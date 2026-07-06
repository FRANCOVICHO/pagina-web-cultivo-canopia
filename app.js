// ===== Configuración PocketBase =====
// La URL del tunnel de Cloudflare — actualizá esto si cambia
const PB_URL = 'https://jeans-statement-wave-transactions.trycloudflare.com';
const COLLECTION = 'plants';

// ===== Duraciones por defecto (días) =====
const DEFAULTS = {
  auto: { germ: 5, veg: 25, flower: 60, dry: 10 },
  photo: { germ: 5, veg: 42, flower: 63, dry: 10 }
};

// ===== Estado local =====
let plants = [];
let editingId = null;
let deletingId = null;

// ===== Auth token =====
let authToken = localStorage.getItem('pb_token') || null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  await ensureAuth();
  await loadPlants();
});

// ===== Autenticación admin =====
async function ensureAuth() {
  if (authToken) return;
  try {
    const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'francolinaresgonzalez11@gmail.com',
        password: 'Messifranco2009'
      })
    });
    const data = await res.json();
    if (data.token) {
      authToken = data.token;
      localStorage.setItem('pb_token', authToken);
    }
  } catch (e) {
    showToast('No se pudo conectar al servidor. Verificá la conexión.', 'error');
  }
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': authToken || ''
  };
}

// ===== CRUD PocketBase =====
async function loadPlants() {
  try {
    const res = await fetch(`${PB_URL}/api/collections/${COLLECTION}/records?sort=-created&perPage=200`, {
      headers: headers()
    });
    if (res.status === 404) {
      // Colección no existe aún, la creamos
      await createCollection();
      plants = [];
    } else {
      const data = await res.json();
      plants = data.items || [];
    }
  } catch (e) {
    showToast('Error al cargar plantas. Verificá la conexión.', 'error');
    plants = [];
  }
  renderPlants();
}

async function createCollection() {
  // Crear la colección plants en PocketBase
  try {
    await fetch(`${PB_URL}/api/collections`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: COLLECTION,
        type: 'base',
        schema: [
          { name: 'name', type: 'text', required: true },
          { name: 'genetics', type: 'text', required: true },
          { name: 'floweringType', type: 'select', options: { values: ['auto', 'photo'] }, required: true },
          { name: 'startDate', type: 'text', required: true },
          { name: 'durGerm', type: 'number' },
          { name: 'durVeg', type: 'number' },
          { name: 'durFlower', type: 'number' },
          { name: 'durDry', type: 'number' }
        ]
      })
    });
  } catch (e) {
    console.error('Error creando colección:', e);
  }
}

async function savePlant(plantData) {
  const url = editingId
    ? `${PB_URL}/api/collections/${COLLECTION}/records/${editingId}`
    : `${PB_URL}/api/collections/${COLLECTION}/records`;
  const method = editingId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: headers(),
    body: JSON.stringify(plantData)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Error al guardar');
  }
  return await res.json();
}

async function deletePlant(id) {
  const res = await fetch(`${PB_URL}/api/collections/${COLLECTION}/records/${id}`, {
    method: 'DELETE',
    headers: headers()
  });
  if (!res.ok) throw new Error('Error al eliminar');
}

// ===== Cálculo de fechas =====
function calcDates(startDate, type, custom = {}) {
  const defaults = DEFAULTS[type] || DEFAULTS.auto;
  const germ   = parseInt(custom.durGerm)   || defaults.germ;
  const veg    = parseInt(custom.durVeg)    || defaults.veg;
  const flower = parseInt(custom.durFlower) || defaults.flower;
  const dry    = parseInt(custom.durDry)    || defaults.dry;

  const start = new Date(startDate);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  const germStart  = start;
  const vegStart   = addDays(start, germ);
  const flowerStart = addDays(vegStart, veg);
  const dryStart   = addDays(flowerStart, flower);
  const harvest    = addDays(dryStart, dry);

  return { germStart, vegStart, flowerStart, dryStart, harvest };
}

