// ═══════════════════════════════════════
//  Immobilier : biens, locataires, charges, rendu
// ═══════════════════════════════════════
function openLocataireModal() { populateBienSelects(); document.getElementById('locEntree').value=today(); openModal('modalLocataire'); }
function openChargeModal() { populateBienSelects(); document.getElementById('chargeDate').value=today(); updateChargeLabel(); openModal('modalCharge'); }
function openImmoActifModal() { document.getElementById('immoActifTitle').textContent='Nouveau Bien Immobilier'; document.getElementById('immoEditActifId').value=''; ['immoLabel','immoAdresse'].forEach(id=>document.getElementById(id).value=''); ['immoValeur','immoAcquisition','immoLoyer','immoCreditCRD','immoCreditMens'].forEach(id=>document.getElementById(id).value=''); document.getElementById('immoApprec').value='2'; document.getElementById('immoFiscal').value='nu'; openModal('modalImmoActif'); }

function saveImmoBien() {
  const editId = document.getElementById('immoEditActifId').value;
  const label = document.getElementById('immoLabel').value.trim();
  const valeur = parseFloat(document.getElementById('immoValeur').value)||0;
  const acquisition = parseFloat(document.getElementById('immoAcquisition').value)||valeur;
  const loyer = parseFloat(document.getElementById('immoLoyer').value)||0;
  const creditCRD = parseFloat(document.getElementById('immoCreditCRD').value)||0;
  const creditMens = parseFloat(document.getElementById('immoCreditMens').value)||0;
  const apprec = parseFloat(document.getElementById('immoApprec').value)||2;
  const fiscal = document.getElementById('immoFiscal').value;
  const adresse = document.getElementById('immoAdresse').value.trim();
  if (!label||valeur<=0){notify('Libellé et valeur requis',true);return;}
  const bien = {id:editId||uid(), label, valeur, acquisition, loyer, creditCRD, creditMens, apprec, fiscal, adresse};
  if (editId) {
    const idx = state.immoBiens.findIndex(b=>b.id===editId);
    if (idx>=0) state.immoBiens[idx] = bien;
  } else {
    state.immoBiens.push(bien);
    // Also create in actifs for portfolio visibility
    state.actifs.push({id:bien.id+'_a', label, category:'immobilier', valeur, mensuel:0, loyer, taux:apprec, fiscal:'ps', _immoRef:bien.id});
  }
  closeModal('modalImmoActif');
  document.getElementById('immoEditActifId').value='';
  notify(editId?'Bien modifié':'Bien enregistré');
  renderAll();
}
function openEditImmoBien(id) {
  const b = state.immoBiens.find(x=>x.id===id);
  if (!b) return;
  document.getElementById('immoActifTitle').textContent = 'Modifier le bien';
  document.getElementById('immoEditActifId').value = id;
  document.getElementById('immoLabel').value = b.label;
  document.getElementById('immoValeur').value = b.valeur;
  document.getElementById('immoAcquisition').value = b.acquisition||b.valeur;
  document.getElementById('immoLoyer').value = b.loyer||0;
  document.getElementById('immoCreditCRD').value = b.creditCRD||0;
  document.getElementById('immoCreditMens').value = b.creditMens||0;
  document.getElementById('immoApprec').value = b.apprec||2;
  document.getElementById('immoFiscal').value = b.fiscal||'nu';
  document.getElementById('immoAdresse').value = b.adresse||'';
  openModal('modalImmoActif');
}
function deleteImmoBien(id) {
  if (!confirm('Supprimer ce bien et ses données associées ?')) return;
  state.immoBiens = state.immoBiens.filter(b=>b.id!==id);
  state.locataires = state.locataires.filter(l=>l.bienId!==id);
  state.charges = state.charges.filter(c=>c.bienId!==id);
  state.actifs = state.actifs.filter(a=>a._immoRef!==id);
  renderAll();
}

