import test from 'node:test';
import {runAnnualO1} from './annualO1Harness.mjs';
test('Annual O1 real queued cold task and authenticated cached GET smoke',{timeout:240000},()=>runAnnualO1());
