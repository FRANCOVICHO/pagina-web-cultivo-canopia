// worker/index.js — Cloudflare Worker proxy hacia Groq API
const GROQ_API_URL      = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL        = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST')   return err('Método no permitido', 405);

    const auth = request.headers.get('Authorization') || '';
    if (!auth) return err('No autorizado', 401);

    const pbUrl = env.POCKETBASE_URL;
    if (!pbUrl) return err('POCKETBASE_URL no configurado', 500);

    try {
      const v = await timeout(fetch(`${pbUrl}/api/collections/users/auth-refresh`,
        { method: 'POST', headers: { Authorization: auth } }), 5000);
      if (!v.ok) return err('Token inválido', 401);
    } catch { return err('No se pudo verificar el token', 401); }

    let body;
    try { body = await request.json(); }
    catch { return err('Body JSON inválido', 400); }

    const groqKey = env.GROQ_API_KEY;
    if (!groqKey) return err('GROQ_API_KEY no configurado', 500);

    const { type } = body;
    const VALID = ['genetics_info','stage_durations','activity_suggestions','plant_diagnosis'];
    if (!VALID.includes(type)) return err(`Tipo desconocido: ${type}`, 400);

    if (type === 'plant_diagnosis') return await diagnosePlant(body, groqKey);
    return await textQuery(type, body, groqKey);
  }
};

// ── Diagnóstico visual (múltiples fotos + diferencial) ────────────────────────

