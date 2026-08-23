/* =====================================================================
   データ表（スプレッドシート）
   ===================================================================== */
let GSEL=null; // {r1,c1,r2,c2} 値セルの選択範囲（cはフラット列 = g*sub+s）
let DRAG=false;
function subLabel(sh,g,s){
  if(sh.ttype==="survival")return "";
  if(sh.sub===1)return "";
  if(sh.subMode==="meansdn")return ["平均","SD","N"][s]||("値"+(s+1));
  if(sh.subMode==="meansen")return ["平均","SEM","N"][s]||("値"+(s+1));
  if(sh.subMode==="meancin")return ["平均","±CI","N"][s]||("値"+(s+1));
  if(sh.ttype==="nested")return "被験者"+(s+1);
  return String.fromCharCode(65+g%26)+":Y"+(s+1);
}
function hasX(sh){return sh.ttype==="xy"||sh.ttype==="survival";}
function hasTitle(sh){return ["column","grouped","contingency","parts","nested","multivar"].includes(sh.ttype);}
function renderDataSheet(sh,view){
  const nUsed=usedRows(sh);
  const nShow=Math.max(nUsed+6,14);
  while(sh.rows.length<nShow)sh.rows.push(newRow(sh.groups.length,sh.sub));
  sh.rows.forEach(r=>{
    while(r.v.length<sh.groups.length)r.v.push(new Array(sh.sub).fill(""));
    r.v.forEach(g=>{while(g.length<sh.sub)g.push("");});
  });
  const G=sh.groups.length,S=sh.sub;
  let h='<div class="tablewrap"><table class="grid"><colgroup>';
  h+='<col style="width:38px">';
  if(hasTitle(sh))h+='<col style="width:120px">';
  if(hasX(sh))h+='<col style="width:96px">';
  for(let g=0;g<G;g++)for(let s=0;s<S;s++)h+='<col class="gcol" style="width:80px">';
  h+="</colgroup><thead>";
  // 1行目：データセット名
  h+='<tr class="grp"><th class="corner rowhdr"></th>';
  if(hasTitle(sh))h+='<th rowspan="2">'+(sh.ttype==="multivar"?"症例":"行タイトル")+"</th>";
  if(hasX(sh))h+='<th rowspan="2"><input value="'+esc(sh.xTitle||"X")+'" data-xtitle="1" title="X列の見出し"></th>';
  for(let g=0;g<G;g++){
    h+='<th colspan="'+S+'"><div class="grpname"><span class="swatch" data-gcolor="'+g+'" style="background:'+sh.groups[g].color+'" title="色を変える"></span>'
      +'<input value="'+esc(sh.groups[g].name)+'" data-gname="'+g+'" style="width:'+Math.max(60,S*66)+'px">'
      +'<span class="kill" data-gdel="'+g+'" style="opacity:.5;cursor:pointer" title="この列を削除">×</span></div></th>';
  }
  h+="</tr>";
  h+='<tr class="sub"><th class="corner rowhdr" style="top:26px">#</th>';
  for(let g=0;g<G;g++)for(let s=0;s<S;s++)h+="<th>"+(sh.ttype==="survival"?(g===0?"符号":"符号"):subLabel(sh,g,s))+"</th>";
  h+="</tr></thead><tbody>";
  for(let r=0;r<nShow;r++){
    const row=sh.rows[r];
    h+='<tr><td class="rowhdr">'+(r+1)+"</td>";
    if(hasTitle(sh))h+='<td class="titlecol"><input value="'+esc(row.t||"")+'" data-r="'+r+'" data-t="1"></td>';
    if(hasX(sh))h+='<td class="xcol"><input value="'+esc(row.x||"")+'" data-r="'+r+'" data-x="1"></td>';
    for(let g=0;g<G;g++)for(let s=0;s<S;s++){
      const c=g*S+s;
      const sel=GSEL&&r>=Math.min(GSEL.r1,GSEL.r2)&&r<=Math.max(GSEL.r1,GSEL.r2)&&c>=Math.min(GSEL.c1,GSEL.c2)&&c<=Math.max(GSEL.c1,GSEL.c2);
      h+='<td'+(sel?' class="sel"':"")+'><input value="'+esc(row.v[g][s]||"")+'" data-r="'+r+'" data-g="'+g+'" data-s="'+s+'" data-c="'+c+'"></td>';
    }
    h+="</tr>";
  }
  h+="</tbody></table></div>";
  h+='<div class="tblfoot"><span class="hint">📋 Excelからコピーしたセルは <kbd>Ctrl</kbd>+<kbd>V</kbd> でそのまま貼り付けできます。'
    +'ドラッグで範囲選択→<kbd>Delete</kbd>で消去、<kbd>Ctrl</kbd>+<kbd>C</kbd>でコピー。</span></div>';
  if(sh.ttype==="survival")h+='<div class="warnbox">生存表の入力：<b>X列＝観察期間</b>、各群の列に <b>1＝イベント（死亡・再発）</b>／<b>0＝打ち切り</b> を入力します。1行が1症例です。</div>';
  if(sh.ttype==="contingency")h+='<div class="warnbox">分割表には<b>度数（人数）</b>を入力します。割合や平均値は入れないでください。</div>';
  if(sh.ttype==="nested")h+='<div class="warnbox">入れ子表：各データセット（群）のサブ列が<b>被験者</b>、行が<b>同一被験者内の技術的反復</b>です。</div>';
  view.innerHTML='<div id="tblroot">'+h+"</div>";
  bindTable(sh,document.getElementById("tblroot"));
}
function bindTable(sh,view){
  const S=sh.sub;
  const setCell=(r,g,s,v)=>{
    while(sh.rows.length<=r)sh.rows.push(newRow(sh.groups.length,sh.sub));
    const row=sh.rows[r];
    while(row.v.length<sh.groups.length)row.v.push(new Array(sh.sub).fill(""));
    while(row.v[g].length<sh.sub)row.v[g].push("");
    row.v[g][s]=v;
  };
  view.addEventListener("change",(e)=>{
    const i=e.target;
    if(i.tagName!=="INPUT")return;
    snapshot();
    if(i.dataset.gname!==undefined){sh.groups[+i.dataset.gname].name=i.value;refreshDeps(sh);renderNav();return;}
    if(i.dataset.xtitle!==undefined){sh.xTitle=i.value;refreshDeps(sh);return;}
    const r=+i.dataset.r;
    if(i.dataset.t!==undefined){sh.rows[r].t=i.value;refreshDeps(sh);return;}
    if(i.dataset.x!==undefined){sh.rows[r].x=i.value;refreshDeps(sh);return;}
    setCell(r,+i.dataset.g,+i.dataset.s,i.value);
    refreshDeps(sh);
  });
  view.addEventListener("click",(e)=>{
    const sw=e.target.closest("[data-gcolor]");
    if(sw){groupStyleDialog(sh,+sw.dataset.gcolor);return;}
    const gd=e.target.closest("[data-gdel]");
    if(gd){
      const g=+gd.dataset.gdel;
      if(sh.groups.length<=1)return toast("最後の列は削除できません",true);
      if(!confirm("「"+sh.groups[g].name+"」列を削除しますか？"))return;
      snapshot();sh.groups.splice(g,1);sh.rows.forEach(row=>row.v.splice(g,1));refreshDeps(sh);renderSheet();
    }
  });
  // 範囲選択
  view.addEventListener("mousedown",(e)=>{
    const i=e.target.closest("input[data-c]");
    if(!i)return;
    DRAG=true;
    GSEL={r1:+i.dataset.r,c1:+i.dataset.c,r2:+i.dataset.r,c2:+i.dataset.c};
    paintSel(view);
  });
  view.addEventListener("mouseover",(e)=>{
    if(!DRAG)return;
    const i=e.target.closest("input[data-c]");
    if(!i||!GSEL)return;
    GSEL.r2=+i.dataset.r;GSEL.c2=+i.dataset.c;
    paintSel(view);
  });
  if(!bindTable._mu){bindTable._mu=true;document.addEventListener("mouseup",()=>{DRAG=false;});}
  view.addEventListener("keydown",(e)=>{
    const i=e.target;
    if(i.tagName!=="INPUT")return;
    const r=+i.dataset.r;
    const move=(dr,dc)=>{
      e.preventDefault();
      const cur=i.dataset.c!==undefined?+i.dataset.c:(i.dataset.x!==undefined?-1:-2);
      let nr=r+dr,nc=cur+dc;
      const maxC=sh.groups.length*sh.sub-1;
      if(nc>maxC){nc=hasTitle(sh)?-2:(hasX(sh)?-1:0);nr++;}
      if(nc<(hasTitle(sh)?-2:(hasX(sh)?-1:0)))nc=maxC;
      if(nr<0)nr=0;
      const sel=nc===-2?'input[data-r="'+nr+'"][data-t]':nc===-1?'input[data-r="'+nr+'"][data-x]':'input[data-r="'+nr+'"][data-c="'+nc+'"]';
      let t=view.querySelector(sel);
      if(!t&&nr>=sh.rows.length-1){
        i.blur();sh.rows.push(newRow(sh.groups.length,sh.sub));renderSheet();
        t=document.querySelector("#sheetview "+sel);
      }
      if(t){t.focus();t.select();}
    };
    if(e.key==="ArrowDown"||e.key==="Enter")move(1,0);
    else if(e.key==="ArrowUp")move(-1,0);
    else if(e.key==="ArrowRight"&&i.selectionStart===i.value.length)move(0,1);
    else if(e.key==="ArrowLeft"&&i.selectionStart===0)move(0,-1);
    else if((e.key==="Delete"||e.key==="Backspace")&&GSEL&&Math.abs(GSEL.r2-GSEL.r1)+Math.abs(GSEL.c2-GSEL.c1)>0){
      e.preventDefault();clearRange(sh);
    }else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="c"&&GSEL){copyRange(sh);}
  });
  view.addEventListener("paste",(e)=>{
    const i=e.target;
    if(i.tagName!=="INPUT")return;
    const txt=(e.clipboardData||window.clipboardData).getData("text");
    if(!txt||(!txt.includes("\t")&&!txt.includes("\n")))return;
    e.preventDefault();
    snapshot();
    const rows=txt.replace(/\r/g,"").split("\n").filter((l,idx,a)=>l!==""||idx<a.length-1);
    const r0=+i.dataset.r;
    let c0=i.dataset.c!==undefined?+i.dataset.c:0;
    const useX=i.dataset.x!==undefined,useT=i.dataset.t!==undefined;
    rows.forEach((line,dr)=>{
      const cells=line.split("\t");
      const r=r0+dr;
      while(sh.rows.length<=r)sh.rows.push(newRow(sh.groups.length,sh.sub));
      cells.forEach((cv,dc)=>{
        if((useX||useT)&&dc===0){
          if(useX)sh.rows[r].x=cv.trim();else sh.rows[r].t=cv.trim();
          return;
        }
        const c=c0+dc-((useX||useT)?1:0);
        const g=Math.floor(c/S),s=c%S;
        if(g>=sh.groups.length)return;
        setCell(r,g,s,cv.trim());
      });
    });
    refreshDeps(sh);renderSheet();
    toast(rows.length+"行を貼り付けました");
  });
}
function paintSel(view){
  const r1=Math.min(GSEL.r1,GSEL.r2),r2=Math.max(GSEL.r1,GSEL.r2);
  const c1=Math.min(GSEL.c1,GSEL.c2),c2=Math.max(GSEL.c1,GSEL.c2);
  view.querySelectorAll("td.sel").forEach(td=>td.classList.remove("sel"));
  view.querySelectorAll("input[data-c]").forEach(i=>{
    const r=+i.dataset.r,c=+i.dataset.c;
    if(r>=r1&&r<=r2&&c>=c1&&c<=c2)i.parentElement.classList.add("sel");
  });
}
function clearRange(sh){
  snapshot();
  const r1=Math.min(GSEL.r1,GSEL.r2),r2=Math.max(GSEL.r1,GSEL.r2);
  const c1=Math.min(GSEL.c1,GSEL.c2),c2=Math.max(GSEL.c1,GSEL.c2);
  for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){
    const g=Math.floor(c/sh.sub),s=c%sh.sub;
    if(sh.rows[r]&&sh.rows[r].v[g])sh.rows[r].v[g][s]="";
  }
  refreshDeps(sh);renderSheet();
}
function copyRange(sh){
  const r1=Math.min(GSEL.r1,GSEL.r2),r2=Math.max(GSEL.r1,GSEL.r2);
  const c1=Math.min(GSEL.c1,GSEL.c2),c2=Math.max(GSEL.c1,GSEL.c2);
  const lines=[];
  for(let r=r1;r<=r2;r++){
    const cells=[];
    for(let c=c1;c<=c2;c++){
      const g=Math.floor(c/sh.sub),s=c%sh.sub;
      cells.push(cellRaw(sh,r,g,s));
    }
    lines.push(cells.join("\t"));
  }
  navigator.clipboard.writeText(lines.join("\n")).then(()=>toast("コピーしました"));
}
function clearSelection(sh){
  if(!GSEL)return toast("消去したい範囲をドラッグで選んでください",true);
  clearRange(sh);
}
function addGroup(sh){
  const g=sh.groups.length;
  sh.groups.push({name:defaultGroupName(sh.ttype,g),color:GCOLORS[g%GCOLORS.length],symbol:SYMBOLS[g%SYMBOLS.length]});
  sh.rows.forEach(r=>r.v.push(new Array(sh.sub).fill("")));
  refreshDeps(sh);
}
function refreshDeps(sh){
  markDirty();
  // データが変わったら、この表に紐づく解析結果のキャッシュを捨てる
  if(typeof RESCACHE!=="undefined")PROJ.sheets.forEach(s=>{if(s.kind==="result"&&s.srcId===sh.id)delete RESCACHE[s.id];});
}
function groupStyleDialog(sh,g){
  const grp=sh.groups[g];
  const h='<div class="frow"><label>名前</label><input type="text" name="nm" value="'+esc(grp.name)+'" style="width:220px"></div>'
   +'<div class="frow"><label>色</label><input type="color" name="col" value="'+grp.color+'">'
   +'<div class="swatches">'+GCOLORS.map(c=>'<div class="sw" data-c="'+c+'" style="background:'+c+'"></div>').join("")+"</div></div>"
   +'<div class="frow"><label>記号</label><select name="sym">'+SYMBOLS.map(s=>'<option value="'+s+'"'+(grp.symbol===s?" selected":"")+">"+symbolName(s)+"</option>").join("")+"</select></div>";
  modal("データセットの書式",h,[{label:"キャンセル"},{label:"適用",primary:true,action:(bg)=>{
    snapshot();
    grp.name=val(bg,"nm");grp.color=val(bg,"col");grp.symbol=val(bg,"sym");
    refreshDeps(sh);render();
  }}],{width:520,onOpen:(bg)=>{
    qa(bg,".sw").forEach(s=>s.addEventListener("click",()=>{q(bg,'[name="col"]').value=s.dataset.c;}));
  }});
}
function symbolName(s){
  return {circle:"● 円",square:"■ 四角",triangle:"▲ 三角",'triangle-down':"▼ 逆三角",diamond:"◆ ひし形",
    plus:"＋ プラス",cross:"✕ バツ",star:"★ 星",hexagon:"⬢ 六角形",bar:"― 横棒"}[s]||s;
}
