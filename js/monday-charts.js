(()=>{const N=NASIDASH,F=N.F;const text=(x,y,s,extra='')=>`<text x="${x}" y="${y}" fill="currentColor" font-family="Arial,sans-serif" font-size="12" ${extra}>${F.esc(s)}</text>`;N.mondayMount=async()=>{const host=document.querySelector('#monday');if(!host)return;try{const t=await N.load('themes');if(!host.isConnected)return;host.innerHTML=`<section class="card"><div class="card-head"><h2>Regional theme positioning</h2><button class="copy" id="scatter-copy">Copy chart</button></div><p class="note">Faint arrows show the move from the prior week's position.</p><div class="svg-scroll">${scatter(t.themes)}</div><p class="note">Source: TWSE, SFC, KRX | KR percentile excludes the Nov 2023–Mar 2025 short-sale ban.</p></section><section class="card"><div class="card-head"><h2>Aggregate Market SI% vs Own 5Y Range (mkt-cap weighted)</h2><button class="copy" id="box-copy">Copy chart</button></div><div class="svg-scroll">${boxes()}</div><p class="note">Each row uses its own scale · filled diamond: latest · hollow circle: prior week · box: 25th–75th pct · tick: median. KR: ex short-sale ban.</p></section>`;tooltips(t.themes);N.copyBind(document.querySelector('#scatter-copy'),()=>N.svgCanvas(document.querySelector('#scatter-svg')),'regional-scatter');N.copyBind(document.querySelector('#box-copy'),()=>N.svgCanvas(document.querySelector('#box-svg')),'market-range')}catch(e){console.error(e);if(host.isConnected)host.textContent='Weekly charts could not load.'}};
function scatter(themes){
 const W=1160,H=1940,L=75,R=1135,ph=540,knots=[0,.01,.03,.1,.3,1,3];
 const transform=v=>{let a=Math.abs(v),i=0;while(i<knots.length-2&&a>knots[i+1])i++;return Math.sign(v)*(i+(a-knots[i])/(knots[i+1]-knots[i]))};
 const domain=Math.max(5.35,...themes.flatMap(t=>[t.stats_weekly?.wow,t.stats_weekly?.wow_prior]).filter(v=>v!=null).map(v=>transform(Math.abs(v))*1.06));
 const X=v=>(L+R)/2+transform(v)/domain*(R-L)/2;
 const ctx=document.createElement('canvas').getContext('2d');ctx.font='8.5px Arial';
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const expand=b=>({x:b.x-b.w*.02,y:b.y-b.h*.125,w:b.w*1.04,h:b.h*1.25});
 let s=`<svg id="scatter-svg" class="monday-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="North Asia themes: SI crowding vs weekly change"><rect width="${W}" height="${H}" fill="white"/>`;
 s+=text(W/2,25,'North Asia Themes: SI Crowding vs Weekly Change','text-anchor="middle" style="fill:#1f3864;font-size:20px;font-weight:bold;font-style:italic"');
 N.scatterLayout=[];
 ['TW','HK','KR'].forEach((market,p)=>{
  const top=78+p*625,bottom=top+ph,Y=v=>bottom-(v+4)/110*ph,color=N.colors[market];
  const fmt=d=>new Date(N.F.iso(d)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),meta=N.manifest.markets[market];
  s+=text((L+R)/2,top-16,`${{TW:'Taiwan',HK:'Hong Kong',KR:'Korea'}[market]} (${fmt(meta.weekly_asof)} vs ${fmt(meta.weekly_prior)})`,'text-anchor="middle" style="fill:#1f3864;font-weight:bold;font-size:14px"');
  s+=`<rect x="${L}" y="${Y(100)}" width="${R-L}" height="${Y(90)-Y(100)}" fill="#F8CBAD" opacity=".25"/><rect x="${L}" y="${Y(10)}" width="${R-L}" height="${Y(0)-Y(10)}" fill="#C6EFCE" opacity=".25"/>`;
  [0,20,40,60,80,100].forEach(v=>s+=text(L-12,Y(v)+4,v,'text-anchor="end" style="fill:#333"'));
  [-1,-.3,-.1,-.03,-.01,0,.01,.03,.1,.3,1].forEach(v=>s+=text(X(v),bottom+18,v===0?'0':(v>0?'+':'−')+Math.abs(v),'text-anchor="middle" style="fill:#333;font-size:10px"'));
  s+=`<path d="M${L},${top} V${bottom} H${R}" fill="none" stroke="#333" stroke-width=".7"/><path d="M${L},${Y(50)} H${R} M${X(0)},${top} V${bottom}" fill="none" stroke="#aaa" stroke-width=".7" stroke-dasharray="4 3"/>`;
  s+=text((L+R)/2,bottom+40,'WoW change in theme SI%, pp (log scale)','text-anchor="middle" style="fill:#333;font-size:11px"');
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
function tooltips(themes){
 let tip=document.querySelector('#scatter-tooltip');if(!tip){tip=document.createElement('div');tip.id='scatter-tooltip';tip.style.cssText='position:fixed;display:none;pointer-events:none;z-index:50;background:#fff;color:#333;padding:9px 12px;border:1px solid #ccd2da;border-radius:6px;box-shadow:0 3px 14px #0002;font:12px/1.6 Arial';document.body.append(tip)}
 document.querySelectorAll('#scatter-svg [data-theme]').forEach(el=>{const show=e=>{const t=themes.find(t=>t.market===el.dataset.market&&t.theme===el.dataset.theme),a=t.stats_weekly;tip.innerHTML=`<b>${F.esc(t.name)}</b><br>SI% ${a.si?.toFixed(2)??'—'} · WoW ${a.wow>=0?'+':''}${a.wow.toFixed(2)} pp<br>5Y pct ${a.pct} · 1Y z ${a.z?.toFixed(1)??'—'}`;tip.style.display='block';tip.style.left=Math.max(4,Math.min(innerWidth-tip.offsetWidth-8,e.clientX+12))+'px';tip.style.top=Math.max(4,Math.min(innerHeight-tip.offsetHeight-8,e.clientY+12))+'px'};el.onmouseenter=show;el.onmousemove=show;el.onmouseleave=()=>tip.style.display='none'});
}
function boxes(){let s='<svg id="box-svg" class="monday-svg" viewBox="0 0 1060 450" role="img" aria-label="Aggregate market SI five year ranges">';N.overview.weekly.aggregates.forEach((a,i)=>{const y=65+i*100,L=150,R=970,X=v=>L+(v-a.mn)/(a.mx-a.mn||1)*(R-L),c=N.colors[a.market];s+=text(12,y+5,a.market,`style="fill:${c};font-size:15px;font-weight:700"`);s+=`<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="#94a3b8" stroke-width="3"/><rect x="${X(a.q1)}" y="${y-11}" width="${X(a.q3)-X(a.q1)}" height="22" rx="2" fill="#2e75b6" opacity=".55"/><line x1="${X(a.med)}" x2="${X(a.med)}" y1="${y-15}" y2="${y+15}" stroke="#1f3864" stroke-width="3"/><circle cx="${X(a.prev)}" cy="${y}" r="7" fill="none" stroke="${c}" stroke-width="2"/><path d="M${X(a.cur)},${y-9} l9,9 l-9,9 l-9,-9Z" fill="${c}"/>`;s+=text(L,y-25,`${F.si(a.cur)} | ${F.pct(a.pct)} pct | WoW ${F.signed(a.wow)}pp`)+text(L,y+32,F.si(a.mn))+text(R,y+32,F.si(a.mx),'text-anchor="end"')});return s+'</svg>'}
})();
