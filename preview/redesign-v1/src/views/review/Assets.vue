<script setup>
import { RouterLink } from 'vue-router'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'
import Cover from '../../components/Cover.vue'
import Diff from '../../components/Diff.vue'
import Crown from '../../components/Crown.vue'
import Rank from '../../components/Rank.vue'
import TitlePlate from '../../components/TitlePlate.vue'
import PlayerAvatar from '../../components/PlayerAvatar.vue'
import AssetsScope from '../../components/AssetsScope.vue'
import { store } from '../../store'
import { DIFFS, RANKS, CROWNS } from '../../mock/data'
import { PLATES, PLATE_SAMPLES, SITE_TITLE } from '../../mock/titles'

// 素材页（V1.3 Phase A）：评审用，不属于产品。逐个列出真实素材在每个尺寸档位、三种表面上的样子，
// 每项下面写素材来源与对应关系；每个组件有一条「版本 A → 版本 B、C」的前后对照。
// 这里的组件用 AssetsScope 固定画法，与右下角的对照版本开关无关；页面配色仍跟随对照版本（C 为 Viewer Teal）。

// 曲目对象只带组件需要的字段，与当前数据集无关
const REAL = { id: 615, ja: '天狗囃子', zh: '天狗配乐', genre: 'namco', coverOk: true }
const THUMB404 = { id: 1255, ja: '電脳幻夜の星言詠', zh: '电脑幻夜之星言咏唱', genre: 'namco', coverOk: true }
const SAMPLE = { id: 233, ja: '示例', zh: '示例', genre: 'vocaloid', coverOk: false }
const FAIL = { id: 615, ja: '天狗囃子', zh: '天狗配乐', genre: 'namco', coverOk: true }
const FAIL_BASE = 'game/__forced-failure__/' // 本地不存在的路径：缩略图与原图都 404，走完整降级链，不请求曲绘域名

const COVER_SIZES = [
  ['sm', 32],
  ['', 44],
  ['lg', 72],
  ['tile', 96],
  ['xl', 168],
]
const DIFF_FILES = [1, 2, 3, 4, 5].map((d) => ({ d, file: `public/game/diff/${d}.png`, src: `icons/diff/${d}.png` }))
const CROWN_ROWS = [
  { v: 2, file: 'dondaful.png', rule: '全良次数 > 0' },
  { v: 1, file: 'full.png', rule: '否则全连次数 > 0' },
  { v: 0, file: 'clear.png', rule: '否则通关次数 > 0' },
  { v: -1, file: null, rule: '有记录、三项都是 0 → 空心圆环' },
  { v: null, file: null, rule: '没有记录 →「—」' },
]
const CROWN_SIZES = [
  ['chip', 16, '筛选胶囊'],
  ['table', 18, '密集表格 / 手机列表'],
  ['', 22, '默认'],
  ['lg', 30, '歌曲详情成绩区'],
  ['xl', 48, '达成时刻'],
]
const RANK_VALUES = [2, 3, 4, 5, 6, 7, 8]
const RANK_SIZES = [
  [20, '小于 24px：写评价名'],
  [24, '列表占位（图按 28px 绘制）'],
  [30, '评价升级的新评价'],
  [44, '歌曲详情成绩区'],
]
const AV_SIZES = [24, 32, 44, 72, 96]
const AV_USER = { name: '年糕咚' }
const LONG_TITLE = { name: '心の底から「だだだ脱出！」とさけびたい日のための長い称号', plate: 42 }
const NOPLATE = { name: '手を叩きながら歩いていこう', plate: null }
const plateLabel = (p) => {
  const m = PLATES[p.plate]
  if (!m) return ''
  const req = { clear: '通关', full_combo: '全连', all_perfect: '全良' }[m.req]
  const scope = { unspecified: '不限难度', oni: '魔王', inner_oni: '魔王（里）', custom: '自定义' }[m.scope]
  const art = m.art ? ` · 右侧 ${Math.ceil(((m.w - m.art) * 220) / m.w)}px 是角色图，文字不进入` : ''
  return `${req} × ${scope} · 源图 ${m.w}×${m.h} → 显示 220×${Math.round((220 * m.h) / m.w)} · 文字段 ${m.band[0]}–${m.band[1]} 行${art}`
}
const SURFACES = [
  ['surface', '表面 --surface'],
  ['sunk', '下沉 --bg-sunk'],
  ['stage', '舞台面（深色）'],
]
</script>

