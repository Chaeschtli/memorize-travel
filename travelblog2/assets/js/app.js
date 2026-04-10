const API = 'api';
let state = { user: null, trips: [], likedTips: [], currentTrip: null };

async function api(file, action, body, formData) {
  const url = `${API}/${file}.php?action=${action}`;
  let opts = {};
  if (formData) { opts = { method: 'POST', body: formData }; }
  else if (body) { opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
  const r = await fetch(url, opts);
  return r.json();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const p = document.getElementById('page-' + name);
  if (p) { p.classList.add('active'); window.scrollTo(0, 0); }
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === name));
  document.querySelectorAll('.admin-nav-item').forEach(l => l.classList.toggle('active', l.dataset.page === name));
  if (name === 'home') loadTrips();
  if (name === 'tips') loadTips();
  if (name === 'admin') loadAdminSection('trips');
  if (name === 'profile') loadProfile();
  closeMobileMenu();
}

function closeMobileMenu() {
  document.getElementById('mobile-menu')?.classList.remove('open');
}

async function checkSession() {
  const d = await api('auth', 'me');
  if (d.loggedIn) setUser(d.user);
  updateNav();
  loadTrips();
  const hash = location.hash.replace('#', '');
  if (hash.startsWith('trip/')) openTripBySlug(hash.replace('trip/', ''));
  else if (hash) showPage(hash);
  else showPage('home');
}

function setUser(u) {
  if (u) {
    u.is_admin = parseInt(u.is_admin) === 1;
    u.is_active = parseInt(u.is_active) === 1;
  }
  state.user = u;
  updateNav();
  if (u) loadLikedTips();
}

function updateNav() {
  const u = state.user;
  document.getElementById('nav-login-btn').style.display = u ? 'none' : '';
  document.getElementById('nav-user-wrap').style.display = u ? 'flex' : 'none';
  document.getElementById('nav-admin-link').style.display = (u && u.is_admin) ? '' : 'none';
  document.querySelectorAll('.mobile-admin-link').forEach(el => el.style.display = (u && u.is_admin) ? '' : 'none');
  document.querySelectorAll('.mobile-user-link').forEach(el => el.style.display = u ? '' : 'none');
  document.querySelectorAll('.mobile-login-link').forEach(el => el.style.display = u ? 'none' : '');
  if (u) {
    const av = document.getElementById('nav-avatar');
    if (u.avatar) { av.innerHTML = `<img src="${u.avatar}" class="nav-avatar" onclick="showPage('profile')">`; }
    else { av.innerHTML = `<div class="nav-avatar-placeholder" onclick="showPage('profile')">${(u.username||'?')[0].toUpperCase()}</div>`; }
  }
}

/* ---- HOME ---- */
async function loadTrips() {
  const d = await api('trips', 'list');
  state.trips = d.trips || [];
  renderTrips();
}

function renderTrips() {
  const g = document.getElementById('trips-grid');
  if (!g) return;
  if (!state.trips.length) { g.innerHTML = '<div class="empty-state">Noch keine Reisen veröffentlicht.</div>'; return; }
  g.innerHTML = state.trips.map(t => `
    <div class="trip-card" onclick="openTrip(${t.id})">
      <div class="trip-card-media">
        ${t.use_emoji == 1 ? `<span>${t.card_emoji||'✈️'}</span>` : (t.card_image ? `<img src="${t.card_image}" alt="${t.title}">` : `<span>${t.card_emoji||'✈️'}</span>`)}
        ${!t.published ? '<span class="trip-card-draft">Entwurf</span>' : ''}
      </div>
      <div class="trip-card-body">
        <div class="trip-card-tag">${t.country||''} ${t.duration ? '· '+t.duration : ''}</div>
        <div class="trip-card-title">${t.title}</div>
        ${t.summary ? `<div class="trip-card-desc">${t.summary.substring(0,80)}${t.summary.length>80?'…':''}</div>` : ''}
      </div>
    </div>`).join('');
}

async function openTrip(id) {
  const r = await fetch(`api/trips.php?action=get&id=${id}`);
  const data = await r.json();
  if (!data.trip) return;
  state.currentTrip = data.trip;
  renderTripDetail(data.trip);
  showPage('trip');
  location.hash = 'trip/' + data.trip.slug;
}

async function openTripBySlug(slug) {
  const r = await fetch(`api/trips.php?action=get&slug=${slug}`);
  const data = await r.json();
  if (!data.trip) { showPage('home'); return; }
  state.currentTrip = data.trip;
  renderTripDetail(data.trip);
  showPage('trip');
}

