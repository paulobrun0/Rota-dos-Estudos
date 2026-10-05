import React from 'react';
import { Panel } from './StudyPanels.jsx';
export function PracticeHistoryPanel({ rows = [] }) {
  if (!rows.length) return null;
  return <Panel title="Histórico preservado"><p className="muted">Excluir um edital, matéria ou assunto preserva sua prática para reaproveitar em novos editais. Os registros continuam no backup da conta.</p><details><summary>{rows.length} assuntos com registros preservados</summary><div className="topic-table-wrap"><table className="topic-table"><thead><tr><th>Matéria e assunto</th><th>Origem</th><th>Acertos / questões</th><th>Última prática</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.materiaName}<strong style={{display:'block'}}>{row.topic.name}</strong></td><td>{row.concursoName}</td><td>{row.topic.questionsCorrect || 0}/{row.topic.questionsTotal || 0}</td><td>{row.topic.lastPracticeDate || 'Não registrada'}</td></tr>)}</tbody></table></div></details></Panel>;
}
