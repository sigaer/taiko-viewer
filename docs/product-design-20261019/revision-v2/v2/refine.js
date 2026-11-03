/* Presentation-only revision of the V1 DOM. The V1 data and action handlers stay in app.js. */
window.refineV2 = function ({model, s, title, a, button}) {
 const root = document.getElementById('content');
 root.className = 'v2-content v2-' + model.page;
 const q = (selector, parent=root) => parent.querySelector(selector);
 const all = (selector, parent=root) => [...parent.querySelectorAll(selector)];
 const make = (tag, className, text) => { const e=document.createElement(tag);e.className=className;if(text)e.textContent=text;return e; };
 const quietSurface = node => {if(node)node.classList.remove('surface');};
 const plainLabel = node => {if(node)node.className='v2-section-label';};

 // Songs: one full-width title group, a dominant chart workspace, a quiet reading rail.
 if (model.page === 'song') {
  root.dataset.layout='song-reading';
  q('.song-heading')?.classList.add('v2-song-header');
  const name=q('.song-heading h1'),fullName=name.textContent,versionAt=fullName.indexOf('(');
  if(versionAt>0){name.replaceChildren(document.createTextNode(fullName.slice(0,versionAt)),make('wbr',''),make('span','v2-song-version',fullName.slice(versionAt)));}
  q('[data-action="practice"]').textContent=s('打开练习播放器 ↗','練習プレイヤー ↗');
  const summary=q('.chart-summary');q('.status',summary)?.remove();
  q('.difficulty-tabs')?.classList.add('v2-difficulties');
  const layout=q('.detail-grid');layout.classList.add('v2-song-layout');
  const chart=q('.chart-panel'),column=make('div','v2-chart-column');
  chart.replaceWith(column);column.append(chart);
  const notes=make('div','v2-song-notes');
  all('details.disclosure',chart).forEach(x=>notes.append(x));column.append(notes);
  const side=q('.detail-side');side.classList.add('v2-song-aside');
  all(':scope > section',side).forEach(x=>{quietSurface(x);x.classList.add('v2-side-section');});
  const score=q('.detail-side h2');score.textContent=s('我的成绩','自分の成績');
  const goal=q('[data-action="goal"]',side);
  if(goal){goal.classList.remove('primary');goal.classList.add('secondary');}
  const discussion=q('.detail-side .discussion');discussion?.remove();
  const discussionCopy=side.children[1]?.querySelector('p');
  if(discussionCopy)discussionCopy.textContent=s('这张谱面还没有攻略。','この譜面の攻略はまだありません。');
 }

 // Training: the goal becomes a summary, management stays available on demand.
 if (model.page === 'training') {
  q('.page-title .eyebrow')?.remove();q('.page-title h1').textContent=s('练习','練習');
  q('.beat-steps')?.remove();
  const grid=q('.training-grid');
  if(grid){
   grid.classList.add('v2-training-layout');
   const goal=q('.training-goal');
   if(goal){
    goal.className='v2-goal-summary';
    const copy=make('div','v2-goal-copy'),controls=make('div','v2-goal-control');
    const status=q('.status',goal),headline=q('h2',goal),song=q(':scope > p:not(.muted)',goal),baseline=q(':scope > p.muted',goal),actions=q('.actions',goal);
    plainLabel(status);copy.append(status);
    headline.textContent=model.state==='completed'?(model.goal==='score'?s('最好成绩已刷新','ベストスコアを更新'):s('不可 1 → 0','不可 1 → 0')):(model.goal==='score'?s('刷新最好成绩','ベストスコアを更新'):s('减少不可：少于 1 个','不可を減らす：1 未満'));
    copy.append(headline,song);
    const primary=actions.firstElementChild;controls.append(primary);
    const management=make('details','v2-goal-management'),summary=make('summary','',s('目标详情与管理','目標の詳細と管理'));
    management.append(summary,baseline);const links=make('div','actions');
    [...actions.children].forEach(x=>links.append(x));management.append(links);controls.append(management);
    goal.replaceChildren(copy,controls);
   }
   const section=q('.training-grid > div > section:last-child');section.classList.add('v2-recommendations');
   const head=q('.section-head',section);q('h2',head).textContent=s('推荐曲目','おすすめの曲');
   const modes=q('.mode-tabs',section);head.append(modes);
   const filters=q('.filters',section),more=q('details.disclosure',section);
   more.classList.add('v2-filter-more');q('summary',more).textContent=s('更多选项','詳細設定');
   if(model.mode==='ordinary'){
    const count=q(':scope > label:nth-child(2)',filters);count?.remove();
   }
   filters.append(more);
   const side=q('.training-aside');
   all(':scope > section',side).forEach(x=>{quietSurface(x);x.classList.add('v2-side-section');});
   q('h2',side).textContent=s('练习方向','練習する要素');
   q('p',side).textContent=s('精度是目前相对较低的一项。','精度は現在、比較的低い要素です。');
  }
 }

 // Home: a greeting identifies the player once; recent records and a chosen goal are peers.
 if(model.page==='home'){
  const header=q('.home-heading'),hero=q('.home-hero'),oldGrid=q('.home-grid');
  if(header&&hero&&oldGrid){
   q('.eyebrow',header)?.remove();q(':scope > p',header)?.remove();
   const identity=q('.identity-line');q('.avatar',identity)?.remove();q(':scope > strong',identity)?.remove();header.append(identity);
   const recent=q(':scope > section:last-child',oldGrid),recommend=q(':scope > section:first-child',oldGrid);
   quietSurface(recent);recent.classList.add('v2-home-recent');q('h2',recent).textContent=s('最近的变化','最近の変化');
   const task=make('section','v2-home-goal'),copy=make('div','v2-home-task-copy');
   const noGoal=model.state==='no-goal',done=model.state==='completed';
   copy.append(make('h2','v2-section-label',noGoal?s('练习','練習'):done?s('目标已完成','目標達成'):s('当前目标','現在の目標')));
   const taskTitle=noGoal?s('还没有选择练习目标','練習目標はまだありません'):model.goal==='score'?(done?s('最好成绩已刷新','ベストスコアを更新'):s('刷新最好成绩','ベストスコアを更新')):(done?s('不可 1 → 0','不可 1 → 0'):s('减少不可','不可を減らす'));
   copy.append(make('h3','v2-task-title',taskTitle));
   if(!noGoal){
    copy.append(make('p','v2-task-song',title()));
    copy.append(make('p','v2-task-baseline',s('魔王 ★7','おに ★7')+' · '+(model.goal==='score'?s('设定时 980,000 分','設定時 980,000 点'):s('设定时不可 1 · 目标少于 1','設定時の不可 1 · 目標 1 未満'))));
   }
   const actions=q('.actions',hero);all('.button.primary',actions).forEach(x=>{x.classList.remove('primary');x.classList.add('secondary');});copy.append(actions);task.append(copy);
   const image=q('.feature-cover',hero);if(image&&!noGoal){image.className='v2-task-cover';task.append(image);}
   const overview=make('div','v2-home-overview');hero.replaceWith(overview);overview.append(recent,task);
   recommend.classList.add('v2-home-recommend');q('h2',recommend).textContent=s('推荐曲目','おすすめの曲');
   oldGrid.replaceWith(recommend);
  }
  q('.guest-hero .eyebrow')?.remove();
  all('.cover-tile').forEach(x=>x.classList.add('v2-cover-tile'));
 }

 // Progress: one factual summary; chart, actual changes and measurements do the talking.
 if(model.page==='progress'){
  q('.page-title .eyebrow')?.remove();
  const story=q('.progress-story');
  if(story){
   story.className='v2-progress-summary';
   story.innerHTML=`<p>${s('8月27日—10月7日，Rating','8月27日—10月7日、Rating')} <strong>10.00 → 10.28</strong>。</p>`;
   const grid=q('.progress-grid');grid.classList.add('v2-progress-layout');
   const chart=q(':scope > section',grid);quietSurface(chart);chart.classList.add('v2-trend-block');
   const head=q('.section-head',chart);q('h2',head)?.remove();
   const ranges=q('.range-buttons',chart);head.prepend(ranges);
   const milestones=q(':scope > aside',grid);quietSurface(milestones);milestones.classList.add('v2-changes');
   q('h2',milestones).textContent=s('具体变化','具体的な変化');
   const bars=q('.lower-section .feature-bars');quietSurface(bars);bars.classList.add('v2-skill-bars');
  }
 }
};
