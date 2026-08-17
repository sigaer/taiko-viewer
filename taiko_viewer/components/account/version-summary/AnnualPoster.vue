<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";
import { isUsableMetric } from "~/utils/annualPresentation";

const props = withDefaults(defineProps<{
  summary: VersionSummaryViewModel;
  shareUrl?: string;
  qrCodeUrl?: string;
  expiresAt?: string | null;
  compact?: boolean;
}>(), { shareUrl: "", qrCodeUrl: "", expiresAt: null, compact: false });

const { t, locale, n } = useI18n();
const myDonFailed = ref(false);
const coverFailed = ref(false);
const qrFailed = ref(false);
const myDonLoaded = ref(false);
const coverLoaded = ref(false);
const qrLoaded = ref(false);
const myDonImage = ref<HTMLImageElement | null>(null);
const coverImage = ref<HTMLImageElement | null>(null);
const qrImage = ref<HTMLImageElement | null>(null);
const posterStats = computed(() => [
  { key: "plays", label: t("annualSummary.slides.overview.plays"), value: props.summary.overview.playCount },
  { key: "songs", label: t("annualSummary.slides.overview.songs"), value: props.summary.overview.uniqueSongs },
  { key: "clear", label: t("annualSummary.slides.overview.clear"), value: props.summary.overview.currentClearCharts }
].filter((stat) => isUsableMetric(stat.value)));
const inspectLoadedImages = async () => {
  await nextTick();
  if (myDonImage.value?.complete) {
    myDonFailed.value = myDonImage.value.naturalWidth === 0;
    myDonLoaded.value = myDonImage.value.naturalWidth > 0;
  }
  if (coverImage.value?.complete) {
    coverFailed.value = coverImage.value.naturalWidth === 0;
    coverLoaded.value = coverImage.value.naturalWidth > 0;
  }
  if (qrImage.value?.complete) {
    qrFailed.value = qrImage.value.naturalWidth === 0;
    qrLoaded.value = qrImage.value.naturalWidth > 0;
  }
};
watch(() => props.summary.profileCard?.myDonUrl, () => { myDonFailed.value = false; myDonLoaded.value = false; void inspectLoadedImages(); });
watch(() => props.summary.favoriteSong?.coverUrl, () => { coverFailed.value = false; coverLoaded.value = false; void inspectLoadedImages(); });
watch(() => props.qrCodeUrl, () => { qrFailed.value = false; qrLoaded.value = false; void inspectLoadedImages(); });
onMounted(() => { void inspectLoadedImages(); });
const formatDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
};
</script>

