import {APP_ORIGIN,TEC_ORIGIN,validateTecRequest,tecNotebookUrl} from './tec-protocol.js';
let queue=Promise.resolve();
function mutate(fn){const task=queue.catch(()=>{}).then(async()=>{const jobs=(await chrome.storage.local.get('tecJobs')).tecJobs||[];const result=await fn(jobs);await chrome.storage.local.set({tecJobs:jobs.slice(-30)});return result;});queue=task;return task;}
const origin=url=>{try{return new URL(url).origin;}catch{return '';}};
const isTec=sender=>origin(sender.url||sender.tab?.url)===TEC_ORIGIN;
const isApp=sender=>origin(sender.url||sender.tab?.url)===APP_ORIGIN;
const output=job=>({id:job.request.id,accountId:job.request.accountId,status:job.status==='error'?'error':'complete',url:job.url,mappingTitle:job.mappingTitle,folder:job.folder,error:job.error});
async function publish(job){try{if(job.returnTabId)await chrome.tabs.sendMessage(job.returnTabId,{type:'TEC_RESULT',result:output(job)});}catch{/* The result stays in local storage for the next platform handshake. */}}
export async function handleTecMessage(message,sender){
 const type=message?.type;
 if(type==='TEC_HELLO'){
  if(!isApp(sender)||typeof message.accountId!=='string')throw Error('Origem inválida.');
  const enabled=await chrome.permissions.contains({origins:[TEC_ORIGIN+'/*']})&&(await chrome.scripting.getRegisteredContentScripts({ids:['ritmo-tec-builder']})).length>0;
  const jobs=(await chrome.storage.local.get('tecJobs')).tecJobs||[];
  return {available:true,enabled,version:'1.2.0',results:jobs.filter(j=>j.request.accountId===message.accountId&&['complete','error'].includes(j.status)).map(output)};
 }
 if(type==='TEC_CREATE'){
  if(!isApp(sender))throw Error('A montagem deve começar na plataforma.');
  const request=validateTecRequest(message.request);if(Date.now()-request.createdAt>86400000||request.createdAt>Date.now()+60000)throw Error('Pedido expirado. Inicie uma nova montagem.');
  if(!await chrome.permissions.contains({origins:[TEC_ORIGIN+'/*']})||!(await chrome.scripting.getRegisteredContentScripts({ids:['ritmo-tec-builder']})).length)throw Error('Ative o montador TEC no botão da extensão.');
  const existing=await mutate(jobs=>{const same=jobs.find(j=>j.request.id===request.id);if(same)return same;if(jobs.some(j=>['opening','pending','applying','generating'].includes(j.status)&&Date.now()-j.request.createdAt<86400000))throw Error('Já existe uma montagem em andamento. Termine ou cancele antes de iniciar outra.');const job={request,status:'opening',returnTabId:sender.tab.id};jobs.push(job);return null;});
  if(existing)return {accepted:true,status:existing.status};
  try{const tab=await chrome.tabs.create({url:TEC_ORIGIN+'/questoes/filtrar'});await mutate(jobs=>{const job=jobs.find(j=>j.request.id===request.id);job.tabId=tab.id;job.status='pending';});return {accepted:true};}
  catch(error){await mutate(jobs=>{const job=jobs.find(j=>j.request.id===request.id);job.status='error';job.error=error.message;});throw error;}
 }
 if(type==='TEC_CANCEL'){
  if(!isApp(sender))throw Error('Origem inválida.');await mutate(jobs=>{const job=jobs.find(j=>j.request.id===message.id&&j.request.accountId===message.accountId);if(job&&job.status!=='complete')job.status='cancelled';});return {cancelled:true};
 }
 if(type==='TEC_CAPTURE'){
  if(sender.tab||sender.id!==chrome.runtime.id||!sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`))throw Error('Use o botão da extensão para vincular o caderno aberto.');
  const url=tecNotebookUrl(message.url);
  const job=await mutate(jobs=>{const pending=jobs.filter(j=>j.status==='generating');if(pending.length!==1)throw Error('Não há uma montagem aguardando o link.');const j=pending[0];j.url=url;j.status='complete';return j;});await publish(job);return {ok:true};
 }
 if(type==='TEC_DISABLE'){
  if(sender.tab||sender.id!==chrome.runtime.id||!sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`))throw Error('Use o botão da extensão.');
  const stopped=await mutate(jobs=>{const active=jobs.filter(j=>['opening','pending','applying','generating'].includes(j.status));for(const j of active){j.status='error';j.error='Montador TEC desativado. Um caderno já criado continua no TEC.';}return active;});for(const j of stopped)await publish(j);return {ok:true};
 }
 if(!isTec(sender))throw Error('Origem TEC inválida.');
 const jobs=(await chrome.storage.local.get('tecJobs')).tecJobs||[],job=jobs.find(j=>j.tabId===sender.tab.id&&['pending','applying','generating'].includes(j.status));
 if(type==='TEC_JOB')return {job:job||null};
 if(type==='TEC_DONE'){const done=jobs.find(j=>j.tabId===sender.tab.id&&j.request.id===message.id&&j.status==='complete');if(done&&tecNotebookUrl(message.url)===done.url)return {ok:true};}
 if(!job||job.request.id!==message.id)throw Error('Montagem não identificada nesta aba.');
 if(type==='TEC_PHASE'){
  if(!await chrome.permissions.contains({origins:[TEC_ORIGIN+'/*']}))throw Error('O acesso ao TEC foi desativado.');
  if(job.status==='generating')throw Error('A geração já foi iniciada; não será reiniciada.');
  if(message.phase==='generating'&&job.status!=='applying')throw Error('Confira os filtros antes de gerar.');
  if(!['applying','pending','generating','error'].includes(message.phase))throw Error('Etapa inválida.');
  if(message.mappingTitle!==undefined&&(typeof message.mappingTitle!=='string'||message.mappingTitle.length>1500))throw Error('Assunto inválido.');
  if(message.folder!==undefined&&(typeof message.folder!=='string'||message.folder.length>200))throw Error('Pasta inválida.');
  const updated=await mutate(all=>{const j=all.find(j=>j.request.id===job.request.id);if(j.status==='cancelled')throw Error('Pedido cancelado.');j.status=message.phase;if(message.mappingTitle)j.mappingTitle=message.mappingTitle;if(message.folder)j.folder=message.folder;if(message.error)j.error=String(message.error).slice(0,1000);return j;});if(updated.status==='error')await publish(updated);return {ok:true};
 }
 if(type==='TEC_DONE'){
  if(job.status!=='generating')throw Error('A criação deste caderno ainda não foi iniciada.');
  const url=tecNotebookUrl(message.url);const updated=await mutate(all=>{const j=all.find(j=>j.request.id===job.request.id);j.url=url;j.status='complete';return j;});await publish(updated);return {ok:true};
 }
 throw Error('Mensagem desconhecida.');
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{handleTecMessage(message,sender).then(reply,error=>reply({error:error.message}));return true;});
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(!change.url)return;let url;try{url=tecNotebookUrl(change.url);}catch{return;}void mutate(jobs=>{const j=jobs.find(j=>j.tabId===tabId&&j.status==='generating');if(!j)return null;j.url=url;j.status='complete';return j;}).then(j=>{if(j)return publish(j);});});
chrome.tabs.onCreated.addListener(tab=>{if(!tab.openerTabId)return;void mutate(jobs=>{const j=jobs.find(j=>j.tabId===tab.openerTabId&&j.status==='generating');if(j)j.tabId=tab.id;});});
