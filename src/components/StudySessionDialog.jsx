import {TopicBizu} from "./TopicBizu.jsx";
import {TecNotebookButton} from './TecNotebookBuilder.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {BookOpen,Clock,Check,X,Play,Pause} from './Icons.jsx';
import {sessionNotebooks,tecQuestionUrl} from '../lib/studySession.js';
import {isSafeStudyLink} from '../lib/planValidation.js';
import {fmtClock} from '../lib/date.js';
import './studySession.css';

export function StudySessionDialog({row,topic,bank,elapsed,running,reviews,onToggle,onComplete,onClose,onAddReview,onManageNotebooks,onBizu,manageNotebooksLabel='Gerenciar meus cadernos ↗'}) {
  const [total,setTotal]=useState(''),[correct,setCorrect]=useState(''),[minutes,setMinutes]=useState('');
  const [error,setError]=useState(''),[question,setQuestion]=useState(''),[note,setNote]=useState(''),[reviewError,setReviewError]=useState(''),[reviewStatus,setReviewStatus]=useState(''),[guide,setGuide]=useState(false),[saving,setSaving]=useState(false);
  const dialog=useRef(null),close=useRef(onClose),busy=useRef(false);close.current=onClose;
  const books=sessionNotebooks(topic,bank),groups=new Map();for(const book of books){const key=book.bank||'Sem banca informada';groups.set(key,[...(groups.get(key)||[]),book]);}
  const theory=row.kind==='theory',n=Number(total),a=Number(correct);
  const validCounts=theory||(total!==''&&Number.isSafeInteger(n)&&n>0&&Number.isSafeInteger(a)&&a>=0&&a<=n);
  const validMinutes=minutes===''||(Number.isSafeInteger(Number(minutes))&&Number(minutes)>=1&&Number(minutes)<=1440);
  const canComplete=validCounts&&validMinutes;
  useEffect(()=>{
    const previousFocus=document.activeElement,overflow=document.body.style.overflow;
    const siblings=[...document.body.children].filter(e=>!e.contains(dialog.current));
    const previous=siblings.map(e=>[e,e.hasAttribute('inert')]);siblings.forEach(e=>e.setAttribute('inert',''));
    document.body.style.overflow='hidden';dialog.current?.focus();
    function keydown(e){
      if(e.key==='Escape'){e.preventDefault();if(!busy.current)close.current();}
      if(e.key!=='Tab'||!dialog.current)return;
      const elements=[...dialog.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')];
      const first=elements[0],last=elements[elements.length-1];
      if(!first){e.preventDefault();dialog.current.focus();}
      else if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first.focus();}
    }
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;previous.forEach(([e,wasInert])=>{if(!wasInert)e.removeAttribute('inert');});previousFocus?.focus();};
  },[]);
  async function complete(e){
    e.preventDefault();if(busy.current||!canComplete)return;
    busy.current=true;setSaving(true);setError('');
    try{await onComplete({total:theory?0:n,correct:theory?0:a,elapsedSeconds:elapsed,...(minutes!==''?{minutes:Number(minutes)}:{})});}
    catch(err){setError(err.message);busy.current=false;setSaving(false);}
  }
  function addReview(e){e.preventDefault();try{const url=tecQuestionUrl(question);onAddReview(url,note);setQuestion('');setNote('');setReviewError('');setReviewStatus('Questão guardada no caderno de revisão. Duplicatas não são adicionadas.');}catch(err){setReviewError(err.message);setReviewStatus('');}}
  const provider=n=>n.provider==='tec'?'TEC':n.provider==='qconcursos'?'Qconcursos':'Caderno';
  return createPortal(<div className="study-session-overlay"><section ref={dialog} className="study-session-dialog" role="dialog" aria-modal="true" aria-label="Sessão de estudo" tabIndex={-1}>
    <header className="study-session-header"><div><span className="eyebrow">SESSÃO DE ESTUDO · {theory?'TEORIA':row.kind==='review'?'REVISÃO':'QUESTÕES'}</span><h2>{row.materiaName}</h2><p>{row.topicName}</p></div><button type="button" className="session-close" aria-label="Fechar sessão sem salvar" disabled={saving} onClick={onClose}><X size={22}/></button></header>
    <div className="study-session-columns"><div className="study-session-resources">{onBizu && <details><summary>Bizu · revisão rápida</summary><TopicBizu topic={topic} onSave={onBizu}/></details>}<section aria-label="Cadernos do assunto"><TecNotebookButton materiaId={row.materiaId} topicId={row.topicId} beforeOpen={onClose}/><div className="session-section-heading"><BookOpen size={18}/><h3>Cadernos de questões</h3></div>
      {[...groups].map(([group,links])=><div className="session-bank" key={group}><h4>{group}</h4><div className="session-book-links">{links.map(book=><a key={book.id} aria-label={`abrir caderno ${book.title}`} href={book.url} target="_blank" rel="noopener noreferrer" title={book.shared?`Vinculado a ${book.sourceConcursoName}`:undefined}><BookOpen size={16}/><span>{book.title}<small>{provider(book)}{book.shared?' · assunto equivalente':''}</small></span><span aria-hidden="true">↗</span></a>)}</div></div>)}
      {!books.length&&<p className="session-muted">Ainda não há cadernos vinculados a este assunto. Vincule seus links do TEC ou Qconcursos ao assunto no edital.</p>}
      {onManageNotebooks&&<button type="button" className="session-text-button" disabled={saving} onClick={onManageNotebooks}>{manageNotebooksLabel}</button>}
    </section>
    <section className="session-materials"><button className="session-guide-button" type="button" aria-expanded={guide} onClick={()=>setGuide(v=>!v)}>Guia do tópico <span aria-hidden="true">{guide?'−':'+'}</span></button>{guide&&<div className="session-guide"><p>{theory?'Leia seu material e revise os conceitos antes de concluir a teoria.':'Resolva questões deste assunto e registre os resultados ao lado.'}</p>{topic.notes&&<p className="session-topic-notes">{topic.notes}</p>}{(topic.materials||[]).filter(m=>m.url&&isSafeStudyLink(m.url)).map(m=><a key={m.id||m.url} href={m.url} target="_blank" rel="noopener noreferrer">{m.name} ↗</a>)}{!topic.notes&&!(topic.materials||[]).some(m=>m.url&&isSafeStudyLink(m.url))&&<p className="session-muted">Vincule seus materiais ao assunto para consultá-los aqui.</p>}</div>}</section>
    {onAddReview&&<section className="session-review"><div className="session-section-heading"><h3>Marcar questão para revisão</h3><span>{reviews.filter(e=>!e.archived).length}</span></div><form onSubmit={addReview}><label>ID ou link da questão (TEC)<input aria-label="Questão TEC para revisão" value={question} maxLength={2048} required placeholder="Cole o link ou digite o número da questão" onChange={e=>{setQuestion(e.target.value);setReviewStatus('');}}/></label><label>Anotação opcional<textarea aria-label="Nota da questão para revisão" rows="2" value={note} maxLength={20000} placeholder="O que você quer lembrar ao revisar?" onChange={e=>setNote(e.target.value)}/></label>{reviewError&&<p role="alert" className="session-error">{reviewError}</p>}{reviewStatus&&<p role="status" className="session-muted">{reviewStatus}</p>}<button type="submit" className="session-secondary" disabled={!question.trim()}>Adicionar ao caderno de revisão</button></form><p className="session-muted">A questão é salva separadamente da conclusão da sessão.</p></section>}
    </div><div className="study-session-performance"><div className="session-section-heading"><h3>Registre seu desempenho</h3></div><form onSubmit={complete}>
      {!theory&&<div className="session-score-fields"><label>Questões<input aria-label="Questões da sessão do painel" type="number" min="1" max="100000" required value={total} onChange={e=>setTotal(e.target.value)} placeholder="0"/></label><label>Acertos<input aria-label="Acertos da sessão do painel" type="number" min="0" max={n||100000} value={correct} onChange={e=>setCorrect(e.target.value)} placeholder="0"/></label></div>}
      {theory&&<p className="session-muted">Esta etapa conclui a teoria sem acrescentar questões. A prática será uma próxima tarefa.</p>}
      <div className="session-timer"><div><Clock size={18}/><span aria-label="Cronômetro da janela de sessão">{fmtClock(elapsed)}</span><small>{running?'Em andamento':'Pausado'}</small></div><button type="button" className="session-secondary" onClick={onToggle} disabled={saving}>{running?<Pause size={15}/>:<Play size={15}/>} {running?'Pausar cronômetro':'Retomar cronômetro'}</button></div>
      <label>Tempo da sessão (opcional)<input aria-label="Minutos da sessão de estudo" type="number" min="1" max="1440" value={minutes} placeholder="Minutos" onChange={e=>setMinutes(e.target.value)}/></label><div className="session-time-shortcuts">{[[10,'10 min'],[30,'30 min'],[60,'1 h'],[90,'1 h 30'],[120,'2 h']].map(([n,label])=><button key={n} type="button" aria-pressed={Number(minutes)===n} onClick={()=>setMinutes(String(n))}>{label}</button>)}<button type="button" onClick={()=>setMinutes('')}>Usar cronômetro</button></div>
      <p className="session-muted">{minutes!==''?`Será registrado o tempo informado: ${minutes} min.`:elapsed>0?'Será registrado o tempo do cronômetro, arredondado em minutos.':`Sem tempo medido ou informado, será usada a estimativa de ${row.minutes} min.`}</p>
      {!theory&&!validCounts&&<p className="session-muted">Informe ao menos 1 questão e acertos entre zero e o total para concluir.</p>}
      {error&&<p role="alert" className="session-error">{error}</p>}
      <button type="submit" className="session-primary" aria-label="Concluir sessão do painel" disabled={!canComplete||saving}><Check size={18}/>{saving?'Registrando…':theory?'Registrar e concluir teoria':'Registrar e concluir tarefa'}</button>
      <button type="button" className="session-dismiss" onClick={onClose} disabled={saving}>Fechar sem salvar</button>
      <p className="session-muted session-close-hint">Ao fechar, a tarefa continua pendente e o cronômetro fica pausado.</p>
    </form></div></div>
  </section></div>,document.body);
}
