(() => {
  'use strict';

  const cfg = window.SITE_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = (v) => String(v ?? '');
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = clean(text);
    return node;
  };
  const percent = (n) => Math.min(100, Math.max(0, Number(n) || 0));

  const projects = Array.isArray(cfg.projects) ? cfg.projects : [];
  const players = Array.isArray(cfg.players) ? cfg.players : [];
  let toastTimeout;

  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function addImage(container, src, alt) {
    if (!src) return;
    const img = el('img');
    img.src = src;
    img.alt = alt;
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove());
    container.append(img);
  }

  function renderProjects(filter = 'alle') {
    const root = $('#projects-grid');
    if (!root) return;
    root.replaceChildren();
    const visible = projects.filter(p => filter === 'alle' || p.status === filter);
    if (!visible.length) {
      root.append(el('div', 'empty-state', 'Für diesen Filter gibt es noch keine Bauprojekte.'));
      return;
    }

    visible.forEach(p => {
      const card = el('article', 'project-card');
      const theme = ['mountain', 'village', 'nether'].includes(p.theme) ? p.theme : 'custom';
      const photo = el('div', `project-photo theme-${theme}`);
      photo.append(el('div', 'placeholder-pattern'));
      addImage(photo, p.image, `Screenshot: ${clean(p.title)}`);
      photo.append(el('span', 'project-category', p.category || 'Bauprojekt'));
      photo.append(el('span', 'project-status', p.status === 'fertig' ? 'Fertig' : 'Im Bau'));

      const info = el('div', 'project-info');
      info.append(el('h3', '', p.title || 'Ohne Titel'));
      info.append(el('p', '', p.description || ''));

      const bottom = el('div', 'project-bottom');
      bottom.append(el('span', '', 'Baufortschritt'));
      bottom.append(el('strong', '', `${percent(p.progress)}%`));
      info.append(bottom);

      const track = el('div', 'track');
      const bar = el('span');
      bar.style.width = `${percent(p.progress)}%`;
      track.append(bar);
      info.append(track);

      const builders = Array.isArray(p.builders) ? p.builders.join(' · ') : '';
      info.append(el('div', 'project-builders', `Erbauer: ${builders || 'Noch offen'}`));

      card.append(photo, info);
      root.append(card);
    });

    const demo = $('#demo-note');
    if (demo) demo.hidden = !projects.some(p => p.demo);
  }

  $$('.filter').forEach(button => {
    button.addEventListener('click', () => {
      $$('.filter').forEach(other => other.classList.toggle('active', other === button));
      renderProjects(button.dataset.filter);
    });
  });
  renderProjects();

  function renderMilestones() {
    const root = $('#milestone-list');
    const items = Array.isArray(cfg.milestones) ? cfg.milestones : [];
    if (root) {
      root.replaceChildren();
      items.forEach((m, i) => {
        const item = el('div', `milestone ${m.done ? 'done' : ''}`);
        const icon = el('div', 'milestone-icon', m.done ? '✓' : String(i + 1).padStart(2, '0'));
        const detail = el('div', 'milestone-detail');
        detail.append(el('h3', '', m.title));
        detail.append(el('p', '', m.description));
        item.append(icon, detail);
        root.append(item);
      });
    }

    const done = items.filter(m => m.done).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const percentNode = $('#world-percent');
    const bar = $('#world-bar');
    const info = $('#world-info');
    const heroProgress = $('#hero-world-progress');
    if (percentNode) percentNode.textContent = `${pct}%`;
    if (bar) bar.style.width = `${pct}%`;
    if (info) info.textContent = `${done} von ${items.length} eingetragenen Meilensteinen erreicht.`;
    if (heroProgress) heroProgress.textContent = `${pct}% Weltfortschritt`;
  }
  renderMilestones();

  function renderPlayers() {
    const root = $('#players-grid');
    if (root) root.replaceChildren();

    players.forEach((p, i) => {
      const card = el('article', 'player-card');
      const avatar = el('div', 'player-avatar', String(i + 1).padStart(2, '0'));
      if (p.username) {
        avatar.textContent = '';
        addImage(avatar, `https://mc-heads.net/avatar/${encodeURIComponent(p.username)}/96`, `${p.name || p.username} Minecraft-Skin`);
      }
      card.append(avatar);
      card.append(el('h3', '', p.name || p.username || `Spieler ${i + 1}`));
      card.append(el('span', 'player-role', p.role || '5er Pasch'));
      root?.append(card);
    });

    const mini = $('#hero-avatars');
    if (mini) {
      mini.replaceChildren();
      players.slice(0, 5).forEach((p, i) => {
        const bubble = el('span', '', String(i + 1));
        if (p.username) {
          bubble.textContent = '';
          addImage(bubble, `https://mc-heads.net/avatar/${encodeURIComponent(p.username)}/32`, p.name || p.username);
        }
        mini.append(bubble);
      });
    }
  }
  renderPlayers();

  function renderUpdates() {
    const root = $('#updates-list');
    if (!root) return;
    root.replaceChildren();
    const items = Array.isArray(cfg.updates) ? cfg.updates : [];
    items.forEach(u => {
      const article = el('article', 'update-card');
      const meta = el('div', 'update-meta');
      meta.append(el('span', '', u.type || 'Update'));
      meta.append(el('span', '', u.date || ''));
      article.append(meta, el('h3', '', u.title || 'Neues Update'), el('p', '', u.text || ''));
      root.append(article);
    });
    if (!root.children.length) root.append(el('div', 'empty-state', 'Hier erscheinen eure nächsten Updates.'));
  }
  renderUpdates();

  function setupMap() {
    if (!cfg.bluemapUrl) return;
    let url;
    try {
      url = new URL(cfg.bluemapUrl);
      if (url.protocol !== 'https:') return;
    } catch (e) {
      return;
    }
    const frame = $('#map-frame');
    if (frame) {
      frame.replaceChildren();
      const iframe = el('iframe');
      iframe.src = url.href;
      iframe.title = '5er Pasch – interaktive BlueMap-Weltkarte';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer';
      frame.append(iframe);
    }
    const link = $('#map-external-link');
    if (link) {
      link.href = url.href;
      link.classList.remove('hidden');
    }
    const note = $('.map-footnote');
    if (note) note.textContent = 'Falls die Karte hier nicht angezeigt wird, öffne sie über „Karte im neuen Tab öffnen“. Der Kartenserver muss Einbettung erlauben.';
  }
  setupMap();

  function setServerStatus(state, message, online, max, version) {
    const dot = $('#server-dot');
    const navDot = $('#nav-dot');
    [dot, navDot].forEach(d => {
      if (!d) return;
      d.className = `status-dot ${d === dot ? 'large ' : ''}${state}`;
    });

    const title = state === 'online' ? 'Server online' : state === 'offline' ? 'Server offline' : 'Noch nicht verbunden';
    const navTitle = state === 'online' ? 'Online' : state === 'offline' ? 'Offline' : 'Serverstatus';
    const heroTitle = $('#hero-server-state');
    const heroCopy = $('#hero-server-copy');
    const stateNode = $('#server-state');
    const navState = $('#nav-state');
    const messageNode = $('#server-message');
    const countNode = $('#online-count');
    const versionNode = $('#mc-version');

    if (stateNode) stateNode.textContent = title;
    if (navState) navState.textContent = navTitle;
    if (messageNode) messageNode.textContent = message;
    if (heroTitle) heroTitle.textContent = title;
    if (heroCopy) {
      heroCopy.textContent = Number.isFinite(online)
        ? `${online}${Number.isFinite(max) ? ` / ${max}` : ''} Spieler gerade online.`
        : message;
    }
    if (countNode) countNode.textContent = Number.isFinite(online) ? `${online} / ${Number.isFinite(max) ? max : '–'}` : '– / –';
    if (versionNode) versionNode.textContent = version || '–';
  }

  const serverAddress = clean(cfg.serverAddress).trim();
  const copyButton = $('#copy-ip');
  if (serverAddress) {
    const addressNode = $('#server-address');
    if (addressNode) addressNode.textContent = serverAddress;
    if (copyButton) {
      copyButton.disabled = false;
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(serverAddress);
          toast('Serveradresse kopiert!');
        } catch (e) {
          toast(`Serveradresse: ${serverAddress}`);
        }
      });
    }
  } else {
    setServerStatus('unknown', 'Trage deine Serveradresse in config.js ein.');
  }

  async function fetchServerStatus() {
    if (!serverAddress) return;
    setServerStatus('unknown', 'Live-Status wird abgefragt …');
    try {
      const edition = cfg.edition === 'bedrock' ? 'bedrock' : 'java';
      const response = await fetch(`https://api.mcstatus.io/v2/status/${edition}/${encodeURIComponent(serverAddress)}?query=false`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.online) {
        setServerStatus(
          'online',
          'Bereit für neue Abenteuer',
          data.players?.online,
          data.players?.max,
          data.version?.name_clean || data.version?.name_raw || '–'
        );
      } else {
        setServerStatus('offline', 'Im Moment nicht erreichbar');
      }
    } catch (e) {
      setServerStatus('unknown', 'Status derzeit nicht abrufbar');
    }
  }

  if (serverAddress) {
    fetchServerStatus();
    setInterval(fetchServerStatus, 60000);
  }

  const yearNode = $('#copyright-year');
  if (yearNode) yearNode.textContent = new Date().getFullYear();

  const menuBtn = $('#menu-toggle');
  const nav = $('#site-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const opening = !nav.classList.contains('open');
      nav.classList.toggle('open', opening);
      menuBtn.setAttribute('aria-expanded', String(opening));
      menuBtn.setAttribute('aria-label', opening ? 'Menü schließen' : 'Menü öffnen');
    });
    $$('#site-nav a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }));
  }
})();
