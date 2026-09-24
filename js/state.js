// ═══════════════════════════════════════
//  État global (state) et constantes (catégories, couleurs)
// ═══════════════════════════════════════
let state = { budget: [], actifs: [], passifs: [], salaire: null, immoBiens: [], locataires: [], charges: [], priceHistory: [], patrimoineHistory: [], comptes: [], peaComptes: [], peaTitres: [], budgetPrevisionnel: {}, settings: { apiKeyAlpha: '', cacheTtlMin: 15 } };

const CATEG_DEPENSE = ['Alimentation','Restaurant','Bar / Café','Transport','Carburant','Pressing','Abonnement','Banque','Assurance','Loyer / Logement','Santé','Loisirs','Voyage','Shopping','Virement','Épargne','Autre'];
const CATEG_REVENU  = ['Salaire','Freelance','Loyers perçus','Dividendes','Virement reçu','Prime','Remboursement','Autre'];

const CATEG_COLORS = {
  'Alimentation':'#4caf78','Restaurant':'#e8c97a','Bar / Café':'#c9a84c',
  'Transport':'#4c8fc9','Carburant':'#6ba3d6','Pressing':'#9b59b6',
  'Abonnement':'#e74c3c','Banque':'#8e44ad','Assurance':'#2980b9',
  'Loyer / Logement':'#c0392b','Santé':'#27ae60','Loisirs':'#f39c12',
  'Voyage':'#16a085','Shopping':'#d35400','Virement':'#7f8c8d',
  'Épargne':'#2ecc71','Autre':'#95a5a6',
  'Salaire':'#4caf78','Freelance':'#e8c97a','Loyers perçus':'#c9a84c',
  'Dividendes':'#4c8fc9','Virement reçu':'#9b59b6','Prime':'#27ae60',
  'Remboursement':'#f39c12'
};

let currentBudgetMonth = 'all';
let opActifId = null;
