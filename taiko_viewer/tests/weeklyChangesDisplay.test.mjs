import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {build} from 'esbuild';
import {parse,compileScript,compileStyle} from '@vue/compiler-sfc';
import {chromium} from 'playwright-core';
import {qaTempPrefix} from './fixtures/qaPaths.mjs';

const root=new URL('../',import.meta.url).pathname;

test('weekly expands every chart, retains supporting crowns and collapses accessibly', {timeout:60000}, async()=>{
  const directory=await mkdtemp(qaTempPrefix('weekly-changes-'));
  const styles=[];
  let browser;
  try {
    const bundle=await build({stdin:{resolveDir:root,contents:`
      import {createApp,h,computed} from 'vue';
      import {createI18n,useI18n} from 'vue-i18n';
      import Weekly from './components/rework/weekly/Highlights.vue';
      import Rank from './components/ds/Rank.vue';
      import Crown from './components/ds/Crown.vue';
      import Diff from './components/ds/Diff.vue';
      import zh from './locales/zh.json'; import ja from './locales/ja.json';
      import {buildWeeklyGrowthRecap} from './server/services/growth-weekly/composer.ts';
      globalThis.computed=computed;globalThis.useI18n=useI18n;
      globalThis.useLocalePath=()=>value=>typeof value==='string'?value:value.path;
      const seed=[['fc',0,1,1],['score-pb',900000,1000000,1],['rank-upgrade',6,7,1],
        ['df',1,2,2],['clear',-1,0,3],['combo-improved',300,400,4],['ng-reduced',10,5,5],['played',null,null,6]];
      const facts=seed.map(([type,before,after,songId],i)=>({id:'f'+i,factKey:'f'+i,type,before,after,delta:1,
        ownerId:'1',bindingId:'1',songId,difficultyType:4,title:'Song '+songId,goalId:null,goalType:null,
        evidence:{source:'score-history',sourceRevision:'r1',evidenceVersion:1},
        temporal:{attributedDay:'2026-11-22',occurredAt:null,observedAt:'2026-11-22T12:00:00Z',confirmedAt:null,precision:'day'}}));
      const weekly=buildWeeklyGrowthRecap({facts,measurements:[],coverage:{scoreHistoryState:'complete'}},
        {from:'2026-11-16',to:'2026-11-22',isCompleteWeek:false},null);
      let app;
      window.mountWeekly=(locale,items=weekly.changes)=>{
        app?.unmount();
        app=createApp({render:()=>h(Weekly,{items,change:h=>h.primaryType+' '+h.before+' → '+h.after})});
        app.use(createI18n({legacy:false,locale,messages:{zh,ja}}));
        for(const [name,component] of Object.entries({DsRank:Rank,DsCrown:Crown,DsDiff:Diff,
          DsCover:{render:()=>h('span',{class:'cover'})},
          NuxtLink:{props:['to'],setup:(p,{slots})=>()=>h('a',{href:p.to},slots.default?.())}})) app.component(name,component);
        app.mount('#app');
      };
    `},bundle:true,platform:'browser',format:'iife',write:false,alias:{'~':root},logLevel:'silent',
      define:{'process.env.NODE_ENV':'"production"',__VUE_OPTIONS_API__:'true',__VUE_PROD_DEVTOOLS__:'false',__VUE_PROD_HYDRATION_MISMATCH_DETAILS__:'false'},
      plugins:[{name:'vue',setup(b){b.onLoad({filter:/\.vue$/},async({path})=>{
        const {descriptor}=parse(await readFile(path,'utf8'));
        const id='weekly-'+styles.length;
        for(const style of descriptor.styles) styles.push(compileStyle({source:style.content,filename:path,id:'data-v-'+id,scoped:style.scoped}).code);
        return {loader:'ts',resolveDir:dirname(path),contents:compileScript(descriptor,{id,inlineTemplate:true}).content.replace('export default','const component =')+`\ncomponent.__scopeId='data-v-${id}';export default component;`};
      });}}]});
    await writeFile(resolve(directory,'weekly.js'),bundle.outputFiles[0].text);
    const tokens=(await Promise.all(['tokens','base','rework'].map(name=>readFile(resolve(root,`assets/css/ds/${name}.css`),'utf8')))).join('\n');
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
    const context=await browser.newContext();
    try {
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      try {
        await page.route(/\/icons\//,route=>route.fulfill({path:resolve(root,'public',new URL(route.request().url()).pathname.slice(1))}));
        await page.setContent(`<html class="viewer-rework"><head><base href="https://viewer.sakura-bot.cn/"><style>${tokens}\n${styles.join('\n')}\nbody{margin:16px}#app{max-width:752px}</style></head><body><main id="app"></main></body></html>`);
        await page.addScriptTag({path:resolve(directory,'weekly.js')});
        for(const locale of ['zh','ja']){
          await page.evaluate(locale=>window.mountWeekly(locale),locale);
          assert.equal(await page.locator('.weekly-highlight').count(),4);
          const toggle=page.locator('.wl-more');
          assert.match(await toggle.innerText(),/6/);
          assert.equal(await toggle.getAttribute('aria-expanded'),'false');
          await toggle.click();
          assert.equal(await page.locator('.weekly-highlight').count(),6);
          assert.equal(await toggle.getAttribute('aria-expanded'),'true');
          await page.waitForFunction(()=>[...document.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0));
          assert.equal(await page.locator('.wl-crown-change').count(),3);
          assert.equal(await page.locator('.ds-rank--upgrade').count(),1);
          assert.equal(await page.locator('.ds-diff').count(),6);
          assert.equal(await page.locator('.ds-crown__text,.ds-rank__name').count(),0);
          for(const width of [320,390,1440]){
            await page.setViewportSize({width,height:900});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
          }
          if(locale==='zh')await page.screenshot({path:resolve(process.env.QA_EVIDENCE_DIR,'weekly-all-changes.png'),fullPage:true});
          await toggle.click();
          assert.equal(await page.locator('.weekly-highlight').count(),4);
        }
        assert.deepEqual(errors,[]);
      }finally{await page.close();}
    }finally{await context.close();}
  }finally{if(browser)await browser.close();await rm(directory,{recursive:true,force:true});}
});
