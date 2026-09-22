// ═══════════════════════════════════════
//  Calculs de patrimoine — fonctions centralisées, réutilisées par
//  synthese.js, diversification.js et (plus tard) patrimoine/simulations.
// ═══════════════════════════════════════
function getTotalComptes() {
  return state.comptes.reduce((s,c)=>s+getSoldeCompte(c.id),0);
}
function getTotalActifs() {
  return state.actifs.reduce((s,a)=>s+(a.valeur||0),0);
}
function getTotalPassifs() {
  return state.passifs.reduce((s,p)=>s+(p.crd||0),0);
}
function getPatrimoineNet() {
  return getTotalActifs() + getTotalComptes() - getTotalPassifs();
}

// Épargne du mois calendaire en cours — sert de "capacité d'épargne mensuelle".
// (Ne pas confondre avec l'épargne cumulée depuis toujours.)
function getEpargneMoisCourant() {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const items = state.budget.filter(b=>b.date.startsWith(ym));
  const rev = items.filter(b=>b.type==='revenu').reduce((s,b)=>s+b.montant,0);
  const dep = items.filter(b=>b.type==='depense').reduce((s,b)=>s+b.montant,0);
  return {rev,dep,solde:rev-dep};
}
// Épargne cumulée depuis le début (toutes opérations confondues).
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

// Répartition factuelle par classe d'actif (en %, sans score arbitraire) — §14
function getAllocationClasses() {
  const groups = {liquide:0,semiliquide:0,immobilier:0,physique:0};
  state.actifs.forEach(a=>groups[a.category||'liquide']+=(a.valeur||0));
  groups.liquide += getTotalComptes();
  const total = Object.values(groups).reduce((a,v)=>a+v,0);
  return {groups, total};
}

// Répartit un montant d'épargne entre "cash conservé" et "investi", sur la base des
// versements mensuels déjà programmés sur les actifs liquides/semi-liquides (aMensuel).
// Ne fabrique aucune donnée : purement dérivé des versements réellement configurés.
function getCashInvestiSplit(soldeMontant) {
  const investiConfigure = state.actifs
    .filter(a=>a.category==='liquide'||a.category==='semiliquide')
    .reduce((s,a)=>s+(a.mensuel||0),0);
  const investi = Math.max(0, Math.min(soldeMontant, investiConfigure));
  const cash = soldeMontant - investi;
  return {cash, investi};
}

// ═══════════════════════════════════════
//  HISTORIQUE DU PATRIMOINE (base réelle, §15)
//  Un point = un instantané réel du jour, enregistré à chaque rendu.
//  On ne reconstruit jamais de données passées fictives : l'historique
//  se construit uniquement à partir d'aujourd'hui.
// ═══════════════════════════════════════
function recordPatrimoineSnapshot() {
  if (!state.patrimoineHistory) state.patrimoineHistory = [];
  const date = today();
  const actifs = getTotalActifs() + getTotalComptes();
  const passifs = getTotalPassifs();
  const net = actifs - passifs;
  const existing = state.patrimoineHistory.find(p=>p.date===date);
  if (existing) {
    // Un seul point par jour : on met à jour la valeur du jour (dernier état connu)
    existing.actifs = actifs; existing.passifs = passifs; existing.net = net;
  } else {
    state.patrimoineHistory.push({date, actifs, passifs, net});
    state.patrimoineHistory.sort((a,b)=>a.date.localeCompare(b.date));
  }
}

// Valeur nette à une date donnée ou avant (dernier point connu ≤ date) — utilisé pour les variations
function getPatrimoineNetAt(dateStr) {
  if (!state.patrimoineHistory || !state.patrimoineHistory.length) return null;
  const candidats = state.patrimoineHistory.filter(p=>p.date<=dateStr);
  if (!candidats.length) return null;
  return candidats[candidats.length-1].net;
}
function addMonths(dateStr, n) {
  const d = new Date(dateStr+'T00:00:00');
  d.setMonth(d.getMonth()+n);
  return d.toISOString().slice(0,10);
}
// Variation du patrimoine net sur N mois, basée sur l'historique réel disponible.
// Retourne null si pas assez d'historique (on n'invente jamais de valeur).
function getVariationPatrimoine(nbMois) {
  if (!state.patrimoineHistory || state.patrimoineHistory.length<2) return null;
  const netActuel = getPatrimoineNet();
  const dateRef = addMonths(today(), -nbMois);
  const premierPoint = state.patrimoineHistory[0];
  if (premierPoint.date > dateRef) return null; // historique pas assez profond
  const netRef = getPatrimoineNetAt(dateRef);
  if (netRef===null) return null;
  return {delta: netActuel-netRef, pct: netRef!==0 ? (netActuel-netRef)/Math.abs(netRef)*100 : null};
}
