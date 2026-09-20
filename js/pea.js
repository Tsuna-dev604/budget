// ═══════════════════════════════════════
//  PEA & CTO : comptes-titres, frais, fiscalité, portefeuille réel
// ═══════════════════════════════════════
let chartPeaTitres = null;
const TTF_RATE = 0.004; // Taxe sur les Transactions Financières (actions FR > 1 Md€ cap.)

function compteTypeLabel(t) {
  return {PEA:'PEA', 'PEA-PME':'PEA-PME', CTO:'CTO'}[t]||t;
}

// ── Ancienneté & fiscalité PEA ──
function peaAncienneteAns(compteId) {
  const titres = state.peaTitres.filter(t=>t.compteId===compteId);
  if (!titres.length) return 0;
  const firstDate = titres.reduce((min,t)=>t.date<min?t.date:min, titres[0].date);
  const diffMs = new Date() - new Date(firstDate);
  return diffMs / (1000*60*60*24*365.25);
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
  const note = document.getElementById('pcFiscalNote');
  note.textContent = type==='CTO'
    ? 'CTO : pas de plafond de versement. Flat Tax (PFU) 30% sur plus-values et dividendes dès le 1er euro (option barème progressif possible en déclaration de revenus).'
    : 'PEA : exonération d\'impôt sur le revenu après 5 ans de détention (seuls les 17,2% de prélèvements sociaux restent dus). Retrait avant 5 ans = clôture du plan + Flat Tax 30%.';
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
  renderPeaPortefeuille();
}
function deletePeaCompte() {
  const id = document.getElementById('pcEditId').value;
  if (!id) return;
  if (!confirm('Supprimer ce compte et toutes ses lignes ?')) return;
  state.peaComptes = state.peaComptes.filter(c=>c.id!==id);
  state.peaTitres  = state.peaTitres.filter(t=>t.compteId!==id);
  closeModal('modalPeaCompte');
  notify('Compte supprimé');
  renderPeaPortefeuille();
}

function openAddPeaTitre(compteId) {
  if (!state.peaComptes.length) {
    notify('Créez d\'abord un compte PEA ou CTO',true);
    openAddPeaCompte();
    return;
  }
  document.getElementById('peaTitreModalTitle').textContent = 'Nouvelle Ligne';
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
  toggleFxFraisField();
  openModal('modalPeaTitre');
}
function openEditPeaTitre(id) {
  const t = state.peaTitres.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('peaTitreModalTitle').textContent = 'Modifier la ligne';
  document.getElementById('ptEditId').value = t.id;
  populatePeaCompteSelect();
  document.getElementById('ptCompteId').value = t.compteId||'';
  document.getElementById('ptNom').value = t.nom;
  document.getElementById('ptTicker').value = t.ticker||'';
  document.getElementById('ptDate').value = t.date;
  document.getElementById('ptQte').value = t.quantite;
  document.getElementById('ptPrix').value = t.prix;
  document.getElementById('ptDevise').value = t.devise||'EUR';
  document.getElementById('ptFrais').value = t.frais||0;
  document.getElementById('ptFxFrais').value = t.fxFraisPct!==undefined?t.fxFraisPct:0.25;
  document.getElementById('ptTer').value = t.ter||0;
  document.getElementById('ptTtf').checked = !!t.ttf;
  document.getElementById('ptCours').value = (t.cours===null||t.cours===undefined)?'':t.cours;
  document.getElementById('ptCoursMeta').textContent = t.coursDate ? `Dernière MàJ cours : ${t.coursDate}${t.coursSource?' · '+t.coursSource:''}` : '';
  toggleFxFraisField();
  openModal('modalPeaTitre');
}
function savePeaTitre() {
  const editId    = document.getElementById('ptEditId').value;
  const compteId  = document.getElementById('ptCompteId').value;
  const nom       = document.getElementById('ptNom').value.trim();
  const ticker    = document.getElementById('ptTicker').value.trim().toUpperCase();
  const date      = document.getElementById('ptDate').value || today();
  const quantite  = parseFloat(document.getElementById('ptQte').value)||0;
  const prix      = parseFloat(document.getElementById('ptPrix').value)||0;
  const devise    = document.getElementById('ptDevise').value;
  const frais     = parseFloat(document.getElementById('ptFrais').value)||0;
  const fxFraisPct= parseFloat(document.getElementById('ptFxFrais').value)||0;
  const ter       = parseFloat(document.getElementById('ptTer').value)||0;
  const ttf       = document.getElementById('ptTtf').checked;
  const coursRaw  = document.getElementById('ptCours').value;
  const cours     = coursRaw!==''?parseFloat(coursRaw):null;
  if (!compteId){notify('Sélectionnez un compte',true);return;}
  if (!nom||quantite<=0||prix<=0){notify('Nom, quantité et prix d\'achat requis',true);return;}
  const existing = editId ? state.peaTitres.find(x=>x.id===editId) : null;
  const titre = {id:editId||uid(), compteId, nom, ticker, date, quantite, prix, devise, frais, fxFraisPct, ter, ttf, cours,
    coursDate: existing?existing.coursDate:null, coursSource: existing?existing.coursSource:null};
  if (editId) {
    const idx = state.peaTitres.findIndex(x=>x.id===editId);
    if (idx>=0) state.peaTitres[idx] = titre;
  } else {
    state.peaTitres.push(titre);
  }
  closeModal('modalPeaTitre');
  notify(editId?'Ligne modifiée':'Ligne ajoutée');
  renderPeaPortefeuille();
}
function deletePeaTitre(id) {
  if (!confirm('Supprimer cette ligne ?')) return;
  state.peaTitres = state.peaTitres.filter(t=>t.id!==id);
  renderPeaPortefeuille();
}

