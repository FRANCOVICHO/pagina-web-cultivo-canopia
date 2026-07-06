// ===== ESTADO GLOBAL =====
let currentUser = null;
let plants = [];
let plantToDelete = null;
let openMenuId = null;

// ===== DURACIONES POR DEFECTO =====
const DEFAULT_DURATIONS = {
  autoflowering: { germination: 5, vegetative: 25, flowering: 60, drying: 10 },
  photoperiod:   { germination: 5, vegetative: 42, flowering: 63, drying: 10 }
};

// ===== IMÁGENES POR ETAPA =====
const STAGE_IMAGES = {
  Germinación: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=80',
  Vegetativo:  'https://images.unsplash.com/photo-1535185384036-28bbc8035f28?w=400&q=80',
  Floración:   'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=400&q=80',
  Secado:      'https://images.unsplash.com/photo-1585059895524-72359e06133a?w=400&q=80',
  Cosecha:     'https://images.unsplash.com/photo-1574482620826-f9cb4b8e4ca5?w=400&q=80'
};

// ===== API POCKETBASE =====
const API = {
  async login(email, password) {
    const res = await fetch(`${POCKETBASE_URL}/api/collections/users/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password })
    });
    if (!res.ok) throw new Error('Credenciales incorrectas');
    return res.json();
  },

  async getPlants(token, userId) {
    const res = await fetch(`${POCKETBASE_URL}/api/collections/plants/records?filter=(user="${userId}")&sort=-created`, {
      headers: { 'Authorization': token }
    });
    if (!res.ok) throw new Error('Error al cargar plantas');
    return res.json();
  },

  async createPlant(token, data) {
    const res = await fetch(`${POCKETBASE_URL}/api/collections/plants/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al crear planta');
    return res.json();
  },

  async updatePlant(token, id, data) {
    const res = await fetch(`${POCKETBASE_URL}/api/collections/plants/records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar planta');
    return res.json();
  },

  async deletePlant(token, id) {
    const res = await fetch(`${POCKETBASE_URL}/api/collections/plants/records/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': token }
    });
    if (!res.ok) throw new Error('Error al eliminar planta');
  }
};

// ===== CÁLCULO DE ETAPAS =====
function calcStages(plant) {
  const type = plant.type || 'autoflowering';
  const defaults = DEFAULT_DURATIONS[type];
  const dur = {
    germination: parseInt(plant.dur_germination) || defaults.germination,
    vegetative:  parseInt(plant.dur_vegetative)  || defaults.vegetative,
    flowering:   parseInt(plant.dur_flowering)   || defaults.flowering,
    drying:      parseInt(plant.dur_drying)      || defaults.drying
  };

  const start = new Date(plant.start_date);
  start.setHours(0, 0, 0, 0);

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const germStart  = start;
  const vegStart   = addDays(germStart, dur.germination);
  const florStart  = addDays(vegStart,  dur.vegetative);
  const dryStart   = addDays(florStart, dur.flowering);
  const harvestDate = addDays(dryStart, dur.drying);

  return { dur, germStart, vegStart, florStart, dryStart, harvestDate };
}

function getCurrentStage(stages) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (now < stages.vegStart)   return 'Germinación';
  if (now < stages.florStart)  return 'Vegetativo';
  if (now < stages.dryStart)   return 'Floración';
  if (now < stages.harvestDate) return 'Secado';
  return 'Cosecha';
}

function stageProgress(stages, stageName) {
  const now = new Date(); now.setHours(0,0,0,0);
  const map = {
    'Germinación': { start: stages.germStart, end: stages.vegStart,  total: stages.dur.germination },
    'Vegetativo':  { start: stages.vegStart,  end: stages.florStart, total: stages.dur.vegetative },
    'Floración':   { start: stages.florStart, end: stages.dryStart,  total: stages.dur.flowering },
    'Secado':      { start: stages.dryStart,  end: stages.harvestDate, total: stages.dur.drying }
  };
  const s = map[stageName];
  if (!s) return { pct: 100, dayIn: 0, total: 0 };
  const elapsed = Math.max(0, Math.floor((now - s.start) / 86400000));
  const pct = Math.min(100, Math.round((elapsed / s.total) * 100));
  return { pct, dayIn: elapsed + 1, total: s.total };
}