<template>
  <article class="annual-poster" :class="{ 'annual-poster--compact': compact }">
    <header class="annual-poster__head">
      <div>
        <p>TAIKO 2026 · SAKURA VIEWER</p>
        <h1>{{ summary.poster.title }}</h1>
        <span>{{ summary.poster.periodLabel }}</span>
      </div>
      <img src="/logo.png" alt="Sakura Bot" />
    </header>

    <section class="annual-poster__identity">
      <div class="annual-poster__drum">
        <i v-for="index in 12" :key="index" :style="{ '--turn': `${index * 30}deg` }"></i>
        <div>
          <img v-if="summary.profileCard?.myDonUrl && !myDonFailed" v-show="myDonLoaded" ref="myDonImage" :src="summary.profileCard.myDonUrl" :alt="summary.profileCard.nickname" @load="myDonLoaded = true" @error="myDonFailed = true" />
          <AnnualArtworkFallback v-if="!summary.profileCard?.myDonUrl || myDonFailed || !myDonLoaded" kind="don" :label="t('annualSummary.common.defaultDon')" mark="DON" />
        </div>
      </div>
      <div class="annual-poster__player">
        <p>{{ t(summary.mode === "current_archive" ? "annualSummary.common.archive" : "annualSummary.common.observed") }}</p>
        <h2>{{ summary.profileCard?.nickname || summary.user.nickname }}</h2>
        <strong>{{ summary.profileCard?.title || summary.finalTitle.title }}</strong>
        <span v-if="summary.profileCard?.danName">{{ summary.profileCard.danName }}</span>
      </div>
    </section>

    <section v-if="posterStats.length" class="annual-poster__stats" :style="{ '--poster-stat-count': posterStats.length }">
      <article v-for="stat in posterStats" :key="stat.key"><span>{{ stat.label }}</span><strong>{{ n(stat.value) }}</strong></article>
    </section>

    <section class="annual-poster__memory">
      <div class="annual-poster__song">
        <div class="annual-poster__song-art">
          <img v-if="summary.favoriteSong?.coverUrl && !coverFailed" v-show="coverLoaded" ref="coverImage" :src="summary.favoriteSong.coverUrl" :alt="summary.favoriteSong.name" @load="coverLoaded = true" @error="coverFailed = true" />
          <AnnualArtworkFallback v-if="!summary.favoriteSong?.coverUrl || coverFailed || !coverLoaded" :label="t('annualSummary.common.defaultCover')" />
        </div>
        <p><span>{{ t("annualSummary.slides.poster.favorite") }}</span><strong>{{ summary.favoriteSong?.name || t("annualSummary.common.songWaiting") }}</strong></p>
      </div>
      <div class="annual-poster__title">
        <span>{{ t("annualSummary.slides.poster.finalTitle") }}</span>
        <h3>{{ summary.finalTitle.title }}</h3>
        <p>{{ summary.finalTitle.body }}</p>
        <small v-if="summary.keyword">{{ t("annualSummary.slides.poster.keyword") }} · {{ summary.keyword.title }}</small>
      </div>
    </section>

    <footer class="annual-poster__foot">
      <div>
        <img v-if="qrCodeUrl && !qrFailed" v-show="qrLoaded" ref="qrImage" :src="qrCodeUrl" alt="" @load="qrLoaded = true" @error="qrFailed = true" />
        <AnnualArtworkFallback v-if="!qrCodeUrl || qrFailed || !qrLoaded" kind="qr" :label="shareUrl || t('annualSummary.slides.poster.scan')" />
      </div>
      <p>
        <strong>{{ t("annualSummary.slides.poster.scan") }}</strong>
        <span v-if="expiresAt">{{ t("annualSummary.slides.poster.expires", { date: formatDate(expiresAt) }) }}</span>
        <small v-if="shareUrl">{{ shareUrl }}</small>
        <small v-else>{{ summary.poster.closingLine }}</small>
      </p>
    </footer>
  </article>
</template>

