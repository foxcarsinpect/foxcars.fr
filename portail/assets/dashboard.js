// ============================================================
// FOXCARS — Dashboard : liste des inspections
// ============================================================

const STATUS_LABELS = {
  transmitted: 'Transmis',
  completed:   'Terminé',
  in_progress: 'En cours',
};

const STATUS_ICONS = {
  transmitted: '📤',
  completed:   '✅',
  in_progress: '🔧',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildInspectionCard(insp, photosCount) {
  const statusClass = `badge-${insp.status}`;
  const statusLabel = STATUS_LABELS[insp.status] || insp.status;
  const statusIcon  = STATUS_ICONS[insp.status] || '';

  const vehicle = `${insp.vehicle_make} ${insp.vehicle_model}${insp.vehicle_year ? ` (${insp.vehicle_year})` : ''}`;
  const plate   = insp.vehicle_plate ? `<span class="insp-plate">${insp.vehicle_plate}</span>` : '';
  const km      = insp.vehicle_km    ? `${insp.vehicle_km.toLocaleString('fr-FR')} km` : null;

  const metaItems = [
    { icon: calendarIcon(), text: formatDate(insp.inspection_date) },
    km ? { icon: speedoIcon(), text: km } : null,
    { icon: personIcon(), text: insp.inspector_name || 'FOXCARS' },
  ].filter(Boolean);

  const metaHtml = metaItems.map(m => `
    <div class="insp-meta-item">
      ${m.icon}
      <span>${m.text}</span>
    </div>
  `).join('');

  const photosHtml = photosCount > 0
    ? `<div class="photos-count">📷 ${photosCount} photo${photosCount > 1 ? 's' : ''}</div>`
    : '';

  return `
    <article class="card inspection-card" data-id="${insp.id}" role="button" tabindex="0"
      aria-label="Inspection ${vehicle}">
      <div class="insp-card-header">
        <div>
          <p class="insp-vehicle">${vehicle}</p>
          ${plate}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <span class="badge ${statusClass}">${statusIcon} ${statusLabel}</span>
          ${photosHtml}
        </div>
      </div>
      <div class="insp-meta">${metaHtml}</div>
    </article>
  `;
}

async function loadDashboard() {
  const sb = getSupabase();
  const grid = document.getElementById('inspections-grid');

  // Inspections du client connecté
  const { data: inspections, error } = await sb
    .from('inspections')
    .select('*')
    .in('status', ['completed', 'transmitted'])
    .order('inspection_date', { ascending: false });

  if (error) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <p>Impossible de charger les inspections. Actualisez la page.</p>
      </div>`;
    console.error(error);
    return;
  }

  if (!inspections || inspections.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        ${carIcon()}
        <h3>Aucune inspection disponible</h3>
        <p>Vos rapports d'inspection apparaîtront ici une fois transmis par FOXCARS.</p>
      </div>`;
    return;
  }

  // Nombre de photos par inspection
  const ids = inspections.map(i => i.id);
  const { data: photoCounts } = await sb
    .from('inspection_photos')
    .select('inspection_id')
    .in('inspection_id', ids);

  const countMap = {};
  (photoCounts || []).forEach(p => {
    countMap[p.inspection_id] = (countMap[p.inspection_id] || 0) + 1;
  });

  grid.innerHTML = inspections
    .map(insp => buildInspectionCard(insp, countMap[insp.id] || 0))
    .join('');

  // Navigation vers le détail
  grid.querySelectorAll('.inspection-card').forEach(card => {
    const go = () => {
      window.location.href = `/portail/inspection.html?id=${card.dataset.id}`;
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
  });
}

// ── Icônes SVG inline ────────────────────────────────────────
function calendarIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
}
function speedoIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/><path d="m12 12 4-4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`;
}
function personIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>`;
}
function carIcon() {
  return `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M5 17H3a2 2 0 0 1-2-2V9l3-4h14l3 4v6a2 2 0 0 1-2 2h-2"/>
    <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
    <path d="M9 17h6"/></svg>`;
}
