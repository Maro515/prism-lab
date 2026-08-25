/* =====================================================================
   ファイル入出力（xlsx / CSV パーサは stat-atelier の実装を継承）
   ===================================================================== */
/* ---------- ZIP / XLSX ---------- */
async function unzipOpen(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  let eocd=-1;
  const stop=Math.max(0,u8.length-22-65536);
  for(let i=u8.length-22;i>=stop;i--){
    if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
  }
  if(eocd<0)throw new Error("ZIP構造を認識できません。xlsx形式か確認してください。");
  const count=dv.getUint16(eocd+10,true);
  let off=dv.getUint32(eocd+16,true);
  const entries=new Map();
  for(let i=0;i<count;i++){
    if(dv.getUint32(off,true)!==0x02014b50)break;
    const method=dv.getUint16(off+10,true);
    const csize=dv.getUint32(off+20,true);
    const nameLen=dv.getUint16(off+28,true);
    const extraLen=dv.getUint16(off+30,true);
    const cmtLen=dv.getUint16(off+32,true);
    const lho=dv.getUint32(off+42,true);
    const name=new TextDecoder().decode(u8.subarray(off+46,off+46+nameLen));
    entries.set(name,{method,csize,lho});
    off+=46+nameLen+extraLen+cmtLen;
  }
  return {u8,dv,entries};
}
async function zipRead(z,name){
  const e=z.entries.get(name);
  if(!e)return null;
  const off=e.lho;
  if(z.dv.getUint32(off,true)!==0x04034b50)return null;
  const nameLen=z.dv.getUint16(off+26,true),extraLen=z.dv.getUint16(off+28,true);
  const start=off+30+nameLen+extraLen;
  const comp=z.u8.subarray(start,start+e.csize);
  if(e.method===0)return comp;
  if(e.method===8){
    const stream=new Blob([comp]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error("非対応のZIP圧縮形式です。");
}
function xmlUnesc(s){
  return s.replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>String.fromCodePoint(parseInt(h,16)))
          .replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d))
          .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
}
function colLetterToIdx(s){let n=0;for(const c of s)n=n*26+(c.charCodeAt(0)-64);return n-1;}
function excelSerialToDate(v){
  if(v<1&&v>=0){
    const tot=Math.round(v*86400);
    return `${Math.floor(tot/3600)}:${String(Math.floor(tot%3600/60)).padStart(2,"0")}`;
  }
  const d=new Date(Math.round((v-25569)*86400000));
  return `${d.getUTCFullYear()}/${d.getUTCMonth()+1}/${d.getUTCDate()}`;
}
async function parseXlsx(arrayBuf){
  const z=await unzipOpen(new Uint8Array(arrayBuf));
  const dec=new TextDecoder();
  const text=async n=>{const d=await zipRead(z,n);return d?dec.decode(d):null;};
  const wbXml=await text("xl/workbook.xml");
  if(!wbXml)throw new Error("Excelブックを読み取れません（xl/workbook.xml が見つかりません）。");
  const relsXml=await text("xl/_rels/workbook.xml.rels")||"";
  const relMap={};
  for(const m of relsXml.matchAll(/<Relationship\b[^>]*\/?>/g)){
    const id=(m[0].match(/ Id="([^"]+)"/)||[])[1];
    const target=(m[0].match(/ Target="([^"]+)"/)||[])[1];
    if(id&&target)relMap[id]=target;
  }
  const sheets=[];
  for(const m of wbXml.matchAll(/<sheet\b[^>]*\/?>/g)){
    const name=xmlUnesc((m[0].match(/ name="([^"]*)"/)||[])[1]||`Sheet${sheets.length+1}`);
    const rid=(m[0].match(/ r:id="([^"]+)"/)||[])[1];
    let t=relMap[rid]||`worksheets/sheet${sheets.length+1}.xml`;
    t=t.replace(/^\//,"").replace(/^xl\//,"");
    sheets.push({name,path:"xl/"+t});
  }
  if(sheets.length===0)throw new Error("シートが見つかりません。");
  // 共有文字列
  const shared=[];
  const ssXml=await text("xl/sharedStrings.xml");
  if(ssXml){
    for(const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)){
      let s="";
      for(const t2 of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))s+=xmlUnesc(t2[1]);
      if(s===""&&/<t[^>]*\/>/.test(m[1]))s="";
      shared.push(s);
    }
  }
  // 日付書式の判定（styles.xml）
  const xfIsDate=[];
  const stXml=await text("xl/styles.xml");
  if(stXml){
    const builtinDate=new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);
    const custom={};
    for(const m of stXml.matchAll(/<numFmt\b[^>]*\/?>/g)){
      const id=+(m[0].match(/ numFmtId="(\d+)"/)||[])[1];
      const code=xmlUnesc((m[0].match(/ formatCode="([^"]*)"/)||[])[1]||"");
      const clean=code.replace(/\[[^\]]*\]/g,"").replace(/"[^"]*"/g,"");
      custom[id]=/[ymdhs]/i.test(clean)&&!/[#0]/.test(clean);
    }
    const cellXfs=(stXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)||[])[1]||"";
    for(const m of cellXfs.matchAll(/<xf\b[^>]*\/?>/g)){
      const id=+((m[0].match(/ numFmtId="(\d+)"/)||[])[1]||0);
      xfIsDate.push(builtinDate.has(id)||!!custom[id]);
    }
  }
  const getGrid=async(path)=>{
    const xml=await text(path);
    if(xml===null)throw new Error("シートを読み取れません。");
    const grid=[];
    for(const cm of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const attrs=cm[1],inner=cm[2]||"";
      const ref=(attrs.match(/ r="([A-Z]+)(\d+)"/)||[]);
      if(!ref[1])continue;
      const col=colLetterToIdx(ref[1]),row=+ref[2]-1;
      const t=(attrs.match(/ t="(\w+)"/)||[])[1];
      const sIdx=+((attrs.match(/ s="(\d+)"/)||[])[1]||-1);
      let val=null;
      if(t==="inlineStr"){
        let s="";for(const tm of inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))s+=xmlUnesc(tm[1]);
        val=s;
      }else{
        const vm=inner.match(/<v[^>]*>([\s\S]*?)<\/v>/);
        if(!vm)continue;
        const v=xmlUnesc(vm[1]);
        if(t==="s")val=shared[+v]!==undefined?shared[+v]:v;
        else if(t==="str")val=v;
        else if(t==="b")val=v==="1"?"TRUE":"FALSE";
        else if(t==="e")val=null;
        else{
          const num=parseFloat(v);
          val=(sIdx>=0&&xfIsDate[sIdx]&&isFinite(num))?excelSerialToDate(num):(isFinite(num)?num:v);
        }
      }
      if(val===null)continue;
      if(!grid[row])grid[row]=[];
      grid[row][col]=val;
    }
    return grid;
  };
  return {sheets,getGrid};
}
/* ---------- CSV / TSV ---------- */
function decodeSmart(buf){
  const u8=new Uint8Array(buf);
  const body=(u8[0]===0xEF&&u8[1]===0xBB&&u8[2]===0xBF)?u8.subarray(3):u8;
  try{return new TextDecoder("utf-8",{fatal:true}).decode(body);}
  catch(e){return new TextDecoder("shift_jis").decode(body);}
}
function parseCSVText(txt){
  const firstLine=txt.slice(0,txt.indexOf("\n")>=0?txt.indexOf("\n"):txt.length);
  const cnt=ch=>firstLine.split(ch).length-1;
  let delim=",";
  if(cnt("\t")>cnt(","))delim="\t";
  else if(cnt(";")>cnt(",")&&cnt(",")===0)delim=";";
  const rows=[];let row=[],cell="",inQ=false;
  for(let i=0;i<txt.length;i++){
    const c=txt[i];
    if(inQ){
      if(c==='"'){
        if(txt[i+1]==='"'){cell+='"';i++;}
        else inQ=false;
      }else cell+=c;
    }else{
      if(c==='"')inQ=true;
      else if(c===delim){row.push(cell);cell="";}
      else if(c==="\n"){row.push(cell);cell="";rows.push(row);row=[];}
      else if(c==="\r"){/* skip */}
      else cell+=c;
    }
  }
  if(cell!==""||row.length)row.push(cell);
  if(row.length)rows.push(row);
  return rows;
}


