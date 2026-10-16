import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {mkdtemp,mkdir,writeFile,readFile,stat,utimes,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='~/server/internal/account/shared')return {url:'fixture:paths',shortCircuit:true};
  if(specifier.startsWith('~/'))return next(pathToFileURL(resolve(project,specifier.slice(2))).href+'.ts',context);
  if(specifier.startsWith('.')&&!extname(specifier)&&context.parentURL?.includes('/server/'))return next(specifier+'.ts',context);
  return next(specifier,context);
 },
 load(url,context,next){if(url==='fixture:paths')return {format:'module',source:'export const getRuntimePaths=()=>globalThis.__revisionPaths;',shortCircuit:true};return next(url,context);}
});
test('actual Viewer Growth revision uses installed identity and invalidates same-stat catalog changes',{timeout:30000},async()=>{
 const root=await mkdtemp('/var/tmp/viewer-growth-revision-');
 try{
  assert.ok(process.env.TAIKO_PYTHON_EXECUTABLE?.startsWith('/var/tmp/'));
  await mkdir(resolve(root,'songs'));
  for(const name of ['song_data.json','song_alias.json','rating_structured_with_ids.json'])await writeFile(resolve(root,'songs',name),'[]');
  const persisted=resolve(root,'old-measurement.json');await writeFile(persisted,'{"revision":"legacy","value":42}');
  globalThis.__revisionPaths={repoRoot:root};
  const {getGrowthModelRevision}=await import('../server/services/growth-history/model-revision.ts');
  const first=await getGrowthModelRevision();assert.match(first,/^[a-f0-9]{64}$/);
  assert.equal(await getGrowthModelRevision(),first);
  const file=resolve(root,'songs/song_data.json'),before=await stat(file);
  await writeFile(file,'{}');await utimes(file,before.atime,before.mtime);
  const changed=await getGrowthModelRevision();assert.notEqual(changed,first);
  assert.equal(await readFile(persisted,'utf8'),'{"revision":"legacy","value":42}');
  console.log(JSON.stringify({consumer:'Viewer Growth revision',before:first,after:changed}));
 }finally{delete globalThis.__revisionPaths;await rm(root,{recursive:true,force:true});}
});
