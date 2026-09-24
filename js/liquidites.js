// ═══════════════════════════════════════
//  LIQUIDITÉS — trésorerie & historique des soldes (§11/§12)
//  L'historique par compte est reconstruit EXACTEMENT à partir du grand
//  livre des opérations (state.budget) : aucune donnée n'est inventée,
//  et l'historique est disponible immédiatement (pas besoin d'attendre).
// ═══════════════════════════════════════
let chartLiquidites = null;
let liquiditesPeriod = '1a';
let liquiditesComptesVisibles = new Set();
let liquiditesComptesConnus = new Set(); // comptes déjà vus au moins une fois (pour ne pas re-cocher un compte décoché manuellement)
const LIQ_PALETTE = ['#5b8def','#22c55e','#ef4444','#8b7cf6','#f59e0b','#06b6d4','#ec4899','#84cc16'];

function renderLiquidites() {
  renderTresorerieKpis();
  renderLiquiditesLegend();
  renderLiquiditesChart();
}

// ── Légende (cases à cocher) — reconstruite seulement lors d'un rendu complet,
//    jamais depuis le gestionnaire onchange d'une case (qui se détruirait elle-même) ──
function renderLiquiditesLegend() {
  const legendWrap = document.getElementById('liquiditesLegend');
  if (!legendWrap) return;
  if (!state.comptes.length) { legendWrap.innerHTML = ''; return; }

  // Un compte nouvellement créé (jamais vu) est visible par défaut ; un compte décoché
  // manuellement le reste lors des rendus suivants. Un compte supprimé est retiré.
  state.comptes.forEach(c=>{
    if (!liquiditesComptesConnus.has(c.id)) {
      liquiditesComptesVisibles.add(c.id);
      liquiditesComptesConnus.add(c.id);
    }
  });
  [...liquiditesComptesVisibles].forEach(id=>{ if (!state.comptes.find(c=>c.id===id)) liquiditesComptesVisibles.delete(id); });
  [...liquiditesComptesConnus].forEach(id=>{ if (!state.comptes.find(c=>c.id===id)) liquiditesComptesConnus.delete(id); });

  legendWrap.innerHTML = state.comptes.map((c,i)=>`
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:var(--font-mono);font-size:11px">
      <input type="checkbox" style="width:auto" ${liquiditesComptesVisibles.has(c.id)?'checked':''} onchange="toggleLiquiditeCompte('${c.id}', this.checked)">
      <span style="color:${LIQ_PALETTE[i%LIQ_PALETTE.length]}">● ${c.label}</span>
    </label>`).join('');
}

// ── KPIs de trésorerie ──
function renderTresorerieKpis() {
  const liq = getLiquidity();
  const depMoy = getMoyenneDepensesMensuelles(3);
  const moisCouverts = depMoy>0 ? liq.liquid/depMoy : null;

  const totalEl = document.getElementById('liq-total');
  if (totalEl) totalEl.textContent = fmt(liq.liquid);

  const moisEl = document.getElementById('liq-mois-couverts');
  if (moisEl) {
    moisEl.textContent = moisCouverts!==null ? `${moisCouverts.toFixed(1)} mois` : '—';
    moisEl.className = 'card-value ' + (moisCouverts===null ? '' : moisCouverts<3 ? 'red' : moisCouverts<6 ? 'gold' : 'green');
  }
  const subEl = document.getElementById('liq-mois-couverts-sub');
  if (subEl) subEl.textContent = depMoy>0 ? `Basé sur ${fmt(depMoy)}/mois de dépenses (moy. 3 derniers mois)` : 'Pas assez de dépenses enregistrées';

  const minEl = document.getElementById('liq-min-histo');
  const minInfo = getComptesTotalMin();
  if (minEl) minEl.textContent = minInfo ? fmt(minInfo.value) : '—';
  const minSubEl = document.getElementById('liq-min-histo-sub');
  if (minSubEl) minSubEl.textContent = minInfo ? `Atteint en ${minInfo.dateLabel}` : 'Historique insuffisant';
}

