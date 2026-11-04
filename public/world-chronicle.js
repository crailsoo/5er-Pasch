(() => {
  "use strict";
  const root = document.querySelector("#chronicle-list");
  if (!root) return;
  const fallback = (Array.isArray(window.SITE_CONFIG?.chronicle) ? window.SITE_CONFIG.chronicle : [])
    .filter(e => e && e.demo !== true && typeof e.title === "string" && e.title.trim())
    .map(e => ({ id: "manual:" + e.date + ":" + e.title,
      date: e.date, title: e.title, description: e.description || "",
      occurredAt: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date + "T12:00:00Z" : null }));
  function render(events) {
    const byId = new Map();
    for (const e of [...fallback, ...events]) {
      if (!e || !e.title || !e.occurredAt || !Number.isFinite(Date.parse(e.occurredAt))) continue;
      byId.set(e.id, e);
    }
    const sorted = [...byId.values()]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 12);
    if (!sorted.length) return;
    root.replaceChildren();
    for (const event of sorted) {
      const item = document.createElement("article");
      item.className = "chronicle-entry";
      const dot = document.createElement("span");
      dot.className = "chronicle-marker";
      dot.setAttribute("aria-hidden", "true");
      const date = document.createElement("time");
      date.className = "chronicle-date";
      const timestamp = new Date(event.occurredAt);
      date.dateTime = timestamp.toISOString();
      date.textContent = timestamp.toLocaleDateString("de-DE", {day: "numeric", month: "long", year: "numeric"});
      const body = document.createElement("div");
      body.className = "chronicle-body";
      const heading = document.createElement("h3");
      heading.textContent = event.title;
      const description = document.createElement("p");
      description.textContent = event.description || "";
      body.append(heading, description);
      item.append(dot, date, body);
      root.append(item);
    }
  }
  async function load() {
    try {
      const response = await fetch("/api/players", {cache: "no-store"});
      if (!response.ok) return;
      const data = await response.json();
      if (data.enabled && Array.isArray(data.events)) render(data.events);
    } catch (_) { /* Keep static server-history entries. */ }
  }
  render([]);
  load();
  setInterval(load, 60000);
})();
