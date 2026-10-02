// ═══════════════════════════════════════
//  OBJECTIFS (Phase 9, §22) — montant cible, montant actuel, échéance,
//  progression et effort d'épargne mensuel nécessaire. Le montant actuel
//  est de préférence relié à une donnée réellement suivie (patrimoine net,
//  un compte, le portefeuille PEA/CTO) plutôt que ressaisi à la main —
//  on ne duplique la saisie manuelle que quand aucune source réelle ne convient.
// ═══════════════════════════════════════
function toggleObjectifSourceFields() {
  const source = document.getElementById('oSource').value;
  document.getElementById('oCompteWrap').style.display = source==='compte' ? 'block' : 'none';
  document.getElementById('oActifWrap').style.display = source==='actif' ? 'block' : 'none';
  document.getElementById('oManuelWrap').style.display = source==='manuel' ? 'block' : 'none';
  if (source==='compte') {
    const sel = document.getElementById('oCompteId');
    sel.innerHTML = state.comptes.map(c=>`<option value="${c.id}">${c.label}</option>`).join('') || '<option value="">— Aucun compte —</option>';
  }
  if (source==='actif') {
    const sel = document.getElementById('oActifId');
    sel.innerHTML = state.actifs.map(a=>`<option value="${a.id}">${a.label}</option>`).join('') || '<option value="">— Aucun actif —</option>';
  }
}
function openAddObjectif() {
  document.getElementById('objectifModalTitle').textContent = 'Nouvel Objectif';
  document.getElementById('oEditId').value = '';
  document.getElementById('oLabel').value = '';
  document.getElementById('oSource').value = 'manuel';
  document.getElementById('oMontantManuel').value = '';
  document.getElementById('oCible').value = '';
  document.getElementById('oEcheance').value = '';
  document.getElementById('oDeleteBtn').style.display = 'none';
  toggleObjectifSourceFields();
  openModal('modalObjectif');
}
function openEditObjectif(id) {
  const o = state.objectifs.find(x=>x.id===id);
  if (!o) return;
  document.getElementById('objectifModalTitle').textContent = 'Modifier l\'Objectif';
  document.getElementById('oEditId').value = id;
  document.getElementById('oLabel').value = o.label;
  document.getElementById('oSource').value = o.source;
  document.getElementById('oCible').value = o.cible;
  document.getElementById('oEcheance').value = o.echeance||'';
  toggleObjectifSourceFields();
  if (o.source==='compte') document.getElementById('oCompteId').value = o.compteId||'';
  if (o.source==='actif') document.getElementById('oActifId').value = o.actifId||'';
  if (o.source==='manuel') document.getElementById('oMontantManuel').value = o.montantManuel||0;
  document.getElementById('oDeleteBtn').style.display = 'inline-block';
  openModal('modalObjectif');
}
function saveObjectif() {
  const editId = document.getElementById('oEditId').value;
  const label = document.getElementById('oLabel').value.trim();
  const source = document.getElementById('oSource').value;
  const cible = parseFloat(document.getElementById('oCible').value)||0;
  const echeance = document.getElementById('oEcheance').value;
  const compteId = document.getElementById('oCompteId').value;
  const actifId = document.getElementById('oActifId').value;
  const montantManuel = parseFloat(document.getElementById('oMontantManuel').value)||0;
  if (!label||cible<=0) { notify('Libellé et montant cible requis',true); return; }
  const objectif = {id:editId||uid(), label, source, cible, echeance, compteId, actifId, montantManuel};
  if (editId) {
    const idx = state.objectifs.findIndex(o=>o.id===editId);
    if (idx>=0) state.objectifs[idx] = objectif;
  } else {
    state.objectifs.push(objectif);
  }
  closeModal('modalObjectif');
  notify(editId?'Objectif modifié':'Objectif enregistré');
  renderAll();
}
function deleteObjectif(id) {
  if (!confirm('Supprimer cet objectif ?')) return;
  state.objectifs = state.objectifs.filter(o=>o.id!==id);
  closeModal('modalObjectif');
  renderAll();
}

