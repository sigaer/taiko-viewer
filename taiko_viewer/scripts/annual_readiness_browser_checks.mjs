import { writeFile } from 'node:fs/promises';

export async function measureAnnualPage(page, label) {
  return page.evaluate(label => {
      const slide = document.querySelector('.story-player__slide[aria-hidden="false"]');
      const visible = el => {
        for(let p=el;p;p=p.parentElement) { const s=getComputedStyle(p); if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.05||p.getAttribute('aria-hidden')==='true')return false; }
        return true;
      };
      const rect = r => ({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
      const issues=[], text=[], scrollable=[], intentionalEllipsis=[], intentionalMarquee=[];
      const canScrollIntoView=el=>{const sc=el.closest('.poster-scene');return sc&&sc.scrollHeight>sc.clientHeight&&getComputedStyle(sc).overflowY==='auto'};
      const walker=document.createTreeWalker(slide,NodeFilter.SHOW_TEXT);
      for(let n; n=walker.nextNode();) {
        const el=n.parentElement;
        if(!n.textContent.trim()||!visible(el)||el.closest('svg,script,style,[class*="__sr"]'))continue;
        // Moving community bubbles enter and leave their clipped viewport by design.
        // Keep them in evidence; stationary report text and controls remain checked.
        const bubble=el.closest('.annual-danmaku__bubble');
        if(bubble&&getComputedStyle(bubble).transform!=='none'&&getComputedStyle(bubble.parentElement).overflow==='hidden'){
          intentionalMarquee.push({text:n.textContent.trim().slice(0,100),...rect(bubble.getBoundingClientRect())});continue;
        }
        const style=getComputedStyle(el);
        if(el.hasAttribute('title')&&Number(style.webkitLineClamp)>0&&el.getAttribute('title')===el.textContent.trim()){intentionalEllipsis.push({text:el.textContent.trim(),lines:Number(style.webkitLineClamp)});continue;}
        const range=document.createRange();range.selectNodeContents(n);
        for(const r of range.getClientRects()) {
          if(!r.width||!r.height)continue;
          const item={text:n.textContent.trim().slice(0,100),...rect(r)};text.push(item);
          if(canScrollIntoView(el)&&(r.top<0||r.bottom>innerHeight)){scrollable.push(item);continue;}
          if(r.left < -2||r.right>innerWidth+2||r.top < -2||r.bottom>innerHeight+2)issues.push({type:'viewport',...item});
          for(let p=el;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();
            if((/(hidden|clip|auto|scroll)/.test(s.overflowY)&&(r.top<b.top-2||r.bottom>b.bottom+2))||(/(hidden|clip|auto|scroll)/.test(s.overflowX)&&(r.left<b.left-2||r.right>b.right+2))){issues.push({type:'ancestor-clip',ancestor:p.className,...item});break;}
          }
        }
      }
      const buttons=[...document.querySelectorAll('.story-player button')].filter(el=>visible(el)&&el.getBoundingClientRect().width>0).map(el=>{
        const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        const ok=r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1&&(hit===el||el.contains(hit));
        return {text:el.textContent.trim()||el.getAttribute('aria-label'),...rect(r),clickable:ok,scrollReachable:Boolean(canScrollIntoView(el))};
      });
      for(const b of buttons)if(!b.clickable&&!b.scrollReachable)issues.push({type:'button-obscured',...b});
      // Check independent weekday blocks, not the container alone.
      if(slide.dataset.pageKey==='weekday'){
        const content=slide.querySelector('.annual-weekday-forest-scene__content').getBoundingClientRect();
        if(Math.abs(content.width-Math.max(innerWidth,innerHeight*853/1844))>1)issues.push({type:'weekday-width-changed',width:content.width});
        const blocks=[...slide.querySelectorAll('.annual-weekday-forest-scene__header,.annual-weekday-forest-scene__row,.annual-weekday-forest-scene__summary')];
        for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++){const a=blocks[i].getBoundingClientRect(),b=blocks[j].getBoundingClientRect();if(Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>2)issues.push({type:'block-overlap',a:blocks[i].className,b:blocks[j].className});}
      }
      return {label,page:slide.dataset.pageKey,viewport:{width:innerWidth,height:innerHeight,visualHeight:visualViewport?.height},text,buttons,scrollable,intentionalEllipsis,intentionalMarquee,issues};
    },label);
}

