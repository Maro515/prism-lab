/* =====================================================================
   混合効果モデル（REML・被験者を変量効果とする）— 欠測のある反復測定に対応
   ===================================================================== */
function cholLogDet(A){
  const n=A.length,L=Array.from({length:n},()=>new Array(n).fill(0));
  let ld=0;
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    let s=A[i][j];
    for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];
    if(i===j){if(s<=0)return NaN;L[i][i]=Math.sqrt(s);ld+=2*Math.log(L[i][i]);}
    else L[i][j]=s/L[j][j];
  }
  return ld;
}
function mixedREML(X,y,subjIdx){
  const N=y.length,p=X[0].length;
  const groups={};
  subjIdx.forEach((s,i)=>{(groups[s]=groups[s]||[]).push(i);});
  const gkeys=Object.keys(groups);
  const nSubj=gkeys.length;
  if(N<=p)return {error:"データ数がパラメータ数に対して不足しています。"};
  const evalTheta=(theta)=>{
    const A=Array.from({length:p},()=>new Array(p).fill(0));
    const b=new Array(p).fill(0);
    let logDetV=0;
    for(const k of gkeys){
      const idx=groups[k],n=idx.length,c=theta/(1+theta*n);
      logDetV+=Math.log(1+theta*n);
      const sx=new Array(p).fill(0);let sy=0;
      for(const i of idx){
        sy+=y[i];
        for(let a=0;a<p;a++){
          sx[a]+=X[i][a];b[a]+=X[i][a]*y[i];
          for(let bb=a;bb<p;bb++)A[a][bb]+=X[i][a]*X[i][bb];
        }
      }
      for(let a=0;a<p;a++){
        b[a]-=c*sx[a]*sy;
        for(let bb=a;bb<p;bb++)A[a][bb]-=c*sx[a]*sx[bb];
      }
    }
    for(let a=0;a<p;a++)for(let bb=0;bb<a;bb++)A[a][bb]=A[bb][a];
    const Ainv=matInv(A);
    if(!Ainv)return null;
    const beta=Ainv.map(r=>r.reduce((s,v,j)=>s+v*b[j],0));
    let q=0;
    for(const k of gkeys){
      const idx=groups[k],n=idx.length,c=theta/(1+theta*n);
      let sr=0,ss=0;
      for(const i of idx){
        const ri=y[i]-X[i].reduce((s,v,j)=>s+v*beta[j],0);
        sr+=ri;ss+=ri*ri;
      }
      q+=ss-c*sr*sr;
    }
    if(!(q>0))return null;
    const ldA=cholLogDet(A);
    if(!isFinite(ldA))return null;
    const ll=-0.5*(logDetV+(N-p)*Math.log(q/(N-p))+ldA+(N-p)*(1+Math.log(2*Math.PI)));
    return {A,Ainv,beta,q,ll,sigma2e:q/(N-p),theta};
  };
  // θ = σ²b/σ²e を REML 対数尤度で最大化（粗い格子→黄金分割）
  let best=evalTheta(0),bestT=0;
  for(let e=-6;e<=4;e+=0.25){
    const t=Math.pow(10,e),r=evalTheta(t);
    if(r&&(!best||r.ll>best.ll)){best=r;bestT=t;}
  }
  if(!best)return {error:"モデルを推定できませんでした（デザイン行列が特異です）。"};
  let lo=bestT/3.2,hi=bestT*3.2;
  if(bestT===0){lo=0;hi=1e-4;}
  const gr=(Math.sqrt(5)-1)/2;
  let a1=hi-gr*(hi-lo),b1=lo+gr*(hi-lo);
  let fa=evalTheta(a1),fb=evalTheta(b1);
  for(let it=0;it<60;it++){
    if((fa?fa.ll:-Infinity)>(fb?fb.ll:-Infinity)){hi=b1;b1=a1;fb=fa;a1=hi-gr*(hi-lo);fa=evalTheta(a1);}
    else{lo=a1;a1=b1;fa=fb;b1=lo+gr*(hi-lo);fb=evalTheta(b1);}
    if(hi-lo<1e-9)break;
  }
  for(const c of [fa,fb])if(c&&c.ll>best.ll)best=c;
  const cov=best.Ainv.map(r=>r.map(v=>v*best.sigma2e));
  return {beta:best.beta,cov,sigma2e:best.sigma2e,sigma2b:best.theta*best.sigma2e,theta:best.theta,
    icc:best.theta/(1+best.theta),logLik:best.ll,N,p,nSubj,groups,gkeys};
}
function waldF(beta,cov,cols){
  const k=cols.length;
  const S=cols.map(a=>cols.map(b=>cov[a][b]));
  const Si=matInv(S);
  if(!Si)return null;
  let q=0;
  for(let a=0;a<k;a++)for(let b=0;b<k;b++)q+=beta[cols[a]]*Si[a][b]*beta[cols[b]];
  return {F:q/k,df1:k};
}
function effectCode(level,nLev){ // 効果コーディング（最終水準を -1）
  const v=[];
  for(let i=0;i<nLev-1;i++)v.push(level===i?1:(level===nLev-1?-1:0));
  return v;
}
function buildMixedModel(obs,facA,facB){
  // obs: [{subj, y, a, b}]  facA/facB: 水準ラベル配列（facB は省略可）
  const nA=facA.length,nB=facB?facB.length:0;
  const terms=[];
  let col=1; // 0 は切片
  const colsA=[];for(let i=0;i<nA-1;i++)colsA.push(col++);
  const colsB=[];for(let i=0;i<nB-1;i++)colsB.push(col++);
  const colsI=[];
  if(nB)for(let i=0;i<(nA-1)*(nB-1);i++)colsI.push(col++);
  const p=col;
  const X=[],y=[],subj=[];
  obs.forEach(o=>{
    const row=new Array(p).fill(0);
    row[0]=1;
    const ea=effectCode(o.a,nA);
    ea.forEach((v,i)=>row[colsA[i]]=v);
    if(nB){
      const eb=effectCode(o.b,nB);
      eb.forEach((v,i)=>row[colsB[i]]=v);
      let t=0;
      for(let i=0;i<nA-1;i++)for(let j=0;j<nB-1;j++)row[colsI[t++]]=ea[i]*eb[j];
    }
    X.push(row);y.push(o.y);subj.push(o.subj);
  });
  if(colsA.length)terms.push({name:"A",cols:colsA});
  if(colsB.length)terms.push({name:"B",cols:colsB});
  if(colsI.length)terms.push({name:"AB",cols:colsI});
  return {X,y,subj,terms,p};
}
function classifyTerms(X,subj,terms){
  // 被験者内で値が変わらない列＝被験者間効果
  const bySubj={};
  subj.forEach((s,i)=>{(bySubj[s]=bySubj[s]||[]).push(i);});
  const constCol=(c)=>Object.keys(bySubj).every(k=>{
    const idx=bySubj[k];
    return idx.every(i=>Math.abs(X[i][c]-X[idx[0]][c])<1e-12);
  });
  let nBetween=1; // 切片
  terms.forEach(t=>{
    t.between=t.cols.every(constCol);
    if(t.between)nBetween+=t.cols.length;
  });
  const nSubj=Object.keys(bySubj).length,N=X.length,p=X[0].length;
  const dfBetween=Math.max(1,nSubj-nBetween);
  const dfWithin=Math.max(1,N-nSubj-(p-nBetween));
  terms.forEach(t=>{t.df2=t.between?dfBetween:dfWithin;});
  return {dfBetween,dfWithin,nBetween};
}
/* ---------- 解析：混合効果モデル ---------- */
ANALYSES.mixed={
  name:"混合効果モデル（REML）",cat:"3群以上の比較",for:["column","grouped","multivar","nested"],
  desc:"欠測のある反復測定データを、被験者を変量効果とする混合モデルで解析します（Prism の Mixed-effects model 相当）。",
  width:720,
  defaults:(sh)=>({ds:sh.groups.map((_,i)=>i),rm:sh.ttype==="grouped"?"col":"one",mc:"sidak",ctrl:0,
    rf:"要因A（行）",cf:"要因B（列）"}),
  form:(sh,p)=>(sh.ttype==="grouped"
      ? selOpt("rm","デザイン",[["col","反復測定：各行＝1被験者（列＝反復要因）"],
          ["row","反復測定：各列＝1被験者（行＝反復要因）"],["one","列だけを反復要因とする（行は無視）"]],p.rm)
        +'<div class="frow"><label>行の要因名</label><input type="text" name="rf" value="'+esc(p.rf||"要因A（行）")+'" style="width:170px">'
        +'<label style="min-width:auto">列の要因名</label><input type="text" name="cf" value="'+esc(p.cf||"要因B（列）")+'" style="width:170px"></div>'
      : '<p class="mini">各行＝1被験者、選んだ列＝反復測定の条件として計算します。<b>空白のセルはそのまま除外され、その行を丸ごと捨てません</b>。</p>'
        +dsChecks(sh,"ds",p.ds))
   +selOpt("mc","多重比較",[["sidak","Šídák"],["tukey","Tukey"],["bonferroni","Bonferroni"],["holm","Holm-Šídák"],
     ["fdr","FDR"],["dunnett","対照群と比較（Dunnett型）"],["none","行わない"]],p.mc)
   +'<div class="frow"><label>対照群</label><select name="ctrl">'
   +sh.groups.map((g,i)=>'<option value="'+i+'"'+(p.ctrl===i?" selected":"")+">"+esc(g.name)+"</option>").join("")+"</select></div>",
  read:(bg,sh)=>({ds:readDs(bg,"ds"),rm:val(bg,"rm")||"one",mc:val(bg,"mc"),ctrl:+val(bg,"ctrl"),
    rf:val(bg,"rf"),cf:val(bg,"cf")}),
  run:(sh,p)=>{
    const nR=usedRows(sh);
    const obs=[];
    let facA=[],facB=null,aName="",bName="",totalCells=0;
    if(sh.ttype==="grouped"&&(p.rm==="col"||p.rm==="row")){
      const rowLabels=sh.rows.slice(0,nR).map((r,i)=>r.t||("行"+(i+1)));
      const colLabels=sh.groups.map(g=>g.name);
      if(p.rm==="col"){
        facA=rowLabels;facB=colLabels;aName=p.rf||"行";bName=p.cf||"列";
        for(let r=0;r<nR;r++)for(let s=0;s<sh.sub;s++){
          const sid="r"+r+"_s"+s;
          for(let c=0;c<colLabels.length;c++){
            totalCells++;
            const v=cellNum(sh,r,c,s);
            if(!isNaN(v))obs.push({subj:sid,y:v,a:r,b:c});
          }
        }
      }else{
        facA=colLabels;facB=rowLabels;aName=p.cf||"列";bName=p.rf||"行";
        for(let c=0;c<colLabels.length;c++)for(let s=0;s<sh.sub;s++){
          const sid="c"+c+"_s"+s;
          for(let r=0;r<nR;r++){
            totalCells++;
            const v=cellNum(sh,r,c,s);
            if(!isNaN(v))obs.push({subj:sid,y:v,a:c,b:r});
          }
        }
      }
    }else{
      const ds=(p.ds&&p.ds.length?p.ds:sh.groups.map((_,i)=>i));
      facA=ds.map(i=>sh.groups[i].name);aName="条件";
      for(let r=0;r<nR;r++){
        const sid="r"+r;
        ds.forEach((g,ai)=>{
          const vals=[];
          for(let s=0;s<sh.sub;s++){const v=cellNum(sh,r,g,s);if(!isNaN(v))vals.push(v);}
          totalCells++;
          if(vals.length)obs.push({subj:sid,y:mean(vals),a:ai});
        });
      }
    }
    if(obs.length<4)return {html:errBox("データが不足しています。")};
    // 被験者が1観測しかない場合も許容（混合モデルの利点）
    const M=buildMixedModel(obs,facA,facB);
    const cls=classifyTerms(M.X,M.subj,M.terms);
    const fit=mixedREML(M.X,M.y,M.subj);
    if(fit.error)return {html:errBox(fit.error)};
    const termName=(t)=>t.name==="A"?aName:t.name==="B"?bName:"交互作用";
    const rows=M.terms.map(t=>{
      const w=waldF(fit.beta,fit.cov,t.cols);
      if(!w)return [esc(termName(t)),"—","—","—","—"];
      const pv=fPvalue(w.F,w.df1,t.df2);
      return [esc(termName(t)),fmt(w.F,4),w.df1+", "+t.df2,pStarCell(pv),t.between?"被験者間":"被験者内"];
    });
    const nSubjWith=Object.keys(fit.groups).length;
    const missing=totalCells-obs.length;
    let html=T(["固定効果","F 値","自由度 (分子, 分母)","P 値","効果の種類"],rows)
     +'<h3 style="margin:14px 0 6px;font-size:13px">分散成分</h3>'
     +T(["成分","推定値","割合"],
        [["被験者間の分散 σ²(subject)",fmt(fit.sigma2b,4),fmt(fit.icc*100,1)+"%"],
         ["残差分散 σ²(residual)",fmt(fit.sigma2e,4),fmt((1-fit.icc)*100,1)+"%"],
         ["級内相関 ICC",fmt(fit.icc,4),"—"],
         ["被験者数 / 観測数",nSubjWith+" / "+obs.length,"—"],
         ["欠測（除外された測定）",missing+" 個",missing?fmt(missing/totalCells*100,1)+"%":"0%"],
         ["REML 対数尤度",fmt(fit.logLik,3),"—"]]);
    // 多重比較（GLS推定値の対比）
    let comparisons=[];
    if(p.mc!=="none"){
      const lev=facA.length,cols=M.terms.find(t=>t.name==="A").cols;
      const est=(i)=>{ // 水準iの効果コーディング値ベクトル
        const e=effectCode(i,lev);
        const L=new Array(fit.beta.length).fill(0);
        e.forEach((v,k)=>L[cols[k]]=v);
        return L;
      };
      const pairs=[];
      const mk=(i,j)=>{
        const Li=est(i),Lj=est(j);
        const L=Li.map((v,k)=>v-Lj[k]);
        let d=0,se2=0;
        for(let a=0;a<L.length;a++){
          d+=L[a]*fit.beta[a];
          for(let b=0;b<L.length;b++)se2+=L[a]*fit.cov[a][b]*L[b];
        }
        const se=Math.sqrt(Math.max(0,se2));
        const df=M.terms.find(t=>t.name==="A").df2;
        pairs.push({a:facA[i],b:facA[j],i,j,diff:d,se,t:d/se,df,pRaw:tPvalue(d/se,df)});
      };
      const ctrlIdx=Math.max(0,facA.indexOf(sh.groups[p.ctrl]?sh.groups[p.ctrl].name:facA[0]));
      if(p.mc==="dunnett"){for(let i=0;i<lev;i++)if(i!==ctrlIdx)mk(i,ctrlIdx);}
      else for(let i=0;i<lev;i++)for(let j=i+1;j<lev;j++)mk(i,j);
      const m=pairs.length;
      if(p.mc==="holm"){const adj=holm(pairs.map(x=>x.pRaw));pairs.forEach((x,i)=>x.pAdj=adj[i]);}
      else if(p.mc==="fdr"){const adj=bhFDR(pairs.map(x=>x.pRaw));pairs.forEach((x,i)=>x.pAdj=adj[i]);}
      else if(p.mc==="bonferroni")pairs.forEach(x=>x.pAdj=Math.min(1,x.pRaw*m));
      else if(p.mc==="tukey")pairs.forEach(x=>x.pAdj=Math.min(1,ptukeyP(Math.abs(x.t)*Math.SQRT2,lev,x.df)));
      else pairs.forEach(x=>x.pAdj=1-Math.pow(1-x.pRaw,m));
      const per=p.mc==="bonferroni"?0.05/m:1-Math.pow(0.95,1/m);
      pairs.forEach(x=>{const tc=tQuantile(1-per/2,x.df);x.ciLo=x.diff-tc*x.se;x.ciHi=x.diff+tc*x.se;});
      comparisons=pairs.map(x=>({a:x.a,b:x.b,p:x.pAdj,star:star(x.pAdj)}));
      html+='<h3 style="margin:14px 0 6px;font-size:13px">多重比較（'+esc(aName)+"）</h3>"
        +T(["比較","差（最小二乗平均）","95% CI","t","df","補正後 P","判定"],
          pairs.map(x=>[esc(x.a)+" vs "+esc(x.b),fmt(x.diff),ciTxt(x.ciLo,x.ciHi),fmt(Math.abs(x.t),3),
            fmt(x.df,0),pCell(x.pAdj),'<span class="'+(x.pAdj<0.05?"sigstar":"pill ns")+'">'+star(x.pAdj)+"</span>"]));
    }
    const mainT=M.terms[M.terms.length-1];
    const wMain=waldF(fit.beta,fit.cov,M.terms[0].cols);
    const pMain=wMain?fPvalue(wMain.F,wMain.df1,M.terms[0].df2):NaN;
    html+=verdict(
      (missing>0?"<b>"+missing+" 個の欠測</b>があるデータを、行を捨てずに解析しました。":"欠測はありません。")
      +" 混合効果モデルは<b>複合対称（compound symmetry）</b>を仮定しており、データが完全に揃っている場合の結果は反復測定ANOVAと一致します。"
      +" 級内相関 ICC = "+fmt(fit.icc,3)+"（被験者ごとのばらつきが全体の "+fmt(fit.icc*100,1)+"%）。");
    return {html,data:{comparisons,overallP:pMain,fit}};
  }
};
