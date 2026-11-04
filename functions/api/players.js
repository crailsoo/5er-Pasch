// 5er Pasch: public read API, authenticated Paper server snapshots.
// Bind KV as PLAYER_DATA and encrypted secret as PLAYER_SYNC_TOKEN in Cloudflare Pages.
const STORAGE_KEY = "5erpasch:known-players:v1";
const USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const FRESH_FOR_MS = 12 * 60 * 1000;

// Avoid buffering arbitrarily large chunked requests before validating JSON.
const MAX_BODY_BYTES = 100000;
const PUBLIC_CACHE_SECONDS = 15;
async function readBoundedBody(request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function publicReply(payload, context) {
  const response = reply(payload);
  response.headers.set("cache-control", "public, max-age=0, s-maxage=" + PUBLIC_CACHE_SECONDS);
  const cache = globalThis.caches?.default;
  if (cache && context.request) {
    const key = new Request(new URL("/api/players", context.request.url).toString());
    const task = cache.put(key, response.clone()).catch(() => {});
    if (typeof context.waitUntil === "function") context.waitUntil(task);
    else task.catch(() => {});
  }
  return response;
}


function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function configured(env) {
  return Boolean(env.PLAYER_DATA && typeof env.PLAYER_DATA.get === "function" &&
    typeof env.PLAYER_DATA.put === "function" &&
    typeof env.PLAYER_SYNC_TOKEN === "string" && env.PLAYER_SYNC_TOKEN.length >= 32);
}

async function equalsToken(provided, expected) {
  if (!provided || provided.length > 512) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!configured(env)) return reply({ enabled: false, players: [], online: [], updatedAt: null, fresh: false });
  const cache = globalThis.caches?.default;
  if (cache && context.request) {
    // Strip query params so ?random= cannot amplify reads or bust the edge cache.
    try {
      const key = new Request(new URL("/api/players", context.request.url).toString());
      const hit = await cache.match(key);
      if (hit) return hit;
    } catch (_) { /* If the edge cache is unavailable, KV remains authoritative. */ }
  }
  try {
    const snapshot = await env.PLAYER_DATA.get(STORAGE_KEY, "json");
    if (!snapshot) return publicReply({ enabled: true, players: [], online: [], updatedAt: null, fresh: false }, context);
    const fresh = Date.now() - Date.parse(snapshot.updatedAt) < FRESH_FOR_MS;
    return publicReply({
      enabled: true,
      players: (snapshot.players || []).map(p => ({ username: p.username })),
      online: fresh ? (snapshot.online || []) : [],
      updatedAt: snapshot.updatedAt,
      fresh,
      statsUpdatedAt: snapshot.statsUpdatedAt || null,
      stats: (snapshot.stats || []).map(p => ({
        username: p.username, playTicks: p.playTicks, deaths: p.deaths,
        mobKills: p.mobKills, walkedCm: p.walkedCm, jumps: p.jumps
      })),
      events: (snapshot.events || []).map(e => ({
        id: e.id, type: e.type, title: e.title, description: e.description,
        occurredAt: e.occurredAt
      }))
    }, context);
  } catch (_) {
    return reply({ error: "Spielerliste derzeit nicht verfügbar" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!configured(env)) return reply({ error: "Server-Synchronisierung nicht eingerichtet" }, 503);
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") ||
      !(await equalsToken(authorization.slice(7), env.PLAYER_SYNC_TOKEN))) {
    return reply({ error: "Nicht autorisiert" }, 401);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return reply({ error: "JSON erforderlich" }, 415);
  }
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES)
      return reply({ error: "Zu große Anfrage" }, 413);
    const raw = await readBoundedBody(request);
    if (raw === null) return reply({ error: "Zu große Anfrage" }, 413);
    const body = JSON.parse(raw);
    if (!Array.isArray(body.players) || !Array.isArray(body.online) ||
        body.players.length > 500 || body.online.length > 500) {
      return reply({ error: "Ungültige Spielerliste" }, 400);
    }
    const incoming = new Map();
    for (const entry of body.players) {
      const name = entry && entry.username;
      const id = entry && entry.uuid;
      if (typeof name !== "string" || !USERNAME.test(name) ||
          typeof id !== "string" || !UUID.test(id)) {
        return reply({ error: "Ungültiger Spieler-Eintrag" }, 400);
      }
      incoming.set(id.toLowerCase(), { uuid: id.toLowerCase(), username: name });
    }
    // Keep previously observed players, even if Bukkit no longer lists them.
    const previous = await env.PLAYER_DATA.get(STORAGE_KEY, "json");
    const known = new Map();
    for (const p of previous?.players || []) {
      if (p && UUID.test(p.uuid) && USERNAME.test(p.username)) known.set(p.uuid.toLowerCase(), p);
    }
    for (const [id, p] of incoming) known.set(id, p);
    const players = [...known.values()].slice(-500);
    const validNames = new Set(players.map(p => p.username.toLowerCase()));
    const online = [...new Map(body.online.filter(n => typeof n === "string" &&
      USERNAME.test(n) && validNames.has(n.toLowerCase())).map(n => [n.toLowerCase(), n])).values()];
    // Optional fields: older v1 plugins continue to work without clearing newer stats/events.
    const statsById = new Map();
    for (const p of previous?.stats || []) {
      if (p && UUID.test(p.uuid) && USERNAME.test(p.username)) statsById.set(p.uuid.toLowerCase(), p);
    }
    let statsUpdatedAt = previous?.statsUpdatedAt || null;
    if (body.stats !== undefined) {
      if (!Array.isArray(body.stats) || body.stats.length > 500) {
        return reply({ error: "Ungültige Statistiken" }, 400);
      }
      for (const entry of body.stats) {
        if (!entry || typeof entry.uuid !== "string" || !UUID.test(entry.uuid)
            || !incoming.has(entry.uuid.toLowerCase())) {
          return reply({ error: "Ungültige Statistik-UUID" }, 400);
        }
        for (const field of ["playTicks", "deaths", "mobKills", "walkedCm", "jumps"]) {
          if (!Number.isInteger(entry[field]) || entry[field] < 0 || entry[field] > 2147483647) {
            return reply({ error: "Ungültiger Statistikwert" }, 400);
          }
        }
        const id = entry.uuid.toLowerCase();
        statsById.set(id, { uuid: id, username: incoming.get(id).username,
          playTicks: entry.playTicks, deaths: entry.deaths, mobKills: entry.mobKills,
          walkedCm: entry.walkedCm, jumps: entry.jumps });
      }
      statsUpdatedAt = new Date().toISOString();
    }
    const stats = [...statsById.values()].slice(-500);

    const eventMap = new Map();
    for (const entry of previous?.events || []) {
      if (entry && typeof entry.id === "string") eventMap.set(entry.id, entry);
    }
    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length > 100) {
        return reply({ error: "Ungültige Ereignisliste" }, 400);
      }
      for (const e of body.events) {
        if (!e || typeof e.id !== "string" || !/^[A-Za-z0-9:_-]{1,120}$/.test(e.id)
            || !["join", "advancement"].includes(e.type)
            || typeof e.title !== "string" || e.title.length > 120 || !e.title.trim()
            || typeof e.description !== "string" || e.description.length > 240
            || typeof e.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(e.occurredAt)
            || !Number.isFinite(Date.parse(e.occurredAt))
            || Date.parse(e.occurredAt) > Date.now() + 600000) {
          return reply({ error: "Ungültiges Chronik-Ereignis" }, 400);
        }
        eventMap.set(e.id, { id: e.id, type: e.type, title: e.title.trim(),
          description: e.description, occurredAt: e.occurredAt });
      }
    }
    const events = [...eventMap.values()]
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
      .slice(-60);
    const updatedAt = new Date().toISOString();
    await env.PLAYER_DATA.put(STORAGE_KEY, JSON.stringify({
      players, online, stats, statsUpdatedAt, events, updatedAt
    }));
    return reply({ ok: true, total: players.length, online: online.length,
      stats: stats.length, events: events.length, updatedAt });
  } catch (_) {
    return reply({ error: "Spielerliste konnte nicht gespeichert werden" }, 500);
  }
}
