/* =====================================================================
   グラフ描画エンジン（依存なしSVG）
   ===================================================================== */
const PALETTES={
  prism:["#F0A22E","#DE5C33","#7C1D1D","#8B44AC","#3F6FD1","#7FBEEA","#2E9B57","#C94F8A","#4C4C4C","#B8A22E"],
  vivid:["#1f6fd0","#e0603c","#2fa36b","#8258c8","#e8a51b","#3aa0d8","#d84a3f","#26a69a","#ec407a","#7e57c2"],
  cud:["#0072B2","#D55E00","#009E73","#CC79A7","#E69F00","#56B4E9","#F0E442","#000000"],
  nature:["#3C5488","#E64B35","#00A087","#4DBBD5","#F39B7F","#8491B4","#91D1C2","#DC0000"],
  gray:["#333333","#777777","#aaaaaa","#cccccc","#555555","#999999","#bbbbbb","#e0e0e0"],
  warm:["#c94f3d","#e08a2e","#d9b310","#8c6d31","#a63c3c","#e2725b","#b5651d","#7d4427"],
  cool:["#1f6fd0","#26a69a","#5c6bc0","#00838f","#3949ab","#0097a7","#7986cb","#4dd0e1"]
};
function gopt(g){
  const d={w:430,h:330,title:"",xlab:"",ylab:"",
    font:'Arial, "Helvetica Neue", Helvetica, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    fs:14,fsTitle:17,fsAxis:13,bold:true,ink:"#000000",
    xmin:"",xmax:"",ymin:"",ymax:"",xlog:false,ylog:false,ytickStep:"",xtickStep:"",
    frame:"L",gridY:false,gridX:false,tickOut:true,tickLen:7,axisWidth:2.6,tickWidth:2.4,
    err:"sd",errCap:10,errDir:"both",errWidth:2,
    showPoints:true,pointSize:8,jitter:true,pointStroke:true,
    barWidth:0.6,barStroke:1.6,barFill:true,barOpacity:1,barOutline:"black",
    lineWidth:2.6,connect:true,curve:false,
    showFit:true,showBand:false,showCI:false,
    legend:true,legendPos:"right",palette:"prism",
    autoBracket:true,brackets:[],bracketStyle:"star",
    meanLine:"mean",meanLineStyle:"solid",sortBars:"none",baseline:0,
    valueLabels:"none",barLayout:"interleaved",
    yTitleRotate:true,pieLabels:"pct",donut:0.55,atRisk:false,censorTicks:true,kmPct:true,
    violinWidth:0.85,violinQuartiles:true,boxWhisker:"tukey",stackPct:false,
    heatColors:"viridis",logBase:10,capRadius:0,dpi:3};
  return Object.assign(d,g.opts||{});
}
function palOf(o,i){const p=PALETTES[o.palette]||PALETTES.prism;return p[i%p.length];}
function inkOf(o){return o.ink||"#000000";}
function strokeOfBar(o,color){
  return o.barOutline==="none"?color:(o.barOutline==="color"?color:inkOf(o));
}
/* ---- 連続カラースケール ---- */
const VIRIDIS=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];
const BWR=[[5,48,97],[33,102,172],[67,147,195],[146,197,222],[209,229,240],[247,247,247],[253,219,199],[244,165,130],[214,96,77],[178,24,43],[103,0,31]];
const BLUES=[[247,251,255],[222,235,247],[198,219,239],[158,202,225],[107,174,214],[66,146,198],[33,113,181],[8,81,156],[8,48,107]];
const WARMS=[[255,245,235],[254,230,206],[253,208,162],[253,174,107],[253,141,60],[241,105,19],[217,72,1],[166,54,3],[127,39,4]];
const GRAYS=[[255,255,255],[240,240,240],[217,217,217],[189,189,189],[150,150,150],[115,115,115],[82,82,82],[37,37,37],[0,0,0]];
function rampColor(ramp,t){
  t=Math.max(0,Math.min(1,t));
  const n=ramp.length-1,f=t*n,i=Math.min(n-1,Math.floor(f)),r=f-i;
  const a=ramp[i],b=ramp[i+1];
  return "rgb("+Math.round(a[0]+(b[0]-a[0])*r)+","+Math.round(a[1]+(b[1]-a[1])*r)+","+Math.round(a[2]+(b[2]-a[2])*r)+")";
}
function heatRamp(o){
  return {viridis:VIRIDIS,bwr:BWR,blues:BLUES,warm:WARMS,gray:GRAYS}[o.heatColors]||VIRIDIS;
}
function niceNum(r,round){
  const e=Math.floor(Math.log10(r)),f=r/Math.pow(10,e);
  let nf;
  if(round)nf=f<1.5?1:f<3?2:f<7?5:10;
  else nf=f<=1?1:f<=2?2:f<=5?5:10;
  return nf*Math.pow(10,e);
}
function linTicks(lo,hi,n,step){
  if(hi<=lo)return [lo];
  if(step&&step>0){
    const out=[];
    const s0=Math.ceil(lo/step)*step;
    for(let v=s0;v<=hi+step*1e-9;v+=step)out.push(+v.toPrecision(12));
    return out;
  }
  const range=niceNum(hi-lo,false);
  const d=niceNum(range/(n-1),true);
  const gl=Math.floor(lo/d)*d,gh=Math.ceil(hi/d)*d;
  const out=[];
  for(let v=gl;v<=gh+d*1e-9;v+=d){
    const vv=+v.toPrecision(12);
    if(vv>=lo-d*1e-9&&vv<=hi+d*1e-9)out.push(vv);
  }
  return out;
}
function logTicks(lo,hi){
  const out=[],minors=[];
  const l0=Math.floor(Math.log10(lo)),l1=Math.ceil(Math.log10(hi));
  for(let e=l0;e<=l1;e++){
    const v=Math.pow(10,e);
    if(v>=lo*0.999&&v<=hi*1.001)out.push(v);
    for(let m=2;m<=9;m++){
      const mv=m*v;
      if(mv>=lo&&mv<=hi)minors.push(mv);
    }
  }
  return {major:out.length?out:[lo,hi],minor:minors};
}
function fmtTick(v){
  if(v===0)return "0";
  const a=Math.abs(v);
  if(a>=1e5||a<1e-3){
    const e=Math.floor(Math.log10(a));
    const m=v/Math.pow(10,e);
    return (Math.abs(m-1)<1e-9?"10":fmtNumShort(m)+"×10")+"<tspan baseline-shift=\"super\" font-size=\"75%\">"+e+"</tspan>";
  }
  if(Number.isInteger(v))return String(v);
  const dec=Math.max(0,Math.min(6,2-Math.floor(Math.log10(a))));
  return (+v.toFixed(dec)).toString();
}
function fmtNumShort(v){return (+v.toPrecision(3)).toString();}
function txtW(s,fs,bold){
  let w=0;
  for(const c of String(s).replace(/<[^>]+>/g,""))w+=/[ -~]/.test(c)?0.56:1;
  return w*fs*(bold?1.07:1);
}
function sym(shape,cx,cy,r,fill,stroke,sw){
  const s=(pts)=>'<polygon points="'+pts+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
  switch(shape){
    case "square":return '<rect x="'+(cx-r)+'" y="'+(cy-r)+'" width="'+2*r+'" height="'+2*r+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
    case "triangle":return s([cx+","+(cy-r*1.15),(cx-r)+","+(cy+r*0.75),(cx+r)+","+(cy+r*0.75)].join(" "));
    case "triangle-down":return s([cx+","+(cy+r*1.15),(cx-r)+","+(cy-r*0.75),(cx+r)+","+(cy-r*0.75)].join(" "));
    case "diamond":return s([cx+","+(cy-r*1.2),(cx+r*1.05)+","+cy,cx+","+(cy+r*1.2),(cx-r*1.05)+","+cy].join(" "));
    case "plus":return '<path d="M'+(cx-r)+' '+cy+'H'+(cx+r)+'M'+cx+' '+(cy-r)+'V'+(cy+r)+'" stroke="'+(fill==="none"?stroke:fill)+'" stroke-width="'+(sw+1.4)+'" fill="none"/>';
    case "cross":return '<path d="M'+(cx-r*0.8)+' '+(cy-r*0.8)+'L'+(cx+r*0.8)+' '+(cy+r*0.8)+'M'+(cx+r*0.8)+' '+(cy-r*0.8)+'L'+(cx-r*0.8)+' '+(cy+r*0.8)+'" stroke="'+(fill==="none"?stroke:fill)+'" stroke-width="'+(sw+1.4)+'" fill="none"/>';
    case "star":{
      let p="";
      for(let i=0;i<10;i++){
        const ang=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.48:r*1.15;
        p+=(cx+rr*Math.cos(ang))+","+(cy+rr*Math.sin(ang))+" ";
      }
      return s(p.trim());
    }
    case "hexagon":{
      let p="";
      for(let i=0;i<6;i++){const ang=-Math.PI/2+i*Math.PI/3;p+=(cx+r*1.08*Math.cos(ang))+","+(cy+r*1.08*Math.sin(ang))+" ";}
      return s(p.trim());
    }
    case "bar":return '<rect x="'+(cx-r*1.2)+'" y="'+(cy-sw*0.9)+'" width="'+2.4*r+'" height="'+Math.max(2,sw*1.8)+'" fill="'+(fill==="none"?stroke:fill)+'"/>';
    default:return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+sw+'"/>';
  }
}
function symFill(o,color){return o.barFill===false?"#ffffff":color;}
function symStroke(o,color){return o.pointStroke?inkOf(o):color;}
function tspanText(x,y,s,op){
  op=op||{};
  return '<text x="'+x+'" y="'+y+'"'+(op.anchor?' text-anchor="'+op.anchor+'"':"")
   +' font-size="'+(op.fs||12)+'"'+(op.bold===false?"":' font-weight="'+(op.weight||700)+'"')
   +(op.fill?' fill="'+op.fill+'"':' fill="#000000"')
   +(op.rot?' transform="rotate('+op.rot+' '+x+' '+y+')"':"")
   +(op.style?' style="'+op.style+'"':"")+">"+s+"</text>";
}
/* ---- プロット枠の生成（Prism風：太い黒軸・外向き目盛・太字ラベル） ---- */
function startPlot(o,xs,ys){
  const fs=o.fsAxis,fsT=o.fsTitle,ink=inkOf(o),bold=o.bold!==false;
  const aw=o.axisWidth,tw=o.tickWidth;
  let ytk=[];
  if(ys.log){const t=logTicks(ys.min,ys.max);ytk=t.major;ys._minor=t.minor;}
  else ytk=(ys.ticks&&ys.ticks.length>1)?ys.ticks:linTicks(ys.min,ys.max,6,+o.ytickStep||0);
  const yLabW=Math.max(...ytk.map(v=>txtW(fmtTick(v),fs,bold)),10);
  const mL=Math.round(yLabW+o.tickLen+8+(ys.title?o.fs+12:0));
  let xtk=[],xcats=null,rotX=0;
  if(xs.type==="cat"){
    xcats=xs.cats;
    const maxw=Math.max(...xcats.map(c=>txtW(c,fs,bold)),1);
    const slot=o.w/Math.max(1,xcats.length);
    if(maxw>slot*0.78)rotX=-45;
  }else{
    if(xs.log){const t=logTicks(xs.min,xs.max);xtk=t.major;xs._minor=t.minor;}
    else xtk=(xs.ticks&&xs.ticks.length>1)?xs.ticks:linTicks(xs.min,xs.max,6,+o.xtickStep||0);
  }
  let xLabH=fs+6;
  if(rotX)xLabH=Math.max(...xcats.map(c=>txtW(c,fs,bold)))*0.72+12;
  const mB=Math.round(xLabH+o.tickLen+(xs.title?o.fs+12:0)+8);
  const titleY=o.title?fsT+10:0;
  const mT=Math.round((o.title?fsT+20:10)+(o._headroom||0));
  const legendItems=ys.legend||[];
  const swW=Math.round(fs*1.15);
  let mR=16;
  if(o.legend&&legendItems.length&&o.legendPos==="right")
    mR=Math.round(Math.max(...legendItems.map(l=>txtW(l.name,fs,bold)))+swW*2.4+22);
  const plotW=o.w,plotH=o.h;
  const W=mL+plotW+mR,H=mT+plotH+mB;
  const px0=mL,px1=mL+plotW,py0=mT,py1=mT+plotH;
  const X=xs.type==="cat"
    ? (i)=>px0+plotW*(i+0.5)/xcats.length
    : (v)=>xs.log?px0+(Math.log10(v)-Math.log10(xs.min))/(Math.log10(xs.max)-Math.log10(xs.min))*plotW
                 :px0+(v-xs.min)/(xs.max-xs.min)*plotW;
  const Y=(v)=>ys.log?py1-(Math.log10(v)-Math.log10(ys.min))/(Math.log10(ys.max)-Math.log10(ys.min))*plotH
                     :py1-(v-ys.min)/(ys.max-ys.min)*plotH;
  const band=xs.type==="cat"?plotW/xcats.length:0;
  let pre="";
  if(o.gridY)pre+=ytk.map(v=>'<line x1="'+px0+'" y1="'+Y(v)+'" x2="'+px1+'" y2="'+Y(v)+'" stroke="#d7dde6" stroke-width="1"/>').join("");
  if(o.gridX&&xs.type!=="cat")pre+=xtk.map(v=>'<line x1="'+X(v)+'" y1="'+py0+'" x2="'+X(v)+'" y2="'+py1+'" stroke="#d7dde6" stroke-width="1"/>').join("");
  const tl=o.tickLen,dir=o.tickOut?1:-1;
  let post="";
  ytk.forEach(v=>{
    const y=Y(v);
    post+='<line x1="'+px0+'" y1="'+y+'" x2="'+(px0-tl*dir)+'" y2="'+y+'" stroke="'+ink+'" stroke-width="'+tw+'"/>';
    post+=tspanText(px0-tl*dir-5,y+fs*0.35,fmtTick(v),{anchor:"end",fs,bold,fill:ink});
  });
  if(ys._minor&&ys.log)ys._minor.forEach(v=>{
    post+='<line x1="'+px0+'" y1="'+Y(v)+'" x2="'+(px0-tl*0.55*dir)+'" y2="'+Y(v)+'" stroke="'+ink+'" stroke-width="'+(tw*0.7)+'"/>';
  });
  if(xs.type==="cat"){
    xcats.forEach((c,i)=>{
      if(c==="")return;
      const x=X(i);
      post+='<line x1="'+x+'" y1="'+py1+'" x2="'+x+'" y2="'+(py1+tl*dir)+'" stroke="'+ink+'" stroke-width="'+tw+'"/>';
      post+=rotX?tspanText(x+fs*0.25,py1+tl*dir+fs*0.9,esc(c),{anchor:"end",fs,bold,rot:rotX,fill:ink})
                :tspanText(x,py1+tl*dir+fs+2,esc(c),{anchor:"middle",fs,bold,fill:ink});
    });
  }else{
    xtk.forEach(v=>{
      const x=X(v);
      post+='<line x1="'+x+'" y1="'+py1+'" x2="'+x+'" y2="'+(py1+tl*dir)+'" stroke="'+ink+'" stroke-width="'+tw+'"/>';
      post+=tspanText(x,py1+tl*dir+fs+2,fmtTick(v),{anchor:"middle",fs,bold,fill:ink});
    });
    if(xs._minor&&xs.log)xs._minor.forEach(v=>{
      post+='<line x1="'+X(v)+'" y1="'+py1+'" x2="'+X(v)+'" y2="'+(py1+tl*0.55*dir)+'" stroke="'+ink+'" stroke-width="'+(tw*0.7)+'"/>';
    });
  }
  // 軸線（Prism流に目盛の範囲だけ引く）
  const yA0=Y(ytk[ytk.length-1]),yA1=Y(ytk[0]);
  const xA0=xs.type==="cat"?px0:X(xtk[0]),xA1=xs.type==="cat"?px1:X(xtk[xtk.length-1]);
  if(o.frame==="full")post+='<rect x="'+px0+'" y="'+py0+'" width="'+plotW+'" height="'+plotH+'" fill="none" stroke="'+ink+'" stroke-width="'+aw+'"/>';
  else if(o.frame!=="none"){
    post+='<line x1="'+px0+'" y1="'+yA0+'" x2="'+px0+'" y2="'+yA1+'" stroke="'+ink+'" stroke-width="'+aw+'" stroke-linecap="square"/>'
      +'<line x1="'+xA0+'" y1="'+py1+'" x2="'+xA1+'" y2="'+py1+'" stroke="'+ink+'" stroke-width="'+aw+'" stroke-linecap="square"/>';
  }
  if(ys.title)post+=tspanText(o.fs*0.9,(py0+py1)/2,esc(ys.title),{anchor:"middle",fs:o.fs,bold,rot:-90,fill:ink});
  if(xs.title)post+=tspanText((px0+px1)/2,H-6,esc(xs.title),{anchor:"middle",fs:o.fs,bold,fill:ink});
  if(o.title)post+=tspanText((px0+px1)/2,titleY,esc(o.title),{anchor:"middle",fs:fsT,bold,fill:ink});
  if(o.legend&&legendItems.length&&o.legendPos!=="none"){
    const gap=fs+11;
    if(o.legendPos==="right"){
      let ly=py0+fs;
      legendItems.forEach(l=>{
        post+=legendMark(o,l,px1+14,ly-fs*0.35,swW);
        post+=tspanText(px1+14+swW*2.1,ly,esc(l.name),{fs,bold,fill:ink});
        ly+=gap;
      });
    }else{
      let lx=px0;
      const ly=py0-8;
      legendItems.forEach(l=>{
        post+=legendMark(o,l,lx,ly-fs*0.35,swW);
        post+=tspanText(lx+swW*2.1,ly,esc(l.name),{fs,bold,fill:ink});
        lx+=txtW(l.name,fs,bold)+swW*2.6+16;
      });
    }
  }
  return {W,H,px0,px1,py0,py1,X,Y,band,pre,post,ytk,xtk,fs,ink,bold,rotX,
    clip:'<clipPath id="cp"><rect x="'+(px0-3)+'" y="'+(py0-3)+'" width="'+(plotW+6)+'" height="'+(plotH+6)+'"/></clipPath>'};
}
function legendMark(o,l,x,y,sw){
  const ink=inkOf(o);
  if(l.line&&!l.shape){
    return '<line x1="'+x+'" y1="'+y+'" x2="'+(x+sw*1.7)+'" y2="'+y+'" stroke="'+l.color+'" stroke-width="'+o.lineWidth+'"/>'
      +'<line x1="'+(x+sw*0.85)+'" y1="'+(y-sw*0.45)+'" x2="'+(x+sw*0.85)+'" y2="'+(y+sw*0.45)+'" stroke="'+l.color+'" stroke-width="'+(o.lineWidth*0.8)+'"/>';
  }
  if(l.shape){
    let s='<line x1="'+x+'" y1="'+y+'" x2="'+(x+sw*1.7)+'" y2="'+y+'" stroke="'+l.color+'" stroke-width="'+o.lineWidth+'"/>';
    s+=sym(l.shape,x+sw*0.85,y,o.pointSize/2,l.fill||l.color,o.pointStroke?ink:l.color,1.2);
    return s;
  }
  return '<rect x="'+x+'" y="'+(y-sw*0.55)+'" width="'+sw*1.35+'" height="'+sw*1.1+'" fill="'+l.color
    +'" fill-opacity="'+(l.opacity||1)+'" stroke="'+ink+'" stroke-width="1.2"/>';
}
function wrapSVG(o,P,body,overlay){
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+P.W+'" height="'+P.H+'" viewBox="0 0 '+P.W+' '+P.H+'" '
    +'font-family="'+o.font+'" style="background:#fff">'
    +"<defs>"+P.clip+"</defs>"
    +'<rect width="'+P.W+'" height="'+P.H+'" fill="#fff"/>'
    +P.pre+'<g clip-path="url(#cp)">'+body+"</g>"+P.post+(overlay||"")+"</svg>";
}
/* ---- 範囲の自動決定 ---- */
function niceRange(lo,hi,n,step){
  if(!(hi>lo))return [lo,hi];
  let d;
  if(step&&step>0)d=step;
  else d=niceNum(niceNum(hi-lo,false)/((n||6)-1),true);
  if(!(d>0))return [lo,hi];
  const gl=Math.floor(lo/d+1e-9)*d,gh=Math.ceil(hi/d-1e-9)*d;
  return [+gl.toPrecision(12),+gh.toPrecision(12)];
}
function autoRange(vals,o,axis){
  const has=(x)=>x!==""&&x!==null&&x!==undefined&&isFinite(+x);
  let lo=Math.min(...vals),hi=Math.max(...vals);
  if(!isFinite(lo)||!isFinite(hi)){lo=0;hi=1;}
  if(lo===hi){const p=Math.abs(lo)*0.1+1;lo-=p;hi+=p;}
  const log=o[axis+"log"];
  let ticks=null;
  if(log){
    const pos=vals.filter(v=>v>0);
    lo=pos.length?Math.min(...pos):1;hi=pos.length?Math.max(...pos):10;
    lo=Math.pow(10,Math.floor(Math.log10(lo)));
    hi=Math.pow(10,Math.ceil(Math.log10(hi)));
  }else{
    const span=(hi-lo)||Math.abs(hi)||1;
    const step=+o[axis+"tickStep"];
    const d=(step>0)?step:niceNum(niceNum(span*1.12,false)/5,true);
    let gl=Math.floor(lo/d+1e-9)*d,gh=Math.ceil(hi/d-1e-9)*d;
    if(!(gh>gl))gh=gl+d;
    ticks=[];
    for(let v=gl;v<=gh+d*1e-9;v+=d)ticks.push(+v.toPrecision(12));
    lo=ticks[0];hi=ticks[ticks.length-1];
  }
  const min=has(o[axis+"min"])?+o[axis+"min"]:lo;
  const max=has(o[axis+"max"])?+o[axis+"max"]:hi;
  return {min,max,log:!!log,ticks:(!log&&min===lo&&max===hi)?ticks:null};
}
function jit(i,n,band,on,seed){
  if(!on||n<=1)return 0;
  const r=mulberry32(seed*7919+i*104729)();
  return (r-0.5)*Math.min(band*0.5,18);
}
/* ---- データ取り出しヘルパ ---- */
function colData(sh,o){
  const arr=sh.groups.map((g,i)=>{
    const v=colValues(sh,i);
    return {i,name:g.name||("列"+(i+1)),color:g.color||palOf(o,i),symbol:g.symbol||"circle",v,d:v.length?describeFull(v):null};
  }).filter(s=>s.v.length);
  if(o.sortBars==="asc")arr.sort((a,b)=>centerOf(a.d,o)-centerOf(b.d,o));
  else if(o.sortBars==="desc")arr.sort((a,b)=>centerOf(b.d,o)-centerOf(a.d,o));
  return arr;
}
function errLoHi(d,o){
  if(!d)return [NaN,NaN];
  const c=o.meanLine==="median"?d.median:d.mean;
  switch(o.err){
    case "sd":return [c-d.sd,c+d.sd];
    case "sem":return [c-d.se,c+d.se];
    case "ci":return [d.ciLo,d.ciHi];
    case "range":return [d.min,d.max];
    case "iqr":return [d.q1,d.q3];
    default:return [c,c];
  }
}
function centerOf(d,o){return o.meanLine==="median"?d.median:d.mean;}
function errBarSvg(x,c,lo,hi,o,color){
  if(o.err==="none"||!isFinite(lo))return "";
  const cap=o.errCap/2,w=o.errWidth;
  let s="";
  const up=o.errDir!=="down",dn=o.errDir!=="up";
  if(up)s+='<line x1="'+x+'" y1="'+c+'" x2="'+x+'" y2="'+hi+'" stroke="'+color+'" stroke-width="'+w+'"/>'
    +'<line x1="'+(x-cap)+'" y1="'+hi+'" x2="'+(x+cap)+'" y2="'+hi+'" stroke="'+color+'" stroke-width="'+w+'"/>';
  if(dn)s+='<line x1="'+x+'" y1="'+c+'" x2="'+x+'" y2="'+lo+'" stroke="'+color+'" stroke-width="'+w+'"/>'
    +'<line x1="'+(x-cap)+'" y1="'+lo+'" x2="'+(x+cap)+'" y2="'+lo+'" stroke="'+color+'" stroke-width="'+w+'"/>';
  return s;
}
function meanLineSvg(o,x1,x2,y,color){
  const dash=o.meanLineStyle==="dash"?' stroke-dasharray="7 5"':"";
  return '<line x1="'+x1+'" y1="'+y+'" x2="'+x2+'" y2="'+y+'" stroke="'+(color||inkOf(o))+'" stroke-width="'+(o.errWidth+0.8)+'"'+dash+'/>';
}
function safeMin(){
  const v=[].slice.call(arguments).filter(x=>isFinite(x));
  return v.length?Math.min.apply(null,v):NaN;
}
function valueLabel(o,x,y,d,n){
  if(o.valueLabels==="none"||!d||!isFinite(y))return "";
  const t=o.valueLabels==="n"?("n = "+n):fmtNumShort(o.meanLine==="median"?d.median:d.mean);
  return tspanText(x,y-6,t,{anchor:"middle",fs:o.fsAxis*0.95,bold:o.bold!==false,fill:inkOf(o)});
}
function kde(v,lo,hi,n){
  const s=sd(v)||1,iqrv=quantile(v,0.75)-quantile(v,0.25);
  const h=0.9*Math.min(s,iqrv/1.34||s)*Math.pow(v.length,-0.2)||1;
  const out=[];
  for(let i=0;i<=n;i++){
    const x=lo+(hi-lo)*i/n;
    let d=0;
    for(const p of v)d+=Math.exp(-0.5*Math.pow((x-p)/h,2));
    out.push([x,d/(v.length*h*Math.sqrt(2*Math.PI))]);
  }
  return out;
}
/* ---- 有意差ブラケット ---- */
function pShort(p){
  if(p===null||p===undefined||!isFinite(p))return "";
  if(p<0.0001)return "<0.0001";
  return p<0.001?String(+p.toPrecision(2)):p.toFixed(4);
}
function bracketSvg(P,o,items,tops,ymaxPix){
  if(!items||!items.length)return "";
  let s="";
  const gap=Math.max(16,o.fs*1.5);
  let level=0;
  const used=[];
  items.forEach(b=>{
    if(b.i===undefined||b.j===undefined)return;
    const x1=P.X(b.i),x2=P.X(b.j);
    const lo=Math.min(x1,x2),hi=Math.max(x1,x2);
    let base=Math.min(tops[b.i]!==undefined?tops[b.i]:P.py1,tops[b.j]!==undefined?tops[b.j]:P.py1);
    for(let k=Math.min(b.i,b.j);k<=Math.max(b.i,b.j);k++)if(tops[k]!==undefined)base=Math.min(base,tops[k]);
    let y=base-gap;
    let guard=0;
    while(used.some(u=>!(u.hi<lo-6||u.lo>hi+6)&&Math.abs(u.y-y)<gap*0.85)&&guard++<20)y-=gap;
    used.push({lo,hi,y});
    const label=o.bracketStyle==="p"?("P "+(b.p<0.0001?"< 0.0001":"= "+pShort(b.p)))
      :o.bracketStyle==="num"?pShort(b.p):(b.star||star(b.p));
    if(o.bracketStyle==="starOnly"&&label==="ns")return;
    const tick=6;
    s+='<path d="M'+lo+' '+(y+tick)+'V'+y+'H'+hi+'V'+(y+tick)+'" fill="none" stroke="'+inkOf(o)+'" stroke-width="'+(o.errWidth-0.2)+'"/>';
    s+=tspanText((lo+hi)/2,y-4,esc(label),{anchor:"middle",fs:/^[*]+$/.test(label)?o.fs*1.35:o.fs,bold:true,fill:inkOf(o)});
    for(let k=Math.min(b.i,b.j);k<=Math.max(b.i,b.j);k++)if(tops[k]!==undefined)tops[k]=Math.min(tops[k],y-4);
  });
  return s;
}
function prepBrackets(g,sh,o,names){
  const list=(o.autoBracket?autoBrackets(g,sh,names):[]).concat(o.brackets||[]);
  o._headroom=list.length?Math.round(list.length*Math.max(16,o.fs*1.5)+o.fs*1.6+(o.title?o.fsTitle*1.1:0)):0;
  return list;
}
function autoBrackets(g,sh,names){
  const out=[];
  ["ttest2","ttestp","anova1","rm1"].forEach(at=>{
    const d=analysisData(sh.id,at);
    if(d&&d.comparisons)d.comparisons.forEach(c=>{
      let i=c.a!==undefined?names.indexOf(c.a):c.i;
      let j=c.b!==undefined?names.indexOf(c.b):c.j;
      if(i===undefined||i<0)i=c.i;
      if(j===undefined||j<0)j=c.j;
      if(i>=0&&j>=0&&i!==undefined&&j!==undefined)out.push({i,j,p:c.p,star:c.star});
    });
  });
  return out;
}
/* =====================================================================
   グラフの種類
   ===================================================================== */
