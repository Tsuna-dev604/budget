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
  renderSimuPatrimoine();
  renderSimuImmobilier();
  renderSimuAV();
  renderObjectifs();
}
function renderAll() {
  renderAllInner();
  scheduleCloudSave(); // sauvegarde automatique (debounced) vers Supabase après chaque modification
}

// Applique tout ce qui est « échu » : opérations récurrentes (salaires, virements…) et
// versements mensuels des actifs. Idempotent. Retourne true si l'état a changé.
function runAutoSync() {
  const m = migratePeaPositions(); // anciennes lignes PEA → positions + achats
  const a = syncRecurrents();
  const b = syncVersementsProgrammes();
  return m || a || b;
}
