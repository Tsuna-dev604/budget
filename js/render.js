// ═══════════════════════════════════════
//  Orchestrateur d'affichage : renderAllInner()
// ═══════════════════════════════════════
function renderAllInner() {
  renderBudgetTable();
  renderComptes();
  renderActifs();
  renderPassifs();
  renderSynthese();
  renderImmobilier();
  renderSalaireBadge();
  renderPeaPortefeuille();
}
function renderAll() {
  renderAllInner();
  scheduleCloudSave(); // sauvegarde automatique (debounced) vers Supabase après chaque modification
}

