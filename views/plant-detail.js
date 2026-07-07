// views/plant-detail.js
// Vista de detalle de planta con tabs: Resumen, Diario, Actividades, Tareas, Genética, Cosecha
// Reemplaza openDetailModal de app.js
// Expone window.PlantDetail

(function () {

  const TABS = [
    { id: 'resumen',      label: '📊 Resumen'      },
    { id: 'diario',       label: '📷 Diario'        },
    { id: 'actividades',  label: '📝 Actividades'   },
    { id: 'tareas',       label: '✅ Tareas'         },
    { id: 'genetica',     label: '🧬 Genética'       },
    { id: 'cosecha',      label: '🌾 Cosecha'        },
    { id: 'diagnostico',  label: '🔬 Diagnóstico'    },
  ];

  function open(plant, allPlants, token, userId) {
    const existing = document.getElementById('pd-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'pd-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box modal-box-wide" style="max-width:760px;padding:0;overflow:hidden">
        <div class="pd-modal-header">
          <div>
            <div class="pd-modal-plant-name">${escHtml(plant.name)}</div>
            <div class="pd-modal-plant-meta">${escHtml(plant.genetics)} · ${escHtml(plant.environment || 'Interior')}</div>
          </div>
          <button class="modal-close" id="pd-modal-close">✕</button>
        </div>
        <div class="pd-tabs">
          ${TABS.map(t => `<button class="pd-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div id="pd-tab-content" style="padding:20px;min-height:300px;overflow-y:auto;max-height:65vh"></div>
      </div>`;

    document.body.appendChild(modal);

    document.getElementById('pd-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onEsc); }
    });

    modal.querySelectorAll('.pd-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab, plant, allPlants, token, userId));
    });

    // Abrir tab resumen por defecto
    switchTab('resumen', plant, allPlants, token, userId);
  }

  async function switchTab(tabId, plant, allPlants, token, userId) {
    const content = document.getElementById('pd-tab-content');
    if (!content) return;

    // Marcar tab activa
    document.querySelectorAll('.pd-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));

    content.innerHTML = '<div class="pd-loading">Cargando...</div>';

    switch (tabId) {
      case 'resumen':
        renderResumen(content, plant);
        break;
      case 'diario':
        await PhotoDiary.render(content, plant, token, userId);
        break;
      case 'actividades':
        await ActivityTimeline.render(content, plant, token, userId);
        break;
      case 'tareas':
        await TasksView.render(content, allPlants, token, userId);
        break;
      case 'genetica':
        await GeneticsCard.render(content, plant, token);
        break;
      case 'cosecha':
        StatsView.renderHarvestForm(content, plant, token, userId, () => {
          content.innerHTML = '<div style="text-align:center;padding:40px"><span style="font-size:48px">🌾</span><p style="margin-top:12px;color:var(--green)">¡Cosecha registrada!</p></div>';
        });
        break;
      case 'diagnostico':
        window._currentDiagPlant = plant;
        window._currentDiagToken = token;
        await DiagnosisView.render(content, plant, token);
        break;
    }
  }

  function renderResumen(container, plant) {
    if (!window.StageCalc) { container.innerHTML = '<div class="pd-empty">Error al cargar el módulo de etapas.</div>'; return; }
    const stages       = StageCalc.calcStages(plant);
    const currentStage = StageCalc.getCurrentStage(stages);
    const now          = new Date(); now.setHours(0,0,0,0);
    const isOverdue    = now >= stages.harvestDate;
    const daysLeft     = StageCalc.daysUntil(stages.harvestDate);

    const stagesList = [
      { name: 'Germinación', start: stages.germStart,  dur: stages.dur.germination },
      { name: 'Vegetativo',  start: stages.vegStart,   dur: stages.dur.vegetative  },
      { name: 'Floración',   start: stages.florStart,  dur: stages.dur.flowering   },
      { name: 'Secado',      start: stages.dryStart,   dur: stages.dur.drying      },
    ];

    const harvestBox = isOverdue
      ? `<div class="overdue-alert" style="text-align:center">🚨 ¡Cosecha lista o urgente!</div>`
      : `<div class="harvest-box">
          <div class="harvest-label">Punto óptimo de cosecha</div>
          <div class="harvest-date">${StageCalc.formatDate(stages.harvestDate)}</div>
          <div class="harvest-days">${daysLeft > 0 ? `Faltan ${daysLeft} días` : 'Es hoy'}</div>
        </div>`;

    container.innerHTML = `
      <div class="detail-info-row">
        <div class="detail-info-item"><label>Genética</label><span>${escHtml(plant.genetics)}</span></div>
        <div class="detail-info-item"><label>Tipo</label><span>${plant.type === 'autoflowering' ? 'Automática' : 'Fotodependiente'}</span></div>
        <div class="detail-info-item"><label>Ambiente</label><span>${escHtml(plant.environment || 'Interior')}</span></div>
        <div class="detail-info-item"><label>Inicio</label><span>${StageCalc.formatDate(new Date(plant.start_date))}</span></div>
      </div>
      ${harvestBox}
      <div class="detail-stages">
        ${stagesList.map(s => `
          <div class="detail-stage-card ${s.name === currentStage ? 'active' : ''}">
            <div class="detail-stage-name">${s.name}</div>
            <div class="detail-stage-date">${StageCalc.formatDate(s.start)}</div>
            <div class="detail-stage-duration">${s.dur} días estimados</div>
          </div>`).join('')}
      </div>`;
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.PlantDetail = { open };

})();
