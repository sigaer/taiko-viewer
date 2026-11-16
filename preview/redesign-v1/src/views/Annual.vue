<script setup>
import { computed, ref, watch } from 'vue'
import Icon from '../components/Icon.vue'
import Lane from '../components/Lane.vue'
import Sheet from '../components/Sheet.vue'
import { player, laneDays } from '../mock/data'
import { store, L, toast, runSync, isAuthed, isReady } from '../store'

// 年度回顾入口。故事本体只在手机上播放：桌面负责「预告 + 交接到手机」，手机负责「检查入场条件 + 开始」。
const RANGE = '2026.01.01 – 2026.11.30'
const LINK = 'viewer.sakura-bot.cn/annual/2026'
const stripDays = laneDays.slice(-11)
const sel = ref(0)

const CHAPTERS = computed(() => [
  { name: L('初见', '出会い'), v: '501', unit: L('次游玩', '回プレイ') },
  { name: L('习惯', '習慣'), v: '79', unit: L('首歌', '曲') },
  { name: L('偏爱', 'お気に入り'), pre: L('最常打：', '最多プレイ：'), text: '千本桜', ja: true },
  { name: L('成长', '成長'), pre: 'Rating', v: '+1.35' },
  { name: L('留念', '記念'), pre: L('称号：', '称号：'), text: player.title },
])
const POSTER = computed(() => [
  { v: '501', k: L('游玩次数', 'プレイ回数') },
  { v: '79', k: L('打过的歌', 'プレイ曲数') },
  { v: '+1.35', k: 'Rating', hi: true },
  { v: '23', k: L('新全良', '新しい全良') },
])

/* 入场条件：邀请码 → 登录 → 绑定 → 同步 */
const checklist = computed(() => {
  const a = store.auth
  const items = [
    { key: 'invite', label: L('邀请码', '招待コード'), done: true },
    { key: 'login', label: L('登录', 'ログイン'), done: a !== 'guest', cta: L('登录', 'ログイン'), to: '/login' },
    { key: 'bind', label: L('绑定鼓众广场 ID', '鼓衆広場 ID を連携'), done: a === 'empty' || a === 'ready', cta: L('去绑定', '連携する'), to: '/bind' },
    { key: 'sync', label: L('同步成绩', '成績を同期'), done: a === 'ready', cta: L('开始同步', '同期を開始') },
  ]
  const next = items.find((i) => !i.done)
  return items.map((i) => ({ ...i, next: i === next }))
})
const syncAsked = ref(false)
function sync() {
  syncAsked.value = true
  runSync()
}
watch(
  () => store.syncing,
  (busy) => {
    if (!busy && syncAsked.value) {
      syncAsked.value = false
      store.auth = 'ready'
    }
  },
)
function start() {
  toast(L('正在打开回顾…', 'ふりかえりを開いています…'), 'info')
}

/* 交接与分享 */
function copyLink(msg) {
  try {
    navigator.clipboard?.writeText(`https://${LINK}`)?.catch(() => {})
  } catch {
    /* 剪贴板不可用时只给出提示 */
  }
  toast(msg || L('链接已复制', 'リンクをコピーしました'))
}
const SHARES = computed(() => [
  { key: 'poster', icon: 'image', label: L('生成海报', 'ポスターを作成'), hint: '1080×1440' },
  { key: 'link', icon: 'link', label: L('分享链接', 'リンクを共有'), hint: L('30 天有效', '30 日間有効') },
  { key: 'danmaku', icon: 'community', label: L('发一条年度感想弹幕', '一年の感想を弾幕で送る'), hint: L('最多 30 字', '30 文字まで') },
])
const dmOpen = ref(false)
const dm = ref('')
const dmErr = ref('')
function share(key) {
  if (key === 'poster') toast(L('海报已生成：1080×1440', 'ポスターを作成しました：1080×1440'))
  else if (key === 'link') copyLink(L('分享链接已复制，30 天内有效', '共有リンクをコピーしました（30 日間有効）'))
  else dmOpen.value = true
}
function sendDm() {
  if (!dm.value.trim()) {
    dmErr.value = L('写点什么再发送。', '内容を入力してから送信してください。')
    document.getElementById('dm-text')?.focus()
    return
  }
  dmOpen.value = false
  dm.value = ''
  dmErr.value = ''
  toast(L('弹幕已发送', '弾幕を送信しました'))
}

