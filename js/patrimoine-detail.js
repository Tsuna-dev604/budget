// ═══════════════════════════════════════
//  PATRIMOINE — sous-pages « Allocation », « Variation du patrimoine »
//  et « Historique » (Phase 5). S'appuie exclusivement sur les fonctions
//  de calcul centralisées de patrimoine.js. Aucune donnée n'est inventée :
//  quand l'historique n'est pas assez profond, on l'affiche clairement
//  plutôt que d'extrapoler.
// ═══════════════════════════════════════
function showPatrimoineTab(id, el) {
  showSubTab('actifs', id, el);
  // Les donuts Chart.js se dimensionnent sur leur canvas au moment de leur création :
  // s'ils sont créés pendant que l'onglet est encore masqué (display:none), ils restent
  // vides. On les recrée donc au moment où l'onglet devient réellement visible.
  if (id === 'patr-alloc') renderPatrimoineAllocation();
}

let chartPatrClasses = null, chartPatrFiscal = null;

// ── Allocation : répartition factuelle, sans score arbitraire (§14) ──
function renderPatrimoineAllocation() {
  const {groups, total} = getAllocationClasses();
  const CAT_LABELS = {liquide:'Liquidités',semiliquide:'Financier (PEA/CTO/AV)',immobilier:'Immobilier',physique:'Biens physiques'};
  const CAT_COLORS = {liquide:'#22c55e',semiliquide:'#5b8def',immobilier:'#3b82f6',physique:'#8b7cf6'};
  const labels=[], vals=[], bgs=[];
  Object.entries(groups).forEach(([k,v])=>{ if (v>0) { labels.push(CAT_LABELS[k]); vals.push(v); bgs.push(CAT_COLORS[k]); } });

  if (chartPatrClasses) { chartPatrClasses.destroy(); chartPatrClasses=null; }
  if (vals.length) {
    chartPatrClasses = new Chart(document.getElementById('chartPatrClasses').getContext('2d'), {
      type:'doughnut',
      data:{labels, datasets:[{data:vals, backgroundColor:bgs, borderWidth:0}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)} (${fmtPct(ctx.raw/total*100,0)})`}}}, cutout:'68%'}
    });
  }
  document.getElementById('patrClassesList').innerHTML = labels.length ? labels.map((l,i)=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:${bgs[i]}"></span>${l}</div>
      <div style="font-family:var(--font-mono);font-size:12px">${fmtPct(total>0?vals[i]/total*100:0,0)} <span style="color:var(--text3);margin-left:8px">${fmt(vals[i])}</span></div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Aucun actif enregistré</div>';

  // Répartition fiscale
  const {map:fiscalMap, total:totalFiscal} = getAllocationFiscale();
  const FISCAL_LABELS = {exonere:'Exonéré (livrets, comptes)',ps:'Prélèvements sociaux (17,2 %)',flat:'Flat Tax (30 %)',immobilier:'Immobilier (fiscalité foncière)'};
  const FISCAL_COLORS = {exonere:'#22c55e',ps:'#3b82f6',flat:'#c9a84c',immobilier:'#8b7cf6'};
  const fLabels=[], fVals=[], fBgs=[];
  Object.entries(fiscalMap).forEach(([k,v])=>{ if (v>0) { fLabels.push(FISCAL_LABELS[k]); fVals.push(v); fBgs.push(FISCAL_COLORS[k]); } });

  if (chartPatrFiscal) { chartPatrFiscal.destroy(); chartPatrFiscal=null; }
  if (fVals.length) {
    chartPatrFiscal = new Chart(document.getElementById('chartPatrFiscal').getContext('2d'), {
      type:'doughnut',
      data:{labels:fLabels, datasets:[{data:fVals, backgroundColor:fBgs, borderWidth:0}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)} (${fmtPct(ctx.raw/totalFiscal*100,0)})`}}}, cutout:'68%'}
    });
  }
  document.getElementById('patrFiscalList').innerHTML = fLabels.length ? fLabels.map((l,i)=>`
    <div class="alloc-row">
      <div><span class="alloc-dot" style="background:${fBgs[i]}"></span>${l}</div>
      <div style="font-family:var(--font-mono);font-size:12px">${fmtPct(totalFiscal>0?fVals[i]/totalFiscal*100:0,0)} <span style="color:var(--text3);margin-left:8px">${fmt(fVals[i])}</span></div>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Aucun actif enregistré</div>';

  // Concentrations importantes — formulation neutre, sans score (§14)
  const notes = getConcentrationNotes();
  document.getElementById('patrConcentrationNotes').innerHTML = notes.length
    ? notes.map(n=>`<div class="info-note" style="margin-bottom:8px">ℹ ${n}</div>`).join('')
    : '';
}

// ── Variation du patrimoine : décomposition du mois en cours (§6) ──
function renderPatrimoineVariation() {
  const wrap = document.getElementById('patrVariationWrap');
  const d = getDecompositionMoisCourant();

  if (!d) {
    wrap.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">↕</div>
          <div class="empty-state-title">L'historique se construit</div>
          <div class="empty-state-text">La décomposition de la variation du patrimoine nécessite un instantané enregistré avant le début du mois. Revenez dans quelques jours — chaque utilisation de l'application enregistre un instantané réel.</div>
        </div>
      </div>`;
    return;
  }

  const row = (label, val, note) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
      <div>
        <div style="font-size:13px;color:var(--text2)">${label}</div>
        ${note?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${note}</div>`:''}
      </div>
      <div style="font-family:var(--font-mono);font-size:14px;font-weight:600;color:${val>=0?'var(--green)':'var(--red)'}">${val>=0?'+':''}${fmt(val)}</div>
    </div>`;

  const moisLabel = new Date(d.debutMois+'T00:00:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  wrap.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Variation du patrimoine — ${moisLabel}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 16px 0">
        <span style="font-size:13px;color:var(--text3)">Patrimoine net au début du mois</span>
        <span style="font-family:var(--font-mono);font-size:15px">${fmt(d.netDebut)}</span>
      </div>
      ${row('Épargne du mois', d.epargne, 'Revenus − dépenses (Budget)')}
      ${row('Performance des investissements', d.performanceInvest, 'Estimation : variation des actifs financiers hors versements programmés')}
      ${row('Remboursement de capital immobilier', d.remboursementCredit, 'Variation du capital restant dû des crédits')}
      ${row('Variation immobilière', d.variationImmobiliere, 'Variation de la valeur des biens immobiliers')}
      ${row('Autres variations', d.autres, 'Résidu non attribuable avec certitude (biens physiques, ajustements…)')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0 6px 0">
        <span style="font-size:13px;color:var(--text2);font-weight:600">Patrimoine net actuel</span>
        <span style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--gold)">${fmt(d.netFin)}</span>
      </div>
      <div class="info-note" style="margin-top:12px">Décomposition basée sur les données réellement enregistrées (opérations Budget, instantanés de patrimoine, versements programmés). Ce n'est pas une prédiction : les montants estimés sont signalés comme tels.</div>
    </div>`;
}

// ── Historique : base réelle des instantanés du patrimoine (§15) ──
function renderPatrimoineHistorique() {
  const wrap = document.getElementById('patrHistoWrap');
  const hist = state.patrimoineHistory || [];
  if (hist.length < 2) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">▤</div>
        <div class="empty-state-title">L'historique se construit</div>
        <div class="empty-state-text">Chaque utilisation de l'application enregistre un instantané réel de votre patrimoine (un point par jour). Revenez régulièrement pour consulter votre évolution.</div>
      </div>`;
    return;
  }
  const ordered = [...hist].sort((a,b)=>b.date.localeCompare(a.date)); // plus récent en premier
  const rows = ordered.map((p,i)=>{
    const prev = ordered[i+1];
    const variation = prev ? p.net - prev.net : null;
    return `<tr>
      <td>${new Date(p.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td>${fmt(p.actifs)}</td>
      <td class="red">${fmt(p.passifs)}</td>
      <td class="gold">${fmt(p.net)}</td>
      <td class="${variation===null?'':(variation>=0?'green':'red')}">${variation===null?'—':(variation>=0?'+':'')+fmt(variation)}</td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `
    <div class="table-wrap" style="max-height:480px;overflow-y:auto">
      <table>
        <thead><tr><th>Date</th><th>Actifs</th><th>Dettes</th><th>Patrimoine net</th><th>Variation</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
