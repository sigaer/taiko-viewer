"""Browser checks on real pages; every business request remains GET/HEAD."""
def run(page,context,key,state,base,out):
 def cookie(value):context.add_cookies([{'name':'song_preview_state','value':value,'url':base}])
 def settle():page.wait_for_timeout(350)
 def image_ready():page.locator('.chart-image, .progress-image').wait_for();page.wait_for_function('Array.from(document.querySelectorAll(".chart-image,.progress-image")).every(x=>x.complete&&x.naturalWidth>0)')
 checks=[]
 if key=='scores' and state=='scores':
  titles=page.locator('.song-table .song-title-cell');assert titles.nth(2).locator('a').count()==0 and titles.nth(2).locator('.custom-song-title').count()==1
  link=titles.first.locator('a');assert 'difficulty=1' in link.get_attribute('href');link.click();page.locator('.difficulty-tab[aria-selected=true][data-track=EASY]').wait_for();page.screenshot(path=str(out/'screenshots'/'score-desktop-navigation.png'));page.go_back(wait_until='networkidle');checks.extend(['custom-title-no-catalog-link','song-navigation-preserves-difficulty'])
  search=page.locator('.filter-row input').first;search.fill('长曲名');page.locator('button[type=submit]').click();settle();assert page.locator('.song-table .el-table__body tbody tr').count()==1;checks.append('search')
  search.fill('');page.locator('button[type=submit]').click();settle();page.locator('.el-pagination .btn-next').click();settle();assert '2' in page.locator('.el-pagination .number.is-active').inner_text();checks.append('pagination')
  page.locator('.song-table').get_by_role('button',name='编辑',exact=True).first.click();page.locator('.el-dialog:visible').wait_for();assert page.locator('.el-dialog:visible input').count()>5;page.locator('.el-dialog:visible .el-dialog__headerbtn').click();checks.append('editor')
  page.get_by_role('button',name='导入成绩',exact=True).click();dialog=page.locator('.el-dialog:visible');dialog.wait_for();dialog.locator('textarea').fill('{invalid');assert dialog.get_by_role('button',name='开始导入').is_disabled();dialog.locator('textarea').fill('[{"song_no":1455,"level":4}]');assert dialog.get_by_role('button',name='开始导入').is_enabled();dialog.locator('.el-dialog__headerbtn').click();checks.append('import-validation-no-submit')
  page.locator('.filter-row .el-select').click();page.locator('.el-select-dropdown__item:visible').filter(has_text='困难').click();settle();assert page.locator('.song-table .el-table__body tbody tr').count()>0;checks.append('difficulty-filter')
 elif key=='b30' and state=='scores':
  image_ready();img=page.locator('.chart-image');old=img.get_attribute('src');number=page.locator('.el-input-number input');number.fill('12');number.press('Tab');settle();assert img.count()==0;assert '条件已修改' in page.locator('.chart-result').inner_text();checks.append('dirty-clears-old-image')
  cookie('slow');page.locator('button[type=submit]').click();assert '正在生成' in page.locator('.chart-result').inner_text();number.fill('13');number.press('Tab');page.wait_for_timeout(2000);assert img.count()==0;checks.append('edit-during-request')
  cookie('scores');page.locator('button[type=submit]').click();image_ready();assert 'Top 13' in page.locator('.result-heading').inner_text();assert img.get_attribute('src')!=old
  page.locator('.chart-parameters .el-select').click();page.locator('.el-select-dropdown__item:visible').filter(has_text='精度力').click();page.locator('.chart-parameters .el-switch').click();page.locator('button[type=submit]').click();image_ready();assert '精度力' in page.locator('.result-heading').inner_text() and '动态原点' in page.locator('.result-heading').inner_text();checks.append('dimension-dynamic-origin')
  cookie('image-failure');page.locator('button[type=submit]').click();page.locator('.el-alert').wait_for();assert img.count()==0;checks.append('regenerate-failure-no-old-image')
  cookie('scores');page.locator('button[type=submit]').click();image_ready();checks.append('image-retry')
 elif key=='progress' and state=='scores':
  image_ready();page.locator('.kind-switch .el-segmented__item').nth(2).click();settle();assert page.locator('.progress-image').count()==0;page.locator('button[type=submit]').click();image_ready();assert '★10' in page.locator('.result-heading').inner_text();checks.append('type-change')
  page.get_by_role('button',name='下一页',exact=True).click();image_ready();assert '第 2 / 3 页' in page.locator('.pager').inner_text();checks.append('result-pagination')
  with page.expect_download() as download:page.locator('.download-link').click()
  item=download.value;item.save_as(str(out/'progress-download.svg'));assert item.suggested_filename=='taiko-progress.png';checks.append('download')
  page.locator('.kind-switch .el-segmented__item').nth(1).click();settle();page.locator('.progress-form .el-segmented__item').nth(1).click();settle();assert '11.0' in page.locator('.progress-form').inner_text();page.locator('button[type=submit]').click();image_ready();assert '综合难度' in page.locator('.result-heading').inner_text();checks.append('constant-mode-options')
  page.locator('.kind-switch .el-segmented__item').nth(3).click();settle();page.locator('button[type=submit]').click();image_ready();assert '上位' in page.locator('.result-heading').inner_text();checks.append('named-type')
  page.locator('.kind-switch .el-segmented__item').nth(0).click();settle();page.locator('.progress-form .el-select').first.click();page.locator('.el-select-dropdown__item:visible').filter(has_text='2024').click();settle();assert '九段' in page.locator('.progress-form').inner_text();checks.append('version-grade-link')
  cookie('image-failure');page.locator('button[type=submit]').click();page.locator('.el-alert').wait_for();assert page.locator('.progress-image').count()==0;cookie('scores');page.locator('button[type=submit]').click();image_ready();checks.append('image-error-retry')
 elif key=='progress' and state=='options-failure':
  assert page.locator('.el-alert').is_visible();assert page.locator('.control-skeleton').count()==0;cookie('scores');page.get_by_role('button',name='再試行',exact=True).click();image_ready();assert page.locator('.el-alert').count()==0;checks.append('option-failure-exits-loading-retry-restores-result')
 if checks:
  page.screenshot(path=str(out/'screenshots'/('checks-'+key+'-'+state+'.png')),full_page=True)
 return checks