// ═══════════════════════════════════════
//  IMMOBILIER — LOCATAIRES
// ═══════════════════════════════════════
function populateBienSelects() {
  const options = state.immoBiens.map(b=>`<option value="${b.id}">${b.label}</option>`).join('')
    || '<option value="">— Aucun bien —</option>';
  ['locBienId','chargeBienId'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}
function saveLocataire() {
  const bienId = document.getElementById('locBienId').value;
  const nom = document.getElementById('locNom').value.trim();
  const entree = document.getElementById('locEntree').value;
  const sortie = document.getElementById('locSortie').value;
  const loyer = parseFloat(document.getElementById('locLoyer').value)||0;
  const caution = parseFloat(document.getElementById('locCaution').value)||0;
  const notes = document.getElementById('locNotes').value.trim();
  if (!nom||!entree||!bienId){notify('Bien, nom et date d\'entrée requis',true);return;}
  state.locataires.push({id:uid(),bienId,nom,entree,sortie,loyer,caution,notes});
  // Update bien loyer if actif
  if (!sortie) {
    const b = state.immoBiens.find(x=>x.id===bienId);
    if (b) b.loyer = loyer;
    const a = state.actifs.find(x=>x._immoRef===bienId);
    if (a) a.loyer = loyer;
  }
  closeModal('modalLocataire');
  ['locNom','locEntree','locSortie','locLoyer','locCaution','locNotes'].forEach(id=>document.getElementById(id).value='');
  notify('Locataire enregistré');
  renderAll();
}
function deleteLocataire(id) {
  if (!confirm('Supprimer ce locataire ?')) return;
  state.locataires = state.locataires.filter(l=>l.id!==id);
  renderAll();
}

// ═══════════════════════════════════════
//  IMMOBILIER — CHARGES
// ═══════════════════════════════════════
const CHARGE_ICONS = {taxe_fonciere:'🏛',assurance_pno:'🛡',assurance_loyers:'📋',eau:'💧',electricite:'⚡',gaz:'🔥',internet:'📡',copropriete:'🏢',gestion:'🔑',entretien:'🔧',travaux:'🏗',comptable:'📊',autre:'📦'};
function updateChargeLabel() {
  const t = document.getElementById('chargeType').value;
  const labels = {taxe_fonciere:'Taxe foncière 2024',assurance_pno:'Assurance PNO',assurance_loyers:'GLI / Assurance loyers impayés',eau:'Eau & assainissement',electricite:'Electricité parties communes',gaz:'Gaz',internet:'Box Internet',copropriete:'Charges copropriété',gestion:'Commission agence',entretien:'Entretien chaudière',travaux:'Travaux rénovation',comptable:'Frais expert-comptable',autre:'Autre charge'};
  document.getElementById('chargeLabel').value = labels[t]||'';
}
function saveCharge() {
  const bienId = document.getElementById('chargeBienId').value;
  const type = document.getElementById('chargeType').value;
  const label = document.getElementById('chargeLabel').value.trim()||type;
  const montant = parseFloat(document.getElementById('chargeMontant').value)||0;
  const freq = document.getElementById('chargeFreq').value;
  const date = document.getElementById('chargeDate').value;
  if (!bienId||montant<=0){notify('Bien et montant requis',true);return;}
  state.charges.push({id:uid(),bienId,type,label,montant,freq,date});
  closeModal('modalCharge');
  ['chargeLabel','chargeMontant','chargeDate'].forEach(id=>document.getElementById(id).value='');
  notify('Charge enregistrée');
  renderAll();
}
function deleteCharge(id) {
  state.charges = state.charges.filter(c=>c.id!==id);
  renderAll();
}
function chargesMensuelles(bienId) {
  return state.charges.filter(c=>c.bienId===bienId).reduce((s,c)=>{
    const m = {mensuel:1,trimestriel:1/3,annuel:1/12,ponctuel:0};
    return s + c.montant*(m[c.freq]||0);
  },0);
}
function chargesAnnuelles(bienId) { return chargesMensuelles(bienId)*12; }

// ═══════════════════════════════════════
//  IMMOBILIER — RENDER
// ═══════════════════════════════════════
function showImmoTab(id, el) {
  document.querySelectorAll('.sub-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
}

function getFiscalLabel(f) {
  const m={nu:'Nu (IR)',lmnp:'LMNP Micro-BIC',lmnp_reel:'LMNP Réel',sci:'SCI IS 15%'};
  return m[f]||f;
}
function getTaxRate(f) {
  // Approximate net tax rate on rental income
  const m={nu:0.30,lmnp:0.15,lmnp_reel:0.05,sci:0.15};
  return m[f]||0.30;
}

function renderImmobilier() {
  populateBienSelects();
  renderImmoKPIs();
  renderImmoBiensList();
  renderLocatairesTable();
  renderChargesTable();
  renderRendement();
}

function renderImmoKPIs() {
  const totalLoyers = state.immoBiens.reduce((s,b)=>s+(b.loyer||0),0);
  const totalChargesMens = state.immoBiens.reduce((s,b)=>s+chargesMensuelles(b.id),0);
  const netAvantImpots = totalLoyers - totalChargesMens;
  const totalValeur = state.immoBiens.reduce((s,b)=>s+(b.valeur||0),0);
  // Net after taxes: apply tax rate per bien
  const netApresImpots = state.immoBiens.reduce((s,b)=>{
    const taxRate = getTaxRate(b.fiscal||'nu');
    const loyer = b.loyer||0;
    const charges = chargesMensuelles(b.id);
    return s + loyer*(1-taxRate) - charges - (b.creditMens||0);
  }, 0);
  document.getElementById('ikpi-loyers').textContent = fmt(totalLoyers)+'/mois';
  document.getElementById('ikpi-charges').textContent = fmt(totalChargesMens)+'/mois';
  const netEl = document.getElementById('ikpi-net');
  netEl.textContent = fmt(netAvantImpots)+'/mois';
  netEl.className = 'card-value '+(netAvantImpots>=0?'green':'red');
  const netApresEl = document.getElementById('ikpi-net-apres');
  if (netApresEl) {
    netApresEl.textContent = fmt(netApresImpots)+'/mois';
    netApresEl.className = 'card-value '+(netApresImpots>=0?'gold':'red');
  }
  document.getElementById('ikpi-valeur').textContent = fmt(totalValeur);
}

function renderImmoBiensList() {
  const container = document.getElementById('immoBiensList');
  if (!state.immoBiens.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--font-mono)">Aucun bien immobilier. Cliquez sur "+ Bien immobilier" pour commencer.</div>';
    return;
  }
  container.innerHTML = state.immoBiens.map(b=>{
    const locActifs = state.locataires.filter(l=>l.bienId===b.id&&!l.sortie);
    const locHisto = state.locataires.filter(l=>l.bienId===b.id&&l.sortie);
    const chargesM = chargesMensuelles(b.id);
    const netMens = (b.loyer||0) - chargesM - (b.creditMens||0);
    const taxRateBien = getTaxRate(b.fiscal||'nu');
    const rdmtBrut = b.valeur>0?((b.loyer||0)*12/b.valeur*100):0;
    const rdmtNet = b.valeur>0?(netMens*12/b.valeur*100):0;
    const cashflow = netMens;
    const equity = (b.valeur||0)-(b.creditCRD||0);
    const cfColor = cashflow>=0?'var(--green)':'var(--red)';
    const netApresImpotsBien = (b.loyer||0)*(1-taxRateBien) - chargesM - (b.creditMens||0);
    return `<div class="immo-card">
      <div class="immo-card-header">
        <div>
          <div class="immo-prop-title">🏠 ${b.label}</div>
          ${b.adresse?`<div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-top:4px">📍 ${b.adresse}</div>`:''}
        </div>
        <div style="display:flex;gap:6px">
          <span class="badge badge-gray">${getFiscalLabel(b.fiscal)}</span>
          <span class="badge ${locActifs.length?'badge-green':'badge-red'}">${locActifs.length?'Loué':'Vacant'}</span>
          <button class="icon-btn" onclick="openEditImmoBien('${b.id}')">✎</button>
          <button class="icon-btn del" onclick="deleteImmoBien('${b.id}')">✕</button>
        </div>
      </div>
      <div class="immo-metrics">
        <div class="immo-metric"><div class="immo-metric-label">Loyer/mois</div><div class="immo-metric-val" style="color:var(--gold)">${fmt(b.loyer)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Charges/mois</div><div class="immo-metric-val" style="color:var(--red)">−${fmt(chargesM)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Crédit/mois</div><div class="immo-metric-val" style="color:var(--red)">−${fmt(b.creditMens||0)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Net avant impôts</div><div class="immo-metric-val" style="color:${cashflow>=0?'var(--green)':'var(--red)'}">${cashflow>=0?'+':''}${fmt(cashflow)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Net après impôts</div><div class="immo-metric-val" style="color:${netApresImpotsBien>=0?'var(--gold)':'var(--red)'}">${netApresImpotsBien>=0?'+':''}${fmt(netApresImpotsBien)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Équité</div><div class="immo-metric-val" style="color:var(--blue)">${fmt(equity)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Valeur</div><div class="immo-metric-val">${fmt(b.valeur)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Rdt Brut</div><div class="immo-metric-val ${rdmtBrut>5?'roi-positive':'roi-negative'}">${fmtPct(rdmtBrut)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Rdt Net</div><div class="immo-metric-val ${rdmtNet>3?'roi-positive':'roi-negative'}">${fmtPct(rdmtNet)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">CRD Crédit</div><div class="immo-metric-val" style="color:var(--red)">${fmt(b.creditCRD||0)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Prix d'achat</div><div class="immo-metric-val">${fmt(b.acquisition||b.valeur)}</div></div>
      </div>
      ${locActifs.length?`<div style="margin-bottom:8px"><div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:6px">Locataire actuel</div>${locActifs.map(l=>`<div class="tenant-row"><div class="tenant-status actif"></div><span style="font-weight:500;color:var(--text)">${l.nom}</span><span style="color:var(--text3);font-size:11px">Depuis ${l.entree}</span><span class="badge badge-green" style="margin-left:auto">${fmt(l.loyer)}/m</span><span style="color:var(--text3);font-size:11px;margin-left:8px">Caution: ${fmt(l.caution)}</span></div>`).join('')}</div>`:''}
      ${locHisto.length?`<div><div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:6px">Anciens locataires (${locHisto.length})</div>${locHisto.slice(-2).map(l=>`<div class="tenant-row" style="opacity:.6"><div class="tenant-status parti"></div><span style="color:var(--text2)">${l.nom}</span><span style="color:var(--text3);font-size:11px">${l.entree} → ${l.sortie}</span></div>`).join('')}</div>`:''}
    </div>`;
  }).join('');
}

function renderLocatairesTable() {
  const tbody = document.getElementById('locatairesTbody');
  const bienMap = {};
  state.immoBiens.forEach(b=>bienMap[b.id]=b.label);
  tbody.innerHTML = state.locataires.length
    ? [...state.locataires].sort((a,b)=>b.entree.localeCompare(a.entree)).map(l=>`<tr>
        <td class="highlight">${bienMap[l.bienId]||'—'}</td>
        <td class="highlight">${l.nom}</td>
        <td>${l.entree||'—'}</td>
        <td ${!l.sortie?'class="green"':''}>${l.sortie||'En cours'}</td>
        <td class="gold">${fmt(l.loyer)}/mois</td>
        <td>${fmt(l.caution)}</td>
        <td><span class="badge ${l.sortie?'badge-gray':'badge-green'}">${l.sortie?'Parti':'Actif'}</span></td>
        <td><button class="icon-btn del" onclick="deleteLocataire('${l.id}')">✕</button></td>
      </tr>`).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">Aucun locataire enregistré</td></tr>';
}

function renderChargesTable() {
  const tbody = document.getElementById('chargesTbody');
  const bienMap = {};
  state.immoBiens.forEach(b=>bienMap[b.id]=b.label);
  const freqLabel = {mensuel:'Mensuelle',trimestriel:'Trimestrielle',annuel:'Annuelle',ponctuel:'Ponctuelle'};
  const freqMens = {mensuel:1,trimestriel:1/3,annuel:1/12,ponctuel:0};
  tbody.innerHTML = state.charges.length
    ? [...state.charges].sort((a,b)=>a.bienId.localeCompare(b.bienId)).map(c=>`<tr>
        <td class="highlight">${bienMap[c.bienId]||'—'}</td>
        <td>${CHARGE_ICONS[c.type]||'📦'} ${c.label}</td>
        <td class="red">${fmt(c.montant)}</td>
        <td><span class="badge badge-gray">${freqLabel[c.freq]||c.freq}</span></td>
        <td class="gold">${fmt(c.montant*(freqMens[c.freq]||0))}/m</td>
        <td style="color:var(--text3)">${c.date||'—'}</td>
        <td><button class="icon-btn del" onclick="deleteCharge('${c.id}')">✕</button></td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Aucune charge enregistrée</td></tr>';
}

function renderRendement() {
  const container = document.getElementById('rendementList');
  if (!state.immoBiens.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">Ajoutez des biens pour voir les calculs de rendement.</div>';
    return;
  }
  container.innerHTML = state.immoBiens.map(b=>{
    const loyer = b.loyer||0;
    const valeur = b.valeur||0;
    const achat = b.acquisition||valeur;
    const chargesM = chargesMensuelles(b.id);
    const creditM = b.creditMens||0;
    const creditCRD = b.creditCRD||0;
    const taxRate = getTaxRate(b.fiscal||'nu');

    // Calculs rendement
    const rdmtBrut = valeur>0?(loyer*12/valeur*100):0;
    const rdmtCharges = valeur>0?((loyer-chargesM)*12/valeur*100):0;
    const loyerNetFisc = loyer*(1-taxRate);
    const rdmtNet = valeur>0?(loyerNetFisc*12/valeur*100):0;

    // Cash-flow
    const cashflowBrut = loyer - chargesM;
    const cashflowNet = loyer*(1-taxRate) - chargesM - creditM;

    // ROI (Return on Investment sur apport)
    const apport = achat - creditCRD;
    const roiAnnuel = apport>0?(cashflowNet*12/apport*100):0;

    // Plus-value potentielle 10 ans
    const valeur10 = compound(valeur, b.apprec||2, 10);
    const pvPotentielle = valeur10 - valeur;

    // TRI simplifié (cashflow + PV)
    const totalRetour10 = cashflowNet*12*10 + pvPotentielle;
    const tri = apport>0?(totalRetour10/apport/10*100):0;

    const cfColor = cashflowNet>=0?'var(--green)':'var(--red)';
    const roiColor = roiAnnuel>=0?'var(--green)':'var(--red)';
    return `<div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <span style="font-family:var(--font-display);font-size:18px;color:var(--gold)">📊 ${b.label}</span>
        <span class="badge badge-gray">${getFiscalLabel(b.fiscal)}</span>
      </div>

      <div class="grid-3" style="margin-bottom:16px">
        <div style="background:var(--bg4);border-radius:6px;padding:14px">
          <div class="card-title" style="margin-bottom:8px">Rendements</div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Brut</span><span class="immo-metric-val" style="color:var(--gold)">${fmtPct(rdmtBrut)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Net charges</span><span class="immo-metric-val" style="color:var(--text)">${fmtPct(rdmtCharges)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Net fiscal</span><span class="immo-metric-val ${rdmtNet>3?'roi-positive':'roi-negative'}">${fmtPct(rdmtNet)}</span></div>
        </div>
        <div style="background:var(--bg4);border-radius:6px;padding:14px">
          <div class="card-title" style="margin-bottom:8px">Cash-flow mensuel</div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Brut (loyer−charges)</span><span style="font-family:var(--font-mono)">${fmt(cashflowBrut)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Net (−crédit −fisc.)</span><span style="font-family:var(--font-mono);color:${cfColor};font-weight:600">${cashflowNet>=0?'+':''}${fmt(cashflowNet)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Sur l'année</span><span style="font-family:var(--font-mono);color:${cfColor}">${cashflowNet>=0?'+':''}${fmt(cashflowNet*12)}</span></div>
        </div>
        <div style="background:var(--bg4);border-radius:6px;padding:14px">
          <div class="card-title" style="margin-bottom:8px">ROI &amp; TRI</div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Apport initial</span><span style="font-family:var(--font-mono)">${fmt(apport)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">ROI annuel</span><span style="font-family:var(--font-mono);color:${roiColor};font-weight:600">${fmtPct(roiAnnuel)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">TRI ~10 ans</span><span style="font-family:var(--font-mono);color:${tri>5?'var(--green)':'var(--text)'}">${fmtPct(tri)}</span></div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <div class="card-title" style="margin-bottom:8px">Projection valeur bien</div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Valeur actuelle</span><span style="font-family:var(--font-mono)">${fmt(valeur)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">+5 ans (${fmtPct(b.apprec||2)}/an)</span><span style="font-family:var(--font-mono);color:var(--gold)">${fmt(compound(valeur,b.apprec||2,5))}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">+10 ans</span><span style="font-family:var(--font-mono);color:var(--gold)">${fmt(valeur10)}</span></div>
          <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Plus-value potentielle 10a</span><span style="font-family:var(--font-mono);color:var(--green)">+${fmt(pvPotentielle)}</span></div>
        </div>
        <div>
          <div class="card-title" style="margin-bottom:8px">Charges annuelles détail</div>
          ${state.charges.filter(c=>c.bienId===b.id).length?
            state.charges.filter(c=>c.bienId===b.id).map(c=>{
              const freqMens={mensuel:1,trimestriel:1/3,annuel:1/12,ponctuel:0};
              const annuel = c.montant*(freqMens[c.freq]||0)*12;
              return `<div class="alloc-row"><span style="color:var(--text3);font-size:12px">${CHARGE_ICONS[c.type]||'📦'} ${c.label}</span><span style="font-family:var(--font-mono);color:var(--red)">−${fmt(annuel)}/an</span></div>`;
            }).join('')+'<div class="alloc-row" style="border-top:1px solid var(--border2);margin-top:4px;padding-top:8px"><span style="font-weight:500">Total charges annuelles</span><span style="font-family:var(--font-mono);color:var(--red)">−${fmt(chargesM*12)}</span></div>'
            :'<div style="color:var(--text3);font-size:12px;padding:8px">Aucune charge enregistrée pour ce bien.</div>'
          }
        </div>
      </div>
    </div>`;
  }).join('');
}

