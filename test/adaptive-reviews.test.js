import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleFirstReview, advanceReview, REVIEW_INTERVALS_DAYS } from '../src/lib/planner.js';
import { buildCyclePlan } from '../src/lib/planner.js';
import { migrate } from '../src/data/model.js';
import { validatePlanData } from '../src/lib/planValidation.js';
import { completeLearningSession, learningQueue, learningForecast } from '../src/lib/learningTools.js';

describe('revisão espaçada adaptativa', () => {
  test('agenda 1, 7 e 30 dias e encerra após três revisões', () => {
    const topic = {};
    assert.deepEqual(REVIEW_INTERVALS_DAYS, [1, 7, 30]);
    scheduleFirstReview(topic, '2026-10-01');
    assert.equal(topic.nextReviewDate, '2026-10-02');
    advanceReview(topic, '2026-10-02', { total: 10, correct: 8 });
    assert.equal(topic.nextReviewDate, '2026-10-09');
    advanceReview(topic, '2026-10-09', { total: 10, correct: 9 });
    assert.equal(topic.nextReviewDate, '2026-11-08');
    advanceReview(topic, '2026-11-08', { total: 10, correct: 9 });
    assert.equal(topic.nextReviewDate, null);
  });
  test('abaixo de 70% reinicia a revisão no dia seguinte', () => {
    const topic = { reviewScheduleVersion: 2, reviewStep: 2, nextReviewDate: '2026-11-01' };
    advanceReview(topic, '2026-11-01', { total: 10, correct: 6 });
    assert.equal(topic.reviewStep, 0);
    assert.equal(topic.nextReviewDate, '2026-11-02');
  });
  test('70% exatos avança e não reinicia', () => {
    const topic = { reviewStep: 0 };
    advanceReview(topic, '2026-10-02', { total: 10, correct: 7 });
    assert.equal(topic.reviewStep, 1);
    assert.equal(topic.nextReviewDate, '2026-10-09');
  });
});

test('legacy stages migrate once without changing due dates, questions, history or completed schedules', () => {
  const topics = Array.from({ length: 6 }, (_, reviewStep) => ({
    id: `t${reviewStep}`, name: `Assunto ${reviewStep}`, status: 'estudado', reviewStep,
    nextReviewDate: reviewStep === 5 ? null : '2026-10-04',
    questionsTotal: 20, questionsCorrect: 15,
    history: [{ date: '2026-10-01', questionsTotal: 20, questionsCorrect: 15 }],
  }));
  for (const singleConcurso of [false, true]) {
    const materias = [{ id: 'm', name: 'Direito', topics: structuredClone(topics) }];
    const raw = singleConcurso ? { materias } : { concursos: [{ id: 'c', name: 'PM', materias }] };
    const saved = migrate(raw), migrated = saved.concursos[0].materias[0].topics;
    assert.deepEqual(migrated.map(t => t.reviewStep), [0, 0, 1, 1, 2, 3]);
    migrated.forEach((t, i) => {
      assert.equal(t.reviewScheduleVersion, 2);
      for (const key of ['nextReviewDate', 'questionsTotal', 'questionsCorrect', 'history', 'status']) assert.deepEqual(t[key], topics[i][key]);
    });
    validatePlanData(saved);
    assert.deepEqual(migrate(structuredClone(saved)), saved);
    for (const [i, days] of [7, 7, 30, 30, null, null].entries()) {
      advanceReview(migrated[i], '2026-10-10', { total: 10, correct: 8 });
      assert.equal(migrated[i].nextReviewDate, days === 7 ? '2026-10-17' : days === 30 ? '2026-11-09' : null);
    }
  }
});

test('missed reviews remain unique in the cycle and advance from the actual completion', () => {
  const topic = { id: 't', status: 'estudado' };
  scheduleFirstReview(topic, '2026-10-01');
  const materias = [{ id: 'm', topics: [topic] }];
  const settings = { topicsPerDay: 0, reviewsPerDay: 3 };
  let carried = [];
  for (const date of ['2026-10-02', '2026-10-03', '2026-10-10']) {
    carried = buildCyclePlan(materias, settings, null, carried, date).cards;
    assert.equal(carried.length, 1);
    assert.equal(carried[0].topicId, 't');
    assert.equal(topic.nextReviewDate, '2026-10-02');
    assert.equal(topic.reviewStep, 0);
  }
  advanceReview(topic, '2026-10-10', { total: 10, correct: 8 });
  assert.equal(topic.nextReviewDate, '2026-10-17');
});

test('dashboard sessions and forecasts share the cycle, retain missed work and use session accuracy', () => {
  const today = '2026-10-12', ref = { materiaId: 'm', topicId: 't' };
  const topic = { id: 't', name: 'Atos', status: 'pendente', questionsTotal: 100, questionsCorrect: 100 };
  const data = { concursos: [{ id: 'c', name: 'PM', materias: [{ id: 'm', name: 'Direito', topics: [topic] }], settings: { minutesPerMateria: 15 } }] };
  const first = completeLearningSession(data, 'c', ref, today, { total: 10, correct: 8 });
  assert.equal(first.concursos[0].materias[0].topics[0].nextReviewDate, '2026-10-13');
  const before = JSON.stringify(first);
  for (const date of ['2026-10-13', '2026-10-15']) assert.equal(learningQueue(first, 'c', date)[0].kind, 'review');
  assert.equal(JSON.stringify(first), before);
  const weak = completeLearningSession(first, 'c', ref, '2026-10-15', { total: 10, correct: 6 });
  assert.equal(weak.concursos[0].materias[0].topics[0].nextReviewDate, '2026-10-16');
  assert.equal(weak.concursos[0].materias[0].topics[0].reviewStep, 0);
  const next = completeLearningSession(weak, 'c', ref, '2026-10-16', { total: 10, correct: 7 });
  assert.equal(next.concursos[0].materias[0].topics[0].nextReviewDate, '2026-10-23');
  const forecast = learningForecast(first, 'c', '2026-10-15', '2026-10-22');
  assert.equal(forecast['2026-10-15'][0].kind, 'review');
  assert.equal(forecast['2026-10-16'].length, 0);
  assert.equal(forecast['2026-10-22'][0].kind, 'review');
  assert.equal(JSON.stringify(first), before);
  validatePlanData(next);
});
