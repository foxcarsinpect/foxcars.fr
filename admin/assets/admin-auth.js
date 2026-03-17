// ============================================================
// FOXCARS — Auth Admin
// Guard + helpers pour l'espace administration
// ============================================================

let _supabaseAdmin = null;

function getSupabase() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabaseAdmin;
}

// ── Vérifie session + role='admin' ───────────────────────────
async function requireAdmin() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = '/admin/index.html';
    return null;
  }
  const { data } = await sb.from('clients')
    .select('role, full_name, email').eq('id', session.user.id).single();
  if (!data || data.role !== 'admin') {
    window.location.href = '/admin/index.html';
    return null;
  }
  return { session, profile: data };
}

// ── Redirige si déjà connecté en admin ──────────────────────
async function redirectIfAdminLoggedIn() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('clients')
    .select('role').eq('id', session.user.id).single();
  if (data?.role === 'admin') {
    window.location.href = '/admin/dashboard.html';
  }
}

// ── Login ────────────────────────────────────────────────────
async function adminLogin(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Vérifie que l'utilisateur est bien admin
  const { data: profile } = await sb.from('clients')
    .select('role').eq('id', data.user.id).single();
  if (!profile || profile.role !== 'admin') {
    await sb.auth.signOut();
    throw new Error('NOT_ADMIN');
  }
  return data;
}

// ── Logout ───────────────────────────────────────────────────
async function adminLogout() {
  const sb = getSupabase();
  await sb.auth.signOut();
  window.location.href = '/admin/index.html';
}

// ── Affiche le nom admin dans le header ──────────────────────
async function renderAdminHeader() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data } = await sb.from('clients')
    .select('full_name').eq('id', user.id).single();
  const nameEl = document.getElementById('admin-name');
  if (nameEl) nameEl.textContent = data?.full_name || user.email;
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);
}

// ── Envoie un email de reset mdp à un client ─────────────────
async function sendClientPasswordReset(email) {
  const sb = getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/portail/reset-password.html',
  });
  if (error) throw error;
}

// ── Crée un nouveau client via signUp ────────────────────────
async function createClient({ email, password, full_name, company_name, phone }) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });
  if (error) throw error;

  // Met à jour les champs supplémentaires dans clients
  if (data.user) {
    await sb.from('clients').upsert({
      id: data.user.id,
      full_name,
      email,
      company_name: company_name || null,
      phone: phone || null,
    });
  }
  return data;
}
