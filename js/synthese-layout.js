// ═══════════════════════════════════════
//  DISPOSITION DE LA PAGE SYNTHÈSE — choix des informations affichées, de leur ordre
//  et de la largeur des blocs (Paramètres › Panel admin — Page Synthèse).
//
//  Stocké dans state.settings.syntheseLayout = {kpis:[{id,visible}], blocks:[{id,visible,width}]},
//  donc synchronisé avec le cloud comme navHidden. Seule la présentation change : aucune donnée
//  n'est touchée. La disposition enregistrée est toujours relue à travers normalize…() : un id
//  inconnu (fichier importé, ancienne version) est ignoré, un bloc ajouté plus tard apparaît à la fin.
// ═══════════════════════════════════════
const SYNTHESE_KPIS = [
  {id:'net',     label:'Patrimoine net'},
  {id:'var12',   label:'Variation 12 mois'},
  {id:'epargne', label:'Capacité d\'épargne'},
  {id:'liquid',  label:'Liquidités disponibles'},
  {id:'dette',   label:'Dettes restantes'},
];
const SYNTHESE_BLOCKS = [
  {id:'evolution',  label:'Évolution du patrimoine', width:'full'},
  {id:'depenses',   label:'Où va mon argent ?',      width:'half'},
  {id:'allocation', label:'Où est mon argent ?',     width:'half'},
  {id:'flux',       label:'Flux du mois',            width:'full'},
  {id:'physiques',  label:'Biens physiques',         width:'half'},
  {id:'points',     label:'Points à surveiller',     width:'half'},
];

function normalizeLayoutList(saved, defaults, withWidth) {
  const known = new Map(defaults.map(d=>[d.id, d]));
  const out = [], seen = new Set();
  (Array.isArray(saved) ? saved : []).forEach(e=>{
    if (!e || typeof e!=='object' || !known.has(e.id) || seen.has(e.id)) return;
    seen.add(e.id);
    const item = {id:e.id, visible:e.visible!==false};
    if (withWidth) item.width = (e.width==='full' || e.width==='half') ? e.width : known.get(e.id).width;
    out.push(item);
  });
  defaults.forEach(d=>{
    if (seen.has(d.id)) return;
    const item = {id:d.id, visible:true};
    if (withWidth) item.width = d.width;
    out.push(item);
  });
  return out;
}
function getSyntheseLayout() {
  const saved = (state.settings && state.settings.syntheseLayout) || {};
  return {
    kpis: normalizeLayoutList(saved.kpis, SYNTHESE_KPIS, false),
    blocks: normalizeLayoutList(saved.blocks, SYNTHESE_BLOCKS, true),
  };
}
function setSyntheseLayout(layout) {
  if (!state.settings) state.settings = {};
  state.settings.syntheseLayout = layout;
  renderAll(); // ré-applique la disposition, rafraîchit le panneau et sauvegarde
}

// ── Application sur la page (appelée au début de renderSynthese) ──
// appendChild déplace les éléments existants : les graphiques sont de toute façon recréés juste après.
function applySyntheseLayout() {
  const {kpis, blocks} = getSyntheseLayout();
  const grid = document.getElementById('kpiGrid');
  if (grid) {
    kpis.forEach(k=>{
      const el = grid.querySelector(`[data-kpi="${k.id}"]`);
      if (!el) return;
      el.style.display = k.visible ? '' : 'none';
      grid.appendChild(el);
    });
    grid.style.display = kpis.some(k=>k.visible) ? '' : 'none';
  }
  const wrap = document.getElementById('syntheseBlocks');
  if (wrap) {
    blocks.forEach(b=>{
      const el = wrap.querySelector(`[data-block="${b.id}"]`);
      if (!el) return;
      el.style.display = b.visible ? '' : 'none';
      el.classList.toggle('span-full', b.width==='full');
      wrap.appendChild(el);
    });
  }
}

// ── Panneau d'administration (Paramètres) ──
function renderSyntheseAdmin() {
  const kEl = document.getElementById('syntheseAdminKpis');
  const bEl = document.getElementById('syntheseAdminBlocks');
  if (!kEl || !bEl) return;
  const {kpis, blocks} = getSyntheseLayout();
  const labels = Object.fromEntries([...SYNTHESE_KPIS, ...SYNTHESE_BLOCKS].map(d=>[d.id, d.label]));
  // Les ids viennent des listes constantes ci-dessus (jamais de la saisie) : sûrs dans un onclick.
  const row = (list, item, i, n) => `
    <div class="layout-row${item.visible?'':' is-hidden'}">
      <label class="layout-row-label">
        <input type="checkbox" style="width:auto" ${item.visible?'checked':''} onchange="toggleSyntheseItem('${list}','${item.id}',this.checked)">
        <span>${esc(labels[item.id])}</span>
      </label>
      ${list==='blocks' ? `<div class="layout-width" role="group" aria-label="Largeur">
        <button class="${item.width==='half'?'active':''}" onclick="setSyntheseWidth('${item.id}','half')" title="Demi-largeur : deux blocs côte à côte">½</button>
        <button class="${item.width==='full'?'active':''}" onclick="setSyntheseWidth('${item.id}','full')" title="Pleine largeur">Pleine</button>
      </div>` : ''}
      <button class="icon-btn" onclick="moveSyntheseItem('${list}','${item.id}',-1)" title="Monter" ${i===0?'disabled':''}>↑</button>
      <button class="icon-btn" onclick="moveSyntheseItem('${list}','${item.id}',1)" title="Descendre" ${i===n-1?'disabled':''}>↓</button>
    </div>`;
  kEl.innerHTML = kpis.map((k,i)=>row('kpis', k, i, kpis.length)).join('');
  bEl.innerHTML = blocks.map((b,i)=>row('blocks', b, i, blocks.length)).join('');
}
function moveSyntheseItem(list, id, dir) {
  const layout = getSyntheseLayout();
  const arr = layout[list];
  if (!arr) return;
  const i = arr.findIndex(x=>x.id===id), j = i+dir;
  if (i<0 || j<0 || j>=arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  setSyntheseLayout(layout);
}
function toggleSyntheseItem(list, id, visible) {
  const layout = getSyntheseLayout();
  const item = (layout[list]||[]).find(x=>x.id===id);
  if (!item) return;
  item.visible = !!visible;
  setSyntheseLayout(layout);
}
function setSyntheseWidth(id, width) {
  const layout = getSyntheseLayout();
  const item = layout.blocks.find(x=>x.id===id);
  if (!item || (width!=='full' && width!=='half')) return;
  item.width = width;
  setSyntheseLayout(layout);
}
function resetSyntheseLayout() {
  if (!state.settings) state.settings = {};
  delete state.settings.syntheseLayout;
  renderAll();
  notify('Disposition par défaut rétablie');
}
// Bouton « Personnaliser » de la Synthèse : ouvre Paramètres sur ce panneau.
function openSyntheseAdmin() {
  showSection('parametres', document.querySelector('.nav-item[data-section="parametres"]'));
  const card = document.getElementById('syntheseAdminCard');
  if (card) card.scrollIntoView({behavior:'smooth', block:'start'});
}
