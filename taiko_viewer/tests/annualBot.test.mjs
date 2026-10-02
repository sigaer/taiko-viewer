import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { build } from 'esbuild';

test('official identity resolves only its current real binding and never accepts a requested owner', async()=>{
 const root=await mkdtemp('/var/tmp/annual-bot-unit-');
 const stubs={
  '~/server/utils/account-db':`export const ensureAccountSchema=async()=>{};export const getAccountDb=()=>({execute:async(sql,args)=>{globalThis.botArgs=args;return [globalThis.botRows]}});`,
  '~/server/internal/account/shared':`export const getRuntimePaths=()=>({});`,
  './admission':`export const annualAdmission={};`,
  './isolated-worker':`export const spawnAnnualWorker=()=>{};export const stopAnnualWorker=()=>{};`,
  './policy':`export const assertAnnualTaskAllowed=()=>{};export const readAnnualPolicy=()=>{};`,
  './runtime':`export const atomicWriteFile=()=>{},atomicWriteJson=()=>{},getAnnualInputFingerprint=()=>{},readAnnualDiskState=()=>{},runAnnualSummaryCli=()=>{},withAnnualFileLock=()=>{};`,
  './bot-store':`export const botAnnualPaths=()=>{},readBotAnnualSummary=()=>{};`,
  './constants':`export const ANNUAL_SHARE_CARD_RENDERER_REVISION='test';export const getAnnualVersion=()=>({});`,
  './index':`export const createAccountAnnualShareCard=()=>{},getOwnerAnnualShareCardPath=()=>{},getReusableBotAnnualSummary=()=>{};`,
  './poster':`export const renderAnnualShareCard=()=>{};`,
  './ratings':`export const enrichAnnualRatingRank=()=>{};`,
 };
 try {
 await build({entryPoints:['server/services/account/annual-summary/bot.ts'],outfile:root+'/bot.mjs',bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'fakes',setup(b){b.onResolve({filter:/.*/},a=>stubs[a.path]?{path:a.path,namespace:'fake'}:undefined);b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:stubs[a.path]}));}}]});
 const m=await import(root+'/bot.mjs');
 globalThis.botRows=[{id:'12345',current_virtual:0}];
 assert.equal(await m.resolveBotAnnualBinding('qq_official:test'),'12345');assert.deepEqual(globalThis.botArgs,['qq_official:test']);
 await assert.rejects(m.resolveBotAnnualBinding('onebot_v11:12345'),e=>e.statusCode===403);
 await assert.rejects(m.resolveBotAnnualBinding('qq_official:../../12345'),e=>e.statusCode===403);
 globalThis.botRows=[];await assert.rejects(m.resolveBotAnnualBinding('qq_official:test'),e=>e.statusCode===400);
 globalThis.botRows=[{id:'12345',current_virtual:1}];await assert.rejects(m.resolveBotAnnualBinding('qq_official:test'),e=>e.statusCode===400);
 globalThis.botRows=[{id:'12345',current_virtual:0},{id:'54321',current_virtual:0}];await assert.rejects(m.resolveBotAnnualBinding('qq_official:test'),e=>e.statusCode===400);
 } finally {delete globalThis.botRows;delete globalThis.botArgs;await rm(root,{recursive:true,force:true});}
});