// ── Calcul frais & PRU net/brut ──
function peaTitreRow(t) {
  const compte = state.peaComptes.find(c=>c.id===t.compteId);
  const montantBrut = t.quantite*t.prix;
  const fxFrais = (t.devise && t.devise!=='EUR') ? montantBrut*((t.fxFraisPct||0)/100) : 0;
  const ttfFrais = t.ttf ? montantBrut*TTF_RATE : 0;
  const fraisCourtage = t.frais||0;
  const totalFrais = fraisCourtage + fxFrais + ttfFrais;
  const investi = montantBrut + totalFrais;
  const pruBrut = t.quantite>0 ? t.prix : 0;
  const pruNet  = t.quantite>0 ? investi/t.quantite : 0;
  const coursActuel = (t.cours!==null && t.cours!==undefined) ? t.cours : t.prix;
  const valeurBrute = t.quantite*coursActuel;
  const terAnnuel = valeurBrute*((t.ter||0)/100);
  const pv = valeurBrute-investi;
  const pvPct = investi>0?(pv/investi*100):0;
  const fiscal = getCompteFiscalInfo(compte);
  const gainImposable = Math.max(0,pv);
  const impotEstime = gainImposable*fiscal.rate;
  const pvNetteFiscale = pv - (pv>0?impotEstime:0);
  return {t,compte,montantBrut,fxFrais,ttfFrais,fraisCourtage,totalFrais,investi,pruBrut,pruNet,coursActuel,
    valeur:valeurBrute,terAnnuel,pv,pvPct,fiscal,impotEstime,pvNetteFiscale};
}

