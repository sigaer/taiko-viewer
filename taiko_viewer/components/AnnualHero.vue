<script setup lang="ts">
const localePath=useLocalePath();const {locale}=useI18n();const {track}=useAnnualBeta();const banner=ref<HTMLElement|null>(null);let observer:IntersectionObserver|null=null;
onMounted(()=>{track('home_view');observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.5)){track('annual_entry_impression',{source:'home_hero'});observer?.disconnect();}},{threshold:.5});if(banner.value)observer.observe(banner.value);});
onBeforeUnmount(()=>observer?.disconnect());
</script>
<template><div ref="banner" class="annual-hero"><NuxtLink :to="localePath('/annual')" :aria-label="locale==='ja'?'年間レポートを見る':'查看年度报告'" @click="track('annual_entry_click',{source:'home_hero'})"><img src="/hero.png" alt="" width="612" height="121" fetchpriority="high"></NuxtLink></div></template>
<style scoped>.annual-hero a{display:block;border-radius:12px;overflow:hidden}.annual-hero a:focus-visible{outline:3px solid var(--el-color-primary);outline-offset:4px}.annual-hero img{display:block;width:100%;height:auto}</style>
