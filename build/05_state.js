
/* =====================================================================
   プロジェクト状態とデータモデル
   ===================================================================== */
const GCOLORS=["#F0A22E","#DE5C33","#7C1D1D","#8B44AC","#3F6FD1","#7FBEEA","#2E9B57","#C94F8A","#4C4C4C","#B8A22E","#1f6fd0","#26a69a"];
const SYMBOLS=["circle","square","triangle","triangle-down","diamond","plus","cross","star","hexagon","bar"];
const TTYPES={
  xy:{name:"XY",icon:"📈",desc:"X（濃度・時間など）に対しY値。回帰・相関・用量反応曲線に。"},
  column:{name:"縦列",icon:"▮",desc:"群ごとに1列。t検定・一元配置ANOVAに。"},
  grouped:{name:"グループ",icon:"▤",desc:"行×列の2要因。二元配置ANOVAに。"},
  contingency:{name:"分割表",icon:"⊞",desc:"度数のクロス表。χ²・Fisher検定に。"},
  survival:{name:"生存",icon:"📉",desc:"時間と打ち切り符号。Kaplan-Meier・log-rankに。"},
  parts:{name:"割合",icon:"◕",desc:"全体に占める割合。円・ドーナツグラフに。"},
  multivar:{name:"多変数",icon:"▦",desc:"1行1症例・1列1変数。重回帰・相関行列・PCAに。"},
  nested:{name:"入れ子",icon:"⧉",desc:"群の中に被験者、その中に技術的反復。"}
};
const APP_VERSION="2026.08.25";
let PROJ=null,SEL=null,UNDO=[],REDO=[];
function uid(){return Math.random().toString(36).slice(2,9);}
function toast(msg,err){
  const t=document.getElementById("toast");
  t.innerHTML=msg;t.className="on"+(err?" err":"");
  clearTimeout(toast._t);toast._t=setTimeout(()=>t.className="",2800);
}
function newRow(ng,ns){return {t:"",x:"",v:Array.from({length:ng},()=>new Array(ns).fill(""))};}
function makeDataSheet(ttype,name){
  const t=ttype||"column";
  const ng=t==="parts"?1:(t==="survival"?2:(t==="multivar"?4:3));
  const ns=(t==="grouped"||t==="nested")?3:1;
  const nr=t==="multivar"?14:10;
  const sh={id:uid(),kind:"data",ttype:t,name:name||(TTYPES[t].name+"データ"),
    sub:ns,subMode:"rep",xTitle:t==="survival"?"時間":"X",yTitle:"Y",
    xFormat:"numbers",groups:[],rows:[]};
  for(let g=0;g<ng;g++)sh.groups.push({name:defaultGroupName(t,g),color:GCOLORS[g%GCOLORS.length],symbol:"circle"});
  for(let r=0;r<nr;r++)sh.rows.push(newRow(ng,ns));
  if(t==="grouped"||t==="contingency"||t==="parts"||t==="nested")sh.rows.forEach((r,i)=>r.t=defaultRowName(t,i));
  return sh;
}
function defaultGroupName(t,g){
  if(t==="survival")return g===0?"群A":"群B";
  if(t==="multivar")return "変数"+(g+1);
  if(t==="contingency")return ["転帰あり","転帰なし","列C","列D"][g]||("列"+(g+1));
  if(t==="parts")return "値";
  return String.fromCharCode(65+g)+"群";
}
function defaultRowName(t,i){
  if(t==="contingency")return ["曝露あり","曝露なし","行C","行D"][i]||("行"+(i+1));
  if(t==="parts")return "分類"+(i+1);
  if(t==="grouped")return ["時点1","時点2","時点3","時点4"][i]||"";
  return "";
}
function sheetsOf(kind){return PROJ.sheets.filter(s=>s.kind===kind);}
function getSheet(id){return PROJ.sheets.find(s=>s.id===id);}
function addSheet(sh){PROJ.sheets.push(sh);return sh;}
function delSheet(id){
  const sh=getSheet(id);
  if(!sh)return;
  const kids=PROJ.sheets.filter(s=>s.srcId===id);
  if(kids.length&&!confirm("「"+sh.name+"」に紐づく解析・グラフ "+kids.length+" 件も削除されます。よろしいですか？"))return;
  snapshot();
  PROJ.sheets=PROJ.sheets.filter(s=>s.id!==id&&s.srcId!==id);
  if(SEL===id)SEL=PROJ.sheets[0]?PROJ.sheets[0].id:null;
  render();
}
function snapshot(){
  UNDO.push(JSON.stringify(PROJ));
  if(UNDO.length>40)UNDO.shift();
  REDO.length=0;
  markDirty();
}
function undo(){
  if(!UNDO.length)return toast("元に戻す操作はありません");
  REDO.push(JSON.stringify(PROJ));
  PROJ=JSON.parse(UNDO.pop());
  if(!getSheet(SEL))SEL=PROJ.sheets[0]&&PROJ.sheets[0].id;
  render();toast("元に戻しました");
}
function redo(){
  if(!REDO.length)return toast("やり直す操作はありません");
  UNDO.push(JSON.stringify(PROJ));
  PROJ=JSON.parse(REDO.pop());
  render();toast("やり直しました");
}
function markDirty(){
  clearTimeout(markDirty._t);
  markDirty._t=setTimeout(saveLocal,700);
}
function saveLocal(){
  try{
    localStorage.setItem("prismlab.project",JSON.stringify(PROJ));
    document.getElementById("savestate").textContent="自動保存 "+new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
  }catch(e){
    document.getElementById("savestate").textContent=
      (e&&e.name==="QuotaExceededError")?"自動保存できません（容量超過）":"自動保存オフ（「保存」でファイルに書き出せます）";
  }
}
function loadLocal(){
  try{
    const s=localStorage.getItem("prismlab.project");
    if(!s)return null;
    const p=JSON.parse(s);
    if(p&&p.sheets&&p.sheets.length)return p;
  }catch(e){}
  return null;
}
function newProject(ttype,quiet){
  PROJ={name:"無題のプロジェクト",created:new Date().toISOString(),sheets:[]};
  const d=makeDataSheet(ttype||"column","データ 1");
  PROJ.sheets.push(d);
  SEL=d.id;UNDO=[];REDO=[];
  render();
  if(!quiet)toast("新しいプロジェクトを作成しました");
}
/* ---- セル値ユーティリティ ---- */
function parseNum(raw){
  if(raw===undefined||raw===null)return NaN;
  let t=String(raw).trim().replace(/,/g,"");
  t=t.replace(/[０-９．＋－]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
  if(t===""||t==="-"||/^(NA|N\/A|NaN|\.)$/i.test(t))return NaN;
  const v=parseFloat(t);
  return isFinite(v)?v:NaN;
}
function cellNum(sh,r,g,s){
  const row=sh.rows[r];
  if(!row||!row.v[g])return NaN;
  return parseNum(row.v[g][s]);
}
function cellRaw(sh,r,g,s){
  const row=sh.rows[r];
  if(!row||!row.v[g])return "";
  const v=row.v[g][s];
  return v===undefined||v===null?"":String(v);
}
function colValues(sh,g){
  const out=[];
  for(let r=0;r<sh.rows.length;r++)for(let s=0;s<sh.sub;s++){
    const v=cellNum(sh,r,g,s);
    if(!isNaN(v))out.push(v);
  }
  return out;
}
function groupSets(sh){
  return sh.groups.map((g,i)=>({label:g.name||("列"+(i+1)),color:g.color,values:colValues(sh,i),idx:i}))
    .filter(g=>g.values.length>0);
}
function xyPairs(sh,g){
  const out=[];
  if(sh.ttype==="multivar"){ // 1列目をX、他の列をYとして扱う
    if(g===0)return out;
    for(let r=0;r<sh.rows.length;r++){
      const xv=cellNum(sh,r,0,0),yv=cellNum(sh,r,g,0);
      if(!isNaN(xv)&&!isNaN(yv))out.push([xv,yv,r,0]);
    }
    return out;
  }
  for(let r=0;r<sh.rows.length;r++){
    const xv=parseNum(sh.rows[r].x);
    if(isNaN(xv))continue;
    for(let s=0;s<sh.sub;s++){
      const yv=cellNum(sh,r,g,s);
      if(!isNaN(yv))out.push([xv,yv,r,s]);
    }
  }
  return out;
}
function xyMeans(sh,g){
  const out=[];
  if(sh.ttype==="multivar"){
    return xyPairs(sh,g).map(p=>({x:p[0],mean:p[1],sd:NaN,se:NaN,n:1,min:p[1],max:p[1],median:p[1],
      q1:p[1],q3:p[1],ciLo:NaN,ciHi:NaN,row:p[2],raw:[p[1]]}));
  }
  for(let r=0;r<sh.rows.length;r++){
    const xv=parseNum(sh.rows[r].x);
    if(isNaN(xv))continue;
    if(sh.subMode!=="rep"&&sh.sub>=2){
      const m=cellNum(sh,r,g,0),e=cellNum(sh,r,g,1),n=sh.sub>=3?cellNum(sh,r,g,2):NaN;
      if(isNaN(m))continue;
      const sdv=sh.subMode==="meansdn"?e:(isNaN(n)?NaN:e*Math.sqrt(n));
      const sev=sh.subMode==="meansen"?e:(isNaN(n)?NaN:e/Math.sqrt(n));
      out.push({x:xv,mean:m,sd:sdv,se:sev,n:n,row:r,raw:[],
        ciLo:isNaN(n)?NaN:m-tQuantile(0.975,n-1)*sev,ciHi:isNaN(n)?NaN:m+tQuantile(0.975,n-1)*sev,
        min:m-sdv,max:m+sdv,median:m,q1:m,q3:m});
      continue;
    }
    const vals=[];
    for(let s=0;s<sh.sub;s++){const v=cellNum(sh,r,g,s);if(!isNaN(v))vals.push(v);}
    if(!vals.length)continue;
    const d=describeFull(vals);
    out.push({x:xv,mean:d.mean,sd:d.sd,se:d.se,n:d.n,min:d.min,max:d.max,median:d.median,
      q1:d.q1,q3:d.q3,ciLo:d.ciLo,ciHi:d.ciHi,row:r,raw:vals});
  }
  return out;
}
function cellsOf(sh){
  return sh.rows.map((row,r)=>sh.groups.map((g,c)=>{
    const vals=[];
    for(let s=0;s<sh.sub;s++){const v=cellNum(sh,r,c,s);if(!isNaN(v))vals.push(v);}
    return vals;
  }));
}
function usedRows(sh){
  let last=-1;
  sh.rows.forEach((r,i)=>{
    const any=(r.x&&r.x!=="")||(r.t&&r.t!=="")||r.v.some(g=>g.some(v=>v!==""&&v!==undefined&&v!==null));
    if(any)last=i;
  });
  return last+1;
}
function activeRowLabels(sh){
  const n=usedRows(sh);
  return sh.rows.slice(0,n).map((r,i)=>r.t||("行"+(i+1)));
}
