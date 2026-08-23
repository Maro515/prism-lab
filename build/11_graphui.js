/* =====================================================================
   グラフシートのUI（作成・書式・出力）
   ===================================================================== */
function buildGraphSVG(g){
  const src=getSheet(g.srcId);
  if(!src)return emptySVG("元データが見つかりません");
  const T=GRAPHTYPES[g.gtype];
  if(!T)return emptySVG("未知のグラフ種類です");
  try{return T.draw(g,src);}
  catch(e){console.error(e);return emptySVG("描画できませんでした："+e.message);}
}
function renderGraphSheet(sh,view){
  view.innerHTML='<div id="graphstage"><div class="graphpaper" id="gpaper">'+buildGraphSVG(sh)+"</div></div>";
}
function redrawGraph(){
  const sh=getSheet(SEL);
  if(!sh||sh.kind!=="graph")return;
  const p=document.getElementById("gpaper");
  if(p)p.innerHTML=buildGraphSVG(sh);
  markDirty();
}
function graphTypesFor(tt){return Object.keys(GRAPHTYPES).filter(k=>GRAPHTYPES[k].for.includes(tt));}
function typeThumb(k){
  const c={col_scatter:'<circle cx="14" cy="30" r="2.5"/><circle cx="17" cy="24" r="2.5"/><circle cx="12" cy="20" r="2.5"/><circle cx="38" cy="18" r="2.5"/><circle cx="42" cy="12" r="2.5"/><circle cx="35" cy="24" r="2.5"/><path d="M8 24h12M32 18h12" stroke="#1d2430" stroke-width="2" fill="none"/>',
    col_bar:'<rect x="8" y="22" width="14" height="20" fill="#F0A22E"/><rect x="30" y="12" width="14" height="30" fill="#DE5C33"/><path d="M15 22v-7M15 15h0M38 12V6" stroke="#1d2430" stroke-width="1.5"/>',
    col_box:'<rect x="8" y="18" width="14" height="14" fill="none" stroke="#F0A22E" stroke-width="2"/><path d="M15 18v-8M15 32v8M8 25h14" stroke="#F0A22E" stroke-width="2"/><rect x="30" y="14" width="14" height="12" fill="none" stroke="#DE5C33" stroke-width="2"/><path d="M37 14V6M37 26v10M30 20h14" stroke="#DE5C33" stroke-width="2"/>',
    col_violin:'<path d="M15 8c8 6 8 12 0 18-8-6-8-12 0-18z" fill="#F0A22E" opacity=".5"/><path d="M15 26c6 4 6 10 0 14-6-4-6-10 0-14z" fill="#F0A22E" opacity=".5"/><path d="M37 10c9 8 9 18 0 28-9-10-9-20 0-28z" fill="#DE5C33" opacity=".5"/>',
    col_beforeafter:'<path d="M12 36L40 16M12 30L40 22M12 22L40 12" stroke="#9aa3b1" stroke-width="1.5" fill="none"/><circle cx="12" cy="36" r="3" fill="#F0A22E"/><circle cx="12" cy="30" r="3" fill="#F0A22E"/><circle cx="12" cy="22" r="3" fill="#F0A22E"/><circle cx="40" cy="16" r="3" fill="#DE5C33"/><circle cx="40" cy="22" r="3" fill="#DE5C33"/><circle cx="40" cy="12" r="3" fill="#DE5C33"/>',
    col_float:'<rect x="8" y="14" width="14" height="24" fill="#F0A22E" opacity=".35" stroke="#F0A22E"/><rect x="30" y="8" width="14" height="20" fill="#DE5C33" opacity=".35" stroke="#DE5C33"/>',
    col_hist:'<rect x="6" y="30" width="8" height="12" fill="#F0A22E"/><rect x="15" y="20" width="8" height="22" fill="#F0A22E"/><rect x="24" y="12" width="8" height="30" fill="#F0A22E"/><rect x="33" y="22" width="8" height="20" fill="#F0A22E"/><rect x="42" y="34" width="8" height="8" fill="#F0A22E"/>',
    xy_scatter:'<circle cx="10" cy="36" r="2.6" fill="#F0A22E"/><circle cx="18" cy="30" r="2.6" fill="#F0A22E"/><circle cx="26" cy="24" r="2.6" fill="#F0A22E"/><circle cx="34" cy="16" r="2.6" fill="#F0A22E"/><circle cx="44" cy="10" r="2.6" fill="#F0A22E"/><path d="M8 38L46 8" stroke="#DE5C33" stroke-width="1.8" fill="none"/>',
    xy_line:'<path d="M8 38C18 36 22 14 46 10" stroke="#F0A22E" stroke-width="2" fill="none"/><circle cx="8" cy="38" r="2.6" fill="#F0A22E"/><circle cx="24" cy="24" r="2.6" fill="#F0A22E"/><circle cx="46" cy="10" r="2.6" fill="#F0A22E"/>',
    xy_bubble:'<circle cx="16" cy="34" r="5" fill="#3F6FD1" opacity=".8"/><circle cx="30" cy="22" r="8" fill="#2E9B57" opacity=".8"/><circle cx="44" cy="14" r="4" fill="#F0A22E" opacity=".8"/><circle cx="24" cy="12" r="3" fill="#DE5C33" opacity=".8"/>',
    xy_area:'<path d="M8 40L8 30C20 26 26 14 46 12L46 40Z" fill="#F0A22E" opacity=".4" stroke="#F0A22E" stroke-width="1.6"/>',
    grp_bar:'<rect x="8" y="20" width="7" height="22" fill="#F0A22E"/><rect x="16" y="26" width="7" height="16" fill="#DE5C33"/><rect x="30" y="12" width="7" height="30" fill="#F0A22E"/><rect x="38" y="22" width="7" height="20" fill="#DE5C33"/>',
    grp_stack:'<rect x="10" y="24" width="14" height="18" fill="#F0A22E"/><rect x="10" y="12" width="14" height="12" fill="#DE5C33"/><rect x="32" y="28" width="14" height="14" fill="#F0A22E"/><rect x="32" y="10" width="14" height="18" fill="#DE5C33"/>',
    grp_scatter:'<circle cx="12" cy="28" r="2.4" fill="#F0A22E"/><circle cx="12" cy="34" r="2.4" fill="#F0A22E"/><circle cx="20" cy="20" r="2.4" fill="#DE5C33"/><circle cx="20" cy="26" r="2.4" fill="#DE5C33"/><circle cx="34" cy="24" r="2.4" fill="#F0A22E"/><circle cx="42" cy="14" r="2.4" fill="#DE5C33"/>',
    grp_box:'<rect x="9" y="20" width="9" height="14" fill="none" stroke="#F0A22E" stroke-width="2"/><rect x="21" y="16" width="9" height="14" fill="none" stroke="#DE5C33" stroke-width="2"/><rect x="35" y="22" width="9" height="12" fill="none" stroke="#7C1D1D" stroke-width="2"/>',
    grp_line:'<path d="M8 34L22 26L36 18L48 12" stroke="#F0A22E" stroke-width="2" fill="none"/><path d="M8 38L22 34L36 32L48 30" stroke="#DE5C33" stroke-width="2" fill="none"/>',
    grp_heat:'<rect x="8" y="10" width="12" height="10" fill="#c6dbef"/><rect x="20" y="10" width="12" height="10" fill="#4292c6"/><rect x="32" y="10" width="12" height="10" fill="#08306b"/><rect x="8" y="20" width="12" height="10" fill="#08306b"/><rect x="20" y="20" width="12" height="10" fill="#6baed6"/><rect x="32" y="20" width="12" height="10" fill="#c6dbef"/><rect x="8" y="30" width="12" height="10" fill="#4292c6"/><rect x="20" y="30" width="12" height="10" fill="#deebf7"/><rect x="32" y="30" width="12" height="10" fill="#2171b5"/>',
    surv_km:'<path d="M8 10h8v6h8v10h8v10h14" stroke="#F0A22E" stroke-width="2" fill="none"/><path d="M8 12h6v10h10v14h6v6h14" stroke="#DE5C33" stroke-width="2" fill="none"/>',
    pie:'<path d="M28 24L28 6A18 18 0 0 1 44 30Z" fill="#F0A22E"/><path d="M28 24L44 30A18 18 0 0 1 12 34Z" fill="#DE5C33"/><path d="M28 24L12 34A18 18 0 0 1 28 6Z" fill="#7C1D1D"/>',
    donut:'<path d="M28 24L28 6A18 18 0 0 1 44 30Z" fill="#F0A22E"/><path d="M28 24L44 30A18 18 0 0 1 12 34Z" fill="#DE5C33"/><path d="M28 24L12 34A18 18 0 0 1 28 6Z" fill="#7C1D1D"/><circle cx="28" cy="24" r="8" fill="#fff"/>',
    mv_corrheat:'<rect x="10" y="10" width="10" height="10" fill="#F0A22E"/><rect x="20" y="10" width="10" height="10" fill="#9ec5f0"/><rect x="30" y="10" width="10" height="10" fill="#f3b7a6"/><rect x="10" y="20" width="10" height="10" fill="#9ec5f0"/><rect x="20" y="20" width="10" height="10" fill="#F0A22E"/><rect x="30" y="20" width="10" height="10" fill="#cfe0f5"/><rect x="10" y="30" width="10" height="10" fill="#f3b7a6"/><rect x="20" y="30" width="10" height="10" fill="#cfe0f5"/><rect x="30" y="30" width="10" height="10" fill="#F0A22E"/>',
    mv_pca:'<circle cx="18" cy="30" r="2.4" fill="#F0A22E"/><circle cx="24" cy="26" r="2.4" fill="#F0A22E"/><circle cx="30" cy="32" r="2.4" fill="#F0A22E"/><circle cx="36" cy="18" r="2.4" fill="#F0A22E"/><path d="M28 26L44 12M28 26L16 14" stroke="#DE5C33" stroke-width="1.6"/>',
    mv_forest:'<path d="M28 6v34" stroke="#9aa3b1" stroke-dasharray="3 3"/><path d="M14 14h20M20 24h22M10 34h26" stroke="#F0A22E" stroke-width="1.6"/><rect x="22" y="11" width="6" height="6" fill="#DE5C33"/><rect x="29" y="21" width="6" height="6" fill="#F0A22E"/><rect x="20" y="31" width="6" height="6" fill="#F0A22E"/>',
    roc:'<path d="M8 40L8 16C16 10 28 8 46 8" stroke="#F0A22E" stroke-width="2" fill="none"/><path d="M8 40L46 8" stroke="#c9d0da" stroke-dasharray="3 3"/>'
  }[k]||'<rect x="10" y="12" width="34" height="28" fill="none" stroke="#9aa3b1" stroke-width="2"/>';
  return '<svg width="56" height="48" viewBox="0 0 56 48">'+c+"</svg>";
}
function graphDialog(sh,existing){
  const keys=graphTypesFor(sh.ttype);
  if(!keys.length)return toast("この表から作れるグラフがありません",true);
  const cats=[...new Set(keys.map(k=>GRAPHTYPES[k].cat))];
  let h='<div class="picker"><div class="cats">'+cats.map((c,i)=>'<div data-cat="'+i+'"'+(i===0?' class="on"':"")+">"+c+"</div>").join("")
   +'</div><div class="items" id="gitems"></div></div>';
  modal(existing?"グラフの種類を変更":"グラフを作成 － "+esc(sh.name),h,[{label:"キャンセル"}],{width:880,onOpen:(bg,close)=>{
    const items=q(bg,"#gitems");
    const fill=(ci)=>{
      items.innerHTML=keys.filter(k=>GRAPHTYPES[k].cat===cats[ci]).map(k=>
        '<div class="tile'+(existing&&existing.gtype===k?" on":"")+'" data-gt="'+k+'">'+typeThumb(k)
        +'<div class="tn">'+GRAPHTYPES[k].name+'</div><div class="td">'+GRAPHTYPES[k].desc+"</div></div>").join("");
      qa(bg,"[data-gt]").forEach(t=>t.addEventListener("click",()=>{
        close();
        snapshot();
        if(existing){existing.gtype=t.dataset.gt;selectSheet(existing.id);}
        else{
          const g={id:uid(),kind:"graph",name:GRAPHTYPES[t.dataset.gt].name+"："+sh.name,srcId:sh.id,gtype:t.dataset.gt,
            opts:{title:"",xlab:sh.ttype==="xy"||sh.ttype==="survival"?(sh.xTitle||""):"",ylab:sh.yTitle||""}};
          if(sh.ttype==="survival"){g.opts.atRisk=true;g.opts.frame="L";}
          addSheet(g);selectSheet(g.id);
        }
      }));
    };
    fill(0);
    qa(bg,"[data-cat]").forEach(c=>c.addEventListener("click",()=>{
      qa(bg,"[data-cat]").forEach(x=>x.classList.remove("on"));c.classList.add("on");fill(+c.dataset.cat);
    }));
  }});
}
function graphTypeDialog(sh){graphDialog(getSheet(sh.srcId),sh);}
/* ---------- 書式インスペクタ ---------- */
function insRow(label,inner){return '<div class="frow"><label style="min-width:88px">'+label+"</label>"+inner+"</div>";}
function optNum(o,key,label,min,max,step,w){
  return insRow(label,'<input type="number" data-opt="'+key+'" value="'+(o[key]===""?"":o[key])+'" '
   +(min!==undefined?'min="'+min+'" ':"")+(max!==undefined?'max="'+max+'" ':"")+'step="'+(step||1)+'" style="width:'+(w||78)+'px">');
}
function optSel(o,key,label,opts){
  return insRow(label,'<select data-opt="'+key+'" style="max-width:190px">'
   +opts.map(x=>'<option value="'+x[0]+'"'+(String(o[key])===String(x[0])?" selected":"")+">"+x[1]+"</option>").join("")+"</select>");
}
function optChk(o,key,label){
  return '<label class="chk" style="display:block;margin:5px 0"><input type="checkbox" data-opt="'+key+'"'+(o[key]?" checked":"")+"> "+label+"</label>";
}
function optText(o,key,label,ph){
  return insRow(label,'<input type="text" data-opt="'+key+'" value="'+esc(o[key]||"")+'" placeholder="'+(ph||"")+'" style="width:190px">');
}
function renderInspector(g){
  const o=gopt(g),src=getSheet(g.srcId),T=GRAPHTYPES[g.gtype]||{};
  const isPie=g.gtype==="pie"||g.gtype==="donut";
  const isKM=g.gtype==="surv_km";
  const isXY=/^xy_/.test(g.gtype);
  let h='<div class="insp-h">🎨 グラフの書式<span style="flex:1"></span><button class="tbtn ghost" data-act="format" title="閉じる">✕</button></div>';
  h+='<details class="acc" open><summary>タイトルとサイズ</summary><div class="body">'
   +optText(o,"title","タイトル")
   +optNum(o,"w","幅 (px)",120,1400,10,90)+optNum(o,"h","高さ (px)",100,1200,10,90)
   +optSel(o,"font","フォント",[["Arial, Helvetica, sans-serif","Arial / Helvetica"],
     ['"Times New Roman", serif',"Times New Roman"],['"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif',"游ゴシック/ヒラギノ"],
     ['"Hiragino Mincho ProN","Yu Mincho",serif',"游明朝/ヒラギノ明朝"],["Georgia, serif","Georgia"]])
   +optNum(o,"fs","本文サイズ",6,36,1)+optNum(o,"fsAxis","目盛サイズ",6,36,1)+optNum(o,"fsTitle","題字サイズ",6,40,1)
   +optChk(o,"bold","文字を太字にする（Prism風）")
   +insRow("文字・軸の色",'<input type="color" data-opt="ink" value="'+(o.ink||"#000000")+'">')
   +'</div></details>';
  if(!isPie){
    h+='<details class="acc" open><summary>軸</summary><div class="body">'
     +optText(o,"xlab","X軸ラベル")+optText(o,"ylab","Y軸ラベル")
     +'<div class="grid2">'+optNum(o,"ymin","Y 最小",undefined,undefined,"any",80)+optNum(o,"ymax","Y 最大",undefined,undefined,"any",80)+"</div>"
     +optNum(o,"ytickStep","Y 目盛間隔",0,undefined,"any",80)
     +(isXY||isKM?'<div class="grid2">'+optNum(o,"xmin","X 最小",undefined,undefined,"any",80)+optNum(o,"xmax","X 最大",undefined,undefined,"any",80)+"</div>"
       +optNum(o,"xtickStep","X 目盛間隔",0,undefined,"any",80):"")
     +optChk(o,"ylog","Y軸を対数目盛にする")
     +(isXY?optChk(o,"xlog","X軸を対数目盛にする"):"")
     +optSel(o,"frame","枠線",[["L","L字（左と下）"],["full","四方を囲む"],["none","なし"]])
     +optChk(o,"gridY","横のグリッド線")+optChk(o,"gridX","縦のグリッド線")
     +optChk(o,"tickOut","目盛を外向きにする")
     +'<div class="grid2">'+optNum(o,"tickLen","目盛の長さ",0,20,1)+optNum(o,"tickWidth","目盛の太さ",0.4,6,0.2)+"</div>"
     +optNum(o,"axisWidth","軸線の太さ",0.5,8,0.2)
     +"</div></details>";
  }
  h+='<details class="acc" open><summary>データの表示</summary><div class="body">';
  if(!isPie&&!isKM){
    h+=optSel(o,"err","エラーバー",[["sd","平均 ± SD"],["sem","平均 ± SEM"],["ci","平均 ± 95% CI"],
       ["range","最小〜最大"],["iqr","四分位範囲"],["none","表示しない"]])
     +optSel(o,"meanLine","中心線",[["mean","平均値"],["median","中央値"],["none","表示しない"]])
     +'<div class="grid2">'+optNum(o,"errCap","ひげの幅",0,30,1)+optNum(o,"errWidth","線の太さ",0.2,6,0.1)+"</div>"
     +optSel(o,"errDir","エラーバーの向き",[["both","上下"],["up","上のみ"],["down","下のみ"]])
     +optChk(o,"showPoints","個々のデータ点を表示")
     +optChk(o,"jitter","点を左右にずらす（重なり防止）")
     +optNum(o,"pointSize","点の大きさ",1,24,0.5)
     +'<div class="grid2">'+optNum(o,"barWidth","棒/箱の幅",0.1,1,0.02)+optNum(o,"barStroke","枠線の太さ",0,6,0.1)+"</div>"
     +optChk(o,"barFill","塗りつぶす")
     +optSel(o,"barOutline","棒・箱の枠線",[["black","黒（Prism風）"],["color","データの色"],["none","なし"]])
     +optChk(o,"pointStroke","データ点に黒い縁をつける")
     +optSel(o,"valueLabels","値のラベル",[["none","表示しない"],["value","平均値を表示"],["n","n数を表示"]])
     +optSel(o,"meanLineStyle","中心線の線種",[["solid","実線"],["dash","破線"]])
     +optSel(o,"sortBars","並び順",[["none","表の順番どおり"],["asc","値の小さい順"],["desc","値の大きい順"]])
     +optNum(o,"barOpacity","塗りの濃さ",0.1,1,0.05)
     +optNum(o,"lineWidth","線の太さ",0.4,8,0.1)
     +optChk(o,"connect","点を線で結ぶ");
  }
  if(g.gtype==="col_box"||g.gtype==="grp_box")
    h+=optSel(o,"boxWhisker","ひげの定義",[["tukey","Tukey（1.5×IQR）"],["minmax","最小〜最大"],["p1090","10〜90パーセンタイル"]]);
  if(g.gtype==="col_violin")h+=optNum(o,"violinWidth","バイオリンの幅",0.2,1.2,0.05)
    +optChk(o,"violinQuartiles","中央値・四分位を破線で描く");
  if(g.gtype==="grp_stack")h+=optChk(o,"stackPct","100%積み上げにする");
  if(g.gtype==="grp_bar")h+=optSel(o,"barLayout","棒の並べ方",[["interleaved","集合（行ごとにまとめる）"],["separated","分離（データセットごとに並べる）"]]);
  if(g.gtype==="grp_heat"||g.gtype==="mv_corrheat")h+=optSel(o,"heatColors","配色",
    [["viridis","Viridis（Prism標準）"],["bwr","青-白-赤"],["blues","ブルー"],["warm","暖色"],["gray","グレースケール"]])
    +optSel(o,"valueLabels","セルに数値を書く",[["none","書かない"],["value","書く"]]);
  if(isPie)h+=optSel(o,"pieLabels","ラベル",[["pct","割合(%)"],["value","実数"],["name","項目名"],["none","なし"]])
    +(g.gtype==="donut"?optNum(o,"donut","中央の穴の割合",0.1,0.9,0.05):"");
  if(isKM)h+=optChk(o,"censorTicks","打ち切りを縦線で示す")+optChk(o,"showBand","95%信頼帯を表示")
    +optChk(o,"atRisk","at risk 表を下に付ける")
    +optSel(o,"meanLine","中央値の補助線",[["none","表示しない"],["median","生存中央値に点線"]])
    +optChk(o,"kmPct","縦軸を%表示にする（オフで0〜1）");
  if(isXY)h+=optChk(o,"showFit","あてはめ曲線・回帰直線を重ねる")+optChk(o,"showBand","信頼帯を表示")
    +'<p class="mini">あてはめ曲線を表示すると、点をつなぐ折れ線は自動的に消えます。</p>';
  if(g.gtype==="mv_pca")h+=optChk(o,"showFit","因子負荷ベクトルを表示（バイプロット）");
  if(g.gtype==="roc")h+=optChk(o,"showBand","曲線の下を塗る")+optChk(o,"showPoints","最適カットオフを示す");
  h+="</div></details>";
  // データセットの色
  if(src&&src.groups){
    h+='<details class="acc"><summary>データセットの色と記号</summary><div class="body">';
    src.groups.forEach((gr,i)=>{
      h+='<div class="frow" style="gap:6px"><input type="color" data-gcol="'+i+'" value="'+(gr.color||palOf(o,i))+'">'
       +'<input type="text" data-gnm="'+i+'" value="'+esc(gr.name)+'" style="flex:1;min-width:60px">'
       +'<select data-gsym="'+i+'" style="width:88px">'+SYMBOLS.map(s=>'<option value="'+s+'"'+(gr.symbol===s?" selected":"")+">"+symbolName(s).split(" ")[0]+"</option>").join("")+"</select></div>";
    });
    h+=insRow("配色テーマ",'<select data-pal="1" style="max-width:190px">'
      +[["prism","Prism標準（橙〜青）"],["vivid","ビビッド"],["cud","色覚バリアフリー"],["nature","Nature風"],["gray","グレースケール"],["warm","暖色系"],["cool","寒色系"]]
        .map(x=>'<option value="'+x[0]+'"'+(o.palette===x[0]?" selected":"")+">"+x[1]+"</option>").join("")+"</select>")
     +'<button class="tbtn" data-applypal="1" style="margin-top:6px">配色をデータセットに適用</button>'
     +"</div></details>";
  }
  h+='<details class="acc"><summary>凡例</summary><div class="body">'
   +optChk(o,"legend","凡例を表示")
   +optSel(o,"legendPos","位置",[["right","右側"],["top","上"],["none","なし"]])
   +"</div></details>";
  if(!isPie){
    h+='<details class="acc"><summary>有意差の表示</summary><div class="body">'
     +optChk(o,"autoBracket","解析結果から自動でブラケットを描く")
     +optSel(o,"bracketStyle","表示形式",[["star","* / ** / ns"],["starOnly","有意なものだけ *"],["p","P = 0.0032 の形式"],["num","数値のみ（Prism風）"]])
     +'<p class="mini">解析（t検定・ANOVAなど）を実行すると、その結果が自動で反映されます。</p>'
     +'<button class="tbtn" data-act="addbracket">＋ 手動でブラケットを追加</button>';
    if(o.brackets&&o.brackets.length){
      h+='<div style="margin-top:8px">'+o.brackets.map((b,i)=>
        '<div class="frow" style="gap:4px"><span class="mini" style="flex:1">'+(b.i+1)+" vs "+(b.j+1)+" ："+esc(b.star||"*")
        +'</span><span class="kill" data-delbr="'+i+'" style="opacity:1;cursor:pointer">×</span></div>').join("")+"</div>";
    }
    h+="</div></details>";
  }
  h+='<details class="acc"><summary>出力</summary><div class="body">'
   +insRow("PNG解像度",'<select data-opt="dpi" style="max-width:150px">'
     +[[2,"標準（2倍）"],[3,"高解像度（3倍）"],[4,"論文用（4倍）"],[6,"最高（6倍）"]]
       .map(x=>'<option value="'+x[0]+'"'+(String(o.dpi||3)===String(x[0])?" selected":"")+">"+x[1]+"</option>").join("")+"</select>")
   +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
   +'<button class="tbtn" data-act="svg">SVGで保存</button><button class="tbtn" data-act="png">PNGで保存</button>'
   +'<button class="tbtn" data-act="pdf">PDF</button><button class="tbtn" data-act="copyimg">コピー</button></div>'
   +'<p class="mini" style="margin-top:8px">SVGはIllustrator・Inkscapeで文字や線を編集できます。PDFは図の物理サイズ（mm）を保ったまま出力されるため、そのまま投稿用ファイルにできます。解像度は4倍以上を推奨。</p>'
   +"</div></details>";
  document.getElementById("inspector").innerHTML=h;
}
document.addEventListener("change",(e)=>{
  const sh=getSheet(SEL);
  if(!sh||sh.kind!=="graph")return;
  const t=e.target;
  if(t.dataset.opt!==undefined){
    sh.opts=sh.opts||{};
    let v=t.type==="checkbox"?t.checked:t.value;
    if(t.type==="number"&&v!=="")v=parseFloat(v);
    sh.opts[t.dataset.opt]=v;
    redrawGraph();
    if(["w","h","legend","legendPos"].includes(t.dataset.opt))return;
  }
  const src=getSheet(sh.srcId);
  if(t.dataset.gcol!==undefined&&src){src.groups[+t.dataset.gcol].color=t.value;redrawGraph();}
  if(t.dataset.gsym!==undefined&&src){src.groups[+t.dataset.gsym].symbol=t.value;redrawGraph();}
  if(t.dataset.gnm!==undefined&&src){src.groups[+t.dataset.gnm].name=t.value;redrawGraph();}
  if(t.dataset.pal!==undefined){sh.opts=sh.opts||{};sh.opts.palette=t.value;redrawGraph();}
});
document.addEventListener("click",(e)=>{
  const sh=getSheet(SEL);
  if(!sh)return;
  const ap=e.target.closest("[data-applypal]");
  if(ap&&sh.kind==="graph"){
    const src=getSheet(sh.srcId),o=gopt(sh);
    snapshot();
    src.groups.forEach((g,i)=>g.color=palOf(o,i));
    render();return;
  }
  const db=e.target.closest("[data-delbr]");
  if(db&&sh.kind==="graph"){
    sh.opts.brackets.splice(+db.dataset.delbr,1);
    renderInspector(sh);redrawGraph();
  }
});
function bracketDialog(g){
  const src=getSheet(g.srcId);
  if(!src)return;
  const names=src.groups.map((x,i)=>[i,(i+1)+". "+x.name]);
  const h=selOpt("i","左のデータセット",names,0)+selOpt("j","右のデータセット",names,1)
   +'<div class="frow"><label>表示する文字</label><input type="text" name="lab" value="*" style="width:120px">'
   +'<span class="mini">例：*　**　***　ns　P = 0.032</span></div>';
  modal("有意差ブラケットを追加",h,[{label:"キャンセル"},{label:"追加",primary:true,action:(bg)=>{
    snapshot();
    g.opts=g.opts||{};
    g.opts.brackets=g.opts.brackets||[];
    g.opts.brackets.push({i:+val(bg,"i"),j:+val(bg,"j"),star:val(bg,"lab"),p:0});
    renderInspector(g);redrawGraph();
  }}],{width:500});
}
/* ---------- 画像の出力 ---------- */
function currentSVG(sh){
  if(sh.kind==="graph")return buildGraphSVG(sh);
  if(sh.kind==="layout")return buildLayoutSVG(sh);
  return null;
}
function exportSVG(sh){
  const svg=currentSVG(sh);
  if(!svg)return toast("SVGにできるシートではありません",true);
  download(sh.name+".svg",svg,"image/svg+xml;charset=utf-8");
  toast("SVGを保存しました");
}
function svgToCanvas(svg,scale){
  return new Promise((res,rej)=>{
    const m=svg.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
    const w=m?+m[1]:600,h=m?+m[2]:400;
    const img=new Image();
    const blob=new Blob([svg],{type:"image/svg+xml;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    img.onload=()=>{
      const cv=document.createElement("canvas");
      cv.width=Math.round(w*scale);cv.height=Math.round(h*scale);
      const ctx=cv.getContext("2d");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,cv.width,cv.height);
      ctx.drawImage(img,0,0,cv.width,cv.height);
      URL.revokeObjectURL(url);
      res(cv);
    };
    img.onerror=(e)=>{URL.revokeObjectURL(url);rej(new Error("画像化に失敗しました"));};
    img.src=url;
  });
}
async function exportPNG(sh){
  const svg=currentSVG(sh);
  if(!svg)return toast("PNGにできるシートではありません",true);
  try{
    const scale=+(gopt(sh).dpi||3);
    const cv=await svgToCanvas(svg,scale);
    cv.toBlob(b=>{download(sh.name+".png",b,"image/png");toast("PNGを保存しました（"+cv.width+"×"+cv.height+"px）");});
  }catch(e){toast(e.message,true);}
}
async function copyImage(sh){
  const svg=currentSVG(sh);
  if(!svg)return;
  try{
    const cv=await svgToCanvas(svg,+(gopt(sh).dpi||3));
    cv.toBlob(async(b)=>{
      try{
        await navigator.clipboard.write([new ClipboardItem({"image/png":b})]);
        toast("画像をクリップボードにコピーしました");
      }catch(err){
        await navigator.clipboard.writeText(svg);
        toast("SVGコードをコピーしました（画像コピー非対応のブラウザ）");
      }
    });
  }catch(e){toast(e.message,true);}
}
