import test from 'node:test';
import assert from 'node:assert/strict';
import { goalBaseline } from '../utils/playerGoal.ts';
import { deriveDailyProgress } from '../utils/dailyProgress.ts';
test('marker alone prevents date attribution, even without an import source label',()=>{
 const before={song_no:1,level:4,high_score:900000,update_datetime:'2026-11-23 12:00:00',highscore_datetime:'2026-11-23 12:00:00'};
 const after={...before,high_score:990000,update_datetime:'2765-01-01 00:00:00',highscore_datetime:'2765-01-01 00:00:00'};
 const baseline=goalBaseline(after,'revision','2026-11-24T00:00:00Z');
 assert.equal(baseline.highScore,990000);assert.equal(baseline.highscoreDatetime,null);assert.equal(baseline.updateDatetime,null);
 for(const day of ['2026-11-24','2765-01-01']){
  const result=deriveDailyProgress([after],[{full:true,timestamp:'2026-11-24 00:00:00',songs:[before]},{full:false,timestamp:'2026-11-24 12:00:00',source:'wahlap',songs:[after]}],day,()=> 'Song');
  assert.equal(result.events.length,0);assert.notEqual(result.attendance,'played');
 }
});