// Minimum historique du total des comptes courants (reconstruction exacte, pas une estimation).
function getComptesTotalMin() {
  const points = getComptesHistoryPoints('tout');
  if (!points.length) return null;
  let min = points[0];
  points.forEach(p=>{ if (p.total < min.total) min = p; });
  return {value:min.total, dateLabel: new Date(min.date+'T00:00:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'})};
}

// Reconstruit, pour chaque compte, le solde exact à la fin de chaque mois (ou à aujourd'hui pour le mois en cours).
function getComptesHistoryPoints(periodKey) {
  if (!state.comptes.length) return [];
  const datesAvecCompte = state.budget.filter(b=>b.compteId).map(b=>b.date);
  let startDate = (datesAvecCompte.length ? datesAvecCompte.reduce((a,b)=>a<b?a:b) : today()).slice(0,7)+'-01';

  const periodeDef = PERIODES.find(p=>p.key===periodKey) || PERIODES[3];
  if (periodeDef.mois) {
    const cutoff = addMonths(today(), -periodeDef.mois).slice(0,7)+'-01';
    if (cutoff > startDate) startDate = cutoff;
  }

  const endYm = today().slice(0,7);
  const points = [];
  let cur = startDate;
  let guard = 0;
  while (cur.slice(0,7) <= endYm && guard < 600) {
    const ym = cur.slice(0,7);
    // Fin de mois pour les mois passés ; aujourd'hui pour le mois en cours (jamais dans le futur).
    const cutoff = ym === endYm ? today() : lastDayOfMonth(ym);
    const soldes = {}; let total = 0;
    state.comptes.forEach(c=>{ const v = getSoldeCompte(c.id, cutoff); soldes[c.id]=v; total+=v; });
    points.push({date:cur, soldes, total});
    cur = addMonths(cur, 1);
    guard++;
  }
  return points;
}
function lastDayOfMonth(ym) {
  const [y,m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate(); // jour 0 du mois suivant = dernier jour du mois courant
  return `${ym}-${String(last).padStart(2,'0')}`;
}

// ── Graphique historique (comptes sélectionnables, filtres temporels) ──
function selectLiquiditesPeriode(key) {
  liquiditesPeriod = key;
  document.querySelectorAll('.liq-periode-btn').forEach(b=>b.classList.toggle('active', b.dataset.periode===key));
  renderLiquiditesChart();
}
function toggleLiquiditeCompte(id, checked) {
  if (checked) liquiditesComptesVisibles.add(id); else liquiditesComptesVisibles.delete(id);
  renderLiquiditesChart();
}
function renderLiquiditesChart() {
  const wrap = document.getElementById('liquiditesChartWrap');
  const empty = document.getElementById('liquiditesChartEmpty');
  if (!wrap) return;

  if (!state.comptes.length) {
    wrap.style.display='none';
    if (empty) { empty.style.display='block'; empty.querySelector('.empty-state-text').textContent = 'Ajoutez un compte courant pour voir apparaître son historique de solde.'; }
    return;
  }

  const points = getComptesHistoryPoints(liquiditesPeriod);
  if (points.length < 2) {
    wrap.style.display='none';
    if (empty) { empty.style.display='block'; empty.querySelector('.empty-state-text').textContent = 'Pas assez d\'opérations rattachées à un compte pour tracer un historique sur cette période.'; }
    return;
  }
  wrap.style.display='block';
  if (empty) empty.style.display='none';

  const labels = points.map(p=>new Date(p.date+'T00:00:00').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}));
  const datasets = state.comptes
    .map((c,i)=>({c, color:LIQ_PALETTE[i%LIQ_PALETTE.length]}))
    .filter(({c})=>liquiditesComptesVisibles.has(c.id))
    .map(({c,color})=>({
      label:c.label,
      data:points.map(p=>p.soldes[c.id]||0),
      borderColor:color, backgroundColor:'transparent', tension:.3, borderWidth:2, pointRadius:2
    }));

  if (chartLiquidites) { chartLiquidites.destroy(); chartLiquidites=null; }
  const styleColor = getComputedStyle(document.documentElement);
  const cText3 = styleColor.getPropertyValue('--text3').trim() || '#8a8680';
  chartLiquidites = new Chart(document.getElementById('chartLiquidites').getContext('2d'), {
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
