// Source-boundary verification for the first design supplement; run under run_qa.sh.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../../taiko_viewer/package.json',import.meta.url));
const postcss=require('postcss');
const base='e827d9cddf6fc12925ad189373f707563fe3e249';
const git=(...args)=>{try{return execFileSync('git',args,{encoding:'utf8',maxBuffer:4*1024*1024});}catch(error){throw new Error('git read failed: '+args[0]+' (status '+error.status+')');}};
const styles=text=>[...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const colorOnly=/^(?:color|background(?:-color|-image)?|fill|stroke|accent-color|caret-color|scrollbar-color|border(?:-(?:top|right|bottom|left))?-color|outline-color|text-decoration-color|stop-color)$/;
const colorValue=value=>value.replace(/rgba?\([^)]*\)|#[\da-f]{3,8}\b|\b(?:white|black|transparent)\b|var\(--(?:viewer|personal)-[\w-]+\)/gi,'COLOR');
function geometry(css){
 const values=[];
 postcss.parse(css).walkDecls(d=>{
  if(d.prop.startsWith('--')||colorOnly.test(d.prop))return;
  const parents=[];for(let p=d.parent;p&&p.type!=='root';p=p.parent)parents.unshift(p.type==='rule'?p.selector:`@${p.name} ${p.params}`);
  const value=/^(?:border(?:-(?:top|right|bottom|left))?|outline|box-shadow|text-shadow)$/.test(d.prop)?colorValue(d.value):d.value;
  values.push([parents.join(' / '),d.prop,value]);
 });return values;
}
const changed=[...new Set([...git('diff','--name-only',base).trim().split('\n'),...git('ls-files','--others','--exclude-standard').trim().split('\n')])].filter(Boolean);
const colorFiles=[];const hashes={};
for(const file of changed.filter(f=>f.startsWith('taiko_viewer/'))){
 const current=readFileSync(file,'utf8');hashes[file]=createHash('sha256').update(current).digest('hex');
 if(file.endsWith('/DailyProgress.vue'))continue;
 if(!file.endsWith('.vue')||/components\/home\/(?:PlayerGrowthSurface|HomeLatestSongs)\.vue$/.test(file))continue;
 const old=git('show',`${base}:${file}`);
 assert.equal(current.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,''),old.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,''),file+' modified script/template');
 assert.deepEqual(geometry(styles(current)),geometry(styles(old)),file+' modified geometry');colorFiles.push(file);
}
const tokenPath='taiko_viewer/assets/css/tokens.css';
const layout=/--viewer-(?:font[\w-]*|display-font|radius|space-[\w-]+|content-[\w-]+|page-gutter)\s*:[^;]+/g;
assert.deepEqual(readFileSync(tokenPath,'utf8').match(layout),git('show',`${base}:${tokenPath}`).match(layout));
assert.deepEqual(geometry(readFileSync('taiko_viewer/assets/css/main.css','utf8')),geometry(git('show',`${base}:taiko_viewer/assets/css/main.css`)));
for(const file of ['taiko_viewer/nuxt.config.ts','taiko_viewer/app.vue'])assert.ok(!/preview\/song-detail|__completion|__palette-controls|site-fixtures|completion-inputs/.test(readFileSync(file,'utf8')),file+' leaks local preview');
const lock=JSON.parse(readFileSync('taiko_viewer/package-lock.json','utf8'));const oldLock=JSON.parse(git('show',`${base}:taiko_viewer/package-lock.json`));
lock.version=oldLock.version;lock.packages[''].version=oldLock.packages[''].version;assert.ok(JSON.stringify(lock)===JSON.stringify(oldLock),'dependency lock changed');
assert.ok(!changed.some(f=>/^(?:taiko_viewer\/server\/|packages\/)/.test(f)),'backend/contract changed');
const result={pass:true,base,colorOnlyVueFiles:colorFiles,layoutTokensUnchanged:true,globalGeometryUnchanged:true,productionEntryUsesPreview:false,dependenciesUnchanged:true,backendAndContractUnchanged:true,sourceSha256:hashes};
const out=process.env.VIEWER_REVIEW_OUT||process.env.QA_EVIDENCE_DIR;assert.ok(out,'Use run_qa.sh with an evidence output directory');
writeFileSync(out+'/scope.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,colorOnlyVueFiles:colorFiles.length,sourceFiles:Object.keys(hashes).length}));
