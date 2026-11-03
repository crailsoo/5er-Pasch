
(() => {
 "use strict";
 const cfg=window.SITE_CONFIG||{};
 const $=s=>document.querySelector(s);
 const $$=s=>Array.from(document.querySelectorAll(s));
 const el=(tag,cls,txt)=>{let n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=String(txt??"");return n;};
 const pct=n=>Math.max(0,Math.min(100,Number(n)||0));
 let tid=0;
 const toast=msg=>{const n=$("#toast");if(!n)return;n.textContent=msg;n.classList.add("show");clearTimeout(tid);tid=setTimeout(()=>n.classList.remove("show"),2600);};
 function putImg(parent,url,alt){if(!url)return;let img=el("img");img.src=url;img.alt=alt;img.loading="lazy";img.addEventListener("error",()=>img.remove());parent.append(img);}
 if(cfg.serverName&&$("#server-name"))$("#server-name").textContent=cfg.serverName;
 if(cfg.description&&$("#hero-description"))$("#hero-description").textContent=cfg.description;
 if(cfg.welcomeText&&$("#welcome-copy"))$("#welcome-copy").textContent=cfg.welcomeText;
 document.title=(cfg.serverName||"5er Pasch")+" — Minecraft SMP";
 ["#discord-link","#discord-link-secondary"].forEach(sel=>{
  const a=$(sel);if(!a)return;
  if(cfg.discordUrl&&/^https:\/\/discord\.(gg|com)\//i.test(cfg.discordUrl)){a.href=cfg.discordUrl;}
  else{a.removeAttribute("target");a.removeAttribute("href");a.setAttribute("role","button");a.setAttribute("tabindex","0");a.addEventListener("click",e=>{e.preventDefault();toast("Discord-Link wird noch ergänzt.");});a.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();toast("Discord-Link wird noch ergänzt.");}});}
 });
 function renderProjects(){
  const root=$("#projects-grid");if(!root)return;root.replaceChildren();
  (Array.isArray(cfg.projects)?cfg.projects:[]).slice(0,3).forEach(p=>{
   const card=el("article","project-card"),photo=el("div","project-photo theme-"+(["mountain","village","nether"].includes(p.theme)?p.theme:"mountain"));
   photo.append(el("div","placeholder-pattern"));
   putImg(photo,p.image,"Screenshot zu "+(p.title||"Projekt"));
   photo.append(el("span","project-category",p.category||"Bauprojekt"),el("span","project-status",p.status==="fertig"?"Fertig":"Im Bau"));
   let info=el("div","project-info");
   info.append(el("h3","",p.title||"Bauprojekt"),el("p","",p.description||""));
   let bottom=el("div","project-bottom");bottom.append(el("span","","Baufortschritt"),el("strong","",pct(p.progress)+"%"));info.append(bottom);
   let track=el("div","track"),bar=el("span");bar.style.width=pct(p.progress)+"%";track.append(bar);info.append(track);
   let makers=Array.isArray(p.builders)?p.builders.join(" · "):"Noch offen";
   info.append(el("div","project-builders","Erbauer: "+makers));card.append(photo,info);root.append(card);
  });
  if(!root.children.length)root.append(el("p","empty-state","Die ersten Projekte folgen bald."));
 }
 function renderMilestones(){
  const root=$("#milestone-list");if(!root)return;root.replaceChildren();
  const ms=Array.isArray(cfg.milestones)?cfg.milestones:[];
  ms.forEach((m,i)=>{const item=el("div","milestone"+(m.done?" done":"")),detail=el("div","milestone-detail");
   detail.append(el("h3","",m.title),el("p","",m.description));item.append(el("div","milestone-icon",m.done?"✓":String(i+1).padStart(2,"0")),detail);root.append(item);
  });
  const count=ms.filter(m=>m.done).length,progress=ms.length?Math.round(count/ms.length*100):0;
  if($("#world-percent"))$("#world-percent").textContent=progress+"%";
  if($("#world-bar"))$("#world-bar").style.width=progress+"%";
  if($("#world-info"))$("#world-info").textContent=count+" von "+ms.length+" eingetragenen Meilensteinen erreicht.";
  if($("#hero-world-progress"))$("#hero-world-progress").textContent=progress+"% Weltfortschritt";
  if($("#world-short-copy"))$("#world-short-copy").textContent=count+" von "+ms.length+" Meilensteinen haben wir bereits geschafft.";
 }
 function renderPlayers(){
  const root=$("#players-grid"),avatars=$("#hero-avatars");
  if(root)root.replaceChildren();if(avatars)avatars.replaceChildren();
  (Array.isArray(cfg.players)?cfg.players:[]).forEach((p,i)=>{
   const name=p.name||p.username||"Spieler "+(i+1);
   const card=el("article","player-card"),av=el("div","player-avatar",String(i+1));
   if(p.username){av.textContent="";putImg(av,"https://mc-heads.net/avatar/"+encodeURIComponent(p.username)+"/96",name+" Minecraft-Skin");}
   card.append(av,el("h3","",name),el("span","player-role",p.role||"5er Pasch"));if(root)root.append(card);
   if(avatars&&i<5){const b=el("span","",String(i+1));if(p.username){b.textContent="";putImg(b,"https://mc-heads.net/avatar/"+encodeURIComponent(p.username)+"/32",name);}avatars.append(b);}
  });
 }
 function setupMap(){
  if(!cfg.bluemapUrl)return;
  let url;try{url=new URL(cfg.bluemapUrl);if(url.protocol!=="https:")return;}catch(e){return;}
  const frame=$("#map-frame");if(frame){frame.replaceChildren();let iframe=el("iframe");iframe.src=url.href;iframe.loading="lazy";iframe.title="5er Pasch Weltkarte";frame.append(iframe);}
  const link=$("#map-external-link");if(link){link.href=url.href;link.classList.remove("hidden");}
 }
 function setStatus(state,msg,online,max,version){
  const title=state==="online"?"Online":state==="offline"?"Offline":"Noch nicht verbunden";
  if($("#server-state"))$("#server-state").textContent=state==="online"?"Server online":state==="offline"?"Server offline":"Noch nicht verbunden";
  if($("#hero-server-state"))$("#hero-server-state").textContent=title;
  if($("#server-message"))$("#server-message").textContent=msg;
  if($("#hero-online-count"))$("#hero-online-count").textContent=Number.isFinite(online)?online+" / "+(Number.isFinite(max)?max:"–"):"– / –";
  if($("#hero-version"))$("#hero-version").textContent=version||"–";
 }
 const server=(cfg.serverAddress||"").trim();
 if(server){
  if($("#server-address"))$("#server-address").textContent=server;
  const cp=$("#copy-ip");if(cp){cp.disabled=false;cp.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(server);toast("IP kopiert!");}catch(e){toast(server);}});}
  const refresh=async()=>{try{const edition=cfg.edition==="bedrock"?"bedrock":"java";
   const response=await fetch("https://api.mcstatus.io/v2/status/"+edition+"/"+encodeURIComponent(server),{cache:"no-store"});if(!response.ok)throw Error("Statusfehler");
   const d=await response.json();if(d.online)setStatus("online","Bereit für neue Abenteuer",d.players?.online,d.players?.max,d.version?.name_clean||d.version?.name_raw);
   else setStatus("offline","Im Moment nicht erreichbar");
  }catch(e){setStatus("unknown","Status derzeit nicht abrufbar");}};
  refresh();setInterval(refresh,60000);
 }else setStatus("unknown","Server-IP wird noch ergänzt.");
 const hero=$(".hero-image");if(hero)hero.addEventListener("error",()=>{if(!hero.src.endsWith("hero-minecraft.svg"))hero.src="assets/hero-minecraft.svg";});
 const menu=$("#menu-toggle"),nav=$("#site-nav");
 if(menu&&nav){menu.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.setAttribute("aria-label",open?"Menü schließen":"Menü öffnen");});$$("#site-nav a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu.setAttribute("aria-expanded","false");}));}
 if($("#copyright-year"))$("#copyright-year").textContent=new Date().getFullYear();
 renderProjects();renderMilestones();renderPlayers();setupMap();
})();