// Runs inside the existing isolated StoryPlayer fixture harness, never an API server.
export async function verifyReadiness(page, output) {
  const results = [];
  const active = () => page.locator('.story-player__slide[aria-hidden="false"]').getAttribute('data-page-key');
  const go = async key => {
    const index = await page.locator('.story-player__slide').evaluateAll((els, key) => els.findIndex(el => el.dataset.pageKey === key), key);
    if (index < 0) throw Error(`Missing page ${key}`);
    await page.locator('.story-player__viewport').evaluate((el, index) => { el.scrollTo({top: el.clientHeight * index, behavior: 'instant'}); el.dispatchEvent(new Event('scroll')); }, index);
    await page.waitForTimeout(2100);
    if (await active() !== key) throw Error(`Navigation did not settle on ${key}`);
  };
  const measure = async label => {
    const value = await measureAnnualPage(page, label);
    await page.screenshot({path:`${output}/${label}.png`});
    results.push(value);
    if(value.page==='poster'){const save=page.locator('.poster-scene__actions>button').first();await save.scrollIntoViewIfNeeded();await save.click({trial:true,timeout:5000});await page.screenshot({path:`${output}/${label}-save-visible.png`});await page.locator('.poster-scene').evaluate(el=>el.scrollTo(0,0));}
    console.log(JSON.stringify({label,issues:value.issues}));
  };
  const keys=await page.locator('.story-player__slide').evaluateAll(els=>els.map(el=>el.dataset.pageKey));
  for(const key of keys){await go(key);await measure(`normal-390x844-${key}`);}
  if(process.env.ANNUAL_READINESS_ONLY){
    for(const size of [{width:375,height:567},{width:375,height:667},{width:320,height:568},{width:390,height:844}]){await page.setViewportSize(size);await go(process.env.ANNUAL_READINESS_ONLY);await measure(`final-${size.width}x${size.height}-${process.env.ANNUAL_READINESS_ONLY}`);}
    await writeFile(`${output}/readiness.json`,JSON.stringify({mode:'final-core-and-target',keys,results,realApi:false,realShare:false,realIPhone:false},null,2));return {cases:results.length,failures:results.filter(r=>r.issues.length).length};
  }
  for(const size of [{width:375,height:567},{width:375,height:667},{width:320,height:568},{width:390,height:844}]){
    await page.setViewportSize(size);
    for(const key of ['weekday','favorite','speedProfile','final','poster']){await go(key);await measure(`${size.width}x${size.height}-${key}`);}
    await go('weekday');await go('monthly');await go('weekday');await measure(`${size.width}x${size.height}-weekday-return`);
  }
  await page.setViewportSize({width:375,height:667});await go('weekday');
  await page.setViewportSize({width:375,height:567});await page.waitForTimeout(700);await measure('weekday-height-shrink');
  await page.setViewportSize({width:375,height:667});await page.waitForTimeout(700);await measure('weekday-height-restore');
  if(process.env.ANNUAL_READINESS_FOCUS==='1'){
    for(const width of [320,375]){
      await page.setViewportSize({width,height:567});
      for(const [name,counts] of Object.entries({balanced:[99,99,99,99,99,99,99],workday:[999,999,999,999,999,1,1]})){
        for(let variant=0;variant<2;variant++){
          await page.evaluate(({counts,variant})=>{window.qa.summary.value.summaryId='long-weekday-'+variant;window.qa.summary.value.weekdayActivity.counts=counts;},{counts,variant});
          await go('weekday');await measure(`long-${name}-${variant}-${width}x567`);
        }
      }
    }
  }
  if(process.env.ANNUAL_READINESS_FOCUS==='1'){await writeFile(`${output}/readiness.json`,JSON.stringify({mode:'focused-geometry',results,realApi:false,realShare:false,realIPhone:false},null,2));return {cases:results.length,failures:results.filter(r=>r.issues.length).length};}
  const variants=[];
  const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(window.qa.summary.value)));
  for(const variant of ['sparse','high']){
    await page.evaluate(({saved,variant})=>{const s=structuredClone(saved);s.summaryId='readiness-'+variant;s.user.nickname=variant==='high'?'很长的合成测试昵称用于检查完整文案与高数据量显示':'稀疏测试';
      if(variant==='sparse'){for(const k of ['favoriteSong','obsessionSong','favoriteShift','keyword','ratingRank','weekdayActivity','calendarActivity','timeOfDay','lateNight','speedProfile','nearDondaful','challenge','pound','highScore'])s[k]=null;s.coverSongs=[];s.monthlyFavorites=[];s.milestones=[];}
      else{s.overview.playCount=999999;s.overview.uniqueSongs=9999;s.weekdayActivity.counts=[99999,88888,77777,66666,55555,44444,33333];}
      window.qa.summary.value=s;
    },{saved,variant});
    await page.waitForTimeout(500);
    const variantKeys=await page.locator('.story-player__slide').evaluateAll(els=>els.map(el=>el.dataset.pageKey));
    for(const key of variantKeys){await go(key);await measure(`${variant}-${key}`);}
    variants.push({variant,keys:variantKeys});
  }
  await page.evaluate(saved=>window.qa.summary.value=saved,saved);await page.waitForTimeout(500);
  const lifetimes=[];
  await page.setViewportSize({width:390,height:844});
  for(let round=0;round<3;round++){
    console.log(`readiness replay ${round+1}/3`);
    for(const key of keys)await go(key);
    await page.evaluate(()=>window.qa.visible.value=false);await page.waitForTimeout(150);
    lifetimes.push(await page.evaluate(()=>({listeners:window.qa.tickerListeners(),contexts:window.qa.liveContexts(),heap:performance.memory?.usedJSHeapSize})));
    await page.evaluate(()=>window.qa.visible.value=true);await page.waitForTimeout(1500);
  }
  for(let i=0;i<30;i++)await page.locator('.story-player__nav button').nth(i%2).click({force:true});
  await page.waitForTimeout(2200);await go('poster');await measure('after-replay-rapid-poster');
  await writeFile(`${output}/readiness.json`,JSON.stringify({mode:'isolated-component-fixture',keys,variants,results,lifetimes,realApi:false,realShare:false,realIPhone:false},null,2));
  return {cases:results.length,failures:results.filter(r=>r.issues.length).length,lifetimes};
}
