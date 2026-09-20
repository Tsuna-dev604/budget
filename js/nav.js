// ═══════════════════════════════════════
//  Navigation entre sections (onglets)
// ═══════════════════════════════════════
function showSection(id, tab) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  tab.classList.add('active');
  renderAll();
}
function openModal(id) {
  document.getElementById(id).classList.add('open');
  const d = document.getElementById('bDate');
  if (d && !d.value) d.value = today();
  const od = document.getElementById('opDate');
  if (od && !od.value) od.value = today();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')});
});

