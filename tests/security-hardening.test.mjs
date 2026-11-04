import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { onRequestGet, onRequestPost } from "../functions/api/players.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const token="security-test-token-1234567890-abcd".repeat(2);
const username="Ben_Keynoobie";
const uuid="00000000-0000-4000-8000-000000000001";

test("player sync rejects unauthorized POST, including valid-looking JSON", async()=>{
  let writes=0;
  const env={PLAYER_SYNC_TOKEN:token,PLAYER_DATA:{
    get:async()=>null,put:async()=>{writes++;}
  }};
  const request=new Request("https://example.test/api/players",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({players:[],online:[]})
  });
  const reply=await onRequestPost({env,request});
  assert.equal(reply.status,401);
  assert.equal(writes,0);
});

test("player sync rejects oversized chunked upload before JSON.parse",async()=>{
  const env={PLAYER_SYNC_TOKEN:token,PLAYER_DATA:{
    get:async()=>null,put:async()=>{throw Error("must not write");}
  }};
  const buffer=new Uint8Array(120000).fill(65);
  const stream=new ReadableStream({
    start(ctrl){ctrl.enqueue(buffer.slice(0,50000));ctrl.enqueue(buffer.slice(50000));ctrl.close();}
  });
  const request=new Request("https://example.test/api/players",{
    method:"POST",duplex:"half",
    headers:{"content-type":"application/json","authorization":"Bearer "+token},
    body:stream
  });
  const response=await onRequestPost({env,request});
  assert.equal(response.status,413);
});

test("public player API omits secrets and UUID, returns only intended public data",async()=>{
  const env={PLAYER_SYNC_TOKEN:token,PLAYER_DATA:{
    get:async()=>({updatedAt:new Date().toISOString(),statsUpdatedAt:new Date().toISOString(),
      players:[{uuid,username}], online:[username],
      stats:[{uuid,username,playTicks:72000,deaths:2,mobKills:3,walkedCm:5,jumps:6}],
      events:[]}),
    put:async()=>{}
  }};
  const reply=await onRequestGet({env,request:new Request("https://example.test/api/players")});
  assert.equal(reply.status,200);
  const content=await reply.text();
  assert(!content.includes(token));
  assert(!content.includes(uuid));
  assert.equal(JSON.parse(content).stats[0].playTicks,72000);
  assert.match(reply.headers.get("cache-control"),/s-maxage=15/);
});

test("static security headers protect all three pages without blocking real assets",()=>{
  const headers=readFileSync(new URL("../public/_headers",import.meta.url),"utf8");
  assert.match(headers,/Content-Security-Policy:/);
  assert.match(headers,/script-src 'self'/);
  assert.match(headers,/object-src 'none'/);
  assert.match(headers,/frame-ancestors 'none'/);
  assert.match(headers,/X-Content-Type-Options: nosniff/);
  assert.match(headers,/Referrer-Policy: no-referrer/);
  assert.match(headers,/https:\/\/skinrender\.dev/);
  assert.match(headers,/https:\/\/api\.mcstatus\.io/);
  assert.match(headers,/style-src-attr 'unsafe-inline'/);
  const csp=headers.split("\n").find(line=>line.includes("Content-Security-Policy:"));
  const scriptDirective=csp.match(/(?:^|;\s*)script-src\s+([^;]+)/)?.[1] || "";
  assert.doesNotMatch(scriptDirective,/'unsafe-inline'/);
});

test("BlueMap proxy rejects encoded separators and oversized queries; caches static only",async()=>{
  const source=readFileSync(new URL("../functions/bluemap/[[path]].js",import.meta.url),"utf8")
    .replace('import { connect } from "cloudflare:sockets";',"")
    .replace("export async function onRequest","async function onRequest");
  const store=new Map(),tasks=[];
  let upstream=0;
  const sandbox={
    connect(){throw Error("Simulated socket unavailable");},
    fetch:async()=>{
      upstream++;
      return new Response("body",{
        status:200,headers:{"content-type":"text/css","set-cookie":"SECRET=do-not-proxy"}
      });
    },
    caches:{default:{
      match:async(request)=>store.get(request.url)?.clone()||null,
      put:async(request,response)=>{store.set(request.url,response.clone());}
    }},
    console, TextEncoder, TextDecoder, URL, Request, Response, Headers, AbortSignal,
    ReadableStream, Uint8Array, setTimeout, clearTimeout
  };
  runInNewContext(source+"\nthis.proxyHandler=onRequest;",sandbox);
  const call=async path=>{
    const request=new Request("https://5erpasch.pages.dev"+path);
    const response=await sandbox.proxyHandler({request,waitUntil:p=>tasks.push(p)});
    await Promise.all(tasks.splice(0));
    return response;
  };
  assert.equal((await call("/bluemap/test%2fprivate.css")).status,400);
  assert.equal((await call("/bluemap/assets/styles.css?x="+ "a".repeat(513))).status,400);
  assert.equal(upstream,0);

  const ok=await call("/bluemap/assets/styles.css");
  assert.equal(ok.status,200);
  assert.equal(ok.headers.get("set-cookie"),null);
  assert.equal(ok.headers.get("x-frame-options"),"SAMEORIGIN");
  assert.equal(ok.headers.get("referrer-policy"),"no-referrer");
  assert.match(ok.headers.get("cache-control"),/s-maxage=120/);
  await call("/bluemap/assets/styles.css");
  assert.equal(upstream,1,"second request should hit edge cache");

  await call("/bluemap/settings.json");
  await call("/bluemap/settings.json");
  assert.equal(upstream,3,"live settings should not be cached");
});
