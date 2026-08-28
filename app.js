const TWITCH_CLIENT_ID = '3rg5uodkyj3s4oa9eec66td49uc1qt';
const GOOGLE_CLIENT_ID = '128990685472-2ef08a8s9n0ah76sd3nikru5am2vf3n7.apps.googleusercontent.com';
const REDIRECT_URI = 'https://z3rgtv.github.io/WOZ/';
const TOKEN_KEY = 'woz_twitch_access_token';
const YOUTUBE_USER_KEY = 'woz_youtube_user';
const OAUTH_STATE_KEY = 'woz_oauth_state';

const MULTIPLIER_TIERS = [
  { min: 5, mult: 1.1 },
  { min: 15, mult: 1.2 },
  { min: 30, mult: 1.3 },
  { min: 50, mult: 1.4 },
];

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
  historyDialog: document.querySelector('#player-history-dialog'),
  historyContent: document.querySelector('#player-history-content'),
  historyClose: document.querySelector('#history-close'),
  youtubeDialog: document.querySelector('#youtube-login-dialog'),
  youtubeClose: document.querySelector('#youtube-login-close'),
  youtubeForm: document.querySelector('#youtube-login-form'),
  youtubeInput: document.querySelector('#youtube-username-input'),
};

let leaderboard = [];
let twitchUser = null;
let youtubeUser = null;
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
  if (platformOf(player) === 'twitch') {
    const profile = twitchProfiles.get(externalId(player));
    const image = safeImageUrl(profile?.profile_image_url || player.profileImageUrl);
    if (image) return `<img src="${image}" alt="" loading="lazy">`;
  } else if (platformOf(player) === 'youtube') {
    if (playerIsMe(player) && youtubeUser?.picture) {
      const image = safeImageUrl(youtubeUser.picture);
      if (image) return `<img src="${image}" alt="" loading="lazy">`;
    }
    const image = safeImageUrl(player.profileImageUrl);
    if (image) return `<img src="${image}" alt="" loading="lazy">`;
  }
  const initial = escapeHtml(String(player.name || '?').slice(0, 1).toLocaleUpperCase('pt-PT'));
  return `<span class="avatar-fallback" aria-hidden="true">${initial}</span>`;
}

function formatPoints(value) {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatRunDate(value) {
  if (!Number(value)) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(Number(value)));
}

function runMarkup(run, label = '') {
  if (!run) return '<p class="history-empty">Ainda não existe uma run registada.</p>';
  const hasDetailedStats = Number(run.wordsFound) > 0 || Boolean(run.longestWord);
  return `<article class="history-run-card">
    <div class="history-run-heading"><div>${label ? `<span>${escapeHtml(label)}</span>` : ''}<strong>Nível ${Number(run.levelReached) || '—'}</strong></div><time>${escapeHtml(formatRunDate(run.endedAt))}</time></div>
    <div class="history-run-stats">
      <div><strong>${formatPoints(run.points)}</strong><span>pontos atuais</span></div>
      <div><strong>${formatPoints(run.basePoints)}</strong><span>pontos-base</span></div>
      <div><strong>${hasDetailedStats ? Number(run.wordsFound) : '—'}</strong><span>palavras</span></div>
      <div><strong>${run.longestWord ? escapeHtml(String(run.longestWord).toLocaleUpperCase('pt-PT')) : '—'}</strong><span>maior palavra</span></div>
      <div><strong>${hasDetailedStats ? Number(run.averageWordLength || 0).toFixed(1).replace('.', ',') : '—'}</strong><span>média de letras</span></div>
    </div>
    ${hasDetailedStats ? '' : '<p class="history-legacy-note">Este recorde é anterior à introdução das estatísticas detalhadas.</p>'}
  </article>`;
}

function playerIsMe(player) {
  if (twitchUser && platformOf(player) === 'twitch') {
    return externalId(player) === String(twitchUser.id) ||
      player.name.toLowerCase() === String(twitchUser.login || '').toLowerCase() ||
      player.name.toLowerCase() === String(twitchUser.display_name || '').toLowerCase();
  }
  if (youtubeUser && platformOf(player) === 'youtube') {
    const rawCleanName = String(youtubeUser.name).replace(/^@/, '').toLowerCase();
    const playerCleanName = String(player.name).replace(/^@/, '').toLowerCase();
    return playerCleanName === rawCleanName || externalId(player).toLowerCase() === rawCleanName;
  }
  return false;
}