async function diagnosePlant(body, groqKey) {
  const { images_base64, image_base64, stage, genetics, extra_context } = body;
  const imgs = images_base64 || (image_base64 ? [image_base64] : []);
  if (!imgs.length) return err('Se requiere al menos una imagen', 400);

  const sys = `Sos un experto agrónomo especializado en cannabis. Analizás fotos con máxima precisión para detectar enfermedades, deficiencias nutricionales, plagas y problemas. Respondés en español argentino de forma técnica y directa.`;

  const imgContent = imgs.map(b => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b}` } }));

  const textBlock = {
    type: 'text',
    text: `Analizá ${imgs.length > 1 ? `estas ${imgs.length} fotos` : 'esta foto'} de cannabis${genetics ? ` (genética: ${genetics})` : ''}${stage ? `, etapa ${stage}` : ''}.${extra_context ? `\n\nContexto aportado por el cultivador:\n${extra_context}` : ''}

Sos un experto agrónomo. Hacé un diagnóstico profesional completo. Respondé SOLO con JSON válido (sin markdown):
{
  "problema_principal": "nombre del problema más probable",
  "descripcion_general": "descripción de lo que observás globalmente",
  "confiabilidad_general": 85,
  "confiabilidad_factores": {
    "imagen": true,
    "sintomas_aportados": true,
    "datos_cultivo": true,
    "sin_ec": true,
    "sin_foto_enves": true
  },
  "hipotesis": [
    {
      "causa": "nombre de la causa",
      "ranking": "muy_probable",
      "confianza": 85,
      "evidencia_visual": ["síntoma visual 1 observado en la foto", "síntoma visual 2"],
      "evidencia_textual": ["dato aportado por el cultivador que apoya esto"],
      "soluciones": ["paso 1 concreto", "paso 2", "paso 3"]
    },
    {
      "causa": "segunda causa posible",
      "ranking": "posible",
      "confianza": 45,
      "evidencia_visual": ["síntoma visual que lo sugiere"],
      "evidencia_textual": [],
      "soluciones": ["paso 1", "paso 2"]
    }
  ],
  "descartados": [
    {"causa": "enfermedad descartada", "razon": "por qué no es esto"},
    {"causa": "otra causa descartada", "razon": "evidencia en contra"}
  ],
  "informacion_faltante": ["foto del envés", "medición EC", "temperatura", "humedad"],
  "urgencia": "baja|media|alta|critica",
  "prevencion": "cómo evitarlo en el futuro"
}

Valores de ranking permitidos: "muy_probable", "posible", "poco_probable".
Urgencia: "baja", "media", "alta", "critica".
Sé honesto con la confiabilidad — si la imagen es borrosa o falta info, bajá el porcentaje.`
  };

  let res;
  try {
    res = await timeout(fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: [...imgContent, textBlock] }],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    }), 25000);
  } catch { return err('Tiempo agotado para el análisis visual', 504); }

  if (!res.ok) { console.error('Vision error:', await res.text()); return err('Error en la API de visión', 502); }

  const raw = (await res.json())?.choices?.[0]?.message?.content || '';
  let parsed;
  try { const m = raw.match(/\{[\s\S]*\}/); parsed = JSON.parse(m ? m[0] : raw); }
  catch { parsed = { problema_principal: 'Análisis completado', descripcion_general: raw, hipotesis: [], descartados: [], informacion_faltante: [], urgencia: 'media', prevencion: '', confiabilidad_general: 50 }; }

  return ok(parsed);
}

// ── Consultas de texto ────────────────────────────────────────────────────────

async function textQuery(type, body, groqKey) {
  const prompt = buildPrompt(type, body);

  let res;
  try {
    res = await timeout(fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 512 }),
    }), 14000);
  } catch { return err('Tiempo agotado para la IA', 504); }

  if (!res.ok) { console.error('Groq error:', await res.text()); return err('Error en la API de IA', 502); }

  const raw = (await res.json())?.choices?.[0]?.message?.content || '';
  let parsed;
  try { const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw]; parsed = JSON.parse(m[1].trim()); }
  catch { parsed = emptyResponse(type); }

  return ok(normalize(type, parsed));
}

function buildPrompt(type, body) {
  if (type === 'genetics_info') {
    const { genetics } = body;
    if (!genetics) throw new Error('genetics requerido');
    return `Provide technical data for cannabis strain "${genetics}". Respond ONLY with JSON: {"thc_pct":"...","cbd_pct":"...","bank":"...","dominance":"Índica|Sativa|Híbrida","height_cm":"...","notes":"..."}. Use null for unknowns.`;
  }
  if (type === 'stage_durations') {
    const { genetics, flowering_type } = body;
    if (!genetics) throw new Error('genetics requerido');
    return `For ${flowering_type || 'autoflowering'} cannabis strain "${genetics}", estimated grow stage days. Respond ONLY with JSON: {"germination":5,"vegetative":25,"flowering":60,"drying":10}. Integers only.`;
  }
  if (type === 'activity_suggestions') {
    const { stage } = body;
    if (!stage) throw new Error('stage requerido');
    return `Suggest 3-5 care activities for cannabis in "${stage}" stage. Respond ONLY with JSON array of short Spanish strings.`;
  }
  throw new Error('Tipo desconocido');
}

function emptyResponse(type) {
  if (type === 'genetics_info') return { thc_pct: null, cbd_pct: null, bank: null, dominance: null, height_cm: null, notes: null };
  if (type === 'stage_durations') return { germination: 5, vegetative: 25, flowering: 60, drying: 10 };
  return [];
}

function normalize(type, p) {
  if (type === 'genetics_info') return {
    thc_pct: p.thc_pct ?? 'No disponible', cbd_pct: p.cbd_pct ?? 'No disponible',
    bank: p.bank ?? 'No disponible', dominance: p.dominance ?? 'No disponible',
    height_cm: p.height_cm ?? 'No disponible', notes: p.notes ?? 'No disponible',
  };
  if (type === 'stage_durations') return {
    germination: parseInt(p.germination) || 5, vegetative: parseInt(p.vegetative) || 25,
    flowering: parseInt(p.flowering) || 60, drying: parseInt(p.drying) || 10,
  };
  if (type === 'activity_suggestions') return Array.isArray(p) ? p.slice(0,5) : [];
  return p;
}

function timeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

function ok(data) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
