import React, { useState } from 'react';
import { Panel, Metric } from '../components/StudyPanels.jsx';
import { todayISO } from '../lib/date.js';
import { inputStyle, primaryBtnStyle, secondaryBtnStyle } from '../styles/shared.js';
import { WEEKDAY_KEYS, weekdayKey } from '../lib/planner.js';

export function UnifiedPlanView({ data, onSettings, onHours, onGenerate, onComplete }) {
  const today = todayISO();
  const settings = data.unifiedSettings || { concursoIds: data.concursos.filter(c => c.stage !== 'completed' && (!c.examDate || c.examDate >= today)).map(c => c.id), minutesPerTopic: 30 };
  const plan = data.unifiedPlans?.[today];
  const [error, setError] = useState('');
  const [minutesDraft, setMinutesDraft] = useState(String(settings.minutesPerTopic));
  const [editingCard, setEditingCard] = useState(null);
  const [total, setTotal] = useState(''), [correct, setCorrect] = useState('');
  function attempt(action) { try { action(); setError(''); } catch (err) { setError(err.message); } }
  function select(id, checked) {
    const ids = checked ? [...new Set([...settings.concursoIds, id])] : settings.concursoIds.filter(value => value !== id);
    onSettings({ ...settings, concursoIds: ids });
  }
  function complete(event) {
    event.preventDefault();
    const questions = { total: total === '' ? 0 : Number(total), correct: correct === '' ? 0 : Number(correct) };
    attempt(() => { onComplete(editingCard, questions); setEditingCard(null); setTotal(''); setCorrect(''); });
  }
  const days = [...new Set(data.studyDays ?? WEEKDAY_KEYS)];
  const isStudyDay = days.includes(weekdayKey(today));
  const done = plan?.cards.filter(card => card.feito) || [];
  const minutes = plan?.cards.reduce((sum, card) => sum + card.minutes, 0) || 0;
  const chosenNames = plan?.concursoIds.map(id => data.concursos.find(c => c.id === id)?.name).filter(Boolean) || [];
  return <div>
    <Panel title="Um plano para seus editais">
      <p className="muted">Escolha os concursos que está preparando. Assuntos equivalentes entram uma vez e mostram quais editais atendem. As revisões vencidas vêm primeiro; peso, desempenho e proximidade da prova orientam a ordem. Pendências do último plano têm preferência dentro de cada categoria.</p>
      <div className="form-grid">{data.concursos.map(c => {
        const inactive = c.stage === 'completed' || (c.examDate && c.examDate < today);
        return <label key={c.id} style={{display:'flex',gap:8,alignItems:'center',overflowWrap:'anywhere'}}><input type="checkbox" aria-label={`Incluir ${c.name}`} checked={!inactive && settings.concursoIds.includes(c.id)} disabled={inactive} onChange={e => select(c.id, e.target.checked)} />{c.name}{inactive ? ' · encerrado' : ''}</label>;
      })}</div>
      <div className="form-grid" style={{marginTop:16}}>
        <label>Horas disponíveis por semana<input aria-label="Horas semanais do plano integrado" type="number" min="0.5" max="168" step="0.5" value={data.availableHoursPerWeek ?? ''} onChange={e => { const n = Number(e.target.value); if (!e.target.value || (n > 0 && n <= 168)) onHours(e.target.value ? n : null); }} style={inputStyle} /></label>
        <label>Minutos por assunto novo<input aria-label="Minutos por assunto do plano integrado" type="number" min="5" max="180" value={minutesDraft} onChange={e => setMinutesDraft(e.target.value)} onBlur={() => { const n = Number(minutesDraft); if (n >= 5 && n <= 180) onSettings({ ...settings, minutesPerTopic: n }); }} style={inputStyle} /></label>
      </div>
      <p className="muted">As horas são divididas pelos {days.length} dias de estudo configurados em Ajustes. Cada revisão reserva 3 minutos. O tempo é estimado; reserve horas adicionais para pausas e imprevistos.</p>
      {!isStudyDay && <p className="muted">Hoje é um dia de descanso no seu calendário. A geração mantém apenas estudos já concluídos.</p>}
      <button type="button" style={primaryBtnStyle} onClick={() => attempt(() => { onGenerate({ ...settings, minutesPerTopic: Number(minutesDraft) }); setEditingCard(null); })}>{plan ? 'Atualizar plano de hoje' : 'Gerar plano de hoje'}</button>
      <p className="muted">Atualizar recalcula os itens pendentes e preserva os concluídos. Trocar a seleção não altera o plano salvo até você atualizar.</p>
    </Panel>
    {error && <p role="alert">{error}</p>}
    {plan && <>
      <div className="study-metrics"><Metric label="Concluídos" value={`${done.length}/${plan.cards.length}`} /><Metric label="Tempo planejado" value={`${minutes} min`} hint={`Limite diário: ${plan.minutesBudget} min`} /><Metric label="Assuntos fora da carga de hoje" value={plan.remainingCandidates || 0} hint="Continuam pendentes para os próximos planos" /></div>
      <Panel title="Plano integrado de hoje"><p className="muted">{chosenNames.join(' · ') || 'Os concursos deste plano foram removidos.'}</p>
        <div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Matéria e assunto</th><th>Atende os editais</th><th>Etapa e prazo</th><th>Tempo</th><th>Ação</th></tr></thead><tbody>{plan.cards.map(card => <tr key={card.id}><td>{card.materiaName}<strong style={{display:'block'}}>{card.topicName}</strong></td><td>{card.concursoNames.join(' · ')}<small style={{display:'block'}}>{card.concursoNames.length > 1 ? 'Conteúdo comum' : 'Conteúdo exclusivo'}</small></td><td>{card.tipo === 'revisao' ? 'Revisão' : card.hasDueReview ? 'Novo e revisão' : 'Novo'}<small style={{display:'block'}}>{card.deadline ? `Prova: ${card.deadline}` : 'Data não informada'}</small></td><td>{card.minutes} min</td><td>{card.feito ? 'Concluído' : <button type="button" aria-label={`Concluir ${card.topicName}`} style={{...secondaryBtnStyle,minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}} onClick={() => { setEditingCard(card.id); setTotal(''); setCorrect(''); setError(''); }}>Concluir</button>}</td></tr>)}</tbody></table></div>
        {!plan.cards.length && <p className="muted">Nenhum item cabe na carga de hoje ou não há pendências elegíveis. Confira os dias de estudo, as horas e o tempo por assunto.</p>}
        {editingCard && <form onSubmit={complete} className="study-form"><h3>Registrar este estudo</h3><p className="muted">A conclusão aproveita a etapa nos assuntos equivalentes deste plano e mantém as revisões. Registre as questões apenas uma vez; os totais compartilhados aparecem nos outros editais. Deixe os campos vazios se não resolveu questões.</p><div className="form-grid"><label>Questões resolvidas<input aria-label="Questões do estudo integrado" type="number" min="0" step="1" value={total} onChange={e => setTotal(e.target.value)} style={inputStyle} /></label><label>Acertos<input aria-label="Acertos do estudo integrado" type="number" min="0" step="1" value={correct} onChange={e => setCorrect(e.target.value)} style={inputStyle} /></label></div><div className="topic-actions"><button style={primaryBtnStyle}>Salvar conclusão</button><button type="button" style={secondaryBtnStyle} onClick={() => setEditingCard(null)}>Cancelar</button></div></form>}
      </Panel>
    </>}
  </div>;
}
