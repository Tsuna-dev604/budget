// ═══════════════════════════════════════
//  Journal des dépenses/revenus : catégories, CRUD, rendu du tableau, sélection
// ═══════════════════════════════════════
function updateCategChips() {
  const type = document.getElementById('bType').value;
  const list = type==='depense' ? CATEG_DEPENSE : CATEG_REVENU;
  const chips = document.getElementById('categChips');
  const cur = document.getElementById('bCateg').value;
  chips.innerHTML = list.map(c=>`<span class="categ-chip${c===cur?' sel':''}" onclick="selectChip(this,'${c}')">${c}</span>`).join('');
}
function selectChip(el, val) {
  document.querySelectorAll('.categ-chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('bCateg').value = val;
}

// ═══════════════════════════════════════
//  BUDGET — CRUD
// ═══════════════════════════════════════
let editBudgetId = null;

function openAddBudget() {
  editBudgetId = null;
  document.getElementById('budgetModalTitle').textContent = 'Nouvelle Opération';
  ['bLabel','bCateg','bMontant'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('bDate').value = today();
  document.getElementById('bType').value = 'depense';
  updateCategChips();
  populateCompteSelects();
  document.getElementById('bCompte').value = '';
  openModal('modalBudget');
}

function saveBudget() {
  const label    = document.getElementById('bLabel').value.trim();
  const categ    = document.getElementById('bCateg').value.trim();
  const montant  = parseFloat(document.getElementById('bMontant').value);
  const type     = document.getElementById('bType').value;
  const date     = document.getElementById('bDate').value;
  const compteId = document.getElementById('bCompte').value||null;
  if (!label||!montant||montant<=0){notify('Champs invalides',true);return;}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)){notify('Date invalide',true);return;}
  const modif = !!editBudgetId;
  if (modif) {
    const b = state.budget.find(x=>x.id===editBudgetId);
    if (b) Object.assign(b,{label,categ,montant,type,date,compteId});
    editBudgetId = null;
  } else {
    state.budget.push({id:uid(),label,categ,montant,type,date,compteId});
  }
  closeModal('modalBudget');
  ['bLabel','bCateg','bMontant'].forEach(id=>document.getElementById(id).value='');
  notify(modif?'Opération modifiée':'Opération enregistrée');
  renderAll();
}
function editBudget(id) {
  const b = state.budget.find(x=>x.id===id);
  if (!b) return;
  if (b.type==='virement') { notify('Ce virement d\'épargne se modifie depuis Liquidités › Épargne automatique', true); return; }
  editBudgetId = id;
  document.getElementById('budgetModalTitle').textContent = 'Modifier l\'opération';
  document.getElementById('bType').value = b.type;
  document.getElementById('bCateg').value   = b.categ||'';
  updateCategChips(); // après bCateg : la catégorie actuelle apparaît sélectionnée
  populateCompteSelects();
  document.getElementById('bLabel').value   = b.label;
  document.getElementById('bMontant').value = b.montant;
  document.getElementById('bDate').value    = b.date;
  document.getElementById('bCompte').value  = b.compteId||'';
  openModal('modalBudget');
}
function deleteBudget(id) {
  if (!confirm('Supprimer cette opération ?')) return;
  const cible = state.budget.find(b=>b.id===id);
  if (cible && cible._versementActif) retirerVirementDuLivret(cible); // défait aussi l'effet sur le livret
  state.budget = state.budget.filter(b=>b.id!==id);
  checkedDepenseIds.delete(id);
  renderAll();
}