function renderPeaComptesList() {
  const container = document.getElementById('peaComptesList');
  if (!state.peaComptes.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);font-family:var(--font-mono)">Aucun compte. Cliquez sur "+ Ajouter un compte" pour commencer.</div>';
    return;
  }
  container.innerHTML = state.peaComptes.map(c=>{
    const titres = state.peaTitres.filter(t=>t.compteId===c.id);
    const rows = titres.map(peaTitreRow);
    const investi = rows.reduce((s,r)=>s+r.investi,0);
    const valeur  = rows.reduce((s,r)=>s+r.valeur,0);
    const pv      = valeur-investi;
    const pvPct   = investi>0?(pv/investi*100):0;
    const plafondPct = c.plafond>0?Math.min(100,investi/c.plafond*100):0;
    const fiscalInfo = getCompteFiscalInfo(c);
    const terAnnuelTotal = rows.reduce((s,r)=>s+r.terAnnuel,0);
    return `<div class="immo-card">
      <div class="immo-card-header">
        <div>
          <div class="immo-prop-title">💼 ${c.nom} <span class="badge ${c.type==='CTO'?'badge-blue':'badge-gold'}" style="margin-left:6px">${compteTypeLabel(c.type)}</span></div>
          ${c.banque?`<div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-top:4px">🏦 ${c.banque} · Courtage ${fmtPct(c.courtagePct||0)} · Garde ${fmtPct(c.gardePct||0)}/an</div>`:''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn" style="padding:6px 12px;font-size:10px" onclick="openAddPeaTitre('${c.id}')">+ Ligne</button>
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
      <div class="info-note" style="margin-bottom:14px">🏛 Fiscalité applicable en cas de retrait : <strong>${fiscalInfo.label}</strong></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Titre</th><th>Date achat</th><th>Qté</th><th>PRU brut</th><th>PRU net</th><th>Frais totaux</th><th>Investi</th><th>Cours actuel</th><th>Valeur</th><th>+/−</th><th>%</th><th>Impôt est.</th><th></th></tr></thead>
          <tbody>
          ${rows.length ? [...rows].sort((a,b)=>b.t.date.localeCompare(a.t.date)).map(r=>`
            <tr>
              <td class="highlight">${r.t.nom}${r.t.ticker?`<div style="font-family:var(--font-mono);font-size:9px;color:var(--text3)">${r.t.ticker}${r.t.devise!=='EUR'?' · '+r.t.devise:''}</div>`:''}</td>
              <td>${r.t.date}</td>
              <td style="font-family:var(--font-mono)">${r.t.quantite}</td>
              <td style="font-family:var(--font-mono)">${fmt(r.pruBrut)}</td>
              <td style="font-family:var(--font-mono);color:var(--gold)" title="Courtage ${fmt(r.fraisCourtage)} + Change ${fmt(r.fxFrais)} + TTF ${fmt(r.ttfFrais)}">${fmt(r.pruNet)}</td>
              <td style="font-family:var(--font-mono);color:var(--red)">${fmt(r.totalFrais)}</td>
              <td class="gold">${fmt(r.investi)}</td>
              <td style="font-family:var(--font-mono)">${fmt(r.coursActuel)}</td>
              <td class="blue">${fmt(r.valeur)}</td>
              <td class="${r.pv>=0?'green':'red'}">${r.pv>=0?'+':''}${fmt(r.pv)}</td>
              <td class="${r.pvPct>=0?'green':'red'}">${r.pvPct>=0?'+':''}${fmtPct(r.pvPct,1)}</td>
              <td style="font-family:var(--font-mono);color:var(--red)">${r.pv>0?'−'+fmt(r.impotEstime):'—'}</td>
              <td><div class="row-actions">
                <button class="icon-btn" onclick="fetchPeaTitreCours('${r.t.id}')" title="Actualiser le cours (API)">🔄</button>
                <button class="icon-btn" onclick="openEditPeaTitre('${r.t.id}')" title="Modifier / mettre à jour le cours">✎</button>
                <button class="icon-btn del" onclick="deletePeaTitre('${r.t.id}')">✕</button>
              </div></td>
            </tr>`).join('') : '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:16px">Aucune ligne dans ce compte</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function renderPeaPortefeuille() {
  const rows = (state.peaTitres||[]).map(peaTitreRow);
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

  // Donut allocation par ligne (tous comptes confondus)
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
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Aucune ligne</div>';

  document.getElementById('peaTitresBreakdown').innerHTML = rows.length ? rows.map(r=>`
    <div class="alloc-row">
      <div>
        <div style="color:var(--text)">${r.t.nom}</div>
        <div style="color:var(--text3);font-family:var(--font-mono);font-size:10px">${r.t.quantite} × ${fmt(r.coursActuel)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--font-mono);color:${r.pv>=0?'var(--green)':'var(--red)'}">${r.pv>=0?'+':''}${fmt(r.pv)}</div>
        <div style="font-family:var(--font-mono);font-size:10px;color:${r.pvPct>=0?'var(--green)':'var(--red)'}">${r.pvPct>=0?'+':''}${fmtPct(r.pvPct,1)}</div>
      </div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Aucune ligne pour le moment</div>';

  renderPeaComptesList();
}

