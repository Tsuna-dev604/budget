// ═══════════════════════════════════════
//  Passifs (crédits, dettes)
// ═══════════════════════════════════════
function addPassif() {
  const label      = document.getElementById('pLabel').value.trim();
  const crd        = parseFloat(document.getElementById('pCRD').value)||0;
  const mensualite = parseFloat(document.getElementById('pMensualite').value)||0;
  const taux       = parseFloat(document.getElementById('pTaux').value)||0;
  const echeance   = document.getElementById('pEcheance').value;
  if (!label||crd<=0){notify('Champs invalides',true);return;}
  state.passifs.push({id:uid(),label,crd,mensualite,taux,echeance});
  closeModal('modalPassif');
  ['pLabel','pCRD','pMensualite','pTaux'].forEach(id=>document.getElementById(id).value='');
  notify('Passif enregistré');
  renderAll();
}
function deletePassif(id) {
  if (!confirm('Supprimer ce passif ?')) return;
  state.passifs = state.passifs.filter(p=>p.id!==id);
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
        <td><button class="icon-btn del" onclick="deletePassif('${p.id}')">✕</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:16px">Aucune dette</td></tr>';
}

