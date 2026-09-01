
/* ================================================================
   DATA — REAL: 出典付き実データ（2026-09-01取得） / S: サンプル（設計値）
   実測パイプライン接続後は board_data.json がこの構造を上書きする
================================================================ */
/* データは build.py が window.BOARD_DATA として注入する（board_data.json）。
   R0はboard_seed.json（実データ＋設計サンプル）、計測開始後は実測で上書き。 */
const BD=window.BOARD_DATA||{};
const REAL=BD.real, S=BD.s, META=BD.meta||{};
/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const fmt=n=>n==null?'—':(typeof n==='number'?n.toLocaleString('ja-JP'):n);
const esc=s=>String(s==null?'—':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const srcA=(...keys)=>keys.map(k=>{const s=REAL.srcs[k];return `<a href="${s[1]}" target="_blank" rel="noopener">${esc(s[0])}</a>`;}).join(' ／ ');
const tagS='<span class="tag smp">サンプル</span>', tagR='<span class="tag real">実測</span>', tagP='<span class="tag prop">提案</span>';
let TMRS=[];
const later=(fn,ms)=>TMRS.push(setTimeout(fn,ms));
const clearT=()=>{TMRS.forEach(clearTimeout);TMRS=[];};
const easeO=t=>1-Math.pow(1-t,4);

/* ---- count up ---- */
function countUp(el){
 const to=parseFloat(el.dataset.cnt), dec=+(el.dataset.dec||0), suf=el.dataset.suf||'', pre=el.dataset.pre||'';
 const dur=950, t0=performance.now();
 function step(t){
  const p=Math.min(1,(t-t0)/dur), v=to*easeO(p);
  el.textContent=pre+(dec?v.toFixed(dec):Math.round(v).toLocaleString('ja-JP'))+suf;
  if(p<1)requestAnimationFrame(step);
 }
 requestAnimationFrame(step);
}

/* ---- SVG chart builders ---- */
function spark(vals,w,h,color,fill){
 if(!vals||!vals.length)return '';
 const mx=Math.max(...vals),mn=Math.min(...vals);
 const pts=vals.map((v,i)=>[(i/(vals.length-1))*(w-4)+2, h-3-((v-mn)/(mx-mn||1))*(h-8)]);
 const d='M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L');
 const area=d+`L${pts[pts.length-1][0].toFixed(1)},${h-1}L${pts[0][0].toFixed(1)},${h-1}Z`;
 return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${fill?`<path d="${area}" fill="${color}" opacity=".13"/>`:''}<path pathLength="1" class="draw" d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/><circle cx="${pts[pts.length-1][0]}" cy="${pts[pts.length-1][1]}" r="2.6" fill="${color}"/></svg>`;
}
function smoothD(pts){
 if(pts.length<3)return 'M'+pts.map(p=>p.join(',')).join('L');
 let d=`M${pts[0][0]},${pts[0][1]}`;
 for(let i=0;i<pts.length-1;i++){
  const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
  const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
  d+=`C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
 }
 return d;
}
function lineChart(id,labels,series,w,h,opts){
 const o=opts||{}, pad={l:o.padl||40,r:12,t:14,b:22};
 const all=series.flatMap(s=>s.vals).filter(v=>v!=null);
 const mx=o.max!=null?o.max:Math.max(...all)*1.06, mn=o.min!=null?o.min:Math.min(...all)*0.94;
 const X=i=>pad.l+(i/(labels.length-1||1))*(w-pad.l-pad.r);
 const Y=v=>pad.t+(1-(v-mn)/(mx-mn||1))*(h-pad.t-pad.b);
 let g='';
 for(let k=0;k<=3;k++){const v=mn+(mx-mn)*k/3,y=Y(v);
  g+=`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w-pad.r}" y2="${y.toFixed(1)}" stroke="#1D2A44" stroke-dasharray="3 5"/><text x="${pad.l-7}" y="${(y+3.5).toFixed(1)}" font-size="9" fill="#5E7192" text-anchor="end" class="mn">${o.fmt?o.fmt(v):Math.round(v)}</text>`;}
 const st=Math.max(1,Math.round(labels.length/6));
 labels.forEach((d,i)=>{if(i%st===0||i===labels.length-1)g+=`<text x="${X(i).toFixed(1)}" y="${h-6}" font-size="8.5" fill="#5E7192" text-anchor="middle" class="mn">${esc(d)}</text>`;});
 (o.marks||[]).forEach(m=>{const x=X(m.i);
  g+=`<line x1="${x.toFixed(1)}" y1="${pad.t}" x2="${x.toFixed(1)}" y2="${h-pad.b}" stroke="rgba(255,194,75,.45)" stroke-dasharray="2 4"/><text x="${x.toFixed(1)}" y="${pad.t-3}" font-size="8" fill="#FFC24B" text-anchor="middle">▼</text>`;});
 series.forEach((s,si)=>{
  const pts=s.vals.map((v,i)=>[X(i),Y(v)]);
  const d=o.smooth?smoothD(pts):('M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L'));
  if(s.fill)g+=`<path class="afill" d="${d}L${pts[pts.length-1][0].toFixed(1)},${h-pad.b}L${pts[0][0].toFixed(1)},${h-pad.b}Z" fill="${s.color}" opacity="0" data-op=".10"/>`;
  g+=`<path pathLength="1" class="draw" d="${d}" fill="none" stroke="${s.color}" stroke-width="2.3" stroke-linejoin="round"/>`;
  const lp=pts[pts.length-1];
  g+=`<circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="3.4" fill="${s.color}" stroke="#0E1626" stroke-width="2"/>`;
  if(s.lbl!==false)g+=`<text x="${(lp[0]-4).toFixed(1)}" y="${(lp[1]-9).toFixed(1)}" font-size="9.5" font-weight="700" fill="#EAF1FB" text-anchor="end">${esc(s.label)}</text>`;
 });
 g+=`<line id="${id}_gd" y1="${pad.t}" y2="${h-pad.b}" stroke="rgba(234,241,251,.35)" visibility="hidden"/>`;
 g+=`<rect class="hovrect" x="${pad.l}" y="${pad.t}" width="${w-pad.l-pad.r}" height="${h-pad.t-pad.b}" fill="transparent"
     onmousemove="lcHover(event,'${id}',${pad.l},${w-pad.l-pad.r},${labels.length})" onmouseleave="lcOut('${id}')"/>`;
 return `<svg id="${id}" width="100%" viewBox="0 0 ${w} ${h}" style="display:block" data-labels='${JSON.stringify(labels)}' data-series='${JSON.stringify(series.map(s=>({label:s.label,vals:s.vals,color:s.hex||s.color})))}'>${g}</svg>`;
}
function lcHover(ev,id,pl,pw,n){
 const svg=document.getElementById(id); if(!svg)return;
 const r=svg.getBoundingClientRect(), sx=svg.viewBox.baseVal.width/r.width;
 const vx=(ev.clientX-r.left)*sx;
 const i=Math.max(0,Math.min(n-1,Math.round((vx-pl)/(pw/(n-1)))));
 const labels=JSON.parse(svg.dataset.labels), series=JSON.parse(svg.dataset.series);
 const gd=document.getElementById(id+'_gd'); const x=pl+i*(pw/(n-1));
 gd.setAttribute('x1',x);gd.setAttribute('x2',x);gd.setAttribute('visibility','visible');
 tip(`<b>${esc(labels[i])}</b><br>`+series.map(s=>`<span style="color:${s.color}">●</span> ${esc(s.label)}: <b>${fmt(s.vals[i])}</b>`).join('<br>'),ev);
}
function lcOut(id){const gd=document.getElementById(id+'_gd');if(gd)gd.setAttribute('visibility','hidden');untip();}
function hbars(rows,opts){
 const o=opts||{}, mx=Math.max(...rows.map(r=>r.v));
 return rows.map(r=>`
  <div class="brow ${r.me?'me':''}">
   <span class="bl2">${esc(r.l)}</span>
   <span class="gbar" ${r.tip?`onmousemove="tip('${esc(r.tip)}',event)" onmouseleave="untip()"`:''}><i data-w="${(r.v/mx*100).toFixed(1)}" style="background:${r.bg||'linear-gradient(90deg,var(--ac2),var(--ac))'}"></i></span>
   <span class="bv mono">${fmt(r.v)}${o.suf||''}</span>
  </div>`).join('');
}
function groupedBars(cats,series,w,h){
 const pad={l:38,r:8,t:16,b:26}, mx=100;
 const gw=(w-pad.l-pad.r)/cats.length, bw=Math.min(20,(gw-26)/series.length);
 let g='';
 for(let k=0;k<=4;k++){const v=mx*k/4,y=pad.t+(1-v/mx)*(h-pad.t-pad.b);
  g+=`<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="#1D2A44" stroke-dasharray="3 5"/><text x="${pad.l-6}" y="${y+3.5}" font-size="9" fill="#5E7192" text-anchor="end" class="mn">${v}</text>`;}
 cats.forEach((c,ci)=>{
  const x0=pad.l+ci*gw+(gw-bw*series.length-(series.length-1)*3)/2;
  g+=`<text x="${(pad.l+ci*gw+gw/2).toFixed(1)}" y="${h-8}" font-size="10" fill="#9DB0CE" text-anchor="middle">${esc(c)}</text>`;
  series.forEach((s,si)=>{
   const v=s.vals[ci], bh=(v/mx)*(h-pad.t-pad.b), x=x0+si*(bw+3), y=pad.t+(h-pad.t-pad.b)-bh;
   g+=`<rect class="gbr" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${s.color}"
      onmousemove="tip('<b>${esc(s.label)}</b><br>${esc(c)}: <b>${v}%</b>',event)" onmouseleave="untip()"/>`;
   g+=`<text x="${(x+bw/2).toFixed(1)}" y="${(y-4).toFixed(1)}" font-size="8.5" fill="#9DB0CE" text-anchor="middle" class="mn gbl">${v}</text>`;
  });
 });
 return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">${g}</svg>`;
}
function radar(series,size){
 const cx=size/2, cy=size/2+6, R=size/2-52, N=S.themes.length;
 const P=(k,r)=>{const a=-Math.PI/2+k*2*Math.PI/N;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];};
 let g='';
 for(let ring=1;ring<=4;ring++){
  const pts=[...Array(N)].map((_,k)=>P(k,R*ring/4).map(v=>v.toFixed(1)).join(',')).join(' ');
  g+=`<polygon points="${pts}" fill="none" stroke="#1D2A44" stroke-width="${ring===4?1.2:.7}"/>`;
 }
 [...Array(N)].forEach((_,k)=>{
  const [x,y]=P(k,R); g+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1D2A44" stroke-width=".7"/>`;
  const [lx,ly]=P(k,R+24);
  const short=S.themes[k].replace('景観(富士山)','景観').replace('混雑・渋滞','混雑').replace('インバウンド','訪日').replace('雨天対応','雨天').replace('アクセス','ｱｸｾｽ').replace('価格感','価格');
  g+=`<text x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" font-size="10" fill="#9DB0CE" text-anchor="middle">${short}</text>`;
 });
 series.forEach(s=>{
  const pts=s.vals.map((v,k)=>P(k,R*v/100).map(n=>n.toFixed(1)).join(',')).join(' ');
  g+=`<polygon class="rpoly" points="${pts}" fill="${s.color}" fill-opacity=".13" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
  s.vals.forEach((v,k)=>{const [x,y]=P(k,R*v/100);
   g+=`<circle class="rpoly" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${s.color}" onmousemove="tip('<b>${esc(s.label)}</b><br>${esc(S.themes[k])}: <b>${v}</b>',event)" onmouseleave="untip()" style="pointer-events:all"/>`;});
 });
 return `<svg width="100%" viewBox="0 0 ${size} ${size}" style="display:block;max-width:${size}px;margin:0 auto">${g}</svg>`;
}
function donut(parts,size,label,sub){
 const tot=parts.reduce((a,b)=>a+b.v,0)||1, r=size/2-14, cx=size/2, cy=size/2;
 let a0=-Math.PI/2,g='';
 parts.forEach((p,i)=>{
  const frac=p.v/tot, a1=a0+frac*Math.PI*2, gap=0.028;
  const x0=cx+r*Math.cos(a0+gap),y0=cy+r*Math.sin(a0+gap),x1=cx+r*Math.cos(a1-gap),y1=cy+r*Math.sin(a1-gap);
  const big=(a1-a0)>Math.PI?1:0;
  if(p.v>0)g+=`<path class="dseg" d="M${x0.toFixed(1)},${y0.toFixed(1)}A${r},${r} 0 ${big} 1 ${x1.toFixed(1)},${y1.toFixed(1)}" fill="none" stroke="${p.c}" stroke-width="16" stroke-linecap="round"
    onmousemove="tip('<b>${esc(p.n)}</b>: ${p.v}%',event)" onmouseleave="untip()" style="pointer-events:stroke"/>`;
  a0=a1;
 });
 g+=`<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="19" font-weight="800" fill="#EAF1FB" class="mn">${label}</text><text x="${cx}" y="${cy+15}" text-anchor="middle" font-size="8.5" fill="#5E7192">${esc(sub)}</text>`;
 return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:0 auto">${g}</svg>`;
}
function mxColor(v){
 if(v==null)return 'transparent';
 const a=Math.min(1,Math.abs(v))*.85+.12;
 return v>=0?`rgba(61,220,151,${(a*.9).toFixed(2)})`:`rgba(255,107,135,${(a*.9).toFixed(2)})`;
}
function mxSym(v){return v==null?'—':v>=.6?'◎':v>=.15?'○':v>-.15?'–':v>-.6?'△':'✕';}
/* ================= modal / tip / ticker ================= */
function openModal(html){$('#modal').innerHTML=`<button class="x" onclick="closeModal()">閉じる ✕</button>`+html;$('#mback').classList.add('on');}
function closeModal(){$('#mback').classList.remove('on');}
$('#mback')?.addEventListener('click',e=>{if(e.target.id==='mback')closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
let tipOn=false;
function tip(html,ev){const t=$('#tip');t.innerHTML=html;t.style.display='block';tipOn=true;if(ev)moveTip(ev);}
function untip(){$('#tip').style.display='none';tipOn=false;}
function moveTip(e){const t=$('#tip');const x=Math.min(e.clientX+15,innerWidth-315),y=Math.min(e.clientY+15,innerHeight-90);t.style.left=x+'px';t.style.top=y+'px';}
document.addEventListener('mousemove',e=>{if(tipOn)moveTip(e);});

const FEED=[
 ['実測','2024年度売上は<b>1,409億円</b>で過去最高 — 「衰退した」印象と実売のギャップこそ検証対象'],
 ['サンプル','AIモード:「雨の日」文脈でG2言及率が<b>-9pt</b>'],
 ['実測','2025年6月、店舗数日本一の座は<b>木更津（約330店）</b>へ'],
 ['サンプル','「子連れ」テーマの第一想起を<b>木更津が3件</b>獲得'],
 ['実測','Googleマップのクチコミは御殿場<b>29,126件・★4.2</b>（9/1時点）'],
 ['サンプル','英語圏クエリの第一想起は<b>67%</b> — インバウンド面は優位'],
 ['工事中','GA4連携で<b>AI経由流入×G2言及率の突合</b>が解放（権限付与のみで開通）']
];
let tkI=0,tkTimer=null;
function tickStart(){
 const el=$('#tk'),n=$('#tkn');
 const show=()=>{el.classList.add('sw');setTimeout(()=>{const f=FEED[tkI%FEED.length];el.innerHTML=`<span class="tag ${f[0]==='実測'?'real':'smp'}" style="margin-right:8px">${f[0]}</span>${f[1]}`;n.textContent=(tkI%FEED.length+1)+'/'+FEED.length;el.classList.remove('sw');tkI++;},350);};
 show(); if(!matchMedia('(prefers-reduced-motion: reduce)').matches) tkTimer=setInterval(show,5200);
 $('#ticker').addEventListener('mouseenter',()=>clearInterval(tkTimer));
 $('#ticker').addEventListener('mouseleave',()=>{clearInterval(tkTimer);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)tkTimer=setInterval(show,5200);});
}

/* ================= nav & router ================= */
const VIEWS=[
 ['v1','◈','サマリー','mix'],
 ['v2','⬡','AI4面比較','smp'],
 ['v3','⚔','競合バトル','smp'],
 ['v4','◔','ペルソナ','smp'],
 ['v5','▦','地域イメージ','smp'],
 ['v6','↗','時系列','smp'],
 ['v7','▣','オープンデータ','real'],
 ['v8','❝','生活者の声','real'],
 ['v9','✦','KPI再設計','prop'],
 ['vx1','◍','SNS公式','lock'],
 ['vx2','◱','GA4×Affinity','lock'],
 ['vx3','◫','CRM・会員','lock']
];
function buildNav(){
 let h='<div class="sec">OVERVIEW</div>';
 VIEWS.forEach(([id,ic,label,kind])=>{
  if(id==='v2')h+='<div class="sec">AI計測（サンプル）</div>';
  if(id==='v7')h+='<div class="sec">実データ</div>';
  if(id==='v9')h+='<div class="sec">戦略</div>';
  if(id==='vx1')h+='<div class="sec">連携（工事中）</div>';
  const bd=kind==='smp'?'<span class="bd smp">SMP</span>':kind==='real'?'<span class="bd real">実測</span>':kind==='prop'?'<span class="bd prop">提案</span>':kind==='lock'?'<span class="bd lock">連携待ち</span>':'<span class="bd">R0</span>';
  h+=`<button class="nv ${kind==='lock'?'ghost':''}" data-v="${id}" onclick="go('${id}')"><span class="ic">${ic}</span>${label}${bd}</button>`;
 });
 $('#nav').innerHTML=h;
}
function go(v){if(location.hash==='#'+v){render();}else{location.hash=v;}}
let GRAN='w';
function setGran(g){GRAN=g;render();}
function cur(){const h=location.hash.replace('#','');return VIEWS.some(x=>x[0]===h)?h:'v1';}
/* ---- 連携ティザー（工事中）: 数値は入れない。形だけのゴーストモック ---- */
function ghostLine(w,h,n,seed,color){
 let pts=[],v=h*.62;
 for(let i=0;i<n;i++){v+= Math.sin(i*seed+seed)*h*.09 - h*.008; v=Math.max(h*.2,Math.min(h*.85,v)); pts.push([8+i*(w-16)/(n-1),v]);}
 const d=smoothD(pts);
 return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">
  <path d="${d}L${pts[pts.length-1][0]},${h-6}L${pts[0][0]},${h-6}Z" fill="${color}" opacity=".1"/>
  <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
  ${[0.25,0.5,0.75].map(f=>`<line x1="8" x2="${w-8}" y1="${(h*f).toFixed(0)}" y2="${(h*f).toFixed(0)}" stroke="#1D2A44" stroke-dasharray="3 5"/>`).join('')}
 </svg>`;
}
function ghostBars(w,h,n,seed,color){
 let g='';const bw=(w-20)/n*.62;
 for(let i=0;i<n;i++){const bh=h*(.25+.55*Math.abs(Math.sin(i*seed+2)));
  g+=`<rect x="${(12+i*(w-24)/n).toFixed(1)}" y="${(h-8-bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${color}" opacity="${(.4+.5*Math.abs(Math.cos(i*seed))).toFixed(2)}"/>`;}
 return `<svg width="100%" viewBox="0 0 ${w} ${h}" style="display:block">${g}</svg>`;
}
function ghostSk(n){let g='';for(let i=0;i<n;i++)g+=`<div class="skrow" style="width:${88-(i*13)%46}%"></div>`;return g;}
const LOCKV={
 vx1:{ic:'◍',t:'SNS公式アカウント',en:'SOCIAL COCKPIT',kpi:'KPIツリー 04（記憶・推奨）',
  need:'<b>X / Instagram の公式アカウント管理者権限</b>（インサイト閲覧の許可のみ・投稿権限は不要）',time:'権限付与から<b>約1営業日</b>で開通',
  see:['公式投稿のエンゲージ率 × テーマ別（富士山/セール/グルメ/イルミ）の伸び比較',
       'UGCメンション量とAI引用率の相関 —「SNSで増えた話題をAIが引用し始める」の実証',
       'キャンペーンハッシュタグの到達・保存数の定点',
       'インバウンド言語別（英/中/韓）の反応差 → 訪日面の投資配分'],
  mock:g=>`<div class="g g2c" style="grid-template-columns:1.2fr 1fr"><div class="card"><div class="ct">テーマ別エンゲージ推移</div>${ghostLine(430,150,14,1.3,'#E27FA6')}${ghostLine(430,40,14,2.1,'#4E9BE8')}</div><div class="card"><div class="ct">投稿×保存数</div>${ghostBars(300,150,9,1.7,'#E27FA6')}<div style="margin-top:10px">${ghostSk(3)}</div></div></div>`},
 vx2:{ic:'◱',t:'GA4 × Affinity',en:'SITE BEHAVIOR',kpi:'KPIツリー 02–03（滞在・体験）',
  need:'<b>GA4プロパティの閲覧権限</b>（またはWindsor経由の接続）。広告管理画面があればさらに出し分け検証が可能',time:'権限付与から<b>約1営業日</b>で開通',
  see:['店舗ページ閲覧者のAffinity（興味関心）分布 → エリア・クリエイティブの出し分け設計',
       '<b>AI経由流入</b>（chatgpt.com / gemini 等の参照元）の推移 — 本ボードのG2言及率と突合し「語られ方→来訪」を接続',
       'ページ回遊（West/East/Hill・ランチ/温泉ページ）→ テナント配置・導線設計への示唆',
       '非セール期のランチ・滞在系ページ行動 → 平日稼働66%の攻略検証'],
  mock:g=>`<div class="g g2c" style="grid-template-columns:1fr 1.2fr"><div class="card"><div class="ct">Affinity分布</div>${ghostBars(300,150,7,2.3,'#4E9BE8')}<div style="margin-top:10px">${ghostSk(2)}</div></div><div class="card"><div class="ct">AI経由流入 × G2言及率</div>${ghostLine(430,150,14,1.1,'#22C7D6')}${ghostLine(430,40,14,1.9,'#FF7A59')}</div></div>`},
 vx3:{ic:'◫',t:'CRM・会員データ',en:'MEMBER JOURNEY',kpi:'KPIツリー 03–04（体験・記憶）',
  need:'<b>会員DB・メール配信ログの読み取り権限</b>（個人が特定されない集計単位で接続）',time:'データ定義の確認込みで<b>約1週間</b>',
  see:['会員セグメント × 来場頻度・買上 —「送客して終わり」からの脱却をデータで確認',
       'ハイロイヤル会員が踏んだジャーニーの可視化 → 他セグメントへの追体験設計',
       'メール開封 → 来場 → 体験（飲食・温泉）の接続 — 開封率単体KPIからの卒業',
       '非セール期プログラム（ランチ・イベント）のLTV寄与'],
  mock:g=>`<div class="g g2c" style="grid-template-columns:1fr 1fr"><div class="card"><div class="ct">セグメント×来場頻度</div>${ghostBars(300,150,8,2.7,'#B48CFF')}</div><div class="card"><div class="ct">ジャーニー遷移</div><div style="padding:12px 4px">${ghostSk(5)}</div></div></div>`}
};
function rLock(id){
 const L=LOCKV[id];
 let h=`<div class="crumb rv"><h2>${L.t}<small>${L.en}</small></h2>
  <span class="chip glt">工事中 — 連携準備</span><span class="chip">${L.kpi}</span></div>`;
 h+=`<div class="rv consband" style="margin-bottom:14px"><span>🚧</span><span><b>この画面は連携待ちのプレビューです。</b>数値は表示していません — 権限をいただくと実数値で開通します。</span></div>`;
 h+=`<div class="lockwrap rv">
   <div class="ghosted">${L.mock()}</div>
   <div class="lockover"><div class="lockcard">
    <div class="lh"><span class="lk">🔒</span><h3>${L.t} を接続すると見えるもの<small>UNLOCK PREVIEW</small></h3></div>
    <ul>${L.see.map(s=>`<li>${s}</li>`).join('')}</ul>
    <div class="req">必要なもの: ${L.need}<br>所要: ${L.time}｜費用: 追加APIコストなし（既存基盤に同居）</div>
   </div></div>
  </div>`;
 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">位置づけ</div>
  <div class="ibox is4"><h4>■ なぜこの連携か</h4><p>本ボードの外側データ（AI・検索・クチコミ）は<b>すでに計測可能</b>。ここに内側データ（${L.t}）が繋がると、<mark>「語られ方の変化 → 行動の変化」まで一本の因果で追える</mark>ようになり、KPI再設計（${L.kpi}）の実測が完成する。</p></div>
 </div>`;
 return h+foot();
}
window.addEventListener('hashchange',render);

/* ================= animation engine ================= */
function animate(root){
 clearT();
 root.querySelectorAll('.rv').forEach((el,i)=>later(()=>el.classList.add('on'),60+i*70));
 root.querySelectorAll('[data-cnt]').forEach((el,i)=>later(()=>countUp(el),240+i*90));
 root.querySelectorAll('.gbar i').forEach((el,i)=>later(()=>{el.style.width=el.dataset.w+'%';},320+i*45));
 root.querySelectorAll('path.draw').forEach((p,i)=>later(()=>p.classList.add('go'),280+i*110));
 root.querySelectorAll('.afill').forEach((p,i)=>later(()=>{p.classList.add('go');p.style.opacity=p.dataset.op;},700+i*120));
 root.querySelectorAll('.ringfg').forEach((c,i)=>later(()=>{c.style.strokeDashoffset=c.dataset.off;},350+i*140));
 root.querySelectorAll('.hcell').forEach(el=>later(()=>el.classList.add('on'),200+(+el.dataset.d)*26));
 root.querySelectorAll('.tile').forEach((el,i)=>later(()=>el.classList.add('on'),240+i*70));
 root.querySelectorAll('.rpoly').forEach((el,i)=>later(()=>el.classList.add('on'),380+i*60));
 root.querySelectorAll('.dseg').forEach((el,i)=>later(()=>el.classList.add('on'),340+i*110));
 root.querySelectorAll('.gbr').forEach((el,i)=>later(()=>el.classList.add('go'),330+i*45));
 root.querySelectorAll('.gbl').forEach((el,i)=>later(()=>el.classList.add('go'),900+i*40));
}
function render(){
 const v=cur();
 document.querySelectorAll('.nv').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 const m=$('#main');
 untip();
 const R={v1:rV1,v2:rV2,v3:rV3,v4:rV4,v5:rV5,v6:rV6,v7:rV7,v8:rV8,v9:rV9};
 m.innerHTML=R[v]?R[v]():rLock(v);
 animate(m);
 window.scrollTo(0,0);
}

/* ================= HELP ================= */
const HELP={
 idx:`<h3>語られ指数とは</h3><p><b>AI言及シェア ÷ 検索需要シェア × 100</b>。来場者数が非公開のため、需要シェア（指名検索の相対量）を実勢の代理としています。<b>100未満＝実需のわりにAIに語られていない</b>（AI比較の入口で不利）、100超＝実需以上に語られている。トヨタ車種別ボードの「語られ指数」（販売シェア比）の御殿場版です。</p><p>※この画面の値は設計プレビュー用サンプルです。実測はテスト計測（R1）から入ります。</p>`,
 funnel:`<h3>G1〜G4の定義</h3><p><b>G1 露出機会 ＝ 1クエリあたりの期待引用数</b>。御殿場が出てくるべき質問に対して「AIがどれだけ回答を作り、どれだけ根拠リンクを引くか」を表す土俵の広さ。<b>回答が返る率 × 回答あたり平均引用数</b>で計算する（例: 90% × 4.1本 = 3.7引用/クエリ）。御殿場自身の成績ではなく、戦う場の大きさを測る指標。</p><p><b>G2 言及率</b>: 同じ質問群で御殿場が回答に登場した率（指名・比較クエリは分母から除外するファネル原則）。<b>G3 第一想起率</b>: 言及があった回答のうち最初に挙がった施設が御殿場だった率。<b>G4 検索需要</b>: Googleトレンド実測の指名検索指数（アンカー連結）。</p>`,
 surface:`<h3>AI4面の見方</h3><p>同じ質問群を <b>ChatGPT / Gemini / GoogleのAI Overview / GoogleのAIモード</b> に投げ、面ごとの言及率・第一想起率・引用元を比較します。面によって参照する情報源が異なるため、<b>弱い面＝その面が引用しやすいメディアへの露出が課題</b>と読みます。</p>`,
 battle:`<h3>勝敗マトリクスの読み方</h3><p>AI回答の全文から<b>テーマ×施設の優劣言及</b>を抽出し、御殿場から見た勝ち（緑）・負け（赤）を集計します。セルをクリックすると根拠スニペット（回答からの抜粋）が開きます。◎○強い勝ち〜✕強い負け、–は拮抗、—はデータなし。</p>`,
 region:`<h3>地域イメージ差の測り方</h3><p>①Googleトレンドの<b>都県別 指名検索指数</b>（タイル地図・全国平均=100）②「日本で」「関東で」を明示した<b>聞き分けプロンプト</b>の回答差 ③テーマ言及率の全国/関東差分。関東では実用文脈（アクセス・混雑）、全国では観光文脈（富士山・訪日）に寄る仮説を検証します。</p>`,
 voice:`<h3>生活者の声の集め方</h3><p>Googleマップのクチコミ（件数・評点・レビュー内キーワード件数）を実査で取得しています。キーワード件数はGoogleマップがクチコミ本文から自動集計しているタグの実数です。引用は原文からの短い抜粋で、出典リンク付き。今後はSNS言及・AI引用元のUGC率も加えます。</p>`,
 open:`<h3>オープンデータの範囲</h3><p>市の観光統計・運営会社の公表資料・報道など、<b>一次情報として出典を示せる公開データ</b>のみを載せています。推計値は使いません。取れない数値は「—」表示です。</p>`,
 kpi:`<h3>KPI再設計の前提</h3><p>現状の主要KPIが<b>駐車台数</b>であることへの問題意識から、来場→滞在→体験→記憶・推奨の4段でKPI候補と取得手段を整理したものです。個人ID単位のトラッキングは想定せず、公開データ・自社データ・AI計測の組み合わせで構成します。</p>`
};
function help(k){openModal(HELP[k]||HELP.idx);}
function cellSnip(theme,rival,v){
 const sn=S.mxsnip[theme]||S.mxsnip.def;
 openModal(`<h3>${esc(theme)} × 対 ${esc(rival)}</h3>
  <p>優劣スコア: <b class="mn" style="color:${v>=0?'var(--gn)':'var(--rd)'}">${v==null?'—':(v>0?'+':'')+v.toFixed(1)}</b>（-1〜+1、+が御殿場優勢）</p>
  <div class="ibox" style="margin-top:12px"><h4>根拠スニペット（サンプル）</h4><p>${esc(sn.t)}<br><small style="color:var(--tx3)">出典面: ${esc(sn.f)}｜回答全文はsnapshotに保存され、ここに実引用が入ります</small></p></div>
  <p style="margin-top:10px;font-size:11px">実測では該当テーマの言及を含む回答からの抜粋が、面バッジ・取得日付きで一覧表示されます。</p>`);
}
/* ================= V1 サマリー ================= */
function rV1(){
 const C=(2*Math.PI*80).toFixed(1), off=(2*Math.PI*80*(1-S.idx/150)).toFixed(1);
 let h=`<div class="crumb rv"><h2>サマリー<small>WEEKLY PULSE</small></h2>
  <span class="chip">出現期待クエリ <b>${S.calls.queries}</b>本×4面</span>
  <span class="chip">回答 <b>${S.calls.answers}</b>/周</span>
  <span class="chip glt">R0 プレビュー</span>
  <button class="hbtn" onclick="help('idx')" aria-label="読み方">?</button></div>`;

 h+=`<div class="hero">
  <div class="card hl rv">
   <div class="ct">語られ指数 — AIでの存在感<span class="tag smp">サンプル</span><button class="q" onclick="help('idx')">?</button></div>
   <div class="ring">
    <svg width="196" height="196" viewBox="0 0 196 196">
     <defs><linearGradient id="gAc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF7A59"/><stop offset="1" stop-color="#FFC24B"/></linearGradient></defs>
     <circle class="ringbg" cx="98" cy="98" r="80"/>
     <circle class="ringfg" cx="98" cy="98" r="80" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}"/>
    </svg>
    <div class="mid"><div><div class="v mn" data-cnt="${S.idx}">0</div><div class="l">語られ指数<span class="delta up">前週 +${S.idx-S.idxPrev}</span></div></div></div>
   </div>
   <div class="sub2" style="text-align:center">AI言及シェア <b class="mono cyt">${S.aiShare}%</b> ÷ 需要シェア <b class="mono cyt">${S.demShare}%</b> × 100<br>
   100超 = <mark class="g">実需以上にAIに語られている</mark></div>
   <svg class="fuji-wm" width="150" height="86" viewBox="0 0 150 86" fill="none"><path d="M8 78 L52 16 Q57 8 63 16 L69 25 L75 16 Q81 8 86 16 L142 78" stroke="#EAF1FB" stroke-width="3"/><path d="M47 30 L56 22 L63 29 L71 21 L79 29 L87 30" stroke="#EAF1FB" stroke-width="2.4"/></svg>
  </div>
  <div class="card rv">
   <div class="ct">ファネル指標 G1–G4<span class="tag smp">サンプル</span><button class="q" onclick="help('funnel')">?</button></div>
   <div class="ktiles">
    <div class="kt"><div class="t"><i style="background:var(--ac)"></i>G1 露出機会</div><div class="v mono"><span data-cnt="${S.g1}" data-dec="1">0</span><small> 引用/クエリ</small></div><div class="s">1クエリあたりの<b>期待引用数</b><br>= 回答が返る率 <b class="mono">90%</b> × 回答あたり引用 <b class="mono">4.1</b>本</div>${spark([3.2,3.3,3.1,3.4,3.5,3.5,3.6,3.7],76,26,'#FF7A59',1)}</div>
    <div class="kt"><div class="t"><i style="background:var(--bl)"></i>G2 言及率</div><div class="v mono"><span data-cnt="${S.g2}" data-dec="1">0</span><small>%</small></div><div class="s">出現期待 ${S.g2n} で言及</div>${spark(S.ts.g2.slice(-8),76,26,'#4E9BE8',1)}</div>
    <div class="kt"><div class="t"><i style="background:var(--pu)"></i>G3 第一想起率</div><div class="v mono"><span data-cnt="${S.g3}" data-dec="1">0</span><small>%</small></div><div class="s">言及${S.g3n}中で最初に登場</div>${spark([38.2,39,38.5,40.1,40.8,40.2,41,41.5],76,26,'#B48CFF',1)}</div>
    <div class="kt"><div class="t"><i style="background:var(--cy)"></i>G4 検索需要</div><div class="v mono"><span data-cnt="${S.g4}">0</span><small> pt</small></div><div class="s">指名検索指数（アンカー=100）<span class="delta up">${S.g4d}</span></div>${spark(S.ts.dem.slice(-8),76,26,'#22C7D6',1)}</div>
   </div>
   <div class="sub2" style="margin-top:10px">指名・比較クエリはG2/G3の分母から除外（ファネル原則）。ノイズ引用は除外して集計。</div>
  </div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px">
  <div class="ct">実データハイライト<span class="tag real">実測</span><button class="q" onclick="help('open')">?</button></div>
  <div class="ktiles" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
   <div class="kt"><div class="t"><i style="background:var(--gold)"></i>2024年度 売上高</div><div class="v mono glt"><span data-cnt="1409">0</span><small> 億円</small></div><div class="s"><mark class="g">過去最高</mark>・国内商業施設トップクラス</div></div>
   <div class="kt"><div class="t"><i style="background:var(--gn)"></i>御殿場市 観光交流客数</div><div class="v mono"><span data-cnt="1538">0</span><small> 万人</small></div><div class="s">2024年度・過去最高圏。うち${REAL.share}がアウトレット</div></div>
   <div class="kt"><div class="t"><i style="background:var(--bl)"></i>Googleマップ評価</div><div class="v mono">★<span data-cnt="4.2" data-dec="1">0</span></div><div class="s">クチコミ <b class="mono">${fmt(REAL.maps.gotemba.cnt)}</b>件（9/1時点）</div></div>
   <div class="kt"><div class="t"><i style="background:var(--rd)"></i>店舗数日本一の座</div><div class="v mono dn" style="font-size:17px">木更津へ</div><div class="s">2025.6増床で約330店（御殿場は約290店）</div></div>
  </div>
  <div class="src">出典: ${srcA('ats','plan','impress','gmap')}</div>
 </div>`;

 h+=`<div class="card hl rv" style="margin-top:14px">
  <div class="ct">検証テーマ —「存在感が薄まった」は本当か</div>
  <div class="g g3c" style="grid-template-columns:repeat(3,minmax(0,1fr))">
   <div class="ibox is2" style="margin:0"><h4>■ 印象（仮説）</h4><p>昔は大盛り上がりだったが、<mark class="r">競合の出現で存在感が薄まり、テナントも弱くなった</mark>印象がある。「アウトレットどこ行く？」の会話で名前が挙がらなくなっていないか。</p></div>
   <div class="ibox is3" style="margin:0"><h4>■ 実データ</h4><p>売上は<mark class="g">1,409億円で過去最高</mark>（2024年度）、市の観光交流客数も過去最高圏。25周年で<b>1年に27店を新規導入</b>。実需・実売は衰えていない。</p></div>
   <div class="ibox is4" style="margin:0"><h4>■ だから測る</h4><p>薄まった可能性があるのは<mark>実売ではなく「語られ方」＝比較検討の入口シェア</mark>。木更津(2012開業→2025店舗数日本一)の台頭で、AI・検索・クチコミ上の相対的な存在感がどう動いたかを定点計測する。</p></div>
  </div>
 </div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1.25fr 1fr;margin-top:14px">
  <div class="card rv">
   <div class="ct">今週の警報<span class="tag smp">サンプル</span></div>
   <div class="g" style="gap:9px">`+
  S.alerts.map(a=>`<div class="alert ${a.sev==='mid'?'mid':''}"><span class="sev">${a.sev==='high'?'HIGH':'MID'}</span>
    <div class="tx"><b>${esc(a.f)}</b>｜${esc(a.t)}<small>${esc(a.s)}</small></div>
    <span class="pill fac">${esc(a.f)}</span></div>`).join('')+
  `</div></div>
  <div class="card rv">
   <div class="ct">クエリ入替（今週）<span class="tag smp">サンプル</span></div>
   <div style="font-size:10px;color:var(--tx3);margin-bottom:6px">▲ 昇格（需要スコア上昇で現役入り）</div>
   ${S.promo.map(q=>`<span class="qchip"><span class="ar up">▲</span>${esc(q[0])}<span class="dm">需要${q[1]}</span></span>`).join('')}
   <div style="font-size:10px;color:var(--tx3);margin:10px 0 6px">▼ 降格（補欠へ）</div>
   ${S.demo.map(q=>`<span class="qchip"><span class="ar dn">▼</span>${esc(q[0])}<span class="dm">需要${q[1]}</span></span>`).join('')}
   <div class="sub2" style="margin-top:10px">クエリIDは永続採番（振り直し禁止）。入替履歴は<a href="#v6" onclick="go('v6')">時系列</a>に蓄積。</div>
  </div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px">
  <div class="ct">AI4面ステータス<span class="tag smp">サンプル</span><button class="q" onclick="help('surface')">?</button></div>
  <div class="g g4c" style="grid-template-columns:repeat(4,minmax(0,1fr))">`+
  S.faces.map(f=>`<div style="min-width:0">
    <div style="display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700"><i style="width:8px;height:8px;border-radius:99px;background:${f.c};box-shadow:0 0 8px ${f.c}"></i>${f.n}<span class="mono" style="margin-left:auto;font-size:12px">${f.g2}%</span></div>
    <div class="gbar" style="margin-top:6px"><i data-w="${f.g2}" style="background:${f.c}"></i></div>
    <div class="sub2">G3 ${f.g3}%・引用${f.cite}/回答</div>
   </div>`).join('')+
 `</div></div>`;

 h+=`<div class="card rv" style="margin-top:14px">
  <div class="ct">連携ロードマップ — 繋がると解放される画面<span class="tag prop">工事中</span></div>
  <div class="g g3c" style="grid-template-columns:repeat(3,minmax(0,1fr))">
   <div class="lockchip" onclick="go('vx1')"><span class="ic2">◍</span><div class="t2">SNS公式アカウント<small>UGC×AI引用の相関・テーマ別エンゲージ</small></div><span style="margin-left:auto">🔒</span></div>
   <div class="lockchip" onclick="go('vx2')"><span class="ic2">◱</span><div class="t2">GA4 × Affinity<small>AI経由流入×G2突合・出し分け設計</small></div><span style="margin-left:auto">🔒</span></div>
   <div class="lockchip" onclick="go('vx3')"><span class="ic2">◫</span><div class="t2">CRM・会員<small>ハイロイヤルのジャーニー再現</small></div><span style="margin-left:auto">🔒</span></div>
  </div>
  <div class="sub2" style="margin-top:9px">権限付与のみで開通（追加APIコストなし）。詳細は各画面の解放プレビューへ。</div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px">
  <div class="ct">今週の発見（実測から言えること — 形式サンプル）<span class="tag smp">サンプル</span></div>
  <div class="g" style="gap:8px">
   <div class="ibox" style="margin:0"><p>① 観光文脈（「箱根旅行 ついでに」「富士山 モデルコース」）のG2は<mark>74%と全ファミリー中最強</mark>。<b>箱根・富士山とセットで語らせる</b>のが御殿場の勝ち筋。</p></div>
   <div class="ibox is2" style="margin:0"><p>② 弱点は<mark class="r">アクセス・混雑・子連れ</mark>。関東実用文脈では木更津に第一想起を奪われつつある（今週3件）。</p></div>
   <div class="ibox is3" style="margin:0"><p>③ 英語圏クエリ（best outlet near Tokyo等）では<mark class="g">第一想起67%</mark>と国内比+9pt。インバウンド面の語られ方は優位で、伸ばす価値がある。</p></div>
  </div>
 </div>`;
 return h+foot();
}

/* ================= V2 AI4面 ================= */
let domSort={k:1,asc:false};
function sortDom(k){domSort={k,asc:domSort.k===k?!domSort.asc:false};const el=document.getElementById('domtb');if(el)el.innerHTML=domRows();const m=$('#main');m.querySelectorAll('#domtb .gbar i').forEach(el2=>{el2.style.width=el2.dataset.w+'%';});}
function domRows(){
 const arr=[...S.domains].sort((a,b)=>domSort.k===0?(domSort.asc?String(a[0]).localeCompare(b[0]):String(b[0]).localeCompare(a[0])):(domSort.asc?a[1]-b[1]:b[1]-a[1]));
 const mx=Math.max(...S.domains.map(d=>d[1]));
 return arr.map((d,i)=>`<tr>
   <td class="mono" style="color:var(--tx3)">${String(i+1).padStart(2,'0')}</td>
   <td style="font-family:var(--mono);font-size:11.5px">${esc(d[0])}</td>
   <td style="min-width:130px"><span class="gbar" style="display:block"><i data-w="${(d[1]/mx*100).toFixed(1)}" style="width:${(d[1]/mx*100).toFixed(1)}%;background:${d[2]==='自社公式'?'linear-gradient(90deg,var(--ac2),var(--ac))':d[2]==='競合公式'?'linear-gradient(90deg,#2C6CB8,var(--bl))':d[2]==='UGC'?'linear-gradient(90deg,#1E9E6E,var(--gn))':'linear-gradient(90deg,#3A4A6B,#55647F)'}"></i></span></td>
   <td class="mono" style="text-align:right">${d[1].toFixed(1)}%</td>
   <td><span class="pill ${d[2]==='自社公式'?'fac':d[2]==='UGC'?'pos':''}">${esc(d[2])}</span></td>
  </tr>`).join('');
}
function rV2(){
 let h=`<div class="crumb rv"><h2>AI4面比較<small>SURFACE BATTLE</small></h2>
  <span class="chip">同一クエリ群を <b>4</b>面に同時投下</span><span class="chip glt">週次</span>
  <button class="hbtn" onclick="help('surface')">?</button></div>`;

 h+=`<div class="card rv"><div class="ct">面別スコア — G2言及率 / G3第一想起率 / 回答生成率<span class="tag smp">サンプル</span></div>
  ${groupedBars(['G2 言及率','G3 第一想起率','回答生成率'],S.faces.map(f=>({label:f.n,color:f.hex,vals:[f.g2,f.g3,f.gen]})),760,270)}
  <div class="legend">${S.faces.map(f=>`<span><i style="background:${f.hex}"></i>${f.n}</span>`).join('')}<span style="margin-left:auto">単位: %</span></div>
 </div>`;

 h+=`<div class="g g4c" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:14px">`+
  S.faces.map(f=>`<div class="face rv" style="--fc:${f.c}">
   <div class="nm"><i></i>${f.n}<span class="tag smp" style="margin-left:auto">SMP</span></div>
   <div class="met">
    <div class="m"><div class="a">回答生成率</div><div class="b mono">${f.gen}<small>%</small></div></div>
    <div class="m"><div class="a">平均引用数</div><div class="b mono">${f.cite}</div></div>
    <div class="m"><div class="a">G2 言及率</div><div class="b mono">${f.g2}<small>%</small></div></div>
    <div class="m"><div class="a">G3 第一想起</div><div class="b mono">${f.g3}<small>%</small></div></div>
   </div>
   <div class="nt">${esc(f.note)}</div>
  </div>`).join('')+`</div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1.35fr 1fr;margin-top:14px">
  <div class="card rv"><div class="ct">引用元ドメインランキング（4面合算）<span class="tag smp">サンプル</span></div>
   <div class="tblwrap"><table class="tbl"><thead><tr>
    <th style="width:34px">#</th><th onclick="sortDom(0)">ドメイン ⇅</th><th>引用シェア</th><th onclick="sortDom(1)" style="text-align:right">% ⇅</th><th>分類</th>
   </tr></thead><tbody id="domtb">${domRows()}</tbody></table></div>
   <div class="sub2" style="margin-top:8px">その他 29.6%。Geminiのリダイレクタ引用はドメイン復元済み。</div>
  </div>
  <div class="card rv"><div class="ct">引用の構成 — 公式は思ったより引かれない<span class="tag smp">サンプル</span></div>
   <div class="ktiles" style="grid-template-columns:1fr 1fr">
    <div class="kt"><div class="t"><i style="background:var(--ac)"></i>自社公式の引用シェア</div><div class="v mono act"><span data-cnt="${S.official}" data-dec="1">0</span><small>%</small></div></div>
    <div class="kt"><div class="t"><i style="background:var(--gn)"></i>UGC・クチコミ系</div><div class="v mono up"><span data-cnt="${S.ugc}" data-dec="1">0</span><small>%</small></div></div>
   </div>
   <div class="ibox" style="margin-top:12px"><h4>■ 示唆</h4><p>「どれがいい？」型の質問では<mark>公式サイトより口コミ・外部記事が引用されやすい</mark>（公式は自社の良いことしか書かないため比較の根拠にならない）。<b>タイアップ・外部メディア・UGCへの露出</b>が4面の言及率を動かすレバーになる。PR表記があってもAIは内容が有用なら評価対象とする。</p></div>
  </div>
 </div>`;
 return h+foot();
}

/* ================= V3 競合バトル ================= */
function rV3(){
 let h=`<div class="crumb rv"><h2>競合バトル<small>THEME × RIVAL</small></h2>
  <span class="chip">Tier1 競合 <b>9</b>施設</span><span class="chip">テーマ <b>9</b>軸</span>
  <button class="hbtn" onclick="help('battle')">?</button></div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1.05fr 1fr">
  <div class="card rv"><div class="ct">テーマ別スコア レーダー — 御殿場 × 木更津 × 軽井沢<span class="tag smp">サンプル</span></div>
   ${radar([
    {label:'御殿場',color:'#FF7A59',vals:S.radar.gotemba},
    {label:'木更津',color:'#4E9BE8',vals:S.radar.kisarazu},
    {label:'軽井沢',color:'#B48CFF',vals:S.radar.karuizawa}
   ],420)}
   <div class="legend"><span><i style="background:#FF7A59"></i>御殿場</span><span><i style="background:#4E9BE8"></i>木更津</span><span><i style="background:#B48CFF"></i>軽井沢</span><span>スコア=テーマ言及のポジ率（0–100）</span></div>
  </div>
  <div class="card rv"><div class="ct">第一想起の獲得数（302回答中）<span class="tag smp">サンプル</span></div>
   ${hbars(S.firstBar.map(r=>({l:r[0],v:r[1],me:r[2],bg:r[2]?'linear-gradient(90deg,var(--ac2),var(--ac))':'linear-gradient(90deg,#31456B,#4A5E85)'})),{suf:''})}
   <div class="sub2" style="margin-top:8px">残り30回答はTier2施設・その他。<b>御殿場73 vs 木更津54</b> — 差は19回答で、家族・実用文脈で侵食が進むと逆転圏。</div>
  </div>
 </div>`;

 const cells=S.mx.map((row,ri)=>`<tr><th class="rowh">${esc(S.themes[ri])}</th>`+row.map((v,ci)=>
   v==null?`<td class="non">—</td>`:
   `<td><button class="hcell" data-d="${ri+ci}" style="background:${mxColor(v)};color:${Math.abs(v)>.45?'#04101D':'var(--tx)'}"
     onclick="cellSnip('${esc(S.themes[ri])}','${esc(S.rivals[ci])}',${v})"
     onmousemove="tip('<b>${esc(S.themes[ri])}</b> × 対${esc(S.rivals[ci])}<br>優劣: <b>${(v>0?'+':'')+v.toFixed(1)}</b>（+が御殿場優勢）<br>クリックで根拠スニペット',event)" onmouseleave="untip()">${mxSym(v)}</button></td>`).join('')+`</tr>`).join('');
 h+=`<div class="card rv" style="margin-top:14px">
  <div class="ct">勝敗マトリクス — テーマ × 競合（セルクリックで根拠）<span class="tag smp">サンプル</span><button class="q" onclick="help('battle')">?</button></div>
  <div class="mwrap"><table class="mx"><thead><tr><th></th>${S.rivals.map(r=>`<th>${esc(r)}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table></div>
  <div class="legend"><span><i style="background:rgba(61,220,151,.8)"></i>御殿場 優勢</span><span><i style="background:rgba(255,107,135,.8)"></i>御殿場 劣勢</span><span>◎○ 勝ち / – 拮抗 / △✕ 負け / — データなし</span></div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">バトル総括</div>
  <div class="ibox"><h4>■ 勝ち筋</h4><p><mark class="g">景観（富士山）・インバウンド・品揃え</mark>はほぼ全施設に勝ち。軽井沢とだけ「景観・特別感」を分け合う構図。</p></div>
  <div class="ibox is2"><h4>■ 負け筋</h4><p><mark class="r">アクセスは対 木更津・横浜BS・入間で明確に負け</mark>。子連れは木更津に負け。混雑・渋滞はネガ言及が最多で、AI回答にも「渋滞に注意」が定型化しつつある。</p></div>
  <div class="ibox is3"><h4>■ だからどうする</h4><p>①観光セット文脈（箱根・富士山・温泉）を外部メディアで増幅し勝ち筋を固定化 ②「渋滞・行き方」の一次情報（時間帯別の空き・シャトル）を公式とマップ系に整備しネガ引用を上書き ③子連れ文脈は施設実装（キッズ導線）とセットで木更津と差別化。</p></div>
 </div>`;
 return h+foot();
}
/* ================= V4 ペルソナ ================= */
function rV4(){
 let h=`<div class="crumb rv"><h2>ペルソナ<small>WHO IS IT FOR</small></h2>
  <span class="chip">属性付与 <b>145</b>言及</span><button class="hbtn" onclick="help('surface')">?</button></div>`;

 h+=`<div class="g g2c" style="grid-template-columns:340px minmax(0,1fr)">
  <div class="card rv"><div class="ct">言及のペルソナ分布<span class="tag smp">サンプル</span></div>
   ${donut(S.personas.map(p=>({n:p.n,v:p.v,c:p.c})),230,'145','言及ベース')}
   <div class="legend" style="justify-content:center">${S.personas.map(p=>`<span><i style="background:${p.c}"></i>${p.n} <b class="mono" style="color:var(--tx2)">${p.v}%</b></span>`).join('')}</div>
  </div>
  <div class="card rv"><div class="ct">面ごとのペルソナ構成 — どのAIが誰に勧めるか<span class="tag smp">サンプル</span></div>
   <div class="g" style="gap:13px;margin-top:4px">`+
   S.faces.map(f=>{const mix=S.pmix[f.id];return `
    <div>
     <div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;margin-bottom:5px"><i style="width:8px;height:8px;border-radius:99px;background:${f.c}"></i>${f.n}</div>
     <div style="display:flex;gap:2px;height:15px;border-radius:99px;overflow:hidden">
      ${mix.map((v,i)=>`<span style="width:${v}%;background:${S.personas[i].c}" onmousemove="tip('<b>${f.n}</b><br>${esc(S.personas[i].n)}: <b>${v}%</b>',event)" onmouseleave="untip()"></span>`).join('')}
     </div>
    </div>`;}).join('')+
   `</div>
   <div class="sub2" style="margin-top:12px">Geminiは<b>インバウンド寄り（27%）</b>、ChatGPTは<b>家族寄り（34%）</b>に言及が偏る — 面ごとに「誰へのおすすめとして語られるか」が違う。</div>
  </div>
 </div>`;

 h+=`<div class="g g3c" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:14px">`+
  S.personas.slice(0,5).map(p=>`
  <div class="card rv" style="border-top:2px solid ${p.c}">
   <div class="ct" style="margin-bottom:8px"><i style="width:9px;height:9px;border-radius:99px;background:${p.c}"></i>${p.n}
    <span class="mono" style="margin-left:auto;font-size:15px;color:var(--tx)">${p.v}%</span><span class="delta ${p.d.startsWith('+')?'up':p.d==='0'||p.d==='—'?'fl':'dn'}">${p.d}</span></div>
   <div class="quote" style="border:none;background:rgba(8,14,26,.6);padding:10px 12px"><div class="qq" style="font-size:11.5px">${esc(p.q)}</div></div>
   <div class="sub2" style="margin-top:8px">${esc(p.s)}</div>
  </div>`).join('')+
 `</div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">ペルソナ総括</div>
  <div class="ibox is3"><h4>■ 強い</h4><p><mark class="g">インバウンド（24%・+3pt）</mark>が伸長。「Mt.Fuji view × 免税 × ブランド」の三点セットで英語圏の推奨が固い。実データ側でも外国人宿泊が2019年比2.2倍と符合。</p></div>
  <div class="ibox is2"><h4>■ 揺らぎ</h4><p>最大セグメントの<mark class="r">家族連れ（31%）で「雨天」「キッズ導線」のネガ言及</mark>が混じり、木更津への流出文脈が発生。カップルは軽井沢と言及を分け合う。</p></div>
  <div class="ibox is3"><h4>■ だからどうする</h4><p>ペルソナ×面のマトリクスで<b>広告・タイアップの出し分け</b>（例: Gemini面が強い訪日文脈は英語メディア、ChatGPT面の家族文脈は国内メディア）に接続する。</p></div>
 </div>`;
 return h+foot();
}

/* ================= V5 地域イメージ ================= */
function rV5(){
 const mx=Math.max(...S.themeDiff.map(d=>Math.abs(d[1])));
 let h=`<div class="crumb rv"><h2>地域イメージ<small>JAPAN vs KANTO</small></h2>
  <span class="chip">都県別需要 × 聞き分けプロンプト</span><button class="hbtn" onclick="help('region')">?</button></div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1fr 1.15fr">
  <div class="card rv"><div class="ct">指名検索の需要指数マップ（全国平均=100）<span class="tag smp">サンプル</span></div>
   <div class="tmap">`+
   [...Array(12)].map((_,i)=>{
    const r=Math.floor(i/4)+1,c=i%4+1;
    const t=S.tiles.find(t=>t.r===r&&t.c===c);
    if(!t)return `<div class="tile ghost"></div>`;
    const a=Math.min(1,t.v/130)*.75+.08;
    return `<div class="tile" style="background:rgba(255,122,89,${a.toFixed(2)});border-color:rgba(255,154,107,${(a+.15).toFixed(2)})"
      onmousemove="tip('<b>${t.p}</b>: 需要指数 <b>${t.v}</b>${t.note?'<br>'+t.note:''}',event)" onmouseleave="untip()">
      ${t.star?'<span class="st">🗻</span>':''}<div class="p">${t.p}</div><div class="v mn">${t.v}</div><div class="d">${t.note||''}</div></div>`;
   }).join('')+
   `</div>
   <div class="sub2" style="margin-top:10px">模式タイル地図。<b>地元圏（静岡128・神奈川96・山梨84）に需要が偏り</b>、千葉29は木更津圏で最弱 — 商圏の「東の壁」が見える。</div>
  </div>
  <div class="card rv"><div class="ct">テーマ言及の 全国⇄関東 差分<span class="tag smp">サンプル</span></div>
   <div style="display:grid;gap:7px">`+
   S.themeDiff.map(d=>{const v=d[1],w=Math.abs(v)/mx*50;
    return `<div style="display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:center">
     <span style="font-size:10.5px;color:var(--tx2);text-align:right;white-space:nowrap">${esc(d[0])}</span>
     <div style="position:relative;height:13px;background:#0A1322;border-radius:99px" onmousemove="tip('<b>${esc(d[0])}</b><br>${v>0?'関東で +'+v+'pt 言及されやすい':'全国で +'+(-v)+'pt 言及されやすい'}',event)" onmouseleave="untip()">
      <span style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1.5px;background:var(--line2)"></span>
      <span class="gbar" style="position:absolute;top:2px;bottom:2px;height:auto;${v>0?'left:50%':'right:50%'};border-radius:99px;width:${w}%"><i data-w="100" style="background:${v>0?'linear-gradient(90deg,#2C6CB8,var(--bl))':'linear-gradient(270deg,var(--ac2),var(--ac))'}"></i></span>
     </div></div>`;}).join('')+
   `</div>
   <div class="legend"><span><i style="background:var(--ac)"></i>全国プロンプトで強い（観光文脈）</span><span><i style="background:var(--bl)"></i>関東プロンプトで強い（実用文脈）</span></div>
   <div class="sub2" style="margin-top:6px">全国では<mark>富士山・訪日の観光地</mark>、関東では<mark class="r">「遠い・混む」の実用比較対象</mark>として語られる — 同じ施設が地域で別のブランドになっている。</div>
  </div>
 </div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1fr 1fr;margin-top:14px">
  <div class="card rv"><div class="ct">「日本でおすすめのアウトレットは？」<span class="tag smp">サンプル</span></div>
   <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <div class="kpi act">御殿場</div><span class="pill pos">4面中 ${S.askJp.gotemba}面で第一想起</span><span class="pill">軽井沢 ${S.askJp.karuizawa}面</span>
   </div>
   <div class="sub2" style="margin-top:8px">全国視点では「日本最大級 × 富士山」で御殿場がほぼ独走。根拠引用は旅行メディア中心。</div>
  </div>
  <div class="card rv"><div class="ct">「関東でおすすめのアウトレットは？」<span class="tag smp">サンプル</span></div>
   <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <div class="kpi" style="color:var(--bl)">木更津と互角</div><span class="pill fac">御殿場 ${S.askKanto.gotemba}面</span><span class="pill fac">木更津 ${S.askKanto.kisarazu}面</span>
   </div>
   <div class="sub2" style="margin-top:8px">関東視点では<mark class="r">アクセス軸で木更津が並ぶ</mark>。「都心から近い順」で並べる回答形式が増えると構造的に不利。</div>
  </div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">地域戦略の含意</div>
  <div class="ibox is3"><h4>■ だからどうする</h4><p>①全国・訪日向けは「富士山×買い物」の観光文脈を維持強化 ②関東向けは<b>時間価値の再定義</b>（「遠いが1日遊べる」滞在型訴求・非セール期のランチ/温泉訴求）で木更津との軸をずらす ③千葉・茨城は深追いせず、神奈川・東京西部・静岡・山梨の地元圏を固める。</p></div>
 </div>`;
 return h+foot();
}

/* ================= V6 時系列 ================= */
function rV6(){
 const T=GRAN==='d'?S.tsD:GRAN==='m'?S.tsM:S.ts;
 const GL={d:'日次（直近28日）',w:'週次（12ラウンド）',m:'月次（12か月）'}[GRAN];
 const dlt=a=>{const d=a[a.length-1]-a[0];return (d>0?'+':'')+(Math.abs(d)<10?d.toFixed(1).replace('.0',''):Math.round(d));};
 const rng={d:{idx:[104,120],g2:[52,62],dem:[80,120]},w:{idx:[95,125],g2:[45,65],dem:[50,110]},m:{idx:[92,120],g2:[45,62],dem:[50,105]}}[GRAN];
 let h=`<div class="crumb rv"><h2>時系列<small>TREND EXPLORER</small></h2>
  <span class="seg" role="tablist" aria-label="集計粒度">
   <button class="${GRAN==='d'?'on':''}" onclick="setGran('d')">日次</button>
   <button class="${GRAN==='w'?'on':''}" onclick="setGran('w')">週次</button>
   <button class="${GRAN==='m'?'on':''}" onclick="setGran('m')">月次</button>
  </span>
  <span class="chip">${GL}</span>
  <button class="hbtn" onclick="help('idx')">?</button></div>`;

 h+=`<div class="rv" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
  <span class="gstat"><i style="width:8px;height:8px;border-radius:99px;background:#FF7A59"></i>語られ指数 期間Δ <b class="${T.idx[T.idx.length-1]>=T.idx[0]?'up':'dn'}">${dlt(T.idx)}</b></span>
  <span class="gstat"><i style="width:8px;height:8px;border-radius:99px;background:#4E9BE8"></i>G2言及率 Δ <b class="${T.g2[T.g2.length-1]>=T.g2[0]?'up':'dn'}">${dlt(T.g2)}pt</b></span>
  <span class="gstat"><i style="width:8px;height:8px;border-radius:99px;background:#22C7D6"></i>検索需要 Δ <b class="${T.dem[T.dem.length-1]>=T.dem[0]?'up':'dn'}">${dlt(T.dem)}</b></span>
 </div>`;

 h+=`<div class="card rv"><div class="ct">語られ指数 — ${GL}<span class="tag smp">サンプル</span></div>
  ${lineChart('tsA',T.w,[{label:'語られ指数',color:'#FF7A59',hex:'#FF7A59',vals:T.idx,fill:1}],760,220,{min:rng.idx[0],max:rng.idx[1],smooth:1,marks:T.ev.map(e=>({i:e.i}))})}
  <div class="legend"><span><i style="background:#FF7A59"></i>語られ指数（100=需要並み）</span>${GRAN==='w'?'<span style="color:var(--gold)">▼ = クエリ入替ラウンド</span>':''}${GRAN==='d'?'<span>週末は需要急増の分だけ指数が沈む（分母効果）</span>':''}${GRAN==='m'?'<span>1月・8月の需要ピークで指数が沈む — 繁忙期ほど語られ方が追いつかない</span>':''}</div>
 </div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1fr 1fr;margin-top:14px">
  <div class="card rv"><div class="ct">G2 言及率（%）— ${GL}<span class="tag smp">サンプル</span></div>
   ${lineChart('tsB',T.w,[{label:'G2',color:'#4E9BE8',hex:'#4E9BE8',vals:T.g2,fill:1}],380,190,{min:rng.g2[0],max:rng.g2[1],smooth:1})}
  </div>
  <div class="card rv"><div class="ct">G4 検索需要指数 — ${GL}<span class="tag smp">サンプル</span></div>
   ${lineChart('tsC',T.w,[{label:'需要',color:'#22C7D6',hex:'#22C7D6',vals:T.dem,fill:1}],380,190,{min:rng.dem[0],max:rng.dem[1],smooth:1})}
   ${GRAN==='d'?'<div class="sub2">土日に需要が跳ねる週末型。非セール期の平日をどう埋めるかがKPI再設計の論点。</div>':''}
  </div>
 </div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1fr 1.2fr;margin-top:14px">
  <div class="card rv"><div class="ct">クエリ入替の履歴<span class="tag smp">サンプル</span>${GRAN!=='w'?'<span class="chip">週次ベース</span>':''}</div>
   <div class="tl">
    <div class="tle"><div class="y">8/31 週（R12）</div><div class="t">▲「富士山 観光 モデルコース」「アウトレット 福袋 いつ」／▼「雨の日 大型 買い物 施設」<small> 需要スコア改定による自動入替</small></div></div>
    <div class="tle"><div class="y">8/3 週（R8）</div><div class="t">▲ 英語E族 3本を現役昇格（訪日需要増）／▼ 2本<small> locale挙動はprobe検証済み</small></div></div>
    <div class="tle"><div class="y">7/6 週（R4）</div><div class="t">▲「イルミネーション 関東」を季節先行で仕込み／▼ 1本<small> 季節イベント族の運用開始</small></div></div>
   </div>
  </div>
  <div class="card rv"><div class="ct">ラウンド実績<span class="tag smp">サンプル</span></div>
   <div class="tblwrap"><table class="tbl"><thead><tr><th>週</th><th>呼数</th><th>取得率</th><th>コスト</th><th>主な変化</th></tr></thead><tbody>
    <tr><td class="mono">8/31</td><td class="mono">336</td><td class="mono up">99.7%</td><td class="mono">$13.1</td><td>指数116に上昇・雨天ネガ警報</td></tr>
    <tr><td class="mono">8/24</td><td class="mono">336</td><td class="mono up">99.9%</td><td class="mono">$12.8</td><td>木更津が子連れ第一想起+2</td></tr>
    <tr><td class="mono">8/17</td><td class="mono">336</td><td class="mono up">100%</td><td class="mono">$12.6</td><td>需要指数が夏休み明けで一服</td></tr>
    <tr><td class="mono">8/10</td><td class="mono">336</td><td class="mono up">99.4%</td><td class="mono">$13.4</td><td>AIO生成率が+4pt回復</td></tr>
   </tbody></table></div>
   <div class="sub2" style="margin-top:8px">snapshotに全回答本文＋引用を保存 — 勝敗テーマ・ペルソナ抽出の再計算がいつでも可能。</div>
  </div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">読み方</div>
  <div class="ibox"><h4>■ この画面が答える問い</h4><p>「語られ方は<b>良くなっているのか悪くなっているのか</b>」。指数・言及率・需要を同じ粒度で並べ、<mark>施策（外部露出・リニューアル報道）の反映ラグ</mark>を観測する。クエリ入替はIDを永続化しているため時系列は壊れない。</p></div>
  <div class="ibox is4"><h4>■ 粒度の使い分け</h4><p><b>週次が正</b>（4面フル計測ラウンド）。<b>日次</b>は軽量クエリの毎日スキャン運用（トヨタ日次60本方式）を想定した設計で、警報の早期検知に使う。<b>月次</b>は週次の集計で、季節性（初売り・夏休み）と施策効果の俯瞰に使う。</p></div>
 </div>`;
 return h+foot();
}
/* ================= V7 オープンデータ ================= */
function rV7(){
 let h=`<div class="crumb rv"><h2>オープンデータ<small>VERIFIED FACTS</small></h2>
  <span class="chip up">全数値 出典付き実データ</span><span class="chip">取得 2026-09-01</span>
  <button class="hbtn" onclick="help('open')">?</button></div>`;

 h+=`<div class="card rv"><div class="ct">経営・来場の実勢<span class="tag real">実測</span></div>
  <div class="ktiles" style="grid-template-columns:repeat(auto-fit,minmax(175px,1fr))">
   <div class="kt"><div class="t"><i style="background:var(--gold)"></i>売上高（2024年度）</div><div class="v mono glt"><span data-cnt="1409">0</span><small> 億円</small></div><div class="s">過去最高。2011年度586億円から<b class="mono">約2.4倍</b></div></div>
   <div class="kt"><div class="t"><i style="background:var(--ac)"></i>累計来場者</div><div class="v mono">2.3<small> 億人</small></div><div class="s">2000年開業〜2025年3月末</div></div>
   <div class="kt"><div class="t"><i style="background:var(--bl)"></i>店舗数</div><div class="v mono"><span data-cnt="290">0</span><small> 店</small></div><div class="s">2020年第4期増床（+88店）後</div></div>
   <div class="kt"><div class="t"><i style="background:var(--gn)"></i>25周年の刷新</div><div class="v mono"><span data-cnt="27">0</span><small> 店 新規</small></div><div class="s">2024.4〜2025.8。既存30店以上も改装・移転</div></div>
   <div class="kt"><div class="t"><i style="background:var(--cy)"></i>宿泊客数（御殿場市）</div><div class="v mono"><span data-cnt="122.2" data-dec="1">0</span><small> 万人</small></div><div class="s">2024年度。2019年度96.8万人から増</div></div>
   <div class="kt"><div class="t"><i style="background:var(--pu)"></i>外国人宿泊（市）</div><div class="v mono"><span data-cnt="24.9" data-dec="1">0</span><small> 万人</small></div><div class="s">2024年・<mark class="g">2019年比 約2.2倍</mark></div></div>
   <div class="kt"><div class="t"><i style="background:var(--rd)"></i>日帰り平均滞在</div><div class="v mono dn"><span data-cnt="3.6" data-dec="1">0</span><small> 時間</small></div><div class="s">県全体9時間32分の1/3以下 — 滞在化が課題</div></div>
   <div class="kt"><div class="t"><i style="background:var(--gold)"></i>平日の稼働</div><div class="v mono"><span data-cnt="66">0</span><small> %</small></div><div class="s">休前日=100とした市内観光関連施設の平日稼働</div></div>
  </div>
  <div class="src">出典: ${srcA('ats','prtimes','plan','planR4','wiki')}</div>
 </div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1.3fr 1fr;margin-top:14px">
  <div class="card rv"><div class="ct">御殿場市 観光交流客数の推移（万人）<span class="tag real">実測</span></div>
   ${lineChart('kk',REAL.kanko.years.map(y=>String(y)),[{label:'交流客数',color:'#3DDC97',hex:'#3DDC97',vals:REAL.kanko.vals,fill:1}],640,240,{min:900,max:1650,smooth:1,marks:[{i:9}]})}
   <div class="legend"><span><i style="background:#3DDC97"></i>観光交流客数（うち${REAL.share}がアウトレット）</span><span style="color:var(--gold)">▼ = 2020 コロナ禍</span></div>
   <div class="sub2">2020年に1,029万人まで落ち、<mark class="g">2023年に完全回復・2024年度は1,538万人と過去最高圏</mark>。「客足の衰退」は市の統計からは確認できない。</div>
   <div class="src">出典: ${srcA('plan','planR4')}</div>
  </div>
  <div class="card rv"><div class="ct">店舗数レース — 「日本一」の交代<span class="tag real">実測</span></div>
   ${hbars([
    {l:'木更津（2025.6〜）',v:330,me:0,bg:'linear-gradient(90deg,#2C6CB8,var(--bl))',tip:'2025年6月 第4期増床で約330店'},
    {l:'御殿場（2020.6〜）',v:290,me:1,tip:'2020年6月 第4期増床で約290店'}
   ],{suf:'店'})}
   <div class="sub2" style="margin-top:6px">2020年の増床で御殿場が獲った「店舗数日本一」を、<mark class="r">2025年6月に木更津が奪回</mark>。「規模」の看板では戦えなくなった — 語られ方の軸（富士山・体験・訪日）へ移る必然。</div>
   <div class="ibox is2" style="margin-top:10px"><h4>■ 補足</h4><p>売上では御殿場1,409億円（2024年度・過去最高）に対し、木更津は増床を機に<b>中長期で1,000億円を目指す</b>と報道されており、追う側の投資が続く。</p></div>
   <div class="src">出典: ${srcA('impress','ats')}</div>
  </div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">競争環境の年表 — 「盛り上がり→競合出現」の実際<span class="tag real">実測</span></div>
  <div class="tl">${REAL.timeline.map(e=>`<div class="tle ${e.me?'':'riv'}"><div class="y">${esc(e.y)}${e.me?'':' <span class="pill" style="margin-left:6px;color:var(--bl);border-color:rgba(78,155,232,.45)">競合</span>'}</div><div class="t">${esc(e.t)} <small><a href="${REAL.srcs[e.src][1]}" target="_blank" rel="noopener">[出典]</a></small></div></div>`).join('')}</div>
  <div class="ibox is4" style="margin-top:12px"><h4>■ 読み解き</h4><p>実売・実需は右肩。ただし<mark>2012年の木更津出現以降、「関東で一番」の座標軸が「近さ×規模」に書き換わり</mark>、2025年に店舗数の看板も移った。<b>実勢が強いのに語られ方で負け始める</b>のが今の構図で、それを可視化するのが本ボードのAI計測系（現在サンプル）。</p></div>
 </div>`;
 return h+foot();
}

/* ================= V8 生活者の声 ================= */
function rV8(){
 const M=REAL.maps;
 const kt=(m,color)=>{
  const mxv=Math.max(...m.tags.map(t=>t[1]));
  return `<div class="card rv">
   <div class="ct"><a href="${m.url}" target="_blank" rel="noopener" style="color:inherit">${m.n}</a><span class="tag real">実測</span></div>
   <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
    <span class="starbig" style="color:${color}"><span data-cnt="${m.star}" data-dec="1">0</span></span>
    <span class="stars">★★★★☆</span>
    <span class="mono" style="color:var(--tx3);font-size:11px"><span data-cnt="${m.cnt}">0</span> 件</span>
   </div>
   <div style="margin-top:11px;display:grid;gap:7px">
    ${m.tags.map(t=>`<div style="display:grid;grid-template-columns:86px 1fr 44px;gap:8px;align-items:center">
      <span style="font-size:10.5px;color:var(--tx2);text-align:right">${esc(t[0])}</span>
      <span class="gbar"><i data-w="${(t[1]/mxv*100).toFixed(1)}" style="background:${color}"></i></span>
      <span class="mono" style="font-size:10.5px;text-align:right">${fmt(t[1])}</span></div>`).join('')}
   </div>
   <div class="sub2" style="margin-top:8px">クチコミ内キーワード件数（Googleマップ自動集計）</div>
  </div>`;};

 let h=`<div class="crumb rv"><h2>生活者の声<small>REAL VOICES</small></h2>
  <span class="chip up">Googleマップ実査（2026-09-01）</span>
  <button class="hbtn" onclick="help('voice')">?</button></div>`;

 h+=`<div class="g g3c" style="grid-template-columns:repeat(3,minmax(0,1fr))">${kt(M.gotemba,'#FF7A59')}${kt(M.kisarazu,'#4E9BE8')}${kt(M.karuizawa,'#B48CFF')}</div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">声から見える「語られ方の資産」<span class="tag real">実測</span></div>
  <div class="g g3c" style="grid-template-columns:repeat(3,minmax(0,1fr))">
   <div class="ibox is3" style="margin:0"><h4>■ 御殿場の声の核</h4><p><mark class="g">「富士山」1,314件</mark> — 2位以下（渋滞171・橋110）の8倍近い圧倒的な体験キーワード。クチコミ件数29,126件も3施設で最多。</p></div>
   <div class="ibox" style="margin:0"><h4>■ 競合の声の核</h4><p>木更津は<b>「フードコート」570件</b>と食・実用が核。軽井沢は<b>「芝生」「敷地」</b>の滞在体験。それぞれ語られる土俵が違う。</p></div>
   <div class="ibox is2" style="margin:0"><h4>■ ネガ密度の逆転</h4><p>「渋滞」言及率は御殿場0.6%（171/29,126）に対し<mark class="r">木更津1.8%（306/17,201）と約3倍</mark>。渋滞イメージは実は相手の方が濃い — AI回答でどちらに紐づくかが勝負。</p></div>
  </div>
 </div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1fr 1fr;margin-top:14px">`+
  REAL.quotes.map(q=>{const m=M[q.f];return `
  <div class="quote rv">
   <div class="qq">${esc(q.t)}</div>
   <div class="meta">
    <span class="pill ${q.s==='pos'?'pos':'neg'}">${q.s==='pos'?'ポジ':'ネガ'}</span>
    <span class="pill">${esc(q.th)}</span>
    <span class="pill fac">${m.n}</span>
    <span style="margin-left:auto"><a href="${m.url}" target="_blank" rel="noopener">${esc(q.w)}</a></span>
   </div>
  </div>`;}).join('')+
 `</div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">声の総括</div>
  <div class="ibox is3"><h4>■ だからどうする</h4><p>①富士山ビューは<b>クチコミ上すでに独占資産</b> — AI回答の引用元（旅行メディア・UGC）へこの文脈を供給し続ける ②駐車場・シャトルの運用ネガは<b>時間帯情報の一次発信</b>で打ち消す ③「渋滞は木更津の方が濃い」という実データは、関東文脈の比較で使える反証材料。今後はSNS言及とAI引用元のUGC率を加えて定点化する。</p></div>
  <div class="src">出典: ${srcA('gmap')} ／ 引用は各クチコミからの短い抜粋（リンク先で原文確認可）</div>
 </div>`;
 return h+foot();
}

/* ================= V9 KPI再設計 ================= */
function rV9(){
 let h=`<div class="crumb rv"><h2>KPI再設計<small>BEYOND PARKING COUNT</small></h2>
  <span class="chip cyt">提案骨子</span><button class="hbtn" onclick="help('kpi')">?</button></div>`;

 h+=`<div class="card hl rv"><div class="ct">出発点<span class="tag prop">提案</span></div>
  <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
   <div><div class="kpi" style="font-size:22px">現KPI = <span class="act">駐車台数</span></div>
   <div class="sub2" style="font-size:12px;margin-top:6px">来場ボリュームの代理値としては機能するが、<mark class="r">「来た後」（滞在・飲食・体験・記憶）と「来る前」（比較検討・AIでの語られ方）が丸ごと見えない</mark>。送客して終わりの構造から、体験と記憶までを計測対象に広げる。</div></div>
  </div>
 </div>`;

 const KN=(no,t,c,items,src)=>`<div class="knode" style="--kc:${c}"><div class="h"><span class="no">${no}</span>${t}</div><ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul><div class="dsrc">${src}</div></div>`;
 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">KPIツリー — 来場から記憶まで4段<span class="tag prop">提案</span></div>
  <div class="kwrapx">
   ${KN('01','来場','#FF7A59',['駐車台数（既存）','市観光交流客数 <b>1,538万人</b>','時間帯別の混雑相対値'],'源: 既存KPI／市統計／Maps混雑クロール')}
   <div class="karr">→</div>
   ${KN('02','滞在','#FFC24B',['平均滞在時間（現状 日帰り<b>3.6h</b>）','エリア回遊（West/East/Hill）','平日稼働（現状<b>66%</b>）'],'源: 市調査／Maps混雑の時間帯カーブ')}
   <div class="karr">→</div>
   ${KN('03','体験','#3DDC97',['飲食利用率・ランチ帯の伸び','ホテル・温泉の併用（宿泊<b>122万人</b>）','非セール期の来場動機'],'源: 周辺飲食店の混雑相対比較／GA×Affinity')}
   <div class="karr">→</div>
   ${KN('04','記憶・推奨','#22C7D6',['クチコミ量・評点（<b>★4.2 / 2.9万件</b>）','テーマ言及（富士山<b>1,314件</b>）','AI語られ方 G1–G4・第一想起'],'源: Maps定点／本ボードAI4面計測')}
  </div>
  <div class="sub2" style="margin-top:10px">個人ID単位の追跡はしない。公開データ＋自社データ＋AI計測の組み合わせで、<b>太字は今日時点で既に取れている実数</b>。</div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">計測手段マップ — 何が・いくらで・いつから<span class="tag prop">提案</span></div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>手段</th><th>分かること</th><th>コスト</th><th>着手</th><th>状態</th></tr></thead><tbody>
   <tr><td><b>AI4面計測</b>（本ボード）</td><td>語られ方G1–G4・勝敗テーマ・ペルソナ・引用元</td><td class="mono">$12–15/周</td><td>今週</td><td><span class="pill pos">R1準備完了</span></td></tr>
   <tr><td><b>Googleマップ クチコミ定点</b></td><td>評点・件数・テーマ言及の週次差分（競合込み）</td><td class="mono">ほぼ0</td><td>本日から</td><td><span class="pill pos">初回実査済み</span></td></tr>
   <tr><td><b>Maps混雑クローリング</b></td><td>時間帯別の混雑相対値・周辺飲食店との比較（滞在・食事の代理指標）</td><td class="mono">ほぼ0</td><td>2週間PoC</td><td><span class="pill">未着手</span></td></tr>
   <tr><td><b>Googleトレンド</b>（pytrends）</td><td>指名検索需要・都県別の地域差</td><td class="mono">0</td><td>今週</td><td><span class="pill pos">実装済み資産あり</span></td></tr>
   <tr><td><b>GA × Affinity</b></td><td>店舗ページ閲覧者の特性→出し分け・導線設計</td><td class="mono">0（要データ提供）</td><td>先方合意後</td><td><span class="pill">要アクセス権</span></td></tr>
   <tr><td>人流データ購入</td><td>実来場の精密計測</td><td class="mono dn">高額</td><td>—</td><td><span class="pill neg">上記で代替検証後に判断</span></td></tr>
  </tbody></table></div>
 </div>`;

 h+=`<div class="g g2c" style="grid-template-columns:1fr 1fr;margin-top:14px">
  <div class="card rv"><div class="ct">機会① 非セール期の訴求余地<span class="tag prop">提案</span></div>
   <div class="sub2" style="font-size:12px">平日稼働<b class="mono">66%</b>・日帰り滞在<b class="mono">3.6h</b>という実データは、<mark>「セール以外の来場理由」がまだ設計されていない</mark>ことを示す。セール期のクーポン型広告に対し、非セール期は<b>ランチ・温泉・富士山ビュー</b>の滞在訴求へ出し分ける。効果はMaps混雑カーブ（食事帯）とクチコミ・テーマ言及で観測できる。</div>
  </div>
  <div class="card rv"><div class="ct">機会② 引用される側への投資<span class="tag prop">提案</span></div>
   <div class="sub2" style="font-size:12px">AI回答は<mark>公式サイトより口コミ・外部記事を引用しやすい</mark>（比較質問では公式情報が根拠にならないため）。動画広告の完全否定ではなく、<b>タイアップ・外部メディア・UGC醸成への投資配分を見直す</b>のが論点。効果は本ボードの引用元ドメインランキングとG2/G3で週次確認する。</div>
  </div>
 </div>`;

 h+=`<div class="card rv" style="margin-top:14px"><div class="ct">進め方（3ステップ）</div>
  <div class="ibox is3"><h4>■ だからどうする</h4><p><b>Step1（今週）</b>: AI4面テスト計測1周（$12–15）＋クチコミ定点の自動化 — 実測値でこのボードのサンプルを置換。<b>Step2（2週間）</b>: Maps混雑クローリングPoCで滞在・食事の代理指標を追加。<b>Step3（合意後）</b>: GA×Affinity接続でKPIツリー4段を全点灯し、週次の定例をこのボードで回す。</p></div>
 </div>`;
 return h+foot();
}

/* ================= footer / init ================= */
function foot(){
 return `<div class="foot rv">出典（実データ）: ${srcA('ats','prtimes','plan','planR4','impress','wiki','wikik','odakyu','gmap')}<br>
 AI計測系（サンプル表示）の設計: DataForSEO AI Optimization API 4面・実測単価ベースの試算。デモ値をボード実数として扱いません — 取れない数値は「—」。<br>
 このページは閲覧ゲート実装前のデザインプレビューです（noindex）。© 御殿場GEOボード R0</div>`;
}
function init(){
 buildNav(); tickStart(); render();
 setTimeout(()=>{const sp=$('#splash');if(sp){sp.classList.add('off');setTimeout(()=>sp.remove(),600);}},1150);
 startFx();
}
/* ---- particles ---- */
function startFx(){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('#fx').remove();return;}
 const cv=$('#fx'),ctx=cv.getContext('2d');let W,H,ps=[];
 const resize=()=>{W=cv.width=innerWidth*devicePixelRatio;H=cv.height=innerHeight*devicePixelRatio;cv.style.width=innerWidth+'px';cv.style.height=innerHeight+'px';};
 resize();addEventListener('resize',resize);
 for(let i=0;i<46;i++)ps.push({x:Math.random(),y:Math.random(),r:(Math.random()*1.6+.5)*devicePixelRatio,s:Math.random()*.00022+.00007,tw:Math.random()*Math.PI*2,g:Math.random()<.28});
 let run=true;
 document.addEventListener('visibilitychange',()=>{run=!document.hidden;if(run)requestAnimationFrame(loop);});
 function loop(t){
  if(!run)return;
  ctx.clearRect(0,0,W,H);
  ps.forEach(p=>{
   p.y-=p.s;if(p.y<-.02){p.y=1.02;p.x=Math.random();}
   const a=(Math.sin(t/1400+p.tw)+1)/2*.5+.12;
   ctx.beginPath();ctx.arc(p.x*W,p.y*H,p.r,0,7);
   ctx.fillStyle=p.g?`rgba(255,194,75,${a})`:`rgba(158,187,228,${a*.8})`;
   ctx.fill();
  });
  requestAnimationFrame(loop);
 }
 requestAnimationFrame(loop);
}
init();
