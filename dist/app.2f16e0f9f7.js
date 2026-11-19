"use strict";
/* Early PWA & Service Worker hook before async data hydration */
const PWA={
  supportsWebInstall:typeof Navigator!=="undefined"&&typeof Navigator.prototype.install==="function",
  deferred:undefined,
  installed:false
};
window.addEventListener("beforeinstallprompt",ev=>{ev.preventDefault();PWA.deferred=ev;if(typeof window.__pmSyncInstall==="function")window.__pmSyncInstall()});
window.addEventListener("appinstalled",()=>{PWA.installed=true;PWA.deferred=undefined;if(typeof window.__pmSyncInstall==="function")window.__pmSyncInstall(true)});
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
  const regSW=()=>navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"}).then(r=>r.update()).catch(()=>{});
  if(document.readyState==="complete")regSW();else window.addEventListener("load",regSW);
}
(async function bootPlayedAndMade(){
/* ================================================================
   Played & Made — a family tree of video games + your gaming timeline
   ================================================================ */
let RAW=null;
const inlineDataEl=document.getElementById("data");
if(inlineDataEl&&inlineDataEl.textContent&&inlineDataEl.textContent.trim().startsWith("{")){
  RAW=JSON.parse(inlineDataEl.textContent);
}else{
  const dataUrl=window.__PM_DATA_URL__||"./data.json";
  try{
    const res=await fetch(dataUrl,{credentials:"same-origin"});
    if(!res.ok)throw new Error("HTTP "+res.status);
    RAW=await res.json();
  }catch(err){
    const m=document.getElementById("main");
    if(m)m.innerHTML=`<section class="wrap" style="padding:32px 18px;max-width:60ch"><h1 class="h1">Couldn’t load the game archive</h1><p class="lede">Check your connection and try again — once loaded, Played &amp; Made caches everything for offline use.</p><button type="button" class="btn primary" onclick="location.reload()">Retry</button></section>`;
    return;
  }
}
const NOW=Math.max(new Date().getFullYear(),2026);
const shareBase=()=>location.protocol.startsWith("http")?location.origin+location.pathname:"https://playedmade.com/";
const ghRepoURL=()=>{if(location.hostname.endsWith(".github.io")){const u=location.hostname.slice(0,-10),r=location.pathname.split("/").filter(Boolean)[0];if(u&&r)return `https://github.com/${u}/${r}`}return ""};
const TIERS=[
  {k:"dev",label:"Developer said so",c:"--t-dev",w:3,dash:""},
  {k:"team",label:"Same team or code",c:"--t-team",w:2.5,dash:"10 4"},
  {k:"series",label:"Same series",c:"--t-series",w:1,dash:"2 4"},
  {k:"critic",label:"Critics & historians",c:"--t-critic",w:2,dash:"8 4 2 4"},
  {k:"mech",label:"Shared mechanics",c:"--t-mech",w:1.5,dash:"5 3"},
  {k:"disp",label:"Debated / disputed",c:"--t-disp",w:.5,dash:"3 3"}];
const tierSwatchSVG=t=>`<svg class="swatch" viewBox="0 0 18 6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" stroke="var(${t.c})" stroke-width="2.4"${t.dash?` stroke-dasharray="${t.dash}"`:""}/></svg>`;
const prefersReducedMotion=()=>!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function haptic(pat=8){
  if(prefersReducedMotion())return;
  if(typeof navigator!=="undefined"&&navigator.userActivation&&!navigator.userActivation.hasBeenActive)return;
  if(typeof navigator!=="undefined"&&typeof navigator.vibrate==="function"){try{navigator.vibrate(pat)}catch(_){}}
}
const RELS_K=RAW.rels||["","synthesis","evolution","mod","fast-follow","variant"];
const REL_META={
  synthesis:{label:"Creative synthesis",cls:""},
  evolution:{label:"Genre evolution",cls:""},
  mod:{label:"Born from a mod",cls:""},
  "fast-follow":{label:"Format iteration",cls:"warn"},
  variant:{label:"Genre variant",cls:"warn"}
};
const GEN=RAW.genres.map(([k,label],i)=>({k,label,i,c:`hsl(${Math.round(i*360/RAW.genres.length*7)%360} 58% 52%)`}));
const PLATS=RAW.plats;

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fold=s=>String(s).normalize("NFD").replace(/[̀-ͯ]/g,"");
const ROMAN={ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10,xi:11,xii:12,xiii:13,xiv:14,xv:15,xvi:16};
const deroman=s=>fold(s).toLowerCase().replace(/\b(ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi)\b/g,m=>ROMAN[m]);
const norm=t=>{const n=fold(t).toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"");return n||"~"+String(t).trim().toLowerCase()};
const norm1=t=>String(t).toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,""); // keys saved by version 1
const normR=t=>norm(deroman(t));
const hueOf=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return h};
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+"s")}`;
const store={get(k,d=null){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const cssVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let _rn=null;const countryName=cc=>{try{_rn=_rn||new Intl.DisplayNames(["en"],{type:"region"});return _rn.of(cc)}catch(e){return cc}};
const flagEmoji=cc=>cc&&/^[A-Z]{2}$/.test(cc)?String.fromCodePoint(...[...cc].map(c=>0x1F1E6+c.charCodeAt(0)-65)):"";
const flag=cc=>cc?`<span class="flag" title="${esc(countryName(cc))}" aria-label="${esc(countryName(cc))}">${flagEmoji(cc)}</span>`:"";
const studio=g=>String(g&&g.dev||"").split(/\s*(?:\/|;|,)\s*/)[0];
let _toastUndoFn=null;
function toast(m,opts){
  const t=$("#toast");if(!t)return;
  const o=opts&&typeof opts==="object"?opts:{};
  _toastUndoFn=typeof o.undo==="function"?o.undo:null;
  t.innerHTML=`<span>${esc(m)}</span>`+(_toastUndoFn?`<button type="button" class="toast-undo" data-act="toastUndo">Undo</button>`:"");
  t.hidden=false;
  try{if(t.showPopover)t.showPopover()}catch(e){}
  clearTimeout(toast.t);
  toast.t=setTimeout(()=>{_toastUndoFn=null;try{if(t.hidePopover)t.hidePopover()}catch(e){}t.hidden=true},o.ms||(_toastUndoFn?6000:2800));
}
function hideToast(){_toastUndoFn=null;const t=$("#toast");if(!t)return;clearTimeout(toast.t);try{if(t.hidePopover)t.hidePopover()}catch(e){}t.hidden=true}
function announceSR(m){const el=$("#srLive");if(!el)return;el.textContent="";setTimeout(()=>{el.textContent=m},60)}
const DEV_QUERY=(()=>{try{return new URLSearchParams(location.search).get("dev")==="1"}catch(e){return false}})();

/* ---------- data ---------- */
const imgURL=v=>{if(!v)return "";if(v.startsWith("i:"))return `https://images.igdb.com/igdb/image/upload/t_cover_big/${v.slice(2)}.webp`;if(v.startsWith("wt:"))return `https://thumb.wikimedia.org/wikipedia/${v.slice(3)}`;if(v.startsWith("w:"))return `${v.includes("/thumb/")?"https://thumb.wikimedia.org/wikipedia/":"https://upload.wikimedia.org/wikipedia/"}${v.slice(2)}`;if(v.startsWith("s:"))return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${v.slice(2)}/library_600x900.jpg`;return v};
window._covFit=function(im){
  if(!im||im.naturalWidth<=20){_covErr(im);return}
  const u=im.getAttribute("src")||"",isLogo=/\.svg\.png|Logo\.|_logo\./i.test(u);
  if(!isLogo){
    const ar=im.naturalWidth/Math.max(1,im.naturalHeight);
    if(ar>1.55)im.dataset.fit="wrap";
    else if(ar>0.96)im.dataset.fit="wide";
  }
  if(im.parentElement)im.parentElement.classList.add("hasimg");
};
window._covErr=function(im){
  if(!im||im.dataset.retried){if(im)im.remove();return}
  im.dataset.retried="1";const u=im.src||"";
  if(u.includes("/library_600x900.jpg")){im.src=u.replace("/library_600x900.jpg","/header.jpg");return}
  const m=u.match(/^https:\/\/(?:thumb|upload)\.wikimedia\.org\/wikipedia\/(en|commons|fr|de|ru|ja)\/thumb\/([0-9a-f]\/[0-9a-f]{2}\/[^/]+?\.(?:jpg|jpeg|png|webp|gif))\/[^/]+$/i);
  if(m){im.src=`https://upload.wikimedia.org/wikipedia/${m[1]}/${m[2]}`;return}
  im.remove();
};
const CULT=RAW.culture||{};
const MW=RAW.mw||{mechanics:[],genres:{},boardgames:[]};
const G=RAW.g.map((r,i)=>{const ryt=String(r[15]||""),yta=ryt.startsWith("~"),rawImg=String(r[13]||""),sid=rawImg.startsWith("s:")?parseInt(rawImg.slice(2),10)||0:0;return {i,code:r[0],id:r[1],title:r[2],year:r[3],dev:r[4],cc:r[5],gen:r[6],plats:r[7].map(p=>PLATS[p]),pop:r[8],note:r[9],inf:r[10],aka:r[11],cat:!!(r[12]&1),cancelled:!!(r[12]&2),sunset:!!(r[12]&4),img:imgURL(rawImg),steamId:sid,moby:r[14]||0,yt:yta?ryt.slice(1):ryt,ytAuto:yta,n:norm(r[2]),nr:normR(r[2]),h:hueOf(r[1])}});
const L=RAW.l.map((r,i)=>({i,from:r[0],to:r[1],t:r[2],tier:TIERS[r[2]].k,took:r[3],added:r[4],src:r[5],extra:r[6],minor:!!(r[7]&1),disputed:!!(r[7]&2),rel:RELS_K[r[8]||0]||""}));
const mobyURL=g=>g.moby?`https://www.mobygames.com/game/${g.moby}/credits/`:`https://www.mobygames.com/search/?q=${encodeURIComponent(g.title)}&type=game`;
const mobyCoversURL=g=>g.moby?`https://www.mobygames.com/game/${g.moby}/covers/`:`https://www.mobygames.com/search/?q=${encodeURIComponent(g.title)}&type=game`;
const byId=new Map(G.map(g=>[g.id,g])),byCode=new Map(G.map(g=>[g.code,g])),byNorm=new Map(),byNorm1=new Map(),bySteamId=new Map();
G.forEach(g=>{if(!byNorm.has(g.n))byNorm.set(g.n,g);const k1=norm1(g.title);if(!byNorm1.has(k1))byNorm1.set(k1,g);if(g.steamId&&!bySteamId.has(g.steamId))bySteamId.set(g.steamId,g)});
const UP=G.map(()=>[]),DOWN=G.map(()=>[]);L.forEach(l=>{UP[l.to].push(l);DOWN[l.from].push(l)});
G.forEach(g=>{g.tree=UP[g.i].length+DOWN[g.i].length>0});
const TREE=G.filter(g=>g.tree);
const findGame=t=>t?(byNorm.get(norm(t))||byNorm1.get(norm1(t))||null):null;
const gameRef=x=>byId.get(x)||findGame(x);
const playable=g=>!g.cancelled&&!(g.plats.length&&g.plats.every(p=>p==="Tabletop")); // tabletop & unreleased games stay in the tree/vault, not consumer timeline picks
const isVideoGame=g=>g&&g.year>=1958&&!(g.plats.length&&g.plats.every(p=>p==="Tabletop"));
const sellable=g=>playable(g)&&!g.sunset;
const statusBadgeHTML=g=>g&&g.cancelled?`<span class="vbadge canc" title="Cancelled before retail release — honored here for the makers who built it">Unreleased / Cancelled</span>`:g&&g.sunset?`<span class="vbadge sun" title="Official online servers shut down">Servers Sunsetted</span>`:"";
const directCrossLinks=g=>DOWN[g.i].filter(l=>l.tier!=="series"&&l.tier!=="disp"&&!l.minor);
const directSeriesLinks=g=>DOWN[g.i].filter(l=>l.tier==="series");
function isWikiOnlyDev(l){
  if(!l||l.tier!=="dev"||!l.src||!l.src.length)return false;
  const urls=l.src.map(x=>x[1]).filter(Boolean);
  if(urls.length)return urls.every(u=>/wikipedia\.org/i.test(u));
  return l.src.every(([tt])=>/wikipedia/i.test(tt||""));
}
const tierLabelForLink=l=>isWikiOnlyDev(l)?"Cited via Wikipedia":(TIERS[l.t]?TIERS[l.t].label:"");
const eraKidLabel=d=>{
  if(d&&d.era&&/^\d0s$/.test(d.era))return `'${d.era} kid`;
  if(d&&d.birth){const dec=Math.floor(d.birth/10)*10;return `'${String(dec).slice(-2)}s kid`}
  return "";
};
const COUNTRY_COUNT=new Set(G.map(g=>g.cc).filter(Boolean)).size;
/* same-named games (Tomb Raider 1996 / 2013): use the entry's year to pick the right one */
const findGameY=(t,y)=>{const g=findGame(t);if(!g||!y||Math.abs(g.year-y)<=1)return g;return byNorm.get(norm(t+" ("+y+")"))||g};
const tierOn=l=>!!state.tiers[l.tier]||(l.disputed&&!!state.tiers.disp);
const srcHTML=(src,tier)=>(src||[]).map(([tt,u])=>{const lbl=tt||u;return u&&/^https?:\/\//i.test(u)?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(lbl)}</a>`:esc(lbl)}).filter(Boolean).join(" · ");
const genreOf=g=>g&&g.gen.length?GEN[g.gen[0]]:null;
const GEN_BY_K=new Map(GEN.map(g=>[g.k,g]));

/* ---------- studios & makers registry ---------- */
const slugStudio=s=>fold(String(s||"")).toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"unknown";
const STUDIOS=new Map(),STUDIO_ALIAS=new Map();
(RAW.studios||[]).forEach(r=>{
  const st={id:r[0],name:r[1],aliases:r[2]||[],cc:r[3]||"",founded:r[4]||0,closed:r[5]||0,status:r[6]||"active",hq:r[7]||"",makers:r[8]||[],bio:r[9]||"",diaspora:(r[10]||[]).map(([studio,note])=>({studio,note})),logo:imgURL(r[11]||""),curated:true,games:[]};
  STUDIOS.set(st.id,st);
  [st.name,...st.aliases].forEach(a=>{STUDIO_ALIAS.set(norm(a),st);STUDIO_ALIAS.set(slugStudio(a),st)});
});
G.forEach(g=>{
  const names=String(g.dev||"").split(/\s*(?:\/|;|,)\s*/).map(s=>s.trim()).filter(Boolean);
  names.forEach(nm=>{
    let st=STUDIO_ALIAS.get(norm(nm))||STUDIO_ALIAS.get(slugStudio(nm));
    if(!st){const id=slugStudio(nm);st=STUDIOS.get(id);if(!st){st={id,name:nm,aliases:[],cc:g.cc||"",founded:0,closed:0,status:"active",hq:"",makers:[],bio:"",diaspora:[],logo:"",curated:false,games:[]};STUDIOS.set(id,st);STUDIO_ALIAS.set(norm(nm),st)}}
    if(!st.cc&&g.cc)st.cc=g.cc;
    if(!st.games.includes(g))st.games.push(g);
  });
});
STUDIOS.forEach(st=>{st.games.sort((a,b)=>a.year-b.year||b.pop-a.pop);st.maxInf=st.games.reduce((m,g)=>Math.max(m,g.inf),0);st.treeCount=st.games.filter(g=>g.tree).length});
const findStudio=x=>x?(STUDIOS.get(x)||STUDIO_ALIAS.get(norm(x))||STUDIO_ALIAS.get(slugStudio(x))||null):null;
const studioLogoHTML=(st,cls="")=>st&&st.logo?`<span class="stlogobox${cls?" "+cls:""}"><img class="stlogo" src="${esc(st.logo)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.remove()"></span>`:"";
const studioBtn=(nm,cls="stbtn")=>{if(!nm)return "";const st=findStudio(nm);return st?`<button type="button" class="${cls}" data-act="studio" data-st="${esc(st.id)}">${esc(nm)}</button>`:esc(nm)};
const studioLinks=dev=>String(dev||"").split(/\s*(?:\/|;|,)\s*/).map(s=>s.trim()).filter(Boolean).map(nm=>studioBtn(nm)).join(" / ");

/* systems: [brand, name, first year, last year]. Append only: share links store positions in this list. */
const SYSTEMS=[["A","Arcade",1971,2026],
 ["C","PC",1981,2026],["C","Amiga",1985,1997],["C","Commodore 64",1982,1994],["C","Atari ST",1985,1995],["C","ZX Spectrum",1982,1993],["C","Amstrad CPC",1984,1992],["C","MSX",1983,1992],["C","Apple II",1977,1993],["C","Mac",1984,2026],["C","Steam Deck",2022,2026],
 ["N","NES",1983,1995],["N","Game Boy",1989,2003],["N","SNES",1990,2000],["N","Nintendo 64",1996,2002],["N","Game Boy Advance",2001,2008],["N","GameCube",2001,2007],["N","Nintendo DS",2004,2014],["N","Wii",2006,2013],["N","Nintendo 3DS",2011,2020],["N","Wii U",2012,2017],["N","Switch",2017,2026],["N","Switch 2",2025,2026],
 ["S","Master System",1985,1996],["S","Mega Drive / Genesis",1988,1998],["S","Game Gear",1990,1997],["S","Saturn",1994,2000],["S","Dreamcast",1998,2002],
 ["P","PlayStation",1994,2006],["P","PlayStation 2",2000,2013],["P","PSP",2004,2014],["P","PlayStation 3",2006,2017],["P","PS Vita",2011,2019],["P","PlayStation 4",2013,2026],["P","PlayStation 5",2020,2026],
 ["X","Xbox",2001,2008],["X","Xbox 360",2005,2016],["X","Xbox One",2013,2022],["X","Xbox Series X|S",2020,2026],
 ["M","iPhone / iPad",2008,2026],["M","Android",2009,2026],["M","Browser",1995,2026],
 ["O","Atari 2600",1977,1992],["O","Atari 7800",1986,1992],["O","Intellivision",1979,1990],["O","ColecoVision",1982,1985],["C","Atari 8-bit",1979,1992],["C","Linux",1995,2026],
 ["N","Game Boy Color",1998,2003],["S","Sega CD",1991,1996],["O","TurboGrafx-16",1987,1994],["O","Neo Geo",1990,2004],["O","Atari Lynx",1989,1995],["O","3DO",1993,1996],["O","Atari Jaguar",1993,1996],
 ["M","Mobile (feature phone)",1997,2010],["N","Game & Watch",1980,1991],["O","VR",2016,2026],["O","Dendy",1992,1999],
 ["O","Vectrex",1982,1984],["C","NEC PC-98",1982,2000],["C","Sharp X68000",1987,1996],["C","Amiga CD32",1993,1994],["C","Subor",1993,2002],["O","Philips CD-i",1991,1998],["N","Virtual Boy",1995,1996],["M","Nokia N-Gage",2003,2006],["O","Gizmondo",2005,2006]];
const SYS_IDX=new Map(SYSTEMS.map((s,i)=>[s[1],i]));
const BRANDS={A:"Arcades",C:"Computers",N:"Nintendo",S:"Sega",P:"PlayStation",X:"Xbox",M:"Phones & browser",O:"Other & regional consoles"};
const canonSys=n=>/^PC \((DOS|Windows)\)$/.test(n)?"PC":n;
const sysOfGame=g=>[...new Set(g.plats.map(canonSys))];
const gameMatchesSys=(ps,sy)=>ps.includes(sy)||((sy==="Dendy"||sy==="Subor")&&ps.includes("NES"))||(sy==="Amiga CD32"&&ps.includes("Amiga"));
const brandOfSys=n=>(SYSTEMS[SYS_IDX.get(n)]||["O"])[0];
const brandOf=g=>g&&g.plats.length?brandOfSys(canonSys(g.plats[0])):"";

/* ---------- tactile console & computer illustrations (0 KB vector art + 3D tilt) ---------- */
function hwSVG(sys,cls="hwsvg"){
  const s=String(sys||"");let body="";
  if(s==="Amiga"){
    body=`<polygon points="6,11 58,11 61,34 3,34" fill="#DDD4BF" stroke="#8C826D" stroke-width="1.5"/>
      <rect x="3" y="33" width="58" height="4" rx="1.5" fill="#B7AD96"/><rect x="10" y="14" width="34" height="4" rx="1" fill="#6F685A"/>
      <rect x="8" y="20" width="38" height="10" rx="1.2" fill="#F2ECE0"/><rect x="48" y="20" width="9" height="10" rx="1.2" fill="#CFC6B0"/>
      <rect x="49" y="14" width="4" height="2" fill="#E84A3C"/><rect x="54" y="14" width="4" height="2" fill="#4AD66D"/>`;
  }else if(s==="Commodore 64"||s==="Atari 8-bit"){
    body=`<rect x="4" y="12" width="56" height="24" rx="5" fill="#8C7965" stroke="#5D4E3F" stroke-width="1.5"/>
      <rect x="9" y="19" width="39" height="13" rx="1.5" fill="#3B322B"/><rect x="50" y="19" width="6" height="13" rx="1" fill="#52463D"/>
      <rect x="47" y="14" width="9" height="1.5" fill="#E04646"/><rect x="47" y="15.5" width="9" height="1.5" fill="#E8B838"/><rect x="47" y="17" width="9" height="1.5" fill="#3BA8DF"/>`;
  }else if(s==="ZX Spectrum"||s==="Amstrad CPC"||s==="MSX"||s==="Atari ST"){
    body=`<rect x="5" y="13" width="54" height="23" rx="3" fill="#23262E" stroke="#4D5362" stroke-width="1.5"/>
      <rect x="9" y="20" width="40" height="12" rx="1" fill="#3C4250"/>
      <polygon points="44,13 48,13 38,36 34,36" fill="#E54848"/><polygon points="48,13 52,13 42,36 38,36" fill="#F0C238"/><polygon points="52,13 56,13 46,36 42,36" fill="#3CC46C"/><polygon points="56,13 59,13 49,36 46,36" fill="#3A9CE8"/>`;
  }else if(s==="PC"||s==="Linux"){
    body=`<rect x="8" y="30" width="48" height="9" rx="2" fill="#D8D2C5" stroke="#8E887B" stroke-width="1.3"/><rect x="38" y="33" width="13" height="2.2" fill="#4A463F"/>
      <rect x="14" y="6" width="36" height="24" rx="3" fill="#E4DFD3" stroke="#8E887B" stroke-width="1.4"/>
      <rect x="18" y="9.5" width="28" height="17" rx="2" fill="#13294B"/><rect x="20" y="12" width="14" height="2" fill="#5CE1E6"/><rect x="20" y="16" width="20" height="2" fill="#8C9DFF" opacity=".7"/>`;
  }else if(s==="Mac"||s==="Apple II"){
    body=`<rect x="16" y="5" width="32" height="34" rx="4" fill="#E5DEC9" stroke="#8F8875" stroke-width="1.5"/>
      <rect x="20" y="9" width="24" height="16" rx="2.5" fill="#1E2938"/><rect x="33" y="29" width="11" height="2" rx="1" fill="#4A453B"/>
      <circle cx="22" cy="30" r="1.6" fill="#5EC269"/>`;
  }else if(s==="Arcade"||s==="Neo Geo"){
    body=`<polygon points="18,4 46,4 49,13 45,26 48,39 16,39 19,26 15,13" fill="#1F2437" stroke="#59658C" stroke-width="1.5"/>
      <rect x="20" y="6" width="24" height="5" rx="1" fill="#FF6E5A"/><rect x="21" y="13" width="22" height="12" rx="2" fill="#153B6E"/>
      <circle cx="25" cy="29" r="2" fill="#FFD166"/><circle cx="37" cy="29.5" r="1.6" fill="#FF6E5A"/><circle cx="41" cy="29" r="1.6" fill="#43C6AC"/>`;
  }else if(s==="NES"){
    body=`<rect x="6" y="13" width="52" height="14" rx="2" fill="#DCDFE4" stroke="#7E8490" stroke-width="1.4"/>
      <rect x="9" y="27" width="46" height="9" rx="1.5" fill="#8E94A0"/><rect x="12" y="13" width="26" height="9" fill="#BFC4CE"/><rect x="43" y="13" width="7" height="23" fill="#2A2D34"/>
      <rect x="14" y="30" width="5" height="3" rx=".8" fill="#D9383A"/><rect x="21" y="30" width="5" height="3" rx=".8" fill="#D9383A"/>`;
  }else if(s==="Dendy"||s==="Subor"){
    body=s==="Subor"?`<rect x="19" y="5" width="22" height="9" rx="1.5" fill="#F4C430" stroke="#B88914" stroke-width="1.2"/>
      <polygon points="6,13 58,13 61,35 3,35" fill="#E4DFD3" stroke="#8A8476" stroke-width="1.4"/>
      <rect x="9" y="19" width="46" height="12" rx="1.2" fill="#4A4E5A"/><rect x="47" y="15" width="8" height="2" fill="#D9383A"/>`
    :`<rect x="21" y="6" width="22" height="10" rx="1.5" fill="#F4C430" stroke="#B88914" stroke-width="1.2"/>
      <rect x="8" y="15" width="48" height="20" rx="3.5" fill="#E3E5EA" stroke="#858B98" stroke-width="1.4"/>
      <rect x="18" y="15" width="28" height="5" rx="1" fill="#B8BECB"/>
      <rect x="14" y="24" width="8" height="4.5" rx="1" fill="#D9383A"/><rect x="42" y="24" width="8" height="4.5" rx="1" fill="#D9383A"/>
      <rect x="27" y="25" width="10" height="3" rx="1" fill="#5D6475"/>`;
  }else if(s==="Vectrex"){
    body=`<rect x="16" y="4" width="32" height="35" rx="3" fill="#1C2029" stroke="#535C73" stroke-width="1.4"/>
      <rect x="20" y="7" width="24" height="20" rx="2" fill="#0B1320" stroke="#3685B5" stroke-width="1"/>
      <polygon points="32,10 38,23 32,20 26,23" fill="none" stroke="#6CF0FF" stroke-width="1.2"/>
      <rect x="19" y="30" width="26" height="6" rx="1.5" fill="#2E3444"/><circle cx="24" cy="33" r="1.8" fill="#B8C2D8"/>`;
  }else if(s==="Virtual Boy"){
    body=`<line x1="25" y1="24" x2="18" y2="39" stroke="#232730" stroke-width="2.6" stroke-linecap="round"/><line x1="39" y1="24" x2="46" y2="39" stroke="#232730" stroke-width="2.6" stroke-linecap="round"/>
      <rect x="12" y="9" width="40" height="16" rx="5" fill="#D92B3A" stroke="#8E1622" stroke-width="1.4"/>
      <rect x="18" y="12" width="28" height="9" rx="3" fill="#1A1D24"/><circle cx="25" cy="16.5" r="2.2" fill="#FF3B4E"/><circle cx="39" cy="16.5" r="2.2" fill="#FF3B4E"/>`;
  }else if(s==="Sharp X68000"){
    body=`<rect x="18" y="5" width="12" height="33" rx="1.5" fill="#252932" stroke="#555E72" stroke-width="1.3"/>
      <rect x="31" y="5" width="12" height="33" rx="1.5" fill="#252932" stroke="#555E72" stroke-width="1.3"/>
      <line x1="24" y1="10" x2="24" y2="32" stroke="#E04646" stroke-width="1.3"/><line x1="37" y1="10" x2="37" y2="32" stroke="#4AD66D" stroke-width="1.3"/>
      <rect x="14" y="36" width="33" height="3" rx="1" fill="#3D4352"/>`;
  }else if(s==="NEC PC-98"){
    body=`<rect x="9" y="28" width="46" height="9" rx="1.5" fill="#DFD9C8" stroke="#8E8775" stroke-width="1.3"/><line x1="36" y1="31" x2="50" y2="31" stroke="#4A453B" stroke-width="1.6"/><line x1="36" y1="34" x2="50" y2="34" stroke="#4A453B" stroke-width="1.6"/>
      <rect x="15" y="6" width="34" height="22" rx="2.5" fill="#E7E1D2" stroke="#8E8775" stroke-width="1.4"/><rect x="19" y="9.5" width="26" height="15" rx="1.5" fill="#19162B"/><circle cx="32" cy="17" r="4" fill="#FF6E5A" opacity=".85"/>`;
  }else if(s==="Nokia N-Gage"||s==="Gizmondo"){
    body=s==="Gizmondo"?`<rect x="7" y="12" width="50" height="22" rx="10" fill="#A9B0BE" stroke="#5E6678" stroke-width="1.4"/>
      <rect x="20" y="15" width="24" height="16" rx="2" fill="#18263A"/><rect x="26" y="10" width="12" height="3" rx="1" fill="#2B303C"/>
      <circle cx="13" cy="23" r="3" fill="#2B303C"/><circle cx="51" cy="23" r="3" fill="#FF6E5A"/>`
    :`<rect x="6" y="11" width="52" height="23" rx="11" fill="#3A404F" stroke="#7A849B" stroke-width="1.4"/>
      <rect x="23" y="13.5" width="18" height="18" rx="2" fill="#244B3A"/><circle cx="14" cy="22.5" r="3.5" fill="#20242E"/><circle cx="50" cy="22.5" r="3.5" fill="#D9383A"/>`;
  }else if(s==="Philips CD-i"||s==="Amiga CD32"||s==="3DO"){
    body=`<rect x="6" y="16" width="52" height="17" rx="2.5" fill="#262A34" stroke="#5B6378" stroke-width="1.4"/>
      <circle cx="26" cy="24.5" r="6.5" fill="#1A1D24" stroke="#788299" stroke-width="1.2"/><rect x="38" y="22" width="14" height="4" rx="1" fill="#3E82F7"/>`;
  }else if(s==="SNES"){
    body=`<rect x="6" y="15" width="52" height="20" rx="3.5" fill="#D7DAE2" stroke="#858B99" stroke-width="1.4"/>
      <rect x="15" y="13" width="34" height="9" rx="2" fill="#C2C6D2"/><rect x="19" y="25" width="8" height="5" rx="1.5" fill="#7B68C8"/><rect x="37" y="25" width="8" height="5" rx="1.5" fill="#9D8CE0"/>`;
  }else if(s==="Game Boy"||s==="Game Boy Color"||s==="Game & Watch"){
    body=`<rect x="18" y="4" width="28" height="36" rx="4" fill="#D8D9DE" stroke="#7D818D" stroke-width="1.4"/>
      <rect x="21" y="7.5" width="22" height="15" rx="2" fill="#59606D"/><rect x="24" y="9.5" width="16" height="11" rx="1" fill="${s==="Game Boy Color"?"#38B6FF":"#7E9448"}"/>
      <path d="M24 27h2v-2h2v2h2v2h-2v2h-2v-2h-2z" fill="#2C303A"/><circle cx="39" cy="28" r="2" fill="#A62656"/><circle cx="35" cy="30.5" r="2" fill="#A62656"/>`;
  }else if(s==="Nintendo 64"||s==="GameCube"){
    body=s==="GameCube"?`<rect x="15" y="8" width="34" height="29" rx="4" fill="#5546A8" stroke="#362B73" stroke-width="1.5"/><circle cx="32" cy="19" r="7" fill="#3D3180"/><rect x="19" y="29" width="26" height="5" rx="1.5" fill="#C9CED8"/>`
      :`<path d="M6 22 Q12 13 32 13 Q52 13 58 22 L56 34 L8 34 Z" fill="#2D313B" stroke="#596073" stroke-width="1.4"/><rect x="22" y="15" width="20" height="5" rx="2" fill="#1B1E25"/><circle cx="15" cy="30" r="1.8" fill="#8E96A8"/><circle cx="22" cy="30" r="1.8" fill="#8E96A8"/><circle cx="42" cy="30" r="1.8" fill="#8E96A8"/><circle cx="49" cy="30" r="1.8" fill="#8E96A8"/><rect x="29" y="26" width="6" height="4" rx="1" fill="#E04646"/>`;
  }else if(s==="Switch"||s==="Switch 2"||s==="Wii U"){
    body=`<rect x="6" y="11" width="10" height="22" rx="4.5" fill="#00C3E3"/><rect x="48" y="11" width="10" height="22" rx="4.5" fill="#FF4554"/>
      <rect x="15" y="11" width="34" height="22" rx="2" fill="#1B1F29" stroke="#3F4658" stroke-width="1.2"/><rect x="18" y="13.5" width="28" height="17" rx="1" fill="#273859"/>
      <circle cx="11" cy="17" r="2" fill="#1B1F29"/><circle cx="53" cy="23" r="2" fill="#1B1F29"/>`;
  }else if(s==="Nintendo DS"||s==="Nintendo 3DS"){
    body=`<rect x="14" y="5" width="36" height="16" rx="3" fill="#3B4254"/><rect x="19" y="7.5" width="26" height="11" rx="1" fill="#243B64"/>
      <rect x="14" y="22" width="36" height="17" rx="3" fill="#4A5268"/><rect x="21" y="24.5" width="22" height="12" rx="1" fill="#34568B"/>`;
  }else if(s==="Wii"){
    body=`<rect x="21" y="5" width="20" height="34" rx="2.5" fill="#F2F4F8" stroke="#AEB6C8" stroke-width="1.4"/><rect x="25" y="9" width="2" height="18" rx="1" fill="#00B4FF"/>`;
  }else if(s==="Mega Drive / Genesis"||s==="Master System"||s==="Saturn"||s==="Sega CD"){
    body=`<rect x="5" y="14" width="54" height="21" rx="4" fill="#1E212B" stroke="#4D5468" stroke-width="1.4"/>
      <circle cx="28" cy="24" r="8.5" fill="#2C3140" stroke="#D4AF37" stroke-width="1.3"/><rect x="18" y="21" width="20" height="4" rx="1" fill="#12141B"/><rect x="44" y="18" width="9" height="12" rx="1.5" fill="#2C3140"/>`;
  }else if(s==="Dreamcast"){
    body=`<rect x="10" y="9" width="44" height="27" rx="4" fill="#ECEFF5" stroke="#A8B0C2" stroke-width="1.4"/>
      <circle cx="32" cy="21" r="9.5" fill="none" stroke="#BEC5D4" stroke-width="1.3"/><circle cx="32" cy="31" r="2.2" fill="#FF6B2B"/>`;
  }else if(s==="PlayStation"){
    body=`<rect x="9" y="9" width="46" height="27" rx="3.5" fill="#C7CCD6" stroke="#7E8594" stroke-width="1.4"/>
      <circle cx="32" cy="22.5" r="10" fill="#B8BECB" stroke="#8C93A4" stroke-width="1.3"/><circle cx="16" cy="29" r="3" fill="#A6AEBD"/><circle cx="48" cy="29" r="3" fill="#A6AEBD"/>`;
  }else if(s==="PlayStation 2"||s==="PlayStation 3"||s==="PlayStation 4"){
    body=`<rect x="6" y="15" width="52" height="18" rx="2" fill="#171A24" stroke="#3E4760" stroke-width="1.4"/>
      <line x1="8" y1="21" x2="56" y2="21" stroke="#2D6BFF" stroke-width="2"/><line x1="8" y1="26" x2="56" y2="26" stroke="#2B3144" stroke-width="1.5"/>`;
  }else if(s==="PlayStation 5"){
    body=`<path d="M21 5 Q32 8 43 5 L41 39 Q32 37 23 39 Z" fill="#F2F4F8" stroke="#9AA3B8" stroke-width="1.3"/>
      <rect x="27" y="7" width="10" height="31" rx="3" fill="#151924" stroke="#2D7DFF" stroke-width="1"/>`;
  }else if(s.startsWith("Xbox")){
    body=`<rect x="7" y="14" width="50" height="19" rx="3" fill="${s==="Xbox 360"?"#E9ECF2":"#1B1F26"}" stroke="#485260" stroke-width="1.4"/>
      <circle cx="32" cy="23.5" r="5" fill="#52E038"/><path d="M29.5 21l5 5M34.5 21l-5 5" stroke="#11290C" stroke-width="1.8"/>`;
  }else if(s==="Atari 2600"||s==="Atari 7800"||s==="Intellivision"||s==="ColecoVision"){
    body=`<rect x="5" y="12" width="54" height="23" rx="3" fill="#1E2026" stroke="#4D5260" stroke-width="1.4"/>
      <rect x="7" y="26" width="50" height="7" rx="1.5" fill="#8B5A2B"/><line x1="9" y1="16" x2="55" y2="16" stroke="#383C48" stroke-width="1.5"/><line x1="9" y1="20" x2="55" y2="20" stroke="#383C48" stroke-width="1.5"/>
      <rect x="22" y="15" width="20" height="5" fill="#101216"/>`;
  }else if(s==="Steam Deck"||s==="Game Boy Advance"||s==="PSP"||s==="PS Vita"||s==="Game Gear"||s==="Atari Lynx"){
    body=`<rect x="4" y="12" width="56" height="21" rx="8" fill="#202531" stroke="#535D75" stroke-width="1.4"/>
      <rect x="17" y="14.5" width="30" height="16" rx="2" fill="#2A4778"/><circle cx="11" cy="21" r="2.6" fill="#464F66"/><circle cx="53" cy="21" r="2.6" fill="#464F66"/>`;
  }else if(s==="VR"){
    body=`<rect x="10" y="14" width="44" height="18" rx="8" fill="#DFE4EE" stroke="#8590A6" stroke-width="1.5"/><path d="M24 32 Q32 27 40 32" fill="none" stroke="#626C82" stroke-width="2"/><rect x="15" y="18" width="34" height="9" rx="4" fill="#1E2536"/>`;
  }else{
    body=`<rect x="20" y="5" width="24" height="34" rx="4" fill="#1E2433" stroke="#596580" stroke-width="1.4"/><rect x="23" y="8" width="18" height="26" rx="2" fill="#2B4C7E"/><circle cx="32" cy="36.5" r="1.2" fill="#8C9DFF"/>`;
  }
  return `<svg class="${cls}" viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}
function canvasHardware(x,sys,bx,by,w,h){
  const s=String(sys||"");x.save();
  x.fillStyle="rgba(255,255,255,.06)";x.strokeStyle="rgba(140,157,255,.35)";x.lineWidth=2;
  x.beginPath();x.roundRect(bx,by,w,h,14);x.fill();x.stroke();
  /* normalized 72×44 hardware icon box */
  const cx=bx+20,cy=by+24,cw=72,ch=44;
  if(s==="Amiga"){x.fillStyle="#DDD4BF";x.fillRect(cx,cy+7,cw,ch-12);x.fillStyle="#6F685A";x.fillRect(cx+8,cy+11,cw-24,5);x.fillStyle="#F2ECE0";x.fillRect(cx+6,cy+19,cw-14,13);x.fillStyle="#E84A3C";x.fillRect(cx+cw-12,cy+11,5,3);x.fillStyle="#4AD66D";x.fillRect(cx+cw-6,cy+11,5,3)}
  else if(s==="Commodore 64"){x.fillStyle="#8C7965";x.beginPath();x.roundRect(cx,cy+7,cw,ch-12,7);x.fill();x.fillStyle="#3B322B";x.fillRect(cx+8,cy+16,cw-18,14);x.fillStyle="#E04646";x.fillRect(cx+cw-16,cy+10,10,3);x.fillStyle="#3BA8DF";x.fillRect(cx+cw-16,cy+13,10,3)}
  else if(s==="Switch"||s==="Switch 2"){x.fillStyle="#00C3E3";x.beginPath();x.roundRect(cx,cy+5,13,ch-10,6);x.fill();x.fillStyle="#FF4554";x.beginPath();x.roundRect(cx+cw-13,cy+5,13,ch-10,6);x.fill();x.fillStyle="#1B1F29";x.fillRect(cx+13,cy+5,cw-26,ch-10);x.fillStyle="#2A4678";x.fillRect(cx+17,cy+9,cw-34,ch-18)}
  else if(s.startsWith("Xbox")){x.fillStyle="#1B1F26";x.beginPath();x.roundRect(cx,cy+7,cw,ch-14,6);x.fill();x.fillStyle="#52E038";x.beginPath();x.arc(cx+cw/2,cy+ch/2,8.5,0,7);x.fill()}
  else if(s.startsWith("PlayStation")){x.fillStyle=s==="PlayStation"?"#C7CCD6":"#171A24";x.beginPath();x.roundRect(cx+2,cy+6,cw-4,ch-12,6);x.fill();x.strokeStyle="#2D6BFF";x.lineWidth=3;x.beginPath();x.arc(cx+cw/2,cy+ch/2,10,0,7);x.stroke()}
  else if(s==="Game Boy"||s==="Game Boy Color"){x.fillStyle="#D8D9DE";x.beginPath();x.roundRect(cx+18,cy+1,36,ch-2,5);x.fill();x.fillStyle="#7E9448";x.fillRect(cx+23,cy+6,26,16);x.fillStyle="#A62656";x.beginPath();x.arc(cx+45,cy+30,3.2,0,7);x.fill()}
  else if(s==="Dendy"){x.fillStyle="#F4C430";x.fillRect(cx+21,cy+2,30,10);x.fillStyle="#E3E5EA";x.beginPath();x.roundRect(cx+3,cy+11,cw-6,ch-15,6);x.fill();x.fillStyle="#D9383A";x.fillRect(cx+13,cy+23,11,6);x.fillRect(cx+cw-24,cy+23,11,6)}
  else if(s==="PC"||s==="Mac"||s.startsWith("PC (")){x.fillStyle="#E4DFD3";x.beginPath();x.roundRect(cx+10,cy+2,cw-20,ch-12,5);x.fill();x.fillStyle="#16325C";x.fillRect(cx+16,cy+7,cw-32,ch-22);x.fillStyle="#CFC9BA";x.fillRect(cx+4,cy+ch-9,cw-8,9)}
  else{x.fillStyle="#2B3348";x.beginPath();x.roundRect(cx+2,cy+6,cw-4,ch-12,6);x.fill();x.fillStyle="#FF6E5A";x.fillRect(cx+10,cy+19,16,7);x.fillStyle="#8C9DFF";x.fillRect(cx+30,cy+19,28,7)}
  x.restore();
}

/* ---------- audio: cover-pick blips & Lucky Wheel peg ticks ON by default (ambient iOS audioSession) ---------- */
const SYNTH={ctx:null,on:false,sfx:store.get("ib3-sfx",1)!==0,timer:null,step:0};
function ensureAudio(){
  try{if(navigator.audioSession&&navigator.audioSession.type!=="ambient")navigator.audioSession.type="ambient"}catch(e){}
  if(!SYNTH.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)SYNTH.ctx=new AC()}
  if(SYNTH.ctx&&SYNTH.ctx.state==="suspended")SYNTH.ctx.resume();
  return SYNTH.ctx;
}
function playBlip(lv){
  if(!SYNTH.sfx)return;const ctx=ensureAudio();if(!ctx)return;
  const notes=lv===3?[523.25,659.25,783.99,1046.5]:lv===2?[523.25,659.25]:lv===1?[440,554.37]:[311.13];
  notes.forEach((f,k)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";o.frequency.value=f;
    const t=ctx.currentTime+k*0.05;g.gain.setValueAtTime(0.001,t);g.gain.exponentialRampToValueAtTime(0.052,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.15);
    o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.16)});
}
/* Mechanical rubber-flapper peg click for the 12-wedge Lucky Wheel */
let lastPegTick=0;
function playWheelTick(speed=1,soft=false){
  if(!SYNTH.sfx)return;
  const now=performance.now();if(now-lastPegTick<22)return;lastPegTick=now;
  const ctx=ensureAudio();if(!ctx)return;
  const t=ctx.currentTime,sp=Math.max(0.15,Math.min(1,speed));
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type="triangle";
  const baseF=soft?290:(420+sp*310);
  o.frequency.setValueAtTime(baseF,t);
  o.frequency.exponentialRampToValueAtTime(baseF*0.36,t+0.026);
  const vol=(soft?0.016:0.024+sp*0.026);
  g.gain.setValueAtTime(0.0008,t);
  g.gain.exponentialRampToValueAtTime(vol,t+0.003);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.032);
  o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.036);
}
/* Subtle UI foley for explicit interactive feedback (never on passive route changes) */
let lastUiTick=0;
function playUiTick(kind="tap"){
  if(!SYNTH.sfx)return;
  const now=performance.now();if(now-lastUiTick<38)return;lastUiTick=now;
  const ctx=ensureAudio();if(!ctx)return;
  const t=ctx.currentTime;
  if(kind==="right"){
    [587.33,880].forEach((f,k)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";o.frequency.value=f;
      const st=t+k*0.055;g.gain.setValueAtTime(0.0008,st);g.gain.exponentialRampToValueAtTime(0.042,st+0.01);g.gain.exponentialRampToValueAtTime(0.0001,st+0.16);
      o.connect(g);g.connect(ctx.destination);o.start(st);o.stop(st+0.17)});
    return;
  }
  if(kind==="wrong"){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(210,t);o.frequency.exponentialRampToValueAtTime(145,t+0.11);
    g.gain.setValueAtTime(0.001,t);g.gain.exponentialRampToValueAtTime(0.032,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+0.13);
    o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.14);
    return;
  }
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type="sine";
  if(kind==="back"){o.frequency.setValueAtTime(470,t);o.frequency.exponentialRampToValueAtTime(360,t+0.028)}
  else if(kind==="fwd"){o.frequency.setValueAtTime(420,t);o.frequency.exponentialRampToValueAtTime(540,t+0.028)}
  else if(kind==="node"){o.frequency.setValueAtTime(520,t);o.frequency.exponentialRampToValueAtTime(660,t+0.032)}
  else{o.frequency.setValueAtTime(560,t);o.frequency.exponentialRampToValueAtTime(440,t+0.022)}
  g.gain.setValueAtTime(0.0006,t);g.gain.exponentialRampToValueAtTime(0.017,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.034);
  o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.038);
}
function toggleSfx(){
  SYNTH.sfx=!SYNTH.sfx;store.set("ib3-sfx",SYNTH.sfx?1:0);
  if(SYNTH.sfx)playBlip(2);
  updateAudioBtns();
  toast(SYNTH.sfx?"Sound effects on":"Sound effects muted");
}
/* 0-KB Web Audio console & sound-chip micro-foley (GB, PS1, C64 SID, YM2612) */
function playChipFoley(sys){
  if(!SYNTH.sfx)return;
  const ctx=ensureAudio();if(!ctx)return;
  const s=String(sys||"").toLowerCase(),t=ctx.currentTime;
  if(s.includes("game boy")||s.includes("game & watch")||s==="gb"){
    // Game Boy crisp 2-tone square boot chime (B5 -> E6)
    [[987.77,0,0.085],[1318.51,0.085,0.22]].forEach(([f,off,dur])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type="square";o.frequency.setValueAtTime(f,t+off);
      g.gain.setValueAtTime(0.001,t+off);g.gain.linearRampToValueAtTime(0.032,t+off+0.008);
      g.gain.exponentialRampToValueAtTime(0.0001,t+off+dur);
      o.connect(g);g.connect(ctx.destination);o.start(t+off);o.stop(t+off+dur+0.02);
    });
    return;
  }
  if(s.includes("playstation")||s==="psp"||s==="ps vita"||s==="ps1"){
    // PS1 warm detuned crystalline pad fifth swell
    [293.66,440,587.33,590.5].forEach((f,i)=>{
      const o=ctx.createOscillator(),flt=ctx.createBiquadFilter(),g=ctx.createGain();
      o.type=i<2?"triangle":"sawtooth";o.frequency.setValueAtTime(f,t);
      flt.type="lowpass";flt.frequency.setValueAtTime(1400,t);flt.frequency.exponentialRampToValueAtTime(480,t+0.34);
      g.gain.setValueAtTime(0.0008,t);g.gain.linearRampToValueAtTime(i<2?0.024:0.011,t+0.045);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.36);
      o.connect(flt);flt.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.38);
    });
    return;
  }
  if(s.includes("commodore 64")||s.includes("atari 8")||s.includes("zx spectrum")||s==="c64"||s==="sid"){
    // C64 MOS 6581 SID rapid 50Hz 3-note resonant sawtooth arpeggio
    const arp=[261.63,329.63,392,523.25,392,329.63];
    const o=ctx.createOscillator(),flt=ctx.createBiquadFilter(),g=ctx.createGain();
    o.type="sawtooth";
    arp.forEach((f,k)=>o.frequency.setValueAtTime(f,t+k*0.028));
    flt.type="bandpass";flt.Q.value=3.8;
    flt.frequency.setValueAtTime(900,t);flt.frequency.exponentialRampToValueAtTime(2200,t+0.16);
    g.gain.setValueAtTime(0.001,t);g.gain.linearRampToValueAtTime(0.036,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.19);
    o.connect(flt);flt.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.21);
    return;
  }
  if(s.includes("mega drive")||s.includes("genesis")||s.includes("master system")||s.includes("saturn")||s.includes("dreamcast")||s.includes("x68000")||s==="ym2612"){
    // Sega Mega Drive / Genesis Yamaha YM2612 2-op FM metallic bass pluck
    const car=ctx.createOscillator(),mod=ctx.createOscillator(),mGain=ctx.createGain(),g=ctx.createGain();
    car.type="sine";car.frequency.setValueAtTime(220,t);
    mod.type="sine";mod.frequency.setValueAtTime(660,t);
    mGain.gain.setValueAtTime(380,t);mGain.gain.exponentialRampToValueAtTime(18,t+0.18);
    g.gain.setValueAtTime(0.001,t);g.gain.linearRampToValueAtTime(0.048,t+0.006);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
    mod.connect(mGain);mGain.connect(car.frequency);car.connect(g);g.connect(ctx.destination);
    mod.start(t);car.start(t);mod.stop(t+0.24);car.stop(t+0.24);
    return;
  }
  playUiTick("node");
}
/* Konami Code (↑↑↓↓←→←→BA) unlocks Tron Synth Mode */
const KONAMI_SEQ=["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
let konamiPos=0;
let konamiUnlocked=!!store.get("pm-konami",0);
document.addEventListener("keydown",ev=>{
  if(ev.target&&ev.target.closest&&ev.target.closest("input,textarea,select"))return;
  const k=String(ev.key||"").toLowerCase();
  if(k===KONAMI_SEQ[konamiPos]){
    konamiPos++;
    if(konamiPos===KONAMI_SEQ.length){
      konamiPos=0;
      konamiUnlocked=true;store.set("pm-konami",1);
      haptic([18,30,18,30,35]);
      if(SYNTH.sfx){
        const ctx=ensureAudio();
        if(ctx)[523.25,659.25,783.99,1046.5,1318.51].forEach((f,idx)=>{
          const o=ctx.createOscillator(),g=ctx.createGain(),st=ctx.currentTime+idx*0.055;
          o.type="square";o.frequency.value=f;
          g.gain.setValueAtTime(0.001,st);g.gain.linearRampToValueAtTime(0.032,st+0.01);g.gain.exponentialRampToValueAtTime(0.0001,st+0.14);
          o.connect(g);g.connect(ctx.destination);o.start(st);o.stop(st+0.15);
        });
      }
      if(!SYNTH.on)toggleSynth();
      updateGearMenu();
      toast("⚡ ↑↑↓↓←→←→BA · Tron Synth Grid unlocked!",{ms:4500});
    }
  }else{
    konamiPos=(k===KONAMI_SEQ[0])?1:0;
  }
});
function toggleSynth(){
  if(SYNTH.on){SYNTH.on=false;clearInterval(SYNTH.timer);SYNTH.timer=null;updateAudioBtns();toast("Synth music paused");return}
  const ctx=ensureAudio();if(!ctx){toast("Audio isn't available in this browser");return}
  SYNTH.on=true;SYNTH.step=0;
  /* Driving 125-BPM D-minor Tron / Derezzed-inspired 16th-note grid arpeggio + octave bass + kick pulse */
  const bars=[
    {bass:73.42,arp:[293.66,349.23,440,587.33,440,349.23,523.25,440,293.66,440,349.23,587.33,659.25,587.33,440,349.23],lead:587.33},
    {bass:58.27,arp:[233.08,293.66,349.23,466.16,349.23,293.66,523.25,466.16,233.08,349.23,293.66,466.16,587.33,466.16,349.23,293.66],lead:523.25},
    {bass:87.31,arp:[349.23,440,523.25,698.46,523.25,440,659.25,523.25,349.23,523.25,440,698.46,783.99,698.46,523.25,440],lead:698.46},
    {bass:65.41,arp:[261.63,329.63,392,523.25,392,329.63,587.33,523.25,261.63,392,329.63,523.25,659.25,587.33,523.25,392],lead:659.25}
  ];
  const tick=()=>{
    if(!SYNTH.on)return;
    const s=SYNTH.step,bar=bars[Math.floor(s/16)%bars.length],i=s%16,t=ctx.currentTime;
    /* 16th-note gated sawtooth arpeggio with dynamic filter sweep */
    const o=ctx.createOscillator(),flt=ctx.createBiquadFilter(),g=ctx.createGain();
    o.type="sawtooth";o.frequency.setValueAtTime(bar.arp[i],t);
    flt.type="lowpass";flt.Q.value=4.2;
    const cutoff=1100+Math.sin(s*0.18)*650+(i%4===0?420:0);
    flt.frequency.setValueAtTime(cutoff,t);flt.frequency.exponentialRampToValueAtTime(380,t+0.11);
    g.gain.setValueAtTime(0.0008,t);g.gain.linearRampToValueAtTime(i%4===0?0.032:0.022,t+0.008);g.gain.exponentialRampToValueAtTime(0.0006,t+0.115);
    o.connect(flt);flt.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+0.12);
    /* Driving 8th-note octave bassline */
    if(i%2===0){
      const b=ctx.createOscillator(),bf=ctx.createBiquadFilter(),bg=ctx.createGain();
      b.type="sawtooth";b.frequency.setValueAtTime(i%4===2?bar.bass*2:bar.bass,t);
      bf.type="lowpass";bf.frequency.setValueAtTime(520,t);bf.frequency.exponentialRampToValueAtTime(140,t+0.19);
      bg.gain.setValueAtTime(0.001,t);bg.gain.linearRampToValueAtTime(0.042,t+0.01);bg.gain.exponentialRampToValueAtTime(0.0008,t+0.20);
      b.connect(bf);bf.connect(bg);bg.connect(ctx.destination);b.start(t);b.stop(t+0.21);
    }
    /* Four-on-the-floor electronic kick pulse */
    if(i%4===0){
      const k=ctx.createOscillator(),kg=ctx.createGain();
      k.type="sine";k.frequency.setValueAtTime(135,t);k.frequency.exponentialRampToValueAtTime(42,t+0.09);
      kg.gain.setValueAtTime(0.065,t);kg.gain.exponentialRampToValueAtTime(0.0008,t+0.11);
      k.connect(kg);kg.connect(ctx.destination);k.start(t);k.stop(t+0.12);
    }
    /* Soaring Tron brass-lead accent on bar change (plus unlocked Konami Tron Grid octave shimmer) */
    if(i===0||i===10){
      const ld=ctx.createOscillator(),lf=ctx.createBiquadFilter(),lg=ctx.createGain();
      ld.type=konamiUnlocked?"sawtooth":"triangle";ld.frequency.setValueAtTime(i===0?bar.lead:bar.lead*0.75,t);
      lf.type="lowpass";lf.frequency.setValueAtTime(konamiUnlocked?2600:1800,t);
      lg.gain.setValueAtTime(0.0008,t);lg.gain.linearRampToValueAtTime(konamiUnlocked?0.028:0.024,t+0.04);lg.gain.exponentialRampToValueAtTime(0.0006,t+0.55);
      ld.connect(lf);lf.connect(lg);lg.connect(ctx.destination);ld.start(t);ld.stop(t+0.58);
      if(konamiUnlocked&&i===0){
        const sh=ctx.createOscillator(),sg=ctx.createGain();
        sh.type="square";sh.frequency.setValueAtTime(bar.lead*2,t);
        sg.gain.setValueAtTime(0.0006,t);sg.gain.linearRampToValueAtTime(0.012,t+0.02);sg.gain.exponentialRampToValueAtTime(0.0004,t+0.34);
        sh.connect(sg);sg.connect(ctx.destination);sh.start(t);sh.stop(t+0.36);
      }
    }
    SYNTH.step++;
  };
  tick();SYNTH.timer=setInterval(tick,120);updateAudioBtns();toast(konamiUnlocked?"⚡ Tron Synth Grid playing — toggle in settings anytime":"Synth music on — toggle in settings anytime to pause");
}
function updateGearMenu(){
  const sb=$("#sfxBtn");if(sb){sb.classList.toggle("on",SYNTH.sfx);const sm=sb.querySelector("small");if(sm)sm.textContent=SYNTH.sfx?"On":"Off";sb.setAttribute("aria-pressed",SYNTH.sfx)}
  const b=$("#synthBtn");if(b){b.classList.toggle("on",SYNTH.on);const sp=b.querySelector("span"),sm=b.querySelector("small");if(sp)sp.textContent=konamiUnlocked?"⚡ Tron Synth":"Synth music";if(sm)sm.textContent=SYNTH.on?"Playing":konamiUnlocked?"Unlocked":"Off";b.setAttribute("aria-pressed",SYNTH.on);document.body.classList.toggle("synth-on",SYNTH.on);document.body.classList.toggle("tron-grid",!!(SYNTH.on&&konamiUnlocked))}
  const tb=$("#themeBtn");if(tb){const dt=document.documentElement.dataset.theme;const sm=tb.querySelector("small");if(sm)sm.textContent=dt==="dark"?"Dark":dt==="light"?"Light":"Auto"}
  const ab=$("#artBtn");if(ab){const era=document.documentElement.dataset.art==="era";const sm=ab.querySelector("small");if(sm)sm.textContent=era?"Era spines":"Box art"}
  const dm=$("#devModeMenuBtn");if(dm){const on=typeof isDevMode==="function"&&isDevMode();dm.classList.toggle("on",on);const sp=dm.querySelector("span"),sm=dm.querySelector("small");if(sp)sp.textContent=on?"🛠 Maker mode":"Work in games?";if(sm)sm.textContent=on?"On":"Off"}
}
const updateAudioBtns=updateGearMenu,updateSynthBtn=updateGearMenu,updateArtBtn=updateGearMenu;

/* ---------- curated mood, vibe & memory packs (casual timeline browsing) ---------- */
const MEMORY_PACKS=[
  {k:"mods",title:"Legendary & Cult Mods",sub:"Dorm-room hacks & LAN obsessions — Counter-Strike, DayZ, Team Fortress, PUBG, Vampire Slayer ('Vampire Hunters'), Desert Combat, Natural Selection, TTT & DotA.",ids:["counter-strike","dayz","team-fortress","team-fortress-classic","team-fortress-2","pubg","vampire-slayer","action-quake-2","threewave-ctf","desert-combat","natural-selection","the-specialists","science-and-industry","sven-co-op","they-hunger","cry-of-fear","the-hidden-source","garrys-mod","trouble-in-terrorist-town","prop-hunt","defense-of-the-ancients","dota-auto-chess","dayz-battle-royale","project-reality","the-stanley-parable","black-mesa","long-war","the-forgotten-city"]},
  {k:"coop",title:"Couch Co-op & Split-Screen",sub:"Shoulder-to-shoulder chaos, screen-peeking, and controller-passing.",ids:["goldeneye-007","super-mario-kart","mario-kart-64","worms","street-fighter-ii","super-smash-bros-melee","halo-combat-evolved","silkworm","speedball-2","micro-machines","bomberman","nba-jam","teenage-mutant-ninja-turtles-turtles-in-time","diablo-iii","left-4-dead-2","overcooked","it-takes-two","rocket-league","guitar-hero","wii-sports"]},
  {k:"floppy",title:"Older Sibling's Floppy Box",sub:"80s & early-90s Amiga, C64, and DOS disks passed down at home.",ids:["defender-of-the-crown","the-secret-of-monkey-island","lemmings","pinball-dreams","pinball-fantasies","speedball-2","ports-of-call","moonstone-a-hard-days-knight","wings-1990","another-world","prince-of-persia","sensible-soccer","cannon-fodder","dune-ii","the-settlers","turrican-ii","shadow-of-the-beast","pirates","california-games","benefactor"]},
  {k:"arcade",title:"Quarter-Munchers at the Arcade",sub:"Sticky joysticks, loud attract modes, and pocketfuls of coins.",ids:["pac-man","donkey-kong","space-invaders","galaga","out-run","bubble-bobble","double-dragon","r-type","golden-axe","final-fight","street-fighter-ii","mortal-kombat","metal-slug","daytona-usa","time-crisis","virtua-fighter-2","crazy-taxi","dance-dance-revolution","nba-jam","gauntlet"]},
  {k:"2am",title:"“Just One More Turn” (2 A.M.)",sub:"Strategy, city-builders, and sims that made whole weekends vanish.",ids:["civilization","civilization-ii","civilization-iv","simcity-2000","rollercoaster-tycoon","age-of-empires-ii","heroes-of-might-and-magic-iii","warcraft-ii","starcraft","command-and-conquer-red-alert","championship-manager","the-sims","ufo-enemy-unknown","theme-hospital","factorio","crusader-kings-iii","stellaris","anno-1800","rimworld","cities-skylines"]},
  {k:"school",title:"School Lab & Windows 95",sub:"Sneaking games between classes or on the family desktop PC.",ids:["the-oregon-trail","minesweeper","microsoft-solitaire","3d-pinball-for-windows-space-cadet","where-in-the-world-is-carmen-sandiego","simcity","commander-keen","jazz-jackrabbit","wolfenstein-3d","doom","worms-armageddon","quake","age-of-empires","myst","theme-park","the-incredible-machine","prince-of-persia","lemmings"]},
  {k:"stories",title:"Stories That Stayed With You",sub:"Characters, twists, and endings you still think about years later.",ids:["chrono-trigger","final-fantasy-vi","final-fantasy-vii","the-legend-of-zelda-ocarina-of-time","metal-gear-solid","grim-fandango","planescape-torment","silent-hill-2","shadow-of-the-colossus","star-wars-knights-of-the-old-republic","bioshock","portal-2","mass-effect-2","the-last-of-us","the-witcher-3-wild-hunt","red-dead-redemption-2","disco-elysium","outer-wilds","baldurs-gate-3","clair-obscur-expedition-33"]},
  {k:"flow",title:"Pure Flow, Speed & High Scores",sub:"Muscle memory, rhythm, and chasing one cleaner run.",ids:["tetris","super-mario-bros-3","super-mario-world","sonic-the-hedgehog-2","tony-hawks-pro-skater-2","wipeout-2097","ssx-tricky","burnout-3-takedown","mirrors-edge","geometry-wars-retro-evolved","super-meat-boy","hotline-miami","threes","celeste","hades","vampire-survivors","balatro","sekiro-shadows-die-twice"]},
  {k:"indie",title:"Indie Gems Beyond the Blockbusters",sub:"Small teams and solo creators punching way above blockbuster budgets.",ids:["cave-story","braid","limbo","fez","FTL: Faster Than Light","papers-please","shovel-knight","undertale","stardew-valley","inside","hollow-knight","return-of-the-obra-dinn","outer-wilds","slay-the-spire","baba-is-you","tunic","dredge","dave-the-diver","animal-well","balatro","blue-prince","inscryption","signalis"]},
  {k:"scares",title:"Lights-Off Tension & Survival",sub:"Creaking doors, scarce ammo, and playing with the lamp on.",ids:["alone-in-the-dark","resident-evil","resident-evil-2","resident-evil-4","silent-hill","silent-hill-2","system-shock-2","half-life","dead-space","left-4-dead","amnesia-the-dark-descent","alien-isolation","pt","subnautica","alan-wake-2","lethal-company"]},
  {k:"sandbox",title:"Open Worlds & Player Chaos",sub:"Sandboxes where making your own fun beat following the rules.",ids:["elite","hunter","grand-theft-auto","grand-theft-auto-iii","grand-theft-auto-san-andreas","grand-theft-auto-v","battlefield-1942","the-elder-scrolls-iii-morrowind","the-elder-scrolls-v-skyrim","garrys-mod","minecraft","terraria","kerbal-space-program","the-legend-of-zelda-breath-of-the-wild","elden-ring","valheim","no-mans-sky"]},
  {k:"dendy",title:"Dendy & 9999-in-1 Cartridges",sub:"Yellow market multicarts, Battle City ('Tanki'), Darkwing Duck, Chip 'n Dale & 90s 8-bit couch co-op.",ids:["battle-city","super-mario-bros","contra","super-contra","duck-hunt","chip-n-dale-rescue-rangers","ducktales","darkwing-duck","felix-the-cat","tiny-toon-adventures","teenage-mutant-ninja-turtles-iii-the-manhattan-project","battletoads","battletoads-and-double-dragon","adventure-island","circus-charlie","lode-runner","bomberman","ice-climber","galaxian","road-fighter","antarctic-adventure","nuts-and-milk","double-dragon-ii-the-revenge","prince-of-persia"]},
  {k:"vault",title:"Sunsetted Worlds & Cult Deep Cuts",sub:"Servers gone dark, buried Atari carts, 40-button mech desks & obscure regional hardware.",ids:["et-the-extra-terrestrial","mine-storm","castlevania-chronicles","link-the-faces-of-evil","virtual-boy-wario-land","bs-the-legend-of-zelda","star-fox-2","lsd-dream-emulator","wu-tang-shaolin-style","steel-battalion","star-wars-galaxies","city-of-heroes","pathway-to-glory","sticky-balls","the-matrix-online","club-penguin","chromehounds","1-vs-100","mag","glitch","wildstar","pt","battleborn","echo-vr","knockout-city"]},
  {k:"sweat",title:"Brutal Games That Made Us Sweat",sub:"Infamous jumps, palms-sweating bosses, and controller-gripping tests of willpower.",ids:["ghosts-n-goblins","battletoads","ninja-gaiden","contra","rick-dangerous","shadow-of-the-beast","the-lion-king","f-zero-gx","devil-may-cry-3-dantes-awakening","super-meat-boy","dark-souls","spelunky","darkest-dungeon","cuphead","getting-over-it-with-bennett-foddy","celeste","sekiro-shadows-die-twice","returnal","elden-ring"]},
  {k:"harbor",title:"Worlds That Carried Us Through",sub:"Safe harbors, warm towns, and grand adventures that helped us weather rough seasons.",ids:["the-secret-of-monkey-island","chrono-trigger","final-fantasy-vii","the-legend-of-zelda-ocarina-of-time","pokemon-red-and-blue","simcity-2000","shenmue","animal-crossing","kingdom-hearts","world-of-warcraft","the-elder-scrolls-v-skyrim","minecraft","journey","undertale","stardew-valley","celeste","outer-wilds","animal-crossing-new-horizons"]}
];
function packGames(pk){const seen=new Set(),out=[];(pk.ids||[]).forEach(x=>{const g=gameRef(x);if(g&&!seen.has(g.i)){seen.add(g.i);out.push(g)}});return out}

/* ---------- pixel glyphs for covers (8×8, one per genre family) ---------- */
const GLYPH_ART={
 pawn:["...##...","..####..","...##...","..####..","...##...","..####..",".######.","########"],
 stick:["...##...","...##...","....#...","....#...","..####..",".######.","########","########"],
 ship:["...##...","...##...","..####..","..####..",".######.","########","##.##.##","#..##..#"],
 jump:["...##...","...##...","..####..",".#.##.#.","...##...","..#..#..","########","#.##.##."],
 rooms:["####.###","#..#.#.#","#..###.#","#......#","##.#####",".#.#....",".###....","........"],
 shield:["########","###..###","###..###","#......#",".##..##.",".##..##.","..#..#..","...##..."],
 globe:["..####..",".#..#.#.","#...#..#","########","#...#..#","#...#..#",".#..#.#.","..####.."],
 target:["..####..",".#....#.","#..##..#","#.####.#","#.####.#","#..##..#",".#....#.","..####.."],
 chute:[".######.","########","#.#..#.#",".#....#.","..#..#..","...##...","...##...","..#..#.."],
 eye:["........","...##...",".##..##.","#..##..#","#..##..#",".##..##.","...##...","........"],
 skull:[".######.","########","#..##..#","#..##..#","########",".##..##.","..####..","..#..#.."],
 sword:["......##",".....###","....###.","#..###..",".####...","..##....",".#.##...","#...#..."],
 gem:["...##...","..#.##..",".#.####.","#.######",".######.","..####..","...##...","........"],
 dice:["########","#......#","#.##...#","#.##...#","#...##.#","#...##.#","#......#","########"],
 people:[".##...##",".##...##","........","####.###","####.###","####.###",".##...##",".##...##"],
 castle:["#.#..#.#","########",".######.",".######.",".######.",".##..##.",".##..##.","########"],
 swords:["#......#",".#....#.","..#..#..","...##...","...##...","..#..#..",".##..##.","##....##"],
 house:["...##...","..####..",".######.","########",".#....#.",".#.##.#.",".#.##.#.",".######."],
 tree:["...##...","..####..",".######.","########",".######.","...##...","...##...","..####.."],
 key:[".###....","#...#...","#...#...",".###....","..#.....","..###...","..#.....","..##...."],
 blocks:["##......","##......","........","##.##...","##.##...","........","##.##.##","##.##.##"],
 bolt:["....###.","...###..","..###...",".######.","...###..","..###...",".###....",".#......"],
 flag:["#.#.#.#.",".#.#.#.#","#.#.#.#.",".#.#.#.#","#.......","#.......","#.......","#......."],
 ball:["..####..",".##..##.","##.##.##","#.####.#","#.####.#","##.##.##",".##..##.","..####.."],
 note:["...##...","...###..","...#.##.","...#..#.","...#....",".###....","####....",".##....."],
 card:[".######.",".#....#.",".#.##.#.",".######.",".######.",".#.##.#.",".#....#.",".######."],
 rocket:["...##...","..####..","..#..#..","..####..","..####..",".######.","##.##.##","...##..."]};
const GENRE_GLYPH={roots:"pawn",arcade:"stick",shmup:"ship",platformer:"jump",metroidvania:"rooms","action-adventure":"shield","open-world":"globe",fps:"target",shooter:"target","battle-royale":"chute","immersive-sim":"eye",horror:"skull",rpg:"sword",jrpg:"gem",arpg:"sword",roguelike:"dice",mmo:"people",strategy:"castle",moba:"swords",sim:"house",survival:"tree",adventure:"key",puzzle:"blocks",fighting:"bolt","beat-em-up":"bolt",racing:"flag",sports:"ball",party:"note",card:"card",space:"rocket"};
const GLYPH_IMG={};
(function makeGlyphs(){let css="";
  for(const [k,rows] of Object.entries(GLYPH_ART)){const c=document.createElement("canvas");c.width=8;c.height=8;const x=c.getContext("2d");x.fillStyle="#fff";
    rows.forEach((r,y)=>[...r].forEach((ch,xx)=>{if(ch==="#")x.fillRect(xx,y,1,1)}));
    GLYPH_IMG[k]=c;css+=`.gl-${k}{--gl:url(${c.toDataURL()})}`}
  const s=document.createElement("style");s.textContent=css;document.head.appendChild(s)})();
const glyphOf=g=>{const gen=genreOf(g);return GENRE_GLYPH[gen?gen.k:"arcade"]||"stick"};
const eraOf=y=>y<1977?0:y<1984?1:y<1990?2:y<1996?3:y<2002?4:y<2013?5:6;

/* a generated box: the era sets the packaging style, the genre sets the pixel glyph; real box art fades in over it when available */
function coverHTML(title,year,h,glyph,{tag="div",attrs="",cls="",showYear=true,img="",eager=false,hiPri=false}={}){
  const ph=h%2?120:38,lw=Math.max(...String(title).split(/[\s\-–:]+/).map(w=>w.length)),k=lw>7?Math.max(.55,7.4/lw).toFixed(2):1;
  const isWiki=img&&(img.startsWith("https://upload.wikimedia.org/")||img.startsWith("https://thumb.wikimedia.org/"));
  const cors=isWiki?' crossorigin="anonymous" referrerpolicy="no-referrer"':"";
  const loadAttr=eager?(hiPri?' fetchpriority="high"':""):' loading="lazy"';
  const im=img?`<img class="cimg" src="${esc(img)}" alt=""${loadAttr} decoding="async"${cors} onload="_covFit(this)" onerror="_covErr(this)">`:"";
  return `<${tag} class="cv e${eraOf(year||2000)} gl-${glyph} ${cls}" style="--h:${h};--ph:${ph};--k:${k}" ${attrs}>${im}<span class="ct">${esc(title)}</span><i class="gl" aria-hidden="true"></i>${showYear&&year?`<span class="cy">${year}</span>`:""}</${tag}>`}
const cover=(g,o={})=>coverHTML(g.title,g.year,g.h,glyphOf(g),{img:g.img,...o});
const coverOfEntry=(e,y,o={})=>{const g=findGameY(e.t,e.y||y);return g?cover(g,o):coverHTML(e.t,y,hueOf(norm(e.t)),"stick",o)};

/* ---------- search ---------- */
function searchGames(q,{limit=8,treeOnly=false,catFirst=false,playOnly=false}={}){
  const v=norm(q),vr=normR(q);if(!v)return [];
  const words=fold(q).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const out=[];
  for(const g of G){
    if(treeOnly&&!g.tree)continue;
    if(playOnly&&!playable(g))continue;
    let s=-1;
    if(g.n===v||g.nr===vr)s=120;
    else if(g.n.startsWith(v)||g.nr.startsWith(vr))s=88;
    else if(g.aka&&(norm(g.aka).includes(v)||g.aka.split(" ").some(a=>a===q.trim().toLowerCase()||norm(a)===v)))s=112;
    else if(g.n.includes(v)||g.nr.includes(vr))s=60;
    else if(words.length>1){const tw=fold(g.title).toLowerCase().split(/[^a-z0-9]+/);if(words.every(w=>tw.some(t=>t.startsWith(w)||(ROMAN[t]&&String(ROMAN[t])===w))))s=55}
    if(s<0)continue;
    s+=g.pop*4+Math.min(g.inf,400)/50+(g.tree?6:0)+(catFirst&&g.cat?4:0);
    out.push([s,g]);
  }
  return out.sort((a,b)=>b[0]-a[0]).slice(0,limit).map(x=>x[1]);
}
function clampSearchBox(box){
  if(!box||box.hidden)return;
  const vv=window.visualViewport;
  const availH=vv?vv.height:window.innerHeight;
  const topOff=vv?vv.offsetTop:0;
  const rect=box.getBoundingClientRect();
  const space=Math.max(150,Math.floor(availH+topOff-rect.top-14));
  box.style.maxHeight=Math.min(420,space)+"px";
}
if(window.visualViewport){
  const syncVV=()=>$$(".results:not([hidden])").forEach(clampSearchBox);
  window.visualViewport.addEventListener("resize",syncVV);
  window.visualViewport.addEventListener("scroll",syncVV);
}
/* attach a type-ahead to an input; onPick(game | {custom:title}) */
const SEARCH_EGGS={
  iddqd:{id:"doom",title:"IDDQD · Degreelessness Mode On",sub:"100% Health (Doom, 1993) — jump straight to Doom's family tree",chip:"ym2612",toast:"IDDQD · Degreelessness Mode On (100% Health)"},
  rosebud:{id:"the-sims",title:"ROSEBUD · +§1,000 Simoleons",sub:";!;!;! (The Sims, 2000) — jump straight to The Sims's family tree",chip:"ps1",toast:"ROSEBUD · +§1,000 Simoleons added to household funds"}
};
function wireSearch(input,box,onPick,opts={}){
  if(!input||!box)return;
  let items=[],on=0;
  const draw=()=>{const v=input.value.trim();if(!v){box.hidden=true;return}
    const egg=SEARCH_EGGS[v.toLowerCase()];
    const eggGame=egg?byId.get(egg.id):null;
    items=searchGames(v,opts);on=0;
    const eggHTML=egg&&eggGame?`<button type="button" class="res egg on" data-egg="${esc(v.toLowerCase())}">${cover(eggGame,{showYear:false})}<span><b>${esc(egg.title)}</b><small>${esc(egg.sub)}</small></span><span class="y">▸</span></button>`:"";
    box.innerHTML=eggHTML+items.map((g,i)=>{
      const mainBtn=`<button type="button" class="res${!eggHTML&&i===0?" on":""}" data-i="${i}">${cover(g,{showYear:false})}<span><b>${esc(g.title)}</b><small>${flag(g.cc)} ${esc(studio(g)||"")}${g.tree?` · <span class="tag">in the family tree</span>`:""}</small></span><span class="y">${g.year}</span></button>`;
      if(opts.quickPick&&playable(g)){
        const lv=levelOf(hist,g);
        return `<div class="resrow">${mainBtn}<button type="button" class="respick${lv?" lv"+lv:""}" data-qpick="${i}" aria-label="${lv?`${LV[lv].label}: ${esc(g.title)} — tap to cycle`:`Add ${esc(g.title)} to my timeline`}">${lv?LV[lv].m:"+ Pick"}</button></div>`;
      }
      return mainBtn;
    }).join("")
      +(opts.custom&&!eggHTML&&!items.some(g=>g.n===norm(v))?`<button type="button" class="res" data-custom="1"><span></span><span><b>Add “${esc(v)}”</b><small>As your own entry</small></span><span class="y">+</span></button>`:"")
      +(!items.length&&!eggHTML&&!opts.custom?`<p class="empty" style="padding:8px 10px 4px">No match yet (${G.length.toLocaleString()} games so far).</p>`:"")
      +(items.length<4&&!eggHTML?`<button type="button" class="res" data-req="1"><span class="mono" style="font-size:16px;text-align:center">+</span><span><b>Request “${esc(v)}” for the catalog</b><small>Missing game or console? Let us know</small></span><span class="y">▸</span></button>`:"");
    box.hidden=false;clampSearchBox(box)};
  input.addEventListener("input",draw);
  input.addEventListener("focus",()=>{if(input.value.trim())draw()});
  input.addEventListener("keydown",e=>{
    const bs=$$(".res",box);
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!bs.length)return;on=(on+(e.key==="ArrowDown"?1:-1)+bs.length)%bs.length;bs.forEach((b,i)=>b.classList.toggle("on",i===on));bs[on].scrollIntoView({block:"nearest"})}
    else if(e.key==="Enter"){e.preventDefault();if(box.hidden||!input.value.trim())return;const b=bs[on]||bs[0];if(b)b.click()}
    else if(e.key==="Escape"){box.hidden=true}});
  box.addEventListener("click",e=>{
    const qp=e.target.closest("[data-qpick]");
    if(qp&&opts.onQuickPick){
      const g=items[+qp.dataset.qpick];if(!g)return;
      opts.onQuickPick(g,qp);return;
    }
    const b=e.target.closest(".res");if(!b)return;
    const rawQ=input.value.trim();input.value="";box.hidden=true;
    if(b.dataset.egg){
      const egg=SEARCH_EGGS[b.dataset.egg],eg=egg&&byId.get(egg.id);
      if(egg){playChipFoley(egg.chip);haptic([12,24,12]);toast(egg.toast)}
      if(eg)onPick(eg);
      return;
    }
    if(b.dataset.req){openFeatureSheet({cat:"Missing Game / Classic",title:rawQ});return}
    const pick=b.dataset.custom?{custom:rawQ}:items[+b.dataset.i];onPick(pick)});
}
/* one listener for every search box: a click outside closes its results */
document.addEventListener("click",e=>{$$(".results").forEach(b=>{if(!b.hidden&&b.parentElement&&!b.parentElement.contains(e.target))b.hidden=true})});

/* ---------- graph: roots, family tree, connections ---------- */
/* the main line back in time: strongest evidence, staying within the genre family where possible,
   so a minor borrowing (a space-combat scene in an RPG) doesn't hijack an RPG's lineage */
const ROOT_W={dev:3,team:2.5,critic:2,mech:1.4,series:.9,disp:0};
/* fold runs of 3+ sequels into one step: keep the newest and oldest of the run */
function compressChain(chain){const out=[];let i=0;
  while(i<chain.length){let r=0;while(i+r<chain.length-1&&chain[i+r].link&&chain[i+r].link.tier==="series")r++;
    if(r>=3){out.push({g:chain[i].g,link:null,collapsed:{n:r-1,to:chain[i+r].g,via:chain.slice(i+1,i+r).map(s=>s.g)}});i+=r}
    else{out.push(chain[i]);i++}}
  return out}
const famOf=g=>new Set(g.gen.map(gi=>laneOfGenre[GEN[gi].k]));
/* step by step: use build-time precomputed RAW.rl when all non-disputed tiers are active, else compute live */
function rootsChain(i){
  const pre=RAW.rl;
  if(Array.isArray(pre)&&state.tiers.dev&&state.tiers.team&&state.tiers.series&&state.tiers.critic&&state.tiers.mech){
    const steps=[];let v=i;const seen=new Set();
    while(steps.length<70&&!seen.has(v)){
      seen.add(v);
      const li=pre[v];
      const lk=(li!=null&&li>=0&&L[li]&&!seen.has(L[li].from))?L[li]:null;
      steps.push({g:G[v],link:lk});
      if(!lk)break;
      v=lk.from;
    }
    return steps;
  }
  const fam=new Map(),minY=new Map(),visiting=new Set();
  const F=v=>{if(!fam.has(v))fam.set(v,famOf(G[v]));return fam.get(v)};
  const ok=l=>tierOn(l)&&l.tier!=="disp"&&!l.minor;
  const reach=v=>{if(minY.has(v))return minY.get(v);if(visiting.has(v))return G[v].year;visiting.add(v);let m=G[v].year;
    for(const l of UP[v])if(ok(l))m=Math.min(m,reach(l.from));visiting.delete(v);minY.set(v,m);return m};
  const steps=[];let v=i;const seen=new Set();
  while(steps.length<70&&!seen.has(v)){
    seen.add(v);const fv=F(v),gv=G[v],sv=studio(gv).toLowerCase();let best=null,bs=-1e9;
    for(const l of UP[v]){if(!ok(l)||seen.has(l.from))continue;const p=G[l.from],fp=F(l.from);
      const aff=(p.gen.length===0||[...fp].some(x=>fv.has(x)))?1:fp.has(0)?.7:.25;
      const prim=p.gen.length&&gv.gen.length?(p.gen[0]===gv.gen[0]?.6:(gv.gen.includes(p.gen[0])||p.gen.includes(gv.gen[0]))?.25:0):0;
      const same=sv&&studio(p).toLowerCase()===sv?.5:0;
      const s=ROOT_W[l.tier]*aff+0.25*Math.min(6,(gv.year-reach(l.from))/10)+prim+same+0.05*p.pop;
      if(s>bs){bs=s;best=l}}
    steps.push({g:G[v],link:best});if(!best)break;v=best.from;
  }
  return steps; // newest first; each step's link points to the next (older) step
}
function ancestors(i){const seen=new Set([i]),st=[i];while(st.length){const v=st.pop();for(const l of UP[v])if(!seen.has(l.from)){seen.add(l.from);st.push(l.from)}}seen.delete(i);return seen}
/* parents and grandparents only: the influences you'd actually feel in a game */
function nearAncestors(i){const out=new Set();for(const l of UP[i]){out.add(l.from);for(const l2 of UP[l.from])out.add(l2.from)}out.delete(i);return out}
function connectPath(a,b){
  if(a===b)return [];const prev=new Map([[a,null]]),q=[a];let h=0;
  while(h<q.length){const v=q[h++];if(v===b)break;
    const ls=[...UP[v],...DOWN[v]].sort((x,y)=>TIERS[y.t].w-TIERS[x.t].w);
    for(const l of ls){const w=l.from===v?l.to:l.from;if(!prev.has(w)){prev.set(w,{v,l});q.push(w)}}}
  if(!prev.has(b))return null;const path=[];let x=b;while(x!==a){const p=prev.get(x);path.unshift({a:p.v,b:x,l:p.l});x=p.v}return path;
}

/* ================================================================
   My timeline: storage, O(1) index, levels, memories, share links
   ================================================================ */
const LV={1:{m:"✓",label:"Played"},2:{m:"★",label:"Played a ton"},3:{m:"♥",label:"Favorite"}};
const MEM_TAGS=["Couch co-op","With siblings","With friends","LAN party","After school","Summer break","Late nights","Arcade","Hand-me-down","Carried me through","Safe harbor","Shaped who I am","Pure art","Made me sweat"];
const UI_MEM_TAGS=MEM_TAGS.filter(t=>t!=="Safe harbor");
const HARBOR_TAGS=new Set(["Carried me through","Safe harbor","Shaped who I am","Pure art","🛟 Carried me through","🏠 Safe harbor","✨ Shaped who I am","🎨 Pure art"]);
const SWEAT_TAGS=new Set(["Made me sweat","😤 Made me sweat"]);
const SWEAT_TAG="Made me sweat";
const DEV_ROLES=["Design","Engineering","Art & Animation","Audio & Music","Narrative","Production","QA","Publishing & Ops","Live Ops","Tech Art"];
/* Backward-compatible single-char role code: 0-7 = original roles, 8 = worked/no role, 9 = not worked, a = Live Ops, b = Tech Art */
const ROLE_TO_CH={"Design":"0","Engineering":"1","Art & Animation":"2","Audio & Music":"3","Narrative":"4","Production":"5","QA":"6","Publishing & Ops":"7","Live Ops":"a","Tech Art":"b"};
const CH_TO_ROLE=Object.fromEntries(Object.entries(ROLE_TO_CH).map(([k,v])=>[v,k]));
const roleChar=r=>(r&&ROLE_TO_CH[r])||"8";
const isWorkedChar=ch=>ch&&ch!=="9"&&(ch==="8"||!!CH_TO_ROLE[ch]);
const WK_TYPES=[["","Shipped / Studio"],["mod","Mod / Map"],["unshipped","Unshipped / Cancelled"]];
const wkTypeLabel=t=>t==="mod"?"Mod / Map":t==="unshipped"?"Unshipped":"";
const workedYearOf=x=>(x&&x.e&&Number.isInteger(x.e.wy)&&x.e.wy>=1950&&x.e.wy<=NOW)?x.e.wy:x.y;
const lvOf=e=>{const v=(e&&e.lv)|0;return v>=1&&v<=3?v:1};
function blankHist(){return {birth:null,era:"",name:"",owned:[],years:{},workedStudios:[],top10:[],favOrder:[],sysDef:{},updated:0,stage:null}}
/* everything that arrives from someone else (a share link, another viewer's saved doc) goes through here */
function cleanTimeline(raw){
  const d=blankHist();if(!raw||typeof raw!=="object")return d;
  const by=parseInt(raw.birth,10);d.birth=by>=1900&&by<=NOW?by:null;
  d.era=typeof raw.era==="string"&&/^\d0s$/.test(raw.era)?raw.era:"";
  d.name=typeof raw.name==="string"?raw.name.slice(0,24):"";
  const strs=(a,n,m)=>Array.isArray(a)?a.filter(s=>typeof s==="string").slice(0,n).map(s=>s.slice(0,m)):[];
  d.owned=strs(raw.owned,60,40);d.top10=strs(raw.top10,10,120);
  d.workedStudios=strs(raw.workedStudios,30,60).filter(id=>STUDIOS.has(id));
  const ys=raw.years&&typeof raw.years==="object"?raw.years:{};
  for(const [k,arr] of Object.entries(ys)){const y=parseInt(k,10);if(!(y>=1800&&y<=NOW)||String(y)!==String(k).trim()||!Array.isArray(arr))continue;
    const out=[];for(const e of arr.slice(0,400)){if(!e||typeof e.t!=="string"||!e.t.trim())continue;
      const x={t:e.t.slice(0,120),p:typeof e.p==="string"?e.p.slice(0,2):"",y:Number.isInteger(e.y)?e.y:null,lv:lvOf(e)};
      if(Array.isArray(e.systems))x.systems=strs(e.systems,8,40);if(typeof e.sys==="string")x.sys=e.sys.slice(0,40);
      if(typeof e.mem==="string"&&e.mem.trim())x.mem=e.mem.trim().slice(0,90);
      if(Array.isArray(e.mtags)&&e.mtags.length)x.mtags=strs(e.mtags,6,32);
      if(e.wk)x.wk=1;
      if(typeof e.role==="string"&&DEV_ROLES.includes(e.role))x.role=e.role;
      const wy=parseInt(e.wy,10);if(e.wk&&wy>=1950&&wy<=NOW)x.wy=wy;
      if(e.wk&&(e.wkType==="mod"||e.wkType==="unshipped"))x.wkType=e.wkType;
      out.push(x)}
    if(out.length)d.years[y]=out}
  d.updated=Number(raw.updated)||0;return d;
}
let hist=Object.assign(blankHist(),store.get("ib-history")||{});
if(!hist.years)hist.years={};
if(!Array.isArray(hist.workedStudios))hist.workedStudios=[];
if(hist.birth&&hist.onboard===true&&!hist.stage)hist.stage=null; // version 1 flag: treat as finished
delete hist.onboard;
/* O(1) entry lookup index per timeline object, invalidated on every mutation */
const HIST_IDX=new WeakMap();
function invalidateHistIdx(d){if(d&&typeof d==="object")HIST_IDX.delete(d)}
function getHistIdx(d){
  if(!d||typeof d!=="object")return {byN:new Map(),byN1:new Map()};
  let idx=HIST_IDX.get(d);
  if(idx)return idx;
  const byN=new Map(),byN1=new Map();
  for(const [y,p] of Object.entries(d.years||{})){
    const yr=+y;
    for(const e of p){
      const k=norm(e.t),k1=norm1(e.t),rec={e,y:yr};
      if(!byN.has(k))byN.set(k,rec);
      if(!byN1.has(k1))byN1.set(k1,rec);
    }
  }
  idx={byN,byN1};HIST_IDX.set(d,idx);return idx;
}
const pileOf=(d,y)=>(d.years[y]||(d.years[y]=[]));
function entries(d){const out=[];for(const [y,p] of Object.entries(d.years||{}))for(const e of p)out.push({e,y:+y,g:findGameY(e.t,e.y||+y),lv:lvOf(e)});return out}
const workedEntries=d=>entries(d).filter(x=>x.e.wk);
const isWorked=(d,g)=>{const e=d&&g?entryOf(d,g):null;return !!(e&&e.wk)};
const isWorkedStudio=(d,id)=>Array.isArray(d&&d.workedStudios)&&d.workedStudios.includes(id);
function entryRecOf(d,g){if(!d||!g)return null;const idx=getHistIdx(d);return idx.byN.get(g.n)||idx.byN1.get(norm1(g.title))||null}
function entryOf(d,g){const r=entryRecOf(d,g);return r?r.e:null}
function entryYearOf(d,g){const r=entryRecOf(d,g);return r?r.y:null}
const levelOf=(d,g)=>{const e=entryOf(d,g);return e?lvOf(e):0};
const sortPile=p=>p.sort((a,b)=>(!!b.wk-!!a.wk)||lvOf(b)-lvOf(a));
/* default year when picking a game: if it came out before you turned 5, place it in early childhood (age 6) */
function defaultPlayedYear(g){
  if(hist.birth&&g.year<hist.birth+5)return Math.min(NOW,Math.max(g.year,hist.birth+6));
  return g.year;
}
function restoreRemovedEntry(snap){
  if(!snap||!snap.entry)return;
  const p=pileOf(hist,snap.y);
  if(!p.some(x=>norm(x.t)===norm(snap.entry.t)))p.push(snap.entry);
  sortPile(p);save();
  const g=snap.g;
  if(g){$$(`.art[data-id="${CSS.escape(g.id)}"]`).forEach(btn=>refreshTile(btn,g))}
  if(state.route&&(state.route.view==="timeline"||state.route.view==="start")){const y=window.scrollY;render();window.scrollTo({top:y})}
  else updatePickBar();
  toast(`Restored ${snap.entry.t}`);
}
function setLevel(g,lv,forceYear=null){
  const rec=entryRecOf(hist,g);
  if(rec){
    const p=hist.years[rec.y];
    const i=p?p.indexOf(rec.e):-1;
    if(i>=0){
      if(lv<=0&&!p[i].wk){
        const [removed]=p.splice(i,1);
        if(!p.length)delete hist.years[rec.y];
        save();
        return {removed:{y:rec.y,entry:removed,g}};
      }else{
        p[i].lv=Math.max(1,lv);sortPile(p);save();return {removed:null};
      }
    }
  }
  if(lv>0){const py=forceYear||defaultPlayedYear(g);const p=pileOf(hist,py);p.push({t:g.title,p:brandOf(g),y:g.year,lv});sortPile(p);save()}
  return {removed:null};
}
function toggleWorked(g,forceRole,opts={}){
  const shipY=Math.min(NOW,Math.max(1950,(opts&&opts.wy)||g.year||NOW));
  const cur=entryOf(hist,g);
  if(cur){
    if(cur.wk&&forceRole===undefined&&!opts.keep){delete cur.wk;delete cur.role;delete cur.wy;delete cur.wkType;save();return false}
    cur.wk=1;
    if(forceRole!==undefined){if(forceRole&&DEV_ROLES.includes(forceRole))cur.role=forceRole;else delete cur.role}
    if(opts&&opts.wy&&opts.wy>=1950&&opts.wy<=NOW)cur.wy=opts.wy;
    else if(!cur.wy)cur.wy=shipY;
    if(opts&&opts.wkType!==undefined){if(opts.wkType==="mod"||opts.wkType==="unshipped")cur.wkType=opts.wkType;else delete cur.wkType}
    save();
    return true;
  }
  const p=pileOf(hist,shipY);
  const item={t:g.title,p:brandOf(g),y:g.year,lv:1,wk:1,wy:shipY};
  if(forceRole&&DEV_ROLES.includes(forceRole))item.role=forceRole;
  if(opts&&(opts.wkType==="mod"||opts.wkType==="unshipped"))item.wkType=opts.wkType;
  const st=findStudio(studio(g));
  if(st&&!isWorkedStudio(hist,st.id))hist.workedStudios=[...(hist.workedStudios||[]),st.id].slice(0,30);
  p.push(item);sortPile(p);save();return true;
}
function toggleWorkedStudio(id){
  if(!STUDIOS.has(id))return false;
  const cur=new Set(hist.workedStudios||[]);
  const on=!cur.has(id);
  if(on)cur.add(id);else cur.delete(id);
  hist.workedStudios=[...cur].slice(0,30);save();return on;
}
function addWorkedCustom(title,y,role,wkType=""){
  const yr=Math.min(NOW,Math.max(1950,+y||NOW));
  const p=pileOf(hist,yr);
  const ex=p.find(x=>norm(x.t)===norm(title));
  if(ex){ex.wk=1;ex.wy=yr;if(role&&DEV_ROLES.includes(role))ex.role=role;if(wkType==="mod"||wkType==="unshipped")ex.wkType=wkType;sortPile(p);save();return}
  const item={t:title.slice(0,80),p:"",y:null,lv:1,wk:1,wy:yr};
  if(role&&DEV_ROLES.includes(role))item.role=role;
  if(wkType==="mod"||wkType==="unshipped")item.wkType=wkType;
  p.push(item);sortPile(p);save();
}
function moveEntryYear(fromY,title,toY){
  if(fromY===toY||!(toY>=1950&&toY<=NOW))return fromY;
  const p=hist.years[fromY];if(!p)return fromY;
  const i=p.findIndex(x=>norm(x.t)===norm(title));if(i<0)return fromY;
  const [e]=p.splice(i,1);
  if(!p.length)delete hist.years[fromY];
  const dst=pileOf(hist,toY);
  if(!dst.some(x=>norm(x.t)===norm(title)))dst.push(e);
  sortPile(dst);save();return toY;
}
function cycleLevel(g){
  const cur=levelOf(hist,g),nl=cur>=3?0:cur+1;
  const res=setLevel(g,nl);
  haptic(nl===3?[10,22,14]:nl===2?12:nl===1?8:6);
  if(res&&res.removed){
    toast(`Removed ${g.title}`,{ms:6000,undo:()=>restoreRemovedEntry(res.removed)});
  }
  return nl;
}
function addCustom(title,y,lv=1){const p=pileOf(hist,y);if(!p.some(x=>norm(x.t)===norm(title)))p.push({t:title,p:"",y:null,lv});sortPile(p);save()}
function removeEntry(y,t){
  const p=hist.years[y];if(!p)return null;
  const i=p.findIndex(x=>norm(x.t)===norm(t));if(i<0)return null;
  const [removed]=p.splice(i,1);
  if(!p.length)delete hist.years[y];
  save();
  return {y,entry:removed,g:findGameY(removed.t,removed.y||y)};
}
/* systems a game was played on: chosen, else the first of its platforms you said you owned */
function sysListOf(e,d){if(Array.isArray(e.systems))return [...new Set(e.systems.map(canonSys))];if(e.sys)return [canonSys(e.sys)];
  const g=findGame(e.t);if(!g)return [];const ps=sysOfGame(g);const own=(d&&d.owned)||[];const hit=ps.find(p=>own.includes(p));return hit?[hit]:ps.slice(0,1)}

let syncMsg="";
function save(){invalidateHistIdx(hist);hist.updated=Date.now();store.set("ib-history",hist)}
function packHist(h){const years={};for(const [y,p] of Object.entries(h.years||{}))if(p.length)years[y]=p;
  return {v:2,birth:h.birth,era:h.era||"",name:h.name||"",owned:h.owned||[],workedStudios:h.workedStudios||[],years,sysDef:h.sysDef||{},favOrder:h.favOrder||[],top10:h.top10||[],updated:h.updated||Date.now()}}

/* share links carry the whole timeline in the hash: t1-name-birthOrEra-systems-played-alot-favorites-top10-custom(-notesAndMaker)
   Privacy-first defaults: exact birth year & personal mem notes are OPT-IN (OFF by default). */
const b36=(n,w)=>n.toString(36).padStart(w,"0");
const hex4=n=>n.toString(16).padStart(4,"0");
const toHex=(s,max)=>[...new TextEncoder().encode(String(s)).slice(0,max)].map(b=>b.toString(16).padStart(2,"0")).join("");
const fromHex=h=>{try{return new TextDecoder().decode(new Uint8Array((h.match(/../g)||[]).map(x=>parseInt(x,16))))}catch(e){return ""}};
function encodeShare(d,{includeBirth=false,includeNotes=false}={}){
  const lv={1:[],2:[],3:[]},custom=[],notes=[];
  for(const {e,y,g,lv:l} of entries(d)){
    const rc=roleChar(e.role);
    if(g&&g.year===y&&g.code<46656)lv[l].push(b36(g.code,3));
    else if(g&&g.code<65536)custom.push("h"+String(y-1900).padStart(3,"0")+l+(e.wk?rc:"9")+hex4(g.code));
    else if(e.wk)custom.push((e.wkType==="mod"?"m":e.wkType==="unshipped"?"u":"w")+String(y-1900).padStart(3,"0")+l+rc+toHex(e.t,40));
    else custom.push(String(y-1900).padStart(3,"0")+l+toHex(e.t,40));
    if(g&&g.code<65536&&e.wk&&g.year===y)notes.push("w"+hex4(g.code)+rc);
    if(g&&g.code<65536&&e.wk&&e.wy&&e.wy>=1950&&e.wy<=NOW&&e.wy!==y)notes.push("y"+hex4(g.code)+String(e.wy-1900).padStart(3,"0"));
    if(g&&g.code<65536&&e.wk&&e.wkType==="mod")notes.push("m"+hex4(g.code));
    if(g&&g.code<65536&&e.wk&&e.wkType==="unshipped")notes.push("u"+hex4(g.code));
    if(includeNotes&&g&&g.code<65536&&(e.mem||(e.mtags&&e.mtags.length))){
      const ti=(e.mtags||[]).map(t=>MEM_TAGS.indexOf(t)).filter(k=>k>=0&&k<36).map(k=>k.toString(36)).join("");
      notes.push("n"+hex4(g.code)+ti+"q"+toHex(e.mem||"",50));
    }
  }
  (d.workedStudios||[]).forEach(id=>{if(STUDIOS.has(id))notes.push("s"+toHex(id,32))});
  const owned=(d.owned||[]).map(n=>SYS_IDX.get(n)).filter(i=>i!=null).map(i=>b36(i,2)).join("");
  const t10=(d.top10||[]).map(k=>{const g=byNorm.get(k)||byNorm1.get(k);return g?b36(g.code,3):""}).join("");
  const birthSeg=includeBirth&&d.birth?String(d.birth):(d.era?("e"+d.era):(d.birth?"e"+String(Math.floor(d.birth/10)*10).slice(-2)+"s":"0"));
  const parts=["t1",toHex(d.name||"",24),birthSeg,owned,lv[1].join(""),lv[2].join(""),lv[3].join(""),t10,custom.join("z")];
  if(notes.length)parts.push(notes.join("z"));
  return parts.join("-");
}
function decodeShare(s){
  const cleanS=String(s||"").split("&")[0];
  const p=cleanS.split("-");if(p[0]!=="t1"||p.length<8)return null;
  const rawB=p[2]||"";
  const isEraSeg=/^e\d0s$/.test(rawB);
  const d=Object.assign(blankHist(),{name:fromHex(p[1]),birth:isEraSeg?null:(+rawB||null),era:isEraSeg?rawB.slice(1):""});
  for(let i=0;i+2<=p[3].length;i+=2){const sy=SYSTEMS[parseInt(p[3].substr(i,2),36)];if(sy)d.owned.push(sy[1])}
  [4,5,6].forEach((k,j)=>{const seg=p[k]||"";for(let i=0;i+3<=seg.length;i+=3){const g=byCode.get(parseInt(seg.substr(i,3),36));if(g)pileOf(d,g.year).push({t:g.title,p:brandOf(g),y:g.year,lv:j+1})}});
  const t=p[7]||"";for(let i=0;i+3<=t.length;i+=3){const g=byCode.get(parseInt(t.substr(i,3),36));if(g)d.top10.push(g.n)}
  (p[8]||"").split("z").filter(Boolean).forEach(x=>{
    if(x[0]==="h"&&x.length>=10){const y=1900+parseInt(x.slice(1,4),10),l=+x[4]||1,rc=x[5],g=byCode.get(parseInt(x.slice(6,10),16));if(g&&y>1900){const it={t:g.title,p:brandOf(g),y:g.year,lv:l};if(isWorkedChar(rc)){it.wk=1;if(CH_TO_ROLE[rc])it.role=CH_TO_ROLE[rc]}pileOf(d,y).push(it)}}
    else if((x[0]==="w"||x[0]==="m"||x[0]==="u")&&x.length>=7){const y=1900+parseInt(x.slice(1,4),10),l=+x[4]||1,rc=x[5],title=fromHex(x.slice(6));if(title&&y>1900){const it={t:title,p:"",y:null,lv:l,wk:1,wy:y};if(x[0]==="m")it.wkType="mod";else if(x[0]==="u")it.wkType="unshipped";if(CH_TO_ROLE[rc])it.role=CH_TO_ROLE[rc];pileOf(d,y).push(it)}}
    else if(x[0]==="g"&&x.length>=8){const y=1900+parseInt(x.slice(1,4),10),l=+x[4]||1,g=byCode.get(parseInt(x.slice(5,8),36));if(g&&y>1900)pileOf(d,y).push({t:g.title,p:brandOf(g),y:g.year,lv:l})}
    else{const y=1900+parseInt(x.slice(0,3),10),l=+x[3]||1,title=fromHex(x.slice(4));if(title&&y>1900)pileOf(d,y).push({t:title,p:"",y:null,lv:l})}
  });
  invalidateHistIdx(d);
  if(p[9]){(p[9]||"").split("z").filter(Boolean).forEach(x=>{
    if(x[0]==="w"&&x.length>=6){const g=byCode.get(parseInt(x.slice(1,5),16)),rc=x[5];const e=g&&entryOf(d,g);if(e){e.wk=1;if(CH_TO_ROLE[rc])e.role=CH_TO_ROLE[rc]}return}
    if(x[0]==="y"&&x.length>=8){const g=byCode.get(parseInt(x.slice(1,5),16)),wy=1900+parseInt(x.slice(5,8),10);const e=g&&entryOf(d,g);if(e&&wy>=1950&&wy<=NOW)e.wy=wy;return}
    if(x[0]==="m"&&x.length>=5){const g=byCode.get(parseInt(x.slice(1,5),16));const e=g&&entryOf(d,g);if(e){e.wk=1;e.wkType="mod"}return}
    if(x[0]==="u"&&x.length>=5){const g=byCode.get(parseInt(x.slice(1,5),16));const e=g&&entryOf(d,g);if(e){e.wk=1;e.wkType="unshipped"}return}
    if(x[0]==="s"&&x.length>2){const id=fromHex(x.slice(1));if(STUDIOS.has(id)&&!d.workedStudios.includes(id))d.workedStudios.push(id);return}
    if(x[0]==="n"&&x.length>=6){const g=byCode.get(parseInt(x.slice(1,5),16)),qi=x.indexOf("q",5);if(!g||qi<0)return;const tags=[...x.slice(5,qi)].map(c=>MEM_TAGS[parseInt(c,36)]).filter(Boolean),mem=fromHex(x.slice(qi+1));const e=entryOf(d,g);if(e){if(tags.length)e.mtags=tags;if(mem)e.mem=mem}return}
    const g=byCode.get(parseInt(x.slice(0,3),36));if(!g)return;
    const qi=x.indexOf("q",3);if(qi<0)return;
    const tags=[...x.slice(3,qi)].map(c=>MEM_TAGS[parseInt(c,36)]).filter(Boolean),mem=fromHex(x.slice(qi+1));
    const e=entryOf(d,g);if(e){if(tags.length)e.mtags=tags;if(mem)e.mem=mem}
  })}
  const c=cleanTimeline(d);c.years&&Object.values(c.years).forEach(sortPile);return (c.birth||c.era||Object.keys(c.years).length)?c:null;
}
const shareLink=(d,opts)=>shareBase()+"#"+encodeShare(d,opts);

/* ================================================================
   Router and views
   ================================================================ */
const state={route:{view:"start"},heroEra:"90s",heroBirth:null,heroShuffle:0,wheelFilter:"all",shareBirth:false,shareNotes:false,shareSlide:0,attractDisabled:false,infMode:store.get("ib2-inf","direct"),cmpMode:"age",almTab:"vault",stFilter:"all",tlMode:"all",devMode:store.get("ib3-devmode",0),makerRole:"",makerWkType:"",pickSys:"",pickMode:"eras",packKey:"coop",eraMem:store.get("ib3-eramem",1),eraFold:store.get("ib3-erafold",{}),mechTab:"mechanics",priceReal:false,priceComp:false,priceEra:3,genreSel:"",worldCC:"",worldMine:false,quizMode:"lore",posterMode:"wall",mapMode:"pillars",mapStrong:true,trail:[],navCount:0,tiers:Object.assign({dev:1,team:1,series:1,critic:1,mech:1,disp:1},store.get("ib2-tiers",{})),treeMore:{},viewing:null,showAllYear:false,pickExtra:{}};
state.tiers.disp=store.get("ib3-disp-init")?state.tiers.disp:1;store.set("ib3-disp-init",1);
const isDevMode=()=>!!(state.devMode||workedEntries(hist).length||(hist.workedStudios&&hist.workedStudios.length));
function renderSandboxBar(){
  const sb=$("#sandboxBar");if(!sb)return;
  const stashed=store.get("ib3-stashed-hist");
  if(!stashed){sb.innerHTML="";return}
  const n=entries(cleanTimeline(stashed)).length;
  sb.innerHTML=`<div class="sbar"><div class="wrap in"><span><b>New-visitor preview mode:</b> your real timeline (${plural(n,"game")}) is safely saved while you test onboarding.</span>
    <span class="row"><button type="button" class="btn sm primary" data-act="sandboxExit">◂ Back to my saved timeline (${n})</button><button type="button" class="btn sm ghost" data-act="sandboxCommit">Replace saved with this one</button></span></div></div>`;
}
function parseHash(){
  let h="";try{h=decodeURIComponent(location.hash.slice(1))}catch(e){h=location.hash.slice(1)}
  const hasTl=!!entries(hist).length;
  const home={view:hasTl?"timeline":"start"};
  if(!h)return home;
  if(h==="start")return {view:"start"};
  if(h==="picks"){hist.stage=null;return {view:"picks"}}
  if(h==="systems")return {view:"systems"};
  if(h==="timeline"){hist.stage=null;return hasTl?{view:"timeline"}:{view:"start"}}
  if(h==="tree"||h==="explore"||h==="lineage")return {view:"tree",id:state.linId||""};
  if(h.startsWith("lineage-")&&byId.has(h.slice(8))){state.linId=h.slice(8);return {view:"tree",id:state.linId}}
  if(h==="daily"||h==="trivia"||h==="roots")return {view:"daily"};
  if(h==="almanac")return {view:"almanac",tab:state.almTab||"vault"};
  if(h==="vault"){state.almTab="vault";return {view:"almanac",tab:"vault"}}
  if(h==="mods"||h==="ugc"){state.almTab="mods";return {view:"almanac",tab:"mods",jumpMods:h==="mods"}}
  if(h==="mobile"){state.almTab="mobile";return {view:"almanac",tab:"mobile"}}
  if(h==="prices"){state.almTab="prices";return {view:"almanac",tab:"prices"}}
  if(h==="studios"||h==="gratitude"||h==="giveback"||h==="donate"){
    state.almTab="studios";
    if(h==="gratitude")state.stFilter="gratitude";
    else if(h==="giveback"||h==="donate")state.stFilter="giveback";
    else state.stFilter="all";
    return {view:"almanac",tab:"studios"};
  }
  if(h==="world"){state.almTab="world";return {view:"almanac",tab:"world"}}
  if(h.startsWith("country-")&&/^[A-Za-z]{2}$/.test(h.slice(8))){state.almTab="world";state.worldCC=h.slice(8).toUpperCase();return {view:"almanac",tab:"world",cc:state.worldCC}}
  if(h==="mechanics"){state.almTab="mechanics";return {view:"almanac",tab:"mechanics"}}
  if(h==="genres"){state.almTab="genres";return {view:"almanac",tab:"genres"}}
  if(h.startsWith("genre-")&&GEN_BY_K.has(h.slice(6))){state.almTab="genres";state.genreSel=h.slice(6);return {view:"almanac",tab:"genres",gen:h.slice(6)}}
  if(h==="boardgames"){state.almTab="boardgames";return {view:"almanac",tab:"boardgames"}}
  if(h.startsWith("studio-")&&findStudio(h.slice(7)))return {view:"studio",st:findStudio(h.slice(7)).id};
  if(h==="about"||h==="johan"||h==="creator"||h==="credits"||h==="sources")return {view:"about",jumpCredits:h==="credits"||h==="sources"};
  if(h.startsWith("t1-")){
    const [payload,q]=h.split("&");
    const vs=q==="vs=1"||new URLSearchParams(location.search).get("vs")==="1";
    return {view:"shared",payload,vs};
  }
  if(h.startsWith("walk-")&&byId.has(h.slice(5)))return {view:"game",id:h.slice(5),walk:true};
  if(byId.has(h))return {view:"game",id:h};
  return home;
}
/* Same-document View Transition cover morph (with reduced-motion fallback, rapid-click safety & focus routing) */
let pendingMorphCover=null,vtToken=0;
function clearMorphNames(){
  document.querySelectorAll("[data-vt-cover]").forEach(el=>{el.style.viewTransitionName="";el.removeAttribute("data-vt-cover")});
  if(pendingMorphCover){pendingMorphCover.style.viewTransitionName="";pendingMorphCover=null}
}
function runWithViewTransition(fn,triggerEl){
  const cov=triggerEl&&(triggerEl.classList&&triggerEl.classList.contains("cv")?triggerEl:(triggerEl.querySelector&&triggerEl.querySelector(".cv"))||(triggerEl.closest&&triggerEl.closest(".tile,.lk,.rs")?.querySelector(".cv")));
  if(!document.startViewTransition||prefersReducedMotion()){
    clearMorphNames();
    fn();
    return;
  }
  const tok=++vtToken;
  clearMorphNames();
  if(cov&&document.body.contains(cov)){
    cov.style.viewTransitionName="pm-cover-morph";
    cov.setAttribute("data-vt-cover","1");
    pendingMorphCover=cov;
  }
  try{
    const vt=document.startViewTransition(()=>{
      if(pendingMorphCover){pendingMorphCover.style.viewTransitionName="";pendingMorphCover.removeAttribute("data-vt-cover");pendingMorphCover=null}
      fn();
      if(tok!==vtToken)return;
      const targetCov=$(".gphead .cv")||$(".treebox [data-center]");
      if(targetCov&&targetCov.classList&&targetCov.classList.contains("cv")){
        targetCov.style.viewTransitionName="pm-cover-morph";
        targetCov.setAttribute("data-vt-cover","1");
      }
    });
    vt.ready.catch(()=>{});
    vt.finished.catch(()=>{}).finally(()=>{
      if(tok!==vtToken)return;
      clearMorphNames();
      const h1=$("#main h1");
      if(h1){h1.setAttribute("tabindex","-1");h1.focus({preventScroll:true})}
    });
  }catch(_){
    clearMorphNames();
    fn();
  }
}
let _suppressHash="";
function go(h,triggerEl){
  state.navCount++;
  const doNav=()=>{
    if(location.hash.slice(1)===h){route();return}
    _suppressHash="#"+h;
    location.hash=h;
    route();
  };
  if(triggerEl)runWithViewTransition(doNav,triggerEl);
  else doNav();
}
function navBack(fallbackHash){if(state.navCount>0){state.navCount=Math.max(0,state.navCount-1);history.back()}else go(fallbackHash||"tree")}
let lastView="",hasBooted=false;
function route(){
  document.title="Played & Made — Life in Games";
  if(typeof stopAttractMode==="function")stopAttractMode(false);
  if(typeof stopRootsCountdown==="function")stopRootsCountdown();
  if(story)closeStory();
  else if($("#layer").innerHTML||($("#sheetDlg")&&$("#sheetDlg").open))clearLayer();
  if(typeof VID_STATE!=="undefined"&&VID_STATE.open&&VID_STATE.mode==="theater")minimizeVidDock();
  try{const gm=$("#gearMenu");if(gm&&gm.matches(":popover-open"))gm.hidePopover()}catch(e){}
  state.route=parseHash();
  render();
  trackRouteAnalytics();
  if(state.route&&state.route.jumpMods)requestAnimationFrame(()=>{const el=$("#modStories");if(el)el.scrollIntoView({behavior:"smooth",block:"start"})});
  if(state.route&&state.route.jumpCredits)requestAnimationFrame(()=>{const el=$("#creditsSec");if(el)el.scrollIntoView({behavior:"smooth",block:"start"})});
  hasBooted=true;
}
addEventListener("hashchange",()=>{if(_suppressHash&&location.hash===_suppressHash){_suppressHash="";return}_suppressHash="";route()});
function render(){
  renderSandboxBar();
  const r=state.route,m=$("#main");
  const tab=(r.view==="start"||r.view==="timeline"||r.view==="picks"||r.view==="systems"||r.view==="shared")?"timeline"
    :(r.view==="tree"||r.view==="game")?"tree"
    :r.view==="daily"?"daily"
    :(r.view==="almanac"||r.view==="studio")?"almanac":"";
  $$(".tab").forEach(a=>{if(a.dataset.tab===tab)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  const key=r.view+(r.id||"")+(r.st||"")+(r.tab||"")+(r.gen||"")+(r.cc||"")+(r.payload||"");
  if(r.view==="start")renderStart(m);
  else if(r.view==="picks")renderPicks(m);
  else if(r.view==="systems")renderSystems(m);
  else if(r.view==="timeline")renderTimeline(m);
  else if(r.view==="tree")renderFamilyTree(m,r.id);
  else if(r.view==="daily")renderDaily(m);
  else if(r.view==="almanac")renderAlmanac(m,r.tab);
  else if(r.view==="about")renderAbout(m);
  else if(r.view==="studio")renderStudio(m,r.st);
  else if(r.view==="game")renderGame(m,r.id);
  else if(r.view==="shared")renderShared(m,r.payload,!!r.vs);
  if(key!==lastView){window.scrollTo({top:0});lastView=key}
  if(r.view==="game"&&r.walk){r.walk=false;openStory(rootsChain(byId.get(r.id).i))}
  updateGearMenu();
  syncInstallUI();
}
const footer=()=>`<footer class="wrap foot-about">
  <p><b>Played &amp; Made</b> · ${TREE.length.toLocaleString()} games in the family tree · ${L.length.toLocaleString()} sourced links · ${G.length.toLocaleString()} catalog games · <a href="#about">About &amp; Credits</a> · <button type="button" class="link" data-act="featureSheet">Suggest an update</button> · <a href="#giveback">Support non-profits</a> · <button type="button" class="link" data-act="devModeTog">${isDevMode()?"🛠 Maker mode: On":"Work in games?"}</button><span data-install-ui hidden> · <button type="button" class="link" data-act="installApp">Install app</button></span></p>
  <p>Independent personal hobby project — views and notes are my own and not affiliated with Google or past employers. Non-commercial educational archive; box art and screenshots are used under fair use for historical identification via IGDB, Wikimedia / Wikipedia, Steam, Libretro &amp; ModDB; maps via Natural Earth; CPI via U.S. BLS. All trademarks and artwork belong to their respective rightsholders.</p>
</footer>`;

function eraMomentsHTML(from,to){
  if(!state.eraMem)return "";
  const eras=CULT.eras||[];
  const hits=eras.filter(e=>e.to>=from&&e.from<=to);
  if(!hits.length)return "";
  const items=[];hits.forEach(h=>(h.moments||[]).slice(0,2).forEach(m=>{if(items.length<4&&!items.includes(m))items.push(m)}));
  if(!items.length)return "";
  const key=`${from}-${to}`,folded=!!(state.eraFold&&state.eraFold[key]);
  return `<details class="eramem" data-era="${esc(key)}"${folded?"":" open"}><summary><span class="eramem-chev" aria-hidden="true">▸</span><b>Meanwhile (${from}–${to})</b><span class="eramem-act"><span class="when-open">Fold ▴</span><span class="when-closed">Peek pop culture ▸</span></span></summary><div class="eramem-body">${items.map(m=>`<span>${esc(m)}</span>`).join("")}</div></details>`;
}
function gtaviSpotlight(){
  const gta=byId.get("grand-theft-auto-vi")||byId.get("grand-theft-auto-v");if(!gta)return "";
  const ch=rootsChain(gta.i),old=ch.length?ch[ch.length-1].g:null,yrs=old?gta.year-old.year:64;
  const studios=new Set(ch.map(s=>studio(s.g)).filter(Boolean)),countries=new Set(ch.map(s=>s.g.cc).filter(Boolean));
  const hls=CULT.gtaStory||[];
  return `<div class="marquee"><div class="marquee-in">${cover(gta,{showYear:false})}<div>
    <p class="eyebrow" style="margin-bottom:4px">Design lineage spotlight · Cumulative craft</p>
    <h2 class="h2">${esc(gta.title)}: ${yrs} years in the making</h2>
    <p class="sub" style="margin:4px 0 10px">Trace the lineage behind ${esc(gta.title)}: ${plural(ch.length-1,"step")} across ${plural(studios.size,"studio")} in ${plural(countries.size,"country","countries")}, from 1960s lab mainframes and 1980s British space sims to modern Vice City.</p>
    <div class="row"><button class="btn sm primary" data-act="walk" data-id="${gta.id}">Walk its ${yrs}-year roots ▸</button><button class="btn sm" data-act="game" data-id="${gta.id}">Open family tree</button><button class="btn sm" data-act="watchTv" data-id="${gta.id}">▶ Watch trailer</button></div>
  </div></div>
  ${hls.length?`<details class="gtadet"><summary>From 1976 arcade controversies &amp; Senate hearings to modern open worlds (${hls.length} milestones)</summary>
    <div class="hlgrid">${hls.map(h=>{const gm=h.game&&byId.get(h.game);return `<div class="hlcard"><span class="hlyr">${esc(h.year)} · ${esc(h.kicker||"")}</span><b>“${esc(h.quote)}”</b><p>${esc(h.body)}</p>${gm?`<button type="button" class="link" style="font-size:11.5px;align-self:flex-start;margin-top:auto" data-act="game" data-id="${gm.id}">${esc(gm.title)} ▸</button>`:""}</div>`}).join("")}</div></details>`:""}
  </div>`;
}
/* ---------- UTC deterministic daily clock + start hero (16 covers tuned to Ages 7-15) ---------- */
const ROOTS_EPOCH_MS=Date.UTC(2026,9,1); // Oct 1, 2026 UTC -> ROOTS #N synchronized globally
function utcDayNum(ms=Date.now()){return Math.floor(ms/864e5)}
function utcDateKey(ms=Date.now()){return new Date(ms).toISOString().slice(0,10)}
function rootsNumber(ms=Date.now()){
  const d=new Date(ms),mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
  return Math.max(1,Math.floor((mid-ROOTS_EPOCH_MS)/864e5)+1);
}
function mulberry32(seed){
  let a=seed>>>0;
  return ()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296};
}
let storyDeckOffset=0;
const HERO_ERAS=[
  {k:"80s",label:"'80s kid",from:1981,to:1992},
  {k:"90s",label:"'90s kid",from:1991,to:2001},
  {k:"00s",label:"'00s kid",from:2001,to:2011}
];
/* Unified formative years window (Ages 7–15) shared by Hero, Daily Rewind & Lucky Wheel */
function formativeWindow(d=hist,{birthOverride=null}={}){
  const b=birthOverride||state.heroBirth||(d&&d.birth)||null;
  if(b&&b>=1940&&b<=NOW-3){
    const from=Math.max(1978,Math.min(NOW-4,b+7));
    const to=Math.min(NOW,Math.max(from+8,b+15));
    return {from,to,birth:b,ageFrom:from-b,ageTo:to-b,label:`Ages ${from-b}\u2013${to-b} (${from}\u2013${to})`};
  }
  const ek=(d&&d.era)||state.heroEra||"90s";
  const cfg=HERO_ERAS.find(e=>e.k===ek)||HERO_ERAS[1];
  return {from:cfg.from,to:cfg.to,birth:null,ageFrom:null,ageTo:null,eraLabel:cfg.label,label:`${cfg.label} · ${cfg.from}\u2013${cfg.to}`};
}
function heroYearWindow(){return formativeWindow(hist)}
const seriesKeyOf=title=>fold(String(title||"")).toLowerCase().replace(/\s*[:\-–].*$/,"").replace(/\s+(?:ii|iii|iv|v|vi|vii|viii|ix|x|64|2000|\d+)$/,"").replace(/[^a-z0-9]+/g,"");
function heroWallGames(){
  const {from,to}=heroYearWindow();
  const cand=G.filter(g=>playable(g)&&!g.cancelled&&g.year>=from&&g.year<=to&&g.year>=1978&&(g.pop>=4||g.inf>=20))
    .sort((a,b)=>(b.pop*12+Math.min(b.inf,300)/14+(b.img?8:0))-(a.pop*12+Math.min(a.inf,300)/14+(a.img?8:0)));
  const pool=cand.slice(0,Math.min(cand.length,56));
  if(pool.length<=16)return pool.slice().sort((a,b)=>a.year-b.year);
  const offset=(state.heroShuffle||0)*7;
  const picked=[],usedGen=new Map(),usedSeries=new Set();
  for(let pass=0;pass<3&&picked.length<16;pass++){
    for(let i=0;i<pool.length&&picked.length<16;i++){
      const g=pool[(offset+i)%pool.length];
      if(picked.includes(g))continue;
      const sk=seriesKeyOf(g.title);
      if(pass<2&&sk&&usedSeries.has(sk))continue;
      const gk=g.gen[0]??-1,gc=usedGen.get(gk)||0;
      if(pass===0&&gc>=3)continue;
      picked.push(g);usedGen.set(gk,gc+1);if(sk)usedSeries.add(sk);
    }
  }
  return picked.sort((a,b)=>a.year-b.year||a.title.localeCompare(b.title));
}
function rotatingStoriesHTML(){
  const mods=CULT.modStories||[],lore=CULT.vaultLore||[],real=CULT.realStories||[];
  const seed=utcDayNum()+storyDeckOffset;
  const picks=[];
  if(mods.length)picks.push({kind:"mod",href:"#mods",moreLbl:"All Mod Stories ▸",it:mods[seed%mods.length]});
  if(lore.length)picks.push({kind:"lore",href:"#vault",moreLbl:"Explore The Vault ▸",it:lore[(seed*3+1)%lore.length]});
  if(real.length){
    const r=real[(seed*5+2)%real.length];
    picks.push({kind:"real",href:"#gratitude",moreLbl:"More maker stories ▸",it:{tag:r.tag||"Documented",title:r.title,body:r.body,games:r.game?[r.game]:[]}});
  }
  if(!picks.length)return "";
  return `<section class="wrap sec" id="homeStories">
    <div class="sechead">
      <div>
        <p class="eyebrow">Almanac dispatches · Mods, folklore &amp; makers</p>
        <h2 class="h2">Stories from seven decades of game craft</h2>
        <p class="sub">From bedroom total conversions and shelved prototypes to the teams behind the worlds players still remember.</p>
      </div>
      <div class="row" style="gap:6px">
        <button type="button" class="btn sm" data-act="shuffleStories">Deal 3 more</button>
        <a class="btn sm ghost" href="#mods">Mods</a>
        <a class="btn sm ghost" href="#vault">The Vault</a>
      </div>
    </div>
    <div class="mechgrid">${picks.map(p=>{
      const it=p.it,gs=(it.games||[]).map(gameRef).filter(Boolean);
      return `<article class="mechcard">
        <div class="row" style="justify-content:space-between;gap:8px"><span class="eyebrow" style="margin:0">${esc(it.tag||"Story")}</span><span>${it.cc?flag(it.cc):""}</span></div>
        <div style="display:flex;gap:12px;align-items:flex-start">
          ${it.sys?`<div style="flex:none;width:50px;padding-top:2px">${hwSVG(it.sys)}</div>`:""}
          <h3 class="h2" style="font-size:16.5px;margin:0;line-height:1.3">${esc(it.title)}</h3>
        </div>
        <p style="margin:2px 0;font-size:13.3px;color:var(--ink2);line-height:1.48">${esc(it.body||"")}</p>
        <footer class="row" style="margin-top:auto;padding-top:6px;justify-content:space-between;gap:6px">
          <span class="row" style="gap:5px">${gs.slice(0,2).map(g=>`<button type="button" class="chip" style="padding:3px 8px;font-size:11.5px" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}">${esc(g.title)} (${g.year}) ▸</button>`).join("")}</span>
          <a class="link" style="font-size:12px;white-space:nowrap" href="${p.href}">${p.moreLbl}</a>
        </footer>
      </article>`;
    }).join("")}</div>
  </section>`;
}
function renderStart(m){
  const win=heroYearWindow();
  const wall=heroWallGames();
  const pickedN=entries(hist).length;
  const activeEra=state.heroBirth||hist.birth?"":(state.heroEra||hist.era||"90s");
  const curBirth=state.heroBirth||hist.birth||"";
  m.innerHTML=`<section class="wrap hero-pick">
    ${challengerBannerHTML()}
    <div class="hero-head">
      <div style="min-width:0;max-width:68ch">
        <h1 class="h1" style="margin-bottom:6px">What worlds raised you growing up?</h1>
        <p class="lede" style="margin:0">Tap any cover to build your timeline — no account, saved locally.</p>
      </div>
      <div class="tap-hint" style="margin:0" aria-label="Tap 1 time for played, 2 times for played a ton, 3 times for favorite"><span><b>✓</b>1× played</span><span><b class="l2">★</b>2× a ton</span><span><b class="l3">♥</b>3× favorite</span></div>
    </div>
    <div class="hero-eras" role="group" aria-label="Choose your childhood era">
      ${HERO_ERAS.map(e=>`<button type="button" class="chip" data-act="heroEra" data-era="${e.k}" aria-pressed="${activeEra===e.k}">${e.label}</button>`).join("")}
      <span class="hero-birth"><label for="heroBirthIn">Birth year</label><input id="heroBirthIn" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="1984" value="${esc(curBirth)}" autocomplete="off" aria-label="Optional birth year to tune covers to ages 7 to 15"></span>
      <button type="button" class="chip" data-act="heroShuffle" title="Show 16 more games from this window">Shuffle 16</button>
      <span class="sync hero-winhint" style="margin-left:auto">${esc(win.label)} · hold cover or tap title for info</span>
    </div>
    <div class="hero-wall" id="heroWall">${wall.map((g,idx)=>tileHTML(g,hist,{act:"heroCycle",sub:`${g.year}`,eager:idx<8,hiPri:idx<4})).join("")}</div>
    <div class="hero-bar" id="heroBar">
      <div class="row" style="gap:10px;min-width:0">
        <span id="heroCount" style="font-size:14px">${pickedN?`<b>${plural(pickedN,"game")}</b> picked — auto-saved`:`<span class="muted">0 picked</span>`}</span>
      </div>
      <div class="row" style="gap:8px">
        <a class="btn sm ghost" href="#picks">Browse all eras</a>
        ${pickedN?`<a class="btn sm primary" href="#timeline">Open my timeline (${pickedN}) ▸</a>`:`<a class="btn sm" href="#tree">Explore family tree ▸</a>`}
      </div>
    </div>
  </section>
  <section class="wrap sec" style="padding-top:16px">
    <div class="search bigsearch"><input class="input" id="q0" type="search" placeholder="Search ${G.length.toLocaleString()}+ games &amp; mods to pick or trace — e.g. Chrono Trigger, Counter-Strike, Lemmings…" autocomplete="off" aria-label="Search any game"><div class="results" id="r0" hidden></div></div>
    <div class="row" style="margin-top:10px;justify-content:space-between;gap:8px">
      <span class="sync">Pick any game directly from search, or jump into its family tree.</span>
      <span class="row" style="gap:12px">
        <button type="button" class="link" style="font-size:13px" data-act="luckyWheel">Feeling lucky</button>
        <button type="button" class="link" style="font-size:13px" data-act="devModeTog">${isDevMode()?"🛠 Maker mode: On":"Work in games?"}</button>
      </span>
    </div>
  </section>
  ${footer()}`;
  const hb=$("#heroBirthIn");
  if(hb){
    const applyBirth=()=>{
      const raw=hb.value.trim();
      if(!raw){state.heroBirth=null;hist.birth=null;hist.era=state.heroEra||"90s";save();renderStart(m);return}
      const y=parseInt(raw,10);
      if(raw.length===4&&y>=1940&&y<=NOW-3){
        state.heroBirth=y;hist.birth=y;hist.era=String(Math.floor(y/10)*10).slice(-2)+"s";state.heroShuffle=0;save();
        trackEvent("timeline_started","era");
        renderStart(m);
        const nb=$("#heroBirthIn");if(nb){nb.focus();nb.setSelectionRange(4,4)}
      }
    };
    hb.addEventListener("input",applyBirth);
  }
  wireSearch($("#q0"),$("#r0"),g=>{if(!g||!g.id)return;go(g.id)},{
    quickPick:true,
    onQuickPick:(g,btn)=>{
      if(!hist.birth&&!hist.era){hist.era=state.heroEra||"90s";save()}
      const wasEmpty=!entries(hist).length;
      const nl=cycleLevel(g);playBlip(nl);
      if(wasEmpty&&nl>0)trackEvent("timeline_started","search");
      btn.className="respick"+(nl?" lv"+nl:"");
      btn.textContent=nl?LV[nl].m:"+ Pick";
      $$(`.art[data-id="${CSS.escape(g.id)}"]`).forEach(el=>refreshTile(el,g));
      updateHeroBar();
      if(nl>0)toast(`${LV[nl].m} ${LV[nl].label}: ${g.title}`);
    }
  });
}
function updateHeroBar(){
  const n=entries(hist).length,bar=$("#heroBar");if(!bar)return;
  const cnt=$("#heroCount");
  if(cnt)cnt.innerHTML=n?`<b>${plural(n,"game")}</b> picked — auto-saved`:`<span class="muted">0 picked</span>`;
  const cta=bar.querySelector("a.btn.sm.primary, a[href='#tree']");
  if(cta){
    if(n){cta.href="#timeline";cta.className="btn sm primary";cta.textContent=`Open my timeline (${n}) ▸`}
    else{cta.href="#tree";cta.className="btn sm";cta.textContent="Explore family tree ▸"}
  }
}

/* ---------- optional systems filter & era-first picker ---------- */
function relevantSystems(birth){if(!birth)return SYSTEMS;const a=birth-2;return SYSTEMS.filter(([,n,f,t])=>t>=a&&f<=NOW)}
function renderSystems(m){
  const sys=relevantSystems(hist.birth),own=new Set(hist.owned||[]);
  const groups={};sys.forEach(s=>(groups[s[0]]=groups[s[0]]||[]).push(s));
  const order=["A","C","N","S","P","X","M","O"];
  m.innerHTML=`<section class="wrap" style="padding-block:22px 10px;max-width:960px">
    <nav class="trail" style="padding-top:0;margin-bottom:8px"><button type="button" class="navback" data-act="navBack" data-fb="picks">◂ Back to Pick</button><span class="cur">Filter by systems</span></nav>
    <p class="eyebrow" style="margin-bottom:4px">Optional hardware filter</p>
    <h1 class="h1" style="font-size:clamp(1.55rem,1.1rem + 2.3vw,2.25rem)">What machines did you play on?</h1>
    <p class="lede">Pick any consoles, home computers, or arcades you played on to prioritize their games in the picker — completely optional.</p>
    <div class="sysgroups">${order.filter(b=>groups[b]).map(b=>`<div class="sysgroup"><h3>${BRANDS[b]}</h3><div>${groups[b].map(([,n,f,t])=>`<button class="syschip" data-act="own" data-sys="${esc(n)}" aria-pressed="${own.has(n)}">${hwSVG(n)}<span><b>${esc(n)}</b><small>${f}${t>=NOW?"–now":"–"+t}</small></span></button>`).join("")}</div></div>`).join("")}</div>
    <div class="row" style="justify-content:space-between;margin-top:18px;padding:12px 14px;border:1px dashed var(--line2);border-radius:12px;background:var(--card)">
      <span class="sub" style="margin:0">Don't see a regional console, Famiclone, or home computer you grew up with?</span>
      <button type="button" class="btn sm" data-act="featureSheet" data-cat="Missing Console / System">Request a missing console or game</button>
    </div>
    <div class="pickbar"><div class="in"><button class="btn ghost" data-act="obBack">Back</button><span class="sync" style="flex:1" id="ownCount">${own.size?plural(own.size,"system")+" picked":"Optional — pick a few or skip"}</span><button class="btn primary" data-act="obPicks">Back to pick games ▸</button></div></div>
  </section>${footer()}`;
}
/* Childhood core (Ages 7-15) leads first; Pre-age 3 hand-me-downs live at the end */
const ERA_BANDS=[
  [7,9,"a7","Ages 7–9","Ages 7–9","",18],
  [10,12,"a10","Ages 10–12","Ages 10–12","",18],
  [13,15,"a13","Ages 13–15","Ages 13–15","",18],
  [3,6,"a3","Early childhood · Ages 3–6","Ages 3–6","First games at home, or watching older siblings play",18],
  [16,19,"a16","Ages 16–19","Ages 16–19","",18],
  [20,24,"a20","Ages 20–24","Ages 20–24","",16],
  [25,29,"a25","Ages 25–29","Ages 25–29","",16],
  [30,39,"a30","Your thirties","30s","",18],
  [40,49,"a40","Your forties","40s","",16],
  [50,90,"a50","Since you turned 50","50+","",14],
  [-10,2,"pre3","Hand-me-downs & older-sibling classics","Hand-me-downs","Games released before you turned 3 — played later via older siblings, cousins, or arcades",16]];
const DECADE_BANDS=[
  [1990,1994,"d90a","Early 1990s · 16-Bit Consoles, Amiga & DOS PC","1990–94","SNES, Mega Drive, Monkey Island, Street Fighter II & Doom",18],
  [1995,1999,"d90b","Late 1990s · The 3D Revolution (PS1, N64 & PC)","1995–99","PlayStation, Nintendo 64, FF7, Ocarina of Time, Half-Life & Pokémon",18],
  [2000,2004,"d00a","Early 2000s · PS2, Xbox, GameCube & LAN Parties","2000–04","GTA III, Halo, Counter-Strike, The Sims & World of Warcraft",18],
  [1985,1989,"d80b","Late 1980s · NES, Amiga & 8-Bit Boom","1985–89","Super Mario Bros., Zelda, Out Run, Amiga 500 & Game Boy",18],
  [2005,2009,"d00b","Late 2000s · HD Consoles, Wii & Indie Awakening","2005–09","Xbox 360, Wii Sports, Portal, BioShock, CoD4 & Minecraft",18],
  [2010,2014,"d10a","Early 2010s · Open Worlds, Souls & Indie Wave","2010–14","Skyrim, Dark Souls, GTA V, The Last of Us & Terraria",18],
  [2015,2019,"d10b","Late 2010s · Switch, Battle Royale & High Craft","2015–19","Witcher 3, Breath of the Wild, Fortnite, Hollow Knight & RDR2",18],
  [2020,NOW,"d20","2020s · Modern Classics & New Landmarks","2020s","Elden Ring, Baldur's Gate 3, Hades, Astro Bot & GTA VI",18],
  [1980,1984,"d80a","Early 1980s · Golden Age of Arcades & 8-Bit Micros","1980–84","Pac-Man, Donkey Kong, Commodore 64, Apple II & ZX Spectrum",18],
  [1971,1979,"d70","1970s · Arcade & Home Console Dawn","1970s","Pong, Space Invaders, Atari 2600 & early mainframe adventures",16]];
function orderedDecadeBands(){
  const ek=hist.era||state.heroEra||"90s";
  const pref=ek==="80s"?["d80a","d80b","d90a","d90b"]:ek==="00s"?["d00a","d00b","d10a","d90b"]:["d90a","d90b","d00a","d80b"];
  const rank=k=>{const i=pref.indexOf(k);return i>=0?i:100};
  return DECADE_BANDS.slice().sort((a,b)=>rank(a[2])-rank(b[2]));
}
function quickBands(birth,owned,sysFilter=""){
  const own=new Set(owned||[]),useOwn=own.size>0;
  const bands=[];
  const rawBands=birth?ERA_BANDS.map(([a,b,key,label,short,sub,n])=>[Math.max(1950,birth+a),Math.min(NOW,birth+b),key,label,short,sub,n]):orderedDecadeBands();
  for(const [from,to,key,label,short,sub,n] of rawBands){
    if(from>to)continue;
    let scored=[];
    if(sysFilter&&sysFilter!=="__other__"){
      const pool=G.filter(g=>g.year>=from&&g.year<=to&&(g.cat||g.pop>=2||g.tree)&&playable(g));
      scored=pool.map(g=>{const ps=sysOfGame(g);if(!gameMatchesSys(ps,sysFilter))return null;
        const exact=ps.includes(sysFilter)?18:0,lead=g.plats.length&&canonSys(g.plats[0])===sysFilter?12:0,excl=ps.length<=2?5:ps.length<=4?2:0;
        return {g,ps,s:g.pop*10+exact+lead+excl+Math.min(g.inf,300)/22+(g.cat?3:0)}}).filter(Boolean).sort((x,y)=>y.s-x.s);
    }else if(sysFilter==="__other__"){
      const pool=G.filter(g=>g.year>=from&&g.year<=to&&(g.cat||g.pop>=3)&&playable(g));
      scored=pool.map(g=>{const ps=sysOfGame(g),arc=ps.includes("Arcade");if([...own].some(sy=>gameMatchesSys(ps,sy)))return null;
        if(!(g.pop>=4||(arc&&g.pop>=3)))return null;
        return {g,ps,s:g.pop*10+(arc?6:0)+Math.min(g.inf,300)/25}}).filter(Boolean).sort((x,y)=>y.s-x.s);
    }else{
      const pool=G.filter(g=>g.year>=from&&g.year<=to&&(g.cat||g.pop>=3)&&playable(g));
      scored=pool.map(g=>{const ps=sysOfGame(g),hit=[...own].some(sy=>gameMatchesSys(ps,sy)),exact=[...own].some(sy=>ps.includes(sy)),arc=ps.includes("Arcade");
        const lead=g.plats.length&&own.has(canonSys(g.plats[0]))?8:0,excl=hit&&ps.length<=3?4:0;
        const s=g.pop*10+(hit?24:0)+(exact?8:0)+lead+excl+(arc&&g.year<1996?5:0)+Math.min(g.inf,300)/25+(g.cat?3:0);
        return {g,ps,s,ok:!useOwn||hit||g.pop>=5||(arc&&g.year<1992&&g.pop>=4)}}).filter(x=>x.ok).sort((x,y)=>y.s-x.s);
      if(useOwn&&own.size>1){
        const queues=[...own].map(sy=>scored.filter(x=>gameMatchesSys(x.ps,sy)).sort((p,q)=>(q.s+(q.ps.includes(sy)?14:0)+(q.g.plats.length&&canonSys(q.g.plats[0])===sy?12:0))-(p.s+(p.ps.includes(sy)?14:0)+(p.g.plats.length&&canonSys(p.g.plats[0])===sy?12:0)))).filter(q=>q.length);
        if(queues.length>1){
          const seen=new Set(),inter=[],ptr=queues.map(()=>0),target=Math.max(n,queues.length*5);
          while(inter.length<target){let added=0;for(let qi=0;qi<queues.length;qi++){const q=queues[qi];while(ptr[qi]<q.length&&seen.has(q[ptr[qi]].g.i))ptr[qi]++;if(ptr[qi]<q.length){const it=q[ptr[qi]++];seen.add(it.g.i);inter.push(it);added++}}if(!added)break}
          scored.forEach(x=>{if(!seen.has(x.g.i))inter.push(x)});
          scored=inter;
        }
      }
    }
    if(!scored.length)continue;
    const extra=state.pickExtra[key+":"+sysFilter]||0;
    const shown=Math.min(scored.length,n+extra);
    const games=scored.slice(0,shown).map(x=>x.g);
    const pickedInBand=scored.reduce((c,x)=>c+(levelOf(hist,x.g)>0?1:0),0);
    bands.push({key,label,short,sub,from,to,games,baseN:n,extra,total:scored.length,shown,rem:scored.length-shown,picked:pickedInBand});
  }
  return bands;
}
function pickSysCounts(birth,owned){
  const from=birth?Math.max(1950,birth-10):1950,out=new Map();
  (owned||[]).forEach(sy=>out.set(sy,0));
  for(const g of G){if(g.year<from||g.year>NOW||!(g.cat||g.pop>=2||g.tree)||!playable(g))continue;
    const ps=sysOfGame(g);
    for(const sy of out.keys())if(gameMatchesSys(ps,sy))out.set(sy,out.get(sy)+1)}
  return out;
}
function pickTileSub(g,ownSet,sysFilter){
  if(sysFilter&&sysFilter!=="__other__")return `${g.year} · ${studioBtn(studio(g))}`;
  const ps=sysOfGame(g),hits=ownSet.size?ps.filter(p=>ownSet.has(p)):[];
  if(hits.length)return `${g.year} · ${esc(hits.slice(0,2).join(", "))}`;
  return `${g.year} · ${ps[0]?esc(ps[0]):studioBtn(studio(g))}`;
}
function tileHTML(g,d,{act="cycle",sub=null,cls="",wkTog=false,quickTick=false,eager=false,hiPri=false}={}){
  const lv=d?levelOf(d,g):0,ent=d?entryOf(d,g):null,wk=!!(ent&&ent.wk);
  const qt=quickTick&&playable(g)?`<button type="button" class="qtick${lv?" lv"+lv:""}" data-act="qtick" data-id="${g.id}" aria-label="${esc(g.title)}: ${lv?LV[lv].label:"Mark as played"}">${lv?LV[lv].m+" "+LV[lv].label:"+ Played"}</button>`:"";
  return `<div class="tile${lv?" lv"+lv:""}${wk?" worked":""} ${cls}"><div class="artwrap"><button class="art" data-act="${act}" data-id="${g.id}" data-lp="${g.id}" aria-label="${esc(g.title)}, ${wk?"worked on it":lv?LV[lv].label:"not played"}">${cover(g,{eager,hiPri})}${wk?`<span class="wkbadge" title="Worked on this">🛠</span>`:""}${lv?`<span class="lvb${lv===3?" l3":lv===2?" l2":""}" aria-hidden="true">${LV[lv].m}</span>`:""}</button></div>
    <button type="button" class="tnbtn" data-act="quickLook" data-id="${g.id}">${esc(g.title)}</button>${wk&&ent.role?`<span class="trole">🛠 ${esc(ent.role)}</span>`:""}${sub!==null?`<span class="ts">${sub}</span>`:`<span class="ts">${g.year} · ${studioBtn(studio(g))}</span>`}${qt}${wkTog&&isDevMode()?`<button type="button" class="wktog" data-act="toggleWk" data-id="${g.id}" aria-pressed="${wk}">🛠 ${wk?"Worked on ✓":"I worked on"}</button>`:""}</div>`}
function histBars(d,from,to){const counts={},loves={};for(const {y,lv} of entries(d)){counts[y]=(counts[y]||0)+1;if(lv===3)loves[y]=1}
  const max=Math.max(1,...Object.values(counts));let h="";for(let y=from;y<=to;y++){const c=counts[y]||0;h+=`<i class="${c?(loves[y]?"l":""):"z"}" style="height:${c?Math.max(12,c/max*100):6}%" title="${y}: ${c}"></i>`}return h}
function pickSummary(){const es=entries(hist);const ys=es.map(x=>x.y),def=hist.birth||1990;return {n:es.length,from:ys.length?Math.min(...ys):def,to:ys.length?Math.max(...ys):def}}
function pickBars(){const s=pickSummary(),b=hist.birth;return histBars(hist,b?Math.max(1950,Math.min(b-10,s.from)):Math.max(1970,s.from-4),b?Math.min(NOW,Math.max(b+40,s.to)):NOW)}
function renderPicks(m){
  const own=hist.owned||[],ownSet=new Set(own);
  if(state.pickSys&&state.pickSys!=="__other__"&&!ownSet.has(state.pickSys))state.pickSys="";
  const sf=state.pickSys||"",byPack=state.pickMode==="packs";
  const bands=byPack?[]:quickBands(hist.birth,own,sf);
  const sysCnt=own.length?pickSysCounts(hist.birth,own):null;
  const curPack=MEMORY_PACKS.find(p=>p.k===state.packKey)||MEMORY_PACKS[0];
  const curPackGames=byPack?packGames(curPack):[];
  const s=pickSummary();
  m.innerHTML=`<section class="wrap" style="padding-block:12px 0">
    <div class="row" style="justify-content:space-between;gap:6px">
      <h1 class="h1" style="font-size:clamp(1.3rem,1rem + 1.8vw,2.05rem);margin:0">Tap the games you played</h1>
      <div class="tap-hint" style="margin:0;font-size:12px;gap:4px 10px"><span><b>✓</b>1× played</span><span><b class="l2">★</b>2× a ton</span><span><b class="l3">♥</b>3× favorite</span></div>
    </div>
    <div class="pickpanel" style="padding:10px 12px;margin:8px 0 4px">
      ${!hist.birth?`<form class="row" id="pickBirthForm" style="padding-bottom:8px;margin-bottom:8px;border-bottom:1px dashed var(--line);justify-content:space-between;gap:6px"><span class="sync"><b>Optional:</b> birth year to group eras by childhood age</span><span class="row" style="gap:5px"><input class="input" id="pickBirthIn" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="1984" aria-label="Birth year" style="width:88px;padding:5px 9px;font-size:16px;font-family:var(--f-mono)"><button class="btn sm primary" type="submit">Set</button></span></form>`:""}
      <div class="row" style="justify-content:space-between;margin-bottom:8px;gap:6px">
        <span class="seg" role="group" aria-label="Browse style">
          <button type="button" data-act="pickMode" data-m="eras" aria-pressed="${!byPack}">${hist.birth?"By age":"By era"}</button>
          <button type="button" data-act="pickMode" data-m="packs" aria-pressed="${byPack}">Mood packs</button>
        </span>
        <span class="row" style="gap:5px">
          <button type="button" class="chip" style="padding:4px 10px;font-size:12px" data-act="steamImport">Import Steam</button>
          <a class="chip" style="padding:4px 10px;font-size:12px" href="#systems">Systems${own.length?` (${own.length})`:""}</a>
          ${hist.birth?`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="settings" title="Change birth year or name">${esc(eraKidLabel(hist)||String(hist.birth))}</button>`:""}
          ${s.n?`<a class="btn sm primary" style="padding:5px 10px;font-size:12px" href="#timeline">Timeline (${s.n}) ▸</a>`:""}
        </span>
      </div>
      <div class="search"><input class="input" id="pickQ" type="search" style="padding-block:8px;font-size:16px" placeholder="Search any game (e.g. GoldenEye, Tanki, Lemmings)…" autocomplete="off" aria-label="Search any game to add"><div class="results" id="pickR" hidden></div></div>
      ${!byPack&&(own.length||bands.length>1)?`<div class="pickstrip" style="margin-top:7px;padding-bottom:3px" aria-label="Filter by system or jump to era">
        ${own.length?`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="pickSys" data-sys="" aria-pressed="${!sf}">All (${own.length})</button>
          ${own.map(sy=>`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="pickSys" data-sys="${esc(sy)}" aria-pressed="${sf===sy}">${esc(sy)} <span class="mono muted">${sysCnt.get(sy)||0}</span></button>`).join("")}
          ${ownSet.has("Dendy")?`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="openDendyPack">Dendy pack ▸</button>`:""}
          <button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="pickSys" data-sys="__other__" aria-pressed="${sf==="__other__"}">+ Other</button>`:""}
        ${bands.map((b,idx)=>`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="bandJump" data-to="band-${idx}" data-bjump="${esc(b.key)}">${esc(b.short)} <span class="mono muted">${b.from===b.to?b.from:"'"+String(b.from).slice(-2)+"–'"+String(b.to).slice(-2)}${b.picked?` · ${b.picked}✓`:""}</span></button>`).join("")}
        <button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="eraMemTog" aria-pressed="${!!state.eraMem}">Headlines: ${state.eraMem?"On":"Off"}</button>
        <button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="featureSheet" data-cat="Missing Game / Classic">Request game</button>
      </div>`:""}
    </div>
    ${byPack?`<div class="packgrid">${MEMORY_PACKS.map(pk=>{const gs=packGames(pk),pkCnt=gs.filter(g=>levelOf(hist,g)>0).length;
        return `<button type="button" class="packcard" data-act="pickPack" data-k="${esc(pk.k)}" aria-pressed="${curPack.k===pk.k}"><b>${esc(pk.title)}</b><small>${esc(pk.sub)}</small><span class="mono muted" style="font-size:11px;margin-top:2px">${gs.length} games${pkCnt?` · <b style="color:var(--accent)">${pkCnt} picked</b>`:""}</span></button>`}).join("")}</div>
      <section class="band firstband"><div class="bandhead"><h2 class="h2">${esc(curPack.title)}</h2><span class="bandmeta"><span>${curPackGames.length} curated classics</span></span></div>
        <p class="sub">${esc(curPack.sub)}</p>
        <div class="grid">${curPackGames.map(g=>tileHTML(g,hist,{sub:pickTileSub(g,ownSet,"")})).join("")}</div></section>`
    :bands.map((b,idx)=>`<section class="band${idx===0?" firstband":""}" id="band-${idx}" data-bkey="${esc(b.key)}" style="${idx===0?"padding-top:8px":""}">
      <div class="bandhead">
        <h2 class="h2">${esc(b.label)} <span class="mono muted" style="font-size:13px;font-weight:500">${b.from===b.to?b.from:b.from+"–"+b.to}</span></h2>
        <span class="bandmeta"><span>${b.shown}/${b.total}</span><b data-bpick="${esc(b.key)}" ${b.picked?"":"hidden"}>${b.picked} picked</b></span>
      </div>
      ${b.sub&&idx>0?`<p class="sub" style="margin-bottom:6px">${esc(b.sub)}</p>`:""}
      ${idx>0?eraMomentsHTML(b.from,b.to):""}
      <div class="grid">${b.games.map(g=>tileHTML(g,hist,{sub:pickTileSub(g,ownSet,sf)})).join("")}</div>
      ${idx===0?eraMomentsHTML(b.from,b.to):""}
      <div class="bandfoot">
        ${b.rem>32?`<button type="button" class="btn sm" data-act="pickMore" data-band="${esc(b.key)}">Show ${Math.min(24,b.rem)} more <span class="mono muted">(${b.rem} left)</span></button><button type="button" class="btn sm ghost" data-act="pickAll" data-band="${esc(b.key)}">Show all ${b.total}</button>`
          :b.rem>0?`<button type="button" class="btn sm" data-act="pickAll" data-band="${esc(b.key)}">Show all ${b.rem} remaining <span class="mono muted">(of ${b.total})</span></button>`
          :b.total>b.baseN?`<span class="sync">Showing all ${b.total} games in this era</span>`:""}
        ${b.extra>0?`<button type="button" class="btn sm ghost" data-act="pickLess" data-band="${esc(b.key)}">Show fewer</button>`:""}
        ${idx<bands.length-1?`<button type="button" class="btn sm ghost" data-act="bandJump" data-to="band-${idx+1}">Next: ${esc(bands[idx+1].short)} ↓</button>`:""}
      </div></section>`).join("")||`<p class="empty" style="margin-top:18px">No matching games found for this filter.</p>`}
    <div class="row" style="justify-content:space-between;margin-top:18px;padding:12px 14px;border:1px dashed var(--line2);border-radius:12px;background:var(--card)">
      <span class="sub" style="margin:0">Missing a console, regional Famiclone, or childhood game from the catalog?</span>
      <button type="button" class="btn sm" data-act="featureSheet" data-cat="Missing Game / Classic">Request a console or game</button>
    </div>
    <div class="pickbar"><div class="in">
      <span class="count" id="pcount">${plural(s.n,"game")}<small>${s.n?`${s.from}–${s.to} · auto-saved`:"Tap a few covers above"}</small></span>
      <span class="minihist" id="phist" aria-hidden="true">${pickBars()}</span>
      <button class="btn primary" data-act="obDone">See my timeline ▸</button></div></div>
  </section>${footer()}`;
  const pb=$("#pickBirthForm");
  if(pb)pb.onsubmit=ev=>{ev.preventDefault();const y=parseInt(($("#pickBirthIn")||{}).value,10);if(y>=1940&&y<=NOW-3){hist.birth=y;hist.era=String(Math.floor(y/10)*10).slice(-2)+"s";hist.stage=null;save();toast(`Grouped eras for ${eraKidLabel(hist)}`);render()}else toast("Enter a 4-digit year like 1984")};
  wireSearch($("#pickQ"),$("#pickR"),p=>{
    if(p.custom){const py=hist.birth?Math.min(NOW,hist.birth+10):NOW-10;addCustom(p.custom,py,1);playBlip(1);toast(`✓ Added “${p.custom}” (${py})`);updatePickBar();return}
    const nl=Math.min(3,levelOf(hist,p)+1);setLevel(p,nl);playBlip(nl);
    $$(`.art[data-id="${CSS.escape(p.id)}"]`).forEach(btn=>refreshTile(btn,p));
    updatePickBar();toast(`${LV[nl].m} ${LV[nl].label}: ${p.title}`);
  },{custom:true,catFirst:true,playOnly:true});
}
function updatePickBar(){
  const s=pickSummary(),c=$("#pcount"),h=$("#phist");
  if(c)c.innerHTML=`${plural(s.n,"game")}<small>${s.n?`${s.from}–${s.to}`:"Nothing yet"}</small>`;
  if(h)h.innerHTML=pickBars();
  $$("section.band[data-bkey]").forEach(sec=>{
    const cnt=$$(".tile.lv1,.tile.lv2,.tile.lv3",sec).length;
    const b=$("[data-bpick]",sec);if(b){b.hidden=!cnt;b.textContent=`${cnt} picked`}
  });
}
function refreshTile(btn,g){const tile=btn.closest(".tile");if(!tile)return;const lv=levelOf(hist,g);
  tile.classList.remove("lv1","lv2","lv3");if(lv)tile.classList.add("lv"+lv);
  const old=btn.querySelector(".lvb");if(old)old.remove();
  if(lv)btn.insertAdjacentHTML("beforeend",`<span class="lvb pop${lv===3?" l3":lv===2?" l2":""}" aria-hidden="true">${LV[lv].m}</span>`);
  btn.setAttribute("aria-label",`${g.title}, ${lv?LV[lv].label:"not played"}`)}

/* ---------- my timeline ---------- */
function lifeStage(age){return age<0?"Before you were born":age<=12?"Childhood":age<=19?"Teens":age<=29?"Your twenties":age<=39?"Your thirties":age<=49?"Your forties":"Fifty and up"}
function stageYearRange(st,birth){
  if(!birth)return null;
  const map={"Before you were born":[birth-10,birth-1],"Childhood":[birth+3,birth+12],"Teens":[birth+13,birth+19],"Your twenties":[birth+20,birth+29],"Your thirties":[birth+30,birth+39],"Your forties":[birth+40,birth+49],"Fifty and up":[birth+50,NOW]};
  const r=map[st];return r?[Math.max(1970,r[0]),Math.min(NOW,r[1])]:null;
}
function lifeStrip(d,{mine=true,workedOnly=false}={}){
  const es=(workedOnly?workedEntries(d):entries(d));
  if(!es.length)return workedOnly?`<div class="card"><p class="empty" style="margin:0">No game credits marked yet. ${mine?`<button type="button" class="link" data-act="makerSheet">Add shipped, live-ops, mod/map or canceled games you worked on ▸</button>`:""}</p></div>`:`<p class="empty">No games yet.</p>`;
  const byY={};es.forEach(x=>{const yr=workedOnly?workedYearOf(x):x.y;(byY[yr]=byY[yr]||[]).push(x)});
  const ys=Object.keys(byY).map(Number);
  const minPlayed=Math.min(...ys),from=minPlayed,to=workedOnly?Math.max(...ys):(mine?NOW:Math.max(...ys));
  let h=(mine&&!workedOnly&&d.birth&&minPlayed>d.birth)?`<div class="ygap" data-yrow="${d.birth}" style="padding-block:6px"><b class="mono">${d.birth===minPlayed-1?d.birth:`${d.birth}–${minPlayed-1}`}</b><button class="link" data-act="year" data-y="${Math.min(minPlayed-1,d.birth+6)}">+ Add earlier childhood games (${d.birth===minPlayed-1?d.birth:`${d.birth}–${minPlayed-1}`})</button></div>`:"";
  const tileMarkup=(x,y)=>{
    const g=x.g,wk=!!x.e.wk,wy=workedYearOf(x);const ttl=g?g.title:x.e.t;
    const relDiff=workedOnly&&g&&g.year!==wy?`<span class="ts">Launched ${g.year} · Live Ops ${wy}</span>`:(g&&g.year!==y?`<span class="ts">Out ${g.year}</span>`:(!g&&wk?`<span class="ts">${x.e.wkType==="mod"?"Mod / Map":"Custom / unshipped"}</span>`:""));
    const roleBits=[x.e.wkType==="mod"?"Mod / Map":"",x.e.role||""].filter(Boolean).join(" · ");
    const roleLine=wk?`<span class="trole">🛠 ${esc(roleBits||"Worked on it")}${!workedOnly&&x.e.wy&&x.e.wy!==x.y?` (${x.e.wy})`:""}</span>`:"";
    const memLine=x.e.mem?`<span class="tmem">“${esc(x.e.mem)}”</span>`:(x.e.mtags&&x.e.mtags.length?`<span class="ts">${esc(x.e.mtags[0])}</span>`:"");
    const grab=mine&&!workedOnly?`<button type="button" class="ygrab" data-y="${x.y}" data-t="${esc(x.e.t)}" title="Drag to another year (or use Up/Down arrow keys)" aria-label="Move ${esc(ttl)} from ${x.y}. Drag to another year or use Up and Down arrow keys.">⠿</button>`:"";
    return `<div class="tile lv${x.lv}${wk?" worked":""}"><div class="artwrap">${grab}<button class="art" data-act="entry" data-y="${x.y}" data-t="${esc(x.e.t)}" ${g?`data-lp="${g.id}"`:""} ${mine?"":`data-ro="1"`} aria-label="${esc(ttl)}, ${wk?"worked on it":LV[x.lv].label}">${coverOfEntry(x.e,x.y,{showYear:false})}${wk?`<span class="wkbadge" title="${x.e.wkType==="mod"?"Mod / Map credit":"Worked on this"}">🛠</span>`:""}<span class="lvb${x.lv===3?" l3":x.lv===2?" l2":""}" aria-hidden="true">${LV[x.lv].m}</span></button></div>${g?`<button type="button" class="tnbtn" data-act="quickLook" data-id="${g.id}">${esc(ttl)}</button>`:`<span class="tn">${esc(ttl)}</span>`}${roleLine}${relDiff}${memLine}</div>`;
  };
  const ageTxt=age=>d.birth?(age<0?`${-age} before you`:age===0?"born":"age "+age):"";
  const renderFullYr=it=>`<div class="tl-yr" data-yrow="${it.y}"><div class="yl"><b>${it.y}</b><span>${ageTxt(it.age)}</span></div><div class="yt">${it.xs.map(x=>tileMarkup(x,it.y)).join("")}${mine&&(workedOnly?`<button class="yadd" data-act="makerSheet" aria-label="Add game credit">+ Credit</button>`:`<button class="yadd" data-act="year" data-y="${it.y}" aria-label="Add games from ${it.y}">+ Add</button>`)||""}</div></div>`;
  const renderCompactYr=it=>`<div class="tl-yr compact" data-yrow="${it.y}"><div class="yl"><b>${it.y}</b>${ageTxt(it.age)?`<span>${ageTxt(it.age)}</span>`:""}${mine&&(workedOnly?`<button class="yadd-in" data-act="makerSheet" aria-label="Add game credit" title="Add game credit">+</button>`:`<button class="yadd-in" data-act="year" data-y="${it.y}" aria-label="Add games from ${it.y}" title="Add games from ${it.y}">+</button>`)||""}</div><div class="yt">${it.xs.map(x=>tileMarkup(x,it.y)).join("")}</div></div>`;
  const renderGap=(a,b,inline=false)=>{
    if(workedOnly)return "";
    const lbl=a===b?String(a):`${a}\u2013${b}`;
    if(inline)return `<div class="ygap-in" data-yrow="${a}"><span>${lbl}</span>${mine?`<button class="link" data-act="year" data-y="${a}" aria-label="Add games from ${lbl}">+ Add</button>`:""}</div>`;
    return `<div class="ygap" data-yrow="${a}"><b>${lbl}</b>${mine?`<button class="link" data-act="year" data-y="${a}">+ ${lbl}</button>`:""}</div>`;
  };
  // Group years into stage buckets so consecutive sparse years (<=2 games) sit inline cleanly
  const stages=[];
  let curSt=null,gapFrom=null;
  const pushGap=y=>{if(gapFrom!=null){if(curSt)curSt.items.push({type:"gap",a:gapFrom,b:y-1});gapFrom=null}};
  for(let y=from;y<=to;y++){
    const age=d.birth?y-d.birth:0,st=(workedOnly||!d.birth)?`${Math.floor(y/10)*10}s`:lifeStage(age);
    const xs=(byY[y]||[]).sort((a,b)=>(!!b.e.wk-!!a.e.wk)||b.lv-a.lv||((b.g&&b.g.pop)||0)-((a.g&&a.g.pop)||0));
    if(!xs.length){if(gapFrom==null)gapFrom=y;continue}
    if(!curSt||curSt.name!==st){pushGap(y);curSt={name:st,items:[]};stages.push(curSt)}
    else pushGap(y);
    curSt.items.push({type:"yr",y,age,xs});
  }
  pushGap(to+1);
  for(const st of stages){
    const sr=!workedOnly&&stageYearRange(st.name,d.birth);
    h+=`<div class="stage">${st.name}</div>${sr?eraMomentsHTML(sr[0],sr[1]):""}`;
    const items=st.items;
    let i=0;
    while(i<items.length){
      const it=items[i];
      if(it.type==="gap"){h+=renderGap(it.a,it.b,false);i++;continue}
      if(it.xs.length>2){h+=renderFullYr(it);i++;continue}
      // Look ahead for consecutive sparse years (allowing single intervening gaps)
      let j=i,yrCount=0,lastYrIdx=i;
      while(j<items.length){
        const nx=items[j];
        if(nx.type==="yr"&&nx.xs.length<=2){yrCount++;lastYrIdx=j;j++}
        else if(nx.type==="gap"&&j+1<items.length&&items[j+1].type==="yr"&&items[j+1].xs.length<=2){j++}
        else break;
      }
      if(yrCount>=2){
        h+=`<div class="tl-inline">`;
        for(let k=i;k<=lastYrIdx;k++){
          const c=items[k];
          h+=c.type==="yr"?renderCompactYr(c):renderGap(c.a,c.b,true);
        }
        h+=`</div>`;
        i=lastYrIdx+1;
      }else{
        h+=renderFullYr(it);
        i++;
      }
    }
  }
  return h;
}
function wireTimelineDrag(root){
  if(!root)return;
  root.querySelectorAll(".ygrab").forEach(handle=>{
    let pid=null,sx=0,sy=0,startScrollY=0,lastX=0,lastY=0,moved=false,targetRow=null,raf=0;
    const tile=handle.closest(".tile"),fromY=+handle.dataset.y,title=handle.dataset.t;
    const clearHi=()=>{root.querySelectorAll(".drop-target").forEach(r=>r.classList.remove("drop-target"));targetRow=null};
    const updateDrop=(cx,cy)=>{
      clearHi();
      let hit=null,fallback=null;
      for(const r of root.querySelectorAll("[data-yrow]")){
        const b=r.getBoundingClientRect();
        if(cy>=b.top-6&&cy<=b.bottom+6){
          if(cx>=b.left-10&&cx<=b.right+10){hit=r;break}
          if(!fallback)fallback=r;
        }
      }
      const chosen=hit||fallback;
      if(chosen&&+chosen.dataset.yrow!==fromY){chosen.classList.add("drop-target");targetRow=chosen}
    };
    const applyPos=()=>{
      if(!moved||!tile)return;
      const dx=lastX-sx,dy=(lastY-sy)+(window.scrollY-startScrollY);
      tile.style.translate=`${dx}px ${dy}px`;
      updateDrop(lastX,lastY);
    };
    const cleanup=()=>{
      cancelAnimationFrame(raf);pid=null;moved=false;document.documentElement.classList.remove("dragging");
      if(tile){tile.classList.remove("lifting");tile.style.translate=""}clearHi();
    };
    const edgeScroll=()=>{
      if(pid==null)return;
      const vh=window.innerHeight;
      if(lastY<80)window.scrollBy(0,-10);else if(lastY>vh-80)window.scrollBy(0,10);
      applyPos();raf=requestAnimationFrame(edgeScroll);
    };
    handle.addEventListener("pointerdown",e=>{
      if(e.button!==0||pid!=null)return;
      pid=e.pointerId;sx=e.clientX;sy=e.clientY;lastX=e.clientX;lastY=e.clientY;startScrollY=window.scrollY;moved=false;
      handle.setPointerCapture(pid);
    });
    handle.addEventListener("pointermove",e=>{
      if(e.pointerId!==pid||!handle.hasPointerCapture(pid))return;
      lastX=e.clientX;lastY=e.clientY;
      const dx=lastX-sx,dy=(lastY-sy)+(window.scrollY-startScrollY);
      if(!moved&&Math.hypot(dx,dy)>4){moved=true;document.documentElement.classList.add("dragging");if(tile)tile.classList.add("lifting");raf=requestAnimationFrame(edgeScroll)}
      applyPos();
    });
    const finish=(e,cancel)=>{
      if(e.pointerId!==pid)return;
      const toEl=!cancel&&moved?targetRow:null,toY=toEl?+toEl.dataset.yrow:null;
      cleanup();
      if(toY&&toY!==fromY){const ny=moveEntryYear(fromY,title,toY);toast(`Moved ${title} to ${ny}`);announceSR(`${title} moved to ${ny}`);const sc=window.scrollY;render();window.scrollTo({top:sc})}
    };
    handle.addEventListener("pointerup",e=>finish(e,false));
    handle.addEventListener("pointercancel",e=>finish(e,true));
    handle.addEventListener("lostpointercapture",()=>cleanup());
    handle.addEventListener("keydown",e=>{
      if(e.key==="Escape"&&pid!=null){e.preventDefault();cleanup();announceSR("Move cancelled");return}
      if(e.key==="ArrowUp"||e.key==="ArrowDown"){
        e.preventDefault();const toY=Math.max(1950,Math.min(NOW,fromY+(e.key==="ArrowUp"?-1:1)));
        if(toY===fromY)return;const ny=moveEntryYear(fromY,title,toY);announceSR(`${title} moved to ${ny}`);
        const sc=window.scrollY;render();window.scrollTo({top:sc});
        const nh=$(`.ygrab[data-y="${ny}"][data-t="${CSS.escape(title)}"]`);if(nh)nh.focus({preventScroll:true});
      }
    });
  });
}
function timelineStats(d){const es=entries(d),ys=new Set(es.map(x=>x.y));const sys=new Set(),yc={};es.forEach(x=>{yc[x.y]=(yc[x.y]||0)+1;sysListOf(x.e,d).forEach(s=>sys.add(s))});
  let peakY=null,peakN=0;for(const [y,n] of Object.entries(yc))if(n>peakN){peakN=n;peakY=+y}
  const from=es.length?Math.min(...ys):null,to=es.length?Math.max(...ys):null,span=es.length?(to-from+1):0;
  return {n:es.length,wk:es.filter(x=>x.e.wk).length,years:ys.size,span,sys:sys.size,fav:es.filter(x=>x.lv===3).length,peakY,peakN,from,to}}
function makerLegacyOf(d){
  const wk=workedEntries(d).sort((a,b)=>workedYearOf(a)-workedYearOf(b));
  const stIds=new Set(d.workedStudios||[]);
  wk.forEach(x=>{if(x.g&&x.e.wkType!=="mod"){const st=findStudio(studio(x.g));if(st)stIds.add(st.id)}});
  const studios=[...stIds].map(id=>STUDIOS.get(id)).filter(Boolean);
  if(!wk.length&&!studios.length)return null;
  const wkSet=new Set(wk.filter(x=>x.g).map(x=>x.g.i));
  const direct=new Set(),reach=new Map(),q=[];
  wk.filter(x=>x.g).forEach(x=>{
    DOWN[x.g.i].forEach(l=>{if(l.minor||l.tier==="disp")return;direct.add(l.to);if(!reach.has(l.to)){reach.set(l.to,{via:x.g,step:1});q.push(l.to)}});
  });
  let qi=0;while(qi<q.length){const v=q[qi++],info=reach.get(v);
    for(const l of DOWN[v]){if(l.minor||l.tier==="disp")continue;if(!reach.has(l.to)){reach.set(l.to,{via:info.via,step:info.step+1});q.push(l.to)}}}
  wkSet.forEach(i=>{direct.delete(i);reach.delete(i)});
  const desc=[...reach.entries()].map(([i,info])=>({g:G[i],via:info.via,step:info.step,s:(info.step===1?24:0)+G[i].pop*10+Math.min(G[i].inf,300)/15})).sort((a,b)=>b.s-a.s||a.g.year-b.g.year);
  const roles=[...new Set(wk.map(x=>x.e.role).filter(Boolean))];
  const mods=wk.filter(x=>x.e.wkType==="mod");
  const unshipped=wk.filter(x=>!x.g&&x.e.wkType!=="mod");
  const yrs=wk.map(workedYearOf);
  return {wk,studios,directCount:direct.size,reachCount:reach.size,desc:desc.slice(0,12),roles,mods,unshipped,from:yrs.length?Math.min(...yrs):null,to:yrs.length?Math.max(...yrs):null};
}
function makerSection(d,mine,pre){
  const mk=pre||makerLegacyOf(d);if(!mk)return "";
  const who=mine?"you":"they",pos=mine?"your":"their";
  const creditedGames=mk.wk.filter(x=>x.g).slice(0,8);
  return `<section class="wrap sec" id="makerSec"><div class="craftcard">
    <div class="sechead" style="margin-bottom:8px"><div><p class="crafteyebrow">🛠 Maker legacy &amp; ripple effect <span class="sr-badge" title="Credits on Played &amp; Made are self-reported by the timeline author — check MobyGames for official credit rolls">Self-reported</span></p>
      <h2 class="h2">${mine?"Games & studios you helped build":`Games & studios ${esc(d.name||"they")} helped build`}</h2>
      <p class="sub" style="margin:4px 0 0">${mk.wk.length?`<b>${plural(mk.wk.length,"project")}</b>${mk.from?` (${mk.from===mk.to?mk.from:mk.from+"–"+mk.to})`:""}`:"Studio alumni"}${mk.mods.length?` (${plural(mk.mods.length,"Mod / Map","Mods / Maps")})`:""}${mk.studios.length?` across <b>${plural(mk.studios.length,"studio")}</b>`:""}${mk.roles.length?` · ${esc(mk.roles.join(", "))}`:""}${mk.reachCount?` · <b>${mk.reachCount.toLocaleString()}</b> later ${mk.reachCount===1?"game traces":"games trace"} back to work ${who} touched.`:""}</p>
    </div><div class="row" style="gap:6px"><button type="button" class="btn sm" data-act="creditsRoll" data-who="${mine?"me":"friend"}">🎬 Roll End Credits</button>${mine?`<button class="btn sm craft" data-act="makerSheet">🛠 Add / edit credits</button>`:""}</div></div>
    ${mk.studios.length?`<div class="makers" style="margin:10px 0 6px">${mk.studios.map(s=>`<button type="button" class="makerbtn worked" data-act="studio" data-st="${esc(s.id)}">🛠 ${flag(s.cc)} ${esc(s.name)}<span>${s.games.length}</span></button>`).join("")}</div>`:""}
    ${creditedGames.length?`<div class="row" style="gap:6px;margin-top:8px"><span class="sync">Official credit rolls:</span>${creditedGames.map(x=>`<a class="chip" style="padding:3px 9px;font-size:11.5px;text-decoration:none" href="${esc(mobyURL(x.g))}" target="_blank" rel="noopener">${esc(x.g.title)} (${workedYearOf(x)})${x.e.wkType==="mod"?" · Mod/Map":""} · MobyGames ↗</a>`).join("")}</div>`:""}
    ${mk.unshipped.length?`<p class="sub" style="margin:8px 0 0;font-size:13px">Includes ${plural(mk.unshipped.length,"unshipped or custom project")} (${mk.unshipped.map(u=>`<b>${esc(u.e.t)}</b>, ${workedYearOf(u)}`).join(" · ")}) — because canceled games still carry years of real craft.</p>`:""}
    ${mk.desc.length?`<h3 class="h3" style="margin-top:16px">The ripple effect: later games ${pos} work helped inspire</h3>
      <p class="sub" style="margin-bottom:10px">${mk.directCount?`${plural(mk.directCount,"direct successor")} borrowed straight from ${pos} games`:""}${mk.reachCount>mk.directCount?`, and ${mk.reachCount.toLocaleString()} across all generations`:""}.</p>
      <div class="recs">${mk.desc.map(r=>`<div class="tile"><button class="art" data-act="game" data-id="${r.g.id}" data-lp="${r.g.id}">${cover(r.g)}</button><button type="button" class="tnbtn" data-act="quickLook" data-id="${r.g.id}">${esc(r.g.title)}</button><span class="why">${r.step===1?"Directly from ":"Traces to "}${esc(r.via.title)}</span></div>`).join("")}</div>`:""}
  </div></section>`;
}
const MECH_MAP={
  "open-world":"Emergent sandboxes & player-driven detours","immersive-sim":"Clockwork systemic worlds that reward improvisation",
  strategy:"Long-horizon planning & 'one more turn' mastery",sim:"Tinkering with living economies & toybox systems",
  rpg:"Deep character builds, party chemistry & world-spanning arcs",jrpg:"Ensemble journeys, turn-based rhythm & unforgettable leitmotifs",
  adventure:"Environmental curiosity, deduction & dialogue wit",puzzle:"Elegant rule-twists & 'aha!' spatial moments",
  fps:"Crisp spatial awareness, momentum & split-second aim",shooter:"High-tempo crowd control & arcade danger",
  platformer:"Kinetic jump-arc feel, timing & secret-hunting",metroidvania:"Lock-and-key world mental mapping",
  roguelike:"High-stakes run mastery & combinatorial synergies",card:"Deck-crafting synergies & probability gambits",
  fighting:"Frame-tight reads, mind-games & couch rivalry",racing:"Slipstream flow & millisecond cornering",
  sports:"Split-second team intuition & living-room trash talk",horror:"Resource scarcity & nerve-testing atmosphere",
  "action-adventure":"Exploration, gadget mastery & boss choreography",arcade:"Pure pick-up-and-play score chasing",
  shmup:"Bullet-weaving trance & pattern memory",mmo:"Shared guild rituals & persistent worlds",
  "battle-royale":"High-tension survival & shrinking-circle improvisation",survival:"Scavenging, shelter-building & respect for the wild"
};
const COZY_IDS=new Set(["stardew-valley","animal-crossing","animal-crossing-new-horizons","harvest-moon","the-sims","the-sims-2","nintendogs","spiritfarer","unpacking","a-short-hike","dorfromantik","slime-rancher","dave-the-diver","dredge","journey","minecraft","katamari-damacy","powerwash-simulator","abzu","gris"]);
const RITUAL_IDS=new Set(["tetris","minesweeper","microsoft-solitaire","candy-crush-saga","threes","2048","balatro","slay-the-spire","vampire-survivors","hearthstone","marvel-snap","the-battle-of-polytopia","pok-mon-go","wordle","clash-royale","clash-of-clans","brawl-stars","bejeweled","brain-age","mini-metro","plants-vs-zombies","tetris-99","flappy-bird","angry-birds","fruit-ninja","cut-the-rope"]);
const CHILDHOOD_COMBOS=[
  {"k":"splitscreen","name":"4-Player Split-Screen Veteran","note":"No Oddjob, blue-shell diplomacy, and taped cardboard dividers.","req":["goldeneye-007"],"any":["mario-kart-64","super-mario-kart","super-smash-bros-melee","halo-combat-evolved","perfect-dark","mario-party"]},
  {"k":"lanparty","name":"CRT LAN-Party Hauler","note":"Lugging a 25-kg monitor up stairs for de_dust2 and midnight pizza.","any2":["counter-strike","counter-strike-source","half-life","quake","quake-iii-arena","unreal-tournament","starcraft","battlefield-1942","team-fortress-classic","warcraft-iii"]},
  {"k":"floppy","name":"Floppy-Swap Survivor","note":"Insert Disk 4 of 11. Amiga drive clicks etched permanently in memory.","any2":["lemmings","the-secret-of-monkey-island","sensible-soccer","sensible-world-of-soccer","pinball-dreams","speedball-2","defender-of-the-crown","another-world","turrican-ii","cannon-fodder"],"sys3":["Amiga","Atari ST"]},
  {"k":"cartblower","name":"Cartridge-Blower Class of '88","note":"Blow on the pins, wiggle twice, hold Reset while powering off.","any2":["super-mario-bros","super-mario-bros-2","super-mario-bros-3","duck-hunt","contra","mega-man-2","mega-man-3","castlevania","metroid","zelda","punch-out","excitebike","tetris"],"sys3":["NES"]},
  {"k":"jrpgtears","name":"90s JRPG Heartbreak Club","note":"Still gets goosebumps from a single 16-bit piano or flute leitmotif.","any2":["chrono-trigger","final-fantasy-vi","final-fantasy-vii","final-fantasy-viii","final-fantasy-ix","final-fantasy-x","earthbound","secret-of-mana","xenogears","suikoden-ii","dragon-quest-viii-journey-of-the-cursed-king","persona-4","persona-5"]},
  {"k":"godmayor","name":"2 A.M. God-View Mayor","note":"Reticulating splines and 'just one more turn' until the birds chirp.","any2":["simcity","simcity-2000","simcity-4","rollercoaster-tycoon","rollercoaster-tycoon-2","civilization","civilization-ii","civilization-iv","civilization-v","civilization-vi","theme-hospital","age-of-empires-ii","heroes-of-might-and-magic-iii","cities-skylines"]},
  {"k":"shareware","name":"Shareware Floppy Smuggler","note":"Installed Episode 1 from a magazine cover disk onto the family 486.","any2":["doom","doom-ii","wolfenstein-3d","quake","duke-nukem-3d","commander-keen","jazz-jackrabbit","heretic"]},
  {"k":"backseatgb","name":"Backseat Streetlight Commuter","note":"Tilting the olive-green Game Boy screen toward every passing highway lamp.","any2":["tetris","super-mario-land","super-mario-land-2-6-golden-coins","the-legend-of-zelda-link-s-awakening","metroid-ii-return-of-samus","kirby-s-dream-land","pok-mon-red-and-green","pok-mon-gold-and-silver"],"sys3":["Game Boy","Game Boy Color"]},
  {"k":"ps1case","name":"PS1 Jewel-Case Detective","note":"Checked the back of the CD case for Meryl's codec frequency.","any2":["metal-gear-solid","resident-evil","resident-evil-2","silent-hill","final-fantasy-vii","castlevania-symphony-of-the-night","gran-turismo","crash-bandicoot","spyro-the-dragon","tekken-3","tomb-raider"],"sys3":["PlayStation"]},
  {"k":"dorm2000s","name":"Early-2000s Dorm Legend","note":"System Link cables down the hallway and Blood Gulch till dawn.","any2":["halo-combat-evolved","halo-2","halo-3","grand-theft-auto-vice-city","grand-theft-auto-san-andreas","super-smash-bros-melee","guitar-hero","wii-sports","mario-kart-double-dash","ssx-tricky"]},
  {"k":"azeroth","name":"Azeroth & Sanctuary Pilgrim","note":"Stay awhile and listen — then pull aggro in Molten Core.","any2":["world-of-warcraft","diablo","diablo-ii","diablo-iii","warcraft-iii","starcraft","starcraft-ii-wings-of-liberty","hearthstone","overwatch"]},
  {"k":"voxel","name":"Voxel & Torch Architect","note":"Never dig straight down, and always light up the cave.","any2":["minecraft","terraria","roblox","dwarf-fortress","valheim","subnautica","dont-starve","rust","ark-survival-evolved"]},
  {"k":"bonfire","name":"Bonfire Stubbornness Award","note":"Died 47 times, memorized every parry frame, praised the sun.","any2":["dark-souls","dark-souls-ii","dark-souls-iii","elden-ring","bloodborne","sekiro-shadows-die-twice","demon-s-souls","demon-s-souls-2020","lies-of-p","nioh"]},
  {"k":"cozyturnip","name":"Cozy Turnip & Parsnip Steward","note":"Pays off raccoon mortgages and waters crops before breakfast.","any2":["stardew-valley","animal-crossing","animal-crossing-wild-world","animal-crossing-new-leaf","animal-crossing-new-horizons","harvest-moon","dave-the-diver","spiritfarer","dredge","a-short-hike","unpacking","dorfromantik"]},
  {"k":"notebook","name":"Scratchpad Detective","note":"Kept real paper notes beside the keyboard to crack the mystery.","any2":["outer-wilds","return-of-the-obra-dinn","tunic","disco-elysium","baba-is-you","myst","blue-prince","animal-well","the-witness","fez"]},
  {"k":"metroidmap","name":"Backtrack Cartographer","note":"Stared at an unexplored 1% map tile until you found the breakable wall.","any2":["super-metroid","castlevania-symphony-of-the-night","hollow-knight","metroid-prime","metroid-dread","ori-and-the-blind-forest","ori-and-the-will-of-the-wisps","cave-story","dead-cells","blasphemous"]},
  {"k":"onerun","name":"Just-One-More-Run Alchemist","note":"Turned a doomed run into an accidental game-breaking synergy engine.","any2":["hades","hades-ii","slay-the-spire","balatro","spelunky","vampire-survivors","ftl-faster-than-light","inscryption","the-binding-of-isaac","into-the-breach","risk-of-rain-2","dead-cells"]},
  {"k":"aperture","name":"Aperture Science Test Subject","note":"Trusted the Companion Cube, doubted the cake, loved the gravity gun.","any2":["portal","portal-2","half-life","half-life-2","left-4-dead","left-4-dead-2","team-fortress-2","counter-strike","garrys-mod"]},
  {"k":"yellowcart","name":"9999-in-1 Yellow Cart Alumni","note":"Defended the eagle base in Tanki on a Saturday morning CRT.","req":["battle-city"],"any":["contra","chip-n-dale-rescue-rangers","darkwing-duck","ducktales","adventure-island","super-mario-bros"],"sysAny":["Dendy","Subor"]},
  {"k":"quarter","name":"Quarter-on-the-Bezel Challenger","note":"Learned quarter-circle-forward before long division.","any2":["street-fighter-ii","street-fighter-iv","street-fighter-6","mortal-kombat","mortal-kombat-ii","mortal-kombat-11","tekken","tekken-3","tekken-5","tekken-7","virtua-fighter","soulcalibur","nba-jam","marvel-vs-capcom-2-new-age-of-heroes","super-smash-bros-ultimate"]},
  {"k":"punkcombo","name":"Punk-Soundtrack Combo Chaser","note":"One guitar riff instantly teleports you back to the Warehouse.","any2":["tony-hawk-s-pro-skater","tony-hawk-s-pro-skater-2","tony-hawk-s-pro-skater-3","tony-hawks-pro-skater-4","tony-hawks-underground","ssx-tricky","burnout-3-takedown","burnout-paradise","wipeout","wipeout-2097","crazy-taxi","jet-set-radio","mirrors-edge","skate-3"]},
  {"k":"squadcomms","name":"Squad-Comms Field Medic","note":"Compass bearings at 240°, scarce bandages, unforgettable emergent stories.","any2":["dayz","dayz-standalone","dayz-badlands","pubg","hell-let-loose","hell-let-loose-vietnam","battlefield-1942","battlefield-2","battlefield-bad-company-2","battlefield-3","battlefield-1","arma-2","arma-3","tarkov","project-reality","squad"]},
  {"k":"poolladder","name":"Benevolent (Mostly) Pool Architect","note":"Built dream mansions, bustling hospitals, and suspiciously doorless rooms.","any2":["the-sims","the-sims-2","the-sims-3","the-sims-4","theme-hospital","theme-park","simcity","rollercoaster-tycoon","cities-skylines","zoo-tycoon","planet-coaster"]},
  {"k":"rubberchicken","name":"Point-and-Click Pixel Hunter","note":"Combined a rubber chicken with a pulley on every hotspot in sight.","any2":["the-secret-of-monkey-island","monkey-island-2-lechuck-s-revenge","grim-fandango","maniac-mansion","day-of-the-tentacle","myst","broken-sword-the-shadow-of-the-templars","broken-sword","full-throttle","sam-and-max-hit-the-road","kings-quest"]},
  {"k":"campfire","name":"Campfire Party Therapist","note":"Quick-saved before every dialogue wheel to keep the whole crew alive.","any2":["mass-effect","mass-effect-2","mass-effect-3","the-witcher-3-wild-hunt","star-wars-knights-of-the-old-republic","planescape-torment","dragon-age-origins","red-dead-redemption-2","baldur-s-gate-3","cyberpunk-2077","the-last-of-us"]},
  {"k":"zenclimber","name":"Thousand-Death Zen Climber","note":"Wore out the jump button and wore the death counter with pride.","any2":["celeste","super-meat-boy","cuphead","ghosts-n-goblins","battletoads","ninja-gaiden","geometry-dash","getting-over-it-with-bennett-foddy"]},
  {"k":"c64tape","name":"LOAD \"*\",8,1 Bedroom Coder","note":"Waited six minutes of cassette screech — and froze if anyone walked past the desk.","any2":["california-games","international-karate","the-great-giana-sisters","elite","boulder-dash","impossible-mission","wizball","the-last-ninja","last-ninja-2","manic-miner","jet-set-willy","summer-games"],"sys3":["Commodore 64","ZX Spectrum"]},
  {"k":"nordicdemo","name":"Nordic Bedroom Demoscene","note":"Amiga 500, 4-channel Paula trackers, and Swedish/Finnish pixel craft before dawn.","any2":["pinball-dreams","max-payne","battlefield-1942","minecraft","the-battle-of-polytopia","valheim","hotline-miami","baba-is-you","angry-birds","clash-of-clans","alan-wake-2","helldivers-2","it-takes-two","mirrors-edge"]},
  {"k":"blastproc","name":"Blast-Processing Playground Loyalist","note":"Swore Sonic was faster than Mario and defended the 3-button pad at recess.","any2":["sonic-the-hedgehog","sonic-the-hedgehog-2","sonic-the-hedgehog-3","streets-of-rage-2","gunstar-heroes","phantasy-star-iv-the-end-of-the-millennium","golden-axe","altered-beast","shinobi","earthworm-jim","mortal-kombat"],"sys3":["Mega Drive / Genesis"]},
  {"k":"mode7snes","name":"Mode-7 Saturday Morning","note":"Rented cartridges on Friday night and tried to beat them before Blockbuster closed Sunday.","any2":["super-mario-world","the-legend-of-zelda-a-link-to-the-past","donkey-kong-country","super-mario-world-2-yoshi-s-island","f-zero","star-fox","super-mario-kart","super-metroid","chrono-trigger","super-mario-all-stars","street-fighter-ii"],"sys3":["SNES"]},
  {"k":"n64fog","name":"Three-Prong Controller Acrobat","note":"Mastered the Z-trigger, dusted the Rumble Pak, and never fell off Rainbow Road.","any2":["super-mario-64","the-legend-of-zelda-ocarina-of-time","the-legend-of-zelda-majora-s-mask","banjo-kazooie","star-fox-64","diddy-kong-racing","goldeneye-007","mario-kart-64","super-smash-bros"],"sys3":["Nintendo 64"]},
  {"k":"modderlab","name":"Custom-Map & Mod Folder Tinkerer","note":"Spent more hours unpacking .zip mods and custom servers than playing vanilla campaigns.","any2":["garrys-mod","desert-combat","natural-selection","defense-of-the-ancients","dayz","counter-strike","the-elder-scrolls-v-skyrim","doom","warcraft-iii","minecraft","factorio","rimworld"]},
  {"k":"siblingcoop","name":"Sibling Couch Co-Op Survivor","note":"Screamed 'PASS THE ONIONS!' and swore the second controller wasn't unplugged.","any2":["overcooked","overcooked-2","it-takes-two","castle-crashers","littlebigplanet","littlebigplanet-2","mario-party","portal-2","streets-of-rage-2","contra","battletoads","chip-n-dale-rescue-rangers","new-super-mario-bros-wii","lego-star-wars-the-complete-saga"]},
  {"k":"roadtriphandheld","name":"AA-Battery Road-Trip Tactician","note":"Brought a pocketful of spare batteries and traded link-cable monsters across the back seat.","any2":["pok-mon-red-and-green","pokemon-yellow","pok-mon-gold-and-silver","pokemon-crystal","pokemon-ruby-and-sapphire","pokemon-heartgold-and-soulsilver","pokemon-black-and-white","pokemon-sun-and-moon","advance-wars","golden-sun","fire-emblem","mario-kart-ds","the-legend-of-zelda-the-minish-cap"],"sys3":["Game Boy Advance","Nintendo DS","Nintendo 3DS"]},
  {"k":"nokiathumb","name":"Nokia 3310 & One-Thumb Commuter","note":"Played Snake under a school desk and now sneaks 30-turn matches on the train.","any2":["snake","snake-ii","the-battle-of-polytopia","angry-birds","fruit-ninja","cut-the-rope","monument-valley","threes","2048","flappy-bird","wordle","subway-surfers","temple-run","doodle-jump","jetpack-joyride"]},
  {"k":"supercelltap","name":"Bus-Stop Pocket Empire","note":"Timed shields, clan wars, and crop harvests around lunch breaks for years.","any2":["clash-of-clans","clash-royale","brawl-stars","hay-day","boom-beach","candy-crush-saga","pok-mon-go","plants-vs-zombies","the-battle-of-polytopia","genshin-impact","hearthstone","marvel-snap"]},
  {"k":"windows95break","name":"Windows 95 Coffee-Break Pro","note":"Learned right-click precision from Minesweeper and spacebar nudges from Space Cadet.","any2":["minesweeper","microsoft-solitaire","3d-pinball-for-windows-space-cadet","skifree","chips-challenge","bejeweled","peggle","plants-vs-zombies","zuma"]},
  {"k":"goldenarcade","name":"Coin-Op Cabinet High-Score Ghost","note":"Still hears the attract-mode bleeps and smells pizza parlor carpet on cue.","any2":["space-invaders","galaga","donkey-kong","frogger","centipede","asteroids","defender","joust","dig-dug","ms-pac-man","pac-man","pong","breakout","q-bert","tempest"],"sys3":["Arcade","Atari 2600"]},
  {"k":"ps2monolith","name":"PS2 Blue-Light Night Owl","note":"Stared at the floating memory-card towers praying the scratched disc would boot.","any2":["shadow-colossus","ico","okami","katamari-damacy","god-of-war","god-of-war-ii","devil-may-cry","kingdom-hearts","jak-and-daxter","ratchet-clank","sly-cooper-and-the-thievius-raccoonus","gta3","grand-theft-auto-vice-city","grand-theft-auto-san-andreas","metal-gear-solid-2","metal-gear-solid-3","final-fantasy-x"],"sys3":["PlayStation 2"]},
  {"k":"lobby360","name":"2007 Headset Lobby Graduate","note":"Still remembers the exact map veto countdown and red-ring towel rituals.","any2":["call-of-duty-4-modern-warfare","call-of-duty-world-at-war","call-of-duty-modern-warfare-2","call-of-duty-black-ops","call-of-duty-black-ops-ii","halo-3","halo-reach","gears-of-war","gears-of-war-2","left-4-dead","bioshock","borderlands","grand-theft-auto-iv"],"sys3":["Xbox 360"]},
  {"k":"plasticguitar","name":"Living-Room Plastic Rock Star","note":"Five colored fret buttons, sore wrists on Through the Fire and Flames, zero regrets.","any2":["guitar-hero","guitar-hero-ii","guitar-hero-iii","rock-band","dance-dance-revolution","just-dance","just-dance-2","just-dance-3","just-dance-4","parappa-the-rapper","beat-saber","elite-beat-agents","taiko-no-tatsujin","singstar","wii-sports"]},
  {"k":"flashlighthorror","name":"Zero-Ammo Flashlight Holder","note":"Checked every dark corner twice, saved ink ribbons, and jumped at every pipe rattle.","any2":["resident-evil","resident-evil-2","resident-evil-4","resident-evil-7-biohazard","resident-evil-village","silent-hill","silent-hill-2","dead-space","dead-space-2","amnesia-the-dark-descent","alien-isolation","outlast","phasmophobia","alan-wake-2","five-nights-at-freddys"]},
  {"k":"ventcrawler","name":"0451 Air-Vent Ghost","note":"Always tries 0451 on the very first keypad and stacks crates just to skip the front door.","any2":["deus-ex","system-shock-2","thief-the-dark-project","dishonored","dishonored-2","bioshock","bioshock-infinite","prey-2017","hitman","hitman-2","tom-clancys-splinter-cell","tom-clancys-splinter-cell-chaos-theory"]},
  {"k":"factorybelt","name":"Conveyor-Belt Bottleneck Auditor","note":"Planned to fix one iron smelter at 9 P.M. and looked up at sunrise.","any2":["factorio","satisfactory","dyson-sphere-program","rimworld","dwarf-fortress","oxygen-not-included","minecraft","rollercoaster-tycoon"]},
  {"k":"mapstaring","name":"Spreadsheet & Border-Gore Monarch","note":"Called 400 hours 'still finishing the tutorial' while redrawing 15th-century Europe.","any2":["europa-universalis-iv","crusader-kings-ii","crusader-kings-iii","hearts-of-iron-iv","stellaris","total-war-shogun-2","rome-total-war","sid-meiers-alpha-centauri","civilization-v","civilization-vi"]},
  {"k":"xcom95","name":"95%-Shot-Missed Tactician","note":"Named every squad member after real friends — and silently mourned each permadeath.","any2":["ufo-enemy-unknown","xcom-enemy-unknown","xcom-2","into-the-breach","fire-emblem","fire-emblem-three-houses","advance-wars","heroes-of-might-and-magic-iii","final-fantasy-tactics"]},
  {"k":"footballpitch","name":"Late-Night Digital Manager","note":"Signed an obscure 17-year-old wonderkid and celebrated a 90th-minute winner like the real cup.","any2":["sensible-world-of-soccer","sensible-soccer","fifa-road-to-world-cup-98","fifa-12","fifa-14","fifa-17","fifa-18","fifa-19","fifa-20","fifa-21","fifa-22","fifa-23","ea-sports-fc-24","pro-evolution-soccer-6","football-manager-2007","championship-manager-0102","rocket-league"]},
  {"k":"apexracer","name":"Apex-Clipping Time-Trialist","note":"Shaved 0.04 seconds off a ghost car at 1 A.M. just to climb one leaderboard spot.","any2":["gran-turismo","gran-turismo-2","gran-turismo-3","gran-turismo-4","gran-turismo-5","forza-horizon-3","forza-horizon-4","forza-horizon-5","need-for-speed-underground","need-for-speed-most-wanted","mario-kart-8","mario-kart-8-deluxe","mario-kart-wii","daytona-usa","out-run","trackmania-nations","burnout-3-takedown"]},
  {"k":"openhorizon","name":"Distracted Side-Quest Wanderer","note":"Swore to finish the main quest tonight — spent four hours chasing glowing hills instead.","any2":["the-legend-of-zelda-breath-of-the-wild","the-legend-of-zelda-tears-of-the-kingdom","the-elder-scrolls-iii-morrowind","the-elder-scrolls-iv-oblivion","the-elder-scrolls-v-skyrim","the-witcher-3-wild-hunt","red-dead-redemption","red-dead-redemption-2","cyberpunk-2077","ghost-of-tsushima","horizon-zero-dawn","grand-theft-auto-v","assassin-s-creed-ii","marvel-s-spider-man"]},
  {"k":"spacesim","name":"Star-Chart Cockpit Pilot","note":"Balanced shield power to forward deflectors and plotted orbital burns by hand.","any2":["elite","elite-dangerous","x-wing","tie-fighter","wing-commander","freelancer","kerbal-space-program","no-mans-sky","eve-online","homeworld","star-fox-64","ftl-faster-than-light"]},
  {"k":"indiefeelings","name":"2 A.M. Indie Credits Weeper","note":"Finished a four-hour indie game in one sitting and stared silently at the end scroll.","any2":["undertale","journey","life-is-strange","to-the-moon","firewatch","what-remains-of-edith-finch","night-in-the-woods","kentucky-route-zero","gris","spiritfarer","outer-wilds","celeste"]},
  {"k":"esportsqueue","name":"One-More-Ranked-Match Believer","note":"Swore 'can't end on a loss' at midnight — and couldn't end on a win streak either.","any2":["league-of-legends","dota-2","overwatch","valorant","apex-legends","fortnite-br","rocket-league","counter-strike-global-offensive","counter-strike-2","starcraft","tom-clancy-s-rainbow-six-siege","pubg"]},
  {"k":"lootgoblin","name":"Glowing-Beam Loot Hoarder","note":"Spent twenty minutes comparing +1.4% crit rolls before dismantling half the backpack.","any2":["diablo-ii","diablo-iii","diablo-iv","path-of-exile","borderlands-2","destiny","destiny-2","warframe","monster-hunter-world","monster-hunter-rise","world-of-warcraft"]},
  {"k":"crpgmanual","name":"Spiral-Bound RPG Manual Reader","note":"Read the spell tables on the bus ride home before even reaching character creation.","any2":["baldur-s-gate","baldur-s-gate-ii","baldur-s-gate-3","planescape-torment","fallout","fallout-2","fallout-3","fallout-new-vegas","disco-elysium","dragon-age-origins","divinity-original-sin-ii"]},
  {"k":"mmoguild","name":"Early-MMO Guild Archivist","note":"Still remembers their first server's trade-chat regulars and midnight boss timers.","any2":["ultima-online","everquest","runescape","world-of-warcraft","eve-online","guild-wars","star-wars-galaxies","city-of-heroes","maplestory","habbo-hotel","club-penguin"]},
  {"k":"partychaos","name":"Voice-Chat Trust Breaker","note":"Accused their best friend in Emergency Meeting and laughed until nobody could breathe.","any2":["among-us","lethal-company","helldivers-2","fall-guys","the-jackbox-party-pack","goose-goose-duck","mario-party","wii-sports","wii-sports-resort","super-smash-bros-ultimate","mario-kart-8-deluxe"]},
  {"k":"vrpioneer","name":"Living-Room Boundary Puncher","note":"Accidentally clipped a ceiling lamp trying to flick a wrist-grab in VR.","any2":["half-life-alyx","beat-saber","superhot","walkabout-mini-golf","the-walking-dead-saints-and-sinners","echo-vr"]},
  {"k":"ugcbuilder","name":"Player-Made World Hopper","note":"Lived inside community servers, islands, and roleplay cities built by other players.","any2":["roblox","minecraft","garrys-mod","fortnite-creative-uefn","hypixel-skyblock","fivem-gta-rp","adopt-me","brookhaven-rp","dreams","super-mario-maker","littlebigplanet"]},
  {"k":"dsstylus","name":"Stylus-Tapping Dual-Screen Era","note":"Blew into the DS mic, trained their brain age, and lost the plastic stylus twice.","any2":["brain-age","nintendogs","mario-kart-ds","phoenix-wright-ace-attorney","professor-layton-and-the-curious-village","elite-beat-agents","animal-crossing-wild-world","new-super-mario-bros","the-legend-of-zelda-phantom-hourglass"],"sys3":["Nintendo DS"]},
  {"k":"cozypowerwash","name":"Zen Chore & Oddly Satisfying Club","note":"Relaxed after work by tidying virtual rooms, washing vans, and arranging puzzle tiles.","any2":["powerwash-simulator","unpacking","dorfromantik","a-short-hike","stardew-valley","animal-crossing-new-horizons","mini-metro","tetris-effect","katamari-damacy","animal-crossing"]}
];
function unlockedCombos(d){
  const es=entries(d).filter(x=>x.g);
  const idSet=new Set(es.map(x=>x.g.id));
  const ownSet=new Set([...(d.owned||[]),...es.flatMap(x=>sysListOf(x.e,d))]);
  const sysCounts=new Map();
  for(const x of es){for(const s of new Set(sysListOf(x.e,d)))sysCounts.set(s,(sysCounts.get(s)||0)+1)}
  const exact=[],bySys=[];
  for(const cb of CHILDHOOD_COMBOS){
    let ok=false;
    if(cb.req){
      const hasReq=cb.req.every(id=>idSet.has(id));
      const hasAny=(!cb.any||cb.any.some(id=>idSet.has(id)))||(cb.sysAny&&cb.sysAny.some(s=>ownSet.has(s)));
      ok=hasReq&&hasAny;
    }else if(cb.any2){
      let hits=0;for(const id of cb.any2)if(idSet.has(id))hits++;
      ok=hits>=2;
    }
    if(ok){exact.push(cb);continue}
    if(cb.sys3&&cb.sys3.some(s=>(sysCounts.get(s)||0)>=3))bySys.push(cb);
  }
  return [...exact,...bySys];
}
function gamerPersonaOf(d){
  const es=entries(d).filter(x=>x.g);if(es.length<4)return null;
  const gw={};es.forEach(x=>x.g.gen.forEach((gi,k)=>{const key=GEN[gi].k;gw[key]=(gw[key]||0)+x.lv*(k?0.5:1)}));
  const topG=Object.entries(gw).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const earlyComp=es.filter(x=>x.g.plats.some(p=>/Amiga|Commodore 64|Atari ST|ZX Spectrum|PC \(DOS\)/.test(p))).length/es.length;
  const coopTags=es.filter(x=>(x.e.mtags||[]).some(t=>/co-op|friends|siblings|LAN|Arcade/i.test(t))).length;
  const cozyHits=es.filter(x=>COZY_IDS.has(x.g.id)).length;
  const ritualHits=es.filter(x=>RITUAL_IDS.has(x.g.id)||x.g.gen.some(gi=>GEN[gi].k==="puzzle"||GEN[gi].k==="card")).length;
  const mobileShare=es.filter(x=>x.g.plats.some(p=>/iPhone|Android|Browser|Game Boy|Nintendo DS|Switch/.test(p))).length/es.length;
  const avgPop=es.reduce((s,x)=>s+x.g.pop,0)/es.length;
  const decades=new Set(es.map(x=>Math.floor(x.y/10))).size;
  const g0=topG[0]||"arcade",g1=topG[1]||"action-adventure";
  let title="The Renaissance World-Hopper",sketch="You refuse to live in just one genre — bouncing between tight arcade craft, sprawling worlds, and sharp design hooks across eras.";
  if(cozyHits>=2&&(cozyHits/es.length>=0.24||(g0==="sim"&&!["fps","horror","battle-royale"].includes(g1)))){
    title="The Cozy World-Tender";
    sketch="You treat games as warm places to tend, decorate, and return to at the end of a loud day. Gentle loops, seasonal rhythms, and kindness toward virtual neighbors beat high-stress leaderboards every time.";
  }else if((ritualHits>=3&&ritualHits/es.length>=0.34)||(["puzzle","card"].includes(g0)&&mobileShare>=0.4)){
    title="The Everyday Ritualist";
    sketch="You love crisp, deeply replayable games that fit cleanly beside morning coffee or a late-evening unwind — elegant rulesets, tactile card/puzzle combos, and satisfying daily mastery without 80-hour bloat.";
  }else if(earlyComp>=0.38){
    title="The Floppy-Box Pioneer & Tinkerer";
    sketch="Raised on whirring disk drives, bedroom-coded ingenuity, and European/PC home-computer magic. You love games with personality, rough-edged ambition, and systems that trust you to figure things out without hand-holding.";
  }else if(["strategy","sim"].includes(g0)&&["strategy","sim","rpg","card"].includes(g1)){
    title="The 2 A.M. Systems Architect";
    sketch="Give you an interlocking set of rules, a map, or an economy and time ceases to exist. You get your deepest joy from nudging complex systems until your own plan clicks into motion.";
  }else if(["immersive-sim","open-world","survival"].includes(g0)){
    title="The Sandbox Improviser";
    sketch="You treat main quests as polite suggestions. You gravitate toward living worlds with physics, ecology, and emergent chaos where the best story is the unscripted stunt you pulled off yourself.";
  }else if(["rpg","jrpg","adventure"].includes(g0)){
    title="The Story-Haunted Wanderer";
    sketch="For you, a great game is a place you actually lived in for a season of your life. Characters, music cues, and quiet towns stick in your memory decades after the credits roll.";
  }else if(coopTags>=3||["sports","fighting","party","racing"].includes(g0)){
    title="The Living-Room Instigator";
    sketch="Games for you are electricity between people in the same room — last-second goals, passed controllers, rematches nobody agreed to end, and rivalries friends still bring up years later.";
  }else if(["platformer","arcade","shmup","roguelike"].includes(g0)){
    title="The Pure-Flow Kineticist";
    sketch="You judge a game in the first ten seconds by how good it feels in your hands. Tight controls, honest challenge, and entering a zen flow state beat bloated cutscenes every time.";
  }else if(["fps","shooter","battle-royale"].includes(g0)){
    title="The High-Stakes Tactician";
    sketch="You thrive when the pulse goes up — reading spaces fast, flanking cleanly, and turning chaotic firefights or arena showdowns into stories.";
  }
  if(avgPop<3.25)sketch+=" You also have a true crate-digger's eye for cult gems outside the obvious blockbusters.";
  else if(decades>=4)sketch+=` Spanning ${decades} decades of play, you've watched the medium grow up firsthand.`;
  const mechs=topG.slice(0,3).map(k=>MECH_MAP[k]).filter(Boolean);
  return {title,sketch,mechs,topGenres:topG.slice(0,3)};
}
function personaSection(d,mine,dx){
  const p=gamerPersonaOf(d),combos=unlockedCombos(d);
  if(!p&&!combos.length)return "";
  const who=mine?"Your":"Their",subWho=mine?"you":"they";
  return `<section class="wrap sec"><div class="personacard">
    ${p?`<p class="eyebrow" style="margin-bottom:4px">${who} player profile</p>
    <h2 class="h2">${esc(p.title)}</h2>
    <p style="margin:6px 0 12px;font-size:15px;color:var(--ink);max-width:68ch;line-height:1.5">${esc(p.sketch)}</p>
    ${p.mechs.length?`<div class="row" style="gap:6px"><span class="sync">Core play loops ${subWho} gravitate toward:</span>${p.mechs.map(m=>`<span class="pill">${esc(m)}</span>`).join("")}</div>`:""}`:""}
    ${combos.length?`<div style="${p?"margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)":""}">
      <p class="eyebrow" style="margin-bottom:6px">Childhood Combo Stamps · ${combos.length} unlocked</p>
      <div class="combo-shelf">${combos.slice(0,8).map(c=>`<div class="combo-stamp"><span class="cs-k">★ Stamp</span><b>${esc(c.name)}</b><small>${esc(c.note)}</small></div>`).join("")}</div>
    </div>`:""}
  </div></section>`;
}
function pyramidSection(d,mine,dx){
  const es=entries(d);if(es.length<5||!d.birth)return "";
  const decs=[[2020,"2020s"],[2010,"2010s"],[2000,"2000s"],[1990,"1990s"],[1980,"1980s"],[1950,"1950s–70s"]];
  const tiers=decs.map(([f,lbl])=>{const t=f===1950?1979:f+9;const n=es.filter(x=>x.y>=f&&x.y<=t).length;return {lbl,n}}).filter(t=>t.n>0);
  const ancN=dx?dx.allCount:0;
  const stages=[["Childhood",0,12],["Teens",13,19],["20s",20,29],["30s",30,39],["40s+",40,90]].filter(([,a])=>d.birth+a<=NOW);
  const sCounts=stages.map(([lbl,a,b])=>({lbl,n:es.filter(x=>{const ag=x.y-d.birth;return ag>=a&&ag<=b}).length}));
  const maxS=Math.max(1,...sCounts.map(s=>s.n));
  const youthPeak=Math.max(...sCounts.slice(0,2).map(s=>s.n),0),nowStage=sCounts[sCounts.length-1];
  const dipped=mine&&sCounts.length>=3&&youthPeak>=6&&nowStage.n<=youthPeak*0.45;
  return `<section class="wrap sec"><div class="hgrid">
    <div class="card"><p class="eyebrow">Standing on giants</p><h3 class="h3">${mine?"Your":"Their"} Pyramid of Craft</h3>
      <p class="sub">Every newer game at the top rests on decades of earlier design experiments underneath.</p>
      <div class="pyrstack">
        ${tiers.map((t,i)=>`<div class="pyrtier" style="width:${Math.min(100,38+i*(56/Math.max(1,tiers.length)))}%"><span>${t.lbl}</span><b>${plural(t.n,"game")}</b></div>`).join("")}
        ${ancN?`<div class="pyrtier" style="width:100%;background:var(--craft-soft);border-color:var(--craft)"><span>Historical foundation behind them</span><b style="color:var(--craft)">${ancN.toLocaleString()} ancestor games</b></div>`:""}
      </div>
    </div>
    <div class="card"><p class="eyebrow">Playfulness across life</p><h3 class="h3">When ${mine?"you":"they"} explored the most worlds</h3>
      <p class="sub">Games logged on ${mine?"your":"their"} timeline by stage of life.</p>
      <div class="pcurve">${sCounts.map(s=>`<div class="pcol"><span>${s.n}</span><i style="height:${s.n?Math.max(10,Math.round(s.n/maxS*100)):4}%;opacity:${s.n?1:.25}"></i><small>${s.lbl}</small></div>`).join("")}</div>
      ${dipped?`<p class="sub" style="margin:6px 0 0;color:var(--ink2)"><b>Notice that dip?</b> Most of us sampled dozens of worlds growing up and far fewer once adult life sped up. Curiosity doesn't fade — it just needs compact, high-craft games that respect an evening. Check out the <b>Indie Gems</b> below.</p>`
        :`<p class="sub" style="margin:6px 0 0">${mine?"Keep adding forgotten favorites anytime — ":"A lifetime of curiosity across "}${plural(es.length,"game")}.</p>`}
    </div>
  </div></section>`;
}
function storeLinksHTML(g){
  const q=encodeURIComponent(g.title);
  const gog=g.year<=2015?`<a class="storetag" href="https://www.gog.com/en/games?query=${q}" target="_blank" rel="noopener" title="Search DRM-free classic preservation on GOG.com">GOG ↗</a>`:"";
  const stm=`<a class="storetag" href="https://store.steampowered.com/search/?term=${q}" target="_blank" rel="noopener" title="Search on Steam">Steam ↗</a>`;
  return `<div class="storelinks">${gog}${stm}</div>`;
}
function matchTop10Entry(favs,k){
  return favs.find(f=>f.g&&(f.g.n===k||f.g.id===k||norm1(f.g.title)===k))||null;
}
function pinnedFavoritesOf(d,max=4){
  const es=entries(d);
  const favs=es.filter(x=>x.lv===3).sort((a,b)=>((b.g&&b.g.pop)||0)-((a.g&&a.g.pop)||0)||((b.g&&b.g.inf)||0)-((a.g&&a.g.inf)||0)||a.y-b.y);
  const t10=(d.top10||[]).map(k=>matchTop10Entry(favs,k)).filter(Boolean);
  const seen=new Set(t10);
  const backfilled=[...t10,...favs.filter(f=>!seen.has(f))];
  if(backfilled.length<max){
    const rest=es.filter(x=>!seen.has(x)&&x.lv<3).sort((a,b)=>b.lv-a.lv||((b.g&&b.g.pop)||0)-((a.g&&a.g.pop)||0));
    backfilled.push(...rest);
  }
  return backfilled.slice(0,max);
}
function renderTimeline(m){
  const d=hist,st=timelineStats(d),mk=makerLegacyOf(d);
  const first=store.get("ib2-revealed")!==true&&st.n>0;
  const dx=st.n>=3?dnaOf(d):null;
  const persona=gamerPersonaOf(d);
  const wkMode=state.tlMode==="worked"&&!!mk;
  const eraLbl=eraKidLabel(d);
  const pinned4=pinnedFavoritesOf(d,4);
  const hasStash=!!store.get("ib3-stashed-hist");
  const yrSpanTxt=st.from&&st.from!==st.to?`${st.from}–${st.to}`:st.from?String(st.from):"";
  const teaser=dx&&dx.oldest?`<p class="sub" style="margin:8px 0 0;font-size:13.5px">Traces back to <button type="button" class="link" style="font-weight:600;font-size:inherit" data-act="toDna">${dx.allCount.toLocaleString()} earlier games</button>${dx.top[0]?` · biggest root: <a href="#${dx.top[0].g.id}" style="font-weight:600">${esc(dx.top[0].g.title)}</a>`:""}.</p>`:"";
  m.innerHTML=`<section class="wrap">
      ${challengerBannerHTML()}
      <div class="idcard">
        <div style="min-width:0">
          <div class="idcard-top">
            <h1 class="idcard-name">${wkMode?esc(d.name?d.name+"'s work in games":"Games I helped build"):esc(d.name?d.name+"'s games":"My life in games")}</h1>
            ${eraLbl?`<span class="idcard-era">${esc(eraLbl)}</span>`:""}
          </div>
          ${persona?`<p class="idcard-arch">${esc(persona.title)}</p>`:""}
          <div class="idcard-stats">
            <span><b>${st.n}</b> games</span>
            ${st.wk?`<span><b style="color:var(--craft)">${st.wk}</b> worked on</span>`:""}
            ${yrSpanTxt?`<span><b>${yrSpanTxt}</b></span>`:""}
            ${st.sys?`<span><b>${st.sys}</b> systems</span>`:""}
            <span><b>${st.fav}</b> favorites</span>
          </div>
          ${teaser}
        </div>
        <div class="idcard-right">
          ${pinned4.length?`<div class="idcard-favs" aria-label="Pinned favorites">${pinned4.map(x=>`<button type="button" class="idcard-fav" data-act="entry" data-y="${x.y}" data-t="${esc(x.e.t)}" title="${esc(x.g?x.g.title:x.e.t)} (${x.y})" aria-label="${esc(x.g?x.g.title:x.e.t)}">${coverOfEntry(x.e,x.y,{showYear:false})}</button>`).join("")}</div>`:""}
          <div class="idcard-acts">
            <button type="button" class="btn sm primary" data-act="share">Share</button>
            <button type="button" class="morebtn" id="tlMoreBtn" popovertarget="tlMoreMenu" aria-label="More timeline actions" title="More actions">⋯</button>
          </div>
        </div>
      </div>
      <div id="tlMoreMenu" popover="auto" class="popmenu" aria-label="Timeline actions">
        <button type="button" class="popitem" data-act="obAgain" data-close-pop="tlMoreMenu"><span>Pick more games</span><small>▸</small></button>
        <button type="button" class="popitem" data-act="steamImport" data-close-pop="tlMoreMenu"><span>Import from Steam</span><small>2s</small></button>
        <button type="button" class="popitem" data-act="poster" data-close-pop="tlMoreMenu"><span>Poster &amp; Box Pile</span><small>4K</small></button>
        <button type="button" class="popitem" data-act="packSheet" data-close-pop="tlMoreMenu"><span>Mood packs</span><small>▸</small></button>
        ${st.fav?`<button type="button" class="popitem" data-act="top10" data-close-pop="tlMoreMenu"><span>Rank top 10</span><small>♥ ${st.fav}</small></button>`:""}
        <hr>
        ${isDevMode()?`<button type="button" class="popitem" data-act="makerSheet" data-close-pop="tlMoreMenu"><span>🛠 Dev credits</span><small>${st.wk||"Add"}</small></button>`
          :`<button type="button" class="popitem" data-act="devModeTog" data-close-pop="tlMoreMenu"><span>Work in games?</span><small>Maker mode</small></button>`}
        <button type="button" class="popitem" data-act="dlJson" data-close-pop="tlMoreMenu"><span>Backup (.json)</span><small>↓</small></button>
        <button type="button" class="popitem" data-act="settings" data-close-pop="tlMoreMenu"><span>Settings</span><small>▸</small></button>
        ${DEV_QUERY&&!hasStash?`<hr><button type="button" class="popitem" data-act="sandboxEnter" data-close-pop="tlMoreMenu"><span>Test new-visitor flow</span><small>dev</small></button>`:""}
      </div>
    </section>
    <section class="wrap" style="margin-top:12px"><div class="search"><input class="input" id="addq" type="search" style="padding-block:8px;font-size:16px" placeholder="Quick-add a game to your timeline…" autocomplete="off" aria-label="Add a game"><div class="results" id="addr" hidden></div></div>
      <div class="row" style="justify-content:space-between;margin-top:7px">
        <div class="row" style="gap:10px"><p class="sync" id="syncmsg" style="margin:0">${esc(syncMsg||"Auto-saved · Drag ⠿ to move a year, or tap a cover for notes.")}</p>
          <a class="link" style="font-size:12.5px" href="#picks">Browse eras &amp; picks ▸</a>
          <button type="button" class="chip" style="padding:3px 9px;font-size:11.5px" data-act="eraMemTog" aria-pressed="${!!state.eraMem}">Headlines: ${state.eraMem?"On":"Off"}</button></div>
        ${mk?`<span class="seg" role="group" aria-label="Timeline filter"><button data-act="tlMode" data-m="all" aria-pressed="${!wkMode}">All games (${st.n})</button><button data-act="tlMode" data-m="worked" aria-pressed="${wkMode}">🛠 Worked on (${st.wk})</button></span>`:""}
      </div></section>
    ${wkMode?makerSection(d,true,mk):""}
    <section class="wrap life" id="tlLife">${lifeStrip(d,{mine:true,workedOnly:wkMode})}</section>
    ${!wkMode?personaSection(d,true,dx):""}
    ${!wkMode&&mk?makerSection(d,true,mk):""}
    ${favSection(d,true)}
    ${specialShelvesSection(d,true)}
    ${pyramidSection(d,true,dx)}
    ${dnaSection(d,true,dx)}
    ${statsSection(d,true)}
    ${footer()}`;
  if(first)store.set("ib2-revealed",true);
  wireTimelineDrag(m);
  wireSearch($("#addq"),$("#addr"),p=>{if(p.custom){openYearSheet(hist.birth?Math.min(NOW,hist.birth+10):NOW-10,p.custom);return}setLevel(p,Math.max(1,levelOf(hist,p)));playBlip(1);const py=entryYearOf(hist,p)||p.year;toast(`Added ${p.title} (${py})`);render()},{custom:true,catFirst:true,playOnly:true});
}
function favSection(d,mine){
  const favs=entries(d).filter(x=>x.lv===3).sort((a,b)=>a.y-b.y);if(!favs.length)return "";
  const t10=(d.top10||[]).map(k=>matchTop10Entry(favs,k)).filter(Boolean);
  const seen=new Set(t10);
  const list=t10.length>=4?t10:[...t10,...favs.filter(f=>!seen.has(f))];
  const showRank=t10.length>=2;
  return `<section class="wrap sec" id="favSec"><div class="sechead"><div><h2 class="h2">${t10.length>=4?(mine?"My top "+t10.length:"Top "+t10.length):"All-time favorites"}</h2><p class="sub">${t10.length>=4?"Ranked.":plural(favs.length,"favorite")+", in the order you played them."}</p></div>${mine?`<div class="row"><button class="btn sm" data-act="boxPile">Box Pile</button><button class="btn sm" data-act="png" data-kind="favs">♥ Save favorites image</button><button class="btn sm" data-act="top10">${t10.length?"Edit top 10":"Rank a top 10"}</button></div>`:""}</div>
    <div class="grid">${list.map((x,i)=>{const g=x.g;return `<div class="tile lv3"><button class="art" data-act="${g?"quickLook":"noop"}" data-id="${g?g.id:""}" ${g?`data-lp="${g.id}"`:""}>${coverOfEntry(x.e,x.y)}${showRank&&i<t10.length?`<span class="lvb l3">${i+1}</span>`:""}</button><span class="tn">${g?`<button type="button" class="tnbtn" data-act="quickLook" data-id="${g.id}">${esc(g.title)}</button>`:esc(x.e.t)}</span><span class="ts">${x.y}${g?" · "+studioBtn(studio(g)):""}</span>${x.e.mem?`<span class="tmem">“${esc(x.e.mem)}”</span>`:""}</div>`}).join("")}</div></section>`;
}
function specialShelvesSection(d,mine){
  const es=entries(d);if(!es.length)return "";
  const harbor=es.filter(x=>(x.e.mtags||[]).some(t=>HARBOR_TAGS.has(t))).sort((a,b)=>a.y-b.y);
  const sweat=es.filter(x=>(x.e.mtags||[]).some(t=>SWEAT_TAGS.has(t))).sort((a,b)=>a.y-b.y);
  const shelfGrid=arr=>`<div class="grid">${arr.map(x=>{const g=x.g;return `<div class="tile lv${x.lv}"><button class="art" data-act="entry" data-y="${x.y}" data-t="${esc(x.e.t)}" ${g?`data-lp="${g.id}"`:""} ${mine?"":"data-ro=\"1\""}>${coverOfEntry(x.e,x.y)}</button><span class="tn">${g?`<button type="button" class="tnbtn" data-act="quickLook" data-id="${g.id}">${esc(g.title)}</button>`:esc(x.e.t)}</span><span class="ts">${x.y}${g?" · "+studioBtn(studio(g)):""}</span>${x.e.mem?`<span class="tmem">“${esc(x.e.mem)}”</span>`:""}</div>`}).join("")}</div>`;
  let out="";
  if(harbor.length){
    out+=`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Lifelines &amp; formative worlds</p><h2 class="h2">Worlds that carried ${mine?"me":"them"} through</h2><p class="sub">Games that helped ${mine?"you":"them"} weather rough seasons or shaped who ${mine?"you":"they"} became.</p></div>${mine?`<button type="button" class="btn sm love" data-act="gratSheet">Thank a maker</button>`:""}</div>${shelfGrid(harbor)}</section>`;
  }
  if(sweat.length){
    out+=`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Palms sweating · Controller survived</p><h2 class="h2">Games that made ${mine?"me":"them"} sweat</h2><p class="sub">Infamous jumps, brutal bosses, and tests of pure stubbornness.</p></div>${mine?`<button type="button" class="btn sm" data-act="openSweatPack">+ Add more brutal classics</button>`:""}</div>${shelfGrid(sweat)}</section>`;
  }
  return out;
}
/* the two halves meet: the ancestors behind the games you played + indie & classic discovery */
function dnaOf(d){
  const mine=entries(d).filter(x=>x.g);const set=new Set(mine.map(x=>x.g.i));const anc=new Map(),all=new Set();
  for(const x of mine){ancestors(x.g.i).forEach(a=>all.add(a));for(const a of nearAncestors(x.g.i)){const o=anc.get(a)||{n:0,w:0,kids:[]};o.n++;o.w+=x.lv;if(o.kids.length<3)o.kids.push(x.g);anc.set(a,o)}}
  const top=[...anc.entries()].map(([i,o])=>({g:G[i],...o,played:set.has(i)})).sort((a,b)=>b.n-a.n||b.w-a.w||a.g.year-b.g.year);
  let oldest=null;all.forEach(i=>{if(!oldest||G[i].year<oldest.g.year)oldest={g:G[i]}});
  const allCount=all.size;
  const gw={};mine.forEach(x=>x.g.gen.forEach((gi,k)=>{gw[gi]=(gw[gi]||0)+x.lv*(k?0.5:1)}));
  const genres=Object.entries(gw).map(([i,w])=>({gen:GEN[i],gi:+i,w})).sort((a,b)=>b.w-a.w);
  const topGenSet=new Set(genres.slice(0,3).map(x=>x.gi));
  const nextUp=[];const seenNext=new Set();
  mine.filter(x=>x.lv>=2).sort((a,b)=>b.lv-a.lv||b.g.pop-a.g.pop).forEach(x=>DOWN[x.g.i].forEach(l=>{const c=G[l.to];if(set.has(c.i)||seenNext.has(c.i)||c.year>NOW)return;seenNext.add(c.i);nextUp.push({g:c,because:x.g,s:c.pop*10+Math.min(c.inf,200)/20+(x.lv===3?8:0)+(l.tier==="dev"?4:0)})}));
  nextUp.sort((a,b)=>b.s-a.s);
  const indiePool=G.filter(g=>!set.has(g.i)&&g.year>=2012&&g.year<=NOW&&g.pop>=2&&g.pop<=3&&g.tree&&playable(g)&&g.gen.some(gi=>topGenSet.has(gi)));
  const indies=indiePool.map(g=>{
    const parentHit=UP[g.i].find(l=>set.has(l.from));
    return {g,why:parentHit?`Inspired by ${G[parentHit.from].title}`:GEN[g.gen[0]].label+" gem",s:(parentHit?30:0)+g.pop*8+UP[g.i].length*3+DOWN[g.i].length*4+(g.img?6:0)};
  }).sort((a,b)=>b.s-a.s).slice(0,8);
  const missed=top.filter(a=>!a.played&&a.g.pop>=3&&a.n>=2).slice(0,8);
  return {top,oldest,genres,nextUp:nextUp.slice(0,8),indies,missed,count:mine.length,allCount};
}
function recTile(g,why,mine,{showStores=false}={}){
  const lv=mine?levelOf(hist,g):0;
  return `<div class="tile${lv?" lv"+lv:""}"><div class="artwrap"><button class="art" data-act="quickLook" data-id="${g.id}" data-lp="${g.id}">${cover(g)}${lv?`<span class="lvb${lv===3?" l3":lv===2?" l2":""}" aria-hidden="true">${LV[lv].m}</span>`:""}</button></div>
    <button type="button" class="tnbtn" data-act="quickLook" data-id="${g.id}">${esc(g.title)}</button>
    <span class="why">${esc(why)}</span>
    ${mine&&playable(g)?`<button type="button" class="qtick${lv?" lv"+lv:""}" data-act="qtick" data-id="${g.id}">${lv?LV[lv].m+" "+LV[lv].label:"+ Played"}</button>`:""}
    ${showStores?storeLinksHTML(g):""}</div>`;
}
function dnaSection(d,mine,pre){
  const x=pre||dnaOf(d);if(x.count<3||!x.top.length)return "";
  const tot=x.genres.reduce((a,b)=>a+b.w,0)||1;
  const who=mine?"your":"their";
  return `<section class="wrap sec" id="dna"><p class="eyebrow">Gaming DNA &amp; discovery</p><h2 class="h2">The games behind ${mine?"your":"their"} games — and what to try next</h2>
    <p class="sub">${mine?"Your":"Their"} games trace back to ${x.allCount.toLocaleString()} earlier games. ${x.oldest?`The oldest root is <b>${esc(x.oldest.g.title)}</b> (${x.oldest.g.year}).`:""}</p>
    <div class="hgrid">
      <div class="card"><h3 class="h3">Biggest influences on ${who} games</h3><p class="sub">How many of ${who} games it inspired, directly or one step removed.</p>
        ${x.top.slice(0,6).map(a=>`<button class="anc" data-act="quickLook" data-id="${a.g.id}">${cover(a.g,{showYear:false})}<span><b>${esc(a.g.title)}</b><small>${a.g.year} · ${a.played?(mine?"you played it":"they played it"):"never played"}</small></span><span class="n">${a.n}<small>of ${x.count}</small></span></button>`).join("")}</div>
      <div class="card"><h3 class="h3">${mine?"Your":"Their"} genres</h3><p class="sub">Weighted by how much ${mine?"you":"they"} played · tap any genre to explore how it evolved.</p>
        <div class="genbar">${x.genres.map(g=>`<i style="width:${(g.w/tot*100).toFixed(2)}%;background:${g.gen.c}" title="${esc(g.gen.label)}"></i>`).join("")}</div>
        <div class="row" style="gap:6px">${x.genres.slice(0,9).map(g=>`<button type="button" class="genpill" data-act="genre" data-g="${esc(g.gen.k)}"><i style="width:9px;height:9px;border-radius:3px;background:${g.gen.c};display:inline-block"></i>${esc(g.gen.label)} <span class="mono muted">${Math.round(g.w/tot*100)}%</span></button>`).join("")}</div>
      </div>
    </div>
    ${x.missed.length?`<h3 class="h3" style="margin-top:22px">Roots ${mine?"you":"they"} never played — and where to play them today</h3>
      <p class="sub">Foundational classics behind several of ${who} favorites. Tap <b>+ Played</b> if you did play one, or tap any cover for details.</p>
      <div class="recs">${x.missed.slice(0,8).map(a=>recTile(a.g,`Behind ${plural(a.n,"of "+who+" games","of "+who+" games")}`,mine,{showStores:true})).join("")}</div>`:""}
    ${x.indies&&x.indies.length?`<h3 class="h3" style="margin-top:22px">Under-the-radar indie gems for ${who} taste</h3>
      <p class="sub">Smaller, high-craft games in ${who} favorite traditions.</p>
      <div class="recs">${x.indies.map(r=>recTile(r.g,r.why,mine,{showStores:true})).join("")}</div>`:""}
    ${x.nextUp.length?`<h3 class="h3" style="margin-top:22px">Spiritual successors to ${who} favorites</h3><p class="sub">Later games that borrowed directly from ${who} top picks.</p>
      <div class="recs">${x.nextUp.map(r=>recTile(r.g,`From ${r.because.title}`,mine,{showStores:true})).join("")}</div>`:""}
  </section>`;
}
function statsSection(d,mine=true){
  const es=entries(d);if(es.length<3)return "";
  const st={},cc={},sy={};let totW=0;
  es.forEach(x=>{const g=x.g;if(g){const s=studio(g);if(s){st[s]=(st[s]||0)+x.lv;totW+=x.lv}if(g.cc)cc[g.cc]=(cc[g.cc]||0)+1}sysListOf(x.e,d).forEach(s=>sy[s]=(sy[s]||0)+1)});
  const top=(o,n)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n);
  const topSt=top(st,8),maxSt=Math.max(1,topSt[0]?topSt[0][1]:1);
  const hwMap=new Map((CULT.hardware||[]).map(h=>[h.sys,h]));
  const sysList=top(sy,10);
  return `<section class="wrap sec" id="odeSec"><div class="sechead"><div><p class="eyebrow">Ode to the makers</p><h2 class="h2">The studios, creators &amp; machines that raised ${mine?"you":esc(d.name||"them")}</h2><p class="sub">Weighted by how deeply ${mine?"you":"they"} played (<b>♥</b> counts 3×, <b>★</b> counts 2×).</p></div><div class="row">${mine?`<button type="button" class="btn sm love" data-act="gratSheet">Thank a maker</button>`:""}<a class="btn sm ghost" href="#world">World map ▸</a>${mine&&sysList.length?`<button type="button" class="btn sm" data-act="png" data-kind="consoles">Save consoles card</button>`:""}</div></div>
    <div class="hgrid">
      <div class="card"><h3 class="h3">Most influential studios &amp; creators in ${mine?"your":"their"} life</h3>
        <div style="margin-top:8px">${topSt.map(([n,v])=>{const sr=findStudio(n),pct=totW?Math.max(1,Math.round(v/totW*100)):0;
          const mks=sr&&sr.makers&&sr.makers.length?sr.makers.slice(0,3).join(", "):"";
          return `<div class="oderow"><div style="display:flex;align-items:center;gap:8px;min-width:0">${studioLogoHTML(sr)}<div style="min-width:0">${sr?`<button type="button" class="stbtn" style="font-weight:700" data-act="studio" data-st="${esc(sr.id)}">${flag(sr.cc)} ${esc(n)}</button>`:`<b>${esc(n)}</b>`}${mks?`<small class="muted" style="display:block;font-size:11.5px">${esc(mks)}</small>`:""}</div></div>
            <div class="odebar"><i style="width:${(v/maxSt*100).toFixed(1)}%"></i></div>
            <span class="row" style="gap:6px;flex-wrap:nowrap"><span class="mono muted" style="font-size:12px">${pct}%</span>${mine&&sr?`<button type="button" class="chip" style="padding:2px 8px;font-size:11px" data-act="gratSheet" data-st="${esc(sr.id)}" title="Write a thank-you note to ${esc(n)}">Thank</button>`:""}</span></div>`}).join("")}</div>
        <h3 class="h3" style="margin-top:16px">Countries behind ${mine?"your":"their"} games <small class="muted" style="font-weight:400">(tap to browse country)</small></h3>
        <div class="makers" style="margin-top:6px">${top(cc,10).map(([c,v])=>`<button type="button" class="makerbtn" data-act="country" data-cc="${esc(c)}">${flag(c)} ${esc(countryName(c))}<span>${v}</span></button>`).join("")}</div>
      </div>
      <div class="card"><h3 class="h3">${mine?"Your":"Their"} hardware shelf</h3><p class="sub">The machines — and hardware engineers — that carried these worlds. Tap a system to hear its chip tone.</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${sysList.map(([n,v])=>{const hw=hwMap.get(n);
          return `<button type="button" class="anc" data-act="chipPing" data-sys="${esc(n)}" style="grid-template-columns:56px minmax(0,1fr) auto;padding:6px 4px;text-align:left">${hwSVG(n)}<div><b>${esc(n)}</b><small>${hw?`${esc(hw.maker)} · ${esc(hw.engineers)}`:plural(v,"game")}</small></div><span class="mono muted" style="font-size:12px">${plural(v,"game")}</span></button>`}).join("")}</div>
      </div>
    </div></section>`;
}
/* ---------- family tree (merged interactive org-chart + journeys + big picture + reach) ---------- */
const JOURNEYS=[
  {id:"grand-theft-auto-vi",title:"64 years to Vice City: GTA VI's roots",sub:"From 1962 mainframes and British space sims to modern Leonida."},
  {id:"2048",title:"Format evolutions & genre variants",sub:"From Threes! to 1024 to 2048 — how a core ruleset travels and mutates."},
  {id:"pubg",title:"How the battle royale was born",sub:"Military sims, a zombie mod and 100 players on an island."},
  {id:"the-finals",title:"From the arcades to The Finals",sub:"Robotron, Smash TV and a Stockholm game show."},
  {id:"arc-raiders",title:"ARC Raiders' roots",sub:"Giant machines, scavenging and risky extraction."},
  {id:"Fortnite Battle Royale",title:"The road to Fortnite",sub:"From PUBG's island to building, shooting and UGC."},
  {id:"elden-ring",title:"The Souls family",sub:"Dungeon crawlers, hidden lore and demanding bosses."},
  {id:"hades",title:"From Rogue to Hades",sub:"Fifty years of dying, learning and trying again."},
  {id:"minecraft",title:"Minecraft's family",sub:"Infiniminer, Dwarf Fortress and theme parks behind a phenomenon."},
  {id:"Baldur's Gate 3",title:"From D&D to Baldur's Gate 3",sub:"Pen-and-paper rules that became a genre."},
  {id:"hollow-knight",title:"Metroidvania",sub:"Maps you open up by finding new abilities."},
  {id:"undertale",title:"Undertale's family",sub:"Dragon Quest, Mother and a bullet-hell shooter."},
  {id:"no-mans-sky",title:"To the stars",sub:"From Spacewar! to a universe of planets."},
  {id:"candy-crush-saga",title:"Match three",sub:"From Russian DOS puzzles to Bejeweled and Candy Crush."},
  {id:"league-of-legends",title:"The MOBA family",sub:"A custom StarCraft map that grew into an esport."},
  {id:"half-life-2",title:"Birth of the shooter",sub:"From mazes on mainframes to physics guns."},
  {id:"rocket-league",title:"Rocket League's family",sub:"Skateboards, car mods and a giant ball."},
  {id:"grand-theft-auto-v",title:"The open-world road",sub:"Cities you can go anywhere in."},
  {id:"stardew-valley",title:"Life on the farm",sub:"Calm, seasons and a town that remembers you."}];
function journeyList(){return JOURNEYS.map(j=>{const g=gameRef(j.id);if(!g)return null;const ch=rootsChain(g.i);return ch.length>=3?{...j,g,ch}:null}).filter(Boolean)}
function todayGame(){const pool=TREE.filter(g=>isVideoGame(g)&&g.pop>=3&&UP[g.i].length>=2&&directCrossLinks(g).length>=1);if(!pool.length)return TREE[0];return pool[(utcDayNum()*7919)%pool.length]}
function formatVariantsSection(){
  const synth=[["infiniminer","minecraft"],["magic-survival","vampire-survivors"],["half-life","counter-strike"],["harvest-moon","stardew-valley"]].map(([a,b])=>[byId.get(a),byId.get(b)]).filter(([a,b])=>a&&b);
  const variants=[["threes","2048"],["happy-farm","farmville"],["pubg","fortnite-br"],["tarkov","arena-breakout-infinite"]].map(([a,b])=>[byId.get(a),byId.get(b)]).filter(([a,b])=>a&&b);
  if(!synth.length&&!variants.length)return "";
  const pairRow=([a,b])=>{const lk=L.find(x=>x.from===a.i&&x.to===b.i);return `<button class="anc" data-act="game" data-id="${b.id}">${cover(b,{showYear:false})}<span><b>${esc(a.title)} → ${esc(b.title)}</b><small>${a.year} → ${b.year}${lk&&lk.added?` · ${esc(lk.added.slice(0,68))}${lk.added.length>68?"…":""}`:""}</small></span><span class="mono muted" style="font-size:12px">▸</span></button>`};
  return `<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">How design formats travel</p><h2 class="h2">Format Evolutions &amp; Genre Variants</h2><p class="sub">Every genre grows as studios build on shared mechanics — sometimes remixing an engine or loop into a new world, sometimes refining a proven format for a broader audience.</p></div></div>
    <div class="lensgrid">
      <div class="lenscol"><h3 class="h3">Creative synthesis &amp; genre leaps</h3><p class="sub">Borrowed a core mechanic or mod toolkit and built a distinct ruleset around it.</p>${synth.map(pairRow).join("")}</div>
      <div class="lenscol"><h3 class="h3">Format evolutions &amp; genre variants</h3><p class="sub">Iterated closely on a breakout loop with new pacing, platform reach, or mechanics.</p>${variants.map(pairRow).join("")}</div>
    </div></section>`;
}
const treeHeading=title=>`${title} · family tree`;
function renderFamilyTree(m,focusId,opts={}){
  const myTreePicks=entries(hist).filter(x=>x.g&&x.g.tree).sort((a,b)=>b.lv-a.lv||b.g.inf-a.g.inf).map(x=>x.g).filter((g,i,a)=>a.indexOf(g)===i).slice(0,5);
  const defId=focusId||(state.linId&&byId.has(state.linId)?state.linId:(myTreePicks[0]&&myTreePicks[0].id)||"grand-theft-auto-vi");
  const g=byId.get(defId)||TREE[0];
  state.linId=g.id;
  if(!state.linTrail)state.linTrail=[];
  if(!opts.fromAttract&&state.linTrail[state.linTrail.length-1]!==g.id){const k=state.linTrail.indexOf(g.id);if(k>=0)state.linTrail=state.linTrail.slice(0,k+1);else state.linTrail.push(g.id);state.linTrail=state.linTrail.slice(-7)}
  const ups=UP[g.i],downs=DOWN[g.i],directCross=directCrossLinks(g),directSer=directSeriesLinks(g);
  const chain=rootsChain(g.i),oldest=chain.length?chain[chain.length-1].g:g;
  const landmarks=["grand-theft-auto-vi","elden-ring","baldurs-gate-3","doom","super-mario-64","hades","world-of-warcraft","project-titan","minecraft","the-legend-of-zelda-breath-of-the-wild"].map(gameRef).filter(x=>x&&x.tree);
  const js=journeyList();
  const direct=state.infMode==="direct";
  const vgTree=TREE.filter(isVideoGame);
  const dcount=new Map(vgTree.map(x=>[x.i,directCrossLinks(x).length]));
  const val=x=>direct?(dcount.get(x.i)||0):x.inf;
  const infl=vgTree.slice().sort((a,b)=>val(b)-val(a)||b.pop-a.pop).slice(0,25),maxInf=Math.max(1,infl.length?val(infl[0]):1);
  const tc={};L.forEach(l=>tc[l.tier]=(tc[l.tier]||0)+1);
  m.innerHTML=`<section class="wrap" style="padding-block:18px 8px">
    <div class="row" style="justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:10px">
      <div style="min-width:0">
        <p class="eyebrow" style="margin-bottom:3px">Family tree · ${TREE.length.toLocaleString()} connected games · ${L.length.toLocaleString()} sourced links</p>
        <h1 class="h1" style="margin:0;font-size:clamp(1.45rem,1.05rem + 2vw,2.2rem)">${esc(treeHeading(g.title))}</h1>
      </div>
      <div class="row" style="gap:6px">
        <button type="button" class="btn sm" data-act="luckyWheel">Feeling lucky</button>
        <button type="button" class="btn sm" data-act="map">Big Picture (5 views)</button>
      </div>
    </div>
    <div class="search" style="margin-bottom:8px"><input class="input" id="linQ" type="search" placeholder="Search ${TREE.length.toLocaleString()} connected games (or ${G.length.toLocaleString()} catalog titles)…" autocomplete="off" aria-label="Jump family tree to any game"><div class="results" id="linR" hidden></div></div>
    <div class="pickstrip" style="padding-block:2px 6px;gap:5px">
      ${myTreePicks.length?`<span class="sync" style="align-self:center;margin-right:2px">Your games:</span>${myTreePicks.map(x=>`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="linFocus" data-id="${x.id}" aria-pressed="${x.id===g.id}">♥ ${esc(x.title)}</button>`).join("")}<span class="muted" style="align-self:center">·</span>`:""}
      ${landmarks.filter(x=>!myTreePicks.includes(x)).slice(0,8).map(x=>`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="linFocus" data-id="${x.id}" aria-pressed="${x.id===g.id}">${esc(x.title)}</button>`).join("")}
    </div>
    <div class="pickstrip" style="padding:2px 0 6px;gap:5px;width:100%">${TIERS.map(t=>`<button type="button" class="chip tierchip" style="--c:var(${t.c});padding:3px 9px;font-size:11.5px" data-act="tier" data-tier="${t.k}" aria-pressed="${!!state.tiers[t.k]}">${tierSwatchSVG(t)}${t.label}</button>`).join("")}</div>
    ${state.linTrail.length>1?`<nav class="lintrailbar" aria-label="Tree history"><span class="sync" style="flex:none">Trail:</span>${state.linTrail.map((id,k)=>k===state.linTrail.length-1?`<b style="color:var(--ink)">${esc(byId.get(id).title)}</b>`:`<button type="button" class="link" style="font-size:12px" data-act="linFocus" data-id="${id}">${esc(byId.get(id).title)}</button><span class="muted" aria-hidden="true">›</span>`).join("")}</nav>`:""}
    <div class="treebox" id="treebox" tabindex="0" role="region" aria-label="Interactive family tree of ${esc(g.title)}">${treeSVG(g,"linFocus")}</div>
    <div class="card" style="margin-top:12px;padding:12px 14px">
      <div class="row" style="justify-content:space-between;align-items:center;gap:12px">
        <div class="row" style="gap:10px;min-width:0;flex:1">
          <div style="width:44px;flex:none">${cover(g,{showYear:false})}</div>
          <div style="min-width:0">
            <div class="row" style="gap:6px"><b style="font-size:15.5px">${esc(g.title)}</b><span class="mono muted" style="font-size:12.5px">${g.year}</span>${statusBadgeHTML(g)}</div>
            <div class="gstats" style="margin-top:5px">
              <button type="button" class="gstatbtn" data-act="jumpPanel" data-id="${g.id}" data-dir="up" ${ups.length?"":"disabled"}>▲ Built on <b>${ups.length}</b> earlier ${ups.length===1?"game":"games"}</button>
              <button type="button" class="gstatbtn" data-act="jumpPanel" data-id="${g.id}" data-dir="down" ${downs.length?"":"disabled"}>▼ Inspired <b>${directCross.length}</b> ${directCross.length===1?"game":"games"} directly${directSer.length?` (+ ${directSer.length} in series)`:""}</button>
              <button type="button" class="gstatbtn" data-act="reachSheet" data-id="${g.id}" data-dir="down" ${g.inf?"":"disabled"}><b>${g.inf.toLocaleString()}</b> across genres${g.inf?" ▸":""}</button>
            </div>
          </div>
        </div>
        <div class="row" style="gap:6px">
          ${chain.length>1?`<button type="button" class="btn sm primary" data-act="walk" data-id="${g.id}">Walk ${g.year-oldest.year}-yr roots (${chain.length-1} steps) ▸</button>`:""}
          <button type="button" class="btn sm" data-act="game" data-id="${g.id}">Full game page ▸</button>
          <button type="button" class="btn sm ghost" data-act="featureSheet" data-cat="Lineage Link / Source" data-title="${esc(g.title+" ← / → ")}">Cite a link</button>
        </div>
      </div>
    </div>
  </section>
  <section class="wrap sec" style="padding-top:10px"><div class="cols">${panelHTML("up",ups,g)}${panelHTML("down",downs,g)}</div></section>
  ${js.length?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Guided walks</p><h2 class="h2">Journeys through game history</h2><p class="sub">Step backward through a tradition, one game at a time.</p></div></div>
    <div class="journeys">${js.map(j=>{const old=j.ch[j.ch.length-1].g;const picks=[j.ch[j.ch.length-1],j.ch[Math.floor(j.ch.length/2)],j.ch[0]].map(s=>s.g);
      return `<button class="jcard" data-act="walk" data-id="${j.g.id}"><span class="jstack">${picks.map((pg,k)=>cover(pg,{showYear:false,attrs:`style="--h:${pg.h};--r:${(k-1)*5}deg"`})).join("")}</span><b>${esc(j.title)}</b><p>${esc(j.sub)}</p><small>${plural(j.ch.length-1,"step")} · ${old.year} → ${j.g.year}</small></button>`}).join("")}</div></section>`:""}
  <section class="wrap sec">${gtaviSpotlight()}</section>
  ${formatVariantsSection()}
  <section class="wrap sec"><div class="hgrid">
    <div class="card"><p class="eyebrow">Six degrees of Pong</p><h2 class="h2">Connect any two games</h2><p class="sub">Find the shortest chain of documented inspiration between any two games in the tree.</p>
      <div class="connect"><div class="search"><input class="input" id="linCa" type="search" placeholder="From (older or newer)" autocomplete="off" aria-label="First game"><div class="results" id="linCra" hidden></div></div><div class="search"><input class="input" id="linCb" type="search" placeholder="To (second game)" autocomplete="off" aria-label="Second game"><div class="results" id="linCrb" hidden></div></div><button type="button" class="btn" data-act="linRandomPair">Random pair</button></div>
      <div id="linCpath"></div></div>
    <div class="card"><p class="eyebrow">The big picture · 5 views</p><h2 class="h2">Explore history from five angles</h2><p class="sub">Switch between <b>Landmarks</b>, <b>Influence Skyline</b>, <b>Genre Rivers</b>, <b>Geography</b>, and <b>My Constellation</b>.</p>
      <canvas id="mapThumb" width="640" height="220" style="width:100%;height:auto;border-radius:10px;border:1px solid var(--line);background:var(--paper);cursor:pointer" data-act="map" aria-label="Open the Big Picture map"></canvas>
      <div class="row" style="margin-top:10px"><button class="btn primary" data-act="map">Open Big Picture</button><a class="btn" href="#almanac">Open Almanac ▸</a></div></div>
  </div></section>
  <section class="wrap sec" id="inflSec"><div class="sechead"><div><p class="eyebrow">Video game influence · Sequels &amp; tabletop excluded</p><h2 class="h2">Most influential video games</h2><p class="sub">${direct?"Ranked by cross-series games directly inspired (sequels within the same series excluded).":"Ranked by later games tracing back across genres (pure same-series sequel chains and pre-video-game tabletop ancestors excluded)."}</p></div>
      <span class="seg" role="group" aria-label="Rank by"><button data-act="infMode" data-m="direct" aria-pressed="${direct}">Direct</button><button data-act="infMode" data-m="reach" aria-pressed="${!direct}">Across genres</button></span></div>
    <div>${infl.map((x,i)=>`<button class="inf" data-act="game" data-id="${x.id}"><span class="rk">${i+1}</span>${cover(x,{showYear:false})}<span><b>${esc(x.title)}</b><small>${x.year} · ${flag(x.cc)} ${esc(studio(x))}</small></span><span class="infcell"><span class="bar"><i style="width:${(val(x)/maxInf*100).toFixed(1)}%"></i></span><span>${val(x).toLocaleString()} ${direct?(val(x)===1?"game directly":"games directly"):(val(x)===1?"game across genres":"games across genres")}</span></span></button>`).join("")}</div>
    <p class="factline">${L.length.toLocaleString()} links: ${TIERS.map(t=>`${(tc[t.k]||0).toLocaleString()} ${t.label.toLowerCase()}`).join(" · ")}.</p>
  </section>
  ${footer()}`;
  requestAnimationFrame(()=>{
    const tb=$("#treebox");if(tb){
      if(state.treeKeepScroll!=null){tb.scrollLeft=state.treeKeepScroll;state.treeKeepScroll=null}
      else{const c=tb.querySelector("[data-center]");if(c){const x=+c.dataset.cx,mob=window.innerWidth<=560;tb.scrollLeft=Math.max(0,x-tb.clientWidth*(mob?0.28:0.5))}}
    }
    const mc=$("#mapThumb");if(mc)drawMapThumb(mc);
  });
  wireSearch($("#linQ"),$("#linR"),x=>{if(!x||!x.id)return;if(x.tree)go("lineage-"+x.id);else go(x.id)},{treeOnly:false});
  let A=null,B=null;const drawP=()=>{if(A&&B&&$("#linCpath"))$("#linCpath").innerHTML=pathHTML(A,B)};
  wireSearch($("#linCa"),$("#linCra"),x=>{if(!x||!x.id)return;A=x;$("#linCa").value=x.title;drawP()},{treeOnly:true});
  wireSearch($("#linCb"),$("#linCrb"),x=>{if(!x||!x.id)return;B=x;$("#linCb").value=x.title;drawP()},{treeOnly:true});
  ACTIONS.linRandomPair=()=>{const pool=vgTree.filter(x=>x.pop>=4);for(let k=0;k<30;k++){const a=pool[Math.floor(Math.random()*pool.length)],b=pool[Math.floor(Math.random()*pool.length)];if(a&&b&&a!==b&&Math.abs(a.year-b.year)>8&&connectPath(a.i,b.i)){A=a.year<b.year?a:b;B=a.year<b.year?b:a;$("#linCa").value=A.title;$("#linCb").value=B.title;drawP();return}}};
  armAttractMode();
}
/* ---------- 30s Idle Attract Mode on Lineage (WCAG 2.2.2 Pause/Stop + reduced-motion opt-out) ---------- */
const ATTRACT={idleTimer:0,stepTimer:0,active:false,paused:false,wired:false,pill:null,lastId:""};
function removeAttractPill(){if(ATTRACT.pill){ATTRACT.pill.remove();ATTRACT.pill=null}}
function stopAttractMode(disableSession=false){
  clearTimeout(ATTRACT.idleTimer);ATTRACT.idleTimer=0;
  clearInterval(ATTRACT.stepTimer);ATTRACT.stepTimer=0;
  ATTRACT.active=false;ATTRACT.paused=false;
  removeAttractPill();
  if(disableSession)state.attractDisabled=true;
}
function renderAttractPill(caption){
  removeAttractPill();
  const el=document.createElement("aside");
  el.className="attract-pill";
  el.setAttribute("aria-label","Lineage attract mode");
  el.innerHTML=`<b>✨ Attract</b><span>${esc(caption||"Exploring lineage…")}</span>
    <button type="button" class="btn sm ghost" style="padding:3px 8px;font-size:11.5px" data-act="attractPause">${ATTRACT.paused?"Resume":"Pause"}</button>
    <button type="button" class="btn sm ghost" style="padding:3px 7px;font-size:11.5px" data-act="attractStop" aria-label="Stop attract mode">×</button>`;
  document.body.appendChild(el);
  ATTRACT.pill=el;
}
function attractBlocked(){
  if(document.hidden||story||($("#sheetDlg")&&$("#sheetDlg").open)||$("#layer").innerHTML||VID_STATE.open)return true;
  const ae=document.activeElement;
  if(ae&&ae.matches&&ae.matches("input,textarea,select,[contenteditable]"))return true;
  return false;
}
function stepAttractMode(){
  if(!ATTRACT.active||ATTRACT.paused||state.route.view!=="tree"){return}
  if(attractBlocked()){if(document.hidden)return;stopAttractMode(false);return}
  const cur=byId.get(state.linId)||TREE[0];
  const neighbors=[...DOWN[cur.i].filter(l=>tierOn(l)&&l.tier!=="disp").map(l=>({g:G[l.to],txt:`${cur.title} → ${G[l.to].title}`})),
    ...UP[cur.i].filter(l=>tierOn(l)&&l.tier!=="disp").map(l=>({g:G[l.from],txt:`${G[l.from].title} → ${cur.title}`}))].filter(x=>x.g&&x.g.id!==ATTRACT.lastId);
  let pick=neighbors.length?neighbors[Math.floor(Math.random()*neighbors.length)]:null;
  if(!pick){
    const pool=TREE.filter(x=>isVideoGame(x)&&x.pop>=4&&x.id!==cur.id);
    const g=pool[Math.floor(Math.random()*pool.length)]||TREE[0];
    pick={g,txt:`Spotlight: ${g.title} (${g.year})`};
  }
  ATTRACT.lastId=cur.id;
  state.linId=pick.g.id;
  state.treeMore={};
  const m=$("#main");
  if(m){
    renderFamilyTree(m,pick.g.id,{fromAttract:true});
    renderAttractPill(pick.txt);
  }
}
function armAttractMode(){
  if(prefersReducedMotion()||state.attractDisabled||state.route.view!=="tree")return;
  if(!ATTRACT.wired){
    ATTRACT.wired=true;
    const resetIdle=ev=>{
      if(ev&&ev.target&&ev.target.closest&&ev.target.closest(".attract-pill"))return;
      if(ATTRACT.active){stopAttractMode(false)}
      if(state.route.view==="tree"&&!state.attractDisabled&&!prefersReducedMotion()){
        clearTimeout(ATTRACT.idleTimer);
        ATTRACT.idleTimer=setTimeout(startAttractMode,30000);
      }
    };
    ["pointerdown","keydown","wheel","touchstart"].forEach(evt=>document.addEventListener(evt,resetIdle,{passive:true}));
  }
  clearTimeout(ATTRACT.idleTimer);
  if(!ATTRACT.active){
    ATTRACT.idleTimer=setTimeout(startAttractMode,30000);
  }
}
function startAttractMode(){
  if(state.route.view!=="tree"||prefersReducedMotion()||state.attractDisabled)return;
  if(attractBlocked())return;
  ATTRACT.active=true;ATTRACT.paused=false;
  const cur=byId.get(state.linId);
  renderAttractPill(cur?`Tracing ${cur.title} (${cur.year})`:"Tracing lineage…");
  clearInterval(ATTRACT.stepTimer);
  ATTRACT.stepTimer=setInterval(stepAttractMode,6500);
}

/* ---------- almanac: unified hub (Vault, Mods, Mobile, Prices, Studios, World Map, Mechanics, Genres, Tabletop) ---------- */
const ALMANAC_TABS=[
  {k:"vault",label:"Vault",hash:"vault"},
  {k:"mods",label:"Mods",hash:"mods"},
  {k:"mobile",label:"Mobile",hash:"mobile"},
  {k:"prices",label:"Prices",hash:"prices"},
  {k:"studios",label:"Studios",hash:"studios"},
  {k:"world",label:"World Map",hash:"world"},
  {k:"mechanics",label:"Mechanics",hash:"mechanics"},
  {k:"genres",label:"Genres",hash:"genres"},
  {k:"boardgames",label:"Tabletop",hash:"boardgames"}
];
function renderAlmanac(m,tab){
  const cur=ALMANAC_TABS.some(t=>t.k===tab)?tab:(state.almTab||"vault");
  state.almTab=cur;
  const nav=`<section class="wrap" style="padding-block:18px 0">
    <p class="eyebrow" style="margin-bottom:4px">Almanac · Archives, studios, hardware &amp; craft</p>
    <div class="almtabs" role="tablist" aria-label="Almanac sections">${ALMANAC_TABS.map(t=>`<button type="button" class="chip" role="tab" aria-selected="${cur===t.k}" data-act="almTab" data-t="${t.k}" data-h="${t.hash}">${esc(t.label)}</button>`).join("")}</div>
  </section>`;
  let body="";
  if(cur==="vault")body=vaultSectionHTML();
  else if(cur==="mods")body=renderUgcCraftHTML();
  else if(cur==="mobile")body=renderMobileCraftHTML();
  else if(cur==="prices")body=renderPricesHTML();
  else if(cur==="studios")body=renderStudiosBody();
  else if(cur==="world")body=renderWorldBody();
  else body=renderMechanicsBody(cur);
  m.innerHTML=nav+body+footer();
  if(cur==="studios")wireStudiosSearch();
}

/* ---------- studios & makers ---------- */
function statusLabel(st){
  if(st.status==="closed")return `<span class="ststatus closed">Closed${st.closed?" "+st.closed:""}</span>`;
  if(st.status==="absorbed")return `<span class="ststatus closed">Merged${st.closed?" "+st.closed:""}</span>`;
  if(st.status==="revived")return `<span class="ststatus revived">Shuttered &amp; revived</span>`;
  return st.founded?`<span class="ststatus active">Est. ${st.founded}</span>`:"";
}
function studioCardHTML(st){
  const yrs=st.founded?(st.closed?`${st.founded}–${st.closed}`:`${st.founded}–present`):(st.games.length?`${st.games[0].year}–${st.games[st.games.length-1].year}`:"");
  const mySt=isWorkedStudio(hist,st.id);
  return `<button type="button" class="stcard" data-act="studio" data-st="${esc(st.id)}" ${mySt?`style="border-color:var(--craft)"`:""}>
    <div class="row" style="justify-content:space-between;width:100%"><span class="row" style="gap:7px;min-width:0">${studioLogoHTML(st)}<b class="stname">${flag(st.cc)} ${esc(st.name)}</b></span><span class="row" style="gap:6px">${mySt?`<span class="pill craft">🛠 Worked here</span>`:""}${statusLabel(st)}</span></div>
    <small class="mono muted">${esc(yrs)}${st.hq?" · "+esc(st.hq):""} · ${plural(st.games.length,"game")}</small>
    ${st.bio?`<p style="margin:2px 0;font-size:13px;color:var(--ink2);line-height:1.4">${esc(st.bio)}</p>`:""}
    ${st.diaspora&&st.diaspora.length?`<small class="muted">Seeded: <b>${esc(st.diaspora.map(d=>d.studio).join(", "))}</b></small>`:""}
  </button>`;
}
function pioneerCardHTML(p){
  const gs=(p.games||[]).map(gameRef).filter(Boolean).slice(0,4);
  return `<div class="piocard">
    <div class="row" style="justify-content:space-between"><span class="yr">${esc(p.year||"")}</span><span>${flag(p.cc||"")}</span></div>
    <b><a href="https://www.mobygames.com/search/?q=${encodeURIComponent(p.name)}&type=developer" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${esc(p.name)} <span class="muted" style="font-weight:400;font-size:12px">↗</span></a></b>
    <small class="muted" style="font-weight:600">${esc(p.role||"")}</small>
    <p>${esc(p.bio||"")}</p>
    ${gs.length?`<div class="row" style="gap:5px;margin-top:auto;padding-top:4px">${gs.map(g=>`<button type="button" class="chip" style="padding:3px 8px;font-size:11.5px" data-act="game" data-id="${g.id}">${esc(g.title)}</button>`).join("")}</div>`:""}
  </div>`;
}
function hardwareCardHTML(h){
  return `<div class="hwcard">
    <div class="hwtop">${hwSVG(h.sys)}<div><b>${esc(h.sys)}</b><small>${flag(h.cc||"")} ${esc(h.maker||"")} · ${h.year||""}</small></div></div>
    ${h.headline?`<b style="font-size:13px;line-height:1.35">${esc(h.headline)}</b>`:""}
    <small style="color:var(--accent);font-weight:600">Hardware leads: ${esc(h.engineers||"")}</small>
    <p style="margin:2px 0 0;font-size:13px;color:var(--ink2);line-height:1.45">${esc(h.bio||h.note||"")}</p>
  </div>`;
}
function allGratitudeNotes(){
  const mine=store.get("ib3-gratitude",[]);
  return [...mine.map(x=>({...x,mine:true})),...(CULT.gratitude||[])];
}
function realStoryCardHTML(item){
  const st=item.studio&&findStudio(item.studio),gm=item.game&&gameRef(item.game);
  return `<article class="gratcard">
    <div class="row" style="justify-content:space-between;gap:6px"><span class="pill" style="background:var(--accent-soft);color:var(--accent)">${esc(item.tag||"Documented")}</span></div>
    <b style="font-family:var(--f-display);font-size:14.5px;line-height:1.3">${esc(item.title||"")}</b>
    <p style="margin:4px 0;font-size:13.2px;color:var(--ink2);line-height:1.48">${esc(item.body||"")}</p>
    ${item.source?`<small class="muted" style="display:block;font-size:11.5px">Source: ${esc(item.source)}</small>`:""}
    <div class="row" style="margin-top:auto;padding-top:6px;justify-content:space-between">
      <span class="row" style="gap:6px">${st?`<button type="button" class="stbtn" style="font-weight:700;font-size:12.5px" data-act="studio" data-st="${esc(st.id)}">${flag(st.cc)} ${esc(st.name)}</button>`:""}${gm?`<button type="button" class="chip" style="padding:2px 8px;font-size:11.5px" data-act="quickLook" data-id="${gm.id}">${esc(gm.title)}</button>`:""}</span>
    </div>
  </article>`;
}
function gratitudeCardHTML(gItem){
  const st=gItem.studio&&findStudio(gItem.studio),gm=gItem.game&&gameRef(gItem.game);
  return `<article class="gratcard">
    <div class="row" style="justify-content:space-between"><span class="pill" style="background:var(--love-soft);color:var(--love)">${esc(gItem.tag||"Thank you")}</span><small class="mono muted">${esc(gItem.mine?"Saved on your device":(gItem.who||(gItem.year?String(gItem.year):"")))}</small></div>
    <blockquote>“${esc(gItem.note||"")}”</blockquote>
    <div class="row" style="margin-top:auto;padding-top:4px;justify-content:space-between">
      <span class="row" style="gap:6px">${st?`<button type="button" class="stbtn" style="font-weight:700;font-size:12.5px" data-act="studio" data-st="${esc(st.id)}">${flag(st.cc)} ${esc(st.name)}</button>`:""}${gm?`<button type="button" class="chip" style="padding:2px 8px;font-size:11.5px" data-act="quickLook" data-id="${gm.id}">${esc(gm.title)}</button>`:""}</span>
    </div>
  </article>`;
}
function gratitudeSectionHTML(){
  const notes=allGratitudeNotes();
  const realStories=CULT.realStories||[];
  const charities=CULT.charities||[];
  return `${notes.length?`<section class="wrap sec" id="myGratitudeWall"><div class="sechead"><div><p class="eyebrow">Your personal thank-you postcards</p><h2 class="h2">Notes saved on this device (${notes.length})</h2></div><button type="button" class="btn sm primary" data-act="gratSheet">Create another postcard</button></div>
      <div class="gratgrid">${notes.map(gratitudeCardHTML).join("")}</div></section>`:""}
    <section class="wrap sec" id="gratitudeWall"><div class="sechead"><div><p class="eyebrow">Documented history · Sourced stories</p><h2 class="h2">Moments where games &amp; makers left a mark</h2><p class="sub">Named, sourced stories from game history. Want to thank a team whose game mattered to you? Download a <b>Thank-You Postcard (.png)</b> to share directly with a developer, or submit a note.</p></div><div class="row" style="gap:6px"><button type="button" class="btn primary" data-act="gratSheet">Create a thank-you postcard</button></div></div>
      <div class="gratgrid">${realStories.map(realStoryCardHTML).join("")}</div>
    </section>
    ${giveBackSectionHTML(charities)}`;
}
function giveBackSectionHTML(charities){
  if(!charities||!charities.length)return "";
  return `<section class="wrap sec" id="giveback"><div class="sechead"><div><p class="eyebrow">Supporting the craft &amp; next generation</p><h2 class="h2">Support game makers, youth &amp; preservation</h2><p class="sub">Direct links to established non-profits — helping underrepresented youth enter game creation, supporting laid-off developers, preserving game history, and bringing play to children's hospitals.</p></div></div>
    <div class="stgrid">${charities.map(c=>`<a class="stcard" href="${esc(c.url)}" target="_blank" rel="noopener" style="text-decoration:none">
      <div class="row" style="justify-content:space-between;width:100%"><b>${esc(c.name)}</b><span class="ststatus active">${esc(c.focus||"Non-profit")} ↗</span></div>
      <p style="margin:4px 0 0;font-size:13px;color:var(--ink2);line-height:1.45">${esc(c.desc||"")}</p>
    </a>`).join("")}</div></section>`;
}
function vaultGameCardHTML(g,mode){
  const ups=UP[g.i].map(l=>G[l.from]),downs=DOWN[g.i].map(l=>G[l.to]);
  const lv=levelOf(hist,g),wk=isWorked(hist,g);
  return `<article class="mechcard">
    <div class="row" style="justify-content:space-between;gap:6px">
      ${mode==="cancelled"?`<span class="vbadge canc">Unreleased · ${g.year}</span>`:`<span class="vbadge sun">Sunsetted · ${g.year}</span>`}
      ${mode==="cancelled"
        ?(isDevMode()?`<button type="button" class="btn sm vault-wkbtn ${wk?"craft":"ghost"}" style="padding:3px 9px;font-size:11.5px" data-act="toggleWk" data-id="${g.id}" aria-pressed="${wk}" title="${wk?"Worked on it":"I worked on this"}">🛠 <span class="vwk-lbl">${wk?"Worked on it ✓":"I worked on this"}</span></button>`:"")
        :`<button type="button" class="qtick${lv?" lv"+lv:""}" data-act="qtick" data-id="${g.id}" aria-pressed="${lv>0}">${lv?`${LV[lv].m} ${LV[lv].label}`:"+ Played"}</button>`}
    </div>
    <div class="today" style="grid-template-columns:72px minmax(0,1fr);gap:12px">
      ${cover(g,{tag:"button",attrs:`type="button" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}" aria-label="Inspect ${esc(g.title)}"`,showYear:false})}
      <div style="min-width:0">
        <h3 class="h2" style="font-size:16.5px;margin:0 0 3px"><button type="button" class="stbtn" style="font-weight:700;text-decoration:none;text-align:left" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}">${esc(g.title)}</button></h3>
        <small class="muted" style="display:block">${flag(g.cc)} ${studioLinks(g.dev||"")}${g.plats.length?` · ${esc(sysOfGame(g).slice(0,3).join(", "))}`:""}</small>
      </div>
    </div>
    <p class="vault-note">${esc(g.note||"")}</p>
    ${downs.length?`<div style="margin-top:auto;padding-top:4px"><span class="sync" style="display:block;margin-bottom:4px">Carried forward into:</span><div class="row" style="gap:5px">${downs.slice(0,4).map(d=>`<button type="button" class="chip" style="padding:2px 8px;font-size:11.5px" data-act="game" data-id="${d.id}">→ ${esc(d.title)} (${d.year})</button>`).join("")}</div></div>`
      :ups.length?`<div style="margin-top:auto;padding-top:4px"><span class="sync" style="display:block;margin-bottom:4px">Built on:</span><div class="row" style="gap:5px">${ups.slice(0,3).map(u=>`<button type="button" class="chip" style="padding:2px 8px;font-size:11.5px" data-act="game" data-id="${u.id}">${esc(u.title)} (${u.year})</button>`).join("")}</div></div>`:""}
    <footer class="row" style="margin-top:${downs.length||ups.length?"6px":"auto"};padding-top:6px;border-top:1px dashed var(--line);justify-content:space-between">
      <span class="row" style="gap:6px">
        ${g.tree?`<button type="button" class="btn sm ghost" data-act="game" data-id="${g.id}">Family tree</button>`:`<button type="button" class="btn sm ghost" data-act="quickLook" data-id="${g.id}">Game info</button>`}
        <button type="button" class="btn sm ghost" data-act="watchTv" data-id="${g.id}">▶ Footage</button>
      </span>
      <button type="button" class="btn sm" data-act="gratSheet" data-id="${g.id}">Thank team</button>
    </footer>
  </article>`;
}
function loreCardHTML(item){
  const gs=(item.games||[]).map(gameRef).filter(Boolean);
  return `<article class="mechcard">
    <div class="row" style="justify-content:space-between;gap:8px"><span class="eyebrow" style="margin:0">${esc(item.tag||"Gaming lore")}</span><span>${item.cc?flag(item.cc):""}</span></div>
    <div style="display:flex;gap:12px;align-items:flex-start">
      ${item.sys?`<div style="flex:none;width:54px;padding-top:2px">${hwSVG(item.sys)}</div>`:""}
      <h3 class="h2" style="font-size:17px;margin:0;line-height:1.3">${esc(item.title)}</h3>
    </div>
    <p style="margin:2px 0;font-size:13.5px;color:var(--ink2);line-height:1.5">${esc(item.body||"")}</p>
    ${item.source?`<small class="muted" style="display:block;font-size:11.5px">Source: ${esc(item.source)}</small>`:""}
    ${gs.length?`<footer class="row" style="margin-top:auto;padding-top:6px;gap:6px">${gs.map(g=>`<button type="button" class="chip" style="padding:3px 9px;font-size:11.5px" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}">${esc(g.title)} (${g.year}) ▸</button>`).join("")}</footer>`:""}
  </article>`;
}
function vaultSectionHTML(){
  const cancelled=G.filter(g=>g.cancelled).sort((a,b)=>b.pop-a.pop||a.year-b.year);
  const sunsetted=G.filter(g=>g.sunset).sort((a,b)=>a.year-b.year||b.pop-a.pop);
  const lore=CULT.vaultLore||[];
  const deepSys=["Dendy","Vectrex","NEC PC-98","Sharp X68000","Subor","Amiga CD32","Philips CD-i","Virtual Boy","Nokia N-Gage","Gizmondo"];
  const hwMap=new Map((CULT.hardware||[]).map(h=>[h.sys,h]));
  const deepHw=deepSys.map(s=>hwMap.get(s)).filter(Boolean);
  return `<section class="wrap sec" id="vaultTop" style="padding-top:16px">
    <div class="personacard" style="margin-bottom:22px">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:14px">
        <div style="max-width:72ch">
          <p class="eyebrow" style="margin-bottom:4px">The Vault · Unfinished craft, sunsetted worlds &amp; folklore</p>
          <h1 class="h1" style="font-size:clamp(1.45rem,1.05rem + 1.9vw,2.15rem);margin:0 0 6px">Cancelled projects, sunsetted servers &amp; regional hardware</h1>
          <p class="sub" style="margin:0;font-size:14px">Years of craft survive even when a project is cancelled before launch or live servers go dark. Trace the ideas unfinished projects seeded, revisit sunsetted online worlds, and explore parallel regional scenes.</p>
        </div>
        <div class="row vault-hero-acts" style="gap:8px">
          <button type="button" class="btn sm primary wrap" data-act="featureSheet" data-cat="Cancelled / Sunsetted / Lore">Suggest a lost game or story</button>
          ${isDevMode()?`<button type="button" class="btn sm wrap" data-act="makerSheet">🛠 Log unshipped credit</button>`:""}
        </div>
      </div>
      <div class="pickstrip" style="margin-top:12px;padding-bottom:0">
        <button type="button" class="chip" data-act="bandJump" data-to="vCancelled">Cancelled &amp; Unfinished (${cancelled.length})</button>
        <button type="button" class="chip" data-act="bandJump" data-to="vSunset">Servers Gone Dark (${sunsetted.length})</button>
        <button type="button" class="chip" data-act="bandJump" data-to="vLore">Folklore &amp; Parallel Scenes (${lore.length})</button>
        <button type="button" class="chip" data-act="bandJump" data-to="vDeepHw">Obscure &amp; Regional Hardware (${deepHw.length})</button>
      </div>
    </div>

    <div id="vCancelled" style="margin-bottom:28px">
      <div class="mechgrid">${cancelled.map(g=>vaultGameCardHTML(g,"cancelled")).join("")}</div>
    </div>

    <div id="vSunset" style="margin-bottom:28px">
      <div class="sechead"><div><p class="eyebrow">Places kept alive in memory</p><h2 class="h2">Worlds whose servers went dark (${sunsetted.length})</h2><p class="sub">Online worlds whose official servers have closed. Tap <b>+ Played</b> to keep any of them on your timeline.</p></div></div>
      <div class="mechgrid">${sunsetted.map(g=>vaultGameCardHTML(g,"sunset")).join("")}</div>
    </div>

    <div id="vLore" style="margin-bottom:28px">
      <div class="sechead"><div><p class="eyebrow">Parallel scenes, vaporware &amp; desert digs</p><h2 class="h2">Regional histories &amp; industry folklore</h2><p class="sub">From Tiger Telematics' Gizmondo collapse and Atari's New Mexico excavation to Brazil's TecToy Sega run, satellite-broadcast Zelda, and Desert Bus.</p></div></div>
      <div class="mechgrid">${lore.map(loreCardHTML).join("")}</div>
    </div>

    <div id="vDeepHw" style="margin-bottom:24px">
      <div class="sechead"><div><p class="eyebrow">Beyond standard console lists</p><h2 class="h2">Obscure, regional &amp; cult hardware (${deepHw.length})</h2><p class="sub">All of these machines are also available under <a href="#systems"><b>Systems</b></a>.</p></div><a class="btn sm" href="#systems">Filter by systems ▸</a></div>
      <div class="hwgrid">${deepHw.map(hardwareCardHTML).join("")}</div>
    </div>

    <div class="banner">
      <p><b>Know a cancelled project, sunsetted online world, regional Famiclone, or piece of gaming history worth documenting?</b></p>
      <button type="button" class="btn primary wrap" data-act="featureSheet" data-cat="Cancelled / Sunsetted / Lore">Suggest a lost game or story ▸</button>
    </div>
  </section>`;
}
function renderStudiosBody(){
  const f=state.stFilter||"all";
  const curated=[...STUDIOS.values()].filter(s=>s.curated).sort((a,b)=>(b.maxInf-a.maxInf)||(b.games.length-a.games.length));
  const pioneers=CULT.pioneers||[],hardware=CULT.hardware||[],charities=CULT.charities||[],grats=allGratitudeNotes(),realStories=CULT.realStories||[];
  const list=f==="closed"?curated.filter(s=>s.status!=="active"):f==="active"?curated.filter(s=>s.status==="active"):curated;
  const topOther=[...STUDIOS.values()].filter(s=>!s.curated&&s.games.length>=4).sort((a,b)=>b.games.length-a.games.length).slice(0,36);
  const wkN=workedEntries(hist).length;
  return `<section class="wrap exhero" style="padding-top:16px">
    <p class="eyebrow">Studios, pioneers &amp; hardware</p>
    <h1 class="h1">Studios change. Their people carry the craft forward.</h1>
    <p class="lede">Behind every cover, console shell, and prototype is a team of designers, silicon engineers, programmers, writers, artists, and composers.</p>
    <div class="search bigsearch"><input class="input" id="stq" type="search" placeholder="Search studios, pioneers, or hardware — e.g. Looking Glass, Bullfrog, Ken Kutaragi…" autocomplete="off" aria-label="Search studios, pioneers, and hardware"><div class="results" id="str" hidden></div></div>
    <div class="pickstrip" style="margin-top:12px">
      <button class="chip" data-act="stFilt" data-f="all" aria-pressed="${f==="all"}">All featured (${curated.length})</button>
      <button class="chip" data-act="stFilt" data-f="closed" aria-pressed="${f==="closed"}">Shuttered &amp; scattered (${curated.filter(s=>s.status!=="active").length})</button>
      <button class="chip" data-act="stFilt" data-f="active" aria-pressed="${f==="active"}">Active studios (${curated.filter(s=>s.status==="active").length})</button>
      ${pioneers.length?`<button class="chip" data-act="stFilt" data-f="pioneers" aria-pressed="${f==="pioneers"}">Pioneers (${pioneers.length})</button>`:""}
      ${hardware.length?`<button class="chip" data-act="stFilt" data-f="hardware" aria-pressed="${f==="hardware"}">Hardware (${hardware.length})</button>`:""}
      <button class="chip" data-act="stFilt" data-f="gratitude" aria-pressed="${f==="gratitude"}">Stories &amp; postcards (${realStories.length+grats.length})</button>
      ${charities.length?`<button class="chip" data-act="stFilt" data-f="giveback" aria-pressed="${f==="giveback"}">Non-profits (${charities.length})</button>`:""}
      ${isDevMode()?`<button class="chip craftchip" data-act="makerSheet" aria-pressed="${wkN>0||!!(hist.workedStudios&&hist.workedStudios.length)}">🛠 ${wkN?`My dev credits (${wkN})`:"Add dev credits"}</button>`:""}
    </div>
  </section>
  ${f==="gratitude"?gratitudeSectionHTML()
  :f==="pioneers"?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Hall of pioneers · 1958–today</p><h2 class="h2">Designers, coders, composers &amp; trailblazers</h2><p class="sub">Chronological milestones from lab oscilloscopes and ROM cartridges to modern indie breakthroughs.</p></div></div>
    <div class="piogrid">${pioneers.map(pioneerCardHTML).join("")}</div></section>`
  :f==="hardware"?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Silicon, sound chips &amp; industrial design</p><h2 class="h2">The machines &amp; hardware engineers</h2><p class="sub">From Jay Miner's custom Amiga silicon and Bob Yannes's C64 SID synth to Dendy multicarts, Vectrex vector CRTs, and Ken Kutaragi's PlayStation.</p></div></div>
    <div class="hwgrid">${hardware.map(hardwareCardHTML).join("")}</div></section>`
  :f==="giveback"?giveBackSectionHTML(charities)
  :`<section class="wrap sec"><div class="stgrid">${list.map(studioCardHTML).join("")}</div></section>
    ${f==="all"&&realStories.length?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Documented history · Sourced</p><h2 class="h2">Moments where games &amp; makers left a mark</h2><p class="sub">Real, attributed stories — plus download a Thank-You Postcard to share with a developer.</p></div><div class="row"><button type="button" class="btn sm love" data-act="gratSheet">Create thank-you postcard</button><button class="btn sm" data-act="stFilt" data-f="gratitude">All ${realStories.length} stories ▸</button></div></div>
      <div class="gratgrid">${realStories.slice(0,3).map(realStoryCardHTML).join("")}</div></section>`:""}
    ${f==="all"&&pioneers.length?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Hall of pioneers · 1958–today</p><h2 class="h2">Trailblazers who shaped how we play</h2><p class="sub">Meet ${pioneers.length} influential creators across seven decades of game history.</p></div><button class="btn sm" data-act="stFilt" data-f="pioneers">See all ${pioneers.length} pioneers ▸</button></div>
      <div class="piogrid">${pioneers.slice(0,9).map(pioneerCardHTML).join("")}</div></section>`:""}
    ${f==="all"&&hardware.length?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Hardware engineers</p><h2 class="h2">Consoles, home computers &amp; custom silicon</h2><p class="sub">Every generation stood on bold custom chips, sound synthesizers, and controllers.</p></div><button class="btn sm" data-act="stFilt" data-f="hardware">See all ${hardware.length} machines ▸</button></div>
      <div class="hwgrid">${hardware.slice(0,6).map(hardwareCardHTML).join("")}</div></section>`:""}
    ${topOther.length?`<section class="wrap sec"><h2 class="h2">More studios across the catalog</h2><p class="sub">Every studio in the database (${STUDIOS.size.toLocaleString()} total) has its own page.</p>
      <div class="makers">${topOther.map(s=>`<button type="button" class="makerbtn${isWorkedStudio(hist,s.id)?" worked":""}" data-act="studio" data-st="${esc(s.id)}">${isWorkedStudio(hist,s.id)?"🛠 ":""}${flag(s.cc)} ${esc(s.name)}<span>${s.games.length}</span></button>`).join("")}</div></section>`:""}
    ${giveBackSectionHTML(charities)}`}`;
}
function wireStudiosSearch(){
  const inp=$("#stq"),box=$("#str");if(!inp||!box)return;
  const pioneers=CULT.pioneers||[],hardware=CULT.hardware||[],lore=CULT.vaultLore||[];
  inp.addEventListener("input",()=>{
    const rawV=inp.value.trim(),q=norm(rawV);if(!q){box.hidden=true;return}
    const stHits=[...STUDIOS.values()].filter(s=>norm(s.name).includes(q)||s.aliases.some(a=>norm(a).includes(q))||s.makers.some(mk=>norm(mk).includes(q))).sort((a,b)=>(b.curated-a.curated)||(b.games.length-a.games.length)).slice(0,5);
    const vGameHits=G.filter(g=>(g.cancelled||g.sunset)&&(g.n.includes(q)||(g.aka&&norm(g.aka).includes(q)))).slice(0,4);
    const loreHits=lore.filter(l=>norm(l.title+" "+l.body).includes(q)).slice(0,3);
    const pioHits=pioneers.filter(p=>norm(p.name).includes(q)||norm(p.role||"").includes(q)).slice(0,3);
    const hwHits=hardware.filter(h=>norm(h.sys).includes(q)||norm(h.engineers||"").includes(q)||norm(h.maker||"").includes(q)).slice(0,3);
    const rows=[
      ...stHits.map(s=>`<button type="button" class="res" data-act="studio" data-st="${esc(s.id)}"><span>${flag(s.cc)}</span><span><b>${esc(s.name)}</b><small>${plural(s.games.length,"game")}${s.makers.length?" · "+esc(s.makers.slice(0,3).join(", ")):""}</small></span><span class="y">${s.founded||""}</span></button>`),
      ...vGameHits.map(g=>`<button type="button" class="res" data-act="game" data-id="${esc(g.id)}"><span class="mono muted">${g.cancelled?"VLT":"SUN"}</span><span><b>${esc(g.title)}</b><small>${g.cancelled?"Unreleased / Cancelled":"Sunsetted World"} · ${esc(studio(g))}</small></span><span class="y">${g.year}</span></button>`),
      ...loreHits.map(l=>`<button type="button" class="res" data-act="almTab" data-t="vault" data-h="vault"><span class="mono muted">VLT</span><span><b>${esc(l.title)}</b><small>The Vault · ${esc(l.tag)}</small></span><span class="y">▸</span></button>`),
      ...pioHits.map(p=>`<button type="button" class="res" data-act="stFilt" data-f="pioneers"><span class="mono muted">PIO</span><span><b>${esc(p.name)}</b><small>Pioneer · ${esc(p.role||"")}</small></span><span class="y">${p.year||""}</span></button>`),
      ...hwHits.map(h=>`<button type="button" class="res" data-act="stFilt" data-f="hardware"><span class="mono muted">HW</span><span><b>${esc(h.sys)}</b><small>${esc(h.maker)} · ${esc(h.engineers)}</small></span><span class="y">${h.year||""}</span></button>`),
      ...(stHits.length+vGameHits.length+loreHits.length+pioHits.length+hwHits.length<3?[`<button type="button" class="res" data-act="featureSheet" data-cat="Cancelled / Sunsetted / Lore" data-title="${esc(rawV)}"><span class="mono">+</span><span><b>Suggest “${esc(rawV)}” for the catalog</b><small>No sign-in required</small></span><span class="y">▸</span></button>`]:[])
    ];
    box.innerHTML=rows.join("");
    box.hidden=false;clampSearchBox(box);
  });
}
function renderStudio(m,id){
  const st=findStudio(id);if(!st){go("studios");return}
  const yrs=st.founded?(st.closed?`${st.founded}–${st.closed}`:`${st.founded}–present`):(st.games.length?`${st.games[0].year}–${st.games[st.games.length-1].year}`:"");
  const inSt=isWorkedStudio(hist,st.id);
  const mobyCompany=`https://www.mobygames.com/search/?q=${encodeURIComponent(st.name)}&type=company`;
  m.innerHTML=`<div class="wrap">
    <nav class="trail"><button type="button" class="navback" data-act="navBack" data-fb="studios">◂ Back</button><button data-act="goStudios">Studios</button><span aria-hidden="true">›</span><span class="cur">${esc(st.name)}</span></nav>
    <section style="padding-block:16px 8px">
      <div class="row" style="gap:10px;margin-bottom:6px"><span class="eyebrow" style="margin:0">Studio &amp; makers</span>${statusLabel(st)}</div>
      <div class="row" style="gap:12px;margin-bottom:8px">${studioLogoHTML(st,"lg")}<h1 class="h1" style="margin:0">${flag(st.cc)} ${esc(st.name)}</h1></div>
      <p class="meta"><span class="mono">${esc(yrs)}</span>${st.hq?`<span>${esc(st.hq)}</span>`:""}${st.cc?`<button type="button" class="stbtn" data-act="country" data-cc="${esc(st.cc)}">${esc(countryName(st.cc))} ▸</button>`:""}</p>
      ${st.bio?`<p class="lede" style="margin-top:12px">${esc(st.bio)}</p>`:""}
      <div class="gstats"><span><b>${st.games.length}</b> game${st.games.length===1?"":"s"} in catalog</span><span><b>${st.treeCount}</b> in the family tree</span><span><b>${st.maxInf.toLocaleString()}</b> max cross-genre reach</span></div>
      <div class="row" style="margin-top:14px"><button type="button" class="btn sm love" data-act="gratSheet" data-st="${esc(st.id)}">Thank ${esc(st.name)} makers</button>${isDevMode()?`<button type="button" class="btn sm ${inSt?"craft":""}" data-act="toggleWkSt" data-st="${esc(st.id)}">🛠 ${inSt?"Worked here ✓":"I worked here"}</button>`:""}<a class="btn sm" href="${esc(mobyCompany)}" target="_blank" rel="noopener">Team roll call on MobyGames ↗</a><a class="btn sm ghost" href="https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(st.name+" game")}" target="_blank" rel="noopener">Find alumni on LinkedIn ↗</a><button class="btn sm ghost" data-act="suggest" data-subj="${esc("Studio note: "+st.name)}">Suggest studio note</button></div>
      ${inSt?`<div class="craftcard" style="margin-top:14px;padding:12px 16px"><p style="margin:0;font-size:14px">🛠 <b>${esc(st.name)}</b> is on your Maker Legacy. Tap <b>🛠 I worked on</b> under any game below to mark titles you helped ship, or <button type="button" class="link" data-act="makerSheet">log an unshipped / canceled project</button>.</p></div>`:""}
    </section>
    ${(()=>{const sGrats=allGratitudeNotes().filter(x=>x.studio===st.id||(x.game&&st.games.some(g=>g.id===x.game)));return sGrats.length?`<section class="sec"><h2 class="h2">Player notes to ${esc(st.name)}</h2><div class="gratgrid" style="margin-top:8px">${sGrats.map(gratitudeCardHTML).join("")}</div></section>`:""})()}
    ${st.makers&&st.makers.length?`<section class="sec"><h2 class="h2">Notable creators &amp; team members</h2><p class="sub">Designers, programmers, writers, artists, and composers connected with ${esc(st.name)}.</p>
      <div class="makers">${st.makers.map(mk=>`<a class="makerbtn" href="https://www.mobygames.com/search/?q=${encodeURIComponent(mk)}&type=developer" target="_blank" rel="noopener">${esc(mk)} <span>↗</span></a>`).join("")}</div></section>`:""}
    ${st.diaspora&&st.diaspora.length?`<section class="sec"><h2 class="h2">Where the makers went next</h2><p class="sub">Studios and games shaped by ${esc(st.name)} alumni.</p>
      <div class="diasgrid">${st.diaspora.map(d=>{const dst=findStudio(d.studio);return `<div class="diascard"><b>${dst?`<button type="button" class="stbtn" data-act="studio" data-st="${esc(dst.id)}">${esc(d.studio)} ▸</button>`:esc(d.studio)}</b><p style="margin:4px 0 0;font-size:13px;color:var(--ink2)">${esc(d.note)}</p></div>`}).join("")}</div></section>`:""}
    <section class="sec"><h2 class="h2">Games by ${esc(st.name)} (${st.games.length})</h2><p class="sub">In chronological order. Tap any cover for its family tree, or tap a title for game info.</p>
      <div class="grid">${st.games.map(g=>tileHTML(g,hist,{act:"game",sub:`${g.year}${g.tree?" · in tree":""}`,wkTog:true,quickTick:true})).join("")}</div></section>
  </div>${footer()}`;
}

/* ---------- prices, mobile craft, mods & mechanics ---------- */
function cpiFactorTo2026(y){
  const tbl=(MW.prices&&MW.prices.cpi)||{1977:60.6,1980:82.4,1985:107.6,1990:130.7,1995:152.4,2000:172.2,2005:195.3,2010:218.1,2015:237,2020:258.8,2026:324};
  const ks=Object.keys(tbl).map(Number).sort((a,b)=>a-b);
  const c26=tbl[2026]||324;
  if(y<=ks[0])return c26/tbl[ks[0]];
  if(y>=ks[ks.length-1])return 1;
  for(let i=0;i<ks.length-1;i++){
    const a=ks[i],b=ks[i+1];
    if(y>=a&&y<=b){const t=(y-a)/(b-a),cpi=tbl[a]+t*(tbl[b]-tbl[a]);return c26/cpi}
  }
  return 1;
}
function estimateGamePrice(g){
  if(!g||!playable(g))return null;
  if(F2P_IDS.has(g.id)||/free-to-play/i.test(g.note||""))return {nom:0,real:0,kind:"Free-to-play"};
  const ps=sysOfGame(g);
  if(ps.length===1&&ps[0]==="Arcade")return {nom:0.25,real:+(0.25*cpiFactorTo2026(Math.max(1977,g.year))).toFixed(2),kind:"Arcade quarter",arcade:true};
  if(ps.every(p=>p==="iPhone / iPad"||p==="Android"||p==="Browser"))return {nom:2.99,real:Math.round(2.99*cpiFactorTo2026(g.year)),kind:"Mobile / web"};
  let nom=59.99;
  if(g.year<1983)nom=34.95;
  else if(g.year<1987)nom=ps.some(p=>/Commodore 64|ZX Spectrum|Amstrad|Amiga|Atari ST|PC/.test(p))?29.95:39.95;
  else if(g.year<1991)nom=ps.some(p=>/Amiga|Commodore 64|PC|Atari ST/.test(p))?39.95:49.99;
  else if(g.year<1996)nom=ps.some(p=>/SNES|Genesis|Neo Geo/.test(p))?64.99:44.99;
  else if(g.year<2000)nom=ps.includes("Nintendo 64")&&!ps.includes("PlayStation")?64.99:49.99;
  else if(g.year<2005)nom=49.99;
  else if(g.year<2020)nom=g.pop<=3?19.99:59.99;
  else nom=g.pop<=3?19.99:69.99;
  return {nom,real:Math.round(nom*cpiFactorTo2026(Math.max(1977,g.year))),kind:g.pop<=3&&g.year>=2006?"Indie / mid-tier":"Standard retail"};
}
function renderPricesHTML(){
  const P=MW.prices||{eras:[],consoles:[],comparisons:[]};
  const eras=P.eras||[],conList=P.consoles||[],cmps=P.comparisons||[];
  const useReal=!!state.priceReal,showComp=!!state.priceComp;
  const selIdx=Math.max(0,Math.min(eras.length-1,state.priceEra??3));
  const selEra=eras[selIdx]||eras[0];
  const maxVal=Math.max(1,...eras.map(e=>useReal?(e.highReal||e.real):(e.high||e.nom)));
  const fmtUSD=v=>v>=100?`$${Math.round(v).toLocaleString()}`:v===0?"$0":`$${Number(v).toFixed(v%1?2:0)}`;
  const catIndies=G.filter(g=>playable(g)&&g.year>=2008&&g.pop<=3).length;
  const catCarts=G.filter(g=>playable(g)&&g.year>=1977&&g.year<=1996&&sysOfGame(g).some(p=>/Atari 2600|NES|SNES|Genesis|Game Boy|Nintendo 64|Neo Geo/.test(p))).length;
  let myReceipt="";
  if(entries(hist).length>=2){
    const priced=entries(hist).filter(x=>x.g).map(x=>({g:x.g,y:x.y,p:estimateGamePrice(x.g)})).filter(x=>x.p&&!x.p.arcade&&x.p.nom>0);
    if(priced.length>=2){
      const sumNom=priced.reduce((s,x)=>s+x.p.nom,0),sumReal=priced.reduce((s,x)=>s+x.p.real,0);
      const topBox=priced.slice().sort((a,b)=>b.p.real-a.p.real)[0];
      myReceipt=`<div class="personacard" style="margin-bottom:18px">
        <div class="row" style="justify-content:space-between"><div><p class="eyebrow" style="margin-bottom:3px">Your timeline receipt · ${priced.length} boxed/digital games</p>
          <h2 class="h2" style="font-size:19px">~$${Math.round(sumNom).toLocaleString()} on launch-day price tags · ~$${Math.round(sumReal).toLocaleString()} in 2026 money</h2>
          <p class="sub" style="margin:4px 0 0">${topBox?`Priciest box on your timeline in real purchasing power: <b>${esc(topBox.g.title)} (${topBox.g.year})</b> — ~$${topBox.p.nom.toFixed(2)} then, or <b>~$${topBox.p.real}</b> today. `:""}Birthday savings, video rental stores, and hand-me-downs carried a lot of us.</p>
        </div><button type="button" class="btn sm primary" data-act="priceComp">${showComp?"See 1977–2026 era chart":"Compare vs. movies &amp; life ▸"}</button></div>
      </div>`;
    }
  }
  const intro=`<section class="wrap exhero" style="padding-top:16px">
    <p class="eyebrow">50 years of sticker prices &amp; inflation</p>
    <h1 class="h1">Are video games actually getting more expensive?</h1>
    <p class="lede">Trace 50 years of arcade quarters, $80 SNES cartridges, $1 PlayStation CDs, and $15 indies — then compare them against movies, music, and everyday expenses.</p>
  </section>`;
  if(showComp){
    const maxPct=Math.max(100,...cmps.map(c=>Math.abs(c.pct)));
    return intro+`<section class="wrap sec" id="priceTop">
      <div class="row" style="justify-content:space-between;margin-bottom:16px">
        <div class="row" style="gap:8px">
          <button type="button" class="btn wrap" data-act="priceComp" aria-pressed="false">◂ Game &amp; console prices (1977–2026)</button>
          <button type="button" class="btn primary wrap" data-act="priceComp" aria-pressed="true">Vs. Movies, Music &amp; Everyday Life</button>
        </div>
        <span class="sync">1990 baseline ($49.99 NES/PC game) → 2026 US CPI-U &amp; retail averages</span>
      </div>
      ${myReceipt}
      <div class="card" style="margin-bottom:18px">
        <p class="eyebrow">1990 → Today · Sticker price % change</p>
        <h2 class="h2">How the “$70 game” stacks up against movies, music, burgers &amp; rent</h2>
        <p class="sub">Since 1990, overall US consumer prices rose <b>+148%</b> ($100 → $248). If a 1990 $49.99 game had tracked general inflation, standard games today would cost <b>$124</b> — before counting 100× larger teams and budgets.</p>
        <div class="cmpbars">
          ${cmps.map(c=>{
            const neg=c.pct<0,w=(Math.max(5,Math.abs(c.pct)/maxPct*100)).toFixed(1);
            return `<div class="cmprow${c.highlight?" hi":""}">
              <div><b style="font-size:13.5px">${esc(c.item)}</b><small class="muted" style="display:block;font-size:11.5px">${fmtUSD(c.p1990)} in 1990 → <b>${fmtUSD(c.p2026)}</b> today${c.perHr&&c.perHr!=="—"?" · "+esc(c.perHr):""}</small></div>
              <div class="cmpbar"><i style="width:${w}%;${neg?"background:var(--t-mech)":""}"></i></div>
              <span class="mono" style="font-weight:700;font-size:13px;min-width:64px;text-align:right;color:${neg?"var(--t-mech)":c.highlight?"var(--accent)":"var(--love)"}">${c.pct>0?"+"+c.pct:c.pct}%</span>
            </div>`;
          }).join("")}
        </div>
      </div>
      <div class="hgrid" style="margin-bottom:18px">
        <div class="card"><p class="eyebrow">Cost per hour</p><h3 class="h3">What $70 (or $15) buys in hours</h3>
          <p class="sub">Comparing a typical night out against worlds you inhabit for weeks:</p>
          <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>Live Arena Concert</b><small>~2.5 hours · avg major tour ticket</small></span><span class="mono" style="font-weight:700;color:var(--love)">~$54.00 / hr</span></div>
          <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>IMAX Movie + Popcorn</b><small>~2.3 hours ($19 ticket + $9 snack)</small></span><span class="mono" style="font-weight:700;color:var(--love)">~$12.15 / hr</span></div>
          <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>Hardcover Novel</b><small>~10 hours ($28 cover price)</small></span><span class="mono" style="font-weight:700">~$2.80 / hr</span></div>
          <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>$69.99 Flagship RPG / Open World</b><small>50–120+ hours (Elden Ring, BG3, GTA)</small></span><span class="mono" style="font-weight:700;color:var(--accent)">~$0.58–$1.40 / hr</span></div>
          <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>$14.99 Indie Release</b><small>50–100+ hours (Stardew, Hollow Knight, Balatro)</small></span><span class="mono" style="font-weight:700;color:var(--t-mech)">~$0.15–$0.30 / hr</span></div>
        </div>
        <div class="card"><p class="eyebrow">Why players still feel squeezed</p><h3 class="h3">Sticker price isn't the whole story</h3>
          <p style="margin:0 0 10px;font-size:13.5px;color:var(--ink2);line-height:1.5"><b>1. Essentials ate disposable income:</b> Rent (+231%), tuition (+508%), and groceries climbed much faster than wages — so $70 hurts more when housing already took the budget.</p>
          <p style="margin:0 0 10px;font-size:13.5px;color:var(--ink2);line-height:1.5"><b>2. Deluxe editions &amp; battle passes:</b> In 1994, a $70 cartridge was 100% of the game and could be lent or resold. Today, $100 early-access tiers and microtransactions change what a base purchase feels like.</p>
          <p style="margin:0;font-size:13.5px;color:var(--ink2);line-height:1.5"><b>3. The upside:</b> Between <b>$15–$25 indies</b> (${catIndies.toLocaleString()} post-2008 titles in this catalog), deep Steam/GOG sales, and libraries, patient players pay less per classic than in any earlier era.</p>
        </div>
      </div>
      <div tabindex="0" role="region" aria-labelledby="ptableCaption" class="ptablewrap">
        <table class="ptable">
          <caption id="ptableCaption">1990 vs. 2026 side-by-side price comparison (US retail &amp; BLS CPI-U inflation adjustment)</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">1990 sticker</th><th scope="col">1990 in 2026 $</th><th scope="col">2026 price</th><th scope="col">Sticker change</th><th scope="col">Value / hour</th></tr></thead>
          <tbody>${cmps.map(c=>`<tr class="${c.highlight?"hi":""}"><th scope="row">${esc(c.item)}</th><td class="mono">${fmtUSD(c.p1990)}</td><td class="mono muted">${fmtUSD(c.p1990Real)}</td><td class="mono"><b>${fmtUSD(c.p2026)}</b></td><td class="mono" style="font-weight:700;color:${c.pct<0?"var(--t-mech)":c.highlight?"var(--accent)":"var(--love)"}">${c.pct>0?"+"+c.pct:c.pct}%</td><td>${esc(c.perHr||"—")}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
  }
  const [fYr,tYr]=(selEra?selEra.era:"1991–1995").split("–").map(s=>parseInt(s,10));
  const eraCount=G.filter(g=>playable(g)&&g.year>=fYr&&g.year<=tYr).length;
  const selGames=(selEra&&selEra.games||[]).map(gameRef).filter(Boolean);
  return intro+`<section class="wrap sec" id="priceTop">
    <div class="row" style="justify-content:space-between;margin-bottom:16px">
      <span class="seg" role="group" aria-label="Price lens" style="max-width:100%">
        <button type="button" data-act="priceReal" data-v="0" aria-pressed="${!useReal}">Launch sticker ($)</button>
        <button type="button" data-act="priceReal" data-v="1" aria-pressed="${useReal}">In 2026 $ (inflation)</button>
      </span>
      <button type="button" class="btn primary wrap" data-act="priceComp">Compare vs. Movies, Music &amp; Life ▸</button>
    </div>
    ${myReceipt}
    <div class="card" style="margin-bottom:18px">
      <div class="row" style="justify-content:space-between">
        <div><p class="eyebrow">${useReal?"Real purchasing power (2026 US CPI-U dollars)":"Nominal shelf tag at launch (1977–2026)"}</p>
          <h2 class="h2">${useReal?"Adjusted for inflation, 1990s cartridges peaked at $140–$200+ per game":"Sticker tags climbed on 16-bit silicon, fell on $1 CDs, then held at $60 for 15 years"}</h2>
        </div>
        <span class="sync">Tap any era column · amber whisker = multi-chip cart / deluxe peak</span>
      </div>
      <div class="pchart" role="group" aria-label="Game prices by era">
        ${eras.map((e,idx)=>{
          const v=useReal?e.real:e.nom,hi=useReal?(e.highReal||e.real):(e.high||e.nom);
          const bh=Math.max(12,Math.round(v/maxVal*136)),hh=Math.max(bh,Math.round(hi/maxVal*136));
          return `<button type="button" class="pecol" data-act="priceEra" data-i="${idx}" aria-pressed="${idx===selIdx}">
            <span class="peval">$${Math.round(v)}</span>
            <span class="pebarwrap">
              ${hh>bh+4?`<i class="pehi" style="height:${hh-bh}px;bottom:${bh}px" title="High-end cartridge / deluxe peak: $${Math.round(hi)}"></i>`:""}
              <i class="pebar${useReal?" real":""}" style="height:${bh}px"></i>
            </span>
            <span class="pelbl">${esc(e.short)}</span>
          </button>`;
        }).join("")}
      </div>
      ${selEra?`<div class="diascard" style="margin-top:12px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;align-items:center">
        <div style="flex:1 1 260px;min-width:0">
          <span class="eyebrow" style="margin:0">${esc(selEra.era)} · ${esc(selEra.format)} · ${eraCount.toLocaleString()} catalog games</span>
          <h3 class="h2" style="margin:4px 0">${esc(selEra.label)} — <b>$${selEra.nom.toFixed(2)}</b> launch tag <span class="muted" style="font-weight:500">(~$${selEra.real} in 2026 $)</span></h3>
          <p style="margin:4px 0 0;font-size:13.5px;color:var(--ink2);max-width:68ch">${esc(selEra.note)}</p>
        </div>
        ${selGames.length?`<div class="row" style="gap:8px">${selGames.map(g=>`<button type="button" class="sbook" style="width:64px" data-act="quickLook" data-id="${g.id}">${cover(g,{showYear:false})}<span class="yr">${g.year}</span><b style="font-size:10.5px">${esc(g.title)}</b></button>`).join("")}</div>`:""}
      </div>`:""}
    </div>
    <div class="hgrid" style="margin-bottom:18px">
      <div class="card"><p class="eyebrow">From our ${G.length.toLocaleString()}-game catalog</p><h3 class="h3">Why CDs &amp; digital changed the economics</h3>
        <p class="sub">Physical media cost used to dictate retail prices:</p>
        <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>Custom Silicon Cartridges (${catCarts.toLocaleString()} classics)</b><small>1977–1999 · $12–$28 factory BOM per cart + battery SRAM</small></span><span class="mono" style="font-weight:700;color:var(--love)">~$100–$195 real</span></div>
        <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>PlayStation / PC Optical Discs</b><small>1995–2012 · ~$0.80–$1.50 to press a 650MB CD or 4.7GB DVD</small></span><span class="mono" style="font-weight:700">~$85–$100 real</span></div>
        <div class="anc" style="grid-template-columns:minmax(0,1fr) auto"><span><b>Modern Indie Digital (${catIndies.toLocaleString()} in catalog)</b><small>2008–today · Zero disc manufacturing, global digital storefronts</small></span><span class="mono" style="font-weight:700;color:var(--t-mech)">$5–$25 today</span></div>
      </div>
      <div class="card"><p class="eyebrow">Hardware sticker shock</p><h3 class="h3">Console launch prices (then vs. 2026 $)</h3>
        <div style="margin-top:6px">${conList.map(c=>`<div class="anc" style="grid-template-columns:46px minmax(0,1fr) auto;padding:6px 0">${hwSVG(c.sys.replace(" 500","").replace(" AES",""))}<span><b>${esc(c.sys)}</b> <small class="mono muted">(${c.year})</small><small style="display:block">$${c.nom} at launch</small></span><span class="mono" style="font-weight:700;color:${c.real>=1000?"var(--love)":"var(--ink)"}">~$${c.real.toLocaleString()} <small class="muted" style="font-weight:400">in '26</small></span></div>`).join("")}</div>
      </div>
    </div>
    <div class="banner">
      <p><b>How does gaming's +40% sticker increase since 1990 compare to movie tickets, concerts, coffee, and rent?</b></p>
      <button type="button" class="btn primary wrap" data-act="priceComp">Show Movies, Music &amp; Life Comparison ▸</button>
    </div>
  </section>`;
}
function renderCraftPillarGrid(pillars){
  return `<div class="mechgrid">${(pillars||[]).map(p=>{
    const exs=(p.games||[]).map(gameRef).filter(Boolean);
    return `<article class="mechcard">
      <span class="eyebrow" style="margin:0">${esc(p.tag||"")}</span>
      <h2 class="h2" style="font-size:18px;margin:2px 0">${esc(p.title||"")}</h2>
      <p style="margin:0;font-size:13.5px;color:var(--ink2);line-height:1.48">${esc(p.body||"")}</p>
      ${exs.length?`<div class="shelfrow" style="gap:8px;padding-top:8px;margin-top:auto">${exs.map(g=>`<button type="button" class="sbook" style="width:64px" data-act="quickLook" data-id="${g.id}">${cover(g,{showYear:false})}<span class="yr">${g.year}</span><b style="font-size:10.5px">${esc(g.title)}</b></button>`).join("")}</div>`:""}
    </article>`;
  }).join("")}</div>`;
}
function renderMobileCraftHTML(){
  const pillars=CULT.mobilePillars||[];
  const mobGames=G.filter(g=>playable(g)&&sysOfGame(g).some(p=>p==="iPhone / iPad"||p==="Android"||p==="Mobile (feature phone)")&&g.pop>=3).sort((a,b)=>b.pop-a.pop||b.inf-a.inf||a.year-b.year).slice(0,24);
  const mobStudios=["king","supercell","rovio-entertainment","popcap-games","ustwo-games","niantic","hoyoverse"].map(id=>STUDIOS.get(id)).filter(Boolean);
  return `<section class="wrap sec" style="padding-top:16px">
    <div class="personacard" style="margin-bottom:20px">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="max-width:74ch">
          <p class="eyebrow" style="margin-bottom:4px">Pocket craft · 3+ billion players</p>
          <h1 class="h1" style="font-size:clamp(1.45rem,1.05rem + 1.9vw,2.15rem);margin:0 0 6px">How pocket screens brought billions of players into games</h1>
          <p class="sub" style="margin:0;font-size:13.8px">From 1997 Nokia Snake and tactile one-thumb touch physics to 90-second commute loops, small autonomous studio cells, and tight thermal engineering — pocket hardware became the world's first game machine for half the planet.</p>
        </div>
        <div class="row" style="gap:6px">
          ${isDevMode()?`<button type="button" class="btn sm primary" data-act="makerSheet">🛠 Log mobile credits</button>`:""}
          <button type="button" class="btn sm" data-act="featureSheet" data-cat="Missing Game / Classic">Suggest mobile classic</button>
        </div>
      </div>
    </div>
    ${renderCraftPillarGrid(pillars)}
  </section>
  ${mobStudios.length?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Studios &amp; teams</p><h2 class="h2">Mobile pioneers &amp; studio cultures</h2><p class="sub">Tap any studio to explore its games and alumni diaspora.</p></div></div>
    <div class="stgrid">${mobStudios.map(studioCardHTML).join("")}</div></section>`:""}
  ${mobGames.length?`<section class="wrap sec"><h2 class="h2" style="margin-bottom:10px">Landmark mobile &amp; cross-pocket games (${mobGames.length})</h2>
    <div class="grid">${mobGames.map(g=>tileHTML(g,hist,{act:"quickLook",quickTick:true})).join("")}</div></section>`:""}`;
}
function renderUgcCraftHTML(){
  const pillars=CULT.ugcPillars||[];
  const stories=CULT.modStories||[];
  const ugcIds=["counter-strike","dayz","team-fortress","pubg","vampire-slayer","action-quake-2","threewave-ctf","desert-combat","natural-selection","the-specialists","science-and-industry","sven-co-op","they-hunger","cry-of-fear","the-hidden-source","garrys-mod","trouble-in-terrorist-town","prop-hunt","defense-of-the-ancients","dota-auto-chess","dayz-battle-royale","project-reality","squad","the-stanley-parable","black-mesa","long-war","the-forgotten-city","minecraft","hypixel-skyblock","fivem-gta-rp","littlebigplanet","super-mario-maker","roblox","adopt-me","brookhaven-rp","doors-roblox","dress-to-impress","fortnite-creative-uefn","vrchat","dreams"];
  const ugcGames=ugcIds.map(gameRef).filter(Boolean);
  const ugcStudios=["valve","mojang-studios","roblox-corporation","epic-games"].map(id=>STUDIOS.get(id)).filter(Boolean);
  return `<section class="wrap sec" style="padding-top:16px">
    <div class="personacard" style="margin-bottom:20px">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="max-width:74ch">
          <p class="eyebrow" style="margin-bottom:4px">Mods, total conversions &amp; creator platforms · 1996–2026</p>
          <h1 class="h1" style="font-size:clamp(1.45rem,1.05rem + 1.9vw,2.15rem);margin:0 0 6px">Most of modern multiplayer started as a player mod</h1>
          <p class="sub" style="margin:0;font-size:13.8px">Tactical shooters (<i>Counter-Strike</i>), class shooters (<i>Team Fortress</i>), Battle Royale (<i>DayZ → PUBG</i>), MOBAs (<i>DotA</i>), social deduction (<i>TTT</i>), and late-night LAN staples like <i>Vampire Slayer</i>, <i>Desert Combat</i>, <i>Natural Selection</i>, and <i>The Specialists</i> began when players opened another game's editor.</p>
        </div>
        <div class="row" style="gap:6px">
          <button type="button" class="btn sm primary" data-act="openModsPack">Add mods to my timeline ▸</button>
          <button type="button" class="btn sm" data-act="featureSheet" data-cat="Missing Game / Classic" data-title="Mod: ">Suggest a mod</button>
        </div>
      </div>
      <div class="pickstrip" style="margin-top:12px;padding-bottom:0">
        ${stories.length?`<button type="button" class="chip" data-act="bandJump" data-to="modStories">Mod Origin Stories (${stories.length})</button>`:""}
        <button type="button" class="chip" data-act="bandJump" data-to="ugcPillarsSec">4 Eras of Modding &amp; UGC</button>
        <button type="button" class="chip" data-act="bandJump" data-to="ugcCatalogSec">Browse ${ugcGames.length} Mods &amp; UGC Worlds</button>
      </div>
    </div>
    ${stories.length?`<div id="modStories" style="margin-bottom:28px">
      <div class="sechead"><div><p class="eyebrow">Bedroom total conversions, LAN nights &amp; studio deals</p><h2 class="h2">Mod origin stories &amp; cult conversions</h2><p class="sub">Tap any game chip to inspect its family tree, watch footage, or add it to your timeline.</p></div></div>
      <div class="mechgrid">${stories.map(loreCardHTML).join("")}</div>
    </div>`:""}
    <div id="ugcPillarsSec">${renderCraftPillarGrid(pillars)}</div>
  </section>
  ${ugcStudios.length?`<section class="wrap sec"><div class="sechead"><div><p class="eyebrow">Toolmakers &amp; sandbox pioneers</p><h2 class="h2">Studios that handed players the keys</h2></div></div>
    <div class="stgrid">${ugcStudios.map(studioCardHTML).join("")}</div></section>`:""}
  ${ugcGames.length?`<section class="wrap sec" id="ugcCatalogSec"><div class="sechead"><div><h2 class="h2">Iconic mods, total conversions &amp; UGC worlds (${ugcGames.length})</h2><p class="sub">Tap <b>+ Played</b> to log any mod onto your timeline, or tap a cover for screenshots and lineage.</p></div><button type="button" class="btn sm primary" data-act="openModsPack">Open Mods picker pack ▸</button></div>
    <div class="grid">${ugcGames.map(g=>tileHTML(g,hist,{act:"quickLook",quickTick:true})).join("")}</div></section>`:""}`;
}
function renderAbout(m){
  const bio=CULT.aboutCreator||{name:"Johan Heurlin",born:1984,chapters:[]};
  const curPlaying=(bio.currentlyPlaying||[]).map(it=>({g:gameRef(it.id),blurb:it.blurb||""})).filter(x=>x.g);
  const favMods=(bio.favoriteMods||[]).map(gameRef).filter(Boolean);
  const pinnedCode=(bio.timelineCode||"").trim();
  const pinnedData=pinnedCode?decodeShare(pinnedCode):null;
  const tlSt=pinnedData?timelineStats(pinnedData):null;
  const tlPicks=pinnedData?entries(pinnedData).filter(x=>x.g).sort((a,b)=>b.lv-a.lv||a.y-b.y).slice(0,14):[];
  m.innerHTML=`<section class="wrap exhero">
    <nav class="trail" style="padding-top:0;margin-bottom:6px"><button type="button" class="navback" data-act="navBack" data-fb="timeline">◂ Back</button><span class="cur">About &amp; credits</span></nav>
    <p class="eyebrow">🇸🇪 → 🇺🇸 · Builder of Played &amp; Made</p>
    <h1 class="h1" style="margin-bottom:8px">Hi, I'm ${esc(bio.name||"Johan Heurlin")}</h1>
    <p class="lede" style="max-width:70ch">${esc(bio.tagline||"")}</p>
    <div class="card" style="margin-top:14px;max-width:78ch">
      <p style="margin:0 0 12px;font-size:14.8px;line-height:1.62;color:var(--ink)">${esc(bio.intro||"")}</p>
      <p style="margin:0;padding:10px 12px;border-radius:10px;background:var(--accent-soft);font-size:13px;color:var(--ink2);line-height:1.5"><b>Disclaimer:</b> Independent personal hobby project — views and notes are my own and not affiliated with Google or past employers.</p>
      <div class="row" style="margin-top:14px;gap:8px">
        ${bio.linkedin?`<a class="btn sm primary" href="${esc(bio.linkedin)}" target="_blank" rel="noopener">Connect on LinkedIn ↗</a>`:""}
        <a class="btn sm" href="#mods">Mod stories</a>
        <a class="btn sm" href="#mobile">Mobile craft</a>
        <button type="button" class="btn sm ghost" data-act="featureSheet">Send a note or game idea</button>
      </div>
    </div>
  </section>
  ${curPlaying.length?`<section class="wrap sec" id="currentlyPlaying">
    <div class="sechead"><div><p class="eyebrow">In rotation right now · Squad comms, survival &amp; pocket 4X</p><h2 class="h2">What I'm currently playing</h2><p class="sub">Tap any game for its family tree, info, or trailer in the floating mini-player.</p></div></div>
    <div class="mechgrid">${curPlaying.map(({g,blurb})=>`<article class="mechcard">
      <div class="today" style="grid-template-columns:72px minmax(0,1fr);gap:12px">
        ${cover(g,{tag:"button",attrs:`type="button" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}" aria-label="Inspect ${esc(g.title)}"`,showYear:false})}
        <div style="min-width:0">
          <span class="eyebrow" style="margin:0">${g.year} · ${flag(g.cc)} ${esc(studio(g))}</span>
          <h3 class="h2" style="font-size:16.5px;margin:2px 0"><button type="button" class="stbtn" style="font-weight:700;text-decoration:none;text-align:left" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}">${esc(g.title)}</button></h3>
          <p style="margin:3px 0 0;font-size:13px;color:var(--ink2);line-height:1.45">${esc(blurb||g.note||"")}</p>
        </div>
      </div>
      <footer class="row" style="margin-top:auto;padding-top:8px;gap:6px">
        <button type="button" class="btn sm ghost" data-act="watchTv" data-id="${g.id}">▶ Trailer</button>
        <button type="button" class="btn sm ghost" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}">${g.tree?"Family tree":"Game info"}</button>
      </footer>
    </article>`).join("")}</div>
    ${favMods.length?`<div class="card" style="margin-top:14px;padding:12px 15px">
      <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
        <div class="row" style="gap:6px"><span class="sync">All-time favorite mods:</span>${favMods.map(g=>`<button type="button" class="chip" style="padding:3px 9px;font-size:12px" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}">${esc(g.title)} (${g.year})</button>`).join("")}</div>
        <a class="link" style="font-size:12.5px" href="#mods">Read Mod Stories ▸</a>
      </div>
    </div>`:""}
  </section>`:""}
  <section class="wrap sec">
    <div class="sechead"><div><p class="eyebrow">16+ years across games, platforms &amp; studios</p><h2 class="h2">Casual career snapshot</h2><p class="sub">Where I've had the privilege of working alongside game makers across mobile, PC, and cross-platform ecosystems.</p></div></div>
    <div class="mechgrid">${(bio.chapters||[]).map(ch=>{
      const stRef=ch.org==="King"?STUDIOS.get("king"):null;
      return `<article class="mechcard">
        <div class="row" style="justify-content:space-between;gap:8px"><span class="eyebrow" style="margin:0">${esc(ch.years||"")}</span>${stRef?`<button type="button" class="link" style="font-size:12px" data-act="studio" data-st="${esc(stRef.id)}">Studio page ▸</button>`:""}</div>
        <h3 class="h2" style="font-size:18px;margin:2px 0">${esc(ch.org)}</h3>
        <small style="font-weight:700;color:var(--accent)">${esc(ch.role||"")}</small>
        <p style="margin:4px 0 0;font-size:13.5px;color:var(--ink2);line-height:1.48">${esc(ch.note||"")}</p>
      </article>`;
    }).join("")}</div>
  </section>
  ${pinnedData?`<section class="wrap sec" id="johanTimeline">
    <div class="personacard">
      <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <p class="eyebrow" style="margin-bottom:3px">Creator's gaming timeline</p>
          <h2 class="h2" style="margin:0 0 4px">Johan's life in games (${tlSt.n} games · ${tlSt.sys} systems)</h2>
          <p class="sub" style="margin:0;max-width:68ch">Tap any cover below to inspect it, or compare your own gaming timeline side-by-side.</p>
        </div>
        <a class="btn sm primary" href="#${esc(pinnedCode)}">Open &amp; compare ▸</a>
      </div>
      ${tlPicks.length?`<div class="grid" style="margin-top:12px">${tlPicks.slice(0,8).map(x=>tileHTML(x.g,pinnedData,{act:"quickLook",sub:String(x.y)})).join("")}</div>`:""}
    </div>
  </section>`:""}
  <section class="wrap sec" id="creditsSec">
    <div class="sechead"><div><p class="eyebrow">Attribution, open archives &amp; fair-use notice</p><h2 class="h2">Sources, box-art &amp; data credits</h2><p class="sub">Played &amp; Made is an independent, non-commercial, ad-free educational tribute to video games and the teams who build them.</p></div></div>
    <div class="mechgrid">
      <article class="mechcard">
        <span class="eyebrow" style="margin:0">Cover art, screenshots &amp; logos</span>
        <h3 class="h3">Fair-use identification, archives &amp; storefronts</h3>
        <p style="margin:2px 0 0;font-size:13.2px;color:var(--ink2);line-height:1.5">Low-resolution box-art thumbnails, screenshots, and studio emblems are used under fair use for historical identification and educational commentary, sourced from <b><a href="https://www.igdb.com/" target="_blank" rel="noopener">IGDB</a></b>, <b><a href="https://www.wikipedia.org/" target="_blank" rel="noopener">Wikipedia</a> &amp; <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a></b>, <b><a href="https://store.steampowered.com/" target="_blank" rel="noopener">Steam</a></b>, <b><a href="https://thumbnails.libretro.com/" target="_blank" rel="noopener">Libretro Thumbnails</a></b>, and <b><a href="https://www.moddb.com/" target="_blank" rel="noopener">ModDB</a></b>, with direct links to <b><a href="https://www.mobygames.com/" target="_blank" rel="noopener">MobyGames</a></b> credit rolls and official <b>Steam / GOG</b> pages.</p>
      </article>
      <article class="mechcard">
        <span class="eyebrow" style="margin:0">Lineage links &amp; studio histories</span>
        <h3 class="h3">Developer interviews, postmortems &amp; encyclopedias</h3>
        <p style="margin:2px 0 0;font-size:13.2px;color:var(--ink2);line-height:1.5">Every connection in the ${L.length.toLocaleString()}-link family tree is tagged by evidence tier (<i>Developer said so</i>, <i>Cited via Wikipedia</i>, <i>Same team or code</i>, <i>Same series</i>, <i>Critics &amp; historians</i>, <i>Shared mechanics</i>, or <i>Debated</i>) and cites its source — drawing from <b>GDC Vault</b> postmortems, published developer interviews, books, <b>Wikipedia</b> (text under CC BY-SA 4.0), and <b>MobyGames</b>.</p>
      </article>
      <article class="mechcard">
        <span class="eyebrow" style="margin:0">Maps, inflation &amp; rightsholders</span>
        <h3 class="h3">Public-domain datasets &amp; creator respect</h3>
        <p style="margin:2px 0 0;font-size:13.2px;color:var(--ink2);line-height:1.5">World map vector geometry is courtesy of <b><a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a></b> (110m public domain), and 1977–2026 real-dollar price comparisons use the <b>U.S. Bureau of Labor Statistics CPI-U</b> public-domain series. All game titles, characters, box art, and trademarks remain the property of their respective studios and publishers. Rightsholders can request a credit fix, source addition, or image update anytime via <button type="button" class="link" data-act="featureSheet">Submit an update ▸</button>.</p>
      </article>
    </div>
  </section>
  ${footer()}`;
}
function renderMechanicsBody(tab){
  const mechs=MW.mechanics||[],genMeta=MW.genres||{},bgs=MW.boardgames||[];
  const selG=state.genreSel&&GEN_BY_K.has(state.genreSel)?GEN_BY_K.get(state.genreSel):GEN[1]||GEN[0];
  const selInfo=genMeta[selG.k]||{};
  const genGames=tab==="genres"?G.filter(g=>g.gen.includes(selG.i)).sort((a,b)=>b.pop-a.pop||b.inf-a.inf).slice(0,36):[];
  return `<section class="wrap exhero" style="padding-top:16px">
    <p class="eyebrow">Design vocabulary &amp; lineage</p>
    <h1 class="h1">${tab==="genres"?"How game genres fit &amp; hybridize":tab==="boardgames"?"From cardboard &amp; dice to pixels":"The mechanics that stuck"}</h1>
    <p class="lede">${tab==="genres"?"Genres aren't rigid boxes — new ones emerge whenever designers cross-pollinate two earlier traditions."
      :tab==="boardgames"?"Long before GPUs, tabletop wargames, pen-and-paper RPGs, and card games invented hit points, fog of war, tech trees, and deckbuilding."
      :"Players remember worlds, yet individual tactile mechanics — a mid-air double jump, fog of war, or corpse runs — leap across decades of design."}</p>
  </section>
  ${tab==="mechanics"?`<section class="wrap sec"><div class="mechgrid">${mechs.map(mc=>{
      const og=mc.origin&&gameRef(mc.origin);
      const exs=(mc.games||[]).map(gameRef).filter(Boolean);
      return `<article class="mechcard">
        <div class="row" style="justify-content:space-between"><span class="eyebrow" style="margin:0">Crystallized c. ${mc.year||""}</span>${og?`<button type="button" class="link" style="font-size:12px" data-act="quickLook" data-id="${og.id}">Spark: ${esc(og.title)} ▸</button>`:""}</div>
        <h2 class="h2" style="font-size:18px">${esc(mc.name)}</h2>
        <p style="margin:0;font-size:13.5px;color:var(--ink2)">${esc(mc.summary||"")}</p>
        ${mc.spread?`<p class="sub" style="margin:0;font-size:12.5px">${esc(mc.spread)}</p>`:""}
        ${exs.length?`<div class="shelfrow" style="gap:8px;padding-top:6px;margin-top:auto">${exs.map((g,k)=>`${k?`<span class="sarrow" aria-hidden="true" style="margin-top:-24px">▸</span>`:""}<button type="button" class="sbook" style="width:62px" data-act="quickLook" data-id="${g.id}">${cover(g,{showYear:false})}<span class="yr">${g.year}</span><b style="font-size:10.5px">${esc(g.title)}</b></button>`).join("")}</div>`:""}
      </article>`}).join("")}</div></section>`
  :tab==="genres"?`<section class="wrap sec">
      <div class="row" style="gap:6px;margin-bottom:16px">${GEN.map(gn=>`<button type="button" class="chip" data-act="genrePick" data-g="${esc(gn.k)}" aria-pressed="${gn.k===selG.k}"><i class="dot" style="--c:${gn.c}"></i>${esc(gn.label)}</button>`).join("")}</div>
      <div class="personacard" style="margin-bottom:20px">
        <div class="row" style="justify-content:space-between"><span class="eyebrow" style="margin:0">Genre spotlight · ${selInfo.born?"Est. "+selInfo.born:"Tradition"}</span>
          ${(selInfo.parents||[]).length?`<span class="row" style="gap:5px"><span class="sync">Born by combining:</span>${selInfo.parents.map(pk=>{const pg=GEN_BY_K.get(pk);return pg?`<button type="button" class="genpill" data-act="genrePick" data-g="${esc(pg.k)}">${esc(pg.label)}</button>`:""}).join(" + ")}</span>`:`<span class="sync">Foundational root genre</span>`}
        </div>
        <h2 class="h1" style="font-size:clamp(1.4rem,1rem + 1.8vw,2.1rem);margin:6px 0">${esc(selG.label)}</h2>
        ${selInfo.tagline?`<p style="margin:0 0 6px;font-weight:600;color:var(--accent)">${esc(selInfo.tagline)}</p>`:""}
        <p style="margin:0;max-width:72ch;color:var(--ink2)">${esc(selInfo.explain||"Explore the landmark games and lineages within this genre below.")}</p>
        ${(()=>{const kids=Object.entries(genMeta).filter(([,v])=>(v.parents||[]).includes(selG.k)).map(([k])=>GEN_BY_K.get(k)).filter(Boolean);
          return kids.length?`<div class="row" style="margin-top:10px;gap:6px"><span class="sync">Helped breed later genres:</span>${kids.map(cg=>`<button type="button" class="genpill" data-act="genrePick" data-g="${esc(cg.k)}">→ ${esc(cg.label)}</button>`).join("")}</div>`:""})()}
      </div>
      <h3 class="h2" style="margin-bottom:10px">Top &amp; foundational ${esc(selG.label)} games (${genGames.length})</h3>
      <div class="grid">${genGames.map(g=>tileHTML(g,hist,{act:"quickLook",quickTick:true})).join("")}</div>
    </section>`
  :`<section class="wrap sec">
      <div class="mechgrid">${bgs.map(b=>{const g=gameRef(b.id);if(!g)return "";const hs=(b.heirs||[]).map(gameRef).filter(Boolean);
        return `<article class="mechcard">
          <div class="row" style="justify-content:space-between"><span class="pill">${esc(b.kind||"Tabletop")} · ${g.year}</span><button type="button" class="link" style="font-size:12px" data-act="game" data-id="${g.id}">Open ${g.inf.toLocaleString()}-game tree ▸</button></div>
          <div class="today" style="grid-template-columns:68px minmax(0,1fr);gap:12px">${cover(g,{showYear:false})}<div><h3 class="h2" style="font-size:17px">${esc(g.title)}</h3><small class="muted">${esc(g.dev||"")}</small></div></div>
          <p style="margin:2px 0;font-size:13.5px;color:var(--ink2)">${esc(b.bridge||g.note||"")}</p>
          ${hs.length?`<div style="margin-top:auto"><span class="sync" style="display:block;margin-bottom:4px">Digital heirs it shaped:</span><div class="row" style="gap:5px">${hs.map(hg=>`<button type="button" class="chip" style="padding:3px 8px;font-size:11.5px" data-act="quickLook" data-id="${hg.id}">${esc(hg.title)} (${hg.year})</button>`).join("")}</div></div>`:""}
        </article>`}).join("")}</div>
    </section>`}`;
}

/* ---------- world map & country explorer (Natural Earth 110m choropleth) ---------- */
const CC_GEO={US:[39,-98],CA:[57,-106],MX:[23,-102],BR:[-12,-52],AR:[-34,-64],CL:[-33,-71],UY:[-33,-56],CO:[4,-73],
  GB:[54,-2],IE:[53,-8],FR:[46.5,2.2],DE:[51,10.2],NL:[52.3,5.3],BE:[50.8,4.4],ES:[40,-4],PT:[39.5,-8],IT:[42.5,12.5],CH:[46.8,8.2],AT:[47.5,14.5],
  SE:[62,15.5],FI:[64,26],NO:[61,8.8],DK:[56,10],IS:[65,-18],EE:[58.7,25.5],PL:[52,19.2],CZ:[49.8,15.5],SK:[48.7,19.7],HU:[47.2,19.5],HR:[45.1,15.5],RO:[45.9,25],BG:[42.7,25.5],GR:[39,22],
  UA:[49,31.5],BY:[53.7,28],RU:[60,65],TR:[39,35],CY:[35,33],IL:[31.5,34.8],ZA:[-29,25],IN:[21,78],
  CN:[35,104],HK:[22.3,114.2],TW:[23.7,121],KR:[36.5,127.8],JP:[36.2,138.2],SG:[1.3,103.8],VN:[16,108],ID:[-2,118],AU:[-25,134],NZ:[-41.5,173]};
function renderWorldBody(){
  const hasMine=entries(hist).length>=1;
  const mineOnly=state.worldMine&&hasMine;
  const srcGames=mineOnly?entries(hist).map(x=>x.g).filter(Boolean):G;
  const byCC=new Map();
  srcGames.forEach(g=>{if(!g.cc)return;if(!byCC.has(g.cc))byCC.set(g.cc,[]);byCC.get(g.cc).push(g)});
  const ranked=[...byCC.entries()].sort((a,b)=>b[1].length-a[1].length);
  const selCC=(state.worldCC&&byCC.has(state.worldCC))?state.worldCC:(ranked[0]?ranked[0][0]:"FI");
  const ccGames=(byCC.get(selCC)||[]).slice().sort((a,b)=>b.pop-a.pop||b.inf-a.inf||a.year-b.year);
  const ccStudios=[...STUDIOS.values()].filter(s=>s.cc===selCC&&s.games.length>=1).sort((a,b)=>(b.curated-a.curated)||(b.games.length-a.games.length)).slice(0,18);
  const ccPio=(CULT.pioneers||[]).filter(p=>p.cc===selCC);
  const maxCnt=Math.max(1,ranked[0]?ranked[0][1].length:1);
  const proj=([lat,lon])=>[((lon+180)/360*900).toFixed(1),((84-Math.max(-58,Math.min(84,lat)))/142*420).toFixed(1)];
  const wm=(MW&&MW.worldMap)||{cc:{},other:""};
  const gratLines=[-30,0,30,60].map(la=>{const y=((84-la)/142*420).toFixed(1);return `<line x1="0" y1="${y}" x2="900" y2="${y}" stroke="var(--line)" stroke-width="${la===0?1:.6}" stroke-dasharray="${la===0?"":"3 3"}" opacity=".55"/>`}).join("")
    +[-120,-60,0,60,120].map(lo=>{const x=((lo+180)/360*900).toFixed(1);return `<line x1="${x}" y1="0" x2="${x}" y2="420" stroke="var(--line)" stroke-width=".6" stroke-dasharray="3 3" opacity=".45"/>`}).join("");
  let inactivePaths=wm.other||"";
  const activePolys=[];
  for(const [cc,d] of Object.entries(wm.cc||{})){
    const arr=byCC.get(cc);
    if(!arr||!arr.length){inactivePaths+=d;continue}
    const isS=cc===selCC,pct=Math.round(24+Math.pow(arr.length/maxCnt,0.34)*64);
    const fill=isS?"var(--love)":`color-mix(in srgb,var(--accent) ${pct}%,var(--card))`;
    activePolys.push(`<path class="ccpoly" data-act="worldPick" data-cc="${esc(cc)}" d="${d}" fill="${fill}" stroke="var(--paper)" stroke-width="${isS?1.4:0.65}" stroke-linejoin="round"><title>${esc(countryName(cc))}: ${arr.length} ${arr.length===1?"game":"games"}</title></path>`);
  }
  const land=`${gratLines}<path d="${inactivePaths}" fill="color-mix(in srgb,var(--ink) 13%,var(--paper))" stroke="var(--paper)" stroke-width="0.55" stroke-linejoin="round"/>${activePolys.join("")}`;
  const dots=ranked.map(([cc,arr])=>{const ll=CC_GEO[cc];if(!ll)return "";const [cx,cy]=proj(ll),hasPoly=!!(wm.cc&&wm.cc[cc]),r=hasPoly?(cc===selCC?6.5:Math.max(3,Math.min(7,2.5+Math.pow(arr.length/maxCnt,0.35)*5.5))):6.5,isS=cc===selCC;
    return `<circle class="ccdot" data-act="worldPick" data-cc="${esc(cc)}" cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${isS?"var(--love)":"var(--accent)"}" fill-opacity="${isS?1:(hasPoly?.72:.9)}" stroke="var(--paper)" stroke-width="${isS?2:1.1}"><title>${esc(countryName(cc))}: ${arr.length} games</title></circle>
      ${arr.length>=25||isS?`<text x="${cx}" y="${(+cy-r-4).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)" stroke="var(--paper)" stroke-width="2.6" paint-order="stroke" pointer-events="none">${esc(cc)}</text>`:""}`}).join("");
  return `<section class="wrap exhero" style="padding-top:16px">
    <div class="row" style="justify-content:space-between;max-width:100%">
      <div><p class="eyebrow">Global craft · ${ranked.length} countries</p><h1 class="h1">World map of games</h1></div>
      ${hasMine?`<span class="seg" role="group" aria-label="Map source"><button data-act="worldMode" data-m="all" aria-pressed="${!mineOnly}">All catalog (${G.length.toLocaleString()})</button><button data-act="worldMode" data-m="mine" aria-pressed="${mineOnly}">My timeline (${entries(hist).length})</button></span>`:""}
    </div>
    <p class="lede">Great games come from bedrooms and studios around the world — from Kyoto, Guildford, and Austin to Stockholm, Helsinki, Warsaw, and Melbourne. Tap any country on the map or below.</p>
  </section>
  <section class="wrap"><div class="wmapbox">
    <svg class="wmapsvg" viewBox="0 0 900 420" role="img" aria-label="Interactive Natural Earth world map of video game origins">${land}${dots}</svg>
    <div class="pickstrip" style="margin-top:10px">${ranked.map(([cc,arr])=>`<button type="button" class="chip" data-act="worldPick" data-cc="${esc(cc)}" aria-pressed="${cc===selCC}">${flag(cc)} ${esc(countryName(cc))} <span class="mono muted">${arr.length}</span></button>`).join("")}</div>
  </div></section>
  <section class="wrap sec" id="ccDetail">
    <div class="sechead"><div><p class="eyebrow">Country spotlight</p><h2 class="h2">${flag(selCC)} ${esc(countryName(selCC))} · ${plural(ccGames.length,"game")}${mineOnly?" in your timeline":""}</h2></div></div>
    ${ccStudios.length?`<h3 class="h3" style="margin-bottom:8px">Studios from ${esc(countryName(selCC))}</h3><div class="makers" style="margin-bottom:16px">${ccStudios.map(s=>`<button type="button" class="makerbtn" data-act="studio" data-st="${esc(s.id)}">${studioLogoHTML(s)} ${esc(s.name)}<span>${s.games.length}</span></button>`).join("")}</div>`:""}
    ${ccPio.length?`<h3 class="h3" style="margin-bottom:8px">Pioneers from ${esc(countryName(selCC))}</h3><div class="piogrid" style="margin-bottom:18px">${ccPio.map(pioneerCardHTML).join("")}</div>`:""}
    <h3 class="h3" style="margin-bottom:10px">Games made in ${esc(countryName(selCC))}</h3>
    <div class="grid">${ccGames.slice(0,48).map(g=>tileHTML(g,hist,{act:"quickLook",quickTick:true})).join("")}</div>
  </section>`;
}
function pathHTML(A,B){
  const p=connectPath(A.i,B.i);
  if(p===null)return `<p class="empty" style="margin-top:12px">No chain between them yet.</p>`;
  if(!p.length)return `<p class="empty" style="margin-top:12px">Same game.</p>`;
  const node=g=>`<button class="pstep" data-act="game" data-id="${g.id}">${cover(g,{showYear:false})}<span><b>${esc(g.title)}</b><small>${g.year} · ${esc(studio(g))}</small></span></button>`;
  let h=`<p class="sub" style="margin:14px 0 4px"><b>${plural(p.length,"step")}</b> from ${esc(A.title)} to ${esc(B.title)}.</p><div class="path">${node(A)}`;
  p.forEach(s=>{const fwd=s.l.from===s.a;const t=TIERS[s.l.t];
    h+=`<div class="pedge" style="--c:var(${t.c})"><span class="dir">${fwd?"▼ inspired":"▲ was inspired by"}</span> · ${esc(fwd?s.l.added:s.l.took)}</div>${node(G[s.b])}`});
  return h+`</div>`;
}
/* ---------- daily: ROOTS #N 60-second daily ritual + This Month at Your Age + collapsible Endless Arcade ---------- */
let quiz=null,quizStreak=0,quizBest=store.get("ib2-best",0),loreRecent=[];
const QUIZ_MODES=[["lore","Lore & Deep Cuts"],["lineage","Lineage"],["year","Year"],["studio","Studio"],["country","Country"],["system","System"]];
const LORE_QUIZ=(Array.isArray(RAW.loreQuiz)&&RAW.loreQuiz.length)?RAW.loreQuiz:[
  {id:"overwatch",q:"Which cancelled 7-year Blizzard MMO did Jeff Kaplan's team salvage into Overwatch?",ans:"Project Titan",wrong:["StarCraft: Ghost","Warcraft Adventures","Project Nomad"],fact:"After Blizzard cancelled Project Titan in 2013, the team distilled its near-future Earth and time-blinking Jumper class ('Tracer') into Overwatch."}
];
const shuffle=(a,rng=Math.random)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function loadRootsStore(){
  const raw=store.get("pm-roots-v1",{done:{},streak:0,bestStreak:0,lastDay:null});
  return {done:raw&&typeof raw.done==="object"?raw.done:{},streak:+(raw&&raw.streak)||0,bestStreak:+(raw&&raw.bestStreak)||0,lastDay:raw&&raw.lastDay!=null?+raw.lastDay:null};
}
function saveRootsStore(st){store.set("pm-roots-v1",st)}
let ROOTS_CACHE={day:-1,puzzle:null},ROOTS_SESSION={day:-1,step:0,picks:[],results:[]},rootsCdTimer=0,ROOTS_POOLS=null;
function stopRootsCountdown(){if(rootsCdTimer){clearInterval(rootsCdTimer);rootsCdTimer=0}}
function getRootsPools(){
  if(ROOTS_POOLS)return ROOTS_POOLS;
  const prng=mulberry32(0x524F4F54);
  const byOrder=G.slice().sort((a,b)=>a.id.localeCompare(b.id));
  /* 1) Arrange LORE_QUIZ indices so no two entries within 30 circular steps share the same game */
  const loreGameOf=it=>byId.get(it.id)||byId.get(it.gFb)||TREE[0];
  const rawLore=shuffle(LORE_QUIZ.map((it,idx)=>({idx,gi:(loreGameOf(it)||{}).i??-1})),prng);
  const loreOrder=[],loreGis=[];
  const rem=rawLore.slice();
  const NQ=rem.length;
  for(let pos=0;pos<NQ;pos++){
    let pickAt=0;
    for(let j=0;j<rem.length;j++){
      const gi=rem[j].gi;
      let clash=false;
      for(let b=1;b<=30&&pos-b>=0;b++){if(loreGis[pos-b]===gi){clash=true;break}}
      if(!clash&&pos>=NQ-30){
        for(let f=0;f<30-(NQ-1-pos)&&f<loreGis.length;f++){if(loreGis[f]===gi){clash=true;break}}
      }
      if(!clash){pickAt=j;break}
    }
    const chosen=rem.splice(pickAt,1)[0];
    loreOrder.push(chosen.idx);loreGis.push(chosen.gi);
  }
  const loreSet=new Set(loreGis.filter(i=>i>=0));
  /* 2) Partition non-lore pop>=4 playable games with covers into 3 strictly disjoint pools: yPool, zPool, sPool */
  const p4Base=shuffle(byOrder.filter(g=>g.pop>=4&&g.year>=1978&&g.year<=NOW&&playable(g)&&!g.cancelled&&g.img&&!loreSet.has(g.i)),prng);
  const leaksYear=g=>{
    const y=g.year,t=g.title||"";
    if(t.includes(String(y))||t.includes(String(y-1))||t.includes(String(y+1)))return true;
    const y2=String(y).slice(2),y2n=String(y+1).slice(2);
    return new RegExp(`(?:^|[\\s'’(-])(?:2k)?(?:${y2}|${y2n})(?=$|[\\s)'’])`,"i").test(t);
  };
  const yPool=[],zPool=[],sPool=[];
  for(const g of p4Base){
    const canYear=!leaksYear(g);
    if(g.year<1982&&canYear){yPool.push(g);continue}
    if(canYear&&yPool.length<=zPool.length&&yPool.length<=sPool.length)yPool.push(g);
    else if(zPool.length<=sPool.length)zPool.push(g);
    else if(studio(g))sPool.push(g);
    else if(canYear)yPool.push(g);
    else zPool.push(g);
  }
  const coreSet=new Set([...yPool,...zPool,...sPool].map(g=>g.i));
  /* 3) Disjoint R3 Ancestor pool (1 link per unique child, pre-verified >=3 decoys) */
  const lSeen=new Set(),lPool=[];
  const candLinks=shuffle(L.filter(l=>(l.tier==="dev"||l.tier==="team"||l.tier==="critic")&&G[l.to].pop>=3&&G[l.from].pop>=3&&G[l.to].year-G[l.from].year>=1&&!G[l.to].cancelled&&!loreSet.has(G[l.to].i)&&!coreSet.has(G[l.to].i)),prng);
  for(const lk of candLinks){
    const child=G[lk.to],parent=G[lk.from];
    if(lSeen.has(child.i))continue;
    const near=new Set([child.i,...UP[child.i].map(x=>x.from),...DOWN[child.i].map(x=>x.to)]);
    const dc=TREE.filter(g=>!near.has(g.i)&&g.n!==parent.n&&g.year<child.year&&g.year>=child.year-25&&g.pop>=3);
    if(dc.length>=3){lSeen.add(child.i);lPool.push({lk,child,parent})}
  }
  const used4=new Set([...coreSet,...lSeen]);
  /* 4) Disjoint R4 Country pool */
  const cPool=shuffle(byOrder.filter(g=>g.pop>=3&&g.cc&&playable(g)&&!g.cancelled&&g.img&&!loreSet.has(g.i)&&!used4.has(g.i)),prng);
  const allCountries=[...new Set(byOrder.map(x=>x.cc).filter(Boolean))];
  const allStudios=[...new Set(byOrder.filter(x=>x.pop>=4&&studio(x)).map(studio))];
  ROOTS_POOLS={loreOrder,yPool,zPool,sPool,lPool,cPool,allCountries,allStudios};
  return ROOTS_POOLS;
}
function buildRootsDaily(dayNum=utcDayNum()){
  if(ROOTS_CACHE.day===dayNum&&ROOTS_CACHE.puzzle)return ROOTS_CACHE.puzzle;
  const P=getRootsPools();
  const n=rootsNumber(dayNum*864e5);
  const rng=mulberry32((dayNum*2654435761)^0x9E3779B9);
  const mod=(a,m)=>((a%m)+m)%m;
  const rounds=[];
  /* Round 1: Year — tight ±1..3 distractors (no throwaway 8-year-off options) */
  const yg=P.yPool[mod(dayNum,P.yPool.length)]||G[0];
  const ySet=new Set([yg.year]);
  for(const d of shuffle([-3,-2,-1,1,2,3],rng)){const yy=yg.year+d;if(yy>=1975&&yy<=NOW&&ySet.size<4)ySet.add(yy)}
  for(const d of [-4,4,-5,5]){const yy=yg.year+d;if(yy>=1975&&yy<=NOW&&ySet.size<4)ySet.add(yy)}
  rounds.push({kind:"year",icon:"🗓️",tag:"Year",g:yg,q:`What year did ${yg.title} launch?`,sub:`From ${studio(yg)||"its original team"} — pick the debut release year:`,ans:String(yg.year),opts:[...ySet].sort((a,b)=>a-b).map(y=>({k:String(y),label:String(y)})),fact:`${yg.title} launched in ${yg.year} (${studio(yg)||"original studio"}).`});
  /* Round 2: Zoomed Cover */
  const zg=P.zPool[mod(dayNum,P.zPool.length)]||G[0];
  const zSeenN=new Set([zg.n]);
  const zDecoys=[];
  for(const x of shuffle(G.filter(x=>x.i!==zg.i&&playable(x)&&!x.cancelled&&x.pop>=4&&Math.abs(x.year-zg.year)<=6),rng)){
    if(!zSeenN.has(x.n)){zSeenN.add(x.n);zDecoys.push(x);if(zDecoys.length===3)break}
  }
  if(zDecoys.length<3){
    for(const x of shuffle(G.filter(x=>x.i!==zg.i&&playable(x)&&!x.cancelled&&x.pop>=3),rng)){
      if(!zSeenN.has(x.n)){zSeenN.add(x.n);zDecoys.push(x);if(zDecoys.length===3)break}
    }
  }
  const zOpts=shuffle([zg,...zDecoys],rng).map(x=>({k:x.id,label:x.title}));
  const zx=28+Math.floor(rng()*44),zy=24+Math.floor(rng()*46);
  rounds.push({kind:"zoom",icon:"🔍",tag:"Zoomed Cover",g:zg,zx,zy,q:"Name the game from this zoomed box-art crop",sub:`Released in the ${Math.floor(zg.year/10)*10}s — tap to reveal the full cover:`,ans:zg.id,opts:zOpts,fact:`${zg.title} (${zg.year}) by ${studio(zg)||"its studio"}.`});
  /* Round 3: Direct Ancestor */
  const ent=P.lPool[mod(dayNum,P.lPool.length)];
  if(ent){
    const {lk,child,parent}=ent;
    const near=new Set([child.i,...UP[child.i].map(x=>x.from),...DOWN[child.i].map(x=>x.to)]);
    const fam=new Set(child.gen.concat(parent.gen));
    const cand=TREE.filter(g=>!near.has(g.i)&&g.n!==parent.n&&g.year<child.year&&g.year>=child.year-25&&g.pop>=3);
    const same=shuffle(cand.filter(g=>g.gen.some(x=>fam.has(x))),rng),other=shuffle(cand.filter(g=>!g.gen.some(x=>fam.has(x))),rng);
    const decoys=[],dSeen=new Set([parent.n]);
    for(const g of [...same.slice(0,2),...other,...same.slice(2)]){
      if(!dSeen.has(g.n)){dSeen.add(g.n);decoys.push(g);if(decoys.length===3)break}
    }
    rounds.push({kind:"ancestor",icon:"🧬",tag:"Direct Ancestor",g:child,parent,l:lk,q:`Which earlier game directly inspired ${child.title}?`,sub:`Released in ${child.year} — pick its documented inspiration:`,ans:parent.id,opts:shuffle([parent,...decoys],rng).map(x=>({k:x.id,label:x.title,g:x})),fact:`${child.title} built on ${parent.title} (${parent.year}): ${lk.added||lk.took}`});
  }
  /* Round 4: Studio (even dayNum) or Country (odd dayNum) */
  const doCountry=mod(dayNum,2)===1;
  const halfSlot=Math.floor(dayNum/2);
  if(doCountry){
    const cg=P.cPool[mod(halfSlot,P.cPool.length)]||G[0];
    const other=P.allCountries.filter(c=>c&&c!==cg.cc);
    const opts=shuffle([cg.cc,...shuffle(other,rng).slice(0,3)],rng).map(c=>({k:c,label:`${flagEmoji(c)} ${countryName(c)}`}));
    rounds.push({kind:"country",icon:"🌍",tag:"Country",g:cg,q:`Where was ${cg.title} made?`,sub:`Released in ${cg.year} — pick the country where its team built it:`,ans:cg.cc,opts,fact:`${cg.title} (${cg.year}) was crafted in ${countryName(cg.cc)} by ${studio(cg)}.`});
  }else{
    const sg=P.sPool[mod(halfSlot,P.sPool.length)]||G[0];
    const ansS=studio(sg);
    const other=P.allStudios.filter(s=>s&&s!==ansS);
    const opts=shuffle([ansS,...shuffle(other,rng).slice(0,3)],rng).map(s=>({k:s,label:s}));
    rounds.push({kind:"studio",icon:"🏛️",tag:"Studio",g:sg,q:`Which studio built ${sg.title}?`,sub:`Released in ${sg.year} — pick the studio behind it:`,ans:ansS,opts,fact:`${sg.title} (${sg.year}) was crafted by ${sg.dev}.`});
  }
  /* Round 5: Deep-Cut Lore (300-question bank, cyclic >=30-day game spacing) */
  const loreIdx=P.loreOrder[mod(dayNum,P.loreOrder.length)]||0;
  const lit=LORE_QUIZ[loreIdx]||LORE_QUIZ[0];
  const lg=byId.get(lit.id)||byId.get(lit.gFb)||TREE[0];
  const cleanAns=String(lit.ans||"").trim();
  const na=norm(cleanAns),nt=lg?lg.n:"",nd=lg?norm(studio(lg)||""):"";
  const hideCover=!!(lit.hideCover||(na.length>=4&&nt&&(nt.includes(na)||na.includes(nt)))||(na.length>=4&&nd&&(nd.includes(na)||na.includes(nd))));
  rounds.push({kind:"lore",icon:"📜",tag:"Lore",g:lg,hideCover,q:lit.q,sub:"Deep-cut gaming & industry lore — pick the true answer:",ans:cleanAns,opts:shuffle([cleanAns,...(lit.wrong||[]).map(w=>String(w||"").trim())],rng).map(s=>({k:s,label:s})),fact:lit.fact});
  const puzzle={dayNum,dateKey:utcDateKey(dayNum*864e5),n,rounds};
  ROOTS_CACHE={day:dayNum,puzzle};
  return puzzle;
}
function rootsShareText(puzzle,rec,streak){
  const score=rec.results.filter(Boolean).length;
  const grid=puzzle.rounds.map((r,i)=>`${r.icon}${rec.results[i]?"🟩":"🟥"}`).join(" ");
  return `Played & Made · ROOTS #${puzzle.n} — ${score}/${puzzle.rounds.length}${streak>=2?` 🔥${streak}`:""}\n${grid}\n${shareBase()}#daily`;
}
function utcCountdownStr(){
  const now=Date.now(),nextMid=(utcDayNum(now)+1)*864e5,rem=Math.max(0,Math.floor((nextMid-now)/1000));
  const hh=String(Math.floor(rem/3600)).padStart(2,"0"),mm=String(Math.floor((rem%3600)/60)).padStart(2,"0"),ss=String(rem%60).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}
function renderRootsCard(){
  const el=$("#rootsCard");if(!el)return;
  const puzzle=buildRootsDaily(),rs=loadRootsStore();
  if(ROOTS_SESSION.day!==puzzle.dayNum){
    ROOTS_SESSION={day:puzzle.dayNum,step:0,picks:[],results:[]};
  }
  const doneRec=rs.done[puzzle.dateKey]||null;
  const dots=puzzle.rounds.map((r,i)=>{
    const res=doneRec?doneRec.results[i]:ROOTS_SESSION.results[i];
    const cls=res===true?"ok":res===false?"no":(!doneRec&&i===ROOTS_SESSION.step?"cur":"");
    return `<span class="roots-dot ${cls}" title="Round ${i+1}: ${esc(r.tag)}" aria-label="Round ${i+1} ${esc(r.tag)}: ${res===true?"correct":res===false?"missed":"pending"}">${res===true?"✓":res===false?"×":i+1}</span>`;
  }).join("");
  if(doneRec){
    const score=doneRec.results.filter(Boolean).length;
    const shareTxt=rootsShareText(puzzle,doneRec,rs.streak);
    el.innerHTML=`<div class="roots-head">
        <div>
          <p class="eyebrow" style="margin-bottom:3px">Daily 60-second ritual · ${esc(puzzle.dateKey)} UTC</p>
          <h2 class="h2" style="margin:0">ROOTS #${puzzle.n} — ${score}/${puzzle.rounds.length}${rs.streak?` · 🔥 ${rs.streak} day streak`:""}</h2>
        </div>
        <div class="roots-dots">${dots}</div>
      </div>
      <div class="roots-summary">
        <div class="roots-emoji-box" id="rootsEmojiBox">${esc(shareTxt)}</div>
        <div class="row" style="gap:8px;justify-content:space-between">
          <div class="row" style="gap:8px">
            <button type="button" class="btn sm primary" data-act="rootsShare">Share spoiler-free grid</button>
            <button type="button" class="btn sm" data-act="rootsCopy">Copy result</button>
          </div>
          <span class="mono muted" style="font-size:12.5px">Next ROOTS #${puzzle.n+1} in <b id="rootsCd">${utcCountdownStr()}</b></span>
        </div>
        <div class="roots-recap">${puzzle.rounds.map((r,i)=>`<div class="roots-recap-it">
          <span class="mono muted" style="font-size:11px">${r.icon} ${esc(r.tag)} · ${doneRec.results[i]?"🟩 Right":"🟥 Missed"}</span>
          <b>${esc(r.g.title)} (${r.g.year})</b>
          <button type="button" class="link" style="font-size:11.5px;margin-top:2px" data-act="${r.g.tree?"game":"quickLook"}" data-id="${r.g.id}">Inspect ▸</button>
        </div>`).join("")}</div>
      </div>`;
    stopRootsCountdown();
    rootsCdTimer=setInterval(()=>{const c=$("#rootsCd");if(c)c.textContent=utcCountdownStr();else stopRootsCountdown()},1000);
    return;
  }
  stopRootsCountdown();
  const idx=ROOTS_SESSION.step,rd=puzzle.rounds[idx];
  const picked=ROOTS_SESSION.picks[idx]??null;
  const isRight=picked!=null&&picked===rd.ans;
  let stageHTML="";
  if(rd.kind==="ancestor"){
    stageHTML=`<div style="display:flex;align-items:center;gap:12px;margin:4px 0 8px"><div style="width:48px;flex:none">${cover(rd.g,{showYear:false})}</div><p class="sub" style="margin:0">${esc(rd.sub)}</p></div>
      <div class="quizopts">${rd.opts.map(o=>`<button type="button" class="qopt${picked!=null?(o.k===rd.ans?" right":o.k===picked?" wrong":""):""}" data-act="rootsPick" data-v="${esc(o.k)}" ${picked!=null?"disabled":""}>${cover(o.g)}<b>${esc(o.label)}</b><small>${o.g.year}</small></button>`).join("")}</div>`;
  }else{
    let covHTML="";
    if(rd.kind==="zoom"){
      covHTML=`<div class="roots-zoom${picked!=null?" revealed":""}" style="--zx:${rd.zx}%;--zy:${rd.zy}%"><img src="${esc(rd.g.img)}" alt="${picked!=null?esc(rd.g.title):"Zoomed mystery game box art"}" onerror="this.parentElement.classList.add('err')"><div class="roots-zoom-fb" aria-hidden="true"><b style="font-size:26px">${picked!=null?rd.g.year:"?"}</b><small style="font-size:11px;color:var(--muted)">${picked!=null?esc(rd.g.title):"Offline cover"}</small></div><span class="roots-zoom-badge">${picked!=null?rd.g.year:"2.7× CROP"}</span></div>`;
    }else if(rd.hideCover&&picked==null){
      covHTML=`<div class="cv mystery" aria-label="Mystery game cover — revealed after answering"><b>?</b><small>${rd.g.year}</small></div>`;
    }else{
      covHTML=cover(rd.g,{showYear:rd.kind!=="year"});
    }
    stageHTML=`<p class="sub" style="margin:0 0 8px">${esc(rd.sub)}</p>
      <div class="quizstage">${covHTML}
        <div class="quizans">${rd.opts.map(o=>`<button type="button" class="quizbtn${picked!=null?(o.k===rd.ans?" right":o.k===picked?" wrong":""):""}" data-act="rootsPick" data-v="${esc(o.k)}" ${picked!=null?"disabled":""}>${esc(o.label)}</button>`).join("")}</div>
      </div>`;
  }
  el.innerHTML=`<div class="roots-head">
      <div>
        <p class="eyebrow" style="margin-bottom:3px">Round ${idx+1} of ${puzzle.rounds.length} · ${esc(rd.tag)}${rs.streak?` · Streak ${rs.streak}`:""}</p>
        <h2 class="h2" style="margin:0">${esc(rd.q)}</h2>
      </div>
      <div class="roots-dots">${dots}</div>
    </div>
    ${stageHTML}
    ${picked!=null?`<div class="qres" style="--c:var(${isRight?"--t-mech":"--love"})"><p style="margin:0 0 4px;font-weight:700">${isRight?"Spot on.":"Close — "+esc(rd.opts.find(o=>o.k===rd.ans)?.label||rd.ans)}</p><p class="sub" style="margin:0">${esc(rd.fact)}</p></div>
      <div class="row" style="margin-top:12px">
        <button type="button" class="btn primary" data-act="rootsNext">${idx<puzzle.rounds.length-1?`Next round (${idx+2}/${puzzle.rounds.length}) ▸`:"Finish ROOTS #"+puzzle.n+" ▸"}</button>
        <button type="button" class="btn ghost" data-act="${rd.g.tree?"game":"quickLook"}" data-id="${rd.g.id}">Inspect ${esc(rd.g.title)}</button>
      </div>`:""}`;
}
function monthAtYourAgeHTML(){
  const nowDate=new Date();
  const monthIdx=nowDate.getUTCMonth();
  const win=formativeWindow(hist);
  const from=win.from,to=win.to;
  let headline="",subline="";
  if(win.birth){
    headline=`When you were ${win.ageFrom}\u2060\u2013\u2060${win.ageTo} (${from}\u2060\u2013\u2060${to})`;
    subline=`Four games from your formative ${from}\u2013${to} window — tap + Played to log any you remember.`;
  }else{
    headline=`${win.eraLabel} rewind (${from}\u2060\u2013\u2060${to})`;
    subline="Set your optional birth year in Settings to tune this shelf to your exact ages 7–15.";
  }
  const pool=G.filter(g=>playable(g)&&!g.cancelled&&g.year>=from&&g.year<=to&&g.pop>=4&&g.img);
  const rng=mulberry32((nowDate.getUTCFullYear()*13+monthIdx+1)*2654435761);
  const picks=shuffle(pool.slice(),rng).slice(0,4).sort((a,b)=>a.year-b.year);
  if(!picks.length)return "";
  return `<section class="month-age-card">
    <div class="sechead" style="margin-bottom:10px">
      <div>
        <p class="eyebrow" style="margin-bottom:2px">Your formative years · Monthly picks</p>
        <h2 class="h2">${esc(headline)}</h2>
        <p class="sub" style="margin:2px 0 0">${esc(subline)}</p>
      </div>
      ${!hist.birth?`<button type="button" class="btn sm ghost" data-act="settings">Set birth year</button>`:""}
    </div>
    <div class="recs">${picks.map(g=>{
      const ageTxt=hist.birth?`Age ${g.year-hist.birth} · ${g.year}`:`${g.year} · ${studio(g)||""}`;
      return tileHTML(g,hist,{act:"quickLook",sub:esc(ageTxt),quickTick:true});
    }).join("")}</div>
  </section>`;
}
function newQuiz(){
  const mode=state.quizMode||"lore";
  if(mode==="lore"){
    const avail=LORE_QUIZ.map((x,idx)=>({x,idx})).filter(o=>!loreRecent.includes(o.idx));
    const pick=(avail.length?avail:LORE_QUIZ.map((x,idx)=>({x,idx})))[Math.floor(Math.random()*(avail.length||LORE_QUIZ.length))];
    loreRecent=[...loreRecent.slice(-24),pick.idx];
    const it=pick.x,g=byId.get(it.id)||byId.get(it.gFb)||TREE[0];
    const cleanAns=String(it.ans||"").trim();
    const opts=shuffle([cleanAns,...(it.wrong||[]).map(w=>String(w||"").trim())]).map(s=>({k:s,label:s}));
    const na=norm(cleanAns),nt=g?g.n:"";
    const hideCover=!!(it.hideCover||(na.length>=4&&nt&&(nt.includes(na)||na.includes(nt))));
    return {mode:"lore",g,hideCover,qTitle:it.q,subHint:`Deep-cut gaming & industry lore (${LORE_QUIZ.length} questions) — pick the true answer:`,ans:cleanAns,opts,picked:null,fact:it.fact};
  }
  if(mode==="year"){
    const pool=G.filter(g=>g.pop>=4&&g.year>=1978&&g.year<=NOW&&playable(g));
    const g=pool[Math.floor(Math.random()*pool.length)];if(!g)return null;
    const yrs=new Set([g.year]);
    for(const d of shuffle([-6,-4,-3,-2,2,3,4,6,8])){const y=g.year+d;if(y>=1975&&y<=NOW&&yrs.size<4)yrs.add(y)}
    return {mode,g,ans:String(g.year),opts:shuffle([...yrs]).sort((a,b)=>a-b).map(y=>({k:String(y),label:String(y)})),picked:null,fact:`${g.title} launched in ${g.year} from ${studio(g)||"its team"}.`};
  }
  if(mode==="studio"){
    const pool=G.filter(g=>g.pop>=4&&studio(g)&&playable(g));
    const g=pool[Math.floor(Math.random()*pool.length)],ans=studio(g);
    const other=[...new Set(pool.map(studio).filter(s=>s&&s!==ans))];
    const opts=shuffle([ans,...shuffle(other).slice(0,3)]).map(s=>({k:s,label:s}));
    return {mode,g,ans,opts,picked:null,fact:`${g.title} (${g.year}) was crafted by ${g.dev}.`};
  }
  if(mode==="country"){
    const pool=G.filter(g=>g.pop>=3&&g.cc&&playable(g));
    const g=pool[Math.floor(Math.random()*pool.length)],ans=g.cc;
    const other=[...new Set(pool.map(x=>x.cc).filter(c=>c&&c!==ans))];
    const opts=shuffle([ans,...shuffle(other).slice(0,3)]).map(c=>({k:c,label:`${flagEmoji(c)} ${countryName(c)}`}));
    return {mode,g,ans,opts,picked:null,fact:`${g.title} (${g.year}) was made in ${countryName(ans)} by ${studio(g)}.`};
  }
  if(mode==="system"){
    const pool=G.filter(g=>g.pop>=3&&sysOfGame(g).length>=1&&sysOfGame(g).length<=3&&playable(g));
    const g=pool[Math.floor(Math.random()*pool.length)],ps=sysOfGame(g),ans=ps[0];
    const other=SYSTEMS.map(s=>s[1]).filter(s=>!ps.includes(s));
    const opts=shuffle([ans,...shuffle(other).slice(0,3)]).map(s=>({k:s,label:s}));
    return {mode,g,ans,opts,picked:null,fact:`${g.title} (${g.year}) launched on ${ps.join(", ")}.`};
  }
  const pool=L.filter(l=>(l.tier==="dev"||l.tier==="team"||l.tier==="critic")&&G[l.to].pop>=3&&G[l.from].pop>=3&&G[l.to].year-G[l.from].year>=1);
  if(!pool.length)return null;
  for(let tries=0;tries<20;tries++){
    const l=pool[Math.floor(Math.random()*pool.length)],child=G[l.to],parent=G[l.from];
    const near=new Set([child.i,...UP[child.i].map(x=>x.from),...DOWN[child.i].map(x=>x.to)]);
    const fam=new Set(child.gen.concat(parent.gen));
    const cand=TREE.filter(g=>!near.has(g.i)&&g.year<child.year&&g.year>=child.year-25&&g.pop>=3);
    const same=shuffle(cand.filter(g=>g.gen.some(x=>fam.has(x)))),other=shuffle(cand.filter(g=>!g.gen.some(x=>fam.has(x))));
    const decoys=[...same.slice(0,2),...other].slice(0,3);
    if(decoys.length===3)return {mode:"lineage",l,child,parent,opts:shuffle([parent,...decoys]),picked:null};
  }
  return null;
}
function renderQuiz(){
  const el=$("#quiz");if(!el)return;if(!quiz||quiz.mode!==(state.quizMode||"lore"))quiz=newQuiz();if(!quiz){el.innerHTML="";return}
  const curMode=state.quizMode||"lore";
  const tabs=`<div class="pickstrip" style="padding-top:0;margin-bottom:8px">${QUIZ_MODES.map(([k,lbl])=>`<button type="button" class="chip" style="padding:4px 10px;font-size:12px" data-act="quizMode" data-m="${k}" aria-pressed="${curMode===k}">${lbl}</button>`).join("")}</div>`;
  const streakShare=quizBest>=2?`<button type="button" class="chip" style="padding:3px 9px;font-size:11.5px" data-act="shareStreak">Share streak (${quizStreak||quizBest})</button>`:"";
  if(quiz.mode!=="lineage"){
    const {g,ans,opts,picked,fact,mode,hideCover}=quiz;
    const qTitle=quiz.qTitle||(mode==="year"?`What year did ${g.title} launch?`:mode==="studio"?`Which studio built ${g.title}?`:mode==="country"?`Where was ${g.title} made?`:`Which system did ${g.title} launch on?`);
    const subHint=quiz.subHint||(mode==="year"?`From ${studio(g)||"its original team"} — pick its debut release year:`
      :mode==="studio"?`Released in ${g.year} — pick the studio behind it:`
      :mode==="country"?`Released in ${g.year} — pick the country where its team built it:`
      :`Released in ${g.year} — pick one of its original platforms:`);
    const covHTML=(hideCover&&picked==null)
      ?`<div class="cv mystery" aria-label="Mystery game cover — revealed after answering"><b>?</b><small>${g.year}</small></div>`
      :cover(g,{showYear:mode!=="year"});
    el.innerHTML=`<div class="sechead" style="margin:0"><div><p class="eyebrow">${mode==="lore"?"Industry &amp; folklore challenge":"Arcade trivia"}</p><h2 class="h2">${esc(qTitle)}</h2></div><span class="row" style="gap:6px"><span class="streak">${quizStreak?`${quizStreak} in a row`:""}${quizBest?` · best ${quizBest}`:""}</span>${streakShare}</span></div>
      ${tabs}
      <p class="sub" style="margin:0">${esc(subHint)}</p>
      <div class="quizstage">${covHTML}
        <div class="quizans">${opts.map(o=>`<button type="button" class="quizbtn${picked!=null?(o.k===ans?" right":o.k===picked?" wrong":""):""}" data-act="quizPickVal" data-v="${esc(o.k)}" ${picked!=null?"disabled":""}>${esc(o.label)}</button>`).join("")}</div>
      </div>
      ${picked!=null?`<div class="qres" style="--c:var(${picked===ans?"--t-mech":"--love"})"><p style="margin:0 0 4px;font-weight:700">${picked===ans?"Spot on.":"Close — "+esc(opts.find(o=>o.k===ans)?.label||ans)}</p><p class="sub" style="margin:0">${esc(fact)}</p></div>
        <div class="row" style="margin-top:12px"><button class="btn primary" data-act="quizNext">Next question ▸</button><button class="btn wrap" data-act="${g.tree?"game":"quickLook"}" data-id="${g.id}">Inspect ${esc(g.title)}</button>${mode==="lore"?`<a class="btn ghost" href="#vault">Open The Vault ▸</a>`:""}</div>`:""}`;
    return;
  }
  const {child,parent,opts,picked,l}=quiz,t=TIERS[l.t];
  el.innerHTML=`<div class="sechead" style="margin:0"><div><p class="eyebrow">Arcade trivia</p><h2 class="h2">Which game inspired ${esc(child.title)}?</h2></div><span class="row" style="gap:6px"><span class="streak">${quizStreak?`${quizStreak} in a row`:""}${quizBest?` · best ${quizBest}`:""}</span>${streakShare}</span></div>
    ${tabs}
    <div style="display:flex;align-items:center;gap:12px;margin:2px 0 4px"><div style="width:46px;flex:none">${cover(child,{showYear:false})}</div><p class="sub" style="margin:0"><b>${esc(child.title)}</b> came out in ${child.year}. Which of these earlier games directly shaped it?</p></div>
    <div class="quizopts">${opts.map(g=>`<button class="qopt${picked!=null?(g===parent?" right":g.i===picked?" wrong":""):""}" data-act="quizPick" data-i="${g.i}" ${picked!=null?"disabled":""}>${cover(g)}<b>${esc(g.title)}</b><small>${g.year}</small></button>`).join("")}</div>
    ${picked!=null?`<div class="qres" style="--c:var(${t.c})"><p style="margin:0 0 4px;font-weight:700">${picked===parent.i?"Right.":"Not quite. It was "+esc(parent.title)+"."}</p><dl class="ta" style="margin:4px 0"><dt>Took</dt><dd>${esc(l.took)}</dd><dt>Added</dt><dd class="add">${esc(l.added)}</dd></dl><span class="tier">${esc(tierLabelForLink(l))}</span></div>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="quizNext">Next question ▸</button><button class="btn wrap" data-act="game" data-id="${child.id}">Open ${esc(child.title)}</button></div>`:""}`;
}
function renderDaily(m){
  const tg=todayGame(),dc=directCrossLinks(tg).length,puz=buildRootsDaily();
  m.innerHTML=`<section class="wrap" style="padding-block:18px 6px;max-width:980px">
    <div class="row" style="justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:14px">
      <div>
        <h1 class="h1" style="margin:0;font-size:clamp(1.45rem,1.05rem + 2vw,2.2rem)">ROOTS #${puz.n} · 60\u2011Second Daily</h1>
      </div>
      <button type="button" class="btn sm primary" data-act="luckyWheel">Feeling lucky — spin wheel</button>
    </div>
    <div class="roots-card" id="rootsCard"></div>
    ${monthAtYourAgeHTML()}
    <details class="arcade-acc" id="endlessArcade">
      <summary>Endless Arcade — 6-Mode Trivia, Rabbit Hole &amp; Lucky Wheel <span class="acc-meta">${LORE_QUIZ.length} lore Qs · 12-wedge wheel</span></summary>
      <div class="arcade-acc-body">
        <div class="card" id="quiz" style="margin-top:12px;border:0;padding:4px 0;background:transparent"></div>
        <div class="hgrid" style="margin-top:16px">
          <div class="card">
            <p class="eyebrow">Today's rabbit hole</p>
            <div class="today">${cover(tg)}<div>
              <h2 class="h2">${esc(tg.title)}</h2>
              <p class="sub" style="margin:2px 0 8px">${tg.year} · ${flag(tg.cc)} ${studioBtn(studio(tg))}</p>
              <p style="margin:0 0 12px;font-size:13.8px;color:var(--ink2)">Built on <b>${UP[tg.i].length}</b> earlier ${UP[tg.i].length===1?"game":"games"} · inspired <b>${dc}</b> directly · <b>${tg.inf.toLocaleString()}</b> across genres.</p>
              <div class="row" style="gap:6px"><button class="btn sm primary" data-act="game" data-id="${tg.id}">Family tree</button><button class="btn sm" data-act="walk" data-id="${tg.id}">Walk roots ▸</button></div>
            </div></div>
          </div>
          <div class="card" style="display:flex;flex-direction:column;justify-content:space-between;gap:12px">
            <div>
              <p class="eyebrow">12-wedge prize wheel</p>
              <h2 class="h2">Spin the Lucky Wheel</h2>
              <p class="sub" style="margin:4px 0 0">Pull the spring lever to spin 12 landmark games from all eras or your own childhood — watch gameplay, add it to your timeline, or trace its family tree.</p>
            </div>
            <div class="row" style="gap:8px">
              <button type="button" class="btn sm primary" data-act="luckyWheel">Feeling lucky — spin wheel</button>
              <a class="btn sm ghost" href="#vault">Explore The Vault ▸</a>
            </div>
          </div>
        </div>
      </div>
    </details>
  </section>${footer()}`;
  renderRootsCard();
  renderQuiz();
}
/* ---------- the big picture: 5 clean views of game history ---------- */
const LANES=[["Roots",["roots"]],["Arcade",["arcade","shmup"]],["Platform",["platformer","metroidvania"]],["Adventure & open world",["action-adventure","open-world"]],["Shooters",["fps","shooter","battle-royale"]],["Stealth & horror",["immersive-sim","horror"]],["Role-playing",["rpg","jrpg","arpg","mmo"]],["Roguelike",["roguelike"]],["Strategy",["strategy","moba"]],["Sim & survival",["sim","survival"]],["Story & puzzle",["adventure","puzzle"]],["Fighting",["fighting","beat-em-up"]],["Racing & sports",["racing","sports"]],["Party & cards",["party","card"]],["Space",["space"]]];
const REG_LANES=[["North America",c=>c==="US"||c==="CA"||c==="MX"],["Japan",c=>c==="JP"],["UK & Ireland",c=>c==="GB"||c==="IE"],["Nordics (SE·FI·DK·NO)",c=>["SE","FI","DK","NO","IS"].includes(c)],["W. & C. Europe",c=>["FR","DE","NL","BE","ES","PT","IT","CH","AT"].includes(c)],["E. Europe",c=>["PL","CZ","SK","HU","UA","RU","BY","EE","HR","RO","BG"].includes(c)],["Asia-Pacific & Global",()=>true]];
const laneOfGenre={};LANES.forEach(([,gs],i)=>gs.forEach(k=>laneOfGenre[k]=i));
const LANE_C=LANES.map((_,i)=>`hsl(${Math.round(i*360/LANES.length+200)%360} 62% 58%)`);
const yearX=y=>y<1950?Math.max(0,(y-1800)/150)*0.06:y<1975?0.06+(y-1950)/25*0.10:0.16+(y-1975)/(NOW+1-1975)*0.84;
let MAPN=null;
function regLaneOf(cc){const idx=REG_LANES.findIndex(([,fn])=>fn(cc||""));return idx>=0?idx:6}
function mapNodes(){
  if(MAPN)return MAPN;
  MAPN=TREE.map(g=>{const gen=genreOf(g),lane=gen?laneOfGenre[gen.k]??1:1,rlane=regLaneOf(g.cc);const j1=(hueOf(g.id+"x")%1000)/1000,j2=(hueOf(g.id+"y")%1000)/1000;
    const skyV=0.92-Math.min(0.85,Math.log10(g.inf+1)/Math.log10(1100)*0.85)+(j2-.5)*0.015;
    return {g,lane,rlane,u:Math.min(.995,Math.max(.002,yearX(g.year)+(j1-.5)*0.006)),v:(lane+0.12+j2*0.76)/LANES.length,wv:(rlane+0.15+j2*0.70)/REG_LANES.length,sv:Math.max(.04,Math.min(.95,skyV)),r:2.2+Math.min(10,Math.sqrt(g.inf)*0.55)}});
  return MAPN;
}
function drawMapThumb(c){
  const x=c.getContext("2d"),W=c.width,H=c.height,ns=mapNodes().filter(n=>n.g.pop>=4||n.g.inf>=35),pos=new Map(ns.map(n=>[n.g.i,n]));
  x.clearRect(0,0,W,H);x.globalAlpha=.18;x.lineWidth=1;
  L.forEach(l=>{if(l.tier!=="dev"&&l.tier!=="team")return;const a=pos.get(l.from),b=pos.get(l.to);if(!a||!b)return;x.strokeStyle=LANE_C[a.lane];x.beginPath();x.moveTo(a.u*W,a.v*H);x.quadraticCurveTo((a.u+b.u)/2*W,Math.min(a.v,b.v)*H-10,b.u*W,b.v*H);x.stroke()});
  x.globalAlpha=.95;ns.forEach(n=>{x.fillStyle=LANE_C[n.lane];x.beginPath();x.arc(n.u*W,n.v*H,Math.max(1.8,n.r*.52),0,7);x.fill()});x.globalAlpha=1;
}
let MAP=null;
const MAP_VIEWS=[["pillars","Landmarks"],["skyline","Influence skyline"],["rivers","Genre rivers"],["world","Geography"],["mine","My constellation"],["all","All "+TREE.length.toLocaleString()]];
function openMap(){
  const md=state.mapMode||"pillars";
  $("#layer").innerHTML=`<div class="ov" role="dialog" aria-label="Map of game history"><div class="wrap ovhead" style="flex-wrap:wrap;gap:6px">
      <div class="row" style="justify-content:space-between;width:100%"><div class="row" style="gap:10px;min-width:0"><button type="button" class="navback" data-act="closeLayer">◂ Back</button><div style="min-width:0"><h2>The big picture</h2><p class="sync" style="margin:1px 0 0" id="mapSub">Drag or pinch to explore · tap any game to trace its family.</p></div></div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
      <div class="pickstrip" style="width:100%;max-width:100%;padding-block:2px 4px">
        ${MAP_VIEWS.map(([k,lbl])=>`<button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="mapView" data-m="${k}" aria-pressed="${md===k}">${lbl}</button>`).join("")}
        <button type="button" class="chip" style="padding:4px 9px;font-size:12px" data-act="mapStrongTog" aria-pressed="${!!state.mapStrong}">Links: ${state.mapStrong?"Primary":"All"}</button>
      </div>
    </div>
    <div class="mapwrap" id="mapwrap"><canvas id="mapc"></canvas><div class="maptip" id="maptip" hidden></div>
      <div class="mapctl"><button class="btn" data-act="mapZoom" data-z="1.4" aria-label="Zoom in">+</button><button class="btn" data-act="mapZoom" data-z="0.7" aria-label="Zoom out">−</button><button class="btn" data-act="mapReset" aria-label="Reset view" style="font-size:13px">⤢</button></div>
      <div id="mapcard"></div></div></div>`;
  const wrap=$("#mapwrap"),c=$("#mapc");
  MAP={k:1,tx:0,ty:0,sel:null,hover:null,W:0,H:0,c,wrap,LW:window.innerWidth<600?74:132};
  const resize=()=>{const r=wrap.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);MAP.W=r.width;MAP.H=r.height;MAP.LW=r.width<600?74:132;c.width=r.width*dpr;c.height=r.height*dpr;MAP.dpr=dpr;drawMap()};
  MAP.resize=resize;resize();addEventListener("resize",resize);
  let drag=null,moved=false,pinchDist=0;const ptrs=new Map();
  c.addEventListener("pointerdown",e=>{ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});try{c.setPointerCapture(e.pointerId)}catch(_){}
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinchDist=Math.hypot(a.x-b.x,a.y-b.y);moved=true;drag=null}
    else if(ptrs.size===1){drag={x:e.clientX,y:e.clientY,tx:MAP.tx,ty:MAP.ty};moved=false;wrap.classList.add("drag")}});
  c.addEventListener("pointermove",e=>{
    if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===2){const [a,b]=[...ptrs.values()],nd=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDist>8&&nd>8){const r=c.getBoundingClientRect();mapZoomAt(nd/pinchDist,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);pinchDist=nd}return}
    if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;MAP.tx=drag.tx+dx;MAP.ty=drag.ty+dy;drawMap();return}
    const n=mapHit(e);if(n!==MAP.hover){MAP.hover=n;drawMap()}const tip=$("#maptip");if(n){const r=wrap.getBoundingClientRect();tip.hidden=false;tip.innerHTML=`<b>${esc(n.g.title)}</b>${n.g.year} · ${esc(studio(n.g))} · ${n.g.inf} descendants`;tip.style.left=Math.min(r.width-240,e.clientX-r.left+12)+"px";tip.style.top=(e.clientY-r.top+12)+"px"}else tip.hidden=true});
  const endPtr=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinchDist=0;if(!ptrs.size){wrap.classList.remove("drag");if(drag&&!moved&&e.type==="pointerup"){const n=mapHit(e);MAP.sel=n?n.g.i:null;drawMap();mapCard()}drag=null}};
  c.addEventListener("pointerup",endPtr);
  c.addEventListener("pointercancel",endPtr);
  c.addEventListener("pointerleave",()=>{$("#maptip").hidden=true;MAP.hover=null});
  c.addEventListener("wheel",e=>{e.preventDefault();const r=c.getBoundingClientRect();mapZoomAt(e.deltaY<0?1.18:1/1.18,e.clientX-r.left,e.clientY-r.top)},{passive:false});
}
const mapX0=()=>MAP.LW+18,mapWW=()=>MAP.W-MAP.LW-36;
function nodeV(n,md){return md==="skyline"?n.sv:md==="world"?n.wv:n.v}
function nodeVisible(n,md,mySet,myAnc,sel,up,down){
  if(sel!=null&&(n.g.i===sel||up.has(n.g.i)||down.has(n.g.i)))return true;
  if(md==="pillars")return n.g.pop>=4||n.g.inf>=35;
  if(md==="rivers")return n.g.pop>=4||n.g.inf>=45;
  if(md==="mine")return mySet.size?(mySet.has(n.g.i)||myAnc.has(n.g.i)):(n.g.pop>=4||n.g.inf>=35);
  return true;
}
function mapXY(n){const H=MAP.H-34,v=nodeV(n,state.mapMode||"pillars");return {x:mapX0()+(n.u*mapWW())*MAP.k+MAP.tx,y:30+(v*H)*MAP.k+MAP.ty}}
function mapHit(e){const r=MAP.c.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,md=state.mapMode||"pillars";
  const mySet=new Set(entries(hist).filter(x=>x.g).map(x=>x.g.i)),myAnc=new Set();if(md==="mine")mySet.forEach(i=>ancestors(i).forEach(a=>myAnc.add(a)));
  const sel=MAP.sel,up=new Set(),down=new Set();if(sel!=null){ancestors(sel).forEach(i=>up.add(i));const st=[sel],sn=new Set([sel]);while(st.length){const v=st.pop();for(const l of DOWN[v])if(!sn.has(l.to)){sn.add(l.to);down.add(l.to);st.push(l.to)}}}
  let best=null,bd=1e9;
  for(const n of mapNodes()){if(!nodeVisible(n,md,mySet,myAnc,sel,up,down))continue;const p=mapXY(n),d=(p.x-px)**2+(p.y-py)**2,rr=Math.max(8,n.r*Math.sqrt(MAP.k)+4);if(d<rr*rr&&d<bd){bd=d;best=n}}return best}
function mapZoomAt(f,px,py){const k2=Math.max(.6,Math.min(14,MAP.k*f));f=k2/MAP.k;const x0=mapX0();MAP.tx=px-(px-MAP.tx-x0)*f-x0;MAP.ty=py-(py-MAP.ty-30)*f-30;MAP.k=k2;drawMap()}
function drawMap(){
  if(!MAP)return;const {c,W,H,dpr,k}=MAP,x=c.getContext("2d"),md=state.mapMode||"pillars";x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  const ns=mapNodes(),ink=cssVar("--ink"),muted=cssVar("--muted"),line=cssVar("--line"),love=cssVar("--love");
  const mySet=new Set(entries(hist).filter(x=>x.g).map(x=>x.g.i)),myAnc=new Set();if(md==="mine")mySet.forEach(i=>ancestors(i).forEach(a=>myAnc.add(a)));
  const sel=MAP.sel,up=new Set(),down=new Set();
  if(sel!=null){ancestors(sel).forEach(i=>up.add(i));const st=[sel],seen=new Set([sel]);while(st.length){const v=st.pop();for(const l of DOWN[v])if(!seen.has(l.to)){seen.add(l.to);down.add(l.to);st.push(l.to)}}}
  const vis=ns.filter(n=>nodeVisible(n,md,mySet,myAnc,sel,up,down)),pos=new Map(vis.map(n=>[n.g.i,n]));
  const rows=md==="world"?REG_LANES:LANES,lh=(H-34)/rows.length*k;
  if(md!=="skyline"){rows.forEach(([,],i)=>{const y=30+i*lh+MAP.ty;if(i%2===0){x.fillStyle=line;x.globalAlpha=.22;x.fillRect(0,y,W,lh);x.globalAlpha=1}})}
  else{[1000,250,50,10,1].forEach(val=>{const sv=0.92-Math.min(0.85,Math.log10(val+1)/Math.log10(1100)*0.85),py=30+sv*(H-34)*k+MAP.ty;if(py<28||py>H)return;x.strokeStyle=line;x.globalAlpha=.55;x.beginPath();x.moveTo(MAP.LW,py);x.lineTo(W,py);x.stroke();x.globalAlpha=1})}
  /* genre river bands */
  if(md==="rivers"){
    for(let li=0;li<LANES.length;li++){
      const cyBase=30+(li+0.5)*lh+MAP.ty;x.fillStyle=LANE_C[li];x.globalAlpha=.20;x.beginPath();
      const pts=[];for(let yr=1970;yr<=NOW;yr+=4){const cnt=G.filter(g=>g.year>=yr-2&&g.year<=yr+2&&g.gen.length&&(laneOfGenre[GEN[g.gen[0]].k]===li)).length;
        pts.push([mapX0()+yearX(yr)*mapWW()*k+MAP.tx,Math.min(lh*0.46,2+cnt*0.55*k)])}
      pts.forEach(([px,hw],idx)=>idx?x.lineTo(px,cyBase-hw):x.moveTo(px,cyBase-hw));
      for(let idx=pts.length-1;idx>=0;idx--)x.lineTo(pts[idx][0],cyBase+pts[idx][1]);
      x.closePath();x.fill();x.globalAlpha=1;
    }
  }
  for(let yr=1950;yr<=NOW;yr+=5){if(yr<1975&&((k<2&&yr!==1950&&yr!==1970)||(yr%10&&k<4)))continue;const px=mapX0()+yearX(yr)*mapWW()*k+MAP.tx;if(px<MAP.LW+12||px>W-12)continue;x.strokeStyle=line;x.globalAlpha=.55;x.beginPath();x.moveTo(px,26);x.lineTo(px,H);x.stroke();x.globalAlpha=1;x.fillStyle=muted;x.font="500 11px IBM Plex Mono, monospace";x.textAlign="center";x.fillText(String(yr),px,18)}
  {const px=mapX0()+yearX(1870)*mapWW()*k+MAP.tx;if(px>MAP.LW+12&&px<W-12){x.fillStyle=muted;x.font="500 11px IBM Plex Mono, monospace";x.textAlign="center";x.fillText("1800s",px,18)}}
  x.textAlign="left";x.lineWidth=1;
  for(const l of L){
    const isSelEdge=sel!=null&&((up.has(l.from)&&(up.has(l.to)||l.to===sel))||((l.from===sel||down.has(l.from))&&down.has(l.to)));
    if(!isSelEdge&&state.mapStrong&&l.tier!=="dev"&&l.tier!=="team")continue;
    const a=pos.get(l.from),b=pos.get(l.to);if(!a||!b)continue;
    let on=sel==null?(md==="pillars"||md==="mine"?.22:.09):(isSelEdge?.88:.02);
    const A=mapXY(a),B=mapXY(b);if((A.x<0&&B.x<0)||(A.x>W&&B.x>W))continue;
    x.globalAlpha=on;x.strokeStyle=sel==null?(md==="mine"&&mySet.has(b.g.i)?love:LANE_C[a.lane]):(up.has(l.from)&&(up.has(l.to)||l.to===sel)?cssVar("--t-dev"):cssVar("--t-mech"));
    x.lineWidth=(sel!=null&&on>.5)||(md==="mine"&&mySet.has(b.g.i))?1.7:1;
    x.beginPath();x.moveTo(A.x,A.y);x.quadraticCurveTo((A.x+B.x)/2,Math.min(A.y,B.y)-Math.abs(B.x-A.x)*.10,B.x,B.y);x.stroke()}
  x.globalAlpha=1;
  const labels=[];
  for(const n of vis){const p=mapXY(n);if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20)continue;const isMine=mySet.has(n.g.i);
    const r=(isMine&&md==="mine"?n.r*1.25:n.r)*Math.sqrt(k);
    const hl=sel==null||n.g.i===sel||up.has(n.g.i)||down.has(n.g.i);
    x.globalAlpha=hl?.95:.16;x.fillStyle=n.g.i===sel||(md==="mine"&&isMine)?love:LANE_C[n.lane];x.beginPath();x.arc(p.x,p.y,r,0,7);x.fill();
    if(n===MAP.hover||(md==="mine"&&isMine)){x.strokeStyle=n===MAP.hover?ink:"#fff";x.lineWidth=1.8;x.stroke()}
    if(hl&&(md==="pillars"||md==="rivers"||(md==="mine"&&isMine)||n.g.inf*k>28||n.g.pop>=5||n.g.i===sel))labels.push({n,p,r,prio:(isMine?500:0)+n.g.inf})}
  x.globalAlpha=1;x.font="600 11.5px IBM Plex Sans, sans-serif";x.fillStyle=ink;const placed=[];
  labels.sort((a,b)=>b.prio-a.prio).forEach(({n,p,r})=>{const t=n.g.title.length>26?n.g.title.slice(0,25)+"…":n.g.title,w=x.measureText(t).width,bx=p.x+r+3,by=p.y-7;
    if(placed.some(q=>bx<q.x+q.w&&bx+w>q.x&&by<q.y+14&&by+14>q.y))return;placed.push({x:bx,y:by,w});x.fillText(t,bx,p.y+4)});
  x.fillStyle=cssVar("--paper");x.fillRect(0,0,MAP.LW-6,H);x.font=W<600?"600 10px IBM Plex Sans, sans-serif":"600 11px IBM Plex Sans, sans-serif";
  if(md==="skyline"){
    [[1000,W<600?"1k+":"1,000+ heirs"],[250,W<600?"250+":"250+ heirs"],[50,W<600?"50+":"50+ heirs"],[10,W<600?"10+":"10+ heirs"],[1,W<600?"1+":"1+ heirs"]].forEach(([val,lbl])=>{const sv=0.92-Math.min(0.85,Math.log10(val+1)/Math.log10(1100)*0.85),py=30+sv*(H-34)*k+MAP.ty;if(py<34||py>H)return;x.fillStyle=muted;x.fillText(lbl,W<600?6:10,py+4)});
  }else{
    rows.forEach(([name],i)=>{const y=30+i*lh+lh/2+MAP.ty;if(y<34||y>H)return;x.fillStyle=LANE_C[i%LANE_C.length];x.beginPath();x.arc(W<600?7:10,y,W<600?3.2:4,0,7);x.fill();x.fillStyle=muted;const lbl=W<600&&name.length>11?name.slice(0,10)+"…":name;x.fillText(lbl,W<600?14:20,y+4)});
  }
  const sub=$("#mapSub");if(sub)sub.textContent=md==="pillars"?`Showing ${vis.length} landmark games (clean view) — zoom or tap any game to light up its family.`:md==="skyline"?"Height = total descendant games across history (log scale).":md==="rivers"?"Stream thickness = volume of games per genre in each 5-year era.":md==="world"?"Grouped by geographic region from 1950 to today.":md==="mine"?(mySet.size?`Your ${mySet.size} timeline games (coral) & their ${myAnc.size} ancestors.`:"Start your timeline to light up your personal constellation."):`Showing all ${vis.length.toLocaleString()} games.`;
}
function mapCard(){const el=$("#mapcard");if(!el)return;if(MAP.sel==null){el.innerHTML="";return}const g=G[MAP.sel];
  el.innerHTML=`<div class="mapcard">${cover(g,{showYear:false})}<div style="min-width:0"><b>${esc(g.title)}</b><p>${g.year} · ${flag(g.cc)} ${studioBtn(studio(g))} · built on ${UP[g.i].length}, inspired ${DOWN[g.i].length}</p><div class="row"><button class="btn sm primary" data-act="game" data-id="${g.id}" data-close="1">Family tree</button><button class="btn sm" data-act="quickLook" data-id="${g.id}">Game info</button><button class="btn sm" data-act="walk" data-id="${g.id}" data-close="1">Walk roots</button></div></div></div>`}

/* ---------- game page ---------- */
function linkCard(l,dir,focus){
  const o=G[dir==="up"?l.from:l.to],t=TIERS[l.t];
  const srcs=srcHTML(l.src,l.tier);
  const rm=l.rel&&REL_META[l.rel];
  const isCloneLike=l.rel==="variant"||l.rel==="fast-follow"||l.tier==="disp";
  const addVerb=isCloneLike?(dir==="up"?esc(focus.title)+" changed":"Changed"):(dir==="up"?esc(focus.title)+" added":"It added");
  const pairTitle=`${G[l.from].title} → ${G[l.to].title}`;
  return `<article class="lk" style="--c:var(${t.c})">${cover(o,{tag:"button",attrs:`data-act="game" data-id="${o.id}" aria-label="Open ${esc(o.title)}"`,showYear:false})}
    <div style="min-width:0"><div class="hd"><button class="nm" data-act="game" data-id="${o.id}">${esc(o.title)}</button><span class="yr">${o.year} · ${flag(o.cc)} ${studioBtn(studio(o))}</span>${statusBadgeHTML(o)}</div>
      <div><span class="tier">${esc(tierLabelForLink(l))}</span>${rm?`<span class="relbadge ${rm.cls}">${esc(rm.label)}</span>`:""}${l.disputed&&l.tier!=="disp"?`<span class="relbadge disp">Debated</span>`:""}</div>
      <dl class="ta"><dt>${addVerb}</dt><dd class="add">${esc(l.added||"Not specified in the source.")}</dd><dt>Built on</dt><dd>${esc(l.took||"Not specified.")}</dd></dl>
      ${l.extra?`<p class="xtra">${esc(l.extra)}</p>`:""}
      <div class="src">${srcs?"Source: "+srcs:"Source: not recorded yet"} · <button type="button" class="link" style="font-size:12px" data-act="suggest" data-subj="${esc("Link feedback: "+pairTitle)}">Have a better source or disagree?</button></div></div></article>`;
}
function panelHTML(dir,ls,g){
  const shown=ls.filter(tierOn).sort((a,b)=>TIERS[b.t].w-TIERS[a.t].w||(G[dir==="up"?b.from:b.to].pop-G[dir==="up"?a.from:a.to].pop)),hid=ls.length-shown.length;
  const cap=state.treeMore[dir]?999:8;
  return `<section class="panel ${dir}" id="panel-${dir}"><h2 tabindex="-1" style="outline:none">${dir==="up"?"▲ Inspired by":"▼ Went on to inspire"} <span class="mono" style="font-size:13px;font-weight:500">${shown.length}</span></h2>
    <p>${dir==="up"?`Earlier games ${esc(g.title)} built on`:`Later games that borrowed from ${esc(g.title)}`}</p>
    ${ls.length?"":`<p class="empty">Nothing recorded yet.</p>`}
    ${shown.slice(0,cap).map(l=>linkCard(l,dir,g)).join("")}
    ${shown.length>cap?`<button class="more" data-act="moreLinks" data-dir="${dir}"><b>${shown.length-cap} more</b>. Show all</button>`:""}
    ${hid?`<button class="more" data-act="allTiers"><b>${hid} hidden</b> with evidence types you've turned off. Show them</button>`:""}</section>`;
}
function renderGame(m,id){
  const g=byId.get(id);if(!g){go("tree");return}
  if(state.trail[state.trail.length-1]!==id){const k=state.trail.indexOf(id);if(k>=0)state.trail=state.trail.slice(0,k+1);else state.trail.push(id);state.trail=state.trail.slice(-8)}
  const chain=compressChain(rootsChain(g.i)),ch=chain.slice().reverse(),lv=levelOf(hist,g),ent=entryOf(hist,g),wk=!!(ent&&ent.wk);
  const nSteps=rootsChain(g.i).length-1;
  const ups=UP[g.i],downs=DOWN[g.i],directCross=directCrossLinks(g),directSer=directSeriesLinks(g);
  const age=hist.birth?g.year-hist.birth:null;
  m.innerHTML=`<div class="wrap">
    <nav class="trail" aria-label="Breadcrumb"><button type="button" class="navback" data-act="navBack" data-fb="tree">◂ Back</button>${state.trail.length>1?state.trail.map((t,k)=>k===state.trail.length-1?`<span class="cur">${esc(byId.get(t).title)}</span>`:`<button data-act="game" data-id="${t}">${esc(byId.get(t).title)}</button><span aria-hidden="true">›</span>`).join(""):`<span class="cur">${esc(g.title)}</span>`}</nav>
    <header class="gphead">${cover(g)}
      <div style="min-width:0"><div class="row" style="gap:5px;margin-bottom:6px">${g.gen.length?g.gen.map(i=>`<button type="button" class="genpill" data-act="genre" data-g="${esc(GEN[i].k)}"><i style="width:8px;height:8px;border-radius:3px;background:${GEN[i].c};display:inline-block"></i>${esc(GEN[i].label)}</button>`).join(""):`<span class="eyebrow" style="margin:0">Game</span>`}${statusBadgeHTML(g)}</div>
        <h1>${esc(g.title)}</h1>
        <div class="meta"><span class="mono">${g.year}${g.cancelled?" (cancelled)":""}</span><span style="display:inline-flex;align-items:center;gap:7px">${studioLogoHTML(findStudio(studio(g)))}<span>${flag(g.cc)} ${studioLinks(g.dev||"")}</span></span>${g.cc?`<button type="button" class="stbtn" data-act="country" data-cc="${esc(g.cc)}">${esc(countryName(g.cc))} ▸</button>`:""}</div>
        ${g.plats.length?`<p class="sub" style="margin:6px 0 0">${g.cancelled?"Target platforms: ":""}${esc(sysOfGame(g).join(" · "))}</p>`:""}
        ${g.note?`<p class="gnote">${esc(g.note)}</p>`:""}
        <div class="gstats">${g.tree?`<button type="button" class="gstatbtn" data-act="jumpPanel" data-id="${g.id}" data-dir="up" ${ups.length?"":"disabled"}>▲ Built on <b>${ups.length}</b> earlier ${ups.length===1?"game":"games"}</button><button type="button" class="gstatbtn" data-act="jumpPanel" data-id="${g.id}" data-dir="down" ${downs.length?"":"disabled"}>▼ Inspired <b>${directCross.length}</b> ${directCross.length===1?"game":"games"} directly${directSer.length?` (+ ${directSer.length} in series)`:""}</button><button type="button" class="gstatbtn" data-act="reachSheet" data-id="${g.id}" data-dir="down" ${g.inf?"":"disabled"}><b>${g.inf.toLocaleString()}</b> across genres${g.inf?" ▸":""}</button>`:""}${!g.cancelled&&age!=null?`<span style="padding-left:2px">${age>=0?`First released when you were <b>${age}</b>`:`Released <b>${-age}</b> years before you were born`}</span>`:""}</div>
        ${g.cancelled
          ?(isDevMode()?`<div class="mylv"><span class="sync">Unreleased project — honored for the team who built it:</span><button type="button" class="btn sm ${wk?"craft":"primary"}" data-act="toggleWk" data-id="${g.id}" aria-pressed="${wk}">🛠 ${wk?"Worked on this ✓":"I worked on this project"}</button>${wk?DEV_ROLES.map(r=>`<button type="button" class="chip craftchip" data-act="setWkRole" data-id="${g.id}" data-role="${esc(r)}" aria-pressed="${ent&&ent.role===r}">${esc(r)}</button>`).join(""):""}</div>`:"")
          :`<div class="mylv"><span class="sync">In my timeline:</span><span class="seg" role="group" aria-label="In my timeline">${[1,2,3].map(v=>`<button class="${v===3?"l3":v===2?"l2":""}" data-act="setlv" data-id="${g.id}" data-lv="${v}" aria-pressed="${lv===v}">${LV[v].m} ${v===1?"Played":v===2?"Played a ton":"Favorite"}</button>`).join("")}</span>${lv&&!wk?`<button class="btn sm ghost" data-act="setlv" data-id="${g.id}" data-lv="0">Remove</button>`:""}</div>
          ${isDevMode()?`<div class="mylv" style="margin-top:8px"><span class="sync">Industry credit:</span><button type="button" class="btn sm ${wk?"craft":""}" data-act="toggleWk" data-id="${g.id}" aria-pressed="${wk}">🛠 ${wk?"Worked on this ✓":"I worked on this"}</button>${wk?DEV_ROLES.map(r=>`<button type="button" class="chip craftchip" data-act="setWkRole" data-id="${g.id}" data-role="${esc(r)}" aria-pressed="${ent&&ent.role===r}">${esc(r)}</button>`).join(""):""}</div>`:""}`}
        <div class="row" style="margin-top:10px">
          <button type="button" class="btn sm" data-act="watchTv" data-id="${g.id}">▶ Watch ${g.cancelled?"footage":"gameplay"}</button>
          <button type="button" class="btn sm love" data-act="gratSheet" data-id="${g.id}">Thank the makers</button>
          <a class="btn sm" href="${esc(mobyCoversURL(g))}" target="_blank" rel="noopener">Box-back scans ↗</a>
          <a class="btn sm" href="${esc(mobyURL(g))}" target="_blank" rel="noopener">Dev credits ↗</a>
          <button type="button" class="btn sm ghost" data-act="copyGame" data-id="${g.id}">Copy link</button>
          <button type="button" class="btn sm ghost" data-act="suggest" data-subj="${esc("Missing link or correction for "+g.title)}">Suggest link</button>
        </div>
        ${sellable(g)?`<div class="row" style="margin-top:8px"><span class="sync">Play officially today:</span>${storeLinksHTML(g)}</div>`
          :g.sunset?`<p class="sub" style="margin:8px 0 0;font-size:12.5px"><b>Official live servers offline</b> — preserved in player memory · <a href="#vault">Open The Vault ▸</a></p>`:""}
      </div></header>
    <div id="gameGalBox"></div>
    ${!g.tree?relatedSection(g):""}
    ${!g.tree?"":ch.length>1?`<section class="sec"><div class="sechead"><div><h2 class="h2">Roots: ${g.year-ch[0].g.year} years in ${plural(nSteps,"step")}</h2><p class="sub">The main line back from ${esc(g.title)}: strongest evidence, staying within the same genre family where possible.</p></div><button class="btn primary" data-act="walk" data-id="${g.id}">Walk the roots ▸</button></div>
      <div class="roots" id="rootsRow" tabindex="0" role="region" aria-label="Lineage steps">${ch.map((s,k)=>{const nx=ch[k+1];
        const arrow=!nx?"":nx.collapsed?`<span class="rfold" title="${esc(nx.collapsed.via.map(v=>v.title).join(", "))}">… ${nx.collapsed.n} more in the series …</span>`:(()=>{const lk=nx.link;return lk?`<span class="rarr" style="--c:var(${TIERS[lk.t].c})" title="${esc(tierLabelForLink(lk))}" aria-hidden="true"></span>`:``})();
        return `<button class="rs${s.g.i===g.i?" cur":""}" data-act="game" data-id="${s.g.id}">${cover(s.g,{showYear:false})}<b>${esc(s.g.title)}</b><span>${s.g.year}</span></button>${arrow}`}).join("")}</div></section>`
      :`<section class="sec"><p class="sub">No recorded roots yet.</p></section>`}
    ${g.tree?`<section class="sec"><div class="sechead"><div><h2 class="h2">${esc(treeHeading(g.title))}</h2><p class="sub">Two generations back and forward. Tap any game to refocus the tree.</p></div></div>
      <div class="pickstrip" style="padding:0 0 8px;gap:5px">${TIERS.map(t=>`<button type="button" class="chip tierchip" style="--c:var(${t.c})" data-act="tier" data-tier="${t.k}" aria-pressed="${!!state.tiers[t.k]}">${tierSwatchSVG(t)}${t.label}</button>`).join("")}</div>
      <div class="treebox" id="treebox" tabindex="0" role="region" aria-label="Interactive family tree">${treeSVG(g)}</div></section>
    <section class="sec"><div class="cols">${panelHTML("up",ups,g)}${panelHTML("down",downs,g)}</div></section>`:""}
  </div>${footer()}`;
  requestAnimationFrame(()=>{const rr=$("#rootsRow");if(rr)rr.scrollLeft=rr.scrollWidth;
    const tb=$("#treebox");if(tb){if(state.treeKeepScroll!=null){tb.scrollLeft=state.treeKeepScroll;state.treeKeepScroll=null}else{const c=tb.querySelector("[data-center]");if(c){const x=+c.dataset.cx,mob=window.innerWidth<=560;tb.scrollLeft=Math.max(0,x-tb.clientWidth*(mob?0.28:0.5))}}}});
  mountGameGallery(g,"#gameGalBox");
}
/* catalog-only games: no dead end, point to nearby games that are in the family tree */
function relatedSection(g){
  const fam=new Set(g.gen);const rel=TREE.filter(t=>t.gen.some(x=>fam.has(x))&&Math.abs(t.year-g.year)<=4).sort((a,b)=>(b.pop*10+Math.min(b.inf,300)/10)-(a.pop*10+Math.min(a.inf,300)/10)).slice(0,8);
  return `<section class="sec"><div class="card"><h2 class="h3">${esc(g.title)} isn't in the family tree yet</h2><p class="sub" style="margin:0">It's in the catalog, so you can add it to your timeline. Nobody has recorded what inspired it yet.</p></div>
    ${rel.length?`<h2 class="h2" style="margin-top:22px">Related games in the family tree</h2><p class="sub">Same kind of game, from around the same time.</p><div class="recs">${rel.map(r=>tileHTML(r,hist,{act:"game",quickTick:true})).join("")}</div>`:""}</section>`;
}
/* two generations each way, capped per column; ordered by year, with real box art thumbnails */
function computeTreeLayout(g){
  const gen=new Map([[g.i,0]]),cols={"-2":[],"-1":[],"0":[g.i],"1":[],"2":[]};
  const imp=i=>G[i].pop*10+Math.min(G[i].inf,500)/10;
  const add=(i,k)=>{if(!gen.has(i)){gen.set(i,k);cols[k].push(i)}};
  UP[g.i].filter(tierOn).forEach(l=>add(l.from,-1));
  DOWN[g.i].filter(tierOn).forEach(l=>add(l.to,1));
  const cap=k=>state.treeMore["c"+k]?60:9;
  const trim=k=>{cols[k].sort((a,b)=>imp(b)-imp(a));const more=cols[k].length-cap(k);if(more>0){cols[k].slice(cap(k)).forEach(i=>gen.delete(i));cols[k]=cols[k].slice(0,cap(k))}return Math.max(0,more)};
  const more={"-1":trim(-1),"1":trim(1)};
  cols["-1"].forEach(i=>UP[i].filter(tierOn).forEach(l=>add(l.from,-2)));
  cols["1"].forEach(i=>DOWN[i].filter(tierOn).forEach(l=>add(l.to,2)));
  more["-2"]=trim(-2);more["2"]=trim(2);
  const ks=[-2,-1,0,1,2].filter(k=>cols[k].length);
  ks.forEach(k=>cols[k].sort((a,b)=>G[a].year-G[b].year||G[a].title.localeCompare(G[b].title)));
  return {gen,cols,more,ks};
}
function treeSVG(g,nodeAct="game"){
  const {gen,cols,more,ks}=computeTreeLayout(g);
  const mob=typeof window!=="undefined"&&window.innerWidth<=560;
  const W=mob?152:192,H=mob?56:52,RG=mob?8:10,CG=mob?34:50,M=mob?12:16,TOP=40;
  const maxRows=Math.max(...ks.map(k=>cols[k].length+(more[k]?1:0)));
  const pos=new Map();const colX={};ks.forEach((k,ci)=>colX[k]=M+ci*(W+CG));
  const colOff={};
  ks.forEach(k=>{const n=cols[k].length+(more[k]?1:0),off=mob?0:Math.min((maxRows-n)/2*(H+RG),68);colOff[k]=off;cols[k].forEach((i,r)=>pos.set(i,{x:colX[k],y:TOP+off+r*(H+RG)}))});
  const actualBottom=Math.max(...ks.map(k=>{const n=cols[k].length+(more[k]?1:0);return TOP+colOff[k]+n*(H+RG)}));
  const width=M*2+ks.length*(W+CG)-CG,height=actualBottom+8;
  const C=cssVar,ink=C("--ink"),muted=C("--muted"),line2=C("--line2"),card=C("--card"),paper=C("--paper"),acc=C("--accent"),accInk=C("--accent-ink"),upInk=C("--up-ink"),downInk=C("--down-ink");
  const useImg=document.documentElement.dataset.art!=="era";
  const covW=mob?28:30,covH=mob?44:40,txX=mob?40:44;
  const splitMobTitle=t=>{
    if(t.length<=15)return [t];
    let cut=t.lastIndexOf(" ",15);
    if(cut<6)cut=15;
    const l1=t.slice(0,cut).trim(),rest=t.slice(cut).trim();
    const l2=rest.length>15?rest.slice(0,14)+"…":rest;
    return l2?[l1,l2]:[l1];
  };
  let defs="";
  for(const [i,p] of pos)if(useImg&&G[i].img)defs+=`<clipPath id="tc-${i}"><rect x="${p.x+6}" y="${p.y+6}" width="${covW}" height="${covH}" rx="4"/></clipPath>`;
  let s=`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="IBM Plex Sans, system-ui, sans-serif" style="display:block" role="group" aria-label="Family tree of ${esc(g.title)}">${defs?`<defs>${defs}</defs>`:""}`;
  const lab={"-2":mob?"◂ Earlier":"◂ Earlier ancestors","-1":"◂ Inspired it","0":"This game","1":"It inspired ▸","2":mob?"Later ▸":"Later descendants ▸"};
  ks.forEach(k=>{
    const tot=cols[k].length+(more[k]||0),lbl=k===0?lab[k]:`${lab[k]} (${tot})`;
    s+=`<g class="wnode" data-act="treeColJump" data-col="${k}" data-colx="${colX[k]+W/2}" pointer-events="all" style="cursor:pointer" role="button" tabindex="0" aria-label="Scroll to ${esc(lbl)}"><rect x="${colX[k]+6}" y="6" width="${W-12}" height="24" rx="12" fill="${card}" fill-opacity="0.85" stroke="${line2}" stroke-opacity="0.65"/><text aria-hidden="true" x="${colX[k]+W/2}" y="22" text-anchor="middle" font-size="${mob?10.5:11}" font-weight="700" fill="${k<0?upInk:k>0?downInk:ink}">${esc(lbl)}</text></g>`;
  });
  const edges=L.filter(l=>tierOn(l)&&pos.has(l.from)&&pos.has(l.to)&&gen.get(l.to)-gen.get(l.from)===1);
  edges.forEach(l=>{const A=pos.get(l.from),B=pos.get(l.to),t=TIERS[l.t];const x1=A.x+W,y1=A.y+H/2,x2=B.x,y2=B.y+H/2,dx=Math.max(16,(x2-x1)/2);
    const touch=l.from===g.i||l.to===g.i;
    s+=`<path d="M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}" fill="none" stroke="${C(t.c)}" stroke-width="${touch?2.5:1.5}" ${t.dash?`stroke-dasharray="${t.dash}"`:""} stroke-linecap="round" opacity="${touch?.92:.5}" pointer-events="none"/>`});
  for(const [i,p] of pos){const n=G[i],isC=i===g.i;const tLines=mob?splitMobTitle(n.title):[n.title.length>21?n.title.slice(0,20)+"…":n.title];const st=studio(n),t2=mob?`${n.year}${n.cancelled?" · unshipped":n.sunset?" · sunset":""}`:`${n.year}${n.cancelled?" (unreleased)":n.sunset?" (sunset)":""} · ${st.length>15?st.slice(0,14)+"…":st}`;
    const myl=levelOf(hist,n),myw=isWorked(hist,n);
    const act=isC&&nodeAct==="linFocus"?"game":nodeAct;
    const titleSvg=tLines.length===2
      ?`<text x="${p.x+txX}" y="${p.y+17}" font-size="11" font-weight="700" fill="${isC?accInk:ink}"><tspan x="${p.x+txX}">${esc(tLines[0])}</tspan><tspan x="${p.x+txX}" dy="13">${esc(tLines[1])}</tspan></text>`
      :`<text x="${p.x+txX}" y="${p.y+(mob?22:21)}" font-size="${mob?11.5:12.5}" font-weight="700" fill="${isC?accInk:ink}">${esc(tLines[0])}</text>`;
    s+=`<g class="wnode" data-act="${act}" data-id="${n.id}" pointer-events="all" style="cursor:pointer" ${isC?`data-center="1" data-cx="${p.x+W/2}"`:""} tabindex="0" role="link">
      <title>${esc(n.title)} (${n.year}${n.cancelled?", unreleased":""})</title>
      <rect x="${p.x}" y="${p.y}" width="${W}" height="${H}" rx="10" fill="${isC?acc:card}" stroke="${myw?C("--craft"):isC?acc:n.cancelled?C("--hook"):line2}" stroke-width="${myw||n.cancelled?1.8:1}" ${n.cancelled&&!isC?'stroke-dasharray="4 2"':""}/>
      <rect x="${p.x+6}" y="${p.y+6}" width="${covW}" height="${covH}" rx="4" fill="hsl(${n.h} 55% 40%)"/>
      ${useImg&&n.img?`<image href="${esc(n.img)}" x="${p.x+6}" y="${p.y+6}" width="${covW}" height="${covH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#tc-${i})"/>`:""}
      ${titleSvg}
      <text x="${p.x+txX}" y="${p.y+(mob?(tLines.length===2?46:38):37)}" font-size="${mob?10:10.5}" fill="${isC?accInk:muted}">${esc(t2)}</text>
      ${myw||myl?`<circle cx="${p.x+W-10}" cy="${p.y+10}" r="7" fill="${myw?C("--craft"):myl===3?C("--love"):acc}"/><text aria-hidden="true" x="${p.x+W-10}" y="${p.y+13.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${myw?C("--craft-ink"):paper}">${myw?"🛠":myl===3?"♥":"✓"}</text>`:""}</g>`}
  ks.forEach(k=>{if(more[k]){const n=cols[k].length,y=TOP+colOff[k]+n*(H+RG);
    s+=`<g class="wnode" data-act="treeMore" data-col="${k}" pointer-events="all" style="cursor:pointer" tabindex="0" role="button" aria-label="Show ${more[k]} more games in column"><rect x="${colX[k]}" y="${y}" width="${W}" height="${H}" rx="10" fill="${card}" fill-opacity="0.92" stroke="${acc}" stroke-dasharray="4 3"/><text aria-hidden="true" x="${colX[k]+W/2}" y="${y+30}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${acc}">+${more[k]} more ▾</text></g>`}});
  return s+`</svg>`;
}
/* ---------- story mode: walk the roots (left = older, right = newer; starts at target game on right, click left to step back) ---------- */
let story=null;
function openStory(chain){const c=compressChain(chain).slice().reverse();story={chain:c,total:chain.length-1,k:c.length-1,dir:-1};drawStory();document.addEventListener("keydown",storyKeys)}
function closeStory(){story=null;$("#layer").innerHTML="";document.removeEventListener("keydown",storyKeys)}
function storyKeys(e){if(!story)return;if(e.key==="ArrowLeft"){storyStep(-1)}else if(e.key==="ArrowRight"){storyStep(1)}else if(e.key==="Escape")closeStory()}
function storyStep(d){if(!story)return;const n=story.chain.length,nk=Math.max(-1,Math.min(n-1,story.k+d));if(nk===story.k)return;story.dir=d;story.k=nk;playUiTick(d<0?"back":"fwd");drawStory()}
function drawStory(){
  const {chain,k,dir}=story,n=chain.length;
  const oldest=chain[0].g,newest=chain[n-1].g;
  const shortT=s=>s.length>(window.innerWidth<540?14:24)?s.slice(0,window.innerWidth<540?13:23)+"…":s;
  const prog=`<div class="stprog" role="group" aria-label="Lineage timeline (${oldest.year} on left to ${newest.year} on right)"><button type="button" class="${k===-1?"cur on":""}" data-act="storyJump" data-k="-1" title="Full lineage summary" aria-label="Full lineage summary"></button>${chain.map((st,j)=>`<button type="button" class="${j<=k&&k>=0?"on":""}${j===k?" cur":""}" data-act="storyJump" data-k="${j}" title="${st.g.year}: ${esc(st.g.title)}" aria-label="${st.g.year}: ${esc(st.g.title)}"></button>`).join("")}</div>`;
  const curG=k>=0?chain[k].g:null;
  let body;
  if(k<0){const studios=new Set(chain.map(s=>studio(s.g)).filter(Boolean)),cs=new Set(chain.map(s=>s.g.cc).filter(Boolean));
    body=`<div><p class="eyebrow">${oldest.year} ← ${newest.year} · Root walk complete</p><h2 class="h1" style="font-size:clamp(24px,4.5vw,38px)">${esc(oldest.title)} (${oldest.year}) → ${esc(newest.title)} (${newest.year})</h2>
      <p class="stsum">Starting at <b>${esc(newest.title)}</b> (${newest.year}) and walking back to <b>${esc(oldest.title)}</b> (${oldest.year}): <b>${newest.year-oldest.year} years</b>, ${plural(story.total,"step")}, ${plural(studios.size,"team")} in ${plural(cs.size,"country","countries")}. Every team stood on earlier craft and added something of their own.</p>
      <div class="row" style="margin-top:16px"><button class="btn primary wrap" data-act="game" data-id="${oldest.id}" data-close="1">Open ${esc(oldest.title)} (${oldest.year})</button><button class="btn wrap" data-act="game" data-id="${newest.id}" data-close="1">Open ${esc(newest.title)} (${newest.year})</button><button class="btn" data-act="storyRestart">Restart at ${esc(newest.title)} (${newest.year}) ▸</button><button class="btn" data-act="copyWalk" data-id="${newest.id}">Copy walk link</button></div></div>`}
  else{const s=chain[k],g=s.g,l=s.link,p=l?G[l.from]:null,t=l?TIERS[l.t]:null;
    const srcs=l?srcHTML(l.src,l.tier):"";
    const stepNote=k===n-1?`Step ${n} of ${n} · Start`:k===0?`Step 1 of ${n} · Origin (${oldest.year})`:`Step ${k+1} of ${n} · Roots of ${esc(newest.title)}`;
    const ageDiff=hist.birth?g.year-hist.birth:null;
    const ageStr=ageDiff==null?"":ageDiff===0?" · released the year you were born":ageDiff>0?` · released when you were ${ageDiff}`:` · ${-ageDiff} years before you were born`;
    body=`<div class="stin${dir<0?" back":""}" key="${k}">${cover(g)}<div style="min-width:0"><p class="eyebrow" style="margin-bottom:4px">${stepNote}</p><div class="styear">${g.year}</div><h2>${esc(g.title)}</h2>
      <p class="sub" style="margin:0">${flag(g.cc)} ${studioLinks(g.dev||"")}${ageStr}</p>
      ${g.note?`<p class="gnote" style="font-size:14px">${esc(g.note)}</p>`:""}
      ${l?`<div class="stlink" style="--c:var(${t.c})"><p class="lead">Built on <b>${esc(p.title)}</b> (${p.year}) · <span class="tier">${esc(tierLabelForLink(l))}</span></p><dl class="ta"><dt>${l.rel==="variant"||l.rel==="fast-follow"?"Changed":"Added"}</dt><dd class="add">${esc(l.added)}</dd><dt>Took</dt><dd>${esc(l.took)}</dd></dl>${srcs?`<div class="src">Source: ${srcs}</div>`:""}</div>`
        :s.collapsed?`<div class="stlink" style="--c:var(--t-series)"><p class="lead">Built on its own series: ${plural(s.collapsed.n,"game")} from <b>${esc(s.collapsed.to.title)}</b> (${s.collapsed.to.year}) · <span class="tier">Same series</span></p><p class="src" style="margin:4px 0 0">${esc(s.collapsed.via.map(v=>v.title+" ("+v.year+")").join(" ▸ "))}</p></div>`
        :`<div class="stlink" style="--c:var(--accent)"><p class="lead"><b>Origin point (${g.year}):</b> where the ${newest.year-oldest.year}-year road to ${esc(newest.title)} (${newest.year}) begins.</p></div>`}
    </div></div>`}
  const prevLbl=k>0?`◂ Earlier (${chain[k-1].g.year} · ${esc(shortT(chain[k-1].g.title))})`:k===0?`◂ Summary (${newest.year-oldest.year} yrs)`:"◂ Origin reached";
  const nextLbl=k<0?`Origin (${oldest.year}) ▸`:k<n-1?`Later (${chain[k+1].g.year}) ▸`:`At ${newest.year}`;
  $("#layer").innerHTML=`<div class="story" role="dialog" aria-label="Walk the roots"><div class="ststage">
    <div class="sthead">${prog}<span class="mono muted sthead-yr" style="font-size:12px">${oldest.year} ← ${k>=0?chain[k].g.year:"Summary"}</span><button class="x" data-act="closeStory" aria-label="Close">×</button></div>
    <div class="stframe">
      <div class="storycard" id="storyBody">
        <div class="stbody">${body}</div>
        <div class="stfoot">
          <div class="stfoot-nav">
            <button class="btn${k>=0?" primary":""}" data-act="storyPrev" ${k<0?"disabled":""}>${prevLbl}</button>
            <button class="btn${k<0?" primary":""}" data-act="storyNext" ${k>=n-1?"disabled":""}>${nextLbl}</button>
          </div>
          <div class="row stfoot-aux" style="gap:6px">
            ${curG?`<button type="button" class="btn sm ghost" data-act="game" data-id="${curG.id}" data-close="1">Family tree</button><button type="button" class="btn sm ghost" data-act="watchTv" data-id="${curG.id}">▶ Gameplay</button>`:""}
          </div>
        </div>
      </div>
    </div>
  </div></div>`;
  const sb=$("#storyBody");
  if(sb){
    let pid=null,sx=0,sy=0,dx=0,dy=0;
    const resetCard=()=>{sb.style.transition="transform .18s ease-out";sb.style.transform=""};
    sb.addEventListener("pointerdown",ev=>{
      if(ev.button&&ev.button!==0)return;
      if(ev.target.closest("button,a,input"))return;
      pid=ev.pointerId;sx=ev.clientX;sy=ev.clientY;dx=0;dy=0;
      sb.style.transition="none";
    });
    sb.addEventListener("pointermove",ev=>{
      if(ev.pointerId!==pid)return;
      dx=ev.clientX-sx;dy=ev.clientY-sy;
      if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2){
        sb.style.transform=`translate3d(${Math.max(-90,Math.min(90,dx*0.32))}px,0,0)`;
      }
    });
    const finish=ev=>{
      if(ev.pointerId!==pid)return;
      pid=null;
      const fx=(ev.clientX||sx)-sx||dx,fy=(ev.clientY||sy)-sy||dy;
      resetCard();
      if(Math.abs(fx)>42&&Math.abs(fx)>Math.abs(fy)*1.25){storyStep(fx>0?-1:1);return}
      const scroller=sb.closest(".story");
      if(fy>88&&Math.abs(fy)>Math.abs(fx)*1.8&&(!scroller||scroller.scrollTop<=4))closeStory();
    };
    sb.addEventListener("pointerup",finish);
    sb.addEventListener("pointercancel",()=>{pid=null;resetCard()});
  }
}

/* ---------- friends, weighted taste match & 10s challenge loop ---------- */
const MP_SERVER_RE=/\b(world of warcraft|counter-strike|starcraft|diablo|warcraft|everquest|ultima online|runescape|league of legends|dota|minecraft|fortnite|dayz|quake|unreal tournament|team fortress|overwatch|destiny|guild wars|final fantasy xi|final fantasy xiv|apex legends|valorant|rocket league|among us|call of duty|battlefield|halo|age of empires|tibia|maplestory|pubg|hell let loose|helldivers|rust|eve online|phantasy star online|goldeneye|mario kart|super smash bros|left 4 dead|rainbow six|tf2|cs:go|cs2|hearthstone|genshin|gta online|grand theft auto online|destiny 2|sea of thieves|terraria|valheim|phasmophobia|lethal company|fall guys|splatoon|monster hunter|elden ring|dark souls|street fighter|tekken|mortal kombat|fifa|nba 2k|madden)\b/i;
const MP_GENRES=new Set(["mmo","battle-royale","moba","fps","fighting","sports","racing","party"]);
function sameServerSameYear(a,b){
  const ea=entries(a),eb=entries(b);
  const ka=new Map(ea.map(x=>[norm(x.e.t),x]));
  const hits=[];
  for(const xb of eb){
    const xa=ka.get(norm(xb.e.t));
    if(!xa||xa.y!==xb.y)continue;
    const g=xa.g||xb.g,ttl=g?g.title:xa.e.t;
    const isOnline=!!(MP_SERVER_RE.test(ttl)||(g&&g.gen.some(gi=>MP_GENRES.has(GEN[gi].k))));
    hits.push({g,title:ttl,year:xa.y,a:xa,b:xb,isOnline,score:(isOnline?40:0)+(xa.lv+xb.lv)*5+(g?g.pop:2)});
  }
  hits.sort((p,q)=>q.score-p.score||p.year-q.year);
  return hits;
}
function weightedTasteMatch(a,b){
  const ea=entries(a),eb=entries(b);
  if(!ea.length||!eb.length)return {both:0,favBoth:0,pct:0,gamePct:0,genrePct:0,sameServer:[],shared:[]};
  const wOf=x=>x.lv===3?3:x.lv===2?2:1;
  const ka=new Map(ea.map(x=>[norm(x.e.t),x])),kb=new Map(eb.map(x=>[norm(x.e.t),x]));
  let totA=0,totB=0,bothW=0,both=0,favBoth=0;
  const shared=[];
  ka.forEach(x=>{totA+=wOf(x)});
  kb.forEach((xb,k)=>{
    const wb=wOf(xb);totB+=wb;
    const xa=ka.get(k);
    if(xa){
      both++;
      bothW+=Math.min(wOf(xa),wb);
      if(xa.lv===3&&xb.lv===3)favBoth++;
      shared.push({a:xa,b:xb,g:xa.g||xb.g,w:wOf(xa)+wb});
    }
  });
  shared.sort((p,q)=>q.w-p.w||((q.g&&q.g.pop)||0)-((p.g&&p.g.pop)||0));
  /* Weighted Dice blended smoothly with size-adjusted overlap so a 5-game newcomer comparing against a 150-game veteran gets a meaningful match score */
  const wDice=(totA+totB)?(2*bothW)/(totA+totB):0;
  const minW=Math.min(totA,totB);
  const wOv=minW?bothW/minW:0;
  const sizeConf=Math.min(1,both/6);
  const gameSim=both?Math.min(1,wDice+(wOv-wDice)*0.55*sizeConf):0;
  /* Genre vector cosine similarity */
  const ga={},gb={};
  ea.forEach(x=>{if(x.g)x.g.gen.forEach((gi,k)=>{ga[gi]=(ga[gi]||0)+wOf(x)*(k?0.5:1)})});
  eb.forEach(x=>{if(x.g)x.g.gen.forEach((gi,k)=>{gb[gi]=(gb[gi]||0)+wOf(x)*(k?0.5:1)})});
  let dot=0,na=0,nb=0;
  const gKeys=new Set([...Object.keys(ga),...Object.keys(gb)]);
  gKeys.forEach(k=>{const va=ga[k]||0,vb=gb[k]||0;dot+=va*vb;na+=va*va;nb+=vb*vb});
  const genCos=(na&&nb)?dot/(Math.sqrt(na)*Math.sqrt(nb)):0;
  /* Hardware overlap */
  const sa=new Set(ea.flatMap(x=>sysListOf(x.e,a))),sb=new Set(eb.flatMap(x=>sysListOf(x.e,b)));
  let hwBoth=0;sa.forEach(s=>{if(sb.has(s))hwBoth++});
  const hasHw=sa.size>0&&sb.size>0;
  const hwSim=hasHw?(2*hwBoth)/(sa.size+sb.size):0;
  let pct=0;
  if(both===0){
    pct=Math.round((genCos*12)+(hwSim*3));
  }else{
    const wG=0.80,wGen=gKeys.size?0.15:0,wHw=hasHw?0.05:0;
    const denom=wG+wGen+wHw;
    pct=Math.min(100,Math.round(((gameSim*wG+genCos*wGen+hwSim*wHw)/denom)*100));
  }
  const sameServer=sameServerSameYear(a,b);
  return {both,favBoth,pct,gamePct:Math.round(gameSim*100),genrePct:Math.round(genCos*100),sameServer,shared};
}
const overlap=weightedTasteMatch;
function vsGridGamesOf(d){
  return entries(d).filter(x=>x.g&&playable(x.g))
    .sort((a,b)=>(b.lv-a.lv)||((b.g.img?1:0)-(a.g.img?1:0))||(b.g.pop-a.g.pop)||(a.y-b.y))
    .slice(0,16);
}
function vsHudHTML(f){
  const d=f.data,mine=entries(hist).length>0,ov=mine?weightedTasteMatch(hist,d):null;
  const ss=ov&&ov.sameServer[0];
  const nm=f.name||"Your friend";
  return `<div class="vs-meter">
      <span class="vs-pct" id="vsPct">${ov?ov.pct+"%":"—"}</span>
      <div style="min-width:0;flex:1">
        <b>${ov?`Weighted Taste Match with ${esc(nm)}`:"Tap any covers below to calculate your Taste Match"}</b>
        <p class="sub" style="margin:2px 0 0">${ov?`${plural(ov.both,"shared game")}${ov.favBoth?` · ${plural(ov.favBoth,"shared ♥ favorite")}`:""} · ${ov.genrePct}% genre DNA alignment`:"1× ✓ played · 2× ★ played a ton · 3× ♥ favorite — saves straight to your own timeline."}</p>
      </div>
    </div>
    ${ss?`<div style="margin-top:10px"><span class="vs-server-pill">${ss.isOnline?"🌐 Same Server, Same Year":"✨ Same Year, Same World"}: You both played ${esc(ss.title)} in ${ss.year}</span></div>`:""}
    <div class="row" style="margin-top:12px;gap:8px">
      ${mine?`<button type="button" class="btn sm primary" data-act="duoPng">Save Duo card</button><button type="button" class="btn sm" data-act="compare">Full side-by-side compare</button><a class="btn sm ghost" href="#timeline">Open my timeline (${entries(hist).length}) ▸</a>`:`<a class="btn sm ghost" href="#start">Or build my own timeline from scratch ▸</a>`}
    </div>`;
}
function loadChallenger(){
  const raw=store.get("pm-challenger",null);
  if(!raw||!raw.payload||typeof raw.payload!=="string")return null;
  if(entries(hist).length&&encodeShare(hist,{includeBirth:false,includeNotes:false})===raw.payload)return null;
  const d=decodeShare(raw.payload);
  if(!d)return null;
  return {name:raw.name||d.name||"A friend",payload:raw.payload,data:d,ts:raw.ts||0};
}
function challengerBannerHTML(){
  const ch=loadChallenger();
  if(!ch)return "";
  const mine=entries(hist).length>0,ov=mine?weightedTasteMatch(hist,ch.data):null;
  return `<div class="chal-bar" id="challengerBar" role="region" aria-label="Active friend challenge">
    <div><b>🎯 Challenged by ${esc(ch.name)}</b>${ov?` · <b>${ov.pct}%</b> Taste Match (${plural(ov.both,"shared game")})`:" · Tap their games to calculate your Taste Match"}</div>
    <div class="row" style="gap:6px">
      <button type="button" class="btn sm primary" data-act="openChallenger">${mine?"Compare & Duo PNG ▸":"Open challenge ▸"}</button>
      <button type="button" class="btn sm ghost" data-act="dismissChallenger" aria-label="Dismiss challenger">×</button>
    </div>
  </div>`;
}
function renderShared(m,payload,isVs=false){
  const cleanPayload=String(payload||"").split("&")[0];
  const d=decodeShare(cleanPayload);
  if(!d){m.innerHTML=`<section class="wrap exhero"><h1 class="h1">This link doesn't open a timeline</h1><p class="lede">It may have been cut off when it was copied. Ask for the link again.</p><a class="btn primary" href="#timeline">Make my own timeline</a></section>${footer()}`;return}
  store.set("pm-challenger",{name:d.name||"A friend",payload:cleanPayload,ts:Date.now()});
  renderPerson(m,{name:d.name||"A friend",data:d,payload:cleanPayload,vs:!!isVs});
  if(entries(hist).length)trackEvent("friend_match",String(weightedTasteMatch(hist,d).pct));
  if(isVs)requestAnimationFrame(()=>{const vc=$("#vsCard");if(vc)vc.scrollIntoView({behavior:prefersReducedMotion()?"auto":"smooth",block:"nearest"})});
}
function renderPerson(m,f){
  const d=f.data,st=timelineStats(d),mk=makerLegacyOf(d),wkMode=state.tlMode==="worked"&&!!mk,mine=entries(hist).length>0;
  const ov=mine?weightedTasteMatch(hist,d):null;
  const pSpanTxt=st.from&&st.from!==st.to?` (${st.from}–${st.to})`:"";
  const eraLbl=eraKidLabel(d);
  const vsGames=vsGridGamesOf(d);
  m.innerHTML=`<section class="wrap mehead"><div><p class="eyebrow">${wkMode?"Game industry credits":"Friend timeline"}</p><h1 class="h1" style="font-size:clamp(1.65rem,1.1rem + 2.8vw,2.5rem)">${esc(f.name)}'s ${wkMode?"work in games":"life in games"}</h1>
      <div class="stats"><div class="stat"><b>${st.n}</b><span>games</span></div>${st.wk?`<div class="stat"><b style="color:var(--craft)">${st.wk}</b><span>worked on</span></div>`:""}<div class="stat"><b>${st.span}</b><span>${st.span===1?"year":"years"}${pSpanTxt}</span></div><div class="stat"><b>${st.fav}</b><span>favorites</span></div>${d.birth?`<div class="stat"><b>${esc(d.birth)}</b><span>born</span></div>`:eraLbl?`<div class="stat"><b>${esc(eraLbl)}</b><span>era</span></div>`:""}</div></div>
      <div class="row">${f.payload?`<button class="btn" data-act="copyLink" data-payload="${esc(f.payload)}">Copy link</button><button class="btn ghost" data-act="adoptAsk" title="Load this saved link as your own editable timeline on this device">Load as mine</button>`:""}</div></section>
    <div class="wrap" id="adoptBox"></div>
    ${vsGames.length?`<section class="wrap"><div class="vs-card" id="vsCard">
      <div class="sechead" style="margin-bottom:10px">
        <div>
          <p class="eyebrow" style="margin-bottom:2px">10-second Taste Match</p>
          <h2 class="h2" style="margin:0">Tap the ones you played too</h2>
        </div>
      </div>
      <div id="vsHud">${vsHudHTML(f)}</div>
      <div class="grid" id="vsGrid" style="margin-top:12px">${vsGames.map(x=>tileHTML(x.g,hist,{act:"vsCycle",sub:`${esc(f.name)} · ${x.y}`})).join("")}</div>
    </div></section>`:""}
    ${mk?`<section class="wrap" style="margin-top:10px;display:flex;justify-content:flex-end"><span class="seg" role="group" aria-label="Timeline filter"><button data-act="tlMode" data-m="all" aria-pressed="${!wkMode}">All games (${st.n})</button><button data-act="tlMode" data-m="worked" aria-pressed="${wkMode}">🛠 Worked on (${st.wk})</button></span></section>`:""}
    ${!wkMode?personaSection(d,false):""}
    ${wkMode?makerSection(d,false,mk):""}
    <section class="wrap life">${lifeStrip(d,{mine:false,workedOnly:wkMode})}</section>
    ${!wkMode&&mk?makerSection(d,false,mk):""}
    ${favSection(d,false)}${pyramidSection(d,false,st.n>=3?dnaOf(d):null)}${dnaSection(d,false)}${statsSection(d,false)}${footer()}`;
  state.viewing=f;
}
function openCompare(f){
  const a=hist,b=f.data;const ea=entries(a),eb=entries(b);
  const ka=new Map(ea.map(x=>[norm(x.e.t),x])),kb=new Map(eb.map(x=>[norm(x.e.t),x]));
  const both=[...ka.keys()].filter(k=>kb.has(k)).map(k=>({a:ka.get(k),b:kb.get(k)}));
  const bothFav=both.filter(x=>x.a.lv===3&&x.b.lv===3);
  const bothWk=both.filter(x=>x.a.e.wk&&x.b.e.wk);
  const youBuiltTheyPlayed=both.filter(x=>x.a.e.wk&&!x.b.e.wk).sort((p,q)=>q.b.lv-p.b.lv);
  const theyBuiltYouPlayed=both.filter(x=>x.b.e.wk&&!x.a.e.wk).sort((p,q)=>q.a.lv-p.a.lv);
  const onlyA=ea.filter(x=>!kb.has(norm(x.e.t))&&x.g).sort((x,y)=>y.lv-x.lv||y.g.pop-x.g.pop);
  const onlyB=eb.filter(x=>!ka.has(norm(x.e.t))&&x.g).sort((x,y)=>y.lv-x.lv||y.g.pop-x.g.pop);
  const ov=weightedTasteMatch(a,b);
  const ssTop=ov.sameServer[0];
  const hasBothBirths=!!(a.birth&&b.birth);
  const byYr=!hasBothBirths||state.cmpMode==="year";
  const mini=(x,sub="")=>{const g=x.g,wk=!!x.e.wk;return `<div class="tile lv${x.lv}${wk?" worked":""}"><button class="art" data-act="${g?"game":"noop"}" data-id="${g?g.id:""}" data-close="1">${coverOfEntry(x.e,x.y,{showYear:false})}${wk?`<span class="wkbadge">🛠</span>`:""}<span class="lvb${x.lv===3?" l3":x.lv===2?" l2":""}">${LV[x.lv].m}</span></button><span class="tn">${esc(g?g.title:x.e.t)}</span>${sub?`<span class="trole">${sub}</span>`:""}</div>`};
  const rows=[];
  if(byYr){
    const ys=[...new Set([...ea.map(x=>x.y),...eb.map(x=>x.y)])].sort((p,q)=>p-q);
    for(const yr of ys){const la=ea.filter(x=>x.y===yr).sort((p,q)=>q.lv-p.lv).slice(0,4),lb=eb.filter(x=>x.y===yr).sort((p,q)=>q.lv-p.lv).slice(0,4);
      const subAge=hasBothBirths?`<small>${yr-a.birth>=0?"age "+(yr-a.birth):"pre"} · ${yr-b.birth>=0?"age "+(yr-b.birth):"pre"}</small>`:"";
      if(la.length||lb.length)rows.push(`<div class="agerow"><b>${yr}${subAge}</b><div class="agecell">${la.map(x=>mini(x)).join("")||'<span class="muted" style="font-size:12px">–</span>'}</div><div class="agecell">${lb.map(x=>mini(x)).join("")||'<span class="muted" style="font-size:12px">–</span>'}</div></div>`)}
  }else{
    for(let age=4;age<=45;age++){const ya=a.birth+age,yb=b.birth+age;if(ya>NOW&&yb>NOW)break;
      const la=ea.filter(x=>x.y===ya).sort((p,q)=>q.lv-p.lv).slice(0,4),lb=eb.filter(x=>x.y===yb).sort((p,q)=>q.lv-p.lv).slice(0,4);
      if(la.length||lb.length)rows.push(`<div class="agerow"><b>${age}<small>${ya} · ${yb}</small></b><div class="agecell">${la.map(x=>mini(x)).join("")||'<span class="muted" style="font-size:12px">–</span>'}</div><div class="agecell">${lb.map(x=>mini(x)).join("")||'<span class="muted" style="font-size:12px">–</span>'}</div></div>`)}
  }
  const nm=f.name;
  $("#layer").innerHTML=`<div class="ov" role="dialog" aria-label="Compare timelines"><div class="wrap ovhead"><div class="row" style="gap:10px"><button type="button" class="navback" data-act="closeLayer">◂ Back</button><h2>You and ${esc(nm)}</h2></div><div class="row" style="gap:6px"><button type="button" class="btn sm primary" data-act="duoPng">Save Duo PNG</button><button class="x" data-act="closeLayer" aria-label="Close">×</button></div></div>
    <div class="ovbody"><div class="wrap" style="padding-block:18px 40px">
      <div class="stats"><div class="stat"><b>${ov.pct}%</b><span>taste match</span></div><div class="stat"><b>${both.length}</b><span>games you both played</span></div><div class="stat"><b>${bothFav.length}</b><span>shared favorites</span></div><div class="stat"><b>${ov.genrePct}%</b><span>genre DNA</span></div>${bothWk.length?`<div class="stat"><b style="color:var(--craft)">${bothWk.length}</b><span>worked on together</span></div>`:""}${hasBothBirths?`<div class="stat"><b>${Math.abs(a.birth-b.birth)}</b><span>years apart</span></div>`:""}</div>
      ${ssTop?`<div style="margin-top:12px"><span class="vs-server-pill">${ssTop.isOnline?"🌐 Same Server, Same Year":"✨ Same Year, Same World"}: You both played ${esc(ssTop.title)} in ${ssTop.year}${ov.sameServer.length>1?` (+${ov.sameServer.length-1} more)`:""}</span></div>`:""}
      <div id="duoOut"></div>
      ${bothWk.length?`<section class="sec"><div class="craftcard"><p class="crafteyebrow">🛠 Shared trenches</p><h3 class="h2" style="margin-bottom:10px">Games you both worked on</h3><div class="grid">${bothWk.map(x=>mini(x.a,esc([x.a.e.role,x.b.e.role].filter(Boolean).join(" / ")||"Colleagues"))).join("")}</div></div></section>`:""}
      ${youBuiltTheyPlayed.length?`<section class="sec"><div class="craftcard"><p class="crafteyebrow">🛠 Maker × Player</p><h3 class="h2" style="margin-bottom:10px">Games you helped build that ${esc(nm)} played</h3><div class="grid">${youBuiltTheyPlayed.map(x=>mini(x.b,`${esc(nm)}: ${LV[x.b.lv].m} ${LV[x.b.lv].label}`)).join("")}</div></div></section>`:""}
      ${theyBuiltYouPlayed.length?`<section class="sec"><div class="craftcard"><p class="crafteyebrow">🛠 Maker × Player</p><h3 class="h2" style="margin-bottom:10px">Games ${esc(nm)} helped build that you played</h3><div class="grid">${theyBuiltYouPlayed.map(x=>mini(x.a,`You: ${LV[x.a.lv].m} ${LV[x.a.lv].label}`)).join("")}</div></div></section>`:""}
      ${bothFav.length?`<section class="sec"><h3 class="h2">You both loved</h3><div class="grid">${bothFav.map(x=>mini(x.a)).join("")}</div></section>`:""}
      ${both.length?`<section class="sec"><h3 class="h2">You both played</h3><div class="grid">${both.filter(x=>!(x.a.lv===3&&x.b.lv===3)).slice(0,40).map(x=>mini(x.a)).join("")}</div></section>`:""}
      <section class="sec"><div class="sechead"><div><h3 class="h2">${byYr?"Year by year":"At the same age"}</h3><p class="sub">${byYr?"What each of you was playing in the same calendar year.":"What each of you played at age 8, 12, 16…"}</p></div>
        ${hasBothBirths?`<span class="seg" role="group" aria-label="Compare mode"><button data-act="cmpMode" data-m="age" aria-pressed="${!byYr}">Same age</button><button data-act="cmpMode" data-m="year" aria-pressed="${byYr}">Same year</button></span>`:""}</div>
        <div class="agehead" style="top:0"><span>${byYr?"Year":"Age"}</span><span>You</span><span>${esc(nm)}</span></div>${rows.join("")}</section>
      <section class="sec"><div class="hgrid"><div><h3 class="h2">Only you</h3><div class="grid">${onlyA.slice(0,18).map(x=>mini(x)).join("")}</div></div><div><h3 class="h2">Only ${esc(nm)}</h3><div class="grid">${onlyB.slice(0,18).map(x=>mini(x)).join("")}</div></div></div></section>
    </div></div></div>`;
}

/* ---------- sheets (native <dialog closedby="any"> + single × close button + 12-wedge Lucky Wheel) ---------- */
let PILE=null,WHEEL=null,SUG_LAST=0,GRAT_DRAFT={st:"",id:"",tag:"Carried me through",note:"",who:""};
function stopLuckyWheel(){
  if(!WHEEL)return;
  if(WHEEL.raf)cancelAnimationFrame(WHEEL.raf);
  if(WHEEL.keyFn)document.removeEventListener("keydown",WHEEL.keyFn);
  if(WHEEL.resizeFn)removeEventListener("resize",WHEEL.resizeFn);
  WHEEL=null;
}
function openSheet(html,label,opts={}){
  const dlg=$("#sheetDlg");if(!dlg)return;
  stopLuckyWheel();
  dlg.classList.toggle("wide",!!(opts&&opts.wide));
  let inner=html;
  if(inner.includes('class="sheethead"')){
    let tagged=false;
    inner=inner.replace(/<h2(\s|>)/,(_,c)=>{tagged=true;return `<h2 id="sheetTitle"${c}`});
    if(tagged){dlg.setAttribute("aria-labelledby","sheetTitle");dlg.removeAttribute("aria-label")}
    else{dlg.removeAttribute("aria-labelledby");dlg.setAttribute("aria-label",label||"Details")}
  }else{
    dlg.removeAttribute("aria-labelledby");dlg.setAttribute("aria-label",label||"Details");
  }
  dlg.innerHTML=inner;
  if(!dlg.open)dlg.showModal();
  dlg.scrollTop=0;
}
function clearLayer(){
  stopLuckyWheel();
  if(typeof stopCreditsRoll==="function")stopCreditsRoll();
  if(typeof clearShareBlobUrls==="function")clearShareBlobUrls();
  if(MAP){removeEventListener("resize",MAP.resize);MAP=null}
  if(PILE){cancelAnimationFrame(PILE.raf);removeEventListener("resize",PILE.resize);PILE=null}
  $("#layer").innerHTML="";
  const dlg=$("#sheetDlg");
  if(dlg){if(dlg.open)dlg.close();dlg.classList.remove("wide");dlg.innerHTML="";dlg.returnValue=""}
}
function closeLayer(){
  const dlg=$("#sheetDlg"),wasDlg=!!(dlg&&dlg.open);
  clearLayer();
  if(!wasDlg&&(state.route.view==="timeline"||state.route.view==="start")){const y=window.scrollY;render();window.scrollTo({top:y})}
}
const F2P_IDS=new Set(["fortnite-br","lego-fortnite","free-fire","garena-free-fire","mobile-legends-bang-bang","league-of-legends","dota-2","apex-legends","valorant","genshin-impact","honkai-star-rail","roblox","candy-crush-saga","clash-of-clans","clash-royale","brawl-stars","hearthstone","pokemon-go","call-of-duty-warzone","counter-strike-2","marvel-rivals","pubg-mobile","honor-of-kings"]);
function eraBoxContext(g){
  if(!playable(g))return "Tabletop boxed set / rulebook";
  if(F2P_IDS.has(g.id)||/free-to-play/i.test(g.note||""))return "Free-to-play live release · digital download";
  const ps=sysOfGame(g);
  if(ps.length===1&&ps[0]==="Arcade")return "Coin-operated arcade cabinet · typically 25¢ / credit";
  if(ps.every(p=>p==="iPhone / iPad"||p==="Android"||p==="Browser"))return "Mobile / web release · digital storefront";
  if(g.year<1984)return "Early big-box / ROM cartridge · typical launch MSRP $29–$39";
  if(g.year<1995){
    const comp=ps.some(p=>/Amiga|Commodore 64|Atari ST|ZX Spectrum|PC|Apple II/.test(p));
    return comp?'Big-box floppy / cassette with printed manual · typical MSRP $39–$49':'Printed cardboard box & ROM cartridge · typical launch MSRP $49–$59';
  }
  if(g.year<2005)return "Jewel-case / big-box CD-ROM or console keep-case · typical MSRP $49";
  if(g.year<2020)return g.pop<=3?"Digital / indie release · typical launch $15–$29":"Keep-case disc & digital storefront · typical launch MSRP $59";
  return g.pop<=3?"Digital / indie release · typical launch $15–$35":"Physical & digital edition · typical launch MSRP $59–$69";
}
const GAL_CACHE=new Map();
let ACTIVE_GAL={gid:"",boxSel:"",items:[],idx:-1};
function probeImgOk(url,ms=2800){
  return new Promise(res=>{
    const im=new Image();let done=false;
    const fin=ok=>{if(!done){done=true;res(ok)}};
    const tm=setTimeout(()=>fin(false),ms);
    im.onload=()=>{clearTimeout(tm);fin(im.naturalWidth>40&&im.naturalHeight>40)};
    im.onerror=()=>{clearTimeout(tm);fin(false)};
    im.src=url;
  });
}
async function fetchWikiGallery(g){
  const skip=/(Gnome-|Symbol_|Commons-logo|Wikiquote|Portal|Question_book|Crystal_Clear|Edit-clear|Nuvola|Flag_of_|Ambox|Lock-|Padlock|Disambig|Wiki_letter|Speaker_Icon|Loudspeaker|\.svg$)/i;
  const parseList=d=>{
    const out=[];
    for(const it of (d&&d.items||[])){
      if(it.type!=="image"||!it.title||skip.test(it.title))continue;
      const ss=it.srcset||[];if(!ss.length)continue;
      const best=ss[ss.length-1].src||ss[0].src,thumb=ss[0].src;
      const full=best.startsWith("//")?"https:"+best:best,th=thumb.startsWith("//")?"https:"+thumb:thumb;
      const cap=((it.caption&&it.caption.text)||"").trim();
      const isPerson=/\b(portrait|at the \d{4}|in \d{4}|Expo|GDC|E3|designer|director|composer|creator|programmer|founder)\b/i.test(cap+" "+it.title);
      out.push({src:full,thumb:th,kind:isPerson?"Creator / Team":"Screenshot / Art",cap:cap||it.title.replace(/^File:/,"").replace(/[_-]/g," ").replace(/\.\w+$/,"")});
    }
    return out;
  };
  const trySlug=async slug=>{
    try{const r=await fetch(`https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(slug)}`);if(!r.ok)return [];return parseList(await r.json())}catch(e){return []}
  };
  const baseSlug=g.title.replace(/\s+/g,"_");
  let hits=await trySlug(`${baseSlug}_(video_game)`);
  if(hits.length<2){const h2=await trySlug(baseSlug);if(h2.length>hits.length)hits=h2}
  if(!hits.length){
    try{
      const sr=await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(g.title+" "+g.year+" video game")}&srlimit=1&format=json&origin=*`);
      if(sr.ok){const sd=await sr.json(),top=sd?.query?.search?.[0]?.title;if(top)hits=await trySlug(top.replace(/\s+/g,"_"))}
    }catch(e){}
  }
  return hits;
}
async function fetchGameGallery(g){
  if(!g)return [];
  if(GAL_CACHE.has(g.id))return GAL_CACHE.get(g.id);
  const items=[];
  if(g.img){
    const hi=g.img.replace(/\/(\d{2,3})px-/,(m,w)=>+w<500?"/500px-":m);
    items.push({src:hi,thumb:g.img,kind:"Front Box / Cover",cap:`${g.title} (${g.year})`,box:true});
  }
  const stm=g.img&&g.img.match(/\/steam\/apps\/(\d+)\//);
  const probes=[];
  if(stm){
    const aid=stm[1];
    probes.push((async()=>{const u=`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${aid}/library_hero.jpg`;return (await probeImgOk(u))?{src:u,thumb:u,kind:"Key Artwork",cap:`${g.title} widescreen banner`}:null})());
  }
  const [wikiHits,...probeHits]=await Promise.all([fetchWikiGallery(g),...probes]);
  probeHits.filter(Boolean).forEach(h=>items.push(h));
  const seenFile=new Set(items.map(x=>x.src.split("/").pop().replace(/^\d+px-/,"").toLowerCase()));
  wikiHits.forEach(w=>{
    const fn=w.src.split("/").pop().replace(/^\d+px-/,"").toLowerCase();
    if(seenFile.has(fn)||items.length>=8)return;
    seenFile.add(fn);items.push(w);
  });
  GAL_CACHE.set(g.id,items);
  return items;
}
function drawGalleryBox(g,boxSel,items,selIdx=-1){
  const box=$(boxSel);if(!box)return;
  if(!items||items.length<=1){box.innerHTML="";return}
  ACTIVE_GAL={gid:g.id,boxSel,items,idx:selIdx};
  const cur=selIdx>=0&&items[selIdx]?items[selIdx]:null;
  box.innerHTML=`<div class="galbox">
    <div class="row" style="justify-content:space-between;margin-bottom:4px">
      <span class="eyebrow" style="margin:0">Screenshots &amp; artwork (${items.length}) · tap to enlarge</span>
      <a class="link" style="font-size:12px" href="${esc(mobyCoversURL(g))}" target="_blank" rel="noopener">Back-of-box scans on MobyGames ↗</a>
    </div>
    <div class="galstrip" role="group" aria-label="Screenshots and artwork for ${esc(g.title)}">
      ${items.map((it,i)=>`<button type="button" class="galcard${it.box?" box":""}" data-act="galPick" data-i="${i}" data-box="${esc(boxSel)}" data-id="${esc(g.id)}" aria-pressed="${i===selIdx}">
        <span class="galthumb"><img src="${esc(it.thumb)}" alt="${esc(it.cap)}" loading="lazy" decoding="async"></span>
        <small>${esc(it.kind)}</small>
        <span>${esc(it.cap)}</span>
      </button>`).join("")}
    </div>
    ${cur?`<div class="galstage">
      <div class="galimgwrap"><img src="${esc(cur.src)}" alt="${esc(cur.cap)}" fetchpriority="high"></div>
      <div class="row" style="justify-content:space-between;margin-top:8px">
        <span style="font-size:12.5px;color:#CBD4E6"><b>${esc(cur.kind)}:</b> ${esc(cur.cap)}</span>
        <span class="row" style="gap:6px">
          <button type="button" class="btn sm" style="background:#1B2234;color:#EEF2FA;border-color:#323C54" data-act="galPick" data-i="${(selIdx-1+items.length)%items.length}" data-box="${esc(boxSel)}" data-id="${esc(g.id)}">◂ Prev</button>
          <button type="button" class="btn sm" style="background:#1B2234;color:#EEF2FA;border-color:#323C54" data-act="galPick" data-i="${(selIdx+1)%items.length}" data-box="${esc(boxSel)}" data-id="${esc(g.id)}">Next ▸</button>
          <button type="button" class="btn sm ghost" style="color:#AEB6C8" data-act="galPick" data-i="-1" data-box="${esc(boxSel)}" data-id="${esc(g.id)}">Close zoom</button>
        </span>
      </div>
    </div>`:""}
  </div>`;
}
function mountGameGallery(g,boxSel){
  const el=$(boxSel);if(!el||!g)return;
  if(GAL_CACHE.has(g.id)){drawGalleryBox(g,boxSel,GAL_CACHE.get(g.id),-1);return}
  el.innerHTML=`<div class="galbox"><span class="sync">Loading screenshots &amp; artwork…</span></div>`;
  fetchGameGallery(g).then(items=>{
    const live=$(boxSel);if(!live)return;
    drawGalleryBox(g,boxSel,items,-1);
  });
}
function openQuickLook(g){
  if(!g)return;
  const lv=levelOf(hist,g),py=entryYearOf(hist,g),ent=entryOf(hist,g),mtags=(ent&&ent.mtags)||[],ups=UP[g.i],downs=DOWN[g.i],directCross=directCrossLinks(g);
  const topUp=ups.slice().sort((a,b)=>TIERS[b.t].w-TIERS[a.t].w)[0];
  const ps=sysOfGame(g),stObj=findStudio(studio(g));
  const quickTags=["Carried me through","Made me sweat","Couch co-op","Shaped who I am"];
  openSheet(`<div class="sheethead"><div>
      <div class="row" style="gap:5px;margin-bottom:4px">${g.gen.length?g.gen.map(i=>`<button type="button" class="genpill" data-act="genre" data-g="${esc(GEN[i].k)}"><i style="width:7px;height:7px;border-radius:3px;background:${GEN[i].c};display:inline-block"></i>${esc(GEN[i].label)}</button>`).join(""):`<span class="eyebrow" style="margin:0">Game info</span>`}${statusBadgeHTML(g)}</div>
      <h2>${esc(g.title)}</h2>
    </div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="gsheet" style="align-items:start">${cover(g)}
      <div style="min-width:0">
        <p class="sub" style="margin:0 0 6px;display:flex;align-items:center;flex-wrap:wrap;gap:6px"><b class="mono">${g.year}${g.cancelled?" (cancelled)":""}</b> · ${studioLogoHTML(stObj)}<span>${flag(g.cc)} ${studioLinks(g.dev||"Unknown studio")}${g.cc?` · <button type="button" class="stbtn" data-act="country" data-cc="${esc(g.cc)}">${esc(countryName(g.cc))}</button>`:""}</span></p>
        ${!g.cancelled?`<p class="sub" style="margin:0 0 8px;font-size:12.5px">${esc(eraBoxContext(g))} · <button type="button" class="link" style="font-size:12px" data-act="goPrices">Compare era prices ▸</button></p>`:""}
        ${ps.length?`<p class="sub" style="margin:0 0 10px;font-size:12.5px"><b>${g.cancelled?"Target systems:":"Systems:"}</b> ${esc(ps.join(" · "))}</p>`:""}
        <p style="margin:0 0 10px;font-size:14.5px;line-height:1.5;color:var(--ink)">${esc(g.note||`${g.title} launched in ${g.year} from ${g.dev||"its development team"}.`)}</p>
        ${topUp?`<div class="diascard" style="margin:0 0 10px;padding:9px 12px"><small class="muted" style="display:block">Key lineage spark: <button type="button" class="link" style="font-size:inherit;font-weight:700" data-act="game" data-id="${G[topUp.from].id}" data-close="1">${esc(G[topUp.from].title)} (${G[topUp.from].year}) ▸</button></small><span style="font-size:13px"><b>Built on:</b> ${esc(topUp.took)} · <b>Added:</b> ${esc(topUp.added)}</span></div>`:""}
        ${g.tree?`<div class="gstats" style="margin:0 0 10px"><button type="button" class="gstatbtn" data-act="jumpPanel" data-id="${g.id}" data-dir="up" ${ups.length?"":"disabled"}>▲ Built on <b>${ups.length}</b> earlier</button><button type="button" class="gstatbtn" data-act="jumpPanel" data-id="${g.id}" data-dir="down" ${downs.length?"":"disabled"}>▼ Inspired <b>${directCross.length}</b> directly</button><button type="button" class="gstatbtn" data-act="reachSheet" data-id="${g.id}" data-dir="down" ${g.inf?"":"disabled"}><b>${g.inf.toLocaleString()}</b> across genres${g.inf?" ▸":""}</button></div>`:""}
        ${g.cancelled
          ?(isDevMode()?`<div class="mylv" style="margin-top:6px"><span class="sync">Unreleased — honored for its makers:</span><button type="button" class="btn sm ${isWorked(hist,g)?"craft":"primary"}" data-act="toggleWk" data-id="${g.id}" aria-pressed="${isWorked(hist,g)}">🛠 ${isWorked(hist,g)?"Worked on this ✓":"I worked on this"}</button></div>`:"")
          :playable(g)?`<div class="mylv" style="margin-top:6px"><span class="sync">${py?`On timeline (${py}):`:"Add to timeline:"}</span>
          <span class="seg" role="group" aria-label="In my timeline">${[1,2,3].map(v=>`<button type="button" class="${v===3?"l3":v===2?"l2":""}" data-act="qlSetLv" data-id="${g.id}" data-lv="${v}" aria-pressed="${lv===v}">${LV[v].m} ${v===1?"Played":v===2?"Played a ton":"Favorite"}</button>`).join("")}</span>
          ${lv?`<button type="button" class="btn sm ghost" data-act="qlSetLv" data-id="${g.id}" data-lv="0">Remove</button>`:""}
        </div>
        <div class="row" style="margin-top:8px;gap:6px"><span class="sync">Quick tag:</span>${quickTags.map(tg=>`<button type="button" class="chip" style="padding:3px 9px;font-size:12px" data-act="qlQuickTag" data-id="${g.id}" data-tag="${esc(tg)}" aria-pressed="${mtags.includes(tg)}">${esc(tg)}</button>`).join("")}</div>`:""}
        <div class="row" style="margin-top:12px">
          ${g.tree?`<button type="button" class="btn sm primary" data-act="game" data-id="${g.id}" data-close="1">Full family tree</button>`:""}
          <button type="button" class="btn sm${g.tree?"":" primary"}" data-act="watchTv" data-id="${g.id}">▶ Watch ${g.cancelled?"footage":"gameplay"}</button>
          <button type="button" class="btn sm love" data-act="gratSheet" data-id="${g.id}">Thank makers</button>
          ${ups.length?`<button type="button" class="btn sm" data-act="walk" data-id="${g.id}" data-close="1">Walk roots ▸</button>`:""}
          <a class="btn sm" href="${esc(mobyCoversURL(g))}" target="_blank" rel="noopener">Box-back scans ↗</a>
          <a class="btn sm ghost" href="${esc(mobyURL(g))}" target="_blank" rel="noopener">Credits ↗</a>
        </div>
        ${sellable(g)?`<div class="row" style="margin-top:8px"><span class="sync">Official stores:</span>${storeLinksHTML(g)}</div>`
          :g.sunset?`<p class="sub" style="margin:8px 0 0;font-size:12px">Official servers offline — preserved in player memory.</p>`:""}
      </div>
    </div>
    <div id="qlGalBox"></div>`,g.title,{wide:true});
  mountGameGallery(g,"#qlGalBox");
}
let panelScrollToken=0,panelFlashTimer=null;
function scrollIntoViewAsync(element,options,scroller=window){
  const result=element.scrollIntoView(options);
  if(result instanceof Promise)return result;
  return new Promise(resolve=>{
    let timeoutId;
    const finish=()=>{
      clearTimeout(timeoutId);
      scroller.removeEventListener("scrollend",finish);
      scroller.removeEventListener("scroll",onScroll);
      resolve();
    };
    const onScroll=()=>{
      clearTimeout(timeoutId);
      timeoutId=setTimeout(finish,110);
    };
    scroller.addEventListener("scrollend",finish,{once:true});
    scroller.addEventListener("scroll",onScroll,{passive:true});
    timeoutId=setTimeout(finish,110);
  });
}
async function jumpToPanel(dir,gid){
  let sec=$(`#panel-${dir}`);
  const curId=(state.route&&(state.route.id||state.linId))||"";
  if(!sec||(gid&&curId&&gid!==curId)||($("#sheetDlg")&&$("#sheetDlg").open)){
    if($("#sheetDlg")&&$("#sheetDlg").open)clearLayer();
    if(gid&&state.route.view!=="game"&&state.route.view!=="tree")go(gid);
    else if(gid&&gid!==curId)go(gid);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    sec=$(`#panel-${dir}`);
  }
  if(!sec)return;
  const tok=++panelScrollToken;
  $$(".panel.flash").forEach(p=>p.classList.remove("flash"));
  await scrollIntoViewAsync(sec,{behavior:"smooth",block:"start"});
  if(tok!==panelScrollToken)return;
  sec.classList.add("flash");
  clearTimeout(panelFlashTimer);
  panelFlashTimer=setTimeout(()=>sec.classList.remove("flash"),1500);
  const h2=sec.querySelector("h2");
  if(h2)h2.focus({preventScroll:true});
}
const REACH_STATE={gid:"",dir:"down",step:"all",q:"",cap:48};
function computeReachList(g,dir="down"){
  if(dir==="up"){
    const seen=new Map([[g.i,0]]),out=[],q=[g.i];
    while(q.length){
      const u=q.shift(),d=seen.get(u);
      for(const l of UP[u]){
        const v=l.from;
        if(!seen.has(v)){seen.set(v,d+1);out.push({g:G[v],steps:d+1,via:G[u],tier:TIERS[l.t]});q.push(v)}
      }
    }
    out.sort((a,b)=>a.steps-b.steps||b.g.year-a.g.year||b.g.pop-a.g.pop);
    return out;
  }
  /* 2-state cross-series reach matching g.inf (excludes pure same-series sequel chains) */
  const best=new Map(),seen=new Set([g.i+":0",g.i+":1"]),q=[[g.i,0,0,null,null]];
  while(q.length){
    const [u,crossed,steps]=q.shift();
    for(const l of DOWN[u]){
      if(l.minor||l.tier==="disp")continue;
      const v=l.to,nc=(crossed||(l.tier!=="series"?1:0));
      const key=v+":"+nc;
      if(seen.has(key))continue;
      seen.add(key);
      if(nc===1&&!best.has(v))best.set(v,{g:G[v],steps:steps+1,via:G[u],tier:TIERS[l.t]});
      q.push([v,nc,steps+1]);
    }
  }
  const out=[...best.values()];
  out.sort((a,b)=>a.steps-b.steps||a.g.year-b.g.year||b.g.pop-a.g.pop);
  return out;
}
function openReachSheet(g,dir="down",reset=true){
  if(!g)return;
  if(reset){REACH_STATE.gid=g.id;REACH_STATE.dir=dir;REACH_STATE.step="all";REACH_STATE.q="";REACH_STATE.cap=48}
  const all=computeReachList(g,REACH_STATE.dir);
  const c1=all.filter(x=>x.steps===1).length,c2=all.filter(x=>x.steps===2).length,c3=all.filter(x=>x.steps>=3).length;
  const isUp=REACH_STATE.dir==="up";
  openSheet(`<div class="sheethead"><div>
      <p class="eyebrow" style="margin-bottom:2px">${isUp?"▲ Full upstream ancestry":"Downstream ripple across genres"} · ${all.length.toLocaleString()} ${all.length===1?"game":"games"}</p>
      <h2>${isUp?`Every earlier game behind ${esc(g.title)}`:`Cross-genre ripple from ${esc(g.title)}`}</h2>
      <p class="sub" style="margin:2px 0 0">${esc(g.title)} (${g.year}) ${isUp?`stands on <b>${all.length.toLocaleString()}</b> documented earlier works`:`helped shape <b>${all.length.toLocaleString()}</b> later games beyond its own sequel line`}.</p>
    </div><button class="x" type="button" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="row" style="gap:6px;margin-bottom:10px;justify-content:space-between">
      <div class="pickstrip" style="padding:0;gap:5px">
        <button type="button" class="chip" data-act="reachStep" data-s="all" aria-pressed="${REACH_STATE.step==="all"}">All (${all.length})</button>
        ${c1?`<button type="button" class="chip" data-act="reachStep" data-s="1" aria-pressed="${REACH_STATE.step==="1"}">Direct · 1 step (${c1})</button>`:""}
        ${c2?`<button type="button" class="chip" data-act="reachStep" data-s="2" aria-pressed="${REACH_STATE.step==="2"}">2 steps (${c2})</button>`:""}
        ${c3?`<button type="button" class="chip" data-act="reachStep" data-s="3+" aria-pressed="${REACH_STATE.step==="3+"}">3+ steps (${c3})</button>`:""}
      </div>
      ${all.length>12?`<input class="input" id="reachQIn" type="search" style="max-width:240px;padding:6px 10px;font-size:16px" placeholder="Filter ${all.length} games…" value="${esc(REACH_STATE.q)}" aria-label="Filter games in reach list">`:""}
    </div>
    <div id="reachGridWrap"></div>`,isUp?`Roots of ${g.title}`:`Downstream ripple of ${g.title}`,{wide:true});
  const drawGrid=()=>{
    const wrap=$("#reachGridWrap");if(!wrap)return;
    const qv=norm(REACH_STATE.q);
    const filt=all.filter(x=>{
      if(REACH_STATE.step==="1"&&x.steps!==1)return false;
      if(REACH_STATE.step==="2"&&x.steps!==2)return false;
      if(REACH_STATE.step==="3+"&&x.steps<3)return false;
      if(qv&&!x.g.n.includes(qv)&&!(x.g.aka&&norm(x.g.aka).includes(qv))&&!norm(studio(x.g)).includes(qv))return false;
      return true;
    });
    const slice=filt.slice(0,REACH_STATE.cap);
    wrap.innerHTML=slice.length
      ?`<div class="grid">${slice.map(x=>tileHTML(x.g,hist,{act:"reachOpenGame",sub:`${x.g.year} · ${x.steps===1?"direct":x.steps+" steps via "+x.via.title}`,quickTick:true})).join("")}</div>
        ${filt.length>slice.length?`<button type="button" class="more" style="margin-top:12px;text-align:center" data-act="reachMore"><b>Show ${Math.min(48,filt.length-slice.length)} more</b> (${filt.length-slice.length} remaining)</button>`:""}`
      :`<p class="empty">No matching games in this filter.</p>`;
  };
  drawGrid();
  const inp=$("#reachQIn");
  if(inp)inp.addEventListener("input",()=>{REACH_STATE.q=inp.value;REACH_STATE.cap=48;drawGrid()});
}

/* ---------- 12-wedge circular Lucky Wheel + ball-top spring pull-arm ---------- */
const WHEEL_PALETTE=[
  ["#1D4E89","#EEF4FF"],["#2A6F6E","#ECFEFF"],["#8B3A2B","#FFF3EE"],["#4A3F7A","#F3F0FF"],
  ["#2F5D50","#ECFDF5"],["#7C4D1E","#FFF8EB"],["#1E3A5F","#EFF6FF"],["#6D2E46","#FDF2F8"],
  ["#27536B","#F0F9FF"],["#6B4C35","#FEFCE8"],["#364156","#F1F5F9"],["#7A2E2E","#FEF2F2"]
];
function wheelPool(filter){
  if(filter==="childhood"){
    const win=formativeWindow(hist);
    const strong=TREE.filter(g=>isVideoGame(g)&&playable(g)&&!g.cancelled&&g.img&&(g.inf>=10||g.pop>=4)&&g.year>=win.from&&g.year<=win.to);
    if(strong.length>=12)return strong;
    const sub=TREE.filter(g=>isVideoGame(g)&&playable(g)&&!g.cancelled&&g.img&&g.pop>=3&&g.year>=win.from&&g.year<=win.to);
    if(sub.length>=12)return sub;
  }
  const strongAll=TREE.filter(g=>isVideoGame(g)&&playable(g)&&!g.cancelled&&g.img&&(g.inf>=10||g.pop>=4));
  return strongAll.length>=12?strongAll:TREE.filter(g=>isVideoGame(g)&&playable(g)&&!g.cancelled&&g.pop>=3);
}
function sampleWheel12(filter){
  const pool=shuffle(wheelPool(filter).slice());
  const picked=[],usedGen=new Map();
  for(let pass=0;pass<2&&picked.length<12;pass++){
    for(const g of pool){
      if(picked.length>=12)break;
      if(picked.includes(g))continue;
      const gk=g.gen[0]??-1,c=usedGen.get(gk)||0;
      if(pass===0&&c>=2)continue;
      picked.push(g);usedGen.set(gk,c+1);
    }
  }
  return picked.slice(0,12);
}
function openLuckyWheel(){
  const filt=state.wheelFilter==="childhood"?"childhood":"all";
  const games=sampleWheel12(filt);
  const eraHint=formativeWindow(hist).label;
  openSheet(`<div class="sheethead"><div>
      <p class="eyebrow" style="margin-bottom:2px">12-wedge discovery wheel</p>
      <h2>Feeling lucky</h2>
    </div><button class="x" type="button" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="row" style="justify-content:space-between;gap:8px;margin-bottom:4px">
      <span class="seg" role="group" aria-label="Era filter">
        <button type="button" data-act="wheelFilter" data-f="all" aria-pressed="${filt==="all"}">All eras</button>
        <button type="button" data-act="wheelFilter" data-f="childhood" aria-pressed="${filt==="childhood"}">My childhood</button>
      </span>
      <button type="button" class="btn sm" data-act="wheelRefresh">Fresh 12 games</button>
    </div>
    <p class="sync" style="margin:0 0 6px">${filt==="childhood"?esc(eraHint)+" · ":""}Pull the spring lever down (or tap it / press Space) to spin.</p>
    <div class="wheel-stage">
      <div class="wheel-wrap"><canvas id="wheelCanvas" class="wheel-canvas" width="500" height="500" role="img" aria-label="12-wedge Lucky Wheel of video games"></canvas></div>
      <div class="lever-rig">
        <div class="lever-housing" id="leverHousing" title="Drag down to tension & release, or tap to yank">
          <div class="lever-slot" aria-hidden="true"></div>
          <div class="lever-base" aria-hidden="true"></div>
          <div class="lever-arm" id="leverArm" aria-hidden="true"></div>
          <button type="button" class="lever-knob" id="leverKnob" aria-label="Pull lever down or press Space to spin the Lucky Wheel"></button>
        </div>
        <span class="lever-hint" id="leverHint">Pull or Space</span>
      </div>
    </div>
    <div id="wheelWinBox" aria-live="polite"></div>`,"Feeling lucky",{wide:true});

  const cv=$("#wheelCanvas"),housing=$("#leverHousing"),knob=$("#leverKnob"),arm=$("#leverArm"),meter=$("#leverMeter"),hint=$("#leverHint"),winBox=$("#wheelWinBox");
  if(!cv||!housing||!knob)return;
  const ctx=cv.getContext("2d");
  const N=games.length||12,SLICE=(Math.PI*2)/N,CONTACT=0.098;
  const reduced=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const WSTATE={
    games,theta:Math.random()*Math.PI*2,omega:0,spinning:false,settledIdx:-1,
    flapper:0,flapperV:0,lastPegIdx:-1,stillTime:0,
    pull:0,pullV:0,pulling:false,autoYank:null,
    raf:0,lastT:0,keyFn:null
  };
  WHEEL=WSTATE;

  const sizeCanvas=()=>{
    const r=cv.getBoundingClientRect();
    const s=Math.max(240,Math.round(r.width||360)),dpr=Math.min(2,window.devicePixelRatio||1);
    if(cv.width!==s*dpr||cv.height!==s*dpr){cv.width=s*dpr;cv.height=s*dpr}
    return {s,dpr};
  };
  const wedgeInfo=th=>{
    const rel=(((-Math.PI/2-th)%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    const idx=Math.floor(rel/SLICE)%N;
    const phase=rel-idx*SLICE;
    const dPeg=phase<SLICE/2?phase:phase-SLICE;
    const pegIdx=Math.round(rel/SLICE)%N;
    return {idx,phase,dPeg,pegIdx};
  };
  const renderLever=()=>{
    const travel=housing.clientHeight?housing.clientHeight-74:112;
    const yOff=WSTATE.pull*travel;
    knob.style.transform=`translate(-50%,${yOff.toFixed(1)}px)`;
    if(arm){
      const mid=travel*0.5;
      const dy=yOff-mid;
      const len=Math.max(12,Math.abs(dy)+12);
      arm.style.height=len.toFixed(1)+"px";
      arm.style.transform=dy<0?`translate(-50%,${(-len).toFixed(1)}px)`:`translate(-50%,0px)`;
    }
    if(meter)meter.style.width=Math.round(Math.max(0,Math.min(1,WSTATE.pull))*100)+"%";
  };
  const drawWheel=()=>{
    const {s,dpr}=sizeCanvas();
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,s,s);
    const cx=s/2,cy=s/2+8,R=s*0.435;
    /* subtle drop shadow */
    ctx.save();
    ctx.beginPath();ctx.arc(cx,cy+3,R+8,0,Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,.22)";ctx.fill();
    /* outer brass/dark bezel */
    const rimGrad=ctx.createRadialGradient(cx-R*0.25,cy-R*0.25,R*0.85,cx,cy,R+9);
    rimGrad.addColorStop(0,"#3A4358");rimGrad.addColorStop(0.78,"#181E2C");rimGrad.addColorStop(1,"#0D111A");
    ctx.beginPath();ctx.arc(cx,cy,R+8,0,Math.PI*2);ctx.fillStyle=rimGrad;ctx.fill();
    ctx.strokeStyle="#C9A24B";ctx.lineWidth=2;ctx.stroke();

    /* rotating wheel */
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(WSTATE.theta);
    const hubR=Math.max(20,R*0.14);
    const titleMaxW=Math.max(58,R-hubR-24);
    const fitWheelText=(txt,maxW)=>{
      if(ctx.measureText(txt).width<=maxW)return txt;
      let t=txt;
      while(t.length>3&&ctx.measureText(t+"…").width>maxW)t=t.slice(0,-1);
      return t.trimEnd()+"…";
    };
    for(let i=0;i<N;i++){
      const a0=i*SLICE,a1=a0+SLICE,mid=a0+SLICE/2,g=games[i];
      const [bg,fg]=WHEEL_PALETTE[i%WHEEL_PALETTE.length];
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,a0,a1);ctx.closePath();
      ctx.fillStyle=WSTATE.settledIdx===i?"#C7513D":bg;
      ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,.16)";ctx.lineWidth=1;ctx.stroke();
      /* Always-upright radial title (flip left hemisphere so zero upside-down labels) */
      ctx.save();
      ctx.rotate(mid);
      const wa=WSTATE.theta+mid;
      const flip=Math.cos(wa)<0;
      if(flip)ctx.rotate(Math.PI);
      ctx.textBaseline="middle";
      const fs=Math.max(10.5,Math.min(14.5,R*0.072));
      ctx.fillStyle=WSTATE.settledIdx===i?"#FFFFFF":fg;
      ctx.font=`700 ${fs}px IBM Plex Sans, system-ui, sans-serif`;
      const lbl=fitWheelText(g?g.title:"",titleMaxW);
      if(flip){
        ctx.textAlign="left";
        ctx.fillText(lbl,-(R-15),0);
      }else{
        ctx.textAlign="right";
        ctx.fillText(lbl,R-15,0);
      }
      ctx.restore();
    }
    /* 12 brass rim pegs every 30° */
    for(let i=0;i<N;i++){
      const a=i*SLICE,px=Math.cos(a)*(R-3),py=Math.sin(a)*(R-3);
      ctx.beginPath();ctx.arc(px,py,Math.max(3.2,R*0.025),0,Math.PI*2);
      const pg=ctx.createRadialGradient(px-1.2,py-1.2,0.5,px,py,4.5);
      pg.addColorStop(0,"#FFF4C4");pg.addColorStop(0.55,"#D6A546");pg.addColorStop(1,"#7A5414");
      ctx.fillStyle=pg;ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,.45)";ctx.lineWidth=0.8;ctx.stroke();
    }
    /* center hub */
    const hg=ctx.createRadialGradient(-hubR*0.3,-hubR*0.3,2,0,0,hubR);
    hg.addColorStop(0,"#F4D37E");hg.addColorStop(0.55,"#B8872F");hg.addColorStop(1,"#5A3E0F");
    ctx.beginPath();ctx.arc(0,0,hubR,0,Math.PI*2);ctx.fillStyle=hg;ctx.fill();
    ctx.strokeStyle="#141824";ctx.lineWidth=2.5;ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,hubR*0.42,0,Math.PI*2);ctx.fillStyle="#141824";ctx.fill();
    ctx.restore();

    /* top 12-o'clock flexible rubber flapper */
    const fx=cx,fy=cy-R-11;
    ctx.save();
    ctx.translate(fx,fy);
    ctx.rotate(WSTATE.flapper);
    ctx.beginPath();
    ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.lineTo(2.4,24);ctx.quadraticCurveTo(0,28,-2.4,24);ctx.closePath();
    ctx.fillStyle="#E14734";ctx.fill();
    ctx.strokeStyle="#7D180E";ctx.lineWidth=1.4;ctx.stroke();
    /* mounting pin */
    ctx.beginPath();ctx.arc(0,0,5.5,0,Math.PI*2);ctx.fillStyle="#E2E8F0";ctx.fill();
    ctx.strokeStyle="#334155";ctx.lineWidth=1.4;ctx.stroke();
    ctx.restore();
    ctx.restore();
  };
  const showWinner=idx=>{
    WSTATE.settledIdx=idx;
    drawWheel();
    const g=games[idx];if(!g||!winBox)return;
    const lv=levelOf(hist,g),dc=directCrossLinks(g).length,upC=(UP[g.i]||[]).length,genObj=genreOf(g);
    const infBit=dc>0?` · Inspired <b>${dc}</b> directly${g.inf?` · <b>${g.inf.toLocaleString()}</b> across genres`:""}`:(g.inf>0?` · <b>${plural(g.inf,"downstream game")}</b>`:(upC>0?` · Built on <b>${plural(upC,"earlier game")}</b>`:(genObj?` · ${esc(genObj.label)}`:"")));
    playBlip(2);
    winBox.innerHTML=`<div class="wheel-win">
      <div class="gsheet">${cover(g)}
        <div style="min-width:0">
          <span class="eyebrow" style="margin:0 0 2px">Winner · ${g.year}</span>
          <h3 class="h2" style="margin:0 0 4px">${esc(g.title)}</h3>
          <p class="sub" style="margin:0 0 8px">${flag(g.cc)} ${studioLinks(g.dev||"")}${infBit}</p>
          ${g.note?`<p style="margin:0 0 12px;font-size:13.8px;color:var(--ink2)">${esc(g.note)}</p>`:""}
          <div class="row" style="gap:6px">
            <button type="button" class="btn sm primary" data-act="game" data-id="${g.id}" data-close="1">Family tree</button>
            <button type="button" class="btn sm" data-act="watchTv" data-id="${g.id}">▶ Watch gameplay</button>
            <button type="button" class="btn sm${lv?" primary":""}" data-act="qtick" data-id="${g.id}" aria-pressed="${lv>0}">${lv?`${LV[lv].m} ${LV[lv].label}`:"+ Played"}</button>
            <button type="button" class="btn sm" id="wheelSpinAgain">Spin again</button>
          </div>
        </div>
      </div>
    </div>`;
    const again=$("#wheelSpinAgain");
    if(again)again.addEventListener("click",()=>triggerAutoYank());
    try{winBox.scrollIntoView({behavior:prefersReducedMotion()?"auto":"smooth",block:"nearest"})}catch(e){}
    announceSR(`Lucky Wheel landed on ${g.title}, ${g.year}`);
  };
  const ensureLoop=()=>{if(WHEEL===WSTATE&&!WSTATE.raf){WSTATE.lastT=0;WSTATE.raf=requestAnimationFrame(tick)}};
  const launchWithPull=p=>{
    if(WSTATE.spinning)return;
    WSTATE.settledIdx=-1;
    if(winBox)winBox.innerHTML="";
    if(reduced){
      const idx=Math.floor(Math.random()*N);
      WSTATE.theta=-Math.PI/2-(idx+0.5)*SLICE;
      WSTATE.pull=0;renderLever();showWinner(idx);return;
    }
    WSTATE.spinning=true;WSTATE.stillTime=0;
    WSTATE.omega=8.6+Math.max(0.2,p)*14.8+Math.random()*2.6;
    WSTATE.lastPegIdx=wedgeInfo(WSTATE.theta).pegIdx;
    if(hint)hint.textContent="Spinning…";
    ensureLoop();
  };
  const triggerAutoYank=()=>{
    if(WSTATE.spinning||WSTATE.pulling)return;
    if(reduced){launchWithPull(0.8);return}
    WSTATE.autoYank={t:0,target:0.78+Math.random()*0.18,phase:"down"};
    ensureLoop();
  };

  /* spring pull-arm pointer capture */
  let dragId=null,startY=0,didTick35=false,didTick75=false,lastUpAt=0;
  const onDown=e=>{
    if(e.button&&e.button!==0)return;
    if(WSTATE.spinning)return;
    dragId=e.pointerId;startY=e.clientY;WSTATE.pulling=true;WSTATE.autoYank=null;didTick35=false;didTick75=false;
    housing.classList.add("pulling");
    try{housing.setPointerCapture(dragId)}catch(_){}
  };
  const onMove=e=>{
    if(e.pointerId!==dragId||!WSTATE.pulling)return;
    const travel=Math.max(84,(housing.clientHeight||196)-74);
    const p=Math.max(0,Math.min(1,(e.clientY-startY)/travel));
    WSTATE.pull=p;renderLever();
    if(p>=0.35&&!didTick35){didTick35=true;playWheelTick(0.35,true)}
    if(p>=0.75&&!didTick75){didTick75=true;playWheelTick(0.65)}
  };
  const onUp=e=>{
    if(e.pointerId!==dragId)return;
    dragId=null;WSTATE.pulling=false;housing.classList.remove("pulling");lastUpAt=Date.now();
    const p=WSTATE.pull;
    if(p>=0.14){launchWithPull(p)}
    else{triggerAutoYank()}
    ensureLoop();
  };
  housing.addEventListener("pointerdown",onDown);
  housing.addEventListener("pointermove",onMove);
  housing.addEventListener("pointerup",onUp);
  knob.addEventListener("click",()=>{if(Date.now()-lastUpAt>300&&!WSTATE.spinning&&!WSTATE.pulling&&!WSTATE.autoYank)triggerAutoYank()});
  housing.addEventListener("pointercancel",()=>{dragId=null;WSTATE.pulling=false;housing.classList.remove("pulling");ensureLoop()});
  knob.addEventListener("keydown",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();triggerAutoYank()}});
  WSTATE.keyFn=e=>{
    if(e.key===" "&&$("#sheetDlg")&&$("#sheetDlg").open&&!e.target.closest("input,textarea,button:not(#leverKnob)")){
      e.preventDefault();triggerAutoYank();
    }
  };
  document.addEventListener("keydown",WSTATE.keyFn);

  /* demand-driven rAF physics loop: lever spring return + peg-flapper barrier torque + rock-back settle (0% idle CPU) */
  const tick=now=>{
    WSTATE.raf=0;
    if(WHEEL!==WSTATE)return;
    const dt=Math.min(0.032,Math.max(0.004,(now-(WSTATE.lastT||now))/1000));
    WSTATE.lastT=now;
    let wheelDirty=false;
    /* auto-yank pull animation */
    if(WSTATE.autoYank){
      WSTATE.autoYank.t+=dt;
      const frac=Math.min(1,WSTATE.autoYank.t/0.16);
      WSTATE.pull=WSTATE.autoYank.target*(1-Math.pow(1-frac,2));
      if(frac>=1){const p=WSTATE.pull;WSTATE.autoYank=null;launchWithPull(p)}
      renderLever();
    }else if(!WSTATE.pulling&&(WSTATE.pull>0.001||Math.abs(WSTATE.pullV)>0.01)){
      /* damped spring return */
      const acc=-240*WSTATE.pull-19*WSTATE.pullV;
      WSTATE.pullV+=acc*dt;WSTATE.pull+=WSTATE.pullV*dt;
      if(WSTATE.pull<0){WSTATE.pull=0;WSTATE.pullV*=-0.32}
      if(Math.abs(WSTATE.pull)<0.002&&Math.abs(WSTATE.pullV)<0.02){WSTATE.pull=0;WSTATE.pullV=0}
      renderLever();
    }
    /* wheel & peg-flapper physics */
    if(WSTATE.spinning){
      wheelDirty=true;
      const subSteps=4,h=dt/subSteps;
      for(let s=0;s<subSteps;s++){
        const info=wedgeInfo(WSTATE.theta);
        const ad=Math.abs(info.dPeg);
        let alpha=-0.42*WSTATE.omega-(WSTATE.omega>0?0.36:WSTATE.omega<0?-0.36:0);
        if(ad<CONTACT){
          /* barrier potential torque: climbs peg (dPeg>0 -> resists/rocks back), clears peg (dPeg<0 -> pushes forward) */
          const q=info.dPeg/CONTACT;
          const kBarrier=Math.abs(WSTATE.omega)<3.8?4.6:2.2;
          alpha+=-kBarrier*Math.sin(q*Math.PI);
          /* extra rubber contact damping */
          alpha+=-0.95*WSTATE.omega*(1-ad/CONTACT);
        }
        const prevTheta=WSTATE.theta;
        WSTATE.omega+=alpha*h;
        WSTATE.theta+=WSTATE.omega*h;
        /* exact slice-boundary peg crossing detection (never drops ticks even at 30fps) */
        const prevSlot=Math.floor((-Math.PI/2-prevTheta)/SLICE);
        const nextSlot=Math.floor((-Math.PI/2-WSTATE.theta)/SLICE);
        if(prevSlot!==nextSlot){
          const spd=Math.abs(WSTATE.omega);
          if(spd>0.28){
            playWheelTick(Math.min(1,spd/12));
            if(spd<4.5&&navigator.vibrate)try{navigator.vibrate(5)}catch(_){}
            WSTATE.omega*=spd>3?0.972:0.93;
            /* snap-back flick when peg slips past rubber tip */
            WSTATE.flapperV+=(WSTATE.omega>=0?1:-1)*Math.min(8,2.5+spd*0.45);
          }
        }
        /* knife-edge guard: never balance dead-on a peg crest; rock back cleanly */
        const nInfo=wedgeInfo(WSTATE.theta);
        if(Math.abs(nInfo.dPeg)<0.012&&Math.abs(WSTATE.omega)<0.12){
          WSTATE.omega=-0.34;
        }
      }
      /* flexible rubber flapper target angle (up to ~26° = 0.454 rad):
         clockwise wheel (omega>0) pushes hanging flapper tip RIGHT -> negative Canvas rotation */
      const cur=wedgeInfo(WSTATE.theta),ad=Math.abs(cur.dPeg);
      let targetFlap=0;
      if(ad<CONTACT){
        const bend=(1-ad/CONTACT)*0.454;
        targetFlap=WSTATE.omega>=0?-bend:bend*0.75;
      }
      const fAcc=(targetFlap-WSTATE.flapper)*360-WSTATE.flapperV*22;
      WSTATE.flapperV+=fAcc*dt;
      WSTATE.flapper=Math.max(-0.46,Math.min(0.46,WSTATE.flapper+WSTATE.flapperV*dt));

      /* check settle (outside peg crest & near-zero angular speed) */
      if(Math.abs(WSTATE.omega)<0.045&&ad>CONTACT*0.42){
        WSTATE.stillTime+=dt;
        if(WSTATE.stillTime>0.26){
          WSTATE.spinning=false;WSTATE.omega=0;
          if(hint)hint.innerHTML="Pull or<br>Space";
          showWinner(cur.idx);
        }
      }else{
        WSTATE.stillTime=0;
      }
    }else if(Math.abs(WSTATE.flapper)>0.002||Math.abs(WSTATE.flapperV)>0.01){
      wheelDirty=true;
      const fAcc=-WSTATE.flapper*320-WSTATE.flapperV*20;
      WSTATE.flapperV+=fAcc*dt;WSTATE.flapper+=WSTATE.flapperV*dt;
      if(Math.abs(WSTATE.flapper)<0.002&&Math.abs(WSTATE.flapperV)<0.01){WSTATE.flapper=0;WSTATE.flapperV=0}
    }
    if(wheelDirty)drawWheel();
    const active=WSTATE.spinning||WSTATE.pulling||!!WSTATE.autoYank||WSTATE.pull>0.001||Math.abs(WSTATE.pullV)>0.01||Math.abs(WSTATE.flapper)>0.002||Math.abs(WSTATE.flapperV)>0.01;
    if(active)WSTATE.raf=requestAnimationFrame(tick);
    else WSTATE.lastT=0;
  };
  WSTATE.resizeFn=()=>{if(WHEEL===WSTATE){renderLever();drawWheel()}};
  addEventListener("resize",WSTATE.resizeFn);
  renderLever();
  drawWheel();
}

function openGameSheet(y,t,ro){
  const p=(ro?state.viewing&&state.viewing.data.years[y]:hist.years[y])||[];const e=p.find(x=>norm(x.t)===norm(t));if(!e)return;
  const g=findGameY(e.t,e.y||y),lv=lvOf(e),d=ro?state.viewing.data:hist,sys=sysListOf(e,d);
  const plats=g?sysOfGame(g):[];
  const mtags=e.mtags||[];
  const wy=e.wy||y;
  const wkType=e.wkType||"";
  const presets=[];
  if(!ro&&d.birth){
    if(g&&g.year>=1950)presets.push([g.year,`Release (${g.year})`]);
    for(const ag of [6,9,12,15,18,22,28]){const py=d.birth+ag;if(py<=NOW&&(!g||py>=g.year)&&!presets.some(x=>x[0]===py))presets.push([py,`Age ${ag} (${py})`])}
  }
  openSheet(`<div class="sheethead"><h2>${esc(g?g.title:e.t)}</h2><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="gsheet">${coverOfEntry(e,y)}<div style="min-width:0">
      <p class="sub" style="margin:0 0 8px">Played in <b>${y}</b>${e.wk&&wy!==y?` · Worked on in <b>${wy}</b>`:""}${d.birth?` (${y-d.birth>=0?"age "+(y-d.birth):(-y+d.birth)+" yrs before birth"})`:""}${g&&g.year!==y?` · first released ${g.year}`:""}${g?` · ${flag(g.cc)} ${studioLinks(g.dev||"")}`:""}</p>
      ${ro?`${e.wk?`<p style="margin:0 0 8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="pill craft">🛠 ${wkType==="mod"?"Mod / Map":wkType==="unshipped"?"Unshipped":"Worked on it"}${e.role?" · "+esc(e.role):""}${wy?` · ${wy}`:""}</span><span class="sr-badge">Self-reported</span>${g?`<a class="link" style="font-size:12px" href="${esc(mobyURL(g))}" target="_blank" rel="noopener">MobyGames credits ↗</a>`:""}</p>`:""}
        <p style="margin:0 0 10px"><b>${LV[lv].m} ${LV[lv].label}</b>${sys.length?" on "+esc(sys.join(", ")):""}</p>
        ${mtags.length?`<div class="row" style="margin:6px 0">${mtags.map(tg=>`<span class="pill">${esc(tg)}</span>`).join("")}</div>`:""}
        ${e.mem?`<p class="memquote">“${esc(e.mem)}”</p>`:""}`:
      `<div class="seg" role="group" aria-label="How much you played">${[1,2,3].map(v=>`<button class="${v===3?"l3":v===2?"l2":""}" data-act="entryLv" data-y="${y}" data-t="${esc(e.t)}" data-lv="${v}" aria-pressed="${lv===v}">${LV[v].m} ${v===1?"Played":v===2?"Played a ton":"Favorite"}</button>`).join("")}</div>
       ${isDevMode()||e.wk?`<div class="row" style="margin-top:10px;gap:6px"><button type="button" class="chip craftchip" data-act="entryWk" data-y="${y}" data-t="${esc(e.t)}" aria-pressed="${!!e.wk}">🛠 ${e.wk?"Worked on this game ✓":"I worked on this game"}</button>${e.wk?`<span class="sr-badge">Self-reported</span>`:""}</div>
       ${e.wk?`<div class="row" style="margin-top:8px;gap:5px"><span class="sync">Credit type:</span>${[["","Shipped / Studio"],["mod","Mod / Map"],["unshipped","Unshipped"]].map(([k,lbl])=>`<button type="button" class="chip craftchip" data-act="entryWkType" data-y="${y}" data-t="${esc(e.t)}" data-wt="${k}" aria-pressed="${wkType===k}">${lbl}</button>`).join("")}</div>
         <div class="row" style="margin-top:8px;gap:5px">${DEV_ROLES.map(r=>`<button type="button" class="chip craftchip" data-act="entryRole" data-y="${y}" data-t="${esc(e.t)}" data-role="${esc(r)}" aria-pressed="${e.role===r}">${esc(r)}</button>`).join("")}</div>
         <div class="row" style="margin-top:8px;gap:6px"><span class="sync">Worked year (live-ops / studio):</span><input class="input" id="entryWyIn" inputmode="numeric" maxlength="4" value="${wy}" style="width:82px;padding:5px 9px;font-size:16px" aria-label="Year worked on this game"><button type="button" class="btn sm craft" data-act="entryWyGo" data-y="${y}" data-t="${esc(e.t)}">Set</button>${g?`<a class="link" style="font-size:12px" href="${esc(mobyURL(g))}" target="_blank" rel="noopener">MobyGames credits ↗</a>`:""}</div>`:""}`:""}
       <p class="sub" style="margin:12px 0 6px">Year played on timeline</p>
       <div class="row">${presets.slice(0,6).map(([py,lbl])=>`<button type="button" class="chip" data-act="entryYr" data-y="${y}" data-t="${esc(e.t)}" data-to="${py}" aria-pressed="${py===y}">${esc(lbl)}</button>`).join("")}
         <input class="input" id="entryYrIn" inputmode="numeric" maxlength="4" value="${y}" style="width:82px;padding:5px 9px;font-size:16px" aria-label="Year played"><button type="button" class="btn sm" data-act="entryYrGo" data-y="${y}" data-t="${esc(e.t)}">Move</button></div>
       ${plats.length?`<p class="sub" style="margin:12px 0 6px">Played on</p><div class="row">${plats.map(n=>`<button class="chip" data-act="entrySys" data-y="${y}" data-t="${esc(e.t)}" data-sys="${esc(n)}" aria-pressed="${sys.includes(n)}">${esc(n)}</button>`).join("")}</div>`:""}
       <p class="sub" style="margin:12px 0 6px">Memories &amp; tags</p>
       <div class="row">${UI_MEM_TAGS.map(tg=>`<button type="button" class="chip" data-act="entryTag" data-y="${y}" data-t="${esc(e.t)}" data-tag="${esc(tg)}" aria-pressed="${mtags.includes(tg)}">${esc(tg)}</button>`).join("")}</div>
       <form class="row" id="memForm" style="margin-top:8px"><input class="input" id="memIn" maxlength="80" style="flex:1;min-width:0;padding:7px 10px;font-size:16px" placeholder="Short memory, e.g. Summer '98 in the basement" value="${esc(e.mem||"")}" aria-label="Short memory"><button class="btn sm" type="submit">Save note</button></form>`}
      <div class="row" style="margin-top:14px">${g?`<button class="btn sm primary" data-act="game" data-id="${g.id}" data-close="1">Family tree</button><button class="btn sm" data-act="quickLook" data-id="${g.id}">Game info</button><button class="btn sm" data-act="watchTv" data-id="${g.id}">▶ Watch gameplay</button><button class="btn sm love" data-act="gratSheet" data-id="${g.id}">Thank makers</button><button class="btn sm" data-act="walk" data-id="${g.id}" data-close="1">Walk roots</button>`:""}${ro?"":`<button class="btn sm ghost" data-act="entryRm" data-y="${y}" data-t="${esc(e.t)}">Remove</button>`}</div>
      ${g&&playable(g)?`<div class="row" style="margin-top:8px"><span class="sync">Official stores:</span>${storeLinksHTML(g)}</div>`:""}
    </div></div>`,"Game");
  const mf=$("#memForm");if(mf)mf.onsubmit=ev=>{ev.preventDefault();const v=$("#memIn").value.trim().slice(0,80);if(v)e.mem=v;else delete e.mem;save();toast(v?"Note saved":"Note cleared");closeLayer()};
}
function extractYtId(s){
  const v=String(s||"").trim();
  if(/^[A-Za-z0-9_-]{11}$/.test(v))return v;
  const m=v.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m?m[1]:"";
}
const VID_STATE={open:false,mode:"theater",gid:"",vid:"",isAuto:false,corner:0,left:null,top:null,wired:false};
function vidInsets(){
  const hdr=$(".top"),pb=$(".pickbar");
  const topClear=Math.max(64,hdr?Math.ceil(hdr.getBoundingClientRect().bottom)+10:64);
  const botClear=16+(pb?Math.ceil(pb.getBoundingClientRect().height)+10:0);
  return {topClear,botClear};
}
const VID_CORNERS=[
  {name:"bottom-right",calc:(vw,vh,w,h)=>{const {botClear}=vidInsets();return [vw-w-14,vh-h-botClear]}},
  {name:"bottom-left",calc:(vw,vh,w,h)=>{const {botClear}=vidInsets();return [14,vh-h-botClear]}},
  {name:"top-right",calc:(vw,vh,w,h)=>{const {topClear}=vidInsets();return [vw-w-14,topClear]}},
  {name:"top-left",calc:(vw,vh,w,h)=>{const {topClear}=vidInsets();return [14,topClear]}}
];
let vidSrTimer=null;
function announceVidPos(msg){
  const sr=$("#srLive");if(!sr)return;
  sr.textContent=msg;
  clearTimeout(vidSrTimer);
  vidSrTimer=setTimeout(()=>{if(sr.textContent===msg)sr.textContent=""},1200);
}
function ensureVidDockDOM(){
  const dock=$("#vidDock");if(!dock||VID_STATE.wired)return dock;
  VID_STATE.wired=true;
  dock.innerHTML=`<div class="vidhead">
      <button type="button" class="viddrag" id="vidDragBtn" aria-label="Video player handle. Drag or use arrow keys to move.">⠿ <span id="vidTitleTxt">Video player</span></button>
      <div class="vidctl">
        <button type="button" class="vidibtn vid-mini-only" data-act="vidCycleCorner" title="Snap mini-player to next corner" aria-label="Snap mini-player to next screen corner">⇄</button>
        <button type="button" class="vidibtn vid-mini-only" data-act="vidKeyHelp" title="Keyboard shortcut help" aria-label="Keyboard movement help">?</button>
        <button type="button" class="vidibtn vid-mini-only" data-act="vidExpand" title="Expand to theater view" aria-label="Expand video to theater view">⤢</button>
        <button type="button" class="vidibtn vid-th-only" data-act="vidMinimize" title="Shrink to floating corner mini-player while browsing" aria-label="Minimize to floating mini-player">Mini-player</button>
        <button type="button" class="vidibtn" data-act="vidClose" title="Close video" aria-label="Close video player">×</button>
      </div>
    </div>
    <div class="vidscreen" id="vidScreen"></div>
    <div class="vidbar" id="vidBar"></div>`;
  const handle=$("#vidDragBtn");
  let startX=0,startY=0,offsetX=0,offsetY=0,moved=false;
  const moveTo=(left,top)=>{
    const {topClear,botClear}=vidInsets();
    const maxLeft=Math.max(8,window.innerWidth-dock.offsetWidth-8);
    const minTop=Math.min(topClear,Math.max(8,window.innerHeight-dock.offsetHeight-8));
    const maxTop=Math.max(minTop,window.innerHeight-dock.offsetHeight-botClear);
    const cl=Math.max(8,Math.min(left,maxLeft)),ct=Math.max(minTop,Math.min(top,maxTop));
    VID_STATE.left=cl;VID_STATE.top=ct;
    dock.style.inset="auto";
    dock.style.left=`${Math.round(cl)}px`;
    dock.style.top=`${Math.round(ct)}px`;
  };
  VID_STATE.moveTo=moveTo;
  handle.addEventListener("pointerdown",ev=>{
    const ctrl=ev.target.closest("button,input,select,textarea,a");
    if(ev.button!==0||(ctrl&&ctrl!==handle))return;
    const r=dock.getBoundingClientRect();
    startX=ev.clientX;startY=ev.clientY;
    offsetX=ev.clientX-r.left;offsetY=ev.clientY-r.top;
    moved=false;
    handle.setPointerCapture(ev.pointerId);
  });
  handle.addEventListener("pointermove",ev=>{
    if(!handle.hasPointerCapture(ev.pointerId))return;
    const dx=ev.clientX-startX,dy=ev.clientY-startY;
    if(!moved&&Math.hypot(dx,dy)<5)return;
    if(!moved){
      moved=true;
      handle.classList.add("dragging");
      const ifr=$("#vidIframe");if(ifr)ifr.style.pointerEvents="none";
      if(VID_STATE.mode==="theater"){
        VID_STATE.mode="mini";
        dock.classList.remove("theater");dock.classList.add("mini");
        const bd=$("#vidBackdrop");if(bd)bd.hidden=true;
        offsetX=Math.min(Math.max(24,offsetX),dock.offsetWidth-40);
        offsetY=16;
      }
    }
    moveTo(ev.clientX-offsetX,ev.clientY-offsetY);
  });
  handle.addEventListener("lostpointercapture",()=>{
    const wasMoved=moved;moved=false;
    handle.classList.remove("dragging");
    const ifr=$("#vidIframe");if(ifr)ifr.style.pointerEvents="";
    if(wasMoved)announceVidPos("Video player moved");
  });
  handle.addEventListener("keydown",ev=>{
    const dirs={ArrowLeft:[-18,0,"moved left"],ArrowRight:[18,0,"moved right"],ArrowUp:[0,-18,"moved up"],ArrowDown:[0,18,"moved down"]};
    const d=dirs[ev.key];if(!d)return;
    ev.preventDefault();
    if(VID_STATE.mode==="theater")minimizeVidDock();
    const r=dock.getBoundingClientRect();
    moveTo(r.left+d[0],r.top+d[1]);
    announceVidPos("Video player "+d[2]);
  });
  addEventListener("resize",()=>{
    if(!VID_STATE.open||VID_STATE.mode!=="mini")return;
    if(VID_STATE.left!=null&&VID_STATE.top!=null)moveTo(VID_STATE.left,VID_STATE.top);
    else snapVidToCorner(VID_STATE.corner,false);
  });
  return dock;
}
function snapVidToCorner(idx,announce=true){
  const dock=$("#vidDock");if(!dock||!VID_STATE.moveTo)return;
  const c=VID_CORNERS[((idx%VID_CORNERS.length)+VID_CORNERS.length)%VID_CORNERS.length];
  const [l,t]=c.calc(window.innerWidth,window.innerHeight,dock.offsetWidth||280,dock.offsetHeight||190);
  VID_STATE.moveTo(l,t);
  if(announce)announceVidPos("Video player docked "+c.name);
}
function minimizeVidDock(){
  const dock=ensureVidDockDOM(),bd=$("#vidBackdrop");
  if(!dock||!VID_STATE.open)return;
  VID_STATE.mode="mini";
  if(bd)bd.hidden=true;
  dock.classList.remove("theater");dock.classList.add("mini");
  requestAnimationFrame(()=>{
    if(VID_STATE.left!=null&&VID_STATE.top!=null)VID_STATE.moveTo(VID_STATE.left,VID_STATE.top);
    else snapVidToCorner(VID_STATE.corner,false);
  });
}
function expandVidDock(){
  const dock=ensureVidDockDOM(),bd=$("#vidBackdrop");
  if(!dock||!VID_STATE.open)return;
  if($("#sheetDlg")&&$("#sheetDlg").open)clearLayer();
  VID_STATE.mode="theater";
  dock.style.inset="";dock.style.left="";dock.style.top="";
  dock.classList.remove("mini");dock.classList.add("theater");
  if(bd)bd.hidden=false;
}
function closeVidDock(){
  const dock=$("#vidDock"),bd=$("#vidBackdrop"),scr=$("#vidScreen");
  VID_STATE.open=false;VID_STATE.gid="";VID_STATE.vid="";
  if(scr)scr.innerHTML="";
  if(dock){dock.hidden=true;dock.classList.remove("theater","mini")}
  if(bd)bd.hidden=true;
}
function cycleVidCorner(){
  if(!VID_STATE.open)return;
  if(VID_STATE.mode!=="mini")minimizeVidDock();
  VID_STATE.corner=(VID_STATE.corner+1)%VID_CORNERS.length;
  snapVidToCorner(VID_STATE.corner,true);
}
function openVideoSheet(g,customVid,liveAuto=false){
  if(!g)return;
  const vid=customVid!==undefined&&customVid!==null?customVid:(g.yt||"");
  const isAuto=!!g.ytAuto||!!liveAuto;
  const ytSearch="https://www.youtube.com/results?search_query="+encodeURIComponent(g.title+" "+g.year+" gameplay");
  const ytWatch=vid?`https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`:ytSearch;
  if(SYNTH.on)toggleSynth();
  if(story)closeStory();
  if($("#layer").innerHTML||($("#sheetDlg")&&$("#sheetDlg").open))clearLayer();
  const dock=ensureVidDockDOM(),bd=$("#vidBackdrop"),scr=$("#vidScreen"),bar=$("#vidBar"),ttl=$("#vidTitleTxt");
  if(!dock||!scr||!bar)return;
  const samePlaying=VID_STATE.open&&VID_STATE.gid===g.id&&vid&&VID_STATE.vid===vid&&!!$("#vidIframe");
  VID_STATE.open=true;VID_STATE.gid=g.id;VID_STATE.isAuto=isAuto;
  if(ttl)ttl.textContent=`${g.title} (${g.year})`;
  dock.hidden=false;
  expandVidDock();
  if(!samePlaying){
    VID_STATE.vid=vid||"";
    if(vid)trackEvent("video_play",g.id);
    scr.innerHTML=vid
      ?`<iframe id="vidIframe" src="https://www.youtube.com/embed/${encodeURIComponent(vid)}?rel=0&autoplay=1" title="${esc(g.title)} gameplay" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      :`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;max-width:44ch">
          <div style="width:76px">${cover(g,{showYear:false})}</div>
          <b style="font-size:16px;color:#EEF2FA">${esc(g.title)} (${g.year})</b>
          <p style="margin:0;font-size:13px;color:#AEB6C8">No embedded clip indexed yet — open YouTube below to watch gameplay, trailers, or soundtracks.</p>
          <a class="btn sm primary" href="${esc(ytSearch)}" target="_blank" rel="noopener">Search ${esc(g.title)} on YouTube ↗</a>
        </div>`;
  }
  bar.innerHTML=`<span>${vid?(isAuto?`<b>Auto-matched clip</b> · browse below and the video follows in a corner mini-player:`
      :`<b>Trailer / gameplay</b> · ${esc(studio(g)||String(g.year))} — browse below to keep watching in mini-player:`)
    :`Open YouTube search or browse this game's family tree below.`}</span>
    <span class="row" style="gap:6px">
      ${g.tree?`<button type="button" class="btn sm primary" data-act="vidGoLineage">Family tree ▸</button>`:""}
      <button type="button" class="btn sm${g.tree?"":" primary"}" data-act="vidGoGame">Game page ▸</button>
      ${UP[g.i]&&UP[g.i].length?`<button type="button" class="btn sm" data-act="vidGoWalk" style="background:#1B2234;color:#EEF2FA;border-color:#323C54">Walk roots ▸</button>`:""}
      <a class="btn sm" href="${esc(ytWatch)}" target="_blank" rel="noopener" style="background:#1B2234;color:#EEF2FA;border-color:#323C54">${vid?"YouTube ↗":"Search YouTube ↗"}</a>
    </span>`;
}
const openTvSheet=openVideoSheet;
const GRAT_TAGS=["Carried me through","Shaped who I am","Pure art","Childhood magic","Never forgotten"];
function openGratitudeSheet(opts={}){
  if(opts.st!==undefined)GRAT_DRAFT.st=opts.st||"";
  if(opts.id!==undefined){
    GRAT_DRAFT.id=opts.id||"";
    const gm=GRAT_DRAFT.id&&byId.get(GRAT_DRAFT.id);
    if(gm&&!opts.st){const sr=findStudio(studio(gm));if(sr)GRAT_DRAFT.st=sr.id}
  }
  const gm=GRAT_DRAFT.id?byId.get(GRAT_DRAFT.id):null;
  const st=GRAT_DRAFT.st?findStudio(GRAT_DRAFT.st):(gm?findStudio(studio(gm)):null);
  const myTopStudios=(()=>{const m={};entries(hist).forEach(x=>{if(x.g){const s=findStudio(studio(x.g));if(s)m[s.id]=(m[s.id]||0)+x.lv}});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id])=>STUDIOS.get(id)).filter(Boolean)})();
  const targetName=gm&&st?`${gm.title} (${st.name})`:gm?gm.title:st?st.name:"the makers who raised you";
  const mobyLink=gm?mobyURL(gm):st?`https://www.mobygames.com/search/?q=${encodeURIComponent(st.name)}&type=company`:"";
  const liLink=st?`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(st.name+" game")}`:gm?`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(studio(gm)+" "+gm.title)}`:"";
  const bskyLink=(st||gm)?`https://bsky.app/search?q=${encodeURIComponent((st?st.name:studio(gm)||gm.title)+" gamedev")}`:"";
  openSheet(`<div class="sheethead"><div><p class="eyebrow" style="margin-bottom:2px">Personal thank-you postcard</p><h2>Send a note to ${esc(targetName)}</h2><p class="sub" style="margin:2px 0 0">Save a personal note on your device or download a <b>Thank-You Postcard (.png)</b> to share directly with a developer on LinkedIn or Bluesky.</p></div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    ${st||gm?`<div class="diascard" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div class="row" style="gap:10px">${gm?`<div style="width:44px">${cover(gm,{showYear:false})}</div>`:studioLogoHTML(st)}<div><b>${st?`${flag(st.cc)} ${esc(st.name)}`:""}${gm?`${st?" · ":""}${esc(gm.title)} (${gm.year})`:""}</b>${st&&st.makers&&st.makers.length?`<small class="muted" style="display:block">Notable team members: ${esc(st.makers.slice(0,5).join(", "))}</small>`:""}</div></div>
      <button type="button" class="btn sm ghost" data-act="gratClearPick">Change game / studio</button>
    </div>`
    :`<div style="margin-bottom:12px">
      ${myTopStudios.length?`<span class="sync" style="display:block;margin-bottom:6px">Quick-pick from studios on your timeline:</span><div class="row" style="margin-bottom:8px">${myTopStudios.map(s=>`<button type="button" class="chip" data-act="gratSheet" data-st="${esc(s.id)}">${flag(s.cc)} ${esc(s.name)}</button>`).join("")}</div>`:""}
      <div class="search"><input class="input" id="gratQ" type="search" placeholder="Search a game or studio (e.g. Bullfrog, Looking Glass, Monkey Island, Final Fantasy VII)…" autocomplete="off"><div class="results" id="gratR" hidden></div></div>
    </div>`}
    <span class="sync" style="display:block;margin-bottom:6px">What did their work mean to you?</span>
    <div class="row" style="gap:6px;margin-bottom:12px">${GRAT_TAGS.map(tg=>`<button type="button" class="chip" data-act="gratTag" data-tag="${esc(tg)}" aria-pressed="${GRAT_DRAFT.tag===tg}">${esc(tg)}</button>`).join("")}</div>
    <label class="field" for="gratNote">Your note or memory<textarea class="input" id="gratNote" rows="4" maxlength="360" placeholder="Example: Booting up ${gm?esc(gm.title):st?esc(st.name+"'s games"):"this world"} after school carried me through rough days I still remember today. Thank you to everyone on the team.">${esc(GRAT_DRAFT.note||"")}</textarea></label>
    <label class="field" for="gratWho" style="margin-top:10px">Signed (optional — first name, platform, or era)<input class="input" id="gratWho" maxlength="48" placeholder="e.g. ${esc(hist.name||"A grateful player")} · Amiga &amp; PC kid" value="${esc(GRAT_DRAFT.who||(hist.name?hist.name:""))}"></label>
    <div class="row" style="margin-top:14px">
      <button type="button" class="btn primary wrap" data-act="gratPostcard">Save &amp; download Postcard (.png)</button>
      <button type="button" class="btn" id="gratSubmitBtn" data-act="gratSubmitReal">Submit note for review</button>
      <button type="button" class="btn ghost" data-act="gratCopy">Copy text</button>
    </div>
    <p class="sub" id="gratSubmitStatus" role="status" aria-live="polite" style="margin-top:8px;color:var(--craft)" hidden></p>
    ${mobyLink||liLink?`<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)"><span class="sync" style="display:block;margin-bottom:6px">Find the developers on the credits:</span>
      <div class="row" style="gap:8px">
        ${mobyLink?`<a class="btn sm" href="${esc(mobyLink)}" target="_blank" rel="noopener">Full team credits on MobyGames ↗</a>`:""}
        ${liLink?`<a class="btn sm" href="${esc(liLink)}" target="_blank" rel="noopener">Find alumni on LinkedIn ↗</a>`:""}
        ${bskyLink?`<a class="btn sm ghost" href="${esc(bskyLink)}" target="_blank" rel="noopener">Search makers on Bluesky ↗</a>`:""}
      </div></div>`:""}
    <p class="sub" style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);font-size:12.5px">Want to support laid-off developers, preservation, or hospitalized kids directly? <a href="#giveback" data-act="goGiveBack">6 established non-profits ▸</a></p>
    <div id="gratOut"></div>`,"Thank the makers");
  const nEl=$("#gratNote"),wEl=$("#gratWho");
  if(nEl)nEl.addEventListener("input",()=>{GRAT_DRAFT.note=nEl.value});
  if(wEl)wEl.addEventListener("input",()=>{GRAT_DRAFT.who=wEl.value});
  const gq=$("#gratQ"),gr=$("#gratR");
  if(gq&&gr){
    gq.addEventListener("input",()=>{
      const q=norm(gq.value.trim());if(!q){gr.hidden=true;return}
      const stHits=[...STUDIOS.values()].filter(s=>norm(s.name).includes(q)||s.aliases.some(a=>norm(a).includes(q))).sort((a,b)=>(b.curated-a.curated)||(b.games.length-a.games.length)).slice(0,4);
      const gmHits=searchGames(gq.value,{limit:5});
      gr.innerHTML=[
        ...stHits.map(s=>`<button type="button" class="res" data-gst="${esc(s.id)}"><span>${flag(s.cc)}</span><span><b>${esc(s.name)}</b><small>Studio · ${plural(s.games.length,"game")}</small></span><span class="y">${s.founded||""}</span></button>`),
        ...gmHits.map(g=>`<button type="button" class="res" data-ggm="${esc(g.id)}">${cover(g,{showYear:false})}<span><b>${esc(g.title)}</b><small>${esc(studio(g))}</small></span><span class="y">${g.year}</span></button>`)
      ].join("")||`<p class="empty" style="padding:8px 10px">No studio or game match.</p>`;
      gr.hidden=false;clampSearchBox(gr);
    });
    gr.addEventListener("click",ev=>{
      const b=ev.target.closest("[data-gst],[data-ggm]");if(!b)return;
      if(b.dataset.gst)openGratitudeSheet({st:b.dataset.gst,id:""});
      else if(b.dataset.ggm)openGratitudeSheet({id:b.dataset.ggm});
    });
  }
}
const SUPABASE_INBOX_URL="https://bplcmxwkhpvqogqincmq.supabase.co/rest/v1/pm_inbox";
const SUPABASE_EVENTS_URL="https://bplcmxwkhpvqogqincmq.supabase.co/rest/v1/pm_events";
const STEAM_IMPORT_URL="https://bplcmxwkhpvqogqincmq.supabase.co/functions/v1/steam-import";
const SUPABASE_PUB_KEY="sb_publishable_JkMRhruYPEVPnQwCylR0aA_TWWiFTwG";
/* Cookie-free, zero-IP, zero-PII, 10% session-sampled aggregate counter (never logs birth year or personal notes) */
const ANALYTICS_SEEN=new Set();
const ANALYTICS_SAMPLE_RATE=0.10;
const ANALYTICS_IN_SAMPLE=(()=>{
  try{
    let v=parseFloat(sessionStorage.getItem("pm_sample_v2")||"");
    if(!(v>=0&&v<1)){v=Math.random();sessionStorage.setItem("pm_sample_v2",v.toFixed(6))}
    return v<ANALYTICS_SAMPLE_RATE;
  }catch(e){return Math.random()<ANALYTICS_SAMPLE_RATE}
})();
function clipUtf(s,max){
  const arr=Array.from(String(s==null?"":s)).filter(ch=>{const c=ch.codePointAt(0);return c<0xD800||c>0xDFFF});
  return arr.slice(0,max).join("");
}
function cleanRefHost(){
  try{
    if(!document.referrer)return "";
    const h=new URL(document.referrer).hostname.toLowerCase().replace(/^www\./,"");
    if(!h||h==="playedmade.com"||h.endsWith(".github.io")||h==="localhost"||h==="127.0.0.1")return "";
    return clipUtf(h,80);
  }catch(e){return ""}
}
function deviceBucket(){
  try{
    if((window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true)return "pwa";
    const w=window.innerWidth||1024;
    return w<=640?"mobile":w<=1024?"tablet":"desktop";
  }catch(e){return "desktop"}
}
function trackEvent(event,section=""){
  try{
    if(!ANALYTICS_IN_SAMPLE||navigator.webdriver)return;
    const host=location.hostname;
    if(!host||host==="localhost"||host==="127.0.0.1"||location.protocol==="file:")return;
    if(event==="view"){
      const key="v:"+section;
      if(ANALYTICS_SEEN.has(key)||ANALYTICS_SEEN.size>=16)return;
      ANALYTICS_SEEN.add(key);
    }
    const tz=clipUtf((Intl&&Intl.DateTimeFormat&&Intl.DateTimeFormat().resolvedOptions().timeZone)||"",48);
    /* Strictly aggregate fields — never birth year, age, name, or personal memory text */
    const body=JSON.stringify({
      event:clipUtf(event||"",40),
      section:clipUtf(section||"",48),
      ref_host:event==="visit"?cleanRefHost():"",
      device:deviceBucket(),
      tz
    });
    fetch(SUPABASE_EVENTS_URL,{
      method:"POST",
      keepalive:true,
      headers:{
        "apikey":SUPABASE_PUB_KEY,
        "Content-Type":"application/json",
        "Prefer":"return=minimal"
      },
      body
    }).catch(()=>{});
  }catch(e){}
}
function trackRouteAnalytics(){
  try{
    const r=state.route||{};
    const sec=r.view==="almanac"?(r.tab||state.almTab||"almanac")
      :r.view==="about"?(r.jumpCredits?"credits":"about")
      :(r.view||"start");
    let visited=false;
    try{visited=sessionStorage.getItem("pm_v1")==="1";if(!visited)sessionStorage.setItem("pm_v1","1")}catch(e){}
    if(!visited)trackEvent("visit",sec);
    trackEvent("view",sec);
  }catch(e){}
}
let FEAT_DRAFT={title:"",cat:"Missing Console / System",scope:"Default",body:""};
let inboxLastSent=0,featOpenedAt=0;
function inboxSessionCount(){try{return parseInt(sessionStorage.getItem("pm_inbox_cnt")||"0",10)||0}catch(e){return 0}}
function bumpInboxSessionCount(){try{sessionStorage.setItem("pm_inbox_cnt",String(inboxSessionCount()+1))}catch(e){}}
function saveLocalRequest(t,b,cat){
  const saved=store.get("ib3-requests",[]);
  const rec={title:t,cat:cat||FEAT_DRAFT.cat,body:b||"",ts:Date.now()};
  const idx=saved.findIndex(x=>norm(x.title)===norm(t)&&x.cat===rec.cat);
  if(idx>=0)saved[idx]=rec;else saved.unshift(rec);
  store.set("ib3-requests",saved.slice(0,25));
}
async function submitInboxPayload(payload){
  if(inboxSessionCount()>=5)return {ok:false,reason:"limit"};
  if(Date.now()-inboxLastSent<10000)return {ok:false,reason:"cooldown"};
  const title=clipUtf(String(payload.title||"").trim(),160).trim();
  if(Array.from(title).length<2)return {ok:false,reason:"short"};
  const details=clipUtf(String(payload.body||"").trim(),1500).trim();
  const urlCount=((title+" "+details).match(/https?:\/\//gi)||[]).length;
  if(urlCount>3)return {ok:false,reason:"links"};
  const catRaw=clipUtf(String(payload.cat||"").trim(),120).trim();
  const category=Array.from(catRaw).length>=2?catRaw:"General";
  const scope=clipUtf(String(payload.scope||"").trim()||"Default",120).trim()||"Default";
  const source_page=clipUtf(String(location.hash||"#start").trim()||"#start",160);
  const id="sub-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);
  const row={
    submission_id:id,
    category,
    title,
    details,
    scope,
    source_page
  };
  try{
    const r=await fetch(SUPABASE_INBOX_URL,{
      method:"POST",
      headers:{
        "apikey":SUPABASE_PUB_KEY,
        "Content-Type":"application/json",
        "Prefer":"return=minimal"
      },
      body:JSON.stringify(row)
    });
    if(r.ok){inboxLastSent=Date.now();bumpInboxSessionCount();return {ok:true}}
    return {ok:false,reason:"http"};
  }catch(e){
    return {ok:false,reason:"net"};
  }
}
function openFeatureSheet(opts={}){
  featOpenedAt=Date.now();
  if(opts.cat)FEAT_DRAFT.cat=opts.cat;
  if(opts.title!==undefined)FEAT_DRAFT.title=opts.title;
  const repo=ghRepoURL()||"https://github.com/JohanHeurlin/inspired-by";
  const cats=["Missing Console / System","Missing Game / Classic","Cancelled / Sunsetted / Lore","Lineage Link / Source","Feature / UI Idea","Bug / Mobile Polish"];
  if(!cats.includes(FEAT_DRAFT.cat))FEAT_DRAFT.cat=cats[0];
  const scopes=["Maintainer decides","Good for everyone","Optional setting"];
  if(!scopes.includes(FEAT_DRAFT.scope))FEAT_DRAFT.scope=scopes[0];
  const isVault=FEAT_DRAFT.cat.includes("Cancelled"),isConsole=FEAT_DRAFT.cat.includes("Console"),isGame=FEAT_DRAFT.cat.includes("Game"),isLineage=FEAT_DRAFT.cat.includes("Lineage"),isFeature=FEAT_DRAFT.cat.includes("Feature");
  const ph=isVault?"e.g. LMNO, Asheron's Call, Zeebo, B.C. (Lionhead), or a regional gaming story…"
    :isConsole?"e.g. Pegasus, Sega Pico, Acorn Archimedes, Zeebo, FM Towns…"
    :isGame?"e.g. Captain Claw, Prehistorik 2, Jazz Jackrabbit 2, Dizzy…"
    :isLineage?"e.g. Quake → Half-Life (GoldSrc engine & developer interview)…"
    :"e.g. Compare 3+ timelines side-by-side…";
  const bodyPh=isVault?"What happened to it, which studio/makers worked on it, or why does its story belong in the archive?"
    :isConsole?"Which years/region did you play it in, and what were its signature games?"
    :isGame?"What year or console/computer did you play it on? Any studio or regional title?"
    :isLineage?"Paste an interview, GDC talk, or postmortem URL and describe what it built on and added…"
    :"Describe what you'd like to see or what looked off…";
  const savedReqs=store.get("ib3-requests",[]);
  openSheet(`<div class="sheethead"><div><p class="eyebrow" style="margin-bottom:2px">Review queue · No sign-in required</p><h2 id="featHeading">Suggest a console, game, source, or fix</h2><p class="sub" style="margin:2px 0 0">Submissions go directly into the catalog review queue — no account needed.</p></div><button class="x" type="button" data-act="closeLayer" aria-label="Close">×</button></div>
    <form id="featForm" aria-labelledby="featHeading" novalidate>
      <input type="text" id="featHp" name="website_url" tabindex="-1" autocomplete="off" aria-hidden="true" class="sr">
      <span class="sync" style="display:block;margin:0 0 6px">Category</span>
      <div class="row" style="gap:6px;margin-bottom:12px">${cats.map(c=>`<button type="button" class="chip" data-act="featCat" data-v="${esc(c)}" aria-pressed="${FEAT_DRAFT.cat===c}">${esc(c)}</button>`).join("")}</div>
      <label class="field" for="featTitle">${isVault?"Cancelled game, sunsetted world, or lore topic":isConsole?"Console or computer name":isGame?"Game title (and system if known)":isLineage?"Game pair or topic (Older → Newer)":"Short summary"} <span aria-hidden="true">*</span><input class="input" id="featTitle" name="title" maxlength="100" required minlength="2" aria-describedby="featErr" placeholder="${esc(ph)}" value="${esc(FEAT_DRAFT.title||"")}"></label>
      ${isFeature?`<span class="sync" style="display:block;margin:10px 0 5px">Scope</span>
        <div class="row" style="gap:6px">${scopes.map(s=>`<button type="button" class="chip" data-act="featScope" data-v="${esc(s)}" aria-pressed="${FEAT_DRAFT.scope===s}">${esc(s)}</button>`).join("")}</div>`:""}
      <label class="field" for="featBody" style="margin-top:10px">${isLineage?"Source URL (interview, GDC talk, article) &amp; notes":"Details, region, or notes (optional)"}<textarea class="input" id="featBody" name="details" rows="3" maxlength="800" placeholder="${esc(bodyPh)}">${esc(FEAT_DRAFT.body||"")}</textarea></label>
      <p class="sub" id="featErr" role="status" aria-live="polite" style="margin:8px 0 0;color:var(--love)" hidden></p>
      <div class="row" style="margin-top:14px;gap:8px;align-items:center;justify-content:space-between">
        <button type="submit" class="btn primary" id="featSubmitBtn">Submit to review queue</button>
        <button type="button" class="btn sm ghost" data-act="featGh" data-repo="${esc(repo)}">Or open GitHub Issue ↗</button>
      </div>
    </form>
    ${savedReqs.length?`<div style="margin-top:14px;padding-top:10px;border-top:1px dashed var(--line)"><span class="sync" style="display:block;margin-bottom:6px">Submitted from this device (${savedReqs.length}):</span>
      <div class="row" style="gap:6px">${savedReqs.slice(0,6).map((r,i)=>`<span class="chip" style="cursor:default">✓ ${esc(r.title)} <button type="button" class="link" style="margin-left:4px;text-decoration:none" data-act="featRmSaved" data-i="${i}" aria-label="Remove local receipt ${esc(r.title)}">×</button></span>`).join("")}</div></div>`:""}`,"Suggest a console, game, or fix");
  const ft=$("#featTitle"),fb=$("#featBody"),fm=$("#featForm"),er=$("#featErr"),sb=$("#featSubmitBtn");
  const clearErr=()=>{if(er&&!er.dataset.ok){er.hidden=true;er.textContent=""}if(ft)ft.removeAttribute("aria-invalid")};
  if(ft){
    ft.addEventListener("input",()=>{FEAT_DRAFT.title=ft.value;clearErr()});
    ft.addEventListener("blur",()=>{const tLen=Array.from(ft.value.trim()).length;if(tLen>0&&tLen<2){ft.setAttribute("aria-invalid","true");if(er){delete er.dataset.ok;er.style.color="var(--love)";er.hidden=false;er.textContent="Please enter at least 2 characters."}}});
  }
  if(fb)fb.addEventListener("input",()=>{FEAT_DRAFT.body=fb.value});
  if(fm)fm.addEventListener("submit",async ev=>{
    ev.preventDefault();
    if(($("#featHp")||{}).value)return;
    if(Date.now()-featOpenedAt<1500){toast("Take a second to review before submitting");return}
    const t=(ft?ft.value:"").trim(),b=(fb?fb.value:"").trim();
    if(Array.from(t).length<2){
      if(ft){ft.setAttribute("aria-invalid","true");ft.focus()}
      if(er){delete er.dataset.ok;er.style.color="var(--love)";er.hidden=false;er.textContent="Please enter at least 2 characters for the console, game, or idea title."}
      return;
    }
    if(sb){sb.disabled=true;sb.textContent="Sending…"}
    const res=await submitInboxPayload({cat:FEAT_DRAFT.cat,title:t,body:b,scope:FEAT_DRAFT.scope});
    if(sb){sb.disabled=false;sb.textContent="Submit to review queue"}
    if(res.ok){
      saveLocalRequest(t,b,FEAT_DRAFT.cat);
      FEAT_DRAFT.title="";FEAT_DRAFT.body="";
      playBlip(2);
      openFeatureSheet();
      const er2=$("#featErr");
      if(er2){er2.dataset.ok="1";er2.style.color="var(--craft)";er2.hidden=false;er2.textContent=`✓ Logged “${t}” in the review queue. Thank you!`}
    }else if(er){
      delete er.dataset.ok;er.style.color="var(--love)";er.hidden=false;
      er.textContent=res.reason==="short"?"Please enter at least 2 characters for the title."
        :res.reason==="cooldown"?"Submitted — wait 10 seconds before sending another."
        :res.reason==="limit"?"Session limit reached (5 submissions) — use GitHub Issues for bulk additions."
        :res.reason==="links"?"Please include at most 3 links per submission."
        :"Network couldn't reach the review queue right now — check your connection or use the GitHub Issue link.";
    }
  });
}
function openPackSheet(){
  const cur=MEMORY_PACKS.find(p=>p.k===state.packKey)||MEMORY_PACKS[0];
  const gs=packGames(cur),ownSet=new Set(hist.owned||[]);
  openSheet(`<div class="sheethead"><div><p class="eyebrow" style="margin-bottom:2px">Casual browsing · Auto-saved</p><h2>Add games by memory &amp; mood</h2><p class="sub" style="margin:2px 0 0">Pick a mood below and tap any game you played (<b>✓</b> → <b>★</b> → <b>♥</b>).</p></div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="pickstrip" style="margin-bottom:12px">${MEMORY_PACKS.map(pk=>{const n=packGames(pk).filter(g=>levelOf(hist,g)>0).length;return `<button type="button" class="chip" data-act="packSheetPick" data-k="${esc(pk.k)}" aria-pressed="${cur.k===pk.k}">${esc(pk.title)}${n?` · ${n}✓`:""}</button>`}).join("")}</div>
    <p class="sub" style="margin:0 0 10px"><b>${esc(cur.title)}</b> — ${esc(cur.sub)}</p>
    <div class="grid">${gs.map(g=>tileHTML(g,hist,{act:"packCycle",sub:pickTileSub(g,ownSet,"")})).join("")}</div>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn primary" data-act="closeLayer">Done</button></div>`,"Memory & Mood Packs",{wide:true});
}
function ensureTimelineReady(cb){
  if(!hist.birth&&!hist.era){hist.era=state.heroEra||"90s";save()}
  cb();
}
function openMakerSheet(){
  const wk=workedEntries(hist).sort((a,b)=>workedYearOf(a)-workedYearOf(b));
  const stList=(hist.workedStudios||[]).map(id=>STUDIOS.get(id)).filter(Boolean);
  const role=state.makerRole||"",wkType=state.makerWkType||"";
  const syncHead=()=>{
    const byEl=$("#mkBirth"),nmEl=$("#mkName");
    if(nmEl&&nmEl.value.trim())hist.name=nmEl.value.trim().slice(0,24);
    if(byEl){const y=parseInt(byEl.value,10);if(y>=1940&&y<=NOW-3){hist.birth=y;hist.era=String(Math.floor(y/10)*10).slice(-2)+"s"}}
    if(!hist.birth&&!hist.era)hist.era=state.heroEra||"90s";
    hist.stage=null;save();return true;
  };
  openSheet(`<div class="sheethead"><div><p class="crafteyebrow">🛠 For game makers, live-ops &amp; modders <span class="sr-badge" style="margin-left:6px">Self-reported</span></p><h2>Games, mods &amp; studios I worked on</h2><p class="sub" style="margin:2px 0 0">Mark shipped titles, live-ops years, total conversions / maps, studios, and canceled projects — plus trace every later game your work helped inspire.</p></div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    ${!hist.birth?`<div class="row" style="align-items:flex-end;margin-bottom:14px"><label class="field" for="mkBirth" style="flex:1;min-width:120px">Birth year (optional)<input class="input" id="mkBirth" inputmode="numeric" maxlength="4" placeholder="1984"></label><label class="field" for="mkName" style="flex:2;min-width:160px">Name on timeline<input class="input" id="mkName" maxlength="24" placeholder="Your name" value="${esc(hist.name||"")}"></label></div>`:""}
    <p class="sub" style="margin:4px 0 6px">Credit type &amp; discipline (applied to credits you add below)</p>
    <div class="row" style="margin-bottom:8px;gap:6px">${[["","Shipped / Studio"],["mod","Mod / Map"],["unshipped","Unshipped / Canceled"]].map(([k,lbl])=>`<button type="button" class="chip craftchip" data-act="mkWkType" data-wt="${k}" aria-pressed="${wkType===k}">${lbl}</button>`).join("")}
      <label style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:12.5px;color:var(--muted)">Worked year (optional live-ops)<input class="input" id="mkWorkYear" inputmode="numeric" maxlength="4" placeholder="Launch yr" style="width:92px;padding:4px 8px;font-size:16px"></label>
    </div>
    <div class="row" style="margin-bottom:14px">${DEV_ROLES.map(r=>`<button type="button" class="chip craftchip" data-act="mkRole" data-role="${esc(r)}" aria-pressed="${role===r}">${esc(r)}</button>`).join("")}</div>
    <label class="field" for="mkGameQ">Add a shipped or live-ops game (or mod base game) you worked on</label>
    <div class="search" style="margin-top:6px"><input class="input" id="mkGameQ" type="search" placeholder="Search ${G.length.toLocaleString()}+ games, e.g. Battlefield 1942, Mirror's Edge, World of Warcraft, Half-Life…" autocomplete="off"><div class="results" id="mkGameR" hidden></div></div>
    <label class="field" for="mkStQ" style="margin-top:14px">Add studios / companies you worked at</label>
    <div class="search" style="margin-top:6px"><input class="input" id="mkStQ" type="search" placeholder="Search studios, e.g. DICE, Looking Glass, King, Bungie…" autocomplete="off"><div class="results" id="mkStR" hidden></div></div>
    ${stList.length?`<div class="makers" style="margin-top:8px">${stList.map(s=>`<span class="makerbtn worked">🛠 ${flag(s.cc)} ${esc(s.name)} <button type="button" class="link" style="margin-left:4px;color:inherit;text-decoration:none" data-act="mkRmSt" data-st="${esc(s.id)}" aria-label="Remove ${esc(s.name)}">×</button></span>`).join("")}</div>`:""}
    <h3 class="h3" style="margin-top:16px">Mod, custom map, or canceled / unannounced project?</h3>
    <p class="sub" style="margin-bottom:8px">Bedroom mods, Counter-Strike maps, and canceled prototypes represent real craft — log them so they live on your timeline too.</p>
    <form class="row" id="mkCustomForm"><input class="input" id="mkCustTitle" maxlength="70" style="flex:2;min-width:160px" placeholder="e.g. de_dust_custom (Mod / Map) or Project Ragtag (Canceled)" aria-label="Project title"><input class="input" id="mkCustYear" inputmode="numeric" maxlength="4" style="width:92px" placeholder="2017" value="${NOW-2}" aria-label="Year"><button class="btn sm craft" type="submit">+ Add credit</button></form>
    ${wk.length?`<h3 class="h3" style="margin-top:18px">Your credits (${wk.length})</h3>
      <div>${wk.map(x=>{const wy=workedYearOf(x),wt=x.e.wkType==="mod"?"Mod / Map":x.e.wkType==="unshipped"?"Unshipped":"";return `<div class="anc" style="grid-template-columns:36px minmax(0,1fr) auto">${coverOfEntry(x.e,x.y,{showYear:false})}<span><b>${esc(x.g?x.g.title:x.e.t)}</b><small>${wy}${x.g&&wy!==x.g.year?` (launched ${x.g.year})`:""}${wt?" · "+wt:""}${x.e.role?" · 🛠 "+esc(x.e.role):""}${x.g?" · "+esc(studio(x.g)):""}${x.g?` · <a href="${esc(mobyURL(x.g))}" target="_blank" rel="noopener">MobyGames ↗</a>`:""}</small></span><button type="button" class="btn sm ghost" data-act="mkRmWk" data-y="${x.y}" data-t="${esc(x.e.t)}" aria-label="Remove credit">×</button></div>`}).join("")}</div>`:""}
    <div class="row" style="justify-content:space-between;margin-top:16px">
      ${wk.length?`<button type="button" class="btn" data-act="creditsRoll">🎬 Roll End Credits</button>`:`<span></span>`}
      <button type="button" class="btn craft" data-act="mkDone">View my Maker timeline ▸</button>
    </div>`,"Games & studios I worked on",{wide:true});
  wireSearch($("#mkGameQ"),$("#mkGameR"),g=>{if(!g||!g.id)return;if(!syncHead())return;const wyVal=parseInt(($("#mkWorkYear")||{}).value,10);toggleWorked(g,state.makerRole||undefined,{keep:true,wy:(wyVal>=1950&&wyVal<=NOW)?wyVal:undefined,wkType:state.makerWkType||""});toast(`Added credit: ${g.title}`);openMakerSheet()},{playOnly:false});
  const stIn=$("#mkStQ"),stBox=$("#mkStR");
  stIn.addEventListener("input",()=>{
    const q=norm(stIn.value.trim());if(!q){stBox.hidden=true;return}
    const hits=[...STUDIOS.values()].filter(s=>norm(s.name).includes(q)||s.aliases.some(a=>norm(a).includes(q))).sort((a,b)=>(b.curated-a.curated)||(b.games.length-a.games.length)).slice(0,8);
    stBox.innerHTML=hits.map((s,i)=>`<button type="button" class="res${i===0?" on":""}" data-stpick="${esc(s.id)}"><span>${flag(s.cc)}</span><span><b>${esc(s.name)}</b><small>${plural(s.games.length,"game")}</small></span><span class="y">${isWorkedStudio(hist,s.id)?"✓":"+"}</span></button>`).join("")||`<p class="empty" style="padding:8px 10px">No studio match.</p>`;
    stBox.hidden=false;clampSearchBox(stBox);
  });
  stBox.addEventListener("click",e=>{const b=e.target.closest("[data-stpick]");if(!b)return;if(!syncHead())return;const id=b.dataset.stpick;if(!isWorkedStudio(hist,id))toggleWorkedStudio(id);stIn.value="";stBox.hidden=true;openMakerSheet()});
  $("#mkCustomForm").onsubmit=e=>{e.preventDefault();if(!syncHead())return;const t=$("#mkCustTitle").value.trim(),y=parseInt($("#mkCustYear").value,10);if(!t){toast("Enter a project title");return}if(!(y>=1950&&y<=NOW)){toast(`Enter a year between 1950 and ${NOW}`);return}addWorkedCustom(t,y,state.makerRole||"",state.makerWkType||"unshipped");toast(`Added ${t} (${y})`);openMakerSheet()};
}
function openYearSheet(y,customTitle){
  const own=new Set(hist.owned||[]);
  const all=G.filter(g=>g.year===y&&(g.cat||g.pop>=3)&&playable(g)).sort((a,b)=>{const ha=sysOfGame(a).some(p=>own.has(p)),hb=sysOfGame(b).some(p=>own.has(p));return (hb-ha)||b.pop-a.pop||b.inf-a.inf});
  const list=state.showAllYear||!own.size?all:all.filter(g=>sysOfGame(g).some(p=>own.has(p))||g.pop>=4);
  const age=hist.birth?y-hist.birth:null;
  openSheet(`<div class="sheethead"><div><h2>${y}</h2>${age!=null?`<p class="sub" style="margin:2px 0 0">${age<0?`${-age} years before you were born`:age===0?"The year you were born":"You were "+age}</p>`:""}</div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="yearNav" data-y="${y-1}">◂ ${y-1}</button>${y<NOW?`<button class="btn sm" data-act="yearNav" data-y="${y+1}">${y+1} ▸</button>`:""}<span style="flex:1"></span>${own.size?`<button class="chip" data-act="yearAll" data-y="${y}" aria-pressed="${state.showAllYear}">All systems</button>`:""}</div>
    <div class="tap-hint" style="margin-bottom:12px"><span><b>✓</b>played</span><span><b class="l2">★</b>played a ton</span><span><b class="l3">♥</b>favorite</span></div>
    <div class="grid" id="yeargrid">${list.map(g=>tileHTML(g,hist)).join("")||`<p class="empty">No games listed for ${y} yet.</p>`}</div>
    <h3 class="h3" style="margin-top:18px">Played an older or missing game in ${y}?</h3>
    <form class="row" id="customForm"><input class="input" id="customIn" style="flex:1;min-width:0" placeholder="Type any game you played in ${y}" value="${esc(customTitle||"")}" aria-label="Game title"><button class="btn" type="submit">Add to ${y}</button></form>`,"Year "+y,{wide:true});
  $("#customForm").onsubmit=e=>{e.preventDefault();const t=$("#customIn").value.trim();if(!t)return;const g=findGame(t);if(g){setLevel(g,Math.max(1,levelOf(hist,g)),y);moveEntryYear(entryYearOf(hist,g)||y,g.title,y);toast(`Added ${g.title} to ${y}`)}else{addCustom(t,y);toast(`Added ${t} to ${y}`)}openYearSheet(y)};
}
function currentShareURL(extra="&vs=1"){
  const u=shareLink(hist,{includeBirth:!!state.shareBirth,includeNotes:!!state.shareNotes});
  return extra?(u+extra):u;
}
function compactQrShareURL(d){
  const full=shareLink(d,{includeBirth:!!state.shareBirth,includeNotes:false})+"&vs=1";
  if(full.length<=220)return full;
  /* Trim to top 16 iconic games/favorites so the QR code stays low-density & instantly scannable on phone cameras */
  const slim=Object.assign(blankHist(),{name:(d.name||"").slice(0,16),birth:state.shareBirth?d.birth:null,era:d.era||"",owned:(d.owned||[]).slice(0,5),workedStudios:(d.workedStudios||[]).slice(0,2)});
  const picked=entries(d).filter(x=>x.g).sort((a,b)=>(!!b.e.wk-!!a.e.wk)||(b.lv-a.lv)||(b.g.pop-a.g.pop)).slice(0,16);
  picked.forEach(x=>{const it={t:x.g.title,p:brandOf(x.g),y:x.g.year,lv:x.lv};if(x.e.wk){it.wk=1;if(x.e.role)it.role=x.e.role;if(x.e.wy)it.wy=x.e.wy;if(x.e.wkType)it.wkType=x.e.wkType}pileOf(slim,x.g.year).push(it)});
  const out=shareLink(slim,{includeBirth:!!state.shareBirth,includeNotes:false})+"&vs=1";
  return out.length<=250?out:"https://playedmade.com/";
}

/* ---------- 0-KB Standards-Compliant ISO/IEC 18004 QR Code Encoder (Byte mode, ECC L, V1–V10) ---------- */
const QR_GF_EXP=new Uint8Array(512),QR_GF_LOG=new Uint8Array(256);
(()=>{let x=1;for(let i=0;i<255;i++){QR_GF_EXP[i]=x;QR_GF_LOG[x]=i;x<<=1;if(x&256)x^=0x11d}for(let i=255;i<512;i++)QR_GF_EXP[i]=QR_GF_EXP[i-255]})();
function qrRsEc(data,ecLen){
  let poly=[1];
  for(let i=0;i<ecLen;i++){
    const next=new Array(poly.length+1).fill(0),f=QR_GF_EXP[i];
    for(let j=0;j<poly.length;j++){next[j]^=poly[j];if(poly[j])next[j+1]^=QR_GF_EXP[QR_GF_LOG[poly[j]]+QR_GF_LOG[f]]}
    poly=next;
  }
  const rem=new Uint8Array(ecLen);
  for(let i=0;i<data.length;i++){
    const factor=data[i]^rem[0];
    for(let j=0;j<ecLen-1;j++)rem[j]=rem[j+1];
    rem[ecLen-1]=0;
    if(factor)for(let j=0;j<ecLen;j++)if(poly[j+1])rem[j]^=QR_GF_EXP[QR_GF_LOG[poly[j+1]]+QR_GF_LOG[factor]];
  }
  return rem;
}
/* [totalDataCw, ecPerBlock, g1Blocks, g1DataCw, g2Blocks, g2DataCw, alignCoords] for ECC Level L V1..V10 */
const QR_V_SPEC=[null,
  [19,7,1,19,0,0,[]],[34,10,1,34,0,0,[6,18]],[55,15,1,55,0,0,[6,22]],
  [80,20,1,80,0,0,[6,26]],[108,26,1,108,0,0,[6,30]],[136,18,2,68,0,0,[6,34]],
  [156,20,2,78,0,0,[6,22,38]],[194,24,2,97,0,0,[6,24,42]],[232,30,2,116,0,0,[6,26,46]],
  [274,18,2,68,2,69,[6,28,50]]
];
function encodeQR(text){
  const bytes=[...new TextEncoder().encode(String(text||"https://playedmade.com/"))];
  let ver=1;
  while(ver<=10){
    const sp=QR_V_SPEC[ver],capBits=sp[0]*8,hdrBits=4+(ver>=10?16:8);
    if(hdrBits+bytes.length*8<=capBits)break;
    ver++;
  }
  if(ver>10)return encodeQR("https://playedmade.com/");
  const [dcTotal,ecLen,g1B,g1D,g2B,g2D,align]=QR_V_SPEC[ver];
  const n=17+ver*4;
  const bits=[];
  const pushBits=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1)};
  pushBits(0b0100,4);
  pushBits(bytes.length,ver>=10?16:8);
  bytes.forEach(b=>pushBits(b,8));
  for(let i=0;i<4&&bits.length<dcTotal*8;i++)bits.push(0);
  while(bits.length%8)bits.push(0);
  const cw=[];
  for(let i=0;i<bits.length;i+=8){let v=0;for(let j=0;j<8;j++)v=(v<<1)|bits[i+j];cw.push(v)}
  for(let k=0;cw.length<dcTotal;k++)cw.push(k%2?0x11:0xec);
  const dBlocks=[],eBlocks=[];
  let off=0;
  for(let i=0;i<g1B;i++){const blk=cw.slice(off,off+g1D);off+=g1D;dBlocks.push(blk);eBlocks.push(qrRsEc(blk,ecLen))}
  for(let i=0;i<g2B;i++){const blk=cw.slice(off,off+g2D);off+=g2D;dBlocks.push(blk);eBlocks.push(qrRsEc(blk,ecLen))}
  const stream=[];
  const maxD=Math.max(g1D,g2D);
  for(let i=0;i<maxD;i++)for(const b of dBlocks)if(i<b.length)stream.push(b[i]);
  for(let i=0;i<ecLen;i++)for(const b of eBlocks)stream.push(b[i]);
  const mod=Array.from({length:n},()=>new Int8Array(n));
  const fn=Array.from({length:n},()=>new Uint8Array(n));
  const setFn=(r,c,v)=>{if(r>=0&&r<n&&c>=0&&c<n){mod[r][c]=v?1:0;fn[r][c]=1}};
  const finder=(r0,c0)=>{
    for(let dr=-1;dr<=7;dr++)for(let dc=-1;dc<=7;dc++){
      const r=r0+dr,c=c0+dc;if(r<0||r>=n||c<0||c>=n)continue;
      const on=(dr>=0&&dr<=6&&dc>=0&&dc<=6)&&(dr===0||dr===6||dc===0||dc===6||(dr>=2&&dr<=4&&dc>=2&&dc<=4));
      setFn(r,c,on?1:0);
    }
  };
  finder(0,0);finder(0,n-7);finder(n-7,0);
  for(let i=8;i<n-8;i++){setFn(6,i,i%2===0?1:0);setFn(i,6,i%2===0?1:0)}
  for(const r0 of align)for(const c0 of align){
    if((r0<9&&c0<9)||(r0<9&&c0>=n-8)||(r0>=n-8&&c0<9))continue;
    for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
      setFn(r0+dr,c0+dc,Math.max(Math.abs(dr),Math.abs(dc))!==1?1:0);
    }
  }
  for(let i=0;i<9;i++){if(i!==6){fn[8][i]=1;fn[i][8]=1}}
  for(let i=0;i<8;i++){fn[8][n-1-i]=1;if(i<7)fn[n-1-i][8]=1}
  setFn(n-8,8,1);
  if(ver>=7){
    let rem=ver;
    for(let i=0;i<12;i++)rem=(rem<<1)^((rem>>>11)*0x1f25);
    const vbits=(ver<<12)|rem;
    for(let i=0;i<18;i++){
      const bit=(vbits>>>i)&1,a=Math.floor(i/3),b=n-11+(i%3);
      setFn(b,a,bit);setFn(a,b,bit);
    }
  }
  let bi=0;
  for(let right=n-1;right>=1;right-=2){
    if(right===6)right=5;
    const up=((right+1)&2)===0;
    for(let step=0;step<n;step++){
      const r=up?(n-1-step):step;
      for(let j=0;j<2;j++){
        const c=right-j;
        if(fn[r][c])continue;
        const bit=bi<stream.length*8?((stream[bi>>>3]>>>(7-(bi&7)))&1):0;
        mod[r][c]=bit;bi++;
      }
    }
  }
  const maskBit=(m,r,c)=>m===0?(r+c)%2===0:m===1?r%2===0:m===2?c%3===0:m===3?(r+c)%3===0:m===4?(Math.floor(r/2)+Math.floor(c/3))%2===0:m===5?(r*c)%2+(r*c)%3===0:m===6?((r*c)%2+(r*c)%3)%2===0:((r+c)%2+(r*c)%3)%2===0;
  const applyFmt=(mat,m)=>{
    const data=(1<<3)|m;
    let rem=data;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
    const fb=((data<<10)|rem)^0x5412;
    const p1=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    for(let i=0;i<15;i++){
      const b=(fb>>>(14-i))&1;
      mat[p1[i][0]][p1[i][1]]=b;
      if(i<7)mat[n-1-i][8]=b;else mat[8][n-15+i]=b;
    }
  };
  let best=null,bestPen=1e9;
  for(let m=0;m<8;m++){
    const cand=mod.map((row,r)=>{const nr=new Int8Array(row);for(let c=0;c<n;c++)if(!fn[r][c]&&maskBit(m,r,c))nr[c]^=1;return nr});
    applyFmt(cand,m);
    let pen=0,dark=0;
    for(let r=0;r<n;r++){
      let runR=1,runC=1;
      for(let c=0;c<n;c++){
        if(cand[r][c])dark++;
        if(c>0){if(cand[r][c]===cand[r][c-1]){runR++;if(runR===5)pen+=3;else if(runR>5)pen++}else runR=1}
        if(c>0){if(cand[c][r]===cand[c-1][r]){runC++;if(runC===5)pen+=3;else if(runC>5)pen++}else runC=1}
        if(r<n-1&&c<n-1&&cand[r][c]===cand[r][c+1]&&cand[r][c]===cand[r+1][c]&&cand[r][c]===cand[r+1][c+1])pen+=3;
      }
    }
    pen+=Math.floor(Math.abs(dark*100/(n*n)-50)/5)*10;
    if(pen<bestPen){bestPen=pen;best=cand}
  }
  return {n,ver,m:best};
}
function drawQrStamp(x,url,px,py,size,caption="SCAN TO COMPARE"){
  try{
    const qr=encodeQR(url);
    /* Integer-snapped module width + ISO/IEC 18004 4-module white quiet zone for 1:1 dark/light ratio & crisp phone scanning */
    const quietMod=4;
    const cell=Math.max(2,Math.floor(size/(qr.n+quietMod*2)));
    const gridPx=qr.n*cell;
    const boxW=Math.max(size,gridPx+cell*quietMod*2);
    const pad=Math.round((boxW-gridPx)/2);
    const capH=caption?22:0;
    const bx=Math.round(px+size-boxW),by=Math.round(py);
    const ox=bx+pad,oy=by+pad;
    x.save();
    x.fillStyle="#FFFFFF";
    x.beginPath();x.roundRect(bx,by,boxW,boxW+capH,12);x.fill();
    x.fillStyle="#0E1428";
    for(let r=0;r<qr.n;r++)for(let c=0;c<qr.n;c++){
      if(qr.m[r][c])x.fillRect(ox+c*cell,oy+r*cell,cell,cell);
    }
    if(caption){
      x.fillStyle="#374151";x.font="700 11px IBM Plex Mono, monospace";x.textAlign="center";
      x.fillText(caption,bx+boxW/2,by+boxW+12,boxW-10);
      x.textAlign="left";
    }
    x.restore();
  }catch(_){}
}

/* ---------- Share v2: swipeable 4-card preview + QR + native navigator.share({ files }) ---------- */
const SHARE_SLIDES=[
  {k:"card",title:"Story 9:16",dim:"1080×1920",fname:"my-life-in-games.png"},
  {k:"favs",title:"Top 10 Grid",dim:"1080×1440",fname:"my-favorite-games.png"},
  {k:"consoles",title:"Machines",dim:"1080×1920",fname:"my-consoles-and-favorites.png"},
  {k:"linkedin",title:"LinkedIn Ripple",dim:"1200×627",fname:"played-and-made-linkedin.png"}
];
let SHARE_CACHE={blobs:{},urls:{},imgMap:null,token:0};
function clearShareBlobUrls(){
  Object.values(SHARE_CACHE.urls||{}).forEach(u=>{try{URL.revokeObjectURL(u)}catch(_){}});
  SHARE_CACHE={blobs:{},urls:{},imgMap:null,token:(SHARE_CACHE.token||0)+1};
}
function buildShareCanvasForKind(kind,d,cleanName,imgMap){
  if(kind==="linkedin")return drawLinkedInCard(d,cleanName,imgMap);
  if(kind==="maker")return drawMakerCard(d,cleanName,imgMap);
  if(kind==="consoles")return drawConsolesCard(d,cleanName,imgMap);
  if(kind==="favs")return drawFavsCard(d,cleanName,imgMap);
  if(kind==="card")return drawCard(d,cleanName,imgMap);
  return drawWallpaper(d,cleanName?cleanName+"'s":null,imgMap);
}
async function renderShareCarouselPreviews(){
  const tok=++SHARE_CACHE.token;
  const gs=[...new Set(["card","favs","consoles","linkedin"].flatMap(k=>renderedGamesForPng(k,hist)))];
  const imgMap=await preloadCoverImages(gs,5200);
  if(tok!==SHARE_CACHE.token)return;
  SHARE_CACHE.imgMap=imgMap;
  for(let i=0;i<SHARE_SLIDES.length;i++){
    if(tok!==SHARE_CACHE.token)return;
    const s=SHARE_SLIDES[i];
    const stage=$(`#shareStage-${s.k}`);if(!stage)continue;
    try{
      let cv=buildShareCanvasForKind(s.k,hist,null,imgMap),blob=null;
      try{blob=await new Promise((res,rej)=>{try{cv.toBlob(b=>b?res(b):rej(new Error("e")),"image/png")}catch(err){rej(err)}})}
      catch(_){cv=buildShareCanvasForKind(s.k,hist,null,null);blob=await new Promise(r=>cv.toBlob(r,"image/png"))}
      if(!blob||tok!==SHARE_CACHE.token)continue;
      if(SHARE_CACHE.urls[s.k])try{URL.revokeObjectURL(SHARE_CACHE.urls[s.k])}catch(_){}
      const u=URL.createObjectURL(blob);
      SHARE_CACHE.blobs[s.k]=blob;SHARE_CACHE.urls[s.k]=u;
      stage.innerHTML=`<img class="share-preview-img" src="${u}" alt="${esc(s.title)} share card preview">`;
    }catch(_){}
  }
}
function syncShareSlideUI(idx){
  state.shareSlide=Math.max(0,Math.min(SHARE_SLIDES.length-1,idx));
  $$(".share-dot").forEach((b,i)=>b.setAttribute("aria-current",i===state.shareSlide?"true":"false"));
  const s=SHARE_SLIDES[state.shareSlide];
  const dl=$("#shareSlideDlBtn"),ns=$("#shareSlideNativeBtn");
  if(dl)dl.textContent=`Download ${s.title} PNG`;
  if(ns)ns.textContent=`Share ${s.title}…`;
}
function scrollShareToSlide(idx){
  const clamped=Math.max(0,Math.min(SHARE_SLIDES.length-1,idx));
  syncShareSlideUI(clamped);
  const deck=$("#shareDeck");
  if(deck)deck.scrollTo({left:clamped*(deck.clientWidth+12),behavior:prefersReducedMotion()?"auto":"smooth"});
}
function canNativeShareFiles(){
  try{
    if(!navigator.share||!navigator.canShare||typeof File==="undefined")return false;
    return navigator.canShare({files:[new File(["x"],"t.png",{type:"image/png"})]});
  }catch(_){return false}
}
async function shareOrDownloadSlide(kind,nativeMode){
  const s=SHARE_SLIDES.find(x=>x.k===kind)||SHARE_SLIDES[0];
  let blob=SHARE_CACHE.blobs[s.k];
  if(!blob){
    toast("Rendering high-res card…");
    const gs=renderedGamesForPng(s.k,hist);
    const imgMap=SHARE_CACHE.imgMap||await preloadCoverImages(gs,3500);
    try{const cv=buildShareCanvasForKind(s.k,hist,null,imgMap);blob=await new Promise((res,rej)=>{try{cv.toBlob(b=>b?res(b):rej(0),"image/png")}catch(e){rej(e)}})}
    catch(_){const cv2=buildShareCanvasForKind(s.k,hist,null,null);blob=await new Promise(r=>cv2.toBlob(r,"image/png"))}
    if(blob)SHARE_CACHE.blobs[s.k]=blob;
  }
  if(!blob){toast("Couldn't generate card");return}
  if(nativeMode&&canNativeShareFiles()){
    try{
      const file=new File([blob],s.fname,{type:"image/png"});
      await navigator.share({files:[file],title:`${hist.name?hist.name+"'s":"My"} life in games · Played & Made`,text:`Compare our gaming timelines on playedmade.com`});
      trackEvent("share_png_native",s.k);
      return;
    }catch(err){if(err&&err.name==="AbortError")return}
  }
  const u=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=u;a.download=s.fname;document.body.appendChild(a);a.click();a.remove();
  trackEvent("export_png",s.k);
  toast(`Downloaded ${s.fname}`);
  setTimeout(()=>{try{URL.revokeObjectURL(u)}catch(_){}},8000);
}
function openShare(){
  clearShareBlobUrls();
  const st=timelineStats(hist),url=currentShareURL();
  const canWebShare=!!navigator.share,canFiles=canNativeShareFiles();
  const eraLbl=eraKidLabel(hist)||"'90s kid";
  const curIdx=Math.max(0,Math.min(SHARE_SLIDES.length-1,state.shareSlide||0));
  const curSlide=SHARE_SLIDES[curIdx];
  openSheet(`<div class="sheethead"><div><h2>Share &amp; export your timeline</h2></div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="row" style="gap:10px;align-items:flex-end">
      <label class="field" for="shareName" style="flex:1;min-width:160px">Name on your timeline<input class="input" id="shareName" maxlength="24" placeholder="Your first name" value="${esc(hist.name||"")}"></label>
    </div>
    <div class="share-deck-wrap">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="eyebrow" style="margin:0">Card preview</span>
        <div class="row" style="gap:4px">
          <button type="button" class="btn sm" data-act="shareSlidePrev" aria-label="Previous card">◂</button>
          <button type="button" class="btn sm" data-act="shareSlideNext" aria-label="Next card">▸</button>
        </div>
      </div>
      <div class="share-deck" id="shareDeck" role="region" aria-label="Share card previews">
        ${SHARE_SLIDES.map((s,i)=>`<div class="share-slide" data-slide="${i}">
          <div class="share-slide-head"><b>${esc(s.title)}</b><span class="mono muted" style="font-size:11.5px">${s.dim}</span></div>
          <div class="share-slide-stage" id="shareStage-${s.k}"><span class="sync" style="color:var(--muted)">Rendering ${esc(s.title)}…</span></div>
        </div>`).join("")}
      </div>
      <div class="share-dots" role="tablist" aria-label="Choose share card">${SHARE_SLIDES.map((s,i)=>`<button type="button" class="share-dot" data-act="shareSlideDot" data-i="${i}" aria-label="${esc(s.title)}" aria-current="${i===curIdx?"true":"false"}"></button>`).join("")}</div>
      <div class="row" style="margin-top:10px;justify-content:center;gap:8px">
        ${canFiles?`<button type="button" class="btn primary" id="shareSlideNativeBtn" data-act="shareCardNative">Share ${esc(curSlide.title)}…</button>`:""}
        <button type="button" class="btn ${canFiles?"":"primary"}" id="shareSlideDlBtn" data-act="shareCardDl">Download ${esc(curSlide.title)} PNG</button>
      </div>
    </div>
    <div class="sharebox" style="margin-top:14px"><input class="input" id="shareLink" readonly value="${esc(url)}" aria-label="Your timeline link"><button class="btn" data-act="copyShare">Copy challenge link</button></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin:10px 0 12px;padding:10px 12px;border-radius:10px;background:var(--card);border:1px solid var(--line)">
      <span class="eyebrow" style="margin:0">Privacy options (opt-in — OFF by default)</span>
      ${hist.birth?`<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer"><input type="checkbox" id="shareBirthChk" ${state.shareBirth?"checked":""}><span>Include exact birth year (${hist.birth}) — off uses <b>${esc(eraLbl)}</b></span></label>`:""}
      <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer"><input type="checkbox" id="shareNotesChk" ${state.shareNotes?"checked":""}><span>Include personal memory notes &amp; tags in shared link</span></label>
    </div>
    <div class="row" style="margin-top:8px;gap:6px">
      ${canWebShare?`<button class="btn sm" data-act="webShare">Share link…</button>`:""}
      <button class="btn sm" data-act="png" data-kind="wall">4K Poster</button>
      <button class="btn sm" data-act="boxPile">Box Pile</button>
      ${st.wk?`<button class="btn sm craft" data-act="png" data-kind="maker">🛠 Vertical Maker PNG</button>`:""}
      <button class="btn sm" data-act="emailSelf">Email to self</button>
      <button class="btn sm" data-act="dlJson">Backup .json</button>
    </div><div id="imgout"></div>`,"Share",{wide:true});
  const deck=$("#shareDeck");
  if(deck){
    let stT=0;
    deck.addEventListener("scroll",()=>{clearTimeout(stT);stT=setTimeout(()=>{const w=deck.clientWidth+12;if(w>0)syncShareSlideUI(Math.round(deck.scrollLeft/w))},70)},{passive:true});
    if(curIdx>0)requestAnimationFrame(()=>deck.scrollTo({left:curIdx*(deck.clientWidth+12),behavior:"auto"}));
  }
  let rerenderT=0;
  const syncShareUrl=(rerender=false)=>{
    const sl=$("#shareLink");if(sl)sl.value=currentShareURL();
    if(rerender){clearTimeout(rerenderT);rerenderT=setTimeout(()=>renderShareCarouselPreviews(),260)}
  };
  $("#shareName").addEventListener("input",e=>{hist.name=e.target.value.trim().slice(0,24);save();syncShareUrl(true)});
  const sb=$("#shareBirthChk"),sn=$("#shareNotesChk");
  if(sb)sb.addEventListener("change",()=>{state.shareBirth=sb.checked;syncShareUrl(true)});
  if(sn)sn.addEventListener("change",()=>{state.shareNotes=sn.checked;syncShareUrl(false)});
  renderShareCarouselPreviews();
}
function openSettings(){
  const artEra=document.documentElement.dataset.art==="era";
  const hasStash=!!store.get("ib3-stashed-hist");
  openSheet(`<div class="sheethead"><h2>Timeline settings</h2><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    <form id="setForm" class="row" style="align-items:flex-end"><label class="field" for="setBirth" style="flex:1">Birth year (optional)<input class="input" id="setBirth" inputmode="numeric" maxlength="4" placeholder="1984" value="${hist.birth||""}"></label><label class="field" for="setName" style="flex:2">Name<input class="input" id="setName" maxlength="24" value="${esc(hist.name||"")}"></label><button class="btn primary" type="submit">Save</button></form>
    <div class="row" style="margin-top:14px"><button class="btn primary" data-act="obAgain">Pick games</button><button class="btn" data-act="steamImport">Import from Steam</button><button class="btn" data-act="obSystems">Filter systems</button><button class="btn" type="button" data-act="featureSheet">Request console / game</button><button class="btn" data-act="theme">Switch theme</button><button class="btn" data-act="artToggle">${artEra?"Use box art":"Use retro era spines"}</button>${canInstallApp()?`<button class="btn" type="button" data-act="installApp" data-install-ui>Install app</button>`:isStandaloneApp()?`<span class="pill craft">✓ Installed app</span>`:""}</div>
    <h3 class="h3" style="margin-top:16px">Preferences</h3>
    <div class="row">
      <button type="button" class="chip" data-act="sfxToggle" aria-pressed="${!!SYNTH.sfx}">Sound effects: ${SYNTH.sfx?"On":"Off"}</button>
      <button type="button" class="chip" data-act="eraMemTog" aria-pressed="${!!state.eraMem}">Era headlines: ${state.eraMem?"On":"Off"}</button>
      <button type="button" class="chip ${isDevMode()?"craftchip":""}" data-act="devModeTog" aria-pressed="${isDevMode()}">🛠 Work in games (Maker mode): ${isDevMode()?"On":"Off"}</button>
    </div>
    ${DEV_QUERY||hasStash?`<h3 class="h3" style="margin-top:16px">Visitor onboarding preview</h3>
      <p class="sub">Test the fresh visitor flow without losing your saved timeline.</p>
      <div class="row">${hasStash?`<button type="button" class="btn primary" data-act="sandboxExit">◂ Return to my saved timeline</button>`:`<button type="button" class="btn" data-act="sandboxEnter">Test new-visitor onboarding</button>`}</div>`:""}
    <h3 class="h3" style="margin-top:16px">Backup &amp; restore</h3>
    <p class="sub">Your timeline saves automatically in this browser. Export or import a JSON backup anytime.</p>
    <div class="row"><button class="btn sm" data-act="dlJson">Export backup (.json)</button><label class="btn sm" style="cursor:pointer">Import backup (.json)<input type="file" id="impJson" accept=".json,application/json" hidden></label></div>
    <h3 class="h3" style="margin-top:16px">Start over</h3><p class="sub">Removes every game from your timeline on this device.</p><button class="btn" data-act="resetAsk">Clear my timeline</button><div id="resetBox"></div>`,"Settings");
  $("#setForm").onsubmit=e=>{e.preventDefault();const raw=$("#setBirth").value.trim(),y=parseInt(raw,10);if(!raw){hist.birth=null}else if(y>=1940&&y<=NOW-3){hist.birth=y;hist.era=String(Math.floor(y/10)*10).slice(-2)+"s"}hist.name=$("#setName").value.trim().slice(0,24);save();closeLayer();toast("Saved")};
  const imp=$("#impJson");if(imp)imp.onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const raw=JSON.parse(await f.text());const c=cleanTimeline(raw);if(!c.birth&&!c.era&&!Object.keys(c.years||{}).length)throw 0;hist=c;save();closeLayer();toast("Timeline restored");go("timeline")}catch(err){toast("Couldn't read that backup file")}};
}
function syncTop10Dom(list){
  const rows=[...list.querySelectorAll(".t10-row")];
  hist.top10=rows.map(r=>r.dataset.k);
  rows.forEach((r,i)=>{
    const num=r.querySelector(".t10-num");if(num)num.textContent=String(i+1);
    const up=r.querySelector('[data-act="t10up"]'),dn=r.querySelector('[data-act="t10down"]');
    if(up)up.disabled=i===0;
    if(dn)dn.disabled=i===rows.length-1;
  });
  save();
}
function reorderTop10Dom(list,rowEl,targetEl,after=false,onDone=null){
  if(!list||!rowEl||rowEl===targetEl)return;
  const doMove=()=>{
    const ref=after?(targetEl?targetEl.nextElementSibling:null):targetEl;
    if(typeof list.moveBefore==="function")list.moveBefore(rowEl,ref);
    else list.insertBefore(rowEl,ref);
    syncTop10Dom(list);
    if(typeof onDone==="function")onDone();
  };
  if(document.startViewTransition&&!prefersReducedMotion()){
    try{const vt=document.startViewTransition(doMove);if(vt&&vt.ready)vt.ready.catch(()=>{});if(vt&&vt.finished)vt.finished.catch(()=>{})}catch(_){doMove()}
  }else doMove();
  haptic(8);
}
function openTop10(){
  const favs=entries(hist).filter(x=>x.lv===3&&x.g);hist.top10=(hist.top10||[]).filter(k=>favs.some(f=>f.g.n===k||norm1(f.g.title)===k)).map(k=>{const f=favs.find(f=>f.g.n===k||norm1(f.g.title)===k);return f.g.n});
  const inT=new Set(hist.top10);const ranked=hist.top10.map(k=>favs.find(f=>f.g.n===k));const rest=favs.filter(f=>!inT.has(f.g.n)).sort((a,b)=>a.y-b.y);
  const rankedRow=(f,i)=>`<div class="t10-row" data-k="${esc(f.g.n)}"><button type="button" class="t10-grab" aria-label="Drag ${esc(f.g.title)} to reorder" title="Drag to reorder">⠿</button><span class="mono t10-num" style="font-size:15px;text-align:right">${i+1}</span>${cover(f.g,{showYear:false})}<span><b>${esc(f.g.title)}</b><small style="display:block;color:var(--muted)">${f.y}</small></span>
    <span class="row" style="gap:4px"><button type="button" class="btn sm" data-act="t10up" data-k="${esc(f.g.n)}" ${i===0?"disabled":""} aria-label="Move ${esc(f.g.title)} up">▲</button><button type="button" class="btn sm" data-act="t10down" data-k="${esc(f.g.n)}" ${i===ranked.length-1?"disabled":""} aria-label="Move ${esc(f.g.title)} down">▼</button><button type="button" class="btn sm ghost" data-act="t10rm" data-k="${esc(f.g.n)}" aria-label="Remove ${esc(f.g.title)} from top 10">×</button></span></div>`;
  const restRow=f=>`<div class="anc" style="grid-template-columns:40px minmax(0,1fr) auto">${cover(f.g,{showYear:false})}<span><b>${esc(f.g.title)}</b><small>${f.y}</small></span>
    <button type="button" class="btn sm" data-act="t10add" data-k="${esc(f.g.n)}" ${ranked.length>=10?"disabled":""}>+ Top 10</button></div>`;
  openSheet(`<div class="sheethead"><div><h2>Rank your top 10</h2><p class="sub" style="margin:2px 0 0">Drag <b>⠿</b> or use ▲/▼ to rank from your ${plural(favs.length,"favorite")}. ${10-ranked.length>0?plural(10-ranked.length,"spot")+" left.":"All ten picked."}</p></div><button class="x" data-act="closeLayer" aria-label="Close">×</button></div>
    ${ranked.length?`<div class="t10-list" id="t10List">${ranked.map((f,i)=>rankedRow(f,i)).join("")}</div>`:`<p class="empty">Add favorites from the list below.</p>`}
    ${rest.length?`<h3 class="h3" style="margin-top:16px">Other favorites</h3>${rest.map(restRow).join("")}`:""}`,"Top 10");
  const list=$("#t10List");
  if(list){
    let drag=null;
    const clearDrop=()=>list.querySelectorAll(".drop-over,.drop-after").forEach(el=>el.classList.remove("drop-over","drop-after"));
    list.addEventListener("pointerdown",ev=>{
      const handle=ev.target.closest(".t10-grab");if(!handle||ev.button!==0)return;
      const row=handle.closest(".t10-row");if(!row)return;
      ev.preventDefault();
      drag={pid:ev.pointerId,row,handle,target:null,after:false,title:row.querySelector("b")?.textContent||"Game"};
      row.classList.add("lifting");
      try{handle.setPointerCapture(ev.pointerId)}catch(_){}
    });
    list.addEventListener("pointermove",ev=>{
      if(!drag||ev.pointerId!==drag.pid)return;
      clearDrop();
      const rows=[...list.querySelectorAll(".t10-row")].filter(r=>r!==drag.row);
      let best=null,after=false;
      for(const r of rows){
        const b=r.getBoundingClientRect();
        if(ev.clientY<b.top+b.height/2){best=r;after=false;break}
        best=r;after=true;
      }
      drag.target=best;drag.after=after;
      if(best)best.classList.add(after?"drop-after":"drop-over");
    });
    const endDrag=ev=>{
      if(!drag||(ev&&ev.pointerId!==drag.pid))return;
      const {row,target,after,title}=drag;
      drag=null;row.classList.remove("lifting");clearDrop();
      if(target&&target!==row){
        reorderTop10Dom(list,row,target,after,()=>{
          const pos=[...list.querySelectorAll(".t10-row")].indexOf(row)+1;
          announceSR(`${title} moved to rank ${pos}`);
        });
      }
    };
    list.addEventListener("pointerup",endDrag);
    list.addEventListener("pointercancel",endDrag);
  }
}
/* ---------- poster wall & interactive 2D physics box pile ---------- */
function openPoster(d,name){
  d=d||hist;
  const es=entries(d),byY={};es.forEach(x=>(byY[x.y]=byY[x.y]||[]).push(x));
  const ys=Object.keys(byY).map(Number);if(!ys.length){toast("Add some games first");return}
  clearLayer();
  const mode=state.posterMode||"wall",reduced=prefersReducedMotion();
  const from=Math.min(...(d.birth?[d.birth,...ys]:ys)),to=Math.max(...ys);
  let cols="";
  if(mode==="wall"){
    for(let y=from;y<=to;y++){const xs=(byY[y]||[]).sort((a,b)=>b.lv-a.lv);
      cols+=`<div class="wcol${xs.length?"":" e"}"><div class="wh">${y}<small>${d.birth&&y-d.birth>=0?"age "+(y-d.birth):""}</small></div>${xs.slice(0,6).map((x,i)=>`<div class="tile lv${x.lv}${i>2?" s":""}">${coverOfEntry(x.e,y,{showYear:false,attrs:`data-k="${esc(norm(x.e.t))}"`})}${x.lv===3?`<span class="lvb l3">♥</span>`:""}</div>`).join("")}${xs.length>6?`<div class="rest">+${xs.length-6}</div>`:""}</div>`}
  }
  $("#layer").innerHTML=`<div class="ov" role="dialog" aria-label="Poster and Box Pile"><div class="wrap ovhead" style="flex-wrap:wrap">
      <div class="row" style="gap:10px"><button type="button" class="navback" data-act="closeLayer">◂ Back</button><div><h2>${esc(name||(d.name?d.name+"'s":"My"))} ${mode==="pile"?"game box pile":"gaming years"}</h2><p class="sync" style="margin:2px 0 0">${mode==="pile"?(reduced?"Static desk spread (Reduced Motion enabled) · Drag boxes or double-click any box to inspect.":"Grab & fling your favorite boxes · Double-click any box to inspect it."):"Lines show where one of these games inspired another."}</p></div></div>
      <div class="row" style="gap:6px">
        <span class="seg" role="group" aria-label="View"><button type="button" data-act="posterMode" data-m="wall" aria-pressed="${mode==="wall"}">Timeline Wall</button><button type="button" data-act="posterMode" data-m="pile" aria-pressed="${mode==="pile"}">Box Pile</button></span>
        ${mode==="pile"?(reduced?`<button type="button" class="btn sm" data-act="pileToss">Reshuffle desk</button>`:`<button type="button" class="btn sm" data-act="pileToss">Toss pile</button><button type="button" class="btn sm" id="pileZeroBtn" data-act="pileZeroG" aria-pressed="false">Zero-G: Off</button>`):`<button class="btn sm" data-act="png" data-kind="wall" data-who="${name?"friend":"me"}">Save 4K poster</button>`}
        <button class="x" data-act="closeLayer" aria-label="Close">×</button>
      </div>
    </div>
    ${mode==="pile"
      ?`<div class="ovbody" id="posterBody" style="overflow:hidden;display:flex;flex-direction:column"><canvas id="pileCanvas" style="flex:1;width:100%;height:100%;display:block;touch-action:none;cursor:grab"></canvas></div>`
      :`<div class="ovbody" id="posterBody" tabindex="0" role="region" aria-label="4K timeline poster"><div class="wall" id="wall"><svg class="lines" id="wallLines"></svg>${cols}</div></div>`}
  </div>`;
  if(mode==="pile")requestAnimationFrame(()=>initBoxPile(d));
  else requestAnimationFrame(()=>drawWallLines(d));
}
function initBoxPile(d){
  const cv=$("#pileCanvas");if(!cv)return;
  const x=cv.getContext("2d");
  const reduced=prefersReducedMotion();
  const sorted=entries(d).slice().sort((a,b)=>b.lv-a.lv||((b.g&&b.g.pop)||0)-((a.g&&a.g.pop)||0)).slice(0,32);
  let W=800,H=560,dpr=1,zeroG=false;
  const initW=Math.max(300,cv.clientWidth||800),initH=Math.max(260,cv.clientHeight||560);
  const bw=Math.max(66,Math.min(112,Math.round(Math.sqrt(initW*initH/Math.max(12,sorted.length*3.6))))),bh=Math.round(bw*1.34);
  const bodies=sorted.map((it,idx)=>{
    const g=it.g,im=g&&g.img?new Image():null;
    const cols=Math.max(3,Math.floor((initW-80)/(bw+12)));
    const cx=60+(idx%cols)*(bw+12)+bw/2+(Math.random()-.5)*18;
    const cy=reduced?(70+Math.floor(idx/cols)*(bh*0.86)+bh/2):Math.max(bh,initH*0.18-Math.floor(idx/cols)*(bh*0.92));
    const b={it,g,im,title:g?g.title:it.e.t,year:it.y,lv:it.lv,h:g?g.h:hueOf(norm(it.e.t)),gl:g?glyphOf(g):"stick",w:bw,hh:bh,x:Math.min(initW-bw/2-12,Math.max(bw/2+12,cx)),y:cy,vx:(Math.random()-.5)*3,vy:Math.random()*2,ang:((idx%5)-2)*0.045,va:(Math.random()-.5)*0.03};
    if(im){if(reduced)im.onload=()=>drawStatic();im.src=g.img}
    return b;
  });
  const drawBodies=()=>{
    x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
    bodies.forEach(b=>{
      x.save();x.translate(b.x,b.y);x.rotate(b.ang);
      const bx=-b.w/2,by=-b.hh/2;
      x.fillStyle="rgba(0,0,0,.28)";x.beginPath();x.roundRect(bx+3,by+5,b.w,b.hh,7);x.fill();
      if(b.im&&b.im.complete&&b.im.naturalWidth>20){
        x.save();x.beginPath();x.roundRect(bx,by,b.w,b.hh,7);x.clip();
        x.drawImage(b.im,bx,by,b.w,b.hh);x.restore();
      }else{
        canvasCover(x,b.title,b.year,b.h,b.gl,bx,by,b.w,b.hh);
      }
      x.strokeStyle=b.lv===3?"#FF6E5A":b.lv===2?"#8C9DFF":"rgba(255,255,255,.35)";
      x.lineWidth=b.lv>=2?3:1.5;x.beginPath();x.roundRect(bx,by,b.w,b.hh,7);x.stroke();
      x.restore();
    });
  };
  const layoutStatic=()=>{
    const cols=Math.max(3,Math.floor((W-64)/(bw+10))),rows=Math.max(1,Math.ceil(bodies.length/cols));
    const stepX=(W-bw-48)/Math.max(1,cols-1),stepY=Math.min(bh*0.88,(H-bh-48)/Math.max(1,rows-1));
    bodies.forEach((b,idx)=>{
      const c=idx%cols,r=Math.floor(idx/cols);
      b.x=Math.max(b.w/2+12,Math.min(W-b.w/2-12,24+b.w/2+c*stepX+((r%2)?14:-10)));
      b.y=Math.max(b.hh/2+12,Math.min(H-b.hh/2-12,24+b.hh/2+r*stepY));
      b.ang=(((idx*7)%9)-4)*0.032;
    });
  };
  const drawStatic=()=>{if(!cv.isConnected)return;drawBodies()};
  const resize=()=>{const r=cv.getBoundingClientRect();W=Math.max(300,r.width);H=Math.max(260,r.height);dpr=Math.min(2,window.devicePixelRatio||1);cv.width=W*dpr;cv.height=H*dpr;if(reduced){layoutStatic();drawStatic()}};
  resize();addEventListener("resize",resize);
  let grab=null;
  const hitBody=(px,py)=>{
    for(let i=bodies.length-1;i>=0;i--){
      const b=bodies[i],dx=px-b.x,dy=py-b.y,ca=Math.cos(-b.ang),sa=Math.sin(-b.ang);
      const lx=dx*ca-dy*sa,ly=dx*sa+dy*ca;
      if(Math.abs(lx)<=b.w/2&&Math.abs(ly)<=b.hh/2)return {b,i,lx,ly};
    }
    return null;
  };
  cv.addEventListener("pointerdown",ev=>{
    if(ev.button!==0)return;
    const r=cv.getBoundingClientRect(),px=ev.clientX-r.left,py=ev.clientY-r.top,h=hitBody(px,py);
    if(!h)return;
    bodies.splice(h.i,1);bodies.push(h.b);
    grab={id:ev.pointerId,b:h.b,px,py,lx:px,ly:py};
    cv.setPointerCapture(ev.pointerId);cv.style.cursor="grabbing";
    if(reduced)drawStatic();
  });
  cv.addEventListener("pointermove",ev=>{
    if(!grab||ev.pointerId!==grab.id)return;
    const r=cv.getBoundingClientRect();grab.lx=grab.px;grab.ly=grab.py;grab.px=ev.clientX-r.left;grab.py=ev.clientY-r.top;
    if(reduced){grab.b.x=grab.px;grab.b.y=grab.py;drawStatic()}
  });
  const endGrab=ev=>{if(!grab||(ev&&ev.pointerId!==grab.id))return;grab=null;cv.style.cursor="grab"};
  cv.addEventListener("pointerup",endGrab);
  cv.addEventListener("lostpointercapture",()=>endGrab());
  cv.addEventListener("dblclick",ev=>{const r=cv.getBoundingClientRect(),h=hitBody(ev.clientX-r.left,ev.clientY-r.top);if(h&&h.b.g)openQuickLook(h.b.g)});
  if(reduced){
    PILE={raf:0,resize,toss(){bodies.sort(()=>Math.random()-.5);layoutStatic();drawStatic();playBlip(2)},toggleZeroG(){}};
    return;
  }
  const minDist=bw*0.78;
  const step=()=>{
    if(!PILE)return;
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i];
      if(grab&&grab.b===b){
        b.vx=(grab.px-b.x)*0.38;b.vy=(grab.py-b.y)*0.38;
        b.x=grab.px;b.y=grab.py;b.va+=(grab.px-grab.lx)*0.002;b.va*=0.82;b.ang+=b.va;
        continue;
      }
      if(!zeroG)b.vy+=0.42;
      b.vx*=zeroG?0.992:0.985;b.vy*=zeroG?0.992:0.985;b.va*=0.94;
      b.x+=b.vx;b.y+=b.vy;b.ang+=b.va;
      const rx=b.w*0.52,ry=b.hh*0.52;
      if(b.x<rx){b.x=rx;b.vx=Math.abs(b.vx)*0.55}
      if(b.x>W-rx){b.x=W-rx;b.vx=-Math.abs(b.vx)*0.55}
      if(b.y<ry&&zeroG){b.y=ry;b.vy=Math.abs(b.vy)*0.65}
      if(b.y>H-ry){b.y=H-ry;b.vy=-Math.abs(b.vy)*(zeroG?0.72:0.42);b.vx*=0.88;b.ang*=0.90;if(Math.abs(b.vy)<0.5&&!zeroG)b.vy=0}
    }
    for(let pass=0;pass<2;pass++){
      for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
        const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
        if(d2>0.01&&d2<minDist*minDist){
          const dist=Math.sqrt(d2),ov=(minDist-dist)*0.36,nx=dx/dist,ny=dy/dist;
          if(!grab||grab.b!==a){a.x-=nx*ov;a.y-=ny*ov;a.vx-=nx*ov*0.18;a.vy-=ny*ov*0.18}
          if(!grab||grab.b!==b){b.x+=nx*ov;b.y+=ny*ov;b.vx+=nx*ov*0.18;b.vy+=ny*ov*0.18}
        }
      }
    }
    drawBodies();
    PILE.raf=requestAnimationFrame(step);
  };
  PILE={
    raf:requestAnimationFrame(step),
    resize,
    toss(){bodies.forEach(b=>{b.vy=-9-Math.random()*9;b.vx=(Math.random()-.5)*14;b.va=(Math.random()-.5)*0.22});playBlip(2)},
    toggleZeroG(){zeroG=!zeroG;if(zeroG)bodies.forEach(b=>{b.vy=(Math.random()-.5)*5;b.vx=(Math.random()-.5)*5});const btn=$("#pileZeroBtn");if(btn){btn.setAttribute("aria-pressed",zeroG);btn.textContent=`Zero-G: ${zeroG?"On":"Off"}`}}
  };
}
function wallLinks(d){const ks=new Map();entries(d).forEach(x=>{if(x.g)ks.set(x.g.i,norm(x.e.t))});return L.filter(l=>ks.has(l.from)&&ks.has(l.to)).map(l=>({l,a:ks.get(l.from),b:ks.get(l.to)}))}
function drawWallLines(d){const wall=$("#wall"),svg=$("#wallLines");if(!wall||!svg)return;svg.setAttribute("width",wall.offsetWidth);svg.setAttribute("height",wall.offsetHeight);
  const box=k=>{const el=wall.querySelector(`[data-k="${CSS.escape(k)}"]`);if(!el)return null;let x=0,y=0,n=el;while(n&&n!==wall){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent}return n===wall?{x,y,w:el.offsetWidth,h:el.offsetHeight}:null};
  svg.innerHTML=wallLinks(d).map(({l,a,b})=>{const A=box(a),B=box(b);if(!A||!B)return "";const x1=A.x+A.w,y1=A.y+A.h/2,x2=B.x,y2=B.y+B.h/2,dx=Math.max(30,Math.abs(x2-x1)/2);
    return `<path d="M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}" fill="none" stroke="${cssVar(TIERS[l.t].c)}" stroke-width="2" opacity=".75"/>`}).join("")}
function canvasCover(x,title,year,h,glyph,bx,by,w,hh){
  const g=x.createLinearGradient(bx,by,bx+w,by+hh);g.addColorStop(0,`hsl(${h} 55% 42%)`);g.addColorStop(1,`hsl(${h+35} 60% 18%)`);
  x.fillStyle=g;x.beginPath();x.roundRect(bx,by,w,hh,Math.max(4,w*.05));x.fill();
  const gi=GLYPH_IMG[glyph];if(gi){x.imageSmoothingEnabled=false;const s=Math.round(w*.22/8)*8||8;x.globalAlpha=.9;x.drawImage(gi,bx+w*.08,by+hh-s-w*.08,s,s);x.globalAlpha=1}
  x.fillStyle="#fff";const fs=Math.max(9.5,Math.min(18,w*.098));x.font=`700 ${fs}px Unbounded, Arial Black, sans-serif`;wrapText(x,title,bx+w*.09,by+fs*1.55,w*.82,fs*1.16,4);
}
function preloadCoverImages(games,timeoutMs=4500){
  if(document.documentElement.dataset.art==="era")return Promise.resolve(new Map());
  const urls=[...new Set((games||[]).map(g=>g&&g.img).filter(Boolean))];
  if(!urls.length)return Promise.resolve(new Map());
  const map=new Map();
  return new Promise(resolve=>{
    let left=urls.length,done=false;
    const finish=()=>{if(!done){done=true;resolve(map)}};
    const tm=setTimeout(finish,timeoutMs);
    urls.forEach(u=>{
      const im=new Image();
      im.crossOrigin="anonymous";
      im.onload=()=>{if(im.naturalWidth>20&&im.naturalHeight>20)map.set(u,im);if(--left<=0){clearTimeout(tm);finish()}};
      im.onerror=()=>{if(--left<=0){clearTimeout(tm);finish()}};
      im.src=u;
    });
  });
}
function drawCoverOrBox(x,g,title,year,h,glyph,bx,by,w,hh,imgMap){
  const im=g&&g.img&&imgMap&&imgMap.get(g.img);
  if(im&&im.naturalWidth>20&&im.naturalHeight>20){
    const r=Math.max(4,w*.05),iw=im.naturalWidth,ih=im.naturalHeight,ar=iw/ih;
    const isLogo=/\.svg\.png|Logo\.|_logo\./i.test(g.img);
    x.save();x.imageSmoothingEnabled=true;
    x.beginPath();x.roundRect(bx,by,w,hh,r);x.clip();
    if(isLogo){
      x.fillStyle="#EEF2FA";x.fillRect(bx,by,w,hh);
      const pad=w*0.1,mw=w-pad*2,mh=hh-pad*2,sc=Math.min(mw/iw,mh/ih),dw=iw*sc,dh=ih*sc;
      x.drawImage(im,bx+(w-dw)/2,by+(hh-dh)/2,dw,dh);
    }else if(ar>1.55){
      /* Wraparound scan (back|spine|front): anchor to front cover on right */
      x.fillStyle="#0D111C";x.fillRect(bx,by,w,hh);
      const sc=Math.max(w/iw,hh/ih),dw=iw*sc,dh=ih*sc;
      x.drawImage(im,bx+w-dw,by+(hh-dh)/2,dw,dh);
    }else if(ar>0.96){
      /* Square/landscape box art (SNES/N64/Game Boy/PS1 jewel): full cover inside subtle frame */
      x.fillStyle="#0D111C";x.fillRect(bx,by,w,hh);
      const sc=Math.min(w/iw,hh/ih),dw=iw*sc,dh=ih*sc;
      x.drawImage(im,bx+(w-dw)/2,by+(hh-dh)/2,dw,dh);
    }else{
      x.fillStyle="#0D111C";x.fillRect(bx,by,w,hh);
      const sc=Math.max(w/iw,hh/ih),dw=iw*sc,dh=ih*sc;
      x.drawImage(im,bx+(w-dw)/2,by+(hh-dh)*0.22,dw,dh);
    }
    x.restore();
    return;
  }
  canvasCover(x,title,year,h,glyph,bx,by,w,hh);
}
function wrapText(x,text,px,py,maxW,lh,maxLines){
  const words=String(text).split(/\s+/).filter(Boolean);let line="",n=0;
  for(let i=0;i<words.length;i++){
    const w=words[i],t=line?line+" "+w:w;
    if(x.measureText(t).width>maxW&&line){
      if(n>=maxLines-1){
        let ell=line;while(ell.length>1&&x.measureText(ell+"…").width>maxW)ell=ell.slice(0,-1);
        x.fillText(ell.trimEnd()+"…",px,py+n*lh);return;
      }
      x.fillText(line,px,py+n*lh);n++;line=w;
    }else line=t;
  }
  if(line&&n<maxLines)x.fillText(line,px,py+n*lh,maxW);
}
function pngEraBadge(d){
  if(state.shareBirth&&d&&d.birth)return `born ${d.birth}`;
  return eraKidLabel(d)||"Life in Games";
}
function drawWallpaper(d,name,imgMap){
  const W=3840,H=2160,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const es=entries(d),byY={};es.forEach(e=>(byY[e.y]=byY[e.y]||[]).push(e));const ys=Object.keys(byY).map(Number);
  if(!ys.length)return cv;
  const from=(state.shareBirth&&d.birth)?Math.min(d.birth,...ys):Math.min(...ys),to=Math.max(...ys),years=[];for(let y=from;y<=to;y++)years.push(y);
  const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#0C1222");bg.addColorStop(1,"#1A1532");x.fillStyle=bg;x.fillRect(0,0,W,H);
  x.strokeStyle="rgba(140,157,255,.06)";x.lineWidth=2;for(let gx=0;gx<W;gx+=64){x.beginPath();x.moveTo(gx,0);x.lineTo(gx,H);x.stroke()}for(let gy=0;gy<H;gy+=64){x.beginPath();x.moveTo(0,gy);x.lineTo(W,gy);x.stroke()}
  const M=120,colW=(W-M*2)/years.length,tw=Math.min(colW*.84,180),th=tw*4/3;
  x.fillStyle="#E8ECF6";x.font="700 66px Unbounded, Arial Black, sans-serif";x.fillText(`${name||(d.name?d.name+"'s":"My")} gaming years`,M,150,W-M*2);
  x.font="500 32px IBM Plex Mono, monospace";x.fillStyle="#98A1B6";x.fillText(`${from===to?from:`${from}–${to}`} · ${pngEraBadge(d)} · ${es.length} games`,M,204,W-M*2);
  const boxes={};
  years.forEach((y,i)=>{const cx=M+i*colW+colW/2;
    x.fillStyle="#98A1B6";x.font=`500 ${Math.max(16,Math.min(26,colW*.28))}px IBM Plex Mono, monospace`;x.textAlign="center";x.fillText(String(y),cx,H-90);x.textAlign="left";
    x.strokeStyle="rgba(255,255,255,.07)";x.beginPath();x.moveTo(M+i*colW,260);x.lineTo(M+i*colW,H-130);x.stroke();
    (byY[y]||[]).sort((a,b)=>b.lv-a.lv).slice(0,7).forEach((e,j)=>{const s=j===0?1:j<3?.86:.72,w=tw*s,h=th*s,top=270+[0,1.04,1.94,2.84,3.6,4.36,5.12][j]*th*.92;if(top+h>H-130)return;
      const bx=cx-w/2,g=e.g;drawCoverOrBox(x,g,g?g.title:e.e.t,y,g?g.h:hueOf(norm(e.e.t)),g?glyphOf(g):"stick",bx,top,w,h,imgMap);
      if(e.lv===3){x.strokeStyle="#FF6E5A";x.lineWidth=7;x.beginPath();x.roundRect(bx,top,w,h,Math.max(4,w*.05));x.stroke()}else if(e.lv===2){x.strokeStyle="#8C9DFF";x.lineWidth=4;x.beginPath();x.roundRect(bx,top,w,h,Math.max(4,w*.05));x.stroke()}
      boxes[norm(e.e.t)]={x:bx,y:top,w,h}})});
  wallLinks(d).forEach(({a,b})=>{const A=boxes[a],B=boxes[b];if(!A||!B)return;const x1=A.x+A.w,y1=A.y+A.h/2,x2=B.x,y2=B.y+B.h/2,dx=Math.max(40,Math.abs(x2-x1)/2);
    x.strokeStyle="rgba(140,157,255,.8)";x.lineWidth=4;x.beginPath();x.moveTo(x1,y1);x.bezierCurveTo(x1+dx,y1,x2-dx,y2,x2,y2);x.stroke()});
  x.font="500 28px IBM Plex Mono, monospace";x.fillStyle="#B9C1D2";x.fillText("Played & Made · playedmade.com",M,H-40);
  return cv;
}
function cardStagesFor(d,imgMap=null){
  const es=entries(d);
  const hasArt=e=>!!(e.g&&e.g.img&&(!imgMap||imgMap.has(e.g.img)));
  const cmp=(p,q)=>(hasArt(q)-hasArt(p))||(q.lv-p.lv)||(((q.g&&q.g.pop)||0)-((p.g&&p.g.pop)||0));
  if(d.birth){
    return [["Childhood",0,12],["Teens",13,19],["Twenties",20,29],["Thirties",30,39],["Forties",40,49],["Fifty+",50,120]].map(([label,a,b])=>({
      label,xs:es.filter(e=>e.y-d.birth>=a&&e.y-d.birth<=b).sort(cmp).slice(0,5)
    })).filter(s=>s.xs.length);
  }
  const decs=[[1950,1979,"1950s–70s"],[1980,1989,"1980s"],[1990,1999,"1990s"],[2000,2009,"2000s"],[2010,2019,"2010s"],[2020,NOW,"2020s"]];
  return decs.map(([a,b,label])=>({
    label,xs:es.filter(e=>e.y>=a&&e.y<=b).sort(cmp).slice(0,5)
  })).filter(s=>s.xs.length);
}
function drawCard(d,name,imgMap){
  const W=1080,H=1920,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#0E1428");bg.addColorStop(1,"#23163C");x.fillStyle=bg;x.fillRect(0,0,W,H);
  const st=timelineStats(d),persona=gamerPersonaOf(d),combos=unlockedCombos(d);
  x.fillStyle="#8C9DFF";x.font="600 26px IBM Plex Mono, monospace";x.fillText("MY LIFE IN GAMES",72,115);
  x.fillStyle="#F2F4F8";x.font="700 68px Unbounded, Arial Black, sans-serif";x.fillText(name||(d.name||"My timeline"),72,196,W-144);
  x.fillStyle="#AEB6C8";x.font="500 28px IBM Plex Mono, monospace";x.fillText(`${pngEraBadge(d)} · ${st.n} games · ${st.sys} systems`,72,248,W-144);
  if(persona){x.fillStyle="#FF8A78";x.font="600 28px IBM Plex Sans, sans-serif";x.fillText(persona.title,72,292,W-144)}
  let yy=356;
  const cw=(W-144-4*18)/5,ch=Math.round(cw*4/3);
  for(const {label,xs} of cardStagesFor(d,imgMap)){if(yy>1420)break;
    x.fillStyle="#8C9DFF";x.font="600 24px IBM Plex Mono, monospace";x.fillText(label.toUpperCase(),72,yy);yy+=24;
    xs.forEach((e,k)=>{const bx=72+k*(cw+18);const g=e.g;drawCoverOrBox(x,g,g?g.title:e.e.t,e.y,g?g.h:hueOf(norm(e.e.t)),g?glyphOf(g):"stick",bx,yy,cw,ch,imgMap);if(e.lv===3){x.strokeStyle="rgba(255,110,90,.85)";x.lineWidth=3;x.beginPath();x.roundRect(bx+1.5,yy+1.5,cw-3,ch-3,8);x.stroke()}});
    yy+=ch+54}
  const dna=dnaOf(d);if(dna.top.length&&yy<1630){const a=dna.top[0];x.fillStyle="#8C9DFF";x.font="600 24px IBM Plex Mono, monospace";x.fillText("MY GAMING DNA",72,yy);yy+=46;
    x.fillStyle="#F2F4F8";x.font="600 32px IBM Plex Sans, sans-serif";wrapText(x,`${a.n} of my games descend from ${a.g.title} (${a.g.year}).`,72,yy,740,42,2);yy+=96}
  if(combos.length&&yy<1730){
    const stamps=combos.slice(0,2).map(c=>"★ "+c.name).join("  ·  ");
    x.fillStyle="#E8A948";x.font="600 22px IBM Plex Mono, monospace";x.fillText(stamps,72,Math.min(yy,H-150),740);
  }
  drawQrStamp(x,compactQrShareURL(d),W-226,H-246,154,"SCAN TO COMPARE");
  x.fillStyle="#8E98B0";x.font="500 26px IBM Plex Mono, monospace";x.fillText("Played & Made · playedmade.com",72,H-70);
  return cv;
}
function favCardPicks(d){
  const es=entries(d);
  const favs=es.filter(e=>e.lv===3).sort((a,b)=>((b.g&&b.g.pop)||0)-((a.g&&a.g.pop)||0)||a.y-b.y);
  const t10=(d.top10||[]).map(k=>matchTop10Entry(favs,k)).filter(Boolean);
  const seen=new Set(t10);
  const backfilled=[...t10,...favs.filter(f=>!seen.has(f))];
  if(!backfilled.length)backfilled.push(...es.slice().sort((a,b)=>b.lv-a.lv||((b.g&&b.g.pop)||0)-((a.g&&a.g.pop)||0)));
  return {t10,picks:backfilled.slice(0,12)};
}
function drawFavsCard(d,name,imgMap){
  const W=1080,H=1440,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#121629");bg.addColorStop(1,"#261533");x.fillStyle=bg;x.fillRect(0,0,W,H);
  const es=entries(d),{t10,picks}=favCardPicks(d);
  const persona=gamerPersonaOf(d);
  const hdr=t10.length>=10?"MY TOP 10":(t10.length>=4&&picks.length===t10.length)?`MY TOP ${t10.length}`:"MY ALL-TIME FAVORITES";
  x.fillStyle="#FF6E5A";x.font="600 26px IBM Plex Mono, monospace";x.fillText(hdr,72,110);
  x.fillStyle="#F2F4F8";x.font="700 62px Unbounded, Arial Black, sans-serif";x.fillText(name||(d.name||"My Favorites"),72,186,W-300);
  x.fillStyle="#AEB6C8";x.font="500 26px IBM Plex Mono, monospace";x.fillText(`${pngEraBadge(d)}${persona?" · "+persona.title:""}`,72,236,W-300);
  drawQrStamp(x,compactQrShareURL(d),W-226,64,154,"SCAN TO COMPARE");
  const small=picks.length<=6;
  const cols=small?3:4,w=small?292:212,h=small?388:276,gapX=small?30:29,gapY=small?46:42,startY=278;
  picks.forEach((e,idx)=>{
    const r=Math.floor(idx/cols),c=idx%cols,bx=72+c*(w+gapX),by=startY+r*(h+gapY),g=e.g;
    drawCoverOrBox(x,g,g?g.title:e.e.t,e.y,g?g.h:hueOf(norm(e.e.t)),g?glyphOf(g):"stick",bx,by,w,h,imgMap);
    x.strokeStyle=e.lv===3?"rgba(255,110,90,.85)":"#8C9DFF";x.lineWidth=3.5;x.beginPath();x.roundRect(bx+1.5,by+1.5,w-3,h-3,10);x.stroke();
    if(idx<t10.length&&t10.length>=2){x.fillStyle="#FF6E5A";x.beginPath();x.roundRect(bx+10,by+10,46,36,8);x.fill();x.fillStyle="#fff";x.font="700 22px IBM Plex Mono, monospace";x.fillText("#"+(idx+1),bx+15,by+35)}
    x.fillStyle="#CBD2E1";x.font="500 20px IBM Plex Mono, monospace";x.fillText(String(e.y),bx,by+h+26);
  });
  const sys=(d.owned&&d.owned.length?d.owned:[...new Set(es.flatMap(e=>sysListOf(e.e,d)))]).slice(0,6);
  if(sys.length){x.fillStyle="#98A1B6";x.font="500 22px IBM Plex Mono, monospace";wrapText(x,"Played on: "+sys.join(" · "),72,H-132,W-144,28,2)}
  x.fillStyle="#8E98B0";x.font="500 24px IBM Plex Mono, monospace";x.fillText("Played & Made · playedmade.com",72,H-56);
  return cv;
}
function consoleCardRows(d){
  const es=entries(d),bySys=new Map();
  (d.owned||[]).forEach(s=>bySys.set(s,[]));
  es.forEach(e=>sysListOf(e.e,d).forEach(s=>{if(!bySys.has(s))bySys.set(s,[]);bySys.get(s).push(e)}));
  return {bySys,rows:[...bySys.entries()].filter(([,arr])=>arr.length||(d.owned||[]).length).sort((a,b)=>b[1].length-a[1].length).slice(0,5).map(([sys,arr])=>({sys,arr,top:arr.slice().sort((p,q)=>q.lv-p.lv||((q.g&&q.g.pop)||0)-((p.g&&p.g.pop)||0)).slice(0,4)}))};
}
function drawConsolesCard(d,name,imgMap){
  const W=1080,H=1920,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#0D1526");bg.addColorStop(1,"#1B1B34");x.fillStyle=bg;x.fillRect(0,0,W,H);
  const es=entries(d),st=timelineStats(d),{rows}=consoleCardRows(d);
  const hwMap=new Map((CULT.hardware||[]).map(h=>[h.sys,h]));
  x.fillStyle="#8C9DFF";x.font="600 26px IBM Plex Mono, monospace";x.fillText("THE MACHINES THAT RAISED ME",72,115);
  x.fillStyle="#F2F4F8";x.font="700 62px Unbounded, Arial Black, sans-serif";x.fillText(name||(d.name||"Consoles & Favorites"),72,192,W-300);
  x.fillStyle="#AEB6C8";x.font="500 26px IBM Plex Mono, monospace";x.fillText(`${pngEraBadge(d)} · ${plural(st.sys,"system")} · ${plural(es.length,"game")}`,72,244,W-300);
  drawQrStamp(x,compactQrShareURL(d),W-226,68,154,"SCAN TO COMPARE");
  let yy=305;
  rows.forEach(({sys,arr,top})=>{
    const hw=hwMap.get(sys);
    canvasHardware(x,sys,72,yy,310,256);
    x.fillStyle="#F2F4F8";x.font="700 29px Unbounded, Arial Black, sans-serif";wrapText(x,sys,92,yy+114,270,34,2);
    x.fillStyle="#98A1B6";x.font="500 20px IBM Plex Mono, monospace";x.fillText(hw?hw.maker:plural(arr.length,"game"),92,yy+176,270);
    x.fillStyle="#8C9DFF";x.font="600 22px IBM Plex Mono, monospace";x.fillText(plural(arr.length,"game")+" played",92,yy+214,270);
    top.forEach((e,k)=>{
      const cw=142,ch=190,bx=406+k*(cw+14),by=yy+33,g=e.g;
      drawCoverOrBox(x,g,g?g.title:e.e.t,e.y,g?g.h:hueOf(norm(e.e.t)),g?glyphOf(g):"stick",bx,by,cw,ch,imgMap);
      if(e.lv===3){x.strokeStyle="rgba(255,110,90,.85)";x.lineWidth=3.5;x.beginPath();x.roundRect(bx+1.5,by+1.5,cw-3,ch-3,8);x.stroke()}
    });
    yy+=288;
  });
  x.fillStyle="#8E98B0";x.font="500 26px IBM Plex Mono, monospace";x.fillText("Played & Made · playedmade.com",72,H-66);
  return cv;
}
function drawMakerCard(d,name,imgMap){
  const W=1080,H=1920,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#14120E");bg.addColorStop(1,"#1B2030");x.fillStyle=bg;x.fillRect(0,0,W,H);
  const mk=makerLegacyOf(d)||{wk:[],studios:[],reachCount:0,desc:[]};
  x.fillStyle="#E8A948";x.font="600 26px IBM Plex Mono, monospace";x.fillText("MY WORK IN GAMES · SELF-REPORTED",72,120);
  x.fillStyle="#F2F4F8";x.font="700 68px Unbounded, Arial Black, sans-serif";x.fillText(name||(d.name||"Maker Legacy"),72,205,W-300);
  x.fillStyle="#AEB6C8";x.font="500 28px IBM Plex Mono, monospace";
  const span=mk.from?(mk.from===mk.to?String(mk.from):`${mk.from}–${mk.to}`):"";
  x.fillText(`${plural(mk.wk.length,"project")}${mk.studios.length?` · ${plural(mk.studios.length,"studio")}`:""}${span?` · ${span}`:""}`,72,262,W-300);
  drawQrStamp(x,compactQrShareURL(d),W-218,74,146,"VIEW TIMELINE");
  let yy=340;
  if(mk.wk.length){
    x.fillStyle="#E8A948";x.font="600 24px IBM Plex Mono, monospace";x.fillText("GAMES & MODS I HELPED BUILD",72,yy);yy+=24;
    mk.wk.slice(0,10).forEach((e,idx)=>{
      const row=Math.floor(idx/5),col=idx%5,w=170,h=226,bx=72+col*(w+18),by=yy+row*(h+52);
      const g=e.g;drawCoverOrBox(x,g,g?g.title:e.e.t,workedYearOf(e),g?g.h:hueOf(norm(e.e.t)),g?glyphOf(g):"stick",bx,by,w,h,imgMap);
      x.strokeStyle="#E8A948";x.lineWidth=5;x.beginPath();x.roundRect(bx,by,w,h,8);x.stroke();
      x.fillStyle="#CBD2E1";x.font="500 20px IBM Plex Mono, monospace";x.fillText(String(workedYearOf(e)),bx,by+h+28);
    });
    yy+=Math.ceil(Math.min(mk.wk.length,10)/5)*(226+52)+36;
  }
  if(mk.desc.length&&yy<1550){
    x.fillStyle="#8C9DFF";x.font="600 24px IBM Plex Mono, monospace";x.fillText(`THE RIPPLE EFFECT · ${mk.reachCount} LATER GAMES`,72,yy);yy+=24;
    mk.desc.slice(0,5).forEach((r,k)=>{const w=170,h=226,bx=72+k*(w+18);drawCoverOrBox(x,r.g,r.g.title,r.g.year,r.g.h,glyphOf(r.g),bx,yy,w,h,imgMap)});
    yy+=226+50;
  }
  x.fillStyle="#98A1B6";x.font="500 26px IBM Plex Mono, monospace";x.fillText("Played & Made · playedmade.com",72,H-70);
  return cv;
}
/* 1200×627 LinkedIn Maker Ripple (or Player DNA & Roots) widescreen card with QR */
function drawLinkedInCard(d,name,imgMap){
  const W=1200,H=627,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const mk=makerLegacyOf(d),isMaker=!!(mk&&mk.wk.length);
  const bg=x.createLinearGradient(0,0,W,H);
  if(isMaker){bg.addColorStop(0,"#14110D");bg.addColorStop(1,"#1B2336")}
  else{bg.addColorStop(0,"#0E1529");bg.addColorStop(1,"#211839")}
  x.fillStyle=bg;x.fillRect(0,0,W,H);
  x.strokeStyle=isMaker?"rgba(232,169,72,.38)":"rgba(140,157,255,.34)";x.lineWidth=2;
  x.beginPath();x.roundRect(22,22,W-44,H-44,18);x.stroke();
  const titleName=name||(d.name||(isMaker?"My Work in Games":"My Life in Games"));
  if(isMaker){
    const span=mk.from?(mk.from===mk.to?String(mk.from):`${mk.from}–${mk.to}`):"";
    x.fillStyle="#E8A948";x.font="600 18px IBM Plex Mono, monospace";
    x.fillText(`MAKER RIPPLE · SELF-REPORTED CREDITS${span?" · "+span:""}`,56,74);
    x.fillStyle="#F4F6FA";x.font="700 46px Unbounded, Arial Black, sans-serif";
    x.fillText(titleName,56,132,880);
    const subBits=[plural(mk.wk.length,"project"),mk.studios.length?mk.studios.slice(0,3).map(s=>s.name).join(" · "):"",mk.reachCount?`${mk.reachCount.toLocaleString()} later games in its ripple`:""].filter(Boolean).join("  ·  ");
    x.fillStyle="#B8C2D6";x.font="500 20px IBM Plex Sans, sans-serif";
    x.fillText(subBits,56,170,880);
    const wkShow=mk.wk.slice(0,4);
    const cw=138,ch=184,cGap=16,baseY=252;
    x.fillStyle="#E8A948";x.font="600 15px IBM Plex Mono, monospace";x.fillText("CREDITS I HELPED BUILD",56,236);
    wkShow.forEach((e,k)=>{
      const bx=56+k*(cw+cGap),by=baseY,g=e.g,wy=workedYearOf(e);
      drawCoverOrBox(x,g,g?g.title:e.e.t,wy,g?g.h:hueOf(norm(e.e.t)),g?glyphOf(g):"stick",bx,by,cw,ch,imgMap);
      x.strokeStyle="#E8A948";x.lineWidth=3.5;x.beginPath();x.roundRect(bx+1.5,by+1.5,cw-3,ch-3,7);x.stroke();
      const yrLbl=(g&&g.year!==wy)?`credit ${wy}`:String(wy);
      x.fillStyle="#CBD2E1";x.font="500 14px IBM Plex Mono, monospace";x.fillText(yrLbl,bx,by+ch+22);
    });
    if(mk.desc.length){
      const rx0=Math.max(296,56+wkShow.length*(cw+cGap)+44);
      const rw=118,rh=158,rGap=14;
      const maxRip=Math.max(1,Math.floor((W-56-rx0+rGap)/(rw+rGap)));
      const ripList=mk.desc.slice().sort((a,b)=>(!!(b.g&&b.g.img&&(!imgMap||imgMap.has(b.g.img)))-!!(a.g&&a.g.img&&(!imgMap||imgMap.has(a.g.img))))||(b.g.pop-a.g.pop)).slice(0,Math.min(6,maxRip)).sort((a,b)=>(a.g.year-b.g.year)||a.g.title.localeCompare(b.g.title));
      x.fillStyle="#8C9DFF";x.font="600 15px IBM Plex Mono, monospace";x.fillText("DOWNSTREAM RIPPLE",rx0,236);
      const ry=baseY+(ch-rh);
      ripList.forEach((r,k)=>{
        const bx=rx0+k*(rw+rGap);
        drawCoverOrBox(x,r.g,r.g.title,r.g.year,r.g.h,glyphOf(r.g),bx,ry,rw,rh,imgMap);
        x.strokeStyle="rgba(140,157,255,.75)";x.lineWidth=2.5;x.beginPath();x.roundRect(bx+1,ry+1,rw-2,rh-2,7);x.stroke();
        x.fillStyle="#98A1B6";x.font="500 13px IBM Plex Mono, monospace";x.fillText(String(r.g.year),bx,ry+rh+20);
      });
    }
    drawQrStamp(x,compactQrShareURL(d),W-196,42,148,"COMPARE / CREDITS");
    x.fillStyle="#98A1B6";x.font="500 18px IBM Plex Mono, monospace";
    x.fillText("Played & Made · playedmade.com — trace the lineage of every game you played or built",56,H-50,W-280);
  }else{
    const st=timelineStats(d),persona=gamerPersonaOf(d),dna=dnaOf(d),combos=unlockedCombos(d);
    const {picks}=favCardPicks(d);
    x.fillStyle="#8C9DFF";x.font="600 18px IBM Plex Mono, monospace";
    x.fillText(`MY LIFE IN GAMES · ${pngEraBadge(d).toUpperCase()}`,56,74);
    x.fillStyle="#F4F6FA";x.font="700 46px Unbounded, Arial Black, sans-serif";
    x.fillText(titleName,56,132,880);
    x.fillStyle="#FF8A78";x.font="600 22px IBM Plex Sans, sans-serif";
    x.fillText(`${persona?persona.title+" · ":""}${plural(st.n,"game")} · ${plural(st.sys,"system")}${dna.allCount?` · ${dna.allCount.toLocaleString()} historical roots`:""}`,56,170,880);
    picks.slice(0,6).forEach((e,k)=>{
      const cw=136,ch=182,bx=56+k*(cw+16),by=226,g=e.g;
      drawCoverOrBox(x,g,g?g.title:e.e.t,e.y,g?g.h:hueOf(norm(e.e.t)),g?glyphOf(g):"stick",bx,by,cw,ch,imgMap);
      if(e.lv===3){x.strokeStyle="#FF6E5A";x.lineWidth=4;x.beginPath();x.roundRect(bx,by,cw,ch,8);x.stroke()}
      x.fillStyle="#CBD2E1";x.font="500 15px IBM Plex Mono, monospace";x.fillText(String(e.y),bx,by+ch+22);
    });
    if(dna.top[0]){
      x.fillStyle="#EEF2FA";x.font="600 22px IBM Plex Sans, sans-serif";
      x.fillText(`Biggest root: ${dna.top[0].g.title} (${dna.top[0].g.year}) — shaped ${dna.top[0].n} games on my timeline.`,56,482,900);
    }
    if(combos.length){
      x.fillStyle="#E8A948";x.font="600 17px IBM Plex Mono, monospace";
      x.fillText(combos.slice(0,3).map(c=>"★ "+c.name).join("  ·  "),56,522,900);
    }
    drawQrStamp(x,compactQrShareURL(d),W-196,42,148,"SCAN TO COMPARE");
    x.fillStyle="#98A1B6";x.font="500 18px IBM Plex Mono, monospace";
    x.fillText("Played & Made · playedmade.com — tap the ones you played too",56,H-48,W-280);
  }
  return cv;
}
/* 1080×1350 Duo Overlap PNG card for Friend Challenge */
function drawDuoCard(a,b,bName,imgMap){
  const W=1080,H=1350,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#0D1528");bg.addColorStop(1,"#2A1634");x.fillStyle=bg;x.fillRect(0,0,W,H);
  const ov=weightedTasteMatch(a,b),ss=ov.sameServer[0];
  const aName=a.name||"You",fName=bName||b.name||"A friend";
  x.fillStyle="#8C9DFF";x.font="600 24px IBM Plex Mono, monospace";x.fillText("DUO TASTE MATCH · PLAYED & MADE",72,94);
  x.fillStyle="#F4F6FA";x.font="700 54px Unbounded, Arial Black, sans-serif";x.fillText(`${aName} × ${fName}`,72,166,W-280);
  x.fillStyle="#FF6E5A";x.font="700 96px Unbounded, Arial Black, sans-serif";
  const pctStr=`${ov.pct}%`;
  x.fillText(pctStr,72,296,360);
  const pctW=Math.min(360,x.measureText(pctStr).width);
  const metaX=Math.ceil(72+pctW+30);
  x.fillStyle="#CBD2E1";x.font="600 26px IBM Plex Sans, sans-serif";
  x.fillText(`${plural(ov.both,"shared game")} · ${plural(ov.favBoth,"shared ♥ favorite")}`,metaX,252,W-metaX-72);
  x.fillStyle="#98A1B6";x.font="500 22px IBM Plex Mono, monospace";
  x.fillText(`${ov.genrePct}% genre DNA alignment`,metaX,292,W-metaX-72);
  let yy=348;
  if(ss){
    x.fillStyle="rgba(232,169,72,.16)";x.strokeStyle="#E8A948";x.lineWidth=2.5;
    x.beginPath();x.roundRect(72,yy,W-144,62,14);x.fill();x.stroke();
    x.fillStyle="#F6C86E";x.font="700 24px IBM Plex Sans, sans-serif";
    x.fillText(`${ss.isOnline?"Same Server, Same Year":"Same Year, Same World"}: You both played ${ss.title} in ${ss.year}`,96,yy+39,W-192);
    yy+=108;
  }
  x.fillStyle="#8C9DFF";x.font="600 22px IBM Plex Mono, monospace";
  x.fillText(ov.shared.length?"GAMES YOU BOTH PLAYED":"PLAYED ON DIFFERENT WORLDS",72,yy);
  yy+=26;
  const picks=ov.shared.slice(0,8);
  const cols=4,cw=216,ch=266,gx=24,gy=42;
  picks.forEach((it,idx)=>{
    const r=Math.floor(idx/cols),c=idx%cols,bx=72+c*(cw+gx),by=yy+r*(ch+gy),g=it.g;
    drawCoverOrBox(x,g,g?g.title:it.a.e.t,it.a.y,g?g.h:hueOf(norm(it.a.e.t)),g?glyphOf(g):"stick",bx,by,cw,ch,imgMap);
    const bothFav=it.a.lv===3&&it.b.lv===3;
    x.strokeStyle=bothFav?"rgba(255,110,90,.85)":"#8C9DFF";x.lineWidth=bothFav?4:2.5;
    x.beginPath();x.roundRect(bx+1.5,by+1.5,cw-3,ch-3,10);x.stroke();
    x.fillStyle="#CBD2E1";x.font="500 19px IBM Plex Mono, monospace";
    x.fillText(`${it.a.y===it.b.y?it.a.y:`${it.a.y}/${it.b.y}`}${bothFav?" · ♥♥":""}`,bx,by+ch+25);
  });
  drawQrStamp(x,compactQrShareURL(a),W-226,H-222,154,"COMPARE YOURS");
  x.fillStyle="#8E98B0";x.font="500 24px IBM Plex Mono, monospace";x.fillText("Played & Made · playedmade.com",72,H-64);
  return cv;
}
async function exportDuoPng(f){
  if(!f||!f.data)return;
  const ov=weightedTasteMatch(hist,f.data);
  const gs=ov.shared.slice(0,8).map(x=>x.g).filter(Boolean);
  toast("Rendering Duo Overlap card…");
  const imgMap=await preloadCoverImages(gs,5200);
  let blob=null;
  try{const cv=drawDuoCard(hist,f.data,f.name,imgMap);blob=await new Promise((res,rej)=>{try{cv.toBlob(b=>b?res(b):rej(0),"image/png")}catch(e){rej(e)}})}
  catch(_){const cv2=drawDuoCard(hist,f.data,f.name,null);blob=await new Promise(r=>cv2.toBlob(r,"image/png"))}
  if(!blob){toast("Couldn't generate Duo card");return}
  const fname=`duo-match-${slugStudio(f.name||"friend")}.png`;
  if(canNativeShareFiles()){
    try{
      await navigator.share({files:[new File([blob],fname,{type:"image/png"})],title:`${ov.pct}% Taste Match with ${f.name} · Played & Made`,text:`${ov.pct}% gaming Taste Match (${plural(ov.both,"shared game")}) on playedmade.com`});
      trackEvent("share_duo_native","duo");
      return;
    }catch(err){if(err&&err.name==="AbortError")return}
  }
  const u=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=u;a.download=fname;document.body.appendChild(a);a.click();a.remove();
  trackEvent("export_png","duo");
  toast(`Downloaded ${fname}`);
  const out=$("#duoOut")||$("#vsCard");
  if(out&&out.id==="duoOut")out.innerHTML=`<p class="sub" style="margin-top:10px">Downloaded <b>${esc(fname)}</b></p><img class="imgprev" src="${u}" alt="Duo Taste Match card">`;
}
function drawPostcard(item,imgMap){
  const W=1200,H=675,cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
  const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#14182B");bg.addColorStop(1,"#2B182D");x.fillStyle=bg;x.fillRect(0,0,W,H);
  x.strokeStyle="rgba(255,110,90,.45)";x.lineWidth=3;x.beginPath();x.roundRect(32,32,W-64,H-64,22);x.stroke();
  const gm=item.game&&byId.get(item.game),st=item.studio&&findStudio(item.studio);
  const repGame=gm||(st&&st.games&&st.games.slice().sort((a,b)=>b.pop-a.pop)[0])||null;
  let tx=76,tw=W-152;
  if(repGame){
    const cw=220,ch=294,bx=76,by=160;
    drawCoverOrBox(x,repGame,repGame.title,repGame.year,repGame.h,glyphOf(repGame),bx,by,cw,ch,imgMap);
    x.strokeStyle="#FF6E5A";x.lineWidth=5;x.beginPath();x.roundRect(bx,by,cw,ch,12);x.stroke();
    tx=334;tw=W-tx-76;
  }
  x.fillStyle="#FF8A78";x.font="600 21px IBM Plex Mono, monospace";x.fillText("THANK YOU TO THE MAKERS",76,102);
  const heading=gm&&st?`To ${st.name} (${gm.title})`:st?`To everyone at ${st.name}`:gm?`To the team behind ${gm.title}`:"To the game makers who raised us";
  x.fillStyle="#F2F4F8";x.font="700 42px Unbounded, Arial Black, sans-serif";wrapText(x,heading,tx,196,tw,50,2);
  x.fillStyle="#8C9DFF";x.font="600 22px IBM Plex Mono, monospace";x.fillText(item.tag||"Carried me through",tx,276);
  x.fillStyle="#EEF2FA";x.font="italic 400 29px IBM Plex Sans, sans-serif";wrapText(x,`“${item.note}”`,tx,334,tw,42,5);
  if(item.who){x.fillStyle="#B8C1D6";x.font="600 23px IBM Plex Sans, sans-serif";x.fillText(`— ${item.who}`,tx,560)}
  x.fillStyle="#8E98B0";x.font="500 20px IBM Plex Mono, monospace";x.fillText("Played & Made · playedmade.com",76,H-58);
  return cv;
}
async function exportCanvasPng(gamesToPreload,buildFn,fname,outSel){
  toast("Rendering high-res image with box art…");
  const imgMap=await preloadCoverImages(gamesToPreload);
  let blob=null;
  try{
    const cv=buildFn(imgMap);
    blob=await new Promise((res,rej)=>{try{cv.toBlob(b=>b?res(b):rej(new Error("empty")),"image/png")}catch(err){rej(err)}});
  }catch(e){
    const cv2=buildFn(null);
    blob=await new Promise(r=>cv2.toBlob(r,"image/png"));
  }
  if(!blob){toast("Couldn't generate image");return}
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();
  trackEvent("export_png",String(fname||"").replace(/\.png$/i,""));
  toast(`Downloaded ${fname}`);
  const out=outSel?$(outSel):null;
  if(out)out.innerHTML=`<p class="sub" style="margin-top:12px">Downloaded <b>${esc(fname)}</b> (on phones, press and hold the preview below to save to Photos).</p><img class="imgprev" src="${url}" alt="${esc(fname)}">`;
}
/* Scope cover image preloads strictly to the rendered covers for each export kind */
function renderedGamesForPng(kind,d){
  if(kind==="favs")return favCardPicks(d).picks.map(e=>e.g).filter(Boolean);
  if(kind==="card")return cardStagesFor(d).flatMap(s=>s.xs).map(e=>e.g).filter(Boolean);
  if(kind==="consoles")return consoleCardRows(d).rows.flatMap(r=>r.top).map(e=>e.g).filter(Boolean);
  if(kind==="linkedin"){
    const mk=makerLegacyOf(d);
    if(mk&&mk.wk.length)return [...mk.wk.slice(0,5).map(e=>e.g),...mk.desc.slice(0,8).map(r=>r.g)].filter(Boolean);
    return favCardPicks(d).picks.slice(0,6).map(e=>e.g).filter(Boolean);
  }
  if(kind==="maker"){
    const mk=makerLegacyOf(d)||{wk:[],desc:[]};
    return [...mk.wk.slice(0,10).map(e=>e.g),...mk.desc.slice(0,5).map(r=>r.g)].filter(Boolean);
  }
  const byY={};entries(d).forEach(e=>(byY[e.y]=byY[e.y]||[]).push(e));
  return Object.values(byY).flatMap(arr=>arr.sort((a,b)=>b.lv-a.lv).slice(0,7)).map(e=>e.g).filter(Boolean);
}
async function saveImage(kind,who){
  const d=who==="friend"&&state.viewing?state.viewing.data:hist,name=who==="friend"&&state.viewing?state.viewing.name+"'s":null;
  const cleanName=name&&name.replace(/'s$/,"");
  const gs=renderedGamesForPng(kind,d);
  const fname=kind==="linkedin"?"played-and-made-linkedin.png":kind==="maker"?"my-work-in-games.png":kind==="consoles"?"my-consoles-and-favorites.png":kind==="favs"?"my-favorite-games.png":kind==="card"?"my-life-in-games.png":"my-gaming-years-4k.png";
  await exportCanvasPng(gs,imgMap=>buildShareCanvasForKind(kind,d,cleanName,imgMap),fname,"#imgout");
}

/* ---------- End Credits Roll for makers (WCAG 2.2.2 pause/speed + reduced-motion static list) ---------- */
let CREDITS=null;
function stopCreditsRoll(){
  if(CREDITS){if(CREDITS.raf)cancelAnimationFrame(CREDITS.raf);CREDITS=null}
  const ov=$("#creditsOv");if(ov)ov.remove();
}
function openCreditsRoll(d){
  d=d||hist;
  const mk=makerLegacyOf(d);
  if(!mk||(!mk.wk.length&&!mk.studios.length)){toast("Add a game credit first to roll End Credits");return}
  stopCreditsRoll();
  trackEvent("credits_roll",String(mk.wk.length));
  const reduced=prefersReducedMotion();
  const who=d.name||"Game Maker";
  const byRole=new Map();
  mk.wk.forEach(x=>{
    const rk=x.e.wkType==="mod"?"Mods & Maps":(x.e.role||"Development & Craft");
    if(!byRole.has(rk))byRole.set(rk,[]);
    byRole.get(rk).push(x);
  });
  const html=`<div class="credits-ov" id="creditsOv" role="dialog" aria-modal="true" aria-label="End Credits Roll for ${esc(who)}">
    <div class="credits-top">
      <div class="row" style="gap:8px"><span class="crafteyebrow" style="margin:0">🎬 END CREDITS</span><span class="sr-badge">Self-reported</span></div>
      <div class="row" style="gap:6px">
        ${reduced?"":`<button type="button" class="btn sm" id="crPauseBtn" data-act="creditsPause">Pause</button><button type="button" class="btn sm" id="crSpeedBtn" data-act="creditsSpeed">Speed: 1×</button>`}
        <button type="button" class="btn sm" data-act="synthToggle">♫ Synth</button>
        <button type="button" class="btn sm primary" data-act="creditsClose">Close ×</button>
      </div>
    </div>
    <div class="credits-stage" id="creditsStage" tabindex="0">
      <div class="credits-roll" id="creditsRoll">
        <p class="crafteyebrow" style="margin-bottom:8px">A CAREER IN INTERACTIVE WORLDS</p>
        <h2>${esc(who)}</h2>
        ${mk.from?`<p class="mono" style="color:#9AA5BC;margin:0 0 18px">${mk.from===mk.to?mk.from:`${mk.from} – ${mk.to}`}</p>`:""}
        ${mk.studios.length?`<h3>Studios &amp; Teams</h3>${mk.studios.map(s=>`<div class="cr-item">${flag(s.cc)} ${esc(s.name)}</div>`).join("")}`:""}
        ${[...byRole.entries()].map(([rk,arr])=>`<h3>${esc(rk)}</h3>${arr.map(x=>{const wy=workedYearOf(x);return `<div class="cr-item"><b>${esc(x.g?x.g.title:x.e.t)}</b><small>${wy}${x.g&&wy!==x.g.year?` (Live Ops · launched ${x.g.year})`:""}${x.g?" · "+esc(studio(x.g)):""}</small></div>`}).join("")}`).join("")}
        ${mk.desc.length?`<h3>The Ripple Effect · ${mk.reachCount.toLocaleString()} Later Games</h3>${mk.desc.slice(0,12).map(r=>`<div class="cr-item">${esc(r.g.title)}<small>${r.g.year} · inspired via ${esc(r.via.title)}</small></div>`).join("")}`:""}
        <h3>Thank You For Playing</h3>
        <div class="cr-item" style="color:#9AA5BC">Played &amp; Made · playedmade.com</div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend",html);
  const roll=$("#creditsRoll"),stage=$("#creditsStage");
  if(!reduced&&roll&&stage){
    CREDITS={y:0,speed:42,mult:1,paused:false,lastT:0,raf:0};
    const tick=now=>{
      if(!CREDITS||!roll.isConnected){stopCreditsRoll();return}
      const dt=CREDITS.lastT?Math.min(0.05,(now-CREDITS.lastT)/1000):0;
      CREDITS.lastT=now;
      if(!CREDITS.paused){
        CREDITS.y+=CREDITS.speed*CREDITS.mult*dt;
        const maxY=roll.scrollHeight-stage.clientHeight*0.35;
        if(CREDITS.y>maxY)CREDITS.y=0;
        roll.style.transform=`translate3d(0,${-CREDITS.y.toFixed(1)}px,0)`;
      }
      CREDITS.raf=requestAnimationFrame(tick);
    };
    CREDITS.raf=requestAnimationFrame(tick);
  }
}

/* ---------- Steam 2-Second Profile Importer (Supabase Edge Function + Instant Paste/JSON Fallback) ---------- */
const STEAM_EDITION_RE=/\b(goty|game of the year|definitive|enhanced|remastered|remake|hd|director'?s cut|complete|ultimate|special|anniversary|royal|deluxe|gold|platinum|classic|original|steam|prepare to die|scholar of the first sin|legendary|intergrade)\s*(edition|version|collection|cut)?\b/gi;
const STEAM_SUB_EDITION_RE=/^(?:game of the year|goty|definitive|enhanced|remastered|remake|hd|director'?s cut|complete|ultimate|special|anniversary|royal|deluxe|gold|platinum|classic|original|prepare to die|scholar of the first sin|legendary|intergrade|collection|edition|steam edition)/i;
function matchSteamGame(appid,title){
  if(appid&&bySteamId.has(+appid))return bySteamId.get(+appid);
  const raw=String(title||"").replace(/[™®©]/g,"").trim();
  if(!raw)return null;
  let g=byNorm.get(norm(raw))||byNorm1.get(norm1(raw));
  if(g)return g;
  const rKey=normR(raw);
  g=G.find(x=>x.nr===rKey);
  if(g)return g;
  const stripped=raw.replace(/\(\d{4}\)/g,"").replace(STEAM_EDITION_RE,"").replace(/[:\-–—]\s*$/,"").trim();
  if(stripped&&stripped!==raw){
    g=byNorm.get(norm(stripped))||byNorm1.get(norm1(stripped))||G.find(x=>x.nr===normR(stripped));
    if(g)return g;
  }
  const ci=raw.indexOf(":");
  if(ci>=4){
    const colonHead=raw.slice(0,ci).trim(),colonTail=raw.slice(ci+1).trim();
    if(STEAM_SUB_EDITION_RE.test(colonTail)){
      const hit=byNorm.get(norm(colonHead))||byNorm1.get(norm1(colonHead));
      if(hit)return hit;
    }
  }
  return null;
}
function parseSteamPasteText(text){
  const raw=String(text||"").trim();
  if(!raw)return [];
  /* 1. JSON (Steam GetOwnedGames response, array of objects, or Playnite export) */
  if(raw.startsWith("{")||raw.startsWith("[")){
    try{
      const j=JSON.parse(raw);
      const arr=Array.isArray(j)?j:(j.games||(j.response&&j.response.games)||[]);
      if(Array.isArray(arr)&&arr.length){
        return arr.map(it=>({
          appid:parseInt(it.appid||it.appId||it.id||0,10)||0,
          name:String(it.name||it.title||"").trim(),
          hours:it.hours!=null?+it.hours:(it.playtime_forever!=null?Math.round((+it.playtime_forever/60)*10)/10:0)
        })).filter(x=>x.appid||x.name);
      }
    }catch(_){}
  }
  /* 2. Free text: Steam Games page Ctrl+A/Ctrl+C, s:<appid>, store URLs, CSV, or newline list */
  const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const items=[];
  const skipRe=/^(all games|recently played|perfect games|followed|reviews|wishlist|game collector|playtime|last played|achievement progress|sort by|filter games|total played|view stats|store page|community hub|forums|guides|my game stats|launch game|steam)$/i;
  for(let i=0;i<lines.length;i++){
    const ln=lines[i];
    if(skipRe.test(ln)||/^\d+\s+of\s+\d+\s+achievements/i.test(ln)||/^last played\b/i.test(ln))continue;
    /* s:<appid> or store.steampowered.com/app/<appid> token(s) */
    const sidMatches=[...ln.matchAll(/(?:\bs:|steampowered\.com\/app\/)(\d{2,9})\b/gi)];
    if(sidMatches.length){sidMatches.forEach(m=>items.push({appid:+m[1],name:"",hours:0}));continue}
    /* Inline hours on same line: "Counter-Strike 2 - 420.5 hrs" */
    const sameHrs=ln.match(/^(.+?)\s*[-–—|,]\s*([\d,.]+)\s*(?:hrs?|hours?)\b/i);
    if(sameHrs){items.push({appid:0,name:sameHrs[1].trim(),hours:parseFloat(sameHrs[2].replace(/,/g,""))||0});continue}
    /* Hours line belonging to previous game title */
    const prevHrs=ln.match(/^([\d,.]+)\s*(?:hrs?|hours?)\s*(?:on record|total|played)?/i);
    if(prevHrs&&items.length){items[items.length-1].hours=parseFloat(prevHrs[1].replace(/,/g,""))||0;continue}
    /* Comma-separated single line of multiple titles */
    if(lines.length===1&&ln.includes(",")){
      ln.split(",").map(s=>s.trim()).filter(Boolean).forEach(t=>items.push({appid:0,name:t,hours:0}));
      break;
    }
    items.push({appid:0,name:ln.replace(/^[-•*\d.)]+\s*/,"").trim(),hours:0});
  }
  return items.filter(x=>x.appid||(x.name&&x.name.length>=2));
}
function resolveSteamMatches(rawItems){
  const byG=new Map();
  for(const it of rawItems){
    const g=matchSteamGame(it.appid,it.name);
    if(!g||!playable(g))continue;
    const hrs=+it.hours||0;
    const prev=byG.get(g.id);
    if(!prev||hrs>prev.hours){
      const lv=hrs>=60?3:hrs>=15?2:1;
      byG.set(g.id,{g,hours:hrs,lv,checked:true,exists:levelOf(hist,g)>0});
    }
  }
  return [...byG.values()].sort((a,b)=>(b.hours-a.hours)||(b.lv-a.lv)||(b.g.pop-a.g.pop));
}
let STEAM_UI={tab:"profile",idVal:"",pasteVal:"",status:"",err:"",matches:[],loading:false};
function openSteamImportSheet(){
  const m=STEAM_UI.matches,selN=m.filter(x=>x.checked).length;
  openSheet(`<div class="sheethead"><div><p class="eyebrow" style="margin-bottom:2px">PC library · 2-second import</p><h2>Import games from Steam</h2><p class="sub" style="margin:2px 0 0">Pull from a public Steam profile via our read-only proxy, or paste your Steam Games page / JSON directly (works even for private profiles).</p></div><button class="x" type="button" data-act="closeLayer" aria-label="Close">×</button></div>
    <div class="row" style="margin-bottom:12px">
      <span class="seg" role="group" aria-label="Steam import method">
        <button type="button" id="stmTabProf" aria-pressed="${STEAM_UI.tab==="profile"}">Public Steam Profile</button>
        <button type="button" id="stmTabPaste" aria-pressed="${STEAM_UI.tab==="paste"}">Instant Paste / JSON</button>
      </span>
    </div>
    ${STEAM_UI.tab==="profile"
      ?`<form id="stmProfForm" class="row" style="gap:8px;align-items:flex-end">
          <label class="field" for="stmIdIn" style="flex:1;min-width:200px">Steam vanity name, SteamID64, or profile URL
            <input class="input" id="stmIdIn" placeholder="e.g. gabelogannewell or 76561197960287930" value="${esc(STEAM_UI.idVal)}" autocomplete="off">
          </label>
          <button type="submit" class="btn primary" id="stmFetchBtn" ${STEAM_UI.loading?"disabled":""}>${STEAM_UI.loading?"Fetching…":"Fetch games"}</button>
        </form>
        <p class="sync" style="margin:8px 0 0">Privacy: read-only lookup, nothing stored on our server. If Steam hides your game list or asks for sign-in, switch to <b>Instant Paste / JSON</b>.</p>`
      :`<label class="field" for="stmPasteIn">Paste your Steam Games page (Ctrl+A → Ctrl+C), GetOwnedGames JSON, or game titles / <code>s:&lt;appid&gt;</code>
          <textarea class="input" id="stmPasteIn" rows="5" placeholder="Example:\nHalf-Life 2 - 48 hrs\nPortal 2 - 22 hrs\nStardew Valley - 140 hrs\nCounter-Strike 2\n(or paste Ctrl+A from steamcommunity.com/id/YOU/games/?tab=all)">${esc(STEAM_UI.pasteVal)}</textarea>
        </label>
        <div class="row" style="margin-top:8px;justify-content:space-between">
          <span class="sync">Hours auto-map: 60h+ → ♥ · 15h+ → ★ · &lt;15h → ✓</span>
          <button type="button" class="btn primary" id="stmParseBtn">Match against ${G.length.toLocaleString()} catalog games</button>
        </div>`}
    ${STEAM_UI.status?`<p class="sub" style="margin:10px 0 0;color:var(--craft)">${esc(STEAM_UI.status)}</p>`:""}
    ${STEAM_UI.err?`<p class="sub" style="margin:10px 0 0;color:var(--love)">${esc(STEAM_UI.err)}</p>`:""}
    ${m.length?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
      <div class="row" style="justify-content:space-between;margin-bottom:6px">
        <b>Matched ${plural(m.length,"catalog game")} (${selN} selected)</b>
        <span class="row" style="gap:6px"><button type="button" class="btn sm ghost" id="stmSelAll">All</button><button type="button" class="btn sm ghost" id="stmSelNone">None</button></span>
      </div>
      <div class="steam-list" id="stmList">${m.map((it,idx)=>`<label class="steam-row" style="cursor:pointer">
        <input type="checkbox" data-si="${idx}" ${it.checked?"checked":""}>
        ${cover(it.g,{showYear:false})}
        <span style="min-width:0"><b style="display:block;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.g.title)}</b><small style="color:var(--muted)">${it.g.year}${it.hours?` · ${it.hours} hrs`:""}${it.exists?" · already on timeline":""}</small></span>
        <span class="pill" style="font-size:11px">${LV[it.lv].m} ${LV[it.lv].label}</span>
      </label>`).join("")}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px;gap:8px">
        <button type="button" class="btn primary" id="stmCommitBtn" ${selN?"":"disabled"}>Import ${plural(selN,"game")} to timeline</button>
      </div>
    </div>`:""}`,"Import from Steam",{wide:true});
  const tProf=$("#stmTabProf"),tPaste=$("#stmTabPaste");
  if(tProf)tProf.onclick=()=>{STEAM_UI.tab="profile";STEAM_UI.err="";openSteamImportSheet()};
  if(tPaste)tPaste.onclick=()=>{STEAM_UI.tab="paste";STEAM_UI.err="";openSteamImportSheet()};
  const pForm=$("#stmProfForm"),idIn=$("#stmIdIn");
  if(idIn)idIn.oninput=()=>{STEAM_UI.idVal=idIn.value};
  if(pForm)pForm.onsubmit=async ev=>{
    ev.preventDefault();
    const q=(idIn?idIn.value:"").trim();
    if(!q){STEAM_UI.err="Enter a Steam vanity username, SteamID64, or profile URL.";openSteamImportSheet();return}
    STEAM_UI.idVal=q;STEAM_UI.loading=true;STEAM_UI.err="";STEAM_UI.status="";openSteamImportSheet();
    try{
      const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),9500);
      const r=await fetch(`${STEAM_IMPORT_URL}?id=${encodeURIComponent(q)}`,{headers:{"apikey":SUPABASE_PUB_KEY},signal:ac.signal});
      clearTimeout(tm);
      const data=await r.json().catch(()=>({}));
      STEAM_UI.loading=false;
      if(!r.ok||!data.ok){
        const code=data.code||data.error||"";
        if(code==="steam_login_gate"||code==="private_profile"||code==="private_games"||code==="upstream_rate_limited"){
          STEAM_UI.tab="paste";
          STEAM_UI.err=data.message||"Steam requires sign-in or your Game Details are private — paste your Steam Games list below for an instant 2-second import.";
        }else{
          STEAM_UI.err=data.message||`Steam proxy unavailable (${r.status}) — switch to Instant Paste / JSON to import right away.`;
        }
        openSteamImportSheet();return;
      }
      const matched=resolveSteamMatches(data.games||[]);
      STEAM_UI.matches=matched;
      STEAM_UI.status=`Found ${(data.total||0).toLocaleString()} Steam games · matched ${matched.length} in the Played & Made catalog.`;
      if(!matched.length)STEAM_UI.err="No catalog matches found — try Instant Paste if titles use alternate names.";
      openSteamImportSheet();
    }catch(e){
      STEAM_UI.loading=false;
      STEAM_UI.tab="paste";
      STEAM_UI.err="Couldn't reach the Steam proxy right now — paste your Steam Games page or JSON below to import offline.";
      openSteamImportSheet();
    }
  };
  const pasteIn=$("#stmPasteIn"),parseBtn=$("#stmParseBtn");
  if(pasteIn)pasteIn.oninput=()=>{STEAM_UI.pasteVal=pasteIn.value};
  if(parseBtn)parseBtn.onclick=()=>{
    const txt=(pasteIn?pasteIn.value:STEAM_UI.pasteVal)||"";
    STEAM_UI.pasteVal=txt;STEAM_UI.err="";
    const parsed=parseSteamPasteText(txt);
    const matched=resolveSteamMatches(parsed);
    STEAM_UI.matches=matched;
    if(matched.length)STEAM_UI.status=`Parsed ${parsed.length} entries · matched ${matched.length} catalog games.`;
    else STEAM_UI.err="No catalog games matched that text. Try pasting game titles (one per line), s:<appid>, or GetOwnedGames JSON.";
    openSteamImportSheet();
  };
  const list=$("#stmList");
  if(list)list.addEventListener("change",ev=>{
    const cb=ev.target.closest("input[data-si]");if(!cb)return;
    const it=STEAM_UI.matches[+cb.dataset.si];if(it)it.checked=cb.checked;
    const n=STEAM_UI.matches.filter(x=>x.checked).length;
    const btn=$("#stmCommitBtn");if(btn){btn.disabled=!n;btn.textContent=`Import ${plural(n,"game")} to timeline`}
  });
  const sAll=$("#stmSelAll"),sNone=$("#stmSelNone"),commit=$("#stmCommitBtn");
  if(sAll)sAll.onclick=()=>{STEAM_UI.matches.forEach(x=>x.checked=true);openSteamImportSheet()};
  if(sNone)sNone.onclick=()=>{STEAM_UI.matches.forEach(x=>x.checked=false);openSteamImportSheet()};
  if(commit)commit.onclick=()=>{
    const chosen=STEAM_UI.matches.filter(x=>x.checked);
    if(!chosen.length)return;
    ensureTimelineReady(()=>{
      let added=0;
      chosen.forEach(it=>{
        const cur=levelOf(hist,it.g);
        if(cur<it.lv){setLevel(it.g,it.lv);added++}
      });
      if(!(hist.owned||[]).includes("PC")){hist.owned=[...(hist.owned||[]),"PC"];save()}
      STEAM_UI.matches=[];STEAM_UI.status="";STEAM_UI.err="";
      playBlip(3);haptic([12,24,16]);
      trackEvent("steam_import",String(chosen.length));
      clearLayer();
      toast(`Imported ${plural(chosen.length,"Steam game")}${added<chosen.length?` (${added} new/upgraded)`:""}`);
      go("timeline");
    });
  };
}

/* ================================================================
   Actions (one delegated click handler)
   ================================================================ */
const ACTIONS={
  noop(){},
  toastUndo(){const fn=_toastUndoFn;hideToast();if(fn)fn()},
  navBack(el){navBack(el&&el.dataset&&el.dataset.fb)},
  scrollTop(){window.scrollTo({top:0,behavior:"smooth"})},
  heroEra(el){
    const ek=el.dataset.era||"90s";
    state.heroEra=ek;state.heroBirth=null;state.heroShuffle=0;
    hist.era=ek;hist.birth=null;save();
    render();
  },
  heroShuffle(){state.heroShuffle=(state.heroShuffle||0)+1;render()},
  heroCycle(el){
    const g=byId.get(el.dataset.id);if(!g)return;
    if(!hist.birth&&!hist.era){hist.era=state.heroEra||"90s";save()}
    const wasEmpty=!entries(hist).length;
    const nl=cycleLevel(g);playBlip(nl);
    if(wasEmpty&&nl>0)trackEvent("timeline_started","hero");
    refreshTile(el,g);updateHeroBar();
  },
  luckyWheel(){openLuckyWheel()},
  wheelFilter(el){state.wheelFilter=el.dataset.f==="childhood"?"childhood":"all";openLuckyWheel()},
  wheelRefresh(){openLuckyWheel()},
  almTab(el){const h=el.dataset.h||el.dataset.t||"vault";state.almTab=el.dataset.t||"vault";go(h)},
  sfxToggle(){toggleSfx();if($("#sheetDlg")&&$("#sheetDlg").open&&$("#setForm"))openSettings()},
  synthToggle(){toggleSynth()},
  eraMemTog(){state.eraMem=state.eraMem?0:1;store.set("ib3-eramem",state.eraMem);if($("#sheetDlg")&&$("#sheetDlg").open&&$("#setForm"))openSettings();else{const y=window.scrollY;render();window.scrollTo({top:y})}},
  devModeTog(){
    state.devMode=state.devMode?0:1;store.set("ib3-devmode",state.devMode);
    updateGearMenu();
    toast(state.devMode?"🛠 Maker mode enabled":"Maker mode hidden");
    const dlg=$("#sheetDlg");
    if(dlg&&dlg.open&&$("#setForm"))openSettings();
    else{const y=window.scrollY;render();window.scrollTo({top:y})}
  },
  sandboxEnter(){
    store.set("ib3-stashed-hist",packHist(hist));
    hist=blankHist();save();clearLayer();
    toast("Testing fresh visitor flow — your timeline is stashed above");
    go("start");
  },
  sandboxExit(){
    const raw=store.get("ib3-stashed-hist");if(!raw)return;
    const restored=cleanTimeline(raw);
    if(restored.birth||restored.era||Object.keys(restored.years||{}).length)hist=restored;
    store.del("ib3-stashed-hist");save();clearLayer();
    toast("Returned to your saved timeline");
    go("timeline");
  },
  sandboxCommit(){
    store.del("ib3-stashed-hist");renderSandboxBar();
    toast("Kept current timeline");
  },
  quickLook(el){const g=byId.get(el.dataset.id);if(g)openQuickLook(g)},
  qlSetLv(el){
    const g=byId.get(el.dataset.id);if(!g)return;
    const v=+el.dataset.lv;
    ensureTimelineReady(()=>{
      const cur=levelOf(hist,g),nl=v===cur?0:v;
      const res=setLevel(g,nl);playBlip(nl);
      $$(`.art[data-id="${CSS.escape(g.id)}"]`).forEach(btn=>refreshTile(btn,g));
      updatePickBar();updateHeroBar();
      openQuickLook(g);
      if(res&&res.removed)toast(`Removed ${g.title}`,{ms:6000,undo:()=>restoreRemovedEntry(res.removed)});
      else toast(nl?`${LV[nl].label}: ${g.title}`:`Removed ${g.title}`);
    });
  },
  qlQuickTag(el){
    const g=byId.get(el.dataset.id);if(!g)return;
    const tg=el.dataset.tag;
    ensureTimelineReady(()=>{
      if(!levelOf(hist,g))setLevel(g,1);
      const e=entryOf(hist,g);if(!e)return;
      const cur=(e.mtags||[]).slice(),i=cur.indexOf(tg);
      if(i>=0)cur.splice(i,1);else if(cur.length<5)cur.push(tg);
      if(cur.length)e.mtags=cur;else delete e.mtags;
      save();playBlip(i>=0?0:2);openQuickLook(g);
      toast(i>=0?`Removed tag ${tg}`:`Tagged ${g.title}: ${tg}`);
    });
  },
  qtick(el){
    const g=byId.get(el.dataset.id);if(!g)return;
    ensureTimelineReady(()=>{
      const nl=cycleLevel(g);playBlip(nl);
      el.className="qtick"+(nl?" lv"+nl:"");
      el.textContent=nl?`${LV[nl].m} ${LV[nl].label}`:"+ Played";
      el.setAttribute("aria-pressed",nl>0);
      if(el.closest(".tile"))refreshTile(el,g);
      if(nl>0)toast(`${LV[nl].label}: ${g.title}`);
    });
  },
  goPrices(){clearLayer();state.almTab="prices";go("prices")},
  priceReal(el){state.priceReal=el.dataset.v==="1";const y=window.scrollY;render();window.scrollTo({top:y})},
  priceComp(){state.priceComp=!state.priceComp;render();const top=$("#priceTop");if(top)top.scrollIntoView({behavior:"smooth",block:"start"})},
  priceEra(el){state.priceEra=+el.dataset.i;const y=window.scrollY;render();window.scrollTo({top:y})},
  genre(el){const k=el.dataset.g;if(!k)return;clearLayer();go("genre-"+k)},
  genrePick(el){state.almTab="genres";state.genreSel=el.dataset.g||"";render()},
  country(el){const cc=el.dataset.cc;if(!cc)return;clearLayer();go("country-"+cc)},
  worldPick(el){state.worldCC=el.dataset.cc||"";render();const d=$("#ccDetail");if(d)d.scrollIntoView({behavior:"smooth",block:"nearest"})},
  worldMode(el){state.worldMine=el.dataset.m==="mine";render()},
  pickMode(el){state.pickMode=el.dataset.m;render()},
  pickPack(el){state.packKey=el.dataset.k;const y=window.scrollY;render();window.scrollTo({top:y})},
  packSheet(){openPackSheet()},
  openSweatPack(){state.packKey="sweat";openPackSheet()},
  openHarborPack(){state.packKey="harbor";openPackSheet()},
  openDendyPack(){state.pickMode="packs";state.packKey="dendy";render()},
  openModsPack(){clearLayer();state.pickMode="packs";state.packKey="mods";go("picks")},
  packSheetPick(el){state.packKey=el.dataset.k;openPackSheet()},
  packCycle(el){const g=byId.get(el.dataset.id);if(!g)return;ensureTimelineReady(()=>{const nl=cycleLevel(g);playBlip(nl);$$(`.art[data-id="${CSS.escape(g.id)}"]`).forEach(btn=>refreshTile(btn,g));updatePickBar();updateHeroBar()})},
  watchTv(el){const g=byId.get(el.dataset.id);if(g)openVideoSheet(g,null,false)},
  gratSheet(el){
    const o={};
    if(el&&el.dataset){if(el.dataset.st!==undefined)o.st=el.dataset.st;if(el.dataset.id!==undefined)o.id=el.dataset.id}
    openGratitudeSheet(o);
  },
  gratClearPick(){GRAT_DRAFT.st="";GRAT_DRAFT.id="";openGratitudeSheet()},
  gratTag(el){GRAT_DRAFT.tag=el.dataset.tag;openGratitudeSheet()},
  async gratPostcard(){
    const note=(($("#gratNote")||{}).value||"").trim(),who=(($("#gratWho")||{}).value||"").trim();
    if(note.length<6){toast("Write a short thank-you note first");const el=$("#gratNote");if(el)el.focus();return}
    GRAT_DRAFT.note=note;GRAT_DRAFT.who=who;
    const item={studio:GRAT_DRAFT.st||"",game:GRAT_DRAFT.id||"",tag:GRAT_DRAFT.tag||"Carried me through",note,who:who||"A grateful player",year:NOW};
    const saved=store.get("ib3-gratitude",[]);
    if(!saved.some(x=>x.note===item.note&&x.studio===item.studio))saved.unshift(item);
    store.set("ib3-gratitude",saved.slice(0,50));
    const gm=item.game&&byId.get(item.game),st=item.studio&&findStudio(item.studio);
    const rep=gm||(st&&st.games&&st.games.slice().sort((a,b)=>b.pop-a.pop)[0])||null;
    playBlip(3);
    await exportCanvasPng(rep?[rep]:[],imgMap=>drawPostcard(item,imgMap),`thank-you-${slugStudio(st?st.name:gm?gm.title:"makers")}.png`,"#gratOut");
  },
  galPick(el){
    const g=byId.get(el.dataset.id);if(!g)return;
    const items=GAL_CACHE.get(g.id)||ACTIVE_GAL.items||[];
    const idx=+el.dataset.i;
    drawGalleryBox(g,el.dataset.box,items,idx===ACTIVE_GAL.idx&&el.classList.contains("galcard")?-1:idx);
  },
  gratCopy(){
    const note=(($("#gratNote")||{}).value||"").trim(),who=(($("#gratWho")||{}).value||"").trim();
    if(note.length<6){toast("Write a short thank-you note first");const el=$("#gratNote");if(el)el.focus();return}
    const gm=GRAT_DRAFT.id&&byId.get(GRAT_DRAFT.id),st=GRAT_DRAFT.st&&findStudio(GRAT_DRAFT.st);
    const target=gm&&st?`${gm.title} (${st.name})`:st?st.name:gm?gm.title:"the makers";
    copyText(`To ${target}:\n“${note}”${who?`\n— ${who}`:""}`);
  },
  featureSheet(el){
    const o={};
    if(el&&el.dataset){if(el.dataset.cat)o.cat=el.dataset.cat;if(el.dataset.title!==undefined)o.title=el.dataset.title}
    openFeatureSheet(o);
  },
  featCat(el){FEAT_DRAFT.cat=el.dataset.v;openFeatureSheet()},
  featScope(el){FEAT_DRAFT.scope=el.dataset.v;openFeatureSheet()},
  featGh(el){
    const t=(($("#featTitle")||{}).value||"").trim(),b=(($("#featBody")||{}).value||"").trim();
    if(Array.from(t).length<2){toast("Enter the console, game, or idea name first");const inp=$("#featTitle");if(inp)inp.focus();return}
    FEAT_DRAFT.title=t;FEAT_DRAFT.body=b;saveLocalRequest(t,b,FEAT_DRAFT.cat);
    const repo=el.dataset.repo||"https://github.com/JohanHeurlin/inspired-by";
    const isVault=FEAT_DRAFT.cat.includes("Cancelled"),isConsole=FEAT_DRAFT.cat.includes("Console"),isGame=FEAT_DRAFT.cat.includes("Game"),isLineage=FEAT_DRAFT.cat.includes("Lineage");
    const tag=isVault?"[Vault / Lore] ":isConsole?"[Console Request] ":isGame?"[Game Request] ":isLineage?"[Lineage Source] ":"[Feature] ";
    const body=`### Request summary\n${t}\n\n### Category\n${FEAT_DRAFT.cat}\n\n### Scope\n${FEAT_DRAFT.scope}\n\n### Details & notes\n${b||"(No extra details provided)"}`;
    window.open(`${repo}/issues/new?labels=feature-request&title=${encodeURIComponent(tag+t)}&body=${encodeURIComponent(body)}`,"_blank","noopener");
  },
  featRmSaved(el){
    const saved=store.get("ib3-requests",[]),i=+el.dataset.i;
    if(i>=0&&i<saved.length){saved.splice(i,1);store.set("ib3-requests",saved);openFeatureSheet()}
  },
  async gratSubmitReal(el){
    const note=(($("#gratNote")||{}).value||GRAT_DRAFT.note||"").trim();
    const who=(($("#gratWho")||{}).value||GRAT_DRAFT.who||"").trim();
    if(Array.from(note).length<12){toast("Write a short memory or thank-you note first");const inp=$("#gratNote");if(inp)inp.focus();return}
    const gm=GRAT_DRAFT.id?byId.get(GRAT_DRAFT.id):null;
    const st=GRAT_DRAFT.st?findStudio(GRAT_DRAFT.st):(gm?findStudio(studio(gm)):null);
    const target=gm&&st?`${gm.title} (${st.name})`:gm?gm.title:st?st.name:"Game makers";
    if(el){el.disabled=true;el.textContent="Submitting…"}
    const res=await submitInboxPayload({cat:"Maker Thank-You Note",title:`To ${target}${who?" — from "+who:""}`,body:`[${GRAT_DRAFT.tag||"Thank you"}] ${note}`,scope:"Community review"});
    if(el){el.disabled=false;el.textContent="Submit note for review"}
    const msg=$("#gratSubmitStatus");
    if(res&&res.ok){
      playBlip(2);
      if(msg){msg.hidden=false;msg.style.color="var(--craft)";msg.textContent="✓ Sent to the review queue."}
    }else if(msg){
      msg.hidden=false;msg.style.color="var(--love)";
      msg.textContent=res&&res.reason==="short"?"Please write a slightly longer title or note before submitting."
        :res&&res.reason==="cooldown"?"Sent — wait 10 seconds before submitting another."
        :res&&res.reason==="limit"?"Session limit reached (5 submissions)."
        :res&&res.reason==="links"?"Please include at most 3 links per submission."
        :"Couldn't reach the review queue right now — please try again in a moment.";
    }
  },
  rootsPick(el){
    const puzzle=buildRootsDaily(),idx=ROOTS_SESSION.step,rd=puzzle.rounds[idx];
    if(!rd||ROOTS_SESSION.picks[idx]!=null)return;
    const v=el.dataset.v,right=v===rd.ans;
    ROOTS_SESSION.picks[idx]=v;ROOTS_SESSION.results[idx]=right;
    playUiTick(right?"right":"wrong");
    haptic(right?10:[18,28,18]);
    renderRootsCard();
  },
  rootsNext(){
    const puzzle=buildRootsDaily();
    if(ROOTS_SESSION.step<puzzle.rounds.length-1){
      ROOTS_SESSION.step++;renderRootsCard();return;
    }
    const rs=loadRootsStore();
    if(!rs.done[puzzle.dateKey]){
      const score=ROOTS_SESSION.results.filter(Boolean).length;
      rs.done[puzzle.dateKey]={n:puzzle.n,score,results:ROOTS_SESSION.results.slice(0,puzzle.rounds.length)};
      const prev=rs.lastDay;
      if(prev===puzzle.dayNum-1)rs.streak=(rs.streak||0)+1;
      else if(prev!==puzzle.dayNum)rs.streak=1;
      rs.lastDay=puzzle.dayNum;
      rs.bestStreak=Math.max(rs.bestStreak||0,rs.streak);
      /* Keep last 90 days */
      const keys=Object.keys(rs.done).sort();
      if(keys.length>90)keys.slice(0,keys.length-90).forEach(k=>delete rs.done[k]);
      saveRootsStore(rs);
      playBlip(score>=4?3:2);haptic([12,20,16]);
      trackEvent("roots_complete",`${puzzle.n}:${score}`);
    }
    renderRootsCard();
  },
  rootsShare(){
    const puzzle=buildRootsDaily(),rs=loadRootsStore(),rec=rs.done[puzzle.dateKey];
    if(!rec)return;
    const txt=rootsShareText(puzzle,rec,rs.streak);
    trackEvent("roots_share",String(puzzle.n));
    if(navigator.share){navigator.share({title:`ROOTS #${puzzle.n} · Played & Made`,text:txt}).catch(()=>{copyText(txt)});return}
    copyText(txt);
  },
  rootsCopy(){
    const puzzle=buildRootsDaily(),rs=loadRootsStore(),rec=rs.done[puzzle.dateKey];
    if(!rec)return;
    trackEvent("roots_copy",String(puzzle.n));
    copyText(rootsShareText(puzzle,rec,rs.streak));
  },
  vsCycle(el){
    const g=byId.get(el.dataset.id);if(!g)return;
    ensureTimelineReady(()=>{
      const wasEmpty=!entries(hist).length;
      const nl=cycleLevel(g);playBlip(nl);
      refreshTile(el,g);
      if(state.viewing){
        const ov=weightedTasteMatch(hist,state.viewing.data);
        const hud=$("#vsHud");if(hud)hud.innerHTML=vsHudHTML(state.viewing);
        const hp=$("#vsHeadPct");if(hp)hp.textContent=ov.pct+"%";
        if(wasEmpty&&nl>0)trackEvent("friend_match",String(ov.pct));
      }
    });
  },
  openChallenger(){
    const ch=loadChallenger();
    if(!ch){toast("No active friend challenge");return}
    go(ch.payload+"&vs=1");
  },
  dismissChallenger(){
    try{localStorage.removeItem("pm-challenger")}catch(_){}
    const b=$("#challengerBar");if(b)b.remove();
  },
  duoPng(){if(state.viewing)exportDuoPng(state.viewing)},
  shareSlidePrev(){scrollShareToSlide((state.shareSlide||0)-1)},
  shareSlideNext(){scrollShareToSlide((state.shareSlide||0)+1)},
  shareSlideDot(el){scrollShareToSlide(+el.dataset.i||0)},
  shareCardNative(){const s=SHARE_SLIDES[state.shareSlide||0];if(s)shareOrDownloadSlide(s.k,true)},
  shareCardDl(){const s=SHARE_SLIDES[state.shareSlide||0];if(s)shareOrDownloadSlide(s.k,false)},
  chipPing(el){playChipFoley(el.dataset.sys||"");haptic(8)},
  creditsRoll(){openCreditsRoll(state.route.view==="shared"&&state.viewing?state.viewing.data:hist)},
  creditsPause(){if(!CREDITS)return;CREDITS.paused=!CREDITS.paused;const b=$("#crPauseBtn");if(b)b.textContent=CREDITS.paused?"Resume":"Pause"},
  creditsSpeed(){if(!CREDITS)return;CREDITS.mult=CREDITS.mult===1?2:1;const b=$("#crSpeedBtn");if(b)b.textContent=`Speed: ${CREDITS.mult}×`},
  creditsClose(){stopCreditsRoll()},
  attractPause(){
    if(!ATTRACT.active)return;
    ATTRACT.paused=!ATTRACT.paused;
    renderAttractPill(ATTRACT.paused?"Paused":`Spotlight: ${(byId.get(state.linId)||TREE[0]).title}`);
  },
  attractStop(){stopAttractMode(true);toast("Attract mode turned off for this session")},
  steamImport(){openSteamImportSheet()},
  linFocus(el){const id=el.dataset.id;if(!id)return;state.linId=id;state.treeMore={};go("lineage-"+id)},
  shuffleStories(){storyDeckOffset++;const cur=$("#homeStories");if(cur){const tmp=document.createElement("div");tmp.innerHTML=rotatingStoriesHTML();if(tmp.firstElementChild)cur.replaceWith(tmp.firstElementChild)}else{const y=window.scrollY;render();window.scrollTo({top:y})}},
  jumpPanel(el){jumpToPanel(el.dataset.dir||"up",el.dataset.id||"")},
  reachSheet(el){const g=byId.get(el.dataset.id);if(!g)return;openReachSheet(g,el.dataset.dir||"down",true)},
  reachStep(el){const g=byId.get(REACH_STATE.gid);if(!g)return;REACH_STATE.step=el.dataset.s||"all";REACH_STATE.cap=48;openReachSheet(g,REACH_STATE.dir,false)},
  reachMore(){const g=byId.get(REACH_STATE.gid);if(!g)return;REACH_STATE.cap+=48;openReachSheet(g,REACH_STATE.dir,false)},
  reachOpenGame(el){const id=el.dataset.id;if(!id)return;clearLayer();go(id)},
  vidMinimize(){minimizeVidDock()},
  vidExpand(){expandVidDock()},
  vidClose(){closeVidDock()},
  vidCycleCorner(){cycleVidCorner()},
  vidKeyHelp(){toast("Tip: Drag ⠿ or press Arrow keys to move · ⇄ snaps corners · ⤢ expands")},
  vidGoLineage(){const id=VID_STATE.gid;minimizeVidDock();if(!id)return;const g=byId.get(id);if(g&&g.tree){state.linId=id;state.treeMore={};go("lineage-"+id)}else go(id)},
  vidGoGame(){const id=VID_STATE.gid;minimizeVidDock();if(id)go(id)},
  vidGoWalk(){const g=VID_STATE.gid&&byId.get(VID_STATE.gid);minimizeVidDock();if(g&&UP[g.i]&&UP[g.i].length)openStory(rootsChain(g.i))},
  goGiveBack(){clearLayer();go("giveback")},
  toDna(){const s=$("#dna");if(s)s.scrollIntoView({behavior:"smooth",block:"start"})},
  quizMode(el){state.quizMode=el.dataset.m||"lore";quiz=newQuiz();renderQuiz()},
  quizPickVal(el){if(!quiz||quiz.picked!=null)return;quiz.picked=el.dataset.v;const right=quiz.picked===quiz.ans;playUiTick(right?"right":"wrong");if(right){quizStreak++;if(quizStreak>quizBest){quizBest=quizStreak;store.set("ib2-best",quizBest)}}else quizStreak=0;renderQuiz()},
  quizPick(el){if(!quiz||quiz.picked!=null)return;quiz.picked=+el.dataset.i;const right=quiz.picked===quiz.parent.i;playUiTick(right?"right":"wrong");if(right){quizStreak++;if(quizStreak>quizBest){quizBest=quizStreak;store.set("ib2-best",quizBest)}}else quizStreak=0;renderQuiz()},
  quizNext(){quiz=newQuiz();renderQuiz()},
  shareStreak(){
    const best=Math.max(quizStreak,quizBest,1),md=QUIZ_MODES.find(x=>x[0]===(state.quizMode||"lore"));
    trackEvent("trivia_streak",state.quizMode||"lore");
    const txt=`I hit a ${best}-in-a-row streak in Played & Made's ${md?md[1]:"Game History"} Trivia. Can you beat it?\n${shareBase()}#daily`;
    if(navigator.share){navigator.share({title:"Played & Made — Daily Trivia",text:txt}).catch(()=>{copyText(txt)});return}
    copyText(txt);
  },
  infMode(el){state.infMode=el.dataset.m;store.set("ib2-inf",state.infMode);const y=window.scrollY;render();window.scrollTo({top:y})},
  cmpMode(el){state.cmpMode=el.dataset.m;if(state.viewing)openCompare(state.viewing)},
  stFilt(el){state.stFilter=el.dataset.f;render()},
  tlMode(el){state.tlMode=el.dataset.m;const y=window.scrollY;render();window.scrollTo({top:y})},
  makerSheet(){openMakerSheet()},
  mkRole(el){state.makerRole=state.makerRole===el.dataset.role?"":el.dataset.role;openMakerSheet()},
  mkWkType(el){state.makerWkType=el.dataset.wt||"";openMakerSheet()},
  mkRmSt(el){toggleWorkedStudio(el.dataset.st);openMakerSheet()},
  mkRmWk(el){const y=+el.dataset.y,p=hist.years[y]||[],i=p.findIndex(x=>norm(x.t)===norm(el.dataset.t));if(i>=0){if(p[i].y===null)p.splice(i,1);else{delete p[i].wk;delete p[i].role;delete p[i].wy;delete p[i].wkType}save()}openMakerSheet()},
  mkDone(){const byEl=$("#mkBirth"),nmEl=$("#mkName");if(nmEl&&nmEl.value.trim())hist.name=nmEl.value.trim().slice(0,24);if(byEl){const y=parseInt(byEl.value,10);if(y>=1940&&y<=NOW-3){hist.birth=y;hist.era=String(Math.floor(y/10)*10).slice(-2)+"s"}}if(!hist.birth&&!hist.era)hist.era=state.heroEra||"90s";hist.stage=null;if(workedEntries(hist).length)state.tlMode="worked";save();clearLayer();go("timeline")},
  toggleWk(el){const g=byId.get(el.dataset.id);if(!g)return;ensureTimelineReady(()=>{const on=toggleWorked(g);const y=window.scrollY;render();window.scrollTo({top:y});toast(on?`🛠 Marked as worked on: ${g.title}`:`Removed dev credit: ${g.title}`)})},
  setWkRole(el){const g=byId.get(el.dataset.id);if(!g)return;const cur=entryOf(hist,g),nr=cur&&cur.role===el.dataset.role?"":el.dataset.role;toggleWorked(g,nr);const y=window.scrollY;render();window.scrollTo({top:y})},
  toggleWkSt(el){const id=el.dataset.st;if(!id)return;ensureTimelineReady(()=>{const on=toggleWorkedStudio(id),st=STUDIOS.get(id);const y=window.scrollY;render();window.scrollTo({top:y});toast(on?`🛠 Added ${st?st.name:id} to your studios`:`Removed studio`)})},
  studio(el){const id=el.dataset.st;if(!id)return;clearLayer();go("studio-"+id)},
  goStudios(){go("studios")},
  artToggle(){const r=document.documentElement;r.dataset.art=r.dataset.art==="era"?"real":"era";store.set("ib3-art",r.dataset.art);updateGearMenu();if($("#sheetDlg")&&$("#sheetDlg").open&&$("#setForm"))openSettings()},
  map(){openMap()},
  mapView(el){state.mapMode=el.dataset.m||"pillars";if(MAP){MAP.k=1;MAP.tx=0;MAP.ty=0;$$("[data-act='mapView']",$("#layer")).forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===state.mapMode));drawMap();mapCard()}},
  mapStrongTog(el){state.mapStrong=!state.mapStrong;el.setAttribute("aria-pressed",state.mapStrong);el.textContent="Links: "+(state.mapStrong?"Primary":"All");if(MAP)drawMap()},
  mapZoom(el){if(MAP)mapZoomAt(+el.dataset.z,MAP.W/2,MAP.H/2)},
  mapReset(){if(MAP){MAP.k=1;MAP.tx=0;MAP.ty=0;MAP.sel=null;drawMap();mapCard()}},
  suggest(el){
    const subj=(el&&el.dataset&&el.dataset.subj)||"";
    openFeatureSheet({cat:"Lineage Link / Source",title:subj});
  },
  game(el){const id=el.dataset.id;if(!id)return;const fromModal=!!(el.dataset.close||story||($("#sheetDlg")&&$("#sheetDlg").open));if(fromModal){closeStory();clearLayer()}go(id,fromModal?null:el)},
  walk(el){const g=byId.get(el.dataset.id);if(!g)return;if(el.dataset.close||($("#sheetDlg")&&$("#sheetDlg").open))clearLayer();openStory(rootsChain(g.i))},
  cycle(el){const g=byId.get(el.dataset.id);if(!g)return;const nl=cycleLevel(g);playBlip(nl);refreshTile(el,g);updatePickBar()},
  own(el){const n=el.dataset.sys,o=new Set(hist.owned||[]);const adding=!o.has(n);adding?o.add(n):o.delete(n);hist.owned=[...o];save();el.setAttribute("aria-pressed",o.has(n));if(adding){playChipFoley(n);haptic(8)}const c=$("#ownCount");if(c)c.textContent=o.size?plural(o.size,"system")+" picked":"Optional — pick a few or skip"},
  obBack(){hist.stage=null;save();if(entries(hist).length)go("picks");else go("start")},
  obPicks(){hist.stage=null;save();go("picks")},
  pickSys(el){const v=el.dataset.sys||"";state.pickSys=state.pickSys===v&&v?"":v;render();const on=$(`.pickstrip [data-act="pickSys"][aria-pressed="true"]`);if(on&&on.scrollIntoView)try{on.scrollIntoView({block:"nearest",inline:"nearest",container:"nearest"})}catch(e){on.scrollIntoView({block:"nearest",inline:"nearest"})}},
  pickMore(el){const k=el.dataset.band+":"+(state.pickSys||"");state.pickExtra[k]=(state.pickExtra[k]||0)+24;const y=window.scrollY;render();window.scrollTo({top:y})},
  pickAll(el){const k=el.dataset.band+":"+(state.pickSys||"");state.pickExtra[k]=9999;const y=window.scrollY;render();window.scrollTo({top:y})},
  pickLess(el){const k=el.dataset.band+":"+(state.pickSys||"");delete state.pickExtra[k];const sec=el.closest(".band"),id=sec&&sec.id;render();const nsec=id&&document.getElementById(id);if(nsec)nsec.scrollIntoView({behavior:"smooth",block:"start"})},
  bandJump(el){const t=document.getElementById(el.dataset.to);if(t)t.scrollIntoView({behavior:"smooth",block:"start"})},
  obDone(){hist.stage=null;save();if(entries(hist).length)go("timeline");else toast("Tap at least one game first")},
  obSystems(){hist.stage=null;save();clearLayer();go("systems")},
  obAgain(){hist.stage=null;save();clearLayer();go("picks")},
  setlv(el){const g=byId.get(el.dataset.id);if(!g)return;const v=+el.dataset.lv;ensureTimelineReady(()=>{const cur=levelOf(hist,g),nl=v===cur?0:v;const res=setLevel(g,nl);playBlip(nl);render();if(res&&res.removed)toast(`Removed ${g.title}`,{ms:6000,undo:()=>restoreRemovedEntry(res.removed)});else toast(nl?`${LV[nl].label}: ${g.title}`:`Removed ${g.title}`)})},
  entry(el){openGameSheet(+el.dataset.y,el.dataset.t,!!el.dataset.ro)},
  entryLv(el){const y=+el.dataset.y,p=hist.years[y]||[],e=p.find(x=>norm(x.t)===norm(el.dataset.t));if(e){e.lv=+el.dataset.lv;playBlip(e.lv);sortPile(p);save();openGameSheet(y,e.t)}},
  entryWk(el){const y=+el.dataset.y,p=hist.years[y]||[],e=p.find(x=>norm(x.t)===norm(el.dataset.t));if(!e)return;if(e.wk){delete e.wk;delete e.role;delete e.wy;delete e.wkType}else{e.wk=1;if(!e.wy)e.wy=y}sortPile(p);save();openGameSheet(y,e.t)},
  entryWkType(el){const y=+el.dataset.y,e=(hist.years[y]||[]).find(x=>norm(x.t)===norm(el.dataset.t));if(!e)return;const wt=el.dataset.wt||"";if(wt==="mod"||wt==="unshipped")e.wkType=wt;else delete e.wkType;save();openGameSheet(y,e.t)},
  entryWyGo(el){const y=+el.dataset.y,e=(hist.years[y]||[]).find(x=>norm(x.t)===norm(el.dataset.t));if(!e)return;const v=parseInt(($("#entryWyIn")||{}).value,10);if(!(v>=1950&&v<=NOW)){toast(`Enter a worked year between 1950 and ${NOW}`);return}e.wy=v;save();openGameSheet(y,e.t);toast(`Worked year set to ${v}`)},
  entryRole(el){const y=+el.dataset.y,e=(hist.years[y]||[]).find(x=>norm(x.t)===norm(el.dataset.t));if(!e)return;if(e.role===el.dataset.role)delete e.role;else e.role=el.dataset.role;save();openGameSheet(y,e.t)},
  entryYr(el){const ny=moveEntryYear(+el.dataset.y,el.dataset.t,+el.dataset.to);openGameSheet(ny,el.dataset.t);toast(`Moved to ${ny}`)},
  entryYrGo(el){const v=parseInt(($("#entryYrIn")||{}).value,10);if(!(v>=1950&&v<=NOW)){toast(`Enter a year between 1950 and ${NOW}`);return}const ny=moveEntryYear(+el.dataset.y,el.dataset.t,v);openGameSheet(ny,el.dataset.t);toast(`Moved to ${ny}`)},
  entryTag(el){const y=+el.dataset.y,e=(hist.years[y]||[]).find(x=>norm(x.t)===norm(el.dataset.t));if(!e)return;const tg=el.dataset.tag,cur=(e.mtags||[]).slice(),i=cur.indexOf(tg);if(i>=0)cur.splice(i,1);else if(cur.length<4)cur.push(tg);if(cur.length)e.mtags=cur;else delete e.mtags;save();openGameSheet(y,e.t)},
  entrySys(el){const y=+el.dataset.y,e=(hist.years[y]||[]).find(x=>norm(x.t)===norm(el.dataset.t));if(!e)return;const cur=sysListOf(e,hist).slice(),n=el.dataset.sys,i=cur.indexOf(n);if(i>=0)cur.splice(i,1);else cur.push(n);e.systems=cur;delete e.sys;save();openGameSheet(y,e.t)},
  entryRm(el){const snap=removeEntry(+el.dataset.y,el.dataset.t);closeLayer();if(snap)toast(`Removed ${snap.entry.t}`,{ms:6000,undo:()=>restoreRemovedEntry(snap)});else toast("Removed")},
  year(el){openYearSheet(+el.dataset.y)},
  yearNav(el){openYearSheet(+el.dataset.y,($("#customIn")||{}).value||"")},
  yearAll(el){state.showAllYear=!state.showAllYear;openYearSheet(+el.dataset.y,($("#customIn")||{}).value||"")},
  closeLayer(el,e){if(el&&el.dataset&&el.dataset.self&&e&&e.target!==el)return;closeLayer()},
  share(){if(!entries(hist).length){toast("Add some games first");return}openShare()},
  copyShare(){const v=$("#shareLink").value;trackEvent("share_link","timeline");copyText(v,$("#shareLink"))},
  webShare(){const u=currentShareURL();trackEvent("share_link","webshare");if(navigator.share)navigator.share({title:`${hist.name?hist.name+"'s":"My"} life in games · Played & Made`,text:"Here's my gaming timeline — compare yours:",url:u}).catch(()=>{})},
  emailSelf(){const u=currentShareURL(""),sub=`My life in games (${entries(hist).length} games) · Played & Made`;location.href=`mailto:?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent("Here is my Played & Made gaming timeline link (open it on any device to view or continue editing):\n\n"+u)}`},
  dlJson(){const blob=new Blob([JSON.stringify(packHist(hist),null,2)],{type:"application/json"});const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`played-and-made-timeline-${hist.name?slugStudio(hist.name):hist.era||"backup"}.json`;document.body.appendChild(a);a.click();a.remove();toast("Backup downloaded")},
  adoptAsk(){const f=state.viewing;if(!f||!f.data)return;if(!entries(hist).length){hist=JSON.parse(JSON.stringify(f.data));save();toast("Loaded as your timeline");go("timeline");return}$("#adoptBox").innerHTML=`<div class="banner"><p>Replace your current timeline on this device (${plural(entries(hist).length,"game")}) with <b>${esc(f.name)}'s</b> (${plural(entries(f.data).length,"game")})?</p><div class="row"><button class="btn primary" data-act="adoptDo">Yes, load it</button><button class="btn" data-act="adoptNo">Cancel</button></div></div>`},
  adoptDo(){const f=state.viewing;if(!f||!f.data)return;hist=JSON.parse(JSON.stringify(f.data));save();toast("Loaded as your timeline");go("timeline")},
  adoptNo(){const b=$("#adoptBox");if(b)b.innerHTML=""},
  copyLink(el){copyText(shareBase()+"#"+el.dataset.payload)},
  copyWalk(el){copyText(shareBase()+"#walk-"+el.dataset.id)},
  copyGame(el){copyText(shareBase()+"#"+el.dataset.id)},
  png(el){saveImage(el.dataset.kind,el.dataset.who)},
  poster(){state.posterMode="wall";openPoster(hist)},
  boxPile(){state.posterMode="pile";openPoster(hist)},
  posterMode(el){state.posterMode=el.dataset.m||"wall";openPoster(state.viewing?state.viewing.data:hist,state.viewing?state.viewing.name+"'s":null)},
  pileToss(){if(PILE&&PILE.toss)PILE.toss()},
  pileZeroG(){if(PILE&&PILE.toggleZeroG)PILE.toggleZeroG()},
  settings(){openSettings()},
  top10(){openTop10()},
  t10add(el){if((hist.top10||[]).length>=10)return;hist.top10=[...(hist.top10||[]),el.dataset.k];save();openTop10()},
  t10rm(el){hist.top10=(hist.top10||[]).filter(k=>k!==el.dataset.k);save();openTop10()},
  t10up(el){
    const list=$("#t10List"),row=el.closest&&el.closest(".t10-row");
    if(list&&row&&row.previousElementSibling){
      const title=row.querySelector("b")?.textContent||"Game";
      reorderTop10Dom(list,row,row.previousElementSibling,false,()=>{
        const pos=[...list.querySelectorAll(".t10-row")].indexOf(row)+1;
        announceSR(`${title} moved to rank ${pos}`);
        const nextFocus=!el.disabled?el:(row.querySelector('[data-act="t10down"]:not([disabled])')||row.querySelector(".t10-grab"));
        if(nextFocus)nextFocus.focus();
      });
      return;
    }
    const a=hist.top10,i=a.indexOf(el.dataset.k);if(i>0){[a[i-1],a[i]]=[a[i],a[i-1]];save();openTop10()}
  },
  t10down(el){
    const list=$("#t10List"),row=el.closest&&el.closest(".t10-row");
    if(list&&row&&row.nextElementSibling){
      const title=row.querySelector("b")?.textContent||"Game";
      reorderTop10Dom(list,row,row.nextElementSibling,true,()=>{
        const pos=[...list.querySelectorAll(".t10-row")].indexOf(row)+1;
        announceSR(`${title} moved to rank ${pos}`);
        const nextFocus=!el.disabled?el:(row.querySelector('[data-act="t10up"]:not([disabled])')||row.querySelector(".t10-grab"));
        if(nextFocus)nextFocus.focus();
      });
      return;
    }
    const a=hist.top10,i=a.indexOf(el.dataset.k);if(i>=0&&i<a.length-1){[a[i+1],a[i]]=[a[i],a[i+1]];save();openTop10()}
  },
  theme(){const r=document.documentElement,cur=r.dataset.theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");r.dataset.theme=cur==="dark"?"light":"dark";store.set("ib2-theme",r.dataset.theme);syncThemeColor();updateGearMenu()},
  async installApp(el){
    if(!el||el.getAttribute("aria-disabled")==="true")return;
    el.setAttribute("aria-disabled","true");
    try{
      if(PWA.supportsWebInstall){
        await navigator.install();
        PWA.installed=true;
        announceInstallStatus("The app was installed or opened.");
        syncInstallUI();
      }else if(PWA.deferred){
        const promptEvent=PWA.deferred;
        PWA.deferred=undefined;
        await promptEvent.prompt();
        const {outcome}=await promptEvent.userChoice;
        if(outcome==="accepted"){
          PWA.installed=true;
          announceInstallStatus("Played & Made installed.");
        }else{
          announceInstallStatus("Installation canceled.");
        }
        syncInstallUI();
      }
    }catch(err){
      if(err&&err.name==="AbortError"){
        announceInstallStatus("Installation was canceled or could not complete.");
      }else{
        announceInstallStatus("Installation could not start.");
        console.error(err);
      }
    }finally{
      el.removeAttribute("aria-disabled");
    }
  },
  resetAsk(){$("#resetBox").innerHTML=`<div class="banner"><p>Clear all ${plural(entries(hist).length,"game")} from your timeline?</p><div class="row"><button class="btn love" data-act="resetDo">Clear it</button><button class="btn" data-act="resetNo">Keep it</button></div></div>`},
  resetNo(){$("#resetBox").innerHTML=""},
  resetDo(){hist=blankHist();save();store.del("ib2-revealed");clearLayer();go("start");render();toast("Cleared")},
  tier(el){const tb=$("#treebox");if(tb)state.treeKeepScroll=tb.scrollLeft;const k=el.dataset.tier;state.tiers[k]=state.tiers[k]?0:1;store.set("ib2-tiers",state.tiers);const y=window.scrollY;render();window.scrollTo({top:y})},
  allTiers(){const tb=$("#treebox");if(tb)state.treeKeepScroll=tb.scrollLeft;TIERS.forEach(t=>state.tiers[t.k]=1);store.set("ib2-tiers",state.tiers);const y=window.scrollY;render();window.scrollTo({top:y})},
  moreLinks(el){state.treeMore[el.dataset.dir]=1;const y=window.scrollY;render();window.scrollTo({top:y})},
  treeMore(el){const tb=$("#treebox");if(tb)state.treeKeepScroll=tb.scrollLeft;state.treeMore["c"+el.dataset.col]=1;const y=window.scrollY;render();window.scrollTo({top:y})},
  treeColJump(el){
    const col=el.dataset.col,tb=$("#treebox");if(!tb)return;
    const hdr=tb.querySelector(`g[data-colx][data-col="${col}"]`);
    if(!hdr)return;
    const target=Math.max(0,(+hdr.dataset.colx)-tb.clientWidth/2);
    const moreBtn=tb.querySelector(`g[data-act="treeMore"][data-col="${col}"]`);
    if(moreBtn&&Math.abs(tb.scrollLeft-target)<36){
      state.treeKeepScroll=target;state.treeMore["c"+col]=1;
      const y=window.scrollY;render();window.scrollTo({top:y});return;
    }
    tb.scrollTo({left:target,behavior:"smooth"});
  },
  closeStory(){closeStory()},storyNext(){storyStep(1)},storyPrev(){storyStep(-1)},storyRestart(){if(story){story.dir=1;story.k=story.chain.length-1;drawStory()}},storyJump(el){if(story){const nk=+el.dataset.k;story.dir=nk<story.k?-1:1;story.k=nk;drawStory()}},
  compare(){const f=state.viewing;if(f)openCompare(f)}
};
async function copyText(v,input){try{await navigator.clipboard.writeText(v);toast("Copied to clipboard")}catch(e){if(input){input.focus();input.select()}toast("Select the text and copy it")}}
document.addEventListener("click",e=>{
  const closePop=e.target.closest("[data-close-pop]");
  if(closePop){
    const pid=closePop.dataset.closePop,pop=pid&&document.getElementById(pid);
    try{if(pop&&pop.matches(":popover-open"))pop.hidePopover()}catch(_){}
  }
  const el=e.target.closest("[data-act]");if(!el)return;const fn=ACTIONS[el.dataset.act];if(!fn)return;
  if(el.tagName==="A")e.preventDefault();fn(el,e);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#creditsOv")){e.preventDefault();stopCreditsRoll();return}
  if(e.key==="Escape"&&VID_STATE.open&&VID_STATE.mode==="theater"){e.preventDefault();minimizeVidDock();return}
  if(e.key==="Escape"&&!story&&$("#layer").innerHTML){e.preventDefault();closeLayer();return}
  if(!story&&ACTIVE_GAL.idx>=0&&ACTIVE_GAL.items.length>1&&$(ACTIVE_GAL.boxSel+" .galstage")){
    if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
      e.preventDefault();
      const g=byId.get(ACTIVE_GAL.gid),len=ACTIVE_GAL.items.length;
      if(g)drawGalleryBox(g,ACTIVE_GAL.boxSel,ACTIVE_GAL.items,(ACTIVE_GAL.idx+(e.key==="ArrowLeft"?-1:1)+len)%len);
      return;
    }
  }
  if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("g.wnode")){e.preventDefault();e.target.dispatchEvent(new MouseEvent("click",{bubbles:true}))}
});
/* Persist fold/peek state on Meanwhile era strips (toggle does not bubble -> capture:true) */
document.addEventListener("toggle",ev=>{
  const d=ev.target;
  if(!d||!d.matches||!d.matches("details.eramem[data-era]"))return;
  const k=d.dataset.era;if(!k)return;
  if(!state.eraFold)state.eraFold={};
  if(d.open)delete state.eraFold[k];else state.eraFold[k]=1;
  store.set("ib3-erafold",state.eraFold);
},{capture:true});
/* Delegated long-press (~450ms) on game cover tiles to inspect game info without corner overlay buttons */
(()=>{
  let lpTimer=0,lpStart=null,suppressNextClick=0;
  const cancelLP=()=>{clearTimeout(lpTimer);lpTimer=0;lpStart=null};
  document.addEventListener("click",ev=>{if(Date.now()<suppressNextClick){ev.stopPropagation();ev.preventDefault()}},true);
  document.addEventListener("pointerdown",ev=>{
    if(ev.button&&ev.button!==0)return;
    const art=ev.target.closest&&ev.target.closest(".tile .art[data-lp]");
    if(!art)return;
    const gid=art.dataset.lp;if(!gid)return;
    lpStart={pid:ev.pointerId,x:ev.clientX,y:ev.clientY};
    lpTimer=setTimeout(()=>{
      lpTimer=0;lpStart=null;
      const g=byId.get(gid);
      if(g){suppressNextClick=Date.now()+450;haptic(10);openQuickLook(g)}
    },450);
  });
  document.addEventListener("pointermove",ev=>{
    if(!lpStart||ev.pointerId!==lpStart.pid)return;
    if(Math.hypot(ev.clientX-lpStart.x,ev.clientY-lpStart.y)>8)cancelLP();
  });
  document.addEventListener("pointerup",cancelLP);
  document.addEventListener("pointercancel",cancelLP);
})();
/* Delegated natural swipe & drag gestures: gallery zoom, trivia next, year sheet, bottom-sheet dismiss & org-chart mouse pan */
(()=>{
  let gState=null,suppressClickUntil=0;
  document.addEventListener("click",ev=>{if(Date.now()<suppressClickUntil){ev.stopPropagation();ev.preventDefault()}},true);
  document.addEventListener("pointerdown",ev=>{
    if(ev.button&&ev.button!==0)return;
    if(ev.target.closest&&ev.target.closest(".lever-housing,.wheel-canvas"))return;
    const tb=ev.target.closest&&ev.target.closest(".treebox");
    if(tb&&ev.pointerType==="mouse"){
      gState={kind:"treepan",el:tb,pid:ev.pointerId,sx:ev.clientX,sy:ev.clientY,sl:tb.scrollLeft,st:tb.scrollTop,moved:false};
      return;
    }
    if(ev.target.closest&&ev.target.closest("input,textarea,select"))return;
    const gs=ev.target.closest&&ev.target.closest(".galstage");
    if(gs){gState={kind:"gal",pid:ev.pointerId,sx:ev.clientX,sy:ev.clientY};return}
    const qz=ev.target.closest&&ev.target.closest("#quiz");
    if(qz&&quiz&&quiz.picked!=null){gState={kind:"quiz",pid:ev.pointerId,sx:ev.clientX,sy:ev.clientY};return}
    const dlg=ev.target.closest&&ev.target.closest("#sheetDlg");
    if(dlg&&dlg.open){
      const inHead=!!(ev.target.closest&&ev.target.closest(".sheethead"));
      const yrPrev=dlg.querySelector('[data-act="yearNav"]');
      gState={kind:"dlg",dlg,inHead,hasYr:!!yrPrev,pid:ev.pointerId,sx:ev.clientX,sy:ev.clientY};
    }
  });
  document.addEventListener("pointermove",ev=>{
    if(!gState||ev.pointerId!==gState.pid)return;
    if(gState.kind==="treepan"){
      const dx=ev.clientX-gState.sx,dy=ev.clientY-gState.sy;
      if(!gState.moved&&Math.hypot(dx,dy)>6){gState.moved=true;gState.el.classList.add("dragging")}
      if(gState.moved){gState.el.scrollLeft=gState.sl-dx;gState.el.scrollTop=gState.st-dy}
    }
  });
  const endGesture=ev=>{
    if(!gState||ev.pointerId!==gState.pid)return;
    const st=gState;gState=null;
    const dx=ev.clientX-st.sx,dy=ev.clientY-st.sy;
    if(st.kind==="treepan"){
      st.el.classList.remove("dragging");
      if(st.moved)suppressClickUntil=Date.now()+180;
      return;
    }
    if(st.kind==="gal"&&ACTIVE_GAL.idx>=0&&ACTIVE_GAL.items.length>1){
      if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.3){
        const g=byId.get(ACTIVE_GAL.gid),len=ACTIVE_GAL.items.length;
        if(g)drawGalleryBox(g,ACTIVE_GAL.boxSel,ACTIVE_GAL.items,(ACTIVE_GAL.idx+(dx>0?-1:1)+len)%len);
      }else if(dy>75&&Math.abs(dy)>Math.abs(dx)*1.7){
        const g=byId.get(ACTIVE_GAL.gid);
        if(g)drawGalleryBox(g,ACTIVE_GAL.boxSel,ACTIVE_GAL.items,-1);
      }
      return;
    }
    if(st.kind==="quiz"&&dx<-48&&Math.abs(dx)>Math.abs(dy)*1.4){
      quiz=newQuiz();renderQuiz();return;
    }
    if(st.kind==="dlg"){
      if(st.inHead&&dy>72&&Math.abs(dy)>Math.abs(dx)*1.6&&st.dlg.scrollTop<=6){st.dlg.close();return}
      if(st.hasYr&&Math.abs(dx)>58&&Math.abs(dx)>Math.abs(dy)*1.6){
        const btns=[...st.dlg.querySelectorAll('[data-act="yearNav"]')];
        const target=dx>0?btns[0]:btns[btns.length-1];
        if(target)target.click();
      }
    }
  };
  document.addEventListener("pointerup",endGesture);
  document.addEventListener("pointercancel",()=>{if(gState&&gState.kind==="treepan")gState.el.classList.remove("dragging");gState=null});
})();
/* ---------- PWA helpers & theme-color sync ---------- */
function isStandaloneApp(){
  return !!(PWA.installed||(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true);
}
function canInstallApp(){
  return !isStandaloneApp()&&(PWA.supportsWebInstall||!!PWA.deferred);
}
function announceInstallStatus(msg){
  const sr=$("#srLive");if(sr)sr.textContent=msg;
  toast(msg);
}
function syncInstallUI(){
  const show=canInstallApp();
  document.querySelectorAll("[data-install-ui]").forEach(el=>{el.hidden=!show});
}
window.__pmSyncInstall=installed=>{
  syncInstallUI();
  if(installed)announceInstallStatus("Played & Made installed — launch anytime from your apps or home screen.");
};
function syncThemeColor(){
  const explicit=document.documentElement.dataset.theme;
  const dark=explicit?explicit==="dark":(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  const col=dark?"#0F141C":"#EAF0F7";
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>{
    if(explicit)m.removeAttribute("media");
    if(!m.getAttribute("media"))m.setAttribute("content",col);
  });
}
if(window.matchMedia){
  const mq=window.matchMedia("(display-mode: standalone)");
  if(mq.addEventListener)mq.addEventListener("change",()=>syncInstallUI());
}

/* ---------- boot & native <dialog closedby="any"> Safari fallback ---------- */
(()=>{
  const t=store.get("ib2-theme");if(t)document.documentElement.dataset.theme=t;
  const a=store.get("ib3-art");if(a)document.documentElement.dataset.art=a;
  syncThemeColor();
  syncInstallUI();
  updateArtBtn();
  updateAudioBtns();
  const dlg=$("#sheetDlg");
  if(dlg){
    dlg.addEventListener("close",()=>{
      if(dlg.open)return;
      stopLuckyWheel();
      clearShareBlobUrls();
      dlg.returnValue="";dlg.classList.remove("wide");dlg.innerHTML="";
      if(state.route.view==="timeline"||state.route.view==="start"||state.route.view==="picks"){const y=window.scrollY;render();window.scrollTo({top:y})}
    });
    if(!("closedBy" in HTMLDialogElement.prototype)){
      const outside=(ev,d)=>{const r=d.getBoundingClientRect();return ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom};
      let pressedOutside=false;
      dlg.addEventListener("pointerdown",ev=>{pressedOutside=outside(ev,dlg)});
      dlg.addEventListener("pointerup",ev=>{if(pressedOutside&&outside(ev,dlg))dlg.close()});
    }
  }
  if(typeof CSS!=="undefined"&&!CSS.supports("container-type","scroll-state")){
    const bar=$(".top");let lastY=window.scrollY;
    addEventListener("scroll",()=>{
      const y=Math.max(0,Math.min(window.scrollY,document.documentElement.scrollHeight-window.innerHeight));
      if(y===lastY)return;
      if(bar)bar.classList.toggle("is-hidden",y>lastY&&y>(bar.offsetHeight||64));
      lastY=y;
    },{passive:true});
  }
})();
route();
})();