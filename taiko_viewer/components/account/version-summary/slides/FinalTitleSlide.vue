<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualDrumWindow from "../AnnualDrumWindow.vue";
import StorySlideShell from "../StorySlideShell.vue";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const themeClass = computed(() => `theme-${props.summary.finalTitle.themeKey || "encouragement"}`);
const { t } = useI18n();
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.finalTitle.eyebrow"
    :title="summary.finalTitle.title"
    :lead="summary.finalTitle.body"
    :accent="summary.copy.finalTitle.eyebrow"
    tone="gold"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="final-title-slide" :class="themeClass">
      <div class="final-title-slide__seal" data-animate>
        <AnnualDrumWindow
          size="large"
          fallback-kind="don"
          :image-url="summary.profileCard?.myDonUrl"
          :image-alt="summary.profileCard?.nickname || summary.user.nickname"
          :fallback="t('annualSummary.common.defaultDon')"
        />
        <div class="final-title-slide__seal-copy">
          <span>{{ summary.version.name }}</span>
          <strong>{{ summary.finalTitle.title }}</strong>
        </div>
      </div>

      <div class="final-title-slide__body">
        <article class="final-title-slide__panel" data-animate>
          <span>{{ summary.profileCard?.nickname || summary.user.nickname }}</span>
          <strong>{{ summary.copy.finalTitle.title }}</strong>
          <small>{{ summary.finalTitle.body }}</small>
        </article>

        <article class="final-title-slide__panel final-title-slide__panel--mini" data-animate>
          <span>{{ summary.finalTitle.evidenceLabel }}</span>
          <strong>{{ summary.finalTitle.evidenceText }}</strong>
        </article>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.final-title-slide {
  display: grid;
  grid-template-columns: minmax(260px, 0.88fr) minmax(0, 1.12fr);
  gap: 18px;
  align-items: center;
  height: 100%;
  min-height: 0;
}

@media (max-height: 900px) {
  .final-title-slide { grid-template-columns: minmax(160px, 32vh) minmax(0, 1fr); gap: 10px; }
  .final-title-slide__seal, .final-title-slide__panel { padding: 14px; border-radius: 22px; }
}

