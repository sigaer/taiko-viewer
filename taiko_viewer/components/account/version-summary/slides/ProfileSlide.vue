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

const { t } = useI18n();
const profile = computed(() => props.summary.profileCard);
</script>

<template>
  <StorySlideShell
    :page-index="pageIndex"
    :page-total="pageTotal"
    :eyebrow="summary.copy.profile.eyebrow"
    :title="summary.copy.profile.title"
    :lead="summary.copy.profile.body"
    tone="royal"
    :active="active"
    :reduced-motion="reducedMotion"
  >
    <div class="profile-slide">
      <AnnualDrumWindow
        data-animate
        size="large"
        fallback-kind="don"
        :image-url="profile?.myDonUrl"
        :image-alt="profile?.nickname || summary.user.nickname"
        :fallback="t('annualSummary.common.defaultDon')"
      />
      <div class="profile-slide__copy">
        <p data-animate>{{ t(summary.mode === "current_archive" ? 'annualSummary.common.archive' : 'annualSummary.common.observed') }}</p>
        <h3 data-animate>{{ profile?.nickname || summary.user.nickname }}</h3>
        <div class="profile-slide__facts">
          <article data-animate>
            <span>{{ t('annualSummary.slides.profile.currentTitle') }}</span>
            <strong>{{ profile?.title || t('annualSummary.slides.profile.noTitle') }}</strong>
          </article>
          <article data-animate>
            <span>{{ t('annualSummary.slides.profile.dan') }}</span>
            <strong>{{ profile?.danName || t('annualSummary.slides.profile.noDan') }}</strong>
          </article>
        </div>
      </div>
    </div>
  </StorySlideShell>
</template>

<style scoped>
.profile-slide {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.2fr);
  gap: clamp(18px, 5vw, 64px);
  align-items: center;
}

.profile-slide__copy { min-width: 0; }
.profile-slide__copy > p {
  margin: 0;
  color: #3978c8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.15em;
}

.profile-slide__copy h3 {
  margin: 12px 0 22px;
  color: #17365d;
  font-family: var(--viewer-display-font);
  font-size: clamp(2.6rem, 7vw, 6rem);
  line-height: 1;
  overflow-wrap: anywhere;
}

.profile-slide__facts { display: grid; gap: 10px; }
.profile-slide__facts article {
  padding: 16px 18px;
  border: 1px solid rgba(57, 120, 200, 0.16);
  border-radius: 20px;
  background: rgba(247, 251, 255, 0.76);
}
.profile-slide__facts span { display: block; color: #3978c8; font-size: 12px; }
.profile-slide__facts strong { display: block; margin-top: 6px; color: #17365d; font-size: clamp(1rem, 2vw, 1.35rem); }

@media (max-width: 720px) {
  .profile-slide { grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start; }
  .profile-slide__copy h3 { margin: 7px 0 10px; font-size: clamp(1.8rem, 9vw, 3.2rem); }
  .profile-slide__facts { gap: 6px; }
  .profile-slide__facts article { padding: 9px 10px; border-radius: 14px; }
  .profile-slide__facts span { font-size: 10px; }
  .profile-slide__facts strong { margin-top: 3px; font-size: 12px; }
}

@media (orientation: landscape) and (min-width: 721px) and (max-height: 460px) {
  .profile-slide { grid-template-columns: 205px minmax(0, 1fr); gap: 28px; }
  .profile-slide :deep(.drum-window) { --drum-size: min(48vh, 185px); }
  .profile-slide__copy h3 { margin: 6px 0 10px; font-size: clamp(2rem, 5vw, 3rem); }
  .profile-slide__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .profile-slide__facts article { padding: 10px 12px; border-radius: 16px; }
  .profile-slide__facts strong { margin-top: 4px; font-size: clamp(0.9rem, 1.9vw, 1.1rem); }
}
</style>
