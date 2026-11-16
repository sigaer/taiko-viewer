<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Logo from '../../components/Logo.vue'
import Icon from '../../components/Icon.vue'

const liveDesk = ref(null)
const scale = ref(0.4)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => (scale.value = e.contentRect.width / 1440))
  ro.observe(liveDesk.value)
})
onBeforeUnmount(() => ro?.disconnect())

// 三个设计方向。A 直接嵌入真实原型；B、C 是为了比较而画的概念稿（只画到能判断方向的程度）。
const base = `${location.pathname}${location.search}#`
const CRIT = [
  ['高频查询效率', 5, 3, 2, '查歌、查定数、看成绩要几步'],
  ['数据密度与可读性', 5, 2, 3, '表格、图表、长列表是否耐读'],
  ['成长叙事', 4, 2, 5, '能否让人看见「我在变强」'],
  ['社区氛围', 3, 5, 3, '是否让人想发帖、想停留'],
  ['辨识度', 4, 5, 4, '离开 logo 还能不能认出来'],
  ['与官方视觉的距离', 4, 1, 5, '避免看起来像游戏官方页面'],
  ['中日双语与长文本', 5, 3, 3, '日文标签更长、曲名很长时是否稳'],
  ['实现成本（点越多越省）', 4, 3, 2, '基于 Nuxt 3 + Element Plus 迁移'],
]
</script>

