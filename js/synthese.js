// ═══════════════════════════════════════
//  SYNTHÈSE — cockpit patrimonial (Phase 2)
//  5 KPI essentiels → évolution du patrimoine → où va/où est l'argent →
//  flux du mois → points à surveiller. Rien d'autre : cf. §24/§39.
// ═══════════════════════════════════════
let chartAlloc = null;
let chartPatrimoineEvol = null;
let synthesePeriod = '1a'; // '1m','3m','6m','1a','3a','5a','tout'
let syntheseSeries = { net:true, actifs:true, passifs:true };
let syntheseDepPeriode = 'mois'; // 'mois' | 'trimestre' | 'annee'

const PERIODES = [
  {key:'1m', label:'1 mois',  mois:1},
  {key:'3m', label:'3 mois',  mois:3},
  {key:'6m', label:'6 mois',  mois:6},
  {key:'1a', label:'1 an',    mois:12},
  {key:'3a', label:'3 ans',   mois:36},
  {key:'5a', label:'5 ans',   mois:60},
  {key:'tout', label:'Tout',  mois:null},
];

function renderSynthese() {
  document.getElementById('lastUpdated').textContent = 'Dernière mise à jour : '+new Date().toLocaleString('fr-FR');
  renderSyntheseKpis();
  renderPatrimoineChart();
  renderAllocationWidget();
  renderDepensesWidget();
  renderFluxMois();
  renderPointsSurveiller();
}

// ── Ligne 1 : 5 KPI essentiels ──
function renderSyntheseKpis() {
  const net = getPatrimoineNet();
  const dette = getTotalPassifs();
  const liq = getLiquidity();
  const epMois = getEpargneMoisCourant();
  const var12 = getVariationPatrimoine(12);
  const var1 = getVariationPatrimoine(1);

  document.getElementById('kpi-net').textContent = fmt(net);
  const subNet = document.getElementById('kpi-net-sub');
  if (subNet) {
    subNet.textContent = var1 ? `${var1.delta>=0?'+':''}${fmt(var1.delta)} sur le mois` : 'Historique en cours de constitution';
  }

  const var12El = document.getElementById('kpi-var12');
  if (var12) {
    var12El.textContent = (var12.delta>=0?'+':'')+fmt(var12.delta);
    var12El.className = 'card-value '+(var12.delta>=0?'green':'red');
  } else {
    var12El.textContent = '—';
    var12El.className = 'card-value';
  }
  const var12Sub = document.getElementById('kpi-var12-sub');
  if (var12Sub) var12Sub.textContent = var12 && var12.pct!==null ? `${var12.pct>=0?'+':''}${fmtPct(var12.pct,1)} sur 12 mois` : 'Pas assez d\'historique';

  const epEl = document.getElementById('kpi-epargne');
  epEl.textContent = fmt(epMois.solde);
  epEl.className = 'card-value '+(epMois.solde>=0?'green':'red');

  document.getElementById('kpi-liquid2').textContent = fmt(liq.liquid);
  document.getElementById('kpi-dette').textContent = fmt(dette);
}