function renderTripDetail(t) {
  const page = document.getElementById('page-trip');
  const bannerBg = t.banner_image ? `<img src="${t.banner_image}" alt="${t.title}">` : '';
  const highlights = t.highlights ? `<div class="trip-highlights"><h3>Highlights</h3><div class="post-content">${t.highlights}</div></div>` : '';
  const spotify = t.spotify_embed ? `<div class="spotify-embed">${t.spotify_embed}</div>` : '';
  const posts = (t.posts || []);
  const tips = (t.tips || []);
  const tlItems = posts.map((p, i) => {
    const side = i % 2 === 0 ? 'left' : 'right';
    const card = `<div class="tl-card" onclick="openPost(${JSON.stringify(p).replace(/"/g,'&quot;')})">
      <div class="tl-card-img">${p.image ? `<img src="${p.image}" alt="${p.title}">` : '📸'}</div>
      <div class="tl-card-body"><div class="tl-card-title">${p.title}</div></div>
    </div>`;
    const spacer = `<div class="tl-spacer"></div>`;
    const dot = `<div class="tl-dot-col"><div class="tl-dot"></div></div>`;
    return `<div class="tl-item ${side}">${side==='left' ? card+dot+spacer : spacer+dot+card}</div>`;
  }).join('');

  const tripTips = tips.length ? `
    <div class="trip-info">
      <div class="divider"></div>
      <div class="section-title" style="font-size:16px">Tipps & Tricks</div>
      ${tips.map(tip => `<div class="tip-card">
        <div class="tip-card-body">
          <span class="badge badge-${tip.type}">${tip.type}</span>
          <div class="tip-card-title">${tip.title}</div>
          <div class="tip-card-desc">${tip.description||''}</div>
        </div>
      </div>`).join('')}
    </div>` : '';

  const adminBtns = state.user?.is_admin ? `
    <div style="position:absolute;top:1rem;right:1rem;z-index:10;display:flex;gap:8px">
      <button class="btn btn-sm btn-primary" onclick="editTrip(${t.id})">Bearbeiten</button>
    </div>` : '';

  page.innerHTML = `
    <div style="position:relative">
      ${adminBtns}
      <div class="trip-banner">
        ${bannerBg}
        <div class="trip-banner-content">
          <h1>${t.title}</h1>
          <div class="trip-meta-row">
            ${t.country ? `<span>📍 ${t.country}</span>` : ''}
            ${t.duration ? `<span>🗓 ${t.duration}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="trip-info">
      <button class="btn btn-sm mt-2" onclick="showPage('home');location.hash=''">← Alle Reisen</button>
      ${t.summary ? `<p class="trip-summary mt-3">${t.summary}</p>` : ''}
      ${highlights}
      ${spotify}
    </div>
    <div class="timeline-wrap">
      <div class="timeline">${tlItems}</div>
    </div>
    <div id="post-detail" class="post-detail"></div>
    ${tripTips}
    ${state.user?.is_admin ? `<div style="text-align:center;padding:2rem"><button class="btn btn-primary" onclick="openAddPost(${t.id})">+ Beitrag hinzufügen</button></div>` : ''}
  `;
}

function openPost(p) {
  const d = document.getElementById('post-detail');
  d.innerHTML = `
    <button class="btn btn-sm" onclick="this.parentElement.classList.remove('open');this.parentElement.innerHTML=''" style="margin-bottom:1rem">← Schliessen</button>
    ${p.image ? `<img src="${p.image}" class="post-detail-img" alt="${p.title}">` : ''}
    <h2 style="font-size:22px;font-weight:700;margin-bottom:1rem">${p.title}</h2>
    <div class="post-content">${p.content||''}</div>
    ${state.user?.is_admin ? `<div style="margin-top:1.5rem;display:flex;gap:8px"><button class="btn btn-sm btn-primary" onclick="editPost(${JSON.stringify(p).replace(/"/g,'&quot;')})">Bearbeiten</button><button class="btn btn-sm btn-danger" onclick="deletePost(${p.id})">Löschen</button></div>` : ''}
  `;
  d.classList.add('open');
  d.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---- TIPS ---- */
async function loadTips(q = '') {
  const d = await fetch(`api/tips.php?action=list&q=${encodeURIComponent(q)}`).then(r=>r.json());
  renderTips(d.tips || []);
}

async function loadLikedTips() {
  const d = await api('tips', 'likes');
  state.likedTips = (d.likes || []).map(Number);
}

function renderTips(tips) {
  const c = document.getElementById('tips-list');
  if (!c) return;
  if (!tips.length) { c.innerHTML = '<div class="empty-state">Keine Tipps gefunden.</div>'; return; }
  c.innerHTML = tips.map(t => {
    const liked = state.likedTips.includes(Number(t.id));
    const tripLinks = t.trip_ids ? t.trip_ids.split(',').map(tid => {
      const trip = state.trips.find(tr => tr.id == tid);
      return trip ? `<span class="tip-trip-link" onclick="openTrip(${trip.id})">↗ ${trip.title}</span>` : '';
    }).join('') : '';
    return `<div class="tip-card expandable" id="tip-${t.id}">
      <div class="tip-card-body">
        <span class="badge badge-${t.type}">${t.type}</span>
        <div class="tip-card-title" onclick="toggleTip(${t.id})" style="cursor:pointer">${t.title} <span style="font-size:11px;color:var(--c-text3)">▼</span></div>
        <div class="tip-card-desc">${t.description||''}</div>
        <div class="tip-card-meta">
          <span class="like-btn ${liked?'liked':''}" onclick="toggleLike(${t.id},this)">♥ ${liked?'Geliked':'Liken'}</span>
          ${tripLinks}
          ${state.user?.is_admin === true ? `<button class="btn btn-sm" onclick="editTip(${t.id})">Bearbeiten</button>` : ''}
        </div>
        <div class="tip-card-expand" id="tip-expand-${t.id}">
          <div id="tip-content-${t.id}" style="font-size:14px;color:var(--c-text2);line-height:1.7">Laden…</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function toggleTip(id) {
  const expand = document.getElementById('tip-expand-' + id);
  const contentEl = document.getElementById('tip-content-' + id);
  expand.classList.toggle('open');
  if (expand.classList.contains('open') && contentEl.textContent === 'Laden…') {
    const d = await fetch(`api/tips.php?action=get&id=${id}`).then(r=>r.json());
    const t = d.tip || {};
    const mediaHtml = (t.media||[]).length ? `<div class="tip-media-grid">${t.media.map(m=>`<img src="${m.path}" onclick="openLightbox('${m.path}','image')">`).join('')}</div>` : '';
    contentEl.innerHTML = (t.content ? `<div class="post-content">${t.content}</div>` : '') + mediaHtml;
  }
}

async function toggleLike(tipId, el) {
  if (!state.user) { openAuthModal(); return; }
  const d = await api('tips', 'like', { tip_id: tipId });
  if (d.liked) { state.likedTips.push(tipId); el.classList.add('liked'); el.textContent = '♥ Geliked'; }
  else { state.likedTips = state.likedTips.filter(id => id != tipId); el.classList.remove('liked'); el.textContent = '♥ Liken'; }
}

/* ---- AUTH ---- */
function openAuthModal() { document.getElementById('auth-modal').classList.add('open'); }
function closeAuthModal() { document.getElementById('auth-modal').classList.remove('open'); }
function switchAuthTab(tab) {
  document.querySelectorAll('.modal-tab').forEach((t,i) => t.classList.toggle('active', ['login','register'][i] === tab));
  document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
}

async function doLogin() {
  const login = document.getElementById('l-login').value;
  const password = document.getElementById('l-pass').value;
  const d = await api('auth', 'login', { login, password });
  if (d.error) { showErr('l-err', d.error); return; }
  const me = await api('auth', 'me');
  setUser(me.user); closeAuthModal(); showToast('Willkommen zurück, ' + d.username + '!');
}

async function doRegister() {
  const username = document.getElementById('r-user').value;
  const email    = document.getElementById('r-email').value;
  const password = document.getElementById('r-pass').value;
  const d = await api('auth', 'register', { username, email, password });
  if (d.error) { showErr('r-err', d.error); return; }
  const me = await api('auth', 'me');
  setUser(me.user); closeAuthModal(); showToast('Willkommen, ' + d.username + '!');
}

async function doLogout() {
  await api('auth', 'logout', {});
  state.user = null; state.likedTips = [];
  updateNav(); showToast('Abgemeldet.'); showPage('home');
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

/* ---- PROFILE ---- */
async function loadProfile() {
  const u = state.user;
  if (!u) { showPage('home'); return; }
  const liked = await api('users', 'liked_tips');
  const wrap = document.getElementById('profile-wrap');
  const avatarHtml = u.avatar
    ? `<img src="${u.avatar}" class="profile-avatar" id="pa">`
    : `<div class="profile-avatar-placeholder" id="pa">${(u.username||'?')[0].toUpperCase()}</div>`;
  wrap.innerHTML = `
    <h2 style="font-size:22px;font-weight:700;margin-bottom:2rem">Mein Profil</h2>
    <div class="profile-avatar-wrap">
      ${avatarHtml}
      <div>
        <div style="font-size:17px;font-weight:600">${u.username}</div>
        <div class="text-muted text-sm">${u.email}</div>
        <label class="btn btn-sm mt-1" style="cursor:pointer">Bild ändern<input type="file" accept="image/*" style="display:none" onchange="uploadAvatar(this)"></label>
      </div>
    </div>
    <div class="editor-card">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:1rem">Profil bearbeiten</h3>
      <div class="field"><label>Benutzername</label><input id="p-user" value="${u.username}"></div>
      <div class="field"><label>E-Mail</label><input id="p-email" value="${u.email}"></div>
      <div class="field"><label>Neues Passwort (leer lassen = unverändert)</label><input type="password" id="p-pass" placeholder="••••••••"></div>
      <button class="btn btn-primary" onclick="saveProfile()">Speichern</button>
    </div>
    <div class="divider"></div>
    <div class="section-title" style="font-size:16px">Gelikte Tipps</div>
    <div id="liked-tips-list">
      ${(liked.tips||[]).length ? liked.tips.map(t => `<div class="tip-card"><div class="tip-card-body"><div class="tip-card-title">${t.title}</div><div class="tip-card-desc">${t.description||''}</div></div></div>`).join('') : '<p class="text-muted text-sm mt-2">Noch keine Tipps geliked.</p>'}
    </div>
  `;
}

async function uploadAvatar(input) {
  const fd = new FormData();
  fd.append('avatar', input.files[0]);
  const d = await api('users', 'upload_avatar', null, fd);
  if (d.ok) { state.user.avatar = d.path; updateNav(); loadProfile(); showToast('Profilbild gespeichert!'); }
}

async function saveProfile() {
  const body = {};
  const u = document.getElementById('p-user').value;
  const e = document.getElementById('p-email').value;
  const p = document.getElementById('p-pass').value;
  if (u !== state.user.username) body.username = u;
  if (e !== state.user.email) body.email = e;
  if (p) body.password = p;
  if (!Object.keys(body).length) return;
  const d = await api('users', 'profile', body);
  if (d.ok) { if (body.username) state.user.username = body.username; if (body.email) state.user.email = body.email; updateNav(); showToast('Gespeichert!'); }
}

/* ---- ADMIN ---- */
function loadAdminSection(name) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.toggle('active', i.dataset.section === name));
  const s = document.getElementById('admin-' + name);
  if (s) s.classList.add('active');
  if (name === 'trips') loadAdminTrips();
  if (name === 'tips') loadAdminTips();
  if (name === 'users') loadAdminUsers();
  if (name === 'config') loadAdminConfig();
}

