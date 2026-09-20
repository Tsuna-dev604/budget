// ═══════════════════════════════════════
//  Calculs de patrimoine global, synthèse, stress test
// ═══════════════════════════════════════
function getTotalComptes() {
  return state.comptes.reduce((s,c)=>s+getSoldeCompte(c.id),0);
}
function getPatrimoineNet() {
  const totalA = state.actifs.reduce((s,a)=>s+(a.valeur||0),0);
  const totalC = getTotalComptes();
  const totalP = state.passifs.reduce((s,p)=>s+(p.crd||0),0);
  return totalA+totalC-totalP;
}
function getEpargne() {
  const rev = state.budget.filter(b=>b.type==='revenu').reduce((s,b)=>s+b.montant,0);
  const dep = state.budget.filter(b=>b.type==='depense').reduce((s,b)=>s+b.montant,0);
  return {rev,dep,solde:rev-dep};
}
function getDepensesMensuelles() {
  return state.budget.filter(b=>b.type==='depense').reduce((s,b)=>s+b.montant,0);
}
function getRdmtMoyen() {
  const finActifs = state.actifs.filter(a=>a.category!=='physique');
  const totalA = finActifs.reduce((s,a)=>s+(a.valeur||0),0);
  if (!totalA) return 0;
  return finActifs.reduce((s,a)=>s+(taxNet(a.taux||0,a.fiscal||'exonere')*(a.valeur||0)/totalA),0);
}
function getLiquidity() {
  const liquid    = state.actifs.filter(a=>a.category==='liquide').reduce((s,a)=>s+(a.valeur||0),0) + getTotalComptes();
  const semi      = state.actifs.filter(a=>a.category==='semiliquide').reduce((s,a)=>s+(a.valeur||0),0);
  const illiquid  = state.actifs.filter(a=>['immobilier','physique'].includes(a.category)).reduce((s,a)=>s+(a.valeur||0),0);
  const loyers    = state.actifs.filter(a=>a.category==='immobilier').reduce((s,a)=>s+(a.loyer||0),0);
  return {liquid,semi,illiquid,loyers};
}

// ═══════════════════════════════════════
//  SYNTHÈSE
// ═══════════════════════════════════════
let chartAlloc=null, chartProjection=null;

