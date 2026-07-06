// views/genetics-card.js
// Ficha técnica de genética con búsqueda en BD y enriquecimiento IA
// Expone window.GeneticsCard

(function () {

  async function render(container, plant, token) {
    container.innerHTML = `
      <div class="genetics-card">
        <div class="at-toolbar">
          <h3 class="section-title">🧬 Ficha técnica — ${escHtml(plant.genetics)}</h3>
          <button class="btn-ghost btn-sm" id="gc-edit-btn" style="display:none">✏️ Editar</button>
        </div>
        <div id="gc-content"><div class="pd-loading">Buscando información genética...</div></div>
      </div>`;

    await loadGenetics(plant, token);
  }

  async function loadGenetics(plant, token) {
    const content = document.getElementById('gc-content');
    let genetics = null;
    let geneticsId = null;

    // 1. Buscar en BD local
    try {
      const data = await API.getGenetics(token, plant.genetics);
      const exact = (data.items || []).find(g =>
        g.name.toLowerCase() === plant.genetics.toLowerCase()
      );
      if (exact) { genetics = exact; geneticsId = exact.id; }
    } catch { /* continúa */ }

    // 2. Si no existe, consultar IA
    if (!genetics && window.AI) {
      content.innerHTML = '<div class="pd-loading">🤖 Consultando IA para obtener datos de la genética...</div>';
      try {
        const aiData = await AI.getGeneticsInfo(token, plant.genetics);
        if (aiData && !aiData.error) {
          const created = await API.createGenetics(token, {
            name:        plant.genetics,
            thc_pct:    aiData.thc_pct    || null,
            cbd_pct:    aiData.cbd_pct    || null,
            bank:       aiData.bank       || null,
            dominance:  normalizeDominance(aiData.dominance),
            height_cm:  aiData.height_cm  || null,
            notes:      aiData.notes      || null,
            ai_generated: true
          });
          genetics = created; geneticsId = created.id;
        }
      } catch { /* IA no disponible */ }
    }

    renderCard(content, genetics, geneticsId, plant, token);
  }

  function normalizeDominance(val) {
    if (!val) return null;
    const v = val.toLowerCase();
    if (v.includes('indica') || v.includes('índica')) return 'Índica';
    if (v.includes('sativa')) return 'Sativa';
    if (v.includes('hybrid') || v.includes('híbrida') || v.includes('hibrida')) return 'Híbrida';
    return null;
  }

  function renderCard(content, genetics, geneticsId, plant, token) {
    const na = 'No disponible';
    const fields = genetics ? [
      { label: 'THC%',       value: genetics.thc_pct   || na },
      { label: 'CBD%',       value: genetics.cbd_pct   || na },
      { label: 'Banco',      value: genetics.bank      || na },
      { label: 'Dominancia', value: genetics.dominance || na },
      { label: 'Altura',     value: genetics.height_cm ? `${genetics.height_cm} cm` : na },
    ] : [];

    content.innerHTML = genetics ? `
      <div class="gc-fields">
        ${fields.map(f => `
          <div class="gc-field">
            <span class="gc-field-label">${f.label}</span>
            <span class="gc-field-value">${escHtml(String(f.value))}</span>
          </div>`).join('')}
      </div>
      ${genetics.notes ? `<div class="gc-notes">${escHtml(genetics.notes)}</div>` : ''}
      ${genetics.ai_generated ? '<div style="font-size:11px;color:var(--gray);margin-top:8px">🤖 Datos generados por IA. Podés editarlos manualmente.</div>' : ''}
      <div id="gc-edit-form" style="display:none;margin-top:20px"></div>
    ` : `
      <div class="pd-empty">
        <span style="font-size:36px">🧬</span>
        <p>No se encontró información para "${escHtml(plant.genetics)}".</p>
        <button class="btn-primary" id="gc-manual-add-btn">+ Agregar manualmente</button>
      </div>
      <div id="gc-edit-form" style="display:none;margin-top:20px"></div>
    `;

    const editBtn = document.getElementById('gc-edit-btn');
    if (editBtn && genetics) editBtn.style.display = 'inline-flex';

    if (editBtn) {
      editBtn.addEventListener('click', () => showEditForm(genetics, geneticsId, plant, token));
    }

    const manualBtn = document.getElementById('gc-manual-add-btn');
    if (manualBtn) {
      manualBtn.addEventListener('click', () => showEditForm(null, null, plant, token));
    }
  }

  function showEditForm(genetics, geneticsId, plant, token) {
    const formContainer = document.getElementById('gc-edit-form');
    if (!formContainer) return;

    const dominanceOptions = ['', 'Índica', 'Sativa', 'Híbrida'];
    formContainer.innerHTML = `
      <h4 style="margin-bottom:12px">${geneticsId ? 'Editar' : 'Agregar'} ficha técnica</h4>
      <div class="form-row">
        <div class="form-group"><label>THC%</label>
          <input type="text" id="gc-thc" value="${escHtml(genetics?.thc_pct || '')}" placeholder="Ej: 20-25%" /></div>
        <div class="form-group"><label>CBD%</label>
          <input type="text" id="gc-cbd" value="${escHtml(genetics?.cbd_pct || '')}" placeholder="Ej: 0.5-1%" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Banco</label>
          <input type="text" id="gc-bank" value="${escHtml(genetics?.bank || '')}" placeholder="Ej: Barney's Farm" /></div>
        <div class="form-group"><label>Dominancia</label>
          <select id="gc-dominance">
            ${dominanceOptions.map(d => `<option value="${d}" ${genetics?.dominance === d ? 'selected' : ''}>${d || '— seleccionar —'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Altura estimada (cm)</label>
          <input type="text" id="gc-height" value="${escHtml(genetics?.height_cm || '')}" placeholder="Ej: 100-120" /></div>
      </div>
      <div class="form-group"><label>Notas</label>
        <textarea id="gc-notes" rows="3" maxlength="1000" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:#fff;font-family:inherit;resize:vertical">${escHtml(genetics?.notes || '')}</textarea>
      </div>
      <div id="gc-save-error" class="error-msg" style="display:none"></div>
      <div class="modal-actions">
        <button class="btn-ghost" id="gc-cancel-edit">Cancelar</button>
        <button class="btn-primary" id="gc-save-genetics">Guardar</button>
      </div>`;

    formContainer.style.display = 'block';

    document.getElementById('gc-cancel-edit').addEventListener('click', () => {
      formContainer.style.display = 'none';
    });

    document.getElementById('gc-save-genetics').addEventListener('click', async () => {
      const errEl   = document.getElementById('gc-save-error');
      const saveBtn = document.getElementById('gc-save-genetics');
      errEl.style.display = 'none';
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';

      const payload = {
        name:       plant.genetics,
        thc_pct:   document.getElementById('gc-thc').value.trim()       || null,
        cbd_pct:   document.getElementById('gc-cbd').value.trim()       || null,
        bank:      document.getElementById('gc-bank').value.trim()      || null,
        dominance: document.getElementById('gc-dominance').value        || null,
        height_cm: document.getElementById('gc-height').value.trim()    || null,
        notes:     document.getElementById('gc-notes').value.trim()     || null,
        ai_generated: false
      };

      try {
        if (geneticsId) {
          await API.updateGenetics(token, geneticsId, payload);
        } else {
          await API.createGenetics(token, payload);
        }
        // Recargar la vista
        const gc = document.querySelector('.genetics-card');
        if (gc) await render(gc, plant, token);
      } catch {
        errEl.textContent = 'Error al guardar.'; errEl.style.display = 'block';
        saveBtn.disabled = false; saveBtn.textContent = 'Guardar';
      }
    });
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.GeneticsCard = { render };

})();