async function loadAdminTrips() {
  const d = await api('trips', 'list');
  const tbody = document.getElementById('admin-trips-tbody');
  if (!tbody) return;
  tbody.innerHTML = d.trips.map(t => `<tr>
    <td>${t.title}</td>
    <td>${t.country||'-'}</td>
    <td><span class="badge ${t.published?'badge-tip':'badge-link'}">${t.published?'Publiziert':'Entwurf'}</span></td>
    <td><div class="flex-gap">
      <button class="btn btn-sm" onclick="editTrip(${t.id})">Bearbeiten</button>
      <button class="btn btn-sm btn-danger" onclick="deleteTrip(${t.id})">Löschen</button>
    </div></td>
  </tr>`).join('');
}

async function loadAdminTips() {
  const d = await fetch('api/tips.php?action=list').then(r=>r.json());
  const tbody = document.getElementById('admin-tips-tbody');
  if (!tbody) return;
  tbody.innerHTML = d.tips.map(t => `<tr>
    <td>${t.title}</td>
    <td><span class="badge badge-${t.type}">${t.type}</span></td>
    <td><div class="flex-gap">
      <button class="btn btn-sm" onclick="editTip(${t.id})">Bearbeiten</button>
      <button class="btn btn-sm btn-danger" onclick="deleteTip(${t.id})">Löschen</button>
    </div></td>
  </tr>`).join('');
}

