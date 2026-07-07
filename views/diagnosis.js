// views/diagnosis.js
// Diagnóstico de enfermedades/problemas de planta via IA con visión
// Flujo: foto → ¿querés preguntas? → (opcional) preguntas → diagnóstico
// Expone window.DiagnosisView

(function () {

  const PREGUNTAS = [
    { id: 'riego',    label: '¿Cuándo la regaste por última vez?',         placeholder: 'Ej: Hace 2 días' },
    { id: 'nutrientes', label: '¿La estás fertilizando actualmente?',     placeholder: 'Ej: Sí, cada 3 días con...' },
    { id: 'ambiente', label: '¿Temperatura y humedad aproximada?',        placeholder: 'Ej: 24°C, 55% humedad' },
    { id: 'sintomas', label: '¿Desde cuándo notás el problema?',          placeholder: 'Ej: Hace 3 días' },
  ];

  async function render(container, plant, token) {
    container.innerHTML = `
      <div class="diag-view">
        <div class="at-toolbar">
          <h3 class="section-title">🔬 Diagnóstico por IA</h3>
        </div>
        <p style="color:var(--gray);font-size:14px;margin-bottom:20px">
          Sacá una foto del problema de tu planta y la IA lo analiza al instante.
        </p>

        <!-- Paso 1: subir foto -->
        <div id="diag-step-1">
          <div id="diag-drop-zone" class="drop-zone" style="margin-bottom:16px">
            <div id="diag-drop-placeholder">
              <span class="drop-icon">📸</span>
              <span>Subí o arrastrá una foto de tu planta</span>
              <span class="drop-hint">JPEG, PNG, WebP — máx 10 MB</span>
            </div>
            <img id="diag-preview" src="" alt="" style="display:none;max-height:220px;object-fit:contain;border-radius:8px;width:100%" />
          </div>
          <input type="file" id="diag-file-input" accept="image/jpeg,image/png,image/webp" capture="environment" style="display:none" />
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn-green" id="diag-upload-btn">📷 Seleccionar foto</button>
            <button class="btn-green" id="diag-camera-btn">📱 Usar cámara</button>
          </div>
          <input type="file" id="diag-camera-input" accept="image/*" capture="environment" style="display:none" />
          <div id="diag-step1-error" class="error-msg" style="display:none;margin-top:10px"></div>
        </div>

        <!-- Paso 2: ¿querés que la IA haga preguntas? -->
        <div id="diag-step-2" style="display:none;margin-top:20px">
          <div class="diag-ask-card">
            <div style="font-size:22px;margin-bottom:8px">🤖</div>
            <div style="font-weight:700;margin-bottom:6px">¿Querés que te haga unas preguntas?</div>
            <div style="color:var(--gray);font-size:13px;margin-bottom:16px">
              Con más contexto el diagnóstico es más preciso. ¿Te molesta responder 4 preguntas rápidas?
            </div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
              <button class="btn-green" id="diag-yes-questions">Sí, preguntame</button>
              <button class="btn-ghost" id="diag-no-questions">No, analizá directo</button>
            </div>
          </div>
        </div>

        <!-- Paso 3: preguntas -->
        <div id="diag-step-3" style="display:none;margin-top:20px">
          <div style="font-weight:600;margin-bottom:14px;color:var(--green)">🌿 Unas preguntas rápidas:</div>
          ${PREGUNTAS.map(q => `
            <div class="form-group">
              <label>${q.label}</label>
              <input type="text" id="diag-q-${q.id}" placeholder="${q.placeholder}" />
            </div>`).join('')}
          <div style="display:flex;gap:10px;margin-top:6px">
            <button class="btn-green" id="diag-submit-questions">Analizar ahora →</button>
            <button class="btn-ghost" id="diag-skip-questions">Saltar y analizar</button>
          </div>
        </div>

        <!-- Resultado -->
        <div id="diag-result" style="display:none;margin-top:20px"></div>
      </div>
    `;

    let selectedFile = null;

    const dropZone    = document.getElementById('diag-drop-zone');
    const fileInput   = document.getElementById('diag-file-input');
    const cameraInput = document.getElementById('diag-camera-input');
    const uploadBtn   = document.getElementById('diag-upload-btn');
    const cameraBtn   = document.getElementById('diag-camera-btn');
    const errEl       = document.getElementById('diag-step1-error');

    // ── File handling ────────────────────────────────────────────────────────
    function handleFile(file) {
      errEl.style.display = 'none';
      if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
        errEl.textContent = 'Formato no soportado. Usá JPEG, PNG o WebP.';
        errEl.style.display = 'block'; return;
      }
      if (file.size > 10 * 1024 * 1024) {
        errEl.textContent = 'La imagen supera los 10 MB.';
        errEl.style.display = 'block'; return;
      }
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        document.getElementById('diag-drop-placeholder').style.display = 'none';
        const prev = document.getElementById('diag-preview');
        prev.src = e.target.result; prev.style.display = 'block';
        document.getElementById('diag-step-2').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }

    uploadBtn.addEventListener('click', () => fileInput.click());
    cameraBtn.addEventListener('click', () => cameraInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
    cameraInput.addEventListener('change', () => { if (cameraInput.files[0]) handleFile(cameraInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    // ── Paso 2: botones ──────────────────────────────────────────────────────
    document.getElementById('diag-yes-questions').addEventListener('click', () => {
      document.getElementById('diag-step-2').style.display = 'none';
      document.getElementById('diag-step-3').style.display = 'block';
    });

    document.getElementById('diag-no-questions').addEventListener('click', () => {
      document.getElementById('diag-step-2').style.display = 'none';
      runDiagnosis(plant, token, selectedFile, null);
    });

    // ── Paso 3: enviar preguntas ─────────────────────────────────────────────
    document.getElementById('diag-submit-questions').addEventListener('click', () => {
      const context = PREGUNTAS.map(q => {
        const val = document.getElementById(`diag-q-${q.id}`)?.value.trim();
        return val ? `${q.label}: ${val}` : null;
      }).filter(Boolean).join(' | ');
      document.getElementById('diag-step-3').style.display = 'none';
      runDiagnosis(plant, token, selectedFile, context || null);
    });

    document.getElementById('diag-skip-questions').addEventListener('click', () => {
      document.getElementById('diag-step-3').style.display = 'none';
      runDiagnosis(plant, token, selectedFile, null);
    });
  }

  // ── Ejecutar diagnóstico ──────────────────────────────────────────────────

  async function runDiagnosis(plant, token, file, extraContext) {
    const resultEl = document.getElementById('diag-result');
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="diag-loading">
        <div style="font-size:32px;margin-bottom:12px">🔬</div>
        <div style="font-weight:600;margin-bottom:6px">Analizando tu planta...</div>
        <div style="color:var(--gray);font-size:13px">La IA está examinando la imagen. Esto puede tardar hasta 20 segundos.</div>
      </div>`;

    // Convertir imagen a base64
    const base64 = await fileToBase64(file);
    // Sacar el prefijo "data:image/...;base64,"
    const base64Data = base64.split(',')[1];

    const stages = window.StageCalc ? window.StageCalc.calcStages(plant) : null;
    const stage  = stages ? window.StageCalc.getCurrentStage(stages) : null;

    try {
      const res = await fetch(`${WORKER_URL}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({
          type: 'plant_diagnosis',
          image_base64: base64Data,
          genetics: plant.genetics || null,
          stage: stage || null,
          extra_context: extraContext
        }),
        signal: AbortSignal.timeout(25000)
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

        ${data.causas?.length ? `
        <div class="diag-section">
          <div class="diag-section-title">⚠️ Causas probables</div>
          <ul class="diag-list">
            ${data.causas.map(c => `<li>${escHtml(c)}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${data.soluciones?.length ? `
        <div class="diag-section">
          <div class="diag-section-title">✅ Soluciones recomendadas</div>
          <ol class="diag-list">
            ${data.soluciones.map(s => `<li>${escHtml(s)}</li>`).join('')}
          </ol>
        </div>` : ''}

        ${data.prevencion ? `
        <div class="diag-section">
          <div class="diag-section-title">🛡️ Prevención</div>
          <p style="color:#ccc;font-size:14px;line-height:1.6">${escHtml(data.prevencion)}</p>
        </div>` : ''}

        <button class="btn-ghost" style="margin-top:16px;width:100%" onclick="window.DiagnosisView._reset()">
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

  window.DiagnosisView = {
    render,
    _reset: () => {
      // Recarga la vista — el caller debe llamar render() de nuevo
      const container = document.querySelector('.diag-view')?.parentElement;
      if (container && window._currentDiagPlant && window._currentDiagToken) {
        render(container, window._currentDiagPlant, window._currentDiagToken);
      }
    }
  };

})();