<template>
  <div class="dir">
    <header class="top">
      <RouterLink to="/review" class="row home"><Logo :size="30" /><b>设计总览</b></RouterLink>
      <span class="grow" />
      <RouterLink to="/review/system" class="btn btn-sm">Design System V1.2</RouterLink>
    </header>

    <main class="wrap">
      <section class="lede">
        <h1>三个方向</h1>
        <p>三个方向不是三套配色。它们对「Viewer 首先是什么」给出了三种不同的回答：一台查询与分析的仪器、一个热闹的玩家广场、一本私人的练习帖。导航、首页、内容密度和交互方式都随之不同。</p>
      </section>

      <!-- ======================= A ======================= -->
      <section class="board a" aria-label="方向 A：譜面">
        <div class="spec">
          <p class="letter">A</p>
          <h2>譜面 <small>Fumen</small></h2>
          <p class="idea">Viewer 是一台仪器。玩家数据用谱面自己的语言来画：朱色的咚、浅葱的咔、山吹的连打，时间是一条从左往右的谱面带。</p>
          <dl>
            <dt>气质</dt><dd>精确、安静、有游戏的骨架但不卖萌</dd>
            <dt>色彩</dt><dd><span class="sw a-ink" />藍墨 <span class="sw a-don" />朱 <span class="sw a-ka" />浅葱 <span class="sw a-roll" />山吹 <span class="sw line a-paper" />冷白纸</dd>
            <dt>字体</dt><dd>汉字用思源黑体重磅做层级，数字全部用 Barlow Condensed 等宽数字</dd>
            <dt>导航</dt><dd>桌面左侧窄轨 6 个目的地，二级页签并入顶栏；全局搜索 / Ctrl K 是第一入口。手机底栏正中是「咚」搜索键</dd>
            <dt>密度</dt><dd>高。表格、点灯表、分面筛选为主，卡片很少</dd>
            <dt>桌面</dt><dd>主栏 + 吸顶侧栏（我的成绩、检视面板），宽屏不留白</dd>
            <dt>手机</dt><dd>表格换成列表行，对话框换成底部抽屉，「我的成绩」提到最前</dd>
          </dl>
          <div class="pc">
            <div><h3>为什么适合</h3><ul><li>查歌、看定数、对成绩是最高频的事，这个方向为它们各省了一到两步</li><li>音符三色本身就是数据编码，不需要另造一套图例</li><li>深色谱面带在浅色和深色主题里都成立</li></ul></div>
            <div><h3>代价</h3><ul><li>第一眼不如 B 热闹，新玩家可能觉得「专业」</li><li>签名元素只有一个，必须克制使用，否则会变成装饰</li></ul></div>
          </div>
          <a :href="base + '/'" class="btn btn-primary open">打开这个方向的完整原型</a>
        </div>
        <div class="mocks">
          <div ref="liveDesk" class="desk live"><iframe :src="base + '/'" title="A 方向桌面原型（预览）" loading="lazy" tabindex="-1" inert aria-hidden="true" :style="{ transform: `scale(${scale})` }" /></div>
          <div class="mob live"><iframe :src="base + '/songs/615'" title="A 方向手机原型（预览）" loading="lazy" tabindex="-1" inert aria-hidden="true" /></div>
        </div>
      </section>

      <!-- ======================= B ======================= -->
      <section class="board b" aria-label="方向 B：祭">
        <div class="spec">
          <p class="letter">B</p>
          <h2>祭 <small>Matsuri</small></h2>
          <p class="idea">Viewer 是一个庙会。首页是大家正在发生的事，功能是一排排色彩鲜明的摊位，成绩像贴纸一样被贴出来炫耀。</p>
          <dl>
            <dt>气质</dt><dd>热闹、直接、亲切，像机厅门口的海报</dd>
            <dt>色彩</dt><dd><span class="sw b-sw-red" />朱赤 <span class="sw b-sw-yel" />山吹 <span class="sw b-sw-blue" />群青 <span class="sw line b-sw-paper" />生成 <span class="sw b-sw-ink" />墨</dd>
            <dt>字体</dt><dd>超粗黑体标题、3px 墨线描边、硬投影贴纸</dd>
            <dt>导航</dt><dd>顶部一排大号胶囊导航；首页是「大格子 + 动态流」；社区在第二位</dd>
            <dt>密度</dt><dd>低到中。一屏 4–6 个大块，数据被做成卡片和徽章</dd>
            <dt>桌面</dt><dd>居中 1200 栏，两侧留色块装饰</dd>
            <dt>手机</dt><dd>最自然的形态，2×2 大格子 + 粗底栏</dd>
          </dl>
          <div class="pc">
            <div><h3>为什么适合</h3><ul><li>社区和晒分的氛围最好，新玩家上手门槛最低</li><li>识别度极高</li></ul></div>
            <div><h3>缺点</h3><ul><li>和游戏官方的视觉太近，容易被当成官方页面</li><li>800 多条成绩的表格、六维对比在这套语言里很难排得清楚</li><li>高饱和大色块长时间看会累，深色模式很难做</li></ul></div>
          </div>
        </div>
        <div class="mocks">
          <div class="desk bm" role="img" aria-label="B 方向桌面概念稿">
            <div class="b-nav"><b class="b-logo">VIEWER</b><i class="on">首页</i><i>社区</i><i>曲库</i><i>我的</i><i>工具</i><span class="b-btn">登录</span></div>
            <div class="b-hero"><b>今天也来<br />咚一下！</b><div class="b-search">搜一首歌</div><span class="b-don" /></div>
            <div class="b-tiles"><i class="t1">查歌<small>1,412 首</small></i><i class="t2">我的战绩<small>RT 11.97</small></i><i class="t3">段位道场<small>虹 2026</small></i><i class="t4">晒分区<small>今日 86 帖</small></i></div>
            <div class="b-feed"><div class="b-card"><b>幽玄ノ乱 全良达成！</b><span>历时 14 个月</span><em>全良</em></div><div class="b-card"><b>十段课题曲逐首分析</b><span>44 回复</span><em class="g">攻略</em></div></div>
          </div>
          <div class="mob bm" role="img" aria-label="B 方向手机概念稿">
            <div class="b-mhead"><b class="b-logo">VIEWER</b></div>
            <div class="b-hero m"><b>今天也来<br />咚一下！</b></div>
            <div class="b-tiles m"><i class="t1">查歌</i><i class="t2">战绩</i><i class="t3">段位</i><i class="t4">晒分</i></div>
            <div class="b-card"><b>幽玄ノ乱 全良达成！</b><em>全良</em></div>
            <div class="b-tab"><i class="on" /><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <!-- ======================= C ======================= -->
      <section class="board c" aria-label="方向 C：帖">
        <div class="spec">
          <p class="letter">C</p>
          <h2>帖 <small>Chō</small></h2>
          <p class="idea">Viewer 是一本练习帖。每天一页，写着今天打了什么；王冠和评价是盖在页上的朱印，成长档案就是这本帖子翻回去看。</p>
          <dl>
            <dt>气质</dt><dd>沉静、私人、有纸和印泥的质感</dd>
            <dt>色彩</dt><dd><span class="sw line c-sw-paper" />和纸白 <span class="sw c-sw-ink" />墨 <span class="sw c-sw-seal" />朱印 <span class="sw c-sw-grey" />藍鼠</dd>
            <dt>字体</dt><dd>宋体 / 明朝体标题，竖排日期与章节名，正文黑体</dd>
            <dt>导航</dt><dd>只有四项：今日帖、曲目、帖簿、寄合；内容沿一条竖直的日期脊线展开</dd>
            <dt>密度</dt><dd>中。单栏叙事，数字作为页边批注出现</dd>
            <dt>桌面</dt><dd>窄正文 + 宽页边，页边放数据批注</dd>
            <dt>手机</dt><dd>天然单栏，接近日记应用</dd>
          </dl>
          <div class="pc">
            <div><h3>为什么适合</h3><ul><li>和现有成长模块温和、不评判的文案语气最契合</li><li>「朱印」是很好的达成反馈</li></ul></div>
            <div><h3>缺点</h3><ul><li>查一首歌的定数要先穿过叙事，高频查询变慢</li><li>竖排和宋体对中日双语、长曲名、表格都不友好</li><li>社区、工具、开发者页面很难放进「帖子」这个隐喻</li></ul></div>
          </div>
        </div>
        <div class="mocks">
          <div class="desk cm" role="img" aria-label="C 方向桌面概念稿">
            <div class="c-spine"><b>練習帖</b><span>令和八年 霜月</span></div>
            <div class="c-page">
              <p class="c-date">十一月十六日　月曜</p>
              <h4>今天碰了十六张谱，千本桜终于全良了。</h4>
              <div class="c-entry"><i class="c-stamp">全良</i><div><b>千本桜（裏）</b><span>1,004,290　第三十一次</span></div></div>
              <div class="c-entry"><i class="c-stamp v">紫雅</i><div><b>白鳥の湖</b><span>953,120　从粉雅升上来</span></div></div>
              <div class="c-entry"><i class="c-dot" /><div><b>天狗囃子</b><span>不可 七 → 三</span></div></div>
              <p class="c-date">十一月十五日　日曜</p>
              <div class="c-entry"><i class="c-dot" /><div><b>Night of Knights</b><span>971,840　刷新</span></div></div>
            </div>
            <div class="c-margin"><span>Rating</span><b>11.97</b><span>近三十日 +0.31</span><hr /><span>留意</span><b class="s">高速处理</b><hr /><span>在练</span><b class="s">天狗囃子 全连</b></div>
          </div>
          <div class="mob cm" role="img" aria-label="C 方向手机概念稿">
            <div class="c-mhead"><b>今日帖</b><span>霜月十六日</span></div>
            <div class="c-page m">
              <h4>千本桜终于全良了。</h4>
              <div class="c-entry"><i class="c-stamp">全良</i><div><b>千本桜（裏）</b><span>1,004,290</span></div></div>
              <div class="c-entry"><i class="c-stamp v">紫雅</i><div><b>白鳥の湖</b><span>953,120</span></div></div>
              <div class="c-entry"><i class="c-dot" /><div><b>天狗囃子</b><span>不可 七 → 三</span></div></div>
            </div>
            <div class="c-tab"><i class="on">帖</i><i>曲</i><i>簿</i><i>寄</i></div>
          </div>
        </div>
      </section>

      <!-- ======================= 对比 ======================= -->
      <section class="cmp" aria-labelledby="dir-cmp">
        <h2 id="dir-cmp">放在一起比</h2>
        <div class="scroll-x">
          <table class="dt">
            <caption class="sr-only">三个方向在八个维度上的评分，满分 5</caption>
            <thead><tr><th scope="col">维度</th><th scope="col" class="c">A 譜面</th><th scope="col" class="c">B 祭</th><th scope="col" class="c">C 帖</th><th scope="col" class="only-desktop">看的是什么</th></tr></thead>
            <tbody>
              <tr v-for="r in CRIT" :key="r[0]">
                <th scope="row" class="dim">{{ r[0] }}</th>
                <td v-for="k in 3" :key="k" class="c"><span class="dots" role="img" :aria-label="r[k] + ' / 5'"><i v-for="n in 5" :key="n" :class="{ on: n <= r[k], a: k === 1 }" aria-hidden="true" /></span></td>
                <td class="only-desktop muted">{{ r[4] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="pick" aria-labelledby="dir-pick">
        <h2 id="dir-pick">选 A，并从另外两个方向各拿一样东西</h2>
        <div class="pick-grid">
          <p>Viewer 的日常是「查一首歌」「看一眼成绩」「同步之后看看有什么变化」。这三件事都是数据问题，而且发生在机厅里、手机上、两首歌之间。A 是唯一把这三件事都缩到一步的方向，同时它的视觉语言直接来自谱面，不需要借官方的角色和插画来获得辨识度。</p>
          <ul>
            <li><Icon name="check" :size="18" /><span><b>从 B 拿：击打的手感。</b>手机底栏正中的「咚」键、达成新王冠时的一次回弹动效。只在「确认」和「达成」两个时刻出现。</span></li>
            <li><Icon name="check" :size="18" /><span><b>从 C 拿：叙事的语气。</b>每周回顾的一句主题、成长档案里的「精彩时刻」、不评判的状态文案，全部沿用现有成长模块的口吻。</span></li>
            <li><Icon name="check" :size="18" /><span><b>不拿的：</b>B 的高饱和大色块和描边贴纸（与官方视觉太近、数据排不清楚）；C 的竖排与宋体（双语和表格吃亏）。</span></li>
          </ul>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.top {
  position: sticky;
  top: 0;
  z-index: var(--z-bar);
  display: flex;
  align-items: center;
  height: var(--bar-h);
  padding: 0 var(--gutter);
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.dir {
  min-height: 100dvh;
  background: var(--bg);
}
.home {
  gap: 10px;
  min-height: var(--hit);
}
.wrap {
  max-width: 1360px;
  margin: 0 auto;
  padding: 48px var(--gutter) 96px;
}
.lede {
  max-width: 760px;
  margin-bottom: 24px;
}
h1 {
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 900;
  line-height: 1.15;
  margin-bottom: 14px;
}
.lede p {
  font-size: var(--fs-16);
  color: var(--ink-2);
}
.board {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 48px;
  padding: 48px 0;
  border-top: 1px solid var(--line-strong);
  align-items: start;
}
.letter {
  font-family: var(--font-num);
  font-size: var(--fs-64);
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
  color: var(--ink-3);
}
.a .letter {
  color: var(--don);
}
h2 {
  font-size: var(--fs-36);
  font-weight: 900;
  line-height: 1.2;
}
h2 small {
  font-family: var(--font-num);
  font-size: var(--fs-22);
  font-weight: 600;
  color: var(--ink-3);
  margin-left: 6px;
}
.idea {
  margin: 12px 0 20px;
  font-size: var(--fs-16);
}
dl {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px 14px;
  font-size: var(--fs-13);
}
dt {
  color: var(--ink-3);
}
dd {
  color: var(--ink-2);
}
.sw {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  vertical-align: -2px;
  margin: 0 3px 0 6px;
}
.sw:first-child {
  margin-left: 0;
}
.sw.line {
  box-shadow: inset 0 0 0 1px var(--line-strong);
}
/* A 的色板就是当前 token */
.a-ink {
  background: var(--ink);
}
.a-don {
  background: var(--don);
}
.a-ka {
  background: var(--ka);
}
.a-roll {
  background: var(--roll);
}
.a-paper {
  background: var(--bg);
}
.pc {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin: 24px 0;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.pc h3 {
  font-size: var(--fs-13);
  font-weight: 700;
  margin-bottom: 6px;
}
.pc ul {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
  list-style: disc;
  font-size: var(--fs-13);
  color: var(--ink-2);
}

/* ---------- 概念稿舞台 ---------- */
.mocks {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  min-width: 0;
}
.desk {
  position: relative;
  flex: 1;
  min-width: 0;
  aspect-ratio: 16 / 10;
  border-radius: var(--r-panel);
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--line-strong), var(--shadow-lift);
}
.mob {
  position: relative;
  width: 172px;
  aspect-ratio: 390 / 800;
  border-radius: var(--r-sheet);
  overflow: hidden;
  flex: none;
  box-shadow: 0 0 0 5px var(--note-outline), var(--shadow-lift);
}
.live iframe {
  position: absolute;
  left: 0;
  top: 0;
  border: 0;
  transform-origin: 0 0;
  pointer-events: none;
}
.desk.live iframe {
  width: 1440px;
  height: 900px;
}
.mob.live iframe {
  width: 390px;
  height: 800px;
  transform: scale(calc(172 / 390));
}

/* ---------- B 祭 ----------
   概念稿自带的配色（朱赤 / 山吹 / 群青 / 生成 / 墨），按裁决 D1 允许硬编码色值，
   不随主题变化，也不进入 Design System token。 */
.b-sw-red {
  background: #e63b2e;
}
.b-sw-yel {
  background: #ffc400;
}
.b-sw-blue {
  background: #1f3fbf;
}
.b-sw-paper {
  background: #fff6e0;
}
.b-sw-ink {
  background: #1a1a1a;
}
.bm {
  --b-red: #e63b2e;
  --b-yel: #ffc400;
  --b-blue: #1f3fbf;
  --b-paper: #fff6e0;
  --b-ink: #1a1a1a;
  background: var(--b-paper);
  color: var(--b-ink);
  font-weight: 900;
  font-size: 10px;
  line-height: 1.2;
}
.desk.bm {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  grid-template-rows: auto 1fr auto;
  gap: 10px 12px;
  padding: 10px 14px 12px;
}
.b-nav {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.b-logo {
  margin-right: auto;
  font-size: 15px;
  letter-spacing: 0.02em;
  color: var(--b-red);
  text-shadow: 1.5px 1.5px 0 var(--b-ink);
}
.b-nav i {
  font-style: normal;
  padding: 4px 10px;
  border: 2px solid var(--b-ink);
  border-radius: 99px;
  background: #fff;
}
.b-nav i.on {
  background: var(--b-yel);
  box-shadow: 2px 2px 0 var(--b-ink);
}
.b-btn {
  padding: 4px 10px;
  border-radius: 99px;
  background: var(--b-ink);
  color: #fff;
}
.b-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 14px 16px;
  border: 3px solid var(--b-ink);
  border-radius: 18px;
  background: var(--b-red);
  color: #fff;
  box-shadow: 4px 4px 0 var(--b-ink);
  overflow: hidden;
}
.b-hero b {
  font-size: 26px;
  line-height: 1.1;
}
.b-search {
  width: 70%;
  padding: 7px 12px;
  border: 2px solid var(--b-ink);
  border-radius: 99px;
  background: #fff;
  color: #888;
  font-weight: 500;
}
.b-don {
  position: absolute;
  right: -26px;
  bottom: -30px;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  background: var(--b-yel);
  border: 3px solid var(--b-ink);
  box-shadow: inset 0 0 0 10px #fff, inset 0 0 0 13px var(--b-ink);
}
.b-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.b-tiles i {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px 10px;
  border: 3px solid var(--b-ink);
  border-radius: 14px;
  font-style: normal;
  font-size: 14px;
  box-shadow: 3px 3px 0 var(--b-ink);
}
.b-tiles small {
  font-size: 9px;
  font-weight: 700;
  opacity: 0.85;
}
.t1 {
  background: var(--b-yel);
}
.t2 {
  background: var(--b-blue);
  color: #fff;
}
.t3 {
  background: #fff;
}
.t4 {
  background: #2fb36a;
  color: #fff;
}
.b-feed {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.b-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 12px;
  border: 2px solid var(--b-ink);
  border-radius: 12px;
  background: #fff;
  font-size: 11px;
}
.b-card span {
  font-weight: 500;
  font-size: 9px;
  color: #666;
}
.b-card em {
  position: absolute;
  right: 8px;
  top: -8px;
  padding: 2px 8px;
  border: 2px solid var(--b-ink);
  border-radius: 99px;
  background: var(--b-red);
  color: #fff;
  font-style: normal;
  font-size: 9px;
  transform: rotate(4deg);
}
.b-card em.g {
  background: var(--b-yel);
  color: var(--b-ink);
}
.mob.bm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 8px 0;
}
.b-hero.m {
  padding: 12px;
  border-radius: 14px;
}
.b-hero.m b {
  font-size: 19px;
}
.b-tiles.m i {
  height: 48px;
  font-size: 12px;
  border-width: 2px;
  box-shadow: 2px 2px 0 var(--b-ink);
}
.b-tab {
  margin: auto -8px 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  justify-items: center;
  padding: 8px 0 10px;
  border-top: 3px solid var(--b-ink);
  background: #fff;
}
.b-tab i {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--b-ink);
}
.b-tab i.on {
  background: var(--b-red);
}

/* ---------- C 帖 ----------
   概念稿自带的配色（和纸白 / 墨 / 朱印 / 藍鼠），按裁决 D1 允许硬编码色值，
   不随主题变化，也不进入 Design System token。 */
.c-sw-paper {
  background: #fbfaf7;
}
.c-sw-ink {
  background: #1c1b1a;
}
.c-sw-seal {
  background: #c8372d;
}
.c-sw-grey {
  background: #6b7b8c;
}
.cm {
  --c-paper: #fbfaf7;
  --c-ink: #1c1b1a;
  --c-seal: #c8372d;
  --c-grey: #6b7b8c;
  background: var(--c-paper);
  color: var(--c-ink);
  font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
  font-size: 10px;
  line-height: 1.5;
}
.desk.cm {
  display: grid;
  grid-template-columns: 64px 1fr 150px;
}
.c-spine {
  display: flex;
  flex-direction: row-reverse;
  justify-content: center;
  gap: 8px;
  padding: 18px 0;
  border-right: 1px solid #d9d5cc;
  writing-mode: vertical-rl;
}
.c-spine b {
  font-size: 20px;
  letter-spacing: 0.2em;
}
.c-spine span {
  font-size: 9px;
  color: var(--c-grey);
  letter-spacing: 0.15em;
}
.c-page {
  padding: 18px 24px;
  background-image: linear-gradient(#ebe7df 1px, transparent 1px);
  background-size: 100% 22px;
  background-position: 0 14px;
}
.c-date {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--c-grey);
  margin: 0 0 4px;
}
.c-page h4 {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 22px;
  font-weight: 700;
}
.c-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}
.c-entry div {
  display: flex;
  flex-direction: column;
}
.c-entry b {
  font-size: 12px;
}
.c-entry span {
  font-family: var(--font-ui);
  font-size: 9px;
  color: var(--c-grey);
}
.c-stamp {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid var(--c-seal);
  color: var(--c-seal);
  font-style: normal;
  font-weight: 700;
  font-size: 10px;
  transform: rotate(-8deg);
  flex: none;
}
.c-stamp.v {
  border-radius: 6px;
  transform: rotate(5deg);
}
.c-dot {
  width: 6px;
  height: 6px;
  margin: 0 14px;
  border-radius: 50%;
  background: var(--c-ink);
  flex: none;
}
.c-page .c-date:not(:first-child) {
  margin-top: 14px;
}
.c-margin {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 22px 16px;
  border-left: 1px solid #d9d5cc;
  font-family: var(--font-ui);
  font-size: 9px;
  color: var(--c-grey);
}
.c-margin b {
  font-family: var(--font-num);
  font-size: 26px;
  line-height: 1;
  color: var(--c-ink);
}
.c-margin b.s {
  font-family: inherit;
  font-size: 11px;
  line-height: 1.4;
}
.c-margin hr {
  width: 100%;
  border: 0;
  border-top: 1px solid #d9d5cc;
  margin: 10px 0;
}
.mob.cm {
  display: flex;
  flex-direction: column;
}
.c-mhead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 14px 12px 8px;
  border-bottom: 1px solid #d9d5cc;
}
.c-mhead b {
  font-size: 15px;
  letter-spacing: 0.15em;
}
.c-mhead span {
  font-size: 8px;
  color: var(--c-grey);
}
.c-page.m {
  flex: 1;
  padding: 12px;
}
.c-page.m h4 {
  font-size: 13px;
}
.c-tab {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  justify-items: center;
  padding: 8px 0 12px;
  border-top: 1px solid #d9d5cc;
}
.c-tab i {
  font-style: normal;
  font-size: 12px;
  color: var(--c-grey);
}
.c-tab i.on {
  color: var(--c-seal);
  font-weight: 700;
}

