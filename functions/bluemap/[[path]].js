// BlueMap: HTTPS same-origin proxy for a Minecraft server on a custom HTTP port.
// Prefer Workers TCP sockets for port 8189; fall back to HTTP fetch through a DNS-only alias.
import { connect } from "cloudflare:sockets";

const SERVER = "45.143.198.58";
const PORT = 8189;
const ORIGIN = "http://45-143-198-58.sslip.io:8189";
const PREFIX = "/bluemap/";
const MAX_QUERY_LENGTH = 512;
// Only versioned/static map assets are eligible for short edge caching.
// JSON settings/live state are deliberately never cached.
const CACHEABLE = /\.(?:png|jpg|jpeg|webp|js|css|woff2?|wasm)$/i;
const CACHE_SECONDS = 120;

function safePath(path, search) {
  if (!path || path === "index.html") return search.length <= MAX_QUERY_LENGTH;
  if (path.length > 2048 || search.length > MAX_QUERY_LENGTH ||
      path.startsWith("/") || path.includes("\\") || /[\u0000-\u001F\u007F]/.test(path) ||
      /%(?:00|0a|0d|2e|2f|5c)/i.test(path)) return false;
  const parts = path.split("/");
  return !parts.some(part => part === "." || part === ".." || part === "");
}


function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}
function findCRLF(bytes) {
  for (let i = 0; i < bytes.length - 1; i++) if (bytes[i] === 13 && bytes[i + 1] === 10) return i;
  return -1;
}
function findHeaderEnd(bytes) {
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) return i;
  }
  return -1;
}
async function viaSocket(path, request) {
  const socket = connect({ hostname: SERVER, port: PORT });
  const writer = socket.writable.getWriter();
  const query = new URL(request.url).search;
  const http = [
    request.method + " /" + path + query + " HTTP/1.0",
    "Host: " + SERVER + ":" + PORT,
    "Connection: close",
    "Accept-Encoding: identity",
    "User-Agent: 5er-Pasch-BlueMap-Proxy",
    "", ""
  ].join("\r\n");
  await writer.write(new TextEncoder().encode(http));
  await writer.close();
  const reader = socket.readable.getReader();
  let buffer = new Uint8Array();
  const deadline = setTimeout(() => { try { socket.close(); } catch {} }, 12000);
  try {
    let end = -1;
    while ((end = findHeaderEnd(buffer)) === -1) {
      if (buffer.length > 65536) throw new Error("Response header too large");
      const chunk = await reader.read();
      if (chunk.done) throw new Error("No response from BlueMap");
      buffer = concat(buffer, chunk.value);
    }
    const headerText = new TextDecoder().decode(buffer.slice(0, end));
    buffer = buffer.slice(end + 4);
    const lines = headerText.split("\r\n");
    const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(lines.shift() || "");
    if (!statusMatch) throw new Error("Invalid BlueMap response");
    const status = Number(statusMatch[1]);
    const headers = new Headers();
    for (const line of lines) {
      const i = line.indexOf(":");
      if (i > 0) {
        const name = line.slice(0, i).trim();
        const value = line.slice(i + 1).trim();
        try { headers.append(name, value); } catch {}
      }
    }
    clearTimeout(deadline);
    const chunked = /chunked/i.test(headers.get("transfer-encoding") || "");
    for (const h of ["connection", "transfer-encoding", "keep-alive", "proxy-connection", "content-security-policy", "x-frame-options", "set-cookie"]) {
      headers.delete(h);
    }
    if (chunked) headers.delete("content-length");
    if (request.method === "HEAD" || status === 204 || status === 304) {
      reader.cancel().catch(() => {});
      return new Response(null, { status, headers });
    }
    const takeMore = async () => {
      const result = await reader.read();
      if (result.done) return false;
      buffer = concat(buffer, result.value);
      return true;
    };
    const body = new ReadableStream({
      async pull(controller) {
        try {
          if (!chunked) {
            if (buffer.length) {
              const pending = buffer; buffer = new Uint8Array();
              controller.enqueue(pending);
              return;
            }
            const data = await reader.read();
            if (data.done) controller.close();
            else controller.enqueue(data.value);
            return;
          }
          while (findCRLF(buffer) === -1) {
            if (!(await takeMore())) throw new Error("Missing chunk size");
          }
          const lineEnd = findCRLF(buffer);
          const line = new TextDecoder().decode(buffer.slice(0, lineEnd)).split(";")[0];
          const n = parseInt(line.trim(), 16);
          if (!Number.isFinite(n) || n < 0 || n > 20 * 1024 * 1024) throw new Error("Invalid chunk size");
          buffer = buffer.slice(lineEnd + 2);
          if (n === 0) {
            controller.close();
            reader.cancel().catch(() => {});
            return;
          }
          while (buffer.length < n + 2) {
            if (!(await takeMore())) throw new Error("Incomplete chunk");
          }
          controller.enqueue(buffer.slice(0, n));
          buffer = buffer.slice(n + 2);
        } catch (error) {
          controller.error(error);
          try { socket.close(); } catch {}
        }
      },
      cancel() { try { socket.close(); } catch {} }
    });
    return new Response(body, { status, headers });
  } catch (error) {
    clearTimeout(deadline);
    try { socket.close(); } catch {}
    throw error;
  }
}

