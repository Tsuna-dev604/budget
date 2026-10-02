// ═══════════════════════════════════════
//  POINT D'ENTRÉE — lance l'authentification, qui charge ensuite les données
//  et déclenche le premier rendu (voir auth.js → onAuthReady)
// ═══════════════════════════════════════
initAuth();

// Session laissée ouverte (passage minuit / nouveau mois) ou onglet qui reprend le focus :
// on applique les récurrences devenues échues.
function checkAutoSync() {
  if (document.body.classList.contains('authed') && runAutoSync()) renderAll();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkAutoSync(); });
setInterval(checkAutoSync, 30*60*1000);
