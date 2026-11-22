// ═══════════════════════════════════════
//  ÉPARGNE AUTOMATIQUE — virements programmés d'un compte courant vers un livret
//
//  Un virement programmé se configure sur l'actif (livret, PEL, assurance-vie…) :
//    mensuel (montant), jourVersement (1-31), compteSourceId (compte débité, facultatif).
//  Chaque mois, au jour choisi et jamais en avance :
//    - la valeur du livret augmente du montant ;
//    - le compte source est débité par une opération de Budget de type « virement ».
//
//  Pourquoi un type « virement » : l'argent ne sort pas du patrimoine, il change de poche.
//  Ce n'est ni une dépense (il ne doit pas gonfler les dépenses, fausser le taux d'épargne,
//  les anomalies ou le nombre de mois de dépenses couverts) ni un revenu. Le solde du compte
//  baisse bien du montant, le livret monte d'autant : le patrimoine net ne bouge pas.
//
//  Idempotent : lastVersementYm mémorise le dernier mois appliqué (pas de doublon ; les mois
//  manqués sont rattrapés à l'ouverture). À la création, la valeur saisie du livret est supposée
//  à jour : le 1er virement automatique est la prochaine échéance, sauf case « inclure ce mois-ci ».
// ═══════════════════════════════════════
const EPARGNE_CATEGORIES = ['liquide','semiliquide'];
const epargneCibles = () => state.actifs.filter(a=>EPARGNE_CATEGORIES.includes(a.category));
const compteExiste = id => !!id && state.comptes.some(c=>c.id===id);

// Anciennes données : les virements d'épargne étaient enregistrés comme des dépenses « Épargne ».
function migrateVirementsEpargne() {
  let changed = false;
  state.budget.forEach(b=>{ if (b._versementActif && b.type==='depense') { b.type = 'virement'; changed = true; } });
  return changed;
}

// Prochaine échéance d'un virement : après le dernier mois appliqué ; sans historique, la première
// échéance encore à venir (ou celle de ce mois-ci si `inclureCeMois` et que son jour est passé).
function calcProchainVirement(jour, lastYm, inclureCeMois) {
  const now = today(), nowYm = now.slice(0,7);
  if (lastYm) return dateEcheance(nextYm(lastYm), jour);
  const ceMois = dateEcheance(nowYm, jour);
  if (ceMois > now) return ceMois;
  return inclureCeMois ? ceMois : dateEcheance(nextYm(nowYm), jour);
}
const getVersementProchaineDate = a => a.mensuel>0 ? calcProchainVirement(a.jourVersement, a.lastVersementYm, false) : null;

// Applique les virements échus. Retourne true si l'état a changé.
function syncVersementsProgrammes() {
  const now = today(), nowYm = now.slice(0,7);
  let changed = false;
  state.actifs.forEach(a=>{
    if (!(a.mensuel>0) || !EPARGNE_CATEGORIES.includes(a.category)) {
      if (a.lastVersementYm) { delete a.lastVersementYm; changed = true; } // virement arrêté : pas de rattrapage s'il reprend
      return;
    }
    if (!a.lastVersementYm) {
      a.lastVersementYm = dateEcheance(nowYm, a.jourVersement) <= now ? nowYm : prevYm(nowYm);
      changed = true;
    }
    const debite = compteExiste(a.compteSourceId);
    let guard = 0;
    while (guard++ < 600) {
      const ym = nextYm(a.lastVersementYm);
      if (ym > nowYm) break;
      const date = dateEcheance(ym, a.jourVersement);
      if (date > now) break;
      const dejaFait = debite && state.budget.some(b=>b._versementActif===a.id && b._ym===ym);
      if (!dejaFait) {
        a.valeur = (a.valeur||0) + a.mensuel;
        a.dernierVersementDate = date;
        recordPrice(a.id, a.valeur, date);
        if (debite) {
          state.budget.push({id:uid(), label:`Versement ${a.label}`, categ:'Épargne', montant:a.mensuel, type:'virement', date, compteId:a.compteSourceId, _versementActif:a.id, _ym:ym});
        }
        lastSyncReport.versements.push({label:a.label, montant:a.mensuel, date, debite});
      }
      a.lastVersementYm = ym;
      changed = true;
    }
  });
  return changed;
}

