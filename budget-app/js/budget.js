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
let recapView = 'year'; // 'year' | 'month'
function setRecapView(v) {
  recapView = v;
  document.getElementById('recapToggleYear').classList.toggle('active', v==='year');
  document.getElementById('recapToggleMonth').classList.toggle('active', v==='month');
  const year = document.getElementById('filterBudgetYear').value || String(currentYear());
  renderCategRecap(year);
}
function renderCategRecap(year) {
  const MOIS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  let items, periodLabel;
  if (recapView === 'month' && currentBudgetMonth !== 'all') {
    items = state.budget.filter(b=>b.date.startsWith(year) && b.date.slice(5,7)===currentBudgetMonth);
    periodLabel = `${MOIS[parseInt(currentBudgetMonth)]} ${year}`;
  } else {
    items = state.budget.filter(b=>b.date.startsWith(year));
    periodLabel = year;
    if (recapView === 'month') periodLabel = `Tous — ${year}`;
  }
  document.getElementById('recapPeriodLabel').textContent = periodLabel;

  const buildRecap = (type) => {
    const map = {};
    items.filter(b=>b.type===type).forEach(b=>{
      const c = b.categ||'Autre';
      map[c] = (map[c]||0)+b.montant;
    });
    const total = Object.values(map).reduce((a,v)=>a+v,0)||1;
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;align-items:center">
          <span style="color:${CATEG_COLORS[c]||'var(--text3)'}">● ${c}</span>
          <span style="font-family:var(--font-mono);white-space:nowrap">${fmt(v)} <span style="color:var(--text3)">(${fmtPct(v/total*100,0)})</span></span>
        </div>
        <div class="categ-bar-wrap"><div class="categ-bar" style="width:${v/total*100}%;background:${CATEG_COLORS[c]||'var(--text3)'}"></div></div>
      </div>`).join('')||'<div style="color:var(--text3);font-size:12px">Aucune donnée pour cette période</div>';
  };
  document.getElementById('categRecapDep').innerHTML = buildRecap('depense');
  document.getElementById('categRecapRev').innerHTML = buildRecap('revenu');
}

