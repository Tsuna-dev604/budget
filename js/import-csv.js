// ═══════════════════════════════════════
//  IMPORT CSV de relevés bancaires → opérations du Budget
//
//  Traitement 100 % local : le fichier est lu dans le navigateur (FileReader), jamais envoyé
//  à un service tiers. Seules les opérations que vous validez entrent dans vos données.
//  Garde-fous :
//   - taille et nombre de lignes plafonnés ;
//   - texte importé nettoyé (caractères de contrôle, < >) ET échappé à l'affichage ;
//   - aperçu obligatoire avant tout import, rien n'est écrit sans validation ;
//   - détection des doublons (réimporter le même mois ne duplique rien) ;
//   - « Annuler le dernier import » pour revenir en arrière.
// ═══════════════════════════════════════
const CSV_MAX_BYTES = 5*1024*1024;
const CSV_MAX_ROWS = 5000;
let csvImport = null; // {table, delim, headerIdx, rows, invalid, manual, toggle}

// ── Fonctions pures (testables) ──
function normTxt(s) {
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
}
// Les exports bancaires français sont souvent en Windows-1252 : UTF-8 strict d'abord, repli sinon.
function csvDecode(buf) {
  try { return new TextDecoder('utf-8',{fatal:true}).decode(buf).replace(/^\uFEFF/,''); }
  catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}
function csvDetectDelim(text) {
  const lines = text.split(/\r?\n/).filter(l=>l.trim()).slice(0,12);
  let best = ';', bestScore = 0;
  [';','\t',',','|'].forEach(d=>{
    const counts = lines.map(l=>l.split(d).length-1).sort((a,b)=>a-b);
    const median = counts[Math.floor(counts.length/2)] || 0;
    if (median > bestScore) { best = d; bestScore = median; }
  });
  return best;
}
function csvParse(text, delim) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i=0; i<text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i+1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
      if (rows.length > CSV_MAX_ROWS + 50) break;
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r=>r.some(c=>String(c).trim()!==''));
}
function csvParseDate(s) {
  s = String(s||'').trim(); let m, y, mo, d;
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) { y=+m[1]; mo=+m[2]; d=+m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})(?!\d)/))) { d=+m[1]; mo=+m[2]; y=+m[3]; if (m[3].length===2) y+=2000; }
  else return null;
  const dt = new Date(y, mo-1, d);
  if (dt.getFullYear()!==y || dt.getMonth()!==mo-1 || dt.getDate()!==d) return null;
  if (y < 2000 || y > new Date().getFullYear()+1) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}
function csvParseAmount(s) {
  let t = String(s||'').replace(/[\s\u00a0€$]|EUR/gi,'').replace(/\u2212/g,'-');
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1,-1); }
  const hasC = t.includes(','), hasD = t.includes('.');
  if (hasC && hasD) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g,'').replace(',','.') : t.replace(/,/g,'');
  else if (hasC) t = t.replace(',','.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
  const v = parseFloat(t);
  return neg ? -v : v;
}
function csvCleanLabel(s) {
  return String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
}
function csvKey(compteId, date, type, montant, label) {
  return [compteId||'', date, type, Number(montant).toFixed(2), normTxt(label)].join('|');
}
// Ligne d'en-tête : la 1re ligne (parmi les 20 premières) qui mentionne une date ET un montant/libellé ;
// sinon la ligne 0. Les éventuelles lignes de préambule de la banque sont ainsi ignorées.
function csvFindHeader(table) {
  for (let i=0; i<Math.min(20,table.length); i++) {
    const n = table[i].map(normTxt);
    if (n.some(c=>/date/.test(c)) && n.some(c=>/libell|montant|debit|credit|description|operation/.test(c))) return {idx:i, hasHeader:true};
  }
  return {idx:0, hasHeader: !table[0] || !table[0].some(c=>csvParseDate(c)!==null)};
}
function csvGuessColumns(table, headerIdx, hasHeader) {
  const ncol = Math.max(...table.slice(0,30).map(r=>r.length));
  const g = {date:-1, label:-1, debit:-1, credit:-1, montant:-1};
  if (hasHeader) {
    const n = (table[headerIdx]||[]).map(normTxt);
    const find = (re, not) => n.findIndex(c=>re.test(c) && !(not && not.test(c)));
    g.date = find(/date.*operation|operation.*date/); if (g.date<0) g.date = find(/date/, /valeur/); if (g.date<0) g.date = find(/date/);
    g.label = find(/libell|description|intitul|detail|reference|nom/, /date/);
    g.debit = find(/debit/); g.credit = find(/credit/);
    if (g.debit<0 && g.credit<0) g.montant = find(/montant|amount|somme/);
  }
  if (g.date<0 || (g.debit<0 && g.credit<0 && g.montant<0)) { // repli : analyse des données
    const sample = table.slice(hasHeader?headerIdx+1:headerIdx, (hasHeader?headerIdx+1:headerIdx)+10);
    for (let c=0;c<ncol;c++) {
      const col = sample.map(r=>r[c]);
      if (g.date<0 && col.length && col.every(v=>csvParseDate(v)!==null)) g.date = c;
      else if (g.montant<0 && g.debit<0 && g.credit<0 && col.length && col.every(v=>csvParseAmount(v)!==null)) g.montant = c;
    }
  }
  if (g.label<0) { // colonne texte la plus longue
    let best = -1, len = 0;
    for (let c=0;c<ncol;c++) {
      if ([g.date,g.debit,g.credit,g.montant].includes(c)) continue;
      const l = table.slice(headerIdx+1, headerIdx+11).reduce((s,r)=>s+String(r[c]||'').length,0);
      if (l > len) { len = l; best = c; }
    }
    g.label = best;
  }
  return g;
}

