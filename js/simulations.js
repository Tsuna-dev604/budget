// ═══════════════════════════════════════
//  SIMULATIONS (Phase 8) — trois simulateurs indépendants des données réelles :
//  patrimonial (§19-20), immobilier (§18), assurance-vie (§21).
//  Principe directeur : les hypothèses sont toujours visibles et modifiables,
//  jamais présentées comme une prédiction (§19).
// ═══════════════════════════════════════
function showSimuTab(id, el) {
  showSubTab('simulations', id, el);
  // Même contrainte que pour les donuts de Patrimoine : un graphique Chart.js créé
  // pendant que son onglet est masqué reste vide tant qu'on ne le recrée pas visible.
  if (id === 'simu-patr') renderSimuPatrimoine();
}

// ── Scénarios patrimoniaux : hypothèses de départ, entièrement modifiables ensuite ──
const SIMU_SCENARIOS = {
  prudent:    {rendement:2.5, immo:1.0, croissance:0.5},
  central:    {rendement:5.0, immo:2.0, croissance:1.5},
  dynamique:  {rendement:7.5, immo:3.0, croissance:3.0},
};
let simuScenarioActif = 'central';
let simuDureeActive = 15;
let simuPatrInitialise = false;
let chartSimuPatr = null;

function selectSimuScenario(key) {
  simuScenarioActif = key;
  document.querySelectorAll('.simu-scenario-btn').forEach(b=>b.classList.toggle('active', b.dataset.scenario===key));
  const s = SIMU_SCENARIOS[key];
  document.getElementById('simuPRendement').value = s.rendement;
  document.getElementById('simuPImmo').value = s.immo;
  document.getElementById('simuPCroissance').value = s.croissance;
  renderSimuPatrimoine();
}
function selectSimuDuree(n) {
  simuDureeActive = n;
  document.querySelectorAll('.simu-duree-btn').forEach(b=>b.classList.toggle('active', Number(b.dataset.duree)===n));
  renderSimuPatrimoine();
}

// Préremplit le simulateur avec la situation réelle actuelle, une seule fois
// (les modifications suivantes de l'utilisateur ne sont jamais écrasées).
function initSimuPatrimoineDefaults() {
  if (simuPatrInitialise) return;
  simuPatrInitialise = true;
  document.getElementById('simuPPatrimoine').value = Math.round(getPatrimoineNet());
  document.getElementById('simuPEpargne').value = Math.round(getEpargneMoisCourant().solde);
  document.getElementById('simuPInflation').value = 2;
  const s = SIMU_SCENARIOS[simuScenarioActif];
  document.getElementById('simuPRendement').value = s.rendement;
  document.getElementById('simuPImmo').value = s.immo;
  document.getElementById('simuPCroissance').value = s.croissance;
}

// Calcule une trajectoire annuelle sur `duree` ans à partir des paramètres donnés.
// Décompose le patrimoine en deux masses réelles : équité immobilière (valeur des
// biens − dettes, ces dernières s'amortissant via les mensualités réelles actuelles)
// et « financier net » (tout le reste), qui capitalise épargne + rendement.
function projeterPatrimoine(params) {
  const {patrimoineInitial, epargneMensuelle, croissanceEpargne, rendement, immoRate, duree, choc} = params;
  const immoValeur0 = getAllocationClasses().groups.immobilier;
  const dettes0 = getTotalPassifs();
  const mensualitesAnnuelles = getTotalMensualitesPassifs()*12;
  let financierNet0 = patrimoineInitial - (immoValeur0 - dettes0);
  if (choc) financierNet0 *= 0.70; // choc de marché immédiat : -30% sur les actifs financiers

  const points = [{annee:0, immoValeur:immoValeur0, dettes:dettes0, financierNet:financierNet0, net:financierNet0+immoValeur0-dettes0}];
  let financierNet = financierNet0, dettes = dettes0, immoValeur = immoValeur0;
  let epargneAnnuelleCourante = epargneMensuelle*12;
  let epargneCumulee = 0;

  for (let an=1; an<=duree; an++) {
    // Dettes : remboursement par les mensualités réelles actuelles (capital + intérêts confondus,
    // approximation simple et transparente — pas de tableau d'amortissement par bien ici)
    dettes = Math.max(0, dettes - mensualitesAnnuelles);
    immoValeur = immoValeur*(1+immoRate/100);
    financierNet = financierNet*(1+rendement/100) + epargneAnnuelleCourante;
    epargneCumulee += epargneAnnuelleCourante;
    epargneAnnuelleCourante *= (1+croissanceEpargne/100);
    points.push({annee:an, immoValeur, dettes, financierNet, net:financierNet+immoValeur-dettes});
  }
  return {points, immoValeur0, dettes0, financierNet0, epargneCumulee};
}

