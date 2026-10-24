import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleFirstReview, advanceReview, REVIEW_INTERVALS_DAYS } from '../src/lib/planner.js';

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
    const topic = { reviewStep: 2, nextReviewDate: '2026-11-01' };
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
