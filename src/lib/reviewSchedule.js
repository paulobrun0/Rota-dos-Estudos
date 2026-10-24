import { addDaysISO } from './date.js';

export const REVIEW_INTERVALS_DAYS = [1, 7, 30];
export const REVIEW_SCHEDULE_VERSION = 2;
const LEGACY_INTERVALS_DAYS = [1, 3, 7, 15, 30];

// reviewStep identifies the interval currently awaiting completion. Keep the
// saved due date and map to the last new interval no longer than the old one,
// so a pending 3-day/15-day review cannot skip the new 7-day/30-day stage.
export function migrateReviewSchedule(topic) {
  if (topic.reviewScheduleVersion >= REVIEW_SCHEDULE_VERSION) return;
  if (topic.reviewStep !== undefined) {
    const oldDays = LEGACY_INTERVALS_DAYS[topic.reviewStep];
    topic.reviewStep = oldDays === undefined ? (topic.nextReviewDate === null ? REVIEW_INTERVALS_DAYS.length : REVIEW_INTERVALS_DAYS.length - 1)
      : REVIEW_INTERVALS_DAYS.findLastIndex(days => days <= oldDays);
  }
  topic.reviewScheduleVersion = REVIEW_SCHEDULE_VERSION;
}

function weakSession(session) {
  return session && Number.isSafeInteger(session.total) && session.total > 0
    && Number.isSafeInteger(session.correct) && session.correct >= 0
    && session.correct <= session.total && session.correct / session.total < 0.7;
}

export function scheduleFirstReview(topic, today) {
  topic.reviewScheduleVersion = REVIEW_SCHEDULE_VERSION;
  topic.reviewStep = 0;
  topic.nextReviewDate = addDaysISO(today, REVIEW_INTERVALS_DAYS[0]);
}

// Only an actual completion advances the cycle; missed days keep their due
// date. Session accuracy, rather than historical accuracy, controls retries.
export function advanceReview(topic, today, session = null) {
  migrateReviewSchedule(topic);
  if (weakSession(session)) return scheduleFirstReview(topic, today);
  const nextStep = Math.min((topic.reviewStep ?? 0) + 1, REVIEW_INTERVALS_DAYS.length);
  topic.reviewStep = nextStep;
  topic.nextReviewDate = nextStep < REVIEW_INTERVALS_DAYS.length
    ? addDaysISO(today, REVIEW_INTERVALS_DAYS[nextStep]) : null;
}

// A notebook practice entry does not complete a task or advance its stage.
export function rescheduleReviewPractice(topic, today, session) {
  migrateReviewSchedule(topic);
  if (weakSession(session)) return scheduleFirstReview(topic, today);
  const days = REVIEW_INTERVALS_DAYS[topic.reviewStep ?? 0];
  if (days !== undefined) topic.nextReviewDate = addDaysISO(today, days);
}
