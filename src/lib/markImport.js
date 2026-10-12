import { isSafeStudyLink } from './planValidation.js';
export function parseMarkImport(text,concursoId,materiaId,topicId) {
  if(text.length>2*1024*1024)throw new Error('Use um arquivo de até 2 MiB.');
  const payload=JSON.parse(text);
  if(payload?.format!=='ritmo-marks-v1'||!Array.isArray(payload.marks)||payload.marks.length>1000)throw new Error('Arquivo de marcações incompatível.');
  const ids=new Set();
  return payload.marks.map(m=>{
    if(!m||typeof m.id!=='string'||!m.id||ids.has(m.id)||typeof m.text!=='string'||!m.text.trim()||m.text.length>20000||typeof m.note!=='string'||!isSafeStudyLink(m.url)||!['yellow','green','pink'].includes(m.color)||typeof m.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!Number.isFinite(Date.parse(m.date))||new Date(m.date).toISOString().slice(0,10)!==m.date)throw new Error('Há uma marcação inválida no arquivo.');
    ids.add(m.id);return {id:JSON.stringify(['extension',concursoId,materiaId,topicId,m.id]),concursoId,materiaId,topicId,text:m.text.trim(),note:m.note,url:m.url,color:m.color,date:m.date};
  });
}
