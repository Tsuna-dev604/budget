// ═══════════════════════════════════════
//  Calculs de patrimoine — fonctions centralisées, réutilisées par
//  synthese.js, patrimoine-detail.js et (plus tard) simulations.js.
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

// Répartition factuelle par enveloppe fiscale (en %, sans score arbitraire) — §14
function getAllocationFiscale() {
  const totalComptesFisc = getTotalComptes();
  const map = {exonere:0, ps:0, flat:0, immobilier:0};
  map.exonere += totalComptesFisc; // comptes courants : pas de fiscalité de détention
  state.actifs.forEach(a=>{
    const v = a.valeur||0;
    if (a.category==='physique') return; // fiscalité plus-value au cas par cas, non modélisée ici
    if (a.category==='immobilier') { map.immobilier += v; return; }
    if (a.fiscal==='ps') map.ps += v;
    else if (a.fiscal==='flat') map.flat += v;
    else map.exonere += v;
  });
  const total = Object.values(map).reduce((a,v)=>a+v,0);
  return {map, total};
}

// Signale les concentrations importantes avec une formulation neutre, factuelle — §14.
// Pas de score, pas de jugement de valeur : un simple constat chiffré.
function getConcentrationNotes() {
  const {groups, total} = getAllocationClasses();
  if (!total) return [];
  const CAT_LABELS = {liquide:'Les liquidités représentent',semiliquide:'Les actifs financiers (PEA, CTO, assurance-vie…) représentent',immobilier:'L\'immobilier représente',physique:'Les biens physiques représentent'};
  const notes = [];
  Object.entries(groups).forEach(([k,v])=>{
    const pct = v/total*100;
    if (pct >= 60) notes.push(`${CAT_LABELS[k]} ${fmtPct(pct,0)} du patrimoine total.`);
  });
  return notes;
}

// ═══════════════════════════════════════
//  HISTORIQUE DU PATRIMOINE (base réelle, §15)
//  Un point = un instantané réel du jour, enregistré à chaque rendu.
//  On ne reconstruit jamais de données passées fictives : l'historique
//  se construit uniquement à partir d'aujourd'hui. Chaque point conserve
//  aussi les sous-totaux par classe d'actif, utilisés par la décomposition
//  de la variation du patrimoine (§6).
// ═══════════════════════════════════════
function recordPatrimoineSnapshot() {
  if (!state.patrimoineHistory) state.patrimoineHistory = [];
  const date = today();
  const comptes = getTotalComptes();
  const {groups} = getAllocationClasses(); // {liquide (hors comptes), semiliquide, immobilier, physique}
  const actifs = getTotalActifs() + comptes;
  const passifs = getTotalPassifs();
  const net = actifs - passifs;
  const point = {
    date, actifs, passifs, net,
    liquide: groups.liquide, // inclut déjà les comptes (getAllocationClasses les additionne)
    semiliquide: groups.semiliquide,
    immobilier: groups.immobilier,
    physique: groups.physique,
  };
  const existing = state.patrimoineHistory.find(p=>p.date===date);
  if (existing) {
    // Un seul point par jour : on met à jour la valeur du jour (dernier état connu)
    Object.assign(existing, point);
  } else {
    state.patrimoineHistory.push(point);
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
// Sous-total (liquide/semiliquide/immobilier/physique/actifs/passifs) à une date donnée ou avant.
// Retourne null si aucun point disponible, ou si le point trouvé ne contient pas encore ce champ
// (anciens instantanés enregistrés avant l'ajout des sous-totaux) — on n'invente jamais de valeur.
function getSubtotalAt(field, dateStr) {
  if (!state.patrimoineHistory || !state.patrimoineHistory.length) return null;
  const candidats = state.patrimoineHistory.filter(p=>p.date<=dateStr);
  if (!candidats.length) return null;
  const point = candidats[candidats.length-1];
  return (point[field]===undefined) ? null : point[field];
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

// ═══════════════════════════════════════
//  DÉCOMPOSITION DE LA VARIATION DU PATRIMOINE (§6)
//  Explique la variation du mois en cours à partir de données réelles :
//  épargne (budget), remboursement de capital (passifs), variation immobilière
//  et performance des investissements (sous-totaux d'historique). Le résidu
//  ("autres variations") absorbe ce qui n'est pas décomposable avec certitude —
//  jamais de valeur inventée pour "faire tomber juste".
// ═══════════════════════════════════════
function getDecompositionMoisCourant() {
  const now = new Date();
  const debutMois = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const dateRef = addMonths(debutMois, -1); // dernier instantané connu avant le 1er du mois
  const netDebut = getPatrimoineNetAt(dateRef);
  const finDebutFinancier = getSubtotalAt('semiliquide', dateRef);
  const finDebutImmo = getSubtotalAt('immobilier', dateRef);
  const finDebutPassifs = (function(){
    if (!state.patrimoineHistory) return null;
    const c = state.patrimoineHistory.filter(p=>p.date<=dateRef);
    return c.length ? c[c.length-1].passifs : null;
  })();

  if (netDebut===null || finDebutFinancier===null || finDebutImmo===null || finDebutPassifs===null) {
    return null; // historique pas encore assez profond/détaillé pour ce mois — on ne fabrique rien
  }

  const netFin = getPatrimoineNet();
  const financierFin = state.actifs.filter(a=>a.category==='semiliquide').reduce((s,a)=>s+(a.valeur||0),0);
  const immoFin = state.actifs.filter(a=>a.category==='immobilier').reduce((s,a)=>s+(a.valeur||0),0);
  const passifsFin = getTotalPassifs();

  const variationTotale = netFin - netDebut;
  const epargne = getEpargneMoisCourant().solde;
  const remboursementCredit = finDebutPassifs - passifsFin; // dette qui diminue = capital remboursé
  const variationImmobiliere = immoFin - finDebutImmo;

  // Performance investissements = variation des actifs financiers − versements mensuels programmés
  // sur ces mêmes actifs (déjà comptés dans l'épargne). Estimation, clairement présentée comme telle.
  const versementsProgrammes = state.actifs.filter(a=>a.category==='semiliquide').reduce((s,a)=>s+(a.mensuel||0),0);
  const performanceInvest = (financierFin - finDebutFinancier) - versementsProgrammes;

  const autres = variationTotale - epargne - remboursementCredit - variationImmobiliere - performanceInvest;

  return {debutMois, netDebut, netFin, variationTotale, epargne, performanceInvest, remboursementCredit, variationImmobiliere, autres};
}
