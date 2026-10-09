/* Maple Market — read-only dashboard, live data branch */
(function(){
"use strict";
const DATA_URL="https://raw.githubusercontent.com/iplayvideogames/maplestory-market/data/prices.json";
const SNAPSHOT="./prices.json";
const INTERVAL=60000;
const MAX_ROWS=24;
const $=id=>document.getElementById(id);
const state={db:null,entries:[],items:[],byName:new Map(),selected:null,view:"all",showAll:false,hash:"",loading:false,firstLoad:true};
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=n=>n==null?"—":Math.round(n).toLocaleString("en-US");
const short=n=>{if(n==null)return"—";if(n>=1e6)return +(n/1e6).toFixed(2)+"m";if(n>=1000)return +(n/1000).toFixed(1)+"k";return num(n)};
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function trackedDate(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return "Date unknown";
  const [year,month,day]=value.split("-").map(Number);
  const check=new Date(Date.UTC(year,month-1,day));
  if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return "Date unknown";
  return MONTHS[month-1]+" "+day+", "+year;
}

const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/\b(luck)\b/g,"luk").replace(/\b(strength)\b/g,"str").replace(/\b(dexterity)\b/g,"dex").replace(/\b(intelligence)\b/g,"int").replace(/\b(pole arm)\b/g,"polearm").replace(/\b(earrings)\b/g,"earring").replace(/\b(t-shirt|tee)\b/g,"t shirt").replace(/\b(\d+)\s*(percent|pct)\b/g,"$1%").replace(/[^a-z0-9%]+/g," ").trim();
function category(name,meta){
  if(meta&&meta.category)return meta.category;
  if(/scroll|(\b60%|\b10%)/i.test(name))return"scroll";
  if(/\b(ore|ingot)\b/i.test(name))return"material";
  if(/\b(dagger|wand|ryden|work gloves|pan lid|nakamaki|forked)\b/i.test(name))return"equipment";
  if(/\b(coupon|throwing stars)\b/i.test(name))return"other";
  return"fashion";
}
const kindLabel={scroll:"Scroll",material:"Material",equipment:"Equipment",fashion:"Fashion / NX",other:"Other"};
function metaFor(n){return state.db&&state.db.items&&state.db.items[n]||{}}
function meowLink(n){let m=metaFor(n);return Number.isInteger(m.page)&&m.page>0?"https://meowdb.com/msclassic/item-db/"+m.page:null}
function fallbackGlyph(cat){return {scroll:"S",material:"O",equipment:"E",fashion:"NX",other:"✦"}[cat]||"✦"}
function icon(n,large=false){
  const m=metaFor(n),cat=category(n,m);
  const glyph='<span class="icon-fallback" aria-hidden="true">'+fallbackGlyph(cat)+'</span>';
  let result='<span class="item-icon"'+(large?' style="width:63px;height:63px;flex-basis:63px"':'')+'>';
  if(Number.isInteger(m.sprite)&&m.sprite>0){
    const src="https://meowdb.com/msclassic/api/assets/icons/"+m.sprite;
    const alt="https://maplestory.io/api/GMS/83/item/"+m.sprite+"/icon";
    result+='<img alt="" loading="lazy" src="'+src+'" data-fallback-src="'+alt+'">';
  }else result+=glyph;
  return result+'</span>';
}
function canonicalSubtitle(n){
  const m=metaFor(n);
  return m.canonical&&norm(m.canonical)!==norm(n)?m.canonical:(kindLabel[category(n,m)]||"Item");
}
function compute(){
  const grouped=new Map();
  for(const e of state.entries){
    if(!grouped.has(e.name))grouped.set(e.name,[]);
    grouped.get(e.name).push(e);
  }
  state.items=Array.from(grouped,([name,history])=>{
    const sold=history.filter(e=>e.status==="sold"&&Number.isFinite(e.price));
    const ask=history.filter(e=>e.status==="unsold");
    const askPriced=ask.filter(e=>Number.isFinite(e.price));
    const soldUnits=sold.reduce((a,e)=>a+e.quantity,0);
    const sum=sold.reduce((a,e)=>a+e.price,0);
    const avg=sold.length?sum/sold.length:null;
    const weighted=soldUnits?sold.reduce((a,e)=>a+e.price*e.quantity,0)/soldUnits:null;
    const lowAsk=askPriced.length?Math.min(...askPriced.map(e=>e.price)):null;
    const m=metaFor(name);
    return {
      name,meta:m,history,sold,ask,avg,weighted,lowAsk,
      lastSold:sold.length?sold[sold.length-1].price:null,
      soldUnits,askUnits:ask.reduce((a,e)=>a+e.quantity,0),
      firstId:history[0].id,lastId:history[history.length-1].id,
      firstDate:history[0].date,lastDate:history[history.length-1].date,
      category:category(name,m),
      search:norm([name,m.canonical,...(Array.isArray(m.aliases)?m.aliases:[])].filter(Boolean).join(" ")),
      gap:avg!=null&&lowAsk!=null?(lowAsk/avg-1)*100:null
    };
  });
  state.byName=new Map(state.items.map(x=>[x.name,x]));
  if(!state.byName.has(state.selected)){
    const asked=new URLSearchParams(location.search).get("item");
    state.selected=state.byName.has(asked)?asked:(state.byName.has("Earring LUK 60%")?"Earring LUK 60%":state.items[0]?.name||null);
  }
}
function kpis(){
  const sales=state.entries.filter(e=>e.status==="sold"&&e.price!=null);
  const asks=state.entries.filter(e=>e.status==="unsold"&&e.price!=null);
  const val=sales.reduce((a,e)=>a+e.price*e.quantity,0);
  $("stat-items").textContent=num(state.items.length);
  $("stat-sales").textContent=num(sales.length);
  $("stat-asks").textContent=num(asks.length);
  $("stat-total").textContent=short(val);
  $("tab-all").textContent=state.items.length;
}
function setSync(type,label){
  const banner=$("live-status");
  banner.classList.toggle("is-live",type==="live");
  banner.classList.toggle("is-error",type==="error");
  $("sync-label").textContent=label;
}
function line(n){return n==null?"<span class='item-figure missing'>—</span>":"<span class='item-figure'>"+short(n)+"</span>"}
function row(item){
  const n=escapeHtml(item.name);
  const sub=escapeHtml(canonicalSubtitle(item.name));
  const gap=item.gap;
  let gaptxt="—",gapClass="";
  if(gap!=null){gaptxt=(gap>0?"+":"")+gap.toFixed(0)+"%";gapClass=gap<0?"better":""}
  return '<button class="item-row'+(item.name===state.selected?" is-selected":"")+'" type="button" data-item="'+n+'" aria-label="View '+n+' price history" aria-pressed="'+(item.name===state.selected)+'">'+
    '<span class="item-cell">'+icon(item.name)+'<span style="min-width:0"><span class="item-name">'+n+'</span><span class="item-sub">'+sub+'</span><span class="item-seen">Tracked '+escapeHtml(trackedDate(item.lastDate))+'</span></span></span>'+
    '<span class="item-figure '+(item.avg==null?"missing":"sale")+'">'+short(item.avg)+'</span>'+
    '<span class="item-figure hide-narrow '+(item.lastSold==null?"missing":"")+'">'+short(item.lastSold)+'</span>'+
    '<span class="item-figure '+(item.lowAsk==null?"missing":"ask")+'">'+short(item.lowAsk)+'</span>'+
    '<span class="gap-figure hide-xs '+gapClass+'">'+gaptxt+'</span></button>';
}
function renderList(){
  const query=norm($("item-search").value);
  const cat=$("category").value;
  const sort=$("sort").value;
  let list=state.items.filter(i=>(!query||i.search.includes(query))&&(cat==="all"||cat===i.category)&&
    (state.view==="all"||(state.view==="sold"&&i.sold.length)||(state.view==="unsold"&&i.ask.length)||(state.view==="under"&&i.gap!=null&&i.gap<0)));
  list.sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):
    sort==="observations"?b.history.length-a.history.length||b.lastId-a.lastId:
    sort==="avg"?(b.avg??-1)-(a.avg??-1):b.lastId-a.lastId);
  $("result-count").textContent=list.length+" results";
  $("list-caption").textContent=state.showAll||list.length<=MAX_ROWS?"Showing "+list.length+" items":"Showing "+MAX_ROWS+" of "+list.length;
  $("show-more").hidden=list.length<=MAX_ROWS;
  $("show-more").innerHTML=state.showAll?"Show fewer records ↑":"Show all "+list.length+" records ↓";
  const visible=state.showAll?list:list.slice(0,MAX_ROWS);
  $("item-list").innerHTML=visible.length?visible.map(row).join(""):'<div class="empty">No items match these filters.<br><small>Try another name or category.</small></div>';
  document.querySelectorAll("[data-view]").forEach(btn=>{
    const active=btn.dataset.view===state.view;btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",active?"true":"false");
  });
}
function chart(i){
  const points=i.history.filter(e=>Number.isFinite(e.price));
  if(!points.length)return '<div class="empty">No priced observations to chart yet.</div>';
  const W=480,H=188,L=42,R=13,T=13,B=21,pw=W-L-R,ph=H-T-B;
  const values=points.map(e=>e.price);
  const low=Math.min(...values),high=Math.max(...values);
  const spread=high-low;
  const axisLow=Math.max(0,low-(spread?spread*.20:Math.max(1,high*.15)));
  const axisHigh=high+(spread?spread*.20:Math.max(1,high*.15));
  const x=j=>L+(points.length===1?pw/2:j*pw/(points.length-1));
  const y=v=>T+ph*(1-(v-axisLow)/(axisHigh-axisLow||1));
  const ticks=[0,.25,.5,.75,1].map(t=>{
    const yy=T+ph*t;
    return '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#e5e9de" stroke-dasharray="2 4"/><text x="'+(L-6)+'" y="'+(yy+4)+'" font-size="10" fill="#8c9d90" text-anchor="end">'+short(axisHigh-(axisHigh-axisLow)*t)+'</text>';
  }).join("");
  const sold=points.map((e,j)=>({e,j})).filter(o=>o.e.status==="sold");
  const stroke=sold.map((o,k)=>(k===0?"M":"L")+x(o.j).toFixed(1)+" "+y(o.e.price).toFixed(1)).join(" ");
  const marks=points.map((e,j)=>{
    const style=e.status==="sold"?'fill="#367451" stroke="#f7f9f1"':'fill="#fffdf7" stroke="#bb764e"';
    return '<circle cx="'+x(j).toFixed(1)+'" cy="'+y(e.price).toFixed(1)+'" r="5.3" stroke-width="2.3" '+style+'><title>'+escapeHtml(e.status)+" · "+num(e.price)+" mesos · "+e.quantity+" unit(s) · "+escapeHtml(trackedDate(e.date))+"</title></circle>";
  }).join("");
  return '<div class="chart-legend"><span><i></i>Sold price</span><span><i class="ask"></i>Unsold asking</span></div>'+
    '<div class="chart-box"><svg viewBox="0 0 '+W+" "+H+'" role="img" aria-label="Sold and unsold price history for '+escapeHtml(i.name)+'">'+
    ticks+(sold.length>1?'<path d="'+stroke+'" fill="none" stroke="#3c7854" stroke-width="2.1" stroke-linejoin="round"/>':"")+
    marks+'<text x="'+L+'" y="'+(H-2)+'" font-size="10" fill="#a1aca1">EARLIER</text><text x="'+(W-R)+'" y="'+(H-2)+'" text-anchor="end" font-size="10" fill="#a1aca1">LATEST</text></svg></div>';
}
function detail(){
  const i=state.byName.get(state.selected);
  if(!i){$("item-detail").innerHTML='<div class="empty">Choose an item from the directory.</div>';return}
  const link=meowLink(i.name);
  const cat=kindLabel[i.category]||"Item";
  const lo=i.sold.length?Math.min(...i.sold.map(e=>e.price)):null;
  const hi=i.sold.length?Math.max(...i.sold.map(e=>e.price)):null;
  const subt=canonicalSubtitle(i.name);
  const canonicalText=subt===cat?"":"<p>MeowDB: "+escapeHtml(subt)+"</p>";
  $("item-detail").innerHTML=
  '<div class="detail-kicker">ITEM FILE / '+escapeHtml(cat.toUpperCase())+'</div>'+
  '<div class="detail-head">'+icon(i.name,true)+'<div><h3>'+escapeHtml(i.name)+'</h3>'+
  '<p>'+i.sold.length+' sold observations · '+i.soldUnits+' sold units</p><p class="detail-tracked">First tracked '+escapeHtml(trackedDate(i.firstDate))+' · Latest '+escapeHtml(trackedDate(i.lastDate))+'</p>'+canonicalText+
  (link?'<a class="meow-link" href="'+link+'" target="_blank" rel="noopener noreferrer">View verified MeowDB item ↗</a>':
  '<a class="meow-link" href="https://meowdb.com/msclassic/item-db/all" target="_blank" rel="noopener noreferrer">Browse MeowDB (unmatched) ↗</a>')+'</div></div>'+
  '<div class="metrics">'+[
    ["AVERAGE SOLD",short(i.avg),"ink-green"],
    ["LOWEST UNSOLD",short(i.lowAsk),"ink-orange"],
    ["LATEST SOLD",short(i.lastSold),""],
    ["SOLD RANGE",short(lo)+" – "+short(hi),""]
  ].map(v=>'<div class="metric"><div class="metric-label">'+v[0]+'</div><div class="metric-value '+v[2]+'">'+v[1]+'</div></div>').join("")+'</div>'+
  '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div class="chart-label">RECORDED PRICE MOVEMENT</div><span class="chart-caption">'+i.history.length+' sightings</span></div>'+chart(i)+
  '<div class="history-wrap"><div class="history-head"><strong>Transaction ledger</strong><span>Oldest → newest</span></div>'+
  '<div class="history-scroller">'+i.history.map(e=>'<div class="trade-row"><span class="trade-id">#'+e.id+'</span><span class="trade-when"><span class="trade-status '+(e.status==="unsold"?"unsold":"")+'">'+(e.status==="sold"?"SOLD":"UNSOLD")+'</span><time class="trade-date" datetime="'+escapeHtml(e.date||"")+'">'+escapeHtml(trackedDate(e.date))+'</time></span><span class="trade-price">'+num(e.price)+'</span><span class="trade-qty">×'+e.quantity+'</span></div>').join("")+'</div></div>'+
  '<div class="detail-fineprint">Sold price mean: '+num(i.avg)+' mesos per observation. Unit-weighted sold average: '+num(i.weighted)+' mesos. Asking prices never affect either mean.'+
  (i.ask.some(e=>e.price==null)?' Unpriced unsold notes are retained.':'')+'</div>';
}
function insights(){
  const cheaper=state.items.filter(i=>i.gap!=null&&i.gap<0).sort((a,b)=>a.gap-b.gap).slice(0,8);
  $("underpriced").innerHTML=cheaper.length?cheaper.map(i=>
    '<div class="insight-item"><div><button type="button" data-item="'+escapeHtml(i.name)+'">'+escapeHtml(i.name)+'</button><small>Sold mean '+short(i.avg)+' / Asking '+short(i.lowAsk)+'</small></div><span class="diff">'+i.gap.toFixed(0)+'%</span></div>').join(""):'<div class="empty">No below-average asks recorded.</div>';
  $("recent-tape").innerHTML=state.entries.filter(e=>e.price!=null).slice(-8).reverse().map(e=>
    '<div class="insight-item"><div><button type="button" data-item="'+escapeHtml(e.name)+'">'+escapeHtml(e.name)+'</button><small>'+e.status.toUpperCase()+(e.quantity>1?' / ×'+e.quantity:'')+' · '+escapeHtml(trackedDate(e.date))+'</small></div><span class="receipt '+(e.status==="unsold"?"unsold":"")+'">'+short(e.price)+'</span></div>').join("");
}
function render(){compute();kpis();renderList();detail();insights()}
function select(name,scroll){
  if(!state.byName.has(name))return;
  state.selected=name;renderList();detail();
  try{history.replaceState(null,"","?item="+encodeURIComponent(name))}catch(_){}
  if(scroll&&window.matchMedia("(max-width:850px)").matches)$("item-detail").scrollIntoView({behavior:"smooth",block:"start"});
}
function validate(json){
  if(!json||!Array.isArray(json.entries)||typeof json.items!=="object")throw Error("Unexpected JSON structure");
  for(const e of json.entries){
    if(typeof e.name!=="string"||!e.name||!["sold","unsold"].includes(e.status)||
    !(e.price===null||(typeof e.price==="number"&&Number.isFinite(e.price)&&e.price>=0))||
    !Number.isInteger(e.quantity)||e.quantity<1||trackedDate(e.date)==="Date unknown")throw Error("Invalid trade observation");
  }
  return json;
}
async function request(url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(url+(url.includes("?")?"&":"?")+"v="+Date.now(),{cache:"no-store",signal:controller.signal});
    if(!r.ok)throw Error("HTTP "+r.status);
    return validate(await r.json());
  }finally{clearTimeout(timer)}
}
async function sync(){
  if(state.loading)return;
  state.loading=true;
  try{
    let json,fallback=false;
    try{json=await request(DATA_URL)}
    catch(e){
      if(!state.firstLoad)throw e;
      json=await request(SNAPSHOT);fallback=true;
    }
    const str=JSON.stringify(json.entries)+"|"+JSON.stringify(json.items);
    if(str!==state.hash){state.hash=str;state.db=json;state.entries=json.entries;render()}
    state.firstLoad=false;
    setSync(fallback?"error":"live",fallback?"ARCHIVED SNAPSHOT · live feed unavailable":"LIVE LEDGER · "+json.entries.length+" observations");
    $("data-notice").hidden=!fallback;
    if(fallback)$("data-notice").textContent="Live prices could not be reached. Displaying the last published site snapshot. Try refreshing in a moment.";
  }catch(err){
    setSync("error","DATA FEED UNAVAILABLE · retrying");
    $("data-notice").hidden=false;
    $("data-notice").textContent=state.db?"New prices could not be checked. Previously loaded observations remain visible.":"Could not load price history. Please try refreshing.";
  }finally{state.loading=false}
}
document.addEventListener("error",function(ev){
  const t=ev.target;
  if(t&&t.tagName==="IMG"){
    if(t.dataset.fallbackSrc&&!t.dataset.attempted){
      t.dataset.attempted="1";t.src=t.dataset.fallbackSrc;
    }else{
      t.insertAdjacentHTML("afterend",'<span class="icon-fallback" aria-hidden="true">✦</span>');
      t.remove();
    }
  }
},true);
document.addEventListener("click",e=>{
  const node=e.target.closest("[data-item]");
  if(node){select(node.getAttribute("data-item"),true);return}
  const view=e.target.closest("[data-view]");
  if(view){state.view=view.dataset.view;state.showAll=false;renderList()}
});
$("item-search").addEventListener("input",()=>{state.showAll=false;renderList()});
$("category").addEventListener("change",()=>{state.showAll=false;renderList()});
$("sort").addEventListener("change",renderList);
$("show-more").addEventListener("click",()=>{state.showAll=!state.showAll;renderList()});
$("refresh-btn").addEventListener("click",sync);
sync();setInterval(sync,INTERVAL);
})();