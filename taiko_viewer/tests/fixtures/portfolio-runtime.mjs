// Isolate all account/catalog/score IO. No production runtime configuration is imported.
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
export function installPortfolioRuntime(db,state){
 const root=new URL('../../',import.meta.url);globalThis.__portfolioFixture={db,state};
 const stub=new Map([
 ['server/utils/account-db.ts','export const getAccountDb=()=>globalThis.__portfolioFixture.db;'],
 ['server/internal/account/shared.ts',`export async function getCurrentBindingRow(userId){const [rows]=await globalThis.__portfolioFixture.db.execute('SELECT * FROM web_taiko_bindings WHERE user_id=? AND is_current=1',[userId]);return rows[0]||null;}`],
 ['server/services/content.ts','export const getSongCatalog=async()=>globalThis.__portfolioFixture.state.songs;'],
 ['server/services/content/catalogAuthority.ts','export const captureCatalogAuthority=async()=>({data:globalThis.__portfolioFixture.state.catalog,root:"/synthetic-catalog"});export const readCatalogPointerRevision=async()=>globalThis.__portfolioFixture.state.catalog.catalogRevision;'],
 ['server/services/goals/snapshot.ts','export const readGoalSnapshot=async()=>{globalThis.__portfolioFixture.state.scoreReads++;return structuredClone(globalThis.__portfolioFixture.state.snapshot);};'],
 ['server/services/taiko-domain/publication.ts','export const withDomainScoreRead=(_account,task)=>task();']
 ].map(([p,code])=>[new URL(p,root).href,code]));
 const hook=registerHooks({
 resolve(specifier,context,next){let url;if(specifier.startsWith('~/'))url=new URL(specifier.slice(2),root).href;else if(specifier.startsWith('.')&&context.parentURL?.startsWith(root.href)&&!context.parentURL.includes('/node_modules/'))url=new URL(specifier,context.parentURL).href;if(url){if(!/\.(ts|mjs|js|json)$/.test(url)&&(stub.has(url+'.ts')||existsSync(fileURLToPath(url+'.ts'))))url+='.ts';if(stub.has(url))return {url,shortCircuit:true};if(existsSync(fileURLToPath(url+'/index.ts')))url+='/index.ts';return next(url,context);}return next(specifier,context);},
 load(url,context,next){if(stub.has(url))return{format:'module',source:stub.get(url),shortCircuit:true};if(url.startsWith(root.href)&&url.endsWith('.ts'))return{format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}
 });return ()=>{hook.deregister();delete globalThis.__portfolioFixture;};
}