function getActiveStage(dates) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (now >= dates.harvest)    return 'harvested';
  if (now >= dates.dryStart)   return 'dry';
  if (now >= dates.flowerStart) return 'flower';
  if (now >= dates.vegStart)   return 'veg';
  return 'germ';
}

function fmtDate(d) {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysUntil(target) {
  const now = new Date(); now.setHours(0,0,0,0);
  const t = new Date(target); t.setHours(0,0,0,0);
  return Math.round((t - now) / 86400000);
}

// ===== Render =====
function renderPlants() {
  const grid = document.getElementById('plantsGrid');
  const empty = document.getElementById('emptyState');

  if (plants.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = plants.map(p => renderCard(p)).join('');
}

function renderCard(plant) {
  const dates = calcDates(plant.startDate, plant.floweringType, {
    durGerm: plant.durGerm, durVeg: plant.durVeg,
    durFlower: plant.durFlower, durDry: plant.durDry
  });
  const active = getActiveStage(dates);
  const typeLabel = plant.floweringType === 'auto' ? 'Automática' : 'Fotodependiente';

  const stages = [
    { key: 'germ',   icon: '🌱', name: 'Germinación', date: dates.germStart },
    { key: 'veg',    icon: '🌿', name: 'Vegetativo',  date: dates.vegStart },
    { key: 'flower', icon: '🌸', name: 'Floración',   date: dates.flowerStart },
    { key: 'dry',    icon: '🏠', name: 'Secado',      date: dates.dryStart },
  ];

  const stageOrder = ['germ','veg','flower','dry','harvested'];
  const activeIdx = stageOrder.indexOf(active);

  const stagesHtml = stages.map(s => {
    const sIdx = stageOrder.indexOf(s.key);
    let cls = 'future', badge = `<span class="stage-badge badge-pending">Pendiente</span>`;
    if (s.key === active) {
      cls = 'active';
      badge = `<span class="stage-badge badge-active">En curso</span>`;
    } else if (sIdx < activeIdx) {
      cls = 'past';
      badge = `<span class="stage-badge badge-done">✓ Lista</span>`;
    }
    return `
      <div class="stage ${cls}">
        <span class="stage-icon">${s.icon}</span>
        <div class="stage-info">
          <div class="stage-name">${s.name}</div>
          <div class="stage-date">Desde ${fmtDate(s.date)}</div>
        </div>
        ${badge}
      </div>`;
  }).join('');

  // Harvest info
  let harvestHtml = '';
  const daysLeft = daysUntil(dates.harvest);
  if (active === 'harvested') {
    harvestHtml = `
      <div class="harvest-info urgent">
        <span class="harvest-icon">🚨</span>
        <div class="harvest-text">
          <div class="harvest-label">Cosecha</div>
          <div class="harvest-value">¡Lista hace ${Math.abs(daysLeft)} días!</div>
        </div>
      </div>`;
  } else if (active === 'dry') {
    harvestHtml = `
      <div class="harvest-info ready">
        <span class="harvest-icon">✂️</span>
        <div class="harvest-text">
          <div class="harvest-label">Punto óptimo de cosecha</div>
          <div class="harvest-value">${fmtDate(dates.harvest)} — en ${daysLeft} días</div>
        </div>
      </div>`;
  } else if (active === 'flower') {
    harvestHtml = `
      <div class="harvest-info countdown">
        <span class="harvest-icon">⏳</span>
        <div class="harvest-text">
          <div class="harvest-label">Cosecha estimada en</div>
          <div class="harvest-value">${daysLeft} días — ${fmtDate(dates.harvest)}</div>
        </div>
      </div>`;
  } else {
    harvestHtml = `
      <div class="harvest-info">
        <span class="harvest-icon">🗓️</span>
        <div class="harvest-text">
          <div class="harvest-label">Cosecha estimada</div>
          <div class="harvest-value">${fmtDate(dates.harvest)}</div>
        </div>
      </div>`;
  }

  return `
    <div class="plant-card" data-id="${plant.id}">
      <div class="card-header">
        <div>
          <div class="card-title">${escHtml(plant.name)}</div>
          <div class="card-genetics">🧬 ${escHtml(plant.genetics)} · ${typeLabel}</div>
        </div>
        <div class="card-actions">
          <button class="btn-icon" onclick="openEdit('${plant.id}')" title="Editar">✏️</button>
          <button class="btn-icon delete" onclick="openDelete('${plant.id}')" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="stages">${stagesHtml}</div>
      ${harvestHtml}
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== Modal form =====
function openModal(plant = null) {
  editingId = plant ? plant.id : null;
  document.getElementById('modalTitle').textContent = plant ? 'Editar planta' : 'Nueva planta';
  document.getElementById('plantId').value = plant?.id || '';
  document.getElementById('plantName').value = plant?.name || '';
  document.getElementById('plantGenetics').value = plant?.genetics || '';
  document.getElementById('floweringType').value = plant?.floweringType || '';
  document.getElementById('startDate').value = plant?.startDate || '';
  document.getElementById('durGerm').value = plant?.durGerm || '';
  document.getElementById('durVeg').value = plant?.durVeg || '';
  document.getElementById('durFlower').value = plant?.durFlower || '';
  document.getElementById('durDry').value = plant?.durDry || '';
  clearErrors();
  document.getElementById('modalOverlay').style.display = 'flex';
}

function openEdit(id) {
  const plant = plants.find(p => p.id === id);
  if (plant) openModal(plant);
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  editingId = null;
}

function openDelete(id) {
  deletingId = id;
  document.getElementById('deleteOverlay').style.display = 'flex';
}

function closeDelete() {
  document.getElementById('deleteOverlay').style.display = 'none';
  deletingId = null;
}

function clearErrors() {
  ['errName','errGenetics','errFlowering','errDate'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  ['plantName','plantGenetics','floweringType','startDate'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

function validateForm() {
  clearErrors();
  let valid = true;
  const checks = [
    { field: 'plantName',     err: 'errName',     msg: 'El nombre es obligatorio.' },
    { field: 'plantGenetics', err: 'errGenetics',  msg: 'La genética es obligatoria.' },
    { field: 'floweringType', err: 'errFlowering', msg: 'Seleccioná un tipo de floración.' },
    { field: 'startDate',     err: 'errDate',      msg: 'La fecha de inicio es obligatoria.' },
  ];
  checks.forEach(({ field, err, msg }) => {
    const el = document.getElementById(field);
    if (!el.value.trim()) {
      document.getElementById(err).textContent = msg;
      el.classList.add('error');
      valid = false;
    }
  });
  return valid;
}

// ===== Events =====
function setupEvents() {
  document.getElementById('btnAdd').addEventListener('click', () => openModal());
  document.getElementById('btnCloseModal').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnCancelDelete').addEventListener('click', closeDelete);

  document.getElementById('plantForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const btn = e.target.querySelector('.btn-save');
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    const plantData = {
      name:          document.getElementById('plantName').value.trim(),
      genetics:      document.getElementById('plantGenetics').value.trim(),
      floweringType: document.getElementById('floweringType').value,
      startDate:     document.getElementById('startDate').value,
      durGerm:       parseInt(document.getElementById('durGerm').value) || null,
      durVeg:        parseInt(document.getElementById('durVeg').value) || null,
      durFlower:     parseInt(document.getElementById('durFlower').value) || null,
      durDry:        parseInt(document.getElementById('durDry').value) || null,
    };

    try {
      const saved = await savePlant(plantData);
      if (editingId) {
        plants = plants.map(p => p.id === editingId ? saved : p);
        showToast('Planta actualizada ✓', 'success');
      } else {
        plants.unshift(saved);
        showToast('Planta registrada ✓', 'success');
      }
      closeModal();
      renderPlants();
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      btn.textContent = 'Guardar planta';
      btn.disabled = false;
    }
  });

  document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
    if (!deletingId) return;
    try {
      await deletePlant(deletingId);
      plants = plants.filter(p => p.id !== deletingId);
      closeDelete();
      renderPlants();
      showToast('Planta eliminada', 'success');
    } catch (err) {
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  });

  // Cerrar modal clickeando overlay
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('deleteOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDelete();
  });
}

// ===== Toast =====
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
