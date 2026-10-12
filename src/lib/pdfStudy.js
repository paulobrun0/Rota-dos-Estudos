export const PDF_COLORS = {yellow:[1,.85,.2],green:[.3,.85,.45],pink:[1,.45,.65]};
export async function documentFingerprint(bytes) {
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export function marksMarkdown(marks) {
  return '# Minhas marcações\n\n'+marks.map(m=>`## ${m.documentName || m.title || 'Trecho'}${m.page ? ` · página ${m.page}`:''}\n\n${m.text}\n\n${m.note || ''}\n\n${m.url || ''}`).join('\n\n---\n\n');
}
export async function annotatedPdf(bytes,marks) {
  const {PDFDocument,rgb,StandardFonts}=await import('pdf-lib');
  const pdf=await PDFDocument.load(bytes),pages=pdf.getPages();
  for(const mark of marks) {
    const page=pages[mark.page-1];if(!page)continue;
    const color=PDF_COLORS[mark.color] || PDF_COLORS.yellow;
    for(const rect of mark.rects) page.drawRectangle({...rect,color:rgb(...color),opacity:.3});
  }
  const notes=marks.filter(m=>m.note?.trim());
  if(notes.length){const font=await pdf.embedFont(StandardFonts.Helvetica);let page,y;
    const fresh=()=>{page=pdf.addPage([595,842]);y=790;};fresh();
    const clean=s=>Array.from(s).map(c=>{try{font.encodeText(c);return c;}catch{return '?';}}).join('');
    function line(s){if(y<50)fresh();page.drawText(clean(s),{x:40,y,size:11,font});y-=17;}
    line('Notas de estudo');line('');
    for(const m of notes){line(`Página ${m.page}`);for(const text of [m.text,m.note]){let row='';for(const word of clean(text).split(/\s+/)){if(font.widthOfTextAtSize(`${row} ${word}`,11)>510){line(row);row='';} // split unbroken long words as well
          for(const char of `${row ? ' ':''}${word}`){if(font.widthOfTextAtSize(row+char,11)>510){line(row);row='';}row+=char;}}
        if(row)line(row);}line('');}
  }
  return pdf.save();
}
export function downloadStudyFile(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

const searchable=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
export async function findPdfPages(doc,query,{isCancelled=()=>false,onProgress=()=>{}}={}){
 const needle=searchable(query);if(!needle)return [];
 const results=[];
 for(let page=1;page<=doc.numPages;page++){
  if(isCancelled())return [];
  const content=await (await doc.getPage(page)).getTextContent();if(isCancelled())return [];
  const text=content.items.map(i=>i.str||'').join(' ');if(searchable(text).includes(needle))results.push({page,text:text.slice(0,300)});
  onProgress(page);if(results.length>=100)break;
 }
 return results;
}
export function selectionRectsToPdf(rects,bounds,viewport){
 return Array.from(rects).flatMap(r=>{const left=Math.max(r.left,bounds.left),right=Math.min(r.right,bounds.right),top=Math.max(r.top,bounds.top),bottom=Math.min(r.bottom,bounds.bottom);if(right<=left||bottom<=top)return [];const a=viewport.convertToPdfPoint(left-bounds.left,top-bounds.top),b=viewport.convertToPdfPoint(right-bounds.left,bottom-bounds.top);return [{x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1])}];}).slice(0,500);
}

export function createPdfAnnotation({fileId,fileName,page,selection,concurso,materiaId,topicId,color,note,date}){
 if(!selection||selection.documentId!==fileId||selection.page!==page)throw Error('A seleção pertence a outra página ou arquivo. Selecione novamente.');
 if(!concurso.materias.some(m=>m.id===materiaId&&m.topics.some(t=>t.id===topicId)))throw Error('Escolha um assunto existente neste edital.');
 if(!Number.isInteger(page)||page<1||!selection.id||!selection.text?.trim()||!selection.rects?.length||!PDF_COLORS[color])throw Error('Seleção inválida. Selecione novamente.');
 return {id:selection.id,documentId:fileId,documentName:fileName,concursoId:concurso.id,materiaId,topicId,page,color,text:selection.text,note:note.slice(0,20000),rects:selection.rects,date};
}
