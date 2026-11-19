// ═══════════════════════════════════════
//  Export / import JSON local (sauvegarde de secours) — avec contrôle d'intégrité
//
//  Format d'export (enveloppe versionnée) :
//    { app, schemaVersion, exportedAt, counts, checksum:{algo, value}, data }
//  - `data` est une copie de l'état SANS la clé API (un secret n'a pas à vivre dans un fichier de sauvegarde) ;
//  - `checksum` est l'empreinte SHA-256 du JSON canonique (clés triées) de `data` : elle détecte un fichier
//    tronqué, corrompu ou modifié à la main, indépendamment de la mise en forme du fichier.
//
//  Import (jamais destructif par surprise) :
//    1. taille et JSON valides ; 2. version du schéma connue ; 3. empreinte vérifiée ;
//    4. validation structurelle de chaque collection ; 5. résumé + confirmation ;
//    6. sauvegarde automatique de l'état actuel (téléchargée) AVANT remplacement.
//  Les anciens exports (état brut, sans enveloppe) restent importables, avec un avertissement.
// ═══════════════════════════════════════
const EXPORT_APP_ID = 'budget-patrimoine';
const STATE_SCHEMA_VERSION = 1;
const IMPORT_MAX_BYTES = 20*1024*1024;

// Les identifiants sont insérés dans des attributs onclick="f('ID')" : un guillemet ou une apostrophe y
// casserait le JavaScript (esc() ne protège pas dans ce contexte, le navigateur décode l'HTML avant d'exécuter).
// uid() ne produit que [a-z0-9] ; les ids de démonstration ou dérivés (…_a, rec_…) n'utilisent que _ . -.
const ID_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

// Champs obligatoires par collection ('?' = facultatif mais, s'il est présent, du bon type).
// Volontairement minimal : on vérifie la forme dont dépend le code, pas le moindre détail métier.
const STATE_SCHEMA = {
  budget:            {id:'id', date:'date', montant:'number', type:['revenu','depense','virement']},
  actifs:            {id:'id', label:'string', category:['liquide','semiliquide','immobilier','physique'], valeur:'number?'},
  passifs:           {id:'id', label:'string', crd:'number'},
  recurrents:        {id:'id', montant:'number'},
  reglesCateg:       {id:'id', motif:'string'},
  immoBiens:         {id:'id', label:'string', valeur:'number'},
  locataires:        {id:'id', bienId:'string', nom:'string', entree:'string'},
  charges:           {id:'id', bienId:'string', montant:'number'},
  priceHistory:      {id:'id', date:'date', valeur:'number'},
  patrimoineHistory: {date:'date', net:'number'},
  comptes:           {id:'id', label:'string', soldeInitial:'number?'},
  peaComptes:        {id:'id', nom:'string'},
  peaTitres:         {id:'id', compteId:'string', nom:'string'},
  objectifs:         {id:'id', label:'string', cible:'number'},
};

