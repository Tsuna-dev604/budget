// ═══════════════════════════════════════
//  Cours en temps réel (API Alpha Vantage) + cache local + saisie manuelle
// ═══════════════════════════════════════
function openApiSettingsModal() {
  document.getElementById('settApiKey').value = state.settings?.apiKeyAlpha || '';
  document.getElementById('settCacheTtl').value = state.settings?.cacheTtlMin || 15;
  openModal('modalApiSettings');
}
function saveApiSettings() {
  if (!state.settings) state.settings = {};
  state.settings.apiKeyAlpha = document.getElementById('settApiKey').value.trim();
  state.settings.cacheTtlMin = parseInt(document.getElementById('settCacheTtl').value)||15;
  closeModal('modalApiSettings');
  notify('Paramètres API enregistrés');
}

// Cache local (localStorage) pour limiter les appels API et respecter le rate-limiting du quota gratuit
function getCachedPrice(ticker) {
  try {
    const raw = localStorage.getItem('priceCache_'+ticker);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const ttlMs = (state.settings?.cacheTtlMin||15)*60*1000;
    if (Date.now()-data.ts > ttlMs) return null;
    return data;
  } catch { return null; }
}
function setCachedPrice(ticker, price) {
  try { localStorage.setItem('priceCache_'+ticker, JSON.stringify({price, ts:Date.now()})); } catch {}
}

// Interroge Alpha Vantage GLOBAL_QUOTE. Retourne {price} ou lève une erreur.
// Si pas de clé API configurée ou en cas d'échec, on invite l'utilisateur à saisir le cours manuellement (fallback déjà présent sur chaque ligne).
async function fetchStockPrice(ticker) {
  if (!ticker) throw new Error('Ticker manquant');
  const cached = getCachedPrice(ticker);
  if (cached) return {price: cached.price, cached: true};
  const apiKey = state.settings?.apiKeyAlpha;
  if (!apiKey) throw new Error('no_api_key');
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('http_error');
  const data = await res.json();
  const priceStr = data?.['Global Quote']?.['05. price'];
  if (!priceStr) throw new Error(data?.Note ? 'quota' : 'not_found');
  const price = parseFloat(priceStr);
  if (isNaN(price)) throw new Error('parse_error');
  setCachedPrice(ticker, price);
  return {price, cached:false};
}

async function fetchPeaTitreCours(id) {
  const t = state.peaTitres.find(x=>x.id===id);
  if (!t) return;
  if (!t.ticker) { notify('Aucun ticker renseigné pour cette ligne — modifie-la pour en ajouter un, ou saisis le cours manuellement',true); return; }
  try {
    const {price, cached} = await fetchStockPrice(t.ticker);
    t.cours = price;
    t.coursDate = new Date().toLocaleString('fr-FR');
    t.coursSource = cached ? 'Alpha Vantage (cache)' : 'Alpha Vantage';
    notify(`Cours ${t.nom} mis à jour : ${fmt(price)}`);
    renderPeaPortefeuille();
  } catch (e) {
    if (e.message==='no_api_key') notify('Aucune clé API configurée (⚙ Cours API) — mets à jour le cours manuellement',true);
    else if (e.message==='quota') notify('Quota API atteint — mets à jour le cours manuellement en attendant',true);
    else notify('Échec de récupération du cours — mets-le à jour manuellement',true);
  }
}
async function fetchPeaTitreCoursForm() {
  const ticker = document.getElementById('ptTicker').value.trim().toUpperCase();
  if (!ticker) { notify('Renseigne un ticker pour utiliser la récupération automatique',true); return; }
  try {
    const {price, cached} = await fetchStockPrice(ticker);
    document.getElementById('ptCours').value = price;
    document.getElementById('ptCoursMeta').textContent = `Cours récupéré : ${fmt(price)} (${cached?'cache':'Alpha Vantage'}) à l'instant`;
    notify('Cours récupéré, pense à Enregistrer');
  } catch (e) {
    if (e.message==='no_api_key') notify('Aucune clé API configurée — clique sur ⚙ Cours API, ou saisis le cours manuellement ci-dessous',true);
    else if (e.message==='quota') notify('Quota API atteint — saisis le cours manuellement',true);
    else notify('Ticker introuvable ou échec API — saisis le cours manuellement',true);
  }
}
// Actualise tous les cours séquentiellement en respectant le rate-limit gratuit (~5 req/min => 12s d'espacement)
async function refreshAllPeaCours() {
  const titresAvecTicker = state.peaTitres.filter(t=>t.ticker);
  if (!titresAvecTicker.length) { notify('Aucune ligne avec ticker renseigné',true); return; }
  if (!state.settings?.apiKeyAlpha) { notify('Configure une clé API (⚙ Cours API) pour actualiser automatiquement',true); return; }
  notify(`Actualisation de ${titresAvecTicker.length} ligne(s)…`);
  for (let i=0; i<titresAvecTicker.length; i++) {
    const t = titresAvecTicker[i];
    try {
      const {price, cached} = await fetchStockPrice(t.ticker);
      t.cours = price;
      t.coursDate = new Date().toLocaleString('fr-FR');
      t.coursSource = cached ? 'Alpha Vantage (cache)' : 'Alpha Vantage';
    } catch { /* on continue avec les autres lignes, fallback manuel reste possible */ }
    if (i < titresAvecTicker.length-1) await new Promise(r=>setTimeout(r,12000));
  }
  renderPeaPortefeuille();
  notify('Actualisation terminée');
}

