import React, { useMemo, useState } from 'react';
import { buildPracticeIndex, compareEditais, flattenEdital, sharedPractice } from '../lib/editalCompatibility.js';
import { Panel, Metric } from '../components/StudyPanels.jsx';
import { SharedPractice } from '../components/SharedPractice.jsx';
import { inputStyle, primaryBtnStyle, secondaryBtnStyle } from '../styles/shared.js';
export function ConciliacaoView({ concursos, activeConcursoId, onLink, onUnlink, onSkip, onUndo }) {
  const [leftId, setLeftId] = useState(activeConcursoId || concursos[0]?.id || '');
  const [rightId, setRightId] = useState(concursos.find(c => c.id !== leftId)?.id || '');
  const [leftTopic, setLeftTopic] = useState(''), [rightTopic, setRightTopic] = useState('');
  const [error, setError] = useState('');
  const index = useMemo(() => buildPracticeIndex(concursos), [concursos]);
  if (concursos.length < 2) return <Panel title="Conciliar editais"><p className="muted">Cadastre pelo menos dois concursos para comparar seus assuntos.</p></Panel>;
  const left = concursos.find(c => c.id === leftId), right = concursos.find(c => c.id === rightId);
  const comparison = left && right && leftId !== rightId ? compareEditais(left, right, index) : null;
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
    <Panel title="Conciliar editais"><div className="form-grid"><label>Primeiro edital<select aria-label="Primeiro edital" value={leftId} onChange={e => { setLeftId(e.target.value); setLeftTopic(''); }} style={inputStyle}>{options}</select></label><label>Segundo edital<select aria-label="Segundo edital" value={rightId} onChange={e => { setRightId(e.target.value); setRightTopic(''); }} style={inputStyle}>{options}</select></label></div>
      <p className="muted">Comparamos assuntos distintos da mesma matéria, ignorando acentos, pontuação e numeração. Nomes diferentes podem ser vinculados abaixo. A coincidência de conteúdo não garante viabilidade de preparação: considere datas, banca, pesos e profundidade.</p>
      {!comparison && <p role="alert">Escolha dois editais diferentes.</p>}
    </Panel>
    {comparison && <>
      <div className="study-metrics"><Metric label="Assuntos em comum" value={comparison.common.length} /><Metric label={`Cobertura de ${left.name}`} value={`${comparison.leftPercent}%`} hint={`${comparison.common.length}/${comparison.leftTotal} assuntos distintos`} /><Metric label={`Cobertura de ${right.name}`} value={`${comparison.rightPercent}%`} hint={`${comparison.common.length}/${comparison.rightTotal} assuntos distintos`} /><Metric label="Sobreposição global" value={`${comparison.overlapPercent}%`} hint="Em comum ÷ união dos dois editais" /></div>
      <Panel title="Assuntos em comum"><p className="muted">As questões abaixo somam registros dos assuntos equivalentes em todos os seus editais. Compartilhar a visualização não duplica registros, atividade ou acertos. Pular aproveita a etapa inicial e mantém revisões; você pode desfazer.</p>
        <div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Assunto</th><th>{left.name}</th><th>{right.name}</th><th>Questões compartilhadas</th></tr></thead><tbody>{comparison.common.map(r => { const practice = sharedPractice(index, r.key, leftId); return <tr key={r.key}><td>{r.left.materiaName}<strong style={{ display: 'block' }}>{r.left.topic.name}</strong>{r.left.topic.name !== r.right.topic.name && <small>{r.right.topic.name}</small>}</td><td>{r.left.topic.status}{controls(r.left)}</td><td>{r.right.topic.status}{controls(r.right)}</td><td>{practice.correct}/{practice.total}</td></tr>; })}</tbody></table></div>
        {!comparison.common.length && <p className="muted">Nenhuma equivalência identificada. Confira os nomes ou vincule assuntos manualmente.</p>}
      </Panel>
      <Panel title="Conteúdo exclusivo"><div className="form-grid">{[[left, comparison.leftOnly], [right, comparison.rightOnly]].map(([c, rows]) => <details key={c.id}><summary>{c.name} · {rows.length} assuntos exclusivos</summary><ul>{rows.map(r => <li key={r.key}>{r.materiaName} · {r.topic.name}</li>)}</ul></details>)}</div></Panel>
      <Panel title="Vincular nomes diferentes"><p className="muted">Confirme somente quando matéria e assunto representam o mesmo conteúdo. O vínculo reúne a prática do grupo inteiro, inclusive em outros editais.</p><form onSubmit={link} className="study-form"><div className="form-grid"><label>Assunto do primeiro edital<select aria-label="Assunto do primeiro edital" required value={leftTopic} onChange={e => setLeftTopic(e.target.value)} style={inputStyle}><option value="">Selecione</option>{topicOptions(left)}</select></label><label>Assunto do segundo edital<select aria-label="Assunto do segundo edital" required value={rightTopic} onChange={e => setRightTopic(e.target.value)} style={inputStyle}><option value="">Selecione</option>{topicOptions(right)}</select></label></div>{error && <p role="alert">{error}</p>}<button style={primaryBtnStyle}>Confirmar assuntos equivalentes</button></form></Panel>
    </>}
  </div>;
}
