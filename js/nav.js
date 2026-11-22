// ═══════════════════════════════════════
//  Navigation — sidebar rétractable (desktop) / drawer (mobile)
// ═══════════════════════════════════════
const SECTION_TITLES = {
  synthese: 'Synthèse',
  budget: 'Budget',
  comptes: 'Liquidités',
  actifs: 'Patrimoine',
  immobilier: 'Immobilier',
  simu_pea: 'Investissements',
  simulations: 'Simulations',
  objectifs: 'Objectifs',
  parametres: 'Paramètres'
};

function showSection(id, tab) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(t=>t.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  if (tab) tab.classList.add('active');

  // La navigation elle-même (section visible, titre) ne doit jamais être bloquée
  // par une erreur de rendu des données (ex. souci réseau/cloud) : on l'applique d'abord.
  const mobileTitle = document.getElementById('mobileTitle');
  if (mobileTitle) mobileTitle.textContent = SECTION_TITLES[id] || '';
  closeSidebarMobile();

  try {
    if (typeof renderAll === 'function') renderAll();
  } catch (e) {
    console.error('Erreur lors du rendu de la section', id, e);
    notify('Impossible d\'actualiser certaines données. Vérifiez votre connexion puis réessayez.', true);
  }
}

// ── Sous-onglets internes à une page (Immobilier, Patrimoine…) ──
// Scopé à la section parente pour éviter qu'un sous-onglet actif dans une page
// n'efface l'état des sous-onglets d'une autre page (elles ne se réaffectent
// pas globalement, contrairement à un simple querySelectorAll('.sub-tab')).
function showSubTab(sectionId, tabId, el) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.querySelectorAll('.sub-section').forEach(s=>s.classList.remove('active'));
  section.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
}

// ── Sidebar rétractable (desktop) ──
function toggleSidebar() {
  const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
  try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch {}
}

// ── Drawer mobile ──
function openSidebarMobile() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('show');
}
function closeSidebarMobile() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
}

// ── Modales (inchangé) ──
function openModal(id) {
  document.getElementById(id).classList.add('open');
  const d = document.getElementById('bDate');
  if (d && !d.value) d.value = today();
  const od = document.getElementById('opDate');
  if (od && !od.value) od.value = today();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click', e=>{ if (e.target===m) m.classList.remove('open'); });
});

// Fermeture des modales et du drawer mobile avec Échap
document.addEventListener('keydown', e=>{
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
  closeSidebarMobile();
});

// ═══════════════════════════════════════
//  Panel admin — choix des fenêtres affichées dans le bandeau latéral
//  Stocké dans state.settings.navHidden (liste d'ids de section masquées) : synchronisé avec le cloud.
//  Masquer une entrée ne touche à aucune donnée ; « Paramètres » ne peut pas être masqué.
// ═══════════════════════════════════════
const navHiddenIds = () => (state.settings && Array.isArray(state.settings.navHidden)) ? state.settings.navHidden : [];

function renderNavAdmin() {
  const items = [...document.querySelectorAll('#sidebarNav .nav-item[data-section]')];
  const hidden = new Set(navHiddenIds());
  items.forEach(el=>{ el.style.display = hidden.has(el.dataset.section) ? 'none' : ''; });

  // La section active vient d'être masquée : on bascule sur la première visible (ou Paramètres),
  // sans relancer le rendu (on est déjà dedans).
  const active = document.querySelector('.section.active');
  if (active && hidden.has(active.id)) {
    const next = items.find(el=>!hidden.has(el.dataset.section));
    const targetId = next ? next.dataset.section : 'parametres';
    document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active', s.id===targetId));
    document.querySelectorAll('.nav-item').forEach(t=>t.classList.remove('active'));
    const navEl = next || document.querySelector('.sidebar-bottom .nav-item[data-section="parametres"]');
    if (navEl) navEl.classList.add('active');
    const mt = document.getElementById('mobileTitle');
    if (mt) mt.textContent = SECTION_TITLES[targetId] || '';
  }

  const list = document.getElementById('navAdminList');
  if (!list) return;
  list.innerHTML = items.map(el=>{
    const id = el.dataset.section;
    const icon = el.querySelector('.nav-icon')?.textContent || '';
    const label = el.querySelector('.nav-label')?.textContent || id;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px">
      <input type="checkbox" ${hidden.has(id)?'':'checked'} onchange="toggleNavItem('${id}', this.checked)">
      <span>${icon}</span><span>${esc(label)}</span>
    </label>`;
  }).join('');
}
function toggleNavItem(id, visible) {
  if (!state.settings) state.settings = {};
  const hidden = new Set(navHiddenIds());
  if (visible) hidden.delete(id); else hidden.add(id);
  state.settings.navHidden = [...hidden];
  renderAll();
}
function resetNavAdmin() {
  if (!state.settings) state.settings = {};
  state.settings.navHidden = [];
  renderAll();
}
