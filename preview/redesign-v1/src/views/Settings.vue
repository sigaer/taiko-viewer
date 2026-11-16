<script setup>
import { computed, reactive, ref } from 'vue'
import Icon from '../components/Icon.vue'
import Cover from '../components/Cover.vue'
import Sheet from '../components/Sheet.vue'
import { songById, chartOf, fx } from '../mock/data'
import { store, L, toast } from '../store'

const THEMES = [
  { v: 'system', icon: 'desktop', zh: '跟随系统', ja: 'システム' },
  { v: 'light', icon: 'sun', zh: '浅色', ja: 'ライト' },
  { v: 'dark', icon: 'moon', zh: '深色', ja: 'ダーク' },
]
const LOCALES = [
  { v: 'zh', label: '简体中文' },
  { v: 'ja', label: '日本語' },
]

/* 密度与标题显示：本地状态，下面的预览表即时反映 */
const density = ref('cozy')
const titleMode = ref('zh')
const previewSongs = [615, 233, 512].map((id) => songById[id])
const titleOf = (s) => (titleMode.value === 'zh' ? s.zh : s.ja)
const subOf = (s) => {
  const sub = titleMode.value === 'zh' ? s.ja : s.zh
  return sub === titleOf(s) ? '' : sub
}

const notices = reactive([
  { key: 'reply', on: true, zh: '回复我的', ja: '自分への返信', dzh: '有人回复你的帖子或楼层', dja: '投稿やコメントに返信がついたとき' },
  { key: 'mention', on: true, zh: '提到我的', ja: '自分へのメンション', dzh: '有人在帖子里 @ 你', dja: '投稿内でメンションされたとき' },
  { key: 'like', on: false, zh: '赞', ja: 'いいね', dzh: '你的帖子或回复收到赞', dja: '投稿や返信にいいねがついたとき' },
  { key: 'sync', on: true, zh: '同步完成', ja: '同期完了', dzh: '同步结束后列出新增的记录', dja: '同期が終わったら新しい記録をお知らせ' },
  { key: 'weekly', on: true, zh: '每周回顾', ja: '週間ふりかえり', dzh: '每周一早上送达上一周的回顾', dja: '毎週月曜の朝に前週のふりかえりを配信' },
])

const caches = reactive([
  { key: 'img', tone: 'don', mb: 14.2, zh: '封面与谱面图', ja: 'ジャケットと譜面画像' },
  { key: 'catalog', tone: 'ka', mb: 3.6, zh: '曲库与定数', ja: '楽曲と定数データ' },
  { key: 'scores', tone: 'roll', mb: 0.6, zh: '成绩快照', ja: 'スコアのスナップショット' },
])
const cacheTotal = computed(() => caches.reduce((n, c) => n + c.mb, 0))
function clearCache() {
  const freed = cacheTotal.value.toFixed(1)
  caches.forEach((c) => (c.mb = 0))
  toast(L(`已清除 ${freed} MB 缓存`, `キャッシュ ${freed} MB を削除しました`))
}

const ABOUT = [
  { key: 'about', icon: 'info', zh: '关于 Viewer', ja: 'Viewer について' },
  { key: 'alias', to: '/titles', icon: 'history', zh: '别名修改日志', ja: '別名の変更履歴' },
  { key: 'support', to: '/account/support', icon: 'help', zh: '工单支持', ja: 'サポート' },
]
const aboutOpen = ref(false)
</script>