<template>
  <div class="assets">
    <header class="top">
      <Logo :size="30" />
      <b class="grow">素材页 · Design V1.3</b>
      <RouterLink to="/review/compare" class="btn btn-sm"><Icon name="layers" :size="14" />三版对照</RouterLink>
      <RouterLink to="/review" class="btn btn-sm btn-ghost">设计总览</RouterLink>
    </header>

    <main class="wrap">
      <section class="intro">
        <h1>真实素材</h1>
        <p class="t-small">难度、王冠、评价、称号牌取自生产仓库 <code>origin/main f9b39e6</code> 的 <code>taiko_viewer/public/</code>，逐字节复制到 <code>public/game/</code>（见该目录的 README）。曲绘运行时从 <code>static.sakura-bot.cn</code> 加载，只限白名单曲目。每项先给版本 A（生成式）→ 版本 B、C（真实素材）的对照，再列尺寸档位与三种表面。当前主题：{{ store.theme }}，对照版本：{{ store.variant.toUpperCase() }}。</p>
      </section>

      <!-- ================= 曲绘 ================= -->
      <section aria-labelledby="a-cover">
        <h2 id="a-cover">曲绘 Cover</h2>
        <div class="ba">
          <AssetsScope mode="generated" class="ba-side"><span class="ba-k">A · 生成式</span><div class="row-wrap"><Cover :song="REAL" size="lg" /><Cover :song="SAMPLE" size="lg" /></div></AssetsScope>
          <Icon name="chevR" :size="18" class="ba-arrow" />
          <AssetsScope mode="authentic" class="ba-side"><span class="ba-k">B、C · 真实曲绘 / 示例占位</span><div class="row-wrap"><Cover :song="REAL" size="lg" /><Cover :song="SAMPLE" size="lg" /></div></AssetsScope>
        </div>
        <AssetsScope mode="authentic">
          <div class="grid">
            <figure v-for="s in COVER_SIZES" :key="'r' + s[1]">
              <Cover :song="REAL" :size="s[0]" priority />
              <figcaption><b>{{ s[1] }}px · 真实曲绘</b>cover/thumb/{200|400}/615.webp?v=0841 → cover/615.png</figcaption>
            </figure>
            <figure>
              <Cover :song="THUMB404" size="tile" priority />
              <figcaption><b>96px · 缩略图 404</b>1255：thumb 返回 404，退回原图 cover/1255.png；原图也失败时显示缺失占位</figcaption>
            </figure>
          </div>
          <div class="grid">
            <figure v-for="s in COVER_SIZES" :key="'s' + s[1]">
              <Cover :song="SAMPLE" :size="s[0]" />
              <figcaption><b>{{ s[1] }}px · 示例曲目</b>合成或未验证的曲目：不请求图片，45° 斜纹；≥ 96px 写「示例」</figcaption>
            </figure>
            <figure v-for="s in COVER_SIZES.slice(1, 4)" :key="'f' + s[1]">
              <Cover :song="FAIL" :size="s[0]" :base="FAIL_BASE" priority />
              <figcaption><b>{{ s[1] }}px · 强制失败</b>缩略图与原图都加载失败 → 缺失占位「没有曲绘」（本地不存在的路径，不请求曲绘域名）</figcaption>
            </figure>
          </div>
          <div class="surfaces">
            <div v-for="sf in SURFACES" :key="sf[0]" class="sf" :class="sf[0] === 'stage' ? 'stage' : sf[0]">
              <span class="sf-k">{{ sf[1] }}</span>
              <div class="row-wrap"><Cover :song="REAL" size="lg" priority /><Cover :song="SAMPLE" size="lg" /><Cover :song="FAIL" size="lg" :base="FAIL_BASE" priority /></div>
            </div>
          </div>
        </AssetsScope>
      </section>

      <!-- ================= 难度 ================= -->
      <section aria-labelledby="a-diff">
        <h2 id="a-diff">难度 Diff</h2>
        <div class="ba">
          <AssetsScope mode="generated" class="ba-side"><span class="ba-k">A · 难度色实色块</span><div class="row-wrap"><Diff :d="4" :star="9" :constant="9.36" short /><Diff :d="5" :star="10" :constant="10.42" short /></div></AssetsScope>
          <Icon name="chevR" :size="18" class="ba-arrow" />
          <AssetsScope mode="authentic" class="ba-side"><span class="ba-k">B、C · 图标 + ★ + 定数</span><div class="row-wrap"><Diff :d="4" :star="9" :constant="9.36" short /><Diff :d="5" :star="10" :constant="10.42" short /></div></AssetsScope>
        </div>
        <AssetsScope mode="authentic">
          <div class="grid">
            <figure v-for="f in DIFF_FILES" :key="f.d">
              <div class="row-wrap">
                <Diff :d="f.d" :star="f.d + 4" :constant="f.d >= 3 ? 8.5 + f.d : null" show-missing />
                <Diff :d="f.d" :star="f.d + 4" lg />
                <img :src="`game/diff/${f.d}.png`" alt="" width="26" height="26" class="contain" />
              </div>
              <figcaption><b>{{ DIFFS[f.d].zh }} · 18 / 22 / 26px</b>{{ f.file }} ← {{ f.src }}</figcaption>
            </figure>
          </div>
          <div class="tabsdemo" role="tablist" aria-label="难度页签示例">
            <button v-for="d in [3, 4, 5]" :key="d" type="button" role="tab" class="diff-tab authentic" :class="DIFFS[d].key" :aria-selected="d === 4">
              <img class="dt-ico" :src="`game/diff/${d}.png`" alt="" width="26" height="26" />
              <span class="dn">{{ DIFFS[d].zh }}</span><span class="ds num">★{{ d + 5 }}</span><span class="dk num">{{ (d + 6.4).toFixed(2) }}</span>
            </button>
          </div>
          <p class="t-caption memo">页签选中：B 为该难度色 2px 描边 + 14% 浅底；C 为 --selected-line + --selected-bg。两者都有底部指示线，选中不靠图标颜色。</p>
          <div class="surfaces">
            <div v-for="sf in SURFACES" :key="sf[0]" class="sf" :class="sf[0] === 'stage' ? 'stage' : sf[0]">
              <span class="sf-k">{{ sf[1] }}</span>
              <div class="row-wrap"><Diff v-for="d in 5" :key="d" :d="d" :star="d + 4" short /></div>
            </div>
          </div>
        </AssetsScope>
      </section>

      <!-- ================= 王冠 ================= -->
      <section aria-labelledby="a-crown">
        <h2 id="a-crown">王冠 Crown</h2>
        <div class="ba">
          <AssetsScope mode="generated" class="ba-side"><span class="ba-k">A · 遮罩王冠</span><div class="row-wrap"><Crown v-for="c in CROWN_ROWS" :key="String(c.v)" :v="c.v" /></div></AssetsScope>
          <Icon name="chevR" :size="18" class="ba-arrow" />
          <AssetsScope mode="authentic" class="ba-side"><span class="ba-k">B、C · 素材</span><div class="row-wrap"><Crown v-for="c in CROWN_ROWS" :key="String(c.v)" :v="c.v" /></div></AssetsScope>
        </div>
        <AssetsScope mode="authentic">
          <div class="grid">
            <figure v-for="c in CROWN_ROWS" :key="String(c.v)">
              <div class="row-wrap"><Crown v-for="s in CROWN_SIZES" :key="s[0]" :v="c.v" :size="s[0]" /></div>
              <figcaption><b>{{ c.v == null ? '未游玩' : CROWNS[c.v].zh }} · 16 / 18 / 22 / 30 / 48px</b>{{ c.file ? 'public/game/crown/' + c.file + ' ← icons/crown/' + c.file : '不用图片' }} · {{ c.rule }}</figcaption>
            </figure>
          </div>
          <p class="t-caption memo">尺寸：<span v-for="s in CROWN_SIZES" :key="s[0]">{{ s[1] }}px {{ s[2] }}；</span>点灯进度的格子仍是色块（--crown-*）。</p>
          <div class="surfaces">
            <div v-for="sf in SURFACES" :key="sf[0]" class="sf" :class="sf[0] === 'stage' ? 'stage' : sf[0]">
              <span class="sf-k">{{ sf[1] }}</span>
              <div class="row-wrap"><Crown v-for="c in CROWN_ROWS" :key="String(c.v)" :v="c.v" size="lg" /></div>
            </div>
          </div>
        </AssetsScope>
      </section>

      <!-- ================= 评价 ================= -->
      <section aria-labelledby="a-rank">
        <h2 id="a-rank">评价 Rank</h2>
        <div class="ba">
          <AssetsScope mode="generated" class="ba-side"><span class="ba-k">A · 圆圈 + 字</span><div class="row-wrap"><Rank v-for="v in [0, 1, ...RANK_VALUES]" :key="v" :v="v" /></div></AssetsScope>
          <Icon name="chevR" :size="18" class="ba-arrow" />
          <AssetsScope mode="authentic" class="ba-side"><span class="ba-k">B、C · 素材</span><div class="row-wrap"><Rank v-for="v in [0, 1, ...RANK_VALUES]" :key="v" :v="v" /></div></AssetsScope>
        </div>
        <AssetsScope mode="authentic">
          <div class="grid">
            <figure v-for="v in RANK_VALUES" :key="v">
              <div class="row-wrap"><Rank v-for="s in RANK_SIZES" :key="s[0]" :v="v" :px="s[0]" /></div>
              <figcaption><b>{{ RANKS[v].zh }} · 值 {{ v }}</b>public/game/rank/{{ v }}.png ← icons/rank/{{ v }}.png</figcaption>
            </figure>
            <figure>
              <div class="row-wrap"><Rank :v="0" /><Rank :v="1" /></div>
              <figcaption><b>值 0 / 1</b>都显示「—」，可访问名称分别是「未设置」「未取得」；rank/1.png 是全透明图，不加载</figcaption>
            </figure>
            <figure>
              <div class="row-wrap"><Rank :v="6" :px="24" /><span class="up-arrow">→</span><Rank :v="7" :px="30" /></div>
              <figcaption><b>评价升级</b>原评价 24px → 新评价 30px，箭头 --ink-3</figcaption>
            </figure>
          </div>
          <p class="t-caption memo">档位：<span v-for="s in RANK_SIZES" :key="s[0]">{{ s[0] }}px {{ s[1] }}；</span></p>
          <div class="surfaces">
            <div v-for="sf in SURFACES" :key="sf[0]" class="sf" :class="sf[0] === 'stage' ? 'stage' : sf[0]">
              <span class="sf-k">{{ sf[1] }}</span>
              <div class="row-wrap"><Rank v-for="v in RANK_VALUES" :key="v" :v="v" /></div>
            </div>
          </div>
        </AssetsScope>
      </section>

      <!-- ================= 称号 ================= -->
      <section aria-labelledby="a-title">
        <h2 id="a-title">称号 Title</h2>
        <div class="ba">
          <AssetsScope mode="generated" class="ba-side"><span class="ba-k">A · 一种铭牌</span><div class="row-wrap"><TitlePlate text="精度调律师" /><TitlePlate text="全良猎人" /></div></AssetsScope>
          <Icon name="chevR" :size="18" class="ba-arrow" />
          <AssetsScope mode="authentic" class="ba-side"><span class="ba-k">B、C · 游戏称号牌 / 文字 / 站内称号</span><div class="row-wrap"><TitlePlate :game="{ name: 'きたさいたまの達人', plate: 42 }" form="plate" /><TitlePlate :game="{ name: 'きたさいたまの達人', plate: 42 }" form="text" /><TitlePlate :game="null" :site="SITE_TITLE" /></div></AssetsScope>
        </div>
        <AssetsScope mode="authentic">
          <div class="grid plates">
            <figure v-for="p in PLATE_SAMPLES" :key="String(p.plate)">
              <TitlePlate :game="{ name: p.name || '　', plate: p.plate }" form="plate" />
              <figcaption><b>{{ p.name || '（关系表里没有使用这张牌面）' }}</b>{{ plateLabel(p) }} · public/game/plate/{{ PLATES[p.plate].src.split('/').pop() }}</figcaption>
            </figure>
            <figure>
              <TitlePlate :game="LONG_TITLE" form="plate" />
              <figcaption><b>太长：退回文字形式</b>12px → 10px 仍放不进文字段（扣掉角色图）时只显示文字，完整称号在 title 里</figcaption>
            </figure>
            <figure>
              <TitlePlate :game="NOPLATE" form="plate" />
              <figcaption><b>没有牌面</b>全连 × 简单：清单里没有这种组合，只显示 --ink-2 文字</figcaption>
            </figure>
            <figure>
              <TitlePlate :game="{ name: 'わさびの達人', plate: 42 }" form="text" />
              <figcaption><b>窄位置</b>帖子列表行、回复行、达人榜、搜索结果：--ink-3 / 12px 文字，单行截断</figcaption>
            </figure>
            <figure>
              <TitlePlate :game="null" :site="SITE_TITLE" />
              <figcaption><b>站内称号 · {{ SITE_TITLE.name }}</b>AccountTitle（{{ SITE_TITLE.key }}）：中性小标签 + 左侧 3px 彩虹竖条，不套牌面</figcaption>
            </figure>
          </div>
          <div class="surfaces">
            <div v-for="sf in SURFACES" :key="sf[0]" class="sf" :class="sf[0] === 'stage' ? 'stage' : sf[0]">
              <span class="sf-k">{{ sf[1] }}</span>
              <div class="col"><TitlePlate :game="{ name: 'フルコンボの達人', plate: 2 }" form="plate" /><TitlePlate :game="{ name: 'トロいか2000', plate: 43 }" form="plate" /><TitlePlate :game="{ name: '博歌乐爱好者', plate: 'custom_rainbow' }" form="plate" /></div>
            </div>
          </div>
        </AssetsScope>
      </section>

      <!-- ================= 头像 ================= -->
      <section aria-labelledby="a-avatar">
        <h2 id="a-avatar">头像 PlayerAvatar</h2>
        <div class="ba">
          <AssetsScope mode="generated" class="ba-side"><span class="ba-k">A · 随机色相鼓面 + 段位鼓缘</span><div class="row-wrap"><PlayerAvatar name="年糕咚" :hue="12" dan="九段" :size="44" /><PlayerAvatar name="疾风连打" :hue="205" dan="达人" :size="44" /></div></AssetsScope>
          <Icon name="chevR" :size="18" class="ba-arrow" />
          <AssetsScope mode="authentic" class="ba-side"><span class="ba-k">C+ · 正式站默认头像</span><div class="row-wrap"><PlayerAvatar name="年糕咚" :size="44" /><PlayerAvatar name="疾风连打" :size="44" /></div></AssetsScope>
        </div>
        <AssetsScope mode="authentic">
          <div class="grid">
            <figure>
              <div class="row-wrap"><PlayerAvatar v-for="s in AV_SIZES" :key="s" :user="AV_USER" :size="s" /></div>
              <figcaption><b>没有头像 · 24 / 32 / 44 / 72 / 96px</b>正式站 /default-avatar.svg 原样显示（public/game/avatar/default-avatar.svg ← taiko_viewer/public/default-avatar.svg）；原型里所有模拟玩家都是这一种</figcaption>
            </figure>
            <figure>
              <div class="row-wrap"><PlayerAvatar v-for="s in [32, 44, 72]" :key="s" :user="AV_USER" src="game/avatar/miku.png" :size="s" /></div>
              <figcaption><b>正式站默认头像 · miku.png</b>论坛接口的回落图（443×402，不是正方形）。只在这里演示「有头像」状态，不代表任何玩家</figcaption>
            </figure>
            <figure>
              <div class="row-wrap"><PlayerAvatar :user="AV_USER" src="game/__forced-failure__/a.png" :size="44" /></div>
              <figcaption><b>图片加载失败</b>退回默认头像 default-avatar.svg</figcaption>
            </figure>
          </div>
          <div class="surfaces">
            <div v-for="sf in SURFACES" :key="sf[0]" class="sf" :class="sf[0] === 'stage' ? 'stage' : sf[0]">
              <span class="sf-k">{{ sf[1] }}</span>
              <div class="row-wrap"><PlayerAvatar :user="AV_USER" :size="32" /><PlayerAvatar :user="AV_USER" :size="44" /><PlayerAvatar :user="AV_USER" src="game/avatar/miku.png" :size="44" /><PlayerAvatar :user="AV_USER" src="game/avatar/default-avatar.svg" :size="44" /></div>
            </div>
          </div>
        </AssetsScope>
      </section>
    </main>
  </div>
