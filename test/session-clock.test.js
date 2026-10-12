import test from 'node:test';
import assert from 'node:assert/strict';
import {clockSeconds,toggleClock,validClock} from '../src/lib/sessionClock.js';
test('clock resumes from timestamps, pauses without accumulating background time and keeps topic ownership',()=>{
 const ref={materiaId:'m',topicId:'t'};let clock=toggleClock(null,ref,10000);assert.equal(clockSeconds(clock,75000),65);const restored=JSON.parse(JSON.stringify(clock));assert.equal(clockSeconds(restored,80000),70);clock=toggleClock(restored,ref,80000);assert.equal(clockSeconds(clock,200000),70);clock=toggleClock(clock,ref,200000);assert.equal(clockSeconds(clock,210000),80);assert.equal(clockSeconds(toggleClock(clock,{...ref,topicId:'other'},210000),211000),1);assert.equal(validClock({elapsedMs:-1}),false);assert.equal(clockSeconds(clock,300000000),86400);
});
