// Scores organize attention, not mastery: weight multiplies the performance
// deficit and overdue days add urgency, capped at 30.
export function studyPriority(materia, topic, today) {
  const total = topic.crossStudy?.total ?? topic.questionsTotal ?? 0;
  const correct = topic.crossStudy?.correct ?? topic.questionsCorrect ?? 0;
  const accuracy = total ? Math.round(correct / total * 100) : null;
  const weight = materia.weight || 1;
  const overdue = topic.nextReviewDate && topic.nextReviewDate < today
    ? Math.floor((Date.parse(today) - Date.parse(topic.nextReviewDate)) / 86400000) : 0;
  const weakness = 100 - (accuracy ?? 70);
  const score = weakness * weight + Math.min(overdue, 30);
  const reasons = [overdue ? `${overdue} dias de atraso` : topic.nextReviewDate === today ? 'Revisão hoje' : '',
    accuracy !== null && accuracy < 70 ? `${accuracy}% de acertos` : '', weight > 1 ? `Peso ${weight}` : ''].filter(Boolean);
  return { score, accuracy, weight, overdue, reason: reasons.join(' · ') || 'Manter o ritmo' };
}
