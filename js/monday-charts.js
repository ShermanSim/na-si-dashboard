(()=>{const N=NASIDASH,F=N.F;const text=(x,y,s,extra='')=>`<text x="${x}" y="${y}" fill="currentColor" font-family="Arial,sans-serif" font-size="12" ${extra}>${F.esc(s)}</text>`;const PRESETS=['1W','1M','3M','YTD','1Y'],SERIES={};
const utc=d=>new Date(F.iso(d)+'T00:00:00Z'),ymd=d=>d.toISOString().slice(0,10).replaceAll('-',''),day=d=>utc(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),full=d=>utc(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const shift=(end,p)=>{if(p==='YTD')return end.slice(0,4)+'0101';const d=utc(end);if(p==='1W'){d.setUTCDate(d.getUTCDate()-7);return ymd(d)}const dd=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-(p==='1Y'?12:+p[0]));d.setUTCDate(Math.min(dd,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return ymd(d)};
// Same rules as build_data.py: years(), stats() and statistics.quantiles (exclusive method).
const years=(d,n)=>(+d.slice(0,4)-n)+d.slice(4,6)+(d.slice(4,6)==='02'?String(Math.min(+d.slice(6),28)).padStart(2,'0'):d.slice(6));
const pyRound=x=>{const r=Math.round(x);return r-x===.5&&r%2?r-1:r};
const at=(dates,d)=>{let i=dates.length-1;while(i>=0&&dates[i]>d)i--;return i};
function windowStats(dates,si,i,j,kr,box){
 const cur=si[i],prev=si[j];if(cur==null||prev==null)return null;const d=dates[i];
 const win=n=>{const from=years(d,n),out=[];for(let k=0;k<=i;k++)if(si[k]!=null&&dates[k]>=from&&!(kr&&dates[k]>='20231106'&&dates[k]<='20250330'))out.push(si[k]);return out};
 const v=win(5),w=win(1),mean=w.reduce((a,b)=>a+b,0)/w.length,sd=w.length>=10?Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length):0;
 const r={si:cur,cur,prev,wow:cur-prev,chg:cur-prev,pct:v.length?pyRound(100*v.filter(x=>x<=cur).length/v.length):null,z:sd?(cur-mean)/sd:null,start:dates[j],end:d};
 if(box){if(v.length<2)return null;v.sort((a,b)=>a-b);const q=k=>{const m=v.length+1,j=Math.max(1,Math.min(v.length-1,Math.floor(k*m/4))),delta=k*m-j*4;return (v[j-1]*(4-delta)+v[j]*delta)/4};Object.assign(r,{mn:v[0],q1:q(1),med:q(2),q3:q(3),mx:v[v.length-1],n:v.length})}
 return r}
async function windowData(){
 if(!SERIES.aggregates){const [aggregates,...raw]=await Promise.all([N.load('aggregates'),...['TW','HK','KR'].map(m=>N.load('theme_series_'+m))]);['TW','HK','KR'].forEach((m,i)=>SERIES[m]=N.decode(raw[i][m==='HK'?'weekly':'daily']));SERIES.aggregates=aggregates}
 return SERIES}
// Each market snaps start and end to its own last observation on or before the chosen date.
const snap=(market,dates,start,end,gaps)=>{const i=at(dates,end),j=at(dates,start);if(j<0)gaps.add(`${market}: no data on or before ${full(start)} (first ${full(dates[0])})`);else if(j>=i)gaps.add(`${market}: start and end both fall on ${full(dates[i])}, the last ${market} observation in this window`);return j<0||j>=i?null:[i,j]};
const picker=id=>`<div class="window" id="${id}-window" role="group" aria-label="Change window"><input type="date" aria-label="From date"><span>–</span><input type="date" aria-label="To date">${PRESETS.map(p=>`<button data-preset="${p}">${p}</button>`).join('')}<button data-reset hidden>Reset</button></div>`;
function bindWindow(id,draw){
 const box=document.querySelector(`#${id}-window`),[from,to]=box.querySelectorAll('input'),reset=box.querySelector('[data-reset]'),note=document.querySelector(`#${id}-window-note`);let token=0;
 const lastWeekly=Object.values(N.manifest.markets).map(m=>m.weekly_asof).sort().at(-1);
 const apply=async(start,end,preset)=>{const rev=++token;
  if(start==null){from.value=to.value='';reset.hidden=true;box.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));note.textContent='';draw(null);return}
  const s=await windowData();if(rev!==token||!box.isConnected)return;
  const all=[...['TW','HK','KR'].map(m=>SERIES[m].dates),...Object.values(s.aggregates).map(a=>(a.daily||a.weekly).dates)],lo=all.map(d=>d[0]).sort()[0],hi=all.map(d=>d.at(-1)).sort().at(-1);
  start=start<lo?lo:start>hi?hi:start;end=end<lo?lo:end>hi?hi:end;if(start>end)[start,end]=[end,start];
  from.min=to.min=F.iso(lo);from.max=to.max=F.iso(hi);from.value=F.iso(start);to.value=F.iso(end);reset.hidden=false;
  box.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===preset));
  const gaps=new Set();draw({start,end,preset,label:preset||`${day(start)}–${day(end)}`,range:`${full(start)} – ${full(end)}`,gaps});
  note.textContent=gaps.size?'Insufficient data for this window. '+[...gaps].join('; ')+'.':''};
 box.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.preset)apply(shift(lastWeekly,b.dataset.preset),lastWeekly,b.dataset.preset);else apply(null)};
 from.onchange=to.onchange=()=>{const a=from.value.replaceAll('-',''),b=to.value.replaceAll('-','');if(!a&&!b)apply(null);else apply(a||shift(b||lastWeekly,'1W'),b||lastWeekly,null)}}