// Montant actuel réellement suivi, selon la source choisie — jamais inventé.
function getObjectifMontantActuel(o) {
  if (o.source==='patrimoine') return getPatrimoineNet();
  if (o.source==='pea') return getTotalPeaPortefeuille();
  if (o.source==='compte') return getSoldeCompte(o.compteId);
  if (o.source==='actif') return state.actifs.find(a=>a.id===o.actifId)?.valeur || 0;
  return o.montantManuel||0; // manuel
}
const OBJECTIF_SOURCE_LABELS = {patrimoine:'Patrimoine net', compte:'Compte suivi', actif:'Actif suivi', pea:'PEA / CTO', manuel:'Suivi manuel'};

// Nombre de mois entre aujourd'hui et l'échéance (YYYY-MM). Négatif si dépassée.
function moisJusquA(echeanceYYYYMM) {
  if (!echeanceYYYYMM) return null;
  const [y,m] = echeanceYYYYMM.split('-').map(Number);
  const now = new Date();
  return (y-now.getFullYear())*12 + (m-(now.getMonth()+1));
}

function renderObjectifs() {
  const container = document.getElementById('objectifsList');
  if (!container) return;
  if (!state.objectifs.length) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">🎯</div>
          <div class="empty-state-title">Aucun objectif</div>
          <div class="empty-state-text">Définissez un objectif (sécurité financière, apport immobilier, patrimoine cible…) pour suivre sa progression et l'effort d'épargne mensuel nécessaire.</div>
        </div>
      </div>`;
    return;
  }
  container.innerHTML = `<div class="grid-2">${state.objectifs.map(o=>{
    const actuel = getObjectifMontantActuel(o);
    const pct = o.cible>0 ? (actuel/o.cible*100) : 0;
    const atteint = actuel >= o.cible;
    const mois = moisJusquA(o.echeance);
    const compteNom = o.source==='compte' ? (state.comptes.find(c=>c.id===o.compteId)?.label || '—')
      : o.source==='actif' ? (state.actifs.find(a=>a.id===o.actifId)?.label || '—') : '';

    let effortHtml;
    if (atteint) {
      effortHtml = `<span style="color:var(--green);font-weight:600">✓ Objectif atteint</span>`;
    } else if (mois===null) {
      effortHtml = `<span style="color:var(--text3)">Aucune échéance définie</span>`;
    } else if (mois<=0) {
      effortHtml = `<span style="color:var(--red);font-weight:600">Échéance dépassée</span>`;
    } else {
      const effort = (o.cible-actuel)/mois;
      effortHtml = `<span style="color:var(--text2)">Effort nécessaire : </span><span style="font-family:var(--font-mono);font-weight:600;color:var(--gold)">${fmt(effort)}/mois</span>`;
    }

    return `<div class="card">
      <div class="card-header">
        <span class="card-title">${o.label}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="badge badge-blue">${OBJECTIF_SOURCE_LABELS[o.source]}${compteNom?' — '+compteNom:''}</span>
          <button class="icon-btn" onclick="openEditObjectif('${o.id}')" title="Modifier">✎</button>
          <button class="icon-btn del" onclick="deleteObjectif('${o.id}')" title="Supprimer">✕</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin:12px 0 6px 0">
        <span style="font-family:var(--font-mono);font-size:18px;font-weight:700;color:${atteint?'var(--green)':'var(--text)'}">${fmt(actuel)}</span>
        <span style="font-family:var(--font-mono);font-size:13px;color:var(--text3)">/ ${fmt(o.cible)}</span>
      </div>
      <div class="progress-track"><div class="progress-fill${atteint?' over':''}" style="width:${Math.min(100,Math.max(0,pct))}%"></div></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px">
        <span style="color:var(--text3)">${fmtPct(pct,0)}${o.echeance?' · échéance '+new Date(o.echeance+'-01').toLocaleDateString('fr-FR',{month:'long',year:'numeric'}):''}</span>
        ${effortHtml}
      </div>
    </div>`;
  }).join('')}</div>`;
}