async function loadAdminUsers() {
  const d = await api('users', 'list');
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  tbody.innerHTML = d.users.map(u => {
    const isAdmin = parseInt(u.is_admin) === 1;
    const isActive = parseInt(u.is_active) === 1;
    return `<tr>
      <td>${u.username}</td>
      <td>${u.email}</td>
      <td><span class="badge ${isAdmin?'badge-tip':'badge-link'}">${isAdmin?'Admin':'User'}</span></td>
      <td><span class="badge ${isActive?'badge-tip':'badge-link'}">${isActive?'Aktiv':'Inaktiv'}</span></td>
      <td><div class="flex-gap">
        <button class="btn btn-sm" onclick="toggleAdmin(${u.id},${isAdmin?1:0},${isActive?1:0})">${isAdmin?'Admin entfernen':'Admin machen'}</button>
        <button class="btn btn-sm" onclick="toggleActive(${u.id},${isAdmin?1:0},${isActive?1:0})">${isActive?'Deaktivieren':'Aktivieren'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">Löschen</button>
      </div></td>
    </tr>`;
  }).join('');
}

async function toggleAdmin(id, isAdmin, isActive) {
  await api('users', 'update_user', { id, is_admin: isAdmin ? 0 : 1, is_active: isActive });
  loadAdminUsers(); showToast('Gespeichert!');
}

