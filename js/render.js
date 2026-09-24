// ═══════════════════════════════════════
//  Orchestrateur d'affichage : renderAllInner()
// ═══════════════════════════════════════
function renderAllInner() {
  recordPatrimoineSnapshot();
  renderBudgetTable();
  renderComptes();
  renderLiquidites();
  renderActifs();
  renderPassifs();
  renderPatrimoineAllocation();
  renderPatrimoineVariation();
  renderPatrimoineHistorique();
  renderSynthese();
  renderImmobilier();
  renderSalaireBadge();
  renderPeaPortefeuille();
}
function renderAll() {
  renderAllInner();
  scheduleCloudSave(); // sauvegarde automatique (debounced) vers Supabase après chaque modification
}
