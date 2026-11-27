// ═══════════════════════════════════════
//  DISPOSITION DE LA PAGE SYNTHÈSE — réglée directement sur la page
//
//  « ✎ Modifier la page » passe en mode édition :
//    - glisser-déposer pour réordonner (indicateurs entre eux, blocs entre eux) ;
//      souris : toute la carte ; tactile : la poignée ⠿ (le reste de la carte garde le défilement) ;
//    - coin ↘ d'un bloc : largeur (grille de 12 colonnes, de 3 à 12) et hauteur ; double-clic = taille par défaut ;
//    - ✕ : retire l'élément (rien n'est supprimé, il reste dans « ＋ Ajouter »).
//  « ＋ Ajouter » (en haut à droite, toujours visible) réaffiche un élément retiré, à la fin.
//
//  Stocké dans state.settings.syntheseLayout = {kpis:[{id,visible}], blocks:[{id,visible,span,h}]}
//  (synchronisé avec le cloud). Toujours relu via normalize…() : id inconnu ignoré, élément ajouté
//  dans une version future placé à la fin, ancien format {width:'half'|'full'} converti.
// ═══════════════════════════════════════
const SYNTHESE_KPIS = [
  {id:'net',     label:'Patrimoine net'},
  {id:'var12',   label:'Variation 12 mois'},
  {id:'epargne', label:'Capacité d\'épargne'},
  {id:'liquid',  label:'Liquidités disponibles'},
  {id:'dette',   label:'Dettes restantes'},
];
const SYNTHESE_BLOCKS = [
  {id:'evolution',  label:'Évolution du patrimoine', span:12},
  {id:'depenses',   label:'Où va mon argent ?',      span:6},
  {id:'allocation', label:'Où est mon argent ?',     span:6},
  {id:'flux',       label:'Flux du mois',            span:12},
  {id:'physiques',  label:'Biens physiques',         span:6},
  {id:'points',     label:'Points à surveiller',     span:6},
];
const LAYOUT_SPAN_MIN = 3, LAYOUT_COLS = 12;
const LAYOUT_H_MIN = 120, LAYOUT_H_MAX = 1400;
const layoutLabel = id => ([...SYNTHESE_KPIS, ...SYNTHESE_BLOCKS].find(d=>d.id===id) || {}).label || id;

// ── Lecture / écriture ──
function normalizeLayoutList(saved, defaults, isBlocks) {
  const known = new Map(defaults.map(d=>[d.id, d]));
  const out = [], seen = new Set();
  const make = (e, d) => {
    const item = {id:d.id, visible: e ? e.visible!==false : true};
    if (isBlocks) {
      let span = e && Number.isInteger(e.span) ? e.span
        : e && e.width==='full' ? 12 : e && e.width==='half' ? 6 : d.span; // ancien format
      item.span = Math.min(LAYOUT_COLS, Math.max(LAYOUT_SPAN_MIN, span));
      const h = e && Number.isFinite(e.h) ? Math.round(e.h) : null;
      item.h = h===null ? null : Math.min(LAYOUT_H_MAX, Math.max(LAYOUT_H_MIN, h));
    }
    return item;
  };
  (Array.isArray(saved) ? saved : []).forEach(e=>{
    if (!e || typeof e!=='object' || !known.has(e.id) || seen.has(e.id)) return;
    seen.add(e.id); out.push(make(e, known.get(e.id)));
  });
  defaults.forEach(d=>{ if (!seen.has(d.id)) out.push(make(null, d)); });
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
  renderAll(); // ré-applique la disposition, recrée les graphiques à la bonne taille et sauvegarde
}

// ── Application sur la page (appelée au début de renderSynthese) ──
let syntheseEditing = false;
let layoutDrag = null; // glisser ou redimensionnement en cours : on ne réordonne pas le DOM pendant ce temps

function applySyntheseLayout() {
  ensureLayoutControls();
  if (layoutDrag) return;
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
      applyBlockSize(el, b.span, b.h);
      wrap.appendChild(el);
    });
  }
  const empty = document.getElementById('syntheseBlocksEmpty');
  if (empty) empty.style.display = blocks.some(b=>b.visible) ? 'none' : 'block';
  renderSyntheseAddMenu();
}
function applyBlockSize(el, span, h) {
  el.style.gridColumn = `span ${span}`;
  el.classList.toggle('has-h', !!h);
  if (h) el.style.setProperty('--block-h', h+'px'); else el.style.removeProperty('--block-h');
}