function drawScatter(t,w){
 let themes=t.themes;
 if(w){themes=t.themes.map(x=>({...x,stats_weekly:null}));w.dates={};['TW','HK','KR'].forEach(m=>{const h=SERIES[m],ij=snap(m,h.dates,w.start,w.end,w.gaps);if(!ij)return;w.dates[m]=[h.dates[ij[1]],h.dates[ij[0]]];themes.forEach((x,k)=>{if(x.market!==m||!h.series[x.theme])return;const r=windowStats(h.dates,h.series[x.theme],ij[0],ij[1],m==='KR');if(r)themes[k]={...x,stats_weekly:{...t.themes[k].stats_weekly,si:r.si,pct:r.pct,z:r.z,wow:r.wow,chg:r.chg,pct_prior:null,wow_prior:null}}});if(!themes.some(x=>x.market===m&&x.stats_weekly))w.gaps.add(`${m}: no theme has data at both dates`)})}
 document.querySelector('#scatter-host').innerHTML=scatter(themes,w);document.querySelector('#scatter-arrows').textContent=w?`Change from each market's last observation on or before ${full(w.start)} to its last on or before ${full(w.end)}; 5Y percentile as of the end date.`:"Faint arrows show the move from the prior week's position.";tooltips(themes,w)}
function drawBoxes(w){
 let rows=N.overview.weekly.aggregates;
 if(w)rows=rows.map(a=>{const h=SERIES.aggregates[a.market][a.country==='HK'?'weekly':'daily'],ij=snap(a.market,h.dates,w.start,w.end,w.gaps),r=ij&&windowStats(h.dates,h.si,ij[0],ij[1],a.country==='KR',true);if(ij&&!r)w.gaps.add(`${a.market}: no SI at both dates`);return r?{...a,...r}:{market:a.market,missing:true}});
 document.querySelector('#box-host').innerHTML=boxes(rows,w);document.querySelector('#box-legend').textContent=w?'Each row uses its own scale · filled diamond: window end · hollow circle: window start · box: 25th–75th pct · tick: median, over the 5Y to the end date. KR: ex short-sale ban.':'Each row uses its own scale · filled diamond: latest · hollow circle: prior week · box: 25th–75th pct · tick: median. KR: ex short-sale ban.'}
