const TWITCH_CLIENT_ID = '3rg5uodkyj3s4oa9eec66td49uc1qt';
const GOOGLE_CLIENT_ID = '128990685472-2ef08a8s9n0ah76sd3nikru5am2vf3n7.apps.googleusercontent.com';
const REDIRECT_URI = 'https://z3rgtv.github.io/woz/';
const TOKEN_KEY = 'woz_twitch_access_token';
const YOUTUBE_USER_KEY = 'woz_youtube_user';
const OAUTH_STATE_KEY = 'woz_oauth_state';

const DEFAULT_MULTIPLIER_TIERS = [
  { minimumRuns: 5, multiplier: 1.1 },
  { minimumRuns: 15, multiplier: 1.2 },
  { minimumRuns: 30, multiplier: 1.3 },
  { minimumRuns: 50, multiplier: 1.4 },
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
  openPowerupsBtn: document.querySelector('#open-powerups-btn'),
  powerupsDialog: document.querySelector('#powerups-dialog'),
  powerupsClose: document.querySelector('#powerups-close'),
  powerupsList: document.querySelector('#powerups-list'),
  countAll: document.querySelector('#count-all'),
  countCommon: document.querySelector('#count-common'),
  countRare: document.querySelector('#count-rare'),
  countEpic: document.querySelector('#count-epic'),
  countLegendary: document.querySelector('#count-legendary'),
};

const DEFAULT_POWERUPS = [
  { id: 'next_hint_one_word', name: 'Pequena Pista', icon: '👁️', effectLabel: '1 pista', rarity: 'common', minimumLevel: 2, scope: 'NEXT_LEVEL', description: 'Revela uma letra aleatória numa palavra do próximo nível.' },
  { id: 'next_hint_two_words', name: 'Pista Dupla', icon: '👀', effectLabel: '2 pistas', rarity: 'common', minimumLevel: 2, scope: 'NEXT_LEVEL', description: 'Revela uma letra aleatória em duas palavras do próximo nível.' },
  { id: 'next_extra_time', name: 'Fôlego Extra', icon: '⏱️', effectLabel: '+15s', rarity: 'common', minimumLevel: 2, scope: 'NEXT_LEVEL', description: 'Acrescenta 15 segundos ao próximo nível.' },
  { id: 'score_multiplier_11', name: 'Pontuação Afinada', icon: '🎯', effectLabel: '×1,1', rarity: 'rare', minimumLevel: 2, scope: 'RUN', maxStacks: 3, maxValue: 1.3, description: 'Soma +0,1 aos pontos de progresso até ao limite máximo de ×1,3 nesta run.' },
  { id: 'hint_words_plus_one', name: 'Olhar Mais Atento', icon: '👓', effectLabel: '+1 palavra', rarity: 'rare', minimumLevel: 2, scope: 'RUN', maxValue: 4, description: 'Uma letra fica visível em mais uma palavra de todos os próximos níveis.' },
  { id: 'next_hint_extra_letter', name: 'Pista Mais Nítida', icon: '🔍', effectLabel: '+1 letra já', rarity: 'rare', minimumLevel: 2, scope: 'NEXT_LEVEL', description: 'No próximo nível, mostra mais uma letra no número de palavras já melhorado (máximo 4).' },
  { id: 'next_target_reduction', name: 'Meta Acessível', icon: '✂️', effectLabel: '−10% meta', rarity: 'rare', minimumLevel: 2, scope: 'NEXT_LEVEL', description: 'Corta 10% da meta necessária do próximo nível e mostra o corte no marcador.' },
  { id: 'hint_letters_plus_one', name: 'Pista Reforçada', icon: '🔎', effectLabel: '+1 letra', rarity: 'epic', minimumLevel: 4, scope: 'RUN', maxValue: 4, description: 'As palavras com pista mostram mais uma letra em todos os próximos níveis.' },
  { id: 'permanent_extra_time', name: 'Relógio Melhorado', icon: '🕰️', effectLabel: '+15s sempre', rarity: 'epic', minimumLevel: 4, scope: 'RUN', maxStacks: 3, maxValue: 45000, description: 'Todos os próximos níveis recebem mais 15 segundos (acumula até +45s).' },
  { id: 'next_head_start', name: 'Arranque Lançado', icon: '🚀', effectLabel: '+10% arranque', rarity: 'epic', minimumLevel: 4, scope: 'NEXT_LEVEL', description: 'O próximo nível começa com 10% da meta já preenchida.' },
  { id: 'next_hint_all_words', name: 'Tabuleiro Iluminado', icon: '💡', effectLabel: 'Todas', rarity: 'legendary', minimumLevel: 7, scope: 'NEXT_LEVEL', description: 'Revela uma letra em todas as palavras apenas no próximo nível.' },
  { id: 'permanent_target_reduction', name: 'Lâmina da Meta', icon: '🗡️', effectLabel: '−5% sempre', rarity: 'legendary', minimumLevel: 7, scope: 'RUN', maxStacks: 3, maxValue: 0.15, description: 'Corta 5% da meta de todos os próximos níveis para sempre; acumula até ao corte máximo de 15%.' },
  { id: 'long_word_boost', name: 'Mestre das Palavras', icon: '🏆', effectLabel: '6+ ×1,25', rarity: 'legendary', minimumLevel: 7, scope: 'RUN', maxStacks: 2, maxValue: 1.5, description: 'Palavras com 6 ou mais letras dão bónus de ×1,25 de progresso (acumula até ao máximo de ×1,5 nesta run).' },
];

