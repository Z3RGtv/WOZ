const TWITCH_CLIENT_ID = '3rg5uodkyj3s4oa9eec66td49uc1qt';
const REDIRECT_URI = 'https://z3rgtv.github.io/WOZ/';
const TOKEN_KEY = 'woz_twitch_access_token';
const OAUTH_STATE_KEY = 'woz_oauth_state';

const elements = {
  accountArea: document.querySelector('#account-area'),
  status: document.querySelector('#status-message'),
  body: document.querySelector('#leaderboard-body'),
  empty: document.querySelector('#empty-state'),
  search: document.querySelector('#search-input'),
  myProfile: document.querySelector('#my-profile'),
  welcome: document.querySelector('#welcome-copy'),
  playerCount: document.querySelector('#player-count'),
  topScore: document.querySelector('#top-score'),
  updatedAt: document.querySelector('#updated-at'),
};

let leaderboard = [];
let twitchUser = null;
let twitchProfiles = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeImageUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' ? escapeHtml(url.href) : '';
  } catch {
    return '';
  }
}

function platformOf(player) {
  if (player.platform) return player.platform;
  return String(player.id).startsWith('youtube:') ? 'youtube' : 'twitch';
}

function externalId(player) {
  const id = String(player.id ?? '');
  const separator = id.indexOf(':');
  return separator >= 0 ? id.slice(separator + 1) : id;
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function beginTwitchLogin() {
  const state = randomState();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const parameters = new URLSearchParams({
    response_type: 'token', client_id: TWITCH_CLIENT_ID, redirect_uri: REDIRECT_URI, state,
  });
  window.location.assign(`https://id.twitch.tv/oauth2/authorize?${parameters}`);
}

function readOAuthResponse() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (!hash.has('access_token') && !hash.has('error')) return;
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  const receivedState = hash.get('state');
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  if (hash.get('error')) throw new Error(hash.get('error_description') || 'Login Twitch recusado.');
  if (!expectedState || expectedState !== receivedState) throw new Error('A validação de segurança do login falhou. Tenta novamente.');
  sessionStorage.setItem(TOKEN_KEY, hash.get('access_token'));
}

async function validateToken(token) {
  const response = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
  if (!response.ok) throw new Error('A sessão Twitch expirou.');
  const validation = await response.json();
  if (validation.client_id !== TWITCH_CLIENT_ID) throw new Error('O login pertence a outra aplicação Twitch.');
  return validation;
}

async function fetchTwitchUsers(token, ids = []) {
  const uniqueIds = [...new Set(ids.filter((id) => /^\d+$/.test(String(id))))];
  const users = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const query = new URLSearchParams();
    uniqueIds.slice(offset, offset + 100).forEach((id) => query.append('id', id));
    const response = await fetch(`https://api.twitch.tv/helix/users?${query}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': TWITCH_CLIENT_ID },
    });
    if (!response.ok) throw new Error('Não foi possível obter os perfis Twitch.');
    users.push(...(await response.json()).data);
  }
  return users;
}

async function loadLeaderboard() {
  const response = await fetch(`leaderboard.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar a leaderboard.');
  const document = await response.json();
  leaderboard = Array.isArray(document.players) ? document.players : [];
  elements.updatedAt.textContent = document.updatedAt
    ? new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(document.updatedAt))
    : '—';
}

function roleBadges(roles = {}, platform = 'twitch') {
  const badges = [];
  if (roles.subscriber) badges.push(platform === 'youtube'
    ? '<span class="badge member">MEMBRO</span>'
    : '<span class="badge sub">SUB</span>');
  if (roles.vip) badges.push('<span class="badge vip">VIP</span>');
  if (roles.moderator || roles.broadcaster) badges.push('<span class="badge mod">MOD</span>');
  return badges.join('');
}

function platformBadge(player) {
  const platform = platformOf(player);
  const label = platform === 'youtube' ? 'YOUTUBE' : 'TWITCH';
  return `<span class="platform-badge ${platform}"><i aria-hidden="true"></i>${label}</span>`;
}

function avatarMarkup(player) {
  const profile = platformOf(player) === 'twitch' ? twitchProfiles.get(externalId(player)) : null;
  const image = safeImageUrl(profile?.profile_image_url || player.profileImageUrl);
  if (image) return `<img src="${image}" alt="" loading="lazy">`;
  const initial = escapeHtml(String(player.name || '?').slice(0, 1).toLocaleUpperCase('pt-PT'));
  return `<span class="avatar-fallback" aria-hidden="true">${initial}</span>`;
}

