import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

test("Achievement notifications: baseline, new event, deduplication, failures, and admin auth", async () => {
  const originalFetch = globalThis.fetch;
  const db = new Map();
  const statusMessages = [];
  const achievementMessages = [];
  let eventList = [];
  let nextId = 100;
  let webhookFail = false;
  const TOKEN = "1234567890abcdef".repeat(4);
  const env = {
    STATUS_STORE: {
      async get(k) { return JSON.parse(db.get(k) || "null"); },
      async put(k, v) { db.set(k, v); }
    },
    ADMIN_TOKEN: TOKEN,
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/111111111111111111/valid_status_token",
    ACHIEVEMENT_WEBHOOK_URL: "https://discord.com/api/webhooks/222222222222222222/valid_achievement_token"
  };
  const player = "Ben_Keynoobie";
  const ach = (id,title) => ({
    id, type: "advancement", title, occurredAt: "2026-11-04T12:00:00.000Z",
    description: player + " hat den Fortschritt „" + title + "“ erreicht."
  });
  const old = ach("old-achievement", "Diamanten gefunden");
  const newEvent = ach("new-achievement", "Das Nether betreten");
  const failedEvent = ach("retry-achievement", "Netherfestung entdeckt");
  const unknownActor = ach("not-real-player", "Der Enderdrache");
  unknownActor.description = "SomeoneElse hat den Fortschritt „Der Enderdrache“ erreicht.";
  eventList = [old];
  globalThis.fetch = async (url, opts = {}) => {
    const target = String(url);
    if (target.includes("api.mcstatus.io"))
      return Response.json({online:true,players:{online:0}});
    if (target.includes("5erpasch.pages.dev/api/players"))
      return Response.json({enabled:true,players:[{username:player}],events:eventList});
    if (target.includes("/api/webhooks/222222222222222222/")) {
      if (webhookFail) return Response.json({message:"Rate limited"},{status:429});
      achievementMessages.push(JSON.parse(opts.body));
      return Response.json({id:String(++nextId)});
    }
    if (target.includes("/api/webhooks/111111111111111111/")) {
      if (opts.method === "POST") {
        statusMessages.push(JSON.parse(opts.body));
        return Response.json({id:String(++nextId)});
      }
      return Response.json({});
    }
    throw Error("Unexpected request: " + target);
  };
  const request = (path,secret = TOKEN) => new Request("https://bot.example" + path, {
    method: "POST",headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
    body:"{}"
  });
  try {
    await worker.scheduled({},env,{});
    assert.equal(achievementMessages.length,0, "initial run must baseline without historical spam");
    assert.equal(statusMessages.length,1, "status card still posts normally");
    await worker.scheduled({},env,{});
    assert.equal(achievementMessages.length,0);

    eventList = [old,newEvent,unknownActor,{...newEvent,id:"a-join",type:"join"}];
    await worker.scheduled({},env,{});
    assert.equal(achievementMessages.length,1);
    assert.match(achievementMessages[0].embeds[0].title,/Nether/);
    assert.equal(achievementMessages[0].allowed_mentions.parse.length,0);
    await worker.scheduled({},env,{});
    assert.equal(achievementMessages.length,1,"previous event should not be posted again");

    const denied=await worker.fetch(request("/admin/achievements-check","bad"),env);
    assert.equal(denied.status,401);
    const ok=await worker.fetch(request("/admin/achievements-check"),env);
    assert.equal(ok.status,200);
    assert.equal((await ok.json()).sent,0);

    eventList.push(failedEvent);
    webhookFail=true;
    await worker.scheduled({},env,{});
    assert.equal(achievementMessages.length,1,"failed webhook must not be marked sent");
    const stillAlive=await worker.fetch(new Request("https://bot.example/status"),env);
    assert.equal((await stillAlive.json()).state,"online","status bot must survive achievement failure");
    webhookFail=false;
    await worker.scheduled({},env,{});
    assert.equal(achievementMessages.length,2,"next check should retry failed delivery");
    await worker.scheduled({},env,{});
    assert.equal(achievementMessages.length,2,"retry should also be deduplicated");

    const noSecret={...env,ACHIEVEMENT_WEBHOOK_URL:undefined};
    await worker.scheduled({},noSecret,{});
    assert.equal(achievementMessages.length,2, "optional secret should leave status bot running");
    const missing=await worker.fetch(request("/admin/achievements-check"),noSecret);
    assert.equal(missing.status,503);
  } finally {
    globalThis.fetch=originalFetch;
  }
});