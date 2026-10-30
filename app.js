'use strict';
const fmt = n => new Intl.NumberFormat('fr-FR').format(n);
const tbody = document.getElementById('games'), status = document.getElementById('status');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let catalog = null, version = '', token = '', isAdmin = false;
const adminBtn = document.getElementById('admin'), saveBtn = document.getElementById('save'), resetBtn = document.getElementById('reset');
function message(text, ok = false) { status.textContent = text; status.classList.toggle('ok', ok) }
function financeConfig(data) {
  const f = data.financement, a = f && f.acompte;
  if (!f || !a || typeof f.majoration_pourcent !== 'number' || !Number.isFinite(f.majoration_pourcent) || f.majoration_pourcent < 0 || f.majoration_pourcent > 1000 || !Number.isSafeInteger(a.numerateur) || !Number.isSafeInteger(a.denominateur) || a.numerateur < 0 || a.denominateur < 1 || a.numerateur > a.denominateur || a.denominateur > 1000000 || f.nombre_mois !== 12) throw Error('Paramètres de financement invalides dans catalogue.json.');
  return f;
}
function update(input) {
  const row = input.closest('tr'), price = Number(input.value), monthly = row.querySelector('.monthly'), printPrice = row.querySelector('.print-price');
  if (input.value === '' || !Number.isSafeInteger(price) || price < 0 || price > 1e12) { monthly.textContent = 'Prix invalide'; printPrice.textContent = 'Prix invalide'; input.setAttribute('aria-invalid', 'true'); return }
  input.removeAttribute('aria-invalid');
  const f = catalog.financement, total = Math.round(price * (1 + f.majoration_pourcent / 100));
  const deposit = Math.round(total * f.acompte.numerateur / f.acompte.denominateur), remainder = total - deposit, first = Math.floor(remainder / 12), last = remainder - first * 11;
  printPrice.textContent = fmt(price) + ' FCFA'; monthly.replaceChildren();
  const main = document.createElement('strong'); main.textContent = fmt(first) + ' FCFA / mois' + (last === first ? '' : ' × 11'); monthly.append(main);
  const detail = document.createElement('span'); detail.className = 'detail';
  detail.textContent = 'Acompte : ' + fmt(deposit) + ' FCFA · Total : ' + fmt(total) + ' FCFA' + (last === first ? '' : ' · 12ᵉ mois : ' + fmt(last) + ' FCFA'); monthly.append(detail);
}
function render(games) {
  const fragment = document.createDocumentFragment();
  games.forEach((game, i) => {
    if (typeof game.nom !== 'string' || !Number.isSafeInteger(game.prix_local_fcfa) || game.prix_local_fcfa < 0 || game.prix_local_fcfa > 1e12 || !(game.prix_import_fcfa === null || (Number.isSafeInteger(game.prix_import_fcfa) && game.prix_import_fcfa >= 0))) throw Error('Données invalides pour l’équipement n° ' + (i + 1));
    const row = document.createElement('tr');
    const ip = game.prix_import_fcfa === null ? '<span class="not-available">Non renseigné</span>' : `${fmt(game.prix_import_fcfa)} <span class="unit">FCFA</span>`;
    row.innerHTML = `<td><div class="game"><span class="number">${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(game.nom)}</strong><span class="game-sub">ÉQUIPEMENT AMZ</span></div></div></td><td class="import-price" data-label="Prix import 🔒">${ip}</td><td data-label="Prix local AMZ 🔒"><span class="locked-local">${fmt(game.prix_local_fcfa)} <span class="unit">FCFA 🔒</span></span><div class="price-field" hidden><input type="number" min="0" max="1000000000000" step="1" value="${game.prix_local_fcfa}" data-initial="${game.prix_local_fcfa}" aria-label="Prix local AMZ de ${esc(game.nom)}, en FCFA"><span>FCFA</span></div><span class="print-price"></span></td><td class="monthly" data-label="Prix échelonné sur 12 mois 🔒"></td><td data-label="Image du jeu"><div class="photo"></div></td>`;
    const photo = row.querySelector('.photo');
    const missing = () => { photo.replaceChildren(); const x = document.createElement('div'); x.className = 'missing'; x.textContent = 'Image non disponible'; photo.append(x) };
    if (typeof game.image === 'string' && /^images\/[a-zA-Z0-9_./-]+\.(jpe?g|png|webp)$/i.test(game.image) && !game.image.includes('..')) { const img = document.createElement('img'); img.src = game.image; img.alt = game.nom; img.loading = 'lazy'; img.addEventListener('error', missing); photo.append(img) } else missing();
    const input = row.querySelector('input'); input.addEventListener('input', () => update(input)); update(input); fragment.append(row);
  });
  tbody.replaceChildren(fragment); document.getElementById('count').textContent = `${games.length} équipement${games.length === 1 ? '' : 's'}`; syncAdmin();
}
function syncAdmin() {
  adminBtn.textContent = isAdmin ? '🔓 Déconnexion admin' : '🔒 Accès administrateur'; saveBtn.hidden = !isAdmin; resetBtn.hidden = !isAdmin;
  document.querySelectorAll('.price-field').forEach(el => el.hidden = !isAdmin); document.querySelectorAll('.locked-local').forEach(el => el.hidden = isAdmin);
}
async function init() {
  try {
    const response = await fetch('/api/catalogue', { cache: 'no-store' }); if (!response.ok) throw Error('HTTP ' + response.status);
    const j = await response.json(); if (!Array.isArray(j.data.equipements)) throw Error('Le tableau « equipements » est manquant.');
    catalog = j.data; version = j.version; const f = financeConfig(catalog);
    document.getElementById('simulation').textContent = `${fmt(f.majoration_pourcent)} % · acompte ${f.acompte.numerateur}/${f.acompte.denominateur}`;
    document.getElementById('calculation-note').innerHTML = `<strong>Simulation indicative :</strong> prix local majoré de ${fmt(f.majoration_pourcent)} %, puis acompte de ${f.acompte.numerateur}/${f.acompte.denominateur} du total majoré ; le solde est réparti sur 12 mois.`;
    render(catalog.equipements);
  } catch (err) { document.getElementById('count').textContent = 'Catalogue indisponible'; message('Impossible de charger le catalogue. Vérifiez le déploiement Netlify (voir LISEZ-MOI.md). Détail : ' + err.message) }
}
const dialog = document.getElementById('loginDialog'), loginForm = document.getElementById('loginForm');
adminBtn.addEventListener('click', async () => {
  if (isAdmin) { try { await fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }) } catch { } token = ''; isAdmin = false; syncAdmin(); if (catalog) render(catalog.equipements); message('Déconnecté. Les modifications non enregistrées ont été annulées.', true); return }
  document.getElementById('loginError').textContent = ''; loginForm.reset(); dialog.showModal(); document.getElementById('password').focus();
});
document.getElementById('cancelLogin').addEventListener('click', () => dialog.close());
loginForm.addEventListener('submit', async e => {
  e.preventDefault(); const error = document.getElementById('loginError'); error.textContent = ''; try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: document.getElementById('password').value }) }); const j = await r.json(); if (!r.ok) throw Error(j.error || 'Connexion impossible.'); token = j.token; isAdmin = true; dialog.close(); loginForm.reset(); syncAdmin(); message('Mode administrateur actif. Modifiez les prix, puis enregistrez.', true);
  } catch (err) { error.textContent = err.message }
});
resetBtn.addEventListener('click', () => { render(catalog.equipements); message('Modifications annulées.', true) });
saveBtn.addEventListener('click', async () => {
  if (document.querySelector('input[aria-invalid="true"]')) { message('Corrigez les prix invalides avant de sauvegarder.'); return }
  const prices = Array.from(document.querySelectorAll('input[data-initial]'), i => Number(i.value)); saveBtn.disabled = true;
  try {
    const r = await fetch('/api/prix', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ version, prices }) }); const j = await r.json(); if (!r.ok) { if (r.status === 401) { token = ''; isAdmin = false; syncAdmin() } throw Error(j.error || 'Enregistrement impossible.') }
    version = j.version; prices.forEach((p, i) => catalog.equipements[i].prix_local_fcfa = p); render(catalog.equipements); message('Prix enregistrés sur Netlify.', true);
  } catch (err) { message(err.message) } finally { saveBtn.disabled = false }
});
document.getElementById('export').addEventListener('click', () => {
  if (!tbody.rows.length) { alert('Le catalogue doit être chargé avant l’export.'); return } if (document.querySelector('input[aria-invalid="true"]')) { alert('Corrigez les prix invalides avant l’export.'); return }
  document.querySelectorAll('.photo img').forEach(img => { img.loading = 'eager' }); Promise.all(Array.from(document.querySelectorAll('.photo img'), img => img.decode().catch(() => { }))).then(() => window.print());
});
init();