// ═══════════════════════════════════════
//  BUDGET — RENDER
// ═══════════════════════════════════════
function getYears() {
  const y = [...new Set(state.budget.map(b=>b.date.slice(0,4)))].sort((a,b)=>b-a);
  return y.length ? y : [String(currentYear())];
}
function buildYearSelect() {
  const sel = document.getElementById('filterBudgetYear');
  const years = getYears();
  const cur = sel.value || String(currentYear());
  sel.innerHTML = years.map(y=>`<option value="${y}" ${y===cur?'selected':''}>${y}</option>`).join('');
}
function buildMonthTabs() {
  const year = document.getElementById('filterBudgetYear').value || String(currentYear());
  const months = [...new Set(state.budget.filter(b=>b.date.startsWith(year)).map(b=>b.date.slice(5,7)))].sort();
  const container = document.getElementById('monthTabs');
  const MOIS = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const tabs = [{v:'all',l:'Tous'},...months.map(m=>({v:m,l:MOIS[parseInt(m)]}))];
  container.innerHTML = tabs.map(t=>`<div class="month-tab ${currentBudgetMonth===t.v?'active':''}" onclick="selectMonth('${t.v}',this)">${t.l}</div>`).join('');
}
function selectMonth(m, el) {
  currentBudgetMonth = m;
  document.querySelectorAll('.month-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderBudgetTable();
}
// Filtre « compte » de la liste des opérations : tous / comptes du budget / un compte / sans compte.
function buildCompteFilter() {
  const sel = document.getElementById('filterBudgetCompte');
  if (!sel) return 'all';
  const cur = sel.value || 'all';
  sel.innerHTML = '<option value="all">Tous les comptes</option><option value="budget">Comptes du budget</option>'
    + state.comptes.map(c=>`<option value="${esc(c.id)}">${esc(c.label)}${c.horsBudget?' (hors budget)':''}</option>`).join('')
    + '<option value="none">Sans compte</option>';
  sel.value = [...sel.options].some(o=>o.value===cur) ? cur : 'all';
  return sel.value;
}
// Filtre « catégorie » : la valeur est « type|catégorie » (« Autre » dépense ≠ « Autre » revenu).
// Les options sont construites à partir des opérations déjà filtrées (année, mois, compte, type),
// avec leur nombre ; la catégorie choisie reste proposée (0) même si le mois affiché n'en contient pas.
const CATEG_FILTER_GROUPS = [
  {type:'depense', label:'Dépenses', ordre:CATEG_DEPENSE},
  {type:'revenu', label:'Revenus', ordre:CATEG_REVENU},
  {type:'virement', label:'Virements d\'épargne', ordre:[]},
];
const categOf = b => b.categ || 'Autre';
function buildCategFilter(items, typeFiltre) {
  const sel = document.getElementById('filterBudgetCateg');
  if (!sel) return null;
  let cur = sel.value || 'all';
  if (cur!=='all' && typeFiltre!=='all' && !cur.startsWith(typeFiltre+'|')) cur = 'all'; // type incompatible
  const counts = {};
  items.forEach(b=>{ const k = b.type+'|'+categOf(b); counts[k] = (counts[k]||0)+1; });
  if (cur!=='all' && !counts[cur]) counts[cur] = 0;
  const groups = CATEG_FILTER_GROUPS.filter(g=>typeFiltre==='all' || g.type===typeFiltre).map(g=>{
    const rang = c => { const i = g.ordre.indexOf(c); return i<0 ? g.ordre.length : i; };
    const cats = Object.keys(counts).filter(k=>k.startsWith(g.type+'|')).map(k=>k.slice(g.type.length+1))
      .sort((a,b)=>rang(a)-rang(b) || a.localeCompare(b,'fr'));
    return cats.length ? `<optgroup label="${esc(g.label)}">${cats.map(c=>{
      const v = g.type+'|'+c;
      return `<option value="${esc(v)}">${esc(c)} (${counts[v]})</option>`;
    }).join('')}</optgroup>` : '';
  }).join('');
  sel.innerHTML = '<option value="all">Toutes catégories</option>' + groups;
  sel.value = [...sel.options].some(o=>o.value===cur) ? cur : 'all';
  sel.classList.toggle('filter-active', sel.value!=='all');
  if (sel.value==='all') return null;
  const i = sel.value.indexOf('|');
  return {type:sel.value.slice(0,i), categ:sel.value.slice(i+1)};
}
// Clic sur le badge d'une catégorie dans la liste : filtre dessus (re-clic : retire le filtre).
function setBudgetCategFilter(type, categ) {
  const sel = document.getElementById('filterBudgetCateg');
  if (!sel) return;
  const v = type+'|'+categ;
  const opt = [...sel.options].find(o=>o.value===v);
  sel.value = (sel.value===v || !opt) ? 'all' : v;
  renderBudgetTable();
}
function resetBudgetCategFilter() {
  const sel = document.getElementById('filterBudgetCateg');
  if (sel) sel.value = 'all';
  renderBudgetTable();
}
function renderBudgetTable() {
  buildYearSelect();
  buildMonthTabs();
  const year  = document.getElementById('filterBudgetYear').value || String(currentYear());
  const type  = document.getElementById('filterBudgetType').value;
  const month = currentBudgetMonth;
  const MOIS  = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const compteFiltre = buildCompteFilter();
  let items = state.budget.filter(b=>b.date.startsWith(year));
  if (month!=='all') items = items.filter(b=>b.date.slice(5,7)===month);
  if (type!=='all') items = items.filter(b=>b.type===type);
  if (compteFiltre==='budget') items = items.filter(b=>compteDansBudget(b.compteId));
  else if (compteFiltre==='none') items = items.filter(b=>!b.compteId);
  else if (compteFiltre!=='all') items = items.filter(b=>b.compteId===compteFiltre);
  const categFiltre = buildCategFilter(items, type);
  if (categFiltre) items = items.filter(b=>b.type===categFiltre.type && categOf(b)===categFiltre.categ);
  // Un compte (ou « sans compte ») choisi explicitement est totalisé tel quel, même hors budget.
  const filtreExplicite = compteFiltre!=='all' && compteFiltre!=='budget';

  // Un virement d'épargne n'est ni un revenu ni une dépense : il est exclu du solde net et du taux d'épargne.
  // Les opérations des comptes « hors budget » restent listées (grisées) mais ne sont pas totalisées.
  let rev=0, dep=0, vir=0;
  items.filter(b=>filtreExplicite || compteDansBudget(b.compteId)).forEach(b=>{if(b.type==='revenu')rev+=b.montant;else if(b.type==='virement')vir+=b.montant;else dep+=b.montant;});
  document.getElementById('bRevenu').textContent = fmt(rev);
  document.getElementById('bDepense').textContent = fmt(dep);
  const solde = rev-dep;
  const s = document.getElementById('bSolde');
  s.textContent = fmt(solde);
  s.className = 'card-value '+(solde>=0?'green':'red');
  const tauxEl = document.getElementById('bTauxEpargne');
  if (tauxEl) {
    // Taux d'épargne sur une seule catégorie : sans signification, on ne l'affiche pas.
    if (rev>0 && !categFiltre) { tauxEl.textContent = fmtPct(solde/rev*100,1); tauxEl.className = 'card-value '+(solde>=0?'green':'red'); }
    else { tauxEl.textContent = '—'; tauxEl.className = 'card-value'; }
  }
  const virEl = document.getElementById('bVirements');
  if (virEl) virEl.textContent = vir>0 ? `dont ${fmt(vir)} virés vers l'épargne` : '';

  const lbl = month==='all'?`Année ${year}`:`${MOIS[parseInt(month)]} ${year}`;
  document.getElementById('budgetMonthLabel').textContent = lbl + (categFiltre ? ` · ${categFiltre.categ}` : '');
  const categInfo = document.getElementById('budgetCategFilterInfo');
  if (categInfo) {
    categInfo.style.display = categFiltre ? 'flex' : 'none';
    if (categFiltre) {
      const total = items.filter(b=>filtreExplicite || compteDansBudget(b.compteId)).reduce((s,b)=>s+b.montant,0);
      document.getElementById('budgetCategFilterText').textContent =
        `${categFiltre.categ} : ${items.length} opération${items.length>1?'s':''} · ${fmt(total)}`;
    }
  }

  const tbody = document.getElementById('budgetTbody');
  tbody.innerHTML = items.sort((a,b)=>b.date.localeCompare(a.date)).map(b=>`
    <tr${compteDansBudget(b.compteId)?'':' style="opacity:.55" title="Compte hors budget : non compté dans les totaux"'}>
      <td>${b.type==='depense'?`<input type="checkbox" class="budget-check" data-id="${b.id}" ${checkedDepenseIds.has(b.id)?'checked':''} onchange="toggleDepenseCheck('${b.id}', this.checked)">`:''}</td>
      <td class="highlight">${esc(b.date)}</td>
      <td class="highlight">${(b._recId||b._versementActif)?'🔁 ':''}${esc(b.label)}</td>
      <td><span class="badge categ-filter-badge" data-type="${esc(b.type)}" data-categ="${esc(categOf(b))}" onclick="setBudgetCategFilter(this.dataset.type, this.dataset.categ)" title="Filtrer sur cette catégorie" style="background:${categColor(b.categ)||'rgba(255,255,255,0.07)'}22;color:${categColor(b.categ)||'var(--text3)'}">${esc(b.categ||'—')}</span></td>
      <td>${b.compteId?`<span class="badge badge-blue">${esc(compteLabel(b.compteId))}</span>${compteDansBudget(b.compteId)?'':' <span class="badge">hors budget</span>'}`:'<span style="color:var(--text3)">—</span>'}</td>
      <td>${b.type==='revenu'?'<span class="badge badge-green">Revenu</span>':b.type==='virement'?'<span class="badge badge-blue">Épargne</span>':'<span class="badge badge-red">Dépense</span>'}</td>
      <td class="${b.type==='revenu'?'green':b.type==='virement'?'blue':'red'}">${b.type==='revenu'?'+':'−'}${fmt(b.montant)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="editBudget('${b.id}')">✎</button>
        <button class="icon-btn del" onclick="deleteBudget('${b.id}')">✕</button>
      </div></td>
    </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">Aucune opération</td></tr>';

  renderCategRecap(year);
  renderPrevisionWidget();
  renderAnomaliesWidget();
  renderEvolutionCategories();
  updateDepenseSelectionBar();
  syncCheckAllDepensesState();
}

// ═══════════════════════════════════════
//  SÉLECTION DE DÉPENSES — total à la carte
// ═══════════════════════════════════════
let checkedDepenseIds = new Set();

function toggleDepenseCheck(id, checked) {
  if (checked) checkedDepenseIds.add(id); else checkedDepenseIds.delete(id);
  updateDepenseSelectionBar();
  syncCheckAllDepensesState();
}

function toggleAllVisibleDepenses(checked) {
  document.querySelectorAll('.budget-check').forEach(cb => {
    cb.checked = checked;
    const id = cb.dataset.id;
    if (checked) checkedDepenseIds.add(id); else checkedDepenseIds.delete(id);
  });
  updateDepenseSelectionBar();
}

function clearDepenseSelection() {
  checkedDepenseIds.clear();
  document.querySelectorAll('.budget-check').forEach(cb => cb.checked = false);
  updateDepenseSelectionBar();
  syncCheckAllDepensesState();
}

function syncCheckAllDepensesState() {
  const all = document.getElementById('checkAllDepenses');
  if (!all) return;
  const boxes = [...document.querySelectorAll('.budget-check')];
  if (!boxes.length) { all.checked = false; all.indeterminate = false; return; }
  const checkedCount = boxes.filter(cb => cb.checked).length;
  all.checked = checkedCount === boxes.length;
  all.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
}

function updateDepenseSelectionBar() {
  const items = state.budget.filter(b => checkedDepenseIds.has(b.id) && b.type==='depense');
  const total = items.reduce((s,b) => s + b.montant, 0);
  const countEl = document.getElementById('depenseSelectionCount');
  const totalEl = document.getElementById('depenseSelectionTotal');
  if (countEl) countEl.textContent = items.length;
  if (totalEl) totalEl.textContent = fmt(total);
}
// Résout le "mois de référence" (AAAA-MM) à partir des filtres actuels de la page Budget :
// le mois sélectionné s'il y en a un, sinon le dernier mois avec données de l'année
// sélectionnée, sinon le mois calendaire en cours. Réutilisé par le récap, le budget
// prévisionnel et la détection d'anomalies — une seule source de vérité (§28/§29).
function getReferenceYearMonth() {
  const year = document.getElementById('filterBudgetYear').value || String(currentYear());
  if (currentBudgetMonth !== 'all') return `${year}-${currentBudgetMonth}`;
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  // Année en cours : le mois calendaire actuel (pas le "dernier mois avec données", qui
  // inclurait les échéances de salaire récurrent auto-générées jusqu'à fin d'année).
  if (year === String(now.getFullYear())) return currentYm;
  // Année différente : dernier mois avec des dépenses réelles enregistrées cette année-là.
  const monthsWithDep = [...new Set(getBudgetOps().filter(b=>b.type==='depense'&&b.date.startsWith(year)).map(b=>b.date.slice(0,7)))].sort();
  return monthsWithDep.length ? monthsWithDep[monthsWithDep.length-1] : currentYm;
}

let recapView = 'mois'; // 'mois' | 'trimestre' | 'annee'
function setRecapView(v) {
  recapView = v;
  ['Mois','Trimestre','Annee'].forEach(k=>{
    const el = document.getElementById('recapToggle'+k);
    if (el) el.classList.toggle('active', k.toLowerCase()===v);
  });
  const year = document.getElementById('filterBudgetYear').value || String(currentYear());
  renderCategRecap(year);
}
function renderCategRecap(year) {
  const MOIS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  let items, periodLabel;
  if (recapView === 'annee') {
    items = getBudgetOps().filter(b=>b.date.startsWith(year));
    periodLabel = year;
  } else if (recapView === 'trimestre') {
    const ref = getReferenceYearMonth();
    const debut = addMonths(ref+'-01', -2).slice(0,7);
    items = getBudgetOps().filter(b=>b.date.slice(0,7)>=debut && b.date.slice(0,7)<=ref);
    periodLabel = formatPeriodeMois(debut, ref);
  } else {
    const ref = getReferenceYearMonth();
    items = getBudgetOps().filter(b=>b.date.startsWith(ref));
    periodLabel = formatPeriodeMois(ref, ref);
  }
  document.getElementById('recapPeriodLabel').textContent = periodLabel;
  document.getElementById('categRecapDep').innerHTML = categBarListHtml(items, 'depense');
  document.getElementById('categRecapRev').innerHTML = categBarListHtml(items, 'revenu');
}

// ═══════════════════════════════════════
//  BUDGET PRÉVISIONNEL VS RÉEL — §9
// ═══════════════════════════════════════
function updatePrevision(categ, value) {
  if (!state.budgetPrevisionnel) state.budgetPrevisionnel = {};
  const v = parseFloat(value)||0;
  if (v>0) state.budgetPrevisionnel[categ] = v; else delete state.budgetPrevisionnel[categ];
  renderPrevisionWidget();
  scheduleCloudSave();
}
function renderPrevisionWidget() {
  const tbody = document.getElementById('previsionTbody');
  if (!tbody) return;
  const ref = getReferenceYearMonth();
  const MOIS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const lblEl = document.getElementById('previsionRefLabel');
  if (lblEl) lblEl.textContent = `${MOIS[parseInt(ref.slice(5,7))]} ${ref.slice(0,4)}`;

  const reelParCateg = Object.create(null);
  getBudgetOps().filter(b=>b.type==='depense'&&b.date.startsWith(ref)).forEach(b=>{
    reelParCateg[b.categ||'Autre'] = (reelParCateg[b.categ||'Autre']||0)+b.montant;
  });
  const prevs = state.budgetPrevisionnel||{};
  // Catégories avec un prévu OU un réel, triées par écart décroissant (les dérapages en premier)
  const categs = [...new Set([...CATEG_DEPENSE, ...Object.keys(reelParCateg)])]
    .filter(c=>prevs[c]>0 || reelParCateg[c]>0);

  const tfoot = document.getElementById('previsionTfoot');
  if (tfoot) tfoot.innerHTML = '';

  if (!categs.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">Aucun budget prévisionnel défini pour l\'instant. Renseignez un montant prévu ci-dessous pour vos catégories habituelles.</td></tr>';
  } else {
    const rows = categs.map(c=>{
      const prevu = prevs[c]||0;
      const reel = reelParCateg[c]||0;
      const ecart = reel - prevu;
      const pct = prevu>0 ? Math.min(150, reel/prevu*100) : null;
      return {c, prevu, reel, ecart, pct};
    }).sort((a,b)=>b.ecart-a.ecart);
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td class="highlight"><span style="color:${categColor(r.c)||'var(--text3)'}">●</span> ${esc(r.c)}</td>
        <td><input type="number" min="0" step="1" value="${r.prevu||''}" placeholder="0" style="width:110px;padding:6px 10px;font-size:12px" data-categ="${esc(r.c)}" onchange="updatePrevision(this.dataset.categ, this.value)"></td>
        <td class="gold">${fmt(r.reel)}</td>
        <td class="${r.ecart>0?'red':'green'}">${r.ecart>0?'+':''}${fmt(r.ecart)}</td>
      </tr>`).join('');

    // Ligne de total (somme des catégories affichées)
    const totPrevu = rows.reduce((s,r)=>s+r.prevu,0);
    const totReel = rows.reduce((s,r)=>s+r.reel,0);
    const totEcart = totReel - totPrevu;
    if (tfoot) tfoot.innerHTML = `
      <tr style="border-top:2px solid var(--border);font-weight:600">
        <td class="highlight">Total</td>
        <td class="gold">${fmt(totPrevu)}</td>
        <td class="gold">${fmt(totReel)}</td>
        <td class="${totEcart>0?'red':'green'}">${totEcart>0?'+':''}${fmt(totEcart)}</td>
      </tr>`;
  }

  // Liste déroulante pour ajouter une catégorie non encore budgétée
  const addSel = document.getElementById('previsionAddCateg');
  if (addSel) {
    const dispo = CATEG_DEPENSE.filter(c=>!(prevs[c]>0));
    addSel.innerHTML = '<option value="">+ Définir un budget pour une catégorie…</option>' + dispo.map(c=>`<option value="${c}">${c}</option>`).join('');
  }
}
function addPrevisionCateg() {
  const sel = document.getElementById('previsionAddCateg');
  const categ = sel.value;
  if (!categ) return;
  const montant = prompt(`Budget mensuel prévu pour "${categ}" (€) :`);
  if (montant===null) return;
  updatePrevision(categ, montant);
  sel.value = '';
}