@media (max-width: 720px) and (max-height: 900px) {
  .final-title-slide { grid-template-columns: minmax(130px, 30vw) minmax(0, 1fr); }
  .final-title-slide__seal { width: 100%; }
  .final-title-slide__panel--mini { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .final-title-slide__panel--mini strong { margin-top: 0; }
}

.final-title-slide__seal,
.final-title-slide__panel {
  padding: 22px;
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
}

.final-title-slide__seal {
  position: relative;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 0;
  border: 0;
  background: transparent;
  backdrop-filter: none;
}

.final-title-slide__seal :deep(.drum-window) { --drum-size: min(43vh, 330px); }
.final-title-slide__seal-copy {
  position: absolute;
  left: 50%;
  bottom: 2%;
  width: min(86%, 15rem);
  padding: 10px 12px;
  transform: translateX(-50%);
  border: 1px solid rgba(247, 251, 255, 0.7);
  border-radius: 18px;
  background: rgba(23, 54, 93, 0.92);
  box-shadow: 0 12px 28px rgba(23, 54, 93, 0.2);
}

.final-title-slide__seal::before,
.final-title-slide__seal::after {
  content: "";
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.final-title-slide__seal::before,
.final-title-slide__seal::after { display: none; }

.final-title-slide__seal::after {
  inset: 18%;
  border-style: dashed;
  opacity: 0.6;
}

.final-title-slide__seal span,
.final-title-slide__panel span {
  display: block;
  color: rgba(255, 247, 234, 0.74);
  letter-spacing: 0.18em;
  font-size: 12px;
  text-transform: uppercase;
}

.final-title-slide__seal strong,
.final-title-slide__panel strong {
  display: block;
  margin-top: 10px;
  color: #fff8ed;
}

.final-title-slide__seal strong {
  font-family: var(--viewer-display-font);
  font-size: clamp(2.4rem, 4vw, 4rem);
  line-height: 1.04;
  max-width: 12rem;
  color: #fff !important;
}

.final-title-slide__seal span { color: rgba(255, 255, 255, 0.82) !important; }

.final-title-slide__body {
  display: grid;
  gap: 14px;
}

.final-title-slide__panel strong {
  font-size: clamp(2.1rem, 4vw, 3.2rem);
  line-height: 1.08;
}

.final-title-slide__panel small {
  display: block;
  margin-top: 14px;
  color: rgba(255, 237, 214, 0.8);
  line-height: 1.84;
}

.final-title-slide__panel--mini strong {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
}

.theme-speed .final-title-slide__seal-copy,
.theme-rhythm .final-title-slide__seal-copy {
  background: linear-gradient(145deg, #3978c8, #9bc9ff);
}

.theme-accuracy .final-title-slide__seal-copy,
.theme-big_song .final-title-slide__seal-copy,
.theme-score_gain .final-title-slide__seal-copy {
  background: linear-gradient(145deg, #3978c8, #3978c8);
}

.theme-complex .final-title-slide__seal-copy,
.theme-stamina .final-title-slide__seal-copy,
.theme-full_combo .final-title-slide__seal-copy,
.theme-dondaful .final-title-slide__seal-copy,
.theme-clear .final-title-slide__seal-copy,
.theme-encouragement .final-title-slide__seal-copy {
  background: linear-gradient(145deg, #17365d, #3978c8 68%, #3978c8);
}

@media (max-width: 960px) {
  .final-title-slide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .final-title-slide__seal,
  .final-title-slide__panel {
    padding: 18px;
    border-radius: 24px;
  }

  .final-title-slide__seal {
    width: min(100%, 15.5rem);
    margin: 0 auto;
  }

  .final-title-slide__seal strong {
    font-size: clamp(2rem, 9vw, 3rem);
    max-width: 10rem;
  }

  .final-title-slide__seal-copy { padding: 8px 9px; border-radius: 14px; }
}

@media (max-width: 720px) {
  .final-title-slide { grid-template-columns: 96px minmax(0, 1fr); gap: 8px; align-items: start; }
  .final-title-slide__seal { width: 92px; padding: 8px; border-radius: 50%; }
  .final-title-slide__seal span { font-size: 10px; }
  .final-title-slide__seal strong { margin-top: 4px; max-width: 72px; font-size: 1.05rem; overflow-wrap: anywhere; }
  .final-title-slide__seal-copy { width: 94px; bottom: -8px; padding: 5px 6px; border-radius: 11px; }
  .final-title-slide__body { gap: 6px; }
  .final-title-slide__panel { padding: 9px 10px; border-radius: 16px; }
  .final-title-slide__panel span { font-size: 10px; letter-spacing: 0.08em; }
  .final-title-slide__panel strong { margin-top: 5px; font-size: clamp(1.05rem, 5vw, 1.4rem); overflow-wrap: anywhere; }
  .final-title-slide__panel small { display: block; margin-top: 6px; font-size: 0.75rem; line-height: 1.32; overflow: visible; }
  .final-title-slide__panel--mini { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; }
  .final-title-slide__panel--mini strong { margin-top: 0; font-size: 0.95rem; }
}

@media (orientation: landscape) and (min-width: 721px) and (max-height: 460px) {
  .final-title-slide { grid-template-columns: minmax(165px, 46vh) minmax(0, 1fr); gap: 14px; align-items: center; }
  .final-title-slide__seal { width: min(46vh, 175px); justify-self: center; padding: 11px; }
  .final-title-slide__seal,
  .final-title-slide__panel { border-radius: 20px; }
  .final-title-slide__seal { border-radius: 50%; }
  .final-title-slide__seal strong { margin-top: 5px; max-width: 8.5rem; font-size: clamp(1.65rem, 3.7vw, 2.3rem); }
  .final-title-slide__seal :deep(.drum-window) { --drum-size: min(43vh, 165px); }
  .final-title-slide__seal-copy { bottom: -4px; padding: 6px 8px; }
  .final-title-slide__body { grid-template-columns: minmax(0, 1fr) minmax(145px, .38fr); gap: 8px; }
  .final-title-slide__panel { padding: 11px 13px; }
  .final-title-slide__panel strong { margin-top: 5px; font-size: clamp(1.35rem, 3vw, 1.9rem); }
  .final-title-slide__panel small { margin-top: 7px; line-height: 1.4; }
  .final-title-slide__panel--mini { display: grid; align-content: center; }
  .final-title-slide__panel--mini strong { font-size: clamp(1.2rem, 2.5vw, 1.55rem); }
}
@media (max-width: 720px) {
  .final-title-slide { grid-template-columns: minmax(112px, 36vw) minmax(0, 1fr); align-items: center; }
  .final-title-slide__seal { width: min(36vw, 140px); padding: 0; }
  .final-title-slide__seal :deep(.drum-window) { --drum-size: min(36vw, 140px); width: var(--drum-size); max-width: var(--drum-size); }
  .final-title-slide__seal-copy { width: 104%; bottom: -5px; }
}
@media (max-width: 720px) and (max-height: 650px) {
  .final-title-slide { grid-template-columns: 104px minmax(0, 1fr); }
  .final-title-slide__seal { width: 100px; }
  .final-title-slide__seal :deep(.drum-window) { --drum-size: 100px; width: 100px; max-width: 100px; }
}
.final-title-slide__seal .final-title-slide__seal-copy span { color: rgba(255, 255, 255, 0.82) !important; }
.final-title-slide__seal .final-title-slide__seal-copy strong { color: #fff !important; }
</style>
