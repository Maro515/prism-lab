/* =====================================================================
   非線形回帰の拡張：ROUT外れ値除去・複数データセットの共有パラメータ
   ===================================================================== */
function xval(x){return (x&&typeof x==="object")?x.v:x;}
/* ---- ロバスト非線形回帰（Lorentzian/Cauchy重みのIRLS） ---- */
function lmFitRobust(x,y,fn,p0,opts){
  opts=opts||{};
  const c=2.3849; // Cauchy M推定量の標準的チューニング定数
  const n=y.length;
  let w=(opts.weights||new Array(n).fill(1)).slice();
  const base=(opts.weights||new Array(n).fill(1)).slice();
  let fit=lmFit(x,y,fn,p0,Object.assign({},opts,{weights:w}));
  if(fit.error)return fit;
  let rsdr=NaN;
  for(let it=0;it<12;it++){
    const res=y.map((v,i)=>v-fn(fit.p,xval(x[i])));
    const ar=res.map(Math.abs);
    rsdr=quantile(ar,0.6827)*n/Math.max(1,n-p0.length);
    if(!(rsdr>0))break;
    const nw=res.map((r,i)=>base[i]/(1+Math.pow(r/(c*rsdr),2)));
    const diff=Math.max(...nw.map((v,i)=>Math.abs(v-w[i])));
    w=nw;
    const f2=lmFit(x,y,fn,fit.p,Object.assign({},opts,{weights:w}));
    if(!f2.error)fit=f2;
    if(diff<1e-6)break;
  }
  fit.rsdr=rsdr;fit.robustWeights=w;
  return fit;
}
/* ---- ROUT法による外れ値の同定（Motulsky & Brown 2006 に準拠） ---- */
function routNL(x,y,fn,p0,Q,opts){
  const K=p0.length,n=y.length;
  const rob=lmFitRobust(x,y,fn,p0,opts);
  if(rob.error)return {error:rob.error};
  const res=y.map((v,i)=>v-fn(rob.p,xval(x[i])));
  const rsdr=isFinite(rob.rsdr)&&rob.rsdr>0?rob.rsdr:(quantile(res.map(Math.abs),0.6827)*n/Math.max(1,n-K));
  const df=Math.max(1,n-K);
  const tv=res.map(r=>Math.abs(r)/rsdr);
  const ps=tv.map(t=>tPvalue(t,df));
  const order=ps.map((p,i)=>[p,i]).sort((a,b)=>a[0]-b[0]);
  let cut=0;
  order.forEach((o,k)=>{if(o[0]<=(k+1)/n*Q)cut=k+1;});
  const outliers=order.slice(0,cut).map(o=>o[1]).sort((a,b)=>a-b);
  return {robust:rob,rsdr,outliers,t:tv,p:ps,Q,df};
}
/* ---- 複数データセットの同時あてはめ（パラメータ共有） ---- */
function lmFitGlobal(sets,model,shared,opts){
  opts=opts||{};
  const np=model.params.length,D=sets.length;
  const idx=[];let n=0;
  for(let j=0;j<np;j++){
    if(shared[j]){const c=n++;idx.push(new Array(D).fill(c));}
    else{const arr=[];for(let d=0;d<D;d++)arr.push(n++);idx.push(arr);}
  }
  const paramsFor=(p,d)=>model.params.map((_,j)=>p[idx[j][d]]);
  const X=[],Y=[];
  sets.forEach((s,d)=>s.x.forEach((xv,i)=>{X.push({v:xv,d});Y.push(s.y[i]);}));
  const inits=sets.map(s=>model.init(s.x,s.y));
  const p0=new Array(n).fill(1);
  for(let j=0;j<np;j++){
    if(shared[j])p0[idx[j][0]]=mean(inits.map(v=>v[j]));
    else for(let d=0;d<D;d++)p0[idx[j][d]]=inits[d][j];
  }
  let weights=null;
  if(opts.weightMode&&opts.weightMode!=="none"){
    weights=Y.map((v,i)=>{
      const xv=X[i].v;
      if(opts.weightMode==="1/y2")return 1/Math.max(1e-12,v*v);
      if(opts.weightMode==="1/y")return 1/Math.max(1e-12,Math.abs(v));
      return 1/Math.max(1e-12,xv*xv);
    });
  }
  const fit=lmFit(X,Y,(p,xo)=>model.f(paramsFor(p,xo.d),xo.v),p0,Object.assign({},opts,{weights}));
  if(fit.error)return fit;
  fit.idx=idx;fit.nFree=n;
  fit.paramsFor=(d)=>paramsFor(fit.p,d);
  fit.seFor=(d)=>model.params.map((_,j)=>fit.se[idx[j][d]]);
  fit.ciFor=(d)=>model.params.map((_,j)=>[fit.ciLo[idx[j][d]],fit.ciHi[idx[j][d]]]);
  return fit;
}
function nlParamNames(p){
  const M=NLMODELS.find(m=>m.id===p.model);
  if(!M)return [];
  if(M.custom)return (p.cparams||"").split(/[,\s]+/).filter(Boolean);
  return M.params;
}
function nlSharedBox(p,nSets){
  const names=nlParamNames(p);
  if(!names.length)return '<p class="mini">モデルを選ぶとパラメータが表示されます。</p>';
  if(nSets<2)return '<p class="mini">データセットを2つ以上選ぶと、パラメータの共有（グローバルフィット）が使えます。</p>';
  return names.map((nm,j)=>'<label class="chk" style="margin-right:14px"><input type="checkbox" name="shared" value="'+j+'"'
    +((p.shared&&p.shared[j])?" checked":"")+"> "+esc(nm)+"</label>").join("")
   +'<p class="mini" style="margin-top:6px">チェックしたパラメータは<b>全データセットで共通の1つの値</b>として推定されます（例：Top と Bottom を共有し、LogIC50 だけ別々に推定する）。</p>';
}
function fmtSig(x,d){
  if(x===null||x===undefined||!isFinite(x))return "—";
  if(x===0)return "0";
  const a=Math.abs(x);
  if(a>=1e6||a<1e-3)return (+x).toExponential(Math.max(1,(d||4)-1));
  return String(+(+x).toPrecision(d||5));
}
function ciTxtSig(lo,hi){return fmtSig(lo,4)+" 〜 "+fmtSig(hi,4);}
