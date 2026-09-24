// ═══════════════════════════════════════
//  Authentification et synchronisation cloud Supabase
//  (identifiants du projet : voir js/config.js)
// ═══════════════════════════════════════
let currentUser = null;
let authMode = 'signin';
let saveTimer = null;
let isLoadingCloud = false;

function switchAuthTab(mode) {
  authMode = mode;
  document.getElementById('tabSignIn').classList.toggle('active', mode==='signin');
  document.getElementById('tabSignUp').classList.toggle('active', mode==='signup');
  document.getElementById('authSubmitBtn').textContent = mode==='signin' ? 'Se connecter' : 'Créer mon compte';
  document.getElementById('authMsg').textContent = '';
}

function setAuthMsg(msg, kind) {
  const el = document.getElementById('authMsg');
  el.textContent = msg;
  el.className = 'auth-msg' + (kind ? ' '+kind : '');
}

async function submitAuth() {
  if (!sb) { setAuthMsg('Configuration Supabase manquante : renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le code.', 'error'); return; }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!email || !password) { setAuthMsg('Email et mot de passe requis.', 'error'); return; }
  setAuthMsg('', '');
  if (authMode === 'signin') {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setAuthMsg(error.message, 'error'); return; }
    await onAuthReady(data.user);
  } else {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { setAuthMsg(error.message, 'error'); return; }
    if (data.session) { await onAuthReady(data.user); }
    else setAuthMsg('Compte créé. Vérifiez votre email pour confirmer, puis connectez-vous.', 'ok');
  }
}

async function doSignOut() {
  if (saveTimer) clearTimeout(saveTimer);
  if (sb) await sb.auth.signOut();
  currentUser = null;
  document.body.classList.remove('authed');
  document.getElementById('authOverlay').classList.remove('hidden');
  document.getElementById('authFormWrap').style.display = '';
  document.getElementById('authLoading').style.display = 'none';
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
}

async function onAuthReady(user) {
  currentUser = user;
  document.getElementById('authFormWrap').style.display = 'none';
  document.getElementById('authLoading').style.display = '';
  await loadCloudState();
  document.getElementById('userBadge').textContent = currentUser.email;
  const userBadgeSettings = document.getElementById('userBadgeSettings');
  if (userBadgeSettings) userBadgeSettings.textContent = currentUser.email;
  document.getElementById('authOverlay').classList.add('hidden');
  document.body.classList.add('authed');
  updateCategChips();
  buildYearSelect();
  renderAllInner();
  if (state.budget.length===0 && state.actifs.length===0) {
    notify('Compte vierge — importez votre fichier JSON de sauvegarde pour récupérer vos données');
  }
}

async function loadCloudState() {
  isLoadingCloud = true;
  try {
    const { data, error } = await sb.from('budget_data').select('data').eq('user_id', currentUser.id).maybeSingle();
    if (error) { console.error(error); notify('Erreur de chargement cloud', true); return; }
    if (data && data.data) {
      state = { budget:[],actifs:[],passifs:[],salaire:null,immoBiens:[],locataires:[],charges:[],priceHistory:[],patrimoineHistory:[],comptes:[],peaComptes:[],peaTitres:[],budgetPrevisionnel:{},settings:{apiKeyAlpha:'',cacheTtlMin:15}, ...data.data };
    }
    // Sinon : aucune donnée en base pour ce compte -> on part d'un état vide (state initial).
  } finally {
    isLoadingCloud = false;
  }
}

function scheduleCloudSave() {
  if (!sb || !currentUser || isLoadingCloud) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCloudState, 1200);
}

async function saveCloudState() {
  if (!sb || !currentUser) return;
  const { error } = await sb.from('budget_data').upsert({ user_id: currentUser.id, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) { console.error(error); notify('Échec de la synchronisation cloud', true); }
}

async function initAuth() {
  if (!sb) {
    // Pas de config Supabase : on affiche quand même le formulaire avec un message d'erreur explicite,
    // pour ne jamais faire tourner l'app sans protection par login.
    setAuthMsg('Configuration Supabase manquante : renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le code.', 'error');
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user) {
    await onAuthReady(session.user);
  }
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      document.body.classList.remove('authed');
      document.getElementById('authOverlay').classList.remove('hidden');
    }
  });
}
