import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

test("Discord bot: initial card, cron updates, maintenance, recovery and API failure", async () => {
  const oldFetch = globalThis.fetch;
  const store = new Map();
  const sent = [];
  const edited = [];
  let online = true, players = 3, thirdPartyDown = false, nextId = 100;
  const token = "1234567890abcdef".repeat(4);
  const env = {
    STATUS_STORE: {
      async get(key) { return JSON.parse(store.get(key) || "null"); },
      async put(key, value) { store.set(key, value); }
    },
    ADMIN_TOKEN: token,
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123456789012345678/test_secret"
  };
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("api.mcstatus.io")) {
      if (thirdPartyDown) return new Response("Unavailable", { status: 503 });
      return Response.json({ online, players: { online: players } });
    }
    if (target.includes("discord.com/api/webhooks/")) {
      if (init.method === "PATCH") {
        edited.push(JSON.parse(init.body));
        return Response.json({});
      }
      if (init.method === "POST") {
        sent.push(JSON.parse(init.body));
        return Response.json({ id: String(++nextId) });
      }
    }
    throw new Error("Unexpected fetch: " + target);
  };
  const request = (path, data, secret = token) =>
    new Request("https://status.example" + path, {
      method: "POST",
      headers: { authorization: "Bearer " + secret, "content-type": "application/json" },
      body: JSON.stringify(data)
    });
  try {
    const before = await worker.fetch(new Request("https://status.example/status"), env);
    assert.equal((await before.json()).label, "Noch nicht geprüft");

    await worker.scheduled({}, env, {});
    assert.equal(sent.length, 1);
    assert.match(sent[0].embeds[0].description, /ONLINE/);
    await worker.scheduled({}, env, {});
    assert.equal(sent.length, 1, "same status must not spam channel");
    assert.equal(edited.length, 1, "card is edited in place");

    const change = await worker.fetch(request("/admin/status", {
      mode: "maintenance", maintenanceReason: "Wir aktualisieren Chunky", eta: "bis 20 Uhr"
    }), env);
    assert.equal(change.status, 200);
    assert.equal(sent.length, 2, "maintenance change notifies channel");
    assert.match(sent[1].content, /Chunky/);

    const forbidden = await worker.fetch(request("/admin/check", {}, "bad-token"), env);
    assert.equal(forbidden.status, 401);
    const invalid = await worker.fetch(request("/admin/status", {
      mode: "maintenance", maintenanceReason: ""
    }), env);
    assert.equal(invalid.status, 400);

    online = false; players = 0;
    const outage = await worker.fetch(request("/admin/status", {
      mode: "auto", maintenanceReason: "", offlineReason: "Hosting-Wartung"
    }), env);
    assert.equal(outage.status, 200);
    const after = await worker.fetch(new Request("https://status.example/status"), env);
    const publicStatus = await after.json();
    assert.equal(publicStatus.state, "offline");
    assert.equal(publicStatus.reason, "Hosting-Wartung");
    assert.equal(JSON.stringify(publicStatus).includes(token), false);
    assert.equal(JSON.stringify(publicStatus).includes(env.DISCORD_WEBHOOK_URL), false);

    online = true; players = 1;
    await worker.scheduled({}, env, {});
    assert.equal(JSON.parse(store.get("5erpasch:discord-status:settings:v1")).offlineReason, "");

    thirdPartyDown = true;
    await worker.scheduled({}, env, {});
    const unknown = await worker.fetch(new Request("https://status.example/status"), env);
    assert.equal((await unknown.json()).state, "unknown", "never mislabel API outage as server offline");
  } finally {
    globalThis.fetch = oldFetch;
  }
});
