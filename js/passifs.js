// ═══════════════════════════════════════
//  Passifs (crédits, dettes) — ajout, édition, suppression
// ═══════════════════════════════════════
function openAddPassif() {
  document.getElementById('passifModalTitle').textContent = 'Nouveau Passif';
  document.getElementById('pEditId').value = '';
  ['pLabel','pCRD','pMensualite','pTaux','pEcheance'].forEach(id=>document.getElementById(id).value='');
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
  if (!label||crd<=0){notify('Champs invalides',true);return;}
  if (editId) {
    const idx = state.passifs.findIndex(x=>x.id===editId);
    if (idx>=0) state.passifs[idx] = {id:editId,label,crd,mensualite,taux,echeance};
  } else {
    state.passifs.push({id:uid(),label,crd,mensualite,taux,echeance});
  }
  closeModal('modalPassif');
  notify(editId?'Passif modifié':'Passif enregistré');
  renderAll();
}
function deletePassif(id) {
  if (!confirm('Supprimer ce passif ?')) return;
  state.passifs = state.passifs.filter(p=>p.id!==id);
  closeModal('modalPassif');
  renderAll();
}
function renderPassifs() {
  document.getElementById('passifTbody').innerHTML = state.passifs.length
    ? state.passifs.map(p=>`<tr>
        <td class="highlight">${p.label}</td>
        <td class="red">${fmt(p.crd)}</td>
        <td>${fmt(p.mensualite)}/mois</td>
        <td>${fmtPct(p.taux)}</td>
        <td>${p.echeance||'—'}</td>
        <td><div class="row-actions">
          <button class="icon-btn" onclick="openEditPassif('${p.id}')" title="Modifier">✎</button>
          <button class="icon-btn del" onclick="deletePassif('${p.id}')" title="Supprimer">✕</button>
        </div></td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">Aucune dette</td></tr>';
}