// ── Ligne 2 : graphique d'évolution du patrimoine ──
function selectPeriode(key) {
  synthesePeriod = key;
  document.querySelectorAll('.periode-btn').forEach(b=>b.classList.toggle('active', b.dataset.periode===key));
  renderPatrimoineChart();
}
function toggleSerie(key) {
  syntheseSeries[key] = !syntheseSeries[key];
  renderPatrimoineChart();
}
function renderPatrimoineChart() {
  const wrap = document.getElementById('patrimoineChartWrap');
  const empty = document.getElementById('patrimoineChartEmpty');
  const hist = state.patrimoineHistory || [];

  if (hist.length < 2) {
    wrap.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  wrap.style.display = 'block';
  empty.style.display = 'none';

  const periodeDef = PERIODES.find(p=>p.key===synthesePeriod) || PERIODES[3];
  const cutoff = periodeDef.mois ? addMonths(today(), -periodeDef.mois) : null;
  const points = cutoff ? hist.filter(p=>p.date>=cutoff) : hist;
  const displayPoints = points.length>=2 ? points : hist.slice(-Math.max(2,hist.length));

  const labels = displayPoints.map(p=>new Date(p.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'}));
  const styleColor = getComputedStyle(document.documentElement);
  const cGold = styleColor.getPropertyValue('--gold').trim() || '#5b8def';
  const cGreen = styleColor.getPropertyValue('--green').trim() || '#22c55e';
  const cRed = styleColor.getPropertyValue('--red').trim() || '#ef4444';
  const cText3 = styleColor.getPropertyValue('--text3').trim() || '#8a8680';

  const datasets = [];
  if (syntheseSeries.net) datasets.push({label:'Patrimoine net', data:displayPoints.map(p=>p.net), borderColor:cGold, backgroundColor:'transparent', tension:.3, borderWidth:2.5, pointRadius:2});
  if (syntheseSeries.actifs) datasets.push({label:'Total actifs', data:displayPoints.map(p=>p.actifs), borderColor:cGreen, backgroundColor:'transparent', tension:.3, borderWidth:1.5, borderDash:[4,3], pointRadius:0});
  if (syntheseSeries.passifs) datasets.push({label:'Total dettes', data:displayPoints.map(p=>p.passifs), borderColor:cRed, backgroundColor:'transparent', tension:.3, borderWidth:1.5, borderDash:[4,3], pointRadius:0});

  if (chartPatrimoineEvol) { chartPatrimoineEvol.destroy(); chartPatrimoineEvol=null; }
  chartPatrimoineEvol = new Chart(document.getElementById('chartPatrimoineEvol').getContext('2d'), {
    type:'line',
    data:{labels, datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${fmt(ctx.raw)}`}} },
      scales:{
        x:{grid:{color:'rgba(127,127,127,.08)'}, ticks:{color:cText3, font:{family:'DM Mono',size:10}}},
        y:{grid:{color:'rgba(127,127,127,.08)'}, ticks:{color:cText3, font:{family:'DM Mono',size:10}, callback:v=>fmt(v,0)}}
      }
    }
  });
}

// ── Ligne 3 : où est mon argent (allocation factuelle, sans score) ──
function renderAllocationWidget() {
  const {groups, total} = getAllocationClasses();
  const CAT_LABELS = {liquide:'Liquidités',semiliquide:'Financier',immobilier:'Immobilier',physique:'Physique'};
  const CAT_COLORS = {liquide:'#22c55e',semiliquide:'#5b8def',immobilier:'#3b82f6',physique:'#8b7cf6'};
  const labels=[], vals=[], bgs=[];
  Object.entries(groups).forEach(([k,v])=>{ if (v>0) { labels.push(CAT_LABELS[k]); vals.push(v); bgs.push(CAT_COLORS[k]); } });

  if (chartAlloc) { chartAlloc.destroy(); chartAlloc=null; }
  if (vals.length>0) {
    chartAlloc = new Chart(document.getElementById('chartAlloc').getContext('2d'), {
      type:'doughnut',
      data:{labels, datasets:[{data:vals, backgroundColor:bgs, borderWidth:0}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)} (${fmtPct(ctx.raw/total*100,0)})`}}}, cutout:'68%'}
    });
  }
  document.getElementById('allocList').innerHTML = labels.map((l,i)=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:${bgs[i]}"></span>${l}</div>
      <div style="font-family:var(--font-mono);font-size:12px">${fmtPct(total>0?vals[i]/total*100:0,0)} <span style="color:var(--text3);margin-left:8px">${fmt(vals[i])}</span></div>
    </div>`).join('') || '<div style="color:var(--text3);font-size:13px">Aucun actif enregistré</div>';
}

// ── Ligne 3 (suite) : où va mon argent (dépenses du mois/trimestre/année) ──
function selectDepPeriode(key) {
  syntheseDepPeriode = key;
  document.querySelectorAll('.dep-periode-btn').forEach(b=>b.classList.toggle('active', b.dataset.depPeriode===key));
  renderDepensesWidget();
}
function renderDepensesWidget() {
  const now = new Date();
  let startDate;
  if (syntheseDepPeriode==='mois') startDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  else if (syntheseDepPeriode==='trimestre') { const d = new Date(now); d.setMonth(d.getMonth()-3); startDate = d.toISOString().slice(0,10); }
  else { startDate = `${now.getFullYear()}-01-01`; }
  const items = state.budget.filter(b=>b.date>=startDate);
  document.getElementById('depensesWidgetList').innerHTML = categBarListHtml(items, 'depense');
}

// ── Ligne 4 : flux du mois ──
function renderFluxMois() {
  const {rev, dep, solde} = getEpargneMoisCourant();
  const investiMensuel = Math.max(0, Math.min(solde, state.actifs
    .filter(a=>a.category==='liquide'||a.category==='semiliquide')
    .reduce((s,a)=>s+(a.mensuel||0),0)));
  const cash = solde - investiMensuel;

  const step = (label, val, color) => `
    <div style="text-align:center;flex:1;min-width:110px">
      <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:6px">${label}</div>
      <div style="font-family:var(--font-display);font-size:20px;color:${color}">${fmt(val)}</div>
    </div>`;
  const arrow = `<div style="color:var(--text3);font-size:18px;padding:0 4px">→</div>`;

  document.getElementById('fluxMoisWrap').innerHTML = `
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;justify-content:center">
      ${step('Revenus', rev, 'var(--green)')}
      ${arrow}
      ${step('Dépenses', dep, 'var(--red)')}
      ${arrow}
      ${step('Épargne', solde, solde>=0?'var(--gold)':'var(--red)')}
    </div>
    <hr class="divider">
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      ${step('Cash conservé', cash, 'var(--text)')}
      ${step('Investi (versements programmés)', investiMensuel, 'var(--blue)')}
    </div>
    <div class="info-note" style="text-align:center;margin-top:14px">Mois calendaire en cours (${new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}). "Investi" = versements mensuels déjà programmés sur vos actifs liquides/semi-liquides.</div>`;
}

// ── Ligne 5 : points à surveiller (règles simples, explicables, max 5) ──
function renderPointsSurveiller() {
  const points = [];
  const net = getPatrimoineNet();
  const dette = getTotalPassifs();
  const {liquid} = getLiquidity();
  const depMens = getMoyenneDepensesMensuelles(3);
  const {groups, total} = getAllocationClasses();

  if (net < 0) {
    points.push({icon:'🔴', text:'Le patrimoine net est actuellement négatif.'});
  }
  if (depMens>0) {
    const moisCouverts = liquid/depMens;
    if (moisCouverts < 3) {
      points.push({icon:'⚠', text:`Trésorerie limitée : environ ${moisCouverts.toFixed(1)} mois de dépenses couvertes par les liquidités disponibles.`});
    }
  }
  if (total>0 && dette>0) {
    const brut = getTotalActifs()+getTotalComptes();
    const ratioDette = brut>0 ? dette/brut*100 : 0;
    if (ratioDette > 50) points.push({icon:'⚠', text:`Les dettes représentent ${fmtPct(ratioDette,0)} du patrimoine brut.`});
  }
  if (total>0 && groups.immobilier/total > 0.70) {
    points.push({icon:'ℹ', text:`L'immobilier représente ${fmtPct(groups.immobilier/total*100,0)} du patrimoine total — une part importante d'actifs peu liquides.`});
  }
  const epMois = getEpargneMoisCourant();
  const moyDepPrec = getMoyenneDepensesMensuelles(3, 1); // décalée d'un mois pour comparer au mois en cours
  if (moyDepPrec>0 && epMois.dep > moyDepPrec*1.3) {
    points.push({icon:'⚠', text:`Dépenses du mois en cours supérieures d'environ ${fmtPct((epMois.dep/moyDepPrec-1)*100,0)} à la moyenne des 3 derniers mois.`});
  }

  const final = points.slice(0,5);
  document.getElementById('pointsSurveillerList').innerHTML = final.length
    ? final.map(p=>`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px"><span style="flex-shrink:0">${p.icon}</span><span style="color:var(--text2);font-size:13px;line-height:1.6">${p.text}</span></div>`).join('')
    : '<div style="color:var(--text3);font-size:13px">Aucun point particulier à signaler pour le moment.</div>';
}

// Moyenne des dépenses mensuelles sur les N derniers mois complets (hors mois en cours par défaut).
// offset=0 inclut le mois en cours dans la fenêtre ; offset=1 l'exclut (fenêtre glissée d'un mois).
function getMoyenneDepensesMensuelles(nbMois, offsetMois=0) {
  const now = new Date();
  let total = 0, count = 0;
  for (let i=offsetMois; i<offsetMois+nbMois; i++) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const dep = state.budget.filter(b=>b.type==='depense'&&b.date.startsWith(ym)).reduce((s,b)=>s+b.montant,0);
    if (dep>0) { total += dep; count++; }
  }
  return count>0 ? total/count : 0;
}