// ═══════════════════════════════════════
//  ANOMALIES DE DÉPENSES — §10 (règles simples et explicables, pas d'IA)
// ═══════════════════════════════════════
function detectAnomalies() {
  const ref = getReferenceYearMonth();
  const HIST_MOIS = 6;
  const anomalies = [];

  // 1. Catégorie dont la dépense du mois dépasse nettement sa moyenne récente
  const refItems = getBudgetOps().filter(b=>b.type==='depense'&&b.date.startsWith(ref));
  const parCateg = Object.create(null);
  refItems.forEach(b=>{ const c=b.categ||'Autre'; parCateg[c]=(parCateg[c]||0)+b.montant; });

  Object.entries(parCateg).forEach(([categ, montant])=>{
    let total=0, count=0;
    for (let i=1;i<=HIST_MOIS;i++){
      const ym = addMonths(ref+'-01', -i).slice(0,7);
      const m = getBudgetOps().filter(b=>b.type==='depense'&&(b.categ||'Autre')===categ&&b.date.startsWith(ym)).reduce((s,b)=>s+b.montant,0);
      if (m>0){ total+=m; count++; }
    }
    if (count>=2) {
      const moyenne = total/count;
      if (moyenne>0 && montant > moyenne*1.3) {
        const pct = (montant/moyenne-1)*100;
        anomalies.push({sev:pct, icon:'⚠', text:`Dépenses « ${esc(categ)} » supérieures de ${fmtPct(pct,0)} à la moyenne des ${count} derniers mois actifs (moyenne : ${fmt(moyenne)}).`});
      }
    }
  });

  // 2. Transaction isolée nettement supérieure à l'habitude de sa catégorie
  refItems.forEach(b=>{
    const categ = b.categ||'Autre';
    const hist = [];
    for (let i=1;i<=HIST_MOIS;i++){
      const ym = addMonths(ref+'-01', -i).slice(0,7);
      getBudgetOps().filter(x=>x.type==='depense'&&(x.categ||'Autre')===categ&&x.date.startsWith(ym)).forEach(x=>hist.push(x.montant));
    }
    if (hist.length>=3) {
      const moy = hist.reduce((a,v)=>a+v,0)/hist.length;
      if (moy>0 && b.montant > moy*2.5 && b.montant>=100) {
        anomalies.push({sev:(b.montant/moy)*150, icon:'🔴', text:`Dépense inhabituelle détectée : ${fmt(b.montant)} pour « ${esc(b.label)} » (${esc(categ)}, ${esc(b.date)}) — nettement au-dessus de vos dépenses habituelles dans cette catégorie (moyenne : ${fmt(moy)}).`});
      }
    }
  });

  return anomalies.sort((a,b)=>b.sev-a.sev).slice(0,5);
}
function renderAnomaliesWidget() {
  const el = document.getElementById('anomaliesList');
  if (!el) return;
  const anomalies = detectAnomalies();
  el.innerHTML = anomalies.length
    ? anomalies.map(a=>`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><span style="flex-shrink:0">${a.icon}</span><span style="color:var(--text2);font-size:13px;line-height:1.6">${a.text}</span></div>`).join('')
    : '<div style="color:var(--text3);font-size:13px">Aucune anomalie détectée sur le mois de référence, comparé aux 6 derniers mois.</div>';
}

