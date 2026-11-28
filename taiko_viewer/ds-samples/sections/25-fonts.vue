<script setup lang="ts">
// P0-10 font comparison page. `?fonts=b` (default) renders with Outfit + system CJK (D0-4 = B).
// `?fonts=a` additionally links /_ds-fonts-a/fonts-cjk.css, which declares the self-hosted 'Noto Sans SC Variable' /
// 'Noto Sans JP Variable' families the token stacks already name first. That URL is NOT served by the app and its
// font files are not in the repository: scripts/ds/font-measure.mjs answers it from a local @fontsource-variable
// install (outside the repo) while measuring. Opened without the script, option A falls back to option B.
// The texts are specimen text of about one screen each (today, song list, post body), not product copy.
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleFonts" });

const route = useRoute();
// One specimen language per page: /_ds/fonts measures Chinese, /ja/_ds/fonts measures Japanese.
const isJa = computed(() => route.path.startsWith("/ja/"));
const option = computed(() => (route.query.fonts === "a" ? "a" : "b"));
useHead(() => ({
  link: option.value === "a" ? [{ key: "ds-fonts-a", rel: "stylesheet", href: "/_ds-fonts-a/fonts-cjk.css" }] : []
}));
</script>

<template>
  <DsSampleShell title="fonts">
    <p class="ds-fonts__option" data-testid="ds-fonts-option">option {{ option }}</p>
    <DsSampleBlock name="today">
      <div class="ds-fonts__screen" v-if="!isJa" data-ds-specimen lang="zh-CN">
        <p class="ds-fonts__lead">上次同步带来 4 条新进展，其中 1 个新全良。</p>
        <p>Rating <span class="num">11.97</span> ▲0.31 · 近 30 天 · 全站位置前 5% · 连续游玩 3 天</p>
        <p>这次想练：天狗祭 ★9 定数 9.38，高速处理。不可从 7 降到 3，最好成绩 968,440。</p>
        <p>最近 21 天：刷新成绩、更稳了、新王冠、连续游玩。今天打了 9 张谱，4 条进展。</p>
        <p>大歌力 12.36 · 体力 11.77 · 高速处理 11.68 · 精度力 12.70 · 节奏处理 12.33 · 复合处理 12.49</p>
      </div>
      <div class="ds-fonts__screen" v-else data-ds-specimen lang="ja">
        <p class="ds-fonts__lead">前回の同期で新しい進展が 4 件、そのうち全良が 1 件。</p>
        <p>Rating <span class="num">11.97</span> ▲0.31 · 直近 30 日 · 全体の上位 5% · 3 日連続プレイ</p>
        <p>今回の練習：天狗祭 ★9 定数 9.38、高速処理。不可を 7 から 3 へ、自己ベスト 968,440。</p>
        <p>直近 21 日：スコア更新、安定、新しい王冠、連続プレイ。今日は 9 譜面、進展は 4 件。</p>
        <p>大音符力 12.36 · 体力 11.77 · 高速処理 11.68 · 精度力 12.70 · リズム処理 12.33 · 複合処理 12.49</p>
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="song list">
      <ul class="ds-fonts__list" v-if="!isJa" data-ds-specimen lang="zh-CN">
        <li>夏祭り · 普通 ★4 · 困难 ★6 · 魔王 ★8</li>
        <li>千本桜 · 魔王 ★8 定数 8.92 · 全连</li>
        <li>紅蓮華 · 魔王 ★9 定数 9.45 · 通关</li>
        <li>天狗祭 · 魔王 ★9 定数 9.38 · 已游玩</li>
        <li>幽玄ノ乱 · 魔王 ★10 定数 11.52 · 未游玩</li>
        <li>第六天魔王 · 魔王（里） ★10 定数 12.10</li>
        <li>さいたま2000 · 魔王 ★9 定数 9.80 · 全良</li>
        <li>ドンカマ2000 · 魔王 ★9 定数 9.61</li>
      </ul>
      <ul class="ds-fonts__list" v-else data-ds-specimen lang="ja">
        <li>夏祭り · ふつう ★4 · むずかしい ★6 · おに ★8</li>
        <li>千本桜 · おに ★8 定数 8.92 · フルコンボ</li>
        <li>紅蓮華 · おに ★9 定数 9.45 · クリア</li>
        <li>天狗祭 · おに ★9 定数 9.38 · プレイ済み</li>
        <li>幽玄ノ乱 · おに ★10 定数 11.52 · 未プレイ</li>
        <li>第六天魔王 · おに（裏） ★10 定数 12.10</li>
        <li>さいたま2000 · おに ★9 定数 9.80 · 全良</li>
        <li>ドンカマ2000 · おに ★9 定数 9.61</li>
      </ul>
    </DsSampleBlock>
    <DsSampleBlock name="post body">
      <div class="ds-fonts__screen" v-if="!isJa" data-ds-specimen lang="zh-CN">
        <p>这首歌的难点集中在中段的十六分连打和后半的复合节奏。建议先用 0.8 倍速把第 45 到 60 小节单独练熟，再恢复原速。</p>
        <p>我的手法是左手起手，咚咔交替时保持手腕放松，不要追求力度。练了大约两周，不可从 12 降到 4，终于拿到了全连。</p>
        <p>另外，判定线前的音符密度变化很大，眼睛要提前看两拍。如果总是在同一个位置断连，可以把那一段录下来慢放看看。</p>
      </div>
      <div class="ds-fonts__screen" v-else data-ds-specimen lang="ja">
        <p>この曲の難所は中盤の16分連打と後半の複合リズムです。まず 0.8 倍速で 45〜60 小節だけを練習してから、元の速さに戻すのがおすすめです。</p>
        <p>左手始動で、ドンとカッが交互になるところは手首の力を抜いて、強く叩きすぎないこと。二週間ほどで不可が 12 から 4 に減り、ようやくフルコンボできました。</p>
        <p>判定枠の手前で密度が大きく変わるので、二拍先を見るようにしています。同じ場所で途切れる場合は、その部分を録画してスロー再生すると原因が見えます。</p>
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-fonts__option {
  margin: 0 0 var(--sp-4);
  color: var(--ink-3);
  font-family: var(--font-num);
}
.ds-fonts__screen,
.ds-fonts__list {
  flex: 1 1 320px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  font-family: var(--font-ui);
}
.ds-fonts__screen[lang="ja"],
.ds-fonts__list[lang="ja"] {
  font-family: "Outfit", var(--font-cjk-jp);
}
.ds-fonts__screen p {
  margin: 0 0 var(--sp-2);
}
.ds-fonts__lead {
  font-size: var(--fs-22);
  font-weight: 700;
}
.ds-fonts__list li {
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--line);
}
</style>
