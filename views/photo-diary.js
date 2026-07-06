// views/photo-diary.js
// Diario fotográfico por planta
// Expone window.PhotoDiary para uso desde plant-detail.js

(function () {

  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE_BYTES  = 10 * 1024 * 1024; // 10 MB

  // ── Render principal ──────────────────────────────────────────────────────

  async function render(container, plant, token, userId) {
    container.innerHTML = `
      <div class="photo-diary">
        <div class="photo-diary-toolbar">
          <h3 class="section-title">📷 Diario fotográfico</h3>
          <div class="photo-diary-actions">
            <button class="btn-primary btn-sm" id="pd-upload-btn">+ Subir foto</button>
            <button class="btn-ghost btn-sm" id="pd-camera-btn" style="display:none">📸 Cámara</button>
          </div>
        </div>

        <div id="pd-upload-form" class="pd-upload-form" style="display:none">
          <div class="form-row">
            <div class="form-group">
              <label>Foto *</label>
              <div id="pd-drop-zone" class="drop-zone">
                <div id="pd-drop-placeholder">
                  <span class="drop-icon">📷</span>
                  <span>Arrastrá o hacé click para seleccionar</span>
                  <span class="drop-hint">JPEG, PNG, WebP — máx 10 MB</span>
                </div>
                <img id="pd-preview" src="" alt="" style="display:none;max-height:180px;object-fit:cover;border-radius:8px;width:100%" />
              </div>
              <input type="file" id="pd-file-input" accept="image/jpeg,image/png,image/webp" capture="environment" style="display:none" />
              <input type="file" id="pd-camera-input" accept="image/*" capture="environment" style="display:none" />
            </div>
            <div class="form-group">
              <label>Fecha de captura</label>
              <input type="date" id="pd-capture-date" value="${todayISO()}" />
              <label style="margin-top:12px">Notas (opcional)</label>
              <textarea id="pd-notes" rows="3" maxlength="500" placeholder="Describí el estado de la planta..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:#fff;font-family:inherit;resize:vertical"></textarea>
            </div>
          </div>
          <div id="pd-upload-error" class="error-msg" style="display:none"></div>
          <div class="modal-actions">
            <button class="btn-ghost" id="pd-cancel-btn">Cancelar</button>
            <button class="btn-primary" id="pd-save-btn">Guardar foto</button>
          </div>
        </div>

        <div id="pd-gallery" class="pd-gallery">
          <div class="pd-loading">Cargando fotos...</div>
        </div>
      </div>
    `;

    // Mostrar botón cámara solo si hay API de cámara disponible
    if (navigator.mediaDevices || window.isSecureContext) {
      document.getElementById('pd-camera-btn').style.display = 'inline-flex';
    }

    bindEvents(plant, token, userId);
    await loadGallery(plant, token);
  }

  // ── Galería ───────────────────────────────────────────────────────────────

  async function loadGallery(plant, token) {
    const gallery = document.getElementById('pd-gallery');
    if (!gallery) return;

    try {
      const data = await API.getPhotos(token, plant.id);
      const photos = (data.items || []).sort((a, b) => b.capture_date.localeCompare(a.capture_date));
      renderGallery(gallery, photos, plant, token);
    } catch (e) {
      gallery.innerHTML = '<div class="pd-empty">Error al cargar fotos.</div>';
    }
  }

  function renderGallery(gallery, photos, plant, token) {
    if (photos.length === 0) {
      gallery.innerHTML = `
        <div class="pd-empty">
          <span style="font-size:40px">📷</span>
          <p>Todavía no hay fotos. ¡Agregá la primera!</p>
        </div>`;
      return;
    }

    gallery.innerHTML = photos.map(photo => {
      const imgUrl = `${POCKETBASE_URL}/api/files/photos/${photo.id}/${photo.image}?token=${token}`;
      const dateStr = photo.capture_date
        ? StageCalc.formatDate(new Date(photo.capture_date + 'T00:00:00'))
        : '—';
      return `
        <div class="pd-thumb" data-id="${photo.id}" data-url="${escHtml(imgUrl)}" data-date="${escHtml(dateStr)}" data-notes="${escHtml(photo.notes || '')}">
          <img src="${imgUrl}" alt="Foto ${dateStr}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\'/>'" />
          <div class="pd-thumb-date">${dateStr}</div>
          ${photo.notes ? `<div class="pd-thumb-notes">${escHtml(photo.notes.slice(0, 40))}${photo.notes.length > 40 ? '…' : ''}</div>` : ''}
        </div>`;
    }).join('');

    // Click para lightbox
    gallery.querySelectorAll('.pd-thumb').forEach(el => {
      el.addEventListener('click', () => openLightbox(
        el.dataset.url, el.dataset.date, el.dataset.notes, el.dataset.id, plant, token
      ));
    });
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────

  function openLightbox(imgUrl, dateStr, notes, photoId, plant, token) {
    const existing = document.getElementById('pd-lightbox');
    if (existing) existing.remove();

    const lb = document.createElement('div');
    lb.id = 'pd-lightbox';
    lb.className = 'modal-overlay';
    lb.innerHTML = `
      <div class="modal-box modal-box-wide" style="text-align:center">
        <div class="modal-header">
          <span style="font-size:14px;color:var(--gray)">${dateStr}</span>
          <button class="modal-close" id="pd-lb-close">✕</button>
        </div>
        <img src="${imgUrl}" style="max-width:100%;max-height:60vh;object-fit:contain;border-radius:8px" alt="Foto" />
        ${notes ? `<p style="margin-top:12px;color:var(--gray);font-size:13px">${escHtml(notes)}</p>` : ''}
        <div class="modal-actions" style="justify-content:center;margin-top:16px">
          <button class="btn-danger" id="pd-lb-delete">🗑️ Eliminar foto</button>
        </div>
      </div>`;

    document.body.appendChild(lb);

    document.getElementById('pd-lb-close').addEventListener('click', () => lb.remove());
    lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
    document.getElementById('pd-lb-delete').addEventListener('click', () =>
      confirmDeletePhoto(photoId, plant, token, lb)
    );
  }

  async function confirmDeletePhoto(photoId, plant, token, lb) {
    if (!confirm('¿Eliminar esta foto? Esta acción no se puede deshacer.')) return;
    try {
      await API.deletePhoto(token, photoId);
      lb.remove();
      await loadGallery(plant, token);
    } catch {
      alert('Error al eliminar la foto.');
    }
  }

  // ── Formulario upload ─────────────────────────────────────────────────────

  let selectedFile = null;

  function bindEvents(plant, token, userId) {
    const uploadBtn  = document.getElementById('pd-upload-btn');
    const cameraBtn  = document.getElementById('pd-camera-btn');
    const cancelBtn  = document.getElementById('pd-cancel-btn');
    const saveBtn    = document.getElementById('pd-save-btn');
    const dropZone   = document.getElementById('pd-drop-zone');
    const fileInput  = document.getElementById('pd-file-input');
    const cameraInput = document.getElementById('pd-camera-input');

    uploadBtn.addEventListener('click', () => toggleForm(true));
    cancelBtn.addEventListener('click', () => { toggleForm(false); resetForm(); });

    cameraBtn.addEventListener('click', () => cameraInput.click());
    cameraInput.addEventListener('change', () => {
      if (cameraInput.files[0]) handleFile(cameraInput.files[0]);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });

    saveBtn.addEventListener('click', () => uploadPhoto(plant, token, userId));
  }

  function toggleForm(show) {
    const form = document.getElementById('pd-upload-form');
    if (form) form.style.display = show ? 'block' : 'none';
  }

  function handleFile(file) {
    const errEl = document.getElementById('pd-upload-error');
    errEl.style.display = 'none';

    if (!ACCEPTED_TYPES.includes(file.type)) {
      errEl.textContent = 'Formato no soportado. Usá JPEG, PNG o WebP.';
      errEl.style.display = 'block';
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      errEl.textContent = 'La imagen supera los 10 MB.';
      errEl.style.display = 'block';
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('pd-drop-placeholder').style.display = 'none';
      const preview = document.getElementById('pd-preview');
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  async function uploadPhoto(plant, token, userId) {
    const errEl   = document.getElementById('pd-upload-error');
    const saveBtn = document.getElementById('pd-save-btn');
    errEl.style.display = 'none';

    if (!selectedFile) {
      errEl.textContent = 'Seleccioná una foto primero.';
      errEl.style.display = 'block';
      return;
    }

    const captureDate = document.getElementById('pd-capture-date').value || todayISO();
    const notes       = document.getElementById('pd-notes').value.trim();

    const formData = new FormData();
    formData.append('plant', plant.id);
    formData.append('user', userId);
    formData.append('image', selectedFile);
    formData.append('capture_date', captureDate);
    if (notes) formData.append('notes', notes);

    saveBtn.disabled = true;
    saveBtn.textContent = 'Subiendo...';

    try {
      await API.createPhoto(token, formData);
      resetForm();
      toggleForm(false);
      await loadGallery(plant, token);
    } catch (e) {
      errEl.textContent = 'Error al subir la foto. Intentá de nuevo.';
      errEl.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar foto';
    }
  }

  function resetForm() {
    selectedFile = null;
    const fi = document.getElementById('pd-file-input');
    const ci = document.getElementById('pd-camera-input');
    if (fi) fi.value = '';
    if (ci) ci.value = '';
    const placeholder = document.getElementById('pd-drop-placeholder');
    const preview = document.getElementById('pd-preview');
    if (placeholder) placeholder.style.display = 'flex';
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    const notes = document.getElementById('pd-notes');
    if (notes) notes.value = '';
    const dateInput = document.getElementById('pd-capture-date');
    if (dateInput) dateInput.value = todayISO();
    const errEl = document.getElementById('pd-upload-error');
    if (errEl) errEl.style.display = 'none';
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.PhotoDiary = { render };

})();