async function toggleActive(id, isAdmin, isActive) {
  await api('users', 'update_user', { id, is_admin: isAdmin, is_active: isActive ? 0 : 1 });
  loadAdminUsers(); showToast('Gespeichert!');
}

async function deleteUser(id) {
  if (!confirm('User wirklich löschen?')) return;
  await api('users', 'delete_user', { id });
  loadAdminUsers(); showToast('Gelöscht!');
}

async function loadAdminConfig() {
  const d = await api('users', 'get_config');
  const c = d.config || {};
  document.getElementById('cfg-title').value = c.site_title || '';
  document.getElementById('cfg-subtitle').value = c.site_subtitle || '';
  document.getElementById('cfg-color').value = c.banner_color || '#1a1a1a';
}

async function saveConfig() {
  const body = {
    site_title: document.getElementById('cfg-title').value,
    site_subtitle: document.getElementById('cfg-subtitle').value,
    banner_color: document.getElementById('cfg-color').value,
  };
  await api('users', 'save_config', body);
  document.getElementById('nav-logo-text').textContent = body.site_title;
  showToast('Konfiguration gespeichert!');
}

/* ---- TRIP EDITOR ---- */
function openTripEditor(trip) {
  const t = trip || {};
  document.getElementById('te-id').value = t.id || '';
  document.getElementById('te-title').value = t.title || '';
  document.getElementById('te-summary').value = t.summary || '';
  document.getElementById('te-description').value = t.description || '';
  document.getElementById('te-country').value = t.country || '';
  document.getElementById('te-duration').value = t.duration || '';
  document.getElementById('te-highlights').value = t.highlights || '';
  document.getElementById('te-emoji').value = t.card_emoji || '✈️';
  document.getElementById('te-use-emoji').checked = t.use_emoji == 1;
  document.getElementById('te-spotify').value = t.spotify_embed || '';
  document.getElementById('te-published').checked = t.published == 1;
  document.getElementById('trip-editor-modal').classList.add('open');
}

async function editTrip(id) {
  const d = await fetch(`api/trips.php?action=get&id=${id}`).then(r=>r.json());
  openTripEditor(d.trip);
}

async function saveTripEditor() {
  const id = document.getElementById('te-id').value;
  const body = {
    id: id || null,
    title: document.getElementById('te-title').value,
    summary: document.getElementById('te-summary').value,
    description: document.getElementById('te-description').value,
    country: document.getElementById('te-country').value,
    duration: document.getElementById('te-duration').value,
    highlights: document.getElementById('te-highlights').value,
    card_emoji: document.getElementById('te-emoji').value,
    use_emoji: document.getElementById('te-use-emoji').checked ? 1 : 0,
    spotify_embed: document.getElementById('te-spotify').value,
    published: document.getElementById('te-published').checked ? 1 : 0,
  };
  const d = await api('trips', 'save', body);
  if (d.ok) {
    const imgFile = document.getElementById('te-card-img').files[0];
    const bannerFile = document.getElementById('te-banner-img').files[0];
    if (imgFile) { const fd = new FormData(); fd.append('image', imgFile); fd.append('trip_id', d.id); fd.append('type','card'); await api('trips','upload_image',null,fd); }
    if (bannerFile) { const fd = new FormData(); fd.append('image', bannerFile); fd.append('trip_id', d.id); fd.append('type','banner'); await api('trips','upload_image',null,fd); }
    closeTripEditor();
    loadTrips();
    loadAdminTrips();
    showToast('Reise gespeichert!');
  }
}

