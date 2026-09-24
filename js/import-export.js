// ═══════════════════════════════════════
//  Import / export JSON local (sauvegarde de secours)
// ═══════════════════════════════════════
function exportData() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`heritage-os-${today()}.json`;
  a.click();
  notify('Données exportées');
}
function importData(event) {
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{const p=JSON.parse(e.target.result);if(p.budget!==undefined){
      state={budget:[],actifs:[],passifs:[],salaire:null,immoBiens:[],locataires:[],charges:[],priceHistory:[],patrimoineHistory:[],comptes:[],peaComptes:[],peaTitres:[],budgetPrevisionnel:{},settings:{apiKeyAlpha:'',cacheTtlMin:15},...p};
      renderAll();notify('Données importées');
    }else notify('Format invalide',true);}
    catch{notify('Erreur lecture fichier',true);}
  };
  reader.readAsText(file);
  event.target.value='';
}
