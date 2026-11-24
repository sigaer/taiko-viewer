import test from 'node:test';
import assert from 'node:assert/strict';
import { measurementAttempt } from '../server/services/growth-history/measurement-attempt.ts';
const trace={userId:1,bindingId:2,scoreRevision:'known-score-revision',capturedAt:'2026-11-24T00:00:00Z',catalogRevision:'catalog',policyVersion:'wahlap-cn-1',sampleCount:0};
test('reader rejection never invokes writer and retains exact trace',async()=>{
  let writes=0;const events:any[]=[];
  await measurementAttempt(trace,async()=>{throw Error('Invalid daily ability point');},async()=>{writes++;return {created:true};},event=>events.push(event));
  assert.equal(writes,0);assert.equal(events[0].outcome,'reader-rejection');assert.equal(events[0].writerExecuted,false);
  assert.equal(events[0].scoreRevision,trace.scoreRevision);assert.equal(events[0].retry,false);
});
test('archive hit, writer preparation failure, persistence failure and success remain distinct',async()=>{
  const events:any[]=[];const log=(event:any)=>events.push(event);
  await measurementAttempt(trace,async()=>[{}],async()=>{throw Error('must not execute');},log);
  await measurementAttempt(trace,async()=>[],async()=>{throw Error('model unavailable');},log);
  await measurementAttempt(trace,async()=>[],async begin=>{begin('model');throw Error('synthetic DB failure');},log);
  await measurementAttempt(trace,async()=>[],async begin=>{begin('model');return {created:true};},log);
  assert.deepEqual(events.map(row=>row.outcome),['existing-archive','writer-not-executed','persistence-failure','created']);
  assert.deepEqual(events.map(row=>row.writerExecuted),[false,false,true,true]);
  assert.equal(events[3].modelRevision,'model');
});
