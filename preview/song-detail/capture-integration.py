"""Song-only shell integration review; run through the bounded QA wrapper."""
import argparse
import json
import os
import signal
import subprocess
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('stage', choices=['before', 'after'])
parser.add_argument('--boards-only', action='store_true')
args = parser.parse_args()
signal.alarm(540)
preview = Path(__file__).resolve().parent
repo = preview.parents[1]
out = repo / 'docs/song-detail-preview-20261020/mobile-integration'
out.mkdir(parents=True, exist_ok=True)
node = '/www/server/nvm/versions/node/v24.13.0/bin/node'
env = {key: os.environ[key] for key in ['PATH', 'TMPDIR', 'NODE_OPTIONS'] if key in os.environ}
env.update(NUXT_TELEMETRY_DISABLED='1')
(preview / '.env.preview-empty').write_text('')
log = open(out / f'{args.stage}-server.log', 'w')
server = subprocess.Popen([
    node, str(repo / 'taiko_viewer/node_modules/@nuxt/cli/bin/nuxi.mjs'),
    'dev', str(preview), '--host', '127.0.0.1', '--port', '3208', '--no-fork',
    '--dotenv', str(preview / '.env.preview-empty')
], cwd=preview, env=env, stdout=log, stderr=log, start_new_session=True)
rows, fonts, checks, errors = [], [], [], []


def save_json(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2))


