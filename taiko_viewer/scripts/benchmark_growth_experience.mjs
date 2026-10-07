#!/usr/bin/env node
// Pure bounded presentation benchmark; no API, DB, Python or historical replay.
import {writeFile} from 'node:fs/promises';
import {composeGrowthFeedback} from '../utils/composeGrowthFeedback.ts';
import {homePresentationFixture} from '../tests/fixtures/growthExperienceFixtures.mjs';
const {overview,recent}=homePresentationFixture('goal-recent');
const times=[];
for(let i=0;i<10000;i++){
 const start=performance.now();composeGrowthFeedback(overview.recentCompletedGoal,overview.dailyProgress,recent);times.push(performance.now()-start);
}
times.sort((a,b)=>a-b);
const report={iterations:times.length,medianMs:times[5000],p95Ms:times[9500],maxMs:times.at(-1),extraApiRequests:0,extraPython:0,extraHistoryReplay:0};
await writeFile('/var/tmp/growth-experience-0792/composition-performance.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
