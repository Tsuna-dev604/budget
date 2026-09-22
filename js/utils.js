// ═══════════════════════════════════════
//  Fonctions utilitaires génériques (format, dates, calculs financiers, notifications)
// ═══════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2,9);
const today = () => new Date().toISOString().slice(0,10);
const currentYear = () => new Date().getFullYear();

// Filtres temporels standard, réutilisés par tout graphique historique (Synthèse, Liquidités…)
const PERIODES = [
  {key:'1m', label:'1 mois',  mois:1},
  {key:'3m', label:'3 mois',  mois:3},
  {key:'6m', label:'6 mois',  mois:6},
  {key:'1a', label:'1 an',    mois:12},
  {key:'3a', label:'3 ans',   mois:36},
  {key:'5a', label:'5 ans',   mois:60},
  {key:'tout', label:'Tout',  mois:null},
];

function fmt(v, dec=2) {
  if (v===undefined||v===null||isNaN(v)) return '—';
  return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v);
}
function fmtPct(v, dec=2) {
  if (v===undefined||v===null||isNaN(v)) return '—';
  return v.toFixed(dec)+' %';
}
function taxNet(brut, fiscal) {
  if (fiscal==='exonere') return brut;
  if (fiscal==='ps') return brut*(1-0.172);
  if (fiscal==='flat') return brut*(1-0.30);
  return brut;
}
function compoundWithContrib(vi, rAnnuel, nAnnees, mensuel) {
  const rMois = rAnnuel/100/12, n = nAnnees*12;
  if (rMois===0) return vi + mensuel*n;
  return vi*Math.pow(1+rMois,n) + mensuel*((Math.pow(1+rMois,n)-1)/rMois);
}
function compound(vi, r, n) { return vi*Math.pow(1+r/100,n); }

function recordPrice(actifId, valeur, date) {
  if (!state.priceHistory) state.priceHistory = [];
  // Évite les doublons à la même date pour le même actif
  state.priceHistory = state.priceHistory.filter(p=>!(p.id===actifId && p.date===date));
  state.priceHistory.push({id: actifId, date, valeur});
}
function fiscalLabel(f) {
  const m = {exonere:'<span class="badge badge-green">Exonéré</span>',ps:'<span class="badge badge-blue">PS 17.2%</span>',flat:'<span class="badge badge-gold">Flat 30%</span>'};
  return m[f]||'';
}
function notify(msg, err=false) {
  const n = document.getElementById('notif');
  n.textContent = msg;
  n.className = 'notif show'+(err?' error':'');
  setTimeout(()=>n.className='notif', 2800);
}

// Génère les barres "Catégorie — montant (%)" à partir d'une liste d'opérations budget déjà filtrée.
// Utilisé par le récapitulatif de la page Budget ET par le widget "Où va mon argent ?" de la Synthèse.
function categBarListHtml(items, type) {
  const map = {};
  items.filter(b=>b.type===type).forEach(b=>{
    const c = b.categ||'Autre';
    map[c] = (map[c]||0)+b.montant;
  });
  const total = Object.values(map).reduce((a,v)=>a+v,0)||1;
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;align-items:center">
        <span style="color:${CATEG_COLORS[c]||'var(--text3)'}">● ${c}</span>
        <span style="font-family:var(--font-mono);white-space:nowrap">${fmt(v)} <span style="color:var(--text3)">(${fmtPct(v/total*100,0)})</span></span>
      </div>
      <div class="categ-bar-wrap"><div class="categ-bar" style="width:${v/total*100}%;background:${CATEG_COLORS[c]||'var(--text3)'}"></div></div>
    </div>`).join('') || '<div style="color:var(--text3);font-size:12px">Aucune donnée pour cette période</div>';
}