try:
    for _ in range(120):
        if server.poll() is not None:
            raise RuntimeError('Nuxt exited; inspect stage server log')
        try:
            urllib.request.urlopen('http://127.0.0.1:3208/api/content/songs/1455', timeout=2)
            break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError('Nuxt readiness deadline')

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=[
            '--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'
        ])
        try:
            for width, height, lang in ([] if args.boards_only else [(414, 846, 'zh'), (414, 846, 'ja'), (390, 844, 'zh'), (1440, 1000, 'zh')]):
                context = browser.new_context(viewport={'width': width, 'height': height},
                    device_scale_factor=1, locale='zh-CN' if lang == 'zh' else 'ja-JP',
                    is_mobile=width < 768, has_touch=width < 768,
                    service_workers='block', reduced_motion='reduce')
                try:
                    page = context.new_page()
                    page.set_default_timeout(15000)
                    page.on('pageerror', lambda error: errors.append(str(error)[:400]))
                    prefix = '' if lang == 'zh' else '/ja'

                    def visit(song=1455, state='scores', extra=''):
                        page.goto(f'http://127.0.0.1:3208{prefix}/songs/{song}?previewState={state}{extra}',
                            wait_until='domcontentloaded', timeout=90000)
                        page.locator('.difficulty-tabs').wait_for()
                        page.wait_for_function('document.querySelector(".chart-sheet img")?.naturalWidth > 0')
                        page.locator('.chart-state').wait_for(state='hidden')
                        page.locator('.song-cover-picture img').evaluate('(e)=>e.decode()')
                        page.evaluate('document.fonts.ready')
                        if state == 'scores':
                            page.locator('.score-primary strong').first.wait_for()
                        page.wait_for_timeout(600)

                    visit()
                    stem = f'{args.stage}-{lang}-{width}'
                    page.screenshot(path=str(out / f'{stem}-first.png'))
                    if width == 414:
                        page.locator('.song-personal').evaluate('(e)=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-28)')
                        page.screenshot(path=str(out / f'{stem}-record-discussion.png'))
                        page.evaluate('window.scrollTo(0,0)')

                    session = context.new_cdp_session(page)
                    session.send('DOM.enable')
                    session.send('CSS.enable')
                    doc = session.send('DOM.getDocument')
                    for label, selector in {
                        'title': '.song-title-group h1', 'secondaryJapaneseOrChinese': '.secondary-title',
                        'bodyChineseOrJapanese': '.song-category', 'numericMeta': '.song-meta',
                        'scoreDigits': '.score-primary strong', 'primaryAction': '.song-action--primary',
                        'difficultyButton': '.difficulty-tab[aria-selected=true]',
                        'mobileNavLabel': '.mobile-tabbar__item span:last-child'
                    }.items():
                        node_id = session.send('DOM.querySelector', {'nodeId': doc['root']['nodeId'], 'selector': selector})['nodeId']
                        if not node_id:
                            continue
                        actual = session.send('CSS.getPlatformFontsForNode', {'nodeId': node_id})['fonts']
                        css = page.locator(selector).first.evaluate('''(e)=>{
                            const s=getComputedStyle(e);return {text:e.textContent.trim(),family:s.fontFamily,
                            weight:s.fontWeight,size:s.fontSize,lineHeight:s.lineHeight}}
                        ''')
                        fonts.append({'viewport': [width, height], 'locale': lang, 'role': label,
                            'css': css, 'actualFonts': actual})
                    session.detach()
                    rows.append({'stage': args.stage, 'route': page.url, 'viewport': [width, height],
                        'locale': lang, 'browser': browser.version,
                        'userAgent': page.evaluate('navigator.userAgent'),
                        'overflow': page.evaluate('document.documentElement.scrollWidth > innerWidth'),
                        'chart': page.locator('.chart-sheet img').evaluate('(e)=>({src:e.currentSrc,width:e.naturalWidth,height:e.naturalHeight})'),
                        'positions': page.locator('.song-heading,.difficulty-tabs,.song-chart-workspace,.chart-sheet,.song-personal').evaluate_all(
                            '(es)=>es.map(e=>({selector:e.className,y:e.getBoundingClientRect().top+scrollY,height:e.getBoundingClientRect().height}))')})
                    print(stem, flush=True)
                    save_json(f'{args.stage}-fonts.json', fonts)
                    save_json(f'{args.stage}-capture.json', rows)

                    if args.stage == 'after' and width == 414 and lang == 'zh':
                        # Only controls touched by this iteration, with existing public inputs.
                        assert page.locator('.mobile-song-navigation').is_visible()
                        assert not page.locator('.breadcrumb-bar').is_visible()
                        assert not page.locator('.back-link').is_visible()
                        page.locator('.mobile-nav-toggle').click()
                        assert page.locator('.app-shell').evaluate('(e)=>e.classList.contains("mobile-nav-open")')
                        assert page.locator('.app-sidebar .locale-switcher a').count() == 2
                        page.locator('.mobile-nav-mask').click(position={'x': 400, 'y': 200})
                        assert page.locator('.mobile-tabbar__item').count() == 5
                        checks.append('Single mobile detail navigation; original menu, language switch and five destinations retained')
                        # All difficulties keep real images and existing practice-player routes.
                        for key, folder, code in [('EASY', 'Kantan', 1), ('NORMAL', 'Futsuu', 2), ('HARD', 'Muzukashii', 3), ('ONI', 'Oni', 4), ('EDIT', 'InnerOni', 5)]:
                            page.locator(f'[data-track={key}]').click()
                            assert f'/fumen/{folder}/1455.png' in page.locator('.chart-sheet img').get_attribute('src')
                            assert page.locator('.song-action--primary').get_attribute('href') == f'/ourtaikoview/1455/{code}'
                        page.locator('[data-track=ONI]').click()
                        page.locator('.chart-excerpt-toggle').click()
                        assert page.locator('.chart-sheet').evaluate('(e)=>e.clientHeight > 500')
                        page.locator('.chart-excerpt-toggle').click()
                        assert page.locator('.chart-sheet').evaluate('(e)=>e.clientHeight < 200')
                        checks.append('Five real charts, practice links and excerpt expand/collapse preserved')
                        page.locator('.score-details summary').click()
                        assert page.locator('.score-meta').is_visible()
                        assert '2026' in page.locator('.score-meta').inner_text()
                        page.locator('.song-personal').evaluate('(e)=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-28)')
                        page.screenshot(path=str(out / 'after-zh-414-record-expanded.png'))
                        checks.append('Judgements visible; combo, roll, play count and date reachable in one disclosure')
                        page.locator('.song-audio summary').click()
                        assert page.locator('.song-audio audio').count() == 3
                        audio = page.locator('.song-audio audio').nth(1)
                        assert audio.evaluate('(e)=>Promise.race([e.play().then(()=>true),new Promise(r=>setTimeout(()=>r(false),15000))])')
                        page.wait_for_function('document.querySelectorAll(".song-audio audio")[1].currentTime>0.1')
                        audio.evaluate('(e)=>e.pause()')
                        checks.append('Existing drum/mix/pure audio retained; public mix plays')
                        for state in ['empty', 'guest']:
                            visit(state=state)
                            page.locator('.song-personal').evaluate('(e)=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-28)')
                            page.screenshot(path=str(out / f'after-zh-414-{state}.png'))
                            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                        visit(song=1)
                        assert page.locator('.difficulty-tab').count() == 4
                        visit(song=627)
                        page.locator('.song-audio summary').click()
                        assert page.locator('.song-audio audio').count() == 5
                        page.locator('.volume-btn').click()
                        assert page.locator('.audio-block').first.locator('audio').evaluate_all('(es)=>es.every(e=>e.muted)')
                        checks.append('Guest, no record, no EDIT and branch audio/mute checked on mobile')
                        visit(extra='&difficulty=4&recommendation=preview-only-invalid')
                        assert page.locator('.recommendation-goal-action').is_visible()
                        page.locator('[data-track=EDIT]').click()
                        assert page.locator('.recommendation-goal-action').count() == 0
                        checks.append('Existing recommendation target condition retained without submitting a write')
                    if width == 1440:
                        page.goto('http://127.0.0.1:3208/about', wait_until='domcontentloaded')
                        page.wait_for_timeout(500)
                        assert page.locator('.app-shell--song-detail').count() == 0
                        assert not page.evaluate('getComputedStyle(document.body).getPropertyValue("--song-ink").trim()')
                        page.screenshot(path=str(out / f'{args.stage}-about-1440.png'))
                        checks.append('Other route retains default shell')
                finally:
                    context.close()
            if args.boards_only:
                context = browser.new_context(viewport={'width': 1100, 'height': 1050}, device_scale_factor=1, reduced_motion='reduce')
                try:
                    page = context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)[:400]))
                    page.goto('http://127.0.0.1:3208/songs/1455?previewState=scores', wait_until='domcontentloaded')
                    page.locator('.related-discussions__empty-row').wait_for()
                    assert page.locator('.related-discussions__compose').count() == 1
                    page.goto('http://127.0.0.1:3208/__song-review/index.html', wait_until='load')
                    for width, lang, region in [(414, 'zh', 'first'), (414, 'zh', 'record-discussion'), (414, 'ja', 'first'), (414, 'ja', 'record-discussion'), (390, 'zh', 'first'), (1440, 'zh', 'first')]:
                        page.set_viewport_size({'width': 3000 if width == 1440 else 1100, 'height': 1050})
                        page.locator('#width').select_option(str(width))
                        if width == 414:
                            page.locator('#lang').select_option(lang)
                            page.locator('#region').select_option(region)
                        page.locator('#pair').evaluate('(e,w)=>e.style.maxWidth=(w*2+72)+"px"', width)
                        page.locator('#pair img').evaluate_all('(es)=>Promise.all(es.map(e=>e.decode()))')
                        assert page.locator('#pair img').first.evaluate('(e)=>e.clientWidth') == width
                        name = f'compare-{lang}-{width}-{region}.png'
                        page.locator('#pair').screenshot(path=str(out / name))
                        print(name, flush=True)
                    checks.append('Review boards preserve original screenshot pixel widths; final compact discussion renders')
                finally:
                    context.close()
        finally:
            browser.close()
    if args.stage == 'after' and not args.boards_only:
        jp_title = next(row for row in fonts if row['locale'] == 'ja' and row['role'] == 'title')
        jp_chinese = next(row for row in fonts if row['locale'] == 'ja' and row['role'] == 'secondaryJapaneseOrChinese')
        assert 'Hiragino Sans' in [font['familyName'] for font in jp_title['actualFonts']]
        assert [font['familyName'] for font in jp_chinese['actualFonts']] == ['Microsoft YaHei UI']
        checks.append('CDP confirms native Japanese face and a coherent Chinese subtitle face on this host')
        assert urllib.request.urlopen('http://127.0.0.1:3208/__song-review/index.html', timeout=5).status == 200
        checks.append('Local same-browser review gallery is reachable')
    save_json('boards-checks.json' if args.boards_only else f'{args.stage}-checks.json', {'checks': checks, 'browserErrors': errors})
    assert not errors, errors
finally:
    if server.poll() is None:
        os.killpg(server.pid, signal.SIGTERM)
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        os.killpg(server.pid, signal.SIGKILL)
        server.wait(timeout=5)
    log.close()
    print('Preview server stopped', server.returncode, flush=True)
