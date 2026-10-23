import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {loadRememberedAccountIdentifier as load,saveRememberedAccountIdentifier as save,removeLegacyAccountPassword as clean} from '../utils/rememberedAccountIdentifier.ts';
function storage(remember='1') {
 const items=new Map([['taiko-account-password',randomBytes(24).toString('hex')],['taiko-account-identifier','synthetic-account'],['taiko-account-remember',remember],['unrelated-setting','preserved']]);
 return {items,getItem:key=>{assert.notEqual(key,'taiko-account-password','legacy secret must never be read');return items.get(key)??null;},setItem:(key,value)=>{assert.notEqual(key,'taiko-account-password');items.set(key,value);},removeItem:key=>items.delete(key)};
}
test('upgrade retains opted-in account but removes legacy password without reading it',()=>{const s=storage();assert.deepEqual(load(s),{enabled:true,identifier:'synthetic-account'});assert.equal(s.items.has('taiko-account-password'),false);assert.equal(s.items.get('unrelated-setting'),'preserved');});
test('disabled preference never fills an orphaned identifier',()=>{assert.deepEqual(load(storage('0')),{enabled:false,identifier:''});});
test('save accepts only identifier and preference, preserving unrelated settings',()=>{const s=storage();save(s,'  synthetic-new  ',true);assert.deepEqual(load(s),{enabled:true,identifier:'synthetic-new'});assert.equal(s.items.size,3);});
test('opt out removes exactly credential keys and is idempotent',()=>{const s=storage();save(s,'',false);save(s,'',false);assert.deepEqual([...s.items],[['unrelated-setting','preserved']]);});
test('startup cleanup also covers an existing session and public first visit',async()=>{const s=storage();clean(s);clean(s);assert.equal(s.items.has('taiko-account-password'),false);assert.equal(s.items.get('taiko-account-identifier'),'synthetic-account');const plugin=await readFile(new URL('../plugins/account-credential-cleanup.client.ts',import.meta.url),'utf8');assert.match(plugin,/defineNuxtPlugin/);assert.match(plugin,/removeLegacyAccountPassword\(localStorage\)/);assert.doesNotMatch(plugin,/accountUser|isAuthenticated|clear\(/);});
test('login never hydrates or passes a password to remembered account storage',async()=>{const page=await readFile(new URL('../pages/account/login.vue',import.meta.url),'utf8');assert.doesNotMatch(page,/remembered\.password|saveRememberedCredentials/);assert.match(page,/saveRememberedIdentifier\(form.identifier, rememberIdentifier.value\)/);assert.match(page,/autocomplete="username"/);assert.match(page,/autocomplete="current-password"/);});
test('register never invokes custom credential storage and passwords use new-password',async()=>{const page=await readFile(new URL('../pages/account/register.vue',import.meta.url),'utf8');assert.doesNotMatch(page,/Remembered|localStorage|sessionStorage/);assert.equal((page.match(/autocomplete="new-password"/g)||[]).length,2);});
test('reset password uses browser password manager new-password semantics',async()=>{const page=await readFile(new URL('../pages/account/forgot-password.vue',import.meta.url),'utf8');assert.equal((page.match(/autocomplete="new-password"/g)||[]).length,2);assert.match(page,/type="email" autocomplete="email"/);assert.doesNotMatch(page,/autocomplete="username"/);});
