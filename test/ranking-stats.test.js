import test from 'node:test';import assert from 'node:assert/strict';import {rankingStreak} from '../server/rankingStats.js';
test('public streak combines recorded study and questions, allows today pending, ignores future dates',()=>{
 const plan={activity:{'2026-10-10':2},questionActivity:{'2026-10-11':{total:10},'2026-10-13':{total:50}}};assert.equal(rankingStreak(plan,'2026-10-12'),2);plan.activity['2026-10-12']=1;assert.equal(rankingStreak(plan,'2026-10-12'),3);delete plan.activity['2026-10-10'];assert.equal(rankingStreak(plan,'2026-10-12'),2);assert.equal(rankingStreak({},'2026-10-12'),0);
});