<style scoped>
.annual-poster{container-type:inline-size}
.annual-poster{--poster-pad:6.5%;position:relative;width:100%;aspect-ratio:3/4;overflow:hidden;padding:var(--poster-pad);display:flex;flex-direction:column;gap:3.3%;color:#17365d;background:linear-gradient(150deg,#f7fbff 0%,#e5f1ff 58%,#f7fbff 100%);font-family:var(--viewer-font-family);isolation:isolate}.annual-poster::before,.annual-poster::after{content:"";position:absolute;z-index:-1;border-radius:50%;border:1px solid rgba(57,120,200,.14)}.annual-poster::before{width:55%;aspect-ratio:1;right:-22%;top:23%;box-shadow:inset 0 0 0 24px rgba(247,251,255,.35)}.annual-poster::after{width:62%;aspect-ratio:1;left:-28%;bottom:-30%}.annual-poster__head{display:flex;justify-content:space-between;gap:4%;align-items:flex-start}.annual-poster__head p{margin:0;color:#3978c8;font-size:1.4cqw;font-weight:700;letter-spacing:.16em}.annual-poster__head h1{margin:1.2% 0 .7%;font:700 5.6cqw/1 var(--viewer-display-font);color:#17365d}.annual-poster__head span{color:#7890ab;font-size:1.55cqw}.annual-poster__head img{width:7.5%;aspect-ratio:1;object-fit:contain}.annual-poster__identity{min-height:24%;display:flex;align-items:center;gap:5%}.annual-poster__drum{position:relative;width:27%;aspect-ratio:1;border-radius:50%;background:#3978c8;box-shadow:0 2.4cqw 5cqw rgba(23,54,93,.18),inset 0 0 0 .65cqw rgba(247,251,255,.8)}.annual-poster__drum>i{position:absolute;inset:0;padding-top:.5%;display:flex;justify-content:center;transform:rotate(var(--turn))}.annual-poster__drum>i::before{content:"";width:2.6%;aspect-ratio:1;border-radius:50%;background:#f7fbff}.annual-poster__drum>div{position:absolute;inset:9%;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:#f7fbff;box-shadow:inset 0 0 2cqw rgba(57,120,200,.14)}.annual-poster__drum img{width:100%;height:100%;object-fit:contain}.annual-poster__drum b{color:#3978c8;font:700 5cqw/1 var(--viewer-display-font)}.annual-poster__player{min-width:0}.annual-poster__player p{margin:0;color:#3978c8;font-size:1.45cqw;font-weight:700;letter-spacing:.12em}.annual-poster__player h2{margin:2% 0;color:#17365d;font:700 6.5cqw/1 var(--viewer-display-font);overflow-wrap:anywhere}.annual-poster__player strong{display:block;color:#5c7697;font-size:1.9cqw;overflow-wrap:anywhere}.annual-poster__player span{display:inline-block;margin-top:3%;padding:1.2% 2.5%;border-radius:99px;color:#3978c8;background:#f7fbff;font-size:1.5cqw}.annual-poster__stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5%}.annual-poster__stats article{padding:8% 9%;border-radius:1.6cqw;background:rgba(247,251,255,.82);border:1px solid rgba(57,120,200,.16)}.annual-poster__stats span{display:block;color:#7890ab;font-size:1.4cqw}.annual-poster__stats strong{display:block;margin-top:5%;color:#3978c8;font:700 4.3cqw/1 var(--viewer-display-font)}.annual-poster__memory{min-height:26%;display:grid;grid-template-columns:41% 1fr;gap:3%}.annual-poster__song,.annual-poster__title{padding:5%;border-radius:2cqw;background:rgba(247,251,255,.78);border:1px solid rgba(57,120,200,.16)}.annual-poster__song{display:grid;grid-template-columns:42% 1fr;align-items:center;gap:6%}.annual-poster__song>img,.annual-poster__song>div{width:100%;aspect-ratio:1;border-radius:1.3cqw;object-fit:cover;display:grid;place-items:center;color:#3978c8;background:#e5f1ff}.annual-poster__song p{margin:0;min-width:0}.annual-poster__song span,.annual-poster__title>span{display:block;color:#7890ab;font-size:1.35cqw}.annual-poster__song strong{display:block;margin-top:5%;color:#17365d;font-size:2cqw;line-height:1.25;overflow-wrap:anywhere}.annual-poster__title h3{margin:2% 0;color:#17365d;font:700 3.4cqw/1.08 var(--viewer-display-font)}.annual-poster__title p{margin:0;color:#5c7697;font-size:1.45cqw;line-height:1.5}.annual-poster__title small{display:block;margin-top:4%;color:#3978c8;font-size:1.35cqw}.annual-poster__foot{margin-top:auto;padding-top:3%;border-top:1px solid rgba(57,120,200,.18);display:flex;align-items:center;gap:2.5%}.annual-poster__foot>div{width:10%;aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border-radius:.8cqw;background:#fff}.annual-poster__foot img{width:100%;height:100%}.annual-poster__foot>div>span{color:#3978c8;font:700 1.8cqw/1 var(--viewer-display-font)}.annual-poster__foot p{margin:0;min-width:0}.annual-poster__foot strong,.annual-poster__foot span,.annual-poster__foot small{display:block}.annual-poster__foot strong{color:#17365d;font-size:1.6cqw}.annual-poster__foot span,.annual-poster__foot small{margin-top:1%;color:#7890ab;font-size:1.2cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.annual-poster--compact{border-radius:28px;box-shadow:0 24px 60px rgba(23,54,93,.18)}
.annual-poster__drum > div > *,
.annual-poster__song-art > *,
.annual-poster__foot > div > * { grid-area: 1 / 1; width: 100%; height: 100%; }
.annual-poster__song-art { display: grid !important; place-items: stretch !important; overflow: hidden; }
.annual-poster__song-art img { width: 100%; height: 100%; object-fit: cover; }
.annual-poster__stats { grid-template-columns: repeat(var(--poster-stat-count, 3), minmax(0, 1fr)); }
.annual-poster__title h3 { overflow-wrap: anywhere; }
</style>
