// ═══════════════════════════════════════
//  Salaire récurrent et application automatique au budget
// ═══════════════════════════════════════
function openSalaireModal() {
  const s = state.salaire;
  populateCompteSelects();
  document.getElementById('salLabel').value = s ? s.label : 'Salaire net';
  document.getElementById('salMontant').value = s ? s.montant : '';
  document.getElementById('salJour').value = s ? s.jour : 1;
  document.getElementById('salCateg').value = s ? s.categ : 'Salaire';
  document.getElementById('salCompte').value = s ? (s.compteId||'') : '';
  document.getElementById('salFromMonth').value = s ? s.fromMonth : new Date().getMonth()+1;
  document.getElementById('salFromYear').value = s ? s.fromYear : new Date().getFullYear();
  document.getElementById('salToMonth').value = s ? (s.toMonth||'') : '';
  document.getElementById('salToYear').value = s ? (s.toYear||'') : '';
  document.getElementById('salDeleteBtn').style.display = s ? 'inline-block' : 'none';
  openModal('modalSalaire');
}

function saveSalaire() {
  const montant = parseFloat(document.getElementById('salMontant').value);
  const jour = parseInt(document.getElementById('salJour').value)||1;
  const fromM = parseInt(document.getElementById('salFromMonth').value);
  const fromY = parseInt(document.getElementById('salFromYear').value);
  if (!montant||montant<=0||!fromY){notify('Montant et date de départ requis',true);return;}
  const toM = parseInt(document.getElementById('salToMonth').value)||null;
  const toY = parseInt(document.getElementById('salToYear').value)||null;
  state.salaire = {
    label: document.getElementById('salLabel').value.trim()||'Salaire net',
    montant, jour,
    categ: document.getElementById('salCateg').value,
    compteId: document.getElementById('salCompte').value||null,
    fromMonth: fromM, fromYear: fromY,
    toMonth: toM, toYear: toY
  };
  applySalaire();
  closeModal('modalSalaire');
  renderAll();
  notify('Salaire configuré et appliqué');
}
function deleteSalaire() {
  if (!confirm('Supprimer le salaire récurrent ?')) return;
  state.salaire = null;
  closeModal('modalSalaire');
  renderSalaireBadge();
  notify('Salaire supprimé');
}
function applySalaire() {
  if (!state.salaire) return;
  const s = state.salaire;
  const padZ = n => String(n).padStart(2,'0');
  // Remove old auto-generated salary entries
  state.budget = state.budget.filter(b=>!b._salaire);
  // Generate for each month in range
  const start = new Date(s.fromYear, s.fromMonth-1, 1);
  const endDate = s.toYear && s.toMonth ? new Date(s.toYear, s.toMonth-1, 1) : new Date(new Date().getFullYear(), 11, 1);
  let cur = new Date(start);
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth()+1;
    const d = Math.min(s.jour, new Date(y, m, 0).getDate());
    const dateStr = `${y}-${padZ(m)}-${padZ(d)}`;
    state.budget.push({
      id: uid(), label: s.label, categ: s.categ, compteId: s.compteId||null,
      montant: s.montant, type: 'revenu', date: dateStr, _salaire: true
    });
    cur.setMonth(cur.getMonth()+1);
  }
}
function renderSalaireBadge() {
  const wrap = document.getElementById('salaryBadgeWrap');
  if (!wrap) return;
  if (state.salaire) {
    wrap.innerHTML = `<div class="salary-badge" onclick="openSalaireModal()" style="cursor:pointer" title="Cliquer pour modifier">
      💼 ${state.salaire.label} · ${fmt(state.salaire.montant)}/mois · J${state.salaire.jour}
    </div>`;
  } else {
    wrap.innerHTML = '';
  }
}

