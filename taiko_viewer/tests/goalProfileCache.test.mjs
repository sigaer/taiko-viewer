import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
test('successful binding mutations invalidate Home identity; Goal writes do not add a resolver waterfall',async()=>{
 const state={value:7};let reject=false;
 globalThis.useI18n=()=>({locale:{value:'zh'}});
 globalThis.useState=(key)=>{assert.equal(key,'home-state-resolved-user-id');return state};
 globalThis.$fetch=async()=>{if(reject)throw Error('failed');return {ok:true}};
 try{
 const source=await readFile(new URL('../composables/useViewerApiFetch.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {useViewerApiFetch}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const fetch=useViewerApiFetch();
 await fetch('/api/account/growth/goal',{method:'POST'});assert.equal(state.value,7);
 await fetch('/api/account/bindings');assert.equal(state.value,7);
 for(const path of ['/api/account/bindings/current','/api/account/bindings/remove','/api/account/manual','/api/account/qq/confirm']){
 state.value=7;await fetch(path,{method:'POST'});assert.equal(state.value,null);
 }
 state.value=7;reject=true;await assert.rejects(fetch('/api/account/bindings/current',{method:'POST'}));assert.equal(state.value,7);
 }finally{delete globalThis.useI18n;delete globalThis.useState;delete globalThis.$fetch}
});
