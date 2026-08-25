
/* =====================================================================
   画面の骨格：ナビゲータ・ツールバー・シート切替
   ===================================================================== */
const KINDMETA={
  data:{label:"データ表",color:"var(--c-data)"},
  info:{label:"情報",color:"var(--c-info)"},
  result:{label:"結果",color:"var(--c-result)"},
  graph:{label:"グラフ",color:"var(--c-graph)"},
  layout:{label:"レイアウト",color:"var(--c-layout)"}
};
function render(){
  if(!PROJ)return;
  document.getElementById("projName").value=PROJ.name;
  renderNav();renderToolbar();renderSheet();
}
function renderNav(){
  const nav=document.getElementById("nav");
  let h="";
  for(const kind of ["data","info","result","graph","layout"]){
    const items=sheetsOf(kind);
    const meta=KINDMETA[kind];
    h+='<div class="navsec"><h4><span class="dot" style="background:'+meta.color+'"></span>'+meta.label+'<span class="cnt">'+items.length+'</span></h4>';
    for(const s of items){
      const src=s.srcId?getSheet(s.srcId):null;
      h+='<div class="navitem'+(s.id===SEL?" sel":"")+'" data-nav="'+s.id+'" title="'+esc(s.name)+(src?" ← "+esc(src.name):"")+'">'
        +'<span style="flex:1;overflow:hidden;text-overflow:ellipsis">'+esc(s.name)+'</span>'
        +'<span class="kill" data-del="'+s.id+'" title="削除">×</span></div>';
    }
    if(kind==="data")h+='<div class="navadd" data-act="newdata">＋ データ表を追加</div>';
    if(kind==="info")h+='<div class="navadd" data-act="newinfo">＋ メモを追加</div>';
    if(kind==="layout")h+='<div class="navadd" data-act="newlayout">＋ レイアウトを追加</div>';
    h+="</div>";
  }
  nav.innerHTML=h;
}
function tbtn(act,label,opt){
  opt=opt||{};
  return '<button class="tbtn'+(opt.primary?" primary":"")+(opt.ghost?" ghost":"")+'" data-act="'+act+'"'
    +(opt.title?' title="'+esc(opt.title)+'"':"")+(opt.dis?" disabled":"")+'>'
    +(opt.ic?'<span class="ic">'+opt.ic+"</span>":"")+label+"</button>";
}
function renderToolbar(){
  const sh=getSheet(SEL);
  let h='<div class="tb"><b>ファイル</b>'
    +tbtn("newproj","新規",{ic:"📄"})
    +tbtn("open","開く",{ic:"📂"})
    +tbtn("save","保存",{ic:"💾"})
    +tbtn("undo","",{ic:"↶",title:"元に戻す (Ctrl+Z)"})
    +tbtn("redo","",{ic:"↷",title:"やり直し (Ctrl+Shift+Z)"})
    +"</div>";
  if(sh&&sh.kind==="data"){
    h+='<div class="tb"><b>データ</b>'
      +tbtn("import","読み込み",{ic:"📥",title:"CSV / Excel(.xlsx) / クリップボード"})
      +tbtn("exportcsv","CSV書出",{ic:"📤"})
      +tbtn("demo","サンプル",{ic:"🧪",title:"デモデータを入れる"})
      +tbtn("tblopt","表の設定",{ic:"⚙"})
      +"</div>"
      +'<div class="tb"><b>編集</b>'
      +tbtn("addrow","＋行")+tbtn("addcol","＋列")+tbtn("transform","変換",{ic:"ƒ"})
      +tbtn("clearsel","消去")+"</div>"
      +'<div class="tb"><b>解析</b>'
      +tbtn("analyze","解析",{primary:true,ic:"Σ"})
      +tbtn("newgraph","グラフ作成",{primary:true,ic:"📊"})
      +"</div>";
  }else if(sh&&sh.kind==="graph"){
    h+='<div class="tb"><b>グラフ</b>'
      +tbtn("format","書式",{ic:"🎨",primary:true})
      +tbtn("changetype","種類を変更",{ic:"🔀"})
      +tbtn("addbracket","有意差ブラケット",{ic:"⌐"})
      +"</div>"
      +'<div class="tb"><b>出力</b>'
      +tbtn("svg","SVG",{ic:"⬇"})+tbtn("png","PNG",{ic:"⬇"})
      +tbtn("pdf","PDF",{ic:"⬇"})+tbtn("copyimg","コピー",{ic:"📋"})+tbtn("print","印刷",{ic:"🖨"})
      +"</div>"
      +'<div class="tb">'+tbtn("gotosrc","元データへ",{ghost:true,ic:"↩"})+tbtn("dup","複製",{ghost:true})+"</div>";
  }else if(sh&&sh.kind==="result"){
    h+='<div class="tb"><b>結果</b>'
      +tbtn("recalc","再計算",{ic:"↻"})
      +tbtn("editanal","設定を変更",{ic:"⚙",primary:true})
      +tbtn("rescsv","CSV書出",{ic:"📤"})
      +tbtn("rescopy","コピー",{ic:"📋"})
      +tbtn("print","印刷/PDF",{ic:"🖨"})+"</div>"
      +'<div class="tb">'+tbtn("gotosrc","元データへ",{ghost:true,ic:"↩"})+"</div>";
  }else if(sh&&sh.kind==="layout"){
    h+='<div class="tb"><b>レイアウト</b>'+tbtn("layoutopt","設定",{ic:"⚙",primary:true})
      +tbtn("svg","SVG",{ic:"⬇"})+tbtn("png","PNG",{ic:"⬇"})+tbtn("pdf","PDF",{ic:"⬇"})
      +tbtn("print","印刷",{ic:"🖨"})+"</div>";
  }else if(sh&&sh.kind==="info"){
    h+='<div class="tb">'+tbtn("print","印刷/PDF",{ic:"🖨"})+"</div>";
  }
  h+='<div class="tb">'+tbtn("help","使い方",{ghost:true,ic:"❓"})+"</div>";
  document.getElementById("toolbar").innerHTML=h;
}
function renderSheet(){
  const sh=getSheet(SEL);
  const bar=document.getElementById("sheetbar"),view=document.getElementById("sheetview");
  const insp=document.getElementById("inspector");
  if(!sh){
    bar.innerHTML="";view.innerHTML='<div class="empty"><h2>シートがありません</h2>左のナビゲータから新しいデータ表を作成してください。</div>';
    insp.className="";return;
  }
  const meta=KINDMETA[sh.kind];
  let sub="";
  if(sh.kind==="data")sub=TTYPES[sh.ttype].name+"表 ／ "+sh.groups.length+"データセット × "+sh.sub+"サブ列";
  if(sh.srcId){const s=getSheet(sh.srcId);if(s)sub="元データ：<a href=\"javascript:void(0)\" data-act=\"gotosrc\" style=\"color:var(--accent);font-weight:700\">"+esc(s.name)+"</a>";}
  bar.innerHTML='<span class="stag" style="background:'+meta.color+'">'+meta.label+"</span>"
    +'<input class="stitle" id="sheetTitle" value="'+esc(sh.name)+'" style="border:1px solid transparent;background:transparent;font-weight:800;font-size:14px;width:280px;border-radius:5px;padding:2px 6px">'
    +'<span class="hint">'+sub+"</span><span class=\"spacer\"></span>"
    +(sh.kind==="graph"?'<span class="hint">グラフをクリックすると要素を編集できます</span>':"");
  if(sh.kind==="data")renderDataSheet(sh,view);
  else if(sh.kind==="result")renderResultSheet(sh,view);
  else if(sh.kind==="graph")renderGraphSheet(sh,view);
  else if(sh.kind==="layout")renderLayoutSheet(sh,view);
  else renderInfoSheet(sh,view);
  if(sh.kind==="graph"){insp.className="on";renderInspector(sh);}
  else if(sh.kind==="layout"){insp.className="on";renderLayoutInspector(sh);}
  else insp.className="";
}
function selectSheet(id){
  SEL=id;
  render();
  document.getElementById("sheetview").scrollTop=0;
}
/* ---- クリック処理（委譲） ---- */
document.addEventListener("click",(e)=>{
  const nav=e.target.closest("[data-nav]");
  const del=e.target.closest("[data-del]");
  if(del){delSheet(del.dataset.del);e.stopPropagation();return;}
  if(nav){selectSheet(nav.dataset.nav);return;}
  const act=e.target.closest("[data-act]");
  if(act){doAction(act.dataset.act,act);return;}
});
document.addEventListener("input",(e)=>{
  if(e.target.id==="projName"){PROJ.name=e.target.value;markDirty();}
  if(e.target.id==="sheetTitle"){
    const sh=getSheet(SEL);
    if(sh){sh.name=e.target.value;markDirty();renderNav();}
  }
});
document.addEventListener("keydown",(e)=>{
  const mod=e.metaKey||e.ctrlKey;
  if(mod&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();}
  if(mod&&e.key.toLowerCase()==="s"){e.preventDefault();doAction("save");}
});
function doAction(act,el){
  const sh=getSheet(SEL);
  switch(act){
    case "newproj":if(confirm("現在のプロジェクトを破棄して新規作成しますか？"))pickTableType(t=>newProject(t));break;
    case "newdata":pickTableType(t=>{snapshot();const s=addSheet(makeDataSheet(t,"データ "+(sheetsOf("data").length+1)));selectSheet(s.id);});break;
    case "newinfo":snapshot();{const s=addSheet({id:uid(),kind:"info",name:"メモ "+(sheetsOf("info").length+1),text:""});selectSheet(s.id);}break;
    case "newlayout":snapshot();{const s=addSheet({id:uid(),kind:"layout",name:"レイアウト "+(sheetsOf("layout").length+1),items:[],cols:2,gap:16,labels:true,pageW:190});selectSheet(s.id);}break;
    case "open":openProject();break;
    case "save":saveProject();break;
    case "undo":undo();break;
    case "redo":redo();break;
    case "import":importDialog();break;
    case "exportcsv":exportCSV(sh);break;
    case "demo":demoDialog();break;
    case "tblopt":tableOptionsDialog(sh);break;
    case "addrow":snapshot();for(let i=0;i<5;i++)sh.rows.push(newRow(sh.groups.length,sh.sub));renderSheet();break;
    case "addcol":snapshot();addGroup(sh);renderSheet();break;
    case "transform":transformDialog(sh);break;
    case "clearsel":clearSelection(sh);break;
    case "analyze":analyzeDialog(sh);break;
    case "newgraph":graphDialog(sh);break;
    case "format":document.getElementById("inspector").classList.toggle("on");break;
    case "changetype":graphTypeDialog(sh);break;
    case "addbracket":bracketDialog(sh);break;
    case "svg":exportSVG(sh);break;
    case "png":exportPNG(sh);break;
    case "pdf":exportPDF(sh);break;
    case "copyimg":copyImage(sh);break;
    case "print":window.print();break;
    case "gotosrc":if(sh.srcId)selectSheet(sh.srcId);break;
    case "dup":snapshot();{const c=JSON.parse(JSON.stringify(sh));c.id=uid();c.name=sh.name+" のコピー";addSheet(c);selectSheet(c.id);}break;
    case "recalc":renderSheet();toast("再計算しました");break;
    case "editanal":analyzeDialog(getSheet(sh.srcId),sh);break;
    case "rescsv":exportResultCSV(sh);break;
    case "rescopy":copyResultTSV(sh);break;
    case "layoutopt":layoutDialog(sh);break;
    case "help":helpDialog();break;
  }
}
/* ---- モーダル ---- */
function modal(title,bodyHtml,buttons,opts){
  opts=opts||{};
  const root=document.getElementById("modalRoot");
  const bg=document.createElement("div");
  bg.className="modal-bg";
  bg.innerHTML='<div class="modal" style="'+(opts.width?"max-width:"+opts.width+"px":"")+'">'
    +"<h3>"+title+'<span class="spacer"></span><button class="tbtn ghost" data-mclose="1">✕</button></h3>'
    +'<div class="mbody">'+bodyHtml+"</div>"
    +'<div class="mfoot">'+(buttons||[]).map((b,i)=>'<button class="tbtn'+(b.primary?" primary":"")+'" data-mbtn="'+i+'">'+b.label+"</button>").join("")+"</div></div>";
  root.appendChild(bg);
  const close=()=>{root.removeChild(bg);};
  bg.addEventListener("click",(e)=>{
    if(e.target===bg&&!opts.noBackdropClose)return close();
    const c=e.target.closest("[data-mclose]");
    if(c)return close();
    const b=e.target.closest("[data-mbtn]");
    if(b){
      const btn=buttons[+b.dataset.mbtn];
      if(!btn.action||btn.action(bg,close)!==false)close();
    }
  });
  if(opts.onOpen)opts.onOpen(bg,close);
  return {el:bg,close};
}
function q(bg,sel){return bg.querySelector(sel);}
function qa(bg,sel){return Array.from(bg.querySelectorAll(sel));}
function val(bg,name){const e=bg.querySelector('[name="'+name+'"]');return e?(e.type==="checkbox"?e.checked:e.value):null;}
/* ---- 表タイプ選択 ---- */
function pickTableType(cb){
  let h='<p class="mini">作りたいデータの形を選んでください。あとから変更もできます。</p><div class="picker" style="grid-template-columns:1fr"><div class="items">';
  for(const k in TTYPES){
    h+='<div class="tile" data-tt="'+k+'"><div style="font-size:26px">'+TTYPES[k].icon+'</div><div class="tn">'+TTYPES[k].name+'表</div><div class="td">'+TTYPES[k].desc+"</div></div>";
  }
  h+="</div></div>";
  modal("データ表の種類を選ぶ",h,[{label:"キャンセル"}],{width:760,onOpen:(bg,close)=>{
    qa(bg,"[data-tt]").forEach(t=>t.addEventListener("click",()=>{close();cb(t.dataset.tt);}));
  }});
}
function helpDialog(){
  modal("PrismLab の使い方",
   '<div style="line-height:1.9">'
   +'<p><b>1. データを入れる</b>：左の「データ表」を選び、セルに直接入力するか <kbd>Ctrl</kbd>+<kbd>V</kbd> でExcelから貼り付け。「読み込み」ボタンで .xlsx / .csv / <b>GraphPad Prism の .pzfx</b> も開けます（Prism側で「名前を付けて保存 ▸ Prism XML」）。列見出しをクリックすると名前と色を変更できます。</p>'
   +'<p><b>2. 解析する</b>：ツールバーの <b>Σ 解析</b> から検定を選ぶと「結果」シートが作られます。データを直すと結果は自動で再計算されます。</p>'
   +'<p><b>3. グラフにする</b>：<b>📊 グラフ作成</b> でグラフの種類を選択。右側の書式パネルで軸・色・記号・エラーバー・有意差ブラケットまで細かく調整できます。</p>'
   +'<p><b>4. 出力する</b>：SVG（Illustrator等で編集可）／PNG（最大6倍）／<b>PDF</b>（図の物理サイズを保持）。レイアウトシートを使うと複数グラフを1枚の図（Figure 1 A/B/C…）に組めます。</p>'
   +'<p><b>ショートカット</b>：<kbd>Ctrl</kbd>+<kbd>Z</kbd> 元に戻す ／ <kbd>Ctrl</kbd>+<kbd>S</kbd> プロジェクト保存 ／ 表内は矢印キー・<kbd>Tab</kbd>・<kbd>Enter</kbd>で移動。</p>'
   +'<p><b>困ったとき</b>：反復測定で<b>欠測がある</b>→「混合効果モデル（REML）」、曲線に<b>外れ値が混じる</b>→非線形回帰の「ROUT法」、'
   +'2つの曲線で<b>TopとBottomを揃えたい</b>→非線形回帰の「パラメータの共有」を使ってください。</p>'
   +'<p class="mini">画面左上に表示されている版（v'+APP_VERSION+'）が最新かどうかは、公開ページを <kbd>Shift</kbd>+再読み込み（Windowsは <kbd>Ctrl</kbd>+<kbd>F5</kbd>）すると確認できます。</p>'
   +'<p class="mini">データはブラウザ内（localStorage）に自動保存されます。別PCへ移すときは「保存」で .prism.json を書き出してください。</p></div>',
   [{label:"閉じる",primary:true}],{width:680});
}
