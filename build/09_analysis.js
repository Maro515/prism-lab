/* =====================================================================
   解析：ダイアログ・計算・結果表示
   ===================================================================== */
const RESCACHE={};
function star(p){
  if(!isFinite(p))return "";
  if(p<0.0001)return "****";
  if(p<0.001)return "***";
  if(p<0.01)return "**";
  if(p<0.05)return "*";
  return "ns";
}
function pCell(p){
  if(p===null||p===undefined||!isFinite(p))return "—";
  if(p<0.0001)return "&lt; 0.0001";
  if(p<0.001)return p.toPrecision(2);
  return p.toFixed(4);
}
function pStarCell(p){
  const s=star(p);
  return pCell(p)+' <span class="'+(s==="ns"?"pill ns":"sigstar")+'">'+s+"</span>";
}
function T(headers,rows,opts){
  opts=opts||{};
  let h='<table class="res"'+(opts.style?' style="'+opts.style+'"':"")+"><thead><tr>";
  h+=headers.map(x=>"<th>"+x+"</th>").join("")+"</tr></thead><tbody>";
  for(const r of rows){
    if(r._sec){h+='<tr class="sec"><td colspan="'+headers.length+'">'+r._sec+"</td></tr>";continue;}
    h+="<tr>"+r.map(c=>"<td>"+(c===undefined||c===null?"":c)+"</td>").join("")+"</tr>";
  }
  return h+"</tbody></table>";
}
function verdict(txt){return '<div class="verdict">'+txt+"</div>";}
function warnBox(txt){return '<div class="warnbox">'+txt+"</div>";}
function errBox(txt){return '<div class="errbox">'+txt+"</div>";}
function ciTxt(lo,hi,d){return fmt(lo,d)+" 〜 "+fmt(hi,d);}
function dsChecks(sh,name,sel){
  return '<div class="frow" style="align-items:flex-start"><label>対象データセット</label><div>'
   +sh.groups.map((g,i)=>'<label class="chk" style="margin-right:12px"><input type="checkbox" name="'+name+'" value="'+i+'"'
     +((!sel||sel.includes(i))?" checked":"")+'><span class="swatch" style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+g.color+'"></span> '+esc(g.name)+"</label>").join("")
   +"</div></div>";
}
function readDs(bg,name){
  return qa(bg,'[name="'+name+'"]').filter(c=>c.checked).map(c=>+c.value);
}
function selOpt(name,label,opts,cur,extra){
  return '<div class="frow"><label>'+label+'</label><select name="'+name+'"'+(extra||"")+">"
   +opts.map(o=>'<option value="'+o[0]+'"'+(String(cur)===String(o[0])?" selected":"")+">"+o[1]+"</option>").join("")+"</select></div>";
}
function ciSel(cur){return selOpt("ci","信頼水準",[[0.95,"95%"],[0.9,"90%"],[0.99,"99%"]],cur||0.95);}
/* ---- 解析メニュー ---- */
function analysesFor(tt){
  return Object.keys(ANALYSES).filter(k=>ANALYSES[k].for.includes(tt));
}
function analyzeDialog(sh,existing){
  if(!sh)return toast("元データがありません",true);
  if(existing)return analyzeParams(sh,existing.atype,existing);
  const keys=analysesFor(sh.ttype);
  const cats=[...new Set(keys.map(k=>ANALYSES[k].cat))];
  let h='<div class="picker"><div class="cats">'
   +cats.map((c,i)=>'<div data-cat="'+i+'"'+(i===0?' class="on"':"")+">"+c+"</div>").join("")+"</div><div class=\"items\" id=\"anitems\"></div></div>";
  modal("解析を選ぶ － "+esc(sh.name),h,[{label:"キャンセル"}],{width:880,onOpen:(bg,close)=>{
    const items=q(bg,"#anitems");
    const fill=(ci)=>{
      items.innerHTML=keys.filter(k=>ANALYSES[k].cat===cats[ci]).map(k=>
        '<div class="tile" data-an="'+k+'"><div class="tn">'+ANALYSES[k].name+'</div><div class="td">'+ANALYSES[k].desc+"</div></div>").join("");
      qa(bg,"[data-an]").forEach(t=>t.addEventListener("click",()=>{close();analyzeParams(sh,t.dataset.an);}));
    };
    fill(0);
    qa(bg,"[data-cat]").forEach(c=>c.addEventListener("click",()=>{
      qa(bg,"[data-cat]").forEach(x=>x.classList.remove("on"));
      c.classList.add("on");fill(+c.dataset.cat);
    }));
  }});
}
function analyzeParams(sh,atype,existing){
  const A=ANALYSES[atype];
  const p=existing?JSON.parse(JSON.stringify(existing.params||{})):(A.defaults?A.defaults(sh):{});
  const body=A.form?A.form(sh,p):'<p class="mini">この解析に設定項目はありません。</p>';
  modal(A.name+" － "+esc(sh.name),
    '<p class="mini" style="margin-top:0">'+A.desc+"</p>"+body,
    [{label:"キャンセル"},{label:existing?"更新":"解析する",primary:true,action:(bg)=>{
      const np=A.read?A.read(bg,sh):{};
      snapshot();
      if(existing){existing.params=np;selectSheet(existing.id);}
      else{
        const res={id:uid(),kind:"result",name:A.name+"："+sh.name,srcId:sh.id,atype,params:np};
        addSheet(res);selectSheet(res.id);
      }
    }}],{width:A.width||700,onOpen:(bg,close)=>{if(A.onOpen)A.onOpen(bg,sh,p);}});
}
function renderResultSheet(sh,view){
  const src=getSheet(sh.srcId);
  if(!src){view.innerHTML=errBox("元のデータ表が見つかりません。");return;}
  const A=ANALYSES[sh.atype];
  if(!A){view.innerHTML=errBox("未知の解析です。");return;}
  let out;
  try{out=A.run(src,sh.params||{});}
  catch(e){out={html:errBox("計算できませんでした："+esc(e.message)+"<br><span class='mini'>データの入力内容（欠測・文字列・n数）をご確認ください。</span>")};console.error(e);}
  RESCACHE[sh.id]=out.data||null;
  view.innerHTML='<div class="card"><h3>'+A.name+'<span class="sub">元データ：'+esc(src.name)+"</span></h3>"+out.html+"</div>";
}
function analysisData(srcId,atype){ // グラフから解析結果を参照
  const res=PROJ.sheets.find(s=>s.kind==="result"&&s.srcId===srcId&&s.atype===atype);
  if(!res)return null;
  if(!RESCACHE[res.id]){
    try{RESCACHE[res.id]=ANALYSES[atype].run(getSheet(srcId),res.params||{}).data;}catch(e){return null;}
  }
  return RESCACHE[res.id];
}
function exportResultCSV(sh){
  const view=document.getElementById("sheetview");
  const rows=[];
  view.querySelectorAll("table.res").forEach(t=>{
    t.querySelectorAll("tr").forEach(tr=>{
      rows.push(Array.from(tr.children).map(td=>td.textContent.trim()));
    });
    rows.push([]);
  });
  download(sh.name+".csv","﻿"+toCSV(rows),"text/csv;charset=utf-8");
  toast("結果をCSVに書き出しました");
}
function copyResultTSV(sh){
  const view=document.getElementById("sheetview");
  const lines=[];
  view.querySelectorAll("table.res tr").forEach(tr=>{
    lines.push(Array.from(tr.children).map(td=>td.textContent.trim()).join("\t"));
  });
  navigator.clipboard.writeText(lines.join("\n")).then(()=>toast("結果をコピーしました（Excelに貼り付けできます）"));
}
/* =====================================================================
   解析の定義
   ===================================================================== */
const MCMETHODS=[["tukey","Tukey（全ペア比較）"],["dunnett","Dunnett（対照群との比較）"],["sidak","Šídák"],
  ["bonferroni","Bonferroni"],["holm","Holm-Šídák"],["fdr","FDR（Benjamini-Hochberg）"],["none","補正なし（Fisher LSD）"]];
const ANALYSES={};
/* ---------- 記述統計 ---------- */
ANALYSES.desc={
  name:"記述統計",cat:"基本",for:["column","xy","grouped","parts","multivar","nested"],
  desc:"n・平均・SD・SEM・95%CI・中央値・四分位・歪度・尖度などを一覧表示します。",
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)+ciSel(p.ci)
   +'<label class="chk"><input type="checkbox" name="geo"'+(p.geo?" checked":"")+">幾何平均・幾何SDも表示（正の値のみ）</label>",
  read:(bg)=>({ds:readDs(bg,"ds"),ci:+val(bg,"ci"),geo:val(bg,"geo")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const stats=ds.map(i=>({g:sh.groups[i],d:describeFull(colValues(sh,i),p.ci||0.95)})).filter(x=>x.d);
    if(!stats.length)return {html:errBox("数値データがありません。")};
    const rowsDef=[["n","n",0],["平均","mean"],["標準偏差 SD","sd"],["標準誤差 SEM","se"],
      [(p.ci||0.95)*100+"% CI 下限","ciLo"],[(p.ci||0.95)*100+"% CI 上限","ciHi"],
      ["中央値","median"],["25パーセンタイル","q1"],["75パーセンタイル","q3"],
      ["最小値","min"],["最大値","max"],["範囲","range"],["合計","sum"],
      ["変動係数 CV(%)","cv"],["歪度","skew"],["尖度","kurt"]];
    if(p.geo)rowsDef.push(["幾何平均","geoMean"],["幾何SD係数","geoSD"]);
    const rows=rowsDef.map(rd=>[rd[0],...stats.map(s=>fmt(s.d[rd[1]],rd[2]))]);
    return {html:T(["統計量",...stats.map(s=>esc(s.g.name))],rows)
      +verdict("平均±SDで表す場合は <b>"+fmt(stats[0].d.mean)+" ± "+fmt(stats[0].d.sd)+"</b>（"+esc(stats[0].g.name)+"、n="+stats[0].d.n+"）のように記載します。ばらつきの記述にはSD、平均の精度にはSEMまたは95%CIを用います。"),
      data:{stats}};
  }
};
/* ---------- 正規性・外れ値 ---------- */
ANALYSES.normality={
  name:"正規性検定と外れ値",cat:"基本",for:["column","xy","grouped","multivar","nested"],
  desc:"Shapiro-Wilk・D'Agostino-Pearson・Anderson-Darling・KS検定と、Grubbs／ROUT法による外れ値検出。",
  form:(sh,p)=>dsChecks(sh,"ds",p.ds),
  read:(bg)=>({ds:readDs(bg,"ds")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const items=ds.map(i=>({g:sh.groups[i],v:colValues(sh,i)})).filter(x=>x.v.length>=3);
    if(!items.length)return {html:errBox("3個以上の数値が必要です。")};
    const rows=[];
    const put=(label,fn)=>rows.push([label,...items.map(fn)]);
    put("n",it=>it.v.length);
    put("Shapiro-Wilk W",it=>{const r=shapiroWilk(it.v);return r?fmt(r.W,4):"—";});
    put("　同 P値",it=>{const r=shapiroWilk(it.v);return r?pStarCell(r.p):"—";});
    put("D'Agostino K²",it=>{const r=dagostino(it.v);return r?fmt(r.K2,3):"n&lt;8";});
    put("　同 P値",it=>{const r=dagostino(it.v);return r?pStarCell(r.p):"—";});
    put("Anderson-Darling A²",it=>{const r=andersonDarling(it.v);return r?fmt(r.A2,3):"n&lt;8";});
    put("　同 P値",it=>{const r=andersonDarling(it.v);return r?pStarCell(r.p):"—";});
    put("KS(Dallal-Wilkinson) P",it=>{const r=ksLilliefors(it.v);return r?(r.approx?"&gt; 0.10":pStarCell(r.p)):"—";});
    put("歪度",it=>fmt(describeFull(it.v).skew,3));
    put("尖度",it=>fmt(describeFull(it.v).kurt,3));
    put("正規分布とみなせるか",it=>{
      const r=shapiroWilk(it.v);
      return r?(r.p>=0.05?'<span class="pill ns">はい</span>':'<span class="pill sig">いいえ</span>'):"—";
    });
    const orows=[];
    items.forEach(it=>{
      const g=grubbs(it.v),ro=routOutliers(it.v);
      orows.push([esc(it.g.name),g?fmt(g.value):"—",g?fmt(g.G,3):"—",g?pCell(g.p):"—",
        g&&g.p<0.05?'<span class="pill sig">外れ値</span>':'<span class="pill ns">なし</span>',
        ro.outliers.length?ro.outliers.map(o=>fmt(o.value)).join(", "):"なし"]);
    });
    return {html:T(["検定",...items.map(it=>esc(it.g.name))],rows)
      +'<h3 style="margin-top:16px;font-size:13px">外れ値の検定</h3>'
      +T(["データセット","最も外れた値","Grubbs G","P値","判定","ROUT法(Q=1%)で検出"],orows)
      +verdict("正規性検定は n が小さいと検出力が低く、n が大きいとわずかな逸脱でも有意になります。<b>P&lt;0.05 でも直ちにノンパラメトリック検定に切り替える必要はありません</b>。ヒストグラムやQQプロット、そして「そのデータが理論上どんな分布に従うか」も合わせて判断してください。外れ値は<b>削除する前に測定ミスの根拠</b>を確認しましょう。"),
      data:{items}};
  }
};
/* ---------- 1標本 ---------- */
ANALYSES.ttest1={
  name:"1標本 t検定 / Wilcoxon",cat:"2群までの比較",for:["column","xy","grouped","multivar"],
  desc:"各データセットの平均（中央値）が、指定した仮想値と異なるかを検定します。",
  defaults:()=>({mu:0,test:"t"}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +'<div class="frow"><label>比較する値</label><input type="number" name="mu" step="any" value="'+(p.mu||0)+'" style="width:110px"></div>'
   +selOpt("test","検定",[["t","1標本 t検定（正規分布を仮定）"],["w","Wilcoxon符号順位検定"],["sign","符号検定"]],p.test),
  read:(bg)=>({ds:readDs(bg,"ds"),mu:parseFloat(val(bg,"mu")),test:val(bg,"test")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const rows=[];
    ds.forEach(i=>{
      const v=colValues(sh,i);
      if(v.length<2)return;
      if(p.test==="t"){
        const r=tTest1(v,p.mu);
        rows.push([esc(sh.groups[i].name),r.n,fmt(r.mean),fmt(r.diff),ciTxt(r.ciLo,r.ciHi),fmt(r.t,3),r.df,pStarCell(r.p)]);
      }else if(p.test==="w"){
        const r=wilcoxon1(v,p.mu);
        rows.push([esc(sh.groups[i].name),v.length,fmt(median(v)),fmt(r.diff),"—",fmt(r.W,1),"—",pStarCell(r.p)]);
      }else{
        const r=signTest(v,p.mu);
        rows.push([esc(sh.groups[i].name),v.length,fmt(median(v)),fmt(median(v)-p.mu),"—",r.pos+"/"+r.n,"—",pStarCell(r.p)]);
      }
    });
    const hd=p.test==="t"?["データセット","n","平均","差","95% CI","t","df","P値"]
      :["データセット","n",p.test==="w"?"中央値":"中央値","差","—",p.test==="w"?"W":"正の個数/n","—","P値"];
    return {html:T(hd,rows)+verdict("比較値 "+fmt(p.mu)+" との比較。P&lt;0.05 なら「その値とは異なる」と判断します。")};
  }
};
/* ---------- 対応なし2群 ---------- */
function twoDsSel(sh,p){
  return '<div class="frow"><label>群1</label><select name="a">'+sh.groups.map((g,i)=>'<option value="'+i+'"'+((p.a!==undefined?p.a:0)===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select>"
   +'<label style="min-width:auto">群2</label><select name="b">'+sh.groups.map((g,i)=>'<option value="'+i+'"'+((p.b!==undefined?p.b:1)===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select></div>";
}
ANALYSES.ttest2={
  name:"対応のない2群の比較",cat:"2群までの比較",for:["column","xy","grouped","multivar","parts"],
  desc:"独立した2群の平均（分布）を比較します。t検定・Welch検定・Mann-Whitney検定・KS検定。",
  defaults:(sh)=>({a:0,b:Math.min(1,sh.groups.length-1),test:"welch",tails:2,ci:0.95}),
  form:(sh,p)=>twoDsSel(sh,p)
   +selOpt("test","検定",[["t","対応のないt検定（等分散を仮定）"],["welch","Welchのt検定（等分散を仮定しない・推奨）"],
     ["mw","Mann-Whitney検定（ノンパラメトリック）"],["ks","Kolmogorov-Smirnov検定"]],p.test)
   +selOpt("tails","両側/片側",[[2,"両側検定"],[1,"片側検定"]],p.tails)
   +ciSel(p.ci),
  read:(bg)=>({a:+val(bg,"a"),b:+val(bg,"b"),test:val(bg,"test"),tails:+val(bg,"tails"),ci:+val(bg,"ci")}),
  run:(sh,p)=>{
    const x=colValues(sh,p.a),y=colValues(sh,p.b);
    if(x.length<2||y.length<2)return {html:errBox("各群に2個以上の数値が必要です。")};
    const na=sh.groups[p.a].name,nb=sh.groups[p.b].name;
    const dx=describeFull(x,p.ci),dy=describeFull(y,p.ci);
    let rows=[],pval,extra="";
    const summary=T(["","n","平均","SD","SEM","中央値","最小〜最大"],
      [[esc(na),dx.n,fmt(dx.mean),fmt(dx.sd),fmt(dx.se),fmt(dx.median),fmt(dx.min)+" 〜 "+fmt(dx.max)],
       [esc(nb),dy.n,fmt(dy.mean),fmt(dy.sd),fmt(dy.se),fmt(dy.median),fmt(dy.min)+" 〜 "+fmt(dy.max)]]);
    if(p.test==="mw"){
      const r=mannWhitney(x,y);
      pval=p.tails===1?r.p/2:r.p;
      rows=[["Mann-Whitney U",fmt(r.U,1)],["正規近似 z",fmt(r.z,3)],["P値（"+(p.tails===1?"片側":"両側")+"）",pStarCell(pval)],
        ["効果量 r",fmt(r.r,3)],["中央値の差",fmt(median(x)-median(y))]];
    }else if(p.test==="ks"){
      const r=ks2sample(x,y);
      pval=r.p;
      rows=[["KS統計量 D",fmt(r.D,4)],["P値（近似）",pStarCell(r.p)],["n1, n2",r.n1+", "+r.n2]];
    }else{
      const r=tTest2(x,y,{welch:p.test==="welch"});
      pval=p.tails===1?r.p/2:r.p;
      const f=fTestVar(x,y);
      rows=[["平均の差（"+esc(na)+" − "+esc(nb)+"）",fmt(r.diff)],
        [(p.ci*100)+"% 信頼区間",ciTxt(r.ciLo,r.ciHi)],
        ["t 値",fmt(Math.abs(r.t),4)],["自由度 df",fmt(r.df,p.test==="welch"?2:0)],
        ["P値（"+(p.tails===1?"片側":"両側")+"）",pStarCell(pval)],
        ["効果量 Cohen's d",fmt(r.cohenD,3)],
        ["等分散性の検定（F検定）","F = "+fmt(f.F,3)+" , P "+(f.p<0.001?"&lt; 0.001":"= "+fmt(f.p,4))]];
      if(f.p<0.05&&p.test==="t")extra=warnBox("等分散の仮定が疑わしい（F検定 P = "+fmt(f.p,4)+"）ため、<b>Welchのt検定</b>の使用を検討してください。");
    }
    const sw1=shapiroWilk(x),sw2=shapiroWilk(y);
    if((sw1&&sw1.p<0.05||sw2&&sw2.p<0.05)&&(p.test==="t"||p.test==="welch"))
      extra+=warnBox("正規性の検定で逸脱が示唆されています（Shapiro-Wilk P = "+fmt(Math.min(sw1?sw1.p:1,sw2?sw2.p:1),4)+"）。n が小さい場合は Mann-Whitney検定も併せて確認してください。");
    const v=pval<0.05
      ? "2群の差は統計学的に有意です（P "+(pval<0.0001?"&lt; 0.0001":"= "+fmt(pval,4))+"）。"+(p.test==="mw"?"":"平均の差は "+fmt(mean(x)-mean(y))+"（"+(p.ci*100)+"%CI "+ciTxt(tTest2(x,y,{welch:p.test==="welch"}).ciLo,tTest2(x,y,{welch:p.test==="welch"}).ciHi)+"）です。")
      : "2群の差は統計学的に有意ではありません（P = "+fmt(pval,4)+"）。<b>「差がない」ことの証明ではなく</b>、信頼区間の幅から検出力不足かどうかを確認してください。";
    return {html:summary+'<h3 style="margin:14px 0 6px;font-size:13px">検定結果</h3>'+T(["項目","値"],rows)+extra+verdict(v),
      data:{comparisons:[{i:p.a,j:p.b,a:na,b:nb,p:pval,star:star(pval)}],pval}};
  }
};
/* ---------- 対応あり2群 ---------- */
function pairedRows(sh,i,j){
  const out=[];
  for(let r=0;r<sh.rows.length;r++){
    const a=[],b=[];
    for(let s=0;s<sh.sub;s++){
      const va=cellNum(sh,r,i,s),vb=cellNum(sh,r,j,s);
      if(!isNaN(va))a.push(va);
      if(!isNaN(vb))b.push(vb);
    }
    if(a.length&&b.length)out.push([mean(a),mean(b),r]);
  }
  return out;
}
ANALYSES.ttestp={
  name:"対応のある2群の比較",cat:"2群までの比較",for:["column","grouped","multivar"],
  desc:"同一個体の前後比較など、行で対応づけられた2群を比較します（1行＝1被験者）。",
  defaults:(sh)=>({a:0,b:Math.min(1,sh.groups.length-1),test:"t",tails:2,ci:0.95}),
  form:(sh,p)=>twoDsSel(sh,p)
   +selOpt("test","検定",[["t","対応のあるt検定"],["w","Wilcoxonの符号順位検定"],["sign","符号検定"]],p.test)
   +selOpt("tails","両側/片側",[[2,"両側検定"],[1,"片側検定"]],p.tails)+ciSel(p.ci)
   +'<p class="mini">同じ行が同一の被験者・同一の実験に対応している必要があります。</p>',
  read:(bg)=>({a:+val(bg,"a"),b:+val(bg,"b"),test:val(bg,"test"),tails:+val(bg,"tails"),ci:+val(bg,"ci")}),
  run:(sh,p)=>{
    const pr=pairedRows(sh,p.a,p.b);
    if(pr.length<2)return {html:errBox("対応づけられる行が2組以上必要です。")};
    const x=pr.map(r=>r[0]),y=pr.map(r=>r[1]);
    const na=sh.groups[p.a].name,nb=sh.groups[p.b].name;
    let rows,pval;
    if(p.test==="t"){
      const r=tTestPaired(x,y);
      pval=p.tails===1?r.p/2:r.p;
      const cor=pearson(x,y);
      rows=[["ペア数",pr.length],["差の平均（"+esc(na)+" − "+esc(nb)+"）",fmt(r.diff)],
        ["差のSD",fmt(sd(r.d))],[(p.ci*100)+"% 信頼区間",ciTxt(r.ciLo,r.ciHi)],
        ["t 値",fmt(Math.abs(r.t),4)],["df",r.df],["P値",pStarCell(pval)],
        ["効果量 Cohen's dz",fmt(r.cohenD,3)],
        ["対応の有効性（r）",fmt(cor.r,3)+"（P "+(cor.p<0.001?"&lt; 0.001":"= "+fmt(cor.p,4))+"）"]];
    }else if(p.test==="w"){
      const r=wilcoxonSigned(x,y);
      pval=p.tails===1?r.p/2:r.p;
      rows=[["ペア数",pr.length],["差の中央値",fmt(median(x.map((v,i)=>v-y[i])))],
        ["W（小さい方の順位和）",fmt(r.W,1)],["正の順位和 / 負の順位和",fmt(r.Wp,1)+" / "+fmt(r.Wm,1)],
        ["P値",pStarCell(pval)],["効果量 r",fmt(r.r,3)]];
    }else{
      const d=x.map((v,i)=>v-y[i]);
      const r=signTest(d,0);
      pval=p.tails===1?r.p/2:r.p;
      rows=[["ペア数",pr.length],["増加 / 減少",r.pos+" / "+r.neg],["P値",pStarCell(pval)]];
    }
    const v=pval<0.05?"前後（2条件）の差は統計学的に有意です（P "+(pval<0.0001?"&lt; 0.0001":"= "+fmt(pval,4))+"）。"
      :"有意な差は認められませんでした（P = "+fmt(pval,4)+"）。";
    return {html:T(["項目","値"],rows)+verdict(v),
      data:{comparisons:[{i:p.a,j:p.b,a:na,b:nb,p:pval,star:star(pval)}],pairs:pr}};
  }
};
/* ---------- 一元配置ANOVA ---------- */
ANALYSES.anova1={
  name:"一元配置分散分析（3群以上）",cat:"3群以上の比較",for:["column","xy","grouped","multivar","parts"],
  desc:"3群以上の平均を比較し、続けて多重比較（Tukey・Dunnettなど）を行います。",
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i),test:"anova",mc:"tukey",ctrl:0,ci:0.95}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +selOpt("test","検定",[["anova","通常の一元配置ANOVA（等分散を仮定）"],["welch","WelchのANOVA（等分散を仮定しない）"],
     ["bf","Brown-ForsytheのANOVA"],["kw","Kruskal-Wallis検定（ノンパラメトリック）"]],p.test)
   +selOpt("mc","多重比較",MCMETHODS.concat([["nomc","行わない"]]),p.mc)
   +'<div class="frow"><label>対照群（Dunnett用）</label><select name="ctrl">'
   +sh.groups.map((g,i)=>'<option value="'+i+'"'+(p.ctrl===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select></div>"
   +ciSel(p.ci),
  read:(bg)=>({ds:readDs(bg,"ds"),test:val(bg,"test"),mc:val(bg,"mc"),ctrl:+val(bg,"ctrl"),ci:+val(bg,"ci")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const groups=ds.map(i=>({label:sh.groups[i].name,values:colValues(sh,i),idx:i})).filter(g=>g.values.length>=2);
    if(groups.length<2)return {html:errBox("2群以上（各n≧2）が必要です。")};
    const ci=p.ci||0.95;
    const stat=T(["群","n","平均","SD","SEM",(ci*100)+"% CI"],
      groups.map(g=>{const d=describeFull(g.values,ci);
        return [esc(g.label),d.n,fmt(d.mean),fmt(d.sd),fmt(d.se),ciTxt(d.ciLo,d.ciHi)];}));
    let head="",comparisons=[],mse,dfE,overallP;
    if(p.test==="kw"){
      const kw=kruskalWallis(groups);
      overallP=kw.p;
      head=T(["項目","値"],[["Kruskal-Wallis 統計量 H",fmt(kw.H,4)],["自由度",kw.df],
        ["P値",pStarCell(kw.p)],["効果量 ε²",fmt(kw.eps2,3)],
        ["平均順位",groups.map((g,i)=>esc(g.label)+": "+fmt(kw.meanRanks[i],1)).join(" ／ ")]]);
      if(p.mc!=="nomc"){
        const dn=dunnTest(groups);
        comparisons=dn.map(d=>({a:d.a,b:d.b,p:d.pAdj,star:star(d.pAdj)}));
        head+='<h3 style="margin:14px 0 6px;font-size:13px">Dunnの多重比較（Holm補正）</h3>'
          +T(["比較","平均順位の差 z","補正前 P","補正後 P","判定"],
            dn.map(d=>[esc(d.a)+" vs "+esc(d.b),fmt(d.z,3),pCell(d.p),pCell(d.pAdj),
              '<span class="'+(d.pAdj<0.05?"sigstar":"pill ns")+'">'+star(d.pAdj)+"</span>"]));
      }
    }else{
      const at=anovaTable1(groups);
      mse=at.mse;dfE=at.df2;
      let F=at.F,df1=at.df1,df2=at.df2,pv=at.p,label="通常のANOVA";
      if(p.test==="welch"){const w=welchAnova(groups);F=w.F;df1=w.df1;df2=w.df2;pv=w.p;label="WelchのANOVA";}
      if(p.test==="bf"){const b=brownForsytheAnova(groups);F=b.F;df1=b.df1;df2=b.df2;pv=b.p;label="Brown-ForsytheのANOVA";}
      overallP=pv;
      const bt=bartlett(groups),bf=brownForsytheVar(groups);
      head=T(["変動要因","平方和 SS","自由度 df","平均平方 MS","F値","P値"],
        [["群間（処理）",fmt(at.ssb),at.df1,fmt(at.ms1),fmt(at.F,4),pStarCell(at.p)],
         ["群内（残差）",fmt(at.ssw),at.df2,fmt(at.ms2),"",""],
         ["全体",fmt(at.sst),at.df1+at.df2,"","",""]])
       +T(["補足","値"],[
         [label+" の F ( "+fmt(df1,0)+", "+fmt(df2,1)+" )",fmt(F,4)+" 　P "+(pv<0.0001?"&lt; 0.0001":"= "+fmt(pv,4))+" "+'<span class="'+(pv<0.05?"sigstar":"pill ns")+'">'+star(pv)+"</span>"],
         ["効果量 η²（イータ二乗）",fmt(at.eta2,3)],
         ["効果量 ω²（オメガ二乗）",fmt(at.omega2,3)],
         ["等分散性 Bartlett検定","χ² = "+fmt(bt.chi2,3)+" , P "+(bt.p<0.001?"&lt; 0.001":"= "+fmt(bt.p,4))],
         ["等分散性 Brown-Forsythe検定","F = "+fmt(bf.F,3)+" , P "+(bf.p<0.001?"&lt; 0.001":"= "+fmt(bf.p,4))]]);
      if(bt.p<0.05&&p.test==="anova")
        head+=warnBox("等分散の仮定が疑わしいため、<b>WelchまたはBrown-ForsytheのANOVA</b>を検討してください。");
      if(p.mc!=="nomc"){
        const mcs=multiCompare(groups,mse,dfE,p.mc,ds.indexOf(p.ctrl)>=0?groups.findIndex(g=>g.idx===p.ctrl):0,ci);
        comparisons=mcs.map(m=>({a:m.a,b:m.b,i:groups[m.i].idx,j:groups[m.j].idx,p:m.pAdj,star:star(m.pAdj)}));
        const mname=(MCMETHODS.find(m=>m[0]===p.mc)||["","—"])[1];
        head+='<h3 style="margin:14px 0 6px;font-size:13px">多重比較：'+mname+"</h3>"
          +T(["比較","平均の差",(ci*100)+"% CI",p.mc==="tukey"?"q":"t","補正後 P値","判定"],
            mcs.map(m=>[esc(m.a)+" vs "+esc(m.b),fmt(m.diff),ciTxt(m.ciLo,m.ciHi),
              fmt(p.mc==="tukey"?m.q:Math.abs(m.t),3),pCell(m.pAdj),
              '<span class="'+(m.pAdj<0.05?"sigstar":"pill ns")+'">'+star(m.pAdj)+"</span>"]));
      }
    }
    const v=overallP<0.05
      ? "群間に統計学的有意差があります（P "+(overallP<0.0001?"&lt; 0.0001":"= "+fmt(overallP,4))+"）。どの群同士が違うかは上の多重比較をご覧ください。"
      : "群間に統計学的有意差は認められませんでした（P = "+fmt(overallP,4)+"）。全体が有意でないときは、原則として多重比較の結果を強調しません。";
    return {html:stat+'<h3 style="margin:14px 0 6px;font-size:13px">検定結果</h3>'+head+verdict(v),
      data:{comparisons,overallP,groups:groups.map(g=>g.idx)}};
  }
};
/* ---------- 反復測定一元配置 ---------- */
function rowMatrix(sh,ds){
  const rows=[],idx=[];
  for(let r=0;r<sh.rows.length;r++){
    const vals=ds.map(g=>{
      const v=[];
      for(let s=0;s<sh.sub;s++){const x=cellNum(sh,r,g,s);if(!isNaN(x))v.push(x);}
      return v.length?mean(v):NaN;
    });
    if(vals.every(v=>!isNaN(v))){rows.push(vals);idx.push(r);}
  }
  return {rows,idx};
}
ANALYSES.rm1={
  name:"反復測定 一元配置ANOVA / Friedman",cat:"3群以上の比較",for:["column","grouped","multivar"],
  desc:"同一被験者を3条件以上で繰り返し測定した場合の検定（1行＝1被験者）。",
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i),test:"rm",mc:"tukey",ctrl:0,ci:0.95,gg:true}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +selOpt("test","検定",[["rm","反復測定一元配置ANOVA"],["fried","Friedman検定（ノンパラメトリック）"]],p.test)
   +'<label class="chk"><input type="checkbox" name="gg"'+(p.gg?" checked":"")+">球面性を仮定せず Geisser-Greenhouse 補正を行う</label>"
   +selOpt("mc","多重比較",MCMETHODS.concat([["nomc","行わない"]]),p.mc)
   +'<div class="frow"><label>対照群（Dunnett用）</label><select name="ctrl">'
   +sh.groups.map((g,i)=>'<option value="'+i+'"'+(p.ctrl===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select></div>"
   +'<p class="mini">欠測のある行は除外されます（完全ケース解析）。</p>',
  read:(bg)=>({ds:readDs(bg,"ds"),test:val(bg,"test"),gg:val(bg,"gg"),mc:val(bg,"mc"),ctrl:+val(bg,"ctrl"),ci:0.95}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const labels=ds.map(i=>sh.groups[i].name);
    const {rows}=rowMatrix(sh,ds);
    if(rows.length<2||ds.length<2)return {html:errBox("欠測のない行が2行以上、条件が2つ以上必要です。")};
    let html="",comparisons=[],overallP;
    const stat=T(["条件","n","平均","SD","SEM"],
      labels.map((L,j)=>{const col=rows.map(r=>r[j]);const d=describeFull(col);
        return [esc(L),d.n,fmt(d.mean),fmt(d.sd),fmt(d.se)];}));
    if(p.test==="fried"){
      const f=friedman(rows);
      overallP=f.p;
      html=T(["項目","値"],[["Friedman 統計量",fmt(f.chi2,4)],["自由度",f.df],["P値",pStarCell(f.p)],
        ["Kendall's W（一致度）",fmt(f.W,3)],["被験者数",f.n],
        ["平均順位",labels.map((L,i)=>esc(L)+": "+fmt(f.meanRanks[i],2)).join(" ／ ")]]);
      if(p.mc!=="nomc"){
        const dn=dunnRM(rows,labels);
        comparisons=dn.map(d=>({a:d.a,b:d.b,p:d.pAdj,star:star(d.pAdj)}));
        html+='<h3 style="margin:14px 0 6px;font-size:13px">Dunnの多重比較（Bonferroni補正）</h3>'
          +T(["比較","平均順位の差","z","補正後 P","判定"],dn.map(d=>[esc(d.a)+" vs "+esc(d.b),fmt(d.diff,2),fmt(d.z,3),pCell(d.pAdj),
            '<span class="'+(d.pAdj<0.05?"sigstar":"pill ns")+'">'+star(d.pAdj)+"</span>"]));
      }
    }else{
      const a=anovaRM1(rows);
      overallP=p.gg?a.pGG:a.p;
      html=T(["変動要因","SS","df","MS","F","P値"],
        [["処理（条件間）",fmt(a.ssTreat),a.dfT,fmt(a.msT),fmt(a.F,4),pStarCell(a.p)],
         ["被験者間",fmt(a.ssSubj),a.dfS,fmt(a.msS),fmt(a.Fsubj,3),pCell(a.pSubj)],
         ["残差",fmt(a.ssErr),a.dfE,fmt(a.msE),"",""],
         ["全体",fmt(a.sst),a.dfT+a.dfS+a.dfE,"","",""]])
       +T(["補足","値"],[
         ["Geisser-Greenhouse ε",fmt(a.epsGG,4)],["Huynh-Feldt ε",fmt(a.epsHF,4)],
         ["GG補正後 P値",pStarCell(a.pGG)],["HF補正後 P値",pCell(a.pHF)],
         ["被験者数",a.n],["条件数",a.k]]);
      if(a.epsGG<0.75)html+=warnBox("球面性からの逸脱が大きい（ε = "+fmt(a.epsGG,3)+"）ため、<b>GG補正後のP値</b>を採用してください。");
      if(p.mc!=="nomc"){
        const mcs=multiComparePaired(rows,labels,p.mc,ds.indexOf(p.ctrl)>=0?ds.indexOf(p.ctrl):0);
        comparisons=mcs.map(m=>({a:m.a,b:m.b,i:ds[m.i],j:ds[m.j],p:m.pAdj,star:star(m.pAdj)}));
        html+='<h3 style="margin:14px 0 6px;font-size:13px">多重比較（対応あり）</h3>'
          +T(["比較","差の平均","95% CI","t","補正後 P","判定"],
            mcs.map(m=>[esc(m.a)+" vs "+esc(m.b),fmt(m.diff),ciTxt(m.ciLo,m.ciHi),fmt(Math.abs(m.t),3),pCell(m.pAdj),
              '<span class="'+(m.pAdj<0.05?"sigstar":"pill ns")+'">'+star(m.pAdj)+"</span>"]));
      }
    }
    return {html:stat+'<h3 style="margin:14px 0 6px;font-size:13px">検定結果</h3>'+html
      +verdict(overallP<0.05?"条件間に有意差があります（P "+(overallP<0.0001?"&lt; 0.0001":"= "+fmt(overallP,4))+"）。":"条件間に有意差は認められませんでした（P = "+fmt(overallP,4)+"）。"),
      data:{comparisons,overallP}};
  }
};
/* ---------- 入れ子ANOVA ---------- */
ANALYSES.nested={
  name:"入れ子（Nested）ANOVA・t検定",cat:"3群以上の比較",for:["nested","grouped"],
  desc:"個体内の技術的反復（擬似反復）を正しく扱い、個体レベルで群間比較します。",
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i)}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +'<p class="mini">各データセット（群）のサブ列＝個体、行＝同一個体内の反復として計算します。</p>',
  read:(bg)=>({ds:readDs(bg,"ds")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const groups=ds.map(g=>{
      const subj=[];
      for(let s=0;s<sh.sub;s++){
        const v=[];
        for(let r=0;r<sh.rows.length;r++){const x=cellNum(sh,r,g,s);if(!isNaN(x))v.push(x);}
        if(v.length)subj.push(v);
      }
      return {label:sh.groups[g].name,subj,idx:g};
    }).filter(g=>g.subj.length>=1);
    if(groups.length<2)return {html:errBox("2群以上が必要です。")};
    const all=groups.flatMap(g=>g.subj.flat());
    const G=mean(all),N=all.length;
    let ssA=0,ssS=0,ssE=0;
    groups.forEach(g=>{
      const gv=g.subj.flat(),gm=mean(gv);
      ssA+=gv.length*Math.pow(gm-G,2);
      g.subj.forEach(s=>{
        const sm=mean(s);
        ssS+=s.length*Math.pow(sm-gm,2);
        s.forEach(v=>ssE+=Math.pow(v-sm,2));
      });
    });
    const a=groups.length,nS=sum(groups.map(g=>g.subj.length));
    const dfA=a-1,dfS=nS-a,dfE=N-nS;
    const msA=ssA/dfA,msS=dfS>0?ssS/dfS:NaN,msE=dfE>0?ssE/dfE:NaN;
    const F=msA/msS,pv=fPvalue(F,dfA,dfS);
    const subjMeans=groups.map(g=>({label:g.label,values:g.subj.map(mean),idx:g.idx}));
    const naive=anovaTable1(groups.map(g=>({label:g.label,values:g.subj.flat()})));
    const tbl=T(["変動要因","SS","df","MS","F","P値"],
      [["群間",fmt(ssA),dfA,fmt(msA),fmt(F,4),pStarCell(pv)],
       ["個体（群内）",fmt(ssS),dfS,fmt(msS),dfE>0?fmt(msS/msE,3):"",dfE>0?pCell(fPvalue(msS/msE,dfS,dfE)):""],
       ["反復（個体内）",fmt(ssE),dfE,fmt(msE),"",""]]);
    const perSubj=T(["群","個体数","個体平均の平均","個体間SD","個体内SD（反復のばらつき）"],
      groups.map((g,i)=>[esc(g.label),g.subj.length,fmt(mean(g.subj.map(mean))),
        fmt(g.subj.length>1?sd(g.subj.map(mean)):NaN),fmt(Math.sqrt(msE))]));
    let mc="";
    if(groups.length>=2&&subjMeans.every(s=>s.values.length>=2)){
      const mcs=multiCompare(subjMeans,msS/1,dfS,"tukey",0,0.95);
      mc='<h3 style="margin:14px 0 6px;font-size:13px">個体平均に基づく多重比較（Tukey）</h3>'
        +T(["比較","差","95% CI","q","補正後P","判定"],mcs.map(m=>[esc(m.a)+" vs "+esc(m.b),fmt(m.diff),ciTxt(m.ciLo,m.ciHi),
          fmt(m.q,3),pCell(m.pAdj),'<span class="'+(m.pAdj<0.05?"sigstar":"pill ns")+'">'+star(m.pAdj)+"</span>"]));
    }
    return {html:perSubj+'<h3 style="margin:14px 0 6px;font-size:13px">入れ子ANOVA表</h3>'+tbl+mc
      +warnBox("反復をすべて独立とみなす誤った解析（擬似反復）では P = "+pCell(naive.p)+" となり、実際より有意になりがちです。個体を単位とした上の結果を用いてください。")
      +verdict(pv<0.05?"個体レベルで群間差は有意です（P "+(pv<0.0001?"&lt; 0.0001":"= "+fmt(pv,4))+"）。":"個体レベルでは群間差は有意ではありません（P = "+fmt(pv,4)+"）。"),
      data:{comparisons:[],overallP:pv}};
  }
};
/* ---------- 二元配置ANOVA ---------- */
ANALYSES.anova2={
  name:"二元配置分散分析",cat:"3群以上の比較",for:["grouped","nested"],
  desc:"行の要因と列の要因、その交互作用を同時に検定します。反復測定にも対応。",
  defaults:(sh)=>({rm:"none",mc:"row",method:"sidak"}),
  form:(sh,p)=>selOpt("rm","データの対応",[["none","対応なし（すべて独立）"],
     ["col","反復測定：各行が同一被験者（列＝反復要因）"],["row","反復測定：各列が同一被験者（行＝反復要因）"]],p.rm)
   +'<div class="frow"><label>行の要因名</label><input type="text" name="rf" value="'+esc(p.rf||"要因A（行）")+'" style="width:180px">'
   +'<label style="min-width:auto">列の要因名</label><input type="text" name="cf" value="'+esc(p.cf||"要因B（列）")+'" style="width:180px"></div>'
   +selOpt("mc","多重比較の方向",[["row","各行の中で列（データセット）を比較"],["col","各列の中で行を比較"],["none","行わない"]],p.mc)
   +selOpt("method","補正方法",[["sidak","Šídák"],["tukey","Tukey"],["bonferroni","Bonferroni"],["holm","Holm-Šídák"],["fdr","FDR"],["none","補正なし"]],p.method),
  read:(bg)=>({rm:val(bg,"rm"),rf:val(bg,"rf"),cf:val(bg,"cf"),mc:val(bg,"mc"),method:val(bg,"method")}),
  run:(sh,p)=>{
    const nR=usedRows(sh);
    const rowLabels=sh.rows.slice(0,nR).map((r,i)=>r.t||("行"+(i+1)));
    const colLabels=sh.groups.map(g=>g.name);
    const cells=cellsOf(sh).slice(0,nR);
    if(!nR||!colLabels.length)return {html:errBox("データがありません。")};
    const rf=p.rf||"要因A（行）",cf=p.cf||"要因B（列）";
    let html="",comparisons=[],mse,dfE,cellMeans,cellN;
    if(p.rm==="none"){
      const a=anova2(cells,rowLabels,colLabels);
      if(a.error)return {html:errBox(a.error)};
      mse=a.mse;dfE=a.dfE;cellMeans=a.cellMeans;cellN=a.cellN;
      const tot=a.total.ss;
      const pct=(ss)=>fmt(ss/tot*100,1)+"%";
      html=T(["変動要因","SS","df","MS","F","P値","全変動に占める割合"],
        [[esc(cf)+"（列）",fmt(a.col.ss),a.col.df,fmt(a.col.ms),fmt(a.col.F,4),pStarCell(a.col.p),pct(a.col.ss)],
         [esc(rf)+"（行）",fmt(a.row.ss),a.row.df,fmt(a.row.ms),fmt(a.row.F,4),pStarCell(a.row.p),pct(a.row.ss)],
         ["交互作用",a.inter?fmt(a.inter.ss):"—",a.inter?a.inter.df:"—",a.inter?fmt(a.inter.ms):"—",
          a.inter?fmt(a.inter.F,4):"—",a.inter?pStarCell(a.inter.p):"—",a.inter?pct(a.inter.ss):"—"],
         ["残差",fmt(a.resid.ss),a.resid.df,fmt(a.resid.ms),"","",pct(a.resid.ss)]]);
      if(!a.balanced)html+=warnBox("各セルのn数が揃っていません（不釣り合い型）。TypeIII平方和で計算しています。");
      if(a.inter&&a.inter.p<0.05)html+=warnBox("<b>交互作用が有意です</b>（P "+(a.inter.p<0.0001?"&lt; 0.0001":"= "+fmt(a.inter.p,4))+"）。主効果だけを解釈すると誤解を招きます。行ごと・列ごとの単純主効果（下の多重比較）で解釈してください。");
    }else{
      // 反復測定（分割プロット）
      let between,within,subjects=[];
      if(p.rm==="col"){
        between=rowLabels;within=colLabels;
        for(let r=0;r<nR;r++)for(let s=0;s<sh.sub;s++){
          const vals=colLabels.map((_,c)=>cellNum(sh,r,c,s));
          if(vals.every(v=>!isNaN(v)))subjects.push({group:r,values:vals});
        }
      }else{
        between=colLabels;within=rowLabels;
        for(let c=0;c<colLabels.length;c++)for(let s=0;s<sh.sub;s++){
          const vals=[];
          for(let r=0;r<nR;r++)vals.push(cellNum(sh,r,c,s));
          if(vals.every(v=>!isNaN(v)))subjects.push({group:c,values:vals});
        }
      }
      if(subjects.length<between.length+1)return {html:errBox("反復測定として解析するには、欠測のない被験者が各群に必要です。")};
      const a=anova2RM(subjects,between,within);
      if(a.error)return {html:errBox(a.error)};
      mse=a.mse;dfE=a.err.df;
      cellMeans=cellsOf(sh).slice(0,nR).map(row=>row.map(c=>c.length?mean(c):NaN));
      cellN=cellsOf(sh).slice(0,nR).map(row=>row.map(c=>c.length));
      html=T(["変動要因","SS","df","MS","F","P値"],
        [[esc(p.rm==="col"?rf:cf)+"（被験者間）",fmt(a.between.ss),a.between.df,fmt(a.between.ms),fmt(a.between.F,4),pStarCell(a.between.p)],
         ["被験者（群内）",fmt(a.subj.ss),a.subj.df,fmt(a.subj.ms),"",""],
         [esc(p.rm==="col"?cf:rf)+"（被験者内・反復）",fmt(a.within.ss),a.within.df,fmt(a.within.ms),fmt(a.within.F,4),pStarCell(a.within.p)],
         ["交互作用",fmt(a.inter.ss),a.inter.df,fmt(a.inter.ms),fmt(a.inter.F,4),pStarCell(a.inter.p)],
         ["残差",fmt(a.err.ss),a.err.df,fmt(a.err.ms),"",""]])
        +'<p class="mini">被験者数：'+a.nSubj+" 　（分割プロット型の混合モデルとして計算）</p>";
    }
    // セル平均表
    html+='<h3 style="margin:14px 0 6px;font-size:13px">セルごとの平均（n）</h3>'
     +T([esc(rf)+" ＼ "+esc(cf),...colLabels.map(esc)],
        rowLabels.map((rl,r)=>[esc(rl),...colLabels.map((_,c)=>fmt(cellMeans[r][c])+' <span class="mini">(n='+cellN[r][c]+")</span>")]));
    // 多重比較
    if(p.mc!=="none"&&mse&&isFinite(mse)){
      const pairsAll=[];
      if(p.mc==="row"){
        rowLabels.forEach((rl,r)=>{
          for(let c1=0;c1<colLabels.length;c1++)for(let c2=c1+1;c2<colLabels.length;c2++){
            const n1=cellN[r][c1],n2=cellN[r][c2];
            if(!n1||!n2)continue;
            const diff=cellMeans[r][c1]-cellMeans[r][c2];
            const se=Math.sqrt(mse*(1/n1+1/n2));
            pairsAll.push({label:esc(rl)+"： "+esc(colLabels[c1])+" vs "+esc(colLabels[c2]),diff,se,t:diff/se,r,c1,c2});
          }
        });
      }else{
        colLabels.forEach((cl,c)=>{
          for(let r1=0;r1<rowLabels.length;r1++)for(let r2=r1+1;r2<rowLabels.length;r2++){
            const n1=cellN[r1][c],n2=cellN[r2][c];
            if(!n1||!n2)continue;
            const diff=cellMeans[r1][c]-cellMeans[r2][c];
            const se=Math.sqrt(mse*(1/n1+1/n2));
            pairsAll.push({label:esc(cl)+"： "+esc(rowLabels[r1])+" vs "+esc(rowLabels[r2]),diff,se,t:diff/se,c,r1,r2});
          }
        });
      }
      const m=pairsAll.length;
      pairsAll.forEach(x=>x.pRaw=tPvalue(x.t,dfE));
      if(p.method==="holm"){const adj=holm(pairsAll.map(x=>x.pRaw));pairsAll.forEach((x,i)=>x.pAdj=adj[i]);}
      else if(p.method==="fdr"){const adj=bhFDR(pairsAll.map(x=>x.pRaw));pairsAll.forEach((x,i)=>x.pAdj=adj[i]);}
      else if(p.method==="bonferroni")pairsAll.forEach(x=>x.pAdj=Math.min(1,x.pRaw*m));
      else if(p.method==="sidak")pairsAll.forEach(x=>x.pAdj=1-Math.pow(1-x.pRaw,m));
      else if(p.method==="tukey"){
        const k=p.mc==="row"?colLabels.length:rowLabels.length;
        pairsAll.forEach(x=>x.pAdj=Math.min(1,ptukeyP(Math.abs(x.t)*Math.SQRT2,k,dfE)));
      }else pairsAll.forEach(x=>x.pAdj=x.pRaw);
      const per=p.method==="bonferroni"?0.05/m:p.method==="none"?0.05:1-Math.pow(0.95,1/m);
      const tc=tQuantile(1-per/2,dfE);
      comparisons=pairsAll.map(x=>({row:x.r,i:x.c1,j:x.c2,col:x.c,r1:x.r1,r2:x.r2,p:x.pAdj,star:star(x.pAdj),label:x.label}));
      html+='<h3 style="margin:14px 0 6px;font-size:13px">多重比較（'+(p.mc==="row"?"行ごとに列を比較":"列ごとに行を比較")+"）</h3>"
        +T(["比較","差","95% CI","t","補正後 P","判定"],
          pairsAll.map(x=>[x.label,fmt(x.diff),ciTxt(x.diff-tc*x.se,x.diff+tc*x.se),fmt(Math.abs(x.t),3),pCell(x.pAdj),
            '<span class="'+(x.pAdj<0.05?"sigstar":"pill ns")+'">'+star(x.pAdj)+"</span>"]));
    }
    return {html,data:{comparisons,cellMeans,cellN,mse,dfE}};
  }
};
/* ---------- 行ごとのt検定 ---------- */
ANALYSES.rowtt={
  name:"行ごとの複数t検定",cat:"3群以上の比較",for:["grouped","nested"],
  desc:"各行（時点・遺伝子など）ごとに2群を比較し、多重性をFDRなどで補正します。",
  defaults:(sh)=>({a:0,b:Math.min(1,sh.groups.length-1),method:"fdr",welch:true}),
  form:(sh,p)=>twoDsSel(sh,p)
   +'<label class="chk"><input type="checkbox" name="welch"'+(p.welch?" checked":"")+">Welch補正（等分散を仮定しない）</label>"
   +selOpt("method","多重性の補正",[["fdr","FDR（Benjamini-Hochberg, Q=5%）"],["holm","Holm-Šídák"],["bonferroni","Bonferroni"],["none","補正なし"]],p.method),
  read:(bg)=>({a:+val(bg,"a"),b:+val(bg,"b"),welch:val(bg,"welch"),method:val(bg,"method")}),
  run:(sh,p)=>{
    const nR=usedRows(sh);
    const rows=[];
    const raw=[];
    for(let r=0;r<nR;r++){
      const A=[],B=[];
      for(let s=0;s<sh.sub;s++){
        const va=cellNum(sh,r,p.a,s),vb=cellNum(sh,r,p.b,s);
        if(!isNaN(va))A.push(va);
        if(!isNaN(vb))B.push(vb);
      }
      if(A.length<2||B.length<2)continue;
      const t=tTest2(A,B,{welch:p.welch});
      raw.push({r,label:sh.rows[r].t||("行"+(r+1)),A,B,t});
    }
    if(!raw.length)return {html:errBox("各行に2個以上の値がある行がありません。")};
    const ps=raw.map(x=>x.t.p);
    let adj;
    if(p.method==="fdr")adj=bhFDR(ps);
    else if(p.method==="holm")adj=holm(ps);
    else if(p.method==="bonferroni")adj=bonferroni(ps);
    else adj=ps;
    raw.forEach((x,i)=>x.pAdj=adj[i]);
    const nSig=raw.filter(x=>x.pAdj<0.05).length;
    return {html:T(["行","平均1","平均2","差","95% CI","t","df","P値","補正後P","判定"],
      raw.map(x=>[esc(x.label),fmt(mean(x.A)),fmt(mean(x.B)),fmt(x.t.diff),ciTxt(x.t.ciLo,x.t.ciHi),
        fmt(Math.abs(x.t.t),3),fmt(x.t.df,1),pCell(x.t.p),pCell(x.pAdj),
        '<span class="'+(x.pAdj<0.05?"sigstar":"pill ns")+'">'+star(x.pAdj)+"</span>"]))
      +verdict(nSig+" / "+raw.length+" 行で有意差が検出されました（補正後 P&lt;0.05）。"),
      data:{comparisons:raw.map(x=>({row:x.r,i:p.a,j:p.b,p:x.pAdj,star:star(x.pAdj)}))}};
  }
};
/* ---------- 直線回帰 ---------- */
ANALYSES.lin={
  name:"直線回帰",cat:"XY・回帰",for:["xy","multivar"],
  desc:"最小二乗法で直線を当てはめ、傾き・切片・95%CI・R²・直線性の検定を表示します。複数データセットの傾き比較も可能。",
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i),origin:false,compare:true,bands:"ci",interp:""}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +'<label class="chk"><input type="checkbox" name="origin"'+(p.origin?" checked":"")+">原点(0,0)を通る直線に固定する</label><br>"
   +'<label class="chk"><input type="checkbox" name="compare"'+(p.compare!==false?" checked":"")+">複数データセットの傾き・切片を比較する（ANCOVA）</label><br>"
   +'<label class="chk"><input type="checkbox" name="deming"'+(p.deming?" checked":"")+">Deming回帰（XにもYにも誤差がある場合）も計算する</label>"
   +selOpt("bands","信頼帯の表示（グラフ用）",[["ci","95%信頼帯"],["pi","95%予測帯"],["none","表示しない"]],p.bands)
   +'<div class="frow"><label>内挿するY値</label><input type="text" name="interp" value="'+esc(p.interp||"")+'" style="width:280px" placeholder="例: 0.5, 1.2（検量線から濃度を逆算）"></div>',
  read:(bg)=>({ds:readDs(bg,"ds"),origin:val(bg,"origin"),compare:val(bg,"compare"),deming:val(bg,"deming"),
    bands:val(bg,"bands"),interp:val(bg,"interp")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const sets=ds.map(g=>{
      const pr=xyPairs(sh,g);
      return {g,label:sh.groups[g].name,x:pr.map(v=>v[0]),y:pr.map(v=>v[1])};
    }).filter(s=>s.x.length>=2);
    if(!sets.length)return {html:errBox("XとYの組が2点以上あるデータセットがありません。")};
    const fits=sets.map(s=>({s,f:linFit(s.x,s.y,{throughOrigin:p.origin})}));
    const ok=fits.filter(f=>!f.f.error);
    if(!ok.length)return {html:errBox(fits[0].f.error||"計算できません。")};
    const rows=[
      ["傾き",...ok.map(f=>fmt(f.f.slope,4))],
      ["傾きの95%CI",...ok.map(f=>ciTxt(f.f.slopeLo,f.f.slopeHi,4))],
      ["切片",...ok.map(f=>p.origin?"0（固定）":fmt(f.f.intercept,4))],
      ["切片の95%CI",...ok.map(f=>p.origin?"—":ciTxt(f.f.intLo,f.f.intHi,4))],
      ["X切片",...ok.map(f=>fmt(f.f.xIntercept,4))],
      ["1/傾き",...ok.map(f=>fmt(f.f.invSlope,4))],
      ["R²",...ok.map(f=>fmt(f.f.r2,4))],
      ["Sy.x（残差SD）",...ok.map(f=>fmt(f.f.syx,4))],
      ["点の数 n",...ok.map(f=>f.f.n)],
      ["傾き≠0 の検定 F",...ok.map(f=>fmt(f.f.t*f.f.t,3))],
      ["　同 P値",...ok.map(f=>pStarCell(f.f.p))],
      ["直線性の検定（Runs test）P",...ok.map(f=>isFinite(f.f.runsP)?pCell(f.f.runsP):"—")],
      ["回帰式",...ok.map(f=>"Y = "+fmt(f.f.slope,4)+"·X"+(p.origin?"":(f.f.intercept>=0?" + ":" − ")+fmt(Math.abs(f.f.intercept),4)))]
    ];
    let html=T(["項目",...ok.map(f=>esc(f.s.label))],rows);
    if(p.deming){
      html+='<h3 style="margin:14px 0 6px;font-size:13px">Deming回帰（λ=1）</h3>'
        +T(["データセット","傾き","切片"],ok.map(f=>{const d=demingFit(f.s.x,f.s.y,1);return [esc(f.s.label),fmt(d.slope,4),fmt(d.intercept,4)];}));
    }
    if(p.compare&&ok.length>=2){
      const cmp=compareLines(ok.map(f=>({x:f.s.x,y:f.s.y})));
      if(!cmp.error){
        html+='<h3 style="margin:14px 0 6px;font-size:13px">直線の比較（ANCOVA）</h3>'
          +T(["比較","F","自由度","P値","判定"],
            [["傾きは等しいか？",fmt(cmp.Fslope,4),cmp.dfSlopeN+", "+cmp.dfSlopeD,pStarCell(cmp.pSlope),
              cmp.pSlope<0.05?"傾きが異なる":"傾きは同じとみなせる"],
             ["（傾き共通として）切片は等しいか？",fmt(cmp.Fint,4),cmp.dfIntN+", "+cmp.dfIntD,pStarCell(cmp.pInt),
              cmp.pInt<0.05?"切片が異なる":"切片も同じとみなせる"]]);
        if(cmp.pSlope>=0.05)html+='<p class="mini">共通の傾き＝'+fmt(cmp.pooledSlope,4)+"</p>";
      }
    }
    if(p.interp&&p.interp.trim()){
      const ys=p.interp.split(/[,\s]+/).map(parseFloat).filter(v=>isFinite(v));
      if(ys.length){
        html+='<h3 style="margin:14px 0 6px;font-size:13px">検量線からの内挿</h3>'
          +T(["Y（測定値）",...ok.map(f=>esc(f.s.label)+" の X")],
            ys.map(yv=>[fmt(yv),...ok.map(f=>fmt((yv-f.f.intercept)/f.f.slope,4))]));
      }
    }
    const f0=ok[0].f;
    return {html:html+verdict(f0.p<0.05
      ? "傾きは0と有意に異なります（P "+(f0.p<0.0001?"&lt; 0.0001":"= "+fmt(f0.p,4))+"）。R² = "+fmt(f0.r2,3)+" で、Yの変動の "+fmt(f0.r2*100,1)+"% がXで説明されます。"
      : "傾きは0と有意に異なりません（P = "+fmt(f0.p,4)+"）。直線関係の根拠は乏しいと言えます。"),
      data:{fits:ok.map(f=>({g:f.s.g,slope:f.f.slope,intercept:f.f.intercept,r2:f.f.r2,
        xmin:Math.min(...f.s.x),xmax:Math.max(...f.s.x),band:p.bands,f:f.f,type:"line"}))}};
  }
};
/* ---------- 相関 ---------- */
ANALYSES.corr={
  name:"相関",cat:"XY・回帰",for:["xy","multivar","column"],
  desc:"2変数の関連の強さ（Pearson / Spearman）を、95%信頼区間つきで求めます。",
  defaults:(sh)=>({method:"pearson",ds:sh.groups.map((_,i)=>i),mode:sh.ttype==="xy"?"xy":"pairs"}),
  form:(sh,p)=>selOpt("method","係数",[["pearson","Pearson（直線的な関連・正規分布を仮定）"],["spearman","Spearman（順位相関）"]],p.method)
   +(sh.ttype==="xy"?'<p class="mini">X列と各データセット（Y）の相関を計算します。</p>':"")
   +dsChecks(sh,"ds",p.ds),
  read:(bg)=>({method:val(bg,"method"),ds:readDs(bg,"ds")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const rows=[];
    const pairsOut=[];
    if(sh.ttype==="xy"){
      ds.forEach(g=>{
        const pr=xyPairs(sh,g);
        if(pr.length<4)return;
        const x=pr.map(v=>v[0]),y=pr.map(v=>v[1]);
        const r=p.method==="pearson"?pearson(x,y):spearman(x,y);
        const co=p.method==="pearson"?r.r:r.rho;
        rows.push([esc(sh.xTitle||"X")+" vs "+esc(sh.groups[g].name),pr.length,fmt(co,4),ciTxt(r.ciLo,r.ciHi,3),
          fmt(co*co,4),pStarCell(r.p)]);
        pairsOut.push({a:g,b:-1,r:co,p:r.p});
      });
    }else{
      for(let i=0;i<ds.length;i++)for(let j=i+1;j<ds.length;j++){
        const A=[],B=[];
        for(let r2=0;r2<sh.rows.length;r2++){
          const va=cellNum(sh,r2,ds[i],0),vb=cellNum(sh,r2,ds[j],0);
          if(!isNaN(va)&&!isNaN(vb)){A.push(va);B.push(vb);}
        }
        if(A.length<4)continue;
        const r=p.method==="pearson"?pearson(A,B):spearman(A,B);
        const co=p.method==="pearson"?r.r:r.rho;
        rows.push([esc(sh.groups[ds[i]].name)+" vs "+esc(sh.groups[ds[j]].name),A.length,fmt(co,4),
          ciTxt(r.ciLo,r.ciHi,3),fmt(co*co,4),pStarCell(r.p)]);
        pairsOut.push({a:ds[i],b:ds[j],r:co,p:r.p});
      }
    }
    if(!rows.length)return {html:errBox("相関を計算できる組（4組以上）がありません。")};
    const strength=(r)=>{const a=Math.abs(r);return a<0.2?"ほとんど相関なし":a<0.4?"弱い相関":a<0.7?"中等度の相関":"強い相関";};
    return {html:T(["組み合わせ","n",p.method==="pearson"?"r":"ρ","95% CI","r²","P値"],rows)
      +verdict("相関係数は "+fmt(pairsOut[0].r,3)+"（"+strength(pairsOut[0].r)+"）。<b>相関は因果関係を意味しません</b>。また外れ値1点で大きく変わるため、必ず散布図を確認してください。"),
      data:{pairs:pairsOut}};
  }
};
/* ---------- 非線形回帰 ---------- */
function readShared(bg,n){
  const arr=new Array(n).fill(false);
  qa(bg,'[name="shared"]').forEach(c=>{if(c.checked)arr[+c.value]=true;});
  return arr;
}
ANALYSES.nonlin={
  name:"非線形回帰（曲線あてはめ）",cat:"XY・回帰",for:["xy","multivar"],
  desc:"用量反応曲線（EC50/IC50）・指数減衰・Michaelis-Menten など。パラメータの共有（グローバルフィット）と ROUT 外れ値除去に対応。",
  width:860,
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i).filter(i=>sh.ttype!=="multivar"||i>0),model:"ec50var",weight:"none",
    custom:"Bottom+(Top-Bottom)/(1+10^((LogEC50-X)*Hill))",cparams:"Bottom,Top,LogEC50,Hill",cinit:"0,100,-7,1",
    shared:[],rout:false,routQ:0.01,interp:"",compare:"none"}),
  form:(sh,p)=>{
    const cats=[...new Set(NLMODELS.map(m=>m.cat))];
    return dsChecks(sh,"ds",p.ds)
     +'<div class="frow"><label>モデル式</label><select name="model" style="width:420px">'
     +cats.map(c=>'<optgroup label="'+c+'">'+NLMODELS.filter(m=>m.cat===c).map(m=>
        '<option value="'+m.id+'"'+(p.model===m.id?" selected":"")+">"+m.name+"</option>").join("")+"</optgroup>").join("")
     +"</select></div>"
     +'<div id="eqbox" class="mini" style="margin:2px 0 8px 104px"></div>'
     +'<fieldset><legend>カスタム式（モデルで「自分で式を入力」を選んだとき）</legend>'
     +'<div class="frow"><label>Y =</label><input type="text" name="custom" value="'+esc(p.custom||"")+'" style="flex:1;min-width:320px"></div>'
     +'<div class="frow"><label>パラメータ名</label><input type="text" name="cparams" value="'+esc(p.cparams||"")+'" style="width:260px">'
     +'<label style="min-width:auto">初期値</label><input type="text" name="cinit" value="'+esc(p.cinit||"")+'" style="width:200px"></div>'
     +'<p class="mini">使える関数：exp, ln, log(=log10), sqrt, abs, sin, cos, pow, ^ 。変数は X とパラメータ名。</p></fieldset>'
     +'<fieldset><legend>パラメータの共有（グローバルフィット）</legend><div id="sharedbox">'+nlSharedBox(p,(p.ds||[]).length)+"</div></fieldset>"
     +'<fieldset><legend>外れ値の自動除去</legend>'
     +'<label class="chk"><input type="checkbox" name="rout"'+(p.rout?" checked":"")+"> ROUT法で外れ値を検出し、除外して当てはめる</label>"
     +selOpt("routQ","誤検出率 Q",[[0.01,"1%（Prism標準）"],[0.001,"0.1%（厳しめ）"],[0.05,"5%（ゆるめ）"]],p.routQ||0.01)
     +'<p class="mini">ロバスト回帰（Lorentzian）で当てはめ→残差のロバストSD（RSDR）→FDR法で外れ値を判定し、除いた点で通常の最小二乗を再実行します。</p></fieldset>'
     +selOpt("weight","重み付け",[["none","なし（等分散を仮定）"],["1/y2","1/Y²（相対誤差一定）"],["1/y","1/Y"],["1/x2","1/X²"]],p.weight)
     +selOpt("compare","別モデルとの比較",[["none","行わない"],["line","直線モデルと比較する"],["ec50std","標準勾配モデルと比較する"],["expdecay1","一相性減衰と比較する"]],p.compare)
     +'<div class="frow"><label>内挿するY値</label><input type="text" name="interp" value="'+esc(p.interp||"")+'" style="width:300px" placeholder="例: 50（IC50相当のXを求める）"></div>';
  },
  onOpen:(bg,sh,p)=>{
    const upd=()=>{
      const cur={model:val(bg,"model"),cparams:val(bg,"cparams"),shared:readShared(bg,24)};
      const n=readDs(bg,"ds").length;
      const box=q(bg,"#sharedbox");
      if(box)box.innerHTML=nlSharedBox(cur,n);
      const M=NLMODELS.find(m=>m.id===cur.model);
      const eq=q(bg,"#eqbox");
      if(eq)eq.innerHTML=M?(M.custom?"下の欄に式を入力してください":"<b>"+esc(M.eq)+"</b>"):"";
    };
    bg.addEventListener("change",(e)=>{
      const n=e.target.name;
      if(n==="model"||n==="cparams"||n==="ds")upd();
    });
    upd();
  },
  read:(bg,sh)=>({ds:readDs(bg,"ds"),model:val(bg,"model"),weight:val(bg,"weight"),custom:val(bg,"custom"),
    cparams:val(bg,"cparams"),cinit:val(bg,"cinit"),interp:val(bg,"interp"),compare:val(bg,"compare"),
    shared:readShared(bg,24),rout:val(bg,"rout"),routQ:parseFloat(val(bg,"routQ"))||0.01}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const M=NLMODELS.find(m=>m.id===p.model)||NLMODELS[0];
    let fnFor=M.f,pnames=M.params,initFor=M.init;
    if(M.custom){
      pnames=(p.cparams||"").split(/[,\s]+/).filter(Boolean);
      let expr;
      try{expr=compileExpr(p.custom||"0",["X"].concat(pnames));}
      catch(e){return {html:errBox("式を解釈できません："+esc(e.message))};}
      fnFor=(pp,x)=>expr([x].concat(pp));
      const init=(p.cinit||"").split(/[,\s]+/).map(parseFloat);
      initFor=()=>pnames.map((_,i)=>isFinite(init[i])?init[i]:1);
    }
    const model={params:pnames,f:fnFor,init:initFor};
    const weightsOf=(x,y)=>{
      if(p.weight==="1/y2")return y.map(v=>1/Math.max(1e-12,v*v));
      if(p.weight==="1/y")return y.map(v=>1/Math.max(1e-12,Math.abs(v)));
      if(p.weight==="1/x2")return x.map(v=>1/Math.max(1e-12,v*v));
      return null;
    };
    const sets=[];
    ds.forEach(g=>{
      const pr=xyPairs(sh,g);
      if(pr.length<pnames.length+1)return;
      sets.push({g,label:sh.groups[g].name,x:pr.map(v=>v[0]),y:pr.map(v=>v[1]),outliers:[]});
    });
    if(!sets.length)return {html:errBox("あてはめできるデータセットがありません（点数がパラメータ数より多い必要があります）。")};
    // ROUT 外れ値除去
    const routRows=[];
    if(p.rout){
      sets.forEach(s=>{
        const r=routNL(s.x,s.y,fnFor,initFor(s.x,s.y),p.routQ||0.01,{weights:weightsOf(s.x,s.y)});
        if(r.error||!r.outliers)return;
        s.outliers=r.outliers.map(i=>[s.x[i],s.y[i]]);
        routRows.push([esc(s.label),s.x.length,r.outliers.length,fmt(r.rsdr,4),
          r.outliers.length?r.outliers.map(i=>"("+fmt(s.x[i],3)+", "+fmt(s.y[i],3)+")").join("、"):"なし"]);
        if(r.outliers.length){
          const keep=s.x.map((_,i)=>r.outliers.indexOf(i)<0);
          s.x=s.x.filter((_,i)=>keep[i]);s.y=s.y.filter((_,i)=>keep[i]);
        }
      });
    }
    const shared=(p.shared||[]).slice(0,pnames.length);
    const useGlobal=sets.length>1&&shared.some(Boolean);
    const results=[];
    let gfit=null,cmpShared=null;
    if(useGlobal){
      gfit=lmFitGlobal(sets,model,shared,{weightMode:p.weight});
      if(gfit.error)return {html:errBox(gfit.error)};
      sets.forEach((s,d)=>results.push({s,label:s.label,params:gfit.paramsFor(d),
        se:gfit.seFor(d),ci:gfit.ciFor(d),fit:gfit,global:true}));
      const sep=lmFitGlobal(sets,model,pnames.map(()=>false),{weightMode:p.weight});
      if(!sep.error&&sep.df<gfit.df)cmpShared=extraSSF(gfit,sep);
    }else{
      sets.forEach(s=>{
        const fit=lmFit(s.x,s.y,fnFor,initFor(s.x,s.y),{weights:weightsOf(s.x,s.y)});
        if(fit.error)return;
        results.push({s,label:s.label,params:fit.p,se:fit.se,
          ci:fit.p.map((_,j)=>[fit.ciLo[j],fit.ciHi[j]]),fit,global:false});
      });
    }
    if(!results.length)return {html:errBox("あてはめに失敗しました。初期値やモデル式を確認してください。")};
    const rows=[];
    pnames.forEach((nm,i)=>{
      rows.push([esc(nm)+(useGlobal&&shared[i]?' <span class="pill">共有</span>':""),...results.map(r=>fmtSig(r.params[i],5))]);
      rows.push(["　95% CI",...results.map(r=>isFinite(r.ci[i][0])?ciTxtSig(r.ci[i][0],r.ci[i][1]):"—")]);
    });
    if(M.derived){
      const d0=M.derived(results[0].params);
      d0.forEach((dd,k)=>rows.push([dd[0],...results.map(r=>fmtSig(M.derived(r.params)[k][1],5))]));
    }
    rows.push({_sec:"あてはまりの良さ"});
    if(useGlobal){
      rows.push(["R²（全体）",...results.map(()=>fmt(gfit.r2,4))]);
      rows.push(["Sy.x（全体）",...results.map(()=>fmt(gfit.sy,4))]);
      rows.push(["残差平方和（全体）",...results.map(()=>fmt(gfit.ss,4))]);
      rows.push(["点数 / 自由度（全体）",...results.map(()=>gfit.n+" / "+gfit.df)]);
      rows.push(["AICc（全体）",...results.map(()=>fmt(gfit.aicc,2))]);
      rows.push(["収束",...results.map(()=>gfit.converged?"✔ 収束":"反復上限")]);
    }else{
      rows.push(["R²（決定係数）",...results.map(r=>fmt(r.fit.r2,4))]);
      rows.push(["Sy.x（残差SD）",...results.map(r=>fmt(r.fit.sy,4))]);
      rows.push(["残差平方和",...results.map(r=>fmt(r.fit.ss,4))]);
      rows.push(["データ点数 / 自由度",...results.map(r=>r.fit.n+" / "+r.fit.df)]);
      rows.push(["AICc",...results.map(r=>fmt(r.fit.aicc,2))]);
      rows.push(["Runs test P（系統的ずれ）",...results.map(r=>isFinite(r.fit.runsP)?pCell(r.fit.runsP):"—")]);
      rows.push(["収束",...results.map(r=>r.fit.converged?"✔ 収束":"反復上限（"+r.fit.iter+"回）")]);
    }
    let html='<p class="mini" style="margin-top:0">モデル： <b>'+esc(M.custom?("Y = "+p.custom):M.eq)+"</b>"
      +(useGlobal?' 　<span class="pill">グローバルフィット：'+pnames.filter((_,i)=>shared[i]).map(esc).join("・")+" を共有</span>":"")+"</p>"
      +T(["パラメータ",...results.map(r=>esc(r.label))],rows);
    if(routRows.length){
      html+='<h3 style="margin:14px 0 6px;font-size:13px">ROUT法による外れ値（Q = '+fmt((p.routQ||0.01)*100,1)+"%）</h3>"
        +T(["データセット","元の点数","外れ値の数","RSDR","除外した点 (X, Y)"],routRows)
        +'<p class="mini">上記の点を除いて当てはめた結果を表示しています。除外前の点はグラフ上で ✕ 印になります。</p>';
    }
    if(cmpShared){
      html+='<h3 style="margin:14px 0 6px;font-size:13px">共有パラメータの検定（Extra sum-of-squares F test）</h3>'
        +T(["帰無仮説","F","自由度","P値","結論"],
          [["共有したパラメータは全データセットで同じ値である",fmt(cmpShared.F,4),cmpShared.dfN+", "+cmpShared.dfD,
            pStarCell(cmpShared.p),
            cmpShared.p<0.05?"<b>データセット間で異なる</b>（共有は棄却）":"同じ値とみなしてよい（共有モデルで十分）"]]);
    }
    if(p.compare!=="none"){
      const M2=NLMODELS.find(m=>m.id===p.compare);
      if(M2){
        const crows=[];
        results.forEach(r=>{
          if(r.global)return;
          const f2=lmFit(r.s.x,r.s.y,M2.f,M2.init(r.s.x,r.s.y),{});
          if(f2.error)return;
          const simple=f2.df>r.fit.df?f2:r.fit,complex=f2.df>r.fit.df?r.fit:f2;
          const e=extraSSF(simple,complex);
          crows.push([esc(r.label),fmt(f2.ss,3)+" / "+fmt(r.fit.ss,3),fmt(e.F,3),e.dfN+", "+e.dfD,pCell(e.p),
            e.p<0.05?"複雑なモデルを採用":"単純なモデルで十分",fmt(r.fit.aicc-f2.aicc,2)]);
        });
        if(crows.length)html+='<h3 style="margin:14px 0 6px;font-size:13px">モデルの比較（'+esc(M2.name)+" vs "+esc(M.name)+"）</h3>"
          +T(["データセット","SS（比較 / 本モデル）","F","df","P値","結論","ΔAICc"],crows);
      }
    }
    if(p.interp&&p.interp.trim()){
      const ys=p.interp.split(/[,\s]+/).map(parseFloat).filter(v=>isFinite(v));
      if(ys.length){
        html+='<h3 style="margin:14px 0 6px;font-size:13px">曲線からの内挿</h3>'
          +T(["Y",...results.map(r=>esc(r.label)+" の X")],
            ys.map(yv=>[fmt(yv),...results.map(r=>{
              const hits=interpX(fnFor,r.params,yv,Math.min(...r.s.x),Math.max(...r.s.x));
              return hits.length?hits.map(h=>fmtSig(h,5)).join(" / "):"範囲外";
            })]));
      }
    }
    const r0=results[0];
    let vtxt="R² = "+fmt(useGlobal?gfit.r2:r0.fit.r2,4)+" で当てはまりました。";
    if(M.derived){
      const d=M.derived(r0.params);
      vtxt+=" "+d.map(x=>"<b>"+x[0]+" = "+fmtSig(x[1],4)+"</b>").join("、")+"。";
    }
    if(cmpShared)vtxt+=cmpShared.p<0.05
      ? " 共有したパラメータはデータセット間で有意に異なります（P "+(cmpShared.p<0.0001?"&lt; 0.0001":"= "+fmt(cmpShared.p,4))+"）。"
      : " 共有したパラメータはデータセット間で差がなく、1つの値にまとめてよいと判断されます（P = "+fmt(cmpShared.p,4)+"）。";
    if(!useGlobal&&isFinite(r0.fit.runsP)&&r0.fit.runsP<0.05)
      vtxt+=" ただし Runs test が有意で、データが曲線から系統的にずれています（別のモデルを検討してください）。";
    return {html:html+verdict(vtxt),
      data:{fits:results.map(r=>({g:r.s.g,type:"curve",fn:fnFor,params:r.params,
        xmin:Math.min(...r.s.x),xmax:Math.max(...r.s.x),label:r.label,
        r2:useGlobal?gfit.r2:r.fit.r2,outliers:r.s.outliers}))}};
  }
};
/* ---------- 曲線下面積 ---------- */
ANALYSES.auc={
  name:"曲線下面積（AUC）",cat:"XY・回帰",for:["xy"],
  desc:"台形法で曲線下面積を計算します。ピークごとの面積も算出。",
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i),base:0,useMean:true}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +'<div class="frow"><label>ベースライン Y</label><input type="number" name="base" step="any" value="'+(p.base||0)+'" style="width:110px"></div>'
   +'<label class="chk"><input type="checkbox" name="useMean"'+(p.useMean!==false?" checked":"")+">反復は平均値を使う</label>",
  read:(bg)=>({ds:readDs(bg,"ds"),base:parseFloat(val(bg,"base"))||0,useMean:val(bg,"useMean")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const rows=[],peakRows=[];
    ds.forEach(g=>{
      let x,y;
      if(p.useMean){const m=xyMeans(sh,g);x=m.map(v=>v.x);y=m.map(v=>v.mean);}
      else{const pr=xyPairs(sh,g);x=pr.map(v=>v[0]);y=pr.map(v=>v[1]);}
      if(x.length<2)return;
      const a=areaUnderCurve(x,y,p.base);
      rows.push([esc(sh.groups[g].name),fmt(a.total,4),fmt(a.positive,4),fmt(a.negative,4),a.peaks.length,
        fmt(Math.min(...x))+" 〜 "+fmt(Math.max(...x))]);
      a.peaks.forEach((pk,i)=>peakRows.push([esc(sh.groups[g].name),"ピーク"+(i+1),fmt(pk.start,3)+" 〜 "+fmt(pk.end,3),
        fmt(pk.peakX,3),fmt(pk.peakY,3),fmt(pk.area,4)]));
    });
    if(!rows.length)return {html:errBox("2点以上のデータが必要です。")};
    return {html:T(["データセット","総面積","正の面積","負の面積","ピーク数","X範囲"],rows)
      +(peakRows.length?'<h3 style="margin:14px 0 6px;font-size:13px">ピークごとの面積</h3>'
        +T(["データセット","ピーク","X範囲","ピークX","ピークY","面積"],peakRows):"")
      +verdict("台形法による面積です。ベースライン Y = "+fmt(p.base)+" を基準としています。曲線の形が異なる場合、AUCが同じでも生物学的意味は異なる点に注意してください。")};
  }
};
/* ---------- 平滑化・スプライン ---------- */
ANALYSES.smooth={
  name:"平滑化・スプライン曲線",cat:"XY・回帰",for:["xy"],
  desc:"移動平均または3次スプラインで滑らかな曲線を作り、グラフに重ねます。",
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i),method:"spline",win:5}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +selOpt("method","方法",[["spline","3次スプライン（点を通る滑らかな曲線）"],["ma","移動平均"]],p.method)
   +'<div class="frow"><label>移動平均の幅</label><input type="number" name="win" min="3" max="21" step="2" value="'+(p.win||5)+'" style="width:80px"></div>',
  read:(bg)=>({ds:readDs(bg,"ds"),method:val(bg,"method"),win:+val(bg,"win")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const curves=[];
    ds.forEach(g=>{
      const m=xyMeans(sh,g);
      if(m.length<3)return;
      const x=m.map(v=>v.x),y=m.map(v=>v.mean);
      const pts=p.method==="spline"?cubicSpline(x,y,200):smoothMovingAvg(x,y,p.win||5);
      curves.push({g,label:sh.groups[g].name,pts});
    });
    if(!curves.length)return {html:errBox("3点以上のデータが必要です。")};
    return {html:T(["データセット","点数","方法","X範囲"],
      curves.map(c=>[esc(c.label),c.pts.length,p.method==="spline"?"3次スプライン":"移動平均（幅"+(p.win||5)+"）",
        fmt(c.pts[0][0],3)+" 〜 "+fmt(c.pts[c.pts.length-1][0],3)]))
      +verdict("平滑化曲線は<b>見た目の傾向を示すためのもの</b>で、統計的なモデルではありません。パラメータ（EC50など）を求める場合は非線形回帰を使ってください。グラフの書式パネルで「あてはめ曲線を表示」をオンにすると重ねて描画されます。"),
      data:{fits:curves.map(c=>({g:c.g,type:"points",pts:c.pts}))}};
  }
};
/* ---------- 分割表 ---------- */
ANALYSES.cont={
  name:"分割表の解析",cat:"分割表・生存",for:["contingency"],
  desc:"χ²検定・Fisherの正確検定・オッズ比・相対危険度・感度/特異度などを計算します。",
  defaults:()=>({test:"auto",paired:false,diag:true}),
  form:(sh,p)=>selOpt("test","検定",[["auto","自動（2×2で期待度数が小さければFisher）"],["chi2","χ²検定（Yates補正なし）"],
     ["yates","χ²検定（Yates補正あり）"],["fisher","Fisherの正確検定"],["trend","χ²傾向検定（Cochran-Armitage）"]],p.test)
   +'<label class="chk"><input type="checkbox" name="paired"'+(p.paired?" checked":"")+">対応のあるデータ（McNemar検定）</label><br>"
   +'<label class="chk"><input type="checkbox" name="diag"'+(p.diag!==false?" checked":"")+">感度・特異度・陽性的中率なども計算する（2×2）</label>",
  read:(bg)=>({test:val(bg,"test"),paired:val(bg,"paired"),diag:val(bg,"diag")}),
  run:(sh,p)=>{
    const nR=usedRows(sh);
    const table=[],rowLabels=[];
    for(let r=0;r<nR;r++){
      const row=sh.groups.map((_,c)=>{const v=cellNum(sh,r,c,0);return isNaN(v)?0:v;});
      if(sum(row)>0){table.push(row);rowLabels.push(sh.rows[r].t||("行"+(r+1)));}
    }
    if(table.length<2||table[0].length<2)return {html:errBox("2行×2列以上の度数が必要です。")};
    const colLabels=sh.groups.map(g=>g.name);
    const chi=chi2Test(table);
    const is2x2=table.length===2&&table[0].length===2;
    const rowSum=table.map(sum),colSum=colLabels.map((_,j)=>sum(table.map(r=>r[j])));
    let html=T([" ",...colLabels.map(esc),"合計","行内%"],
      table.map((r,i)=>[esc(rowLabels[i]),...r.map(v=>String(v)),rowSum[i],
        r.map(v=>fmt(v/rowSum[i]*100,1)+"%").join(" / ")])
      .concat([["合計",...colSum.map(String),sum(colSum),""]]));
    const rows=[];
    if(p.paired&&is2x2){
      const m=mcnemar(table[0][0],table[0][1],table[1][0],table[1][1]);
      rows.push(["McNemar χ²（連続性補正）",fmt(m.chi2,4)],["自由度",m.df],["P値",pStarCell(m.p)],
        ["正確検定（二項）P値",pStarCell(m.pExact)],["不一致ペア",m.b+" / "+m.c]);
    }else{
      let useFisher=p.test==="fisher"||(p.test==="auto"&&is2x2&&chi.minExp<5);
      if(p.test==="trend"&&table.length===2){
        const tr=chi2Trend(table);
        rows.push(["Cochran-Armitage 傾向検定 χ²",fmt(tr.chi2,4)],["z",fmt(tr.z,3)],["P値",pStarCell(tr.p)]);
      }
      let yates=p.test==="yates";
      let chi2v=chi.chi2,pv=chi.p;
      if(yates&&is2x2){
        const N=chi.N;
        chi2v=N*Math.pow(Math.abs(table[0][0]*table[1][1]-table[0][1]*table[1][0])-N/2,2)/(rowSum[0]*rowSum[1]*colSum[0]*colSum[1]);
        pv=chi2Pvalue(chi2v,1);
      }
      if(p.test!=="trend"){
        rows.push(["χ²"+(yates?"（Yates補正）":""),fmt(chi2v,4)],["自由度",chi.df],["χ²検定 P値",pStarCell(pv)]);
        if(is2x2){
          const f=fisherExact2x2(table[0][0],table[0][1],table[1][0],table[1][1]);
          rows.push(["Fisherの正確検定 P値（両側）",pStarCell(f.p)]);
        }
        rows.push(["Cramér's V（関連の強さ）",fmt(chi.cramerV,3)],
          ["最小期待度数",fmt(chi.minExp,2)+(chi.minExp<5?" ⚠ 5未満":"")]);
      }
    }
    html+='<h3 style="margin:14px 0 6px;font-size:13px">検定結果</h3>'+T(["項目","値"],rows);
    let effP=null;
    if(is2x2){
      const [a,b]=table[0],[c,d]=table[1];
      const e=orRr2x2(a,b,c,d),rd=riskDiff(a,b,c,d);
      html+='<h3 style="margin:14px 0 6px;font-size:13px">効果の大きさ</h3>'
        +T(["指標","推定値","95% 信頼区間"],
          [["オッズ比 OR",fmt(e.or,3),ciTxt(e.orLo,e.orHi,3)],
           ["相対危険度 RR",fmt(e.rr,3),ciTxt(e.rrLo,e.rrHi,3)],
           ["リスク差 RD",fmt(rd.rd*100,2)+" %",fmt(rd.lo*100,2)+" 〜 "+fmt(rd.hi*100,2)+" %"],
           ["治療必要数 NNT",fmt(rd.nnt,1),"—"]]);
      if(p.diag!==false){
        const dg=diagnostic2x2(a,b,c,d);
        html+='<h3 style="margin:14px 0 6px;font-size:13px">診断能（1行目＝疾患あり／1列目＝検査陽性として計算）</h3>'
          +T(["指標","値","95% CI"],
            [["感度",fmt(dg.sens*100,1)+"%",fmt(dg.sensCI[0]*100,1)+" 〜 "+fmt(dg.sensCI[1]*100,1)+"%"],
             ["特異度",fmt(dg.spec*100,1)+"%",fmt(dg.specCI[0]*100,1)+" 〜 "+fmt(dg.specCI[1]*100,1)+"%"],
             ["陽性的中率 PPV",fmt(dg.ppv*100,1)+"%",fmt(dg.ppvCI[0]*100,1)+" 〜 "+fmt(dg.ppvCI[1]*100,1)+"%"],
             ["陰性的中率 NPV",fmt(dg.npv*100,1)+"%",fmt(dg.npvCI[0]*100,1)+" 〜 "+fmt(dg.npvCI[1]*100,1)+"%"],
             ["陽性尤度比 LR+",fmt(dg.lrPos,2),"—"],["陰性尤度比 LR−",fmt(dg.lrNeg,3),"—"],
             ["正診率",fmt(dg.acc*100,1)+"%","—"],["Youden index",fmt(dg.youden,3),"—"]]);
      }
      effP=chi.p;
    }
    if(chi.lowExpCells>0)html+=warnBox("期待度数が5未満のセルが "+chi.lowExpCells+" / "+chi.totalCells+" 個あります。χ²検定の近似が不正確になるため、<b>Fisherの正確検定</b>の結果を採用してください。");
    return {html:html+verdict(chi.p<0.05?"行と列の間に統計学的に有意な関連があります（P "+(chi.p<0.0001?"&lt; 0.0001":"= "+fmt(chi.p,4))+"）。"
      :"行と列の間に有意な関連は認められませんでした（P = "+fmt(chi.p,4)+"）。"),
      data:{table,rowLabels,colLabels,p:chi.p}};
  }
};
/* ---------- 生存解析 ---------- */
ANALYSES.km={
  name:"生存曲線の解析（Kaplan-Meier）",cat:"分割表・生存",for:["survival"],
  desc:"生存曲線・生存中央値・log-rank検定・ハザード比を計算します。",
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i),test:"logrank",times:"",ci:0.95}),
  form:(sh,p)=>dsChecks(sh,"ds",p.ds)
   +selOpt("test","群間比較",[["logrank","log-rank検定（Mantel-Cox）"],["gehan","Gehan-Breslow-Wilcoxon検定"],["both","両方"]],p.test)
   +'<div class="frow"><label>指定時点の生存率</label><input type="text" name="times" value="'+esc(p.times||"")+'" style="width:240px" placeholder="例: 6, 12, 24（カンマ区切り）"></div>'
   +ciSel(p.ci),
  read:(bg)=>({ds:readDs(bg,"ds"),test:val(bg,"test"),times:val(bg,"times"),ci:+val(bg,"ci")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const groups=[];
    ds.forEach(g=>{
      const times=[],events=[];
      for(let r=0;r<sh.rows.length;r++){
        const t=parseNum(sh.rows[r].x),e=cellNum(sh,r,g,0);
        if(!isNaN(t)&&!isNaN(e))
        {times.push(t);events.push(e>=1?1:0);}
      }
      if(times.length)groups.push({label:sh.groups[g].name,times,events,idx:g,km:kmFull(times,events,p.ci||0.95)});
    });
    if(!groups.length)return {html:errBox("X列に生存期間、群の列に 1（イベント）/ 0（打ち切り）を入力してください。")};
    const rows=groups.map(g=>[esc(g.label),g.km.n,g.km.events,g.km.censored,
      g.km.median===null?"未到達":fmt(g.km.median,2),
      g.km.median===null?"—":(g.km.medianLo===null?"—":fmt(g.km.medianLo,2))+" 〜 "+(g.km.medianHi===null?"未到達":fmt(g.km.medianHi,2)),
      fmt(g.km.maxT,1)]);
    let html=T(["群","n","イベント数","打ち切り","生存期間中央値","95% CI","最長観察"],rows);
    const ts=(p.times||"").split(/[,\s]+/).map(parseFloat).filter(v=>isFinite(v));
    if(ts.length){
      html+='<h3 style="margin:14px 0 6px;font-size:13px">指定時点の生存率</h3>'
       +T(["時点",...groups.map(g=>esc(g.label))],
         ts.map(t=>[fmt(t,1),...groups.map(g=>{
           const s=g.km.surviveAt(t),c=g.km.ciAt(t);
           return fmt(s*100,1)+"% <span class='mini'>("+fmt(c[0]*100,1)+"–"+fmt(c[1]*100,1)+"%)</span>";
         })]));
    }
    let cmpP=null;
    if(groups.length>=2){
      const c=survivalCompare(groups);
      cmpP=c.p;
      const crows=[];
      if(p.test!=="gehan")crows.push(["log-rank（Mantel-Cox）χ²",fmt(c.chi2,4),c.df,pStarCell(c.p)]);
      if(p.test!=="logrank")crows.push(["Gehan-Breslow-Wilcoxon χ²",fmt(c.chi2Gehan,4),c.df,pStarCell(c.pGehan)]);
      if(isFinite(c.trendZ))crows.push(["log-rank 傾向検定 z",fmt(c.trendZ,3),1,pStarCell(c.trendP)]);
      html+='<h3 style="margin:14px 0 6px;font-size:13px">群間比較</h3>'+T(["検定","統計量","df","P値"],crows);
      html+=T(["群","観測イベント O","期待イベント E","O/E"],
        groups.map((g,i)=>[esc(g.label),fmt(c.O[i],1),fmt(c.E[i],2),fmt(c.O[i]/c.E[i],3)]));
      if(c.hr){
        html+='<h3 style="margin:14px 0 6px;font-size:13px">ハザード比（'+esc(groups[0].label)+" / "+esc(groups[1].label)+"）</h3>"
          +T(["方法","HR","95% CI"],
            [["log-rank法",fmt(c.hr.hr,3),ciTxt(c.hr.lo,c.hr.hi,3)],
             ["Mantel-Haenszel法",fmt(c.hr.mh,3),ciTxt(c.hr.mhLo,c.hr.mhHi,3)]])
          +'<p class="mini">HR &gt; 1 は '+esc(groups[0].label)+" の方がイベントが起こりやすいことを意味します。</p>";
      }
    }
    // リスク集合表
    const maxT=Math.max(...groups.map(g=>g.km.maxT));
    const step=maxT/5;
    const marks=[0,1,2,3,4,5].map(i=>+(i*step).toPrecision(2));
    html+='<h3 style="margin:14px 0 6px;font-size:13px">Number at risk</h3>'
     +T(["群",...marks.map(t=>fmt(t,1))],groups.map(g=>[esc(g.label),...marks.map(t=>g.km.atRiskAtT(t))]));
    return {html:html+verdict(cmpP===null?"1群のみの解析です。"
      :(cmpP<0.05?"生存曲線に統計学的有意差があります（log-rank P "+(cmpP<0.0001?"&lt; 0.0001":"= "+fmt(cmpP,4))+"）。"
        :"生存曲線に有意差は認められませんでした（log-rank P = "+fmt(cmpP,4)+"）。")
      +" 生存期間中央値は "+groups.map(g=>esc(g.label)+" "+(g.km.median===null?"未到達":fmt(g.km.median,1))).join("、")+" です。"),
      data:{groups:groups.map(g=>({idx:g.idx,label:g.label,km:g.km})),p:cmpP}};
  }
};
/* ---------- 割合 ---------- */
ANALYSES.fraction={
  name:"全体に占める割合",cat:"基本",for:["parts","contingency","column"],
  desc:"各値が合計に占める割合（%）を計算します。円グラフの数値表として使えます。",
  form:(sh,p)=>dsChecks(sh,"ds",p.ds),
  read:(bg)=>({ds:readDs(bg,"ds")}),
  run:(sh,p)=>{
    const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
    const nR=usedRows(sh);
    const labels=sh.rows.slice(0,nR).map((r,i)=>r.t||("項目"+(i+1)));
    const cols=ds.map(g=>({name:sh.groups[g].name,vals:sh.rows.slice(0,nR).map((_,r)=>{const v=cellNum(sh,r,g,0);return isNaN(v)?0:v;})}));
    const totals=cols.map(c=>sum(c.vals));
    const rows=labels.map((L,i)=>[esc(L),...cols.map((c,j)=>c.vals[i]+" ("+fmt(c.vals[i]/totals[j]*100,1)+"%)")]);
    rows.push(["合計",...totals.map(t=>String(t)+" (100%)")]);
    return {html:T(["項目",...cols.map(c=>esc(c.name))],rows),
      data:{labels,cols,totals}};
  }
};
/* ---------- 多変数表：共通ユーティリティ ---------- */
function mvComplete(sh,idxs){
  const rows=[],src=[];
  for(let r=0;r<sh.rows.length;r++){
    const v=idxs.map(g=>cellNum(sh,r,g,0));
    if(v.every(x=>!isNaN(x))){rows.push(v);src.push(r);}
  }
  return {rows,src};
}
function varSel(sh,name,label,cur){
  return '<div class="frow"><label>'+label+'</label><select name="'+name+'">'
   +sh.groups.map((g,i)=>'<option value="'+i+'"'+(+cur===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select></div>";
}
function varChecks(sh,name,label,sel,exclude){
  return '<div class="frow" style="align-items:flex-start"><label>'+label+'</label><div>'
   +sh.groups.map((g,i)=>(exclude!==undefined&&i===+exclude)?"":
     '<label class="chk" style="margin-right:12px"><input type="checkbox" name="'+name+'" value="'+i+'"'
     +(sel&&sel.includes(i)?" checked":"")+"> "+esc(g.name)+"</label>").join("")+"</div></div>";
}
/* ---------- 相関行列 ---------- */
ANALYSES.corrmat={
  name:"相関行列",cat:"多変数",for:["multivar","column","xy"],
  desc:"すべての変数ペアの相関係数を行列で表示します（ヒートマップにも使えます）。",
  defaults:(sh)=>({vars:sh.groups.map((_,i)=>i),method:"pearson"}),
  form:(sh,p)=>varChecks(sh,"vars","変数",p.vars)
   +selOpt("method","係数",[["pearson","Pearson"],["spearman","Spearman"]],p.method),
  read:(bg)=>({vars:readDs(bg,"vars"),method:val(bg,"method")}),
  run:(sh,p)=>{
    const vs=(p.vars&&p.vars.length?p.vars:sh.groups.map((_,i)=>i));
    if(vs.length<2)return {html:errBox("2変数以上を選んでください。")};
    const M=[],Pm=[];
    for(let i=0;i<vs.length;i++){
      M.push([]);Pm.push([]);
      for(let j=0;j<vs.length;j++){
        const {rows}=mvComplete(sh,[vs[i],vs[j]]);
        if(rows.length<4){M[i].push(NaN);Pm[i].push(NaN);continue;}
        const a=rows.map(r=>r[0]),b=rows.map(r=>r[1]);
        const r=p.method==="pearson"?pearson(a,b):spearman(a,b);
        M[i].push(p.method==="pearson"?r.r:r.rho);Pm[i].push(r.p);
      }
    }
    const names=vs.map(v=>sh.groups[v].name);
    const cellFmt=(v,pv,i,j)=>{
      if(i===j)return "<b>1.000</b>";
      const col=v>0?"rgba(31,111,208,":"rgba(224,96,60,";
      const alpha=Math.min(0.65,Math.abs(v)*0.75);
      return '<span style="display:block;background:'+col+alpha+');padding:2px 4px;border-radius:3px">'
        +fmt(v,3)+(pv<0.05?' <span class="sigstar">'+star(pv)+"</span>":"")+"</span>";
    };
    return {html:T([p.method==="pearson"?"r":"ρ",...names.map(esc)],
      names.map((n,i)=>[esc(n),...names.map((_,j)=>cellFmt(M[i][j],Pm[i][j],i,j))]))
      +verdict("色が濃いほど相関が強く、青＝正の相関、赤＝負の相関です。* は P&lt;0.05（多重性は未補正）。"),
      data:{matrix:M,pmatrix:Pm,names,vars:vs}};
  }
};
/* ---------- 重回帰 ---------- */
ANALYSES.mreg={
  name:"重回帰分析",cat:"多変数",for:["multivar","column"],
  desc:"複数の説明変数から連続量の目的変数を予測するモデルを当てはめます。",
  defaults:(sh)=>({y:0,xs:sh.groups.map((_,i)=>i).slice(1)}),
  form:(sh,p)=>varSel(sh,"y","目的変数 Y",p.y)+varChecks(sh,"xs","説明変数 X",p.xs),
  read:(bg)=>({y:+val(bg,"y"),xs:readDs(bg,"xs")}),
  run:(sh,p)=>{
    const xs=(p.xs||[]).filter(i=>i!==p.y);
    if(!xs.length)return {html:errBox("説明変数を1つ以上選んでください。")};
    const {rows}=mvComplete(sh,[p.y].concat(xs));
    if(rows.length<xs.length+2)return {html:errBox("症例数が不足しています。")};
    const y=rows.map(r=>r[0]);
    const X=rows.map(r=>[1,...r.slice(1)]);
    const names=["切片",...xs.map(i=>sh.groups[i].name)];
    const r=linReg(X,y,names);
    if(r.error)return {html:errBox(r.error)};
    // 標準化偏回帰係数とVIF
    const sy=sd(y);
    const vif=xs.map((_,k)=>{
      if(xs.length<2)return 1;
      const others=xs.map((__,m)=>m).filter(m=>m!==k);
      const Xk=rows.map(rr=>[1,...others.map(m=>rr[1+m])]);
      const yk=rows.map(rr=>rr[1+k]);
      const rk=linReg(Xk,yk,others.map(String));
      return rk.error?NaN:1/(1-rk.r2);
    });
    return {html:T(["変数","係数 B","標準誤差","95% CI","標準化β","t","P値","VIF"],
      names.map((n,i)=>[esc(n),fmt(r.beta[i],5),fmt(r.se[i],5),ciTxt(r.ciLo[i],r.ciHi[i],4),
        i===0?"—":fmt(r.beta[i]*sd(rows.map(rr=>rr[i]))/sy,3),fmt(r.tvals[i],3),pStarCell(r.ps[i]),
        i===0?"—":fmt(vif[i-1],2)+(vif[i-1]>5?" ⚠":"")]))
      +T(["モデル全体","値"],
        [["R²",fmt(r.r2,4)],["自由度調整済みR²",fmt(r.adjR2,4)],["F値",fmt(r.F,3)],
         ["モデルのP値",pStarCell(r.modelP)],["残差の標準偏差 RMSE",fmt(r.rmse,4)],["症例数 n",r.n]])
      +(vif.some(v=>v>5)?warnBox("VIF &gt; 5 の変数があります。説明変数どうしの相関が強く（多重共線性）、係数の解釈が不安定です。"):"")
      +verdict("回帰式：Y = "+fmt(r.beta[0],3)+names.slice(1).map((n,i)=>(r.beta[i+1]>=0?" + ":" − ")+fmt(Math.abs(r.beta[i+1]),3)+"×"+esc(n)).join("")
        +"。説明変数全体でYの変動の "+fmt(r.r2*100,1)+"% を説明します。"),
      data:{fit:r}};
  }
};
/* ---------- ロジスティック回帰 ---------- */
ANALYSES.logit={
  name:"ロジスティック回帰",cat:"多変数",for:["multivar","column"],
  desc:"2値アウトカム（あり/なし）に対するオッズ比を、複数因子を調整して推定します。",
  defaults:(sh)=>({y:sh.groups.length-1,xs:sh.groups.map((_,i)=>i).slice(0,-1)}),
  form:(sh,p)=>varSel(sh,"y","目的変数（0/1）",p.y)+varChecks(sh,"xs","説明変数",p.xs)
   +'<p class="mini">目的変数は 0（なし）と 1（あり）で入力してください。</p>',
  read:(bg)=>({y:+val(bg,"y"),xs:readDs(bg,"xs")}),
  run:(sh,p)=>{
    const xs=(p.xs||[]).filter(i=>i!==p.y);
    if(!xs.length)return {html:errBox("説明変数を選んでください。")};
    const {rows}=mvComplete(sh,[p.y].concat(xs));
    const y=rows.map(r=>r[0]);
    if(!y.every(v=>v===0||v===1))return {html:errBox("目的変数は 0 と 1 のみで入力してください。")};
    if(rows.length<xs.length+5)return {html:errBox("症例数が不足しています。")};
    const X=rows.map(r=>[1,...r.slice(1)]);
    const names=["切片",...xs.map(i=>sh.groups[i].name)];
    const r=logisticReg(X,y,names);
    if(r.error)return {html:errBox(r.error)};
    return {html:T(["変数","係数","標準誤差","オッズ比","95% CI","z","P値"],
      names.map((n,i)=>[esc(n),fmt(r.beta[i],4),fmt(r.se[i],4),i===0?"—":fmt(r.or[i],3),
        i===0?"—":ciTxt(r.orLo[i],r.orHi[i],3),fmt(r.zvals[i],3),pStarCell(r.ps[i])]))
      +T(["モデル全体","値"],
        [["尤度比検定 χ²",fmt(r.lrChi2,3)],["モデルのP値",pStarCell(r.modelP)],
         ["McFadden 疑似R²",fmt(r.mcfadden,4)],["AUC（判別能）",fmt(r.auc,3)],
         ["症例数 / イベント数",r.n+" / "+r.nPos]])
      +(r.separation?warnBox("完全分離が疑われます（係数が極端に大きい）。カテゴリの併合や変数の削減を検討してください。"):"")
      +verdict("オッズ比 &gt; 1 はイベントが起こりやすいことを示します。AUC = "+fmt(r.auc,3)+"（0.7以上で中等度、0.8以上で良好な判別能）。"),
      data:{fit:r}};
  }
};
/* ---------- Cox回帰 ---------- */
ANALYSES.cox={
  name:"Cox比例ハザード回帰",cat:"多変数",for:["multivar"],
  desc:"生存時間に対する複数因子の影響（ハザード比）を推定します。",
  defaults:(sh)=>({t:0,e:1,xs:sh.groups.map((_,i)=>i).slice(2)}),
  form:(sh,p)=>varSel(sh,"t","生存期間",p.t)+varSel(sh,"e","イベント(1)/打ち切り(0)",p.e)
   +varChecks(sh,"xs","説明変数",p.xs),
  read:(bg)=>({t:+val(bg,"t"),e:+val(bg,"e"),xs:readDs(bg,"xs")}),
  run:(sh,p)=>{
    const xs=(p.xs||[]).filter(i=>i!==p.t&&i!==p.e);
    if(!xs.length)return {html:errBox("説明変数を選んでください。")};
    const {rows}=mvComplete(sh,[p.t,p.e].concat(xs));
    const times=rows.map(r=>r[0]),events=rows.map(r=>r[1]?1:0);
    const X=rows.map(r=>r.slice(2));
    const names=xs.map(i=>sh.groups[i].name);
    const r=coxPH(times,events,X,names);
    if(r.error)return {html:errBox(r.error)};
    return {html:T(["変数","係数","標準誤差","ハザード比","95% CI","z","P値"],
      names.map((n,i)=>[esc(n),fmt(r.beta[i],4),fmt(r.se[i],4),fmt(r.hr[i],3),
        ciTxt(r.hrLo[i],r.hrHi[i],3),fmt(r.zvals[i],3),pStarCell(r.ps[i])]))
      +T(["モデル全体","値"],[["症例数 / イベント数",r.n+" / "+r.nEvents],
        ["Harrell's C統計量",fmt(r.cIndex,3)],["収束",r.converged?"✔":"反復上限"]])
      +verdict("ハザード比 &gt; 1 はイベント発生リスクが高いことを示します。イベント数は説明変数1個あたり10以上が目安です（現在 "+r.nEvents+" イベント／"+names.length+" 変数）。"),
      data:{fit:r}};
  }
};
/* ---------- 主成分分析 ---------- */
ANALYSES.pca={
  name:"主成分分析（PCA）",cat:"多変数",for:["multivar"],
  desc:"多数の変数を少数の主成分に要約し、寄与率・因子負荷量・スコアを求めます。",
  defaults:(sh)=>({vars:sh.groups.map((_,i)=>i)}),
  form:(sh,p)=>varChecks(sh,"vars","変数",p.vars),
  read:(bg)=>({vars:readDs(bg,"vars")}),
  run:(sh,p)=>{
    const vs=(p.vars&&p.vars.length?p.vars:sh.groups.map((_,i)=>i));
    if(vs.length<2)return {html:errBox("2変数以上を選んでください。")};
    const {rows}=mvComplete(sh,vs);
    if(rows.length<vs.length+1)return {html:errBox("症例数が不足しています。")};
    const names=vs.map(v=>sh.groups[v].name);
    const r=pcaAnalyze(rows,names);
    let cum=0;
    const eigRows=r.eig.map((e,i)=>{
      cum+=r.explained[i];
      return ["PC"+(i+1),fmt(e.val,4),fmt(r.explained[i],2)+"%",fmt(cum,2)+"%"];
    });
    const nShow=Math.min(4,r.eig.length);
    const loadRows=names.map((n,j)=>[esc(n),...Array.from({length:nShow},(_,k)=>fmt(r.eig[k].vec[j]*Math.sqrt(Math.max(0,r.eig[k].val)),3))]);
    return {html:T(["主成分","固有値","寄与率","累積寄与率"],eigRows)
      +'<h3 style="margin:14px 0 6px;font-size:13px">因子負荷量</h3>'
      +T(["変数",...Array.from({length:nShow},(_,k)=>"PC"+(k+1))],loadRows)
      +verdict("第1・第2主成分で全変動の "+fmt(r.explained[0]+r.explained[1],1)+"% を説明します。散布図（PCAスコア）はグラフ作成から「PCAスコア散布図」を選んでください。"),
      data:{pca:r,scores:r.scores,names}};
  }
};
/* ---------- ROC曲線 ---------- */
ANALYSES.roc={
  name:"ROC曲線",cat:"多変数",for:["column","multivar","xy"],
  desc:"検査値の診断能（AUC・最適カットオフ・感度・特異度）を評価します。",
  defaults:(sh)=>({a:0,b:Math.min(1,sh.groups.length-1),dir:"high"}),
  form:(sh,p)=>'<div class="frow"><label>疾患あり群</label><select name="a">'
   +sh.groups.map((g,i)=>'<option value="'+i+'"'+(p.a===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select>"
   +'<label style="min-width:auto">対照群</label><select name="b">'
   +sh.groups.map((g,i)=>'<option value="'+i+'"'+(p.b===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select></div>"
   +selOpt("dir","陽性の向き",[["high","値が高いほど疾患あり"],["low","値が低いほど疾患あり"]],p.dir),
  read:(bg)=>({a:+val(bg,"a"),b:+val(bg,"b"),dir:val(bg,"dir")}),
  run:(sh,p)=>{
    let A=colValues(sh,p.a),B=colValues(sh,p.b);
    if(A.length<3||B.length<3)return {html:errBox("各群に3個以上の値が必要です。")};
    if(p.dir==="low"){A=A.map(v=>-v);B=B.map(v=>-v);}
    const all=[...new Set([...A,...B])].sort((x,y)=>y-x);
    const pts=[{fpr:0,tpr:0,cut:Infinity}];
    all.forEach(c=>{
      const tp=A.filter(v=>v>=c).length,fp=B.filter(v=>v>=c).length;
      pts.push({fpr:fp/B.length,tpr:tp/A.length,cut:p.dir==="low"?-c:c,
        sens:tp/A.length,spec:1-fp/B.length,youden:tp/A.length-fp/B.length});
    });
    pts.push({fpr:1,tpr:1,cut:-Infinity});
    let auc=0;
    for(let i=1;i<pts.length;i++)auc+=(pts[i].fpr-pts[i-1].fpr)*(pts[i].tpr+pts[i-1].tpr)/2;
    const n1=A.length,n2=B.length;
    const q1=auc/(2-auc),q2=2*auc*auc/(1+auc);
    const se=Math.sqrt((auc*(1-auc)+(n1-1)*(q1-auc*auc)+(n2-1)*(q2-auc*auc))/(n1*n2));
    const z=(auc-0.5)/se,pv=2*(1-ncdf(Math.abs(z)));
    const best=pts.filter(x=>isFinite(x.cut)).sort((x,y)=>y.youden-x.youden)[0];
    const cand=pts.filter(x=>isFinite(x.cut));
    const step=Math.max(1,Math.floor(cand.length/15));
    const tblRows=cand.filter((_,i)=>i%step===0).map(x=>[fmt(x.cut,3),fmt(x.sens*100,1)+"%",fmt(x.spec*100,1)+"%",
      fmt(x.youden,3),fmt(x.spec<1?x.sens/(1-x.spec):Infinity,2)]);
    return {html:T(["指標","値"],
      [["AUC（曲線下面積）",fmt(auc,4)],["標準誤差",fmt(se,4)],
       ["95% CI",ciTxt(Math.max(0,auc-1.96*se),Math.min(1,auc+1.96*se),3)],
       ["AUC = 0.5 との検定 P値",pStarCell(pv)],
       ["最適カットオフ（Youden法）",fmt(best.cut,4)],
       ["　その感度 / 特異度",fmt(best.sens*100,1)+"% / "+fmt(best.spec*100,1)+"%"],
       ["症例数（疾患あり / 対照）",n1+" / "+n2]])
      +'<h3 style="margin:14px 0 6px;font-size:13px">カットオフ値ごとの成績</h3>'
      +T(["カットオフ","感度","特異度","Youden index","LR+"],tblRows)
      +verdict("AUC = "+fmt(auc,3)+"（0.7〜0.8：中等度、0.8〜0.9：良好、0.9以上：優秀）。グラフ作成から「ROC曲線」を選ぶと図にできます。"),
      data:{roc:pts,auc,se,best,a:p.a,b:p.b}};
  }
};
