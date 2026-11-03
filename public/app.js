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

  const status=$("#server-status"),players=$("#server-players"),dot=$("#server-dot");
  const memberList=$("#members-list"),onlineList=$("#online-list");
  const roster=(Array.isArray(cfg.players)?cfg.players:[]).filter(p=>{
    if(!p||typeof p!=="object")return false;
    const name=get(p.name),user=get(p.username);
    return Boolean(user)||(Boolean(name)&&!/^Spieler\s*0?\d+$/i.test(name));
  });
  const onlineKnown=new Set();
  let hasFullOnlineList=false;
  let serverAvailability="unknown";
  function rowForPlayer(name,username,subtitle,onlineState){
    const row=document.createElement("div");row.className="item-row member-row";
    const identity=document.createElement("div");identity.className="member-identity";
    const avatar=document.createElement("span");avatar.className="member-head";
    const validUser=/^[A-Za-z0-9_]{3,16}$/.test(username||"");
    if(validUser){
      const img=document.createElement("img");
      img.src="https://mc-heads.net/avatar/"+encodeURIComponent(username)+"/64";
      img.alt="";
      img.loading="lazy";
      img.addEventListener("error",()=>{avatar.textContent=(name||username).slice(0,1).toUpperCase();img.remove();});
      avatar.append(img);
    }else avatar.textContent=(name||"?").slice(0,1).toUpperCase();
    const text=document.createElement("div");text.className="member-name";
    const heading=document.createElement("h4");heading.textContent=name;
    text.append(heading);
    if(subtitle){const p=document.createElement("p");p.textContent=subtitle;text.append(p);}
    identity.append(avatar,text);row.append(identity);
    if(onlineState==="online"||onlineState==="offline"){
      const meta=document.createElement("span");meta.className="item-meta";meta.textContent=onlineState==="online"?"Online":"Offline";
      row.append(meta);
    }
    return row;
  }
  function renderRoster(){
    if(!memberList)return;
    memberList.replaceChildren();
    $("#members-count").textContent=roster.length?roster.length+" Mitglieder":"Noch offen";
    if(!roster.length){
      const p=document.createElement("p");p.className="empty-copy";
      p.textContent="Die Mitgliedernamen können in config.js eingetragen werden.";
      memberList.append(p);return;
    }
    roster.forEach(p=>{
      const name=get(p.name)||get(p.username);
      const user=get(p.username);
      const matched=[name.toLowerCase(),user.toLowerCase()].some(s=>s&&onlineKnown.has(s));
      const state=matched?"online":(serverAvailability==="offline"||hasFullOnlineList)?"offline":"unknown";
      memberList.append(rowForPlayer(name,user,get(p.role),state));
    });
  }
  function renderOnline(message,listed,total){
    onlineList.replaceChildren();
    $("#online-count").textContent=typeof total==="number"?total+" online":"–";
    if(listed.length){
      listed.forEach(p=>{
        const row=document.createElement("div");row.className="item-row";
        const label=document.createElement("div");label.className="online-name";
        const dot=document.createElement("span");dot.className="online-presence";
        const heading=document.createElement("h4");heading.textContent=p.name;
        label.append(dot,heading);row.append(label);onlineList.append(row);
      });
      if(total>listed.length){
        const hint=document.createElement("p");hint.className="empty-copy";
        hint.textContent="Weitere "+(total-listed.length)+" Spieler online, Namen nicht verfügbar.";
        onlineList.append(hint);
      }
    }else{
      const p=document.createElement("p");p.className="empty-copy";p.textContent=message;
      onlineList.append(p);
    }
  }
  renderRoster();
  if(server){
    status.textContent="Verbindung wird geprüft";
    renderOnline("Live-Status wird geladen …",[],null);
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
            name:get(typeof p==="string"?p:p?.name_clean||p?.name_raw||p?.name),
            uuid:get(typeof p==="object"?p?.uuid:"")
          })).filter(p=>{
            if(!p.name||seen.has(p.name.toLowerCase()))return false;
            seen.add(p.name.toLowerCase());return true;
          });
          onlineKnown.clear();
          entries.forEach(p=>onlineKnown.add(p.name.toLowerCase()));
          hasFullOnlineList=count===0||(count!==null&&entries.length>=count);
          renderOnline(count===0?"Gerade ist niemand auf dem Server.":"Der Server meldet "+(count??"einige")+" Spieler online, überträgt aber keine Namen.",entries,count);
        }else{
          serverAvailability="offline";hasFullOnlineList=true;onlineKnown.clear();
          status.textContent="Server offline";dot.className="status-dot offline";players.textContent="0 online";
          renderOnline("Im Moment ist der Server offline.",[],0);
        }
      }catch(e){
        serverAvailability="unknown";hasFullOnlineList=false;onlineKnown.clear();
        status.textContent="Status nicht verfügbar";dot.className="status-dot";
        players.textContent="– online";renderOnline("Der Live-Status konnte nicht abgerufen werden.",[],null);
      }
      renderRoster();
    }
    checkStatus();setInterval(checkStatus,60000);
  }else{
    status.textContent="Server-IP noch nicht eingetragen";
    players.textContent="– online";
    renderOnline("Sobald die Server-IP eingetragen ist, erscheinen hier die gerade aktiven Spieler.",[],null);
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