function formatPoints(value) {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function playerIsMe(player) {
  return Boolean(twitchUser && platformOf(player) === 'twitch' && externalId(player) === String(twitchUser.id));
}

function renderRows(filter = '') {
  const normalizedFilter = filter.trim().toLocaleLowerCase('pt-PT');
  const filtered = leaderboard.filter((player) => player.name.toLocaleLowerCase('pt-PT').includes(normalizedFilter));
  elements.body.innerHTML = filtered.map((player) => {
    const position = leaderboard.indexOf(player) + 1;
    const platform = platformOf(player);
    return `<tr class="${playerIsMe(player) ? 'is-me' : ''}">
      <td class="rank ${position <= 3 ? 'top' : ''}">${position}</td>
      <td><div class="player-cell">${avatarMarkup(player)}<div><div class="player-name">${escapeHtml(player.name)}${platformBadge(player)}</div><div class="badges">${roleBadges(player.roles, platform)}</div></div></div></td>
      <td class="score">${formatPoints(player.maxPoints)} pts</td>
      <td>Nível ${player.bestLevel || '—'}</td>
      <td>${player.runs}</td>
      <td><span class="multiplier">x${Number(player.multiplier || 1).toFixed(1)}</span></td>
      <td class="muted">${formatPoints(player.lastRunPoints)} pts</td>
    </tr>`;
  }).join('');
  elements.empty.hidden = filtered.length > 0;
}

function renderMyProfile() {
  if (!twitchUser) {
    elements.myProfile.hidden = true;
    return;
  }
  const player = leaderboard.find(playerIsMe);
  elements.welcome.textContent = `Olá, ${twitchUser.display_name}. A tabela continua visível para todos; o login apenas destaca o teu perfil.`;
  if (!player) {
    elements.myProfile.hidden = false;
    elements.myProfile.innerHTML = `${avatarMarkup({ id: `twitch:${twitchUser.id}`, platform: 'twitch', name: twitchUser.display_name })}<div class="profile-name"><strong>${escapeHtml(twitchUser.display_name)}</strong><span>Ainda não tens uma run registada. Entra no próximo jogo!</span></div>`;
    return;
  }
  const position = leaderboard.indexOf(player) + 1;
  elements.myProfile.hidden = false;
  elements.myProfile.innerHTML = `${avatarMarkup(player)}
    <div class="profile-name"><strong>${escapeHtml(player.name)}</strong><span>A tua posição na comunidade</span><div class="badges">${roleBadges(player.roles, 'twitch')}</div></div>
    <div class="profile-stat"><strong>#${position}</strong><span>posição</span></div>
    <div class="profile-stat"><strong>${formatPoints(player.maxPoints)}</strong><span>recorde</span></div>
    <div class="profile-stat"><strong>x${Number(player.multiplier || 1).toFixed(1)}</strong><span>multiplicador</span></div>`;
}

function renderSignedOutAccount() {
  elements.accountArea.innerHTML = '<div class="account-login-actions"><button id="header-twitch-login" class="account-login-button" type="button">Entrar com Twitch</button><span class="youtube-coming-soon">LOGIN YOUTUBE · EM PREPARAÇÃO</span></div>';
  document.querySelector('#header-twitch-login').addEventListener('click', beginTwitchLogin);
}

function renderAccount() {
  elements.accountArea.innerHTML = `<div class="account-chip"><img src="${safeImageUrl(twitchUser.profile_image_url)}" alt=""><div><strong>${escapeHtml(twitchUser.display_name)}</strong><button id="logout-button" type="button">Terminar sessão</button></div></div>`;
  document.querySelector('#logout-button').addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  });
}

async function enrichWithTwitchLogin(token, validation) {
  const twitchIds = [validation.user_id, ...leaderboard.filter((player) => platformOf(player) === 'twitch').map(externalId)];
  const profiles = await fetchTwitchUsers(token, twitchIds);
  twitchProfiles = new Map(profiles.map((profile) => [String(profile.id), profile]));
  twitchUser = twitchProfiles.get(String(validation.user_id));
  if (!twitchUser) throw new Error('Não foi possível identificar a tua conta Twitch.');
  renderAccount();
  renderMyProfile();
  renderRows(elements.search.value);
}

function renderPublicLeaderboard() {
  elements.playerCount.textContent = leaderboard.length;
  elements.topScore.textContent = formatPoints(leaderboard[0]?.maxPoints ?? 0);
  renderSignedOutAccount();
  renderRows();
}

async function initialize() {
  elements.search.addEventListener('input', () => renderRows(elements.search.value));
  try {
    readOAuthResponse();
    elements.status.textContent = 'A carregar a classificação…';
    await loadLeaderboard();
    renderPublicLeaderboard();
    elements.status.textContent = '';

    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    elements.status.textContent = 'A validar a tua conta Twitch…';
    const validation = await validateToken(token);
    await enrichWithTwitchLogin(token, validation);
    elements.status.textContent = '';
  } catch (error) {
    sessionStorage.removeItem(TOKEN_KEY);
    if (!leaderboard.length) renderSignedOutAccount();
    elements.status.textContent = error.message;
    elements.status.classList.add('error');
  }
}

initialize();
