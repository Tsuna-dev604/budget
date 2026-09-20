// ═══════════════════════════════════════
//  Thème clair / sombre — mémorisé (localStorage)
//  L'attribut data-theme est déjà posé au plus tôt par le script
//  inline dans <head> (évite le flash). Ce fichier gère juste le
//  bouton bascule et la mise à jour de son libellé.
// ═══════════════════════════════════════
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function updateThemeToggleUI(theme) {
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';
  if (label) label.textContent = theme === 'dark' ? 'Mode sombre' : 'Mode clair';
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre';
}

function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch {}
  updateThemeToggleUI(next);
  // Les graphiques Chart.js sont recréés à chaque rendu : on redessine
  // simplement la section active pour qu'ils reprennent les bonnes couleurs.
  if (document.body.classList.contains('authed') && typeof renderAll === 'function') {
    renderAll();
    const active = document.querySelector('.section.active');
    if (active && active.id === 'diversification' && typeof renderDiversification === 'function') {
      renderDiversification();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => updateThemeToggleUI(getCurrentTheme()));
