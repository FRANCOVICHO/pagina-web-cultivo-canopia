// worker/index.js
// Cloudflare Worker — Proxy seguro hacia la API de Groq
// La API key de Groq se lee desde variables de entorno (nunca se expone al frontend)
// Requiere: wrangler secret put GROQ_API_KEY
//           wrangler secret put POCKETBASE_URL

const GROQ_API_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL      = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TIMEOUT_MS      = 20000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return jsonError('Método no permitido', 405);
    }

    // ── 1. Validar token PocketBase ─────────────────────────────────────────
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader) return jsonError('No autorizado', 401);

    const pbUrl = env.POCKETBASE_URL;
    if (!pbUrl) return jsonError('Configuración incompleta: POCKETBASE_URL', 500);

    try {
      const verifyRes = await fetchWithTimeout(
        `${pbUrl}/api/collections/users/auth-refresh`,
        { method: 'POST', headers: { 'Authorization': authHeader } },
        5000
      );
      if (!verifyRes.ok) return jsonError('Token inválido o expirado', 401);
    } catch {
      return jsonError('No se pudo verificar el token', 401);
    }

    // ── 2. Parsear body ─────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Body JSON inválido', 400);
    }

    const { type } = body;
    if (!['genetics_info', 'stage_durations', 'activity_suggestions', 'plant_diagnosis'].includes(type)) {
      return jsonError(`Tipo de solicitud desconocido: ${type}`, 400);
    }

    // ── 3. Construir prompt ─────────────────────────────────────────────────
    const groqKey = env.GROQ_API_KEY;
    if (!groqKey) return jsonError('Configuración incompleta: GROQ_API_KEY', 500);

    // Plant diagnosis usa vision model — flujo separado
    if (type === 'plant_diagnosis') {
      const { image_base64, stage, genetics, extra_context } = body;
      if (!image_base64) return jsonError('Campo "image_base64" requerido', 400);
      const systemPrompt = `Sos un experto agrónomo especializado en cultivo de cannabis. Analizás fotos de plantas y detectás enfermedades, deficiencias, plagas y problemas. Respondés en español argentino.`;
      const userContent = [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
        { type: 'text', text: `Analizá esta planta${genetics ? ` (genética: ${genetics})` : ''}${stage ? `, etapa: ${stage}` : ''}.${extra_context ? ` Info extra: ${extra_context}` : ''}\nRespondé SOLO con JSON: {"problema":"...","descripcion":"...","causas":["..."],"soluciones":["..."],"urgencia":"bajo|medio|alto","prevencion":"..."}` }
      ];
      return await callGroqVision(groqKey, systemPrompt, userContent);
    }

    let prompt;
    try {
      prompt = buildPrompt(type, body);
    } catch (e) {
      return jsonError(e.message, 400);
    }

    let groqData;
    try {
      const groqRes = await fetchWithTimeout(
        GROQ_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 512,
          }),
        },
        TIMEOUT_MS
      );

      if (!groqRes.ok) {
        const err = await groqRes.text();
        console.error('Groq error:', err);
        return jsonError('Error en la API de IA', 502);
      }

      groqData = await groqRes.json();
    } catch (e) {
      console.error('Groq fetch error:', e);
      return jsonError('Tiempo de espera agotado para la IA', 504);
    }

    // ── 5. Parsear respuesta del LLM ────────────────────────────────────────
    const rawText = groqData?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      // Extraer JSON de posibles bloques de código markdown
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error('LLM response parse error. Raw:', rawText);
      // Retornar campos vacíos en lugar de fallar
      parsed = buildEmptyResponse(type);
    }

    // ── 6. Normalizar y retornar ────────────────────────────────────────────
    const normalized = normalizeResponse(type, parsed);
    return jsonOk(normalized);
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPrompt(type, body) {
  switch (type) {
    case 'genetics_info': {
      const { genetics } = body;
      if (!genetics) throw new Error('Campo "genetics" requerido');
      return `Provide technical data for cannabis strain "${genetics}". ` +
        `Respond ONLY with valid JSON (no markdown, no explanation) with these exact keys: ` +
        `{"thc_pct":"...","cbd_pct":"...","bank":"...","dominance":"Índica|Sativa|Híbrida","height_cm":"...","notes":"..."}. ` +
        `Use null for unknown fields.`;
    }
    case 'stage_durations': {
      const { genetics, flowering_type } = body;
      if (!genetics) throw new Error('Campo "genetics" requerido');
      return `For ${flowering_type || 'autoflowering'} cannabis strain "${genetics}", ` +
        `provide estimated grow stage durations in days. ` +
        `Respond ONLY with valid JSON: ` +
        `{"germination":5,"vegetative":25,"flowering":60,"drying":10}. ` +
        `Use integers only. No markdown.`;
    }
    case 'plant_diagnosis': {
      const { image_base64, stage, genetics, extra_context } = body;
      if (!image_base64) throw new Error('Campo "image_base64" requerido');

      const systemPrompt = `Eres un experto agrónomo especializado en cultivo de cannabis. 
Analizás fotos de plantas y detectás enfermedades, deficiencias nutricionales, plagas y problemas de cultivo.
Respondés siempre en español argentino de forma clara y directa.
Si te dan contexto adicional (etapa, genética), lo usás para un mejor diagnóstico.`;

      const userContent = [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${image_base64}` }
        },
        {
          type: 'text',
          text: `Analizá esta planta de cannabis${genetics ? ` (genética: ${genetics})` : ''}${stage ? `, en etapa de ${stage}` : ''}.
${extra_context ? `Contexto adicional del cultivador: ${extra_context}` : ''}

Por favor:
1. Identificá el problema principal (enfermedad, plaga, deficiencia, estrés, etc.)
2. Explicá las causas más probables
3. Recomendá soluciones concretas paso a paso
4. Indicá el nivel de urgencia (bajo/medio/alto)

Respondé con JSON en este formato exacto:
{
  "problema": "nombre del problema detectado",
  "descripcion": "descripción detallada de lo que ves",
  "causas": ["causa 1", "causa 2"],
  "soluciones": ["solución 1", "solución 2", "solución 3"],
  "urgencia": "bajo|medio|alto",
  "prevencion": "cómo evitarlo en el futuro"
}`
        }
      ];

      return await callGroqVision(groqKey, systemPrompt, userContent);
    }
      const { stage } = body;
      if (!stage) throw new Error('Campo "stage" requerido');
      return `Suggest 3-5 care activities for a cannabis plant in the "${stage}" stage. ` +
        `Respond ONLY with a JSON array of short Spanish strings, e.g.: ` +
        `["Regar","Revisar pH","Aplicar nutrientes"]. No markdown, no explanation.`;
    }
    default:
      throw new Error('Tipo desconocido');
  }
}

function buildEmptyResponse(type) {
  switch (type) {
    case 'genetics_info':
      return { thc_pct: null, cbd_pct: null, bank: null, dominance: null, height_cm: null, notes: null };
    case 'stage_durations':
      return { germination: 5, vegetative: 25, flowering: 60, drying: 10 };
    case 'activity_suggestions':
      return [];
    default:
      return {};
  }
}

function normalizeResponse(type, parsed) {
  switch (type) {
    case 'genetics_info':
      return {
        thc_pct:   parsed.thc_pct   ?? 'No disponible',
        cbd_pct:   parsed.cbd_pct   ?? 'No disponible',
        bank:      parsed.bank      ?? 'No disponible',
        dominance: parsed.dominance ?? 'No disponible',
        height_cm: parsed.height_cm ?? 'No disponible',
        notes:     parsed.notes     ?? 'No disponible',
      };
    case 'stage_durations':
      return {
        germination: parseInt(parsed.germination) || 5,
        vegetative:  parseInt(parsed.vegetative)  || 25,
        flowering:   parseInt(parsed.flowering)   || 60,
        drying:      parseInt(parsed.drying)      || 10,
      };
    case 'activity_suggestions':
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    default:
      return parsed;
  }
}

async function callGroqVision(groqKey, systemPrompt, userContent) {
  const res = await fetchWithTimeout(
    GROQ_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    },
    TIMEOUT_MS
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Groq vision error:', err);
    return jsonError('Error en la API de visión IA', 502);
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content || '';

  let parsed;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch {
    parsed = {
      problema: 'Análisis completado',
      descripcion: rawText,
      causas: [],
      soluciones: [],
      urgencia: 'medio',
      prevencion: ''
    };
  }

  return jsonOk(parsed);
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
