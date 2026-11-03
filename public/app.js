(() => {
  "use strict";
  const cfg=window.SITE_CONFIG||{};
  const $=(s)=>document.querySelector(s);
  const get=(val)=>String(val??"").trim();
  let toastTimer;
  function toast(message){
    const node=$("#toast");
    node.textContent=message;node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>node.classList.remove("show"),2600);
  }
  const year=$("#year");if(year) year.textContent=new Date().getFullYear();
  const server=get(cfg.serverAddress);
  const copy=$("#copy-ip"),ipLabel=$("#ip-label");
  if(server){
    copy.disabled=false;ipLabel.textContent=server;
    copy.addEventListener("click",async()=>{
      try{await navigator.clipboard.writeText(server);toast("Server-IP kopiert");}
      catch(e){toast("Server-IP: "+server);}
    });
  }
  const discord=get(cfg.discordUrl);
  document.querySelectorAll("[data-discord]").forEach(link=>{
    if(/^https:\/\/(discord\.gg|discord\.com\/invite)\//i.test(discord)){
      link.href=discord;link.setAttribute("target","_blank");link.setAttribute("rel","noopener noreferrer");
      link.removeAttribute("aria-disabled");
    }else{
      link.removeAttribute("href");link.setAttribute("aria-disabled","true");
      link.addEventListener("click",e=>e.preventDefault());
    }
  });
  // Aufklappbares Menü: Klick außerhalb, Escape und Navigation schließen es.
  const menuButton=$("#menu-toggle"),menu=$("#site-menu");
  if(menuButton&&menu){
    const closeMenu=()=>{
      menu.hidden=true;
      menuButton.setAttribute("aria-expanded","false");
      menuButton.setAttribute("aria-label","Navigationsmenü öffnen");
    };
    menuButton.addEventListener("click",()=>{
      const willOpen=menu.hidden;
      menu.hidden=!willOpen;
      menuButton.setAttribute("aria-expanded",String(willOpen));
      menuButton.setAttribute("aria-label",willOpen?"Navigationsmenü schließen":"Navigationsmenü öffnen");
    });
    menu.querySelectorAll("a").forEach(a=>a.addEventListener("click",closeMenu));
    document.addEventListener("click",e=>{
      if(!menu.hidden&&!menu.contains(e.target)&&!menuButton.contains(e.target))closeMenu();
    });
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape"&&!menu.hidden){closeMenu();menuButton.focus();}
    });
  }

  // FitnaCraft-inspired member showcase: real Minecraft skin renders, subtle online badges.
  const status=$("#server-status"),players=$("#server-players"),dot=$("#server-dot");
  const memberList=$("#members-list"),onlineList=$("#online-list");
  const roster=(Array.isArray(cfg.players)?cfg.players:[]).filter(p=>{
    if(!p||typeof p!=="object")return false;
    const name=get(p.name),user=get(p.username);
    return Boolean(user)||(Boolean(name)&&!/^Spieler\s*0?\d+$/i.test(name));
  });
  const onlineKnown=new Set();
  const cardStatusNodes=new Map();
  let hasFullOnlineList=false;
  let serverAvailability="unknown";

  function makeEl(tag,cls,content){
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(content!==undefined)e.textContent=String(content);
    return e;
  }

  function renderRoster(){
    if(!memberList)return;
    memberList.replaceChildren();
    cardStatusNodes.clear();
    if(!roster.length){
      memberList.append(makeEl("p","empty-copy","Die ersten Spieler werden noch eingetragen."));
      return;
    }

    roster.forEach((person,index)=>{
      const username=get(person.username);
      const name=get(person.name)||username;
      const role=get(person.role);
      const validUser=/^[A-Za-z0-9_]{3,16}$/.test(username);
      const card=makeEl("article","player-showcase-card");
      card.setAttribute("role","listitem");
      card.style.setProperty("--card-index",String(index));

      const stage=makeEl("div","player-character-stage");
      const orb=makeEl("span","player-character-orb");
      orb.setAttribute("aria-hidden","true");
      const character=makeEl("div","player-character");
      if(validUser){
        const img=makeEl("img","player-character-image");
        img.src="https://skinrender.dev/render/"+encodeURIComponent(username)+"/body?size=480";
        img.alt="Minecraft-Charakter von "+name;
        img.loading="lazy";
        img.decoding="async";
        let fallbackUsed=false;
        img.addEventListener("error",()=>{
          if(!fallbackUsed){
            fallbackUsed=true;
            img.src="https://mc-heads.net/player/"+encodeURIComponent(username)+"/480";
          }else{
            img.remove();
            character.append(makeEl("span","player-character-fallback",name.slice(0,1).toUpperCase()));
          }
        });
        character.append(img);
      }else{
        character.append(makeEl("span","player-character-fallback",name.slice(0,1).toUpperCase()));
      }
      stage.append(orb,character);

      const details=makeEl("div","player-card-info");
      const label=makeEl("div","player-card-identity");
      label.append(makeEl("h3","player-name",name));
      const roleLabel=makeEl("p","player-role",role||"Mitglied");
      label.append(roleLabel);
      const presence=makeEl("div","player-presence is-unknown");
      const light=makeEl("span","presence-light");
      light.setAttribute("aria-hidden","true");
      const state=makeEl("span","presence-text","Wird geprüft …");
      presence.append(light,state);
      details.append(label,presence);
      card.append(stage,details);
      memberList.append(card);
      cardStatusNodes.set(username.toLowerCase()||name.toLowerCase(),{presence,state,name,username});
    });
    updateCardStatuses();
  }

  function updateCardStatuses(){
    for(const [key,entry] of cardStatusNodes){
      const names=[key,entry.name.toLowerCase()].filter(Boolean);
      const isOnline=names.some(n=>onlineKnown.has(n));
      const certainty=serverAvailability==="offline"||hasFullOnlineList;
      const next=isOnline?"online":certainty?"offline":"unknown";
      entry.presence.className="player-presence is-"+next;
      entry.state.textContent=next==="online"?"Online":next==="offline"?"Offline":"Status unbekannt";
      entry.presence.setAttribute("aria-label",entry.name+": "+entry.state.textContent);
    }
  }

  function renderOnline(message,listed,total){
    if(!onlineList)return;
    onlineList.replaceChildren();
    $("#online-count").textContent=typeof total==="number"?String(total):"–";
    if(listed.length){
      listed.forEach(person=>{
        const label=makeEl("span","live-player-tag");
        const light=makeEl("span","presence-light");
        light.setAttribute("aria-hidden","true");
        label.append(light,makeEl("span","",person.name));
        onlineList.append(label);
      });
      if(typeof total==="number"&&total>listed.length){
        onlineList.append(makeEl("span","live-empty","+"+(total-listed.length)+" weitere online · Namen nicht verfügbar"));
      }
    }else{
      onlineList.append(makeEl("span","live-empty",message));
    }
  }

  renderRoster();
  if(server){
    status.textContent="Verbindung wird geprüft";
    renderOnline("Live-Daten werden geladen …",[],null);
    async function checkStatus(){
      try{
        const ed=cfg.edition==="bedrock"?"bedrock":"java";
        const res=await fetch("https://api.mcstatus.io/v2/status/"+ed+"/"+encodeURIComponent(server),{cache:"no-store"});
        if(!res.ok)throw new Error("Status nicht verfügbar");
        const data=await res.json();
        if(data.online){
          serverAvailability="online";
          status.textContent="Server online";
          dot.className="status-dot online";
          const count=Number.isFinite(data.players?.online)?data.players.online:null;
          players.textContent=count===null?"Onlinezahl unbekannt":count+" online";
          const list=Array.isArray(data.players?.list)?data.players.list:[];
          const seen=new Set();
          const entries=list.map(p=>({
            name:get(typeof p==="string"?p:p?.name_clean||p?.name_raw||p?.name)
          })).filter(p=>{
            if(!p.name||seen.has(p.name.toLowerCase()))return false;
            seen.add(p.name.toLowerCase());return true;
          });
          onlineKnown.clear();
          entries.forEach(p=>onlineKnown.add(p.name.toLowerCase()));
          hasFullOnlineList=count===0||(count!==null&&entries.length>=count);
          renderOnline(count===0?"Gerade ist niemand online.":"Der Server überträgt derzeit keine Spielernamen.",entries,count);
        }else{
          serverAvailability="offline";
          hasFullOnlineList=true;
          onlineKnown.clear();
          status.textContent="Server offline";
          dot.className="status-dot offline";
          players.textContent="0 online";
          renderOnline("Im Moment ist niemand online.",[],0);
        }
      }catch(e){
        serverAvailability="unknown";
        hasFullOnlineList=false;
        onlineKnown.clear();
        status.textContent="Status nicht verfügbar";
        dot.className="status-dot";
        players.textContent="– online";
        renderOnline("Live-Status ist derzeit nicht erreichbar.",[],null);
      }
      updateCardStatuses();
    }
    checkStatus();
    setInterval(checkStatus,60000);
  }else{
    status.textContent="Server-IP noch nicht eingetragen";
    players.textContent="– online";
    renderOnline("Live-Status wird nach Einrichtung der IP angezeigt.",[],null);
  }

  // Show real projects only. The starter project's example projects remain in config.js
  // for editing but will not be presented as if they were real.
  const projects=(Array.isArray(cfg.projects)?cfg.projects:[]).filter(p=>!p.demo).slice(0,4);
  const proot=$("#projects-list");
  if(projects.length){
    proot.replaceChildren();$("#project-count").textContent=projects.length+" Projekte";
    projects.forEach(p=>{
      const row=document.createElement("div");row.className="item-row";
      const body=document.createElement("div"),title=document.createElement("h4"),sub=document.createElement("p"),meta=document.createElement("span");
      title.textContent=p.title||"Projekt";sub.textContent=p.status==="fertig"?"Abgeschlossen":"Im Bau";
      meta.className="item-meta";meta.textContent=Math.max(0,Math.min(100,Number(p.progress)||0))+" %";
      body.append(title,sub);row.append(body,meta);proot.append(row);
    });
  }
  // Default milestone list is sample content, so do not display fabricated progress.
  const sample=["Die erste Nacht","Das Nether betreten","Den Enderdrachen besiegen","Unser erstes Großprojekt","Alle Biome erkunden"];
  const allMs=Array.isArray(cfg.milestones)?cfg.milestones:[];
  const isSample=allMs.length===sample.length&&allMs.every((m,i)=>m.title===sample[i]);
  const milestones=isSample?[]:allMs.slice(0,4);
  const mroot=$("#milestones-list");
  if(milestones.length){
    mroot.replaceChildren();
    const total=allMs.length,done=allMs.filter(m=>m.done).length;
    $("#progress-count").textContent=done+" / "+total;
    milestones.forEach(m=>{
      const row=document.createElement("div");row.className="item-row";
      const title=document.createElement("h4");title.textContent=m.title||"Meilenstein";
      const mark=document.createElement("span");mark.className="item-meta";mark.textContent=m.done?"Erreicht":"Offen";
      row.append(title,mark);mroot.append(row);
    });
  }
  const mapUrl=get(cfg.bluemapUrl);
  try{
    if(mapUrl){
      const url=new URL(mapUrl);
      if(url.protocol==="https:"){
        $("#map-area").hidden=false;$("#map-link").href=url.href;
      }
    }
  }catch(e){}
  const image=$(".hero-image");
  image.addEventListener("error",()=>{
    if(!image.src.endsWith("/assets/hero-minecraft.svg")) image.src="assets/hero-minecraft.svg";
  });
})();