// Total viré vers l'épargne ce mois-ci (opérations déjà effectuées), pour le « Flux du mois ».
function getVirementsEpargneMois() {
  const now = today(), ym = now.slice(0,7);
  return getBudgetOps().filter(b=>b.type==='virement' && b.date.startsWith(ym) && b.date<=now).reduce((s,b)=>s+b.montant,0);
}

// Supprimer un virement du Budget doit aussi défaire son effet sur le livret : sinon le livret reste
// crédité d'un argent qui est pourtant revenu sur le compte, et le patrimoine net est faussé.
function retirerVirementDuLivret(b) {
  const a = state.actifs.find(x=>x.id===b._versementActif);
  if (!a) return;
  if (confirm(`Ce virement avait aussi crédité « ${a.label} » de ${fmt(b.montant)}.\n\nOK = retirer ce montant du livret · Annuler = le conserver`)) {
    a.valeur = Math.max(0, (a.valeur||0) - b.montant);
    recordPrice(a.id, a.valeur, today());
  }
}

// ═══════════════════════════════════════
//  PAGE LIQUIDITÉS — liste des virements programmés
// ═══════════════════════════════════════
function renderVirementsEpargne() {
  const wrap = document.getElementById('virementsEpargneList');
  if (!wrap) return;
  const sub = document.getElementById('virementsEpargneSub');
  const plans = epargneCibles().filter(a=>a.mensuel>0);
  if (!plans.length) {
    if (sub) sub.textContent = '';
    wrap.innerHTML = `<div class="empty-state" style="padding:32px 24px">
      <div class="empty-state-icon">🔁</div>
      <div class="empty-state-title">Aucun virement programmé</div>
      <div class="empty-state-text">Programmez un virement mensuel depuis un compte vers un livret : il est appliqué au jour choisi, débite le compte et crédite le livret, sans compter comme une dépense.</div>
    </div>`;
    return;
  }
  const total = plans.reduce((s,a)=>s+a.mensuel,0);
  const sorties = plans.filter(a=>compteExiste(a.compteSourceId)).reduce((s,a)=>s+a.mensuel,0);
  if (sub) sub.textContent = `${fmt(total)}/mois programmés · ${fmt(sorties)}/mois débités de vos comptes`;
  const horsComptes = plans.some(a=>!compteExiste(a.compteSourceId));
  const now = today();
  wrap.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Vers</th><th>Depuis</th><th>Montant</th><th>Jour</th><th>Prochain</th><th>Dernier</th><th></th></tr></thead>
      <tbody>${plans.map(a=>{
        const prochain = getVersementProchaineDate(a);
        const debite = compteExiste(a.compteSourceId);
        return `<tr>
          <td class="highlight">${esc(a.label)}</td>
          <td>${debite ? esc(compteLabel(a.compteSourceId)) : '<span style="color:var(--text3)" title="Le livret est crédité sans débiter de compte suivi">Hors comptes suivis</span>'}</td>
          <td class="gold">${fmt(a.mensuel)}</td>
          <td>le ${a.jourVersement||1}</td>
          <td>${prochain ? (prochain<=now ? '<span class="badge badge-gold">À appliquer</span>' : fmtDateFr(prochain)) : '—'}</td>
          <td style="color:var(--text3)">${a.dernierVersementDate ? fmtDateFr(a.dernierVersementDate) : '—'}</td>
          <td><div class="row-actions">
            <button class="icon-btn" onclick="openVirementEpargne('${a.id}')" title="Modifier">✎</button>
            <button class="icon-btn del" onclick="stopVirementEpargne('${a.id}')" title="Arrêter">✕</button>
          </div></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    ${horsComptes ? '<p style="font-size:11px;color:var(--text3);margin-top:10px">Un virement « hors comptes suivis » crédite le livret sans débiter de compte : le patrimoine net augmente d\'autant. Choisissez un compte source pour qu\'il reste neutre.</p>' : ''}`;
}

// ═══════════════════════════════════════
//  MODALE — créer / modifier un virement programmé
// ═══════════════════════════════════════
function openVirementEpargne(actifId) {
  const cibles = epargneCibles();
  if (!cibles.length) { notify('Ajoutez d\'abord un livret ou un actif d\'épargne (page Patrimoine)', true); return; }
  document.getElementById('vrActif').innerHTML = cibles.map(a=>`<option value="${a.id}">${esc(a.label)}</option>`).join('');
  document.getElementById('vrCompte').innerHTML = '<option value="">— Hors comptes suivis —</option>' +
    state.comptes.map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join('');
  const a = (actifId && cibles.find(x=>x.id===actifId)) || cibles.find(x=>!(x.mensuel>0)) || cibles[0];
  document.getElementById('vrActif').value = a.id;
  document.getElementById('vrModalTitle').textContent = actifId ? 'Modifier le virement programmé' : 'Nouveau virement programmé';
  fillVirementForm(a);
  openModal('modalVirement');
}
function fillVirementForm(a) {
  const plan = a.mensuel>0;
  document.getElementById('vrMontant').value = plan ? a.mensuel : '';
  document.getElementById('vrJour').value = plan ? (a.jourVersement||1) : 1;
  document.getElementById('vrCompte').value = plan ? (a.compteSourceId||'') : (state.comptes[0] ? state.comptes[0].id : '');
  document.getElementById('vrRattrapage').checked = false;
  document.getElementById('vrRattrapageWrap').style.display = plan ? 'none' : 'block';
  document.getElementById('vrStopBtn').style.display = plan ? 'inline-block' : 'none';
  updateVirementInfo();
}
function onVirementActifChange() {
  const a = state.actifs.find(x=>x.id===document.getElementById('vrActif').value);
  if (a) fillVirementForm(a);
}
function updateVirementInfo() {
  const a = state.actifs.find(x=>x.id===document.getElementById('vrActif').value);
  const info = document.getElementById('vrInfo');
  if (!a || !info) return;
  const jour = clampJourMois(document.getElementById('vrJour').value);
  const inclure = document.getElementById('vrRattrapage').checked;
  const date = calcProchainVirement(jour, a.mensuel>0 ? a.lastVersementYm : null, inclure);
  const horsComptes = !compteExiste(document.getElementById('vrCompte').value);
  info.innerHTML = `Prochain virement : <strong>${fmtDateFr(date)}</strong>`
    + (horsComptes ? '<br><span style="color:var(--gold)">Sans compte source, le livret est crédité sans débiter de compte (le patrimoine net augmente).</span>' : '');
}
function saveVirementEpargne() {
  const a = state.actifs.find(x=>x.id===document.getElementById('vrActif').value);
  const montant = parseFloat(document.getElementById('vrMontant').value);
  if (!a) { notify('Choisissez un livret', true); return; }
  if (!montant || montant<=0) { notify('Montant mensuel requis', true); return; }
  const nouveau = !(a.mensuel>0);
  Object.assign(a, {
    mensuel: montant,
    jourVersement: clampJourMois(document.getElementById('vrJour').value),
    compteSourceId: document.getElementById('vrCompte').value || null
  });
  if (nouveau) {
    // « Inclure ce mois-ci » : on repart du mois précédent pour que l'échéance du mois soit appliquée tout de suite.
    if (document.getElementById('vrRattrapage').checked) a.lastVersementYm = prevYm(today().slice(0,7));
    else delete a.lastVersementYm;
  }
  closeModal('modalVirement');
  runAutoSync();
  renderAll();
  notify(nouveau ? 'Virement programmé enregistré' : 'Virement programmé modifié');
}
function stopVirementEpargne(actifId) {
  const a = state.actifs.find(x=>x.id===(actifId || document.getElementById('vrActif').value));
  if (!a) return;
  if (!confirm(`Arrêter le virement programmé vers « ${a.label} » ?\n\nLes virements déjà effectués sont conservés.`)) return;
  a.mensuel = 0;
  delete a.lastVersementYm;
  closeModal('modalVirement');
  notify('Virement programmé arrêté');
  renderAll();
}
