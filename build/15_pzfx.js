/* =====================================================================
   GraphPad Prism ファイル（.pzfx / Prism XML）の読み込み
   ===================================================================== */
const PRISM_TABLETYPE={XY:"xy",OneWay:"column",Column:"column",TwoWay:"grouped",Grouped:"grouped",
  Contingency:"contingency",Survival:"survival",PartsOfWhole:"parts",PartOfWhole:"parts",
  MultipleVariables:"multivar",Nested:"nested"};
function childrenByTag(el,tag){
  return Array.from(el.children||[]).filter(c=>c.nodeName===tag||c.nodeName.replace(/^.*:/,"")===tag);
}
function directTitle(el){
  const t=childrenByTag(el,"Title")[0];
  return t?t.textContent.trim():"";
}
function subcolValues(sub){
  return Array.from(sub.getElementsByTagName("d")).map(d=>{
    if(d.getAttribute("Excluded")==="1")return "";
    return (d.textContent||"").trim();
  });
}
function prismTableToSheet(t,index){
  const raw=t.getAttribute("TableType")||"";
  const ttype=PRISM_TABLETYPE[raw]||(childrenByTag(t,"XColumn").length?"xy":"column");
  const sh=makeDataSheet(ttype,directTitle(t)||("Prism表 "+(index+1)));
  sh.groups=[];sh.rows=[];
  const yTag=childrenByTag(t,"YColumn").length?"YColumn":"OneWayColumn";
  const yCols=childrenByTag(t,yTag);
  const xCol=childrenByTag(t,"XColumn")[0]||childrenByTag(t,"XAdvancedColumn")[0];
  const rowTitles=childrenByTag(t,"RowTitlesColumn")[0];
  const yfmt=(t.getAttribute("YFormat")||"").toLowerCase();
  sh.subMode=/sdn/.test(yfmt)?"meansdn":/sen/.test(yfmt)?"meansen":"rep";
  const colData=yCols.map(c=>childrenByTag(c,"Subcolumn").map(subcolValues));
  const sub=Math.max(1,...colData.map(c=>c.length));
  sh.sub=sub;
  const xVals=xCol?(childrenByTag(xCol,"Subcolumn")[0]?subcolValues(childrenByTag(xCol,"Subcolumn")[0]):[]):[];
  const tVals=rowTitles?(childrenByTag(rowTitles,"Subcolumn")[0]?subcolValues(childrenByTag(rowTitles,"Subcolumn")[0]):[]):[];
  if(xCol)sh.xTitle=directTitle(xCol)||sh.xTitle;
  yCols.forEach((c,i)=>sh.groups.push({name:directTitle(c)||("列"+(i+1)),
    color:GCOLORS[i%GCOLORS.length],symbol:SYMBOLS[i%SYMBOLS.length]}));
  if(!sh.groups.length)sh.groups.push({name:"値",color:GCOLORS[0],symbol:SYMBOLS[0]});
  let nRows=Math.max(xVals.length,tVals.length,
    ...colData.map(c=>Math.max(0,...c.map(s=>s.length))));
  nRows=Math.max(nRows,1);
  for(let r=0;r<nRows;r++){
    const row=newRow(sh.groups.length,sub);
    row.x=xVals[r]||"";
    row.t=tVals[r]||"";
    colData.forEach((c,g)=>{
      for(let s=0;s<sub;s++)row.v[g][s]=(c[s]&&c[s][r]!==undefined)?c[s][r]:"";
    });
    sh.rows.push(row);
  }
  return sh;
}
function parsePrismXML(text){
  const doc=new DOMParser().parseFromString(text,"application/xml");
  if(doc.getElementsByTagName("parsererror").length)throw new Error("XMLとして解釈できませんでした");
  const root=doc.documentElement;
  if(!/GraphPadPrismFile/i.test(root.nodeName))
    throw new Error("GraphPad Prism のXMLファイルではないようです");
  const tables=Array.from(doc.getElementsByTagName("Table"));
  if(!tables.length)throw new Error("データ表が見つかりませんでした");
  return tables.map((t,i)=>prismTableToSheet(t,i));
}
async function readPrismFile(file){
  const buf=await file.arrayBuffer();
  const u8=new Uint8Array(buf);
  let text=null;
  if(u8[0]===0x50&&u8[1]===0x4B){ // ZIP（Prism 9以降のパッケージ形式など）
    try{
      const z=await unzipOpen(u8);
      const names=Array.from(z.entries.keys());
      const cand=names.find(n=>/\.(pzfx|xml)$/i.test(n))||names[0];
      if(cand){
        const bytes=await zipRead(z,cand);
        text=new TextDecoder("utf-8").decode(bytes);
      }
    }catch(e){}
    if(!text||!/GraphPadPrismFile/i.test(text))
      throw new Error("この形式は読み込めません。Prism で「ファイル ▸ 名前を付けて保存 ▸ Prism XML (.pzfx)」として保存し直してください。");
  }else{
    text=decodeSmart(buf);
  }
  if(!/GraphPadPrismFile/i.test(text))
    throw new Error("バイナリ形式の .pzf のようです。Prism で「名前を付けて保存 ▸ Prism XML (.pzfx)」に変換してから読み込んでください。");
  const sheets=parsePrismXML(text);
  snapshot();
  sheets.forEach(s=>addSheet(s));
  SEL=sheets[0].id;
  render();
  toast("Prismファイルから "+sheets.length+" 個のデータ表を読み込みました");
}