const GRAPHTYPES={};
/* ---------- 縦列（column）系 ---------- */
GRAPHTYPES.col_scatter={name:"散布ドットプロット",cat:"縦列",for:["column","parts","multivar","xy","grouped"],
  desc:"1点1データを表示し、平均±SDを重ねます。n が小さい実験の標準的な描き方。",
  draw:(g,sh)=>{
    const o=gopt(g),S=colData(sh,o);
    if(!S.length)return emptySVG();
    const br=prepBrackets(g,sh,o,S.map(s=>s.name));
    const all=S.flatMap(s=>s.v).concat(S.flatMap(s=>errLoHi(s.d,o)));
    const ys=autoRange(all.filter(isFinite),o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    const P=startPlot(o,{type:"cat",cats:S.map(s=>s.name),title:o.xlab||""},ys);
    let body="";
    const tops={};
    S.forEach((s,idx)=>{
      const x=P.X(idx);
      const c=centerOf(s.d,o),[lo,hi]=errLoHi(s.d,o);
      s.v.forEach((v,k)=>{
        const jx=x+jit(k,s.v.length,P.band*0.6,o.jitter,idx+1);
        body+=sym(s.symbol,jx,P.Y(v),o.pointSize/2,symFill(o,s.color),symStroke(o,s.color),1.3);
      });
      body+=errBarSvg(x,P.Y(c),P.Y(lo),P.Y(hi),o,inkOf(o));
      if(o.meanLine!=="none")body+=meanLineSvg(o,x-P.band*0.26,x+P.band*0.26,P.Y(c));
      const topS=safeMin(P.Y(hi),P.Y(Math.max(...s.v)),P.Y(c));
      body+=valueLabel(o,x,topS,s.d,s.v.length);
      tops[idx]=topS;
    });
    return wrapSVG(o,P,body,bracketSvg(P,o,br,tops));
  }};
GRAPHTYPES.col_bar={name:"棒グラフ（平均±エラーバー）",cat:"縦列",for:["column","parts","multivar","xy","grouped"],
  desc:"平均値の棒とエラーバー。個々の点を重ねることもできます。",
  draw:(g,sh)=>{
    const o=gopt(g),S=colData(sh,o);
    if(!S.length)return emptySVG();
    const br=prepBrackets(g,sh,o,S.map(s=>s.name));
    const all=S.flatMap(s=>errLoHi(s.d,o)).concat(S.map(s=>centerOf(s.d,o)),[o.baseline]);
    if(o.showPoints)S.forEach(s=>all.push(...s.v));
    const ys=autoRange(all.filter(isFinite),o,"y");
    if(!o.ylog&&ys.min>0&&o.ymin==="")ys.min=0;
    ys.title=o.ylab||sh.yTitle||"";
    const P=startPlot(o,{type:"cat",cats:S.map(s=>s.name),title:o.xlab||""},ys);
    let body="";const tops={};
    const bw=P.band*o.barWidth;
    S.forEach((s,idx)=>{
      const x=P.X(idx),c=centerOf(s.d,o),[lo,hi]=errLoHi(s.d,o);
      const y0=P.Y(Math.max(ys.min,o.baseline||ys.min)),y1=P.Y(c);
      body+='<rect x="'+(x-bw/2)+'" y="'+Math.min(y0,y1)+'" width="'+bw+'" height="'+Math.abs(y0-y1)
        +'" fill="'+(o.barFill?s.color:"#fff")+'" fill-opacity="'+o.barOpacity+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+o.barStroke+'"/>';
      body+=errBarSvg(x,y1,P.Y(lo),P.Y(hi),o,inkOf(o));
      if(o.showPoints)s.v.forEach((v,k)=>{
        const jx=x+jit(k,s.v.length,bw*0.7,o.jitter,idx+3);
        body+=sym(s.symbol,jx,P.Y(v),o.pointSize/2.4,"#ffffff",inkOf(o),1.2);
      });
      const topB=safeMin(P.Y(hi),y1,o.showPoints?P.Y(Math.max(...s.v)):NaN);
      body+=valueLabel(o,x,topB,s.d,s.v.length);
      tops[idx]=topB-(o.valueLabels!=="none"?o.fsAxis*1.2:0);
    });
    return wrapSVG(o,P,body,bracketSvg(P,o,br,tops));
  }};
GRAPHTYPES.col_box={name:"箱ひげ図",cat:"縦列",for:["column","parts","multivar","xy","grouped"],
  desc:"中央値・四分位・ひげ。分布の要約に。外れ値も表示できます。",
  draw:(g,sh)=>{
    const o=gopt(g),S=colData(sh,o);
    if(!S.length)return emptySVG();
    const br=prepBrackets(g,sh,o,S.map(s=>s.name));
    const ys=autoRange(S.flatMap(s=>s.v),o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    const P=startPlot(o,{type:"cat",cats:S.map(s=>s.name),title:o.xlab||""},ys);
    let body="";const tops={};
    const bw=P.band*o.barWidth;
    S.forEach((s,idx)=>{
      const x=P.X(idx),d=s.d;
      const iqr=d.q3-d.q1;
      let wLo,wHi,outs=[];
      if(o.boxWhisker==="minmax"){wLo=d.min;wHi=d.max;}
      else if(o.boxWhisker==="p1090"){wLo=quantile(s.v,0.1);wHi=quantile(s.v,0.9);outs=s.v.filter(v=>v<wLo||v>wHi);}
      else{
        wLo=Math.min(...s.v.filter(v=>v>=d.q1-1.5*iqr));wHi=Math.max(...s.v.filter(v=>v<=d.q3+1.5*iqr));
        outs=s.v.filter(v=>v<wLo||v>wHi);
      }
      const bs=strokeOfBar(o,s.color);
      body+='<rect x="'+(x-bw/2)+'" y="'+P.Y(d.q3)+'" width="'+bw+'" height="'+(P.Y(d.q1)-P.Y(d.q3))
        +'" fill="'+(o.barFill?s.color:"#fff")+'" fill-opacity="'+(o.barFill?0.55:1)+'" stroke="'+bs+'" stroke-width="'+o.barStroke+'"/>';
      body+='<line x1="'+(x-bw/2)+'" y1="'+P.Y(d.median)+'" x2="'+(x+bw/2)+'" y2="'+P.Y(d.median)+'" stroke="'+bs+'" stroke-width="'+(o.barStroke+1.2)+'"/>';
      body+='<line x1="'+x+'" y1="'+P.Y(d.q3)+'" x2="'+x+'" y2="'+P.Y(wHi)+'" stroke="'+bs+'" stroke-width="'+o.barStroke+'"/>';
      body+='<line x1="'+x+'" y1="'+P.Y(d.q1)+'" x2="'+x+'" y2="'+P.Y(wLo)+'" stroke="'+bs+'" stroke-width="'+o.barStroke+'"/>';
      body+='<line x1="'+(x-bw*0.3)+'" y1="'+P.Y(wHi)+'" x2="'+(x+bw*0.3)+'" y2="'+P.Y(wHi)+'" stroke="'+bs+'" stroke-width="'+o.barStroke+'"/>';
      body+='<line x1="'+(x-bw*0.3)+'" y1="'+P.Y(wLo)+'" x2="'+(x+bw*0.3)+'" y2="'+P.Y(wLo)+'" stroke="'+bs+'" stroke-width="'+o.barStroke+'"/>';
      if(o.meanLine==="mean")body+=sym("plus",x,P.Y(d.mean),4.5,inkOf(o),inkOf(o),1);
      if(o.showPoints)s.v.forEach((v,k)=>{
        const jx=x+jit(k,s.v.length,bw*0.6,o.jitter,idx+5);
        body+=sym(s.symbol,jx,P.Y(v),o.pointSize/2.6,"#ffffff",inkOf(o),1.1);
      });
      else outs.forEach(v=>body+=sym("circle",x,P.Y(v),o.pointSize/2.6,"#fff",inkOf(o),1.2));
      tops[idx]=P.Y(Math.max(wHi,...(o.showPoints?s.v:outs.concat([wHi]))));
    });
    return wrapSVG(o,P,body,bracketSvg(P,o,br,tops));
  }};
GRAPHTYPES.col_violin={name:"バイオリンプロット",cat:"縦列",for:["column","parts","multivar","xy","grouped"],
  desc:"分布の形（密度）を左右対称に描きます。n が多いデータに。",
  draw:(g,sh)=>{
    const o=gopt(g),S=colData(sh,o);
    if(!S.length)return emptySVG();
    const br=prepBrackets(g,sh,o,S.map(s=>s.name));
    const ys=autoRange(S.flatMap(s=>s.v),o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    const P=startPlot(o,{type:"cat",cats:S.map(s=>s.name),title:o.xlab||""},ys);
    let body="";const tops={};
    const bw=P.band*o.violinWidth;
    S.forEach((s,idx)=>{
      const x=P.X(idx),d=s.d;
      if(s.v.length<3){tops[idx]=P.Y(d.max);return;}
      const dens=kde(s.v,Math.max(ys.min,d.min-(d.max-d.min)*0.15),Math.min(ys.max,d.max+(d.max-d.min)*0.15),64);
      const mx=Math.max(...dens.map(p=>p[1]))||1;
      const left=dens.map(p=>(x-p[1]/mx*bw/2)+","+P.Y(p[0]));
      const right=dens.slice().reverse().map(p=>(x+p[1]/mx*bw/2)+","+P.Y(p[0]));
      body+='<polygon points="'+left.concat(right).join(" ")+'" fill="'+(o.barFill?s.color:"#fff")+'" fill-opacity="'+(o.barFill?0.55:1)+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+o.barStroke+'"/>';
      if(o.violinQuartiles){
        const hw=bw*0.34;
        body+='<line x1="'+(x-hw)+'" y1="'+P.Y(d.median)+'" x2="'+(x+hw)+'" y2="'+P.Y(d.median)+'" stroke="'+inkOf(o)+'" stroke-width="'+(o.barStroke+0.6)+'" stroke-dasharray="6 4"/>';
        body+='<line x1="'+(x-hw*0.8)+'" y1="'+P.Y(d.q1)+'" x2="'+(x+hw*0.8)+'" y2="'+P.Y(d.q1)+'" stroke="'+inkOf(o)+'" stroke-width="'+o.barStroke+'" stroke-dasharray="4 4"/>';
        body+='<line x1="'+(x-hw*0.8)+'" y1="'+P.Y(d.q3)+'" x2="'+(x+hw*0.8)+'" y2="'+P.Y(d.q3)+'" stroke="'+inkOf(o)+'" stroke-width="'+o.barStroke+'" stroke-dasharray="4 4"/>';
      }
      if(o.showPoints)s.v.forEach((v,k)=>{
        body+=sym(s.symbol,x+jit(k,s.v.length,bw*0.5,true,idx+9),P.Y(v),o.pointSize/3,symFill(o,s.color),symStroke(o,s.color),0.9);
      });
      tops[idx]=P.Y(d.max);
    });
    return wrapSVG(o,P,body,bracketSvg(P,o,br,tops));
  }};
GRAPHTYPES.col_float={name:"フローティングバー（範囲）",cat:"縦列",for:["column","parts","multivar"],
  desc:"最小値〜最大値の帯と平均線。範囲を強調したいときに。",
  draw:(g,sh)=>{
    const o=gopt(g),S=colData(sh,o);
    if(!S.length)return emptySVG();
    const br=prepBrackets(g,sh,o,S.map(s=>s.name));
    const ys=autoRange(S.flatMap(s=>s.v),o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    const P=startPlot(o,{type:"cat",cats:S.map(s=>s.name),title:o.xlab||""},ys);
    let body="";const tops={};
    const bw=P.band*o.barWidth;
    S.forEach((s,idx)=>{
      const x=P.X(idx),d=s.d;
      body+='<rect x="'+(x-bw/2)+'" y="'+P.Y(d.max)+'" width="'+bw+'" height="'+(P.Y(d.min)-P.Y(d.max))
        +'" fill="'+s.color+'" fill-opacity="0.5" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+o.barStroke+'"/>';
      body+=meanLineSvg(o,x-bw/2,x+bw/2,P.Y(centerOf(d,o)));
      tops[idx]=P.Y(d.max);
    });
    return wrapSVG(o,P,body,bracketSvg(P,o,br,tops));
  }};
GRAPHTYPES.col_beforeafter={name:"前後プロット（対応線）",cat:"縦列",for:["column","multivar","grouped"],
  desc:"同一被験者を線で結び、前後の変化を示します。対応のある検定とセットで。",
  draw:(g,sh)=>{
    const o=gopt(g),S=colData(sh,o);
    if(S.length<2)return emptySVG("2列以上のデータが必要です");
    const br=prepBrackets(g,sh,o,S.map(s=>s.name));
    const ys=autoRange(S.flatMap(s=>s.v),o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    const P=startPlot(o,{type:"cat",cats:S.map(s=>s.name),title:o.xlab||""},ys);
    let body="";const tops={};
    const nR=usedRows(sh);
    for(let r=0;r<nR;r++){
      const pts=[];
      S.forEach((s,idx)=>{
        const v=cellNum(sh,r,s.i,0);
        if(!isNaN(v))pts.push([P.X(idx),P.Y(v)]);
      });
      if(pts.length>1){
        const up=pts[pts.length-1][1]<pts[0][1];
        body+='<polyline points="'+pts.map(p=>p[0]+","+p[1]).join(" ")+'" fill="none" stroke="'+(o.palette==="gray"?"#888":(up?"#1f6fd0":"#e0603c"))+'" stroke-width="1.2" opacity="0.75"/>';
      }
      pts.forEach((p,idx)=>{body+=sym(S[idx].symbol,p[0],p[1],o.pointSize/2.4,symFill(o,S[idx].color),symStroke(o,S[idx].color),1.4);});
    }
    S.forEach((s,idx)=>{
      const x=P.X(idx),c=centerOf(s.d,o),[lo,hi]=errLoHi(s.d,o);
      if(o.meanLine!=="none"){
        body+=meanLineSvg(o,x-P.band*0.24,x+P.band*0.24,P.Y(c));
        body+=errBarSvg(x,P.Y(c),P.Y(lo),P.Y(hi),o,inkOf(o));
      }
      tops[idx]=P.Y(Math.max(...s.v));
    });
    return wrapSVG(o,P,body,bracketSvg(P,o,br,tops));
  }};
GRAPHTYPES.col_hist={name:"ヒストグラム（度数分布）",cat:"縦列",for:["column","multivar","xy","parts"],
  desc:"データの分布を階級ごとの度数で表示します。",
  draw:(g,sh)=>{
    const o=gopt(g),S=colData(sh,o);
    if(!S.length)return emptySVG();
    const all=S.flatMap(s=>s.v);
    const nb=Math.max(5,Math.min(30,Math.ceil(Math.sqrt(all.length))));
    const mn=Math.min(...all),mx=Math.max(...all),w=(mx-mn)/nb||1;
    const hists=S.map(s=>{
      const c=new Array(nb).fill(0);
      s.v.forEach(v=>{const b=Math.min(nb-1,Math.floor((v-mn)/w));c[b]++;});
      return c;
    });
    const ys=autoRange([0,Math.max(...hists.flat())*1.1],o,"y");
    ys.min=0;ys.title=o.ylab||"度数";
    ys.legend=S.map(s=>({name:s.name,color:s.color}));
    const P=startPlot(o,{type:"num",min:mn,max:mx,log:false,ticks:null,title:o.xlab||sh.yTitle||"値"},ys);
    let body="";
    hists.forEach((h,si)=>{
      h.forEach((cnt,b)=>{
        const x0=P.X(mn+b*w),x1=P.X(mn+(b+1)*w);
        const bw=(x1-x0)/hists.length;
        body+='<rect x="'+(x0+bw*si)+'" y="'+P.Y(cnt)+'" width="'+Math.max(1,bw-0.5)+'" height="'+(P.Y(0)-P.Y(cnt))
          +'" fill="'+S[si].color+'" fill-opacity="'+(hists.length>1?0.6:0.85)+'" stroke="'+S[si].color+'" stroke-width="0.8"/>';
      });
    });
    return wrapSVG(o,P,body);
  }};
function emptySVG(msg){
  return '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220" font-family="sans-serif">'
   +'<rect width="420" height="220" fill="#fff"/>'
   +'<text x="210" y="110" text-anchor="middle" fill="#7b8794" font-size="13">'+esc(msg||"表示できるデータがありません")+"</text></svg>";
}
/* ---------- XY 系 ---------- */
function fitCurves(sh){
  const out=[];
  ["lin","nonlin","smooth"].forEach(at=>{
    const d=analysisData(sh.id,at);
    if(d&&d.fits)out.push(...d.fits);
  });
  return out;
}
function drawFits(sh,P,o,xs){
  let s="";
  fitCurves(sh).forEach(f=>{
    const g=sh.groups[f.g]||{color:"#888"};
    const col=g.color||"#888";
    const x0=o.xmin!==""?Math.max(f.xmin,+o.xmin):f.xmin;
    const x1=o.xmax!==""?Math.min(f.xmax,+o.xmax):f.xmax;
    if(f.type==="line"){
      const pts=[[x0,f.intercept+f.slope*x0],[x1,f.intercept+f.slope*x1]];
      s+='<polyline points="'+pts.map(p=>P.X(p[0])+","+P.Y(p[1])).join(" ")+'" fill="none" stroke="'+col+'" stroke-width="'+o.lineWidth+'"/>';
      if(o.showBand&&f.f&&f.band!=="none"){
        const up=[],dn=[];
        for(let i=0;i<=60;i++){
          const xv=x0+(x1-x0)*i/60;
          const yv=f.intercept+f.slope*xv;
          const h=f.f.band(xv,f.band==="pi");
          up.push(P.X(xv)+","+P.Y(yv+h));dn.push(P.X(xv)+","+P.Y(yv-h));
        }
        s+='<polygon points="'+up.concat(dn.reverse()).join(" ")+'" fill="'+col+'" fill-opacity="0.12" stroke="none"/>';
      }
    }else if(f.type==="curve"){
      const pts=[];
      for(let i=0;i<=200;i++){
        const xv=xs.log?Math.pow(10,Math.log10(x0)+(Math.log10(x1)-Math.log10(x0))*i/200):x0+(x1-x0)*i/200;
        const yv=f.fn(f.params,xv);
        if(isFinite(yv))pts.push(P.X(xv)+","+P.Y(yv));
      }
      s+='<polyline points="'+pts.join(" ")+'" fill="none" stroke="'+col+'" stroke-width="'+o.lineWidth+'"/>';
      if(f.outliers&&f.outliers.length)f.outliers.forEach(pt=>{
        s+=sym("cross",P.X(pt[0]),P.Y(pt[1]),o.pointSize/1.8,"#d84a3f","#d84a3f",1.6);
      });
    }else if(f.type==="points"&&f.pts){
      s+='<polyline points="'+f.pts.map(p=>P.X(p[0])+","+P.Y(p[1])).join(" ")+'" fill="none" stroke="'+col+'" stroke-width="'+o.lineWidth+'" stroke-dasharray="none"/>';
    }
  });
  return s;
}
function xySetup(g,sh,useMean){
  const o=gopt(g);
  const skip=sh.ttype==="multivar"?0:-1;
  if(sh.ttype==="multivar"&&!o.xlab&&sh.groups[0])o.xlab=sh.groups[0].name;
  const series=sh.groups.map((gr,i)=>i===skip?null:{
    i,name:gr.name||("Y"+(i+1)),color:gr.color||palOf(o,i),symbol:gr.symbol||"circle",
    pts:xyPairs(sh,i),ms:xyMeans(sh,i)}).filter(s=>s&&(s.pts.length||s.ms.length));
  return {o,series};
}
function xyRanges(o,series,useMean,withErr){
  const xsv=[],ysv=[];
  series.forEach(s=>{
    (useMean?s.ms:s.pts).forEach(p=>{
      if(useMean){
        xsv.push(p.x);ysv.push(p.mean);
        if(withErr){const e=errLoHi(p,o);if(isFinite(e[0]))ysv.push(e[0],e[1]);}
      }else{xsv.push(p[0]);ysv.push(p[1]);}
    });
  });
  return {xs:autoRange(xsv,o,"x"),ys:autoRange(ysv,o,"y")};
}
GRAPHTYPES.xy_scatter={name:"散布図（点のみ）",cat:"XY",for:["xy","multivar"],
  desc:"すべての点を表示。回帰直線・あてはめ曲線を重ねられます。",
  draw:(g,sh)=>{
    const {o,series}=xySetup(g,sh);
    if(!series.length)return emptySVG();
    const R=xyRanges(o,series,false);
    R.ys.title=o.ylab||sh.yTitle||"Y";
    R.ys.legend=series.map(s=>({name:s.name,color:s.color,shape:s.symbol,fill:s.color}));
    const P=startPlot(o,{type:"num",min:R.xs.min,max:R.xs.max,log:R.xs.log,ticks:R.xs.ticks,title:o.xlab||sh.xTitle||"X"},R.ys);
    let body="";
    series.forEach(s=>s.pts.forEach(p=>{
      body+=sym(s.symbol,P.X(p[0]),P.Y(p[1]),o.pointSize/2,symFill(o,s.color),symStroke(o,s.color),1.3);
    }));
    if(o.showFit)body+=drawFits(sh,P,o,R.xs);
    return wrapSVG(o,P,body);
  }};
GRAPHTYPES.xy_line={name:"折れ線＋点",cat:"XY",for:["xy","multivar"],
  desc:"平均値を線で結びます。経時変化・成長曲線に。",
  draw:(g,sh)=>{
    const {o,series}=xySetup(g,sh);
    if(!series.length)return emptySVG();
    const R=xyRanges(o,series,true,true);
    R.ys.title=o.ylab||sh.yTitle||"Y";
    R.ys.legend=series.map(s=>({name:s.name,color:s.color,shape:s.symbol,fill:s.color}));
    const P=startPlot(o,{type:"num",min:R.xs.min,max:R.xs.max,log:R.xs.log,ticks:R.xs.ticks,title:o.xlab||sh.xTitle||"X"},R.ys);
    const hasFit=o.showFit&&fitCurves(sh).length>0;
    let body="";
    series.forEach(s=>{
      const ms=s.ms.slice().sort((a,b)=>a.x-b.x);
      if(o.connect&&ms.length>1&&!hasFit)
        body+='<polyline points="'+ms.map(p=>P.X(p.x)+","+P.Y(p.mean)).join(" ")+'" fill="none" stroke="'+s.color+'" stroke-width="'+o.lineWidth+'"/>';
      ms.forEach(p=>{
        const e=errLoHi(p,o);
        body+=errBarSvg(P.X(p.x),P.Y(p.mean),P.Y(e[0]),P.Y(e[1]),o,s.color);
      });
      ms.forEach(p=>{body+=sym(s.symbol,P.X(p.x),P.Y(p.mean),o.pointSize/2,symFill(o,s.color),symStroke(o,s.color),1.4);});
      if(o.showPoints)s.pts.forEach(p=>body+=sym("circle",P.X(p[0]),P.Y(p[1]),o.pointSize/4,s.color,s.color,0.7));
    });
    if(o.showFit)body+=drawFits(sh,P,o,R.xs);
    return wrapSVG(o,P,body);
  }};
GRAPHTYPES.xy_area={name:"面グラフ",cat:"XY",for:["xy"],
  desc:"曲線とベースラインの間を塗ります。AUCの図示に。",
  draw:(g,sh)=>{
    const {o,series}=xySetup(g,sh);
    if(!series.length)return emptySVG();
    const R=xyRanges(o,series,true,false);
    if(R.ys.min>0)R.ys.min=0;
    R.ys.title=o.ylab||sh.yTitle||"Y";
    R.ys.legend=series.map(s=>({name:s.name,color:s.color}));
    const P=startPlot(o,{type:"num",min:R.xs.min,max:R.xs.max,log:R.xs.log,ticks:R.xs.ticks,title:o.xlab||sh.xTitle||"X"},R.ys);
    const hasFit=o.showFit&&fitCurves(sh).length>0;
    let body="";
    series.forEach(s=>{
      const ms=s.ms.slice().sort((a,b)=>a.x-b.x);
      if(ms.length<2)return;
      const base=P.Y(Math.max(R.ys.min,o.baseline||0));
      body+='<polygon points="'+(P.X(ms[0].x)+","+base)+" "+ms.map(p=>P.X(p.x)+","+P.Y(p.mean)).join(" ")+" "+(P.X(ms[ms.length-1].x)+","+base)
        +'" fill="'+s.color+'" fill-opacity="0.28" stroke="'+s.color+'" stroke-width="'+o.lineWidth+'"/>';
      if(o.showPoints)ms.forEach(p=>body+=sym(s.symbol,P.X(p.x),P.Y(p.mean),o.pointSize/2.4,symFill(o,s.color),symStroke(o,s.color),1.2));
    });
    return wrapSVG(o,P,body);
  }};
/* ---------- バブルプロット ---------- */
GRAPHTYPES.xy_bubble={name:"バブルプロット",cat:"XY",for:["multivar","xy"],
  desc:"X・Yに加え、点の大きさと色で2つの変数を同時に表します（4変数の可視化）。",
  draw:(g,sh)=>{
    const o=gopt(g),ink=inkOf(o),bold=o.bold!==false;
    // 列の割り当て：多変数表は 1列目X・2列目Y・3列目サイズ・4列目色
    const cols=sh.groups.map((_,i)=>i);
    const pts=[];
    if(sh.ttype==="multivar"){
      if(cols.length<3)return emptySVG("X・Y・大きさの3列以上が必要です");
      for(let r=0;r<sh.rows.length;r++){
        const x=cellNum(sh,r,0,0),y=cellNum(sh,r,1,0),sz=cellNum(sh,r,2,0);
        const cv=cols.length>3?cellNum(sh,r,3,0):NaN;
        if(!isNaN(x)&&!isNaN(y)&&!isNaN(sz))pts.push({x,y,sz,c:cv,label:sh.rows[r].t||""});
      }
    }else{
      if(cols.length<2)return emptySVG("Yと大きさの2データセットが必要です");
      for(let r=0;r<sh.rows.length;r++){
        const x=parseNum(sh.rows[r].x),y=cellNum(sh,r,0,0),sz=cellNum(sh,r,1,0);
        const cv=cols.length>2?cellNum(sh,r,2,0):NaN;
        if(!isNaN(x)&&!isNaN(y)&&!isNaN(sz))pts.push({x,y,sz,c:cv,label:sh.rows[r].t||""});
      }
    }
    if(pts.length<1)return emptySVG("数値のそろった行がありません");
    const names=sh.ttype==="multivar"
      ? [sh.groups[0].name,sh.groups[1].name,sh.groups[2].name,sh.groups[3]?sh.groups[3].name:""]
      : [sh.xTitle||"X",sh.groups[0].name,sh.groups[1].name,sh.groups[2]?sh.groups[2].name:""];
    const hasColor=pts.some(p=>isFinite(p.c));
    const padv=(arr)=>{const lo=Math.min(...arr),hi=Math.max(...arr),d=(hi-lo)*0.09||1;return arr.concat([lo-d,hi+d]);};
    const xs=autoRange(padv(pts.map(p=>p.x)),o,"x"),ys=autoRange(padv(pts.map(p=>p.y)),o,"y");
    ys.title=o.ylab||names[1];
    const P=startPlot(o,{type:"num",min:xs.min,max:xs.max,log:xs.log,ticks:xs.ticks,title:o.xlab||names[0]},ys);
    const szMin=Math.min(...pts.map(p=>p.sz)),szMax=Math.max(...pts.map(p=>p.sz));
    const rMin=o.pointSize*0.45,rMax=o.pointSize*2.2;
    const rOf=(v)=>rMin+(rMax-rMin)*Math.sqrt(Math.max(0,(v-szMin)/((szMax-szMin)||1)));
    const cMin=hasColor?Math.min(...pts.filter(p=>isFinite(p.c)).map(p=>p.c)):0;
    const cMax=hasColor?Math.max(...pts.filter(p=>isFinite(p.c)).map(p=>p.c)):1;
    const ramp=heatRamp(o);
    let body="";
    pts.slice().sort((a,b)=>b.sz-a.sz).forEach(p=>{
      const fill=hasColor&&isFinite(p.c)?rampColor(ramp,(p.c-cMin)/((cMax-cMin)||1)):palOf(o,0);
      body+='<circle cx="'+P.X(p.x)+'" cy="'+P.Y(p.y)+'" r="'+rOf(p.sz).toFixed(2)+'" fill="'+fill
        +'" fill-opacity="'+(o.barOpacity*0.85)+'" stroke="'+(o.pointStroke?ink:fill)+'" stroke-width="1.1"/>';
    });
    // 右側の凡例（カラースケールとサイズ）
    let over="";
    const fs=P.fs,lx=P.px1+16;
    let ly=P.py0+fs;
    if(hasColor){
      over+=tspanText(lx,ly,esc(names[3]||"色"),{fs,bold,fill:ink});
      const bw=Math.max(12,fs*0.9),bh=Math.min(110,o.h*0.45);
      const by=ly+8;
      for(let i=0;i<50;i++)
        over+='<rect x="'+lx+'" y="'+(by+bh*i/50)+'" width="'+bw+'" height="'+(bh/50+0.7)+'" fill="'+rampColor(ramp,1-i/50)+'"/>';
      over+='<rect x="'+lx+'" y="'+by+'" width="'+bw+'" height="'+bh+'" fill="none" stroke="'+ink+'" stroke-width="1.4"/>';
      linTicks(cMin,cMax,4).forEach(v=>{
        const y=by+bh*(1-(v-cMin)/((cMax-cMin)||1));
        over+='<line x1="'+(lx+bw)+'" y1="'+y+'" x2="'+(lx+bw+4)+'" y2="'+y+'" stroke="'+ink+'" stroke-width="1.4"/>'
          +tspanText(lx+bw+7,y+fs*0.34,fmtTick(v),{fs:fs*0.9,bold,fill:ink});
      });
      ly=by+bh+fs*1.8;
    }
    over+=tspanText(lx,ly,esc(names[2]||"大きさ"),{fs,bold,fill:ink});
    ly+=6;
    [szMax,(szMax+szMin)/2,szMin].forEach(v=>{
      const r=rOf(v);
      ly+=r+6;
      over+='<circle cx="'+(lx+rMax)+'" cy="'+ly+'" r="'+r.toFixed(2)+'" fill="none" stroke="'+ink+'" stroke-width="1.2"/>';
      over+=tspanText(lx+rMax*2+8,ly+fs*0.34,fmtNumShort(v),{fs:fs*0.9,bold,fill:ink});
      ly+=r+4;
    });
    // 凡例の幅ぶんキャンバスを広げる
    const need=Math.round(rMax*2+70);
    let svg=wrapSVG(o,P,body,over);
    svg=svg.replace(/width="([\d.]+)" height="([\d.]+)" viewBox="0 0 ([\d.]+) ([\d.]+)"/,
      (m,w,h,vw,vh)=>'width="'+(+w+need)+'" height="'+h+'" viewBox="0 0 '+(+vw+need)+' '+vh+'"');
    svg=svg.replace(/<rect width="([\d.]+)" height="([\d.]+)" fill="#fff"\/>/,
      (m,w,h)=>'<rect width="'+(+w+need)+'" height="'+h+'" fill="#fff"/>');
    return svg;
  }};
/* ---------- グループ（2要因）系 ---------- */
function grpData(sh,o){
  const nR=usedRows(sh);
  const cats=sh.rows.slice(0,nR).map((r,i)=>r.t||("行"+(i+1)));
  const cells=cellsOf(sh).slice(0,nR);
  const series=sh.groups.map((g,c)=>({c,name:g.name||("列"+(c+1)),color:g.color||palOf(o,c),symbol:g.symbol||"circle",
    cells:cells.map(row=>{const v=row[c];return {v,d:v.length?describeFull(v):null};})}));
  return {cats,series,cells};
}
function grpBase(g,sh,mode){
  const o=gopt(g);
  const {cats,series}=grpData(sh,o);
  if(!cats.length||!series.length)return null;
  return {o,cats,series};
}
GRAPHTYPES.grp_bar={name:"集合棒グラフ",cat:"グループ",for:["grouped","contingency","nested","parts","column"],
  desc:"行を横軸、列（データセット）を隣り合う棒として並べます。データセットごとに離して並べることもできます。",
  draw:(g,sh)=>{
    const B=grpBase(g,sh);if(!B)return emptySVG();
    const {o,cats,series}=B;
    const sep=o.barLayout==="separated";
    const dPre=analysisData(sh.id,"anova2")||analysisData(sh.id,"rowtt");
    const nPre=(o.autoBracket&&dPre&&dPre.comparisons&&!sep)?dPre.comparisons.filter(c=>c.row!==undefined).length:0;
    o._headroom=Math.min(3,Math.ceil(nPre/Math.max(1,cats.length)))*(o.fs*1.7)+(o.brackets||[]).length*(o.fs*1.5)
      +(o.valueLabels!=="none"?o.fsAxis*1.5:0)+((nPre||(o.brackets||[]).length)?o.fs*1.2:0);
    const vals=[o.baseline||0];
    series.forEach(s=>s.cells.forEach(c=>{if(c.d){const e=errLoHi(c.d,o);vals.push(centerOf(c.d,o),e[0],e[1]);if(o.showPoints)vals.push(...c.v);}}));
    const ys=autoRange(vals.filter(isFinite),o,"y");
    if(ys.min>0&&o.ymin==="")ys.min=0;
    ys.title=o.ylab||sh.yTitle||"";
    ys.legend=series.map(s=>({name:s.name,color:s.color}));
    // 分離配置では「データセット×行」を横軸に並べる（間に空カテゴリを挟む）
    let axisCats=cats,slots=[];
    if(sep){
      axisCats=[];
      series.forEach((s,si)=>{
        if(si>0){axisCats.push("");slots.push(null);}
        cats.forEach((ct,ri)=>{axisCats.push(ct);slots.push({si,ri});});
      });
    }
    const P=startPlot(o,{type:"cat",cats:axisCats,title:o.xlab||""},ys);
    let body="";const tops={};
    const drawBar=(x,bw,s,c,ri,key)=>{
      if(!c.d)return;
      const cv=centerOf(c.d,o),[lo,hi]=errLoHi(c.d,o);
      const y0=P.Y(Math.max(ys.min,o.baseline||ys.min)),y1=P.Y(cv);
      body+='<rect x="'+(x-bw/2)+'" y="'+Math.min(y0,y1)+'" width="'+bw+'" height="'+Math.abs(y0-y1)
        +'" fill="'+(o.barFill?s.color:"#fff")+'" fill-opacity="'+o.barOpacity+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+o.barStroke+'"/>';
      body+=errBarSvg(x,y1,P.Y(lo),P.Y(hi),o,inkOf(o));
      if(o.showPoints)c.v.forEach((v,k)=>body+=sym(s.symbol,x+jit(k,c.v.length,bw*0.5,o.jitter,ri*10+s.c),P.Y(v),o.pointSize/2.8,"#fff",inkOf(o),1.1));
      const top=safeMin(P.Y(hi),o.showPoints&&c.v.length?P.Y(Math.max(...c.v)):NaN,y1);
      body+=valueLabel(o,x,top,c.d,c.v.length);
      if(key!==undefined)tops[key]=safeMin(tops[key]===undefined?P.py1:tops[key],top-(o.valueLabels!=="none"?o.fsAxis*1.2:0));
    };
    if(sep){
      const bw=P.band*o.barWidth;
      slots.forEach((sl,i)=>{
        if(!sl)return;
        drawBar(P.X(i),bw,series[sl.si],series[sl.si].cells[sl.ri],sl.ri,i);
      });
    }else{
      const gw=P.band*o.barWidth,bw=gw/series.length;
      cats.forEach((ct,ri)=>{
        let top=P.py1;
        series.forEach((s,si)=>{
          const c=s.cells[ri];
          if(!c.d)return;
          const x=P.X(ri)-gw/2+bw*(si+0.5);
          drawBar(x,bw*0.88,s,c,ri);
          const [lo,hi]=errLoHi(c.d,o);
          top=safeMin(top,P.Y(hi),o.showPoints&&c.v.length?P.Y(Math.max(...c.v)):NaN,P.Y(centerOf(c.d,o)));
        });
        tops[ri]=top-(o.valueLabels!=="none"?o.fsAxis*1.2:0);
      });
      // 二元配置ANOVA等の行内比較を棒の上に描く
      let over="";
      if(o.autoBracket&&dPre&&dPre.comparisons){
        dPre.comparisons.forEach(c=>{
          if(c.row===undefined)return;
          const i1=series.findIndex(s=>s.c===c.i),i2=series.findIndex(s=>s.c===c.j);
          if(i1<0||i2<0)return;
          const gwx=P.X(c.row)-gw/2;
          const x1=gwx+bw*(i1+0.5),x2=gwx+bw*(i2+0.5);
          const y=tops[c.row]-14;
          const lab=o.bracketStyle==="p"?("P = "+pShort(c.p)):o.bracketStyle==="num"?pShort(c.p):(c.star||star(c.p));
          if(o.bracketStyle==="starOnly"&&lab==="ns")return;
          over+='<path d="M'+Math.min(x1,x2)+' '+(y+5)+'V'+y+'H'+Math.max(x1,x2)+'V'+(y+5)+'" fill="none" stroke="'+inkOf(o)+'" stroke-width="'+(o.errWidth-0.2)+'"/>';
          over+=tspanText((x1+x2)/2,y-4,lab,{anchor:"middle",fs:o.fs,bold:o.bold!==false,fill:inkOf(o)});
          tops[c.row]=y-o.fs-6;
        });
      }
      return wrapSVG(o,P,body,over+bracketSvg(P,o,(o.brackets||[]),tops));
    }
    return wrapSVG(o,P,body,bracketSvg(P,o,(o.brackets||[]),tops));
  }};
GRAPHTYPES.grp_stack={name:"積み上げ棒グラフ",cat:"グループ",for:["grouped","contingency","parts","column"],
  desc:"各行の中で値を積み上げます。構成比の比較に。",
  draw:(g,sh)=>{
    const B=grpBase(g,sh);if(!B)return emptySVG();
    const {o,cats,series}=B;
    const pct=o.stackPct;
    const totals=cats.map((_,ri)=>sum(series.map(s=>s.cells[ri].d?centerOf(s.cells[ri].d,o):0)));
    const ys=pct?{min:0,max:100,log:false}:autoRange([0,Math.max(...totals)*1.08],o,"y");
    ys.title=o.ylab||(pct?"割合 (%)":sh.yTitle||"");
    ys.legend=series.map(s=>({name:s.name,color:s.color}));
    const P=startPlot(o,{type:"cat",cats,title:o.xlab||""},ys);
    let body="";
    const bw=P.band*o.barWidth;
    cats.forEach((ct,ri)=>{
      let acc=0;
      series.forEach((s,si)=>{
        const c=s.cells[ri];
        if(!c.d)return;
        let v=centerOf(c.d,o);
        if(pct)v=totals[ri]?v/totals[ri]*100:0;
        const y0=P.Y(acc),y1=P.Y(acc+v);
        body+='<rect x="'+(P.X(ri)-bw/2)+'" y="'+y1+'" width="'+bw+'" height="'+Math.max(0,y0-y1)
          +'" fill="'+s.color+'" fill-opacity="'+o.barOpacity+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+(o.barStroke*0.8)+'"/>';
        if(pct&&v>7)body+=tspanText(P.X(ri),(y0+y1)/2+4,fmt(v,0)+"%",{anchor:"middle",fs:o.fsAxis*0.9,fill:"#fff",bold:true});
        acc+=v;
      });
    });
    return wrapSVG(o,P,body);
  }};
GRAPHTYPES.grp_scatter={name:"集合散布図",cat:"グループ",for:["grouped","nested","contingency"],
  desc:"行ごとに列を並べ、個々の点と平均±エラーバーを表示します。",
  draw:(g,sh)=>{
    const B=grpBase(g,sh);if(!B)return emptySVG();
    const {o,cats,series}=B;
    const vals=[];
    series.forEach(s=>s.cells.forEach(c=>{vals.push(...c.v);if(c.d){const e=errLoHi(c.d,o);vals.push(e[0],e[1]);}}));
    const ys=autoRange(vals.filter(isFinite),o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    ys.legend=series.map(s=>({name:s.name,color:s.color,shape:s.symbol,fill:s.color}));
    const P=startPlot(o,{type:"cat",cats,title:o.xlab||""},ys);
    let body="";const tops={};
    const gw=P.band*o.barWidth,bw=gw/series.length;
    cats.forEach((ct,ri)=>{
      let top=P.py1;
      series.forEach((s,si)=>{
        const c=s.cells[ri];if(!c.d)return;
        const x=P.X(ri)-gw/2+bw*(si+0.5);
        c.v.forEach((v,k)=>body+=sym(s.symbol,x+jit(k,c.v.length,bw*0.55,o.jitter,ri*7+si),P.Y(v),o.pointSize/2.3,symFill(o,s.color),symStroke(o,s.color),1.2));
        const cv=centerOf(c.d,o),[lo,hi]=errLoHi(c.d,o);
        body+=errBarSvg(x,P.Y(cv),P.Y(lo),P.Y(hi),o,inkOf(o));
        body+=meanLineSvg(o,x-bw*0.38,x+bw*0.38,P.Y(cv));
        top=Math.min(top,P.Y(hi),P.Y(Math.max(...c.v)));
      });
      tops[ri]=top;
    });
    return wrapSVG(o,P,body,bracketSvg(P,o,o.brackets||[],tops));
  }};
GRAPHTYPES.grp_box={name:"集合箱ひげ図",cat:"グループ",for:["grouped","nested","contingency"],
  desc:"行ごとに列を並べた箱ひげ図。",
  draw:(g,sh)=>{
    const B=grpBase(g,sh);if(!B)return emptySVG();
    const {o,cats,series}=B;
    const vals=[];series.forEach(s=>s.cells.forEach(c=>vals.push(...c.v)));
    const ys=autoRange(vals,o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    ys.legend=series.map(s=>({name:s.name,color:s.color}));
    const P=startPlot(o,{type:"cat",cats,title:o.xlab||""},ys);
    let body="";
    const gw=P.band*o.barWidth,bw=gw/series.length;
    cats.forEach((ct,ri)=>{
      series.forEach((s,si)=>{
        const c=s.cells[ri];if(!c.d||c.v.length<2)return;
        const d=c.d,x=P.X(ri)-gw/2+bw*(si+0.5),w=bw*0.72;
        const iqr=d.q3-d.q1;
        const wLo=o.boxWhisker==="minmax"?d.min:Math.min(...c.v.filter(v=>v>=d.q1-1.5*iqr));
        const wHi=o.boxWhisker==="minmax"?d.max:Math.max(...c.v.filter(v=>v<=d.q3+1.5*iqr));
        body+='<rect x="'+(x-w/2)+'" y="'+P.Y(d.q3)+'" width="'+w+'" height="'+(P.Y(d.q1)-P.Y(d.q3))
          +'" fill="'+(o.barFill?s.color:"#fff")+'" fill-opacity="'+(o.barFill?0.55:1)+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+o.barStroke+'"/>'
          +'<line x1="'+(x-w/2)+'" y1="'+P.Y(d.median)+'" x2="'+(x+w/2)+'" y2="'+P.Y(d.median)+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+(o.barStroke+1)+'"/>'
          +'<line x1="'+x+'" y1="'+P.Y(d.q3)+'" x2="'+x+'" y2="'+P.Y(wHi)+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+o.barStroke+'"/>'
          +'<line x1="'+x+'" y1="'+P.Y(d.q1)+'" x2="'+x+'" y2="'+P.Y(wLo)+'" stroke="'+strokeOfBar(o,s.color)+'" stroke-width="'+o.barStroke+'"/>';
        if(o.showPoints)c.v.forEach((v,k)=>body+=sym(s.symbol,x+jit(k,c.v.length,w*0.5,true,ri*3+si),P.Y(v),o.pointSize/3,"#fff",inkOf(o),1));
      });
    });
    return wrapSVG(o,P,body);
  }};
GRAPHTYPES.grp_line={name:"折れ線（行＝時点）",cat:"グループ",for:["grouped","contingency","nested"],
  desc:"行を横軸の時点として、列ごとの折れ線で描きます。経時データに。",
  draw:(g,sh)=>{
    const B=grpBase(g,sh);if(!B)return emptySVG();
    const {o,cats,series}=B;
    const vals=[];
    series.forEach(s=>s.cells.forEach(c=>{if(c.d){const e=errLoHi(c.d,o);vals.push(centerOf(c.d,o),e[0],e[1]);}}));
    const ys=autoRange(vals.filter(isFinite),o,"y");
    ys.title=o.ylab||sh.yTitle||"";
    ys.legend=series.map(s=>({name:s.name,color:s.color,shape:s.symbol,fill:s.color}));
    const P=startPlot(o,{type:"cat",cats,title:o.xlab||""},ys);
    let body="";
    series.forEach(s=>{
      const pts=[];
      s.cells.forEach((c,ri)=>{if(c.d)pts.push([P.X(ri),P.Y(centerOf(c.d,o)),c]);});
      if(pts.length>1&&o.connect)
        body+='<polyline points="'+pts.map(p=>p[0]+","+p[1]).join(" ")+'" fill="none" stroke="'+s.color+'" stroke-width="'+o.lineWidth+'"/>';
      pts.forEach(p=>{
        const e=errLoHi(p[2].d,o);
        body+=errBarSvg(p[0],p[1],P.Y(e[0]),P.Y(e[1]),o,s.color);
      });
      pts.forEach(p=>body+=sym(s.symbol,p[0],p[1],o.pointSize/2,symFill(o,s.color),symStroke(o,s.color),1.4));
    });
    return wrapSVG(o,P,body);
  }};
GRAPHTYPES.grp_heat={name:"ヒートマップ",cat:"グループ",for:["grouped","multivar","contingency","nested"],
  desc:"行×列の値を色の濃淡で表します。発現データなどに。",
  draw:(g,sh)=>{
    const o=gopt(g),ink=inkOf(o),bold=o.bold!==false;
    const {cats,series}=grpData(sh,o);
    if(!cats.length)return emptySVG();
    const vals=[];
    series.forEach(s=>s.cells.forEach(c=>{if(c.d)vals.push(c.d.mean);}));
    if(!vals.length)return emptySVG();
    const mn=o.ymin!==""?+o.ymin:Math.min(...vals),mx=o.ymax!==""?+o.ymax:Math.max(...vals);
    const ramp=heatRamp(o);
    const cw=Math.max(22,o.w/series.length),ch=Math.max(9,Math.min(44,o.h/cats.length));
    const fs=o.fsAxis;
    const mL=Math.max(...cats.map(c=>txtW(c,fs,bold)))+14;
    const mT=Math.max(...series.map(s=>txtW(s.name,fs,bold)))*0.72+18+(o.title?o.fsTitle+12:0);
    const mapW=cw*series.length,mapH=ch*cats.length;
    const barW=Math.max(16,fs*1.25);
    const W=mL+mapW+barW+90,H=mT+mapH+28;
    let body='<rect width="'+W+'" height="'+H+'" fill="#fff"/>';
    cats.forEach((ct,ri)=>{
      body+=tspanText(mL-7,mT+ch*ri+ch/2+fs*0.35,esc(ct),{anchor:"end",fs,bold,fill:ink});
      series.forEach((s,ci)=>{
        const c=s.cells[ri],x=mL+cw*ci,y=mT+ch*ri;
        if(!c.d){
          body+='<rect x="'+x+'" y="'+y+'" width="'+cw+'" height="'+ch+'" fill="#ffffff"/>'
            +'<path d="M'+(x+cw*0.3)+' '+(y+ch*0.3)+'L'+(x+cw*0.7)+' '+(y+ch*0.7)
            +'M'+(x+cw*0.7)+' '+(y+ch*0.3)+'L'+(x+cw*0.3)+' '+(y+ch*0.7)+'" stroke="'+ink+'" stroke-width="1"/>';
          return;
        }
        const t=(c.d.mean-mn)/(mx-mn||1);
        body+='<rect x="'+x+'" y="'+y+'" width="'+cw+'" height="'+ch+'" fill="'+rampColor(ramp,t)+'"/>';
        if(o.valueLabels!=="none"&&ch>=16&&cw>=34)
          body+=tspanText(x+cw/2,y+ch/2+fs*0.32,fmtNumShort(c.d.mean),
            {anchor:"middle",fs:fs*0.85,bold,fill:(t>0.62||t<0.18)?"#fff":ink});
      });
    });
    body+='<rect x="'+mL+'" y="'+mT+'" width="'+mapW+'" height="'+mapH+'" fill="none" stroke="'+ink+'" stroke-width="'+o.axisWidth+'"/>';
    series.forEach((s,ci)=>{
      body+=tspanText(mL+cw*ci+cw/2+fs*0.3,mT-8,esc(s.name),{anchor:"start",fs,bold,rot:-45,fill:ink});
    });
    // カラースケール
    const bx=mL+mapW+26,bh=Math.min(Math.max(120,mapH*0.7),mapH);
    const by=mT;
    for(let i=0;i<60;i++)
      body+='<rect x="'+bx+'" y="'+(by+bh*i/60)+'" width="'+barW+'" height="'+(bh/60+0.7)+'" fill="'+rampColor(ramp,1-i/60)+'"/>';
    body+='<rect x="'+bx+'" y="'+by+'" width="'+barW+'" height="'+bh+'" fill="none" stroke="'+ink+'" stroke-width="1.6"/>';
    linTicks(mn,mx,5).forEach(v=>{
      const y=by+bh*(1-(v-mn)/(mx-mn||1));
      body+='<line x1="'+(bx+barW)+'" y1="'+y+'" x2="'+(bx+barW+5)+'" y2="'+y+'" stroke="'+ink+'" stroke-width="1.6"/>'
        +tspanText(bx+barW+8,y+fs*0.35,fmtTick(v),{fs:fs*0.92,bold,fill:ink});
    });
    if(o.ylab)body+=tspanText(bx,by-8,esc(o.ylab),{fs:fs*0.95,bold,fill:ink});
    if(o.title)body+=tspanText(W/2,o.fsTitle+8,esc(o.title),{anchor:"middle",fs:o.fsTitle,bold,fill:ink});
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" font-family="'+o.font+'" style="background:#fff">'+body+"</svg>";
  }};
/* ---------- 生存曲線 ---------- */
GRAPHTYPES.surv_km={name:"生存曲線（Kaplan-Meier）",cat:"生存",for:["survival"],
  desc:"階段状の生存曲線。打ち切り記号・95%信頼帯・at risk表に対応。",
  draw:(g,sh)=>{
    const o=gopt(g);
    const groups=[];
    sh.groups.forEach((gr,gi)=>{
      const times=[],events=[];
      for(let r=0;r<sh.rows.length;r++){
        const t=parseNum(sh.rows[r].x),e=cellNum(sh,r,gi,0);
        if(!isNaN(t)&&!isNaN(e)){times.push(t);events.push(e>=1?1:0);}
      }
      if(times.length)groups.push({name:gr.name,color:gr.color||palOf(o,gi),symbol:gr.symbol,km:kmFull(times,events),times});
    });
    if(!groups.length)return emptySVG("X列に期間、各列に 1/0 を入力してください");
    const maxT=Math.max(...groups.map(gr=>gr.km.maxT));
    const xs={min:o.xmin!==""?+o.xmin:0,max:o.xmax!==""?+o.xmax:maxT*1.02,log:false,type:"num",title:o.xlab||sh.xTitle||"時間"};
    const pctMode=o.kmPct!==false;
    const ys={min:o.ymin!==""?+o.ymin:0,max:o.ymax!==""?+o.ymax:(pctMode?100:1),log:false,
      title:o.ylab||(pctMode?"生存率 (%)":"生存率"),legend:groups.map(gr=>({name:gr.name,color:gr.color,line:true}))};
    const P=startPlot(o,xs,ys);
    const sc=(s)=>pctMode?s*100:s;
    let body="";
    groups.forEach(gr=>{
      const pts=[];
      let prev=null;
      gr.km.steps.forEach(st=>{
        if(prev!==null)pts.push([P.X(st.t),P.Y(sc(prev))]);
        pts.push([P.X(st.t),P.Y(sc(st.s))]);
        prev=st.s;
      });
      pts.push([P.X(xs.max),P.Y(sc(prev===null?1:prev))]);
      if(o.showBand){
        const up=[],dn=[];
        let pl=1,ph=1;
        gr.km.steps.forEach(st=>{
          up.push(P.X(st.t)+","+P.Y(sc(ph)));dn.push(P.X(st.t)+","+P.Y(sc(pl)));
          ph=isFinite(st.hi)?st.hi:ph;pl=isFinite(st.lo)?st.lo:pl;
          up.push(P.X(st.t)+","+P.Y(sc(ph)));dn.push(P.X(st.t)+","+P.Y(sc(pl)));
        });
        up.push(P.X(xs.max)+","+P.Y(sc(ph)));dn.push(P.X(xs.max)+","+P.Y(sc(pl)));
        body+='<polygon points="'+up.concat(dn.reverse()).join(" ")+'" fill="'+gr.color+'" fill-opacity="0.13" stroke="none"/>';
      }
      body+='<polyline points="'+pts.map(p=>p[0]+","+p[1]).join(" ")+'" fill="none" stroke="'+gr.color+'" stroke-width="'+o.lineWidth+'"/>';
      if(o.censorTicks)gr.km.censors.forEach(c=>{
        body+='<line x1="'+P.X(c.t)+'" y1="'+(P.Y(sc(c.s))-6)+'" x2="'+P.X(c.t)+'" y2="'+(P.Y(sc(c.s))+6)+'" stroke="'+gr.color+'" stroke-width="'+(o.lineWidth*0.8)+'"/>';
      });
      if(o.meanLine==="median"&&gr.km.median!==null){
        body+='<line x1="'+P.X(gr.km.median)+'" y1="'+P.Y(sc(0.5))+'" x2="'+P.X(gr.km.median)+'" y2="'+P.py1+'" stroke="'+gr.color+'" stroke-width="1" stroke-dasharray="4 3"/>';
      }
    });
    if(o.meanLine==="median")body+='<line x1="'+P.px0+'" y1="'+P.Y(sc(0.5))+'" x2="'+P.px1+'" y2="'+P.Y(sc(0.5))+'" stroke="#9aa3b1" stroke-width="1" stroke-dasharray="4 3"/>';
    // log-rank P値
    const d=analysisData(sh.id,"km");
    if(o.autoBracket&&d&&d.p!==null&&d.p!==undefined&&isFinite(d.p)){
      const txt=d.p<0.0001?"log-rank P &lt; 0.0001":"log-rank P = "+pShort(d.p);
      body+=tspanText(P.px1-10,P.py0+P.fs+10,txt,{anchor:"end",fs:o.fs,bold:true,fill:inkOf(o)});
    }
    let svg=wrapSVG(o,P,body);
    if(o.atRisk){
      const marks=P.xtk;
      const rowH=o.fs+7;
      const extra=rowH*(groups.length+1)+14;
      svg=svg.replace(/height="(\d+(\.\d+)?)"/,(m,h)=>'height="'+(+h+extra)+'"')
             .replace(/viewBox="0 0 ([\d.]+) ([\d.]+)"/,(m,w,h)=>'viewBox="0 0 '+w+" "+(+h+extra)+'"');
      let tbl=tspanText(P.px0,P.H+12,"Number at risk",{fs:o.fs*0.9,bold:true,fill:inkOf(o)});
      groups.forEach((gr,i)=>{
        const y=P.H+12+rowH*(i+1);
        tbl+=tspanText(P.px0-8,y,esc(gr.name),{anchor:"end",fs:o.fs*0.9,fill:gr.color,bold:true});
        marks.forEach(t=>tbl+=tspanText(P.X(t),y,String(gr.km.atRiskAtT(t)),{anchor:"middle",fs:o.fs*0.9,bold:true,fill:inkOf(o)}));
      });
      svg=svg.replace("</svg>",tbl+"</svg>");
    }
    return svg;
  }};
/* ---------- 円・ドーナツ ---------- */
function pieSlices(sh,o){
  const nR=usedRows(sh);
  const labels=[],vals=[];
  for(let r=0;r<nR;r++){
    const v=cellNum(sh,r,0,0);
    if(!isNaN(v)&&v>0){labels.push(sh.rows[r].t||("項目"+(r+1)));vals.push(v);}
  }
  return {labels,vals,total:sum(vals)};
}
function drawPie(g,sh,donut){
  const o=gopt(g);
  const {labels,vals,total}=pieSlices(sh,o);
  if(!vals.length)return emptySVG("1列目に正の数値を入力してください");
  const R=Math.min(o.w,o.h)/2;
  const cx=R+130,cy=R+(o.title?o.fsTitle+16:14);
  const W=cx+R+165,H=cy+R+(donut?26:42);
  let body='<rect width="'+W+'" height="'+H+'" fill="#fff"/>';
  let ang=-Math.PI/2;
  const inner=donut?R*o.donut:0;
  vals.forEach((v,i)=>{
    const frac=v/total,a2=ang+frac*2*Math.PI;
    const col=palOf(o,i);
    const x1=cx+R*Math.cos(ang),y1=cy+R*Math.sin(ang);
    const x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
    const large=frac>0.5?1:0;
    let d;
    if(inner){
      const ix1=cx+inner*Math.cos(a2),iy1=cy+inner*Math.sin(a2);
      const ix2=cx+inner*Math.cos(ang),iy2=cy+inner*Math.sin(ang);
      d="M"+x1+" "+y1+"A"+R+" "+R+" 0 "+large+" 1 "+x2+" "+y2+"L"+ix1+" "+iy1+"A"+inner+" "+inner+" 0 "+large+" 0 "+ix2+" "+iy2+"Z";
    }else{
      d="M"+cx+" "+cy+"L"+x1+" "+y1+"A"+R+" "+R+" 0 "+large+" 1 "+x2+" "+y2+"Z";
    }
    body+='<path d="'+d+'" fill="'+col+'" stroke="'+inkOf(o)+'" stroke-width="'+Math.max(1.6,o.barStroke*1.4)+'"/>';
    if(o.pieLabels!=="none"&&frac>0.03){
      const mid=(ang+a2)/2,lr=inner?(R+inner)/2:R*0.65;
      const lx=cx+lr*Math.cos(mid),ly=cy+lr*Math.sin(mid);
      const t=o.pieLabels==="pct"?fmt(frac*100,1)+"%":o.pieLabels==="value"?fmtNumShort(v):esc(labels[i]);
      body+=tspanText(lx,ly+4,t,{anchor:"middle",fs:o.fs,fill:"#fff",bold:true});
    }
    ang=a2;
  });
  if(donut&&o.pieLabels!=="none")
    body+=tspanText(cx,cy+6,"n = "+fmtNumShort(total),{anchor:"middle",fs:o.fs*1.2,bold:true,fill:inkOf(o)});
  if(!donut)body+=tspanText(cx,cy+R+22,"Total = "+fmtNumShort(total),{anchor:"middle",fs:o.fs,bold:true,fill:inkOf(o)});
  if(o.legend){
    let ly=cy-R+10;
    const sw=Math.round(o.fs*1.15);
    labels.forEach((L,i)=>{
      body+=legendMark(o,{name:L,color:palOf(o,i)},cx+R+20,ly-o.fs*0.35,sw);
      body+=tspanText(cx+R+20+sw*2.1,ly,esc(L)+"  "+fmt(vals[i]/total*100,1)+"%",{fs:o.fs,bold:o.bold!==false,fill:inkOf(o)});
      ly+=o.fs+11;
    });
  }
  if(o.title)body+=tspanText(W/2,o.fsTitle+8,esc(o.title),{anchor:"middle",fs:o.fsTitle,bold:true,fill:inkOf(o)});
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" font-family="'+o.font+'" style="background:#fff">'+body+"</svg>";
}
GRAPHTYPES.pie={name:"円グラフ",cat:"割合",for:["parts","contingency","column"],
  desc:"全体に占める割合。項目が少ないときに。",draw:(g,sh)=>drawPie(g,sh,false)};
GRAPHTYPES.donut={name:"ドーナツグラフ",cat:"割合",for:["parts","contingency","column"],
  desc:"中央に合計を表示できる円グラフ。",draw:(g,sh)=>drawPie(g,sh,true)};
/* ---------- 相関ヒートマップ ---------- */
GRAPHTYPES.mv_corrheat={name:"相関行列ヒートマップ",cat:"多変数",for:["multivar","column","xy"],
  desc:"変数間の相関係数を青-白-赤で表示します。先に「相関行列」の解析を実行してください。",
  draw:(g,sh)=>{
    const o=gopt(g),ink=inkOf(o),bold=o.bold!==false;
    let d=analysisData(sh.id,"corrmat");
    if(!d){
      const vs=sh.groups.map((_,i)=>i);
      const M=[],names=vs.map(v=>sh.groups[v].name);
      for(let i=0;i<vs.length;i++){M.push([]);
        for(let j=0;j<vs.length;j++){
          const {rows}=mvComplete(sh,[vs[i],vs[j]]);
          M[i].push(rows.length>3?pearson(rows.map(r=>r[0]),rows.map(r=>r[1])).r:NaN);
        }}
      d={matrix:M,names,pmatrix:M.map(r=>r.map(()=>1))};
    }
    const n=d.names.length;
    const cell=Math.max(30,Math.min(58,o.w/n));
    const fs=o.fsAxis;
    const mL=Math.max(...d.names.map(x=>txtW(x,fs,bold)))+14;
    const mT=Math.max(...d.names.map(x=>txtW(x,fs,bold)))*0.72+16+(o.title?o.fsTitle+10:0);
    const barW=Math.max(16,fs*1.25);
    const W=mL+cell*n+barW+80,H=mT+cell*n+26;
    let body='<rect width="'+W+'" height="'+H+'" fill="#fff"/>';
    d.names.forEach((nm,i)=>{
      body+=tspanText(mL-7,mT+cell*i+cell/2+fs*0.35,esc(nm),{anchor:"end",fs,bold,fill:ink});
      body+=tspanText(mL+cell*i+cell/2+fs*0.3,mT-7,esc(nm),{anchor:"start",fs,bold,rot:-90,fill:ink});
      d.names.forEach((__,j)=>{
        const v=d.matrix[i][j];
        const x=mL+cell*j,y=mT+cell*i;
        if(!isFinite(v)){body+='<rect x="'+x+'" y="'+y+'" width="'+cell+'" height="'+cell+'" fill="#fff" stroke="'+ink+'" stroke-width="0.7"/>';return;}
        body+='<rect x="'+x+'" y="'+y+'" width="'+cell+'" height="'+cell+'" fill="'+rampColor(BWR,1-(v+1)/2)+'" stroke="'+ink+'" stroke-width="0.7"/>';
        body+=tspanText(x+cell/2,y+cell/2+fs*0.33,(v<0?"−":"")+Math.abs(v).toFixed(2),
          {anchor:"middle",fs:fs*0.86,bold,fill:Math.abs(v)>0.62?"#fff":ink});
      });
    });
    body+='<rect x="'+mL+'" y="'+mT+'" width="'+(cell*n)+'" height="'+(cell*n)+'" fill="none" stroke="'+ink+'" stroke-width="'+o.axisWidth+'"/>';
    const bx=mL+cell*n+24,bh=Math.min(Math.max(120,cell*n*0.8),cell*n),by=mT;
    for(let i=0;i<60;i++)
      body+='<rect x="'+bx+'" y="'+(by+bh*i/60)+'" width="'+barW+'" height="'+(bh/60+0.7)+'" fill="'+rampColor(BWR,i/60)+'"/>';
    body+='<rect x="'+bx+'" y="'+by+'" width="'+barW+'" height="'+bh+'" fill="none" stroke="'+ink+'" stroke-width="1.6"/>';
    [1,0.5,0,-0.5,-1].forEach(v=>{
      const y=by+bh*(1-(v+1)/2);
      body+='<line x1="'+(bx+barW)+'" y1="'+y+'" x2="'+(bx+barW+5)+'" y2="'+y+'" stroke="'+ink+'" stroke-width="1.6"/>'
        +tspanText(bx+barW+8,y+fs*0.35,v.toFixed(1),{fs:fs*0.92,bold,fill:ink});
    });
    if(o.title)body+=tspanText(W/2,o.fsTitle+6,esc(o.title),{anchor:"middle",fs:o.fsTitle,bold,fill:ink});
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" font-family="'+o.font+'" style="background:#fff">'+body+"</svg>";
  }};
/* ---------- PCAスコア散布図 ---------- */
GRAPHTYPES.mv_pca={name:"PCAスコア散布図",cat:"多変数",for:["multivar"],
  desc:"第1・第2主成分のスコアと因子負荷量（バイプロット）。先に「主成分分析」を実行してください。",
  draw:(g,sh)=>{
    const o=gopt(g);
    const d=analysisData(sh.id,"pca");
    if(!d||!d.pca)return emptySVG("先に「主成分分析（PCA）」を実行してください");
    const sc=d.scores.map(r=>[r[0],r[1]]);
    const xs=autoRange(sc.map(p=>p[0]),o,"x"),ys=autoRange(sc.map(p=>p[1]),o,"y");
    ys.title=o.ylab||("PC2 ("+fmt(d.pca.explained[1],1)+"%)");
    const P=startPlot(o,{type:"num",min:xs.min,max:xs.max,log:false,ticks:xs.ticks,
      title:o.xlab||("PC1 ("+fmt(d.pca.explained[0],1)+"%)")},ys);
    let body='<line x1="'+P.px0+'" y1="'+P.Y(0)+'" x2="'+P.px1+'" y2="'+P.Y(0)+'" stroke="#c9d0da" stroke-dasharray="3 3"/>'
      +'<line x1="'+P.X(0)+'" y1="'+P.py0+'" x2="'+P.X(0)+'" y2="'+P.py1+'" stroke="#c9d0da" stroke-dasharray="3 3"/>';
    sc.forEach((p,i)=>{body+=sym("circle",P.X(p[0]),P.Y(p[1]),o.pointSize/2.4,palOf(o,0),palOf(o,0),1);});
    if(o.showFit){
      const scale=Math.min(Math.abs(xs.max),Math.abs(ys.max))*0.9;
      d.pca.names.forEach((nm,j)=>{
        const vx=d.pca.eig[0].vec[j]*scale,vy=d.pca.eig[1].vec[j]*scale;
        body+='<line x1="'+P.X(0)+'" y1="'+P.Y(0)+'" x2="'+P.X(vx)+'" y2="'+P.Y(vy)+'" stroke="#e0603c" stroke-width="1.4"/>';
        body+=tspanText(P.X(vx),P.Y(vy)-4,esc(nm),{anchor:"middle",fs:o.fs*0.9,fill:"#c2452a",bold:true});
      });
    }
    return wrapSVG(o,P,body);
  }};
/* ---------- フォレストプロット ---------- */
GRAPHTYPES.mv_forest={name:"フォレストプロット",cat:"多変数",for:["multivar","contingency","column"],
  desc:"ロジスティック回帰・Cox回帰のオッズ比／ハザード比を対数軸で表示します。",
  draw:(g,sh)=>{
    const o=gopt(g);
    let items=null,unit="OR";
    const dl=analysisData(sh.id,"logit");
    const dc=analysisData(sh.id,"cox");
    if(dc&&dc.fit){
      unit="HR";
      items=dc.fit.names.map((n,i)=>({name:n,est:dc.fit.hr[i],lo:dc.fit.hrLo[i],hi:dc.fit.hrHi[i],p:dc.fit.ps[i]}));
    }else if(dl&&dl.fit){
      items=dl.fit.names.map((n,i)=>({name:n,est:dl.fit.or[i],lo:dl.fit.orLo[i],hi:dl.fit.orHi[i],p:dl.fit.ps[i]}))
        .filter((_,i)=>i>0);
    }
    if(!items||!items.length)return emptySVG("先に「ロジスティック回帰」または「Cox回帰」を実行してください");
    const fs=o.fsAxis;
    const mL=Math.max(...items.map(i=>txtW(i.name,fs)))+18;
    const rowH=Math.max(24,o.h/items.length);
    const plotW=o.w*0.6,mR=150;
    const W=mL+plotW+mR,H=rowH*items.length+70+(o.title?o.fsTitle+8:0);
    const lo=Math.min(...items.map(i=>i.lo).filter(isFinite),0.5);
    const hi=Math.max(...items.map(i=>i.hi).filter(isFinite),2);
    const l0=Math.log10(Math.max(1e-3,lo*0.8)),l1=Math.log10(hi*1.2);
    const X=(v)=>mL+(Math.log10(Math.max(1e-6,v))-l0)/(l1-l0)*plotW;
    const top=(o.title?o.fsTitle+14:10)+16;
    let body='<rect width="'+W+'" height="'+H+'" fill="#fff"/>';
    body+='<line x1="'+X(1)+'" y1="'+top+'" x2="'+X(1)+'" y2="'+(top+rowH*items.length)+'" stroke="#9aa3b1" stroke-dasharray="4 3"/>';
    items.forEach((it,i)=>{
      const y=top+rowH*(i+0.5);
      body+=tspanText(mL-10,y+fs*0.35,esc(it.name),{anchor:"end",fs,bold:true});
      if(isFinite(it.lo)&&isFinite(it.hi)){
        body+='<line x1="'+X(it.lo)+'" y1="'+y+'" x2="'+X(it.hi)+'" y2="'+y+'" stroke="'+palOf(o,0)+'" stroke-width="1.6"/>'
          +'<line x1="'+X(it.lo)+'" y1="'+(y-4)+'" x2="'+X(it.lo)+'" y2="'+(y+4)+'" stroke="'+palOf(o,0)+'" stroke-width="1.6"/>'
          +'<line x1="'+X(it.hi)+'" y1="'+(y-4)+'" x2="'+X(it.hi)+'" y2="'+(y+4)+'" stroke="'+palOf(o,0)+'" stroke-width="1.6"/>';
      }
      body+=sym("square",X(it.est),y,o.pointSize/2,it.p<0.05?palOf(o,1):palOf(o,0),"#1d2430",1);
      body+=tspanText(mL+plotW+14,y+fs*0.35,fmt(it.est,2)+" ("+fmt(it.lo,2)+"–"+fmt(it.hi,2)+")  "
        +(it.p<0.05?'<tspan font-weight="700">P='+(it.p<0.001?"&lt;0.001":it.p.toFixed(3))+"</tspan>":"P="+(it.p<0.001?"&lt;0.001":it.p.toFixed(3))),{fs:fs*0.92});
    });
    const ticks=[0.1,0.25,0.5,1,2,4,10].filter(t=>Math.log10(t)>=l0&&Math.log10(t)<=l1);
    const ay=top+rowH*items.length;
    body+='<line x1="'+mL+'" y1="'+ay+'" x2="'+(mL+plotW)+'" y2="'+ay+'" stroke="#1d2430" stroke-width="1.2"/>';
    ticks.forEach(t=>{
      body+='<line x1="'+X(t)+'" y1="'+ay+'" x2="'+X(t)+'" y2="'+(ay+5)+'" stroke="#1d2430"/>';
      body+=tspanText(X(t),ay+fs+6,String(t),{anchor:"middle",fs});
    });
    body+=tspanText(mL+plotW/2,ay+fs*2+12,esc(o.xlab||(unit+"（95% CI）")),{anchor:"middle",fs:o.fs,bold:true});
    if(o.title)body+=tspanText(W/2,o.fsTitle+6,esc(o.title),{anchor:"middle",fs:o.fsTitle,bold:true});
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" font-family="'+o.font+'">'+body+"</svg>";
  }};
/* ---------- ROC曲線 ---------- */
GRAPHTYPES.roc={name:"ROC曲線",cat:"多変数",for:["column","multivar","xy"],
  desc:"感度と1−特異度の関係。先に「ROC曲線」の解析を実行してください。",
  draw:(g,sh)=>{
    const o=gopt(g);
    const d=analysisData(sh.id,"roc");
    if(!d)return emptySVG("先に「ROC曲線」の解析を実行してください");
    const ys={min:0,max:100,log:false,title:o.ylab||"感度 (%)"};
    const P=startPlot(o,{type:"num",min:0,max:100,log:false,title:o.xlab||"100% − 特異度 (%)"},ys);
    let body='<line x1="'+P.X(0)+'" y1="'+P.Y(0)+'" x2="'+P.X(100)+'" y2="'+P.Y(100)+'" stroke="#c9d0da" stroke-dasharray="4 3"/>';
    const pts=d.roc.map(p=>P.X(p.fpr*100)+","+P.Y(p.tpr*100));
    body+='<polyline points="'+pts.join(" ")+'" fill="none" stroke="'+palOf(o,0)+'" stroke-width="'+o.lineWidth+'"/>';
    if(o.showBand)body+='<polygon points="'+pts.join(" ")+" "+P.X(100)+","+P.Y(0)+'" fill="'+palOf(o,0)+'" fill-opacity="0.12"/>';
    if(o.showPoints&&d.best)body+=sym("circle",P.X((1-d.best.spec)*100),P.Y(d.best.sens*100),o.pointSize/2,"#fff",palOf(o,1),2);
    body+=tspanText(P.px1-10,P.py1-14,"AUC = "+fmt(d.auc,3),{anchor:"end",fs:o.fs*1.1,bold:true});
    return wrapSVG(o,P,body);
  }};