// ── Interface ──
function csvCategOptions(type, selected) {
  const list = type==='depense' ? CATEG_DEPENSE : CATEG_REVENU;
  return list.map(c=>`<option value="${esc(c)}"${c===selected?' selected':''}>${esc(c)}</option>`).join('');
}
function csvAutoCateg(label, type) {
  const n = normTxt(label);
  const r = (state.reglesCateg||[]).find(x=>x.type===type && normTxt(x.motif) && n.includes(normTxt(x.motif)));
  const list = type==='depense' ? CATEG_DEPENSE : CATEG_REVENU;
  return r && list.includes(r.categ) ? r.categ : 'Autre';
}

function openImportCsv() {
  csvImport = null;
  populateCompteSelects();
  if (state.comptes.length===1) document.getElementById('csvCompte').value = state.comptes[0].id;
  document.getElementById('csvFile').value = '';
  document.getElementById('csvFileName').textContent = '';
  document.getElementById('csvMapping').style.display = 'none';
  document.getElementById('csvSummary').textContent = '';
  document.getElementById('csvPreview').innerHTML = '';
  document.getElementById('csvConfirmBtn').disabled = true;
  document.getElementById('csvConfirmBtn').textContent = 'Importer';
  csvRulesRender();
  csvUndoButtonState();
  openModal('modalImportCsv');
}

function csvOnFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > CSV_MAX_BYTES) { notify('Fichier trop volumineux (5 Mo maximum)', true); event.target.value=''; return; }
  document.getElementById('csvFileName').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text = csvDecode(e.target.result);
      const delim = csvDetectDelim(text);
      const table = csvParse(text, delim);
      if (table.length < 2) { notify('Fichier vide ou illisible', true); return; }
      const {idx, hasHeader} = csvFindHeader(table);
      const g = csvGuessColumns(table, idx, hasHeader);
      csvImport = {table, delim, headerIdx:idx, rows:[], invalid:0, manual:{}, toggle:{}};
      const ncol = Math.max(...table.slice(0,30).map(r=>r.length));
      const head = hasHeader ? table[idx] : [];
      const opts = '<option value="">— aucune —</option>' + Array.from({length:ncol},(_,i)=>`<option value="${i}">${esc(`Col. ${i+1}${head[i]?' — '+String(head[i]).slice(0,28):''}`)}</option>`).join('');
      [['csvColDate',g.date],['csvColLabel',g.label],['csvColMontant',g.montant],['csvColDebit',g.debit],['csvColCredit',g.credit]].forEach(([id,v])=>{
        const el = document.getElementById(id); el.innerHTML = opts; el.value = v>=0 ? String(v) : '';
      });
      document.getElementById('csvHasHeader').checked = hasHeader;
      document.getElementById('csvMapping').style.display = 'block';
      csvRebuild();
    } catch (err) {
      console.error(err);
      notify('Impossible de lire ce fichier', true);
    }
  };
  reader.readAsArrayBuffer(file);
}

