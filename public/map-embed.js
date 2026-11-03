(() => {
  "use strict";
  const cfg = window.SITE_CONFIG || {};
  const raw = String(cfg.bluemapUrl || "").trim();
  let original;
  try { original = new URL(raw); } catch { original = null; }
  const proxy = "/bluemap/index.html" + (original?.hash || "");
  const all = document.querySelectorAll("[data-bluemap]");
  for (const el of all) {
    const iframe = el.querySelector(".bluemap-iframe");
    const overlay = el.querySelector("[data-map-overlay]");
    const message = el.querySelector("[data-map-message]");
    const direct = el.querySelector("[data-map-direct]");
    const retry = el.querySelector("[data-map-retry]");
    if (original && /^https?:$/.test(original.protocol)) direct.href = original.href;
    else direct.hidden = true;
    async function connect() {
      retry.disabled = true;
      retry.hidden = true;
      overlay.hidden = false;
      iframe.hidden = true;
      message.textContent = "Weltkarte wird verbunden …";
      if (!original) {
        message.textContent = "Noch keine BlueMap-Adresse hinterlegt.";
        retry.disabled = false;
        return;
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        let response;
        try { response = await fetch("/bluemap/settings.json?check=" + Date.now(), { cache: "no-store", signal: controller.signal }); }
        finally { clearTimeout(timer); }
        if (!response.ok) throw new Error("BlueMap status " + response.status);
        const type = (response.headers.get("content-type") || "").toLowerCase();
        if (!type.includes("json")) throw new Error("Invalid map response");
        const settings = await response.json();
        if (!settings || typeof settings !== "object" || !settings.maps) throw new Error("Invalid map settings");
        iframe.addEventListener("load", () => { overlay.hidden = true; }, { once: true });
        iframe.src = proxy;
        iframe.hidden = false;
        message.textContent = "3D-Welt wird geladen …";
      } catch (e) {
        message.textContent = "Die Kartenverbindung ist gerade nicht erreichbar.";
        retry.hidden = false;
      } finally { retry.disabled = false; }
    }
    retry.addEventListener("click", connect);
    connect();
  }
})();