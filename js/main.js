// ═══════════════════════════════════════
//  POINT D'ENTRÉE — lance l'authentification, qui charge ensuite les données
//  et déclenche le premier rendu (voir auth.js → onAuthReady)
// ═══════════════════════════════════════
initAuth();

// Session laissée ouverte (passage minuit / nouveau mois) ou onglet qui reprend le focus :
// on récupère d'abord une éventuelle version plus récente (autre onglet / appareil), puis on
// applique les récurrences devenues échues.
async function checkAutoSync() {
  if (!document.body.classList.contains('authed')) return;
  let changed = false;
  try { changed = await refreshFromCloudIfChanged(); }
  catch (e) { console.error('Vérification de la version en ligne impossible :', e); }
  if (changed) {
    runAutoSync();
    renderAll(); // la sauvegarde qui suit part de la version qu'on vient de lire : pas de conflit
    notify('Données actualisées depuis un autre appareil');
  } else if (runAutoSync()) renderAll();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkAutoSync();
  else flushCloudSave(); // onglet masqué ou fermé : on n'attend pas la temporisation de 1,2 s
});
window.addEventListener('pagehide', () => { flushCloudSave(); });
setInterval(checkAutoSync, 30*60*1000);
