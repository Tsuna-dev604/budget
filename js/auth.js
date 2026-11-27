// ═══════════════════════════════════════
//  Authentification et synchronisation cloud Supabase
//  (identifiants du projet : voir js/config.js)
// ═══════════════════════════════════════
let currentUser = null;
let authMode = 'signin';
let saveTimer = null;
let isLoadingCloud = false;
let cloudReady = false; // true seulement si le chargement cloud a réussi : évite d'écraser le cloud par un état vide
// Verrou optimiste : updated_at de la ligne telle que chargée ou dernièrement écrite par CET onglet
// (null = aucune ligne en base). Une sauvegarde n'est acceptée que si la ligne n'a pas changé entre-temps :
// un onglet resté ouvert avec des données anciennes ne peut plus écraser ce qu'un autre appareil a saisi.
let cloudUpdatedAt = null;
let saveInFlight = null, saveAgain = false;

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

// Données locales retirées de la mémoire (déconnexion, y compris depuis un autre onglet).
function clearLocalSession() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  currentUser = null;
  cloudReady = false;
  cloudUpdatedAt = null;
  state = getDefaultState(); // ne jamais garder les données d'un utilisateur déconnecté en mémoire
}

async function doSignOut() {
  await flushCloudSave(); // une modification faite dans la seconde précédente ne doit pas être perdue
  if (sb) await sb.auth.signOut();
  clearLocalSession();
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
  if (cloudReady && runAutoSync()) scheduleCloudSave(); // salaires / versements échus depuis la dernière visite
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
  cloudReady = false;
  state = getDefaultState();
  cloudUpdatedAt = null;
  try {
    const { data, error } = await sb.from('budget_data').select('data, updated_at').eq('user_id', currentUser.id).maybeSingle();
    if (error) { console.error(error); notify('Erreur de chargement cloud — synchronisation suspendue pour protéger vos données', true); return; }
    if (data) {
      if (data.data) state = { ...getDefaultState(), ...data.data };
      cloudUpdatedAt = data.updated_at || null;
    }
    cloudReady = true; // (aucune donnée en base = compte vierge : on part de l'état initial)
  } finally {
    isLoadingCloud = false;
  }
}

function scheduleCloudSave() {
  if (!sb || !currentUser || isLoadingCloud || !cloudReady) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCloudState, 1200);
}
const cloudSavePending = () => !!saveTimer || !!saveInFlight;

// Envoie tout de suite une sauvegarde programmée (onglet masqué, déconnexion).
async function flushCloudSave() {
  if (saveTimer) await saveCloudState();
  else if (saveInFlight) await saveInFlight;
}

async function saveCloudState() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!sb || !currentUser || !cloudReady) return;
  if (saveInFlight) { saveAgain = true; return saveInFlight; } // une écriture à la fois
  saveInFlight = writeCloudState();
  try { await saveInFlight; }
  finally {
    saveInFlight = null;
    if (saveAgain) { saveAgain = false; scheduleCloudSave(); }
  }
}

async function writeCloudState() {
  const userId = currentUser.id;
  const ts = new Date().toISOString();
  const res = cloudUpdatedAt
    ? await sb.from('budget_data').update({ data: state, updated_at: ts })
        .eq('user_id', userId).eq('updated_at', cloudUpdatedAt).select('updated_at')
    : await sb.from('budget_data').insert({ user_id: userId, data: state, updated_at: ts }).select('updated_at');
  if (!currentUser || currentUser.id !== userId) return; // déconnecté pendant l'écriture
  const { data, error } = res;
  if (error) {
    if (error.code === '23505') { onCloudConflict(); return; } // ligne créée entre-temps par un autre appareil
    console.error(error); notify('Échec de la synchronisation cloud', true); return;
  }
  if (!data || !data.length) { onCloudConflict(); return; } // ligne modifiée ailleurs : rien n'a été écrasé
  cloudUpdatedAt = data[0].updated_at;
}

// Les données en ligne ont changé depuis le chargement de cet onglet : on suspend la synchronisation
// (rien n'est écrasé) et on laisse choisir entre recharger la dernière version et garder une copie locale.
function onCloudConflict() {
  cloudReady = false;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const recharger = confirm('Vos données ont été modifiées depuis un autre onglet ou appareil.\n\n'
    + 'OK = recharger la dernière version (les modifications faites ici depuis le dernier enregistrement seront perdues)\n'
    + 'Annuler = télécharger une sauvegarde de cette version ; la synchronisation reste suspendue jusqu\'au rechargement de la page.');
  if (recharger) { location.reload(); return; }
  exportData();
  notify('Synchronisation suspendue : rechargez la page pour reprendre', true);
}

// Au retour sur l'onglet : si la ligne a changé ailleurs et qu'aucune modification locale n'est en attente,
// on recharge simplement la dernière version (évite le conflit dans le cas courant). Retourne true si l'état a changé.
async function refreshFromCloudIfChanged() {
  if (!sb || !currentUser || !cloudReady || cloudSavePending()) return false;
  const userId = currentUser.id;
  const { data, error } = await sb.from('budget_data').select('updated_at').eq('user_id', userId).maybeSingle();
  if (error || !data || data.updated_at === cloudUpdatedAt) return false;
  const full = await sb.from('budget_data').select('data, updated_at').eq('user_id', userId).maybeSingle();
  // Modification locale survenue pendant la requête, ou déconnexion : on ne remplace rien.
  if (full.error || !full.data || cloudSavePending() || !currentUser || currentUser.id !== userId) return false;
  state = { ...getDefaultState(), ...(full.data.data || {}) };
  cloudUpdatedAt = full.data.updated_at;
  return true;
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
      clearLocalSession(); // déconnexion depuis un autre onglet / session expirée : plus de données en mémoire
      document.body.classList.remove('authed');
      document.getElementById('authOverlay').classList.remove('hidden');
    }
  });
}
