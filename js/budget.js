// ═══════════════════════════════════════
//  Journal des dépenses/revenus : catégories, CRUD, rendu du tableau, sélection
// ═══════════════════════════════════════
function updateCategChips() {
  const type = document.getElementById('bType').value;
  const list = type==='depense' ? CATEG_DEPENSE : CATEG_REVENU;
  const chips = document.getElementById('categChips');
  chips.innerHTML = list.map(c=>`<span class="categ-chip" onclick="selectChip(this,'${c}')">${c}</span>`).join('');
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
  if (editBudgetId) {
    const b = state.budget.find(x=>x.id===editBudgetId);
    if (b) Object.assign(b,{label,categ,montant,type,date,compteId});
    editBudgetId = null;
  } else {
    state.budget.push({id:uid(),label,categ,montant,type,date,compteId});
  }
  closeModal('modalBudget');
  ['bLabel','bCateg','bMontant'].forEach(id=>document.getElementById(id).value='');
  notify(editBudgetId?'Opération modifiée':'Opération enregistrée');
  renderAll();
}
function editBudget(id) {
  const b = state.budget.find(x=>x.id===id);
  if (!b) return;
  editBudgetId = id;
  document.getElementById('budgetModalTitle').textContent = 'Modifier l\'opération';
  document.getElementById('bType').value = b.type;
  updateCategChips();
  populateCompteSelects();
  document.getElementById('bLabel').value   = b.label;
  document.getElementById('bCateg').value   = b.categ||'';
  document.getElementById('bMontant').value = b.montant;
  document.getElementById('bDate').value    = b.date;
  document.getElementById('bCompte').value  = b.compteId||'';
  openModal('modalBudget');
}
function deleteBudget(id) {
  if (!confirm('Supprimer cette opération ?')) return;
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
function renderBudgetTable() {
  buildYearSelect();
  buildMonthTabs();
  const year  = document.getElementById('filterBudgetYear').value || String(currentYear());
  const type  = document.getElementById('filterBudgetType').value;
  const month = currentBudgetMonth;
  const MOIS  = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  let items = state.budget.filter(b=>b.date.startsWith(year));
  if (month!=='all') items = items.filter(b=>b.date.slice(5,7)===month);
  if (type!=='all') items = items.filter(b=>b.type===type);

  let rev=0, dep=0;
  items.forEach(b=>{if(b.type==='revenu')rev+=b.montant;else dep+=b.montant;});
  document.getElementById('bRevenu').textContent = fmt(rev);
  document.getElementById('bDepense').textContent = fmt(dep);
  const solde = rev-dep;
  const s = document.getElementById('bSolde');
  s.textContent = fmt(solde);
  s.className = 'card-value '+(solde>=0?'green':'red');
  const tauxEl = document.getElementById('bTauxEpargne');
  if (tauxEl) {
    if (rev>0) { tauxEl.textContent = fmtPct(solde/rev*100,1); tauxEl.className = 'card-value '+(solde>=0?'green':'red'); }
    else { tauxEl.textContent = '—'; tauxEl.className = 'card-value'; }
  }

  const lbl = month==='all'?`Année ${year}`:`${MOIS[parseInt(month)]} ${year}`;
  document.getElementById('budgetMonthLabel').textContent = lbl;

  const tbody = document.getElementById('budgetTbody');
  tbody.innerHTML = items.sort((a,b)=>b.date.localeCompare(a.date)).map(b=>`
    <tr>
      <td>${b.type==='depense'?`<input type="checkbox" class="budget-check" data-id="${b.id}" ${checkedDepenseIds.has(b.id)?'checked':''} onchange="toggleDepenseCheck('${b.id}', this.checked)">`:''}</td>
      <td class="highlight">${b.date}</td>
      <td class="highlight">${b.label}</td>
      <td><span class="badge" style="background:${CATEG_COLORS[b.categ]||'rgba(255,255,255,0.07)'}22;color:${CATEG_COLORS[b.categ]||'var(--text3)'}">${b.categ||'—'}</span></td>
      <td>${b.compteId?`<span class="badge badge-blue">${compteLabel(b.compteId)}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
      <td>${b.type==='revenu'?'<span class="badge badge-green">Revenu</span>':'<span class="badge badge-red">Dépense</span>'}</td>
      <td class="${b.type==='revenu'?'green':'red'}">${b.type==='revenu'?'+':'−'}${fmt(b.montant)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="editBudget('${b.id}')">✎</button>
        <button class="icon-btn del" onclick="deleteBudget('${b.id}')">✕</button>
      </div></td>
    </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">Aucune opération</td></tr>';

  renderCategRecap(year);
  renderPrevisionWidget();
  renderAnomaliesWidget();
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
  const monthsWithDep = [...new Set(state.budget.filter(b=>b.type==='depense'&&b.date.startsWith(year)).map(b=>b.date.slice(0,7)))].sort();
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
    items = state.budget.filter(b=>b.date.startsWith(year));
    periodLabel = year;
  } else if (recapView === 'trimestre') {
    const ref = getReferenceYearMonth();
    const debut = addMonths(ref+'-01', -2).slice(0,7);
    items = state.budget.filter(b=>b.date.slice(0,7)>=debut && b.date.slice(0,7)<=ref);
    periodLabel = `${MOIS[parseInt(debut.slice(5,7))]} → ${MOIS[parseInt(ref.slice(5,7))]} ${ref.slice(0,4)}`;
  } else {
    const ref = getReferenceYearMonth();
    items = state.budget.filter(b=>b.date.startsWith(ref));
    periodLabel = `${MOIS[parseInt(ref.slice(5,7))]} ${ref.slice(0,4)}`;
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

  const reelParCateg = {};
  state.budget.filter(b=>b.type==='depense'&&b.date.startsWith(ref)).forEach(b=>{
    reelParCateg[b.categ||'Autre'] = (reelParCateg[b.categ||'Autre']||0)+b.montant;
  });
  const prevs = state.budgetPrevisionnel||{};
  // Catégories avec un prévu OU un réel, triées par écart décroissant (les dérapages en premier)
  const categs = [...new Set([...CATEG_DEPENSE, ...Object.keys(reelParCateg)])]
    .filter(c=>prevs[c]>0 || reelParCateg[c]>0);

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
        <td class="highlight"><span style="color:${CATEG_COLORS[r.c]||'var(--text3)'}">●</span> ${r.c}</td>
        <td><input type="number" min="0" step="1" value="${r.prevu||''}" placeholder="0" style="width:110px;padding:6px 10px;font-size:12px" onchange="updatePrevision('${r.c}', this.value)"></td>
        <td class="gold">${fmt(r.reel)}</td>
        <td class="${r.ecart>0?'red':'green'}">${r.ecart>0?'+':''}${fmt(r.ecart)}</td>
      </tr>`).join('');
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
  const refItems = state.budget.filter(b=>b.type==='depense'&&b.date.startsWith(ref));
  const parCateg = {};
  refItems.forEach(b=>{ const c=b.categ||'Autre'; parCateg[c]=(parCateg[c]||0)+b.montant; });

  Object.entries(parCateg).forEach(([categ, montant])=>{
    let total=0, count=0;
    for (let i=1;i<=HIST_MOIS;i++){
      const ym = addMonths(ref+'-01', -i).slice(0,7);
      const m = state.budget.filter(b=>b.type==='depense'&&(b.categ||'Autre')===categ&&b.date.startsWith(ym)).reduce((s,b)=>s+b.montant,0);
      if (m>0){ total+=m; count++; }
    }
    if (count>=2) {
      const moyenne = total/count;
      if (moyenne>0 && montant > moyenne*1.3) {
        const pct = (montant/moyenne-1)*100;
        anomalies.push({sev:pct, icon:'⚠', text:`Dépenses « ${categ} » supérieures de ${fmtPct(pct,0)} à la moyenne des ${count} derniers mois actifs (moyenne : ${fmt(moyenne)}).`});
      }
    }
  });

  // 2. Transaction isolée nettement supérieure à l'habitude de sa catégorie
  refItems.forEach(b=>{
    const categ = b.categ||'Autre';
    const hist = [];
    for (let i=1;i<=HIST_MOIS;i++){
      const ym = addMonths(ref+'-01', -i).slice(0,7);
      state.budget.filter(x=>x.type==='depense'&&(x.categ||'Autre')===categ&&x.date.startsWith(ym)).forEach(x=>hist.push(x.montant));
    }
    if (hist.length>=3) {
      const moy = hist.reduce((a,v)=>a+v,0)/hist.length;
      if (moy>0 && b.montant > moy*2.5 && b.montant>=100) {
        anomalies.push({sev:(b.montant/moy)*150, icon:'🔴', text:`Dépense inhabituelle détectée : ${fmt(b.montant)} pour « ${b.label} » (${categ}, ${b.date}) — nettement au-dessus de vos dépenses habituelles dans cette catégorie (moyenne : ${fmt(moy)}).`});
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
