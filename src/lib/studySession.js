import {getTopicLinks,STUDY_PLATFORMS} from './topicLinks.js';
import {isSafeStudyLink,validatePlanData} from './planValidation.js';
import {normalizeStudyName} from './editalCompatibility.js';

export function sessionNotebooks(topic,bank='') {
  const rows=[],seen=new Set();
  const add=book=>{if(!book.url||!isSafeStudyLink(book.url))return;const key=new URL(book.url).href;if(seen.has(key))return;seen.add(key);rows.push(book);};
  for(const n of topic.notebookLinks||[])add(n);
  for(const [provider,url] of Object.entries(getTopicLinks(topic)))add({id:`link-${provider}`,title:STUDY_PLATFORMS.find(p=>p.key===provider)?.label||'Caderno',bank:bank||'Sem banca',provider,url});
  const target=normalizeStudyName(bank);
  rows.sort((a,b)=>Number(Boolean(target)&&normalizeStudyName(b.bank)===target)-Number(Boolean(target)&&normalizeStudyName(a.bank)===target));
  return rows;
}

export function tecQuestionUrl(input) {
  const value=String(input||'').trim();
  let id;
  if(/^[1-9]\d{0,14}$/.test(value))id=value;
  else {
    let url;try{url=new URL(value);}catch{throw Error('Cole o link de uma questão do TEC ou informe seu número.');}
    if(url.protocol!=='https:'||!['www.tecconcursos.com.br','tecconcursos.com.br'].includes(url.hostname)||url.username||url.password||url.port)
      throw Error('Use um link https de questão do TEC Concursos.');
    id=url.pathname.match(/^\/questoes\/([1-9]\d{0,14})\/?$/)?.[1];
  }
  if(!id)throw Error('Informe uma questão individual do TEC, como /questoes/1234567.');
  return `https://www.tecconcursos.com.br/questoes/${id}`;
}

export function addSessionReview(data,concursoId,ref,input,note,today) {
  const c=data.concursos.find(c=>c.id===concursoId),m=c?.materias.find(m=>m.id===ref.materiaId),t=m?.topics.find(t=>t.id===ref.topicId);
  if(!t)throw Error('Este assunto foi removido. Atualize sua fila.');
  const url=tecQuestionUrl(input),id=JSON.stringify(['session-review',concursoId,m.id,t.id,url]);
  const existing=(data.externalReviews||[]).find(e=>e.concursoId===concursoId&&e.materiaId===m.id&&e.topicId===t.id&&tecComparable(e.url)===url);
  if(existing&&!existing.archived)return data;
  const externalReviews=existing?data.externalReviews.map(e=>e.id===existing.id?{...e,archived:false}:e):[...(data.externalReviews||[]),{id,concursoId,materiaId:m.id,topicId:t.id,url,note:String(note||'').trim().slice(0,20000),nextReviewDate:today,interval:1,reviews:[]}];
  const next={...data,externalReviews};validatePlanData(next);return next;
}
function tecComparable(url){try{return tecQuestionUrl(url);}catch{return url;}}