N.mondayMount=async()=>{const host=document.querySelector('#monday');if(!host)return;try{const t=await N.load('themes');if(!host.isConnected)return;host.innerHTML=`<section class="card"><div class="card-head"><h2>Regional theme positioning</h2><div class="card-tools">${picker('scatter')}<button class="copy" id="scatter-copy">Copy chart</button></div></div><p class="note" id="scatter-arrows">Faint arrows show the move from the prior week's position.</p><p class="note window-note" id="scatter-window-note"></p><div class="svg-scroll" id="scatter-host">${scatter(t.themes)}</div><p class="note">Source: TWSE, SFC, KRX | KR percentile excludes the Nov 2023–Mar 2025 short-sale ban.</p></section><section class="card"><div class="card-head"><h2>Aggregate Market SI% vs Own 5Y Range (mkt-cap weighted)</h2><div class="card-tools">${picker('box')}<button class="copy" id="box-copy">Copy chart</button></div></div><p class="note window-note" id="box-window-note"></p><div class="svg-scroll" id="box-host">${boxes()}</div><p class="note" id="box-legend">Each row uses its own scale · filled diamond: latest · hollow circle: prior week · box: 25th–75th pct · tick: median. KR: ex short-sale ban.</p></section>`;tooltips(t.themes);bindWindow('scatter',w=>drawScatter(t,w));bindWindow('box',drawBoxes);N.copyBind(document.querySelector('#scatter-copy'),()=>N.svgCanvas(document.querySelector('#scatter-svg')),'regional-scatter');N.copyBind(document.querySelector('#box-copy'),()=>N.svgCanvas(document.querySelector('#box-svg')),'market-range')}catch(e){console.error(e);if(host.isConnected)host.textContent='Weekly charts could not load.'}};
function scatter(themes,w){
 const W=1160,H=1940,L=75,R=1135,ph=540,knots=[0,.01,.03,.1,.3,1,3];
 const transform=v=>{let a=Math.abs(v),i=0;while(i<knots.length-2&&a>knots[i+1])i++;return Math.sign(v)*(i+(a-knots[i])/(knots[i+1]-knots[i]))};
 const domain=Math.max(5.35,...themes.flatMap(t=>[t.stats_weekly?.wow,t.stats_weekly?.wow_prior]).filter(v=>v!=null).map(v=>transform(Math.abs(v))*1.06));
 const X=v=>(L+R)/2+transform(v)/domain*(R-L)/2;
 const ctx=document.createElement('canvas').getContext('2d');ctx.font='8.5px Arial';
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const expand=b=>({x:b.x-b.w*.02,y:b.y-b.h*.125,w:b.w*1.04,h:b.h*1.25});
 let s=`<svg id="scatter-svg" class="monday-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="North Asia themes: SI crowding vs weekly change"><rect width="${W}" height="${H}" fill="white"/>`;
 s+=text(W/2,25,w?`North Asia Themes: SI Crowding vs ${w.preset?w.preset+' ':''}Change (${w.range})`:'North Asia Themes: SI Crowding vs Weekly Change','text-anchor="middle" style="fill:#1f3864;font-size:20px;font-weight:bold;font-style:italic"');
 N.scatterLayout=[];
 ['TW','HK','KR'].forEach((market,p)=>{
  const top=78+p*625,bottom=top+ph,Y=v=>bottom-(v+4)/110*ph,color=N.colors[market];
  const fmt=d=>new Date(N.F.iso(d)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),meta=N.manifest.markets[market];
  const span=w?w.dates[market]:[meta.weekly_prior,meta.weekly_asof];
  s+=text((L+R)/2,top-16,`${{TW:'Taiwan',HK:'Hong Kong',KR:'Korea'}[market]} (${span?(w?`${full(span[1])} vs ${full(span[0])}`:`${fmt(span[1])} vs ${fmt(span[0])}`):'insufficient data for this window'})`,'text-anchor="middle" style="fill:#1f3864;font-weight:bold;font-size:14px"');
  s+=`<rect x="${L}" y="${Y(100)}" width="${R-L}" height="${Y(90)-Y(100)}" fill="#F8CBAD" opacity=".25"/><rect x="${L}" y="${Y(10)}" width="${R-L}" height="${Y(0)-Y(10)}" fill="#C6EFCE" opacity=".25"/>`;
  [0,20,40,60,80,100].forEach(v=>s+=text(L-12,Y(v)+4,v,'text-anchor="end" style="fill:#333"'));
  [...(w&&domain>6?[-3]:[]),-1,-.3,-.1,-.03,-.01,0,.01,.03,.1,.3,1,...(w&&domain>6?[3]:[])].forEach(v=>s+=text(X(v),bottom+18,v===0?'0':(v>0?'+':'−')+Math.abs(v),'text-anchor="middle" style="fill:#333;font-size:10px"'));
  s+=`<path d="M${L},${top} V${bottom} H${R}" fill="none" stroke="#333" stroke-width=".7"/><path d="M${L},${Y(50)} H${R} M${X(0)},${top} V${bottom}" fill="none" stroke="#aaa" stroke-width=".7" stroke-dasharray="4 3"/>`;
  s+=text((L+R)/2,bottom+40,w?(span?`Change in theme SI%, ${full(span[0])} to ${full(span[1])}, pp (log scale)`:`Change in theme SI%, ${w.range}, pp (log scale)`):'WoW change in theme SI%, pp (log scale)','text-anchor="middle" style="fill:#333;font-size:11px"');
  s+=`<text transform="translate(21 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle" font-family="Arial" font-size="12" fill="#333">5Y percentile</text>`;
  const caps=[['Crowded & covering','#C55A11',false,false],['Crowded & building','#C00000',true,false],['Quiet','#548235',false,true],['Fresh shorts','#7030A0',true,true]].map(([name,c,right,bot])=>{ctx.font='bold 12px Arial';let w=ctx.measureText(name).width+10;return {name,c,x:right?R-w-6:L+6,y:bot?bottom-22:top+3,w,h:19}});
  const pts=themes.filter(t=>t.market===market&&t.stats_weekly?.wow!=null&&t.stats_weekly?.pct!=null).map(t=>({t,x:X(t.stats_weekly.wow),y:Y(t.stats_weekly.pct)}));
  const dots=pts.map(d=>({x:d.x-5,y:d.y-5,w:10,h:10}));ctx.font='8.5px Arial';
  const labels=pts.map(d=>({x:d.x+7,y:d.y-13,w:ctx.measureText(d.t.name).width,h:10,homeX:d.x+7,homeY:d.y-13,d}));
  const clamp=b=>{b.x=Math.max(L+3,Math.min(R-b.w-3,b.x));b.y=Math.max(top+2,Math.min(bottom-b.h-2,b.y))};
  // Local spring/repulsion keeps the cluster local before deterministic repair.
  for(let iter=0;iter<180;iter++){
   labels.forEach((b,i)=>{let dx=(b.homeX-b.x)*.07,dy=(b.homeY-b.y)*.07;
    [...labels.filter((_,j)=>i!==j).map(expand),...dots,...caps].forEach(o=>{if(overlap(expand(b),o)){const cx=b.x+b.w/2-o.x-o.w/2,cy=b.y+b.h/2-o.y-o.h/2;const ox=(b.w+o.w)/2-Math.abs(cx),oy=(b.h+o.h)/2-Math.abs(cy);if(oy<ox)dy+=(cy>=0?1:-1)*Math.max(1,oy)*.45;else dx+=(cx>=0?1:-1)*Math.max(1,ox)*.45}});b.x+=dx;b.y+=dy;clamp(b)});
  }
  const occupied=[...dots,...caps];
  labels.forEach(b=>{const valid=c=>!occupied.some(o=>overlap(expand(c),o));
   if(!valid(b)){let candidates=[];
    for(let y=top+3;y<=bottom-b.h-3;y+=3)for(let x=L+3;x<=R-b.w-3;x+=4)candidates.push({x,y,w:b.w,h:b.h});
    candidates.sort((a,c)=>((a.x-b.homeX)**2+(a.y-b.homeY)**2)-((c.x-b.homeX)**2+(c.y-b.homeY)**2));
    const free=candidates.find(valid);if(!free)throw Error('No collision-free label slot: '+b.d.t.name);b.x=free.x;b.y=free.y;
   }occupied.push(expand(b));
  });
  labels.forEach((b,i)=>{if(labels.some((c,j)=>i!==j&&overlap(b,c))||[...dots,...caps].some(c=>overlap(b,c)))throw Error('Scatter collision '+b.d.t.name)});
  N.scatterLayout.push({market,labels:labels.map(({d,...b})=>({...b,name:d.t.name})),dots,caps});
  // Prior-week arrows precede all dots and labels.
  pts.forEach(({t,x,y})=>{let a=t.stats_weekly;if(a.wow_prior==null||a.pct_prior==null)return;let px=X(a.wow_prior),py=Y(a.pct_prior),angle=Math.atan2(y-py,x-px),ex=x-4*Math.cos(angle),ey=y-4*Math.sin(angle);s+=`<path d="M${px},${py} L${ex},${ey} M${ex-4*Math.cos(angle-.45)},${ey-4*Math.sin(angle-.45)} L${ex},${ey} L${ex-4*Math.cos(angle+.45)},${ey-4*Math.sin(angle+.45)}" fill="none" stroke="${color}" opacity=".22" stroke-width=".8"/>`});
  pts.forEach(({t,x,y},i)=>s+=`<circle data-theme="${F.esc(t.theme)}" data-market="${market}" cx="${x}" cy="${y}" r="3.5" fill="${color}" stroke="white" stroke-width=".7"/>`);
  // Short grey leaders under the labels, never market-coloured.
  labels.forEach(b=>{const d=b.d,x=Math.max(b.x,Math.min(d.x,b.x+b.w)),y=Math.max(b.y,Math.min(d.y,b.y+b.h)),dist=Math.hypot(x-d.x,y-d.y);if(dist>5)s+=`<line x1="${x}" y1="${y}" x2="${d.x+(x-d.x)*3.5/dist}" y2="${d.y+(y-d.y)*3.5/dist}" stroke="#999999" stroke-width=".5" pointer-events="none"/>`});
  labels.forEach(b=>{s+=`<text data-theme="${F.esc(b.d.t.theme)}" data-market="${market}" x="${b.x}" y="${b.y+8}" font-family="Arial,sans-serif" font-size="8.5" fill="#333333">${F.esc(b.d.t.name)}</text>`});
  caps.forEach(b=>s+=`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="white" opacity=".9"/>`+text(b.x+5,b.y+14,b.name,`style="fill:${b.c};font-size:12px;font-weight:bold"`));
 });return s+'</svg>';
}
function tooltips(themes,w){
 let tip=document.querySelector('#scatter-tooltip');if(!tip){tip=document.createElement('div');tip.id='scatter-tooltip';tip.style.cssText='position:fixed;display:none;pointer-events:none;z-index:50;background:#fff;color:#333;padding:9px 12px;border:1px solid #ccd2da;border-radius:6px;box-shadow:0 3px 14px #0002;font:12px/1.6 Arial';document.body.append(tip)}
 document.querySelectorAll('#scatter-svg [data-theme]').forEach(el=>{const show=e=>{const t=themes.find(t=>t.market===el.dataset.market&&t.theme===el.dataset.theme),a=t.stats_weekly;tip.innerHTML=`<b>${F.esc(t.name)}</b><br>SI% ${a.si?.toFixed(2)??'—'} · ${w?'Δ '+w.label:'WoW'} ${a.wow>=0?'+':''}${a.wow.toFixed(2)} pp<br>5Y pct ${a.pct} · 1Y z ${a.z?.toFixed(1)??'—'}`;tip.style.display='block';tip.style.left=Math.max(4,Math.min(innerWidth-tip.offsetWidth-8,e.clientX+12))+'px';tip.style.top=Math.max(4,Math.min(innerHeight-tip.offsetHeight-8,e.clientY+12))+'px'};el.onmouseenter=show;el.onmousemove=show;el.onmouseleave=()=>tip.style.display='none'});
}
function boxes(rows=N.overview.weekly.aggregates,w){let s='<svg id="box-svg" class="monday-svg" viewBox="0 0 1060 450" role="img" aria-label="Aggregate market SI five year ranges">';if(w)s+=text(1048,22,`Change ${w.preset?w.preset+' ':''}(${w.range}) · 5Y range to end date`,'text-anchor="end" style="fill:#1f3864;font-weight:bold"');rows.forEach((a,i)=>{const y=65+i*100,L=150,R=970,X=v=>L+(v-a.mn)/(a.mx-a.mn||1)*(R-L),c=N.colors[a.market];s+=text(12,y+5,a.market,`style="fill:${c};font-size:15px;font-weight:700"`);if(a.missing){s+=text(L,y+5,'Insufficient data for this window','style="fill:#64748b"');return}s+=`<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="#94a3b8" stroke-width="3"/><rect x="${X(a.q1)}" y="${y-11}" width="${X(a.q3)-X(a.q1)}" height="22" rx="2" fill="#2e75b6" opacity=".55"/><line x1="${X(a.med)}" x2="${X(a.med)}" y1="${y-15}" y2="${y+15}" stroke="#1f3864" stroke-width="3"/><circle cx="${X(a.prev)}" cy="${y}" r="7" fill="none" stroke="${c}" stroke-width="2"/><path d="M${X(a.cur)},${y-9} l9,9 l-9,9 l-9,-9Z" fill="${c}"/>`;s+=text(L,y-25,`${F.si(a.cur)} | ${F.pct(a.pct)} pct | ${w?`${full(a.start)}–${full(a.end)}`:'WoW'} ${F.signed(a.wow)}pp`)+text(L,y+32,F.si(a.mn))+text(R,y+32,F.si(a.mx),'text-anchor="end"')});return s+'</svg>'}
})();
