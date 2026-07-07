// ===== ESTADO GLOBAL =====
let currentUser = null;
let plants = [];
let plantToDelete = null;
let openMenuId = null;
let selectedImageFile = null;

// ===== DURACIONES POR DEFECTO =====
// Referencia desde stage-calc.js (window.StageCalc), con fallback inline por si se carga solo.
const DEFAULT_DURATIONS = (window.StageCalc && window.StageCalc.DEFAULT_DURATIONS) || {
  autoflowering: { germination: 5, vegetative: 25, flowering: 60, drying: 10 },
  photoperiod:   { germination: 5, vegetative: 42, flowering: 63, drying: 10 }
};

// ===== IMÁGENES POR ETAPA =====
// Referencia desde stage-calc.js (window.StageCalc), con fallback inline.
const STAGE_IMAGES = (window.StageCalc && window.StageCalc.STAGE_IMAGES) || {
  Germinación: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&q=80',
  Vegetativo:  'https://images.unsplash.com/photo-1535185384036-28bbc8035f28?w=400&q=80',
  Floración:   'https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=400&q=80',
  Secado:      'https://images.unsplash.com/photo-1585059895524-72359e06133a?w=400&q=80',
  Cosecha:     'https://images.unsplash.com/photo-1574482620826-f9cb4b8e4ca5?w=400&q=80'
};

// ===== API POCKETBASE =====
// El objeto API se define en services/api.js y se expone en window.API.
// Este archivo depende de que services/api.js se cargue antes en index.html.

// ===== CÁLCULO DE ETAPAS =====
// Las funciones canónicas viven en services/stage-calc.js (window.StageCalc).
// Aquí se definen como delegados para mantener compatibilidad con el resto de app.js.
function calcStages(plant) {
  return window.StageCalc.calcStages(plant);
}

function getCurrentStage(stages) {
  return window.StageCalc.getCurrentStage(stages);
}

function stageProgress(stages, stageName) {
  return window.StageCalc.stageProgress(stages, stageName);
}

function formatDate(date) {
  return window.StageCalc.formatDate(date);
}

function daysUntil(date) {
  return window.StageCalc.daysUntil(date);
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

    const imgUrl = plant.image
      ? `${POCKETBASE_URL}/api/files/plants/${plant.id}/${plant.image}`
      : STAGE_IMAGES[stage] || STAGE_IMAGES['Vegetativo'];
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
  resetDropZone();
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

  // Mostrar imagen existente si tiene
  resetDropZone();
  if (plant.image) {
    const url = `${POCKETBASE_URL}/api/files/plants/${plant.id}/${plant.image}`;
    showImagePreview(url);
  }

  document.getElementById('plant-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('plant-modal').style.display = 'none';
  selectedImageFile = null;
}

function openDetailModal(id) {
  const plant = plants.find(p => p.id === id);
  if (!plant) return;
  if (window.PlantDetail) {
    PlantDetail.open(plant, plants, currentUser.token, currentUser.id);
  }
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
    currentUser = { token: data.token, id: data.record.id, username: data.record.username || data.record.email };
    sessionStorage.setItem('pb_token', data.token);
    sessionStorage.setItem('pb_user_id', data.record.id);
    sessionStorage.setItem('pb_username', data.record.username || data.record.email || '');
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
  document.getElementById('app').style.display = 'flex';

  try {
    const data = await API.getPlants(currentUser.token, currentUser.id);
    plants = data.items || [];
  } catch (e) {
    plants = [];
  }
  renderPlants();
  setDailyTip();
  switchSection('cultivo');
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

  // Usar FormData para soportar archivos
  const formData = new FormData();
  formData.append('user', currentUser.id);
  formData.append('name', document.getElementById('plant-name').value.trim());
  formData.append('genetics', document.getElementById('plant-genetics').value.trim());
  formData.append('type', document.getElementById('plant-type').value);
  formData.append('environment', document.getElementById('plant-environment').value);
  formData.append('start_date', document.getElementById('plant-start-date').value);

  const durG = parseInt(document.getElementById('dur-germination').value);
  const durV = parseInt(document.getElementById('dur-vegetative').value);
  const durF = parseInt(document.getElementById('dur-flowering').value);
  const durD = parseInt(document.getElementById('dur-drying').value);
  if (!isNaN(durG)) formData.append('dur_germination', durG);
  if (!isNaN(durV)) formData.append('dur_vegetative', durV);
  if (!isNaN(durF)) formData.append('dur_flowering', durF);
  if (!isNaN(durD)) formData.append('dur_drying', durD);

  if (selectedImageFile) formData.append('image', selectedImageFile);

  try {
    if (id) {
      const updated = await API.updatePlant(currentUser.token, id, formData);
      plants = plants.map(p => p.id === id ? updated : p);
    } else {
      const created = await API.createPlant(currentUser.token, formData);
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
    currentUser = { token, id: userId, username: sessionStorage.getItem('pb_username') || '' };
    await loadApp();
  }
})();

// ===== NAVEGACIÓN ENTRE SECCIONES =====
function switchSection(section) {
  ['cultivo', 'estadisticas', 'tareas'].forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.style.display = s === section ? 'block' : 'none';
  });

  // Sync sidebar
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  // Sync bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  const names = { cultivo: 'MI CULTIVO', estadisticas: 'ESTADÍSTICAS', tareas: 'TAREAS' };
  const headerName = document.getElementById('header-section-name');
  if (headerName) headerName.textContent = names[section] || '';

  if (section === 'estadisticas') {
    const container = document.getElementById('stats-container');
    if (container && currentUser) StatsView.render(container, plants, currentUser.token, currentUser.id);
  }
  if (section === 'tareas') {
    const container = document.getElementById('tasks-container');
    if (container && currentUser) TasksView.render(container, plants, currentUser.token, currentUser.id);
  }
}

