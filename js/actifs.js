// ═══════════════════════════════════════
//  Actifs (patrimoine financier/physique) : modale, opérations rapides, rendu
// ═══════════════════════════════════════
function toggleActifFields() {
  const cat = document.getElementById('aCategory').value;
  const isPhys = cat==='physique';
  const isImmo = cat==='immobilier';
  document.getElementById('fieldsFinancier').style.display = isPhys?'none':'block';
  document.getElementById('fieldsPhysique').style.display  = isPhys?'block':'none';
  document.getElementById('fieldLoyer').style.display      = isImmo?'block':'none';
}
function openAddActif() {
  document.getElementById('actifModalTitle').textContent = 'Nouvel Actif';
  document.getElementById('aEditId').value = '';
  ['aLabel','aValeur','aMensuel','aLoyer','aTaux','aValeurPhys','aAchat','aEvolPhys'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.value = id==='aMensuel'||id==='aLoyer'?'0':'';
  });
  document.getElementById('aCategory').value = 'liquide';
  document.getElementById('aFiscal').value = 'exonere';
  toggleActifFields();
  openModal('modalActif');
}
function openEditActif(id) {
  const a = state.actifs.find(x=>x.id===id);
  if (!a) return;
  document.getElementById('actifModalTitle').textContent = 'Modifier l\'actif';
  document.getElementById('aEditId').value = id;
  document.getElementById('aCategory').value  = a.category||'liquide';
  document.getElementById('aLabel').value     = a.label;
  if (a.category==='physique') {
    document.getElementById('aSubtype').value     = a.subtype||'autre';
    document.getElementById('aAchat').value       = a.achat||0;
    document.getElementById('aValeurPhys').value  = a.valeur||0;
    document.getElementById('aEvolPhys').value    = a.evolPhys||0;
  } else {
    document.getElementById('aValeur').value  = a.valeur||0;
    document.getElementById('aMensuel').value = a.mensuel||0;
    document.getElementById('aLoyer').value   = a.loyer||0;
    document.getElementById('aTaux').value    = a.taux||0;
    document.getElementById('aFiscal').value  = a.fiscal||'exonere';
  }
  toggleActifFields();
  openModal('modalActif');
}
function saveActif() {
  const editId = document.getElementById('aEditId').value;
  const cat    = document.getElementById('aCategory').value;
  const label  = document.getElementById('aLabel').value.trim();
  if (!label){notify('Libellé requis',true);return;}

  let actif = {id: editId||uid(), label, category: cat};
  if (cat==='physique') {
    const achat = parseFloat(document.getElementById('aAchat').value)||0;
    const val   = parseFloat(document.getElementById('aValeurPhys').value)||0;
    if (val<=0&&achat<=0){notify('Valeur requise',true);return;}
    actif = {...actif, subtype:document.getElementById('aSubtype').value, achat, valeur:val||achat, evolPhys:parseFloat(document.getElementById('aEvolPhys').value)||0};
  } else {
    const valeur  = parseFloat(document.getElementById('aValeur').value)||0;
    const mensuel = parseFloat(document.getElementById('aMensuel').value)||0;
    const loyer   = parseFloat(document.getElementById('aLoyer').value)||0;
    const taux    = parseFloat(document.getElementById('aTaux').value)||0;
    if (valeur<=0&&mensuel<=0){notify('Valeur ou versement requis',true);return;}
    actif = {...actif, valeur, mensuel, loyer, taux, fiscal:document.getElementById('aFiscal').value};
  }

  if (editId) {
    const idx = state.actifs.findIndex(x=>x.id===editId);
    if (idx>=0) {
      const prev = state.actifs[idx];
      // Enregistre si la valeur a changé
      if (prev.valeur !== actif.valeur) recordPrice(actif.id, actif.valeur, today());
      state.actifs[idx] = actif;
    }
  } else {
    state.actifs.push(actif);
    // Point initial à la création
    recordPrice(actif.id, actif.valeur || actif.achat || 0, today());
  }
  closeModal('modalActif');
  notify(editId?'Actif modifié':'Actif enregistré');
  renderAll();
}
function deleteActif(id) {
  if (!confirm('Supprimer cet actif ?')) return;
  state.actifs = state.actifs.filter(a=>a.id!==id);
  renderAll();
}

