import test from 'node:test';
import {runAnnualO1} from './annualO1Harness.mjs';
test('Annual O1 queued cold distinct synthetic user mid',{timeout:190000},()=>runAnnualO1({scale:'mid',warmRates:[],formalCold:true}));