const RARITY_LABELS = {
  common: 'Comum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
};

let gamePowerups = [...DEFAULT_POWERUPS];
let activeRarityFilter = 'all';
let leaderboard = [];
let twitchUser = null;
let youtubeUser = null;
let twitchProfiles = new Map();
let multiplierTiers = [...DEFAULT_MULTIPLIER_TIERS];

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

function renderPowerups(filterRarity = 'all') {
  const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
  const filtered = gamePowerups
    .filter((powerup) => filterRarity === 'all' || powerup.rarity === filterRarity)
    .sort((a, b) => {
      const rarityDifference = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
      if (rarityDifference !== 0) return rarityDifference;
      const levelDifference = Number(a.minimumLevel || 2) - Number(b.minimumLevel || 2);
      return levelDifference || a.name.localeCompare(b.name, 'pt-PT');
    });

  if (elements.countAll) elements.countAll.textContent = gamePowerups.length;
  if (elements.countCommon) elements.countCommon.textContent = gamePowerups.filter((p) => p.rarity === 'common').length;
  if (elements.countRare) elements.countRare.textContent = gamePowerups.filter((p) => p.rarity === 'rare').length;
  if (elements.countEpic) elements.countEpic.textContent = gamePowerups.filter((p) => p.rarity === 'epic').length;
  if (elements.countLegendary) elements.countLegendary.textContent = gamePowerups.filter((p) => p.rarity === 'legendary').length;

  if (!elements.powerupsList) return;

  const cardsByRarity = new Map(rarityOrder.map((rarity) => [rarity, []]));
  filtered.forEach((powerup) => cardsByRarity.get(powerup.rarity || 'common')?.push(powerup));

  const renderedGroups = rarityOrder
    .filter((rarity) => cardsByRarity.get(rarity)?.length)
    .map((rarity) => {
      const cards = cardsByRarity.get(rarity).map((powerup) => {
        const isRunScope = powerup.scope === 'RUN';
        const scopeLabel = isRunScope ? 'Permanente nesta run' : 'Apenas no próximo nível';
        const stackNote = Number(powerup.maxStacks || 1) > 1
          ? `<div><span>Acumulação</span><strong>Até ${powerup.maxStacks}×</strong></div>`
          : '';

        return `<article class="powerup-card rarity-${escapeHtml(rarity)}">
          <div class="powerup-card-icon" aria-hidden="true">${escapeHtml(powerup.icon || '⚡')}</div>
          <div class="powerup-card-body">
            <div class="powerup-card-head">
              <strong>${escapeHtml(powerup.name)}</strong>
              <span class="powerup-rarity-pill ${escapeHtml(rarity)}">${escapeHtml(RARITY_LABELS[rarity] || rarity)}</span>
            </div>
            ${powerup.effectLabel ? `<div class="powerup-effect">${escapeHtml(powerup.effectLabel)}</div>` : ''}
            <p class="powerup-description">${escapeHtml(powerup.description)}</p>
            <div class="powerup-facts">
              <div><span>Disponível</span><strong>Desde o nível ${Number(powerup.minimumLevel || 2)}</strong></div>
              <div><span>Duração</span><strong>${scopeLabel}</strong></div>
              ${stackNote}
            </div>
          </div>
        </article>`;
      }).join('');

      return `<section class="powerup-rarity-group rarity-${escapeHtml(rarity)}">
        <header class="powerup-group-heading">
          <div><span class="powerup-group-dot" aria-hidden="true"></span><strong>${escapeHtml(RARITY_LABELS[rarity])}</strong></div>
          <small>${cardsByRarity.get(rarity).length} ${cardsByRarity.get(rarity).length === 1 ? 'melhoria' : 'melhorias'}</small>
        </header>
        <div class="powerup-group-cards">${cards}</div>
      </section>`;
    }).join('');

  elements.powerupsList.innerHTML = renderedGroups;
}