// ═══════════════════════════════════════
//  ÉVOLUTION DES DÉPENSES PAR CATÉGORIE — 12 derniers mois
//  Fenêtre glissante terminée au mois calendaire en cours (indépendante des filtres de la page).
//  Moyenne et tendance se calculent sur les mois COMPLETS uniquement : le mois en cours,
//  inachevé, fausserait les deux.
// ═══════════════════════════════════════
let chartEvolCateg = null;

function getEvolutionDepensesCategories(nbMois=12) {
  const months = [];
  let ym = today().slice(0,7);
  for (let i=0;i<nbMois;i++) { months.unshift(ym); ym = prevYm(ym); }
  const inWindow = new Set(months);
  const data = Object.create(null); // catégorie -> {AAAA-MM: total}
  getBudgetOps().forEach(b=>{
    if (b.type!=='depense') return;
    const m = b.date.slice(0,7);
    if (!inWindow.has(m)) return;
    const c = b.categ||'Autre';
    (data[c] = data[c]||{})[m] = ((data[c]||{})[m]||0) + b.montant;
  });
  const totalParMois = months.map(m=>Object.values(data).reduce((s,byM)=>s+(byM[m]||0),0));
  const complets = months.length-1; // le dernier mois est le mois en cours
  const premierActif = totalParMois.findIndex((v,i)=>i<complets && v>0); // 1er mois complet avec dépenses
  const nbActifs = premierActif<0 ? 0 : complets-premierActif;
  const rows = Object.entries(data).map(([c,byM])=>{
    const vals = months.map(m=>byM[m]||0);
    const total = vals.reduce((a,v)=>a+v,0);
    const moyenne = nbActifs>0 ? vals.slice(premierActif,complets).reduce((a,v)=>a+v,0)/nbActifs : null;
    // 3 derniers mois complets vs les 3 précédents (nécessite 6 mois complets d'historique)
    const dern3 = vals.slice(complets-3,complets).reduce((a,v)=>a+v,0)/3;
    const prec3 = vals.slice(complets-6,complets-3).reduce((a,v)=>a+v,0)/3;
    const tendance = (nbActifs>=6 && prec3>0) ? (dern3/prec3-1)*100 : null;
    return {c, vals, total, moyenne, tendance};
  }).sort((a,b)=>b.total-a.total);
  return {months, rows, totalParMois};
}

