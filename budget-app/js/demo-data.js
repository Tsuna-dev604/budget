// ═══════════════════════════════════════
//  Jeu de données de démonstration (loadDemo) — non appelé automatiquement
// ═══════════════════════════════════════
function loadDemo() {
  const d = (y,m,j) => `${y}-${String(m).padStart(2,'0')}-${String(j).padStart(2,'0')}`;
  const y = currentYear();
  state.comptes = [
    {id:'cpt_courant',label:'Compte Courant Principal',banque:'CIC',soldeInitial:2500},
    {id:'cpt_joint',label:'Compte Joint',banque:'Boursorama',soldeInitial:800},
  ];
  const cptC = 'cpt_courant', cptJ = 'cpt_joint';
  state.budget = [
    // Janvier
    {id:uid(),label:'Salaire net',categ:'Salaire',montant:3200,type:'revenu',date:d(y,1,1),compteId:cptC},
    {id:uid(),label:'Revenus locatifs',categ:'Loyers perçus',montant:850,type:'revenu',date:d(y,1,2),compteId:cptJ},
    {id:uid(),label:'Loyer appartement',categ:'Loyer / Logement',montant:1100,type:'depense',date:d(y,1,3),compteId:cptC},
    {id:uid(),label:'Courses Carrefour',categ:'Alimentation',montant:280,type:'depense',date:d(y,1,8),compteId:cptJ},
    {id:uid(),label:'Restaurant Septime',categ:'Restaurant',montant:95,type:'depense',date:d(y,1,12),compteId:cptC},
    {id:uid(),label:'Metro / Navigo',categ:'Transport',montant:86,type:'depense',date:d(y,1,5),compteId:cptC},
    {id:uid(),label:'Netflix + Spotify',categ:'Abonnement',montant:28,type:'depense',date:d(y,1,5),compteId:cptC},
    {id:uid(),label:'Pressing pressing',categ:'Pressing',montant:45,type:'depense',date:d(y,1,15),compteId:cptJ},
    {id:uid(),label:'Frais bancaires CIC',categ:'Banque',montant:9,type:'depense',date:d(y,1,20),compteId:cptC},
    {id:uid(),label:'Bar Le Perchoir',categ:'Bar / Café',montant:62,type:'depense',date:d(y,1,19),compteId:cptC},
    // Février
    {id:uid(),label:'Salaire net',categ:'Salaire',montant:3200,type:'revenu',date:d(y,2,1),compteId:cptC},
    {id:uid(),label:'Revenus locatifs',categ:'Loyers perçus',montant:850,type:'revenu',date:d(y,2,2),compteId:cptJ},
    {id:uid(),label:'Loyer appartement',categ:'Loyer / Logement',montant:1100,type:'depense',date:d(y,2,3),compteId:cptC},
    {id:uid(),label:'Courses bio',categ:'Alimentation',montant:310,type:'depense',date:d(y,2,7),compteId:cptJ},
    {id:uid(),label:'Sushi Yoshi',categ:'Restaurant',montant:55,type:'depense',date:d(y,2,14),compteId:cptC},
    {id:uid(),label:'Uber',categ:'Transport',montant:34,type:'depense',date:d(y,2,10),compteId:cptC},
    {id:uid(),label:'Assurance vie',categ:'Assurance',montant:80,type:'depense',date:d(y,2,15),compteId:cptC},
    // Mars
    {id:uid(),label:'Salaire net',categ:'Salaire',montant:3200,type:'revenu',date:d(y,3,1),compteId:cptC},
    {id:uid(),label:'Prime Q1',categ:'Prime',montant:1500,type:'revenu',date:d(y,3,15),compteId:cptC},
    {id:uid(),label:'Revenus locatifs',categ:'Loyers perçus',montant:850,type:'revenu',date:d(y,3,2),compteId:cptJ},
    {id:uid(),label:'Loyer appartement',categ:'Loyer / Logement',montant:1100,type:'depense',date:d(y,3,3),compteId:cptC},
    {id:uid(),label:'Courses semaine',categ:'Alimentation',montant:260,type:'depense',date:d(y,3,9),compteId:cptJ},
    {id:uid(),label:'Week-end Amsterdam',categ:'Voyage',montant:480,type:'depense',date:d(y,3,22),compteId:cptC},
    {id:uid(),label:'Pressing Mars',categ:'Pressing',montant:38,type:'depense',date:d(y,3,12),compteId:cptJ},
  ];
  state.actifs = [
    {id:uid(),label:'Livret A',category:'liquide',valeur:22950,mensuel:0,loyer:0,taux:3.0,fiscal:'exonere'},
    {id:uid(),label:'LDDS',category:'liquide',valeur:12000,mensuel:0,loyer:0,taux:3.0,fiscal:'exonere'},
    {id:uid(),label:'PEL CIC',category:'semiliquide',valeur:15000,mensuel:45,loyer:0,taux:2.25,fiscal:'flat'},
    {id:uid(),label:'PEA — MSCI World (Amundi)',category:'semiliquide',valeur:45000,mensuel:300,loyer:0,taux:8.0,fiscal:'ps'},
    {id:uid(),label:'CTO — ETF S&P 500',category:'semiliquide',valeur:12500,mensuel:100,loyer:0,taux:9.5,fiscal:'flat'},
    {id:uid(),label:'Assurance Vie (fonds €)',category:'semiliquide',valeur:18000,mensuel:200,loyer:0,taux:2.8,fiscal:'flat'},
    {id:uid(),label:'Appartement Paris 13e',category:'immobilier',valeur:320000,mensuel:0,loyer:850,taux:3.5,fiscal:'ps'},
    {id:uid(),label:'Studio Lyon Confluence',category:'immobilier',valeur:145000,mensuel:0,loyer:620,taux:4.0,fiscal:'ps'},
    {id:uid(),label:'Rolex Submariner 126610',category:'physique',subtype:'montre',achat:9500,valeur:14200,evolPhys:8},
    {id:uid(),label:'Tableau — Artiste Contemporain',category:'physique',subtype:'art',achat:3200,valeur:4100,evolPhys:5},
    {id:uid(),label:'BMW M3 2021',category:'physique',subtype:'voiture',achat:72000,valeur:58000,evolPhys:-8},
  ];
  state.salaire = {
    label: 'Salaire net', montant: 3200, jour: 1, categ: 'Salaire', compteId: cptC,
    fromMonth: 1, fromYear: y, toMonth: null, toYear: null
  };
  state.immoBiens = [
    {id:'immo1',label:'Appartement Paris 13e',valeur:320000,acquisition:290000,loyer:850,creditCRD:185000,creditMens:920,apprec:3,fiscal:'nu',adresse:'45 avenue d\'Italie, 75013 Paris'},
    {id:'immo2',label:'Studio Lyon Confluence',valeur:145000,acquisition:132000,loyer:620,creditCRD:62000,creditMens:420,apprec:2.5,fiscal:'lmnp',adresse:'12 rue Montrochet, 69002 Lyon'},
  ];
  state.locataires = [
    {id:uid(),bienId:'immo1',nom:'Martin Sophie',entree:`${y-2}-09-01`,sortie:`${y-1}-08-31`,loyer:800,caution:800,notes:'EDL sortant bon état'},
    {id:uid(),bienId:'immo1',nom:'Leroy Thomas & Alice',entree:`${y-1}-09-15`,sortie:'',loyer:850,caution:850,notes:'Bail 3 ans reconduit'},
    {id:uid(),bienId:'immo2',nom:'Dubois Clément',entree:`${y}-01-01`,sortie:'',loyer:620,caution:620,notes:'Étudiant - garant parents'},
  ];
  state.charges = [
    {id:uid(),bienId:'immo1',type:'taxe_fonciere',label:'Taxe foncière 2024',montant:1800,freq:'annuel',date:`${y}-10-15`},
    {id:uid(),bienId:'immo1',type:'assurance_pno',label:'Assurance PNO',montant:240,freq:'annuel',date:`${y}-01-01`},
    {id:uid(),bienId:'immo1',type:'assurance_loyers',label:'GLI Garantie Loyers',montant:80,freq:'mensuel',date:`${y}-01-01`},
    {id:uid(),bienId:'immo1',type:'copropriete',label:'Charges copropriété',montant:180,freq:'mensuel',date:`${y}-01-01`},
    {id:uid(),bienId:'immo1',type:'gestion',label:'Commission agence',montant:72,freq:'mensuel',date:`${y}-01-01`},
    {id:uid(),bienId:'immo2',type:'taxe_fonciere',label:'Taxe foncière 2024',montant:650,freq:'annuel',date:`${y}-10-15`},
    {id:uid(),bienId:'immo2',type:'assurance_pno',label:'Assurance PNO',montant:120,freq:'annuel',date:`${y}-01-01`},
    {id:uid(),bienId:'immo2',type:'copropriete',label:'Charges copropriété',montant:80,freq:'mensuel',date:`${y}-01-01`},
    {id:uid(),bienId:'immo2',type:'entretien',label:'Entretien chaudière',montant:150,freq:'annuel',date:`${y}-03-15`},
  ];
  state.passifs = [
    {id:uid(),label:'Crédit immobilier Paris 13e',crd:185000,mensualite:920,taux:1.35,echeance:'2038-06-01'},
    {id:uid(),label:'Crédit immobilier Lyon',crd:62000,mensualite:420,taux:1.85,echeance:'2034-03-01'},
  ];
  // Historique démo — points sur les 12 derniers mois
  state.priceHistory = [];
  const livretA  = state.actifs.find(a=>a.label==='Livret A');
  const ldds     = state.actifs.find(a=>a.label==='LDDS');
  const rolex    = state.actifs.find(a=>a.label==='Rolex Submariner 126610');
  const tableau  = state.actifs.find(a=>a.label==='Tableau — Artiste Contemporain');
  const livretAHist = [18200,18700,19100,19400,19800,20200,20700,21100,21500,22000,22450,22950];
  const lddsHist    = [10000,10200,10400,10600,10800,11000,11200,11400,11600,11800,11900,12000];
  const rolexHist   = [9500,10200,10800,11200,11500,11800,12100,12500,12900,13400,13800,14200];
  const tableauHist = [3200,3300,3350,3400,3500,3600,3700,3750,3850,3950,4050,4100];
  for (let m=0; m<12; m++) {
    const mo = ((new Date().getMonth() - 11 + m + 12) % 12) + 1;
    const yr = new Date().getFullYear() + (new Date().getMonth() - 11 + m < 0 ? -1 : 0);
    const date = `${yr}-${String(mo).padStart(2,'0')}-01`;
    if (livretA)  state.priceHistory.push({id:livretA.id,  date, valeur:livretAHist[m]});
    if (ldds)     state.priceHistory.push({id:ldds.id,     date, valeur:lddsHist[m]});
    if (rolex)    state.priceHistory.push({id:rolex.id,    date, valeur:rolexHist[m]});
    if (tableau)  state.priceHistory.push({id:tableau.id,  date, valeur:tableauHist[m]});
  }
  state.peaComptes = [
    {id:'pea1', type:'PEA', nom:'PEA Boursorama', banque:'Boursorama', plafond:150000, courtagePct:0.5, gardePct:0},
    {id:'pea2', type:'PEA-PME', nom:'PEA-PME CIC', banque:'CIC', plafond:225000, courtagePct:0.5, gardePct:0.4},
    {id:'cto1', type:'CTO', nom:'CTO Trade Republic', banque:'Trade Republic', plafond:0, courtagePct:0, gardePct:0},
  ];
  state.peaTitres = [
    {id:uid(), compteId:'pea1', nom:'LVMH', ticker:'MC.PAR', date:`${y-6}-03-12`, quantite:5, prix:720.00, devise:'EUR', frais:6.50, fxFraisPct:0, ter:0, ttf:true, cours:640.00},
    {id:uid(), compteId:'pea1', nom:'ETF Amundi MSCI World', ticker:'CW8.PAR', date:`${y-6}-06-01`, quantite:120, prix:410.00, devise:'EUR', frais:24.60, fxFraisPct:0, ter:0.38, ttf:false, cours:452.30},
    {id:uid(), compteId:'pea1', nom:'Air Liquide', ticker:'AI.PAR', date:`${y}-01-15`, quantite:12, prix:165.00, devise:'EUR', frais:9.90, fxFraisPct:0, ter:0, ttf:false, cours:172.40},
    {id:uid(), compteId:'pea2', nom:'TotalEnergies', ticker:'TTE.PAR', date:`${y}-02-20`, quantite:20, prix:58.50, devise:'EUR', frais:5.85, fxFraisPct:0, ter:0, ttf:true, cours:56.10},
    {id:uid(), compteId:'cto1', nom:'Apple Inc.', ticker:'AAPL', date:`${y}-01-08`, quantite:8, prix:185.20, devise:'USD', frais:1.00, fxFraisPct:0.25, ter:0, ttf:false, cours:198.50},
    {id:uid(), compteId:'cto1', nom:'ETF S&P 500 (Physique)', ticker:'PE500.PAR', date:`${y-1}-09-10`, quantite:45, prix:38.40, devise:'EUR', frais:3.20, fxFraisPct:0, ter:0.15, ttf:false, cours:41.90},
  ];
  state.settings = { apiKeyAlpha: '', cacheTtlMin: 15 };
  applySalaire();
}
