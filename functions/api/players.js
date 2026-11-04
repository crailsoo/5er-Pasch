// 5er Pasch: public read API, authenticated Paper server snapshots.
// Bind KV as PLAYER_DATA and encrypted secret as PLAYER_SYNC_TOKEN in Cloudflare Pages.
const STORAGE_KEY = "5erpasch:known-players:v1";
const USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const FRESH_FOR_MS = 12 * 60 * 1000;

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

export async function onRequestGet({ env }) {
  if (!configured(env)) return reply({ enabled: false, players: [], online: [], updatedAt: null, fresh: false });
  try {
    const snapshot = await env.PLAYER_DATA.get(STORAGE_KEY, "json");
    if (!snapshot) return reply({ enabled: true, players: [], online: [], updatedAt: null, fresh: false });
    const fresh = Date.now() - Date.parse(snapshot.updatedAt) < FRESH_FOR_MS;
    return reply({
      enabled: true,
      players: (snapshot.players || []).map(p => ({ username: p.username })),
      online: fresh ? (snapshot.online || []) : [],
      updatedAt: snapshot.updatedAt,
      fresh
    });
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
    if (Number(request.headers.get("content-length")) > 100000) return reply({ error: "Zu große Anfrage" }, 413);
    const raw = await request.text();
    if (raw.length > 100000) return reply({ error: "Zu große Anfrage" }, 413);
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
    const updatedAt = new Date().toISOString();
    await env.PLAYER_DATA.put(STORAGE_KEY, JSON.stringify({ players, online, updatedAt }));
    return reply({ ok: true, total: players.length, online: online.length, updatedAt });
  } catch (_) {
    return reply({ error: "Spielerliste konnte nicht gespeichert werden" }, 500);
  }
}
