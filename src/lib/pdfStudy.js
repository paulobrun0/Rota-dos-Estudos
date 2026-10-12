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
