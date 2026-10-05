import { practiceEvidence } from "../lib/practiceHistory.js";
import { todayISO } from "../lib/date.js";
import React from 'react';
import { secondaryBtnStyle } from '../styles/shared.js';
const sharedButtonStyle = { ...secondaryBtnStyle, width: "100%", maxWidth: "100%", minWidth: 0, justifyContent: "center", overflowWrap: "anywhere" };
export function SharedPractice({ topic, onSkip, onUndo }) {
  const shared = topic.crossStudy;
  const evidence = practiceEvidence(shared, todayISO());
  if (!shared?.otherTotal && !topic.skippedFromShared) return null;
  return <div style={{ marginTop: 8, display: 'grid', gap: 5, fontSize: 11, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}>
    {shared?.otherTotal > 0 && <span title={shared.sources.join(', ')}>{shared.otherTotal} questões em outros editais · {Math.round(shared.otherCorrect / shared.otherTotal * 100)}% de acertos</span>}
    {shared?.otherTotal > 0 && <details className="practice-evidence"><summary>{evidence.label}</summary><span>Erros: {shared.otherTotal - shared.otherCorrect} · Última prática: {evidence.lastDate || 'não registrada'}. Origem: {shared.sources.join(', ')}. Este indicador não confirma domínio do assunto.</span></details>}
    {topic.skippedFromShared ? <><span>Etapa inicial aproveitada; revisões mantidas.</span>{onUndo && <button type="button" onClick={onUndo} style={sharedButtonStyle}>Voltar a estudar</button>}</> : topic.status === 'pendente' && shared?.otherTotal > 0 && onSkip && <button type="button" onClick={onSkip} style={sharedButtonStyle}>Pular assunto já praticado</button>}
  </div>;
}
