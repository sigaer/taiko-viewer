<script setup lang="ts">
definePageMeta({layout:false});
const state = ref('scores');
const theme = ref('light');
const language = ref('zh');
const cookie = useCookie('song_preview_state');
const themeCookie = useCookie('taiko_theme');
const go = (page: string) => {
 cookie.value=state.value; themeCookie.value=theme.value;
 localStorage.setItem('taiko_theme',theme.value);
 window.location.href=(language.value==='ja'?'/ja':'')+page+'?previewState='+state.value;
};
const frames=[['1440','light','zh'],['390','light','zh'],['414','dark','ja']];
</script>
<template>
 <main class="review">
  <h1>成长档案与周报 · 真实组件预览</h1>
  <p>仅使用隔离的合成数据；API 写入不转发。</p>
  <label>状态 <select v-model="state"><option v-for="value in ['scores','growth-expanded', 'growth-empty','growth-single','growth-missing','growth-limited','growth-unknown','growth-incompatible','growth-no-next','growth-quiet','growth-no-play','growth-failure','slow','guest','unbound']" :key="value">{{ value }}</option></select></label>
  <label>主题 <select v-model="theme"><option>light</option><option>dark</option></select></label>
  <label>语言 <select v-model="language"><option>zh</option><option>ja</option></select></label>
  <div><button @click="go('/my/growth')">成长档案</button><button @click="go('/my/weekly')">周报</button><button @click="go('/account/songs')">成绩分页</button></div>
  <section v-for="page in ['growth','weekly']" :key="page">
   <h2>{{ page }}</h2>
   <details v-for="[width,t,l] in frames" :key="width"><summary>{{ width }} · {{ t }} · {{ l }} · 同输入对照</summary><div class="pair"><figure v-for="stage in ['before','after']" :key="stage"><figcaption>{{ stage }}</figcaption><img :src="`/__batch2-shots/${stage}-${page}-${width}-${t}-${l}-scores.png`" :alt="`${stage} ${page}`" loading="lazy"></figure></div></details>
  </section>
 </main>
</template>
<style scoped>
.review{max-width:1100px;margin:32px auto;padding:20px;font-family:system-ui;color:var(--viewer-text);background:var(--viewer-bg)}
label{display:inline-flex;align-items:center;gap:8px;margin:0 16px 12px 0}select,button,summary{min-height:44px;font:inherit}button{margin:8px;padding:8px 16px;cursor:pointer}summary{align-content:center;cursor:pointer}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{max-width:100%;height:auto}section{margin-top:28px}@media(max-width:600px){.pair{grid-template-columns:1fr}}
</style>