function openPowerupsDialog() {
  if (elements.historyDialog?.open) {
    elements.historyDialog.close();
  }
  document.body.classList.add('has-drawer-open');
  if (!elements.powerupsDialog.open) {
    elements.powerupsDialog.showModal();
  }
  renderPowerups(activeRarityFilter);
}

function closePowerupsDialog() {
  document.body.classList.remove('has-drawer-open');
  elements.powerupsDialog.close();
}

async function loadLeaderboard() {
  const response = await fetch(`leaderboard.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar a leaderboard.');
  const document = await response.json();
  leaderboard = Array.isArray(document.players) ? document.players : [];
  if (Array.isArray(document.game?.multiplierTiers) && document.game.multiplierTiers.length > 0) {
    multiplierTiers = document.game.multiplierTiers
      .map((tier) => ({
        minimumRuns: Number(tier.minimumRuns),
        multiplier: Number(tier.multiplier),
      }))
      .filter((tier) => Number.isFinite(tier.minimumRuns) && Number.isFinite(tier.multiplier))
      .sort((a, b) => a.minimumRuns - b.minimumRuns);
  }
  if (Array.isArray(document.game?.powerUps) && document.game.powerUps.length > 0) {
    gamePowerups = document.game.powerUps;
  }
  renderPowerups(activeRarityFilter);
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

function formatMultiplier(value) {
  return Number(value || 1).toFixed(2).replace('.', ',').replace(/,?0+$/, '');
}

function formatRunDate(value) {
  if (!Number(value)) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(Number(value)));
}

function runPowerupsMarkup(run) {
  const powerups = Array.isArray(run?.powerups) ? run.powerups : [];
  if (powerups.length === 0) {
    return '<p class="run-powerups-empty">Os power-ups ainda não eram registados nesta run.</p>';
  }

  return `<section class="run-powerups">
    <div class="run-powerups-heading"><strong>Power-ups conquistados</strong><span>${powerups.length}</span></div>
    <div class="run-powerups-list">${powerups.map((powerup) => {
      const rarity = ['common', 'rare', 'epic', 'legendary'].includes(powerup.rarity) ? powerup.rarity : 'common';
      return `<div class="run-powerup rarity-${rarity}" title="Escolhido depois do nível ${Number(powerup.selectedAfterLevel) || '—'}">
        <span class="run-powerup-icon" aria-hidden="true">${escapeHtml(powerup.icon || '⚡')}</span>
        <span><strong>${escapeHtml(powerup.name || 'Power-up')}</strong><small>${escapeHtml(powerup.effectLabel || RARITY_LABELS[rarity])} · após nível ${Number(powerup.selectedAfterLevel) || '—'}</small></span>
      </div>`;
    }).join('')}</div>
  </section>`;
}

function calculateRunTrend(runs = []) {
  const validRuns = runs.filter((run) => Number(run.basePoints) >= 0).slice(0, 5);
  if (validRuns.length < 2) return { status: 'neutral', label: 'Ainda sem tendência', detail: 'São necessárias pelo menos duas runs detalhadas.', percentage: 0 };

  const newest = validRuns.slice(0, Math.min(2, validRuns.length));
  const older = validRuns.length >= 4 ? validRuns.slice(2, 4) : validRuns.slice(1);
  const average = (items) => items.reduce((sum, run) => sum + Number(run.basePoints || 0), 0) / Math.max(1, items.length);
  const newestAverage = average(newest);
  const olderAverage = average(older);
  const percentage = olderAverage > 0 ? Math.round(((newestAverage - olderAverage) / olderAverage) * 100) : (newestAverage > 0 ? 100 : 0);

  if (percentage >= 5) return { status: 'improving', label: 'A melhorar', detail: `As runs recentes subiram cerca de ${percentage}% em pontos-base.`, percentage };
  if (percentage <= -5) return { status: 'declining', label: 'Abaixo do ritmo habitual', detail: `As runs recentes ficaram cerca de ${Math.abs(percentage)}% abaixo das anteriores.`, percentage };
  return { status: 'steady', label: 'Desempenho estável', detail: 'As runs recentes mantêm um resultado semelhante.', percentage };
}

function runTrendMarkup(runs = []) {
  const chronological = runs.slice(0, 5).reverse();
  const trend = calculateRunTrend(runs);
  const maximum = Math.max(1, ...chronological.map((run) => Number(run.basePoints) || 0));
  const bars = chronological.map((run, index) => {
    const height = Math.max(8, Math.round(((Number(run.basePoints) || 0) / maximum) * 100));
    return `<div class="trend-bar-column"><span class="trend-bar" style="height:${height}%" title="${formatPoints(run.basePoints)} pontos-base"></span><small>${index + 1}</small></div>`;
  }).join('');

  return `<section class="performance-trend ${trend.status}">
    <div class="trend-copy"><span>EVOLUÇÃO RECENTE</span><strong>${trend.label}</strong><p>${trend.detail}</p></div>
    <div class="trend-chart" aria-label="Pontos-base das últimas runs, da mais antiga para a mais recente">${bars || '<span class="trend-empty">Sem dados</span>'}</div>
  </section>`;
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
    ${runPowerupsMarkup(run)}
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
    return externalId(player) === String(youtubeUser.id);
  }
  return false;
}

function openPlayerHistory(playerId) {
  const player = leaderboard.find((candidate) => String(candidate.id) === String(playerId));
  if (!player) return;
  const platform = platformOf(player);
  const isMe = playerIsMe(player);
  const recentRuns = Array.isArray(player.runHistory) ? player.runHistory.slice(0, 5) : [];

  let personalSection = '';
  if (isMe) {
    const hasLifetimeTotals = Number.isFinite(Number(player.trackedRuns)) && Number(player.trackedRuns) > 0;
    const trackedRuns = hasLifetimeTotals ? Number(player.trackedRuns) : (player.runHistory ?? []).length;
    const totalWords = Number(player.totalWordsFound) || (player.runHistory ?? []).reduce((sum, r) => sum + (Number(r.wordsFound) || 0), 0);
    const totalBasePoints = Number(player.totalBasePoints) || (player.runHistory ?? []).reduce((sum, r) => sum + (Number(r.basePoints) || 0), 0);
    const totalLevels = Number(player.totalLevelsReached) || (player.runHistory ?? []).reduce((sum, r) => sum + (Number(r.levelReached) || 0), 0);
    const avgWordsPerRun = trackedRuns > 0 ? (totalWords / trackedRuns).toFixed(1).replace('.', ',') : '—';
    const avgPointsPerRun = trackedRuns > 0 ? formatPoints(totalBasePoints / trackedRuns) : '—';
    const avgLevel = trackedRuns > 0 ? (totalLevels / trackedRuns).toFixed(1).replace('.', ',') : '—';
    const longestWord = player.bestRun?.longestWord || (player.runHistory ?? []).reduce((max, r) => (r.longestWord?.length > max.length ? r.longestWord : max), '');

    const nextTier = multiplierTiers.find((tier) => tier.minimumRuns > player.runs);
    let progressionMarkup = '';
    if (nextTier) {
      const needed = nextTier.minimumRuns - player.runs;
      const pct = Math.min(100, Math.max(4, Math.round((player.runs / nextTier.minimumRuns) * 100)));
      progressionMarkup = `<div class="progression-card">
        <div class="progression-head"><span>PROGRESSO DE RUNS</span><strong>Próximo patamar: ×${formatMultiplier(nextTier.multiplier)} (${player.runs}/${nextTier.minimumRuns} runs)</strong></div>
        <div class="progression-bar"><span style="width: ${pct}%"></span></div>
        <small>Faltam apenas ${needed} ${needed === 1 ? 'run válida' : 'runs válidas'} para subires o multiplicador de regularidade!</small>
      </div>`;
    } else {
      const maximumTier = multiplierTiers.at(-1) ?? { minimumRuns: 0, multiplier: 1 };
      progressionMarkup = `<div class="progression-card">
        <div class="progression-head"><span>PROGRESSO DE RUNS</span><strong>🏆 Patamar Máximo de Regularidade Atingido! (×${formatMultiplier(maximumTier.multiplier)})</strong></div>
        <div class="progression-bar"><span style="width: 100%"></span></div>
        <small>Parabéns! Atingiste o patamar máximo configurado, a partir de ${maximumTier.minimumRuns} runs válidas.</small>
      </div>`;
    }

    const statisticsScope = hasLifetimeTotals
      ? 'Totais históricos completos'
      : `Análise baseada nas ${trackedRuns} runs detalhadas disponíveis`;

    personalSection = `<div class="personal-view-banner">⭐ O Teu Perfil Autenticado · Estatísticas Avançadas</div>
      <p class="personal-statistics-scope">${statisticsScope}</p>
      <div class="personal-insights-grid is-detailed">
        <div class="insight-box"><strong>${player.runs}</strong><span>runs válidas</span></div>
        <div class="insight-box"><strong>${totalWords}</strong><span>${hasLifetimeTotals ? 'palavras no total' : 'palavras analisadas'}</span></div>
        <div class="insight-box"><strong>${avgWordsPerRun}</strong><span>palavras / run analisada</span></div>
        <div class="insight-box"><strong>${avgPointsPerRun}</strong><span>pontos / run analisada</span></div>
        <div class="insight-box"><strong>${avgLevel}</strong><span>nível médio analisado</span></div>
        <div class="insight-box"><strong>${longestWord ? escapeHtml(longestWord.toLocaleUpperCase('pt-PT')) : '—'}</strong><span>maior palavra</span></div>
      </div>
      ${runTrendMarkup(recentRuns)}
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
  elements.welcome.textContent = `Olá, ${currentName}. A tabela continua visível para todos; o login confirma e destaca o teu perfil.`;
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
    <div class="profile-stat"><strong>x${Number(player.multiplier || 1).toFixed(1)}</strong><span>multiplicador</span></div>
    <button class="profile-details-button" type="button">Ver evolução e runs</button>`;
  elements.myProfile.querySelector('.profile-details-button')?.addEventListener('click', () => openPlayerHistory(player.id));
}

function beginGoogleLogin() {
  if (window.google?.accounts?.oauth2) {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          try {
            elements.status.textContent = 'A autenticar com a Google…';
            const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            if (res.ok) {
              const channel = (await res.json()).items?.[0];
              if (!channel?.id) throw new Error('youtube_channel_not_found');
              youtubeUser = {
                id: channel.id,
                name: channel.snippet?.title ?? 'Canal YouTube',
                picture: channel.snippet?.thumbnails?.default?.url ?? '',
                platform: 'youtube',
              };
              sessionStorage.setItem(YOUTUBE_USER_KEY, JSON.stringify(youtubeUser));
              renderAccount();
              renderMyProfile();
              renderRows(elements.search.value);
              elements.status.textContent = '';
            } else throw new Error(`youtube_api_${res.status}`);
          } catch (err) {
            elements.status.textContent = 'Falha ao autenticar com a Google. Tenta novamente.';
            elements.status.classList.add('error');
          }
        }
      },
    });
    client.requestAccessToken();
  } else {
    elements.status.textContent = 'O serviço de autenticação Google ainda não terminou de carregar. Tenta novamente dentro de instantes.';
    elements.status.classList.add('error');
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

  elements.openPowerupsBtn?.addEventListener('click', openPowerupsDialog);
  elements.powerupsClose?.addEventListener('click', closePowerupsDialog);
  elements.powerupsDialog?.addEventListener('close', () => {
    document.body.classList.remove('has-drawer-open');
  });
  elements.powerupsDialog?.addEventListener('click', (event) => {
    if (event.target === elements.powerupsDialog) closePowerupsDialog();
  });

  document.querySelectorAll('.rarity-filter').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.rarity-filter').forEach((b) => b.classList.remove('is-active'));
      button.classList.add('is-active');
      activeRarityFilter = button.dataset.rarity || 'all';
      renderPowerups(activeRarityFilter);
    });
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
