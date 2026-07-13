<script setup lang="ts">
import { computed } from "vue";
import type { AccountSongScore } from "~/types/account-song";

const props = defineProps<{
  items: AccountSongScore[];
  pending?: boolean;
  unavailable?: boolean;
}>();

const { locale, t } = useI18n();
const copy = computed(() =>
  locale.value === "ja"
    ? {
        eyebrow: "PLAYER RECORD",
        title: "自分の成績",
        empty: "この曲の成績はまだ同期されていません",
        unavailable: "連携中の ID に成績データがありません。プロフィールと同期状態を確認してください",
        score: "スコア",
        good: "良",
        ok: "可",
        bad: "不可",
        combo: "最大コンボ",
        plays: "プレイ",
        drumroll: "連打",
        updated: "更新",
        dondaful: "全良",
        fullCombo: "フルコンボ",
        clear: "クリア",
        played: "プレイ済み",
        times: "回"
      }
    : {
        eyebrow: "PLAYER RECORD",
        title: "我的成绩",
        empty: "这首歌还没有同步到成绩记录",
        unavailable: "当前绑定 ID 暂无可用成绩，请检查个人档案与同步状态",
        score: "分数",
        good: "良",
        ok: "可",
        bad: "不可",
        combo: "最大连击",
        plays: "游玩",
        drumroll: "连打",
        updated: "更新于",
        dondaful: "全良",
        fullCombo: "全连",
        clear: "通关",
        played: "已游玩",
        times: "次"
      }
);

const numberFormatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN"));
const formatNumber = (value: number) => numberFormatter.value.format(Number(value || 0));
const difficultyName = (level: number) => t(`difficulty.${level}`);
const starLabel = (value: string | number) => (value === "" || value === null || value === undefined ? "—" : `${value}★`);

const crownLabel = (item: AccountSongScore) => {
  if (item.dondafulComboCnt > 0) return copy.value.dondaful;
  if (item.fullComboCnt > 0) return copy.value.fullCombo;
  if (item.clearCnt > 0) return copy.value.clear;
  return copy.value.played;
};

const formatDate = (value: string) => {
  if (!value) return "—";
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
};
</script>

<template>
  <section class="account-score-section" aria-labelledby="account-score-title">
    <header class="score-section-head">
      <div class="score-title-mark" aria-hidden="true"><span></span><span></span></div>
      <div>
        <span class="score-eyebrow">{{ copy.eyebrow }}</span>
        <h3 id="account-score-title">{{ copy.title }}</h3>
      </div>
    </header>

    <div v-if="pending" class="score-skeleton" aria-busy="true">
      <el-skeleton :rows="3" animated />
    </div>
    <div v-else-if="!items.length" class="score-empty">
      <span class="empty-drum" aria-hidden="true">♪</span>
      <p>{{ unavailable ? copy.unavailable : copy.empty }}</p>
    </div>
    <div v-else class="score-lanes">
      <article v-for="item in items" :key="item.level" :class="['score-lane', `level-${item.level}`]">
        <div class="difficulty-stamp">
          <span>{{ difficultyName(item.level) }}</span>
          <strong>{{ starLabel(item.starLevel) }}</strong>
        </div>
        <div class="score-primary">
          <span>{{ copy.score }}</span>
          <strong>{{ formatNumber(item.highScore) }}</strong>
          <em>{{ crownLabel(item) }}</em>
        </div>
        <dl class="judge-strip">
          <div><dt>{{ copy.good }}</dt><dd>{{ formatNumber(item.goodCnt) }}</dd></div>
          <div><dt>{{ copy.ok }}</dt><dd>{{ formatNumber(item.okCnt) }}</dd></div>
          <div><dt>{{ copy.bad }}</dt><dd>{{ formatNumber(item.ngCnt) }}</dd></div>
        </dl>
        <dl class="score-meta">
          <div><dt>{{ copy.combo }}</dt><dd>{{ formatNumber(item.comboCnt) }}</dd></div>
          <div><dt>{{ copy.drumroll }}</dt><dd>{{ formatNumber(item.poundCnt) }}</dd></div>
          <div><dt>{{ copy.plays }}</dt><dd>{{ formatNumber(item.stageCnt) }}{{ copy.times }}</dd></div>
          <div><dt>{{ copy.updated }}</dt><dd>{{ formatDate(item.highscoreDatetime || item.updateDatetime) }}</dd></div>
        </dl>
      </article>
    </div>
  </section>
</template>

<style scoped>
.account-score-section {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid rgba(139, 107, 77, 0.2);
}

