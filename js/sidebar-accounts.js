// ═══════════════════════════════════════
//  COMPTES DANS LA BARRE LATÉRALE — vue d'ensemble permanente de où est l'argent
//
//  Groupes : comptes courants, épargne, investissements (PEA/CTO), immobilier, biens physiques, dettes.
//  Mêmes sources et mêmes calculs que le patrimoine net (patrimoine.js) : la somme des groupes est
//  exactement getPatrimoineNet(), affiché en tête. Groupes vides masqués ; repli mémorisé (localStorage).
//  Clic sur un compte : ouvre la page qui le gère, active le bon sous-onglet et met la ligne en évidence
//  (repère data-acc="type:id" posé par chaque page). « ＋ » ouvre la fenêtre de création adaptée.
// ═══════════════════════════════════════
const SIDEBAR_ACC_STORAGE = 'sidebarAccGroupsClosed';

// Chaque élément : {kind, id, label, value, sub?} ; kind sert à la navigation (goToSidebarAccount).
function getSidebarAccountGroups() {
  const actifs = cat => state.actifs.filter(a=>a.category===cat);
  const peaValeur = compteId => (state.peaTitres||[]).filter(t=>t.compteId===compteId)
    .reduce((s,t)=>s + peaQte(t)*peaCoursActuel(t), 0);
  const peaSansCompte = (state.peaTitres||[]).filter(t=>!(state.peaComptes||[]).some(c=>c.id===t.compteId))
    .reduce((s,t)=>s + peaQte(t)*peaCoursActuel(t), 0);
  const groups = [
    {key:'comptes', label:'Comptes courants', icon:'🏦', add:'compte',
      items: state.comptes.map(c=>({kind:'compte', id:c.id, label:c.label, value:getSoldeCompte(c.id),
        sub: compteHorsBudget(c) ? 'hors budget' : ''}))},
    {key:'epargne', label:'Épargne', icon:'🐷', add:'epargne',
      items: [...actifs('liquide'), ...actifs('semiliquide')].map(a=>({kind:'actif', id:a.id, label:a.label, value:a.valeur||0}))},
    {key:'invest', label:'Investissements', icon:'📈', add:'pea',
      items: (state.peaComptes||[]).map(c=>({kind:'pea', id:c.id, label:c.nom, value:peaValeur(c.id), sub:c.type||''}))
        .concat(peaSansCompte ? [{kind:'pea', id:'', label:'Positions sans compte', value:peaSansCompte}] : [])},
    {key:'immo', label:'Immobilier', icon:'🏠', add:'immo',
      items: actifs('immobilier').map(a=>a._immoRef
        ? {kind:'bien', id:a._immoRef, label:a.label, value:a.valeur||0}
        : {kind:'actif', id:a.id, label:a.label, value:a.valeur||0})},
    {key:'biens', label:'Biens physiques', icon:'💎', add:'physique',
      items: actifs('physique').map(a=>({kind:'actif', id:a.id, label:a.label, value:a.valeur||0}))},
    {key:'dettes', label:'Dettes', icon:'📉', add:'passif',
      items: state.passifs.map(p=>({kind:'passif', id:p.id, label:p.label, value:-(p.crd||0)}))},
  ];
  groups.forEach(g=>{ g.total = g.items.reduce((s,i)=>s+i.value, 0); });
  return groups.filter(g=>g.items.length);
}

function sidebarAccClosed() {
  try { return new Set(JSON.parse(localStorage.getItem(SIDEBAR_ACC_STORAGE)||'[]')); } catch { return new Set(); }
}
function toggleSidebarAccGroup(key) {
  const closed = sidebarAccClosed();
  if (closed.has(key)) closed.delete(key); else closed.add(key);
  try { localStorage.setItem(SIDEBAR_ACC_STORAGE, JSON.stringify([...closed])); } catch {}
  renderSidebarAccounts();
}

