import test from 'node:test';
import assert from 'node:assert/strict';
import { featureEnabled, optionalTabEnabled, setOptionalFeature, resetOptionalFeatures } from '../src/lib/optionalFeatures.js';
import { migrate } from '../src/data/model.js';
import { validatePlanData } from '../src/lib/planValidation.js';

function fixture() {
  return { concursos: [{ id: 'c', name: 'PM', materias: [{ id: 'm', name: 'Direito', topics: [{ id: 't', name: 'Atos', questionsTotal: 50, questionsCorrect: 35 }] }] }],
    activeConcursoId: 'c', studyPreferences: { dailyHours: { seg: 1 }, weeklyQuestionsGoal: 100 },
    activity: { '2026-10-24': 1 }, externalReviews: [{ id: 'r', concursoId: 'c', materiaId: 'm', topicId: 't', url: 'https://www.tecconcursos.com.br/questoes/1', note: 'Rever motivo', nextReviewDate: '2026-10-25', interval: 1, reviews: [] }] };
}

test('existing accounts start focused and core study, planning and review completion remain accessible', () => {
  const data = migrate(fixture());
  assert.equal(featureEnabled(data, 'ranking'), false);
  assert.equal(optionalTabEnabled(data, 'ranking'), false);
  assert.equal(optionalTabEnabled(data, 'pdf'), false);
  for (const tab of ['painel', 'edital', 'revisoes', 'desempenho', 'planejamento', 'ajustes', 'dia', 'concursos', 'perfil']) assert.equal(optionalTabEnabled(data, tab), true);
});

test('preferences survive validation, backup and reload; disabling and restoring extras preserves records', () => {
  const initial = fixture(), before = structuredClone(initial);
  const enabled = setOptionalFeature(initial, 'externalReviews', true);
  const restored = migrate(JSON.parse(JSON.stringify(enabled)));
  validatePlanData(restored);
  assert.equal(optionalTabEnabled(restored, 'revisaoexterna'), true);
  const disabled = setOptionalFeature(restored, 'externalReviews', false);
  assert.equal(optionalTabEnabled(disabled, 'revisaoexterna'), false);
  const reset = resetOptionalFeatures(setOptionalFeature(disabled, 'multiExam', true));
  assert.equal(optionalTabEnabled(reset, 'integrado'), false);
  assert.equal(optionalTabEnabled(reset, 'conciliar'), false);
  assert.deepEqual(reset.externalReviews, initial.externalReviews);
  assert.deepEqual(reset.activity, initial.activity);
  assert.deepEqual(reset.studyPreferences.dailyHours, initial.studyPreferences.dailyHours);
  assert.equal(reset.studyPreferences.weeklyQuestionsGoal, 100);
  assert.deepEqual(setOptionalFeature(reset, 'externalReviews', true).externalReviews, initial.externalReviews);
  assert.deepEqual(initial, before);
});

test('invalid feature settings are rejected before storage or import', () => {
  assert.throws(() => setOptionalFeature(fixture(), 'unknown', true));
  assert.throws(() => setOptionalFeature(fixture(), 'pdf', 'true'));
  for (const value of [[], null, { pdf: 'false' }, { pdf: 1 }]) {
    const data = fixture(); data.studyPreferences.optionalFeatures = value;
    assert.throws(() => validatePlanData(data));
  }
});