// Poignée, bouton ✕ et coin de redimensionnement : ajoutés une fois à chaque carte (affichés en mode édition).
function ensureLayoutControls() {
  document.querySelectorAll('#kpiGrid > [data-kpi], #syntheseBlocks > [data-block]').forEach(el=>{
    if (el.querySelector(':scope > .layout-handle')) return;
    const isBlock = !!el.dataset.block;
    const id = isBlock ? el.dataset.block : el.dataset.kpi;
    const handle = document.createElement('div');
    handle.className = 'layout-handle'; handle.title = 'Glisser pour déplacer'; handle.textContent = '⠿';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'layout-remove'; remove.title = 'Retirer de la page'; remove.textContent = '✕';
    remove.addEventListener('click', e=>{ e.stopPropagation(); removeSyntheseItem(isBlock ? 'blocks' : 'kpis', id); });
    el.append(handle, remove);
    el.addEventListener('pointerdown', e=>startLayoutDrag(e, el));
    if (isBlock) {
      const rz = document.createElement('div');
      rz.className = 'layout-resize'; rz.title = 'Redimensionner (double-clic : taille par défaut)';
      const badge = document.createElement('div'); badge.className = 'layout-size-badge';
      rz.addEventListener('pointerdown', e=>startLayoutResize(e, el));
      rz.addEventListener('dblclick', e=>{ e.stopPropagation(); resetBlockSize(id); });
      el.append(rz, badge);
    }
  });
}

// ── Mode édition ──
function toggleSyntheseEdit(force) {
  syntheseEditing = typeof force==='boolean' ? force : !syntheseEditing;
  const sec = document.getElementById('synthese');
  if (sec) sec.classList.toggle('synthese-editing', syntheseEditing);
  const btn = document.getElementById('syntheseEditBtn');
  if (btn) {
    btn.textContent = syntheseEditing ? '✓ Terminé' : '✎ Modifier la page';
    btn.classList.toggle('btn-gold', syntheseEditing);
  }
}

// ── Retirer / ajouter ──
function removeSyntheseItem(list, id) {
  const layout = getSyntheseLayout();
  const item = layout[list].find(x=>x.id===id);
  if (!item) return;
  item.visible = false;
  setSyntheseLayout(layout);
  notify(`« ${layoutLabel(id)} » retiré — réaffichez-le avec « ＋ Ajouter »`);
}
function addSyntheseItem(list, id) {
  const layout = getSyntheseLayout();
  const arr = layout[list];
  const i = arr.findIndex(x=>x.id===id);
  if (i<0) return;
  const [item] = arr.splice(i, 1);
  item.visible = true;
  arr.push(item); // ajouté à la fin, à déplacer ensuite si besoin
  closeSyntheseAddMenu();
  setSyntheseLayout(layout);
  const el = document.querySelector(list==='kpis' ? `#kpiGrid > [data-kpi="${id}"]` : `#syntheseBlocks > [data-block="${id}"]`);
  if (el) {
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.remove('layout-flash'); void el.offsetWidth; el.classList.add('layout-flash');
  }
}
function resetSyntheseLayout() {
  closeSyntheseAddMenu();
  if (!confirm('Revenir à la disposition par défaut de la Synthèse ?')) return;
  if (!state.settings) state.settings = {};
  delete state.settings.syntheseLayout;
  renderAll();
  notify('Disposition par défaut rétablie');
}

// ── Menu « ＋ Ajouter » ──
function renderSyntheseAddMenu() {
  const list = document.getElementById('syntheseAddMenuList');
  if (!list) return;
  const {kpis, blocks} = getSyntheseLayout();
  // Les ids viennent des listes constantes ci-dessus (jamais de la saisie) : sûrs dans un onclick.
  const group = (title, listName, items) => items.length
    ? `<div class="layout-menu-title">${title}</div>` + items.map(x=>
        `<button type="button" onclick="addSyntheseItem('${listName}','${x.id}')">＋ ${esc(layoutLabel(x.id))}</button>`).join('')
    : '';
  const hiddenK = kpis.filter(k=>!k.visible), hiddenB = blocks.filter(b=>!b.visible);
  list.innerHTML = (hiddenK.length || hiddenB.length
      ? group('Indicateurs', 'kpis', hiddenK) + group('Blocs', 'blocks', hiddenB)
      : '<div class="layout-menu-empty">Tout est déjà affiché. Retirez un élément avec ✕ en mode « Modifier la page ».</div>')
    + '<div class="layout-menu-sep"></div><button type="button" onclick="resetSyntheseLayout()">↺ Disposition par défaut</button>';
}
function toggleSyntheseAddMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('syntheseAddMenu');
  if (!m) return;
  renderSyntheseAddMenu();
  m.classList.toggle('open');
}
function closeSyntheseAddMenu() {
  const m = document.getElementById('syntheseAddMenu');
  if (m) m.classList.remove('open');
}
document.addEventListener('click', e=>{ if (!e.target.closest('#syntheseAddMenu')) closeSyntheseAddMenu(); });
document.addEventListener('keydown', e=>{
  if (e.key!=='Escape') return;
  closeSyntheseAddMenu();
  if (syntheseEditing && !layoutDrag) toggleSyntheseEdit(false);
});

