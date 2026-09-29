import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';
const source = await readFile(new URL('../server/utils/account/auth.ts', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('export const getAccountUserFromEvent ='), source.indexOf('export const requireAccountUser ='));
const { code } = await transform(body.replace('export const ', 'globalThis.resolveUser = '), { loader: 'ts' });
function runtime(token, ensure, execute) {
 const context = vm.createContext({readSessionTokenFromEvent:()=>token, ensureAccountSchema:ensure,getAccountDb:()=>({execute}), deleteCookie:()=>{}, SESSION_COOKIE_NAME:'stv_session'});
 vm.runInContext(code,context);return context.resolveUser;
}
test('anonymous requests never initialize the database (including prerender)', async()=> {
 let calls=0;const resolve=runtime(null,async()=>{calls++;throw Error('DB unavailable')});
 assert.equal(await resolve({}),null);assert.equal(calls,0);
});
test('authenticated requests keep database failures visible', async()=> {
 const resolve=runtime('session',async()=>{throw Error('DB unavailable')});
 await assert.rejects(resolve({}),/DB unavailable/);
});
test('valid sessions retain lookup and last-seen update; expired sessions stay anonymous', async()=> {
 const queries=[]; const row={id:42};
 const resolve=runtime('session',async()=>{},async(sql)=>{queries.push(sql);return sql.startsWith('SELECT')?[[row]]:[{}]});
 assert.equal(await resolve({}),row);assert.equal(queries.length,2);
 const expired=runtime('expired',async()=>{},async()=>[[]]);assert.equal(await expired({}),null);
});
