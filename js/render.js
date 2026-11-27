// ═══════════════════════════════════════
//  Orchestrateur d'affichage : renderAllInner()
// ═══════════════════════════════════════
function renderAllInner() {
  recordPatrimoineSnapshot();
  renderBudgetTable();
  renderComptes();
  renderLiquidites();
  renderVirementsEpargne();
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
  updateLastExportInfo();
  renderNavAdmin();
  renderSyntheseAdmin();
}
function renderAll() {
  // La sauvegarde cloud ne doit jamais dépendre du rendu : une erreur d'affichage ne doit pas faire perdre
  // les opérations qui viennent d'être générées ou saisies.
  try { renderAllInner(); }
  finally { scheduleCloudSave(); } // sauvegarde automatique (debounced) vers Supabase après chaque modification
}

// Ce que la dernière synchronisation a ajouté : sert à prévenir l'utilisateur (voir notifySyncReport).
let lastSyncReport = {recurrents:[], versements:[]};

// Applique tout ce qui est « échu » : opérations récurrentes (salaires, virements…) et
// virements d'épargne vers les livrets. Idempotent. Retourne true si l'état a changé.
// Chaque étape est isolée : une erreur dans l'une (donnée inattendue, par ex.) ne bloque pas les autres.
function runAutoSync() {
  lastSyncReport = {recurrents:[], versements:[]};
  const etapes = [
    migratePeaPositions,        // anciennes lignes PEA → positions + achats
    migrateVirementsEpargne,    // anciens virements d'épargne « dépense » → type virement
    migrateComptesHorsBudget,   // Caisse d'Épargne : hors périmètre du budget
    syncRecurrents,             // salaires, virements reçus, dépenses fixes
    syncVersementsProgrammes,   // virements compte → livrets
    syncBiensFromPassifs,       // lie chaque bien à son passif (adoption / création)
    syncAmortissementCredits,   // fait baisser le capital restant dû des crédits
    syncBiensFromPassifs,       // répercute le nouveau capital sur les biens
  ];
  let changed = false;
  etapes.forEach(etape=>{
    try { if (etape()) changed = true; }
    catch (e) { console.error(`Synchronisation « ${etape.name} » en échec :`, e); }
  });
  return changed;
}

// Message court récapitulant ce que la dernière synchronisation a ajouté. Retourne false s'il n'y a rien à dire.
function notifySyncReport() {
  const r = lastSyncReport, parts = [];
  const plur = n => n>1 ? 's' : '';
  if (r.recurrents.length) parts.push(`${r.recurrents.length} opération${plur(r.recurrents.length)} récurrente${plur(r.recurrents.length)}`);
  if (r.versements.length) parts.push(`${r.versements.length} virement${plur(r.versements.length)} d'épargne`);
  if (!parts.length) return false;
  notify('Ajouté automatiquement : '+parts.join(' · '));
  return true;
}
