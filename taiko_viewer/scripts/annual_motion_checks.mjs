import assert from 'node:assert/strict';

export const measureFrames = (page, duration = 72000) => page.evaluate(async (duration) => {
      const intervals = [], longTasks = []; let last = 0, handle;
      const observer = new PerformanceObserver(list => list.getEntries().forEach(e => longTasks.push(e.duration)));
      observer.observe({ type: 'longtask' });
      const tick = now => { if(last) intervals.push(now-last);last=now;handle=requestAnimationFrame(tick); };
      handle=requestAnimationFrame(tick);
      await new Promise(r=>setTimeout(r,duration));
      cancelAnimationFrame(handle);observer.disconnect();intervals.sort((a,b)=>a-b);
      return { pixelRatio:document.querySelector('.annual-cover-background canvas')?.dataset.pixelRatio, p95:intervals[Math.floor(intervals.length*.95)], max:intervals.at(-1), count:intervals.length, longTasks:longTasks.slice(0,30) };
}, duration);

export const verifyMotion = async (page, output) => {
  const next = () => page.locator('.story-player__nav button').last().click();
  const previous = () => page.locator('.story-player__nav button').first().click();
  const active = () => page.locator('.story-player__slide[aria-hidden="false"]').getAttribute('data-page-key');
  await page.locator('.story-player__viewport').focus();
  await page.keyboard.press('Home'); await page.waitForTimeout(1500);
  await next(); await page.waitForTimeout(900);
  assert.equal(await active(), 'period');
  assert.equal(await page.locator('.period-overview-scene').count(), 1);
  await page.waitForSelector('[data-renderer="webgl"]', { timeout: 10000 });
  await page.evaluate(() => { window.qa.canvas = document.querySelector('.annual-cover-background canvas'); window.qa.particle = document.querySelector('.period-overview-scene__particles i'); });
  const identity = async () => assert.equal(await page.evaluate(() => window.qa.canvas === document.querySelector('.annual-cover-background canvas') && window.qa.particle === document.querySelector('.period-overview-scene__particles i')), true, 'pair must retain canvas and particles');
  const frames = [];
  await page.waitForTimeout(6000); // Let session-local resolution adaptation settle.
  for (const name of ['period', 'overview']) {
    // No screenshot or DOM sampling in the steady-state timing loop.
    const metrics = await measureFrames(page);
    frames.push({ name, pixelRatio: await page.locator('.annual-cover-background canvas').getAttribute('data-pixel-ratio'), ...metrics });
    await page.screenshot({path:`${output}/${name}-webgl.png`});
    if(name==='period'){await next();await page.waitForTimeout(1800);assert.equal(await active(),'overview');}
  }
  for(let i=0;i<10;i++){
    await previous();await page.waitForTimeout(1750);assert.equal(await active(),'period');await identity();
    await next();await page.waitForTimeout(1750);assert.equal(await active(),'overview');await identity();
  }
  // Ignore repeated navigation while the pair timeline owns the viewport.
  await previous();await next();await page.locator('.story-player__viewport').focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowDown');await page.waitForTimeout(1800);
  assert.equal(await active(),'period');await identity();
  for(const viewport of [{width:375,height:667},{width:844,height:390},{width:1280,height:800},{width:390,height:724},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(350);
    const size=await page.evaluate(()=>({stage:document.querySelector('.story-player').getBoundingClientRect().height,scene:document.querySelector('.period-overview-scene').getBoundingClientRect().height}));
    assert.ok(Math.abs(size.stage-size.scene)<1,'one stage height');
    await page.screenshot({path:`${output}/viewport-${viewport.width}x${viewport.height}.png`});
  }
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  assert.equal(await page.locator('.annual-cover-background').getAttribute('data-running'),'false');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow')));
  await page.waitForTimeout(100);await identity();
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  assert.equal(await page.locator('.annual-cover-background').getAttribute('data-renderer'),'static');
  await next();await page.waitForTimeout(100);assert.equal(await active(),'overview');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForSelector('[data-renderer="webgl"]');
  await page.evaluate(()=>document.querySelector('.annual-cover-background canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForSelector('[data-renderer="static"]');
  await previous();await page.waitForTimeout(1750);assert.equal(await active(),'period');
  // Repeated player lifetime: the old render listener and WebGL context must go.
  const lifetimes=[];
  for(let i=0;i<3;i++){
    await page.evaluate(()=>window.qa.visible.value=false);await page.waitForTimeout(100);
    assert.equal(await page.locator('.period-overview-scene').count(),0);
    lifetimes.push(await page.evaluate(()=>({listeners:window.qa.tickerListeners(),contexts:window.qa.liveContexts()})));
    await page.evaluate(()=>window.qa.visible.value=true);await page.waitForTimeout(900);
    assert.equal(await page.locator('.period-overview-scene').count(),1);
  }
  assert.ok(lifetimes.every(s=>s.listeners===lifetimes[0].listeners && s.contexts<=lifetimes[0].contexts),'resources must not accumulate across reports');
  await page.route('**/api/content/covers/*/texture', route=>route.fulfill({status:503,body:'unavailable'}));
  await page.evaluate(()=>window.qa.visible.value=false);await page.waitForTimeout(100);
  await page.evaluate(()=>window.qa.visible.value=true);await page.waitForTimeout(1500);
  assert.equal(await page.locator('.annual-cover-background').getAttribute('data-renderer'),'webgl');
  await page.evaluate(()=>{window.qa.visible.value=false;window.qa.getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:window.qa.getContext.call(this,type,...args)};});
  await page.waitForTimeout(100);await page.evaluate(()=>window.qa.visible.value=true);await page.waitForTimeout(1000);
  assert.equal(await page.locator('.annual-cover-background').getAttribute('data-renderer'),'static');
  await page.evaluate(()=>HTMLCanvasElement.prototype.getContext=window.qa.getContext);
  await page.evaluate(()=>{const s=window.qa.summary.value;for(const key of ['favoriteSong','obsessionSong','favoriteShift','keyword','ratingRank','weekdayActivity','calendarActivity','timeOfDay','lateNight','speedProfile','nearDondaful','challenge','pound','highScore'])s[key]=null;s.coverSongs=[];s.monthlyFavorites=[];s.milestones=[];s.summaryId='motion-empty';});
  await page.waitForTimeout(900);await next();await page.waitForTimeout(800);await next();await page.waitForTimeout(1800);
  assert.equal(await active(),'overview');
  await page.screenshot({path:`${output}/empty-overview.png`});
  return {frames,lifetimes};
};
