import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("Player profile uses server stats, filters achievements by exact username, and renders safely", async () => {
  const script=readFileSync(new URL("../public/profile-achievements.js",import.meta.url),"utf8");
  const listeners=new Map(),nodes=new Map();
  class Element {
    constructor(tag="div"){this.tag=tag;this.children=[];this.textContent="";this.className="";this.open=true;}
    replaceChildren(...content){this.children=[...content];}
    append(...content){this.children.push(...content);}
    setAttribute(key,value){this[key]=value;}
    addEventListener(name,handler){listeners.set(this.tag+":"+name,handler);}
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)};
  const snapshot={
    enabled:true,
    players:[{username:"sams939"},{username:"Ben_Keynoobie"}],
    statsUpdatedAt:"2026-11-04T12:00:00Z",
    stats:[
      {username:"Ben_Keynoobie",playTicks:72000,deaths:2,mobKills:15,walkedCm:200000,jumps:123},
      {username:"sams939",playTicks:144000,deaths:7,mobKills:5,walkedCm:100000,jumps:23}
    ],
    events:[
      {id:"a",type:"advancement",title:"Diamanten gefunden",
        description:"Ben_Keynoobie hat den Fortschritt „Diamanten gefunden“ erreicht.",
        occurredAt:"2026-11-04T12:00:00Z"},
      {id:"b",type:"advancement",title:"Nether betreten",
        description:"sams939 hat den Fortschritt „Nether betreten“ erreicht.",
        occurredAt:"2026-11-04T12:00:00Z"},
      {id:"c",type:"join",title:"Neues Mitglied",
        description:"Ben_Keynoobie ist beigetreten.",
        occurredAt:"2026-11-04T12:00:00Z"}
    ]
  };
  const context={
    document:{
      getElementById:get,
      createElement:tag=>new Element(tag),
      addEventListener:(name,handler)=>listeners.set(name,handler)
    },
    fetch:async()=>({ok:true,json:async()=>snapshot}),
    setInterval:()=>0,
    Date,Intl,console
  };
  runInNewContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  const trigger=listeners.get("5erpasch:profile-open");
  assert.equal(typeof trigger,"function");

  trigger({detail:{username:"Ben_Keynoobie"}});
  assert.equal(get("profile-stats").children.length,5);
  assert.equal(get("profile-achievements").children.length,1);
  assert.equal(get("profile-achievement-count").textContent,"1 erfasst");
  assert.equal(get("profile-achievements").children[0].children[1].children[0].textContent,"Diamanten gefunden");
  assert.equal(get("profile-stats").children[0].children[0].textContent.includes("1"),true);

  trigger({detail:{username:"sams939"}});
  assert.equal(get("profile-achievements").children.length,1);
  assert.equal(get("profile-achievements").children[0].children[1].children[0].textContent,"Nether betreten");
  assert.equal(get("profile-stats").children[0].children[0].textContent.includes("2"),true);

  trigger({detail:{username:"invalid player name"}});
  assert.equal(get("profile-achievements").children.length,1,
    "unsupported usernames should not update someone else's profile");
});