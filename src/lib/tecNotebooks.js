import {validateTecRequest,tecNotebookUrl,normalize,discipline} from './tecProtocol.js';
import {mergeNotebooks} from './notebooks.js';
import {topicIdentity} from './editalCompatibility.js';
export {validateTecRequest,tecNotebookUrl};
export function makeTecRequest(data,accountId,ref,options,id,createdAt=Date.now()){
 const c=data.concursos.find(c=>c.id===ref.concursoId),m=c?.materias.find(m=>m.id===ref.materiaId),t=m?.topics.find(t=>t.id===ref.topicId);if(!t)throw Error('Selecione um assunto existente.');
 return validateTecRequest({id,accountId,...ref,materia:m.name,subject:t.name,mappedTitle:t.tecSubjectTitle||'',title:options.title||t.name.slice(0,200),bank:options.bank?.trim()||'',folder:options.folder?.trim()||'',quantity:Number(options.quantity),yearFrom:options.yearFrom===''?null:Number(options.yearFrom),yearTo:options.yearTo===''?null:Number(options.yearTo),onlyUnsolved:Boolean(options.onlyUnsolved),removeCancelled:Boolean(options.removeCancelled),removeOutdated:Boolean(options.removeOutdated),createdAt});
}
export function queueTecRequest(data,request){validateTecRequest(request);if(data.tecRequests?.some(r=>r.id===request.id))return data;const pending=(data.tecRequests||[]).filter(r=>r.status==='pending');if(pending.length>=10)throw Error('Conclua ou cancele as montagens pendentes antes de iniciar outra.');return {...data,tecRequests:[...(data.tecRequests||[]).filter(r=>r.status==='pending'),...(data.tecRequests||[]).filter(r=>r.status!=='pending').slice(-39),{...request,status:'pending'}]};}
export function applyTecResult(data,result,accountId,{allowUnmapped=false}={}){
 const request=data.tecRequests?.find(r=>r.id===result.id);if(!request||request.accountId!==accountId||result.accountId!==accountId)throw Error('Este resultado não pertence a uma montagem desta conta.');
 if(request.status==='cancelled'||request.status==='complete')return data;
 if(result.status==='error')return {...data,tecRequests:data.tecRequests.map(r=>r.id===request.id?{...r,status:'error',error:String(result.error||'Falha na montagem.').slice(0,1000)}:r)};
 const url=tecNotebookUrl(result.url);
 const hasMapping=typeof result.mappingTitle==='string'&&Boolean(result.mappingTitle.trim())&&result.mappingTitle.length<=1500;
 if(!hasMapping&&!allowUnmapped)throw Error('Confirme o assunto do TEC antes de vincular o caderno.');
 if(result.mappingTitle!==undefined&&result.mappingTitle.length>1500)throw Error('Correspondência de assunto muito longa.');
 const c=data.concursos.find(c=>c.id===request.concursoId),m=c?.materias.find(m=>m.id===request.materiaId),t=m?.topics.find(t=>t.id===request.topicId);
 if(!t)throw Error('O assunto original foi removido. O caderno continua disponível no TEC.');
 if(discipline(m.name)!==discipline(request.materia)||normalize(t.name)!==normalize(request.subject))throw Error('O assunto mudou desde o pedido. Confira o caderno no TEC e inicie outra montagem para o assunto atual.');
 const entry={id:`tec-${request.id}`,concursoId:c.id,materiaId:m.id,topicId:t.id,subjectKey:topicIdentity(m,t),title:request.title,bank:request.bank||'Todas as bancas',url,...(request.yearFrom!==null?{yearFrom:request.yearFrom,yearTo:request.yearTo}:{})};
 const next=mergeNotebooks(data,[entry]);return {...next,concursos:next.concursos.map(c=>c.id!==request.concursoId?c:{...c,materias:c.materias.map(m=>m.id!==request.materiaId?m:{...m,topics:m.topics.map(t=>t.id!==request.topicId||!hasMapping?t:{...t,tecSubjectTitle:result.mappingTitle.trim()})})}),tecRequests:next.tecRequests.map(r=>r.id===request.id?{...r,status:'complete',url}:r),studyPreferences:{...next.studyPreferences,...(typeof result.folder==='string'&&result.folder.length<=200?{tecFolder:result.folder}:{})}};
}
