// ============================================================
// FOXCARS — Page détail inspection
// Chargement, galerie photos, export PDF et ZIP
// ============================================================

const STATUS_LABELS = { transmitted: 'Transmis', completed: 'Terminé', in_progress: 'En cours' };
const STATUS_ICONS  = { transmitted: '📤', completed: '✅', in_progress: '🔧' };

let currentInspection = null;
let photoUrls         = [];
let lightboxIndex     = 0;

// ── Chargement de l'inspection ───────────────────────────────
async function loadInspection(id) {
  const sb = getSupabase();

  const { data: insp, error } = await sb
    .from('inspections')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !insp) {
    document.getElementById('loading').innerHTML = `
      <p style="color:var(--muted);text-align:center;padding:60px 0;">
        Inspection introuvable ou accès non autorisé.
        <br><a href="/portail/dashboard.html" style="color:var(--orange-bright);">Retour au tableau de bord</a>
      </p>`;
    return;
  }

  currentInspection = insp;

  const { data: photos } = await sb
    .from('inspection_photos')
    .select('*')
    .eq('inspection_id', id)
    .order('sort_order', { ascending: true });

  renderInspection(insp, photos || []);
  await renderPhotos(photos || []);

  document.getElementById('loading').style.display    = 'none';
  document.getElementById('content').style.display    = 'block';
}

// ── Rendu HTML de l'inspection ───────────────────────────────
function renderInspection(insp, photos) {
  const vehicle = `${insp.vehicle_make} ${insp.vehicle_model}${insp.vehicle_year ? ` (${insp.vehicle_year})` : ''}`;
  document.title = `FOXCARS — ${vehicle}`;

  // Titre
  document.getElementById('insp-title').textContent   = vehicle;
  document.getElementById('insp-subtitle').textContent =
    `Inspection du ${formatDate(insp.inspection_date)} · ${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

  // Badge statut
  const badge = document.getElementById('insp-badge');
  badge.textContent  = `${STATUS_ICONS[insp.status] || ''} ${STATUS_LABELS[insp.status] || insp.status}`;
  badge.className    = `badge badge-${insp.status}`;

  // Fiche véhicule
  renderFields('vehicle-fields', [
    ['Marque',     insp.vehicle_make],
    ['Modèle',     insp.vehicle_model],
    ['Année',      insp.vehicle_year],
    ['Plaque',     insp.vehicle_plate],
    ['VIN',        insp.vehicle_vin],
    ['Kilométrage', insp.vehicle_km ? `${insp.vehicle_km.toLocaleString('fr-FR')} km` : null],
  ]);

  // Fiche inspection
  renderFields('inspection-fields', [
    ['Date',        formatDate(insp.inspection_date)],
    ['Inspecteur',  insp.inspector_name || 'FOXCARS'],
    ['Statut',      `${STATUS_ICONS[insp.status] || ''} ${STATUS_LABELS[insp.status] || insp.status}`],
    ['Rapport créé', formatDate(insp.created_at)],
  ]);

  // Rapport (report_data JSON)
  const reportContainer = document.getElementById('report-container');
  if (insp.report_data && Object.keys(insp.report_data).length > 0) {
    const rows = buildReportRows(insp.report_data);
    if (rows.length > 0) {
      reportContainer.innerHTML = `
        <div class="card report-section">
          <h3>Détail du rapport</h3>
          <table class="report-table">
            <thead><tr><th>Élément</th><th>Observation</th></tr></thead>
            <tbody>${rows.map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody>
          </table>
        </div>`;
    }
  }

  // Notes
  const notesContainer = document.getElementById('notes-container');
  if (insp.notes && insp.notes.trim()) {
    notesContainer.innerHTML = `
      <div class="card report-section">
        <h3>Notes & observations</h3>
        <div class="notes-box">${escapeHtml(insp.notes)}</div>
      </div>`;
  }
}

function renderFields(containerId, fields) {
  const el = document.getElementById(containerId);
  el.innerHTML = fields
    .filter(([, v]) => v != null && v !== '')
    .map(([label, value]) => `
      <div class="detail-field">
        <span class="label">${label}</span>
        <span class="value">${escapeHtml(String(value))}</span>
      </div>`).join('');
}

function buildReportRows(data, prefix = '') {
  const rows = [];
  for (const [key, val] of Object.entries(data)) {
    const label = prefix ? `${prefix} › ${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      rows.push(...buildReportRows(val, label));
    } else {
      const display = Array.isArray(val) ? val.join(', ') : String(val ?? '—');
      rows.push([label, escapeHtml(display)]);
    }
  }
  return rows;
}