// ===== DRAG & DROP IMAGEN =====
function initDropZone() {
  const zone = document.getElementById('drop-zone');
  const input = document.getElementById('plant-image-input');
  const removeBtn = document.getElementById('drop-remove');

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleImageFile(input.files[0]);
  });

  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    resetDropZone();
  });
}

function handleImageFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    alert('La imagen supera los 5MB. Elegí una más pequeña.');
    return;
  }
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = e => showImagePreview(e.target.result);
  reader.readAsDataURL(file);
}

function showImagePreview(src) {
  document.getElementById('drop-placeholder').style.display = 'none';
  const preview = document.getElementById('drop-preview');
  preview.src = src;
  preview.style.display = 'block';
  document.getElementById('drop-remove').style.display = 'inline-block';
}

function resetDropZone() {
  selectedImageFile = null;
  document.getElementById('drop-placeholder').style.display = 'flex';
  const preview = document.getElementById('drop-preview');
  preview.src = '';
  preview.style.display = 'none';
  document.getElementById('drop-remove').style.display = 'none';
  document.getElementById('plant-image-input').value = '';
}

// Inicializar drop zone
initDropZone();

// ===== MODAL MI CUENTA =====
function openAccountModal() {
  const modal = document.getElementById('account-modal');
  if (!modal) return;

  // Mostrar username
  const usernameEl = document.getElementById('account-username-display');
  if (usernameEl && currentUser) {
    usernameEl.textContent = currentUser.username || currentUser.id.slice(0, 8);
  }

  // Mostrar cantidad de plantas
  const plantsEl = document.getElementById('acc-plants-count');
  if (plantsEl) plantsEl.textContent = plants.length;

  // Mostrar info de sesión
  const sessionEl = document.getElementById('acc-session-info');
  if (sessionEl) {
    const now = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    sessionEl.textContent = now;
  }

  modal.style.display = 'flex';
}

function closeAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) modal.style.display = 'none';
}

// ===== UTILS =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== TIPS DEL DÍA =====
const TIPS = [
  'La constancia es clave. Pequeños cuidados, grandes resultados.',
  'Revisá el pH del agua antes de regar. Un rango de 6.0–7.0 es ideal.',
  'La temperatura ideal en vegetativo es 22–28°C durante el día.',
  'En floración, reducí el nitrógeno y aumentá el fósforo y potasio.',
  'Buena ventilación previene hongos y fortalece los tallos.',
  'El estrés controlado puede aumentar la producción de resina.',
  'Monitoreá los tricomas con lupa para encontrar el punto óptimo de cosecha.',
  'Un buen sustrato bien drenado es la base de un cultivo sano.',
  'Las plantas necesitan oscuridad total durante la noche en floración fotodependiente.',
  'Registrar cada actividad te ayuda a mejorar en cada cultivo.',
  'La humedad ideal en floración es 40–50% para evitar hongos.',
  'Regá cuando los primeros 2–3 cm del sustrato estén secos.',
  'El entrenamiento LST aumenta los puntos de floración sin estrés severo.',
  'La defoliación estratégica mejora la penetración de luz en la canopia.',
  'Mantené las herramientas de poda limpias y desinfectadas.',
  'El agua de lluvia es ideal por su bajo contenido de sales.',
  'Un buen grow log te permite repetir tus mejores resultados.',
  'Agregá micorrizas al sustrato para mejorar la absorción de nutrientes.',
  'La temperatura del agua de riego debe estar entre 18–22°C.',
  'Controlá los trips y ácaros desde el inicio del cultivo.',
  'El CO₂ extra en el espacio de cultivo puede acelerar el crecimiento.',
  'En secado, apuntá a una humedad del 45–55% y temperatura de 18–22°C.',
  'Lavar las raíces antes de cosechar mejora el sabor final.',
  'El curado en frascos de vidrio potencia el aroma y suavidad.',
  'Usá luz UVB en las últimas semanas para aumentar tricomas.',
  'La poda apical duplica los puntos de floración principales.',
  'Anotá el peso en seco de cada cosecha para comparar genéticas.',
  'Rotá los cultivos para evitar agotamiento del sustrato.',
  'Las deficiencias de magnesio se manifiestan como amarillamiento entre venas.',
  'Un electroconductor (EC) bajo indica poca nutrición disponible.',
  'El periodo de oscuridad continuo es vital en plantas fotodependientes.',
];

function setDailyTip() {
  // Usar fecha completa (año + día del año) para rotar todos los tips
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const idx = dayOfYear % TIPS.length;

  const el  = document.getElementById('tip-text');
  const el2 = document.getElementById('tip-text-mobile');
  if (el)  el.textContent  = TIPS[idx];
  if (el2) el2.textContent = TIPS[idx];
}
