import test from 'node:test';
import assert from 'node:assert/strict';
import { goalBaseline, goalOptions, goalTarget, goalChartAvailable } from '../utils/playerGoal.ts';
const score = { high_score: 998360, good_cnt: 400, ok_cnt: 20, ng_cnt: 8, combo_cnt: 120, clear_cnt: 0, full_combo_cnt: 0, dondaful_combo_cnt: 0, best_score_rank: 4, highscore_datetime: '2026-09-18 10:00:00' };
const baseline = (r = score) => goalBaseline(r, 'revision', '2026-09-19T00:00:00.000Z');
test('freezes authoritative numbers, timestamp and distinct causal capture', () => {
 const b=baseline(); assert.equal(b.highScore,998360); assert.equal(b.ngCnt,8); assert.equal(b.highscoreDatetime,'2026-09-18T02:00:00.000Z'); assert.equal(b.scoreObservedAt,null); assert.notEqual(b.capturedAt,b.highscoreDatetime); assert.equal(b.sourceRevision,'revision');
});
test('all six approved types available independently of recommendation dimension',()=>assert.deepEqual(goalOptions(baseline(),'wahlap'),['score-pb','ng-reduced','clear','fc','df','rank-upgrade']));
test('achieved crowns and maximum rank excluded',()=>assert.deepEqual(goalOptions(baseline({...score,full_combo_cnt:1,dondaful_combo_cnt:1,best_score_rank:8,ng_cnt:0}),'hiroba'),['score-pb']));
test('missing optional fields are unknown, not zero; types independent',()=>{
 const b=goalBaseline({high_score:0},'r','now'); assert.equal(b.ngCnt,null); assert.deepEqual(goalOptions(b,'hiroba'),['score-pb']); assert.deepEqual(goalOptions(goalBaseline({},'r','now'),'wahlap'),[]);
});
test('unplayed requires server-proven complete coverage and manual stays excluded',()=>{
 for(const c of ['partial','unknown'] as const) assert.deepEqual(goalOptions(goalBaseline(undefined,'r','now',c),'wahlap'),[]);
 const b=goalBaseline(undefined,'r','now','complete'); assert.equal(b.recordPresent,false);assert.equal(b.clearCnt,null);assert.deepEqual(goalOptions(b,'hiroba'),['played','clear']);assert.deepEqual(goalOptions(b,'manual'),[]);assert.deepEqual(goalOptions(baseline(),'manual'),[]);
});
test('invalid and unavailable charts excluded',()=>{
 assert.equal(goalChartAvailable(undefined,4),false);assert.equal(goalChartAvailable({shelf_status:1,level_4:9},4),false);assert.equal(goalChartAvailable({shelf_status:0,level_4:9},5),false);assert.equal(goalChartAvailable({level_4:9},4),true);assert.deepEqual(goalOptions(baseline(),'wahlap',false),[]);
});
test('targets use relative conditions, no arbitrary score target',()=>{
 assert.deepEqual(goalTarget('score-pb'),{comparison:'greater',field:'highScore'});assert.deepEqual(goalTarget('ng-reduced'),{comparison:'less',field:'ngCnt'});assert.deepEqual(goalTarget('played'),{comparison:'present',field:'recordPresent'});
});