// ── Rendu galerie photos ─────────────────────────────────────
async function renderPhotos(photos) {
  const grid  = document.getElementById('photos-grid');
  const count = document.getElementById('photos-count');

  if (photos.length === 0) {
    grid.innerHTML = `<div class="no-photos">Aucune photo disponible pour cette inspection.</div>`;
    count.textContent = '0 photo';
    return;
  }

  count.textContent = `${photos.length} photo${photos.length > 1 ? 's' : ''}`;
  photoUrls = [];

  const sb = getSupabase();

  // Génère les URLs signées (valables 1 heure)
  const urlPromises = photos.map(p =>
    sb.storage.from('inspection-photos').createSignedUrl(p.storage_path, 3600)
  );
  const results = await Promise.all(urlPromises);

  const thumbsHtml = photos.map((photo, i) => {
    const { data } = results[i];
    const url = data?.signedUrl || '';
    photoUrls.push({ url, caption: photo.caption || '', category: photo.category || 'general' });

    const catLabel = photo.category && photo.category !== 'general'
      ? `<div class="photo-category-badge">${escapeHtml(photo.category)}</div>`
      : '';
    const caption = photo.caption
      ? `<div class="photo-caption">${escapeHtml(photo.caption)}</div>`
      : '';

    return `
      <div class="photo-thumb" data-index="${i}" role="button" tabindex="0"
        aria-label="Photo ${i + 1}${photo.caption ? ': ' + photo.caption : ''}">
        <img src="${url}" alt="${escapeHtml(photo.caption || `Photo ${i + 1}`)}" loading="lazy">
        ${catLabel}
        ${caption}
      </div>`;
  }).join('');

  grid.innerHTML = thumbsHtml;

  // Ouvre le lightbox au clic
  grid.querySelectorAll('.photo-thumb').forEach(thumb => {
    const open = () => openLightbox(parseInt(thumb.dataset.index));
    thumb.addEventListener('click', open);
    thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
  });
}

// ── Lightbox ─────────────────────────────────────────────────
function openLightbox(index) {
  lightboxIndex = index;
  updateLightbox();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function updateLightbox() {
  const photo = photoUrls[lightboxIndex];
  if (!photo) return;
  document.getElementById('lb-img').src           = photo.url;
  document.getElementById('lb-img').alt           = photo.caption;
  document.getElementById('lb-caption').textContent =
    photo.caption ? `${photo.caption} (${lightboxIndex + 1}/${photoUrls.length})` : `${lightboxIndex + 1}/${photoUrls.length}`;
}

function lightboxPrev() {
  lightboxIndex = (lightboxIndex - 1 + photoUrls.length) % photoUrls.length;
  updateLightbox();
}

function lightboxNext() {
  lightboxIndex = (lightboxIndex + 1) % photoUrls.length;
  updateLightbox();
}

function initLightbox() {
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', lightboxPrev);
  document.getElementById('lb-next').addEventListener('click', lightboxNext);

  document.getElementById('lightbox').addEventListener('click', function(e) {
    if (e.target === this) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
  });
}

// ── Export PDF ───────────────────────────────────────────────
async function exportPDF() {
  if (!currentInspection) return;
  const btn = document.getElementById('btn-pdf');
  btn.disabled = true;
  btn.textContent = 'Génération…';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const insp = currentInspection;

    const orange = [255, 106, 0];
    const dark   = [10, 12, 15];
    const grey   = [120, 120, 130];

    // En-tête
    doc.setFillColor(...dark);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(20);
    doc.setTextColor(...orange);
    doc.setFont('helvetica', 'bold');
    doc.text('FOXCARS', 15, 18);
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 210);
    doc.setFont('helvetica', 'normal');
    doc.text('Inspection automobile indépendante', 15, 25);
    doc.text('foxcars.fr  ·  06 66 54 55 88', 15, 31);

    // Badge statut
    const statusLabel = STATUS_LABELS[insp.status] || insp.status;
    doc.setFillColor(...orange);
    doc.roundedRect(150, 12, 45, 12, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel.toUpperCase(), 172.5, 19, { align: 'center' });

    // Titre véhicule
    const vehicle = `${insp.vehicle_make} ${insp.vehicle_model}${insp.vehicle_year ? ` (${insp.vehicle_year})` : ''}`;
    doc.setFontSize(18);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text(vehicle, 15, 55);

    doc.setFontSize(10);
    doc.setTextColor(...grey);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rapport d'inspection — ${formatDate(insp.inspection_date)}`, 15, 63);

    // Ligne séparatrice
    doc.setDrawColor(...orange);
    doc.setLineWidth(0.5);
    doc.line(15, 68, 195, 68);

    let y = 76;

    // Section véhicule
    y = pdfSection(doc, 'Informations véhicule', [
      ['Marque',      insp.vehicle_make],
      ['Modèle',      insp.vehicle_model],
      ['Année',       insp.vehicle_year],
      ['Plaque',      insp.vehicle_plate],
      ['VIN',         insp.vehicle_vin],
      ['Kilométrage', insp.vehicle_km ? `${insp.vehicle_km.toLocaleString('fr-FR')} km` : null],
    ], doc, y, orange, dark, grey);

    y += 6;

    // Section inspection
    y = pdfSection(doc, "Informations d'inspection", [
      ['Date',       formatDate(insp.inspection_date)],
      ['Inspecteur', insp.inspector_name || 'FOXCARS'],
      ['Statut',     STATUS_LABELS[insp.status] || insp.status],
    ], doc, y, orange, dark, grey);

    // Rapport détaillé
    if (insp.report_data && Object.keys(insp.report_data).length > 0) {
      const rows = buildReportRows(insp.report_data);
      if (rows.length > 0) {
        y += 6;
        if (y > 230) { doc.addPage(); y = 20; }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...orange);
        doc.text('Rapport détaillé', 15, y);
        y += 6;

        doc.autoTable({
          startY: y,
          head: [['Élément', 'Observation']],
          body: rows.map(([k, v]) => [k, stripHtml(v)]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: orange, textColor: [255,255,255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 248] },
          margin: { left: 15, right: 15 },
        });
        y = doc.lastAutoTable.finalY + 6;
      }
    }

    // Notes
    if (insp.notes && insp.notes.trim()) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...orange);
      doc.text('Notes & observations', 15, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...dark);
      const lines = doc.splitTextToSize(insp.notes, 175);
      doc.text(lines, 15, y);
      y += lines.length * 5 + 4;
    }

    // Pied de page sur toutes les pages
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(...grey);
      doc.text(
        `FOXCARS — Document généré le ${new Date().toLocaleDateString('fr-FR')} — Page ${p}/${pageCount}`,
        105, 290, { align: 'center' }
      );
    }

    const filename = `foxcars_${(insp.vehicle_make + '_' + insp.vehicle_model).toLowerCase().replace(/\s+/g, '_')}_${insp.inspection_date || 'inspection'}.pdf`;
    doc.save(filename);

  } catch (err) {
    console.error('Export PDF :', err);
    alert('Erreur lors de la génération du PDF.');
  }

  btn.disabled = false;
  btn.innerHTML = pdfBtnHtml();
}

