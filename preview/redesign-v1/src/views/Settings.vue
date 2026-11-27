<script setup>
import { computed, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import Sheet from '../components/Sheet.vue'
import { songById, chartOf, fx, fmt, datasetInfo } from '../mock/data'
import * as storeMod from '../store'
import { store, L, toast } from '../store'
import { useSectionNav } from '../sectionNav'

const THEMES = [
  { v: 'system', icon: 'desktop', zh: '跟随系统', ja: 'システム' },
  { v: 'light', icon: 'sun', zh: '浅色', ja: 'ライト' },
  { v: 'dark', icon: 'moon', zh: '深色', ja: 'ダーク' },
]
const LOCALES = [
  { v: 'zh', label: '简体中文' },
  { v: 'ja', label: '日本語' },
]
const MOTIONS = [
  { v: 'system', zh: '跟随系统', ja: 'システム' },
  { v: 'reduce', zh: '开启', ja: 'オン' },
]

/* 列表密度（V11 / I10）：直接绑定 store.density（'comfortable' | 'compact'），根元素 data-density 随之变化，全站表格生效 */
const density = computed({
  get: () => store.density,
  set: (v) => (store.density = v),
})

/* 歌曲标题显示：本地状态，预览即时反映 */
const titleMode = ref('zh')
const previewSongs = [615, 413, 1308].map((id) => songById[id]).filter(Boolean)
const titleOf = (s) => (titleMode.value === 'zh' ? s.zh : s.ja)
const subOf = (s) => {
  const sub = titleMode.value === 'zh' ? s.ja : s.zh
  return sub === titleOf(s) ? '' : sub
}
const oniConst = (s) => chartOf(s.id, 4)?.constant ?? null

const notices = reactive([
  { key: 'reply', on: true, zh: '回复我的', ja: '自分への返信', dzh: '有人回复你的帖子或楼层', dja: '投稿やコメントに返信がついたとき' },
  { key: 'mention', on: true, zh: '提到我的', ja: '自分へのメンション', dzh: '有人在帖子里 @ 你', dja: '投稿内でメンションされたとき' },
  { key: 'like', on: false, zh: '赞', ja: 'いいね', dzh: '你的帖子或回复收到赞', dja: '投稿や返信にいいねがついたとき' },
  { key: 'sync', on: true, zh: '同步完成', ja: '同期完了', dzh: '同步结束后列出新增的记录', dja: '同期が終わったら新しい記録をお知らせ' },
  { key: 'weekly', on: true, zh: '每周回顾', ja: '週間ふりかえり', dzh: '每周一早上送达上一周的回顾', dja: '毎週月曜の朝に前週のふりかえりを配信' },
])

/* 本地缓存 */
const caches = reactive([
  { key: 'img', mb: 14.2, zh: '封面与谱面图', ja: 'ジャケットと譜面画像' },
  { key: 'catalog', mb: 3.6, zh: '曲库与定数', ja: '楽曲と定数データ' },
  { key: 'scores', mb: 0.6, zh: '成绩快照', ja: 'スコアのスナップショット' },
])
const cacheTotal = computed(() => caches.reduce((n, c) => n + c.mb, 0))
function clearCache() {
  const freed = cacheTotal.value.toFixed(1)
  caches.forEach((c) => (c.mb = 0))
  toast(L(`已清除 ${freed} MB 缓存`, `キャッシュ ${freed} MB を削除しました`))
}
// 最近看过（P10）：store 导出了 clearRecent / recentIds 时才显示
const recentIds = storeMod.recentIds
const clearRecentFn = typeof storeMod.clearRecent === 'function' ? storeMod.clearRecent : null
const recentCount = computed(() => (recentIds?.value ? recentIds.value.length : 0))
function clearRecentSongs() {
  clearRecentFn?.()
  toast(L('已清除最近看过的歌曲', '最近見た曲を消去しました'))
}

const dataLine = computed(() =>
  L(`示例数据：${fmt(datasetInfo.songs)} 首歌 · ${fmt(datasetInfo.scores)} 条成绩`, `サンプルデータ：${fmt(datasetInfo.songs)} 曲・成績 ${fmt(datasetInfo.scores)} 件`),
)

const aboutOpen = ref(false)

/* ---------- 页内目录（≥ 1100px 显示） ---------- */
const NAV = computed(() => [
  { id: 'set-look', label: L('外观与显示', '表示') },
  { id: 'set-lang', label: L('语言与曲名', '言語と曲名') },
  { id: 'set-notify', label: L('通知', '通知') },
  { id: 'set-cache', label: L('本地缓存', 'ローカルキャッシュ') },
  { id: 'set-about', label: L('关于', 'このアプリについて') },
])
const { current: currentSec, scrollTo } = useSectionNav(() => NAV.value.map((n) => n.id))
</script>

<template>
  <div class="page settings">
    <div class="vpage">
      <nav class="toc" :aria-label="L('本页目录', 'このページの目次')">
        <ul>
          <li v-for="n in NAV" :key="n.id">
            <button type="button" :aria-current="currentSec === n.id ? 'true' : undefined" @click="scrollTo(n.id)">{{ n.label }}</button>
          </li>
        </ul>
      </nav>

      <div class="vcol">
        <!-- 外观与显示 -->
        <section id="set-look" class="vsec" aria-labelledby="set-look-h">
          <div class="section-head"><h2 id="set-look-h" class="t-h2" tabindex="-1">{{ L('外观与显示', '表示') }}</h2></div>
          <div class="panel">
            <div class="srow">
              <span id="set-theme-l" class="lbl">{{ L('外观', 'テーマ') }}</span>
              <div class="ctl">
                <div class="seg" role="group" aria-labelledby="set-theme-l">
                  <button v-for="t in THEMES" :key="t.v" type="button" :aria-pressed="store.theme === t.v" @click="store.theme = t.v">
                    <span class="seg-in"><Icon :name="t.icon" :size="15" />{{ L(t.zh, t.ja) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="srow">
              <span id="set-density-l" class="lbl">{{ L('列表密度', 'リストの密度') }}</span>
              <div class="ctl">
                <div class="seg" role="group" aria-labelledby="set-density-l">
                  <button type="button" :aria-pressed="density === 'comfortable'" @click="density = 'comfortable'">{{ L('舒适', 'ゆったり') }}</button>
                  <button type="button" :aria-pressed="density === 'compact'" @click="density = 'compact'">{{ L('紧凑', 'コンパクト') }}</button>
                </div>
                <table class="dt mini" :class="density">
                  <caption class="sr-only">{{ L('列表密度预览', 'リスト密度のプレビュー') }}</caption>
                  <thead class="sr-only">
                    <tr>
                      <th scope="col">{{ L('歌曲', '楽曲') }}</th>
                      <th scope="col">{{ L('魔王星级', 'おに ★') }}</th>
                      <th scope="col">{{ L('定数', '定数') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in previewSongs" :key="s.id">
                      <td class="t" :lang="titleMode === 'ja' ? 'ja' : 'zh-CN'"><span class="title-1l" :title="titleOf(s)">{{ titleOf(s) }}</span></td>
                      <td class="c"><span class="star-pip">{{ s.levels[3] }}</span></td>
                      <td class="r num">
                        <span v-if="oniConst(s) == null" class="na">—</span>
                        <template v-else>{{ fx(oniConst(s)) }}</template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="srow">
              <span id="set-motion-l" class="lbl">{{ L('减少动效', '動きを減らす') }}</span>
              <div class="ctl">
                <div class="seg" role="group" aria-labelledby="set-motion-l">
                  <button v-for="m in MOTIONS" :key="m.v" type="button" :aria-pressed="store.motion === m.v" @click="store.motion = m.v">{{ L(m.zh, m.ja) }}</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 语言与曲名 -->
        <section id="set-lang" class="vsec" aria-labelledby="set-lang-h">
          <div class="section-head"><h2 id="set-lang-h" class="t-h2" tabindex="-1">{{ L('语言与曲名', '言語と曲名') }}</h2></div>
          <div class="panel">
            <div class="srow">
              <span id="set-locale-l" class="lbl">{{ L('语言', '言語') }}</span>
              <div class="ctl">
                <div class="seg" role="group" aria-labelledby="set-locale-l">
                  <button v-for="l in LOCALES" :key="l.v" type="button" :aria-pressed="store.locale === l.v" :lang="l.v === 'ja' ? 'ja' : 'zh-CN'" @click="store.locale = l.v">{{ l.label }}</button>
                </div>
              </div>
            </div>

            <div class="srow">
              <span id="set-title-l" class="lbl">{{ L('歌曲标题显示', '曲名の表示') }}</span>
              <div class="ctl">
                <div class="seg" role="group" aria-labelledby="set-title-l">
                  <button type="button" :aria-pressed="titleMode === 'zh'" @click="titleMode = 'zh'">{{ L('优先中文译名', '中国語訳を優先') }}</button>
                  <button type="button" :aria-pressed="titleMode === 'ja'" @click="titleMode = 'ja'">{{ L('优先日文原名', '日本語の原題を優先') }}</button>
                </div>
                <div v-if="previewSongs[0]" class="song-preview">
                  <Cover :song="previewSongs[0]" />
                  <span class="grow">
                    <b class="title-1l" :title="titleOf(previewSongs[0])" :lang="titleMode === 'ja' ? 'ja' : 'zh-CN'">{{ titleOf(previewSongs[0]) }}</b>
                    <small v-if="subOf(previewSongs[0])" class="title-1l" :title="subOf(previewSongs[0])" :lang="titleMode === 'zh' ? 'ja' : 'zh-CN'">{{ subOf(previewSongs[0]) }}</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 通知 -->
        <section id="set-notify" class="vsec" aria-labelledby="set-notify-h">
          <div class="section-head"><h2 id="set-notify-h" class="t-h2" tabindex="-1">{{ L('通知', '通知') }}</h2></div>
          <p v-if="store.auth === 'guest'" class="panel guest-note">
            <span class="grow">{{ L('登录后可以设置通知。', 'ログインすると通知を設定できます。') }}</span>
            <RouterLink to="/login" class="btn btn-sm">{{ L('登录', 'ログイン') }}</RouterLink>
          </p>
          <ul v-else class="panel rows">
            <li v-for="n in notices" :key="n.key">
              <label class="chk">
                <input v-model="n.on" type="checkbox" />
                <span class="grow">
                  <b>{{ L(n.zh, n.ja) }}</b>
                  <small>{{ L(n.dzh, n.dja) }}</small>
                </span>
              </label>
            </li>
          </ul>
        </section>

        <!-- 本地缓存 -->
        <section id="set-cache" class="vsec" aria-labelledby="set-cache-h">
          <div class="section-head">
            <h2 id="set-cache-h" class="t-h2" tabindex="-1">{{ L('本地缓存', 'ローカルキャッシュ') }}</h2>
            <span class="t-small">{{ L('这台设备已用', 'この端末で使用中') }} <b class="num">{{ cacheTotal.toFixed(1) }}</b> MB</span>
          </div>
          <div class="panel">
            <ul class="rows">
              <li v-for="c in caches" :key="c.key" class="crow">
                <span class="grow">{{ L(c.zh, c.ja) }}</span>
                <span><span class="num">{{ c.mb.toFixed(1) }}</span> MB</span>
              </li>
              <li v-if="clearRecentFn" class="crow">
                <span class="grow">
                  {{ L('最近看过的歌曲', '最近見た曲') }}
                  <span class="t-small"> · <span class="num">{{ recentCount }}</span> {{ L('首', '曲') }}</span>
                </span>
                <button type="button" class="btn btn-sm" :disabled="!recentCount" @click="clearRecentSongs">{{ L('清除', '消去') }}</button>
              </li>
            </ul>
            <div class="panel-foot">
              <button type="button" class="btn" :disabled="!cacheTotal" @click="clearCache">
                <Icon name="trash" :size="16" />{{ cacheTotal ? L(`清除 ${cacheTotal.toFixed(1)} MB 缓存`, `キャッシュ ${cacheTotal.toFixed(1)} MB を削除`) : L('缓存已清空', 'キャッシュは空です') }}
              </button>
              <span class="field-hint">{{ L('下次打开时重新下载', '次回表示時に再ダウンロードされます') }}</span>
            </div>
          </div>
        </section>

        <!-- 关于 -->
        <section id="set-about" class="vsec" aria-labelledby="set-about-h">
          <div class="section-head"><h2 id="set-about-h" class="t-h2" tabindex="-1">{{ L('关于', 'このアプリについて') }}</h2></div>
          <div class="panel">
            <dl class="kv about-kv">
              <dt>{{ L('版本', 'バージョン') }}</dt>
              <dd>{{ L('Design V1.3 原型', 'Design V1.3 プロトタイプ') }}</dd>
              <dt>{{ L('数据', 'データ') }}</dt>
              <dd class="data-line">
                <span class="tag tag-info"><Icon name="info" :size="12" />{{ L('原型', 'プロトタイプ') }}</span>
                <span>{{ dataLine }}</span>
              </dd>
            </dl>
            <ul class="rows links">
              <li>
                <button type="button" class="lk" @click="aboutOpen = true">
                  <Icon name="info" :size="18" /><span class="grow">{{ L('关于 Viewer', 'Viewer について') }}</span><Icon name="chevR" :size="16" />
                </button>
              </li>
              <li>
                <RouterLink to="/titles" class="lk"><Icon name="history" :size="18" /><span class="grow">{{ L('别名修改日志', '別名の変更履歴') }}</span><Icon name="chevR" :size="16" /></RouterLink>
              </li>
              <li>
                <RouterLink to="/account/support" class="lk"><Icon name="help" :size="18" /><span class="grow">{{ L('工单支持', 'サポート') }}</span><Icon name="chevR" :size="16" /></RouterLink>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>

    <Sheet :open="aboutOpen" :title="L('关于 Viewer', 'Viewer について')" :width="420" @close="aboutOpen = false">
      <p class="about-line">My Taiko, in one place.</p>
      <dl class="kv about-sheet-kv">
        <dt>{{ L('版本', 'バージョン') }}</dt>
        <dd>{{ L('Design V1.3 原型', 'Design V1.3 プロトタイプ') }}</dd>
        <dt>{{ L('技术栈', '技術スタック') }}</dt>
        <dd>Nuxt 3 · Vue 3 · Element Plus</dd>
      </dl>
      <ul class="rows links about-links">
        <li>
          <RouterLink to="/account/support" class="lk"><Icon name="help" :size="18" /><span class="grow">{{ L('工单支持', 'サポート') }}</span><Icon name="chevR" :size="16" /></RouterLink>
        </li>
        <li>
          <RouterLink to="/account/developer" class="lk"><Icon name="code" :size="18" /><span class="grow">{{ L('开发者', '開発者') }}</span><Icon name="chevR" :size="16" /></RouterLink>
        </li>
      </ul>
    </Sheet>
  </div>
</template>

<style scoped>
/* ---------- 单栏 760 + 宽屏页内目录（V10） ---------- */
.vpage {
  max-width: 760px;
  margin: 0 auto;
}
.vcol {
  display: flex;
  flex-direction: column;
  gap: var(--sp-10);
  min-width: 0;
}
.toc {
  display: none;
}
.vsec {
  scroll-margin-top: calc(var(--bar-h) + 24px);
}
.vsec h2:focus-visible {
  box-shadow: none;
  text-decoration: underline;
}
@media (min-width: 1100px) {
  .vpage {
    display: grid;
    grid-template-columns: 200px minmax(0, 760px);
    gap: var(--sp-10);
    max-width: calc(200px + 760px + var(--sp-10));
  }
  .toc {
    display: block;
    position: sticky;
    top: calc(var(--bar-h) + 24px);
    align-self: start;
  }
}
.toc ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-left: 1px solid var(--line);
}
.toc button {
  display: block;
  width: 100%;
  min-height: 36px;
  margin-left: -1px;
  padding: 6px 12px;
  border-left: 2px solid transparent;
  text-align: left;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.toc button:hover {
  color: var(--ink);
}
.toc button[aria-current='true'] {
  border-left-color: var(--selected-line);
  color: var(--ink);
  font-weight: 700;
}

.rows > li {
  border-bottom: 1px solid var(--line);
}
.rows > li:last-child {
  border-bottom: 0;
}

/* 设置行：左标签，右控件 */
.srow {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.srow:last-child {
  border-bottom: 0;
}
.lbl {
  padding-top: 8px;
  font-weight: 700;
  color: var(--ink);
}
.ctl {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-3);
  min-width: 0;
}
.seg {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.seg button {
  white-space: nowrap;
}
.seg-in {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mini {
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
}
.mini td {
  padding-top: 10px;
  padding-bottom: 10px;
  transition: padding var(--dur-2) var(--ease-out);
}
.mini.compact td {
  padding-top: 4px;
  padding-bottom: 4px;
}
.mini .t {
  max-width: 0;
  width: 100%;
  font-weight: 500;
}
.mini .c {
  width: 44px;
}
.mini .r {
  width: 64px;
  font-size: var(--fs-14);
}
.song-preview {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  max-width: 420px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
}
.song-preview .grow {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.35;
}
.song-preview b {
  font-size: var(--fs-16);
}
.song-preview small {
  font-size: var(--fs-13);
  color: var(--ink-2);
}

/* 通知 */
.chk {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  min-height: 60px;
  padding: var(--sp-3) var(--sp-5);
  cursor: pointer;
}
.chk:hover {
  background: var(--surface-2);
}
.rows > li:first-child .chk {
  border-radius: var(--r-panel) var(--r-panel) 0 0;
}
.rows > li:last-child .chk {
  border-radius: 0 0 var(--r-panel) var(--r-panel);
}
.chk input {
  flex: none;
  width: 20px;
  height: 20px;
  accent-color: var(--ink);
}
.chk .grow {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}
.chk b {
  font-size: var(--fs-16);
}
.chk small {
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.guest-note {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  font-size: var(--fs-14);
}

/* 缓存 */
.crow {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 52px;
  padding: 8px var(--sp-5);
  font-size: var(--fs-14);
}
.crow .num {
  font-size: var(--fs-14);
}
.panel-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px var(--sp-3);
  padding: var(--sp-3) var(--sp-5) var(--sp-4);
  border-top: 1px solid var(--line);
}

/* 关于 */
.about-kv {
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
}
.data-line {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}
.lk {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: 48px;
  padding: 0 var(--sp-5);
  color: var(--ink-2);
  text-align: left;
}
.lk .grow {
  color: var(--ink);
  font-weight: 500;
}
.lk:hover .grow {
  color: var(--link);
}
.about-line {
  font-size: var(--fs-16);
  font-weight: 700;
}
.about-sheet-kv {
  margin: var(--sp-4) 0;
}
.about-links {
  margin: 0 calc(var(--sp-5) * -1);
  border-top: 1px solid var(--line);
}

@media (max-width: 767px) {
  .vcol {
    gap: var(--sp-8);
  }
  .srow {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-2);
    padding: var(--sp-4);
  }
  .lbl {
    padding-top: 0;
  }
  .seg {
    width: 100%;
  }
  .seg button {
    flex: 1;
  }
  .mini,
  .song-preview {
    max-width: none;
  }
  .chk,
  .crow {
    padding-left: var(--sp-4);
    padding-right: var(--sp-4);
  }
  .panel-foot .btn {
    width: 100%;
  }
  .about-kv {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .about-kv dd {
    text-align: left;
    margin-bottom: 8px;
  }
  .data-line {
    justify-content: flex-start;
  }
}
</style>