</template>

<style scoped>
.assets {
  min-height: 100dvh;
  background: var(--bg);
}
.top {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--bar-h);
  padding: 0 var(--gutter);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.top b {
  min-width: 0;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px var(--gutter) 96px;
  display: flex;
  flex-direction: column;
  gap: 44px;
}
.intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 820px;
}
h1 {
  font-size: var(--fs-32, 2rem);
  font-weight: 900;
}
h2 {
  margin-bottom: 14px;
  font-size: var(--fs-20, 1.25rem);
  font-weight: 900;
}
section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ba {
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex-wrap: wrap;
}
.ba-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  min-width: 0;
}
.ba-k,
.sf-k {
  font-size: var(--fs-12);
  font-weight: 700;
  color: var(--ink-2);
}
.ba-arrow {
  align-self: center;
  color: var(--ink-3);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 4px;
}
.grid.plates {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}
figure {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
figcaption {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  font-size: var(--fs-12);
  color: var(--ink-3);
  overflow-wrap: anywhere;
}
figcaption b {
  color: var(--ink);
  font-size: var(--fs-13);
}
.row-wrap {
  align-items: center;
}
.col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.contain {
  object-fit: contain;
}
.tabsdemo {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.memo {
  color: var(--ink-3);
}
.up-arrow {
  color: var(--ink-3);
  font-size: var(--fs-12);
}
.surfaces {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.sf {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border-radius: var(--r-panel);
  border: 1px solid var(--line);
}
.sf.surface {
  background: var(--surface);
}
.sf.sunk {
  background: var(--bg-sunk);
}
code {
  font-size: 0.92em;
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .surfaces {
    grid-template-columns: minmax(0, 1fr);
  }
  .grid,
  .grid.plates {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