function csvRebuild() {
  const c = csvImport;
  if (!c) return;
  const col = id => { const v = document.getElementById(id).value; return v==='' ? -1 : parseInt(v); };
  const iDate=col('csvColDate'), iLabel=col('csvColLabel'), iMont=col('csvColMontant'), iDeb=col('csvColDebit'), iCred=col('csvColCredit');
  const compteId = document.getElementById('csvCompte').value || null;
  const start = document.getElementById('csvHasHeader').checked ? c.headerIdx+1 : 0;

  // Opérations déjà présentes (même compte) : pour repérer doublons et opérations déjà générées par un récurrent
  const existing = {}, recKeys = new Set();
  state.budget.forEach(b=>{
    if ((b.compteId||null) !== compteId) return;
    const k = csvKey(compteId, b.date, b.type, b.montant, b.label);
    existing[k] = (existing[k]||0) + 1;
    if (b._recId) recKeys.add([b.type, Number(b.montant).toFixed(2), b.date.slice(0,7)].join('|'));
  });

  const rows = []; let invalid = 0; const seen = {};
  c.table.slice(start).forEach((r, k)=>{
    const i = start + k;
    const date = iDate>=0 ? csvParseDate(r[iDate]) : null;
    let type = null, montant = null;
    if (iMont >= 0) {
      const v = csvParseAmount(r[iMont]);
      if (v !== null && v !== 0) { type = v<0 ? 'depense' : 'revenu'; montant = Math.abs(v); }
    } else {
      const d = iDeb>=0 ? csvParseAmount(r[iDeb]) : null, cr = iCred>=0 ? csvParseAmount(r[iCred]) : null;
      if (d) { type = 'depense'; montant = Math.abs(d); }
      else if (cr) { type = 'revenu'; montant = Math.abs(cr); }
    }
    if (!date || !type || rows.length >= CSV_MAX_ROWS) { invalid++; return; }
    const label = csvCleanLabel(iLabel>=0 ? r[iLabel] : '') || 'Opération importée';
    const key = csvKey(compteId, date, type, montant, label);
    seen[key] = (seen[key]||0) + 1;
    const dup = seen[key] <= (existing[key]||0);
    const dupRec = !dup && recKeys.has([type, montant.toFixed(2), date.slice(0,7)].join('|'));
    rows.push({i, date, label, type, montant, dup, dupRec, auto:csvAutoCateg(label,type)});
  });
  c.rows = rows; c.invalid = invalid;
  csvRenderPreview();
}

const csvCategOf = r => (csvImport.manual[r.i] !== undefined ? csvImport.manual[r.i] : r.auto);
const csvIncluded = r => csvImport.toggle[r.i] !== undefined ? csvImport.toggle[r.i] : (!r.dup && !r.dupRec);

