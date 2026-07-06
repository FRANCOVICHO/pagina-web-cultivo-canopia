// views/stats.js
// Estadísticas del cultivador + formulario de registro de cosecha
// Expone window.StatsView

(function () {

  async function render(container, plants, token, userId) {
    container.innerHTML = `
      <div class="stats-view">
        <h3 class="section-title">📈 Estadísticas del cultivo</h3>
        <div id="sv-content"><div class="pd-loading">Cargando estadísticas...</div></div>
      </div>
    `;
    await loadStats(plants, token, userId);
  }

  async function loadStats(plants, token, userId) {
    const content = document.getElementById('sv-content');
    if (!content) return;
    try {
      const data     = await API.getHarvests(token, userId);
      const harvests = (data.items || []).filter(h => h.user === userId);
      renderStats(content, harvests, plants, token, userId);
    } catch {
      content.innerHTML = '<div class="pd-empty">Error al cargar estadísticas.</div>';
    }
  }

  function renderStats(content, harvests, plants, token, userId) {
    const total   = harvests.length;
    const avgDays = total === 0 ? 0 : Math.round(
      harvests.reduce((sum, h) => {
        if (!h.harvest_date) return sum;
        const plant = plants.find(p => p.id === h.plant);
        if (!plant || !plant.start_date) return sum;
        const diff = Math.ceil((new Date(h.harvest_date) - new Date(plant.start_date)) / 86400000);
        return sum + diff;
      }, 0) / total
    );
    const maxGrams = total === 0 ? 0 : Math.max(...harvests.map(h => h.weight_grams || 0));

    // Genética más cultivada
    const geneticsCount = {};
    plants.forEach(p => { geneticsCount[p.genetics] = (geneticsCount[p.genetics] || 0) + 1; });
    const favGenetics = Object.entries(geneticsCount).sort((a, b) => b[1] - a[1])[0];

    if (total === 0) {
      content.innerHTML = `
        <div class="pd-empty">
          <span style="font-size:48px">📊</span>
          <p>Todavía no hay cosechas registradas.</p>
          <p style="color:var(--gray);font-size:13px">Registrá tu primera cosecha desde el detalle de una planta.</p>
        </div>`;
      return;
    }

    content.innerHTML = `
      <div class="sv-grid">
        <div class="sv-card"><div class="sv-label">Cultivos realizados</div><div class="sv-value">${total}</div></div>
        <div class="sv-card"><div class="sv-label">Duración promedio</div><div class="sv-value">${avgDays} <small>días</small></div></div>
        <div class="sv-card"><div class="sv-label">Mayor producción</div><div class="sv-value">${maxGrams} <small>g</small></div></div>
        <div class="sv-card"><div class="sv-label">Genética favorita</div><div class="sv-value" style="font-size:16px">${favGenetics ? escHtml(favGenetics[0]) : '—'}</div></div>
      </div>
      <h4 style="margin:20px 0 12px;font-size:15px">Historial de cosechas</h4>
      <div class="sv-harvest-list">
        ${harvests.map(h => {
          const plant = plants.find(p => p.id === h.plant);
          const dateStr = h.harvest_date
            ? StageCalc.formatDate(new Date(h.harvest_date + 'T00:00:00'))
            : '—';
          return `
            <div class="sv-harvest-row">
              <span class="sv-harvest-name">${plant ? escHtml(plant.name) : 'Planta eliminada'}</span>
              <span class="sv-harvest-date">${dateStr}</span>
              <span class="sv-harvest-grams">${h.weight_grams || '—'} g</span>
            </div>`;
        }).join('')}
      </div>`;
  }

  // ── Formulario registro de cosecha (para usar desde plant-detail) ─────────

  function renderHarvestForm(container, plant, token, userId, onSaved) {
    container.innerHTML = `
      <div class="sv-harvest-form">
        <h4 style="margin-bottom:16px">🌾 Registrar cosecha</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Fecha de cosecha *</label>
            <input type="date" id="sv-harvest-date" value="${todayISO()}" />
          </div>
          <div class="form-group">
            <label>Producción (gramos)</label>
            <input type="number" id="sv-harvest-grams" min="0" placeholder="Ej: 120" />
          </div>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea id="sv-harvest-notes" rows="2" maxlength="500" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:#fff;font-family:inherit;resize:vertical"></textarea>
        </div>
        <div id="sv-harvest-error" class="error-msg" style="display:none"></div>
        <div class="modal-actions">
          <button class="btn-primary" id="sv-harvest-save-btn">Guardar cosecha</button>
        </div>
      </div>`;

    document.getElementById('sv-harvest-save-btn').addEventListener('click', async () => {
      const errEl   = document.getElementById('sv-harvest-error');
      const saveBtn = document.getElementById('sv-harvest-save-btn');
      errEl.style.display = 'none';

      const harvest_date  = document.getElementById('sv-harvest-date').value;
      const weight_grams  = parseFloat(document.getElementById('sv-harvest-grams').value) || null;
      const notes         = document.getElementById('sv-harvest-notes').value.trim();

      if (!harvest_date) { errEl.textContent = 'Ingresá la fecha de cosecha.'; errEl.style.display = 'block'; return; }

      saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
      try {
        await API.createHarvest(token, { plant: plant.id, user: userId, harvest_date, weight_grams, notes: notes || null });
        if (typeof onSaved === 'function') onSaved();
      } catch {
        errEl.textContent = 'Error al guardar la cosecha.'; errEl.style.display = 'block';
      } finally {
        saveBtn.disabled = false; saveBtn.textContent = 'Guardar cosecha';
      }
    });
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.StatsView = { render, renderHarvestForm };

})();
