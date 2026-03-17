// ============================================================
// FOXCARS Admin — Formulaire inspection
// Création / édition + upload photos
// ============================================================

let inspectionId  = null;   // null = création, uuid = édition
let newPhotoFiles = [];     // fichiers sélectionnés avant upload
let existingPhotos = [];    // photos déjà en BDD

async function initForm() {
  const params = new URLSearchParams(window.location.search);
  inspectionId = params.get('id') || null;

  const sb = getSupabase();

  // Charge la liste des clients
  const { data: clients } = await sb.from('clients')
    .select('id, full_name, company_name')
    .neq('role', 'admin')
    .order('full_name');

  const select = document.getElementById('f-client');
  (clients || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.company_name ? `${c.full_name} — ${c.company_name}` : c.full_name;
    select.appendChild(opt);
  });

  // Pré-sélection client depuis l'URL (?client=uuid)
  const preClient = params.get('client');
  if (preClient) select.value = preClient;

  // Date par défaut = aujourd'hui
  document.getElementById('f-date').value = new Date().toISOString().split('T')[0];

  if (inspectionId) {
    // Mode édition : charge les données existantes
    document.getElementById('page-title').textContent = 'Éditer l\'inspection';
    document.querySelector('.nav-item.active strong, .nav-item.active')?.classList.remove('active');
    await loadInspection(inspectionId);
    document.getElementById('photos-section').style.display = 'block';
    await loadExistingPhotos(inspectionId);
  }

  // Upload zone
  const uploadZone = document.getElementById('upload-zone');
  const fileInput  = document.getElementById('file-input');

  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  });

  // Sauvegarde
  document.getElementById('btn-save').addEventListener('click', saveInspection);

  document.getElementById('loading-wrap').style.display = 'none';
  document.getElementById('form-wrap').style.display = 'block';
}

async function loadInspection(id) {
  const sb = getSupabase();
  const { data: insp, error } = await sb.from('inspections').select('*').eq('id', id).single();
  if (error || !insp) {
    showAlert('Inspection introuvable.', 'error');
    return;
  }

  document.getElementById('f-make').value      = insp.vehicle_make || '';
  document.getElementById('f-model').value     = insp.vehicle_model || '';
  document.getElementById('f-year').value      = insp.vehicle_year || '';
  document.getElementById('f-plate').value     = insp.vehicle_plate || '';
  document.getElementById('f-vin').value       = insp.vehicle_vin || '';
  document.getElementById('f-km').value        = insp.vehicle_km || '';
  document.getElementById('f-client').value    = insp.client_id || '';
  document.getElementById('f-date').value      = insp.inspection_date || '';
  document.getElementById('f-status').value    = insp.status || 'transmitted';
  document.getElementById('f-inspector').value = insp.inspector_name || 'FOXCARS';
  document.getElementById('f-notes').value     = insp.notes || '';
}

