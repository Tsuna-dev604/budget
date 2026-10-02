// ═══════════════════════════════════════
//  PEA & CTO : comptes-titres, frais, fiscalité, portefeuille réel
//
//  Modèle à 2 niveaux :
//   - une POSITION (state.peaTitres[]) = un titre dans un compte : nom, ticker, devise,
//     TER, TTF, cours actuel, et la liste de ses ACHATS ;
//   - un ACHAT (position.achats[]) = {id, date, quantite, prix, frais, fxFraisPct}.
//  Le niveau 1 affiche quantité totale, PRU moyen, valeur et rendement de la position ;
//  un clic déroule le détail des achats (prix / dates différents), où l'on peut en ajouter.
// ═══════════════════════════════════════
let chartPeaTitres = null;
const TTF_RATE = 0.004; // Taxe sur les Transactions Financières (actions FR > 1 Md€ cap.)
let peaExpanded = new Set(); // positions dépliées (niveau 2)

function compteTypeLabel(t) {
  return {PEA:'PEA', 'PEA-PME':'PEA-PME', CTO:'CTO'}[t]||t;
}

// ── Accès tolérants (une ancienne ligne sans `achats` reste lisible avant migration) ──
function peaAchats(t) { return Array.isArray(t.achats) ? t.achats : []; }
function peaQte(t) {
  if (!Array.isArray(t.achats)) return t.quantite||0;
  return t.achats.reduce((s,a)=>s+(a.quantite||0),0);
}
function peaCoursActuel(t) {
  if (t.cours!==null && t.cours!==undefined) return t.cours;
  if (!Array.isArray(t.achats)) return t.prix||0;
  const dernier = [...t.achats].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  return dernier ? dernier.prix : 0; // sans cours renseigné : dernier prix d'achat
}
function fmtQte(q) { return String(Number((q||0).toFixed(4))); }

// Migration : anciennes lignes plates (une ligne = un achat) → positions regroupées par compte + ticker/nom.
function migratePeaPositions() {
  const list = state.peaTitres || [];
  if (!list.some(t=>!Array.isArray(t.achats))) return false;
  const positions = [], index = {};
  list.forEach(t=>{
    if (Array.isArray(t.achats)) { positions.push(t); return; }
    const key = (t.compteId||'')+'|'+((t.ticker||t.nom||'').trim().toUpperCase());
    const achat = {id:t.id, date:t.date||today(), quantite:t.quantite||0, prix:t.prix||0, frais:t.frais||0, fxFraisPct:t.fxFraisPct||0};
    let p = index[key];
    if (!p) {
      p = {id:t.id, compteId:t.compteId, nom:t.nom, ticker:t.ticker||'', devise:t.devise||'EUR', ter:t.ter||0, ttf:!!t.ttf,
           cours:(t.cours===undefined?null:t.cours), coursDate:t.coursDate||null, coursSource:t.coursSource||null, achats:[achat]};
      index[key] = p; positions.push(p);
    } else {
      p.achats.push(achat);
      if (t.ttf) p.ttf = true;
      if ((t.ter||0) > p.ter) p.ter = t.ter;
      if ((p.cours===null||p.cours===undefined) && t.cours!==null && t.cours!==undefined) { p.cours=t.cours; p.coursDate=t.coursDate||null; p.coursSource=t.coursSource||null; }
    }
  });
  state.peaTitres = positions;
  return true;
}

// ── Ancienneté & fiscalité PEA ──
function peaAncienneteAns(compteId) {
  const dates = [];
  state.peaTitres.filter(t=>t.compteId===compteId).forEach(t=>peaAchats(t).forEach(a=>{ if (a.date) dates.push(a.date); }));
  if (!dates.length) return 0;
  const firstDate = dates.reduce((min,d)=>d<min?d:min, dates[0]);
  return (new Date() - new Date(firstDate)) / (1000*60*60*24*365.25);
}
function getCompteFiscalInfo(compte) {
  if (!compte) return {rate:0.30, label:'—'};
  if (compte.type==='CTO') return {rate:0.30, label:'Flat Tax (PFU) 30% dès le 1er €'};
  // PEA / PEA-PME
  const anciennete = peaAncienneteAns(compte.id);
  if (anciennete>=5) return {rate:0.172, label:`PS 17,2% seul (PEA > 5 ans, ancienneté ${anciennete.toFixed(1)} ans)`};
  return {rate:0.30, label:`Flat Tax 30% (PEA < 5 ans, ancienneté ${anciennete.toFixed(1)} ans — clôture = perte des avantages)`};
}