/* ---------- 読み込みダイアログ ---------- */
function importDialog(){
  const h='<div class="frow"><label>ファイル</label><input type="file" name="f" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.pzfx,.pzf,.prism,.xml"></div>'
   +'<p class="mini">Excel(.xlsx) / CSV / タブ区切り / <b>GraphPad Prism (.pzfx)</b> に対応。Shift_JISのCSVも自動判定します。<br>'
   +'Prism のファイルは Prism 側で「ファイル ▸ 名前を付けて保存 ▸ Prism XML (.pzfx)」として保存したものを読み込めます（全データ表がそのまま取り込まれます）。</p>'
   +'<fieldset><legend>または貼り付け</legend><textarea name="paste" rows="6" style="width:100%;border:1px solid var(--line);border-radius:6px;padding:6px" placeholder="Excelからコピーしたセルをここに貼り付け（タブ区切り）"></textarea></fieldset>'
   +'<fieldset><legend>取り込み方</legend>'
   +'<label class="chk"><input type="checkbox" name="hdr" checked>1行目をデータセット名（列見出し）にする</label><br>'
   +'<label class="chk"><input type="checkbox" name="firstcol">1列目をX値／行タイトルにする</label><br>'
   +'<label class="chk"><input type="checkbox" name="newsheet" checked>新しいデータ表として取り込む</label></fieldset>';
  modal("データの読み込み",h,[{label:"キャンセル"},{label:"取り込む",primary:true,action:(bg,close)=>{
    const opts={hdr:val(bg,"hdr"),firstcol:val(bg,"firstcol"),newsheet:val(bg,"newsheet")};
    const paste=val(bg,"paste");
    const fi=q(bg,'[name="f"]');
    if(fi.files&&fi.files[0]){readFile(fi.files[0],opts);close();return false;}
    if(paste&&paste.trim()){applyGrid(parseCSVText(paste.replace(/\r/g,"")),opts,"貼り付けデータ");close();return false;}
    toast("ファイルまたは貼り付けデータを指定してください",true);return false;
  }}],{width:620});
}
async function readFile(file,opts){
  const name=file.name.replace(/\.[^.]+$/,"");
  try{
    if(/\.(pzfx|pzf|prism|xml)$/i.test(file.name)){await readPrismFile(file);return;}
    if(/\.(xlsx|xlsm)$/i.test(file.name)){
      const wb=await parseXlsx(await file.arrayBuffer());
      if(wb.sheets.length===1){applyGrid(await wb.getGrid(wb.sheets[0].path),opts,name);return;}
      const h='<p class="mini">読み込むシートを選んでください。</p>'+wb.sheets.map((s,i)=>
        '<div class="frow"><label class="chk"><input type="radio" name="sh" value="'+i+'"'+(i===0?" checked":"")+"> "+esc(s.name)+"</label></div>").join("");
      modal("シートの選択",h,[{label:"キャンセル"},{label:"読み込む",primary:true,action:async(bg)=>{
        const i=+val(bg,"sh");
        applyGrid(await wb.getGrid(wb.sheets[i].path),opts,name+" / "+wb.sheets[i].name);
      }}],{width:460});
    }else{
      applyGrid(parseCSVText(decodeSmart(await file.arrayBuffer())),opts,name);
    }
  }catch(e){toast("読み込みに失敗しました："+e.message,true);}
}
function applyGrid(grid,opts,name){
  grid=(grid||[]).filter(r=>r&&r.some(c=>c!==undefined&&c!==null&&String(c).trim()!==""));
  if(!grid.length)return toast("データが空です",true);
  const width=Math.max(...grid.map(r=>r.length));
  let header=null,body=grid;
  if(opts.hdr){header=grid[0];body=grid.slice(1);}
  const cur=getSheet(SEL);
  let sh;
  snapshot();
  if(opts.newsheet||!cur||cur.kind!=="data"){
    sh=makeDataSheet(cur&&cur.kind==="data"?cur.ttype:"column",name||"読み込みデータ");
    sh.rows=[];sh.groups=[];sh.sub=1;
    addSheet(sh);
  }else{sh=cur;sh.rows=[];sh.groups=[];sh.sub=1;}
  const useFirst=opts.firstcol&&(hasX(sh)||hasTitle(sh));
  const start=useFirst?1:0;
  const nG=Math.max(1,width-start);
  for(let g=0;g<nG;g++){
    const nm=header&&header[start+g]!==undefined&&String(header[start+g]).trim()!==""?String(header[start+g]):defaultGroupName(sh.ttype,g);
    sh.groups.push({name:nm,color:GCOLORS[g%GCOLORS.length],symbol:"circle"});
  }
  body.forEach(r=>{
    const row=newRow(nG,1);
    if(useFirst){
      const v=r[0]===undefined||r[0]===null?"":String(r[0]);
      if(hasX(sh))row.x=v;else row.t=v;
    }
    for(let g=0;g<nG;g++){
      const v=r[start+g];
      row.v[g][0]=v===undefined||v===null?"":String(v);
    }
    sh.rows.push(row);
  });
  SEL=sh.id;
  render();
  toast(body.length+"行 × "+nG+"列を読み込みました");
}
/* ---------- 書き出し ---------- */
function download(filename,content,mime){
  const blob=content instanceof Blob?content:new Blob([content],{type:mime||"text/plain;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=filename;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);
}
function sheetToGrid(sh){
  const n=Math.max(1,usedRows(sh));
  const head=[];
  if(hasTitle(sh))head.push(sh.ttype==="multivar"?"症例":"行タイトル");
  if(hasX(sh))head.push(sh.xTitle||"X");
  sh.groups.forEach((g,gi)=>{
    for(let s=0;s<sh.sub;s++)head.push(sh.sub>1?g.name+" "+(subLabel(sh,gi,s)||s+1):g.name);
  });
  const rows=[head];
  for(let r=0;r<n;r++){
    const line=[];
    if(hasTitle(sh))line.push(sh.rows[r].t||"");
    if(hasX(sh))line.push(sh.rows[r].x||"");
    sh.groups.forEach((g,gi)=>{for(let s=0;s<sh.sub;s++)line.push(cellRaw(sh,r,gi,s));});
    rows.push(line);
  }
  return rows;
}
function toCSV(rows){
  return rows.map(r=>r.map(c=>{
    const v=c===undefined||c===null?"":String(c);
    return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
  }).join(",")).join("\n");
}
function exportCSV(sh){
  download(sh.name+".csv","﻿"+toCSV(sheetToGrid(sh)),"text/csv;charset=utf-8");
  toast("CSVを書き出しました");
}
function saveProject(){
  download((PROJ.name||"prismlab")+".prism.json",JSON.stringify(PROJ,null,1),"application/json");
  saveLocal();
  toast("プロジェクトを保存しました");
}
function openProject(){
  const i=document.createElement("input");
  i.type="file";i.accept=".json,.prism.json";
  i.onchange=async()=>{
    try{
      const p=JSON.parse(await i.files[0].text());
      if(!p.sheets)throw new Error("形式が違います");
      PROJ=p;SEL=p.sheets[0].id;UNDO=[];REDO=[];
      render();saveLocal();toast("プロジェクトを開きました");
    }catch(e){toast("開けませんでした："+e.message,true);}
  };
  i.click();
}
/* ---------- 情報シート ---------- */
function renderInfoSheet(sh,view){
  view.innerHTML='<div class="card" style="max-width:900px">'
   +'<h3>プロジェクト情報・メモ</h3>'
   +'<div class="frow"><label>実験名</label><input type="text" id="infoTitle" value="'+esc(sh.title||"")+'" style="width:60%"></div>'
   +'<div class="frow"><label>実施日</label><input type="text" id="infoDate" value="'+esc(sh.date||"")+'" style="width:180px" placeholder="2026-08-23"></div>'
   +'<div class="frow"><label>実施者</label><input type="text" id="infoWho" value="'+esc(sh.who||"")+'" style="width:40%"></div>'
   +'<div class="frow" style="align-items:flex-start"><label>メモ</label>'
   +'<textarea id="infoText" rows="16" style="flex:1;min-width:300px;border:1px solid var(--line);border-radius:6px;padding:8px;line-height:1.7">'+esc(sh.text||"")+"</textarea></div>"
   +'<p class="mini">方法・試薬ロット・解析の前提などを残しておくと、論文投稿時の再現性チェックに役立ちます。</p></div>';
  const bind=(id,key)=>{
    const el=document.getElementById(id);
    el.addEventListener("input",()=>{sh[key]=el.value;markDirty();});
  };
  bind("infoTitle","title");bind("infoDate","date");bind("infoWho","who");bind("infoText","text");
}
/* ---------- 表の設定 ---------- */
function tableOptionsDialog(sh){
  const h='<div class="frow"><label>表の種類</label><select name="tt">'
   +Object.keys(TTYPES).map(k=>'<option value="'+k+'"'+(sh.ttype===k?" selected":"")+">"+TTYPES[k].name+"表</option>").join("")+"</select>"
   +'<span class="mini">'+esc(TTYPES[sh.ttype].desc)+"</span></div>"
   +'<div class="frow"><label>サブ列（反復）</label><input type="number" name="sub" min="1" max="24" value="'+sh.sub+'" style="width:70px">'
   +'<span class="mini">同一条件の反復測定（n数）の列数</span></div>'
   +'<div class="frow"><label>サブ列の意味</label><select name="submode">'
   +[["rep","反復値をそのまま入力"],["meansdn","平均・SD・N を入力"],["meansen","平均・SEM・N を入力"],["meancin","平均・95%CI幅・N を入力"]]
     .map(o=>'<option value="'+o[0]+'"'+(sh.subMode===o[0]?" selected":"")+">"+o[1]+"</option>").join("")+"</select></div>"
   +'<div class="frow"><label>X列の見出し</label><input type="text" name="xt" value="'+esc(sh.xTitle||"X")+'" style="width:200px"></div>'
   +'<div class="frow"><label>Y軸の見出し</label><input type="text" name="yt" value="'+esc(sh.yTitle||"Y")+'" style="width:200px"></div>'
   +'<div class="frow"><label>データセット数</label><input type="number" name="ng" min="1" max="40" value="'+sh.groups.length+'" style="width:70px"></div>'
   +'<div class="frow"><label>行数</label><input type="number" name="nr" min="2" max="5000" value="'+Math.max(usedRows(sh),sh.rows.length)+'" style="width:90px"></div>';
  modal("データ表の設定",h,[{label:"キャンセル"},{label:"適用",primary:true,action:(bg)=>{
    snapshot();
    sh.ttype=val(bg,"tt");
    const ns=Math.max(1,Math.min(24,+val(bg,"sub")||1));
    const ng=Math.max(1,Math.min(40,+val(bg,"ng")||1));
    const nr=Math.max(2,Math.min(5000,+val(bg,"nr")||10));
    sh.subMode=val(bg,"submode");sh.xTitle=val(bg,"xt");sh.yTitle=val(bg,"yt");
    while(sh.groups.length<ng)addGroup(sh);
    if(sh.groups.length>ng){sh.groups.length=ng;sh.rows.forEach(r=>r.v.length=ng);}
    sh.rows.forEach(r=>{
      while(r.v.length<ng)r.v.push(new Array(ns).fill(""));
      r.v.forEach(g=>{while(g.length<ns)g.push("");g.length=ns;});
    });
    sh.sub=ns;
    while(sh.rows.length<nr)sh.rows.push(newRow(ng,ns));
    if(sh.rows.length>nr)sh.rows.length=nr;
    refreshDeps(sh);render();
  }}],{width:600});
}
/* ---------- データ変換 ---------- */
const TRANSFORMS={
  log10:{n:"log10(Y)",f:y=>Math.log10(y)},
  ln:{n:"ln(Y)",f:y=>Math.log(y)},
  log2:{n:"log2(Y)",f:y=>Math.log2(y)},
  pow10:{n:"10^Y",f:y=>Math.pow(10,y)},
  expy:{n:"exp(Y)",f:y=>Math.exp(y)},
  sqrt:{n:"√Y",f:y=>Math.sqrt(y)},
  sq:{n:"Y²",f:y=>y*y},
  recip:{n:"1/Y",f:y=>1/y},
  abs:{n:"|Y|",f:y=>Math.abs(y)},
  addk:{n:"Y + K",f:(y,k)=>y+k,k:true},
  subk:{n:"Y − K",f:(y,k)=>y-k,k:true},
  mulk:{n:"Y × K",f:(y,k)=>y*k,k:true},
  divk:{n:"Y ÷ K",f:(y,k)=>y/k,k:true},
  kminus:{n:"K − Y",f:(y,k)=>k-y,k:true},
  logit:{n:"logit: ln(Y/(1−Y))",f:y=>Math.log(y/(1-y))},
  zscore:{n:"Zスコア（列ごとに標準化）",col:true,f:(y,k,st)=>(y-st.mean)/st.sd},
  pctmax:{n:"列の最大値を100%とする",col:true,f:(y,k,st)=>y/st.max*100},
  pcttotal:{n:"列の合計に対する割合(%)",col:true,f:(y,k,st)=>y/st.sum*100},
  center:{n:"平均を引く（中心化）",col:true,f:(y,k,st)=>y-st.mean}
};
const XTRANSFORMS={
  none:{n:"（変換しない）"},xlog10:{n:"log10(X)",f:x=>Math.log10(x)},xln:{n:"ln(X)",f:x=>Math.log(x)},
  xpow10:{n:"10^X",f:x=>Math.pow(10,x)},xsqrt:{n:"√X",f:x=>Math.sqrt(x)},xrecip:{n:"1/X",f:x=>1/x},
  xmulk:{n:"X × K",f:(x,k)=>x*k,k:true},xaddk:{n:"X + K",f:(x,k)=>x+k,k:true}
};
function transformDialog(sh){
  const h='<div class="frow"><label>Yの変換</label><select name="tf" style="width:260px">'
   +'<option value="none">（変換しない）</option>'
   +Object.keys(TRANSFORMS).map(k=>'<option value="'+k+'">'+TRANSFORMS[k].n+"</option>").join("")+"</select>"
   +'<label style="min-width:auto">K =</label><input type="number" name="k" value="1" step="any" style="width:80px"></div>'
   +(hasX(sh)?'<div class="frow"><label>Xの変換</label><select name="xf" style="width:260px">'
     +Object.keys(XTRANSFORMS).map(k=>'<option value="'+k+'">'+XTRANSFORMS[k].n+"</option>").join("")+"</select></div>":"")
   +'<fieldset><legend>正規化（Normalize）</legend>'
   +'<label class="chk"><input type="checkbox" name="norm">0〜100%に正規化する</label>'
   +'<div class="frow"><label>0% とする値</label><select name="n0"><option value="min">列の最小値</option><option value="first">最初の行</option><option value="zero">0</option><option value="val">指定値</option></select>'
   +'<input type="number" name="n0v" value="0" step="any" style="width:80px"></div>'
   +'<div class="frow"><label>100% とする値</label><select name="n100"><option value="max">列の最大値</option><option value="first">最初の行</option><option value="last">最後の行</option><option value="val">指定値</option></select>'
   +'<input type="number" name="n100v" value="100" step="any" style="width:80px"></div></fieldset>'
   +'<fieldset><legend>ベースライン処理</legend>'
   +'<div class="frow"><label>基準列</label><select name="base"><option value="-1">（使わない）</option>'
   +sh.groups.map((g,i)=>'<option value="'+i+'">'+esc(g.name)+"</option>").join("")+"</select>"
   +'<select name="basemode"><option value="sub">他の列から引く</option><option value="div">他の列を割る（比）</option><option value="pct">基準を100%とした%</option></select></div></fieldset>'
   +'<fieldset><legend>表の組み替え</legend>'
   +'<label class="chk"><input type="radio" name="re" value="none" checked>そのまま</label> '
   +'<label class="chk"><input type="radio" name="re" value="transpose">行と列を入れ替える</label> '
   +'<label class="chk"><input type="radio" name="re" value="rowstats">行ごとの平均・SD・Nの表にする</label></fieldset>'
   +'<label class="chk"><input type="checkbox" name="newt" checked>結果を新しいデータ表として作る（元の表は残す）</label>';
  modal("データの変換・正規化",h,[{label:"キャンセル"},{label:"実行",primary:true,action:(bg)=>{
    applyTransform(sh,{
      tf:val(bg,"tf"),k:parseFloat(val(bg,"k")),xf:hasX(sh)?val(bg,"xf"):"none",
      norm:val(bg,"norm"),n0:val(bg,"n0"),n0v:parseFloat(val(bg,"n0v")),
      n100:val(bg,"n100"),n100v:parseFloat(val(bg,"n100v")),
      base:+val(bg,"base"),basemode:val(bg,"basemode"),
      re:(qa(bg,'[name="re"]').find(r=>r.checked)||{}).value,newt:val(bg,"newt")
    });
  }}],{width:640});
}
function applyTransform(sh,o){
  snapshot();
  const n=Math.max(1,usedRows(sh));
  let out=JSON.parse(JSON.stringify(sh));
  out.rows=out.rows.slice(0,n);
  const setV=(r,g,s,v)=>{out.rows[r].v[g][s]=(v===null||v===undefined||!isFinite(v))?"":String(+(+v).toPrecision(8));};
  // 列統計
  const stats=sh.groups.map((g,gi)=>{
    const vals=colValues(sh,gi);
    return vals.length?{mean:mean(vals),sd:sd(vals)||1,max:Math.max(...vals),min:Math.min(...vals),sum:sum(vals),
      first:vals[0],last:vals[vals.length-1]}:null;
  });
  // ベースライン
  if(o.base>=0){
    for(let r=0;r<n;r++)for(let s=0;s<sh.sub;s++){
      const b=cellNum(sh,r,o.base,s);
      for(let g=0;g<sh.groups.length;g++){
        const v=cellNum(sh,r,g,s);
        if(isNaN(v)||isNaN(b)){setV(r,g,s,NaN);continue;}
        setV(r,g,s,o.basemode==="sub"?v-b:o.basemode==="div"?v/b:v/b*100);
      }
    }
  }
  // 正規化
  if(o.norm){
    for(let g=0;g<sh.groups.length;g++){
      const st=stats[g];if(!st)continue;
      const v0=o.n0==="min"?st.min:o.n0==="first"?st.first:o.n0==="zero"?0:o.n0v;
      const v1=o.n100==="max"?st.max:o.n100==="first"?st.first:o.n100==="last"?st.last:o.n100v;
      for(let r=0;r<n;r++)for(let s=0;s<sh.sub;s++){
        const v=parseNum(out.rows[r].v[g][s]);
        setV(r,g,s,(v-v0)/(v1-v0)*100);
      }
    }
  }
  // Y変換
  if(o.tf&&o.tf!=="none"){
    const T=TRANSFORMS[o.tf];
    for(let g=0;g<sh.groups.length;g++){
      const st=stats[g];
      for(let r=0;r<n;r++)for(let s=0;s<sh.sub;s++){
        const v=parseNum(out.rows[r].v[g][s]);
        if(isNaN(v)){continue;}
        setV(r,g,s,T.f(v,o.k,st||{mean:0,sd:1,max:1,sum:1}));
      }
    }
  }
  // X変換
  if(o.xf&&o.xf!=="none"&&hasX(sh)){
    const T=XTRANSFORMS[o.xf];
    for(let r=0;r<n;r++){
      const v=parseNum(out.rows[r].x);
      out.rows[r].x=isNaN(v)?out.rows[r].x:String(+T.f(v,o.k).toPrecision(8));
    }
  }
  // 組み替え
  if(o.re==="transpose"){
    const src=out;
    const t=makeDataSheet(src.ttype==="xy"?"column":src.ttype,src.name+"（転置）");
    t.sub=1;t.groups=[];t.rows=[];
    const nr=Math.max(1,usedRows(src));
    for(let r=0;r<nr;r++)t.groups.push({name:src.rows[r].t||src.rows[r].x||("行"+(r+1)),color:GCOLORS[r%GCOLORS.length],symbol:SYMBOLS[r%SYMBOLS.length]});
    for(let g=0;g<src.groups.length;g++)for(let s=0;s<src.sub;s++){
      const row=newRow(nr,1);
      row.t=src.groups[g].name+(src.sub>1?" "+(s+1):"");
      for(let r=0;r<nr;r++)row.v[r][0]=cellRaw(src,r,g,s);
      t.rows.push(row);
    }
    out=t;
  }else if(o.re==="rowstats"){
    const src=out;
    const t=makeDataSheet(src.ttype,src.name+"（行ごとの統計）");
    t.sub=3;t.subMode="meansdn";t.groups=[];t.rows=[];
    t.xTitle=src.xTitle;
    src.groups.forEach((g,i)=>t.groups.push({name:g.name,color:g.color,symbol:g.symbol}));
    const nr=Math.max(1,usedRows(src));
    for(let r=0;r<nr;r++){
      const row=newRow(src.groups.length,3);
      row.t=src.rows[r].t;row.x=src.rows[r].x;
      src.groups.forEach((g,gi)=>{
        const vals=[];
        for(let s=0;s<src.sub;s++){const v=cellNum(src,r,gi,s);if(!isNaN(v))vals.push(v);}
        if(vals.length){
          const d=describeFull(vals);
          row.v[gi][0]=String(+d.mean.toPrecision(6));
          row.v[gi][1]=String(+(d.sd||0).toPrecision(6));
          row.v[gi][2]=String(d.n);
        }
      });
      t.rows.push(row);
    }
    out=t;
  }
  if(o.newt||o.re!=="none"){
    out.id=uid();
    if(!/（/.test(out.name))out.name=sh.name+"（変換）";
    addSheet(out);SEL=out.id;
  }else{
    sh.rows=out.rows;sh.groups=out.groups;sh.sub=out.sub;sh.subMode=out.subMode;
  }
  render();toast("変換しました");
}
/* ---------- デモデータ ---------- */
function rnorm(rnd,m,s){let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const DEMOS={
 tumor:{name:"3群の腫瘍重量",tt:"column",desc:"対照・薬剤A・薬剤B（各n=10）。一元配置ANOVA＋Dunnettの練習に。",
  make:(sh)=>{
    const rnd=mulberry32(4021);
    sh.name="腫瘍重量（3群）";sh.yTitle="腫瘍重量 (mg)";
    sh.groups=[{name:"対照",color:GCOLORS[0],symbol:"circle"},{name:"薬剤A 10mg/kg",color:GCOLORS[1],symbol:"circle"},{name:"薬剤B 10mg/kg",color:GCOLORS[2],symbol:"circle"}];
    sh.sub=1;sh.rows=[];
    const mu=[820,610,395],sg=[145,130,110];
    for(let r=0;r<10;r++){
      const row=newRow(3,1);
      for(let g=0;g<3;g++)row.v[g][0]=String(Math.round(rnorm(rnd,mu[g],sg[g])));
      sh.rows.push(row);
    }
  }},
 dose:{name:"用量反応曲線（2薬剤）",tt:"xy",desc:"log[濃度] vs 生存率%。3反復。非線形回帰でIC50を求める。",
  make:(sh)=>{
    const rnd=mulberry32(777);
    sh.name="用量反応（IC50）";sh.xTitle="log[濃度] (M)";sh.yTitle="細胞生存率 (%)";
    sh.groups=[{name:"薬剤X",color:GCOLORS[0],symbol:"circle"},{name:"薬剤Y",color:GCOLORS[1],symbol:"circle"}];
    sh.sub=3;sh.subMode="rep";sh.rows=[];
    const xs=[-9,-8.5,-8,-7.5,-7,-6.5,-6,-5.5,-5];
    const ic=[-7.1,-6.2],hill=[1.1,1.4];
    xs.forEach(x=>{
      const row=newRow(2,3);row.x=String(x);
      for(let g=0;g<2;g++)for(let s=0;s<3;s++){
        const y=3+(100-3)/(1+Math.pow(10,(x-ic[g])*hill[g]));
        row.v[g][s]=String(+(y+rnorm(rnd,0,4)).toFixed(1));
      }
      sh.rows.push(row);
    });
  }},
 timecourse:{name:"治療×時点（二元配置）",tt:"grouped",desc:"対照/治療の2群を4時点で測定（各n=4）。二元配置ANOVA。",
  make:(sh)=>{
    const rnd=mulberry32(19);
    sh.name="腫瘍体積の経時変化";sh.yTitle="腫瘍体積 (mm³)";
    sh.groups=[{name:"対照",color:GCOLORS[0],symbol:"circle"},{name:"治療",color:GCOLORS[1],symbol:"circle"}];
    sh.sub=4;sh.rows=[];
    const days=["Day 0","Day 7","Day 14","Day 21"];
    days.forEach((d,i)=>{
      const row=newRow(2,4);row.t=d;
      for(let s=0;s<4;s++){
        row.v[0][s]=String(Math.round(rnorm(rnd,120*Math.pow(1.62,i),18*Math.pow(1.5,i))));
        row.v[1][s]=String(Math.round(rnorm(rnd,120*Math.pow(1.18,i),15*Math.pow(1.4,i))));
      }
      sh.rows.push(row);
    });
  }},
 surv:{name:"生存曲線（2群）",tt:"survival",desc:"標準治療 vs 新規治療の全生存（各30例）。Kaplan-Meier＋log-rank。",
  make:(sh)=>{
    const rnd=mulberry32(3355);
    sh.name="全生存期間";sh.xTitle="生存期間 (月)";
    sh.groups=[{name:"標準治療",color:GCOLORS[0],symbol:"circle"},{name:"新規治療",color:GCOLORS[1],symbol:"circle"}];
    sh.sub=1;sh.rows=[];
    const gen=(med,n,gi)=>{
      for(let i=0;i<n;i++){
        const t=-Math.log(1-rnd())*med/Math.log(2);
        const cens=36;
        const row=newRow(2,1);
        row.x=String(+Math.min(t,cens).toFixed(1));
        row.v[gi][0]=t<=cens?"1":"0";
        sh.rows.push(row);
      }
    };
    gen(11,30,0);gen(19,30,1);
  }},
 cont:{name:"分割表（奏効率）",tt:"contingency",desc:"レジメン別の奏効あり/なし。χ²・Fisher・オッズ比。",
  make:(sh)=>{
    sh.name="奏効率の比較";
    sh.groups=[{name:"奏効あり",color:GCOLORS[6],symbol:"circle"},{name:"奏効なし",color:"#B6BFCC",symbol:"circle"}];
    sh.sub=1;sh.rows=[];
    const data=[["レジメンA",38,22],["レジメンB",21,39]];
    data.forEach(d=>{
      const row=newRow(2,1);row.t=d[0];row.v[0][0]=String(d[1]);row.v[1][0]=String(d[2]);
      sh.rows.push(row);
    });
  }},
 parts:{name:"有害事象の内訳（円グラフ）",tt:"parts",desc:"Grade別の症例数。円・ドーナツ・積み上げ。",
  make:(sh)=>{
    sh.name="有害事象 Grade 分布";
    sh.groups=[{name:"症例数",color:GCOLORS[0],symbol:"circle"}];
    sh.sub=1;sh.rows=[];
    [["Grade 1",42],["Grade 2",28],["Grade 3",14],["Grade 4",5],["Grade 5",1]].forEach(d=>{
      const row=newRow(1,1);row.t=d[0];row.v[0][0]=String(d[1]);sh.rows.push(row);
    });
  }},
 paired:{name:"治療前後（対応あり）",tt:"column",desc:"同一患者12例の治療前後。対応のあるt検定・before-afterプロット。",
  make:(sh)=>{
    const rnd=mulberry32(88);
    sh.name="治療前後のLDH";sh.yTitle="LDH (U/L)";
    sh.groups=[{name:"治療前",color:GCOLORS[0],symbol:"circle"},{name:"治療後",color:GCOLORS[1],symbol:"circle"}];
    sh.sub=1;sh.rows=[];
    for(let i=0;i<12;i++){
      const base=rnorm(rnd,412,95);
      const row=newRow(2,1);
      row.v[0][0]=String(Math.round(base));
      row.v[1][0]=String(Math.round(base-rnorm(rnd,88,52)));
      sh.rows.push(row);
    }
  }},
 mm:{name:"酵素反応速度（Michaelis-Menten）",tt:"xy",desc:"基質濃度 vs 反応速度。非線形回帰でVmax・Kmを推定。",
  make:(sh)=>{
    const rnd=mulberry32(1212);
    sh.name="酵素反応速度";sh.xTitle="[基質] (µM)";sh.yTitle="速度 (nmol/min)";
    sh.groups=[{name:"野生型",color:GCOLORS[0],symbol:"circle"},{name:"変異型",color:GCOLORS[1],symbol:"circle"}];
    sh.sub=2;sh.rows=[];
    [0.5,1,2,5,10,20,50,100,200].forEach(x=>{
      const row=newRow(2,2);row.x=String(x);
      for(let s=0;s<2;s++){
        row.v[0][s]=String(+(120*x/(12+x)+rnorm(rnd,0,4)).toFixed(1));
        row.v[1][s]=String(+(78*x/(38+x)+rnorm(rnd,0,3.5)).toFixed(1));
      }
      sh.rows.push(row);
    });
  }},
 mv:{name:"臨床データ80例（多変数）",tt:"multivar",desc:"年齢・PS・LDH・腫瘍径・奏効。相関行列・重回帰・ロジスティック回帰。",
  make:(sh)=>{
    const rnd=mulberry32(606);
    sh.name="臨床背景データ";
    sh.groups=[{name:"年齢",color:GCOLORS[0]},{name:"PS",color:GCOLORS[1]},{name:"LDH",color:GCOLORS[2]},
      {name:"腫瘍径mm",color:GCOLORS[3]},{name:"奏効(1/0)",color:GCOLORS[4]}];
    sh.sub=1;sh.rows=[];
    for(let i=0;i<80;i++){
      const age=Math.round(rnorm(rnd,66,10));
      const ps=Math.min(3,Math.max(0,Math.round(rnorm(rnd,0.8,0.8))));
      const ldh=Math.round(Math.exp(rnorm(rnd,Math.log(230),0.35))+ps*40);
      const size=Math.round(rnorm(rnd,42,15)+ps*4);
      const lin=2.4-0.02*(age-66)-0.9*ps-0.004*(ldh-230)-0.02*(size-42);
      const pr=1/(1+Math.exp(-lin));
      const row=newRow(5,1);row.t="症例"+(i+1);
      row.v[0][0]=String(age);row.v[1][0]=String(ps);row.v[2][0]=String(ldh);
      row.v[3][0]=String(size);row.v[4][0]=rnd()<pr?"1":"0";
      sh.rows.push(row);
    }
  }},
 volcano:{name:"発現データ60遺伝子（ボルケーノ用）",tt:"grouped",desc:"対照 vs 処理の2群×3反復を60遺伝子分。行ごとのt検定→ボルケーノプロット。",
  make:(sh)=>{
    const rnd=mulberry32(9021);
    sh.name="遺伝子発現（60遺伝子）";sh.yTitle="正規化発現量";
    sh.groups=[{name:"処理",color:GCOLORS[1],symbol:"circle"},{name:"対照",color:GCOLORS[0],symbol:"circle"}];
    sh.sub=4;sh.rows=[];
    const names=["TP53","EGFR","MYC","BRCA1","KRAS","PTEN","AKT1","CDKN2A","RB1","MDM2",
      "VEGFA","HIF1A","CCND1","BCL2","BAX","CASP3","MKI67","ESR1","ERBB2","PGR",
      "CD8A","PDCD1","CD274","FOXP3","IFNG","IL6","TNF","TGFB1","CXCL9","CCL2",
      "COL1A1","FN1","MMP9","TIMP1","SNAI1","CDH1","CDH2","VIM","ZEB1","TWIST1",
      "GAPDH","ACTB","TUBB","RPL13A","B2M","HPRT1","PPIA","SDHA","YWHAZ","UBC",
      "SOD1","CAT","GPX1","NFE2L2","KEAP1","HMOX1","NQO1","GCLC","TXN","PRDX1"];
    names.forEach((nm,i)=>{
      const base=Math.exp(rnorm(rnd,Math.log(120),0.7));
      let lfc=0;
      if(i<8)lfc=rnorm(rnd,1.8,0.5);        // 明確に増加
      else if(i>=30&&i<38)lfc=rnorm(rnd,-1.7,0.5); // 明確に減少
      else if(i<20)lfc=rnorm(rnd,0.35,0.35);
      else lfc=rnorm(rnd,0,0.22);
      const cv=0.09+rnd()*0.06;
      const row=newRow(2,4);
      row.t=nm;
      for(let s2=0;s2<4;s2++){
        row.v[0][s2]=(base*Math.pow(2,lfc)*Math.exp(rnorm(rnd,0,cv))).toFixed(1);
        row.v[1][s2]=(base*Math.exp(rnorm(rnd,0,cv))).toFixed(1);
      }
      sh.rows.push(row);
    });
  }},
 nested:{name:"入れ子データ（群→個体→反復）",tt:"nested",desc:"3群×4個体×3技術的反復。入れ子ANOVAで擬似反復を避ける。",
  make:(sh)=>{
    const rnd=mulberry32(2468);
    sh.name="mRNA発現（入れ子）";sh.yTitle="相対発現量";
    sh.groups=[{name:"対照",color:GCOLORS[0],symbol:"circle"},{name:"処理A",color:GCOLORS[1],symbol:"circle"},{name:"処理B",color:GCOLORS[2],symbol:"circle"}];
    sh.sub=4;sh.rows=[];
    const gm=[1.0,1.62,2.35];
    const subj=[];
    for(let g=0;g<3;g++){subj[g]=[];for(let s=0;s<4;s++)subj[g][s]=rnorm(rnd,gm[g],0.28);}
    for(let r=0;r<3;r++){
      const row=newRow(3,4);row.t="反復"+(r+1);
      for(let g=0;g<3;g++)for(let s=0;s<4;s++)row.v[g][s]=String(+Math.max(0.02,rnorm(rnd,subj[g][s],0.09)).toFixed(3));
      sh.rows.push(row);
    }
  }}
};
function demoDialog(){
  let h='<p class="mini">練習用のデータセットです。選ぶと新しいデータ表として追加されます。</p><div class="picker" style="grid-template-columns:1fr"><div class="items" style="grid-template-columns:repeat(auto-fill,minmax(215px,1fr))">';
  for(const k in DEMOS){
    h+='<div class="tile" data-demo="'+k+'"><div style="font-size:22px">'+TTYPES[DEMOS[k].tt].icon+'</div><div class="tn">'+DEMOS[k].name+'</div><div class="td">'+DEMOS[k].desc+"</div></div>";
  }
  h+="</div></div>";
  modal("サンプルデータを入れる",h,[{label:"閉じる"}],{width:820,onOpen:(bg,close)=>{
    qa(bg,"[data-demo]").forEach(t=>t.addEventListener("click",()=>{
      const d=DEMOS[t.dataset.demo];
      snapshot();
      const sh=makeDataSheet(d.tt,d.name);
      d.make(sh);
      sh.rows.forEach(r=>{while(r.v.length<sh.groups.length)r.v.push(new Array(sh.sub).fill(""));});
      addSheet(sh);SEL=sh.id;close();render();
      toast("「"+d.name+"」を追加しました");
    }));
  }});
}