function renderEvolutionCategories() {
  const wrap = document.getElementById('evolCategChartWrap');
  const empty = document.getElementById('evolCategEmpty');
  const table = document.getElementById('evolCategTable');
  if (!wrap || !table) return;
  const {months, rows, totalParMois} = getEvolutionDepensesCategories(12);

  const lbl = document.getElementById('evolCategPeriodLabel');
  if (lbl) lbl.textContent = formatPeriodeMois(months[0], months[months.length-1])+' · mois en cours inclus';

  if (!rows.length) {
    wrap.style.display='none'; empty.style.display='block'; table.innerHTML='';
    if (chartEvolCateg) { chartEvolCateg.destroy(); chartEvolCateg=null; }
    return;
  }
  wrap.style.display='block'; empty.style.display='none';

  const labels = months.map(m=>new Date(m+'-01T00:00:00').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}));
  const TOP = 6;
  const top = rows.slice(0,TOP), reste = rows.slice(TOP);
  const datasets = top.map(r=>({label:r.c, data:r.vals, backgroundColor:categColor(r.c)||'#95a5a6', borderWidth:0}));
  if (reste.length) datasets.push({label:'Autres', data:months.map((_,i)=>reste.reduce((s,r)=>s+r.vals[i],0)), backgroundColor:'#6b7280', borderWidth:0});

  if (chartEvolCateg) { chartEvolCateg.destroy(); chartEvolCateg=null; }
  const cText3 = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#8a8680';
  chartEvolCateg = new Chart(document.getElementById('chartEvolCateg').getContext('2d'), {
    type:'bar',
    data:{labels, datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom', labels:{color:cText3, boxWidth:10, font:{family:'DM Mono', size:10}}},
        tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${fmt(ctx.raw,0)}`, footer:items=>'Total : '+fmt(items.reduce((s,i)=>s+i.raw,0),0)}}
      },
      scales:{
        x:{stacked:true, grid:{display:false}, ticks:{color:cText3, font:{family:'DM Mono', size:10}}},
        y:{stacked:true, grid:{color:'rgba(127,127,127,.08)'}, ticks:{color:cText3, font:{family:'DM Mono', size:10}, callback:v=>fmt(v,0)}}
      }
    }
  });

  // Tableau détaillé : toutes les catégories, mois par mois
  const th = s=>`<th style="text-align:right;white-space:nowrap">${s}</th>`;
  const mono = 'font-family:var(--font-mono);text-align:right;white-space:nowrap';
  table.innerHTML = `
    <thead><tr><th>Catégorie</th>${labels.map(th).join('')}${th('Moy./mois')}${th('Tendance')}</tr></thead>
    <tbody>
      ${rows.map(r=>`<tr>
        <td class="highlight" style="white-space:nowrap"><span style="color:${categColor(r.c)||'var(--text3)'}">●</span> ${esc(r.c)}</td>
        ${r.vals.map(v=>`<td style="${mono}">${v>0?fmt(v,0):'<span style="color:var(--text3)">—</span>'}</td>`).join('')}
        <td style="${mono};color:var(--gold)">${r.moyenne!==null?fmt(r.moyenne,0):'—'}</td>
        <td style="${mono};color:${r.tendance===null?'var(--text3)':(r.tendance>0?'var(--red)':'var(--green)')}">${r.tendance===null?'—':(r.tendance>0?'▲ +':'▼ ')+fmtPct(r.tendance,0)}</td>
      </tr>`).join('')}
      <tr style="font-weight:600">
        <td class="highlight">Total</td>
        ${totalParMois.map(v=>`<td style="${mono};color:var(--text)">${fmt(v,0)}</td>`).join('')}
        <td style="${mono}"></td><td></td>
      </tr>
    </tbody>
    <caption style="caption-side:bottom;text-align:left;padding:10px 12px 0;font-size:11px;color:var(--text3)">Moyenne : mois complets depuis le premier mois de dépenses. Tendance : 3 derniers mois complets comparés aux 3 précédents (affichée à partir de 6 mois complets d'historique).</caption>`;
}
