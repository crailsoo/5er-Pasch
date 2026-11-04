(() => {
  "use strict";
  const list = document.querySelector("#leaderboard-list");
  if (!list) return;
  const status = document.querySelector("#leaderboard-status");
  const buttons = [...document.querySelectorAll("[data-leaderboard-metric]")];
  const validName = /^[A-Za-z0-9_]{3,16}$/;
  const metrics = {
    playTicks: { label: "Spielzeit", value: n => (n / 72000).toLocaleString("de-DE", {maximumFractionDigits: 1}) + " Std." },
    mobKills: { label: "Besiegte Mobs", value: n => n.toLocaleString("de-DE") },
    walkedCm: { label: "Gelaufene Strecke", value: n => (n / 100000).toLocaleString("de-DE", {maximumFractionDigits: 1}) + " km" },
    deaths: { label: "Tode", value: n => n.toLocaleString("de-DE") },
    jumps: { label: "Sprünge", value: n => n.toLocaleString("de-DE") }
  };
  let active = "playTicks";
  let stats = [];
  let updatedAt = null;

  function render() {
    list.replaceChildren();
    const meta = metrics[active];
    if (!updatedAt) {
      const empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = "Noch keine echten Langzeitdaten. Installiert die neue Version von 5erPaschPlayerSync auf Paper, damit die Ranglisten automatisch gefüllt werden.";
      list.append(empty);
      return;
    }
    const ranking = stats.filter(p => validName.test(p.username) && Number.isSafeInteger(p[active]) && p[active] >= 0)
      .sort((a, b) => b[active] - a[active] || a.username.localeCompare(b.username, "de"))
      .slice(0, 10);
    if (!ranking.length) {
      const empty = document.createElement("p");
      empty.className = "empty-copy";
      empty.textContent = "Noch keine Spielerstatistiken vorhanden.";
      list.append(empty);
      return;
    }
    ranking.forEach((player, i) => {
      const item = document.createElement("li");
      item.className = "leaderboard-item";
      const rank = document.createElement("span");
      rank.className = "leaderboard-place";
      rank.textContent = String(i + 1).padStart(2, "0");
      const avatar = document.createElement("img");
      avatar.className = "leaderboard-avatar";
      avatar.alt = "";
      avatar.loading = "lazy";
      avatar.src = "https://mc-heads.net/avatar/" + encodeURIComponent(player.username) + "/40";
      avatar.addEventListener("error", () => avatar.remove());
      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = player.username;
      const value = document.createElement("strong");
      value.className = "leaderboard-value";
      value.textContent = meta.value(player[active]);
      item.append(rank, avatar, name, value);
      list.append(item);
    });
  }

  buttons.forEach(button => button.addEventListener("click", () => {
    active = button.dataset.leaderboardMetric;
    buttons.forEach(b => b.setAttribute("aria-pressed", String(b === button)));
    render();
  }));

  async function load() {
    try {
      const response = await fetch("/api/players", { cache: "no-store" });
      if (!response.ok) throw new Error("API momentan nicht erreichbar");
      const data = await response.json();
      stats = Array.isArray(data.stats) ? data.stats : [];
      updatedAt = data.statsUpdatedAt || null;
      status.textContent = updatedAt
        ? "Letzter Abgleich: " + new Date(updatedAt).toLocaleString("de-DE", {dateStyle: "short", timeStyle: "short"})
        : "Wartet auf das aktualisierte Paper-Plugin";
      render();
    } catch (_) {
      status.textContent = "Synchronisierung nicht erreichbar";
      render();
    }
  }
  render();
  load();
  setInterval(load, 60000);
})();