function csvRenderPreview() {
  const c = csvImport;
  const el = document.getElementById('csvPreview');
  if (!c.rows.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Aucune opération lisible avec ce mappage. Vérifiez les colonnes choisies ci-dessus.</div>';
    csvUpdateSummary();
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th style="width:34px"></th><th>Date</th><th>Libellé</th><th>Catégorie</th><th style="text-align:right">Montant</th><th>Statut</th></tr></thead>
    <tbody>${c.rows.map(r=>`
      <tr style="${(r.dup||r.dupRec)?'opacity:.6':''}">
        <td><input type="checkbox" ${csvIncluded(r)?'checked':''} onchange="csvToggleRow(${r.i}, this.checked)"></td>
        <td class="highlight">${r.date}</td>
        <td>${esc(r.label)}</td>
        <td><select style="padding:4px 8px;font-size:12px;width:auto" onchange="csvSetCateg(${r.i}, this.value)">${csvCategOptions(r.type, csvCategOf(r))}</select></td>
        <td class="${r.type==='revenu'?'green':'red'}" style="text-align:right">${r.type==='revenu'?'+':'−'}${fmt(r.montant)}</td>
        <td>${r.dup?'<span class="badge badge-gray">Déjà importée</span>':r.dupRec?'<span class="badge badge-gold">Déjà générée (récurrent)</span>':'<span class="badge badge-green">Nouvelle</span>'}</td>
      </tr>`).join('')}</tbody></table>`;
  csvUpdateSummary();
}
function csvUpdateSummary() {
  const c = csvImport;
  const n = c.rows.filter(csvIncluded).length;
  const dup = c.rows.filter(r=>r.dup).length, dupRec = c.rows.filter(r=>r.dupRec).length;
  const parts = [`${c.rows.length} opération(s) lue(s)`, `${n} sélectionnée(s)`];
  if (dup) parts.push(`${dup} déjà importée(s)`);
  if (dupRec) parts.push(`${dupRec} déjà générée(s) par un récurrent`);
  if (c.invalid) parts.push(`${c.invalid} ligne(s) ignorée(s) (date ou montant illisible)`);
  document.getElementById('csvSummary').textContent = parts.join(' · ');
  const btn = document.getElementById('csvConfirmBtn');
  btn.disabled = n === 0;
  btn.textContent = n ? `Importer ${n} opération${n>1?'s':''}` : 'Importer';
}
function csvToggleRow(i, checked) { csvImport.toggle[i] = checked; csvUpdateSummary(); }
function csvSetCateg(i, v) { csvImport.manual[i] = v; }

function csvConfirmImport() {
  if (!csvImport) return;
  const sel = csvImport.rows.filter(csvIncluded);
  if (!sel.length) { notify('Aucune opération sélectionnée', true); return; }
  const compteId = document.getElementById('csvCompte').value || null;
  const batch = 'imp_' + Date.now();
  sel.forEach(r=>{
    state.budget.push({id:uid(), label:r.label, categ:csvCategOf(r), montant:r.montant, type:r.type, date:r.date, compteId, _importId:batch});
  });
  closeModal('modalImportCsv');
  csvImport = null;
  notify(`${sel.length} opération${sel.length>1?'s':''} importée${sel.length>1?'s':''}`);
  renderAll();
}

// ── Annulation du dernier import ──
function csvLastBatch() {
  const ids = state.budget.map(b=>b._importId).filter(Boolean).sort();
  return ids.length ? ids[ids.length-1] : null;
}
function csvUndoButtonState() {
  const btn = document.getElementById('csvUndoBtn');
  if (btn) btn.style.display = csvLastBatch() ? 'inline-block' : 'none';
}
function undoLastImport() {
  const batch = csvLastBatch();
  if (!batch) return;
  const n = state.budget.filter(b=>b._importId===batch).length;
  if (!confirm(`Supprimer les ${n} opération(s) du dernier import ?`)) return;
  state.budget = state.budget.filter(b=>b._importId!==batch);
  csvUndoButtonState();
  notify(`${n} opération(s) supprimée(s)`);
  renderAll();
}

// ── Règles de catégorisation : « le libellé contient X → catégorie Y » ──
function csvRuleTypeChanged() {
  const type = document.getElementById('csvRuleType').value;
  document.getElementById('csvRuleCateg').innerHTML = csvCategOptions(type, '');
}
function csvRulesRender() {
  csvRuleTypeChanged();
  const rules = state.reglesCateg || [];
  document.getElementById('csvRulesList').innerHTML = rules.length ? rules.map(r=>`
    <div class="alloc-row">
      <div><span style="font-family:var(--font-mono);font-size:12px;color:var(--text)">contient « ${esc(r.motif)} »</span>
        <span style="color:var(--text3);margin:0 8px">→</span>${esc(r.categ)}
        <span class="badge ${r.type==='revenu'?'badge-green':'badge-red'}" style="margin-left:8px">${r.type==='revenu'?'Revenu':'Dépense'}</span></div>
      <button class="icon-btn del" onclick="csvDeleteRule('${r.id}')">✕</button>
    </div>`).join('') : '<div style="color:var(--text3);font-size:12px;padding:6px 0">Aucune règle. Exemple : « CARREFOUR » → Alimentation.</div>';
}
function csvAddRule() {
  const motif = document.getElementById('csvRuleMotif').value.trim().slice(0,60);
  if (normTxt(motif).length < 2) { notify('Motif trop court (2 caractères minimum)', true); return; }
  if (!state.reglesCateg) state.reglesCateg = [];
  state.reglesCateg.push({id:uid(), motif, type:document.getElementById('csvRuleType').value, categ:document.getElementById('csvRuleCateg').value});
  document.getElementById('csvRuleMotif').value = '';
  scheduleCloudSave();
  csvRulesRender();
  csvRebuild();
}
function csvDeleteRule(id) {
  state.reglesCateg = (state.reglesCateg||[]).filter(r=>r.id!==id);
  scheduleCloudSave();
  csvRulesRender();
  csvRebuild();
}
