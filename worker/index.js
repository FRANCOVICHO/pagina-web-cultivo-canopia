// worker/index.js
// Cloudflare Worker — Proxy seguro hacia la API de Groq
// La API key de Groq se lee desde variables de entorno (nunca se expone al frontend)
// Requiere: wrangler secret put GROQ_API_KEY
//           wrangler secret put POCKETBASE_URL

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const TIMEOUT_MS   = 14000;

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
    if (!['genetics_info', 'stage_durations', 'activity_suggestions'].includes(type)) {
      return jsonError(`Tipo de solicitud desconocido: ${type}`, 400);
    }

    // ── 3. Construir prompt ─────────────────────────────────────────────────
    let prompt;
    try {
      prompt = buildPrompt(type, body);
    } catch (e) {
      return jsonError(e.message, 400);
    }

    // ── 4. Llamar a Groq ───────────────────────────────────────────────────
    const groqKey = env.GROQ_API_KEY;
    if (!groqKey) return jsonError('Configuración incompleta: GROQ_API_KEY', 500);

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
    case 'activity_suggestions': {
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