/* 二维码占位：21×21，三个定位角 + 确定性填充 */
function finder(r, c) {
  for (const [or, oc] of [[0, 0], [0, 14], [14, 0]]) {
    const y = r - or
    const x = c - oc
    if (y < -1 || y > 7 || x < -1 || x > 7) continue
    if (y < 0 || y > 6 || x < 0 || x > 6) return false
    return Math.max(Math.abs(y - 3), Math.abs(x - 3)) !== 2
  }
  return null
}
const QR = Array.from({ length: 441 }, (_, i) => {
  const r = Math.floor(i / 21)
  const c = i % 21
  const f = finder(r, c)
  if (f !== null) return f
  if (r === 6 || c === 6) return (r + c) % 2 === 0
  return (((r * 73856093) ^ (c * 19349663)) >>> 0) % 7 < 3
})
</script>

<template>
  <div class="page">
    <div class="annual">
      <div class="info">
        <header class="intro only-desktop">
          <h1 class="t-display">{{ L('虹 2026 太鼓回顾', '虹 2026 太鼓ふりかえり') }}</h1>
          <p class="num range">{{ RANGE }}</p>
        </header>

        <!-- 入场：手机上始终显示；桌面只在条件未满足时显示 -->
        <section class="entry" :class="{ pending: !isReady }">
          <button type="button" class="btn btn-primary btn-lg btn-block start" :disabled="!isReady" @click="start">{{ L('开始回顾', 'ふりかえりを始める') }}</button>
          <ol class="checks" :aria-label="L('开始前的准备', '開始前の準備')">
            <li v-for="c in checklist" :key="c.key" :class="{ done: c.done, next: c.next }">
              <i class="note" :class="c.done ? 'ka' : c.next ? '' : 'ghost'" />
              <span class="grow">{{ c.label }}</span>
              <span v-if="c.done" class="ok"><Icon name="check" :size="16" /><span class="sr-only">{{ L('已完成', '完了') }}</span></span>
              <template v-else-if="c.next">
                <RouterLink v-if="c.to" :to="c.to" class="btn btn-primary btn-sm">{{ c.cta }}</RouterLink>
                <button v-else type="button" class="btn btn-primary btn-sm" :disabled="store.syncing" @click="sync">{{ store.syncing ? L('正在同步…', '同期中…') : c.cta }}</button>
              </template>
            </li>
          </ol>
        </section>

        <section>
          <h2 class="t-h2 sec-h">{{ L('五个章节', '5 つの章') }}</h2>
          <ol class="chapters">
            <li v-for="(c, i) in CHAPTERS" :key="c.name">
              <span class="num idx">{{ String(i + 1).padStart(2, '0') }}</span>
              <b class="cname">{{ c.name }}</b>
              <span v-if="isReady" class="teaser">
                <span v-if="c.pre" class="faint">{{ c.pre }}</span>
                <b v-if="c.v" class="num">{{ c.v }}</b>
                <b v-else :lang="c.ja ? 'ja' : undefined">{{ c.text }}</b>
                <span v-if="c.unit">{{ c.unit }}</span>
              </span>
              <span v-else class="teaser faint">—</span>
            </li>
          </ol>
        </section>

        <section class="panel handoff">
          <div class="qr" role="img" :aria-label="L('打开回顾的二维码', 'ふりかえりを開く QR コード')">
            <i v-for="(on, i) in QR" :key="i" :class="{ on }" />
          </div>
          <div class="handoff-copy">
            <h2 class="t-h2"><Icon name="phone" :size="20" />{{ L('用手机继续', 'スマートフォンで続ける') }}</h2>
            <p class="t-small">{{ L('回顾只在手机上播放。扫码后会直接打开你的回顾。', 'ふりかえりはスマートフォン専用です。QR コードを読み取ると、そのまま開きます。') }}</p>
            <div class="linkrow">
              <code class="num truncate">{{ LINK }}</code>
              <button type="button" class="btn btn-sm" @click="copyLink()"><Icon name="copy" :size="16" />{{ L('复制链接', 'リンクをコピー') }}</button>
            </div>
          </div>
        </section>

        <section>
          <h2 class="t-h2 sec-h">{{ L('分享', '共有') }}</h2>
          <div class="shares">
            <button v-for="s in SHARES" :key="s.key" type="button" class="share" :disabled="!isReady" @click="share(s.key)">
              <Icon :name="s.icon" :size="20" />
              <span class="grow"><b>{{ s.label }}</b><small class="num">{{ s.hint }}</small></span>
            </button>
          </div>
        </section>
      </div>

      <!-- 故事封面预览 -->
      <div class="stagecol">
        <figure class="phone" :aria-label="L('回顾封面预览', 'ふりかえり表紙のプレビュー')">
          <p class="p-label">{{ L('虹 2026 太鼓回顾', '虹 2026 太鼓ふりかえり') }}</p>
          <div>
            <p class="num p-year">2026</p>
            <p class="p-name">
              <template v-if="isAuthed"><b>{{ player.nickname }}</b><span v-if="isReady">{{ player.title }}</span></template>
              <b v-else>{{ L('你的 2026', 'あなたの 2026') }}</b>
            </p>
          </div>
          <Lane v-model="sel" :days="stripDays" compact />
          <dl class="p-stats">
            <div v-for="s in POSTER" :key="s.k">
              <dt>{{ s.k }}</dt>
              <dd class="num" :class="{ hi: s.hi && isReady }">{{ isReady ? s.v : '—' }}</dd>
            </div>
          </dl>
          <p class="num p-range">{{ RANGE }}</p>
        </figure>
      </div>
    </div>

    <Sheet :open="dmOpen" :title="L('发一条年度感想弹幕', '一年の感想を弾幕で送る')" :width="440" @close="dmOpen = false">
      <form id="dm-form" class="field" novalidate @submit.prevent="sendDm">
        <label for="dm-text">{{ L('年度感想', '一年の感想') }}</label>
        <textarea id="dm-text" v-model="dm" class="textarea" rows="2" maxlength="30" :aria-invalid="!!dmErr" :aria-describedby="dmErr ? 'dm-err' : 'dm-count'" @input="dmErr = ''" />
        <p v-if="dmErr" id="dm-err" class="field-error">{{ dmErr }}</p>
        <p v-else id="dm-count" class="field-hint num">{{ dm.length }} / 30</p>
      </form>
      <template #foot>
        <button type="button" class="btn" @click="dmOpen = false">{{ L('取消', 'キャンセル') }}</button>
        <button type="submit" form="dm-form" class="btn btn-primary">{{ L('发送弹幕', '弾幕を送信') }}</button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.annual {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 32px clamp(32px, 6vw, 96px);
  max-width: 1120px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 32px;
  min-width: 0;
  max-width: 620px;
}
.range {
  margin-top: 8px;
  font-size: var(--fs-18);
  color: var(--ink-2);
}
.sec-h {
  margin-bottom: 4px;
}

