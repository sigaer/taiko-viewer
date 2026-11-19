<script setup lang="ts">
defineProps<{title:string;backPath?:string;backLabel?:string;expanded:boolean}>();
defineEmits<{menu:[]}>();
const {t}=useI18n();const localePath=useLocalePath();
</script>
<template>
  <div class="mobile-page-navigation" :class="{'mobile-page-navigation--detail':backPath}">
    <NuxtLink v-if="backPath" :to="localePath(backPath)" class="mobile-page-back" :aria-label="backLabel"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>{{ backLabel }}</span></NuxtLink>
    <span class="mobile-page-title">{{ title }}</span>
    <button type="button" class="mobile-nav-toggle" :aria-label="t(expanded?'layout.closeNav':'layout.openNav')" :aria-expanded="expanded" aria-controls="site-sidebar" @click="$emit('menu')"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
  </div>
</template>
<style scoped>
.mobile-page-navigation{display:none;min-height:64px;gap:12px;align-items:center;margin:0 0 24px}.mobile-page-title{font-size:22px;font-weight:600;line-height:1.4;min-width:0;overflow-wrap:anywhere}.mobile-page-navigation--detail{grid-template-columns:1fr auto 1fr}.mobile-page-navigation--detail .mobile-page-title{font-size:14px;font-weight:400;color:var(--viewer-text-muted)}.mobile-nav-toggle{justify-self:end;display:grid;place-items:center;min-width:44px;min-height:44px;border:0;border-radius:8px;background:transparent;color:var(--viewer-text);padding:10px;cursor:pointer}.mobile-nav-toggle svg{width:22px;height:22px}.mobile-page-back{display:inline-flex;align-items:center;gap:4px;min-height:44px;text-decoration:none;color:var(--viewer-text);font-size:15px;min-width:0}.mobile-page-back svg{width:20px;height:20px;flex-shrink:0}.mobile-page-back span{overflow-wrap:anywhere}.mobile-page-back:focus-visible,.mobile-nav-toggle:focus-visible{outline:3px solid var(--viewer-link);outline-offset:2px}@media(max-width:960px){.mobile-page-navigation{display:grid;grid-template-columns:1fr auto}.mobile-page-navigation--detail{grid-template-columns:1fr auto 1fr}}
</style>
