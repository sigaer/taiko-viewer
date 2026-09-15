<script setup lang="ts">
import StoryPlayer from "~/components/account/version-summary/StoryPlayer.vue";
import AnnualScene from "~/components/account/version-summary/AnnualScene.vue";
import { normalizeAnnualSummary } from "~/utils/annualSummary";
import type { AnnualSummaryV4 } from "~/types/account-version-summary";
defineI18nRoute(false); definePageMeta({ layout: "story", middleware: "admin-auth", mobileNav: false });
const route = useRoute(); const apiFetch = useAdminApiFetch(); const started = ref(false); const { t } = useI18n();
const summaryId = String(route.params.summaryId || "");
const backToAdmin = () => navigateTo('/admin/taiko/annual-summaries');
const { data, error, refresh, pending } = await useAsyncData(`admin-annual-${summaryId}`, () => apiFetch<{summary:AnnualSummaryV4}>(`/api/admin/annual-summaries/${encodeURIComponent(summaryId)}`));
const summary = computed(() => data.value?.summary ? normalizeAnnualSummary(data.value.summary, "zh", (key, params) => t(key, params || {})) : null);
const loadErrorText = computed(() => {
  const value = error.value as { data?: { statusMessage?: string }; statusMessage?: string; message?: string } | null;
  return value?.data?.statusMessage || value?.statusMessage || value?.message || t("annualSummary.state.loadFailed");
});
const retry = async () => { started.value = false; await refresh(); };
</script>
<template>
  <StoryPlayer v-if="summary" :summary="summary" :started="started" profile-fallback="summary" @start="started=true" @open-drawer="backToAdmin" />
  <AnnualScene v-else class="admin-annual-view" mood="award-stage" intensity="low" :active="true" :reduced-motion="true">
    <div class="admin-annual-view__state" role="status">
      <p class="admin-annual-view__message">{{ loadErrorText }}</p>
      <div class="admin-annual-view__actions">
        <button type="button" :disabled="pending" @click="retry">{{ pending ? '加载中…' : '重新加载' }}</button>
        <button type="button" @click="backToAdmin">返回管理</button>
      </div>
    </div>
  </AnnualScene>
  <button v-if="summary" class="admin-annual-view__back" type="button" @click="backToAdmin">返回管理</button>
</template>
<style scoped>
.admin-annual-view{min-height:100dvh;background:#07111e;color:#fff}
.admin-annual-view__state{position:absolute;inset:0;z-index:2;display:grid;place-content:center;gap:18px;padding:24px;text-align:center}
.admin-annual-view__message{margin:0;max-width:26rem;color:#ffecc0d9;font-size:15px;line-height:1.6;overflow-wrap:anywhere}
.admin-annual-view__actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.admin-annual-view__actions button{min-height:44px;padding:0 20px;border-radius:999px;border:1px solid #ffffff38;background:#ffffff1a;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
.admin-annual-view__actions button:disabled{opacity:.6;cursor:default}
.admin-annual-view__back{position:fixed;z-index:100;top:max(12px,env(safe-area-inset-top));left:12px;min-height:44px;padding:0 16px;border:1px solid #ffffff38;border-radius:999px;color:#fff;background:#07111ecc;cursor:pointer}
</style>