def run_mobile(page,key,out):
 checks=[]
 if key=='scores':
  custom=page.locator('.mobile-score').nth(2);assert custom.locator('a').count()==0 and custom.locator('.custom-song-title').count()==1
  link=page.locator('.mobile-score').first.locator('a');assert 'difficulty=1' in link.get_attribute('href');link.click();page.locator('.difficulty-tab[aria-selected=true][data-track=EASY]').wait_for();page.screenshot(path=str(out/'screenshots'/'score-mobile-navigation.png'));page.go_back(wait_until='networkidle');checks.extend(['mobile-custom-title','mobile-chart-navigation'])
  article=page.locator('.mobile-score').first;article.locator('summary').click();assert article.locator('details').get_attribute('open') is not None;assert '更新时间' in article.inner_text();assert article.locator('a').get_attribute('href');checks.append('score-fields-disclosure-song-link')
  page.locator('.el-pagination .btn-next').click();page.wait_for_timeout(400);assert '2' in page.locator('.el-pagination .number.is-active').inner_text();checks.append('mobile-pagination')
 else:
  img=page.locator('.chart-image, .progress-image');assert img.locator('..').get_attribute('target')=='_blank';assert img.evaluate('(e)=>e.naturalHeight>e.naturalWidth && e.getBoundingClientRect().width<=innerWidth-40');checks.append('complete-image-full-size-link')
  if key=='progress':
   page.locator('.kind-switch .el-segmented__item').nth(2).click();page.locator('button[type=submit]').click();img.wait_for();page.get_by_role('button',name='下一页',exact=True).click();page.wait_for_timeout(700);assert '第 2 / 3 页' in page.locator('.pager').inner_text();checks.append('mobile-result-pagination-download-visible')
   page.locator('.download-link').scroll_into_view_if_needed();assert page.locator('.download-link').is_visible()
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
 page.screenshot(path=str(out/'screenshots'/('mobile-checks-'+key+'.png')),full_page=True)
 return checks
