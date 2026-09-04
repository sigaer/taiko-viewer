<script setup lang="ts">
import StoryPlayer from "~/components/account/version-summary/StoryPlayer.vue";
import { normalizeAnnualSummary } from "~/utils/annualSummary";
import type { AnnualSummaryV4 } from "~/types/account-version-summary";
defineI18nRoute(false); definePageMeta({ layout: "story", middleware: "admin-auth", mobileNav: false });
const route=useRoute(); const {t}=useI18n(); const started=ref(false); const raw=ref<AnnualSummaryV4|null>(null);
onMounted(()=>{try{raw.value=JSON.parse(sessionStorage.getItem(`annual-admin-preview-${String(route.params.taikoId||"")}`)||"null")}catch{raw.value=null}});
const summary=computed(()=>raw.value?normalizeAnnualSummary(raw.value,"zh",(key,params)=>t(key,params||{})):null);
</script>
<template><div class="preview"><button class="back" @click="navigateTo('/admin/taiko/annual-summaries')">返回管理</button><StoryPlayer v-if="summary" :summary="summary" :started="started" @start="started=true" @open-drawer="navigateTo('/admin/taiko/annual-summaries')"/><div v-else class="error">预览数据不可用，请返回重新生成。</div></div></template>
<style scoped>.preview{min-height:100dvh;background:#07111e}.back{position:fixed;z-index:100;top:max(12px,env(safe-area-inset-top));left:12px;min-height:44px;padding:0 16px;border:1px solid #ffffff38;border-radius:999px;color:#fff;background:#07111ecc}.error{min-height:100dvh;display:grid;place-items:center;color:#fff}</style>