// ═══════════════════════════════════════
//  ACTIFS — OPÉRATION RAPIDE
// ═══════════════════════════════════════
function openActifOp(id) {
  opActifId = id;
  const a = state.actifs.find(x=>x.id===id);
  document.getElementById('opActifLabel').textContent = a?a.label:'';
  document.getElementById('opMontant').value = '';
  document.getElementById('opDate').value = today();
  document.getElementById('opType').value = 'versement';
  updateOpLabel();
  openModal('modalActifOp');
}
function updateOpLabel() {
  const t = document.getElementById('opType').value;
  const labels = {versement:'Montant à ajouter (€)',retrait:'Montant à retirer (€)',revalorisation:'Nouvelle valeur totale (€)',taux:'Nouveau taux annuel brut (%)',mensuel:'Nouveau versement mensuel (€)'};
  document.getElementById('opMontantLabel').textContent = labels[t]||'Valeur';
  document.getElementById('opDateWrap').style.display = ['versement','retrait'].includes(t)?'block':'none';
}
document.getElementById('opType').addEventListener('change', updateOpLabel);

function applyActifOp() {
  const a = state.actifs.find(x=>x.id===opActifId);
  if (!a) return;
  const t = document.getElementById('opType').value;
  const v = parseFloat(document.getElementById('opMontant').value)||0;
  if (!v){notify('Valeur requise',true);return;}
  const dateOp = document.getElementById('opDate').value || today();
  switch(t) {
    case 'versement':    a.valeur = (a.valeur||0)+v; break;
    case 'retrait':      a.valeur = Math.max(0,(a.valeur||0)-v); break;
    case 'revalorisation': a.valeur = v; break;
    case 'taux':         a.taux = v; break;
    case 'mensuel':      a.mensuel = v; break;
  }
  // Enregistre un point d'historique pour versement/retrait/revalorisation
  if (['versement','retrait','revalorisation'].includes(t)) {
    recordPrice(a.id, a.valeur, dateOp);
  }
  closeModal('modalActifOp');
  notify('Opération appliquée');
  renderAll();
}

