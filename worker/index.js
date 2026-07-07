// worker/index.js
// Cloudflare Worker — Proxy seguro hacia la API de Groq

const GROQ_API_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL        = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TIMEOUT_MS        = 20000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
};

const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + 60000;
  } else {
    entry.count++;
  }
  rateLimitMap.set(ip, entry);
  if (rateLimitMap.size > 10000) rateLimitMap.clear();
  return entry.count <= 10; // Max 10 requests per minute per IP
}


export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return jsonError('Método no permitido', 405);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return jsonError('Demasiadas solicitudes. Esperá un minuto.', 429);
    }

    // 1. Validar token PocketBase
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
      
      const pbData = await verifyRes.json();
      if (!pbData.record || pbData.record.id === undefined) {
         return jsonError('Rol o token no autorizado', 403);
      }
    } catch {
      return jsonError('No se pudo verificar el token', 401);
    }

    // 2. Parsear body
    let body;
    try { body = await request.json(); }
    catch { return jsonError('Body JSON inválido', 400); }

    const { type } = body;
    const VALID_TYPES = ['genetics_info', 'stage_durations', 'activity_suggestions', 'plant_diagnosis'];
    if (!VALID_TYPES.includes(type)) {
      return jsonError(`Tipo desconocido: ${type}`, 400);
    }

    const groqKey = env.GROQ_API_KEY;
    if (!groqKey) return jsonError('Configuración incompleta: GROQ_API_KEY', 500);

    // 3. Diagnóstico visual — usa modelo de visión
    if (type === 'plant_diagnosis') {
      return await handleDiagnosis(body, groqKey);
    }

    // 4. Otros tipos — modelo de texto
    let prompt;
    try { prompt = buildPrompt(type, body).slice(0, 2000); } // Límite de largo del prompt (seguridad)
    catch (e) { return jsonError(e.message, 400); }

    let groqData;
    try {
      const res = await fetchWithTimeout(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 512,
        }),
      }, TIMEOUT_MS);

      if (!res.ok) {
        console.error('Groq error:', await res.text());
        return jsonError('Error en la API de IA', 502);
      }
      groqData = await res.json();
    } catch (e) {
      return jsonError('Tiempo de espera agotado para la IA', 504);
    }

    const rawText = groqData?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      const m = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      parsed = JSON.parse(m[1].trim());
    } catch {
      parsed = buildEmptyResponse(type);
    }

    return jsonOk(normalizeResponse(type, parsed));
  }
};

// ── Diagnóstico visual ────────────────────────────────────────────────────────

async function handleDiagnosis(body, groqKey) {
  const { image_base64, stage, genetics, extra_context } = body;
  if (!image_base64) return jsonError('Campo "image_base64" requerido', 400);

  const systemPrompt = `Sos un experto agrónomo especializado en cultivo de cannabis. Analizás fotos de plantas y detectás enfermedades, deficiencias nutricionales, plagas y problemas. Respondés en español argentino de forma clara y directa.`;

  const safeGenetics = genetics ? String(genetics).slice(0, 100).replace(/[^a-zA-Z0-9 -]/g, '') : '';
  const safeStage = stage ? String(stage).slice(0, 50).replace(/[^a-zA-Z0-9 -]/g, '') : '';
  const safeContext = extra_context ? String(extra_context).slice(0, 500) : '';

  const userContent = [
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
    {
      type: 'text',
      text: `Analizá esta planta de cannabis${safeGenetics ? ` (genética: ${safeGenetics})` : ''}${safeStage ? `, etapa: ${safeStage}` : ''}.${safeContext ? ` Info extra del cultivador: ${safeContext}` : ''}

Respondé SOLO con JSON válido (sin markdown):
{"problema":"...","descripcion":"...","causas":["..."],"soluciones":["..."],"urgencia":"bajo|medio|alto","prevencion":"..."}`
    }
  ];

  let res;
  try {
    res = await fetchWithTimeout(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    }, 20000);
  } catch {
    return jsonError('Tiempo de espera agotado para el análisis visual', 504);
  }

  if (!res.ok) {
    console.error('Vision error:', await res.text());
    return jsonError('Error en la API de visión IA', 502);
  }

  const data    = await res.json();
  const rawText = data?.choices?.[0]?.message?.content || '';

  let parsed;
  try {
    const m = rawText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : rawText);
  } catch {
    parsed = { problema: 'Análisis completado', descripcion: rawText, causas: [], soluciones: [], urgencia: 'medio', prevencion: '' };
  }

  return jsonOk(parsed);
}

// ── Text prompts ──────────────────────────────────────────────────────────────

function buildPrompt(type, body) {
  switch (type) {
    case 'genetics_info': {
      const genetics = String(body.genetics || '').slice(0, 100).replace(/[^a-zA-Z0-9 -]/g, '');
      if (!genetics) throw new Error('Campo "genetics" requerido');
      return `Provide technical data for cannabis strain "${genetics}". Respond ONLY with valid JSON: {"thc_pct":"...","cbd_pct":"...","bank":"...","dominance":"Índica|Sativa|Híbrida","height_cm":"...","notes":"..."}. Use null for unknown fields.`;
    }
    case 'stage_durations': {
      const genetics = String(body.genetics || '').slice(0, 100).replace(/[^a-zA-Z0-9 -]/g, '');
      const flowering_type = String(body.flowering_type || '').slice(0, 30);
      if (!genetics) throw new Error('Campo "genetics" requerido');
      return `For ${flowering_type || 'autoflowering'} cannabis strain "${genetics}", provide estimated grow stage durations in days. Respond ONLY with valid JSON: {"germination":5,"vegetative":25,"flowering":60,"drying":10}. Integers only.`;
    }
    case 'activity_suggestions': {
      const stage = String(body.stage || '').slice(0, 50).replace(/[^a-zA-Z0-9 -]/g, '');
      if (!stage) throw new Error('Campo "stage" requerido');
      return `Suggest 3-5 care activities for a cannabis plant in the "${stage}" stage. Respond ONLY with a JSON array of short Spanish strings. No markdown.`;
    }
    default:
      throw new Error('Tipo desconocido');
  }
}

function buildEmptyResponse(type) {
  if (type === 'genetics_info') return { thc_pct: null, cbd_pct: null, bank: null, dominance: null, height_cm: null, notes: null };
  if (type === 'stage_durations') return { germination: 5, vegetative: 25, flowering: 60, drying: 10 };
  return [];
}

function normalizeResponse(type, parsed) {
  if (type === 'genetics_info') return {
    thc_pct: parsed.thc_pct ?? 'No disponible', cbd_pct: parsed.cbd_pct ?? 'No disponible',
    bank: parsed.bank ?? 'No disponible', dominance: parsed.dominance ?? 'No disponible',
    height_cm: parsed.height_cm ?? 'No disponible', notes: parsed.notes ?? 'No disponible',
  };
  if (type === 'stage_durations') return {
    germination: parseInt(parsed.germination) || 5, vegetative: parseInt(parsed.vegetative) || 25,
    flowering: parseInt(parsed.flowering) || 60, drying: parseInt(parsed.drying) || 10,
  };
  if (type === 'activity_suggestions') return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  return parsed;
}

// ── Utils ─────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(id); }
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
