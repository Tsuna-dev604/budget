// ═══════════════════════════════════════
//  Opérations récurrentes (salaires, virements reçus, dépenses fixes)
//  - Plusieurs opérations possibles (state.recurrents).
//  - Chaque opération est ajoutée au Budget À SA DATE chaque mois, jamais en avance
//    (plus de génération anticipée jusqu'à décembre).
//  - syncRecurrents() est idempotent : appelée à l'ouverture, après chaque modification
//    et périodiquement, elle rattrape les mois échus (nouveau mois, nouvelle année…).
//  - Une opération supprimée à la main du Budget n'est pas recréée (lastSyncYm).
// ═══════════════════════════════════════
const REC_MOIS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function getRecurrents() {
  if (!state.recurrents) state.recurrents = [];
  return state.recurrents;
}

// Migration de l'ancien salaire unique (state.salaire) vers la liste de récurrents.
function migrateSalaireToRecurrents() {
  if (!state.recurrents) state.recurrents = [];
  if (!state.salaire) return false;
  const s = state.salaire;
  const id = 'rec_'+uid();
  state.recurrents.push({
    id, label:s.label||'Salaire net', type:'revenu', montant:s.montant, jour:s.jour||1,
    categ:s.categ||'Salaire', compteId:s.compteId||null,
    fromMonth:s.fromMonth, fromYear:s.fromYear, toMonth:s.toMonth||null, toYear:s.toYear||null, lastSyncYm:null
  });
  const t = today();
  // Les anciennes lignes générées à l'avance (dates futures) sont retirées : elles seront recréées à leur date.
  state.budget = state.budget.filter(b=>!(b._salaire && b.date>t));
  state.budget.forEach(b=>{ if (b._salaire) { b._recId = id; b._ym = b.date.slice(0,7); delete b._salaire; } });
  state.salaire = null;
  return true;
}

// Génère les opérations échues. Retourne true si l'état a changé.
function syncRecurrents() {
  let changed = migrateSalaireToRecurrents();
  const now = today(), nowYm = now.slice(0,7);
  getRecurrents().forEach(r=>{
    if (!r.fromYear || !r.fromMonth || !(r.montant>0)) return;
    const toYm = (r.toYear && r.toMonth) ? `${r.toYear}-${pad2(r.toMonth)}` : null;
    let ym = `${r.fromYear}-${pad2(r.fromMonth)}`;
    let guard = 0;
    while (guard++ < 600) {
      if (ym > nowYm) break;
      if (toYm && ym > toYm) break;
      const date = `${ym}-${pad2(Math.min(r.jour||1, daysInMonth(ym)))}`;
      if (date > now) break; // pas encore échu : on attend le jour J
      if (!r.lastSyncYm || ym > r.lastSyncYm) {
        if (!state.budget.some(b=>b._recId===r.id && b._ym===ym)) {
          state.budget.push({
            id:uid(), label:r.label, categ:r.categ, compteId:r.compteId||null,
            montant:r.montant, type:r.type||'revenu', date, _recId:r.id, _ym:ym
          });
        }
        r.lastSyncYm = ym;
        changed = true;
      }
      ym = nextYm(ym);
    }
  });
  return changed;
}
// Compatibilité avec l'ancien nom
function applySalaire() { return syncRecurrents(); }

// ── Liste ──
function openRecurrentsModal() {
  renderRecurrentsList();
  openModal('modalRecurrents');
}
function openSalaireModal() { openRecurrentsModal(); } // compatibilité

