// ═══════════════════════════════════════
//  Analyse de diversification du patrimoine (HHI, graphiques)
// ═══════════════════════════════════════
let chartDivClasses=null, chartDivFiscal=null, chartDivRisque=null;

function herfindahl(weights) {
  // HHI : somme des parts² — 0=parfaitement diversifié, 1=concentré
  const total = weights.reduce((a,v)=>a+v,0)||1;
  return weights.reduce((s,w)=>s+Math.pow(w/total,2),0);
}

function divScore(hhi, n) {
  // Score 0-100 : inverse HHI pondéré par nombre de positions
  const base = 1-(hhi-1/Math.max(n,1));
  return Math.max(0,Math.min(100,base*100));
}

function renderDiversification() {
  const actifs = state.actifs;
  const totalComptesDiv = getTotalComptes();
  const totalPatrimoine = actifs.reduce((s,a)=>s+(a.valeur||0),0)+totalComptesDiv||1;

  // ── 1. Répartition par classe ──
  const classes = {
    'Liquidités': actifs.filter(a=>a.category==='liquide').reduce((s,a)=>s+(a.valeur||0),0)+totalComptesDiv,
    'Financier': actifs.filter(a=>a.category==='semiliquide').reduce((s,a)=>s+(a.valeur||0),0),
    'Immobilier': actifs.filter(a=>a.category==='immobilier').reduce((s,a)=>s+(a.valeur||0),0),
    'Physique': actifs.filter(a=>a.category==='physique').reduce((s,a)=>s+(a.valeur||0),0),
  };
  const classesVals = Object.values(classes).filter(v=>v>0);
  const hhiClasses  = herfindahl(classesVals);
  const scoreClasses= divScore(hhiClasses, classesVals.length);

  // ── 2. Répartition fiscale ──
  const fiscalMap = {'Exonéré':0, 'PEA (PS 17.2%)':0, 'Flat Tax 30%':0, 'Immobilier':0};
  fiscalMap['Exonéré'] += totalComptesDiv;
  actifs.forEach(a=>{
    const v = a.valeur||0;
    if (a.category==='physique') return;
    if (a.category==='immobilier') { fiscalMap['Immobilier']+=v; return; }
    if (a.fiscal==='exonere') fiscalMap['Exonéré']+=v;
    else if (a.fiscal==='ps') fiscalMap['PEA (PS 17.2%)']+=v;
    else fiscalMap['Flat Tax 30%']+=v;
  });
  const fiscalVals = Object.values(fiscalMap).filter(v=>v>0);
  const hhiFiscal  = herfindahl(fiscalVals);
  const scoreFiscal= divScore(hhiFiscal, fiscalVals.length);

  // ── 3. Liquidité ──
  const liquide = classes['Liquidités'];
  const ratioLiq = liquide/totalPatrimoine*100;
  const scoreLiq = ratioLiq>=5&&ratioLiq<=25 ? 100 : ratioLiq<5 ? ratioLiq/5*100 : Math.max(0,100-(ratioLiq-25)*2);

  // ── 4. Score global ──
  const scoreGlobal = Math.round(scoreClasses*0.4 + scoreFiscal*0.35 + scoreLiq*0.25);

  // KPIs
  const el = document.getElementById('divScore');
  el.textContent = scoreGlobal+' / 100';
  el.className = 'card-value '+(scoreGlobal>=75?'green':scoreGlobal>=50?'gold':'red');
  document.getElementById('divClasses').textContent = fmtPct(scoreClasses,0);
  document.getElementById('divEnveloppes').textContent = fmtPct(scoreFiscal,0);
  const liqEl = document.getElementById('divLiquidite');
  liqEl.textContent = fmtPct(ratioLiq,1);
  liqEl.className = 'card-value '+(scoreLiq>=80?'green':scoreLiq>=50?'gold':'red');

  // ── Jauge ──
  const jauge = document.getElementById('divGauge');
  const scoreColor = scoreGlobal>=75?'var(--green)':scoreGlobal>=50?'var(--gold)':'var(--red)';
  const scoreLabel = scoreGlobal>=75?'Bonne diversification':scoreGlobal>=50?'Diversification modérée':'Concentration élevée';
  jauge.innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span style="font-family:var(--font-mono);font-size:11px;color:var(--text3)">Diversification globale</span>
      <span style="font-family:var(--font-mono);font-size:13px;color:${scoreColor};font-weight:600">${scoreGlobal} pts — ${scoreLabel}</span>
    </div>
    <div style="background:var(--bg4);border-radius:6px;height:16px;overflow:hidden">
      <div style="height:100%;width:${scoreGlobal}%;background:linear-gradient(90deg,var(--red),var(--gold),var(--green));border-radius:6px;transition:width .8s ease"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px">
      ${[
        {l:'Classes d\'actifs',s:Math.round(scoreClasses),w:'40%'},
        {l:'Enveloppes fiscales',s:Math.round(scoreFiscal),w:'35%'},
        {l:'Liquidité',s:Math.round(scoreLiq),w:'25%'}
      ].map(d=>`<div style="background:var(--bg4);border-radius:6px;padding:10px 12px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--text3);font-family:var(--font-mono);margin-bottom:4px">${d.l} <span style="color:var(--text3)">(×${d.w})</span></div>
        <div style="font-size:18px;font-family:var(--font-display);color:${d.s>=75?'var(--green)':d.s>=50?'var(--gold)':'var(--red)'}">${d.s}<span style="font-size:12px;color:var(--text3)">/100</span></div>
        <div style="background:var(--bg);border-radius:3px;height:4px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${d.s}%;background:${d.s>=75?'var(--green)':d.s>=50?'var(--gold)':'var(--red)'}"></div></div>
      </div>`).join('')}
    </div>`;

  // ── Recommandations ──
  const recos = [];
  if (scoreClasses<60) recos.push({icon:'⚠',color:'var(--red)',text:'Votre patrimoine est concentré sur peu de classes d\'actifs. Envisagez de diversifier (ex: ajouter des matières premières, obligations, SCPI).'});
  if (classes['Financier']/(totalPatrimoine||1)<0.15) recos.push({icon:'💡',color:'var(--gold)',text:'La part financière (PEA, CTO, AV) est faible. Maximiser votre PEA (plafond 150 000 €) avant les autres enveloppes.'});
  if (classes['Liquidités']/(totalPatrimoine||1)<0.05) recos.push({icon:'🔴',color:'var(--red)',text:'Réserve de liquidités insuffisante (< 5%). Maintenez 3-6 mois de dépenses sur Livret A.'});
  if (classes['Liquidités']/(totalPatrimoine||1)>0.30) recos.push({icon:'💡',color:'var(--gold)',text:'Liquidités trop importantes (> 30%). L\'inflation érode votre capital. Investissez l\'excédent.'});
  if (fiscalMap['Exonéré']==0) recos.push({icon:'💡',color:'var(--gold)',text:'Aucun actif exonéré. Ouvrez un Livret A (3% net) ou un LDDS pour votre épargne de précaution.'});
  if (fiscalMap['PEA (PS 17.2%)']==0) recos.push({icon:'💡',color:'var(--gold)',text:'Pas de PEA détecté. C\'est l\'enveloppe la plus avantageuse pour les actions européennes (17,2% vs 30%).'});
  if (classes['Immobilier']/(totalPatrimoine||1)>0.70) recos.push({icon:'⚠',color:'var(--red)',text:'Forte concentration immobilière (> 70%). Actif illiquide en cas de besoin urgent de liquidités.'});
  if (recos.length===0) recos.push({icon:'✅',color:'var(--green)',text:'Excellente diversification ! Continuez à équilibrer vos versements selon votre profil de risque.'});

  document.getElementById('divRecos').innerHTML = recos.map(r=>
    `<div style="display:flex;gap:8px;margin-bottom:8px;padding:8px 10px;background:var(--bg4);border-radius:6px;border-left:3px solid ${r.color}">
      <span style="font-size:16px;flex-shrink:0">${r.icon}</span>
      <span style="color:var(--text2);font-size:12px">${r.text}</span>
    </div>`).join('');

  // ── Donut classes ──
  const classColors = ['#4caf78','#c9a84c','#4c8fc9','#9b59b6'];
  const classLabels = Object.keys(classes).filter((_,i)=>Object.values(classes)[i]>0);
  const classData   = Object.values(classes).filter(v=>v>0);
  if (chartDivClasses){chartDivClasses.destroy();chartDivClasses=null;}
  if (classData.length) {
    chartDivClasses = new Chart(document.getElementById('chartDivClasses').getContext('2d'),{
      type:'doughnut',
      data:{labels:classLabels,datasets:[{data:classData,backgroundColor:classColors.slice(0,classData.length),borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)} (${fmtPct(ctx.raw/totalPatrimoine*100,1)})`}}},cutout:'65%'}
    });
  }
  document.getElementById('divClassesList').innerHTML = classLabels.map((l,i)=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:${classColors[i]}"></span>${l}</div>
      <div style="font-family:var(--font-mono);font-size:12px">${fmtPct(classData[i]/totalPatrimoine*100,1)} <span style="color:var(--text3);margin-left:6px">${fmt(classData[i])}</span></div>
    </div>`).join('');

  // ── Donut fiscal ──
  const fiscalColors = ['#4caf78','#4c8fc9','#c9a84c','#9b59b6'];
  const fiscalLabels = Object.keys(fiscalMap).filter(k=>fiscalMap[k]>0);
  const fiscalData   = fiscalLabels.map(k=>fiscalMap[k]);
  if (chartDivFiscal){chartDivFiscal.destroy();chartDivFiscal=null;}
  if (fiscalData.length) {
    chartDivFiscal = new Chart(document.getElementById('chartDivFiscal').getContext('2d'),{
      type:'doughnut',
      data:{labels:fiscalLabels,datasets:[{data:fiscalData,backgroundColor:fiscalColors.slice(0,fiscalData.length),borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)}`}}},cutout:'65%'}
    });
  }
  document.getElementById('divFiscalList').innerHTML = fiscalLabels.map((l,i)=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:${fiscalColors[i]}"></span>${l}</div>
      <div style="font-family:var(--font-mono);font-size:12px">${fmtPct(fiscalData[i]/totalPatrimoine*100,1)} <span style="color:var(--text3);margin-left:6px">${fmt(fiscalData[i])}</span></div>
    </div>`).join('');

  // ── Scatter rendement/risque ──
  const RISK_RDMT = [
    {label:'Livret A/LDDS',risk:0,rdmt:3,color:'#4caf78',r:8},
    {label:'PEL',risk:0.5,rdmt:2.25,color:'#4caf78',r:6},
    {label:'Fonds €',risk:1,rdmt:2.8,color:'#4caf78',r:7},
    {label:'SCPI',risk:3,rdmt:4.5,color:'#c9a84c',r:8},
    {label:'Immo direct',risk:4,rdmt:4.0,color:'#c9a84c',r:10},
    {label:'ETF Oblig.',risk:3,rdmt:3.5,color:'#4c8fc9',r:7},
    {label:'ETF World',risk:6,rdmt:8.0,color:'#e8c97a',r:10},
    {label:'Actions FR',risk:7,rdmt:7.5,color:'#c9a84c',r:8},
    {label:'ETF EM',risk:8,rdmt:9.0,color:'#9b59b6',r:8},
    {label:'Crypto',risk:10,rdmt:15.0,color:'#c94c4c',r:7},
  ];
  if (chartDivRisque){chartDivRisque.destroy();chartDivRisque=null;}
  chartDivRisque = new Chart(document.getElementById('chartDivRisque').getContext('2d'),{
    type:'bubble',
    data:{datasets:RISK_RDMT.map(d=>({label:d.label,data:[{x:d.risk,y:d.rdmt,r:d.r}],backgroundColor:d.color+'99',borderColor:d.color,borderWidth:1}))},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: risque ${ctx.raw.x}/10, rdmt ~${ctx.raw.y}%`}}},scales:{x:{title:{display:true,text:'Risque →',color:'var(--text3)',font:{family:'DM Mono',size:10}},grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#5a5854',font:{family:'DM Mono',size:10}},min:0,max:11},y:{title:{display:true,text:'Rendement % →',color:'var(--text3)',font:{family:'DM Mono',size:10}},grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#5a5854',font:{family:'DM Mono',size:10},callback:v=>v+'%'}}}}
  });
  document.getElementById('divRisqueNote').textContent = 'Tailles indicatives • Rendements bruts historiques annualisés estimés';
}