// ═══════════════════════════════════════
//  ACTIFS — RENDER
// ═══════════════════════════════════════
function actifActions(a) {
  return `<div class="row-actions">
    <button class="icon-btn" onclick="openActifOp('${a.id}')" title="Versement / retrait / modif">⚡</button>
    <button class="icon-btn" onclick="openEditActif('${a.id}')" title="Modifier">✎</button>
    <button class="icon-btn del" onclick="deleteActif('${a.id}')" title="Supprimer">✕</button>
  </div>`;
}
function financierRow(a) {
  const rNet = taxNet(a.taux||0, a.fiscal||'exonere');
  const m    = a.mensuel||0;
  const v1   = compoundWithContrib(a.valeur||0, rNet, 1, m);
  const v5   = compoundWithContrib(a.valeur||0, rNet, 5, m);
  const v10  = compoundWithContrib(a.valeur||0, rNet, 10, m);
  return `<tr>
    <td class="highlight">${a.label}</td>
    <td class="gold">${fmt(a.valeur)}</td>
    <td style="color:var(--green);font-family:var(--font-mono)">${m>0?'+'+fmt(m)+'/m':'—'}</td>
    <td>${fmtPct(a.taux||0)}</td>
    <td>${fiscalLabel(a.fiscal||'exonere')}</td>
    <td class="green">${fmtPct(rNet)}</td>
    <td>${fmt(v1)}</td><td>${fmt(v5)}</td><td>${fmt(v10)}</td>
    <td>${actifActions(a)}</td>
  </tr>`;
}
function immoRow(a) {
  const rNet = taxNet(a.taux||0, a.fiscal||'ps');
  const loyer = a.loyer||0;
  const rendLoc = a.valeur>0 ? (loyer*12/a.valeur*100) : 0;
  const v1  = compoundWithContrib(a.valeur||0, rNet, 1, 0);
  const v5  = compoundWithContrib(a.valeur||0, rNet, 5, 0);
  const v10 = compoundWithContrib(a.valeur||0, rNet, 10, 0);
  return `<tr>
    <td class="highlight">${a.label}</td>
    <td class="gold">${fmt(a.valeur)}</td>
    <td style="color:var(--green);font-family:var(--font-mono)">${loyer>0?fmt(loyer)+'/m':'—'}</td>
    <td>${fmtPct(a.taux||0)}</td>
    <td>${fiscalLabel(a.fiscal||'ps')}</td>
    <td class="${rendLoc>4?'green':'gold'}">${rendLoc>0?fmtPct(rendLoc):'—'}</td>
    <td>${fmt(v1)}</td><td>${fmt(v5)}</td><td>${fmt(v10)}</td>
    <td>${actifActions(a)}</td>
  </tr>`;
}
const SUBTYPE_ICONS = {montre:'⌚',art:'🎨',voiture:'🚗',moto:'🏍',bijou:'💍',vin:'🍷',autre:'📦'};
function physRow(a) {
  const achat = a.achat||a.valeur||0;
  const val   = a.valeur||0;
  const diff  = val-achat;
  const pct   = achat>0?(diff/achat*100):0;
  const evol  = a.evolPhys||0;
  const v5    = compound(val, evol, 5);
  const v10   = compound(val, evol, 10);
  return `<tr>
    <td class="highlight">${a.label}</td>
    <td>${SUBTYPE_ICONS[a.subtype]||'📦'} <span style="color:var(--text3);font-size:11px">${a.subtype||'autre'}</span></td>
    <td>${fmt(achat)}</td>
    <td class="gold">${fmt(val)}</td>
    <td class="${diff>=0?'green':'red'}">${diff>=0?'+':''}${fmt(diff)} <span style="font-size:10px">(${pct>=0?'+':''}${pct.toFixed(1)}%)</span></td>
    <td class="${evol>=0?'green':'red'}">${evol>=0?'+':''}${fmtPct(evol)}/an</td>
    <td>${fmt(v5)}</td><td>${fmt(v10)}</td>
    <td>${actifActions(a)}</td>
  </tr>`;
}

function renderActifs() {
  const liquides    = state.actifs.filter(a=>a.category==='liquide');
  const semiliquid  = state.actifs.filter(a=>a.category==='semiliquide');
  const immobilier  = state.actifs.filter(a=>a.category==='immobilier');
  const physiques   = state.actifs.filter(a=>a.category==='physique');
  const empty = (n) => `<tr><td colspan="${n}" style="text-align:center;color:var(--text3);padding:16px">Aucun actif</td></tr>`;

  document.getElementById('actifLiqTbody').innerHTML  = liquides.map(financierRow).join('')||empty(10);
  document.getElementById('actifSemiTbody').innerHTML = semiliquid.map(financierRow).join('')||empty(10);
  document.getElementById('actifImmTbody').innerHTML  = immobilier.map(immoRow).join('')||empty(10);
  document.getElementById('actifPhysTbody').innerHTML = physiques.map(physRow).join('')||empty(9);

  const totalA = state.actifs.filter(a=>a.category!=='physique').reduce((s,a)=>s+(a.valeur||0),0)
    + state.actifs.filter(a=>a.category==='physique').reduce((s,a)=>s+(a.valeur||0),0);
  const totalC = getTotalComptes();
  const totalP = state.passifs.reduce((s,p)=>s+(p.crd||0),0);
  const totalL = state.actifs.filter(a=>a.category==='immobilier').reduce((s,a)=>s+(a.loyer||0),0);

  document.getElementById('totalActifs').textContent  = fmt(totalA);
  document.getElementById('totalPassifs').textContent = fmt(totalP);
  document.getElementById('totalNet2').textContent    = fmt(totalA+totalC-totalP);
  document.getElementById('totalLoyers2').textContent = fmt(totalL)+'/mois';
  const cptEl = document.getElementById('totalComptesActifs');
  if (cptEl) cptEl.textContent = fmt(totalC);
}