<template>
  <div class="page settings">
    <div class="cols">
      <div class="main">
        <section>
          <div class="section-head"><h2 class="t-h2">{{ L('外观与语言', '表示と言語') }}</h2></div>
          <div class="panel">
            <div class="srow">
              <b class="lbl">{{ L('外观', 'テーマ') }}</b>
              <div class="ctl">
                <div class="seg" role="group" :aria-label="L('外观', 'テーマ')">
                  <button v-for="t in THEMES" :key="t.v" :aria-pressed="store.theme === t.v" @click="store.theme = t.v">
                    <span class="seg-in"><Icon :name="t.icon" :size="15" />{{ L(t.zh, t.ja) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="srow">
              <b class="lbl">{{ L('列表密度', 'リストの密度') }}</b>
              <div class="ctl">
                <div class="seg" role="group" :aria-label="L('列表密度', 'リストの密度')">
                  <button :aria-pressed="density === 'cozy'" @click="density = 'cozy'">{{ L('舒适', 'ゆったり') }}</button>
                  <button :aria-pressed="density === 'compact'" @click="density = 'compact'">{{ L('紧凑', 'コンパクト') }}</button>
                </div>
                <table class="dt mini" :class="density">
                  <tbody>
                    <tr v-for="s in previewSongs" :key="s.id">
                      <td class="t" :lang="titleMode === 'ja' ? 'ja' : 'zh-CN'"><span class="truncate">{{ titleOf(s) }}</span></td>
                      <td class="c"><span class="star-pip">{{ s.levels[3] }}</span></td>
                      <td class="r num">{{ fx(chartOf(s.id, 4).constant) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="srow">
              <b class="lbl">{{ L('语言', '言語') }}</b>
              <div class="ctl">
                <div class="seg" role="group" :aria-label="L('语言', '言語')">
                  <button v-for="l in LOCALES" :key="l.v" :aria-pressed="store.locale === l.v" :lang="l.v === 'ja' ? 'ja' : 'zh-CN'" @click="store.locale = l.v">{{ l.label }}</button>
                </div>
              </div>
            </div>

            <div class="srow">
              <b class="lbl">{{ L('歌曲标题显示', '曲名の表示') }}</b>
              <div class="ctl">
                <div class="seg" role="group" :aria-label="L('歌曲标题显示', '曲名の表示')">
                  <button :aria-pressed="titleMode === 'zh'" @click="titleMode = 'zh'">{{ L('优先中文译名', '中国語訳を優先') }}</button>
                  <button :aria-pressed="titleMode === 'ja'" @click="titleMode = 'ja'">{{ L('优先日文原名', '日本語の原題を優先') }}</button>
                </div>
                <div class="song-preview">
                  <Cover :song="previewSongs[0]" />
                  <span class="grow">
                    <b class="truncate" :lang="titleMode === 'ja' ? 'ja' : 'zh-CN'">{{ titleOf(previewSongs[0]) }}</b>
                    <small v-if="subOf(previewSongs[0])" class="truncate" :lang="titleMode === 'zh' ? 'ja' : 'zh-CN'">{{ subOf(previewSongs[0]) }}</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2 class="t-h2">{{ L('通知', '通知') }}</h2></div>
          <p v-if="store.auth === 'guest'" class="panel guest-note t-small">
            <span class="grow">{{ L('登录后可以设置通知。', 'ログインすると通知を設定できます。') }}</span>
            <RouterLink to="/login" class="link">{{ L('登录', 'ログイン') }}</RouterLink>
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
      </div>

      <aside class="side">
        <section>
          <div class="section-head"><h2 class="t-h2">{{ L('本地缓存', 'ローカルキャッシュ') }}</h2></div>
          <div class="panel">
            <div class="cache-top">
              <div class="stat">
                <div class="v">{{ cacheTotal.toFixed(1) }}<span class="unit">MB</span></div>
                <div class="k">{{ L('这台设备已用', 'この端末で使用中') }}</div>
              </div>
              <div v-if="cacheTotal" class="bar" aria-hidden="true">
                <i v-for="c in caches" :key="c.key" :class="c.tone" :style="{ flexGrow: c.mb }" />
              </div>
            </div>
            <ul class="rows cache-list">
              <li v-for="c in caches" :key="c.key">
                <i class="dot" :class="c.tone" />
                <span class="grow">{{ L(c.zh, c.ja) }}</span>
                <span><span class="num">{{ c.mb.toFixed(1) }}</span> MB</span>
              </li>
            </ul>
            <div class="panel-foot">
              <button class="btn btn-block" :disabled="!cacheTotal" @click="clearCache"><Icon name="trash" :size="16" />{{ L('清除缓存', 'キャッシュを削除') }}</button>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2 class="t-h2">{{ L('关于', 'このアプリについて') }}</h2></div>
          <div class="panel">
            <dl class="kv about-kv">
              <dt>{{ L('版本', 'バージョン') }}</dt>
              <dd>{{ L('Design V1 原型', 'Design V1 プロトタイプ') }}</dd>
            </dl>
            <ul class="rows links">
              <li v-for="a in ABOUT" :key="a.key">
                <RouterLink v-if="a.to" :to="a.to" class="lk">
                  <Icon :name="a.icon" :size="18" />
                  <span class="grow">{{ L(a.zh, a.ja) }}</span>
                  <Icon name="chevR" :size="16" />
                </RouterLink>
                <button v-else type="button" class="lk" @click="aboutOpen = true">
                  <Icon :name="a.icon" :size="18" />
                  <span class="grow">{{ L(a.zh, a.ja) }}</span>
                  <Icon name="chevR" :size="16" />
                </button>
              </li>
            </ul>
          </div>
        </section>
      </aside>
    </div>

    <Sheet :open="aboutOpen" :title="L('关于 Viewer', 'Viewer について')" :width="420" @close="aboutOpen = false">
      <p class="about-line">My Taiko, in one place.</p>
      <dl class="kv about-sheet-kv">
        <dt>{{ L('版本', 'バージョン') }}</dt>
        <dd>{{ L('Design V1 原型', 'Design V1 プロトタイプ') }}</dd>
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
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: var(--sp-8);
}
.main,
.side {
  min-width: 0;
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
  grid-template-columns: 180px minmax(0, 1fr);
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.srow:last-child {
  border-bottom: 0;
}
.lbl {
  padding-top: 7px;
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
.seg-in {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mini {
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
.mini .t .truncate {
  display: block;
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
  line-height: 1.35;
}
.song-preview b {
  font-size: var(--fs-16);
}
.song-preview small {
  font-size: var(--fs-12);
  color: var(--ink-3);
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
  width: 18px;
  height: 18px;
  accent-color: var(--don);
}
.chk .grow {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}
.chk small {
  font-size: var(--fs-12);
  color: var(--ink-3);
}

/* 缓存 */
.cache-top {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding: var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.unit {
  margin-left: 4px;
  font-size: var(--fs-14);
  font-weight: 600;
  color: var(--ink-3);
}
.bar {
  display: flex;
  gap: 2px;
  height: 8px;
  border-radius: var(--r-xs);
  overflow: hidden;
}
.bar i {
  flex-basis: 0;
  min-width: 4px;
}
.don {
  background: var(--don);
  color: var(--don);
}
.ka {
  background: var(--ka);
  color: var(--ka);
}
.roll {
  background: var(--roll);
  color: var(--roll);
}
.cache-list li {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 10px var(--sp-5);
  font-size: var(--fs-13);
}
.cache-list .num {
  font-size: var(--fs-14);
}
.panel-foot {
  padding: var(--sp-3) var(--sp-5) var(--sp-4);
  border-top: 1px solid var(--line);
}

/* 关于 */
.about-kv {
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.lk {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: 48px;
  padding: 0 var(--sp-5);
  color: var(--ink-3);
  text-align: left;
}
.guest-note {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
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
.lk .grow {
  color: var(--ink);
  font-weight: 500;
}
.lk:hover .grow {
  color: var(--ka-ink);
}

@media (max-width: 1099px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-10);
  }
}
@media (max-width: 767px) {
  .cols {
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
  .mini,
  .song-preview {
    max-width: none;
  }
  .chk {
    padding: var(--sp-3) var(--sp-4);
  }
}
</style>