async function viaFetch(path, request) {
  const url = new URL(path || "index.html", ORIGIN + "/");
  url.search = new URL(request.url).search;
  const h = new Headers();
  for (const key of ["accept", "range", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(key);
    if (value) h.set(key, value);
  }
  const res = await fetch(url, { method: request.method, headers: h, redirect: "manual", signal: AbortSignal.timeout(12000) });
  const headers = new Headers(res.headers);
  for (const name of ["set-cookie", "x-frame-options", "content-security-policy"]) headers.delete(name);
  return new Response(res.body, { status: res.status, headers });
}

function ensureBase(response, path) {
  if (response.status !== 200 || !(/^(index\.html)?$/.test(path))) return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  return new HTMLRewriter().on("head", {
    element(element) { element.prepend('<base href="/bluemap/">', { html: true }); }
  }).transform(response);
}

export async function onRequest({ request, waitUntil }) {
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith(PREFIX)) return new Response("Not found", { status: 404 });
  const path = incoming.pathname.slice(PREFIX.length);
  if (!safePath(path, incoming.search)) {
    return new Response("Invalid path", { status: 400 });
  }
  const shouldCache = request.method === "GET" && incoming.search === "" &&
    CACHEABLE.test(path) && !path.includes("/live/");
  const cache = globalThis.caches?.default;
  if (shouldCache && cache) {
    try {
      const hit = await cache.match(request);
      if (hit) return hit;
    } catch (_) { /* If cache is unavailable, use the normal BlueMap origin. */ }
  }
  try {
    let response;
    try {
      response = await viaSocket(path || "index.html", request);
    } catch (tcpError) {
      response = await viaFetch(path || "index.html", request);
    }
    const headers = new Headers(response.headers);
    if (response.status >= 300 && response.status < 400 && headers.has("location")) {
      const location = new URL(headers.get("location"), ORIGIN + "/" + path);
      if (location.hostname !== SERVER && location.hostname !== new URL(ORIGIN).hostname) {
        return new Response("Upstream redirect not allowed", { status: 502 });
      }
      headers.set("location", PREFIX + location.pathname.replace(/^\/+/, "") + location.search + location.hash);
    }
    if (path.includes("/live/") || path.endsWith(".json")) headers.set("cache-control", "no-store");
    else if (/\.(png|jpg|jpeg|webp|js|css|woff2?|wasm)$/i.test(path)) headers.set("cache-control", "public, max-age=300");
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "no-referrer");
    headers.set("x-frame-options", "SAMEORIGIN");
    headers.delete("server");
    headers.delete("www-authenticate");
    if (shouldCache && response.status === 200) {
      headers.set("cache-control", "public, max-age=0, s-maxage=" + CACHE_SECONDS);
    }
    response = new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
    response = ensureBase(response, path);
    if (shouldCache && cache && response.status === 200) {
      const task = cache.put(request, response.clone()).catch(() => {});
      if (typeof waitUntil === "function") waitUntil(task);
      else task.catch(() => {});
    }
    return response;
  } catch (error) {
    return new Response("BlueMap momentan nicht über HTTPS erreichbar.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
