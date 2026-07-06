// views/activity-timeline.js
// Línea de tiempo de actividades por planta + gestión de tipos personalizados
// Expone window.ActivityTimeline

(function () {

  const PREDEFINED_TYPES = ['Regar', 'Fertilizar', 'Poda', 'LST', 'Defoliación', 'Trasplante'];

  // ── Render principal ──────────────────────────────────────────────────────

  async function render(container, plant, token, userId) {
    container.innerHTML = `
      <div class="activity-timeline">
        <div class="at-toolbar">
          <h3 class="section-title">📝 Registro de actividades</h3>
          <button class="btn-primary btn-sm" id="at-add-btn">+ Nueva actividad</button>
        </div>

        <!-- Formulario nueva/editar actividad -->
        <div id="at-form" class="at-form" style="display:none">
          <input type="hidden" id="at-edit-id" />
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de actividad *</label>
              <select id="at-type-select"></select>
              <div id="at-ai-suggestions" class="at-suggestions" style="display:none"></div>
            </div>
            <div class="form-group">
              <label>Fecha *</label>
              <input type="date" id="at-date" value="${todayISO()}" />
            </div>
          </div>
          <div class="form-group">
            <label>Notas (opcional, máx 500 caracteres)</label>
            <textarea id="at-notes" rows="3" maxlength="500" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:#fff;font-family:inherit;resize:vertical"></textarea>
            <div style="text-align:right;font-size:11px;color:var(--gray);margin-top:4px">
              <span id="at-notes-count">0</span>/500
            </div>
          </div>
          <div id="at-form-error" class="error-msg" style="display:none"></div>
          <div class="modal-actions">
            <button class="btn-ghost" id="at-cancel-btn">Cancelar</button>
            <button class="btn-primary" id="at-save-btn">Guardar</button>
          </div>
        </div>

        <!-- Gestión de tipos personalizados -->
        <details class="at-custom-types-section">
          <summary style="cursor:pointer;color:var(--gray);font-size:13px;padding:8px 0">⚙️ Tipos personalizados</summary>
          <div id="at-custom-types-content" style="padding-top:8px"></div>
        </details>

        <!-- Línea de tiempo -->
        <div id="at-timeline" class="at-timeline-list">
          <div class="pd-loading">Cargando actividades...</div>
        </div>
      </div>
    `;

    await loadCustomTypes(token, userId);
    await loadTimeline(plant, token);
    bindEvents(plant, token, userId);
  }

  // ── Línea de tiempo ───────────────────────────────────────────────────────

  async function loadTimeline(plant, token) {
    const container = document.getElementById('at-timeline');
    if (!container) return;
    try {
      const data = await API.getActivities(token, plant.id);
      const activities = (data.items || []).sort((a, b) =>
        b.activity_date.localeCompare(a.activity_date)
      );
      renderTimeline(container, activities, plant, token);
    } catch {
      container.innerHTML = '<div class="pd-empty">Error al cargar actividades.</div>';
    }
  }

  function renderTimeline(container, activities, plant, token) {
    if (activities.length === 0) {
      container.innerHTML = `
        <div class="pd-empty">
          <span style="font-size:36px">📋</span>
          <p>Sin actividades registradas.</p>
        </div>`;
      return;
    }

    container.innerHTML = activities.map(act => {
      const icon = activityIcon(act.activity_type);
      const dateStr = act.activity_date
        ? StageCalc.formatDate(new Date(act.activity_date + 'T00:00:00'))
        : '—';
      return `
        <div class="at-entry" data-id="${act.id}">
          <div class="at-entry-left">
            <span class="at-entry-icon">${icon}</span>
            <div>
              <div class="at-entry-type">${escHtml(act.activity_type)}</div>
              <div class="at-entry-date">${dateStr}</div>
              ${act.notes ? `<div class="at-entry-notes">${escHtml(act.notes)}</div>` : ''}
            </div>
          </div>
          <div class="at-entry-actions">
            <button class="card-menu-btn at-edit-btn" data-id="${act.id}" title="Editar">✏️</button>
            <button class="card-menu-btn at-delete-btn" data-id="${act.id}" title="Eliminar">🗑️</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.at-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = activities.find(a => a.id === btn.dataset.id);
        if (act) openEditForm(act);
      });
    });

    container.querySelectorAll('.at-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteActivity(btn.dataset.id, plant, token));
    });
  }

  // ── Tipos personalizados ──────────────────────────────────────────────────

  let customTypes = [];

  async function loadCustomTypes(token, userId) {
    try {
      const data = await API.getCustomTypes(token, userId);
      customTypes = data.items || [];
    } catch {
      customTypes = [];
    }
    renderCustomTypes(token, userId);
    refreshTypeSelect();
  }

  function renderCustomTypes(token, userId) {
    const container = document.getElementById('at-custom-types-content');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input type="text" id="at-new-type-input" maxlength="50" placeholder="Nuevo tipo (máx 50 caracteres)" style="flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:#fff;font-family:inherit" />
        <button class="btn-primary btn-sm" id="at-add-type-btn">Agregar</button>
      </div>
      <div id="at-type-error" class="error-msg" style="display:none;margin-bottom:8px"></div>
      <div class="at-custom-types-list">
        ${customTypes.length === 0
          ? '<span style="color:var(--gray);font-size:13px">Sin tipos personalizados</span>'
          : customTypes.map(t => `
            <span class="at-custom-type-chip">
              ${escHtml(t.name)}
              <button class="at-remove-type" data-id="${t.id}" title="Eliminar">✕</button>
            </span>`).join('')
        }
      </div>`;

    document.getElementById('at-add-type-btn').addEventListener('click', () =>
      addCustomType(token, userId)
    );

    container.querySelectorAll('.at-remove-type').forEach(btn => {
      btn.addEventListener('click', () => removeCustomType(btn.dataset.id, token, userId));
    });
  }

  async function addCustomType(token, userId) {
    const input = document.getElementById('at-new-type-input');
    const errEl = document.getElementById('at-type-error');
    const name  = input.value.trim();
    errEl.style.display = 'none';

    if (!name) { errEl.textContent = 'Ingresá un nombre.'; errEl.style.display = 'block'; return; }
    if (name.length > 50) { errEl.textContent = 'Máximo 50 caracteres.'; errEl.style.display = 'block'; return; }
    if (customTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      errEl.textContent = 'Ese tipo ya existe.'; errEl.style.display = 'block'; return;
    }

    try {
      await API.createCustomType(token, { name, user: userId });
      input.value = '';
      await loadCustomTypes(token, userId);
    } catch {
      errEl.textContent = 'Error al crear el tipo.'; errEl.style.display = 'block';
    }
  }

  async function removeCustomType(id, token, userId) {
    if (!confirm('¿Eliminar este tipo de actividad?')) return;
    try {
      await API.deleteCustomType(token, id);
      await loadCustomTypes(token, userId);
    } catch {
      alert('Error al eliminar el tipo.');
    }
  }

  function refreshTypeSelect() {
    const sel = document.getElementById('at-type-select');
    if (!sel) return;
    const all = [...PREDEFINED_TYPES, ...customTypes.map(t => t.name)];
    sel.innerHTML = all.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  function bindEvents(plant, token, userId) {
    document.getElementById('at-add-btn').addEventListener('click', () => openAddForm(plant, token));
    document.getElementById('at-cancel-btn').addEventListener('click', () => closeForm());
    document.getElementById('at-save-btn').addEventListener('click', () => saveActivity(plant, token, userId));

    const notesTA = document.getElementById('at-notes');
    notesTA.addEventListener('input', () => {
      document.getElementById('at-notes-count').textContent = notesTA.value.length;
    });
  }

  async function openAddForm(plant, token) {
    document.getElementById('at-edit-id').value = '';
    document.getElementById('at-date').value = todayISO();
    document.getElementById('at-notes').value = '';
    document.getElementById('at-notes-count').textContent = '0';
    document.getElementById('at-form-error').style.display = 'none';
    document.getElementById('at-form').style.display = 'block';

    // Sugerencias de IA
    loadAISuggestions(plant, token);
  }

  function openEditForm(act) {
    document.getElementById('at-edit-id').value = act.id;
    document.getElementById('at-type-select').value = act.activity_type;
    document.getElementById('at-date').value = act.activity_date || todayISO();
    document.getElementById('at-notes').value = act.notes || '';
    document.getElementById('at-notes-count').textContent = (act.notes || '').length;
    document.getElementById('at-form-error').style.display = 'none';
    document.getElementById('at-form').style.display = 'block';
    document.getElementById('at-ai-suggestions').style.display = 'none';
  }

  function closeForm() {
    document.getElementById('at-form').style.display = 'none';
    document.getElementById('at-ai-suggestions').style.display = 'none';
  }

  async function saveActivity(plant, token, userId) {
    const errEl   = document.getElementById('at-form-error');
    const saveBtn = document.getElementById('at-save-btn');
    errEl.style.display = 'none';

    const id           = document.getElementById('at-edit-id').value;
    const activity_type = document.getElementById('at-type-select').value;
    const activity_date = document.getElementById('at-date').value;
    const notes        = document.getElementById('at-notes').value.trim();

    if (!activity_type) { errEl.textContent = 'Seleccioná un tipo de actividad.'; errEl.style.display = 'block'; return; }
    if (!activity_date)  { errEl.textContent = 'Ingresá una fecha.'; errEl.style.display = 'block'; return; }
    if (notes.length > 500) { errEl.textContent = 'Las notas no pueden superar 500 caracteres.'; errEl.style.display = 'block'; return; }

    saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';

    const data = { plant: plant.id, user: userId, activity_type, activity_date, notes: notes || null };

    try {
      if (id) {
        await API.updateActivity(token, id, data);
      } else {
        await API.createActivity(token, data);
      }
      closeForm();
      await loadTimeline(plant, token);
    } catch {
      errEl.textContent = 'Error al guardar. Intentá de nuevo.';
      errEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Guardar';
    }
  }

  async function deleteActivity(id, plant, token) {
    if (!confirm('¿Eliminar esta actividad?')) return;
    try {
      await API.deleteActivity(token, id);
      await loadTimeline(plant, token);
    } catch {
      alert('Error al eliminar la actividad.');
    }
  }

  // ── Sugerencias IA ────────────────────────────────────────────────────────

  async function loadAISuggestions(plant, token) {
    if (!window.AI || !window.StageCalc) return;
    const sugContainer = document.getElementById('at-ai-suggestions');
    sugContainer.innerHTML = '<span style="color:var(--gray);font-size:12px">🤖 Cargando sugerencias...</span>';
    sugContainer.style.display = 'block';

    try {
      const stages = StageCalc.calcStages(plant);
      const stage  = StageCalc.getCurrentStage(stages);
      const suggestions = await AI.getActivitySuggestions(token, stage);
      if (!suggestions || suggestions.length === 0) { sugContainer.style.display = 'none'; return; }

      sugContainer.innerHTML = `<span style="font-size:12px;color:var(--gray);display:block;margin-bottom:6px">🤖 Sugerencias de IA para la etapa ${escHtml(stage)}:</span>` +
        suggestions.map(s => `<button class="at-suggestion-chip" data-val="${escHtml(s)}">${escHtml(s)}</button>`).join('');

      sugContainer.querySelectorAll('.at-suggestion-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const sel = document.getElementById('at-type-select');
          // Agregar opción si no existe
          if (![...sel.options].some(o => o.value === btn.dataset.val)) {
            sel.add(new Option(btn.dataset.val, btn.dataset.val));
          }
          sel.value = btn.dataset.val;
        });
      });
    } catch {
      sugContainer.style.display = 'none';
    }
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  function activityIcon(type) {
    const map = { 'Regar': '💧', 'Fertilizar': '🌱', 'Poda': '✂️', 'LST': '🪢', 'Defoliación': '🍃', 'Trasplante': '🪴' };
    return map[type] || '📋';
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.ActivityTimeline = { render };

})();