function togglePcPlafondField() {
  const type = document.getElementById('pcType').value;
  document.getElementById('pcPlafondWrap').style.display = type==='CTO'?'none':'block';
  document.getElementById('pcPlafond').value = type==='PEA-PME'?225000:150000;
}

function populatePeaCompteSelect() {
  const sel = document.getElementById('ptCompteId');
  if (!sel) return;
  sel.innerHTML = state.peaComptes.map(c=>`<option value="${c.id}">${c.nom} (${compteTypeLabel(c.type)})</option>`).join('')
    || '<option value="">— Aucun compte —</option>';
}

function toggleFxFraisField() {
  const devise = document.getElementById('ptDevise').value;
  document.getElementById('ptFxFraisWrap').style.display = devise==='EUR'?'none':'block';
}

// ═══════════════════════════════════════
//  COMPTES PEA / CTO
// ═══════════════════════════════════════
function openAddPeaCompte() {
  document.getElementById('peaCompteModalTitle').textContent = 'Nouveau Compte';
  document.getElementById('pcEditId').value = '';
  document.getElementById('pcType').value = 'PEA';
  document.getElementById('pcNom').value = '';
  document.getElementById('pcBanque').value = '';
  document.getElementById('pcPlafond').value = '150000';
  document.getElementById('pcCourtagePct').value = '0.5';
  document.getElementById('pcGardePct').value = '0';
  document.getElementById('pcDeleteBtn').style.display = 'none';
  togglePcPlafondField();
  openModal('modalPeaCompte');
}
function openEditPeaCompte(id) {
  const c = state.peaComptes.find(x=>x.id===id);
  if (!c) return;
  document.getElementById('peaCompteModalTitle').textContent = 'Modifier le compte';
  document.getElementById('pcEditId').value = c.id;
  document.getElementById('pcType').value = c.type||'PEA';
  document.getElementById('pcNom').value = c.nom;
  document.getElementById('pcBanque').value = c.banque||'';
  document.getElementById('pcPlafond').value = c.plafond||150000;
  document.getElementById('pcCourtagePct').value = c.courtagePct!==undefined?c.courtagePct:0.5;
  document.getElementById('pcGardePct').value = c.gardePct!==undefined?c.gardePct:0;
  document.getElementById('pcDeleteBtn').style.display = 'inline-block';
  togglePcPlafondField();
  document.getElementById('pcPlafond').value = c.plafond||150000;
  openModal('modalPeaCompte');
}
function savePeaCompte() {
  const editId  = document.getElementById('pcEditId').value;
  const type    = document.getElementById('pcType').value;
  const nom     = document.getElementById('pcNom').value.trim();
  const banque  = document.getElementById('pcBanque').value.trim();
  const plafond = type==='CTO' ? 0 : (parseFloat(document.getElementById('pcPlafond').value)||150000);
  const courtagePct = parseFloat(document.getElementById('pcCourtagePct').value)||0;
  const gardePct = parseFloat(document.getElementById('pcGardePct').value)||0;
  if (!nom){notify('Nom du compte requis',true);return;}
  if (editId) {
    const c = state.peaComptes.find(x=>x.id===editId);
    if (c) Object.assign(c,{type,nom,banque,plafond,courtagePct,gardePct});
  } else {
    state.peaComptes.push({id:uid(),type,nom,banque,plafond,courtagePct,gardePct});
  }
  closeModal('modalPeaCompte');
  notify(editId?'Compte modifié':'Compte ajouté');
  renderAll();
}
function deletePeaCompte() {
  const id = document.getElementById('pcEditId').value;
  if (!id) return;
  if (!confirm('Supprimer ce compte et toutes ses positions ?')) return;
  state.peaComptes = state.peaComptes.filter(c=>c.id!==id);
  state.peaTitres  = state.peaTitres.filter(t=>t.compteId!==id);
  closeModal('modalPeaCompte');
  notify('Compte supprimé');
  renderAll();
}

