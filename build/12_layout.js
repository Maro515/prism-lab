/* =====================================================================
   レイアウト（複数グラフを1枚の図に組む）
   ===================================================================== */
function layoutItems(sh){
  return (sh.items||[]).map(it=>getSheet(it.gid)).filter(Boolean);
}
function buildLayoutSVG(sh){
  const gs=layoutItems(sh);
  if(!gs.length)return emptySVG("「設定」からグラフを選んでください");
  const cols=Math.max(1,sh.cols||2),gap=sh.gap===undefined?18:sh.gap;
  const parts=gs.map((g,i)=>{
    let svg=buildGraphSVG(g);
    svg=svg.replace(/id="cp"/g,'id="cp'+i+'"').replace(/url\(#cp\)/g,"url(#cp"+i+")");
    const m=svg.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
    const w=m?+m[1]:400,h=m?+m[2]:300;
    const inner=svg.replace(/^[\s\S]*?<svg[^>]*>/,"").replace(/<\/svg>\s*$/,"");
    return {w,h,inner,name:g.name};
  });
  const rows=Math.ceil(parts.length/cols);
  const colW=[],rowH=[];
  for(let c=0;c<cols;c++)colW[c]=Math.max(...parts.filter((_,i)=>i%cols===c).map(p=>p.w),10);
  for(let r=0;r<rows;r++)rowH[r]=Math.max(...parts.slice(r*cols,(r+1)*cols).map(p=>p.h),10);
  const labelH=sh.labels!==false?22:0;
  const W=sum(colW)+gap*(cols-1)+20,H=sum(rowH)+(gap+labelH)*rows+16+(sh.title?26:0);
  let body='<rect width="'+W+'" height="'+H+'" fill="#fff"/>';
  if(sh.title)body+=tspanText(W/2,22,esc(sh.title),{anchor:"middle",fs:16,bold:true});
  let y=10+(sh.title?26:0);
  for(let r=0;r<rows;r++){
    let x=10;
    for(let c=0;c<cols;c++){
      const i=r*cols+c;
      if(i>=parts.length)break;
      const p=parts[i];
      if(sh.labels!==false){
        const lab=(sh.labelStyle==="lower"?"abcdefghij"[i]:(sh.labelStyle==="num"?String(i+1):"ABCDEFGHIJ"[i]))||String(i+1);
        body+=tspanText(x,y+16,lab,{fs:17,bold:true});
      }
      body+='<g transform="translate('+x+","+(y+labelH)+')">'+p.inner+"</g>";
      x+=colW[c]+gap;
    }
    y+=rowH[r]+gap+labelH;
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+" "+H+'" font-family="Arial, Helvetica, sans-serif">'+body+"</svg>";
}
function renderLayoutSheet(sh,view){
  view.innerHTML='<div id="graphstage"><div class="graphpaper" id="gpaper">'+buildLayoutSVG(sh)+"</div></div>";
}
function renderLayoutInspector(sh){
  const graphs=sheetsOf("graph");
  let h='<div class="insp-h">🗂 レイアウトの設定</div><div class="acc"><div class="body">'
   +insRow("図のタイトル",'<input type="text" data-lay="title" value="'+esc(sh.title||"")+'" style="width:190px">')
   +insRow("列数",'<input type="number" data-lay="cols" value="'+(sh.cols||2)+'" min="1" max="5" style="width:70px">')
   +insRow("間隔",'<input type="number" data-lay="gap" value="'+(sh.gap===undefined?18:sh.gap)+'" min="0" max="80" style="width:70px">')
   +'<label class="chk" style="display:block;margin:6px 0"><input type="checkbox" data-lay="labels"'+(sh.labels!==false?" checked":"")+"> パネル記号（A・B・C…）を付ける</label>"
   +insRow("記号の形式",'<select data-lay="labelStyle"><option value="upper"'+(sh.labelStyle!=="lower"&&sh.labelStyle!=="num"?" selected":"")+">A B C</option>"
     +'<option value="lower"'+(sh.labelStyle==="lower"?" selected":"")+">a b c</option>"
     +'<option value="num"'+(sh.labelStyle==="num"?" selected":"")+">1 2 3</option></select>")
   +"</div></div>";
  h+='<details class="acc" open><summary>収録するグラフ</summary><div class="body">';
  if(!graphs.length)h+='<p class="mini">まだグラフがありません。データ表から「グラフ作成」してください。</p>';
  graphs.forEach(g=>{
    const on=(sh.items||[]).some(it=>it.gid===g.id);
    h+='<label class="chk" style="display:block;margin:4px 0"><input type="checkbox" data-layitem="'+g.id+'"'+(on?" checked":"")+"> "+esc(g.name)+"</label>";
  });
  h+='<p class="mini" style="margin-top:8px">チェックした順ではなく、下の並び替えで順序を変えられます。</p>';
  if((sh.items||[]).length>1){
    h+='<div style="margin-top:6px">'+(sh.items||[]).map((it,i)=>{
      const g=getSheet(it.gid);
      return '<div class="frow" style="gap:4px"><span class="mini" style="flex:1">'+(i+1)+". "+esc(g?g.name:"?")+"</span>"
        +'<button class="tbtn ghost" data-laymove="'+i+'" data-dir="-1">↑</button>'
        +'<button class="tbtn ghost" data-laymove="'+i+'" data-dir="1">↓</button></div>';
    }).join("")+"</div>";
  }
  h+="</div></details>";
  h+='<details class="acc" open><summary>出力</summary><div class="body">'
   +'<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="tbtn" data-act="svg">SVGで保存</button>'
   +'<button class="tbtn" data-act="png">PNGで保存</button><button class="tbtn" data-act="pdf">PDFで保存</button><button class="tbtn" data-act="print">印刷</button></div>'
   +'<p class="mini" style="margin-top:8px">論文の Figure 1 のように複数パネルを1枚にまとめて書き出せます。</p></div></details>';
  document.getElementById("inspector").innerHTML=h;
}
function layoutDialog(sh){
  document.getElementById("inspector").classList.add("on");
  renderLayoutInspector(sh);
  toast("右側のパネルで設定できます");
}
document.addEventListener("change",(e)=>{
  const sh=getSheet(SEL);
  if(!sh||sh.kind!=="layout")return;
  const t=e.target;
  if(t.dataset.lay!==undefined){
    let v=t.type==="checkbox"?t.checked:t.value;
    if(t.type==="number")v=parseFloat(v);
    sh[t.dataset.lay]=v;markDirty();renderLayoutSheet(sh,document.getElementById("sheetview"));
  }
  if(t.dataset.layitem!==undefined){
    sh.items=sh.items||[];
    if(t.checked){if(!sh.items.some(i=>i.gid===t.dataset.layitem))sh.items.push({gid:t.dataset.layitem});}
    else sh.items=sh.items.filter(i=>i.gid!==t.dataset.layitem);
    markDirty();renderSheet();
  }
});
document.addEventListener("click",(e)=>{
  const mv=e.target.closest("[data-laymove]");
  if(!mv)return;
  const sh=getSheet(SEL);
  if(!sh||sh.kind!=="layout")return;
  const i=+mv.dataset.laymove,d=+mv.dataset.dir,j=i+d;
  if(j<0||j>=sh.items.length)return;
  const t=sh.items[i];sh.items[i]=sh.items[j];sh.items[j]=t;
  markDirty();renderSheet();
});
