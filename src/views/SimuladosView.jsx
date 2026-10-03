import React, { useState } from 'react';
import { uid } from '../lib/id.js';
import { todayISO } from '../lib/date.js';
import { examScore, sortedExams } from '../lib/studyInsights.js';
import { Panel, Metric } from '../components/StudyPanels.jsx';
import { inputStyle, primaryBtnStyle, secondaryBtnStyle } from '../styles/shared.js';
import { colors } from '../styles/colors.js';
const fresh = concurso => ({ id:uid(), name:'', date:todayISO(), banca:concurso.banca || '', minutes:0, rows:concurso.materias.map(m=>({materiaId:m.id,materiaName:m.name,total:0,correct:0,weight:1})) });
export function SimuladosView({ concurso, onSave, onRemove }) {
  const [draft,setDraft] = useState(null);
  const [error,setError] = useState('');
  const exams=sortedExams(concurso);
  const latest=exams.at(-1);
  const average=exams.length ? exams.reduce((s,e)=>s+examScore(e).percent,0)/exams.length : null;
  const best=exams.length ? Math.max(...exams.map(e=>examScore(e).percent)) : null;
  const previous=exams.at(-2);
  function updateRow(i,key,value){setDraft(d=>({...d,rows:d.rows.map((r,n)=>n===i?{...r,[key]:Number(value)}:r)}));}
  function save(event){event.preventDefault();const rows=draft.rows.filter(r=>r.total>0);if(!draft.name.trim() || !rows.length || draft.rows.some(r=>r.total<0||!Number.isSafeInteger(r.total)||!Number.isSafeInteger(r.correct)||r.correct<0||r.correct>r.total||!Number.isFinite(r.weight)||r.weight<=0) || !Number.isFinite(draft.minutes)||draft.minutes<0){setError('Informe o nome e ao menos uma matéria com questões. Acertos não podem exceder o total e pesos devem ser positivos.');return;}onSave({...draft,name:draft.name.trim(),rows});setDraft(null);setError('');}
  return <div><div className="study-metrics"><Metric label="Melhor nota" value={best===null?'—':`${best}%`} /><Metric label="Último simulado" value={latest?`${examScore(latest).percent}%`:'—'} hint={previous?`${(examScore(latest).percent-examScore(previous).percent).toFixed(1)} p.p. em relação ao anterior`:undefined}/><Metric label="Média das notas" value={average===null?'—':`${average.toFixed(1)}%`}/><Metric label="Simulados realizados" value={exams.length}/></div>
    <Panel title="Simulados" action={<button onClick={()=>{setDraft(fresh(concurso));setError('');}} style={primaryBtnStyle}>Registrar simulado</button>}>
      <p className="muted">Registre os resultados por matéria. A nota considera o peso de cada questão; simulados ficam separados dos contadores de prática para evitar duplicação.</p>
      {draft && <form onSubmit={save} className="study-form">
        <div className="form-grid"><label>Nome<input required maxLength={120} aria-label="Nome do simulado" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} style={inputStyle}/></label><label>Data<input required type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})} style={inputStyle}/></label><label>Banca<input value={draft.banca} maxLength={120} onChange={e=>setDraft({...draft,banca:e.target.value})} style={inputStyle}/></label><label>Tempo (minutos)<input type="number" min="0" value={draft.minutes} onChange={e=>setDraft({...draft,minutes:Number(e.target.value)})} style={inputStyle}/></label></div>
        <div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Matéria</th><th>Questões</th><th>Acertos</th><th>Peso por questão</th></tr></thead><tbody>{draft.rows.map((r,i)=><tr key={r.materiaId}><td data-label="Matéria">{r.materiaName}</td><td data-label="Questões"><input aria-label={`Questões de ${r.materiaName}`} type="number" min="0" step="1" value={r.total} onChange={e=>updateRow(i,'total',e.target.value)} style={{...inputStyle,width:'100%',maxWidth:90}}/></td><td data-label="Acertos"><input aria-label={`Acertos de ${r.materiaName}`} type="number" min="0" max={r.total} step="1" value={r.correct} onChange={e=>updateRow(i,'correct',e.target.value)} style={{...inputStyle,width:'100%',maxWidth:90}}/></td><td data-label="Peso por questão"><input aria-label={`Peso de ${r.materiaName}`} type="number" min="0.01" step="0.01" value={r.weight} onChange={e=>updateRow(i,'weight',e.target.value)} style={{...inputStyle,width:'100%',maxWidth:90}}/></td></tr>)}</tbody></table></div>
        {!draft.rows.length&&<p className="muted">Cadastre matérias no edital para registrar os resultados.</p>}{error&&<p role="alert" style={{color:colors.red}}>{error}</p>}<div className="topic-actions"><button style={primaryBtnStyle}>Salvar simulado</button><button type="button" onClick={()=>setDraft(null)} style={secondaryBtnStyle}>Cancelar</button></div>
      </form>}
      {!exams.length&&<p className="muted">Seu primeiro simulado começará o histórico de evolução.</p>}
      {!!exams.length&&<div className="score-chart" aria-label="Evolução das notas dos simulados">{exams.slice(-12).map(e=><div key={e.id} className="score-column"><strong>{examScore(e).percent}%</strong><div className="score-bar-track"><div style={{height:`${examScore(e).percent}%`,background:colors.accent,borderRadius:'6px 6px 0 0'}}/></div><small>{e.name}</small><small>{e.date}</small></div>)}</div>}
      <div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Simulado</th><th>Data</th><th>Nota</th><th>Ações</th></tr></thead><tbody>{[...exams].reverse().map(e=><tr key={e.id}><td data-label="Simulado">{e.name}<small className="muted" style={{display:'block'}}>{e.banca || 'Banca não informada'} · {e.minutes} min</small></td><td data-label="Data">{e.date}</td><td data-label="Nota">{examScore(e).percent}%</td><td data-label="Ações"><div className="topic-actions"><button onClick={()=>{setDraft(structuredClone(e));setError('');}} style={secondaryBtnStyle}>Editar</button><button onClick={()=>{if(window.confirm(`Excluir o simulado ${e.name}?`))onRemove(e.id);}} style={secondaryBtnStyle}>Excluir</button></div></td></tr>)}</tbody></table></div>
    </Panel>
    {latest&&<Panel title={`Raio-X por matéria · ${latest.name}`}><div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Matéria</th><th>Acertos</th><th>Desempenho</th><th>Anterior</th></tr></thead><tbody>{latest.rows.map(r=>{const old=previous?.rows.find(x=>x.materiaId===r.materiaId);return <tr key={r.materiaId}><td data-label="Matéria">{r.materiaName}</td><td data-label="Acertos">{r.correct}/{r.total}</td><td data-label="Desempenho">{Math.round(r.correct/r.total*100)}%</td><td data-label="Anterior">{old?`${Math.round(old.correct/old.total*100)}%`:'—'}</td></tr>;})}</tbody></table></div></Panel>}
  </div>;
}
