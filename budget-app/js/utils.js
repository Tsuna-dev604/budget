// ═══════════════════════════════════════
//  Fonctions utilitaires génériques (format, dates, calculs financiers, notifications)
// ═══════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2,9);
const today = () => new Date().toISOString().slice(0,10);
const currentYear = () => new Date().getFullYear();

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

