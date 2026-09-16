<script setup lang="ts">
const {status,refresh,track}=useAnnualBeta();const localePath=useLocalePath();const {locale}=useI18n();onActivated(()=>void refresh().catch(()=>{}));
</script>
<template><div v-if="status?.entitled" class="beta-continue"><NuxtLink :to="localePath('/annual')" @click="track('annual_entry_click',{source:'account_continuation'})">{{locale==='ja'?'年間レポートへ':'继续查看年度报告'}} →</NuxtLink></div></template>
<style scoped>.beta-continue a{display:inline-flex;align-items:center;min-height:44px;font-weight:700}</style>
