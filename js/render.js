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
  const c = syncBiensFromPassifs();   // lie chaque bien à son passif (adoption / création)
  const d = syncAmortissementCredits(); // fait baisser le capital restant dû des crédits
  const e = syncBiensFromPassifs();   // répercute le nouveau capital sur les biens
  return m || a || b || c || d || e;
}
