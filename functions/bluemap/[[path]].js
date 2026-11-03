// Cloudflare Pages Function: fixed-upstream BlueMap reverse proxy.
// Request path /bluemap/... becomes http://45-143-198-58.sslip.io:8189/...
// The DNS-only alias resolves to 45.143.198.58 and avoids Workers' direct-IP fetch restriction.
const ORIGIN = "http://45-143-198-58.sslip.io:8189";
const PREFIX = "/bluemap/";

export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith(PREFIX)) return new Response("Not found", { status: 404 });
  const path = incoming.pathname.slice(PREFIX.length);
  if (path.length > 2048 || path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    return new Response("Invalid path", { status: 400 });
  }

  const upstreamUrl = new URL(path || "index.html", ORIGIN + "/");
  if (upstreamUrl.origin !== new URL(ORIGIN).origin) {
    return new Response("Invalid upstream destination", { status: 400 });
  }
  upstreamUrl.search = incoming.search;

  const forwardHeaders = new Headers();
  for (const key of ["accept", "range", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(key);
    if (value) forwardHeaders.set(key, value);
  }

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      redirect: "manual"
    });
    const responseHeaders = new Headers(upstream.headers);
    // Prevent stale lengths after stream processing, and keep cookies local to BlueMap itself.
    responseHeaders.delete("content-length");
    responseHeaders.delete("set-cookie");
    responseHeaders.delete("x-frame-options");
    responseHeaders.delete("content-security-policy");

    if (upstream.status >= 300 && upstream.status < 400 && responseHeaders.has("location")) {
      const location = new URL(responseHeaders.get("location"), upstreamUrl);
      if (location.origin !== upstreamUrl.origin) {
        return new Response("Upstream redirect not allowed", { status: 502 });
      }
      responseHeaders.set("location", PREFIX + location.pathname.replace(/^\/+/, "") + location.search + location.hash);
    }

    if (path.includes("/live/") || path.endsWith(".json") || path.endsWith(".json.gz")) {
      responseHeaders.set("cache-control", "no-store");
    } else if (/\.(png|jpg|jpeg|webp|js|css|woff2?|wasm)$/i.test(path)) {
      responseHeaders.set("cache-control", "public, max-age=600");
    }
    responseHeaders.set("x-content-type-options", "nosniff");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    return new Response("BlueMap ist gerade nicht über die Website erreichbar.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
}
