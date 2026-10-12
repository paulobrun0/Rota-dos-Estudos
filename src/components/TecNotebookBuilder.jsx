import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {makeTecRequest,queueTecRequest,applyTecResult,tecNotebookUrl} from '../lib/tecNotebooks.js';
import {validatePlanData} from '../lib/planValidation.js';
import {primaryBtnStyle,secondaryBtnStyle,inputStyle} from '../styles/shared.js';
import {X} from './Icons.jsx';

const TecContext=createContext(null);
export function useTecNotebooks(data,setData,accountId){
 const current=useRef(data);current.current=data;
 const [bridge,setBridge]=useState({available:false,enabled:false}),[selected,setSelected]=useState(null),[message,setMessage]=useState('');
 const sending=useRef(null);
 const announce=value=>window.postMessage({channel:'ritmo-tec-app-v1',...value},window.location.origin);
 useEffect(()=>{
  setBridge({available:false,enabled:false});setSelected(null);setMessage('');sending.current=null;
  if(!accountId)return;
  function receive(event){
   if(event.source!==window||event.origin!==window.location.origin||event.data?.channel!=='ritmo-tec-extension-v1')return;
   const value=event.data;
   if(value.type==='TEC_HELLO'){if(value.available)setBridge({available:true,enabled:Boolean(value.enabled)});for(const result of value.results||[])apply(result);}
   if(value.type==='TEC_RESULT')apply(value.result);
   if(value.type==='TEC_CREATE'&&value.id===sending.current){if(value.error){setMessage(value.error);const result={id:value.id,accountId,status:'error',error:value.error};apply(result);}else if(value.accepted){setMessage('Pedido enviado. Acompanhe a montagem na aba do TEC.');setSelected(null);}}
  }
  function apply(result){
   const plan=current.current;if(!plan||!result||!plan.tecRequests?.some(r=>r.id===result.id&&r.accountId===accountId&&r.status!=='complete'&&r.status!=='cancelled'))return;
   try{const next=applyTecResult(plan,result,accountId);validatePlanData(next);setData(d=>d===plan?next:applyTecResult(d,result,accountId));setMessage(result.status==='error'?result.error:'Caderno TEC vinculado ao assunto.');}
   catch(error){setMessage(error.message);}
  }
  window.addEventListener('message',receive);const hello=()=>announce({type:'TEC_HELLO',accountId});hello();const interval=setInterval(hello,5000);
  return()=>{window.removeEventListener('message',receive);clearInterval(interval);};
 },[accountId,setData]);
 function open(ref,initial={}){setMessage('');setSelected({ref:{concursoId:ref.concursoId||current.current.activeConcursoId,materiaId:ref.materiaId,topicId:ref.topicId},initial});announce({type:'TEC_HELLO',accountId});}
 function start(options){
  if(!accountId)throw Error('Entre na sua conta para montar um caderno no TEC.');
  if(!bridge.available)throw Error('Instale ou atualize a extensão Ritmo e recarregue a plataforma.');
  if(!bridge.enabled)throw Error('Na extensão, clique em Ativar montador TEC e autorize o acesso ao TEC.');
  const request=makeTecRequest(current.current,accountId,selected.ref,options,crypto.randomUUID());
  const next=queueTecRequest(current.current,request);validatePlanData(next);setData(next);sending.current=request.id;announce({type:'TEC_CREATE',request});return request;
 }
 function cancel(id){setData(d=>({...d,tecRequests:(d.tecRequests||[]).map(r=>r.id===id&&r.accountId===accountId?{...r,status:'cancelled'}:r)}));announce({type:'TEC_CANCEL',id,accountId});setMessage('Montagem cancelada. Um caderno já criado continua disponível no TEC.');}
 function manual(id,url,mappingTitle){const plan=current.current;const next=applyTecResult(plan,{id,accountId,url,mappingTitle,status:'complete'},accountId,{allowUnmapped:true});validatePlanData(next);setData(next);setMessage('Caderno vinculado ao assunto.');}
 return {data,accountId,bridge,selected,message,open,start,cancel,manual,close:()=>setSelected(null)};
}
export function TecNotebookProvider({value,children}){return <TecContext.Provider value={value}>{children}{value.selected&&<TecNotebookDialog key={JSON.stringify(value.selected.ref)} controller={value}/>}</TecContext.Provider>;}
export function TecNotebookButton({materiaId,topicId,concursoId,initial,beforeOpen}){const context=useContext(TecContext);if(!context)return null;return <button type="button" disabled={!materiaId||!topicId} style={{...secondaryBtnStyle,fontSize:11,padding:'5px 8px',marginTop:0}} onClick={()=>{beforeOpen?.();context.open({materiaId,topicId,concursoId},initial);}}>Gerar caderno TEC</button>;}
export function TecRequestStatus(){
 const c=useContext(TecContext),[editing,setEditing]=useState(null),[url,setUrl]=useState(''),[mapping,setMapping]=useState(''),[error,setError]=useState('');if(!c)return null;
 const rows=(c.data?.tecRequests||[]).filter(r=>r.accountId===c.accountId&&['pending','error'].includes(r.status));
 return <div>{c.message&&<p role="status" className="muted">{c.message}</p>}{rows.length>0&&<section className="study-panel"><h3>Montagens do TEC</h3>{rows.map(r=><div key={r.id} style={{borderTop:'1px solid var(--border)',padding:'12px 0'}}><strong>{r.subject}</strong><p className="muted">{r.status==='error'?r.error:'Em andamento. O vínculo será recebido pela extensão.'}</p><button type="button" style={secondaryBtnStyle} onClick={()=>{setEditing(r.id);setUrl('');setMapping(r.mappedTitle||'');}}>Vincular link gerado</button><button type="button" style={secondaryBtnStyle} onClick={()=>c.cancel(r.id)}>Cancelar montagem</button>{editing===r.id&&<form className="study-form" onSubmit={e=>{e.preventDefault();try{tecNotebookUrl(url);c.manual(r.id,url,mapping);setEditing(null);setError('');}catch(err){setError(err.message);}}}><label>Link do caderno gerado<input aria-label="Link gerado no TEC" style={inputStyle} type="url" required value={url} onChange={e=>setUrl(e.target.value)}/></label><label>Matéria e assunto no TEC — opcional<input aria-label="Correspondência do assunto TEC" style={inputStyle} value={mapping} maxLength={1500} onChange={e=>setMapping(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button style={primaryBtnStyle}>Vincular caderno ao assunto</button></form>}</div>)}</section>}</div>;
}
function TecNotebookDialog({controller:c}){
 const {ref,initial}=c.selected,concurso=c.data.concursos.find(e=>e.id===ref.concursoId),materia=concurso?.materias.find(m=>m.id===ref.materiaId),topic=materia?.topics.find(t=>t.id===ref.topicId),year=new Date().getFullYear();
 const [draft,setDraft]=useState(()=>({title:initial.title||topic?.name.slice(0,200)||'',bank:initial.bank??concurso?.banca??'',yearFrom:initial.yearFrom||String(year-5),yearTo:initial.yearTo||String(year),quantity:30,folder:c.data.studyPreferences?.tecFolder||'',onlyUnsolved:false,removeCancelled:true,removeOutdated:true}));
 const [error,setError]=useState(''),[sent,setSent]=useState(false),dialog=useRef(null),submitting=useRef(false);
 useEffect(()=>{const focus=document.activeElement,overflow=document.body.style.overflow;const siblings=[...document.body.children].filter(e=>!e.contains(dialog.current)).map(e=>[e,e.hasAttribute('inert')]);siblings.forEach(([e])=>e.setAttribute('inert',''));document.body.style.overflow='hidden';dialog.current?.focus();const key=e=>{if(e.key==='Escape')c.close();if(e.key!=='Tab')return;const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input,a[href]')],first=controls[0],last=controls.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first?.focus();}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;siblings.forEach(([e,wasInert])=>{if(!wasInert)e.removeAttribute('inert');});document.removeEventListener('keydown',key);focus?.focus();};},[]);
 const edit=(key,value)=>{setDraft(d=>({...d,[key]:value}));setError('');};
 return createPortal(<div style={{position:'fixed',inset:0,zIndex:400,background:'rgba(3,15,23,.7)',padding:'4vh 16px',overflowY:'auto'}}><section ref={dialog} role="dialog" aria-modal="true" aria-label="Montar caderno no TEC" tabIndex={-1} className="study-panel" style={{maxWidth:650,margin:'0 auto',padding:24}}><div className="study-panel-heading"><div><span className="eyebrow">MONTAR NO TEC</span><h2>{materia?.name}</h2></div><button type="button" aria-label="Fechar montador TEC" style={secondaryBtnStyle} onClick={c.close}><X size={18}/></button></div><p>{topic?.name}</p>
 <p className="muted">A extensão preenche os filtros no TEC, cria o caderno e devolve seu link. Quando houver dúvida na correspondência, você escolhe o assunto no TEC. A pasta escolhida será lembrada.</p>
 {!c.bridge.available&&<p role="status">Instale a versão 1.2 da extensão Ritmo e recarregue esta página. <a href={`${import.meta.env.BASE_URL}ritmo-marcacoes-extension.zip`} download>Baixar extensão</a></p>}
 {c.bridge.available&&!c.bridge.enabled&&<p role="status">Abra a extensão e clique em “Ativar montador TEC” para autorizar o acesso ao TEC.</p>}
 <form className="study-form" onSubmit={e=>{e.preventDefault();if(submitting.current)return;try{submitting.current=true;c.start(draft);setSent(true);setError('');}catch(err){submitting.current=false;setError(err.message);}}}><label>Título do caderno<input style={inputStyle} aria-label="Título do caderno automático" required maxLength={200} value={draft.title} onChange={e=>edit('title',e.target.value)}/></label><label>Banca — vazio para todas<input aria-label="Banca do caderno automático" style={inputStyle} maxLength={100} value={draft.bank} onChange={e=>edit('bank',e.target.value)} placeholder="Ex.: Cebraspe"/></label><div className="form-grid"><label>Ano inicial<input aria-label="Ano inicial do caderno automático" style={inputStyle} type="number" min="1900" max={year} value={draft.yearFrom} onChange={e=>edit('yearFrom',e.target.value)}/></label><label>Ano final<input aria-label="Ano final do caderno automático" style={inputStyle} type="number" min="1900" max={year} value={draft.yearTo} onChange={e=>edit('yearTo',e.target.value)}/></label><label>Quantidade de questões<input aria-label="Quantidade do caderno automático" style={inputStyle} type="number" min="1" max="1000" required value={draft.quantity} onChange={e=>edit('quantity',e.target.value)}/></label></div><label>Pasta no TEC — opcional<input style={inputStyle} aria-label="Pasta do caderno automático" maxLength={200} value={draft.folder} onChange={e=>edit('folder',e.target.value)} placeholder="Na primeira vez, escolha diretamente no TEC"/></label>
 {[["onlyUnsolved","Somente questões não resolvidas"],["removeCancelled","Excluir anuladas"],["removeOutdated","Excluir desatualizadas"]].map(([key,label])=><label key={key}><span><input type="checkbox" checked={draft[key]} onChange={e=>edit(key,e.target.checked)}/> {label}</span></label>)}
 <p className="muted">Se houver menos questões que o pedido, o caderno usará as disponíveis. Criar o caderno não registra estudo nem acertos.</p>{(error||c.message)&&<p role="alert">{error||c.message}</p>}<button type="submit" style={primaryBtnStyle} disabled={sent||!c.bridge.available||!c.bridge.enabled}>{sent?'Pedido enviado…':'Gerar e vincular caderno'}</button></form></section></div>,document.body);
}