// ── Photos existantes ────────────────────────────────────────
async function loadExistingPhotos(inspId) {
  const sb = getSupabase();
  const { data: photos } = await sb.from('inspection_photos')
    .select('*').eq('inspection_id', inspId).order('sort_order');

  existingPhotos = photos || [];
  updatePhotosCount();

  const container = document.getElementById('existing-photos');
  if (existingPhotos.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Génère les URLs signées
  const urlResults = await Promise.all(
    existingPhotos.map(p => sb.storage.from('inspection-photos').createSignedUrl(p.storage_path, 3600))
  );

  container.innerHTML = existingPhotos.map((photo, i) => {
    const url = urlResults[i].data?.signedUrl || '';
    return `
      <div class="photo-item" id="existing-${photo.id}">
        <img src="${url}" alt="${escapeHtml(photo.caption || '')}">
        <button class="photo-delete" onclick="deleteExistingPhoto('${photo.id}', '${escapeHtml(photo.storage_path)}')">✕</button>
        <div class="photo-item-info">
          <input type="text" placeholder="Légende" value="${escapeHtml(photo.caption || '')}"
            onchange="updatePhotoCaption('${photo.id}', this.value)">
          <input type="text" placeholder="Catégorie" value="${escapeHtml(photo.category || 'general')}"
            onchange="updatePhotoCategory('${photo.id}', this.value)">
        </div>
      </div>`;
  }).join('');
}

async function deleteExistingPhoto(photoId, storagePath) {
  if (!confirm('Supprimer cette photo définitivement ?')) return;
  const sb = getSupabase();
  await sb.storage.from('inspection-photos').remove([storagePath]);
  await sb.from('inspection_photos').delete().eq('id', photoId);
  existingPhotos = existingPhotos.filter(p => p.id !== photoId);
  document.getElementById(`existing-${photoId}`)?.remove();
  updatePhotosCount();
}

async function updatePhotoCaption(photoId, caption) {
  const sb = getSupabase();
  await sb.from('inspection_photos').update({ caption }).eq('id', photoId);
}

async function updatePhotoCategory(photoId, category) {
  const sb = getSupabase();
  await sb.from('inspection_photos').update({ category }).eq('id', photoId);
}

// ── Nouvelles photos (avant upload) ──────────────────────────
function handleFileSelect(e) {
  handleFiles(Array.from(e.target.files));
  e.target.value = '';
}

function handleFiles(files) {
  files.forEach(file => {
    const reader = new FileReader();
    const idx = newPhotoFiles.length;
    newPhotoFiles.push({ file, caption: '', category: 'general' });

    reader.onload = e => {
      const container = document.getElementById('new-photos-preview');
      const div = document.createElement('div');
      div.className = 'photo-item';
      div.id = `new-${idx}`;
      div.innerHTML = `
        <img src="${e.target.result}" alt="Nouvelle photo">
        <button class="photo-delete" onclick="removeNewPhoto(${idx})">✕</button>
        <div class="photo-item-info">
          <input type="text" placeholder="Légende" oninput="newPhotoFiles[${idx}].caption = this.value">
          <input type="text" placeholder="Catégorie" value="general" oninput="newPhotoFiles[${idx}].category = this.value">
        </div>`;
      container.appendChild(div);
      updatePhotosCount();
    };
    reader.readAsDataURL(file);
  });
}

function removeNewPhoto(idx) {
  newPhotoFiles[idx] = null;
  document.getElementById(`new-${idx}`)?.remove();
  updatePhotosCount();
}

function updatePhotosCount() {
  const existing = existingPhotos.length;
  const newCount = newPhotoFiles.filter(Boolean).length;
  const total = existing + newCount;
  document.getElementById('photos-count').textContent =
    total > 0 ? `${total} photo${total > 1 ? 's' : ''}` : '';
}

// ── Upload des nouvelles photos ───────────────────────────────
async function uploadNewPhotos(inspId) {
  const sb       = getSupabase();
  const toUpload = newPhotoFiles.filter(Boolean);
  if (toUpload.length === 0) return;

  const progressEl = document.getElementById('upload-progress');
  progressEl.style.display = 'flex';
  progressEl.style.flexDirection = 'column';

  const existingCount = existingPhotos.length;

  for (let i = 0; i < toUpload.length; i++) {
    const { file, caption, category } = toUpload[i];
    const ext  = file.name.split('.').pop() || 'jpg';
    const name = `${Date.now()}_${i}.${ext}`;
    const path = `${inspId}/${name}`;

    // Indicateur de progression
    const itemId = `prog-${i}`;
    progressEl.innerHTML += `
      <div class="progress-item" id="${itemId}">
        <span style="min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(file.name)}</span>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:0%" id="bar-${i}"></div></div>
        <span id="status-${i}" style="min-width:50px;text-align:right;">0%</span>
      </div>`;

    // Simule la progression (Supabase JS ne supporte pas onUploadProgress nativement)
    const progressInterval = setInterval(() => {
      const bar = document.getElementById(`bar-${i}`);
      if (bar) {
        const current = parseInt(bar.style.width) || 0;
        if (current < 85) bar.style.width = (current + 15) + '%';
      }
    }, 200);

    const { error } = await sb.storage.from('inspection-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    clearInterval(progressInterval);
    const bar    = document.getElementById(`bar-${i}`);
    const status = document.getElementById(`status-${i}`);

    if (error) {
      if (bar) bar.style.background = 'var(--red)';
      if (status) status.textContent = '✕';
      continue;
    }

    if (bar) bar.style.width = '100%';
    if (status) status.textContent = '✓';

    // Enregistre en BDD
    await sb.from('inspection_photos').insert({
      inspection_id: inspId,
      storage_path:  path,
      caption:       caption || null,
      category:      category || 'general',
      sort_order:    existingCount + i,
    });
  }

  newPhotoFiles = [];
  document.getElementById('new-photos-preview').innerHTML = '';
}

// ── Sauvegarde inspection ────────────────────────────────────
async function saveInspection() {
  const make  = document.getElementById('f-make').value.trim();
  const model = document.getElementById('f-model').value.trim();
  const client = document.getElementById('f-client').value;
  const date   = document.getElementById('f-date').value;

  if (!make || !model || !client || !date) {
    showAlert('Veuillez remplir les champs obligatoires : Marque, Modèle, Client, Date.', 'error');
    return;
  }

  const payload = {
    client_id:      client,
    vehicle_make:   make,
    vehicle_model:  model,
    vehicle_year:   parseInt(document.getElementById('f-year').value) || null,
    vehicle_plate:  document.getElementById('f-plate').value.trim() || null,
    vehicle_vin:    document.getElementById('f-vin').value.trim() || null,
    vehicle_km:     parseInt(document.getElementById('f-km').value) || null,
    inspection_date: date,
    status:          document.getElementById('f-status').value,
    inspector_name:  document.getElementById('f-inspector').value.trim() || 'FOXCARS',
    notes:           document.getElementById('f-notes').value.trim() || null,
  };

  const btn      = document.getElementById('btn-save');
  const saveText = document.getElementById('save-text');
  btn.disabled   = true;
  saveText.textContent = 'Enregistrement…';

  const sb = getSupabase();

  try {
    let savedId = inspectionId;

    if (inspectionId) {
      // Mise à jour
      const { error } = await sb.from('inspections').update(payload).eq('id', inspectionId);
      if (error) throw error;
    } else {
      // Création
      const { data, error } = await sb.from('inspections').insert(payload).select().single();
      if (error) throw error;
      savedId = data.id;
      inspectionId = savedId;

      // Affiche la section photos maintenant qu'on a un ID
      document.getElementById('photos-section').style.display = 'block';
      document.getElementById('page-title').textContent = 'Éditer l\'inspection';

      // Met à jour l'URL sans rechargement
      window.history.replaceState({}, '', `?id=${savedId}`);
    }

    // Upload les nouvelles photos
    if (newPhotoFiles.filter(Boolean).length > 0) {
      saveText.textContent = 'Upload photos…';
      await uploadNewPhotos(savedId);
    }

    showAlert('✅ Inspection enregistrée avec succès.', 'success');
    await loadExistingPhotos(savedId);

  } catch (err) {
    showAlert('Erreur : ' + escapeHtml(err.message), 'error');
  }

  btn.disabled = false;
  saveText.textContent = 'Enregistrer';
}

// ── Utilitaires ──────────────────────────────────────────────
function showAlert(msg, type) {
  const el = document.getElementById('global-alert');
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') setTimeout(() => { el.innerHTML = ''; }, 4000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
