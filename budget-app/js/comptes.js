// ═══════════════════════════════════════
//  Comptes courants : CRUD et calculs de solde
// ═══════════════════════════════════════
function getSoldeCompte(compteId) {
  const c = state.comptes.find(x=>x.id===compteId);
  if (!c) return 0;
  const mvts = state.budget.filter(b=>b.compteId===compteId);
  const rev = mvts.filter(b=>b.type==='revenu').reduce((s,b)=>s+b.montant,0);
  const dep = mvts.filter(b=>b.type==='depense').reduce((s,b)=>s+b.montant,0);
  return (c.soldeInitial||0) + rev - dep;
}
function compteLabel(id) {
  const c = state.comptes.find(x=>x.id===id);
  return c ? c.label : '—';
}
function populateCompteSelects() {
  const options = '<option value="">— Aucun compte —</option>' +
    state.comptes.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  ['bCompte','salCompte'].forEach(id=>{
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
  document.getElementById('cptDeleteBtn').style.display = 'inline-block';
  openModal('modalCompte');
}
function saveCompte() {
  const editId = document.getElementById('cptEditId').value;
  const label  = document.getElementById('cptLabel').value.trim();
  const banque = document.getElementById('cptBanque').value.trim();
  const soldeInitial = parseFloat(document.getElementById('cptSoldeInitial').value)||0;
  if (!label){notify('Nom du compte requis',true);return;}
  if (editId) {
    const idx = state.comptes.findIndex(c=>c.id===editId);
    if (idx>=0) Object.assign(state.comptes[idx],{label,banque,soldeInitial});
  } else {
    state.comptes.push({id:uid(),label,banque,soldeInitial});
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
    renderDoublonsCheck();
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
    return `<div class="card">
      <div class="card-header">
        <span class="card-title">🏦 ${c.label}</span>
        <div class="row-actions">
          <button class="icon-btn" onclick="openEditCompte('${c.id}')" title="Modifier">✎</button>
          <button class="icon-btn del" onclick="deleteCompte('${c.id}')" title="Supprimer">✕</button>
        </div>
      </div>
      ${c.banque?`<div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-bottom:8px">${c.banque}</div>`:''}
      <div class="card-value ${solde<0?'red':'gold'}">${fmt(solde)}</div>
      <div class="card-sub">Solde actuel · initial ${fmt(c.soldeInitial||0)}</div>
      <hr class="divider">
      <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:12px">
        <span style="color:var(--green)">+${fmt(rev)}</span>
        <span style="color:var(--red)">−${fmt(dep)}</span>
        <span style="color:var(--text3)">${nbOps} opération(s)</span>
      </div>
    </div>`;
  }).join('');
  renderDoublonsCheck();
}

function renderDoublonsCheck() {
  const card = document.getElementById('doublonsCard');
  const list = document.getElementById('doublonsList');
  const liquides = state.actifs.filter(a=>a.category==='liquide');
  if (!liquides.length) { card.style.display='none'; return; }
  card.style.display = 'block';
  list.innerHTML = liquides.map(a=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:var(--gold)"></span>${a.label} <span style="color:var(--text3);font-family:var(--font-mono);font-size:11px;margin-left:6px">${fmt(a.valeur)}</span></div>
      <div class="row-actions">
        <button class="btn btn-blue" style="padding:4px 10px;font-size:10px" onclick="convertActifToCompte('${a.id}')">🔄 Convertir en Compte</button>
        <button class="icon-btn del" onclick="deleteActif('${a.id}')" title="Supprimer ce doublon">✕</button>
      </div>
    </div>`).join('');
}

function convertActifToCompte(actifId) {
  const a = state.actifs.find(x=>x.id===actifId);
  if (!a) return;
  if (!confirm(`Convertir "${a.label}" (${fmt(a.valeur)}) en Compte Courant ? Il sera retiré des Actifs Liquides et son solde deviendra le solde initial du nouveau compte.`)) return;
  state.comptes.push({id:uid(), label:a.label, banque:'', soldeInitial:a.valeur||0});
  state.actifs = state.actifs.filter(x=>x.id!==actifId);
  notify('Actif converti en Compte Courant');
  renderAll();
}

