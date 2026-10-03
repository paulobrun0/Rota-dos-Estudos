import React, { useState } from 'react';
import { reviewRows } from '../lib/studyInsights.js';
import { Panel, Metric } from '../components/StudyPanels.jsx';
import { inputStyle, secondaryBtnStyle } from '../styles/shared.js';
import { todayISO } from '../lib/date.js';
export function RevisoesView({ concurso, addTopicToToday, onNavigate }) {
  const [filter, setFilter] = useState('due');
  const [query, setQuery] = useState('');
  const all = reviewRows(concurso);
  const rows = all.filter(r => (filter==='all' || filter==='due' && r.due || filter==='weak' && r.weak || filter==='future' && r.nextReviewDate > todayISO()) && `${r.name} ${r.materiaName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div><div className="study-metrics"><Metric label="Previstas ou vencidas" value={all.filter(r=>r.due).length} /><Metric label="Abaixo de 70%" value={all.filter(r=>r.weak).length} /><Metric label="Na agenda futura" value={all.filter(r=>r.nextReviewDate > todayISO()).length} /></div><Panel title="Sua fila de revisão" action={<button onClick={()=>onNavigate('dia')} style={secondaryBtnStyle}>Abrir hoje</button>}>
    <div className="filter-bar"><input aria-label="Buscar revisão" placeholder="Buscar matéria ou assunto" value={query} onChange={e=>setQuery(e.target.value)} style={inputStyle}/><select aria-label="Filtrar revisões" value={filter} onChange={e=>setFilter(e.target.value)} style={inputStyle}><option value="due">Previstas ou vencidas</option><option value="weak">Baixo desempenho</option><option value="future">Futuras</option><option value="all">Todas</option></select></div>
    <p className="muted">A fila prioriza datas previstas e depois assuntos abaixo de 70% de acertos. Adicionar ao plano não conclui a revisão: faça a atividade em Hoje.</p>
    <div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Assunto</th><th>Revisão</th><th>Acertos</th><th>Ação</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.materiaId}-${r.id}`}><td data-label="Assunto">{r.name}<small className="muted" style={{display:'block'}}>{r.materiaName}</small></td><td data-label="Revisão">{r.nextReviewDate || 'Sem data'}</td><td data-label="Acertos">{r.accuracy===null?'Sem questões':`${r.accuracy}%`}</td><td data-label="Ação"><button disabled={r.planned} onClick={()=>addTopicToToday(r.materiaId,r.id)} style={secondaryBtnStyle}>{r.completedToday?'Feita hoje':r.planned?'No plano de hoje':'Revisar hoje'}</button></td></tr>)}</tbody></table></div>{!rows.length&&<p className="muted">Nenhum assunto neste filtro.</p>}
  </Panel></div>;
}