function renderRecurrentsList() {
  const el = document.getElementById('recurrentsList');
  if (!el) return;
  const recs = getRecurrents();
  if (!recs.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-family:var(--font-mono);font-size:12px">Aucune opération récurrente. Cliquez sur « + Ajouter » pour créer un salaire ou un virement.</div>';
    return;
  }
  el.innerHTML = recs.map(r=>{
    const isRev = (r.type||'revenu')==='revenu';
    const depuis = `${REC_MOIS[r.fromMonth]||''} ${r.fromYear||''}`;
    const jusqua = (r.toYear && r.toMonth) ? ` → ${REC_MOIS[r.toMonth]} ${r.toYear}` : '';
    return `<div class="alloc-row" style="gap:12px">
      <div style="min-width:0">
        <div style="color:var(--text);font-weight:500">${r.label} <span class="badge ${isRev?'badge-green':'badge-red'}" style="margin-left:6px">${isRev?'Revenu':'Dépense'}</span></div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-top:2px">le ${r.jour||1} du mois · ${r.categ||'—'} · ${r.compteId?compteLabel(r.compteId):'sans compte'} · ${depuis}${jusqua}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        <span style="font-family:var(--font-mono);font-weight:600;color:${isRev?'var(--green)':'var(--red)'}">${isRev?'+':'−'}${fmt(r.montant)}</span>
        <div class="row-actions">
          <button class="icon-btn" onclick="openRecurrentForm('${r.id}')" title="Modifier">✎</button>
          <button class="icon-btn del" onclick="deleteRecurrent('${r.id}')" title="Supprimer">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Formulaire ──
function recurrentCategOptions(type, selected) {
  const list = type==='depense' ? CATEG_DEPENSE : CATEG_REVENU;
  const sel = document.getElementById('salCateg');
  sel.innerHTML = list.map(c=>`<option value="${c}">${c}</option>`).join('');
  sel.value = list.includes(selected) ? selected : list[0];
}
function onRecurrentTypeChange() {
  recurrentCategOptions(document.getElementById('salType').value, '');
}
function openRecurrentForm(id) {
  populateCompteSelects();
  const r = id ? getRecurrents().find(x=>x.id===id) : null;
  const now = new Date();
  const type = r ? (r.type||'revenu') : 'revenu';
  document.getElementById('recModalTitle').textContent = r ? 'Modifier l\'opération récurrente' : 'Nouvelle opération récurrente';
  document.getElementById('salEditId').value = r ? r.id : '';
  document.getElementById('salType').value = type;
  recurrentCategOptions(type, r ? r.categ : 'Salaire');
  document.getElementById('salLabel').value = r ? r.label : (type==='revenu' ? 'Salaire net' : '');
  document.getElementById('salMontant').value = r ? r.montant : '';
  document.getElementById('salJour').value = r ? (r.jour||1) : 1;
  document.getElementById('salCompte').value = r ? (r.compteId||'') : '';
  document.getElementById('salFromMonth').value = r ? r.fromMonth : now.getMonth()+1;
  document.getElementById('salFromYear').value = r ? r.fromYear : now.getFullYear();
  document.getElementById('salToMonth').value = r ? (r.toMonth||'') : '';
  document.getElementById('salToYear').value = r ? (r.toYear||'') : '';
  document.getElementById('salDeleteBtn').style.display = r ? 'inline-block' : 'none';
  openModal('modalRecurrent');
}

function saveRecurrent() {
  const editId = document.getElementById('salEditId').value;
  const montant = parseFloat(document.getElementById('salMontant').value);
  const fromY = parseInt(document.getElementById('salFromYear').value);
  if (!montant || montant<=0 || !fromY) { notify('Montant et date de départ requis', true); return; }
  const type = document.getElementById('salType').value;
  const rec = {
    id: editId || ('rec_'+uid()),
    label: document.getElementById('salLabel').value.trim() || (type==='revenu' ? 'Revenu récurrent' : 'Dépense récurrente'),
    type, montant,
    jour: Math.min(28, Math.max(1, parseInt(document.getElementById('salJour').value)||1)),
    categ: document.getElementById('salCateg').value,
    compteId: document.getElementById('salCompte').value || null,
    fromMonth: parseInt(document.getElementById('salFromMonth').value),
    fromYear: fromY,
    toMonth: parseInt(document.getElementById('salToMonth').value)||null,
    toYear: parseInt(document.getElementById('salToYear').value)||null,
    lastSyncYm: null
  };
  if (editId) {
    // Régénère l'historique de cette opération (montant / jour / période modifiés)
    state.budget = state.budget.filter(b=>b._recId!==editId);
    const idx = getRecurrents().findIndex(x=>x.id===editId);
    if (idx>=0) state.recurrents[idx] = rec; else state.recurrents.push(rec);
  } else {
    getRecurrents().push(rec);
  }
  runAutoSync();
  closeModal('modalRecurrent');
  if (document.getElementById('modalRecurrents').classList.contains('open')) renderRecurrentsList();
  renderAll();
  notify('Opération récurrente enregistrée');
}

function deleteRecurrent(id) {
  if (!id || !confirm('Supprimer cette opération récurrente ?')) return;
  const garder = confirm('Conserver les opérations déjà ajoutées au Budget ?\n\nOK = les conserver · Annuler = les supprimer aussi');
  state.recurrents = getRecurrents().filter(r=>r.id!==id);
  if (garder) state.budget.forEach(b=>{ if (b._recId===id) { delete b._recId; delete b._ym; } });
  else state.budget = state.budget.filter(b=>b._recId!==id);
  closeModal('modalRecurrent');
  renderRecurrentsList();
  renderAll();
  notify('Opération récurrente supprimée');
}
function deleteSalaire() { /* ancien point d'entrée, remplacé par deleteRecurrent */ }

function renderSalaireBadge() {
  const recs = getRecurrents();
  const rev = recs.filter(r=>(r.type||'revenu')==='revenu').reduce((s,r)=>s+r.montant,0);
  const html = recs.length
    ? `<div class="salary-badge" onclick="openRecurrentsModal()" style="cursor:pointer" title="Cliquer pour gérer">
        🔁 ${recs.length} récurrent${recs.length>1?'s':''} · ${fmt(rev)}/mois de revenus
      </div>`
    : '';
  ['salaryBadgeWrap','salaryBadgeWrapSettings'].forEach(id=>{
    const wrap = document.getElementById(id);
    if (wrap) wrap.innerHTML = html;
  });
}