// ── Glisser-déposer (Pointer Events : souris, tactile et stylet) ──
const LAYOUT_INTERACTIVE = 'button,input,select,textarea,a,label,.month-tab,.layout-resize';
function startLayoutDrag(e, el) {
  if (!syntheseEditing || layoutDrag || e.button!==0) return;
  const onHandle = !!e.target.closest('.layout-handle');
  if (!onHandle && (e.pointerType!=='mouse' || e.target.closest(LAYOUT_INTERACTIVE))) return;
  e.preventDefault();
  const isBlock = !!el.dataset.block;
  layoutDrag = {
    mode:'move', el, isBlock, container: el.parentElement,
    selector: isBlock ? '[data-block]' : '[data-kpi]',
    startX:e.clientX, startY:e.clientY, x:e.clientX, y:e.clientY, started:false, lastMove:0, ghost:null, raf:0,
  };
  window.addEventListener('pointermove', onLayoutPointerMove);
  window.addEventListener('pointerup', endLayoutPointer);
  window.addEventListener('pointercancel', endLayoutPointer);
}
function onLayoutPointerMove(e) {
  const d = layoutDrag;
  if (!d) return;
  d.x = e.clientX; d.y = e.clientY;
  if (d.mode==='resize') return updateLayoutResize();
  if (!d.started) {
    if (Math.hypot(d.x-d.startX, d.y-d.startY) < 6) return;
    d.started = true;
    d.el.classList.add('layout-dragging');
    document.body.classList.add('layout-drag-active');
    d.ghost = document.createElement('div');
    d.ghost.className = 'layout-ghost';
    d.ghost.textContent = '⠿ ' + layoutLabel(d.isBlock ? d.el.dataset.block : d.el.dataset.kpi);
    document.body.appendChild(d.ghost);
    d.raf = requestAnimationFrame(layoutAutoScroll);
  }
  d.ghost.style.left = d.x+'px'; d.ghost.style.top = d.y+'px';
  layoutReorderAt(d.x, d.y);
}
// Insère l'élément déplacé avant / après la carte survolée (même conteneur uniquement).
function layoutReorderAt(x, y, force) {
  const d = layoutDrag;
  const now = performance.now();
  if (!force && now - d.lastMove < 90) return; // évite l'oscillation pendant que la grille se réorganise
  const hit = document.elementFromPoint(x, y)?.closest(d.selector);
  const cw = d.container.getBoundingClientRect().width;
  if (hit && hit!==d.el && hit.parentElement===d.container) {
    const r = hit.getBoundingClientRect();
    const pleineLargeur = r.width > cw*0.75;
    const before = pleineLargeur ? y < r.top + r.height/2 : x < r.left + r.width/2;
    const ref = before ? hit : hit.nextSibling;
    if (ref!==d.el && ref!==d.el.nextSibling) { d.container.insertBefore(d.el, ref); d.lastMove = now; }
    return;
  }
  // Sous la dernière carte visible : on place à la fin.
  const visibles = [...d.container.querySelectorAll(':scope > '+d.selector)].filter(c=>c.style.display!=='none');
  const last = visibles[visibles.length-1];
  const cr = d.container.getBoundingClientRect();
  if (last && last!==d.el && x>=cr.left && x<=cr.right && y > last.getBoundingClientRect().bottom && y < cr.bottom + 80) {
    d.container.appendChild(d.el); d.lastMove = now;
  }
}
// Défilement automatique près des bords de la fenêtre pendant le glisser.
function layoutAutoScroll() {
  const d = layoutDrag;
  if (!d || !d.started) return;
  const zone = 70, h = window.innerHeight;
  const v = d.y < zone ? -Math.ceil((zone-d.y)/4) : d.y > h-zone ? Math.ceil((d.y-(h-zone))/4) : 0;
  if (v) { window.scrollBy(0, v); layoutReorderAt(d.x, d.y); }
  d.raf = requestAnimationFrame(layoutAutoScroll);
}

