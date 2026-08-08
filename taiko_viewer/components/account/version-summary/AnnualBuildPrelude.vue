<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  status: "queued" | "running" | "completed" | "failed";
  stage?: string | null;
  percent?: number | null;
  detail?: string | null;
  error?: string;
}>();
const emit = defineEmits<{ retry: []; sync: [] }>();
const { t } = useI18n();
const safePercent = computed(() => props.status === "queued" ? 0 : Math.max(0, Math.min(100, Number(props.percent || 0))));
const stageText = computed(() => t(`annualSummary.buildStages.${props.stage || props.status}`));
</script>

<template>
  <main class="annual-prelude" aria-live="polite">
    <section class="annual-prelude__card">
      <p class="annual-prelude__eyebrow">{{ t("annualSummary.buildPrelude.eyebrow") }}</p>
      <h1>{{ status === "failed" ? t("annualSummary.buildPrelude.failedTitle") : t("annualSummary.buildPrelude.title") }}</h1>
      <p class="annual-prelude__lead">{{ error || t("annualSummary.buildPrelude.lead") }}</p>

      <div v-if="status !== 'failed'" class="annual-prelude__route">
        <div class="annual-prelude__track">
          <span class="annual-prelude__fill" :style="{ width: `${safePercent}%` }"></span>
          <img class="annual-prelude__don" src="/don.gif" alt="" :style="{ left: `${safePercent}%` }" />
        </div>
        <div class="annual-prelude__status">
          <strong>{{ stageText }}</strong>
          <span>{{ status === "queued" ? t("annualSummary.buildPrelude.waiting") : `${safePercent}%` }}</span>
        </div>
        <p v-if="detail" class="annual-prelude__detail">{{ detail }}</p>
      </div>

      <div v-else class="annual-prelude__actions">
        <el-button type="primary" @click="emit('retry')">{{ t("annualSummary.buildPrelude.retry") }}</el-button>
        <el-button @click="emit('sync')">{{ t("annualSummary.state.openSync") }}</el-button>
      </div>
      <small>{{ t("annualSummary.buildPrelude.background") }}</small>
    </section>
  </main>
</template>

<style scoped>
.annual-prelude{min-height:100vh;min-height:100svh;padding:24px;display:grid;place-items:center;color:#17365d;background:radial-gradient(circle at 80% 12%,#c7ddf8 0,transparent 30%),linear-gradient(145deg,#f7fbff,#e5f1ff)}.annual-prelude__card{width:min(680px,100%);padding:clamp(26px,6vw,58px);border:1px solid #3978c829;border-radius:32px;background:#f7fbffe8;box-shadow:0 30px 80px #17365d1d}.annual-prelude__eyebrow{margin:0;color:#3978c8;font-size:12px;font-weight:800;letter-spacing:.16em}.annual-prelude h1{margin:12px 0 14px;font:700 clamp(2.5rem,8vw,5.2rem)/.96 var(--viewer-display-font);text-wrap:balance}.annual-prelude__lead{margin:0;color:#5c7697;line-height:1.75}.annual-prelude__route{margin-top:46px}.annual-prelude__track{position:relative;height:12px;border-radius:99px;background:#cedff2;box-shadow:inset 0 1px 3px #17365d25}.annual-prelude__fill{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:linear-gradient(90deg,#3978c8,#72a9cd);transition:width .6s ease}.annual-prelude__don{position:absolute;bottom:7px;width:72px;height:36px;image-rendering:auto;transform:translateX(-50%);transition:left .6s ease}.annual-prelude__status{margin-top:16px;display:flex;justify-content:space-between;gap:18px}.annual-prelude__status strong{color:#17365d}.annual-prelude__status span,.annual-prelude__detail,.annual-prelude small{color:#7890ab}.annual-prelude__detail{margin:7px 0 0}.annual-prelude__actions{margin:26px 0}.annual-prelude small{display:block;margin-top:28px;line-height:1.6}@media(max-width:520px){.annual-prelude{padding:12px}.annual-prelude__card{border-radius:24px}.annual-prelude__route{margin-top:42px}.annual-prelude__don{width:64px;height:32px}}@media(prefers-reduced-motion:reduce){.annual-prelude__fill,.annual-prelude__don{transition:none}.annual-prelude__don{display:none}}
</style>
