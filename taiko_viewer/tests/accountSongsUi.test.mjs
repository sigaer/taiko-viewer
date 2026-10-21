import test from 'node:test';
import assert from 'node:assert/strict';
import {ref,reactive,watch,nextTick} from 'vue';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {component,mount} from './fixtures/batch2ComponentHarness.mjs';
const settle=async()=>{for(let i=0;i<12;i++)await nextTick();};
async function fixture(fn){
 const keys=['useState','useI18n','useLocalePath','useViewerApiFetch','useViewerSeo','definePageMeta','useAsyncData','useAccountRequestGuard','__batch2Messages'];const before=new Map(keys.map(k=>[k,globalThis[k]]));
 const states=new Map([['account-user',ref({id:1})],['account-binding-generation',ref(0)]]),pending=[],messages=[],emits=[];
 let confirmResolve,failRead=false,current={id:1,taikoId:'synthetic-A',isManual:false,source:'wahlap'};
 const row={songNo:1455,level:4,title:'Synthetic',titleJp:'Synthetic',highScore:980000,bestScoreRank:5,goodCnt:700,okCnt:7,ngCnt:1,poundCnt:25,stageCnt:12,clearCnt:10,fullComboCnt:3,dondafulComboCnt:0,comboCnt:700,isLocked:false};
 Object.assign(globalThis,{useState:(k,init)=>{if(!states.has(k))states.set(k,ref(init?.()));return states.get(k);},useI18n:()=>({t:k=>k,locale:ref('zh')}),useLocalePath:()=>x=>x,useViewerSeo:()=>{},definePageMeta:()=>{},__batch2Messages:{ElMessage:{success:m=>messages.push(['success',m]),error:m=>messages.push(['error',m])},ElMessageBox:{confirm:()=>new Promise(resolve=>{confirmResolve=resolve;})}}});
 globalThis.useViewerApiFetch=()=>async(path,options={})=>{
  if(options.method)return new Promise((resolve,reject)=>pending.push({path,options,resolve,reject}));
  if(path==='/api/account/bindings')return {bindings:[current],currentBinding:current};
  if(path==='/api/content/songs')return {songs:[{id:1455,song_name:'Synthetic',level_4:10}]};
  if(failRead)throw {statusCode:503,data:{message:'Synthetic scores failure'}};
  return {currentBinding:current,total:1,page:1,pageSize:25,items:[{...row}]};
 };
 globalThis.useAsyncData=async(key,load,opts)=>{
  const data=ref(opts.default()),error=ref(null),status=ref('idle');let request=0;
  const clear=()=>{request++;data.value=opts.default();error.value=null;status.value='idle';};
  const refresh=async()=>{const token=++request;status.value='pending';try{const value=await load();if(token===request){data.value=value;error.value=null;status.value='success';}}catch(e){if(token===request){error.value=e;status.value='error';}}};
  if(opts.watch)watch(opts.watch,()=>void refresh());
  await refresh();return {data,error,status,refresh,clear};
 };
 const raw=(await readFile(new URL('../composables/useAccountRequestGuard.ts',import.meta.url),'utf8')).replace('"vue"',JSON.stringify(new URL('../node_modules/vue/dist/vue.runtime.esm-bundler.js',import.meta.url).href));
 globalThis.useAccountRequestGuard=(await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))).useAccountRequestGuard;
 let app;
 try{await fn({mount:async(path,props)=>{app=await mount(await component(path),props);return app.model;},close:()=>{app?.close();app=null;},states,pending,messages,emits,row,confirm:()=>confirmResolve(),binding:b=>{current=b;},fail:value=>{failRead=value;}});}
 finally{app?.close();for(const [key,value] of before){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}
test('actual scores page preserves rows, handles lock failure/success and suppresses stale identity completion',async()=>fixture(async({mount,pending,messages,states})=>{
 const m=await mount('pages/account/songs.vue');assert.equal(m.rows.length,1);assert.equal(m.resultReady,true);
 let op=m.toggleLock(m.rows[0],true);await m.changeBinding(2);assert.equal(pending.length,1,'binding switch waits for the active lock operation');assert.equal(pending[0].path,'/api/account/songs/lock');pending.shift().reject({data:{statusMessage:'Synthetic lock failure'}});await op;assert.equal(m.rows[0].isLocked,false);assert.equal(messages.at(-1)[1],'Synthetic lock failure');
 op=m.toggleLock(m.rows[0],true);pending.shift().resolve({});await op;assert.equal(m.rows[0].isLocked,true);
 op=m.toggleLock(m.rows[0],false);const late=pending.shift();const count=messages.length;states.get('account-user').value=null;await settle();assert.equal(m.rows.length,0);assert.equal(m.editorVisible,false);
 late.resolve({});await op;assert.equal(messages.length,count);assert.equal(m.lockingKey,'');
}));
test('actual scores read failure is distinct from empty, retry recovers; manual delete confirmation cannot cross identities',async()=>fixture(async({mount,fail,binding,states,pending,confirm})=>{
 binding({id:2,taikoId:'synthetic-manual',isManual:true,source:'manual'});const m=await mount('pages/account/songs.vue');
 fail(true);await m.refreshSongs();await settle();assert.equal(m.rows.length,0);assert.match(m.readError,/Synthetic scores failure/);assert.equal(m.resultReady,false);
 fail(false);await m.retryRead();await settle();assert.equal(m.rows.length,1);assert.equal(m.readError,'');
 const op=m.deleteScore(m.rows[0]);states.get('account-binding-generation').value++;confirm();await op;assert.equal(pending.length,0,'stale confirmation must not issue delete');
}));
for(const [file,method] of [['AccountSongEditorDialog','submit'],['AccountScoreImportDialog','submit']])test('actual '+file+' preserves isolated success/error handlers and drops late binding callbacks',async()=>fixture(async({mount,row,pending,messages,states,emits})=>{
 const props=reactive(file==='AccountSongEditorDialog'?{modelValue:true,mode:'edit',initialSong:row,songCatalog:[],isManual:false}:{modelValue:true});props['onUpdate:modelValue']=v=>{emits.push(v);props.modelValue=v;};props.onSaved=()=>emits.push('saved');props.onImported=()=>emits.push('imported');
 const m=await mount('components/account/'+file+'.vue',props);
 if(file==='AccountScoreImportDialog')m.text=JSON.stringify({scoreInfo:[{song_no:1455,level:4,high_score:980000}]});
 let op=m[method]();assert.equal(pending.length,1);pending.shift().reject({data:{statusMessage:'Synthetic save failure'}});await op;assert.equal(messages.at(-1)[1],'Synthetic save failure');
 op=m[method]();pending.shift().resolve({created:1,updated:0});await op;assert.ok(messages.some(x=>x[0]==='success'));assert.ok(emits.includes(file==='AccountSongEditorDialog'?'saved':'imported'));
 props.modelValue=true;await settle();if(file==='AccountScoreImportDialog')m.text=JSON.stringify([{song_no:1455,level:4}]);
 op=m[method]();const late=pending.shift();assert.ok(late);const count=messages.length,events=emits.length;states.get('account-binding-generation').value++;late.resolve({created:1});await op;assert.equal(messages.length,count);assert.equal(emits.length,events);
}));
test('actual binding switch hides old results while pending, preserves old binding on failure, then refreshes the new source',async()=>fixture(async({mount,pending,binding,states})=>{
 const m=await mount('pages/account/songs.vue');m.openCreator();assert.equal(m.editorVisible,true);
 let op=m.changeBinding(2);assert.equal(m.rows.length,0);assert.equal(m.editorVisible,false);assert.equal(pending[0].path,'/api/account/bindings/current');pending.shift().reject({data:{statusMessage:'Synthetic binding failure'}});await op;assert.equal(m.currentBinding.id,1);assert.equal(m.rows.length,1);
 op=m.changeBinding(2);binding({id:2,taikoId:'synthetic-manual',isManual:true,source:'manual'});states.get('account-binding-generation').value++;pending.shift().resolve({});await op;await settle();assert.equal(m.currentBinding.id,2);assert.equal(m.resultReady,true);assert.match(m.sourceHint,/手动/);
}));
test('pending binding switch cannot leave another account busy or emit its completion',async()=>fixture(async({mount,pending,messages,states})=>{
 const m=await mount('pages/account/songs.vue');const op=m.changeBinding(2),late=pending.shift();states.get('account-user').value={id:2};await settle();assert.equal(m.switchingBinding,false);const count=messages.length;late.resolve({});await op;assert.equal(messages.length,count);assert.equal(m.switchingBinding,false);
}));
test('actual manual delete preserves confirmed identity payload and success/error feedback',async()=>fixture(async({mount,pending,messages,binding,confirm})=>{
 binding({id:2,taikoId:'synthetic-manual',isManual:true,source:'manual'});const m=await mount('pages/account/songs.vue');
 let op=m.deleteScore(m.rows[0]);confirm();await settle();assert.equal(pending[0].path,'/api/account/songs/delete');assert.deepEqual(pending[0].options.body,{taikoId:'synthetic-manual',songNo:1455,level:4,confirmed:true});pending.shift().resolve({});await op;assert.equal(messages.at(-1)[0],'success');
 op=m.deleteScore(m.rows[0]);confirm();await settle();pending.shift().reject({data:{statusMessage:'Synthetic delete failure'}});await op;assert.equal(messages.at(-1)[1],'Synthetic delete failure');assert.equal(m.rows.length,1);
}));
test('actual creator keeps catalog validation, source endpoint and score payload',async()=>fixture(async({mount,pending,messages})=>{
 const song={id:1455,song_name:'Synthetic',level_4:10};const m=await mount('components/account/AccountSongEditorDialog.vue',{modelValue:true,mode:'create',songCatalog:[song],isManual:false});
 await m.submit();assert.equal(pending.length,0);assert.equal(messages.at(-1)[0],'error');m.handleCatalogSelect({song});m.form.high_score=987654;await settle();const op=m.submit();assert.equal(pending[0].path,'/api/account/songs/create');assert.equal(pending[0].options.body.songNo,1455);assert.equal(pending[0].options.body.level,4);assert.equal(pending[0].options.body.values.high_score,987654);pending.shift().resolve({});await op;assert.equal(messages.at(-1)[0],'success');
}));
test('manual create/edit completes before its own real API generation broadcast, but rejects external identity changes',async()=>fixture(async({mount,pending,messages,states,emits})=>{
 const beforeFetch=globalThis.$fetch;
 const source=await readFile(new URL('../composables/useViewerApiFetch.ts',import.meta.url),'utf8');
 globalThis.useViewerApiFetch=(await import('data:text/javascript,'+encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText))).useViewerApiFetch;
 // Transport only: ofetch invokes onResponse after parsing, before resolving.
 globalThis.$fetch=(path,options)=>new Promise((resolve,reject)=>pending.push({path,options,reject,resolve:value=>{options.onResponse?.({response:{ok:true,_data:value}});resolve(value);}}));
 try{
  const song={id:1455,song_name:'Synthetic',level_4:10};const props=reactive({modelValue:true,mode:'edit',initialSong:{songNo:1455,level:4,highScore:980000},songCatalog:[song],isManual:true});
  props['onUpdate:modelValue']=value=>{props.modelValue=value;};props.onSaved=()=>emits.push('saved');
  const m=await mount('components/account/AccountSongEditorDialog.vue',props);
  for(const mode of ['edit','create']){
   props.mode=mode;props.modelValue=true;await settle();if(mode==='create')m.handleCatalogSelect({song});
   const generation=states.get('account-binding-generation').value,events=emits.length,op=m.submit();assert.equal(pending[0].path,'/api/account/manual');assert.equal(pending[0].options.body.action,'score-upsert');pending.shift().resolve({});await op;
   assert.equal(states.get('account-binding-generation').value,generation+1);assert.equal(emits.length,events+1);assert.equal(props.modelValue,false);assert.equal(m.saving,false);assert.equal(messages.at(-1)[0],'success');
  }
  props.mode='edit';props.modelValue=true;await settle();let op=m.submit(),late=pending.shift(),count=messages.length,events=emits.length;states.get('account-binding-generation').value++;late.resolve({});await op;assert.equal(messages.length,count);assert.equal(emits.length,events);
  props.modelValue=false;await settle();props.modelValue=true;await settle();const generation=states.get('account-binding-generation').value;op=m.submit();pending.shift().reject({data:{statusMessage:'Synthetic manual save failure'}});await op;assert.equal(states.get('account-binding-generation').value,generation);assert.equal(m.saving,false);assert.equal(messages.at(-1)[1],'Synthetic manual save failure');
 }finally{if(beforeFetch===undefined)delete globalThis.$fetch;else globalThis.$fetch=beforeFetch;}
}));
test('actual score navigation keeps each chart difficulty and uses the server custom flag',async()=>fixture(async({mount})=>{
 const m=await mount('pages/account/songs.vue');const row=m.rows[0];
 for(const level of [1,2,3,4,5])assert.deepEqual(m.scoreSongPath({...row,level,isCustom:false}),{path:'/songs/1455',query:{difficulty:level}});
 assert.equal(m.scoreSongPath({...row,isCustom:true}),null,'custom title must not offer a missing catalog destination');
}));
