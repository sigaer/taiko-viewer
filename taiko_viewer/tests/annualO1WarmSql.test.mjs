import test from 'node:test';
import {runAnnualO1} from './annualO1Harness.mjs';
// Warm reports come from this run's real queue/installed generator, never a recreated legacy identity.
test('Annual O1 current cached GET 1/s then 3/s then 5/s',{timeout:580000},()=>runAnnualO1({formal:true,warmSamples:200}));
