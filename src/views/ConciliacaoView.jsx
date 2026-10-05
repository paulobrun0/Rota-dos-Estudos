import { weightedCoverage, conciliationForecast } from "../lib/conciliationForecast.js";
import { todayISO } from "../lib/date.js";
import React, { useMemo, useState } from 'react';
import { buildPracticeIndex, compareEditais, flattenEdital, sharedPractice } from '../lib/editalCompatibility.js';
import { Panel, Metric } from '../components/StudyPanels.jsx';
import { SharedPractice } from '../components/SharedPractice.jsx';
import { inputStyle, primaryBtnStyle, secondaryBtnStyle } from '../styles/shared.js';
export function ConciliacaoView({ concursos, activeConcursoId, onLink, onUnlink, onSkip, onUndo, practiceArchive = [], availableHours, onHours, onWeight, studyDays, onNavigate }) {
  const [leftId, setLeftId] = useState(activeConcursoId || concursos[0]?.id || '');
  const [rightId, setRightId] = useState(concursos.find(c => c.id !== leftId)?.id || '');
  const [leftTopic, setLeftTopic] = useState(''), [rightTopic, setRightTopic] = useState('');
  const [error, setError] = useState('');
  const index = useMemo(() => buildPracticeIndex(concursos, practiceArchive), [concursos, practiceArchive]);
  if (concursos.length < 2) return <Panel title="Conciliar editais"><p className="muted">Cadastre pelo menos dois concursos para comparar seus assuntos.</p></Panel>;
  const left = concursos.find(c => c.id === leftId), right = concursos.find(c => c.id === rightId);
  const comparison = left && right && leftId !== rightId ? compareEditais(left, right, index) : null;
  const forecast = comparison ? conciliationForecast(left, right, index, todayISO(), availableHours, studyDays) : null;
  const options = concursos.map(c => <option key={c.id} value={c.id}>{c.name}</option>);
  const topicOptions = c => flattenEdital(c).map(r => <option key={`${r.materiaId}:${r.topicId}`} value={JSON.stringify([r.materiaId, r.topicId])}>{r.materiaName} · {r.topic.name}</option>);
  function link(event) {
    event.preventDefault();
    if (!comparison || !leftTopic || !rightTopic) { setError('Selecione um assunto de cada edital.'); return; }
    const [lm, lt] = JSON.parse(leftTopic), [rm, rt] = JSON.parse(rightTopic);
    onLink({ concursoId: leftId, materiaId: lm, topicId: lt }, { concursoId: rightId, materiaId: rm, topicId: rt });
    setLeftTopic(''); setRightTopic(''); setError('');
  }
  function sharedTopic(row) { return { ...row.topic, crossStudy: sharedPractice(index, row.key, row.concursoId) }; }
  function controls(row) { const ref = { concursoId: row.concursoId, materiaId: row.materiaId, topicId: row.topicId }; return <><SharedPractice topic={sharedTopic(row)} onSkip={() => onSkip(ref)} onUndo={() => onUndo(ref)} />{row.topic.equivalenceKey && <button type="button" style={{ ...secondaryBtnStyle, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }} onClick={() => onUnlink(ref)}>Remover vínculo manual</button>}</>; }
  return <div>
    <Panel title="Conciliar editais" action={onNavigate && <button type="button" style={secondaryBtnStyle} onClick={() => onNavigate("integrado")}>Montar plano integrado</button>}><div className="form-grid"><label>Primeiro edital<select aria-label="Primeiro edital" value={leftId} onChange={e => { setLeftId(e.target.value); setLeftTopic(''); }} style={inputStyle}>{options}</select></label><label>Segundo edital<select aria-label="Segundo edital" value={rightId} onChange={e => { setRightId(e.target.value); setRightTopic(''); }} style={inputStyle}>{options}</select></label></div>
      <p className="muted">Comparamos assuntos distintos da mesma matéria, ignorando acentos, pontuação e numeração. Nomes diferentes podem ser vinculados abaixo. A coincidência de conteúdo não garante viabilidade de preparação: considere datas, banca, pesos e profundidade.</p>
      {!comparison && <p role="alert">Escolha dois editais diferentes.</p>}
    </Panel>
    {comparison && <>
      <div className="study-metrics"><Metric label="Assuntos em comum" value={comparison.common.length} /><Metric label={`Cobertura de ${left.name}`} value={`${comparison.leftPercent}%`} hint={`${comparison.common.length}/${comparison.leftTotal} assuntos distintos`} /><Metric label={`Cobertura de ${right.name}`} value={`${comparison.rightPercent}%`} hint={`${comparison.common.length}/${comparison.rightTotal} assuntos distintos`} /><Metric label="Sobreposição global" value={`${comparison.overlapPercent}%`} hint="Em comum ÷ união dos dois editais" /></div>
      <Panel title="Pesos e carga de preparação">
        <div className="form-grid"><label>Horas disponíveis por semana (total para os dois editais)<input aria-label="Horas disponíveis por semana" type="number" min="0.5" max="168" step="0.5" value={availableHours ?? ''} onChange={e => { const n = Number(e.target.value); if (!e.target.value || (n > 0 && n <= 168)) onHours?.(e.target.value ? n : null); }} style={inputStyle} /></label><div><strong>{forecast.pending} assuntos pendentes distintos · {(forecast.minutes / 60).toFixed(1)}h estimadas</strong><p className="muted">{forecast.deadline ? `Até a primeira prova: ${forecast.deadline}. ` : 'Defina as datas das provas em Concursos. '}{forecast.days !== null && forecast.days <= 0 ? 'Prazo encerrado; atualize as datas para projetar a carga.' : forecast.fits === null ? 'Informe as horas disponíveis para comparar a carga.' : forecast.fits ? 'A carga inicial cabe no tempo informado.' : 'A carga inicial supera o tempo disponível.'}{forecast.requiredHoursPerWeek !== null && ` Mínimo estimado: ${forecast.requiredHoursPerWeek}h/semana.`}</p></div></div>
        <p className="muted">Estimativa conservadora: conteúdo pendente dos dois editais antes da primeira prova, sem duplicar assuntos comuns. Usa minutos por matéria ÷ assuntos por dia. Reserve tempo extra para questões, revisões e imprevistos; não é garantia de preparação.</p>
        <div className="study-metrics"><Metric label={`Cobertura ponderada de ${left.name}`} value={`${weightedCoverage(left, comparison.common, index)}%`} hint="Soma dos pesos dos assuntos comuns ÷ total de pesos" /><Metric label={`Cobertura ponderada de ${right.name}`} value={`${weightedCoverage(right, comparison.common, index)}%`} /></div>
        <details><summary>Ajustar importância das matérias</summary><p className="muted">Peso relativo por assunto, de 0,1 a 100. O padrão é 1; informe valores conforme o seu edital.</p><div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Edital</th><th>Matéria</th><th>Peso por assunto</th></tr></thead><tbody>{[left, right].flatMap(c => c.materias.map(m => <tr key={`${c.id}:${m.id}`}><td>{c.name}</td><td>{m.name}</td><td><input aria-label={`Peso de ${m.name} em ${c.name}`} type="number" min="0.1" max="100" step="0.1" defaultValue={m.weight || 1} key={m.weight || 1} onBlur={e => { const n = Number(e.target.value); if (n > 0 && n <= 100) onWeight?.(c.id, m.id, n); else e.target.value = m.weight || 1; }} style={{ ...inputStyle, width: '100%', minWidth: 0 }} /></td></tr>))}</tbody></table></div></details>
      </Panel>
      <Panel title="Assuntos em comum"><p className="muted">As questões abaixo somam registros dos assuntos equivalentes em todos os seus editais. Compartilhar a visualização não duplica registros, atividade ou acertos. Pular aproveita a etapa inicial e mantém revisões; você pode desfazer.</p>
        <div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Assunto</th><th>{left.name}</th><th>{right.name}</th><th>Questões compartilhadas</th></tr></thead><tbody>{comparison.common.map(r => { const practice = sharedPractice(index, r.key, leftId); return <tr key={r.key}><td>{r.left.materiaName}<strong style={{ display: 'block' }}>{r.left.topic.name}</strong>{r.left.topic.name !== r.right.topic.name && <small>{r.right.topic.name}</small>}</td><td>{r.left.topic.status}<details><summary>Prática e ações</summary>{controls(r.left)}</details></td><td>{r.right.topic.status}<details><summary>Prática e ações</summary>{controls(r.right)}</details></td><td>{practice.correct}/{practice.total}</td></tr>; })}</tbody></table></div>
        {!comparison.common.length && <p className="muted">Nenhuma equivalência identificada. Confira os nomes ou vincule assuntos manualmente.</p>}
      </Panel>
      <Panel title="Conteúdo exclusivo"><div className="form-grid">{[[left, comparison.leftOnly], [right, comparison.rightOnly]].map(([c, rows]) => <details key={c.id}><summary>{c.name} · {rows.length} assuntos exclusivos</summary><ul>{rows.map(r => <li key={r.key}>{r.materiaName} · {r.topic.name}</li>)}</ul></details>)}</div></Panel>
      <Panel title="Vincular nomes diferentes"><p className="muted">Confirme somente quando matéria e assunto representam o mesmo conteúdo. O vínculo reúne a prática do grupo inteiro, inclusive em outros editais.</p><form onSubmit={link} className="study-form"><div className="form-grid"><label>Assunto do primeiro edital<select aria-label="Assunto do primeiro edital" required value={leftTopic} onChange={e => setLeftTopic(e.target.value)} style={inputStyle}><option value="">Selecione</option>{topicOptions(left)}</select></label><label>Assunto do segundo edital<select aria-label="Assunto do segundo edital" required value={rightTopic} onChange={e => setRightTopic(e.target.value)} style={inputStyle}><option value="">Selecione</option>{topicOptions(right)}</select></label></div>{error && <p role="alert">{error}</p>}<button style={primaryBtnStyle}>Confirmar assuntos equivalentes</button></form></Panel>
    </>}
  </div>;
}
