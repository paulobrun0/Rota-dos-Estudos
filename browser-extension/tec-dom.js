import {normalize,bankMatches,subjectMatches,searchTerm,tecNotebookUrl} from './tec-protocol.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function runTecBuilder(document,job,send){
 const request=job.request,win=document.defaultView;
 const visible=e=>Boolean(e&&e.getClientRects().length&&win.getComputedStyle(e).display!=='none');
 const elements=(selector)=>Array.from(document.querySelectorAll(selector)).filter(e=>visible(e)&&!e.closest('#ritmo-tec-panel,article'));
 const exact=(selector,text)=>elements(selector).filter(e=>e.textContent.trim()===text);
 const findText=text=>exact('a,button,span,li',text).find(e=>!Array.from(e.children).some(c=>c.textContent.trim()===text))||exact('a,button,span,li',text)[0];
 async function wait(fn,message,ms=20000){const end=Date.now()+ms;while(Date.now()<end){const value=fn();if(value)return value;await delay(250);}throw Error(message);}
 function input(e,value){e.focus();const setter=Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value').set;setter.call(e,String(value));e.dispatchEvent(new win.Event('input',{bubbles:true}));e.dispatchEvent(new win.Event('change',{bubbles:true}));e.dispatchEvent(new win.KeyboardEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));e.blur();}
 function selectedItem(e){return e.closest('li')?.classList.contains('arvore-item-selecionado');}
 async function tab(name){const e=await wait(()=>exact('li',name)[0],`Não encontrei o filtro ${name}.`);e.click();await delay(300);}
 async function search(section,term){await tab(section);const trigger=await wait(()=>findText('Pesquisar por nome'),'Não encontrei a busca por nome.');trigger.click();const field=await wait(()=>elements('input').find(e=>(e.getAttribute('placeholder')||'').includes('três caracteres')),'A busca do TEC mudou.');input(field,term);await delay(1200);try{await wait(()=>elements('.arvore-item-nome').some(e=>normalize(e.textContent).includes(normalize(term))),'A pesquisa não retornou opções.',8000);}catch{return [];}return elements('li.arvore-item');}
 const panel=document.createElement('aside');panel.id='ritmo-tec-panel';Object.assign(panel.style,{position:'fixed',right:'16px',top:'16px',zIndex:'99999',width:'340px',maxWidth:'calc(100vw - 32px)',maxHeight:'90vh',overflow:'auto',boxSizing:'border-box',padding:'18px',borderRadius:'12px',background:'#142633',color:'#eaf5f9',boxShadow:'0 10px 40px #0008',font:'13px system-ui'});
 const heading=document.createElement('strong');heading.textContent='Ritmo · Montagem do caderno';const status=document.createElement('p');panel.append(heading,status);document.body.append(panel);
 const say=text=>status.textContent=text;
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;Object.assign(b.style,{display:'block',width:'100%',padding:'10px',marginTop:'8px',border:'1px solid #355263',borderRadius:'6px',background:'#1b3241',color:'#eaf5f9',cursor:'pointer'});b.onclick=action;panel.append(b);return b;}
 async function chooseSubject(items){const matches=items.filter(e=>subjectMatches(e.title,request));if(matches.length===1)return matches[0];
  say('Confira o assunto equivalente no TEC. Sua escolha será guardada para as próximas montagens.');
  return new Promise(resolve=>{const candidates=items.filter(e=>e.title?.includes(':')).slice(0,30);if(!candidates.length){say('Não encontrei o assunto. Use a busca de Matéria e assunto no TEC e clique em Usar assunto selecionado.');button('Usar assunto selecionado',()=>{const selected=elements('li.arvore-item-selecionado[title]').filter(e=>e.title.includes(':'));if(selected.length!==1){say('Selecione exatamente um assunto, sem marcar a matéria inteira.');return;}resolve(selected[0]);});}
   else for(const e of candidates){const b=button(e.title,()=>{for(const c of panel.querySelectorAll('button'))c.remove();resolve(e);});b.title=e.title;}
  });
 }
 function count(){return elements('strong').filter(e=>/questões\s+encontradas/.test(e.parentElement.textContent)).map(e=>Number(e.textContent.replace(/\D/g,''))).find(n=>Number.isFinite(n));}
 async function stableCount(){await delay(2500);let last=null,stable=0;return wait(()=>{const n=count();if(!Number.isFinite(n))return false;if(n===last)stable++;else{last=n;stable=0;}return stable>=3?{value:n}:false;},'A contagem do TEC não atualizou. Aguarde e refaça a montagem.',30000);}
 if(job.status==='generating'){say('A geração já foi iniciada. Aguardando o link, sem criar outro caderno.');const url=await wait(()=>{try{return tecNotebookUrl(win.location.href);}catch{return null;}},'Abra o caderno gerado e use Vincular caderno aberto na extensão.',60000);await send({type:'TEC_DONE',id:request.id,url});say('Caderno vinculado. Volte para sua plataforma.');return;}
 if(win.location.pathname!=='/questoes/filtrar'){say('Abra o filtro de questões do TEC e entre na sua conta para continuar.');return;}
 if(job.status==='applying'){say('Esta montagem foi interrompida. Cancele na plataforma e inicie outra para evitar filtros duplicados.');return;}
 try{
  await wait(()=>document.querySelector('#nomeCadernoId'),'Entre no TEC e volte para a montagem.',30000);
  await send({type:'TEC_PHASE',id:request.id,phase:'applying'});say('Preparando matéria e assunto…');
  const clear=findText('Limpar todos');if(clear){clear.click();await delay(700);}else{const count=elements('.gerador-filtrador-cabecalho-titulo strong').find(e=>e.parentElement.textContent.includes('Filtros ativos'));if(Number(count?.textContent)>0)throw Error('Limpe os filtros anteriores no TEC antes de iniciar outra montagem.');}
  const items=await search('Matéria e assunto',searchTerm(request));const subject=await chooseSubject(items),mappingTitle=subject.title;
  if(!mappingTitle)throw Error('Confirme um assunto individual do TEC.');if(!selectedItem(subject))subject.querySelector('.arvore-item-conteudo')?.click();
  await send({type:'TEC_PHASE',id:request.id,phase:'applying',mappingTitle});
  if(request.bank){say('Selecionando banca…');const items=await search('Banca',bankMatches(request.bank,'Cebraspe')?'Cebraspe':request.bank);const matches=items.filter(e=>bankMatches(e.querySelector('.arvore-item-nome')?.textContent,request.bank));if(matches.length!==1)throw Error('A banca não foi identificada com segurança. Confira o nome e inicie outra montagem.');if(!selectedItem(matches[0]))matches[0].querySelector('.arvore-item-conteudo')?.click();}
  if(request.yearFrom!==null){say('Selecionando anos…');await tab('Ano');for(let year=request.yearFrom;year<=request.yearTo;year++){const matches=elements('.arvore-item-nome').filter(e=>e.textContent.trim()===String(year));if(matches.length!==1)throw Error(`O TEC não disponibilizou o ano ${year}.`);if(!selectedItem(matches[0]))matches[0].closest('.arvore-item-conteudo').click();}}
  const options=[['onlyUnsolved','Remover as que resolvi'],['removeCancelled','Remover anuladas'],['removeOutdated','Remover desatualizadas']];if(options.some(([key])=>request[key])){say('Aplicando opções…');await tab('Opções');for(const [key,label] of options)if(request[key]){const e=elements('.arvore-item-nome').find(e=>e.textContent.trim()===label);if(!e)throw Error(`Não encontrei a opção ${label}.`);if(!selectedItem(e))e.closest('.arvore-item-conteudo').click();}}
  say('Aguardando a contagem de questões…');const {value:available}=await stableCount();if(!available)throw Error('Nenhuma questão corresponde aos filtros. Ajuste banca ou anos.');if(available>100000)throw Error('Restrinja os filtros: o TEC limita a edição de quantidades a 100 mil resultados.');
  findText('Editar quantidades')?.click();const quantity=await wait(()=>elements('input[aria-label="Alterar quantidade total de questões do caderno"]')[0],'O editor de quantidades mudou. Não gerei um caderno com quantidade incorreta.');input(quantity,Math.min(request.quantity,available));await delay(750);
  const folder=await wait(()=>document.querySelector('#pastaCadernosId'),'Não encontrei a pasta de destino.');
  let chosen=request.folder?Array.from(folder.options).find(o=>normalize(o.text)===normalize(request.folder)):null;
  if(!chosen){say('Escolha uma pasta no TEC e confirme abaixo. Ela será lembrada para as próximas montagens.');await new Promise(resolve=>{button('Usar pasta selecionada e gerar',()=>{chosen=folder.options[folder.selectedIndex];if(!chosen?.value){say('Selecione uma pasta de destino no TEC.');return;}resolve();});});}
  folder.value=chosen.value;folder.dispatchEvent(new win.Event('change',{bubbles:true}));input(document.querySelector('#nomeCadernoId'),request.title);
  const checkboxes=elements('input[type="checkbox"]');const series=checkboxes.find(e=>`${e.getAttribute('aria-label')||''} ${e.title||''} ${e.closest('label')?.textContent||''}`.includes('Gerar cadernos em série'))||(checkboxes.length===1?checkboxes[0]:null);if(series?.checked)series.click();
  const generate=await wait(()=>elements('button').find(b=>normalize(b.textContent)==='gerar caderno'&&!b.disabled),'O TEC não habilitou a geração do caderno.');
  await send({type:'TEC_PHASE',id:request.id,phase:'generating',mappingTitle,folder:chosen.text.trim()});say('Gerando o caderno. Você pode acompanhar a criação no TEC.');generate.click();
  const url=await wait(()=>{try{return tecNotebookUrl(win.location.href);}catch{}const links=elements('a[href]').filter(a=>{try{tecNotebookUrl(a.href);return true;}catch{return false;}});return links.length===1?tecNotebookUrl(links[0].href):null;},'A geração foi iniciada. Se o link não voltou, abra o caderno e clique em Vincular caderno aberto na extensão.',60000);
  await send({type:'TEC_DONE',id:request.id,url});say('Caderno vinculado ao assunto. Volte para sua plataforma.');
 }catch(error){say(error.message);const result=await chromeSafePhase(error.message);if(result)button('Voltar para a plataforma',()=>win.open('https://app.paulobruno.dev/','_blank','noopener'));}
 async function chromeSafePhase(error){try{const response=await send({type:'TEC_JOB'});if(response.job?.status==='generating')return false;await send({type:'TEC_PHASE',id:request.id,phase:'error',error});return true;}catch{return false;}}
}