// ── Redimensionnement (coin ↘) : largeur aimantée sur la grille de 12 colonnes, hauteur par pas de 10 px ──
function startLayoutResize(e, el) {
  if (!syntheseEditing || layoutDrag || e.button!==0) return;
  e.preventDefault(); e.stopPropagation();
  const container = el.parentElement;
  const cs = getComputedStyle(container);
  const gap = parseFloat(cs.columnGap) || 16;
  const cw = container.getBoundingClientRect().width;
  const item = getSyntheseLayout().blocks.find(b=>b.id===el.dataset.block);
  layoutDrag = {mode:'resize', el, gap, colW:(cw - gap*(LAYOUT_COLS-1))/LAYOUT_COLS,
    rect: el.getBoundingClientRect(), span:item.span, h:item.h, span0:item.span, h0:item.h,
    startX:e.clientX, startY:e.clientY, x:e.clientX, y:e.clientY, moved:false};
  document.body.classList.add('layout-resize-active');
  window.addEventListener('pointermove', onLayoutPointerMove);
  window.addEventListener('pointerup', endLayoutPointer);
  window.addEventListener('pointercancel', endLayoutPointer);
}
function updateLayoutResize() {
  const d = layoutDrag;
  // Un simple clic (ou le double-clic de réinitialisation) ne doit pas figer une taille.
  if (!d.moved && Math.hypot(d.x-d.startX, d.y-d.startY) < 4) return;
  d.moved = true;
  d.el.classList.add('is-resizing');
  const w = d.x - d.rect.left;
  d.span = Math.min(LAYOUT_COLS, Math.max(LAYOUT_SPAN_MIN, Math.round((w + d.gap)/(d.colW + d.gap))));
  const top = d.el.getBoundingClientRect().top; // la carte peut changer de ligne en s'élargissant
  d.h = Math.min(LAYOUT_H_MAX, Math.max(LAYOUT_H_MIN, Math.round((d.y - top)/10)*10));
  applyBlockSize(d.el, d.span, d.h);
  const badge = d.el.querySelector('.layout-size-badge');
  if (badge) badge.textContent = `${d.span}/12 · ${d.h} px`;
}
function resetBlockSize(id) {
  const layout = getSyntheseLayout();
  const item = layout.blocks.find(b=>b.id===id), def = SYNTHESE_BLOCKS.find(b=>b.id===id);
  if (!item || !def) return;
  item.span = def.span; item.h = null;
  setSyntheseLayout(layout);
}

// ── Fin du geste : on lit l'ordre / la taille dans le DOM et on enregistre ──
function endLayoutPointer() {
  const d = layoutDrag;
  window.removeEventListener('pointermove', onLayoutPointerMove);
  window.removeEventListener('pointerup', endLayoutPointer);
  window.removeEventListener('pointercancel', endLayoutPointer);
  if (!d) return;
  layoutDrag = null;
  document.body.classList.remove('layout-drag-active', 'layout-resize-active');
  if (d.mode==='resize') {
    d.el.classList.remove('is-resizing');
    if (!d.moved) return;
    const layout = getSyntheseLayout();
    const item = layout.blocks.find(b=>b.id===d.el.dataset.block);
    if (item) { item.span = d.span; item.h = d.h; setSyntheseLayout(layout); }
    return;
  }
  if (!d.started) return; // simple clic
  layoutDrag = d; layoutReorderAt(d.x, d.y, true); layoutDrag = null; // position finale, même relâchée très vite
  cancelAnimationFrame(d.raf);
  if (d.ghost) d.ghost.remove();
  d.el.classList.remove('layout-dragging');
  // Un clic est émis juste après le relâchement : on l'absorbe pour ne pas déclencher un bouton de la carte.
  // Retiré peu après : en tactile, aucun clic ne suit, et le garde ne doit pas avaler le clic suivant.
  const guard = ev=>{ ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener('click', guard, true);
  setTimeout(()=>window.removeEventListener('click', guard, true), 60);
  const layout = getSyntheseLayout();
  const listName = d.isBlock ? 'blocks' : 'kpis';
  const attr = d.isBlock ? 'block' : 'kpi';
  const order = [...d.container.querySelectorAll(':scope > '+d.selector)].map(c=>c.dataset[attr]);
  layout[listName].sort((a,b)=>order.indexOf(a.id) - order.indexOf(b.id));
  setSyntheseLayout(layout);
}