.score-section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.score-title-mark {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #f8f4ed;
  border: 3px solid #e45543;
  box-shadow: inset 0 0 0 6px #fff, 0 5px 14px rgba(140, 70, 52, 0.16);
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
}

.score-title-mark span:first-child { background: rgba(228, 85, 67, 0.2); }
.score-title-mark span:last-child { background: rgba(87, 146, 197, 0.2); }
.score-eyebrow { color: #9b7459; font-size: 10px; font-weight: 800; letter-spacing: 0.18em; }
.score-section-head h3 { margin: 1px 0 0; color: #49382d; font-size: 21px; line-height: 1.2; }
.score-skeleton, .score-empty { border-radius: 14px; background: #faf8f4; padding: 18px; }
.score-empty { min-height: 84px; display: flex; align-items: center; justify-content: center; gap: 12px; color: #7c6a58; text-align: center; }
.score-empty p { margin: 0; }
.empty-drum { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: #fff; color: #d25c48; font-weight: 800; box-shadow: 0 3px 10px rgba(115, 83, 58, 0.12); }
.score-lanes { display: grid; gap: 10px; }
.score-lane {
  --difficulty: #777;
  display: grid;
  grid-template-columns: 112px minmax(180px, 1.1fr) minmax(220px, 1fr) minmax(290px, 1.35fr);
  align-items: stretch;
  min-height: 94px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--difficulty) 24%, transparent);
  border-left: 7px solid var(--difficulty);
  border-radius: 14px;
  background: linear-gradient(100deg, color-mix(in srgb, var(--difficulty) 9%, white), #fff 30%);
  box-shadow: 0 7px 20px rgba(102, 76, 54, 0.08);
}
.level-1 { --difficulty: #e6534a; }
.level-2 { --difficulty: #df9b20; }
.level-3 { --difficulty: #52a565; }
.level-4 { --difficulty: #7658b5; }
.level-5 { --difficulty: #2c2b35; }
.difficulty-stamp { display: grid; align-content: center; gap: 3px; padding: 14px 16px; color: var(--difficulty); }
.difficulty-stamp span { font-size: 13px; font-weight: 800; }
.difficulty-stamp strong { font-size: 21px; }
.score-primary { position: relative; display: grid; align-content: center; gap: 2px; padding: 13px 18px; border-left: 1px dashed rgba(112, 91, 72, 0.18); }
.score-primary span, .score-meta dt, .judge-strip dt { color: #897666; font-size: 11px; }
.score-primary strong { color: #342a24; font: 800 clamp(1.45rem, 2.2vw, 2rem)/1.05 var(--viewer-display-font); font-variant-numeric: tabular-nums; }
.score-primary em { position: absolute; top: 11px; right: 10px; border-radius: 999px; padding: 3px 8px; background: color-mix(in srgb, var(--difficulty) 12%, white); color: var(--difficulty); font-size: 10px; font-style: normal; font-weight: 800; }
.judge-strip { margin: 0; padding: 13px 18px; display: grid; grid-template-columns: repeat(3, 1fr); align-items: center; gap: 8px; border-left: 1px solid rgba(112, 91, 72, 0.12); }
.judge-strip div { display: grid; justify-items: center; gap: 3px; }
.judge-strip dt, .judge-strip dd, .score-meta dt, .score-meta dd { margin: 0; }
.judge-strip dd { color: #4f4036; font-size: 16px; font-weight: 750; font-variant-numeric: tabular-nums; }
.score-meta { margin: 0; padding: 13px 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: center; gap: 8px 18px; border-left: 1px solid rgba(112, 91, 72, 0.12); }
.score-meta div { display: flex; justify-content: space-between; gap: 8px; }
.score-meta dd { color: #4f4036; font-size: 12px; font-weight: 700; text-align: right; }

@media (max-width: 980px) {
  .score-lane { grid-template-columns: 100px minmax(180px, 1fr) minmax(220px, 1fr); }
  .score-meta { grid-column: 1 / -1; border-left: 0; border-top: 1px solid rgba(112, 91, 72, 0.12); grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .account-score-section { margin-top: 22px; padding-top: 20px; }
  .score-lane { grid-template-columns: 82px minmax(0, 1fr); }
  .difficulty-stamp { padding: 12px; }
  .difficulty-stamp strong { font-size: 17px; }
  .score-primary { padding: 12px 14px; }
  .score-primary strong { font-size: 1.55rem; }
  .judge-strip, .score-meta { grid-column: 1 / -1; border-left: 0; border-top: 1px solid rgba(112, 91, 72, 0.12); }
  .score-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 12px 14px; }
  .score-empty { align-items: flex-start; text-align: left; }
}
</style>
