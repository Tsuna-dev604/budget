// ═══════════════════════════════════════
//  Passifs (crédits, dettes) — ajout, édition, suppression
// ═══════════════════════════════════════
function openAddPassif() {
  document.getElementById('passifModalTitle').textContent = 'Nouveau Passif';
  document.getElementById('pEditId').value = '';
  ['pLabel','pCRD','pMensualite','pTaux','pEcheance'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pJour').value = '1';
  document.getElementById('pDeleteBtn').style.display = 'none';
  openModal('modalPassif');
}
function openEditPassif(id) {
  const p = state.passifs.find(x=>x.id===id);
  if (!p) return;
  document.getElementById('passifModalTitle').textContent = 'Modifier le Passif';
  document.getElementById('pEditId').value = id;
  document.getElementById('pLabel').value = p.label;
  document.getElementById('pCRD').value = p.crd;
  document.getElementById('pMensualite').value = p.mensualite;
  document.getElementById('pTaux').value = p.taux;
  document.getElementById('pEcheance').value = p.echeance||'';
  document.getElementById('pJour').value = p.jour||1;
  document.getElementById('pDeleteBtn').style.display = 'inline-block';
  openModal('modalPassif');
}
function savePassif() {
  const editId     = document.getElementById('pEditId').value;
  const label      = document.getElementById('pLabel').value.trim();
  const crd        = parseFloat(document.getElementById('pCRD').value)||0;
  const mensualite = parseFloat(document.getElementById('pMensualite').value)||0;
  const taux       = parseFloat(document.getElementById('pTaux').value)||0;
  const echeance   = document.getElementById('pEcheance').value;
  const jour       = Math.min(28, Math.max(1, parseInt(document.getElementById('pJour').value)||1));
  if (!label||crd<=0){notify('Champs invalides',true);return;}
  if (editId) {
    const idx = state.passifs.findIndex(x=>x.id===editId);
    // lastAmortYm remis à zéro : le capital saisi est supposé à jour, aucun rattrapage rétroactif.
    // _immoRef conservé : le passif reste lié à son bien immobilier.
    if (idx>=0) state.passifs[idx] = {id:editId,label,crd,mensualite,taux,echeance,jour,_immoRef:state.passifs[idx]._immoRef};
  } else {
    state.passifs.push({id:uid(),label,crd,mensualite,taux,echeance,jour});
  }
  syncBiensFromPassifs();
  syncBiensFromPassifs();
  closeModal('modalPassif');
  notify(editId?'Passif modifié':'Passif enregistré');
  renderAll();
}
function deletePassif(id) {
  const p = state.passifs.find(x=>x.id===id);
  const lie = p && p._immoRef && state.immoBiens.find(b=>b.id===p._immoRef);
  if (!confirm(lie ? `Ce crédit est lié au bien « ${lie.label} ». Le supprimer ramène son capital restant dû à 0. Continuer ?` : 'Supprimer ce passif ?')) return;
  state.passifs = state.passifs.filter(x=>x.id!==id);
  syncBiensFromPassifs();
  closeModal('modalPassif');
  renderAll();
}
function renderPassifs() {
  document.getElementById('passifTbody').innerHTML = state.passifs.length
    ? state.passifs.map(p=>`<tr>
        <td class="highlight">${p._immoRef?'🏠 ':''}${esc(p.label)}</td>
        <td class="red">${fmt(p.crd)}</td>
        <td>${fmt(p.mensualite)}/mois${creditCapitalLabel(p)}</td>
        <td>${fmtPct(p.taux)}</td>
        <td>${p.echeance||'—'}</td>
        <td><div class="row-actions">
          <button class="icon-btn" onclick="openEditPassif('${p.id}')" title="Modifier">✎</button>
          <button class="icon-btn del" onclick="deletePassif('${p.id}')" title="Supprimer">✕</button>
        </div></td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">Aucune dette</td></tr>';
}

// ═══════════════════════════════════════
//  CRÉDITS : amortissement mensuel et lien avec l'immobilier
//
//  Le passif (state.passifs) est la SEULE source de vérité de la dette. Un bien immobilier avec
//  crédit y est rattaché par passif._immoRef = bien.id ; bien.creditCRD / creditMens / tauxCredit
//  n'en sont que le miroir (synchronisé par syncBiensFromPassifs), de sorte que le patrimoine net
//  compte la dette une seule fois.
//
//  Amortissement : chaque mois, au jour de prélèvement, la part d'intérêts (CRD × taux / 12) est
//  retirée de la mensualité et le reste vient diminuer le CRD. Idempotent grâce à lastAmortYm
//  (rattrape les mois manqués, ne double jamais). À la première prise en compte, le CRD saisi est
//  supposé déjà à jour : aucun rattrapage rétroactif. Le paiement de la mensualité elle-même
//  reste à saisir côté Budget (ex. via une dépense récurrente) : elle n'est pas dupliquée ici.
// ═══════════════════════════════════════
function creditCapitalLabel(p) {
  if (!(p.mensualite>0) || !(p.crd>0)) return '';
  const info = getCreditInfo(p.crd, p.taux||0, p.mensualite);
  return info.capitalMensuel>0
    ? `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text3)">dont ${fmt(info.capitalMensuel)} de capital</div>`
    : `<div style="font-family:var(--font-mono);font-size:10px;color:var(--red)">ne couvre pas les intérêts</div>`;
}

// Applique les échéances dues. Retourne true si l'état a changé.
function syncAmortissementCredits() {
  const now = today(), nowYm = now.slice(0,7);
  let changed = false;
  state.passifs.forEach(p=>{
    if (!(p.mensualite>0) || !(p.crd>0)) return;
    const jour = Math.min(Math.max(p.jour||1,1),28);
    const dateDuMois = ym => `${ym}-${pad2(Math.min(jour, daysInMonth(ym)))}`;
    if (!p.lastAmortYm) {
      p.lastAmortYm = dateDuMois(nowYm) <= now ? nowYm : prevYm(nowYm);
      changed = true;
    }
    let guard = 0;
    while (p.crd > 0 && guard++ < 600) {
      const ym = nextYm(p.lastAmortYm);
      if (ym > nowYm || dateDuMois(ym) > now) break;
      const interet = p.crd * (p.taux||0)/100/12;
      const capital = Math.min(p.crd, p.mensualite - interet);
      if (capital <= 0) break; // la mensualité ne couvre pas les intérêts : le capital ne baisse pas
      p.crd = Math.round((p.crd - capital)*100)/100;
      if (p.crd < 0.005) p.crd = 0;
      p.lastAmortYm = ym;
      changed = true;
    }
  });
  return changed;
}

// Rattache à chaque bien avec crédit son passif, et répercute le passif sur le bien (miroir).
// Un passif déjà saisi à la main pour ce crédit (CRD et mensualité proches à ±5 %) est ADOPTÉ
// plutôt que dupliqué ; sinon un passif est créé. Retourne true si l'état a changé.
function syncBiensFromPassifs() {
  let changed = false;
  const proche = (a,b) => b>0 && Math.abs(a-b)/b <= 0.05;
  state.immoBiens.forEach(b=>{
    let p = state.passifs.find(x=>x._immoRef===b.id);
    if (!p && (b.creditCRD||0) > 0) {
      p = state.passifs.find(x=>!x._immoRef && proche(x.crd, b.creditCRD) && proche(x.mensualite||0, b.creditMens||0));
      if (p) { p._immoRef = b.id; }
      else {
        p = {id:uid(), label:`Crédit ${b.label}`, crd:b.creditCRD, mensualite:b.creditMens||0, taux:b.tauxCredit||0, echeance:'', jour:1, _immoRef:b.id};
        state.passifs.push(p);
      }
      changed = true;
    }
    if (p) {
      if (b.creditCRD !== p.crd)             { b.creditCRD = p.crd; changed = true; }
      if ((b.creditMens||0) !== (p.mensualite||0)) { b.creditMens = p.mensualite||0; changed = true; }
      if ((b.tauxCredit||0) !== (p.taux||0)) { b.tauxCredit = p.taux||0; changed = true; }
    }
  });
  // Passif lié à un bien disparu : on coupe le lien (la dette reste suivie).
  state.passifs.forEach(p=>{ if (p._immoRef && !state.immoBiens.some(b=>b.id===p._immoRef)) { delete p._immoRef; changed = true; } });
  return changed;
}
