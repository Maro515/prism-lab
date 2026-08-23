/* =====================================================================
   PDF の直接生成（外部ライブラリなし・FlateDecodeで可逆埋め込み）
   ===================================================================== */
async function deflateBytes(u8){
  if(typeof CompressionStream==="undefined")return null;
  try{
    const st=new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }catch(e){return null;}
}
function pdfEscape(s){return String(s).replace(/[\\()]/g,c=>"\\"+c);}
function pdfBuild(objects,info){
  const enc=new TextEncoder();
  const chunks=[];let len=0;
  const push=(x)=>{const b=(typeof x==="string")?enc.encode(x):x;chunks.push(b);len+=b.length;};
  push(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a]));
  const offsets=[];
  objects.forEach((o,i)=>{
    offsets[i]=len;
    push((i+1)+" 0 obj\n"+o.head+"\n");
    if(o.stream){push("stream\n");push(o.stream);push("\nendstream\n");}
    push("endobj\n");
  });
  const xrefStart=len;
  let xref="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
  for(let i=0;i<objects.length;i++)xref+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  push(xref);
  push("trailer\n<< /Size "+(objects.length+1)+" /Root 1 0 R"+(info?" /Info "+info+" 0 R":"")
    +" >>\nstartxref\n"+xrefStart+"\n%%EOF\n");
  return new Blob(chunks,{type:"application/pdf"});
}
async function svgToPDFBlob(svg,scale,title){
  const cv=await svgToCanvas(svg,scale);
  const w=cv.width,h=cv.height;
  const data=cv.getContext("2d").getImageData(0,0,w,h).data;
  const rgb=new Uint8Array(w*h*3);
  for(let i=0,j=0;i<data.length;i+=4){rgb[j++]=data[i];rgb[j++]=data[i+1];rgb[j++]=data[i+2];}
  let stream=await deflateBytes(rgb),filter="/FlateDecode";
  if(!stream){ // 圧縮が使えない環境では JPEG で埋め込む
    const b64=cv.toDataURL("image/jpeg",0.95).split(",")[1];
    const bin=atob(b64);
    stream=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)stream[i]=bin.charCodeAt(i);
    filter="/DCTDecode";
  }
  const m=svg.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
  const pw=+((m?+m[1]:w)*72/96).toFixed(2),ph=+((m?+m[2]:h)*72/96).toFixed(2);
  const content=enc0("q\n"+pw+" 0 0 "+ph+" 0 0 cm\n/Im0 Do\nQ\n");
  const objs=[
    {head:"<< /Type /Catalog /Pages 2 0 R >>"},
    {head:"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"},
    {head:"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+pw+" "+ph+"] "
      +"/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>"},
    {head:"<< /Type /XObject /Subtype /Image /Width "+w+" /Height "+h
      +" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter "+filter+" /Length "+stream.length+" >>",stream},
    {head:"<< /Length "+content.length+" >>",stream:content},
    {head:"<< /Title ("+pdfEscape(title||"PrismLab figure")+") /Producer (PrismLab) /Creator (PrismLab) >>"}
  ];
  return {blob:pdfBuild(objs,6),pw,ph,w,h};
}
function enc0(s){return new TextEncoder().encode(s);}
async function exportPDF(sh){
  const svg=currentSVG(sh);
  if(!svg)return toast("PDFにできるシートではありません",true);
  try{
    toast("PDFを作成しています…");
    const scale=Math.max(2,+(gopt(sh).dpi||3));
    const r=await svgToPDFBlob(svg,scale,sh.name);
    download(sh.name+".pdf",r.blob,"application/pdf");
    toast("PDFを保存しました（"+fmt(r.pw/72*25.4,1)+" × "+fmt(r.ph/72*25.4,1)+" mm ／ 約"
      +Math.round(r.w/(r.pw/72))+" dpi）");
  }catch(e){toast("PDFを作成できませんでした："+e.message,true);}
}
/* 結果シートを印刷用PDFにするためのヘルパ（表はブラウザ印刷を利用） */
function printSheet(){window.print();}
