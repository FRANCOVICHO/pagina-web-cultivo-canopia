// views/diagnosis.js — Diagnóstico de problemas de planta con IA visual
// Mejoras: preguntas detalladas, múltiples fotos, diagnóstico diferencial
(function () {

  const PREGUNTAS = [
    {
      id: 'zona',
      label: '¿Qué partes están afectadas?',
      tipo: 'multicheck',
      opciones: ['Hojas bajas', 'Hojas altas', 'Hojas del medio', 'Toda la planta', 'Tallos', 'Cogollos', 'Raíces']
    },
    {
      id: 'sintomas',
      label: '¿Cómo se ven las hojas afectadas?',
      tipo: 'multicheck',
      opciones: ['Amarillas', 'Marrones/secas', 'Con manchas', 'Rizadas hacia arriba', 'Rizadas hacia abajo', 'Puntos blancos/negros', 'Pérdida de color entre venas', 'Brillantes o pegajosas', 'Caídas']
    },
    {
      id: 'riego',
      label: '¿Cuándo la regaste y con qué frecuencia?',
      tipo: 'text',
      placeholder: 'Ej: Hace 2 días, cada 3 días'
    },
    {
      id: 'ph',
      label: '¿pH del agua de riego?',
      tipo: 'text',
      placeholder: 'Ej: 6.5 (o "no lo mido")'
    },
    {
      id: 'nutrientes',
      label: '¿Usás fertilizantes? ¿Cuáles y con qué frecuencia?',
      tipo: 'text',
      placeholder: 'Ej: Biobizz Grow, cada riego'
    },
    {
      id: 'ambiente',
      label: '¿Temperatura y humedad del espacio de cultivo?',
      tipo: 'text',
      placeholder: 'Ej: 24°C, 55% HR'
    },
    {
      id: 'desde_cuando',
      label: '¿Desde cuándo notás el problema? ¿Avanza rápido?',
      tipo: 'text',
      placeholder: 'Ej: Hace 3 días, avanza rápido'
    },
  ];

  async function render(container, plant, token) {
    container.innerHTML = `
      <div class="diag-view">
        <div class="at-toolbar">
          <h3 class="section-title">🔬 Diagnóstico por IA</h3>
        </div>
        <p style="color:var(--gray);font-size:14px;margin-bottom:20px">
          Subí hasta 3 fotos del problema y la IA hace un diagnóstico diferencial con confianza por cada causa probable.
        </p>

        <!-- Paso 1: subir fotos (hasta 3) -->
        <div id="diag-step-1">
          <div style="font-weight:600;font-size:13px;color:var(--green);margin-bottom:10px">
            📸 Fotos (podés subir hasta 3 — cuantas más, mejor diagnóstico)
          </div>
          <div id="diag-photos-grid" class="diag-photos-grid">
            <div class="diag-photo-slot" id="diag-slot-0">
              <div class="diag-slot-placeholder">+ Foto 1<br><span style="font-size:11px;color:var(--gray2)">Principal</span></div>
              <img class="diag-slot-img" style="display:none" />
              <button class="diag-slot-remove" style="display:none">✕</button>
            </div>
            <div class="diag-photo-slot" id="diag-slot-1">
              <div class="diag-slot-placeholder">+ Foto 2<br><span style="font-size:11px;color:var(--gray2)">Acercamiento</span></div>
              <img class="diag-slot-img" style="display:none" />
              <button class="diag-slot-remove" style="display:none">✕</button>
            </div>
            <div class="diag-photo-slot" id="diag-slot-2">
              <div class="diag-slot-placeholder">+ Foto 3<br><span style="font-size:11px;color:var(--gray2)">Planta entera</span></div>
              <img class="diag-slot-img" style="display:none" />
              <button class="diag-slot-remove" style="display:none">✕</button>
            </div>
          </div>
          <input type="file" id="diag-file-input" accept="image/jpeg,image/png,image/webp" style="display:none" />
          <div id="diag-step1-error" class="error-msg" style="display:none;margin-top:10px"></div>
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
            <button class="btn-green btn-sm" id="diag-camera-btn">📱 Usar cámara</button>
          </div>
          <input type="file" id="diag-camera-input" accept="image/*" capture="environment" style="display:none" />
        </div>

        <!-- Paso 2: ¿preguntas? -->
        <div id="diag-step-2" style="display:none;margin-top:20px">
          <div class="diag-ask-card">
            <div style="font-size:22px;margin-bottom:8px">🤖</div>
            <div style="font-weight:700;margin-bottom:6px">¿Te puedo hacer unas preguntas?</div>
            <div style="color:var(--gray);font-size:13px;margin-bottom:16px">
              Con más contexto el diagnóstico es más preciso. Son 7 preguntas rápidas.
            </div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
              <button class="btn-green" id="diag-yes-questions">Sí, preguntame</button>
              <button class="btn-ghost" id="diag-no-questions">No, analizá directo</button>
            </div>
          </div>
        </div>

        <!-- Paso 3: preguntas -->
        <div id="diag-step-3" style="display:none;margin-top:20px">
          <div style="font-weight:600;margin-bottom:14px;color:var(--green)">🌿 Contame más sobre el problema:</div>
          <div id="diag-questions-container"></div>
          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
            <button class="btn-green" id="diag-submit-questions">Analizar ahora →</button>
            <button class="btn-ghost" id="diag-skip-questions">Saltar y analizar</button>
          </div>
        </div>

        <!-- Resultado -->
        <div id="diag-result" style="display:none;margin-top:20px"></div>
      </div>
    `;

    const selectedFiles = [null, null, null];
    let activeSlot = 0;

    // ── Slots de fotos ──────────────────────────────────────────────────────
    for (let i = 0; i < 3; i++) {
      const slot = document.getElementById(`diag-slot-${i}`);
      slot.addEventListener('click', (e) => {
        if (e.target.classList.contains('diag-slot-remove')) return;
        activeSlot = i;
        document.getElementById('diag-file-input').click();
      });
      slot.querySelector('.diag-slot-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFiles[i] = null;
        slot.querySelector('.diag-slot-img').style.display = 'none';
        slot.querySelector('.diag-slot-img').src = '';
        slot.querySelector('.diag-slot-remove').style.display = 'none';
        slot.querySelector('.diag-slot-placeholder').style.display = 'flex';
        checkShowStep2(selectedFiles);
      });
    }

    document.getElementById('diag-camera-btn').addEventListener('click', () => {
      activeSlot = selectedFiles.findIndex(f => f === null);
      if (activeSlot === -1) activeSlot = 0;
      document.getElementById('diag-camera-input').click();
    });

    document.getElementById('diag-file-input').addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0], activeSlot, selectedFiles);
    });
    document.getElementById('diag-camera-input').addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0], activeSlot, selectedFiles);
    });

    // ── Paso 2 ───────────────────────────────────────────────────────────────
    document.getElementById('diag-yes-questions').addEventListener('click', () => {
      document.getElementById('diag-step-2').style.display = 'none';
      renderQuestions();
      document.getElementById('diag-step-3').style.display = 'block';
    });
    document.getElementById('diag-no-questions').addEventListener('click', () => {
      document.getElementById('diag-step-2').style.display = 'none';
      runDiagnosis(plant, token, selectedFiles, null);
    });

    // ── Paso 3 ───────────────────────────────────────────────────────────────
    document.getElementById('diag-submit-questions').addEventListener('click', () => {
      const ctx = collectContext();
      document.getElementById('diag-step-3').style.display = 'none';
      runDiagnosis(plant, token, selectedFiles, ctx);
    });
    document.getElementById('diag-skip-questions').addEventListener('click', () => {
      document.getElementById('diag-step-3').style.display = 'none';
      runDiagnosis(plant, token, selectedFiles, null);
    });
  }

  // ── Manejo de archivos ────────────────────────────────────────────────────

  function handleFile(file, slotIdx, selectedFiles) {
    const errEl = document.getElementById('diag-step1-error');
    errEl.style.display = 'none';
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      errEl.textContent = 'Formato no soportado. Usá JPEG, PNG o WebP.';
      errEl.style.display = 'block'; return;
    }
    if (file.size > 10 * 1024 * 1024) {
      errEl.textContent = 'La imagen supera los 10 MB.';
      errEl.style.display = 'block'; return;
    }
    selectedFiles[slotIdx] = file;
    const reader = new FileReader();
    reader.onload = e => {
      const slot = document.getElementById(`diag-slot-${slotIdx}`);
      slot.querySelector('.diag-slot-placeholder').style.display = 'none';
      const img = slot.querySelector('.diag-slot-img');
      img.src = e.target.result; img.style.display = 'block';
      slot.querySelector('.diag-slot-remove').style.display = 'flex';
    };
    reader.readAsDataURL(file);
    checkShowStep2(selectedFiles);
  }

  function checkShowStep2(selectedFiles) {
    const hasAny = selectedFiles.some(f => f !== null);
    document.getElementById('diag-step-2').style.display = hasAny ? 'block' : 'none';
  }

  // ── Preguntas dinámicas ───────────────────────────────────────────────────

  function renderQuestions() {
    const container = document.getElementById('diag-questions-container');
    container.innerHTML = PREGUNTAS.map(q => {
      if (q.tipo === 'multicheck') {
        return `
          <div class="form-group">
            <label>${q.label}</label>
            <div class="diag-multicheck" id="mc-${q.id}">
              ${q.opciones.map(o => `
                <button type="button" class="diag-check-chip" data-val="${escHtml(o)}">${escHtml(o)}</button>
              `).join('')}
            </div>
          </div>`;
      }
      if (q.tipo === 'select') {
        return `
          <div class="form-group">
            <label>${q.label}</label>
            <select id="diag-q-${q.id}">
              <option value="">— Seleccioná —</option>
              ${q.opciones.map(o => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('')}
            </select>
          </div>`;
      }
      return `
        <div class="form-group">
          <label>${q.label}</label>
          <input type="text" id="diag-q-${q.id}" placeholder="${q.placeholder || ''}" />
        </div>`;
    }).join('');

    // Toggle chips
    container.querySelectorAll('.diag-check-chip').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
    });
  }

  function collectContext() {
    const parts = [];
    PREGUNTAS.forEach(q => {
      if (q.tipo === 'multicheck') {
        const mc = document.getElementById(`mc-${q.id}`);
        if (!mc) return;
        const selected = [...mc.querySelectorAll('.diag-check-chip.selected')].map(b => b.dataset.val);
        if (selected.length) parts.push(`${q.label}: ${selected.join(', ')}`);
      } else {
        const el = document.getElementById(`diag-q-${q.id}`);
        if (el && el.value.trim()) parts.push(`${q.label}: ${el.value.trim()}`);
      }
    });
    return parts.length ? parts.join(' | ') : null;
  }

  // ── Diagnóstico ───────────────────────────────────────────────────────────

  async function runDiagnosis(plant, token, selectedFiles, extraContext) {
    const resultEl = document.getElementById('diag-result');
    resultEl.style.display = 'block';
    const photoCount = selectedFiles.filter(f => f !== null).length;
    resultEl.innerHTML = `
      <div class="diag-loading">
        <div style="font-size:32px;margin-bottom:12px">🔬</div>
        <div style="font-weight:600;margin-bottom:6px">Analizando ${photoCount} foto${photoCount > 1 ? 's' : ''}...</div>
        <div style="color:var(--gray);font-size:13px">La IA está examinando las imágenes. Puede tardar hasta 20 segundos.</div>
      </div>`;

    // Convertir todas las fotos a base64
    const base64s = await Promise.all(
      selectedFiles.map(f => f ? fileToBase64(f).then(b => b.split(',')[1]) : null)
    );
    const validBase64s = base64s.filter(b => b !== null);

    if (!validBase64s.length) {
      resultEl.innerHTML = '<div class="error-msg">No hay fotos seleccionadas.</div>';
      return;
    }

    const stages = window.StageCalc ? window.StageCalc.calcStages(plant) : null;
    const stage  = stages ? window.StageCalc.getCurrentStage(stages) : null;

    try {
      const res = await fetch(`${WORKER_URL}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({
          type: 'plant_diagnosis',
          images_base64: validBase64s,
          image_base64: validBase64s[0], // compatibilidad
          genetics: plant.genetics || null,
          stage: stage || null,
          extra_context: extraContext
        }),
        signal: AbortSignal.timeout(30000)
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error en el análisis');
      renderResult(resultEl, data);
    } catch (e) {
      resultEl.innerHTML = `
        <div class="error-msg">
          ❌ No se pudo completar el análisis. ${e.message === 'TimeoutError' ? 'Tiempo agotado.' : e.message}<br>
          <button class="btn-ghost" style="margin-top:10px" onclick="location.reload()">Intentar de nuevo</button>
        </div>`;
    }
  }

  function renderResult(container, data) {
    const urgencyColor = { alto: '#ef5350', medio: '#ffa726', bajo: '#66bb6a' }[data.urgencia] || '#888';
    const urgencyLabel = { alto: '🔴 Alta', medio: '🟡 Media', bajo: '🟢 Baja' }[data.urgencia] || '—';

    // Diagnóstico diferencial
    const diferencialHTML = data.diagnostico_diferencial?.length ? `
      <div class="diag-section">
        <div class="diag-section-title">📊 Diagnóstico diferencial</div>
        ${data.diagnostico_diferencial.map(d => `
          <div class="diag-diferencial-item">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-weight:600;font-size:14px">${escHtml(d.causa)}</span>
              <span class="diag-confianza" style="background:${d.confianza >= 70 ? 'rgba(57,231,95,0.15)' : 'rgba(255,167,38,0.15)'}">
                ${d.confianza}% confianza
              </span>
            </div>
            <div style="font-size:12px;color:var(--gray)">${escHtml(d.razon || '')}</div>
          </div>`).join('')}
      </div>` : '';

    container.innerHTML = `
      <div class="diag-result-card">
        <div class="diag-result-header">
          <div class="diag-problema">${escHtml(data.problema || 'Análisis completado')}</div>
          <span class="diag-urgencia" style="background:${urgencyColor}20;color:${urgencyColor};border:1px solid ${urgencyColor}40">
            Urgencia ${urgencyLabel}
          </span>
        </div>

        <div class="diag-section">
          <div class="diag-section-title">🔍 Descripción</div>
          <p style="color:#ccc;font-size:14px;line-height:1.6">${escHtml(data.descripcion || '—')}</p>
        </div>

        ${diferencialHTML}

        ${data.causas?.length ? `
        <div class="diag-section">
          <div class="diag-section-title">⚠️ Causas probables</div>
          <ul class="diag-list">${data.causas.map(c => `<li>${escHtml(c)}</li>`).join('')}</ul>
        </div>` : ''}

        ${data.soluciones?.length ? `
        <div class="diag-section">
          <div class="diag-section-title">✅ Soluciones paso a paso</div>
          <ol class="diag-list">${data.soluciones.map(s => `<li>${escHtml(s)}</li>`).join('')}</ol>
        </div>` : ''}

        ${data.prevencion ? `
        <div class="diag-section">
          <div class="diag-section-title">🛡️ Prevención futura</div>
          <p style="color:#ccc;font-size:14px;line-height:1.6">${escHtml(data.prevencion)}</p>
        </div>` : ''}

        <button class="btn-ghost" style="margin-top:16px;width:100%" onclick="window._diagReset()">
          🔄 Analizar otra foto
        </button>
      </div>`;
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.DiagnosisView = { render };
  window._diagReset = () => {
    const c = document.getElementById('consulta-container') || document.querySelector('.diag-view')?.parentElement;
    if (c && window._currentDiagPlant && window._currentDiagToken) {
      DiagnosisView.render(c, window._currentDiagPlant, window._currentDiagToken);
    }
  };

})();
