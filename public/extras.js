(() => {
  "use strict";
  const cfg = window.SITE_CONFIG || {};
  const $ = (selector) => document.querySelector(selector);
  const get = (value) => String(value ?? "").trim();

  // Auf allen Unterseiten gleiches kleines Navigationsmenü.
  const menuBtn = $("#menu-toggle"), menu = $("#site-menu");
  if (menuBtn && menu) {
    const closeMenu = () => {
      menu.hidden = true;
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Navigationsmenü öffnen");
    };
    menuBtn.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Navigationsmenü schließen" : "Navigationsmenü öffnen");
    });
    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("click", (event) => {
      if (!menu.hidden && !menu.contains(event.target) && !menuBtn.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        closeMenu(); menuBtn.focus();
      }
    });
  }

  const discord = get(cfg.discordUrl);
  document.querySelectorAll("[data-discord]").forEach((link) => {
    if (/^https:\/\/(discord\.gg|discord\.com\/invite)\//i.test(discord)) {
      link.href = discord;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.removeAttribute("aria-disabled");
    } else {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.addEventListener("click", (event) => event.preventDefault());
    }
  });
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  // BlueMap wird auf dem Minecraft-Server gerendert. Nur eine echte URL einbinden.
  const mapSetup = $("#map-setup");
  if (mapSetup) {
    const rawMapUrl = get(cfg.bluemapUrl);
    if (rawMapUrl) {
      try {
        const url = new URL(rawMapUrl, window.location.href);
        if (url.protocol === "https:") {
          $("#bluemap-frame").src = url.href;
          $("#map-external").href = url.href;
          $("#map-connected").hidden = false;
          mapSetup.hidden = true;
        } else if (url.protocol === "http:") {
          $("#map-http-link").href = url.href;
          $("#map-http").hidden = false;
          mapSetup.hidden = true;
        }
      } catch (error) {
        // Ungültige URL: Der Einrichtungshinweis bleibt sichtbar.
      }
    }
  }

  // Stats nur aus tatsächlich übertragenen Minecraft-Serverwerten.
  if (!$("#stats-status")) return;
  const server = get(cfg.serverAddress);
  const edition = cfg.edition === "bedrock" ? "bedrock" : "java";
  const samples = [], maxSamples = 24;
  const refreshBtn = $("#refresh-stats");
  const update = (id, value) => {
    const node = $(id);
    if (node) node.textContent = value;
  };
  const numberOrNull = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

  function setStatus(text, state) {
    update("#stats-status", text);
    const dot = $("#stats-dot");
    if (dot) dot.className = "status-dot" + (state === "online" ? " online" : state === "offline" ? " offline" : "");
  }

  function setPlayerNames(list, onlineCount) {
    const root = $("#stats-player-names");
    root.replaceChildren();
    const seen = new Set();
    const names = (Array.isArray(list) ? list : [])
      .map((item) => get(typeof item === "string" ? item : item?.name_clean || item?.name_raw || item?.name))
      .filter((name) => {
        const key = name.toLowerCase();
        if (!name || seen.has(key)) return false;
        seen.add(key); return true;
      });
    for (const name of names) {
      const row = document.createElement("div");
      row.className = "stats-player";
      const dot = document.createElement("i");
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = name;
      row.append(dot, label); root.append(row);
    }
    if (!names.length || (onlineCount !== null && onlineCount > names.length)) {
      const note = document.createElement("p");
      note.textContent = onlineCount === 0
        ? "Gerade ist niemand online."
        : names.length
          ? "Weitere Spielernamen werden vom Server nicht veröffentlicht."
          : onlineCount === null
            ? "Keine Namen verfügbar."
            : onlineCount > 0
              ? "Der Server meldet aktive Spieler, veröffentlicht jedoch keine Namen."
              : "Keine Spieler online.";
      root.append(note);
    }
  }

  function drawChart() {
    const polyline = $("#chart-line"), fill = $("#chart-area");
    if (samples.length < 2) {
      update("#chart-message", samples.length === 0
        ? "Der Verlauf baut sich automatisch auf, während du hier bist."
        : "Erster Live-Messwert erfasst. Weitere Werte folgen ungefähr jede Minute.");
      polyline.setAttribute("points", "");
      fill.setAttribute("d", "");
      return;
    }
    const peak = Math.max(1, ...samples.map((s) => s.count));
    const coords = samples.map((sample, i) => ({
      x: 10 + (i / (samples.length - 1)) * 620,
      y: 170 - (sample.count / peak) * 144
    }));
    const points = coords.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
    polyline.setAttribute("points", points);
    fill.setAttribute("d", "M " + coords.map((p) => p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" L ") + " L 630 170 L 10 170 Z");
    update("#chart-message", samples.length + " Messpunkte seit Öffnen der Seite · Höchstwert hier: " + peak + " Spieler");
  }

  async function loadStats() {
    if (!server) {
      setStatus("Server-IP nicht eingerichtet", "unknown");
      update("#stats-updated", "Keine Daten");
      update("#stat-address", "Noch nicht eingetragen");
      setPlayerNames([], null);
      return;
    }
    refreshBtn.disabled = true;
    update("#stat-address", server);
    try {
      const response = await fetch(
        "https://api.mcstatus.io/v2/status/" + edition + "/" + encodeURIComponent(server),
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Statusabfrage fehlgeschlagen");
      const data = await response.json();
      const observedAt = Number.isFinite(data.retrieved_at) ? new Date(data.retrieved_at) : new Date();
      const stamp = Number.isFinite(observedAt.getTime())
        ? observedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"
        : "Gerade eben";
      update("#stats-updated", "Stand: " + stamp);

      if (data.online) {
        setStatus("Server online", "online");
        const online = numberOrNull(data.players?.online);
        const max = numberOrNull(data.players?.max);
        const free = online === null || max === null ? null : Math.max(0, max - online);
        update("#stat-online", online === null ? "–" : String(online));
        update("#stat-free", free === null ? "–" : String(free));
        update("#stat-online-detail", online === null ? "Spielerzahl unbekannt" : "Spieler momentan verbunden");
        update("#stat-free-detail", max === null ? "Platzlimit unbekannt" : "Von insgesamt " + max + " Plätzen");

        const version = get(data.version?.name_clean || data.version?.name || data.version?.name_raw) || "Unbekannt";
        const software = typeof data.software === "string" ? get(data.software) : "";
        update("#stat-version", version);
        update("#stat-software", software ? version + " / " + software : version);
        const motd = get(data.motd?.clean).replace(/\s+/g, " ").slice(0, 160);
        update("#stat-motd", motd || "Keine Serverbeschreibung übermittelt.");
        setPlayerNames(data.players?.list, online);

        if (online !== null) {
          samples.push({ count: online, timestamp: observedAt.getTime() });
          if (samples.length > maxSamples) samples.shift();
        }
        drawChart();
      } else {
        setStatus("Server offline", "offline");
        update("#stat-online", "0");
        update("#stat-free", "–");
        update("#stat-online-detail", "Momentan nicht erreichbar");
        update("#stat-free-detail", "Server momentan offline");
        update("#stat-version", "–");
        update("#stat-software", "–");
        update("#stat-motd", "–");
        setPlayerNames([], 0);
        samples.push({ count: 0, timestamp: observedAt.getTime() });
        if (samples.length > maxSamples) samples.shift();
        drawChart();
      }
    } catch (error) {
      setStatus("Daten gerade nicht verfügbar", "unknown");
      update("#stats-updated", "Abfrage fehlgeschlagen");
      update("#stat-online", "–");
      update("#stat-free", "–");
      update("#stat-version", "–");
      update("#stat-software", "–");
      update("#stat-motd", "–");
      setPlayerNames([], null);
    } finally {
      refreshBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener("click", loadStats);
  loadStats();
  window.setInterval(loadStats, 60000);
})();
