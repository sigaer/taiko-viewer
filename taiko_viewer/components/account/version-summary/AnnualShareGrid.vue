<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import AnnualArtworkFallback from './AnnualArtworkFallback.vue';
const props = defineProps<{ summary: VersionSummaryViewModel; locale: string; exportMode?: boolean }>();
const failed = reactive<Record<string, boolean>>({});
watch(() => props.summary, () => { Object.keys(failed).forEach(key => delete failed[key]); });
const ja = computed(() => props.locale === 'ja');
const missing = computed(() => ja.value ? '記録なし' : '暂无记录');
const number = (value: number | null | undefined) => value != null && Number.isFinite(value) ? new Intl.NumberFormat(props.locale === 'ja' ? 'ja-JP' : 'zh-CN', { maximumFractionDigits: 2 }).format(value) : '—';
const cells = computed(() => [
  { key: 'favorite', label: ja.value ? '今年の一曲' : '年度歌曲', song: props.summary.favoriteSong, value: props.summary.favoriteSong?.name || missing.value },
  { key: 'pound', label: ja.value ? '最高秒速' : '最高秒速', song: props.summary.pound?.topSong, value: props.summary.pound?.speed != null ? `${number(props.summary.pound.speed)} ${ja.value ? '打/秒' : '打/秒'}` : missing.value },
  { key: 'profile', label: ja.value ? '称号' : '称号展示', song: null, value: '' },
  { key: 'score', label: ja.value ? '年間ハイスコア' : '年度高分', song: props.summary.highScore?.song, value: props.summary.highScore ? number(props.summary.highScore.score) : missing.value }
]);
const stats = computed(() => {
  const s = props.summary;
  const time = s.timeOfDay;
  const range = time?.periods.find(period => period.key === time.topPeriod)?.range;
  return [
    [ja.value ? 'プレイ記録' : '游玩记录', number(s.overview.playCount)],
    [ja.value ? '楽曲記録' : '鼓点记录', number(s.overview.uniqueSongs)],
    [ja.value ? 'クリア譜面' : '已经通关', number(s.overview.currentClearCharts)],
    [ja.value ? '遊んだ日数' : '陪伴天数', `${number(s.period.activeDays)} ${ja.value ? '日' : '天'}`],
    [ja.value ? '活動時間帯' : '活跃时段', time?.topLabel ? [time.topLabel, range].filter(Boolean).join(' ') : time?.favoriteHourLabel || '—'],
    [ja.value ? 'ドンだー座標' : '鼓众坐标', s.ratingRank ? [s.ratingRank.rankLabel, number(s.ratingRank.rating)].filter(Boolean).join(' · ') : '—']
  ];
});
</script>

<template>
  <section class="annual-share-grid" :class="{ 'is-export': exportMode }" :aria-label="ja ? '年間レポート' : '年度报告'">
    <div class="annual-share-grid__visual">
      <div class="annual-share-grid__labels annual-share-grid__labels--top">
        <div v-for="cell in cells.slice(0, 2)" :key="cell.key" class="annual-share-grid__label" :class="`annual-share-grid__label--${cell.key}`">
          <h2>{{ cell.label }}</h2>
          <p :title="cell.value">{{ cell.value }}</p>
        </div>
      </div>

      <div class="annual-share-grid__mosaic">
        <div v-for="cell in cells" :key="cell.key" class="annual-share-grid__tile" :class="`annual-share-grid__tile--${cell.key}`" :aria-label="cell.label">
          <template v-if="cell.key === 'profile'">
            <div class="annual-share-grid__don">
              <img v-if="summary.profileCard?.myDonUrl && !failed.profile" :src="summary.profileCard.myDonUrl" alt="MyDon" @error="failed.profile = true">
              <AnnualArtworkFallback v-else kind="don" label="MyDon" mark="" />
            </div>
            <div class="annual-share-grid__profile-caption">
              <strong>{{ summary.profileCard?.nickname || summary.user.nickname }}</strong>
              <span :title="summary.profileCard?.title || summary.finalTitle.title">{{ summary.profileCard?.title || summary.finalTitle.title || '—' }}</span>
            </div>
          </template>
          <template v-else>
            <img v-if="cell.song?.coverUrl && !failed[cell.key]" :src="cell.song.coverUrl" :alt="cell.song.name" @error="failed[cell.key] = true">
            <AnnualArtworkFallback v-else :label="missing" mark="♪" />
          </template>
        </div>
      </div>

      <div class="annual-share-grid__labels annual-share-grid__labels--bottom">
        <div v-for="cell in cells.slice(2)" :key="cell.key" class="annual-share-grid__label" :class="`annual-share-grid__label--${cell.key}`">
          <h2>{{ cell.label }}</h2>
          <p>{{ cell.key === 'profile' ? summary.profileCard?.danName : cell.value }}</p>
        </div>
      </div>
    </div>
    <dl class="annual-share-grid__stats"><div v-for="[label, value] in stats" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></dl>
  </section>
</template>

<style scoped>
.annual-share-grid{width:100%;aspect-ratio:363/554;container-type:inline-size;background:url('/annual/poster/square_bg.png') center/100% 100% no-repeat;border-radius:12px;overflow:hidden;color:#101921;font-family:var(--viewer-font-family,sans-serif)}
.annual-share-grid__visual{height:75.27%;position:relative}
.annual-share-grid__labels{position:absolute;left:0;right:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));text-align:center}
.annual-share-grid__labels--top{top:3cqw}
.annual-share-grid__labels--bottom{top:102.3cqw}
.annual-share-grid__label{min-width:0;padding:0 3cqw}
.annual-share-grid__label h2{margin:0;font-size:5.8cqw;line-height:1.2;font-weight:900;letter-spacing:-.04em}
.annual-share-grid__label p{margin:1.5cqw 0 0;font-size:3.5cqw;line-height:1.3;font-weight:700;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.annual-share-grid__labels--bottom p{margin-top:1cqw;-webkit-line-clamp:1}
/* Media geometry is independent of label length and the six metrics. */
.annual-share-grid__mosaic{position:absolute;top:27cqw;left:50%;transform:translateX(-50%);width:64.5%;aspect-ratio:1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:0}
.annual-share-grid__tile{min-width:0;min-height:0;position:relative;overflow:hidden;aspect-ratio:1;border-radius:0}
.annual-share-grid__tile>img{display:block;width:100%;height:100%;object-fit:cover;border-radius:0}
.annual-share-grid__tile--profile{background:#e5f1fb}
.annual-share-grid__don{position:absolute;inset:0 0 26%;display:grid;place-items:center}
.annual-share-grid__don>img{width:100%;height:100%;min-height:0;object-fit:contain}
.annual-share-grid__profile-caption{position:absolute;inset:auto 0 0;background:#f7fbffed;display:flex;flex-direction:column;gap:.5cqw;padding:1cqw 1.2cqw;text-align:center;font-size:2.9cqw;line-height:1.2}
.annual-share-grid__profile-caption strong,.annual-share-grid__profile-caption span{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow-wrap:anywhere}
.annual-share-grid__stats{height:24.73%;margin:0;box-sizing:border-box;padding:4cqw 4.5cqw;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2cqw 3cqw;align-items:start}.annual-share-grid__stats div{min-width:0}.annual-share-grid__stats dt{font-size:4cqw;font-weight:800;line-height:1.2}.annual-share-grid__stats dd{margin:1cqw 0 0;font-size:3.5cqw;line-height:1.2;overflow-wrap:anywhere}
</style>