function closeTripEditor() { document.getElementById('trip-editor-modal').classList.remove('open'); }

async function deleteTrip(id) {
  if (!confirm('Reise wirklich löschen?')) return;
  await api('trips', 'delete', { id });
  loadAdminTrips(); loadTrips(); showToast('Gelöscht!');
}

/* ---- POST EDITOR ---- */
function openAddPost(tripId) {
  document.getElementById('pe-id').value = '';
  document.getElementById('pe-trip-id').value = tripId;
  document.getElementById('pe-title').value = '';
  document.getElementById('pe-content').value = '';
  document.getElementById('pe-order').value = '0';
  document.getElementById('post-editor-modal').classList.add('open');
}

function editPost(p) {
  document.getElementById('pe-id').value = p.id;
  document.getElementById('pe-trip-id').value = p.trip_id;
  document.getElementById('pe-title').value = p.title || '';
  document.getElementById('pe-content').value = p.content || '';
  document.getElementById('pe-order').value = p.sort_order || 0;
  document.getElementById('post-editor-modal').classList.add('open');
}

async function savePostEditor() {
  const id = document.getElementById('pe-id').value;
  const body = {
    id: id || null,
    trip_id: document.getElementById('pe-trip-id').value,
    title: document.getElementById('pe-title').value,
    content: document.getElementById('pe-content').value,
    sort_order: document.getElementById('pe-order').value,
    published: 1,
  };
  const d = await api('posts', 'save', body);
  if (d.ok) {
    const imgFile = document.getElementById('pe-img').files[0];
    if (imgFile) { const fd = new FormData(); fd.append('image', imgFile); fd.append('post_id', d.id); await api('posts','upload_image',null,fd); }
    closePostEditor();
    if (state.currentTrip) openTrip(state.currentTrip.id);
    showToast('Beitrag gespeichert!');
  }
}

function closePostEditor() { document.getElementById('post-editor-modal').classList.remove('open'); }

async function deletePost(id) {
  if (!confirm('Beitrag wirklich löschen?')) return;
  await api('posts', 'delete', { id });
  if (state.currentTrip) openTrip(state.currentTrip.id);
  showToast('Beitrag gelöscht!');
}

/* ---- TIP EDITOR ---- */
function openTipEditor(tip) {
  const t = tip || {};
  document.getElementById('tipe-id').value = t.id || '';
  document.getElementById('tipe-title').value = t.title || '';
  document.getElementById('tipe-desc').value = t.description || '';
  document.getElementById('tipe-content').value = t.content || '';
  document.getElementById('tipe-type').value = t.type || 'tip';
  document.getElementById('tipe-published').checked = t.published != 0;
  document.getElementById('tip-editor-modal').classList.add('open');
}

async function editTip(id) {
  const d = await fetch(`api/tips.php?action=list`).then(r=>r.json());
  const tip = (d.tips||[]).find(t=>t.id==id);
  if (tip) openTipEditor(tip);
}

async function saveTipEditor() {
  const id = document.getElementById('tipe-id').value;
  const body = {
    id: id || null,
    title: document.getElementById('tipe-title').value,
    description: document.getElementById('tipe-desc').value,
    content: document.getElementById('tipe-content').value,
    type: document.getElementById('tipe-type').value,
    published: document.getElementById('tipe-published').checked ? 1 : 0,
  };
  const d = await api('tips', 'save', body);
  if (d.ok) { closeTipEditor(); loadAdminTips(); loadTips(); showToast('Tipp gespeichert!'); }
}

function closeTipEditor() { document.getElementById('tip-editor-modal').classList.remove('open'); }

async function deleteTip(id) {
  if (!confirm('Tipp wirklich löschen?')) return;
  await api('tips', 'delete', { id });
  loadAdminTips(); showToast('Gelöscht!');
}

/* ---- HTML TOOLBAR ---- */
function insertHtml(fieldId, tag) {
  const ta = document.getElementById(fieldId);
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0,s) + tag + ta.value.slice(e);
  ta.focus();
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  document.getElementById('tips-search-input')?.addEventListener('input', e => loadTips(e.target.value));
  window.addEventListener('popstate', () => {
    const hash = location.hash.replace('#','');
    if (hash.startsWith('trip/')) openTripBySlug(hash.replace('trip/',''));
  });
});