/* ---------- 入场清单 ---------- */
.entry {
  display: none;
}
.entry.pending {
  display: block;
}
.start {
  display: none;
}
.checks {
  border-top: 1px solid var(--line-strong);
}
.checks li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-3);
}
.checks li.done {
  color: var(--ink-2);
}
.checks li.next {
  color: var(--ink);
  font-weight: 700;
}
.checks .note {
  --n: 16px;
}
.ok {
  color: var(--ka-ink);
}

/* ---------- 章节 ---------- */
.chapters {
  border-top: 1px solid var(--line-strong);
}
.chapters li {
  display: grid;
  grid-template-columns: 28px auto minmax(0, 1fr);
  align-items: baseline;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
}
.idx {
  font-size: var(--fs-14);
  color: var(--ink-3);
}
.cname {
  font-size: var(--fs-18);
  font-weight: 900;
}
.teaser {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
  text-align: right;
}
.teaser b {
  color: var(--ink);
  font-size: var(--fs-14);
}
.teaser b.num {
  font-size: var(--fs-22);
  line-height: 1;
}

/* ---------- 交接到手机 ---------- */
.handoff {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  padding: 20px;
}
.qr {
  flex: none;
  display: grid;
  grid-template-columns: repeat(21, 5px);
  grid-auto-rows: 5px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  background: var(--surface);
}
.qr .on {
  background: var(--ink);
}
.handoff-copy {
  flex: 1 1 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.handoff-copy h2 {
  display: flex;
  align-items: center;
  gap: 8px;
}
.linkrow {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-top: 4px;
}
.linkrow code {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-13);
  line-height: 30px;
  color: var(--ink-2);
}