function openPlayerHistory(playerId) {
  const player = leaderboard.find((candidate) => String(candidate.id) === String(playerId));
  if (!player) return;
  const platform = platformOf(player);
  const isMe = playerIsMe(player);
  const maxRuns = isMe ? 10 : 5;
  const recentRuns = Array.isArray(player.runHistory) ? player.runHistory.slice(0, maxRuns) : [];

  let personalSection = '';
  if (isMe) {
    const totalWords = (player.runHistory ?? []).reduce((sum, r) => sum + (Number(r.wordsFound) || 0), 0);
    const runsWithWords = (player.runHistory ?? []).filter((r) => Number(r.wordsFound) > 0);
    const avgWordsPerRun = runsWithWords.length > 0 ? (totalWords / runsWithWords.length).toFixed(1).replace('.', ',') : '—';
    const longestWord = player.bestRun?.longestWord || (player.runHistory ?? []).reduce((max, r) => (r.longestWord?.length > max.length ? r.longestWord : max), '');

    const nextTier = MULTIPLIER_TIERS.find((t) => t.min > player.runs);
    let progressionMarkup = '';
    if (nextTier) {
      const needed = nextTier.min - player.runs;
      const pct = Math.min(100, Math.max(4, Math.round((player.runs / nextTier.min) * 100)));
      progressionMarkup = `<div class="progression-card">
        <div class="progression-head"><span>PROGRESSO DE RUNS</span><strong>Próximo patamar: ×${nextTier.mult} (${player.runs}/${nextTier.min} runs)</strong></div>
        <div class="progression-bar"><span style="width: ${pct}%"></span></div>
        <small>Faltam apenas ${needed} ${needed === 1 ? 'run válida' : 'runs válidas'} para subires o multiplicador de regularidade!</small>
      </div>`;
    } else {
      progressionMarkup = `<div class="progression-card">
        <div class="progression-head"><span>PROGRESSO DE RUNS</span><strong>🏆 Patamar Máximo de Regularidade Atingido! (×1.4)</strong></div>
        <div class="progression-bar"><span style="width: 100%"></span></div>
        <small>Parabéns! Tens mais de 50 runs válidas na comunidade.</small>
      </div>`;
    }

    personalSection = `<div class="personal-view-banner">⭐ O Teu Perfil Autenticado · Estatísticas Avançadas</div>
      <div class="personal-insights-grid">
        <div class="insight-box"><strong>${totalWords}</strong><span>palavras acertadas</span></div>
        <div class="insight-box"><strong>${avgWordsPerRun}</strong><span>média palavras / run</span></div>
        <div class="insight-box"><strong>${longestWord ? escapeHtml(longestWord.toLocaleUpperCase('pt-PT')) : '—'}</strong><span>maior palavra</span></div>
        <div class="insight-box"><strong>Nível ${player.bestLevel || '—'}</strong><span>melhor nível</span></div>
      </div>
      ${progressionMarkup}`;
  }

  elements.historyContent.innerHTML = `<header class="history-profile-header">
    <div class="history-profile-info">
      ${avatarMarkup(player)}
      <div class="history-profile-text">
        <span class="eyebrow">${isMe ? 'O TEU PERFIL' : 'PERFIL DO JOGADOR'}</span>
        <h2 id="history-title">${escapeHtml(player.name)}</h2>
        <div class="badges">${platformBadge(player)}${roleBadges(player.roles, platform)}</div>
      </div>
    </div>
    <div class="history-profile-score">
      <strong>${formatPoints(player.maxPoints)}</strong>
      <span>recorde atual · x${Number(player.multiplier || 1).toFixed(1)}</span>
    </div>
  </header>
  ${personalSection}
  <p class="history-role-note">Os cargos e os recordes são recalculados quando o jogador volta a escrever no chat. Ganhar ou perder SUB, VIP, MOD ou membro YouTube altera também os resultados anteriores.</p>
  <section class="history-best"><h3>Melhor run</h3>${runMarkup(player.bestRun, 'RECORDE PESSOAL')}</section>
  <section class="history-recent"><h3>${isMe ? `As tuas últimas ${Math.min(10, recentRuns.length)} runs` : `Últimas ${Math.min(5, recentRuns.length)} runs`}</h3>${recentRuns.length ? recentRuns.map((run, index) => runMarkup(run, `RUN ${player.runs - index}`)).join('') : '<p class="history-empty">Ainda não existem runs detalhadas.</p>'}</section>`;

  document.body.classList.add('has-drawer-open');
  if (!elements.historyDialog.open) {
    elements.historyDialog.showModal();
  }
}