/* ---------- 对比与结论（回到 Design System token） ---------- */
.cmp .dt th.dim {
  position: static;
  padding: 12px;
  background: transparent;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-14);
  font-weight: 700;
  color: var(--ink);
  white-space: normal;
}
.cmp,
.pick {
  padding: 48px 0 0;
  border-top: 1px solid var(--line-strong);
}
.cmp h2,
.pick h2 {
  font-size: var(--fs-28);
  margin-bottom: 20px;
}
.cmp {
  padding-bottom: 48px;
}
.cmp .dt td {
  padding-top: 12px;
  padding-bottom: 12px;
  font-size: var(--fs-14);
}
.dots {
  display: inline-flex;
  gap: 4px;
}
.dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ctl-border);
}
.dots i.on {
  background: var(--ink-3);
  box-shadow: none;
}
.dots i.on.a {
  background: var(--don);
}
.pick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
}
.pick-grid p {
  font-size: var(--fs-16);
  line-height: 1.8;
}
.pick-grid ul {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pick-grid li {
  display: flex;
  gap: 10px;
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.pick-grid li :deep(svg) {
  color: var(--don);
  margin-top: 2px;
}
.pick-grid li b {
  color: var(--ink);
}
@media (max-width: 1099px) {
  .board {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }
  .pick-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}
@media (max-width: 767px) {
  .wrap {
    padding-top: 28px;
  }
  .board {
    padding: 32px 0;
  }
  .mocks {
    flex-direction: column;
    align-items: center;
  }
  .desk {
    width: 100%;
    flex: none;
  }
  .pc {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
