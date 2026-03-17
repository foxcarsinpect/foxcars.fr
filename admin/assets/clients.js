// ============================================================
// FOXCARS Admin — Clients
// Liste, création, reset mot de passe
// ============================================================

let allClients      = [];
let inspCountMap    = {};
let resetEmailTarget = '';

async function loadClients() {
  const sb = getSupabase();

  const [{ data: clients }, { data: inspCounts }] = await Promise.all([
    sb.from('clients').select('*').neq('role', 'admin').order('created_at', { ascending: false }),
    sb.from('inspections').select('client_id'),
  ]);

  allClients = clients || [];

  // Compte les inspections par client
  inspCountMap = {};
  (inspCounts || []).forEach(i => {
    inspCountMap[i.client_id] = (inspCountMap[i.client_id] || 0) + 1;
  });

  renderClients(allClients);

  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';

  // Recherche
  document.getElementById('search-input').addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    if (!q) { renderClients(allClients); return; }
    renderClients(allClients.filter(c =>
      `${c.full_name} ${c.company_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(q)
    ));
  });

  // Modal nouveau client
  document.getElementById('btn-new-client').addEventListener('click', openNewClientModal);
  document.getElementById('modal-close').addEventListener('click', closeNewClientModal);
  document.getElementById('modal-cancel').addEventListener('click', closeNewClientModal);
  document.getElementById('modal-save').addEventListener('click', saveNewClient);

  // Modal reset mdp
  document.getElementById('reset-close').addEventListener('click', closeResetModal);
  document.getElementById('reset-cancel').addEventListener('click', closeResetModal);
  document.getElementById('reset-confirm').addEventListener('click', doResetPassword);
}

function renderClients(clients) {
  const tbody = document.getElementById('clients-body');
  const empty = document.getElementById('empty-state');

  if (clients.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = clients.map(c => `
    <tr>
      <td style="font-weight:600;">${escapeHtml(c.full_name)}</td>
      <td class="td-muted">${escapeHtml(c.company_name || '—')}</td>
      <td class="td-muted">${escapeHtml(c.email || '—')}</td>
      <td class="td-muted">${escapeHtml(c.phone || '—')}</td>
      <td>
        <a href="dashboard.html" style="color:var(--orange-bright);font-weight:600;">
          ${inspCountMap[c.id] || 0}
        </a>
      </td>
      <td class="td-muted">${formatDate(c.created_at)}</td>
      <td class="td-actions">
        <button class="btn btn-sm btn-ghost" onclick="openResetModal('${escapeHtml(c.email || '')}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          Reset mdp
        </button>
        <a href="inspection-form.html?client=${c.id}" class="btn btn-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Inspection
        </a>
      </td>
    </tr>`).join('');
}

// ── Modal nouveau client ─────────────────────────────────────
function openNewClientModal() {
  ['c-name', 'c-company', 'c-email', 'c-phone', 'c-password'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('modal-alert').innerHTML = '';
  document.getElementById('modal-new-client').classList.add('open');
}

function closeNewClientModal() {
  document.getElementById('modal-new-client').classList.remove('open');
}

async function saveNewClient() {
  const full_name    = document.getElementById('c-name').value.trim();
  const company_name = document.getElementById('c-company').value.trim();
  const email        = document.getElementById('c-email').value.trim();
  const phone        = document.getElementById('c-phone').value.trim();
  const password     = document.getElementById('c-password').value;

  const alertEl = document.getElementById('modal-alert');

  if (!full_name || !email || !password) {
    alertEl.innerHTML = '<div class="alert alert-error">Veuillez remplir les champs obligatoires.</div>';
    return;
  }
  if (password.length < 8) {
    alertEl.innerHTML = '<div class="alert alert-error">Le mot de passe doit contenir au moins 8 caractères.</div>';
    return;
  }

  const saveBtn  = document.getElementById('modal-save');
  const saveText = document.getElementById('save-text');
  const saveSpin = document.getElementById('save-spin');
  saveBtn.disabled = true;
  saveText.style.display = 'none';
  saveSpin.style.display = '';

  try {
    await createClient({ email, password, full_name, company_name, phone });
    alertEl.innerHTML = '<div class="alert alert-success">✅ Compte créé. Un e-mail de confirmation a été envoyé au client.</div>';

    // Recharge la liste après 1.5s et ferme le modal
    setTimeout(async () => {
      closeNewClientModal();
      document.getElementById('loading').style.display = 'flex';
      document.getElementById('content').style.display = 'none';
      await loadClients();
    }, 1500);

  } catch (err) {
    const msgs = {
      'User already registered': 'Un compte avec cet e-mail existe déjà.',
    };
    alertEl.innerHTML = `<div class="alert alert-error">${msgs[err.message] || 'Erreur lors de la création : ' + escapeHtml(err.message)}</div>`;
    saveBtn.disabled = false;
    saveText.style.display = '';
    saveSpin.style.display = 'none';
  }
}

// ── Modal reset mot de passe ─────────────────────────────────
function openResetModal(email) {
  if (!email) {
    alert('Ce client n\'a pas d\'adresse e-mail enregistrée.');
    return;
  }
  resetEmailTarget = email;
  document.getElementById('reset-email-display').textContent = email;
  document.getElementById('reset-alert').innerHTML = '';
  document.getElementById('reset-confirm').disabled = false;
  document.getElementById('reset-confirm').textContent = 'Envoyer l\'e-mail';
  document.getElementById('modal-reset').classList.add('open');
}

function closeResetModal() {
  document.getElementById('modal-reset').classList.remove('open');
}

async function doResetPassword() {
  const btn = document.getElementById('reset-confirm');
  btn.disabled = true;
  btn.textContent = 'Envoi…';

  try {
    await sendClientPasswordReset(resetEmailTarget);
    document.getElementById('reset-alert').innerHTML =
      '<div class="alert alert-success">✅ E-mail de réinitialisation envoyé.</div>';
    setTimeout(closeResetModal, 2000);
  } catch (err) {
    document.getElementById('reset-alert').innerHTML =
      `<div class="alert alert-error">Erreur : ${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Réessayer';
  }
}

// ── Utilitaires ──────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
