// ═══════════════════════════════════════
//  Comptes courants : CRUD et calculs de solde
// ═══════════════════════════════════════
// Solde d'un compte. Sans dateStr : solde actuel (comportement historique, inchangé).
// Avec dateStr : solde exact reconstruit à cette date, en ne comptant que les opérations
// antérieures ou égales — permet un historique fiable sans données inventées.
function getSoldeCompte(compteId, dateStr) {
  const c = state.comptes.find(x=>x.id===compteId);
  if (!c) return 0;
  // Sans dateStr : solde À CE JOUR (les opérations datées dans le futur ne comptent pas encore).
  const limite = dateStr || today();
  const mvts = state.budget.filter(b=>b.compteId===compteId && b.date<=limite);
  const rev = mvts.filter(b=>b.type==='revenu').reduce((s,b)=>s+b.montant,0);
  const dep = mvts.filter(b=>b.type==='depense').reduce((s,b)=>s+b.montant,0);
  const vir = mvts.filter(b=>b.type==='virement').reduce((s,b)=>s+b.montant,0); // virements d'épargne : le compte est débité
  return (c.soldeInitial||0) + rev - dep - vir;
}
// ── Périmètre du budget ──
// Un compte « hors budget » (ex. Caisse d'Épargne) garde ses opérations et son solde, mais ses
// opérations ne comptent ni dans les revenus/dépenses, ni dans les récaps, prévisions, anomalies,
// épargne mensuelle ou synthèse. Une opération sans compte reste comptée (comportement historique).
// Défaut quand l'utilisateur n'a encore rien choisi (horsBudget non défini) : la Caisse d'Épargne est hors budget.
// Calculé à la lecture : ne dépend donc d'aucune migration ni de l'état de synchronisation.
const estCaisseEpargne = c => /caisse\s*d.?\s*[ée]pargne/i.test(`${c.label||''} ${c.banque||''}`);
function compteHorsBudget(c) {
  return typeof c.horsBudget === 'boolean' ? c.horsBudget : estCaisseEpargne(c);
}
function compteDansBudget(compteId) {
  const c = state.comptes.find(x=>x.id===compteId);
  return !(c && compteHorsBudget(c));
}
function getBudgetOps() {
  return state.budget.filter(b=>compteDansBudget(b.compteId));
}
// Fige le défaut dans les données (une seule fois par compte) pour qu'il soit sauvegardé.
function migrateComptesHorsBudget() {
  let changed = false;
  state.comptes.forEach(c=>{
    if (typeof c.horsBudget === 'boolean') return;
    c.horsBudget = estCaisseEpargne(c);
    changed = true;
  });
  return changed;
}
function compteLabel(id) {
  const c = state.comptes.find(x=>x.id===id);
  return c ? c.label : '—';
}
function populateCompteSelects() {
  const options = '<option value="">— Aucun compte —</option>' +
    state.comptes.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('');
  ['bCompte','salCompte','aCompteSource','csvCompte'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = options;
    if ([...el.options].some(o=>o.value===cur)) el.value = cur;
  });
}
function openAddCompte() {
  document.getElementById('compteModalTitle').textContent = 'Nouveau Compte';
  document.getElementById('cptEditId').value = '';
  document.getElementById('cptLabel').value = '';
  document.getElementById('cptBanque').value = '';
  document.getElementById('cptSoldeInitial').value = '0';
  document.getElementById('cptInclureBudget').checked = true;
  document.getElementById('cptDeleteBtn').style.display = 'none';
  openModal('modalCompte');
}
function openEditCompte(id) {
  const c = state.comptes.find(x=>x.id===id);
  if (!c) return;
  document.getElementById('compteModalTitle').textContent = 'Modifier le compte';
  document.getElementById('cptEditId').value = c.id;
  document.getElementById('cptLabel').value = c.label;
  document.getElementById('cptBanque').value = c.banque||'';
  document.getElementById('cptSoldeInitial').value = c.soldeInitial||0;
  document.getElementById('cptInclureBudget').checked = !compteHorsBudget(c);
  document.getElementById('cptDeleteBtn').style.display = 'inline-block';
  openModal('modalCompte');
}
function saveCompte() {
  const editId = document.getElementById('cptEditId').value;
  const label  = document.getElementById('cptLabel').value.trim();
  const banque = document.getElementById('cptBanque').value.trim();
  const soldeInitial = parseFloat(document.getElementById('cptSoldeInitial').value)||0;
  const horsBudget = !document.getElementById('cptInclureBudget').checked;
  if (!label){notify('Nom du compte requis',true);return;}
  if (editId) {
    const idx = state.comptes.findIndex(c=>c.id===editId);
    if (idx>=0) Object.assign(state.comptes[idx],{label,banque,soldeInitial,horsBudget});
  } else {
    state.comptes.push({id:uid(),label,banque,soldeInitial,horsBudget});
  }
  closeModal('modalCompte');
  notify(editId?'Compte modifié':'Compte enregistré');
  renderAll();
}
function deleteCompte(idParam) {
  const id = idParam || document.getElementById('cptEditId').value;
  if (!id) return;
  if (!confirm('Supprimer ce compte ? Les opérations liées resteront mais ne seront plus rattachées à un compte.')) return;
  state.comptes = state.comptes.filter(c=>c.id!==id);
  state.budget.forEach(b=>{if(b.compteId===id) b.compteId=null;});
  // Les automatismes qui pointaient vers ce compte ne doivent pas rester rattachés à un compte disparu.
  state.actifs.forEach(a=>{if(a.compteSourceId===id) a.compteSourceId=null;});
  getRecurrents().forEach(r=>{if(r.compteId===id) r.compteId=null;});
  closeModal('modalCompte');
  notify('Compte supprimé');
  renderAll();
}
function renderComptes() {
  populateCompteSelects();
  const container = document.getElementById('comptesList');
  if (!state.comptes.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--font-mono);grid-column:1/-1">Aucun compte courant. Cliquez sur "+ Nouveau compte" pour commencer.</div>';
    document.getElementById('cpt-total').textContent = fmt(0);
    document.getElementById('cpt-count').textContent = '0';
    document.getElementById('cpt-min').textContent = '—';
    return;
  }
  const soldes = state.comptes.map(c=>({c, solde:getSoldeCompte(c.id)}));
  const total = soldes.reduce((s,x)=>s+x.solde,0);
  const minEntry = soldes.reduce((a,b)=>a.solde<=b.solde?a:b);

  document.getElementById('cpt-total').textContent = fmt(total);
  document.getElementById('cpt-count').textContent = state.comptes.length;
  const minEl = document.getElementById('cpt-min');
  minEl.textContent = `${fmt(minEntry.solde)} (${minEntry.c.label})`;
  minEl.className = 'card-value '+(minEntry.solde<0?'red':minEntry.solde<200?'gold':'green');

  container.innerHTML = soldes.map(({c,solde})=>{
    const nbOps = state.budget.filter(b=>b.compteId===c.id).length;
    const rev = state.budget.filter(b=>b.compteId===c.id&&b.type==='revenu').reduce((s,b)=>s+b.montant,0);
    const dep = state.budget.filter(b=>b.compteId===c.id&&b.type==='depense').reduce((s,b)=>s+b.montant,0);
    const vir = state.budget.filter(b=>b.compteId===c.id&&b.type==='virement').reduce((s,b)=>s+b.montant,0);
    return `<div class="card" data-acc="compte:${c.id}">
      <div class="card-header">
        <span class="card-title">🏦 ${esc(c.label)}</span>
        <div class="row-actions">
          <button class="icon-btn" onclick="openEditCompte('${c.id}')" title="Modifier">✎</button>
          <button class="icon-btn del" onclick="deleteCompte('${c.id}')" title="Supprimer">✕</button>
        </div>
      </div>
      ${c.banque?`<div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-bottom:8px">${esc(c.banque)}</div>`:''}
      ${compteHorsBudget(c)?'<div style="margin-bottom:8px"><span class="badge">Hors budget</span></div>':''}
      <div class="card-value ${solde<0?'red':'gold'}">${fmt(solde)}</div>
      <div class="card-sub">Solde actuel · initial ${fmt(c.soldeInitial||0)}</div>
      <hr class="divider">
      <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12px">
        <span style="color:var(--green)">+${fmt(rev)}</span>
        <span style="color:var(--red)">−${fmt(dep)}</span>
        ${vir>0?`<span style="color:var(--blue)" title="Virements vers l'épargne">⇢ ${fmt(vir)}</span>`:''}
        <span style="color:var(--text3)">${nbOps} opération(s)</span>
      </div>
    </div>`;
  }).join('');
}
