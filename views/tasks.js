// views/tasks.js
// Vista de tareas Hoy / Mañana / Esta semana + CRUD
// Expone window.TasksView

(function () {

  async function render(container, plants, token, userId) {
    container.innerHTML = `
      <div class="tasks-view">
        <div class="at-toolbar">
          <h3 class="section-title">✅ Próximas tareas</h3>
          <button class="btn-primary btn-sm" id="tv-add-btn">+ Nueva tarea</button>
        </div>

        <div id="tv-form" class="at-form" style="display:none">
          <input type="hidden" id="tv-edit-id" />
          <div class="form-row">
            <div class="form-group">
              <label>Planta *</label>
              <select id="tv-plant-select">
                ${plants.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Actividad *</label>
              <input type="text" id="tv-activity" placeholder="Ej: Regar, Fertilizar..." maxlength="100" />
            </div>
            <div class="form-group">
              <label>Fecha programada *</label>
              <input type="date" id="tv-date" value="${todayISO()}" />
            </div>
          </div>
          <div id="tv-form-error" class="error-msg" style="display:none"></div>
          <div class="modal-actions">
            <button class="btn-ghost" id="tv-cancel-btn">Cancelar</button>
            <button class="btn-primary" id="tv-save-btn">Guardar</button>
          </div>
        </div>

        <div id="tv-sections"></div>
      </div>
    `;

    bindEvents(plants, token, userId);
    await loadTasks(plants, token, userId);
  }

  async function loadTasks(plants, token, userId) {
    const sectionsEl = document.getElementById('tv-sections');
    if (!sectionsEl) return;
    try {
      const data  = await API.getTasks(token, userId);
      const tasks = (data.items || []).filter(t => !t.completed);
      renderSections(sectionsEl, tasks, plants, token, userId);
    } catch {
      sectionsEl.innerHTML = '<div class="pd-empty">Error al cargar tareas.</div>';
    }
  }

  function renderSections(container, tasks, plants, token, userId) {
    const today    = todayISO();
    const tomorrow = addDaysISO(today, 1);
    const weekEnd  = addDaysISO(today, 7);

    const grouped = {
      hoy:     tasks.filter(t => t.scheduled_date === today),
      manana:  tasks.filter(t => t.scheduled_date === tomorrow),
      semana:  tasks.filter(t => t.scheduled_date > tomorrow && t.scheduled_date <= weekEnd),
      vencidas: tasks.filter(t => t.scheduled_date < today)
    };

    const sections = [
      { key: 'vencidas', label: '⚠️ Vencidas',   cls: 'overdue' },
      { key: 'hoy',      label: '📅 Hoy',          cls: '' },
      { key: 'manana',   label: '🌅 Mañana',        cls: '' },
      { key: 'semana',   label: '📆 Esta semana',   cls: '' },
    ];

    container.innerHTML = sections.filter(s => grouped[s.key].length > 0).map(s => `
      <div class="tv-section">
        <div class="tv-section-title ${s.cls}">${s.label} <span class="tv-count">${grouped[s.key].length}</span></div>
        ${grouped[s.key].map(t => renderTask(t, plants)).join('')}
      </div>`).join('') || `<div class="pd-empty"><span style="font-size:40px">✅</span><p>Sin tareas próximas.</p></div>`;

    container.querySelectorAll('.tv-complete-btn').forEach(btn => {
      btn.addEventListener('click', () => completeTask(btn.dataset.id, token, plants, userId));
    });
    container.querySelectorAll('.tv-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const task = tasks.find(t => t.id === btn.dataset.id);
        if (task) openEditForm(task, plants);
      });
    });
    container.querySelectorAll('.tv-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteTask(btn.dataset.id, token, plants, userId));
    });
  }

  function renderTask(task, plants) {
    const plant = plants.find(p => p.id === task.plant);
    const plantName = plant ? plant.name : 'Planta';
    const dateStr = task.scheduled_date
      ? StageCalc.formatDate(new Date(task.scheduled_date + 'T00:00:00'))
      : '—';
    const isOverdue = task.scheduled_date < todayISO();
    return `
      <div class="tv-task ${isOverdue ? 'tv-task-overdue' : ''}">
        <div class="tv-task-info">
          <div class="tv-task-activity">${escHtml(task.activity_type)}</div>
          <div class="tv-task-meta">${escHtml(plantName)} · ${dateStr}</div>
        </div>
        <div class="tv-task-actions">
          <button class="btn-primary btn-xs tv-complete-btn" data-id="${task.id}" title="Marcar completada">✓</button>
          <button class="card-menu-btn tv-edit-btn" data-id="${task.id}" title="Editar">✏️</button>
          <button class="card-menu-btn tv-delete-btn" data-id="${task.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
  }

  function bindEvents(plants, token, userId) {
    document.getElementById('tv-add-btn').addEventListener('click', openAddForm);
    document.getElementById('tv-cancel-btn').addEventListener('click', () => {
      document.getElementById('tv-form').style.display = 'none';
    });
    document.getElementById('tv-save-btn').addEventListener('click', () => saveTask(plants, token, userId));
  }

  function openAddForm() {
    document.getElementById('tv-edit-id').value = '';
    document.getElementById('tv-activity').value = '';
    document.getElementById('tv-date').value = todayISO();
    document.getElementById('tv-form-error').style.display = 'none';
    document.getElementById('tv-form').style.display = 'block';
  }

  function openEditForm(task, plants) {
    document.getElementById('tv-edit-id').value = task.id;
    document.getElementById('tv-plant-select').value = task.plant;
    document.getElementById('tv-activity').value = task.activity_type;
    document.getElementById('tv-date').value = task.scheduled_date || todayISO();
    document.getElementById('tv-form-error').style.display = 'none';
    document.getElementById('tv-form').style.display = 'block';
  }

  async function saveTask(plants, token, userId) {
    const errEl   = document.getElementById('tv-form-error');
    const saveBtn = document.getElementById('tv-save-btn');
    errEl.style.display = 'none';

    const id             = document.getElementById('tv-edit-id').value;
    const plant          = document.getElementById('tv-plant-select').value;
    const activity_type  = document.getElementById('tv-activity').value.trim();
    const scheduled_date = document.getElementById('tv-date').value;

    if (!activity_type)  { errEl.textContent = 'Ingresá el tipo de actividad.'; errEl.style.display = 'block'; return; }
    if (!scheduled_date) { errEl.textContent = 'Ingresá una fecha.'; errEl.style.display = 'block'; return; }

    saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
    const data = { plant, user: userId, activity_type, scheduled_date, completed: false };

    try {
      if (id) { await API.updateTask(token, id, data); }
      else    { await API.createTask(token, data); }
      document.getElementById('tv-form').style.display = 'none';
      await loadTasks(plants, token, userId);
    } catch {
      errEl.textContent = 'Error al guardar.'; errEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Guardar';
    }
  }

  async function completeTask(id, token, plants, userId) {
    try {
      await API.updateTask(token, id, { completed: true, completed_date: todayISO() });
      await loadTasks(plants, token, userId);
    } catch { alert('Error al completar la tarea.'); }
  }

  async function deleteTask(id, token, plants, userId) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await API.deleteTask(token, id);
      await loadTasks(plants, token, userId);
    } catch { alert('Error al eliminar la tarea.'); }
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function addDaysISO(iso, n) {
    const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.TasksView = { render };

})();