function renderSynthese() {
  const net   = getPatrimoineNet();
  const {rev,dep,solde} = getEpargne();
  const rdmt  = getRdmtMoyen();
  const liq   = getLiquidity();

  document.getElementById('kpi-net').textContent    = fmt(net);
  const ep = document.getElementById('kpi-epargne');
  ep.textContent  = fmt(solde);
  ep.className    = 'card-value '+(solde>=0?'green':'red');
  document.getElementById('kpi-rdmt').textContent   = fmtPct(rdmt);
  document.getElementById('lastUpdated').textContent= 'Dernière mise à jour : '+new Date().toLocaleString('fr-FR');

  document.getElementById('kpi-liquid').textContent    = fmt(liq.liquid);
  document.getElementById('kpi-semiliquid').textContent= fmt(liq.semi);
  document.getElementById('kpi-illiquid').textContent  = fmt(liq.illiquid);
  document.getElementById('kpi-loyers').textContent    = fmt(liq.loyers)+'/mois';
  document.getElementById('kpi-comptes').textContent   = fmt(getTotalComptes());

  // Allocation doughnut
  if (chartAlloc){chartAlloc.destroy();chartAlloc=null;}
  const groups = {liquide:0,semiliquide:0,immobilier:0,physique:0};
  state.actifs.forEach(a=>groups[a.category||'liquide']+=(a.valeur||0));
  const CAT_LABELS = {liquide:'Liquide',semiliquide:'Semi-liquide',immobilier:'Immobilier',physique:'Physique'};
  const CAT_COLORS = {liquide:'#4caf78',semiliquide:'#c9a84c',immobilier:'#4c8fc9',physique:'#9b59b6'};
  const labels=[],vals=[],bgs=[];
  Object.entries(groups).forEach(([k,v])=>{if(v>0){labels.push(CAT_LABELS[k]);vals.push(v);bgs.push(CAT_COLORS[k]);}});
  if (vals.length>0) {
    chartAlloc = new Chart(document.getElementById('chartAlloc').getContext('2d'),{
      type:'doughnut',
      data:{labels,datasets:[{data:vals,backgroundColor:bgs,borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)}`}}},cutout:'68%'}
    });
  }
  const totalA = vals.reduce((a,v)=>a+v,0)||1;
  document.getElementById('allocList').innerHTML = labels.map((l,i)=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:${bgs[i]}"></span>${l}</div>
      <div style="font-family:var(--font-mono);font-size:12px">${fmtPct(vals[i]/totalA*100,0)} <span style="color:var(--text3);margin-left:8px">${fmt(vals[i])}</span></div>
    </div>`).join('')||'<div style="color:var(--text3);font-size:13px">Aucun actif</div>';

  // Projection 10 ans
  if (chartProjection){chartProjection.destroy();chartProjection=null;}
  const infl = 2.5; // Taux d'inflation par défaut (module FIRE retiré)
  const years = Array.from({length:11},(_,i)=>i);
  const totalComptesProj = getTotalComptes();
  const projData = years.map(y=>state.actifs.reduce((s,a)=>{
    if (a.category==='physique') return s+compound(a.valeur||0,a.evolPhys||0,y);
    return s+compoundWithContrib(a.valeur||0,taxNet(a.taux||0,a.fiscal||'exonere'),y,a.mensuel||0);
  },0)+totalComptesProj);
  const inflData = years.map((y,i)=>projData[i]/Math.pow(1+infl/100,y));
  chartProjection = new Chart(document.getElementById('chartProjection').getContext('2d'),{
    type:'line',
    data:{labels:years.map(y=>y===0?'Auj.':`+${y}a`),datasets:[
      {label:'Valeur Nominale',data:projData,borderColor:'#c9a84c',backgroundColor:'rgba(201,168,76,.08)',tension:.4,fill:true,borderWidth:2,pointRadius:3},
      {label:'Valeur Réelle',data:inflData,borderColor:'#4c8fc9',backgroundColor:'rgba(76,143,201,.06)',tension:.4,fill:true,borderWidth:2,borderDash:[6,3],pointRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#8a8680',font:{family:'DM Mono',size:11}}},tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${fmt(ctx.raw)}`}}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#5a5854',font:{family:'DM Mono',size:10}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#5a5854',font:{family:'DM Mono',size:10},callback:v=>fmt(v)}}}}
  });
}

// ═══════════════════════════════════════
//  STRESS TEST
// ═══════════════════════════════════════
function runStressTest() {
  const dynTotal = state.actifs.filter(a=>a.category==='semiliquide').reduce((s,a)=>s+(a.valeur||0),0);
  const loss = dynTotal*0.30;
  const netBefore = getPatrimoineNet();
  const netAfter  = netBefore-loss;
  const impactPct = netBefore>0?(loss/netBefore*100):0;
  document.getElementById('stressResult').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div><div style="color:var(--text3);font-size:10px;text-transform:uppercase;margin-bottom:4px">Perte simulée</div><div style="color:var(--red);font-size:18px">−${fmt(loss)}</div></div>
      <div><div style="color:var(--text3);font-size:10px;text-transform:uppercase;margin-bottom:4px">Patrimoine après krach</div><div style="color:var(--text);font-size:18px">${fmt(netAfter)}</div></div>
      <div><div style="color:var(--text3);font-size:10px;text-transform:uppercase;margin-bottom:4px">Patrimoine avant krach</div><div style="color:var(--text3);font-size:16px">${fmt(netBefore)}</div></div>
      <div><div style="color:var(--text3);font-size:10px;text-transform:uppercase;margin-bottom:4px">Impact sur le patrimoine</div><div style="color:var(--red);font-size:16px">−${fmtPct(impactPct)}</div></div>
    </div>`;
  notify('Stress test effectué');
}