/* ---------- 分享 ---------- */
.shares {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.share {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctl);
  background: var(--surface);
  color: var(--ink-2);
  text-align: left;
  transition: background var(--dur-1), border-color var(--dur-1);
}
.share:hover {
  background: var(--surface-2);
  border-color: var(--ink-3);
}
.share[disabled] {
  opacity: 0.5;
  pointer-events: none;
}
.share .grow {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.share b {
  font-size: var(--fs-14);
  color: var(--ink);
}
.share small {
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.textarea[aria-invalid='true'] {
  border-color: var(--danger);
}

/* ---------- 手机封面 ---------- */
.stagecol {
  position: sticky;
  top: calc(var(--bar-h) + 24px);
}
.phone {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  width: 320px;
  min-height: 640px;
  padding: 52px 16px 24px;
  border-radius: 36px;
  background: var(--lane);
  color: var(--lane-ink);
  box-shadow: 0 0 0 6px var(--surface), 0 0 0 7px var(--line-strong);
}
.phone::before {
  /* 听筒 */
  content: '';
  position: absolute;
  top: 18px;
  left: 50%;
  width: 72px;
  height: 6px;
  margin-left: -36px;
  border-radius: var(--r-note);
  background: var(--lane-line);
}
.phone :deep(.lane) {
  border: 1px solid var(--lane-line);
}
.p-label {
  padding: 0 4px;
  font-size: var(--fs-13);
  font-weight: 700;
  color: color-mix(in srgb, var(--lane-ink) 70%, transparent);
}
.p-year {
  padding: 0 4px;
  font-size: 112px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.01em;
}
.p-name {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 12px;
  padding: 0 4px;
  font-size: var(--fs-13);
  color: color-mix(in srgb, var(--lane-ink) 70%, transparent);
}
.p-name b {
  font-size: var(--fs-22);
  font-weight: 900;
  color: var(--lane-ink);
}
.p-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--lane-line);
}
.p-stats div {
  display: flex;
  flex-direction: column-reverse;
  padding: 14px 4px 12px;
  border-bottom: 1px solid var(--lane-line);
}
.p-stats div:nth-child(even) {
  padding-left: 16px;
  border-left: 1px solid var(--lane-line);
}
.p-stats dd {
  font-size: var(--fs-36);
  font-weight: 700;
  line-height: 1;
}
.p-stats dd.hi {
  color: var(--roll);
}
.p-stats dt {
  margin-top: 6px;
  font-size: var(--fs-12);
  color: color-mix(in srgb, var(--lane-ink) 60%, transparent);
}
.p-range {
  padding: 0 4px;
  font-size: var(--fs-13);
  color: color-mix(in srgb, var(--lane-ink) 50%, transparent);
}

@media (max-width: 1099px) {
  .annual {
    gap: 32px;
  }
  .phone {
    width: 300px;
    min-height: 600px;
  }
}
@media (max-width: 767px) {
  .annual {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .info {
    gap: 28px;
    max-width: none;
  }
  .stagecol {
    position: static;
    order: -1;
  }
  .phone {
    width: 100%;
    min-height: 0;
    padding: 24px 16px 20px;
    border-radius: var(--r-panel);
    box-shadow: none;
  }
  .phone::before {
    display: none;
  }
  .p-year {
    font-size: 96px;
  }
  .entry,
  .entry.pending {
    display: block;
  }
  .start {
    display: inline-flex;
    margin-bottom: 12px;
  }
  .handoff {
    display: none;
  }
  .shares {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
