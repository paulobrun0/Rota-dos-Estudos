import React from 'react';
import { Panel, Metric, ProgressBar } from '../components/StudyPanels.jsx';
import { concursoSummary, reviewRows, sortedExams, examScore } from '../lib/studyInsights.js';
import { todayISO } from '../lib/date.js';
import { secondaryBtnStyle, primaryBtnStyle } from '../styles/shared.js';
import { colors } from '../styles/colors.js';
export function DashboardView({ concurso, onNavigate }) {
  const summary = concursoSummary(concurso);
  const reviews = reviewRows(concurso);
  const exams = sortedExams(concurso);
  const latest = exams.at(-1);
  const index = Math.max(0, concurso.materias.findIndex(m => m.id === concurso.cycleCursor));
  const cycle = [...concurso.materias.slice(index), ...concurso.materias.slice(0, index)];
  const planned = concurso.dailyPlans?.[todayISO()] || [];
  return <div>
    <div className="study-metrics"><Metric label="Questões registradas" value={summary.questions} hint="Práticas e registros nos assuntos" /><Metric label="Taxa de acertos" value={summary.accuracy === null ? '—' : `${summary.accuracy}%`} /><Metric label="Cobertura do edital" value={`${summary.coverage}%`} hint={`${summary.done}/${summary.total} assuntos`} /><Metric label="Último simulado" value={latest ? `${examScore(latest).percent}%` : '—'} hint={latest?.name || 'Registre seu primeiro simulado'} /></div>
    <div className="dashboard-columns"><div>
      <Panel title={concurso.name} action={<button onClick={() => onNavigate('edital')} style={secondaryBtnStyle}>Abrir edital</button>}>
        <div className="dashboard-meta">{concurso.cargo || 'Cargo não informado'} · {concurso.banca || 'Banca não informada'} · {concurso.stage === 'completed' ? 'Concurso realizado' : concurso.stage === 'post' ? 'Pós-edital' : 'Pré-edital'}</div>
        <div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Matéria</th><th>Questões</th><th>Acertos</th><th>Progresso</th></tr></thead><tbody>{summary.rows.map(m => <tr key={m.id}><td data-label="Matéria">{m.name}</td><td data-label="Questões">{m.questionsTotal}</td><td data-label="Acertos">{m.accuracyPct === null ? '—' : `${m.accuracyPct}%`}</td><td data-label="Progresso"><ProgressBar value={m.pct} label={`${m.done}/${m.total} assuntos`} /></td></tr>)}</tbody></table></div>
        {!summary.rows.length && <p className="muted">Cadastre matérias ou importe um modelo para começar.</p>}
      </Panel>
      <Panel title="Onde concentrar a revisão" action={<button onClick={() => onNavigate('revisoes')} style={secondaryBtnStyle}>Ver revisões</button>}>
        {reviews.filter(r => r.due || r.weak).slice(0, 4).map(r => <div className="insight-row" key={`${r.materiaId}-${r.id}`}><div><strong>{r.name}</strong><small>{r.materiaName}</small></div><span className="topic-status" style={{color:r.due ? colors.red : colors.accent, background:colors.surface2}}>{r.due ? 'Revisão prevista' : `${r.accuracy}% de acertos`}</span></div>)}
        {!reviews.some(r => r.due || r.weak) && <p className="muted">Nenhuma revisão vencida ou assunto abaixo de 70% de acertos.</p>}
      </Panel>
    </div><aside>
      <Panel title={concurso.planMode === 'cronograma' ? 'Cronograma semanal' : 'Ciclo de estudos'} action={<button onClick={() => onNavigate('metas')} style={secondaryBtnStyle}>Editar</button>}>
        {concurso.planMode === 'cronograma' ? <p className="muted">Veja as matérias atribuídas a cada dia na tela Semana.</p> : cycle.map((m, i) => <div className="cycle-row" key={m.id}><span className="cycle-number">{String(i+1).padStart(2,'0')}</span><strong>{m.name}</strong><span>{concurso.settings?.minutesPerMateria || 0} min</span></div>)}
        {!cycle.length && <p className="muted">O ciclo aparecerá após cadastrar as matérias.</p>}
        <button onClick={() => onNavigate(concurso.planMode === 'cronograma' ? 'semana' : 'dia')} style={{...primaryBtnStyle,width:'100%',justifyContent:'center'}}>Continuar estudos</button>
      </Panel>
      <Panel title="Seu próximo passo"><p className="muted">{planned.filter(c=>!c.feito).length} atividades no plano de hoje · {reviews.filter(r=>r.due).length} revisões previstas</p><button onClick={()=>onNavigate('dia')} style={secondaryBtnStyle}>Abrir plano de hoje</button></Panel>
    </aside></div>
  </div>;
}