function formatDate(date) {
  return date.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function daysUntil(date) {
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.ceil((date - now) / 86400000);
}

// ===== RENDER =====
function renderPlants() {
  const grid = document.getElementById('plants-grid');
  const empty = document.getElementById('empty-state');
  const reminders = document.getElementById('reminders-section');

  grid.innerHTML = '';

  if (plants.length === 0) {
    empty.style.display = 'block';
    reminders.style.display = 'none';
    return;
  }

  empty.style.display = 'none';

  plants.forEach(plant => {
    const stages = calcStages(plant);
    const stage = getCurrentStage(stages);
    const prog = stageProgress(stages, stage);
    const now = new Date(); now.setHours(0,0,0,0);
    const isOverdue = now >= stages.harvestDate;
    const daysToHarvest = daysUntil(stages.harvestDate);

    const stageClass = {
      'Germinación': 'stage-germinacion',
      'Vegetativo':  'stage-vegetativo',
      'Floración':   'stage-floracion',
      'Secado':      'stage-secado',
      'Cosecha':     'stage-cosecha'
    }[stage] || 'stage-completado';

    const imgUrl = STAGE_IMAGES[stage] || STAGE_IMAGES['Vegetativo'];
    const weeksOrDays = prog.total >= 14
      ? `${Math.ceil(prog.total/7)} semanas`
      : `${prog.total} días`;

    let alertHTML = '';
    if (isOverdue) {
      alertHTML = `<div class="overdue-alert">🚨 ¡Lista para cosechar!</div>`;
    } else if (stage === 'Floración') {
      alertHTML = `<div class="harvest-alert">🌿 ${daysToHarvest} días para cosecha óptima</div>`;
    }

    const card = document.createElement('div');
    card.className = 'plant-card';
    card.innerHTML = `
      <div class="plant-card-image-placeholder" style="position:relative">
        <img src="${imgUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:0" 
             onerror="this.style.display='none'" alt="${stage}" />
        <span class="stage-badge ${stageClass}">${stage}</span>
      </div>
      <div class="plant-card-body">
        <div class="plant-card-name">${escHtml(plant.name)}</div>
        <div class="plant-card-meta">${escHtml(plant.environment || 'Interior')} • ${weeksOrDays}</div>
        ${alertHTML}
        <div class="progress-label">Día ${prog.dayIn} de ${prog.total}</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${prog.pct}%"></div>
        </div>
      </div>
      <div class="plant-card-footer">
        <button class="btn-link" onclick="openDetailModal('${plant.id}')">Ver detalles</button>
        <div class="card-menu" id="menu-${plant.id}">
          <button class="card-menu-btn" onclick="toggleMenu('${plant.id}', event)">•••</button>
          <div class="card-menu-dropdown" id="dropdown-${plant.id}">
            <button class="card-menu-item" onclick="openEditModal('${plant.id}')">✏️ Editar</button>
            <button class="card-menu-item danger" onclick="confirmDelete('${plant.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  renderReminders();
}

function renderReminders() {
  const section = document.getElementById('reminders-section');
  const list = document.getElementById('reminders-list');
  const items = [];

  plants.forEach(plant => {
    const stages = calcStages(plant);
    const d = daysUntil(stages.harvestDate);
    if (d >= 0 && d <= 7) {
      items.push({
        icon: '💧',
        text: `Cosecha próxima – ${plant.name}`,
        date: d === 0 ? 'Hoy' : `En ${d} días`
      });
    }
  });

  if (items.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = items.map(i => `
    <div class="reminder-item">
      <div class="reminder-info">
        <span class="reminder-icon">${i.icon}</span>
        <div>
          <div class="reminder-text">${escHtml(i.text)}</div>
          <div class="reminder-date">${i.date}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== MODALES =====
function openAddModal() {
  document.getElementById('modal-title').textContent = 'Agregar planta';
  document.getElementById('plant-form').reset();
  document.getElementById('plant-id').value = '';
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('plant-modal').style.display = 'flex';
}

function openEditModal(id) {
  closeAllMenus();
  const plant = plants.find(p => p.id === id);
  if (!plant) return;
  document.getElementById('modal-title').textContent = 'Editar planta';
  document.getElementById('plant-id').value = plant.id;
  document.getElementById('plant-name').value = plant.name;
  document.getElementById('plant-genetics').value = plant.genetics;
  document.getElementById('plant-type').value = plant.type;
  document.getElementById('plant-environment').value = plant.environment || 'Interior';
  document.getElementById('plant-start-date').value = plant.start_date;
  document.getElementById('dur-germination').value = plant.dur_germination || '';
  document.getElementById('dur-vegetative').value = plant.dur_vegetative || '';
  document.getElementById('dur-flowering').value = plant.dur_flowering || '';
  document.getElementById('dur-drying').value = plant.dur_drying || '';
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('plant-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('plant-modal').style.display = 'none';
}

function openDetailModal(id) {
  const plant = plants.find(p => p.id === id);
  if (!plant) return;
  const stages = calcStages(plant);
  const currentStage = getCurrentStage(stages);
  const now = new Date(); now.setHours(0,0,0,0);
  const isOverdue = now >= stages.harvestDate;
  const daysLeft = daysUntil(stages.harvestDate);

  document.getElementById('detail-plant-name').textContent = plant.name;

  const stagesList = [
    { name: 'Germinación', start: stages.germStart,  dur: stages.dur.germination },
    { name: 'Vegetativo',  start: stages.vegStart,   dur: stages.dur.vegetative },
    { name: 'Floración',   start: stages.florStart,  dur: stages.dur.flowering },
    { name: 'Secado',      start: stages.dryStart,   dur: stages.dur.drying }
  ];

  const stagesHTML = stagesList.map(s => `
    <div class="detail-stage-card ${s.name === currentStage ? 'active' : ''}">
      <div class="detail-stage-name">${s.name}</div>
      <div class="detail-stage-date">${formatDate(s.start)}</div>
      <div class="detail-stage-duration">${s.dur} días estimados</div>
    </div>
  `).join('');

  const harvestStatus = isOverdue
    ? `<div class="overdue-alert" style="text-align:center;font-size:14px">🚨 ¡Cosecha lista o urgente!</div>`
    : `<div class="harvest-box">
        <div class="harvest-label">Punto óptimo de cosecha</div>
        <div class="harvest-date">${formatDate(stages.harvestDate)}</div>
        <div class="harvest-days">${daysLeft > 0 ? `Faltan ${daysLeft} días` : 'Es hoy'}</div>
       </div>`;

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-info-row">
      <div class="detail-info-item"><label>Genética</label><span>${escHtml(plant.genetics)}</span></div>
      <div class="detail-info-item"><label>Tipo</label><span>${plant.type === 'autoflowering' ? 'Automática' : 'Fotodependiente'}</span></div>
      <div class="detail-info-item"><label>Ambiente</label><span>${escHtml(plant.environment || 'Interior')}</span></div>
      <div class="detail-info-item"><label>Inicio</label><span>${formatDate(new Date(plant.start_date))}</span></div>
    </div>
    ${harvestStatus}
    <div class="detail-stages">${stagesHTML}</div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn-ghost" onclick="openEditModal('${plant.id}');closeDetailModal()">✏️ Editar</button>
      <button class="btn-danger" onclick="confirmDelete('${plant.id}');closeDetailModal()">🗑️ Eliminar</button>
    </div>
  `;

  document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
}

function confirmDelete(id) {
  closeAllMenus();
  plantToDelete = id;
  document.getElementById('confirm-modal').style.display = 'flex';
}

function closeConfirm() {
  plantToDelete = null;
  document.getElementById('confirm-modal').style.display = 'none';
}

// ===== MENÚ TARJETA =====
function toggleMenu(id, e) {
  e.stopPropagation();
  const dropdown = document.getElementById(`dropdown-${id}`);
  if (openMenuId && openMenuId !== id) closeAllMenus();
  dropdown.classList.toggle('open');
  openMenuId = dropdown.classList.contains('open') ? id : null;
}

function closeAllMenus() {
  document.querySelectorAll('.card-menu-dropdown.open').forEach(d => d.classList.remove('open'));
  openMenuId = null;
}

// ===== LOGIN =====
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    errEl.textContent = 'Completá email y contraseña.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Ingresando...';
  errEl.style.display = 'none';

  try {
    const data = await API.login(email, password);
    currentUser = { token: data.token, id: data.record.id };
    sessionStorage.setItem('pb_token', data.token);
    sessionStorage.setItem('pb_user_id', data.record.id);
    await loadApp();
  } catch (err) {
    errEl.textContent = 'Email o contraseña incorrectos.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
});

// Enter en login
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// ===== CARGAR APP =====
async function loadApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  try {
    const data = await API.getPlants(currentUser.token, currentUser.id);
    plants = data.items || [];
  } catch (e) {
    plants = [];
  }
  renderPlants();
}

// ===== FORM SUBMIT =====
document.getElementById('plant-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('save-btn');
  const errEl = document.getElementById('form-error');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  errEl.style.display = 'none';

  const id = document.getElementById('plant-id').value;
  const payload = {
    user: currentUser.id,
    name: document.getElementById('plant-name').value.trim(),
    genetics: document.getElementById('plant-genetics').value.trim(),
    type: document.getElementById('plant-type').value,
    environment: document.getElementById('plant-environment').value,
    start_date: document.getElementById('plant-start-date').value,
    dur_germination: parseInt(document.getElementById('dur-germination').value) || null,
    dur_vegetative:  parseInt(document.getElementById('dur-vegetative').value)  || null,
    dur_flowering:   parseInt(document.getElementById('dur-flowering').value)   || null,
    dur_drying:      parseInt(document.getElementById('dur-drying').value)      || null
  };

  try {
    if (id) {
      const updated = await API.updatePlant(currentUser.token, id, payload);
      plants = plants.map(p => p.id === id ? updated : p);
    } else {
      const created = await API.createPlant(currentUser.token, payload);
      plants.unshift(created);
    }
    closeModal();
    renderPlants();
  } catch (err) {
    errEl.textContent = 'Error al guardar. Verificá los datos e intentá de nuevo.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar planta';
  }
});

// ===== ELIMINAR =====
document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
  if (!plantToDelete) return;
  try {
    await API.deletePlant(currentUser.token, plantToDelete);
    plants = plants.filter(p => p.id !== plantToDelete);
    closeConfirm();
    renderPlants();
  } catch (err) {
    closeConfirm();
    alert('Error al eliminar la planta.');
  }
});

// ===== LOGOUT =====
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.clear();
  currentUser = null;
  plants = [];
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
});

// ===== ADD PLANT BTN =====
document.getElementById('add-plant-btn').addEventListener('click', openAddModal);

// ===== CERRAR MENÚS AL CLICK FUERA =====
document.addEventListener('click', closeAllMenus);

// ===== CERRAR MODALES CON ESC =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeDetailModal();
    closeConfirm();
    closeAllMenus();
  }
});

// ===== AUTO LOGIN SI HAY SESIÓN =====
(async () => {
  const token = sessionStorage.getItem('pb_token');
  const userId = sessionStorage.getItem('pb_user_id');
  if (token && userId) {
    currentUser = { token, id: userId };
    await loadApp();
  }
})();

// ===== UTILS =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
