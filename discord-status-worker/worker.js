/* Cloudflare Worker: 5er Pasch Discord status bot. No secrets in source.
   STATUS_STORE is a KV binding. ADMIN_TOKEN and DISCORD_WEBHOOK_URL are secrets.
   The scheduled() handler is run by a Cloudflare Cron Trigger, not by this chat. */
const SETTINGS_KEY = "5erpasch:discord-status:settings:v1";
const STATE_KEY = "5erpasch:discord-status:snapshot:v1";
const ADDRESS = "45.143.198.58:25605";
const MC_STATUS = "https://api.mcstatus.io/v2/status/java/45.143.198.58:25605?query=false";
const DEFAULTS = { mode: "auto", maintenanceReason: "", offlineReason: "", eta: "" };
const ACHIEVEMENT_KEY = "5erpasch:discord-achievements:delivered:v1";
const ACHIEVEMENT_API = "https://5erpasch.pages.dev/api/players";
const MAX_ACHIEVEMENTS_PER_CHECK = 5;


const ADMIN_HTML = "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>5er Pasch · Statusbot</title><style>*{box-sizing:border-box}body{margin:0;background:#101410;color:#eef2ec;font:16px system-ui}main{max-width:680px;margin:auto;padding:28px 20px}h1{font-size:36px;letter-spacing:-.04em}p{line-height:1.55;color:#b6c5b8}.card{border:1px solid #485a4b;border-radius:16px;padding:22px;margin:22px 0;background:#182019}label{display:block;margin:16px 0 6px;font-weight:600}input,select,textarea{display:block;width:100%;padding:12px;border:1px solid #66776a;border-radius:8px;background:#101410;color:#fff;font:inherit}textarea{min-height:78px}button{border:0;border-radius:8px;padding:12px 15px;background:#a0d6a2;color:#101410;font-weight:700;cursor:pointer;margin:14px 8px 0 0}.muted{font-size:13px}#output{white-space:pre-wrap}</style></head><body><main><small>5ER PASCH / DISCORD</small><h1>Serverstatus verwalten.</h1><p>Der Statusbot prüft euren Minecraft-Server alle fünf Minuten. Nur bekannte Gründe für Wartung oder Ausfälle eintragen. Der geheime Schlüssel bleibt auf diesem Gerät im Eingabefeld und wird nicht gespeichert.</p><section class=\"card\"><h2>Aktueller Status</h2><p id=\"status\">Wird geladen …</p></section><form id=\"form\" class=\"card\" autocomplete=\"off\"><h2>Mitteilung ändern</h2><label>Betriebsmodus</label><select id=\"mode\"><option value=\"auto\">Automatisch</option><option value=\"maintenance\">Wartung</option></select><label>Wartungsgrund (bei Wartung erforderlich)</label><textarea id=\"reason\" maxlength=\"220\" placeholder=\"z. B. Plugins aktualisieren und Backup erstellen\"></textarea><label>Bekannter Offline-Grund (optional)</label><textarea id=\"offline\" maxlength=\"220\" placeholder=\"Leer lassen, wenn Ursache unbekannt\"></textarea><label>Voraussichtliche Dauer (optional)</label><input id=\"eta\" maxlength=\"70\" placeholder=\"z. B. bis 19 Uhr\"><label>Geheimer Admin-Schlüssel</label><input id=\"token\" type=\"password\" autocomplete=\"off\" required minlength=\"32\"><button type=\"submit\">Speichern und Discord aktualisieren</button><button id=\"check\" type=\"button\">Jetzt prüfen</button><button id=\"achievement-check\" type=\"button\">Erfolge prüfen</button><p id=\"output\" role=\"status\"></p></form><p class=\"muted\">Die Statuskarte wird regelmäßig bearbeitet, zusätzliche Nachrichten gibt es nur bei Statuswechsel oder einem neuen Grund.</p></main><script>const el=x=>document.getElementById(x);async function refresh(){try{const r=await fetch('/status',{cache:'no-store'}),d=await r.json();el('status').textContent=(d.label||'Noch nicht eingerichtet')+(d.reason?' – '+d.reason:'')+(d.checkedAt?' (geprüft: '+new Date(d.checkedAt).toLocaleString('de-DE')+')':'')}catch(_){el('status').textContent='Abfrage derzeit nicht verfügbar'}}async function send(path,body){const token=el('token').value.trim();if(token.length<32){el('output').textContent='Bitte Admin-Schlüssel eingeben.';return}el('output').textContent='Übertrage …';try{const r=await fetch(path,{method:'POST',headers:{'authorization':'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();el('output').textContent=r.ok?'Erfolgreich. Discord-Kanal prüfen.':'Fehler '+r.status+': '+(d.error||'Unbekannt');if(r.ok)refresh()}catch(_){el('output').textContent='Verbindung fehlgeschlagen'}}el('form').addEventListener('submit',e=>{e.preventDefault();send('/admin/status',{mode:el('mode').value,maintenanceReason:el('reason').value,offlineReason:el('offline').value,eta:el('eta').value})});el('check').onclick=()=>send('/admin/check',{});el('achievement-check').onclick=()=>send('/admin/achievements-check',{});refresh();</script></body></html>";

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
const clean = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
function configured(env) {
  return !!(env.STATUS_STORE && typeof env.STATUS_STORE.get === "function" &&
    typeof env.STATUS_STORE.put === "function" &&
    typeof env.ADMIN_TOKEN === "string" && env.ADMIN_TOKEN.length >= 32 &&
    /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[0-9]+\/[\w-]+$/.test(env.DISCORD_WEBHOOK_URL || ""));
}
async function authorized(request, env) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 530) return false;
  const coder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", coder.encode(header.slice(7))),
    crypto.subtle.digest("SHA-256", coder.encode(env.ADMIN_TOKEN))
  ]);
  let diff = 0; const left = new Uint8Array(a), right = new Uint8Array(b);
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
async function pingMinecraft() {
  try {
    const r = await fetch(MC_STATUS, { cache: "no-store",
      signal: AbortSignal.timeout(12000), headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("Status endpoint failed");
    const data = await r.json();
    if (typeof data.online !== "boolean") throw new Error("Invalid status");
    return { online: data.online, players: data.online &&
      Number.isInteger(data.players?.online) ? data.players.online : 0 };
  } catch (_) {
    // Never claim "offline" when only the third-party status API is broken.
    return { online: null, players: null };
  }
}
function describe(settings, ping) {
  let state, label, reason;
  if (settings.mode === "maintenance") {
    state = "maintenance"; label = "🟡 WARTUNG";
    reason = settings.maintenanceReason || "Wartungsarbeiten, genauere Informationen folgen.";
  } else if (ping.online === true) {
    state = "online"; label = "🟢 ONLINE"; reason = "Der Minecraft-Server ist erreichbar.";
  } else if (ping.online === false) {
    state = "offline"; label = "🔴 OFFLINE";
    reason = settings.offlineReason ||
      "Der Server antwortet nicht. Die genaue Ursache ist noch unbekannt.";
  } else {
    state = "unknown"; label = "⚪ STATUS UNBEKANNT";
    reason = "Die Statusabfrage ist derzeit gestört. Die Erreichbarkeit ist unklar.";
  }
  return {state, label, reason, online: ping.online, players: ping.players,
    eta: state==="online" ? "" : (settings.eta || ""), checkedAt: new Date().toISOString(), address: ADDRESS};
}
function payload(status) {
  const colors = {online:0x43b86d, offline:0xe15a5a, maintenance:0xf1b955, unknown:0x89929e};
  const fields = [
    {name:"Grund / Hinweis",value:status.reason.slice(0,400),inline:false},
    {name:"Minecraft-Erreichbarkeit",value:status.online===null?"Nicht ermittelbar":status.online?"Erreichbar":"Nicht erreichbar",inline:true},
    {name:"Spieler online",value:status.online===true?String(status.players):"–",inline:true},
    {name:"Serveradresse",value:ADDRESS,inline:false}
  ];
  if(status.eta) fields.push({name:"Voraussichtliche Dauer",value:status.eta,inline:false});
  return {username:"5er Pasch · Status", allowed_mentions:{parse:[]},
    embeds:[{title:"5er Pasch · Serverstatus",description:"**"+status.label+"**",
    color:colors[status.state],url:"https://5erpasch.pages.dev",
    fields,timestamp:status.checkedAt,
    footer:{text:"Automatische Prüfung alle 5 Minuten · 5er Pasch"}}]};
}
async function publish(env, oldId, body) {
  if (oldId) {
    const r = await fetch(env.DISCORD_WEBHOOK_URL+"/messages/"+encodeURIComponent(oldId), {
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    if (r.ok) return oldId;
    if (r.status !== 404) throw new Error("Discord edit HTTP "+r.status);
  }
  const r = await fetch(env.DISCORD_WEBHOOK_URL+"?wait=true", {
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  if (!r.ok) throw new Error("Discord send HTTP "+r.status);
  const data = await r.json();
  if (typeof data.id !== "string") throw new Error("Discord message ID missing");
  return data.id;
}
async function check(env) {
  if (!configured(env)) throw new Error("Cloudflare bindings/secrets fehlen");
  const [settings, previous, ping] = await Promise.all([
    env.STATUS_STORE.get(SETTINGS_KEY,"json").then(s=>({...DEFAULTS,...(s||{})})),
    env.STATUS_STORE.get(STATE_KEY,"json"),
    pingMinecraft()
  ]);
  const status = describe(settings,ping);
  const signature = [status.state,status.reason,status.eta].join(":");
  const messageId = await publish(env,previous?.messageId||null,payload(status));
  // Save after a successful Discord post/edit, so failed writes can be retried.
  await env.STATUS_STORE.put(STATE_KEY,JSON.stringify({...status,messageId,signature}));
  if (previous?.signature && previous.signature !== signature) {
    try {
      await publish(env,null,{username:"5er Pasch · Status",
        content:"📢 **Serverstatus geändert: "+status.label+"**\n"+
          "**Grund:** "+status.reason+(status.eta?"\n**Bis:** "+status.eta:""),
        allowed_mentions:{parse:[]}});
    } catch (_) { /* The persistent status message is already current. */ }
  }
  // A documented offline cause should not persist into an unrelated future outage.
  if (settings.mode==="auto" && ping.online===true && previous?.state==="offline" && settings.offlineReason) {
    await env.STATUS_STORE.put(SETTINGS_KEY,JSON.stringify({...settings,offlineReason:"",eta:""}));
  }
  return status;
}

/*
 * Achievement notifications reuse the public /api/players events produced by
 * the existing Paper plugin. No extra Paper tasks, polling plugin, Discord bot
 * login, or additional Minecraft RAM required.
 * An optional ACHIEVEMENT_WEBHOOK_URL secret points to #erfolge.
 */
function achievementsConfigured(env) {
  return Boolean(env.STATUS_STORE &&
    /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[0-9]+\/[\w-]+$/.test(env.ACHIEVEMENT_WEBHOOK_URL || ""));
}
function achievementActor(event, usernames) {
  // Current plugin sends descriptions like "Player hat den Fortschritt „…“ erreicht".
  // Derive the actor only from the server's known validated player names.
  if (!event || event.type !== "advancement" ||
    typeof event.description !== "string" ||
    typeof event.title !== "string" || event.title.trim().length === 0) return null;
  for (const name of usernames) {
    if (event.description.toLowerCase().startsWith(name.toLowerCase() + " hat den fortschritt ")) return name;
  }
  return null;
}
function achievementEmbed(entry) {
  const timestamp = new Date(entry.occurredAt).toISOString();
  return {
    username: "5er Pasch · Erfolge",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: "🏆 " + entry.title.slice(0, 150),
      description: "**" + entry.actor + "** hat einen Minecraft-Fortschritt freigeschaltet.",
      color: 0xe5bd69,
      timestamp,
      url: "https://5erpasch.pages.dev/#chronik",
      footer: { text: "5er Pasch · Automatische Erfolgsmeldung" }
    }]
  };
}
async function announceAchievements(env) {
  // All other status-bot features keep working when this optional secret is absent.
  if (!achievementsConfigured(env)) return { enabled: false, sent: 0 };
  const response = await fetch(ACHIEVEMENT_API, {
    cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("5er Pasch events API HTTP " + response.status);
  const data = await response.json();
  if (!data.enabled || !Array.isArray(data.events) || !Array.isArray(data.players)) {
    throw new Error("5er Pasch events API not ready");
  }
  const usernames = data.players
    .map(p => p?.username)
    .filter(n => typeof n === "string" && /^[A-Za-z0-9_]{3,16}$/.test(n));
  const entries = data.events.filter(e => e && typeof e.id === "string" &&
      /^[A-Za-z0-9:_-]{1,120}$/.test(e.id) &&
      typeof e.occurredAt === "string" &&
      Number.isFinite(Date.parse(e.occurredAt)))
    .map(e => ({ ...e, actor: achievementActor(e, usernames) }))
    .filter(e => e.actor !== null)
    .sort((a,b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  const previous = await env.STATUS_STORE.get(ACHIEVEMENT_KEY, "json");
  if (!previous || !Array.isArray(previous.ids)) {
    // Baseline pre-existing events on first run. No surprise notification flood.
    await env.STATUS_STORE.put(ACHIEVEMENT_KEY, JSON.stringify({
      ids: entries.map(e => e.id).slice(-300), initializedAt: new Date().toISOString()
    }));
    return { enabled: true, initialized: true, sent: 0 };
  }
  const sent = new Set(previous.ids.filter(id => typeof id === "string").slice(-300));
  let count = 0;
  for (const entry of entries) {
    if (sent.has(entry.id)) continue;
    if (count >= MAX_ACHIEVEMENTS_PER_CHECK) break;
    const res = await fetch(env.ACHIEVEMENT_WEBHOOK_URL, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(achievementEmbed(entry))
    });
    if (!res.ok) throw new Error("Discord achievements webhook HTTP " + res.status);
    sent.add(entry.id);
    count++;
    // Commit after each confirmed send, so failed requests can be retried.
    await env.STATUS_STORE.put(ACHIEVEMENT_KEY, JSON.stringify({
      ids: [...sent].slice(-300), initializedAt: previous.initializedAt
    }));
  }
  return { enabled: true, sent: count };
}

export default {
  async scheduled(_controller,env,_ctx) {
    // A broken achievements webhook must never stop the existing status card.
    const results = await Promise.allSettled([check(env), announceAchievements(env)]);
    if (results[0].status === "rejected") throw results[0].reason;
    if (results[1].status === "rejected")
      console.error("Achievement notifications failed:", String(results[1].reason));
  },
  async fetch(request,env) {
    const path = new URL(request.url).pathname;
    if(request.method==="GET" && path==="/admin")
      return new Response(ADMIN_HTML,{headers:{"content-type":"text/html; charset=utf-8",
        "cache-control":"no-store","x-content-type-options":"nosniff",
        "referrer-policy":"no-referrer",
        "content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'"}});
    if(request.method==="GET" && (path==="/" || path==="/status")) {
      if(!configured(env)) return reply({configured:false,label:"Noch nicht eingerichtet"},503);
      const snap = await env.STATUS_STORE.get(STATE_KEY,"json");
      if(!snap) return reply({configured:true,label:"Noch nicht geprüft",checkedAt:null});
      return reply({configured:true,state:snap.state,label:snap.label,reason:snap.reason,
        online:snap.online,players:snap.players,eta:snap.eta,
        checkedAt:snap.checkedAt,address:ADDRESS});
    }
    if(request.method!=="POST" || !["/admin/status","/admin/check","/admin/achievements-check"].includes(path))
      return reply({error:"Nicht gefunden"},404);
    if(!configured(env)) return reply({error:"Worker noch nicht konfiguriert"},503);
    if(!(await authorized(request,env))) return reply({error:"Nicht autorisiert"},401);
    if (path === "/admin/achievements-check") {
      if (!achievementsConfigured(env))
        return reply({ error: "ACHIEVEMENT_WEBHOOK_URL fehlt oder ist ungültig" }, 503);
      try {
        const result = await announceAchievements(env);
        return reply({ ok: true, ...result });
      } catch (_) {
        return reply({ error: "Erfolge konnten nicht synchronisiert werden: Worker-Logs prüfen" }, 502);
      }
    }
    if(path==="/admin/status") {
      let raw,body;
      try {
        raw = await request.text(); if(raw.length>4096) return reply({error:"Zu große Anfrage"},413);
        body = JSON.parse(raw);
      } catch (_) { return reply({error:"Ungültiges JSON"},400); }
      if(!body || !["auto","maintenance"].includes(body.mode))
        return reply({error:"Ungültiger Modus"},400);
      const next={mode:body.mode,maintenanceReason:clean(body.maintenanceReason,220),
        offlineReason:clean(body.offlineReason,220),eta:clean(body.eta,70)};
      if(next.mode==="maintenance" && !next.maintenanceReason)
        return reply({error:"Wartungsgrund fehlt"},400);
      await env.STATUS_STORE.put(SETTINGS_KEY,JSON.stringify(next));
    }
    try {
      const result=await check(env);
      return reply({ok:true,state:result.state,reason:result.reason,checkedAt:result.checkedAt});
    } catch (_) {
      return reply({error:"Status gespeichert, Discord-Senden fehlgeschlagen: Worker-Logs prüfen"},502);
    }
  }
};
