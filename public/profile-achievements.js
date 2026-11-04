(() => {
  "use strict";
  // Client-only enrichment of the existing profile dialog. No extra Paper plugin or tick loop.
  const API = "/api/players";
  const el = id => document.getElementById(id);
  const usernamePattern = /^[A-Za-z0-9_]{3,16}$/;
  const metrics = [
    { key: "playTicks", label: "Spielzeit", format: n => (n / 72000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Std." },
    { key: "deaths", label: "Tode", format: n => n.toLocaleString("de-DE") },
    { key: "mobKills", label: "Besiegte Mobs", format: n => n.toLocaleString("de-DE") },
    { key: "walkedCm", label: "Zu Fuß", format: n => (n / 100000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km" },
    { key: "jumps", label: "Sprünge", format: n => n.toLocaleString("de-DE") }
  ];
  let active = "";
  let snapshot = null;
  let status = "loading";

  function announce(container, message) {
    container.replaceChildren();
    const p = document.createElement("p");
    p.className = "profile-data-empty";
    p.textContent = message;
    container.append(p);
  }
  function achievementsFor(data, name) {
    const prefix = name.toLowerCase() + " hat den fortschritt ";
    return (Array.isArray(data?.events) ? data.events : [])
      .filter(event => event && event.type === "advancement" &&
        typeof event.title === "string" && typeof event.description === "string" &&
        event.description.toLowerCase().startsWith(prefix) &&
        Number.isFinite(Date.parse(event.occurredAt)))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 8);
  }
  function render(name) {
    if (!el("player-profile")?.open || !usernamePattern.test(name)) return;
    const statRoot = el("profile-stats");
    const achievementRoot = el("profile-achievements");
    const updated = el("profile-data-updated");
    const achievementCount = el("profile-achievement-count");
    statRoot.replaceChildren();
    achievementRoot.replaceChildren();
    updated.textContent = "";

    if (!snapshot) {
      announce(statRoot, status === "loading" ? "Statistiken werden geladen …" :
        "Statistiken sind derzeit nicht erreichbar.");
      announce(achievementRoot, "Erfolge derzeit nicht verfügbar.");
      achievementCount.textContent = "";
      return;
    }
    const stat = (Array.isArray(snapshot.stats) ? snapshot.stats : [])
      .find(entry => entry && typeof entry.username === "string" &&
        entry.username.toLowerCase() === name.toLowerCase());
    if (!stat || !snapshot.statsUpdatedAt) {
      announce(statRoot, "Für diesen Spieler sind noch keine Statistiken vorhanden.");
    } else {
      const date = new Date(snapshot.statsUpdatedAt);
      if (Number.isFinite(date.getTime()))
        updated.textContent = "Stand: " + date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      metrics.forEach(metric => {
        if (!Number.isSafeInteger(stat[metric.key]) || stat[metric.key] < 0) return;
        const box = document.createElement("div");
        box.className = "profile-stat";
        const num = document.createElement("strong");
        num.textContent = metric.format(stat[metric.key]);
        const caption = document.createElement("span");
        caption.textContent = metric.label;
        box.append(num, caption);
        statRoot.append(box);
      });
      if (!statRoot.children.length)
        announce(statRoot, "Keine gültigen Statistikwerte vorhanden.");
    }
    const achievements = achievementsFor(snapshot, name);
    achievementCount.textContent = achievements.length ? achievements.length + " erfasst" : "";
    if (!achievements.length) {
      announce(achievementRoot, "Noch keine seit Aktivierung der Chronik erfassten Achievements.");
    } else {
      achievements.forEach(event => {
        const row = document.createElement("article");
        row.className = "profile-achievement";
        const symbol = document.createElement("span");
        symbol.className = "profile-achievement-icon";
        symbol.textContent = "✦";
        symbol.setAttribute("aria-hidden", "true");
        const text = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = event.title;
        const date = document.createElement("time");
        date.dateTime = new Date(event.occurredAt).toISOString();
        date.textContent = new Date(event.occurredAt).toLocaleDateString("de-DE", {
          day: "numeric", month: "short", year: "numeric"
        });
        text.append(label, date);
        row.append(symbol, text);
        achievementRoot.append(row);
      });
    }
  }

  async function refresh() {
    try {
      const response = await fetch(API, { cache: "no-store" });
      if (!response.ok) throw new Error("Cloudflare API unavailable");
      const data = await response.json();
      if (!data.enabled || !Array.isArray(data.players)) throw new Error("Sync disabled");
      snapshot = data;
      status = "ready";
    } catch (_) {
      // Keep cached data, if any; only show an error when no data has ever loaded.
      if (!snapshot) status = "error";
    }
    if (active) render(active);
  }
  document.addEventListener("5erpasch:profile-open", event => {
    const username = String(event.detail?.username || "").trim();
    active = usernamePattern.test(username) ? username : "";
    render(active);
  });
  document.getElementById("player-profile")?.addEventListener("close", () => { active = ""; });
  refresh();
  setInterval(refresh, 60000);
})();