function pdfSection(doc, title, fields, y, orange, dark, grey) {
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...orange);
  doc.text(title, 15, y);
  y += 5;

  const validFields = fields.filter(([, v]) => v != null && v !== '');
  doc.autoTable({
    startY: y,
    body: validFields.map(([k, v]) => [k, String(v)]),
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: grey, cellWidth: 50 }, 1: { textColor: dark } },
    margin: { left: 15, right: 15 },
    theme: 'plain',
  });
  return doc.lastAutoTable.finalY + 4;
}

// ── Export ZIP photos ────────────────────────────────────────
async function exportZIP() {
  if (photoUrls.length === 0) {
    alert('Aucune photo disponible pour cette inspection.');
    return;
  }

  const btn = document.getElementById('btn-zip');
  btn.disabled = true;
  btn.textContent = `Téléchargement…`;

  try {
    const zip  = new JSZip();
    const insp = currentInspection;
    const folder = zip.folder(`foxcars_${insp.vehicle_make}_${insp.vehicle_model}`.replace(/\s+/g, '_'));

    // Télécharge toutes les photos en parallèle
    const downloads = photoUrls.map(async (photo, i) => {
      const resp = await fetch(photo.url);
      if (!resp.ok) throw new Error(`Erreur téléchargement photo ${i + 1}`);
      const blob = await resp.blob();
      const ext  = blob.type.split('/')[1] || 'jpg';
      const name = photo.caption
        ? `${String(i + 1).padStart(2, '0')}_${photo.caption.replace(/[^a-z0-9]/gi, '_').substring(0, 40)}.${ext}`
        : `photo_${String(i + 1).padStart(2, '0')}.${ext}`;
      folder.file(name, blob);
    });

    await Promise.all(downloads);

    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const filename = `foxcars_photos_${(insp.vehicle_make + '_' + insp.vehicle_model).toLowerCase().replace(/\s+/g, '_')}_${insp.inspection_date || 'inspection'}.zip`;

    saveAs(content, filename);

  } catch (err) {
    console.error('Export ZIP :', err);
    alert('Erreur lors de la création du ZIP. Vérifiez votre connexion.');
  }

  btn.disabled = false;
  btn.innerHTML = zipBtnHtml();
}

// ── Utilitaires ──────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(str) {
  return String(str).replace(/<[^>]*>/g, '');
}

function pdfBtnHtml() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/></svg> Exporter PDF`;
}

function zipBtnHtml() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Photos ZIP`;
}