function renderSidebarAccounts() {
  const el = document.getElementById('sidebarAccounts');
  if (!el) return;
  const groups = getSidebarAccountGroups();
  if (!groups.length) {
    el.innerHTML = `<div class="sacc-head"><span>Comptes</span></div>
      <button type="button" class="sacc-empty" data-add="compte">＋ Ajouter un premier compte</button>`;
    return;
  }
  const closed = sidebarAccClosed();
  const money = v => `<span class="sacc-amount${v<0?' neg':''}" title="${esc(fmt(v))}">${esc(fmt(v,0))}</span>`;
  const net = getPatrimoineNet();
  el.innerHTML = `
    <div class="sacc-head" title="Somme de tous les groupes ci-dessous"><span>Patrimoine net</span>${money(net)}</div>
    ${groups.map(g=>{
      const open = !closed.has(g.key);
      return `<div class="sacc-group${open?' open':''}">
        <div class="sacc-group-row">
          <button type="button" class="sacc-group-toggle" data-toggle="${g.key}" aria-expanded="${open}">
            <span class="sacc-chevron"></span><span class="sacc-icon">${g.icon}</span>
            <span class="sacc-label">${esc(g.label)}</span>${money(g.total)}
          </button>
          <button type="button" class="sacc-add" data-add="${g.add}" title="Ajouter : ${esc(g.label.toLowerCase())}">＋</button>
        </div>
        ${open ? `<div class="sacc-items">${g.items.map(i=>`
          <button type="button" class="sacc-item" data-kind="${i.kind}" data-id="${esc(i.id)}" title="${esc(i.label)} — ${esc(fmt(i.value))}">
            <span class="sacc-label">${esc(i.label)}${i.sub?` <span class="sacc-tag">${esc(i.sub)}</span>`:''}</span>${money(i.value)}
          </button>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}`;
}

// Un seul écouteur délégué : aucun id ni libellé n'est injecté dans un onclick.
document.addEventListener('click', e=>{
  const root = e.target.closest('#sidebarAccounts');
  if (!root) return;
  const t = e.target.closest('[data-toggle],[data-add],[data-kind]');
  if (!t) return;
  if (t.dataset.toggle) toggleSidebarAccGroup(t.dataset.toggle);
  else if (t.dataset.add) addSidebarAccount(t.dataset.add);
  else goToSidebarAccount(t.dataset.kind, t.dataset.id);
});

// ── Navigation vers le compte ──
const SIDEBAR_ACC_TARGETS = {
  compte: {section:'comptes'},
  actif:  {section:'actifs', tab:'patr-vue'},
  passif: {section:'actifs', tab:'patr-vue'},
  bien:   {section:'immobilier', tab:'bien-list'},
  pea:    {section:'simu_pea', tab:'inv-comptes'},
};
function goToSidebarAccount(kind, id) {
  const target = SIDEBAR_ACC_TARGETS[kind];
  if (!target) return;
  showSection(target.section, document.querySelector(`.nav-item[data-section="${target.section}"]`));
  if (target.tab) {
    const tab = document.querySelector(`#${target.section} .sub-tab[onclick*="'${target.tab}'"]`);
    if (tab && !tab.classList.contains('active')) tab.click();
  }
  if (!id) return;
  const row = [...document.querySelectorAll(`#${target.section} [data-acc]`)].find(r=>r.dataset.acc===`${kind}:${id}`);
  if (!row) return;
  row.scrollIntoView({behavior:'smooth', block:'center'});
  row.classList.remove('acc-flash'); void row.offsetWidth; row.classList.add('acc-flash');
}

// ── « ＋ » : fenêtre de création adaptée au groupe ──
function addSidebarAccount(kind) {
  closeSidebarMobile();
  const actif = category => {
    openAddActif();
    document.getElementById('aCategory').value = category;
    toggleActifFields();
  };
  switch (kind) {
    case 'compte':   openAddCompte(); break;
    case 'epargne':  actif('liquide'); break;
    case 'physique': actif('physique'); break;
    case 'pea':      openAddPeaCompte(); break;
    case 'immo':     openImmoActifModal(); break;
    case 'passif':   openAddPassif(); break;
  }
}