function renderRows(filter = '') {
  const normalizedFilter = filter.trim().toLocaleLowerCase('pt-PT');
  const filtered = leaderboard.filter((player) => player.name.toLocaleLowerCase('pt-PT').includes(normalizedFilter));
  elements.body.innerHTML = filtered.map((player) => {
    const position = leaderboard.indexOf(player) + 1;
    const platform = platformOf(player);
    const isMe = playerIsMe(player);
    return `<tr class="${isMe ? 'is-me' : ''}" data-player-id="${escapeHtml(player.id)}" tabindex="0" role="button" aria-label="Ver histórico de ${escapeHtml(player.name)}">
      <td class="rank ${position <= 3 ? 'top' : ''}">${position}</td>
      <td><div class="player-cell">${avatarMarkup(player)}<div><div class="player-name"><button class="player-profile-button" type="button" data-player-id="${escapeHtml(player.id)}">${escapeHtml(player.name)}</button>${platformBadge(player)}</div><div class="badges">${roleBadges(player.roles, platform)}</div></div></div></td>
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
  if (!twitchUser && !youtubeUser) {
    elements.myProfile.hidden = true;
    return;
  }
  const player = leaderboard.find(playerIsMe);
  const currentName = twitchUser ? twitchUser.display_name : youtubeUser.name;
  elements.welcome.textContent = `Olá, ${currentName}. A tabela continua visível para todos; o login destaca o teu perfil e desbloqueia as tuas 10 últimas runs e estatísticas.`;
  if (!player) {
    elements.myProfile.hidden = false;
    elements.myProfile.innerHTML = `${avatarMarkup({ id: twitchUser ? `twitch:${twitchUser.id}` : `youtube:${youtubeUser.name}`, platform: twitchUser ? 'twitch' : 'youtube', name: currentName })}<div class="profile-name"><strong>${escapeHtml(currentName)}</strong><span>Ainda não tens uma run registada. Entra no próximo jogo no chat!</span></div>`;
    return;
  }
  const position = leaderboard.indexOf(player) + 1;
  elements.myProfile.hidden = false;
  elements.myProfile.innerHTML = `${avatarMarkup(player)}
    <div class="profile-name"><strong>${escapeHtml(player.name)}</strong><span>A tua posição na comunidade</span><div class="badges">${roleBadges(player.roles, platformOf(player))}</div></div>
    <div class="profile-stat"><strong>#${position}</strong><span>posição</span></div>
    <div class="profile-stat"><strong>${formatPoints(player.maxPoints)}</strong><span>recorde</span></div>
    <div class="profile-stat"><strong>x${Number(player.multiplier || 1).toFixed(1)}</strong><span>multiplicador</span></div>`;
}

function beginGoogleLogin() {
  if (window.google?.accounts?.oauth2) {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/userinfo.profile',
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          try {
            elements.status.textContent = 'A autenticar com a Google…';
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            if (res.ok) {
              const profile = await res.json();
              youtubeUser = {
                id: profile.sub,
                name: profile.name,
                picture: profile.picture,
                platform: 'youtube',
              };
              sessionStorage.setItem(YOUTUBE_USER_KEY, JSON.stringify(youtubeUser));
              renderAccount();
              renderMyProfile();
              renderRows(elements.search.value);
              elements.status.textContent = '';
            }
          } catch (err) {
            elements.status.textContent = 'Falha ao autenticar com a Google. Tenta novamente.';
            elements.status.classList.add('error');
          }
        }
      },
    });
    client.requestAccessToken();
  } else {
    elements.youtubeDialog.showModal();
    elements.youtubeInput.focus();
  }
}

function renderSignedOutAccount() {
  elements.accountArea.innerHTML = '<div class="account-login-actions"><button id="header-twitch-login" class="account-login-button" type="button">Entrar com Twitch</button><button id="header-youtube-login" class="account-login-button youtube" type="button">Entrar com Google / YouTube</button></div>';
  document.querySelector('#header-twitch-login').addEventListener('click', beginTwitchLogin);
  document.querySelector('#header-youtube-login').addEventListener('click', beginGoogleLogin);
}

function renderAccount() {
  if (twitchUser) {
    elements.accountArea.innerHTML = `<div class="account-chip"><img src="${safeImageUrl(twitchUser.profile_image_url)}" alt=""><div><strong>${escapeHtml(twitchUser.display_name)}</strong><button id="logout-button" type="button">Terminar sessão</button></div></div>`;
  } else if (youtubeUser) {
    const avatar = youtubeUser.picture
      ? `<img src="${safeImageUrl(youtubeUser.picture)}" alt="">`
      : `<span class="avatar-fallback youtube">${escapeHtml(youtubeUser.name.slice(0, 1).toUpperCase())}</span>`;
    elements.accountArea.innerHTML = `<div class="account-chip">${avatar}<div><strong>${escapeHtml(youtubeUser.name)}</strong><button id="logout-button" type="button">Terminar sessão</button></div></div>`;
  }
  document.querySelector('#logout-button')?.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(YOUTUBE_USER_KEY);
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

function checkYouTubeSession() {
  const saved = sessionStorage.getItem(YOUTUBE_USER_KEY);
  if (saved) {
    try {
      youtubeUser = JSON.parse(saved);
      renderAccount();
      renderMyProfile();
      renderRows(elements.search.value);
    } catch {
      sessionStorage.removeItem(YOUTUBE_USER_KEY);
    }
  }
}

function renderPublicLeaderboard() {
  elements.playerCount.textContent = leaderboard.length;
  elements.topScore.textContent = formatPoints(leaderboard[0]?.maxPoints ?? 0);
  renderSignedOutAccount();
  renderRows();
}

async function initialize() {
  elements.search.addEventListener('input', () => renderRows(elements.search.value));

  elements.body.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-player-id]');
    if (row) openPlayerHistory(row.dataset.playerId);
  });
  elements.body.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const row = event.target.closest('tr[data-player-id]');
      if (row) {
        event.preventDefault();
        openPlayerHistory(row.dataset.playerId);
      }
    }
  });

  const closeDrawer = () => {
    document.body.classList.remove('has-drawer-open');
    elements.historyDialog.close();
  };
  elements.historyClose.addEventListener('click', closeDrawer);
  elements.historyDialog.addEventListener('close', () => {
    document.body.classList.remove('has-drawer-open');
  });
  elements.historyDialog.addEventListener('click', (event) => {
    if (event.target === elements.historyDialog) closeDrawer();
  });

  elements.youtubeClose?.addEventListener('click', () => elements.youtubeDialog.close());
  elements.youtubeDialog?.addEventListener('click', (event) => {
    if (event.target === elements.youtubeDialog) elements.youtubeDialog.close();
  });
  elements.youtubeForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const handle = elements.youtubeInput.value.trim();
    if (!handle) return;
    youtubeUser = { name: handle, platform: 'youtube' };
    sessionStorage.setItem(YOUTUBE_USER_KEY, JSON.stringify(youtubeUser));
    elements.youtubeDialog.close();
    renderAccount();
    renderMyProfile();
    renderRows(elements.search.value);
  });

  try {
    readOAuthResponse();
    elements.status.textContent = 'A carregar a classificação…';
    await loadLeaderboard();
    renderPublicLeaderboard();
    elements.status.textContent = '';

    checkYouTubeSession();

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
