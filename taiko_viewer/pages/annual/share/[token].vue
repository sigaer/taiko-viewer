<script setup lang="ts">
import AnnualPoster from "~/components/account/version-summary/AnnualPoster.vue";
import type { AnnualSummaryV4 } from "~/types/account-version-summary";
import { normalizeAnnualSummary } from "~/utils/annualSummary";

definePageMeta({ layout: "story", keepalive: false, mobileNav: false });
useHead({
  meta: [
    { name: "robots", content: "noindex, nofollow, noarchive" },
    { name: "referrer", content: "no-referrer" }
  ]
});
const route = useRoute();
const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const immersiveStory = useState<boolean>("story-layout-immersive", () => false);
immersiveStory.value = false;
const token = String(route.params.token || "");
const currentLocale = computed<"zh" | "ja">(() => locale.value === "ja" ? "ja" : "zh");
const numberFormatter = computed(() => new Intl.NumberFormat(currentLocale.value === "ja" ? "ja-JP" : "zh-CN"));

const { data, pending, error, refresh } = await useAsyncData(`annual-public-share-${token}`, () =>
  apiFetch<{ summary: AnnualSummaryV4; share: { expiresAt: string; locale: "zh" | "ja"; posterUrl?: string | null; url?: string } }>(`/api/annual/shares/${encodeURIComponent(token)}`, { query: { locale: currentLocale.value } })
);

const summary = computed(() => data.value?.summary ? normalizeAnnualSummary(data.value.summary, currentLocale.value, (key, params) => t(key, params || {})) : null);
const shareUrl = computed(() => process.client ? window.location.href : useRequestURL().href);
const qrCodeUrl = ref("");
const createQrCode = async (value: string) => {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(value, { width: 300, margin: 2, color: { dark: "#17365D", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
};
watchEffect(async () => {
  if (!process.client || !summary.value) return;
  qrCodeUrl.value = await createQrCode(shareUrl.value);
});
watch(currentLocale, () => refresh());

const sharePage = async () => {
  if (!process.client || !summary.value) return;
  if (navigator.share) await navigator.share({ title: summary.value.poster.title, text: summary.value.finalTitle.title, url: shareUrl.value });
  else await navigator.clipboard.writeText(shareUrl.value);
};
</script>

<template>
  <main class="public-annual">
    <div v-if="pending" class="public-annual__state">{{ t("annualSummary.state.loading") }}</div>
    <div v-else-if="error || !summary" class="public-annual__state">{{ t("annualSummary.share.expired") }}</div>
    <template v-else>
      <section class="public-annual__intro">
        <p>{{ t("annualSummary.entry.eyebrow") }}</p>
        <h1>{{ summary.profileCard?.nickname }}</h1>
        <strong>{{ summary.finalTitle.title }}</strong>
        <span>{{ t("annualSummary.share.publicLead") }}</span>
      </section>
      <div class="public-annual__poster">
        <img v-if="data?.share.posterUrl" :src="data.share.posterUrl" :alt="summary.poster.title" />
        <AnnualPoster v-else :summary="summary" :share-url="shareUrl" :qr-code-url="qrCodeUrl" :expires-at="data?.share.expiresAt" compact />
      </div>
      <section class="public-annual__facts">
        <article><span>{{ t("annualSummary.slides.overview.plays") }}</span><strong>{{ numberFormatter.format(summary.overview.playCount) }}</strong></article>
        <article><span>{{ t("annualSummary.slides.overview.songs") }}</span><strong>{{ numberFormatter.format(summary.overview.uniqueSongs) }}</strong></article>
        <article class="public-annual__wide"><span>{{ t("annualSummary.slides.poster.favorite") }}</span><strong>{{ summary.favoriteSong?.name || "—" }}</strong></article>
        <article v-if="summary.ratingRank?.tier" class="public-annual__wide"><span>{{ t("annualSummary.slides.rating.tier") }}</span><strong>{{ t(`annualSummary.slides.rating.tiers.${summary.ratingRank.tier}`) }}</strong></article>
        <button type="button" @click="sharePage">{{ t("annualSummary.controls.webShare") }}</button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.public-annual__wide{grid-column:1/-1}
.public-annual{min-height:100vh;padding:clamp(100px,12vh,140px) max(16px,calc((100vw - 1120px)/2)) 64px;color:#17365d;background:linear-gradient(145deg,#f7fbff,#e5f1ff);display:grid;grid-template-columns:minmax(260px,.68fr) minmax(310px,.92fr);grid-template-areas:"intro poster" "facts poster";gap:18px clamp(24px,5vw,70px);align-items:center}.public-annual__state{grid-column:1/-1;min-height:70vh;display:grid;place-items:center;color:#5c7697}.public-annual__intro{grid-area:intro;align-self:end}.public-annual__intro>p{margin:0;color:#3978c8;font-size:12px;font-weight:700;letter-spacing:.14em}.public-annual__intro h1{margin:12px 0 5px;color:#17365d;font:700 clamp(3rem,7vw,6rem)/1 var(--viewer-display-font);overflow-wrap:anywhere}.public-annual__intro strong{display:block;color:#3978c8;font-size:clamp(1.3rem,3vw,2.2rem)}.public-annual__intro span{display:block;margin-top:16px;color:#5c7697;line-height:1.7}.public-annual__poster{grid-area:poster}.public-annual__poster>img{display:block;width:100%;border-radius:28px;box-shadow:0 28px 70px rgba(23,54,93,.2)}.public-annual__facts{grid-area:facts;align-self:start;display:grid;grid-template-columns:1fr 1fr;gap:8px}.public-annual__facts article{padding:14px;border:1px solid rgba(57,120,200,.16);border-radius:17px;background:#f7fbffb8}.public-annual__facts article:nth-child(3){grid-column:1/-1}.public-annual__facts span{display:block;color:#7890ab;font-size:11px}.public-annual__facts strong{display:block;margin-top:5px;color:#17365d;font-size:1.2rem;overflow-wrap:anywhere}.public-annual__facts button{grid-column:1/-1;min-height:46px;border:0;border-radius:99px;color:#fff;background:#3978c8;font-weight:700;cursor:pointer}.public-annual__facts button:focus-visible{outline:3px solid #3978c8;outline-offset:3px}@media(max-width:720px){.public-annual{padding:88px 12px 36px;grid-template-columns:1fr;grid-template-areas:"intro" "poster" "facts";gap:16px}.public-annual__intro h1{font-size:3rem}.public-annual__poster{width:min(100%,480px);margin:auto}}
</style>
