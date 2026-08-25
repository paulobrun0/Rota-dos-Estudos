// Per-matéria breakdown for the active concurso: completion of the current
// edital plus how many "novo" vs "revisão" cards were checked off over time.
// The novo/revisão counts come from scanning every day ever planned
// (dailyPlans keeps history, it isn't pruned), not just the current cycle.
export function computeMateriaStats(concurso) {
  if (!concurso) return [];

  const completedByMateria = {};
  Object.values(concurso.dailyPlans || {}).forEach((plan) => {
    (plan || []).forEach((card) => {
      if (!card.feito) return;
      const bucket = completedByMateria[card.materiaId] || (completedByMateria[card.materiaId] = { novo: 0, revisao: 0 });
      bucket[card.tipo === "revisao" ? "revisao" : "novo"]++;
    });
  });

  return concurso.materias.map((m) => {
    const total = m.topics.length;
    const done = m.topics.filter((t) => t.status === "estudado").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const completed = completedByMateria[m.id] || { novo: 0, revisao: 0 };
    const questionsTotal = m.topics.reduce((sum, t) => sum + (t.questionsTotal || 0), 0);
    const questionsCorrect = m.topics.reduce((sum, t) => sum + (t.questionsCorrect || 0), 0);
    const accuracyPct = questionsTotal === 0 ? null : Math.round((questionsCorrect / questionsTotal) * 100);
    return {
      id: m.id,
      name: m.name,
      color: m.color,
      total,
      done,
      pct,
      novoCount: completed.novo,
      revisaoCount: completed.revisao,
      questionsTotal,
      questionsCorrect,
      accuracyPct,
    };
  });
}

// Per-topic accuracy, flattened across every matéria in the concurso and
// limited to topics that actually have questions logged. Sorted weakest
// first (then by how many questions back that number, as a tiebreaker) so
// the topics needing the most attention surface immediately instead of
// being buried inside a matéria-level average.
export function computeTopicStats(concurso) {
  if (!concurso) return [];

  const rows = [];
  concurso.materias.forEach((m) => {
    m.topics.forEach((t) => {
      const total = t.questionsTotal || 0;
      if (total === 0) return;
      const correct = t.questionsCorrect || 0;
      rows.push({
        id: t.id,
        name: t.name,
        materiaName: m.name,
        materiaColor: m.color,
        total,
        correct,
        accuracyPct: Math.round((correct / total) * 100),
      });
    });
  });

  return rows.sort((a, b) => a.accuracyPct - b.accuracyPct || b.total - a.total);
}
