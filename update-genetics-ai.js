// update-genetics-ai.js
// Actualiza las fichas técnicas de genetics_db usando Groq API
// Uso: node update-genetics-ai.js
//
// Requiere variables de entorno:
//   GROQ_API_KEY=gsk_...
//   PB_URL=https://jeans-statement-wave-transactions.trycloudflare.com
//   PB_EMAIL=francolinaresgonzalez11@gmail.com
//   PB_PASS=Messifranco2009

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PB_URL       = process.env.PB_URL || 'http://localhost:8090';
const PB_EMAIL     = process.env.PB_EMAIL;
const PB_PASS      = process.env.PB_PASS;

if (!GROQ_API_KEY || !PB_EMAIL || !PB_PASS) {
  console.error('Faltan variables de entorno. Ejemplo:');
  console.error('GROQ_API_KEY=gsk_... PB_EMAIL=admin@mail.com PB_PASS=pass node update-genetics-ai.js');
  process.exit(1);
}

async function pbAdminLogin() {
  const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Login admin fallido: ' + JSON.stringify(data));
  return data.token;
}

async function getAllGenetics(token) {
  const res = await fetch(`${PB_URL}/api/collections/genetics_db/records?perPage=200`, {
    headers: { 'Authorization': token }
  });
  const data = await res.json();
  return data.items || [];
}

async function queryGroq(strainName) {
  const prompt = `Provide technical data for cannabis strain "${strainName}". ` +
    `Respond ONLY with valid JSON (no markdown, no explanation) with these exact keys: ` +
    `{"thc_pct":"...","cbd_pct":"...","bank":"...","dominance":"Índica or Sativa or Híbrida","height_cm":"...","notes":"..."}. ` +
    `Use null for unknown fields. Be concise.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 300
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';

  // Extraer JSON del texto
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON en respuesta: ${raw}`);
  return JSON.parse(match[0]);
}

function normalizeDominance(val) {
  if (!val) return null;
  const v = val.toLowerCase();
  if (v.includes('indica') || v.includes('índica')) return 'Índica';
  if (v.includes('sativa')) return 'Sativa';
  if (v.includes('hybrid') || v.includes('híbrida') || v.includes('hibrida')) return 'Híbrida';
  return null;
}

async function updateGenetic(token, id, aiData) {
  const res = await fetch(`${PB_URL}/api/collections/genetics_db/records/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify({
      thc_pct:    aiData.thc_pct    || null,
      cbd_pct:    aiData.cbd_pct    || null,
      bank:       aiData.bank       || null,
      dominance:  normalizeDominance(aiData.dominance),
      height_cm:  aiData.height_cm  || null,
      notes:      aiData.notes      || null,
      ai_generated: true
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('==> Conectando a PocketBase...');
  const token = await pbAdminLogin();
  console.log('==> Token OK');

  const genetics = await getAllGenetics(token);
  console.log(`==> ${genetics.length} genéticas encontradas`);

  for (const g of genetics) {
    try {
      console.log(`\n→ Consultando Groq para: ${g.name}`);
      const aiData = await queryGroq(g.name);
      await updateGenetic(token, g.id, aiData);
      console.log(`  ✅ ${g.name}: THC ${aiData.thc_pct}, CBD ${aiData.cbd_pct}, ${aiData.dominance}`);
    } catch (e) {
      console.error(`  ❌ ${g.name}: ${e.message}`);
    }
    // Esperar 1 segundo entre requests para no superar el rate limit de Groq
    await sleep(1000);
  }

  console.log('\n==> ¡Listo! Todas las genéticas actualizadas.');
}

main().catch(console.error);
