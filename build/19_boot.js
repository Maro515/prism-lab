/* =====================================================================
   起動
   ===================================================================== */
function welcomeDialog(){
  const h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;line-height:1.8">'
   +'<div><h3 style="margin:0 0 6px;font-size:14px">PrismLab へようこそ</h3>'
   +'<p class="mini" style="font-size:12px;line-height:1.8">GraphPad Prism と同じ流れ ——'
   +' <b>データ表 → 解析 → グラフ → レイアウト</b> —— で、論文用の図と統計解析を作れる完全オフラインのアプリです。'
   +'インストールも通信も不要で、データはこのブラウザの中だけに保存されます。</p>'
   +'<p class="mini" style="font-size:12px">搭載：t検定・ANOVA（一元/二元/反復測定）・<b>混合効果モデル（欠測に強いREML）</b>・'
   +'多重比較（Tukey/Dunnett/Šídák…）・ノンパラメトリック検定・分割表・生存解析・線形/非線形回帰'
   +'（EC50・IC50・Michaelis-Menten…、<b>ROUT外れ値除去</b>・<b>パラメータ共有のグローバルフィット</b>）・'
   +'重回帰/ロジスティック/Cox・PCA・ROC、25種類のグラフ。'
   +'<b>Prism (.pzfx) の読み込み</b>と <b>PDF出力</b>にも対応。</p></div>'
   +'<div><h3 style="margin:0 0 6px;font-size:14px">はじめかた</h3>'
   +'<div class="tile" data-w="demo" style="text-align:left;margin-bottom:8px"><div class="tn">🧪 サンプルデータで試す</div>'
   +'<div class="td">腫瘍重量・用量反応曲線・生存曲線などの実例からスタート</div></div>'
   +'<div class="tile" data-w="new" style="text-align:left;margin-bottom:8px"><div class="tn">📄 新しいデータ表を作る</div>'
   +'<div class="td">表の種類（XY・縦列・グループ・生存…）を選んで入力</div></div>'
   +'<div class="tile" data-w="open" style="text-align:left"><div class="tn">📂 保存したプロジェクトを開く</div>'
   +'<div class="td">.prism.json ファイルを読み込みます</div></div></div></div>';
  modal("PrismLab — 論文グラフ＆統計スタジオ",h,[{label:"閉じる"}],{width:760,onOpen:(bg,close)=>{
    qa(bg,"[data-w]").forEach(t=>t.addEventListener("click",()=>{
      close();
      const w=t.dataset.w;
      if(w==="demo")demoDialog();
      else if(w==="new")pickTableType(tt=>{snapshot();const s=addSheet(makeDataSheet(tt,"データ "+(sheetsOf("data").length+1)));selectSheet(s.id);});
      else openProject();
    }));
  }});
}
(function boot(){
  const p=loadLocal();
  if(p){
    PROJ=p;
    SEL=(p.sheets.find(s=>s.kind==="data")||p.sheets[0]).id;
    render();
    document.getElementById("savestate").textContent="前回の続きを復元しました";
  }else{
    newProject("column",true);
    setTimeout(welcomeDialog,300);
  }
  window.addEventListener("beforeunload",saveLocal);
})();