function renderSimuPatrimoine() {
  initSimuPatrimoineDefaults();
  const patrimoineInitial = parseFloat(document.getElementById('simuPPatrimoine').value)||0;
  const epargneMensuelle  = parseFloat(document.getElementById('simuPEpargne').value)||0;
  const croissanceEpargne = parseFloat(document.getElementById('simuPCroissance').value)||0;
  const rendementCentral  = parseFloat(document.getElementById('simuPRendement').value)||0;
  const immoRateCentral   = parseFloat(document.getElementById('simuPImmo').value)||0;
  const inflation         = parseFloat(document.getElementById('simuPInflation').value)||0;
  const choc              = document.getElementById('simuPChoc').checked;
  const duree = simuDureeActive;

  // Les 3 courbes du graphique utilisent les écarts de rendement/immoRate de chaque
  // scénario par rapport au scénario Central, appliqués aux valeurs actuellement
  // saisies (qui peuvent avoir été modifiées manuellement depuis le préréglage).
  const delta = SIMU_SCENARIOS[simuScenarioActif];
  const scenarios = {};
  Object.keys(SIMU_SCENARIOS).forEach(key=>{
    const s = SIMU_SCENARIOS[key];
    scenarios[key] = projeterPatrimoine({
      patrimoineInitial, epargneMensuelle, croissanceEpargne,
      rendement: rendementCentral + (s.rendement-delta.rendement),
      immoRate: immoRateCentral + (s.immo-delta.immo),
      duree, choc
    });
  });

  // Graphique
  const labels = scenarios.central.points.map(p=>`+${p.annee}a`);
  const ds = (key,color,label)=>({label, data:scenarios[key].points.map(p=>Math.round(p.net)), borderColor:color, backgroundColor:color, tension:0.25, pointRadius:0, borderWidth:2});
  if (chartSimuPatr) { chartSimuPatr.destroy(); chartSimuPatr=null; }
  const canvas = document.getElementById('chartSimuPatr');
  if (canvas && typeof Chart!=='undefined') {
    chartSimuPatr = new Chart(canvas.getContext('2d'), {
      type:'line',
      data:{labels, datasets:[
        ds('prudent','#94a3b8','Prudent'),
        ds('central','#5b8def','Central'),
        ds('dynamique','#22c55e','Dynamique'),
      ]},
      options:{responsive:true, maintainAspectRatio:false,
        plugins:{legend:{position:'bottom'}, tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${fmt(ctx.raw)}`}}},
        scales:{y:{ticks:{callback:v=>fmt(v)}}}
      }
    });
  }

  // Décomposition (§20) — scénario actuellement sélectionné, avec les valeurs saisies telles quelles
  const sc = scenarios[simuScenarioActif];
  const dernier = sc.points[sc.points.length-1];
  const performanceEstimee = dernier.financierNet - sc.financierNet0 - sc.epargneCumulee;
  const remboursementCredit = sc.dettes0 - dernier.dettes;
  const variationImmo = dernier.immoValeur - sc.immoValeur0;
  const netFinalConstant = dernier.net / Math.pow(1+inflation/100, duree);

  const row = (label,val,note)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div><div style="font-size:13px;color:var(--text2)">${label}</div>${note?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${note}</div>`:''}</div>
      <div style="font-family:var(--font-mono);font-size:14px;font-weight:600;color:${val>=0?'var(--green)':'var(--red)'}">${val>=0?'+':''}${fmt(val)}</div>
    </div>`;

  document.getElementById('simuPDecompWrap').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 16px 0">
      <span style="font-size:13px;color:var(--text3)">Patrimoine net initial</span>
      <span style="font-family:var(--font-mono);font-size:15px">${fmt(patrimoineInitial)}</span>
    </div>
    ${row('Épargne cumulée', sc.epargneCumulee, `Épargne mensuelle croissant de ${fmtPct(croissanceEpargne)}/an`)}
    ${row('Performance estimée des investissements', performanceEstimee, `Rendement annuel : ${fmtPct(rendementCentral)}`)}
    ${row('Remboursement de crédit', remboursementCredit, 'Mensualités réelles actuelles, inchangées sur la durée')}
    ${row('Évolution immobilière', variationImmo, `Valorisation : ${fmtPct(immoRateCentral)}/an`)}
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0 4px 0">
      <span style="font-size:13px;color:var(--text2);font-weight:600">Patrimoine projeté à +${duree} ans (scénario ${simuScenarioActif})</span>
      <span style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--gold)">${fmt(dernier.net)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0 0 0">
      <span style="font-size:12px;color:var(--text3)">Soit en euros constants (inflation ${fmtPct(inflation)}/an)</span>
      <span style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">${fmt(netFinalConstant)}</span>
    </div>
    ${choc?'<div class="info-note" style="margin-top:12px">⚠ Choc de marché simulé : −30% appliqué immédiatement sur les actifs financiers en année 0.</div>':''}`;
}

// ── Simulateur immobilier (§18) ──
function renderSimuImmobilier() {
  const prix      = parseFloat(document.getElementById('simuIPrix').value)||0;
  const apport    = parseFloat(document.getElementById('simuIApport').value)||0;
  const notaire   = parseFloat(document.getElementById('simuINotaire').value)||0;
  const travaux   = parseFloat(document.getElementById('simuITravaux').value)||0;
  const dureeAns  = parseFloat(document.getElementById('simuIDuree').value)||0;
  const taux      = parseFloat(document.getElementById('simuITaux').value)||0;
  const tauxAss   = parseFloat(document.getElementById('simuIAssurance').value)||0;
  const chargesM  = parseFloat(document.getElementById('simuICharges').value)||0;
  const taxeFonc  = parseFloat(document.getElementById('simuITaxeFonciere').value)||0;
  const loyer     = parseFloat(document.getElementById('simuILoyer').value)||0;

  const montantEmprunte = Math.max(0, prix+notaire+travaux-apport);
  const dureeMois = dureeAns*12;
  const mensHorsAss = getMensualiteCredit(montantEmprunte, taux, dureeMois);
  const mensAssurance = montantEmprunte*(tauxAss/100)/12;
  const mensualiteTotale = mensHorsAss + mensAssurance;
  const coutTotalCredit = mensHorsAss*dureeMois; // capital + intérêts
  const interetsTotal = coutTotalCredit - montantEmprunte;
  const coutAssuranceTotal = mensAssurance*dureeMois;
  const coutTotalProjet = prix+notaire+travaux+interetsTotal+coutAssuranceTotal;

  const rendementBrut = prix>0 ? (loyer*12/prix*100) : 0;
  const chargesAnnuelles = chargesM*12+taxeFonc;
  const rendementNet = prix>0 ? ((loyer*12-chargesAnnuelles)/prix*100) : 0;
  const cashflowMensuel = loyer - chargesM - (taxeFonc/12) - mensualiteTotale;
  const effortEpargne = Math.max(0, -cashflowMensuel);
  const impactImmediat = -(notaire+travaux); // frais perdus immédiatement, hors valeur du bien

  const row = (label,val,color)=>`<div class="alloc-row"><span style="color:var(--text3);font-size:12px">${label}</span><span style="font-family:var(--font-mono);font-weight:600;color:${color||'var(--text)'}">${val}</span></div>`;

  document.getElementById('simuImmoResult').innerHTML = `
    <div class="grid-3">
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">Crédit</div>
        ${row('Montant emprunté', fmt(montantEmprunte))}
        ${row('Mensualité (hors assurance)', fmt(mensHorsAss))}
        ${row('Mensualité assurance', fmt(mensAssurance))}
        ${row('Mensualité totale', fmt(mensualiteTotale), 'var(--gold)')}
        ${row('Coût total du crédit (intérêts)', fmt(interetsTotal), 'var(--red)')}
        ${row('Coût total assurance', fmt(coutAssuranceTotal), 'var(--red)')}
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">Coût total du projet</div>
        ${row('Prix + notaire + travaux', fmt(prix+notaire+travaux))}
        ${row('+ Intérêts du crédit', fmt(interetsTotal))}
        ${row('+ Assurance emprunteur', fmt(coutAssuranceTotal))}
        <div class="alloc-row" style="border-top:1px solid var(--border2);margin-top:6px;padding-top:8px"><span style="font-weight:500">Coût total du projet</span><span style="font-family:var(--font-mono);font-weight:700;color:var(--gold)">${fmt(coutTotalProjet)}</span></div>
        <div class="alloc-row"><span style="color:var(--text3);font-size:12px">Impact immédiat sur le patrimoine net</span><span style="font-family:var(--font-mono);font-weight:600;color:var(--red)">${fmt(impactImmediat)}</span></div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">Rentabilité locative ${loyer<=0?'<span style="color:var(--text3);font-weight:400">(résidence principale)</span>':''}</div>
        ${row('Rendement brut', fmtPct(rendementBrut))}
        ${row('Rendement net (charges + taxe foncière)', fmtPct(rendementNet))}
        ${row('Cash-flow mensuel', (cashflowMensuel>=0?'+':'')+fmt(cashflowMensuel), cashflowMensuel>=0?'var(--green)':'var(--red)')}
        ${row('Effort d\'épargne mensuel', effortEpargne>0?fmt(effortEpargne):'Aucun', effortEpargne>0?'var(--red)':'var(--green)')}
      </div>
    </div>
    <div class="info-note" style="margin-top:16px">Simulation indépendante — n'affecte pas vos biens réels. Impact immédiat = frais de notaire et travaux, qui ne se retrouvent pas dans la valeur du bien.</div>`;
}

// ── Simulateur assurance-vie (§21) ──
function renderSimuAV() {
  const versementInitial = parseFloat(document.getElementById('simuAVInitial').value)||0;
  const versementMensuel = parseFloat(document.getElementById('simuAVMensuel').value)||0;
  const dureeAns  = parseFloat(document.getElementById('simuAVDuree').value)||0;
  const rendement = parseFloat(document.getElementById('simuAVRendement').value)||0;
  const fraisVers = parseFloat(document.getElementById('simuAVFraisVers').value)||0;
  const fraisGestion = parseFloat(document.getElementById('simuAVFraisGestion').value)||0;
  const mois = Math.round(dureeAns*12);

  function simuler(rendementAnnuel) {
    let capital = versementInitial*(1-fraisVers/100);
    const rMens = rendementAnnuel/100/12;
    for (let m=1;m<=mois;m++) {
      capital *= (1+rMens);
      capital += versementMensuel*(1-fraisVers/100);
    }
    return capital;
  }
  const capitalFinal = simuler(rendement-fraisGestion);
  const capitalSansFraisGestion = simuler(rendement);
  const fraisGestionEstimes = capitalSansFraisGestion - capitalFinal;
  const totalVerse = versementInitial + versementMensuel*mois;
  const fraisVersementTotal = totalVerse*(fraisVers/100);
  const gains = capitalFinal - totalVerse;
  const fraisEstimesTotal = fraisVersementTotal + fraisGestionEstimes;

  const row = (label,val,color,note)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div><div style="font-size:13px;color:var(--text2)">${label}</div>${note?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${note}</div>`:''}</div>
      <div style="font-family:var(--font-mono);font-size:14px;font-weight:600;color:${color}">${val}</div>
    </div>`;

  document.getElementById('simuAVResult').innerHTML = `
    <div class="card">
      ${row('Total versé', fmt(totalVerse), 'var(--text)', 'Versement initial + versements mensuels, sur '+dureeAns+' ans')}
      ${row('Gains', (gains>=0?'+':'')+fmt(gains), gains>=0?'var(--green)':'var(--red)', 'Ce que le contrat a réellement rapporté, net de tous les frais')}
      ${row('Frais estimés (versement + gestion)', fmt(fraisEstimesTotal), 'var(--red)')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0 4px 0">
        <span style="font-size:13px;color:var(--text2);font-weight:600">Capital final estimé</span>
        <span style="font-family:var(--font-mono);font-size:17px;font-weight:700;color:var(--gold)">${fmt(capitalFinal)}</span>
      </div>
    </div>`;
}