// ── Empreinte ──
function canonicalJson(v) {
  if (Array.isArray(v)) return '['+v.map(canonicalJson).join(',')+']';
  if (v && typeof v==='object') {
    return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(v[k])).join(',')+'}';
  }
  return JSON.stringify(v);
}
// SHA-256 de secours (crypto.subtle n'existe que dans un contexte sécurisé : https, localhost…).
function sha256Fallback(bytes) {
  const primes = [];
  for (let n=2; primes.length<64; n++) if (primes.every(p=>n%p)) primes.push(n);
  const frac = x => ((x-Math.floor(x))*4294967296)>>>0;
  const K = primes.map(p=>frac(Math.cbrt(p)));
  let H = primes.slice(0,8).map(p=>frac(Math.sqrt(p)));
  const len = bytes.length, padded = new Uint8Array(((len+9+63)>>6)<<6);
  padded.set(bytes); padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length-8, Math.floor(len*8/4294967296));
  dv.setUint32(padded.length-4, (len*8)>>>0);
  const w = new Uint32Array(64), rotr = (x,n)=>(x>>>n)|(x<<(32-n));
  for (let off=0; off<padded.length; off+=64) {
    for (let i=0;i<16;i++) w[i] = dv.getUint32(off+i*4);
    for (let i=16;i<64;i++) {
      const s0 = rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);
      const s1 = rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
      w[i] = (w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i=0;i<64;i++) {
      const t1 = (h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
      const t2 = ((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    H = H.map((v,i)=>(v+[a,b,c,d,e,f,g,h][i])>>>0);
  }
  return H.map(v=>v.toString(16).padStart(8,'0')).join('');
}
async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  return sha256Fallback(bytes);
}

// ── Validation structurelle ──
function validateStateShape(data) {
  const errors = [];
  if (!data || typeof data!=='object' || Array.isArray(data)) return ['Les données ne sont pas un objet.'];
  const isDate = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v+'T00:00:00'));
  Object.entries(STATE_SCHEMA).forEach(([coll, spec])=>{
    if (data[coll]===undefined) return; // collection absente : l'état par défaut la fournira
    if (!Array.isArray(data[coll])) { errors.push(`« ${coll} » doit être une liste.`); return; }
    data[coll].forEach((item, i)=>{
      if (errors.length>=8) return;
      if (!item || typeof item!=='object' || Array.isArray(item)) { errors.push(`${coll}[${i}] n'est pas un objet.`); return; }
      Object.entries(spec).forEach(([field, rule])=>{
        const optional = typeof rule==='string' && rule.endsWith('?');
        const kind = optional ? rule.slice(0,-1) : rule;
        const v = item[field];
        if (v===undefined || v===null) { if (!optional) errors.push(`${coll}[${i}] : champ « ${field} » manquant.`); return; }
        const ok = Array.isArray(kind) ? kind.includes(v)
          : kind==='id' ? (typeof v==='string' && ID_PATTERN.test(v))
          : kind==='string' ? typeof v==='string'
          : kind==='number' ? (typeof v==='number' && isFinite(v))
          : kind==='date' ? isDate(v) : true;
        if (!ok) errors.push(`${coll}[${i}] : champ « ${field} » invalide.`);
      });
    });
  });
  (data.peaTitres||[]).forEach((t, i)=>{
    if (errors.length>=8 || !t || t.achats===undefined) return;
    if (!Array.isArray(t.achats)) { errors.push(`peaTitres[${i}] : « achats » doit être une liste.`); return; }
    t.achats.forEach((a, j)=>{
      const ok = a && typeof a==='object' && typeof a.id==='string' && ID_PATTERN.test(a.id)
        && typeof a.quantite==='number' && isFinite(a.quantite) && typeof a.prix==='number' && isFinite(a.prix);
      if (!ok && errors.length<8) errors.push(`peaTitres[${i}].achats[${j}] invalide.`);
    });
  });
  if (data.budgetPrevisionnel!==undefined) {
    const bp = data.budgetPrevisionnel;
    if (!bp || typeof bp!=='object' || Array.isArray(bp) || Object.values(bp).some(v=>typeof v!=='number'||!isFinite(v))) {
      errors.push('« budgetPrevisionnel » invalide.');
    }
  }
  if (data.settings!==undefined && (!data.settings || typeof data.settings!=='object' || Array.isArray(data.settings))) errors.push('« settings » invalide.');
  if (data.salaire!==undefined && data.salaire!==null && (typeof data.salaire!=='object' || Array.isArray(data.salaire))) errors.push('« salaire » invalide.');
  return errors.slice(0,8);
}

// Ne garde que les clés connues de l'état (une clé inattendue du fichier n'entre jamais dans l'application).
function pickKnownState(data) {
  const base = getDefaultState(), out = {};
  Object.keys(base).forEach(k=>{ out[k] = data[k]!==undefined ? data[k] : base[k]; });
  return out;
}

