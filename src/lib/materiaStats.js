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
    return {
      id: m.id,
      name: m.name,
      color: m.color,
      total,
      done,
      pct,
      novoCount: completed.novo,
      revisaoCount: completed.revisao,
    };
  });
}