// ═══════════════════════════════════════
//  POSITIONS (niveau 1)
// ═══════════════════════════════════════
function openAddPeaTitre(compteId) {
  if (!state.peaComptes.length) {
    notify('Créez d\'abord un compte PEA ou CTO',true);
    openAddPeaCompte();
    return;
  }
  document.getElementById('peaTitreModalTitle').textContent = 'Nouvelle position';
  document.getElementById('ptEditId').value = '';
  populatePeaCompteSelect();
  if (compteId) document.getElementById('ptCompteId').value = compteId;
  ['ptNom','ptTicker','ptQte','ptPrix','ptCours'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ptFrais').value = '0';
  document.getElementById('ptFxFrais').value = '0.25';
  document.getElementById('ptTer').value = '0';
  document.getElementById('ptTtf').checked = false;
  document.getElementById('ptDevise').value = 'EUR';
  document.getElementById('ptDate').value = today();
  document.getElementById('ptCoursMeta').textContent = '';
  document.getElementById('ptAchatFields').style.display = 'block'; // 1er achat saisi avec la position
  toggleFxFraisField();
  openModal('modalPeaTitre');
}
function openEditPeaTitre(id) {
  const t = state.peaTitres.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('peaTitreModalTitle').textContent = 'Modifier la position';
  document.getElementById('ptEditId').value = t.id;
  populatePeaCompteSelect();
  document.getElementById('ptCompteId').value = t.compteId||'';
  document.getElementById('ptNom').value = t.nom;
  document.getElementById('ptTicker').value = t.ticker||'';
  document.getElementById('ptDevise').value = t.devise||'EUR';
  document.getElementById('ptTer').value = t.ter||0;
  document.getElementById('ptTtf').checked = !!t.ttf;
  document.getElementById('ptCours').value = (t.cours===null||t.cours===undefined)?'':t.cours;
  document.getElementById('ptCoursMeta').textContent = t.coursDate ? `Dernière MàJ cours : ${t.coursDate}${t.coursSource?' · '+t.coursSource:''}` : '';
  document.getElementById('ptAchatFields').style.display = 'none'; // les achats se gèrent dans le détail de la position
  toggleFxFraisField();
  openModal('modalPeaTitre');
}
function savePeaTitre() {
  const editId   = document.getElementById('ptEditId').value;
  const compteId = document.getElementById('ptCompteId').value;
  const nom      = document.getElementById('ptNom').value.trim();
  const ticker   = document.getElementById('ptTicker').value.trim().toUpperCase();
  const devise   = document.getElementById('ptDevise').value;
  const ter      = parseFloat(document.getElementById('ptTer').value)||0;
  const ttf      = document.getElementById('ptTtf').checked;
  const coursRaw = document.getElementById('ptCours').value;
  const cours    = coursRaw!=='' ? parseFloat(coursRaw) : null;
  if (!compteId){notify('Sélectionnez un compte',true);return;}
  if (!nom){notify('Nom du titre requis',true);return;}

  if (editId) {
    const t = state.peaTitres.find(x=>x.id===editId);
    if (t) Object.assign(t,{compteId,nom,ticker,devise,ter,ttf,cours});
  } else {
    const quantite = parseFloat(document.getElementById('ptQte').value)||0;
    const prix     = parseFloat(document.getElementById('ptPrix').value)||0;
    if (quantite<=0||prix<=0){notify('Quantité et prix d\'achat requis',true);return;}
    const pos = {id:uid(), compteId, nom, ticker, devise, ter, ttf, cours, coursDate:null, coursSource:null, achats:[{
      id:uid(), date:document.getElementById('ptDate').value||today(), quantite, prix,
      frais:parseFloat(document.getElementById('ptFrais').value)||0,
      fxFraisPct:parseFloat(document.getElementById('ptFxFrais').value)||0
    }]};
    state.peaTitres.push(pos);
    peaExpanded.add(pos.id);
  }
  closeModal('modalPeaTitre');
  notify(editId?'Position modifiée':'Position ajoutée');
  renderAll();
}
function deletePeaTitre(id) {
  if (!confirm('Supprimer cette position et tous ses achats ?')) return;
  state.peaTitres = state.peaTitres.filter(t=>t.id!==id);
  peaExpanded.delete(id);
  renderAll();
}
function togglePeaPosition(id) {
  if (peaExpanded.has(id)) peaExpanded.delete(id); else peaExpanded.add(id);
  renderPeaComptesList();
}

// ═══════════════════════════════════════
//  ACHATS (niveau 2)
// ═══════════════════════════════════════
function openAddPeaAchat(posId) {
  const t = state.peaTitres.find(x=>x.id===posId);
  if (!t) return;
  document.getElementById('peaAchatModalTitle').textContent = 'Nouvel achat';
  document.getElementById('paTitreId').value = posId;
  document.getElementById('paEditId').value = '';
  document.getElementById('paTitreLabel').textContent = t.nom + (t.ticker?` · ${t.ticker}`:'');
  document.getElementById('paDate').value = today();
  document.getElementById('paQte').value = '';
  const c = peaCoursActuel(t);
  document.getElementById('paPrix').value = c>0 ? c : ''; // pré-rempli avec le cours connu, modifiable
  document.getElementById('paFrais').value = '0';
  document.getElementById('paFxFrais').value = '0.25';
  document.getElementById('paFxWrap').style.display = (t.devise && t.devise!=='EUR') ? 'block' : 'none';
  document.getElementById('paDeleteBtn').style.display = 'none';
  openModal('modalPeaAchat');
}
function openEditPeaAchat(posId, achatId) {
  const t = state.peaTitres.find(x=>x.id===posId);
  const a = t && peaAchats(t).find(x=>x.id===achatId);
  if (!a) return;
  document.getElementById('peaAchatModalTitle').textContent = 'Modifier l\'achat';
  document.getElementById('paTitreId').value = posId;
  document.getElementById('paEditId').value = achatId;
  document.getElementById('paTitreLabel').textContent = t.nom + (t.ticker?` · ${t.ticker}`:'');
  document.getElementById('paDate').value = a.date||today();
  document.getElementById('paQte').value = a.quantite;
  document.getElementById('paPrix').value = a.prix;
  document.getElementById('paFrais').value = a.frais||0;
  document.getElementById('paFxFrais').value = a.fxFraisPct!==undefined ? a.fxFraisPct : 0.25;
  document.getElementById('paFxWrap').style.display = (t.devise && t.devise!=='EUR') ? 'block' : 'none';
  document.getElementById('paDeleteBtn').style.display = 'inline-block';
  openModal('modalPeaAchat');
}
function savePeaAchat() {
  const posId   = document.getElementById('paTitreId').value;
  const editId  = document.getElementById('paEditId').value;
  const t = state.peaTitres.find(x=>x.id===posId);
  if (!t) return;
  const quantite = parseFloat(document.getElementById('paQte').value)||0;
  const prix     = parseFloat(document.getElementById('paPrix').value)||0;
  if (quantite<=0||prix<=0){notify('Quantité et prix d\'achat requis',true);return;}
  const achat = {
    id: editId||uid(),
    date: document.getElementById('paDate').value||today(),
    quantite, prix,
    frais: parseFloat(document.getElementById('paFrais').value)||0,
    fxFraisPct: parseFloat(document.getElementById('paFxFrais').value)||0
  };
  if (!Array.isArray(t.achats)) t.achats = [];
  if (editId) {
    const idx = t.achats.findIndex(x=>x.id===editId);
    if (idx>=0) t.achats[idx] = achat;
  } else {
    t.achats.push(achat);
  }
  peaExpanded.add(posId);
  closeModal('modalPeaAchat');
  notify(editId?'Achat modifié':'Achat ajouté');
  renderAll();
}
function deletePeaAchat(posId, achatId) {
  const t = state.peaTitres.find(x=>x.id===posId);
  if (!t) return;
  const dernier = peaAchats(t).length<=1;
  if (!confirm(dernier ? 'C\'est le dernier achat : la position sera supprimée. Continuer ?' : 'Supprimer cet achat ?')) return;
  t.achats = peaAchats(t).filter(a=>a.id!==achatId);
  if (!t.achats.length) { state.peaTitres = state.peaTitres.filter(x=>x.id!==posId); peaExpanded.delete(posId); }
  closeModal('modalPeaAchat');
  renderAll();
}

// ═══════════════════════════════════════
//  CALCULS : coût d'un achat, agrégat d'une position
// ═══════════════════════════════════════
function peaAchatCout(t, a) {
  const brut = (a.quantite||0)*(a.prix||0);
  const fx = (t.devise && t.devise!=='EUR') ? brut*((a.fxFraisPct||0)/100) : 0;
  const ttf = t.ttf ? brut*TTF_RATE : 0;
  const courtage = a.frais||0;
  return {brut, fx, ttf, courtage, frais:courtage+fx+ttf, investi:brut+courtage+fx+ttf};
}
function peaPositionRow(t) {
  const compte = state.peaComptes.find(c=>c.id===t.compteId);
  const coursActuel = peaCoursActuel(t);
  const achats = [...peaAchats(t)].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(a=>{
    const c = peaAchatCout(t,a);
    const valeur = a.quantite*coursActuel;
    const pv = valeur - c.investi;
    return {a, ...c, valeur, pv, pvPct:c.investi>0?pv/c.investi*100:0};
  });
  const sum = k => achats.reduce((s,x)=>s+x[k],0);
  const quantite = achats.reduce((s,x)=>s+x.a.quantite,0);
  const montantBrut = sum('brut'), investi = sum('investi');
  const fxFrais = sum('fx'), ttfFrais = sum('ttf'), fraisCourtage = sum('courtage'), totalFrais = sum('frais');
  const valeur = quantite*coursActuel;
  const pv = valeur - investi;
  const pvPct = investi>0 ? pv/investi*100 : 0;
  const fiscal = getCompteFiscalInfo(compte);
  const impotEstime = Math.max(0,pv)*fiscal.rate;
  return {t, compte, achats, quantite, montantBrut, fxFrais, ttfFrais, fraisCourtage, totalFrais, investi,
    pruBrut: quantite>0?montantBrut/quantite:0, pruNet: quantite>0?investi/quantite:0,
    coursActuel, valeur, terAnnuel:valeur*((t.ter||0)/100), pv, pvPct, fiscal, impotEstime,
    pvNetteFiscale: pv - (pv>0?impotEstime:0)};
}

// ═══════════════════════════════════════
//  RENDU
// ═══════════════════════════════════════
function renderPeaAchatsDetail(r) {
  const t = r.t;
  const mono = 'font-family:var(--font-mono)';
  const lignes = r.achats.map(x=>`
    <tr>
      <td>${x.a.date||'—'}</td>
      <td style="${mono}">${fmtQte(x.a.quantite)}</td>
      <td style="${mono}">${fmt(x.a.prix)}</td>
      <td style="${mono};color:var(--red)">${fmt(x.courtage)}</td>
      <td style="${mono};color:var(--red)">${t.devise!=='EUR'?fmt(x.fx):'—'}</td>
      <td style="${mono};color:var(--red)">${t.ttf?fmt(x.ttf):'—'}</td>
      <td class="gold">${fmt(x.investi)}</td>
      <td class="blue">${fmt(x.valeur)}</td>
      <td class="${x.pv>=0?'green':'red'}">${x.pv>=0?'+':''}${fmt(x.pv)}</td>
      <td class="${x.pvPct>=0?'green':'red'}">${x.pvPct>=0?'+':''}${fmtPct(x.pvPct,1)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openEditPeaAchat('${t.id}','${x.a.id}')" title="Modifier l'achat">✎</button>
        <button class="icon-btn del" onclick="deletePeaAchat('${t.id}','${x.a.id}')" title="Supprimer l'achat">✕</button>
      </div></td>
    </tr>`).join('');
  return `<tr><td colspan="13" style="padding:4px 12px 14px;background:transparent">
    <div style="background:var(--bg4);border-radius:8px;padding:12px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span class="card-title">Achats — ${t.nom} (${r.achats.length})</span>
        <button class="btn btn-gold" style="padding:6px 12px;font-size:10px" onclick="openAddPeaAchat('${t.id}')">+ Achat</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Qté</th><th>Prix</th><th>Courtage</th><th>Change</th><th>TTF</th><th>Investi</th><th>Valeur</th><th>+/−</th><th>%</th><th></th></tr></thead>
        <tbody>${lignes}</tbody>
      </table></div>
    </div>
  </td></tr>`;
}

function renderPeaComptesList() {
  const container = document.getElementById('peaComptesList');
  if (!state.peaComptes.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--font-mono)">Aucun compte. Cliquez sur "+ Ajouter un compte" pour commencer.</div>';
    return;
  }
  container.innerHTML = state.peaComptes.map(c=>{
    const rows = state.peaTitres.filter(t=>t.compteId===c.id).map(peaPositionRow).sort((a,b)=>b.valeur-a.valeur);
    const investi = rows.reduce((s,r)=>s+r.investi,0);
    const valeur  = rows.reduce((s,r)=>s+r.valeur,0);
    const pv      = valeur-investi;
    const pvPct   = investi>0?(pv/investi*100):0;
    const plafondPct = c.plafond>0?Math.min(100,investi/c.plafond*100):0;
    const terAnnuelTotal = rows.reduce((s,r)=>s+r.terAnnuel,0);
    const mono = 'font-family:var(--font-mono)';
    const body = rows.length ? rows.map(r=>{
      const open = peaExpanded.has(r.t.id);
      return `
      <tr style="cursor:pointer" onclick="togglePeaPosition('${r.t.id}')" title="Cliquer pour voir / ajouter des achats">
        <td style="width:22px;color:var(--text3)">${open?'▾':'▸'}</td>
        <td class="highlight">${r.t.nom}<div style="font-family:var(--font-mono);font-size:9px;color:var(--text3)">${r.t.ticker?r.t.ticker+' · ':''}${r.t.devise!=='EUR'?r.t.devise+' · ':''}${r.achats.length} achat${r.achats.length>1?'s':''}</div></td>
        <td style="${mono}">${fmtQte(r.quantite)}</td>
        <td style="${mono}">${fmt(r.pruBrut)}</td>
        <td style="${mono};color:var(--gold)" title="Courtage ${fmt(r.fraisCourtage)} + Change ${fmt(r.fxFrais)} + TTF ${fmt(r.ttfFrais)}">${fmt(r.pruNet)}</td>
        <td style="${mono};color:var(--red)">${fmt(r.totalFrais)}</td>
        <td class="gold">${fmt(r.investi)}</td>
        <td style="${mono}">${fmt(r.coursActuel)}</td>
        <td class="blue">${fmt(r.valeur)}</td>
        <td class="${r.pv>=0?'green':'red'}">${r.pv>=0?'+':''}${fmt(r.pv)}</td>
        <td class="${r.pvPct>=0?'green':'red'}">${r.pvPct>=0?'+':''}${fmtPct(r.pvPct,1)}</td>
        <td style="${mono};color:var(--red)">${r.pv>0?'−'+fmt(r.impotEstime):'—'}</td>
        <td><div class="row-actions">
          <button class="icon-btn" onclick="event.stopPropagation();fetchPeaTitreCours('${r.t.id}')" title="Actualiser le cours (API)">🔄</button>
          <button class="icon-btn" onclick="event.stopPropagation();openAddPeaAchat('${r.t.id}')" title="Ajouter un achat">＋</button>
          <button class="icon-btn" onclick="event.stopPropagation();openEditPeaTitre('${r.t.id}')" title="Modifier la position / le cours">✎</button>
          <button class="icon-btn del" onclick="event.stopPropagation();deletePeaTitre('${r.t.id}')" title="Supprimer la position">✕</button>
        </div></td>
      </tr>${open?renderPeaAchatsDetail(r):''}`;
    }).join('') : '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:16px">Aucune position dans ce compte</td></tr>';

    return `<div class="immo-card">
      <div class="immo-card-header">
        <div>
          <div class="immo-prop-title">💼 ${c.nom} <span class="badge ${c.type==='CTO'?'badge-blue':'badge-gold'}" style="margin-left:6px">${compteTypeLabel(c.type)}</span></div>
          ${c.banque?`<div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-top:4px">🏦 ${c.banque} · Courtage ${fmtPct(c.courtagePct||0)} · Garde ${fmtPct(c.gardePct||0)}/an</div>`:''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn" style="padding:6px 12px;font-size:10px" onclick="openAddPeaTitre('${c.id}')">+ Position</button>
          <button class="icon-btn" onclick="openEditPeaCompte('${c.id}')">✎</button>
          <button class="icon-btn del" onclick="openEditPeaCompte('${c.id}');deletePeaCompte()">✕</button>
        </div>
      </div>
      <div class="immo-metrics" style="grid-template-columns:repeat(5,1fr)">
        <div class="immo-metric"><div class="immo-metric-label">Investi</div><div class="immo-metric-val" style="color:var(--gold)">${fmt(investi)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Valeur</div><div class="immo-metric-val" style="color:var(--blue)">${fmt(valeur)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">+/−</div><div class="immo-metric-val" style="color:${pv>=0?'var(--green)':'var(--red)'}">${pv>=0?'+':''}${fmt(pv)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">Perf.</div><div class="immo-metric-val" style="color:${pvPct>=0?'var(--green)':'var(--red)'}">${pvPct>=0?'+':''}${fmtPct(pvPct,1)}</div></div>
        <div class="immo-metric"><div class="immo-metric-label">TER annuel est.</div><div class="immo-metric-val" style="color:var(--red)">−${fmt(terAnnuelTotal)}</div></div>
      </div>
      ${c.plafond?`<div style="margin-bottom:10px">
        <div class="fire-label"><span>Plafond de versement</span><span>${fmt(investi)} / ${fmt(c.plafond)}</span></div>
        <div class="fire-bar-wrap"><div class="fire-bar" style="width:${plafondPct}%"></div></div>
      </div>`:''}
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>Titre</th><th>Qté</th><th>PRU brut</th><th>PRU net</th><th>Frais totaux</th><th>Investi</th><th>Cours actuel</th><th>Valeur</th><th>+/−</th><th>%</th><th>Impôt est.</th><th></th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function renderPeaPortefeuille() {
  const rows = (state.peaTitres||[]).map(peaPositionRow);
  const totalInvesti = rows.reduce((s,r)=>s+r.investi,0);
  const totalValeur  = rows.reduce((s,r)=>s+r.valeur,0);

  document.getElementById('pkpi-investi').textContent = fmt(totalInvesti);
  document.getElementById('pkpi-valeur').textContent  = fmt(totalValeur);
  const pvTotal = totalValeur-totalInvesti;
  const pvEl = document.getElementById('pkpi-pv');
  pvEl.textContent = (pvTotal>=0?'+':'')+fmt(pvTotal);
  pvEl.className = 'card-value '+(pvTotal>=0?'green':'red');
  const perfEl = document.getElementById('pkpi-perf');
  const perfPct = totalInvesti>0?(pvTotal/totalInvesti*100):0;
  perfEl.textContent = (perfPct>=0?'+':'')+fmtPct(perfPct,1);
  perfEl.className = 'card-value '+(perfPct>=0?'green':'red');

  // Un instantané par jour de la valeur totale du portefeuille — base de l'historique.
  recordPrice('__pea_portefeuille__', totalValeur, today());

  // Donut allocation par position (tous comptes confondus)
  if (chartPeaTitres){chartPeaTitres.destroy();chartPeaTitres=null;}
  const ctx = document.getElementById('chartPeaTitres');
  const palette = ['#c9a84c','#4caf78','#4c8fc9','#9b59b6','#e8c97a','#c94c4c','#6ba3d6','#e74c3c','#16a085','#f39c12'];
  if (ctx && rows.length) {
    chartPeaTitres = new Chart(ctx.getContext('2d'),{
      type:'doughnut',
      data:{labels:rows.map(r=>r.t.nom),datasets:[{data:rows.map(r=>r.valeur),backgroundColor:rows.map((_,i)=>palette[i%palette.length]),borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)}`}}},cutout:'62%'}
    });
  }
  document.getElementById('peaTitresList').innerHTML = rows.length ? rows.map((r,i)=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:${palette[i%palette.length]}"></span>${r.t.nom}</div>
      <div style="font-family:var(--font-mono);font-size:12px">${fmtPct(totalValeur>0?r.valeur/totalValeur*100:0,0)} <span style="color:var(--text3);margin-left:8px">${fmt(r.valeur)}</span></div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Aucune position</div>';

  document.getElementById('peaTitresBreakdown').innerHTML = rows.length ? rows.map(r=>`
    <div class="alloc-row">
      <div>
        <div style="color:var(--text)">${r.t.nom}</div>
        <div style="color:var(--text3);font-family:var(--font-mono);font-size:10px">${fmtQte(r.quantite)} × ${fmt(r.coursActuel)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--font-mono);color:${r.pv>=0?'var(--green)':'var(--red)'}">${r.pv>=0?'+':''}${fmt(r.pv)}</div>
        <div style="font-family:var(--font-mono);font-size:10px;color:${r.pvPct>=0?'var(--green)':'var(--red)'}">${r.pvPct>=0?'+':''}${fmtPct(r.pvPct,1)}</div>
      </div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Aucune position pour le moment</div>';

  renderPeaComptesList();
  renderInvAv();
  renderPeaHistorique();
}

// ── Sous-onglets de la page Investissements ──
function showInvTab(id, el) {
  showSubTab('simu_pea', id, el);
}

// ── Assurance-vie, PEL, crypto & autres investissements non cotés ──
// Ces lignes vivent dans state.actifs (catégorie 'semiliquide') : affichées ici aussi, sans duplication.
function renderInvAv() {
  const tbody = document.getElementById('invAvTbody');
  if (!tbody) return;
  const items = state.actifs.filter(a=>a.category==='semiliquide');
  tbody.innerHTML = items.length ? items.map(a=>{
    const rNet = taxNet(a.taux||0, a.fiscal||'exonere');
    return `<tr>
      <td class="highlight">${a.label}</td>
      <td class="gold">${fmt(a.valeur)}</td>
      <td style="color:var(--green);font-family:var(--font-mono)">${a.mensuel>0?'+'+fmt(a.mensuel)+'/m':'—'}</td>
      <td>${fmtPct(a.taux||0)}</td>
      <td>${fiscalLabel(a.fiscal||'exonere')}</td>
      <td class="green">${fmtPct(rNet)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">Aucune ligne — ajoutez une assurance-vie, un PEL ou un autre investissement depuis Patrimoine</td></tr>';
}

// ── Historique de la valeur du portefeuille PEA/CTO ──
function renderPeaHistorique() {
  const wrap = document.getElementById('peaHistoWrap');
  if (!wrap) return;
  const hist = (state.priceHistory||[]).filter(p=>p.id==='__pea_portefeuille__').sort((a,b)=>a.date.localeCompare(b.date));
  if (hist.length < 2) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">▤</div>
        <div class="empty-state-title">L'historique se construit</div>
        <div class="empty-state-text">Chaque ouverture de cette page enregistre la valeur du jour de votre portefeuille. Revenez régulièrement pour suivre son évolution réelle.</div>
      </div>`;
    return;
  }
  const ordered = [...hist].reverse(); // plus récent en premier
  const rows = ordered.map((p,i)=>{
    const prev = ordered[i+1];
    const variation = prev ? p.valeur - prev.valeur : null;
    return `<tr>
      <td>${new Date(p.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td class="blue">${fmt(p.valeur)}</td>
      <td class="${variation===null?'':(variation>=0?'green':'red')}">${variation===null?'—':(variation>=0?'+':'')+fmt(variation)}</td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `
    <div class="table-wrap" style="max-height:420px;overflow-y:auto">
      <table>
        <thead><tr><th>Date</th><th>Valeur du portefeuille</th><th>Variation</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