// ── Export ──
async function buildExportEnvelope() {
  const data = JSON.parse(JSON.stringify(state));            // copie profonde, sans undefined/NaN
  if (data.settings) data.settings.apiKeyAlpha = '';         // le secret ne quitte pas l'application
  const counts = {};
  ['budget','actifs','passifs','comptes','immoBiens','peaTitres','objectifs'].forEach(k=>{ counts[k] = (data[k]||[]).length; });
  return {
    app: EXPORT_APP_ID,
    schemaVersion: STATE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    checksum: {algo:'SHA-256', value: await sha256Hex(canonicalJson(data))},
    data
  };
}
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
async function exportData() {
  try {
    const envelope = await buildExportEnvelope();
    downloadJson(envelope, `budget-patrimoine-${today()}.json`);
    try { localStorage.setItem('lastExportAt', envelope.exportedAt); } catch {}
    updateLastExportInfo();
    notify('Données exportées (empreinte '+envelope.checksum.value.slice(0,8)+'…)');
  } catch (e) {
    console.error(e);
    notify('Échec de l\'export', true);
  }
}
function updateLastExportInfo() {
  const el = document.getElementById('lastExportInfo');
  if (!el) return;
  let iso = null;
  try { iso = localStorage.getItem('lastExportAt'); } catch {}
  el.textContent = iso ? 'Dernier export sur cet appareil : '+new Date(iso).toLocaleString('fr-FR') : 'Aucun export effectué sur cet appareil.';
}

// ── Import ──
function importData(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > IMPORT_MAX_BYTES) { notify('Fichier trop volumineux (20 Mo maximum)', true); return; }
  const reader = new FileReader();
  reader.onload = e => { importFromText(String(e.target.result)).catch(err=>{ console.error(err); notify('Erreur lors de l\'import', true); }); };
  reader.onerror = () => notify('Erreur lecture fichier', true);
  reader.readAsText(file);
}

async function importFromText(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { notify('Fichier illisible : ce n\'est pas du JSON valide', true); return; }
  if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) { notify('Format invalide', true); return; }

  let data, verified = false;
  if (parsed.app===EXPORT_APP_ID && parsed.data) {
    if (typeof parsed.schemaVersion!=='number' || parsed.schemaVersion>STATE_SCHEMA_VERSION) {
      notify('Ce fichier vient d\'une version plus récente de l\'application : mettez-la à jour avant d\'importer', true); return;
    }
    if (!parsed.checksum || typeof parsed.checksum.value!=='string') { notify('Fichier sans empreinte : import refusé', true); return; }
    const attendu = parsed.checksum.value.toLowerCase();
    const calcule = await sha256Hex(canonicalJson(parsed.data));
    if (attendu!==calcule) { notify('Intégrité compromise : le fichier est corrompu ou a été modifié. Import annulé.', true); return; }
    data = parsed.data; verified = true;
  } else if (Array.isArray(parsed.budget)) {
    data = parsed; // ancien export brut, sans empreinte
  } else { notify('Format invalide : ce fichier n\'est pas une sauvegarde de l\'application', true); return; }

  const errors = validateStateShape(data);
  if (errors.length) {
    console.error('Import refusé :', errors);
    notify('Fichier invalide : '+errors[0]+(errors.length>1?` (+${errors.length-1} autre(s), voir la console)`:''), true);
    return;
  }

  const n = k => (data[k]||[]).length, cur = k => (state[k]||[]).length;
  const resume = `${n('budget')} opération(s), ${n('actifs')} actif(s), ${n('passifs')} passif(s), ${n('comptes')} compte(s), ${n('immoBiens')} bien(s), ${n('peaTitres')} position(s)`;
  const msg = `Importer cette sauvegarde ?\n\n${resume}\n${verified ? '✔ Intégrité vérifiée (SHA-256).' : '⚠ Ancien format : aucune empreinte, intégrité non vérifiable.'}\n\n`
    + `Cela REMPLACE vos données actuelles (${cur('budget')} opération(s), ${cur('actifs')} actif(s)…) et leur copie en ligne.\n`
    + `Une sauvegarde de vos données actuelles sera d'abord téléchargée.`;
  if (!confirm(msg)) { notify('Import annulé'); return; }

  // Filet de sécurité : l'état actuel est sauvegardé avant tout remplacement.
  try { downloadJson(await buildExportEnvelope(), `budget-patrimoine-AVANT-IMPORT-${today()}.json`); }
  catch (e) { console.error(e); if (!confirm('La sauvegarde automatique a échoué. Continuer quand même ?')) return; }

  const cleKeep = state.settings && state.settings.apiKeyAlpha;
  const next = pickKnownState(data);
  next.settings = {...getDefaultState().settings, ...(next.settings||{}), apiKeyAlpha: cleKeep || (next.settings && next.settings.apiKeyAlpha) || ''};
  state = next;
  runAutoSync();
  renderAll();
  notify('Données importées');
}
