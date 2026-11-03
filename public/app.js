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
  const status=$("#server-status"),players=$("#server-players"),dot=$("#server-dot");
  if(server){
    status.textContent="Verbindung wird geprüft";
    async function checkStatus(){
      try{
        const ed=cfg.edition==="bedrock"?"bedrock":"java";
        const res=await fetch("https://api.mcstatus.io/v2/status/"+ed+"/"+encodeURIComponent(server),{cache:"no-store"});
        if(!res.ok)throw new Error("unavailable");
        const data=await res.json();
        if(data.online){
          status.textContent="Server online";dot.className="status-dot online";
          players.textContent=Number.isFinite(data.players?.online)?data.players.online+" online":"5 Spieler";
        }else{status.textContent="Server offline";dot.className="status-dot offline";players.textContent="5 Spieler";}
      }catch(e){status.textContent="Status nicht verfügbar";dot.className="status-dot";players.textContent="5 Spieler";}
    }
    checkStatus();setInterval(checkStatus,60000);
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