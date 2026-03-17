// ============================================================
// FOXCARS — Auth helper
// Gestion de la session Supabase : login, logout, guard
// ============================================================

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ── Vérifie la session et redirige si non connecté ──────────
async function requireAuth() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = '/portail/index.html';
    return null;
  }
  return session;
}

// ── Redirige vers dashboard si déjà connecté ────────────────
async function redirectIfLoggedIn() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    window.location.href = '/portail/dashboard.html';
  }
}

// ── Login email + password ───────────────────────────────────
async function login(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ── Déconnexion ──────────────────────────────────────────────
async function logout() {
  const sb = getSupabase();
  await sb.auth.signOut();
  window.location.href = '/portail/index.html';
}

// ── Récupère le profil client connecté ──────────────────────
async function getClientProfile() {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb.from('clients').select('*').eq('id', user.id).single();
  return data || { id: user.id, full_name: user.email };
}

// ── Réinitialisation du mot de passe (envoie l'e-mail) ───────
async function sendPasswordReset(email) {
  const sb = getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/portail/reset-password.html',
  });
  if (error) throw error;
}

// ── Mise à jour du mot de passe après réinitialisation ───────
async function updatePassword(newPassword) {
  const sb = getSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ── Affiche le nom dans le header ────────────────────────────
async function renderUserHeader() {
  const profile = await getClientProfile();
  if (!profile) return;

  const nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = profile.full_name || profile.id;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
}
