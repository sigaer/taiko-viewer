<script setup lang="ts">
import StoryPlayer from "~/components/account/version-summary/StoryPlayer.vue";
import { normalizeAnnualSummary } from "~/utils/annualSummary";
import type { AnnualSummaryV4 } from "~/types/account-version-summary";
defineI18nRoute(false); definePageMeta({ layout: "story", middleware: "admin-auth", mobileNav: false });
const route = useRoute(); const apiFetch = useAdminApiFetch(); const started = ref(false); const { t } = useI18n();
const summaryId = String(route.params.summaryId || "");
const { data, error } = await useAsyncData(`admin-annual-${summaryId}`, () => apiFetch<{summary:AnnualSummaryV4}>(`/api/admin/annual-summaries/${encodeURIComponent(summaryId)}`));
const summary = computed(() => data.value?.summary ? normalizeAnnualSummary(data.value.summary, "zh", (key, params) => t(key, params || {})) : null);
</script>
<template><div class="admin-annual-view"><button class="admin-annual-view__back" @click="navigateTo('/admin/taiko/annual-summaries')">返回管理</button><StoryPlayer v-if="summary" :summary="summary" :started="started" @start="started=true" @open-drawer="navigateTo('/admin/taiko/annual-summaries')"/><div v-else class="admin-annual-view__error">{{ error?.message || '年度报告不可用' }}</div></div></template>
<style scoped>.admin-annual-view{min-height:100dvh;background:#07111e}.admin-annual-view__back{position:fixed;z-index:100;top:max(12px,env(safe-area-inset-top));left:12px;min-height:44px;padding:0 16px;border:1px solid #ffffff38;border-radius:999px;color:#fff;background:#07111ecc;cursor:pointer}.admin-annual-view__error{min-height:100dvh;display:grid;place-items:center;color:#fff}</style>
