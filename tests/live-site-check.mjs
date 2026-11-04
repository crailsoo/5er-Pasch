// Deliberately bounded live availability/load probe of a site the repository owner operates.
// No authentication attempts, writes, BlueMap tile floods or Minecraft gameplay traffic.
import { performance } from "node:perf_hooks";

const origin = "https://5erpasch.pages.dev";
const plans = [
  { name: "Homepage", path: "/", count: 60, concurrency: 4 },
  { name: "Stats page", path: "/stats.html", count: 35, concurrency: 3 },
  { name: "Map page HTML", path: "/map.html", count: 20, concurrency: 2 },
  { name: "Public player API", path: "/api/players", count: 25, concurrency: 2 }
];
const finish = [];
let stopped = false;
const percentile = (values, p) => {
  if (!values.length) return 0;
  const a = [...values].sort((x,y) => x-y);
  return Math.round(a[Math.ceil(p * a.length) - 1]);
};

async function probe(path, method="GET") {
  const started=performance.now();
  try {
    const res=await fetch(origin+path,{method,signal:AbortSignal.timeout(9000),redirect:"follow",
      headers:{"User-Agent":"5er-Pasch-Owner-Security-Audit/1.0"}});
    // Do not buffer response bodies. The page is deliberately fetched to measure TTFB.
    await res.body?.cancel();
    const duration=performance.now()-started;
    if (new URL(res.url).origin !== origin)
      return {status:0,ms:duration,error:"Unexpected cross-origin redirect"};
    return { status:res.status, ms:duration, headers:res.headers,
      finalPath:new URL(res.url).pathname, redirected:res.redirected };
  } catch (err) {
    return { status:0, ms:performance.now()-started, error:String(err) };
  }
}

const initial=await probe("/");
console.log("Site:",origin);
console.log("Initial homepage:",initial.status,"TTFB",Math.round(initial.ms)+"ms");
for (const path of ["/stats.html","/map.html","/style.css","/app.js"]) {
  const smoke = await probe(path);
  console.log("SMOKE",path, "status="+smoke.status, "finalPath="+smoke.finalPath,
    "redirected="+Boolean(smoke.redirected));
  if (smoke.status !== 200) {console.error("Static route smoke test failed");process.exit(1);}
}
if(initial.status!==200){
  console.error("Live site unavailable from GitHub runner; no load was generated.");
  process.exit(1);
}
const seen=new Set();
for (const key of [
  "content-security-policy", "strict-transport-security",
  "x-content-type-options", "referrer-policy", "permissions-policy",
  "x-frame-options"]) {
  const value=initial.headers.get(key);
  console.log("Header", key+":",value?value.slice(0,320):"MISSING");
  if(value) seen.add(key);
}

for (const plan of plans) {
  if (stopped) break;
  const durations=[], statuses=new Map();
  let next=0, errors=0;
  await Promise.all(Array.from({length:plan.concurrency},async()=>{
    while(next<plan.count && !stopped){
      const current=next++;
      const r=await probe(plan.path);
      durations.push(r.ms);
      statuses.set(r.status,(statuses.get(r.status)||0)+1);
      if(r.status===0 || r.status>=500){
        errors++;
        if(errors>=3) stopped=true;
      }
      if(current % 10===0) await new Promise(ok=>setTimeout(ok,25));
    }
  }));
  const summary={name:plan.name,requests:durations.length,parallel:plan.concurrency,
    statuses:Object.fromEntries(statuses),p50ms:percentile(durations,.5),
    p95ms:percentile(durations,.95),maxMs:percentile(durations,1)};
  console.log("RESULT",JSON.stringify(summary));
  finish.push(summary);
}
const failures=finish.reduce((n,r)=>n+(r.statuses["0"]||0)+
  Object.entries(r.statuses).filter(([k])=>Number(k)>=500).reduce((s,[,v])=>s+v,0),0);
if(stopped||failures>0){
  console.error("Stop condition hit: HTTP 5xx / timeouts, inspect Cloudflare status before retry.");
  process.exit(1);
}
console.log("SUCCESS: bounded live probe completed, requests total",
  finish.reduce((n,r)=>n+r.requests,0));
