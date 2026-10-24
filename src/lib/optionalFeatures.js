// Saved per account with the study plan. Missing settings mean the focused
// experience, including for existing accounts; no study records are removed.
export const OPTIONAL_FEATURES = [
  { id: 'calendar', name: 'Calendário', description: 'Projeção semanal e tela Semana.', tabs: ['semana'] },
  { id: 'goals', name: 'Metas', description: 'Meta semanal e configurações do plano individual.', tabs: ['metas'] },
  { id: 'alerts', name: 'Alertas detalhados', description: 'Uma tela separada para baixo desempenho e revisões pendentes.', tabs: ['alertas'] },
  { id: 'externalReviews', name: 'Caderno de questões para revisão', description: 'Guardar questões específicas e revisar em uma agenda separada.', tabs: ['revisaoexterna'] },
  { id: 'marks', name: 'Marcações', description: 'Trechos, notas e revisão de grifos.', tabs: ['marcacoes'] },
  { id: 'pdf', name: 'Leitor PDF', description: 'Ler arquivos e criar grifos na plataforma.', tabs: ['pdf'] },
  { id: 'notebooks', name: 'Catálogo de cadernos', description: 'Importação em lote, prática avulsa e banco próprio de questões.', tabs: ['avulsas', 'caderno'] },
  { id: 'simulations', name: 'Simulados', description: 'Registrar provas completas e comparar resultados.', tabs: ['simulados'] },
  { id: 'multiExam', name: 'Vários editais ao mesmo tempo', description: 'Conciliar editais e usar o plano integrado.', tabs: ['integrado', 'conciliar'] },
  { id: 'legacyPlan', name: 'Plano individual alternativo', description: 'Atalho para a rotina antiga e estatísticas adicionais.', tabs: ['dia', 'progresso'] },
  { id: 'ranking', name: 'Ranking', description: 'Comparar sua atividade com outros estudantes.', tabs: ['ranking'] },
  { id: 'tools', name: 'Ferramentas e extensão', description: 'Acessar a extensão e outras ferramentas de estudo.', tabs: ['ferramentas'] },
];

export const featureEnabled = (data, id) => data?.studyPreferences?.optionalFeatures?.[id] === true;

export function optionalTabEnabled(data, tab) {
  // The individual review screen also serves the essential review queue.
  if (tab === 'dia') return true;
  const feature = OPTIONAL_FEATURES.find(feature => feature.tabs.includes(tab));
  return !feature || featureEnabled(data, feature.id);
}

export function setOptionalFeature(data, id, enabled) {
  if (!OPTIONAL_FEATURES.some(feature => feature.id === id) || typeof enabled !== 'boolean') throw Error('Recurso inválido.');
  return { ...data, studyPreferences: { ...data.studyPreferences,
    optionalFeatures: { ...data.studyPreferences?.optionalFeatures, [id]: enabled } } };
}

export function resetOptionalFeatures(data) {
  return { ...data, studyPreferences: { ...data.studyPreferences, optionalFeatures: {} } };
}
