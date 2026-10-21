<script setup lang="ts">
definePageMeta({layout:false});
const theme=ref('light'),locale=ref('zh');
const cookie=useCookie('song_preview_state'),themeCookie=useCookie('taiko_theme');
function go(path:string){cookie.value='song-rows';themeCookie.value=theme.value;localStorage.setItem('taiko_theme',theme.value);window.location.href=(locale.value==='ja'?'/ja':'')+path+'?previewState=song-rows';}
const frames=[['1440','light','zh'],['390','light','zh'],['414','dark','ja']];
</script>
<template>
 <main class="row-review">
  <h1>首页批次 · 共享歌曲条目</h1><p>隔离合成数据，真实 Nuxt 页面。确认操作只在受控响应中验收，真实业务写入为 0。</p>
  <label>主题 <select v-model="theme"><option>light</option><option>dark</option></select></label><label>语言 <select v-model="locale"><option>zh</option><option>ja</option></select></label>
  <div><button @click="go('/')">首页今日推荐</button><button @click="go('/tools/recommend')">普通推荐</button></div>
  <section v-for="page in ['home','recommend']" :key="page"><h2>{{ page }}</h2><details v-for="[width,t,l] in frames" :key="width"><summary>{{ width }} · {{ t }} · {{ l }}</summary><div class="pair"><figure v-for="stage in ['before','after']" :key="stage"><figcaption>{{ stage }}</figcaption><img :src="`/__batch2-shots/${stage}-${page}-${width}-${t}-${l}.png`" :alt="`${stage} ${page}`" loading="lazy"></figure></div></details></section>
 </main>
</template>
<style scoped>
.row-review{max-width:1100px;margin:32px auto;padding:20px;font-family:system-ui;color:var(--viewer-text);background:var(--viewer-bg)}label{display:inline-flex;align-items:center;gap:8px;margin:0 16px 12px 0}button,select,summary{min-height:44px;font:inherit}button{margin:8px;padding:8px 16px;cursor:pointer}summary{align-content:center;cursor:pointer}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%;height:auto}section{margin-top:28px}@media(max-width:600px){.pair{grid-template-columns:1fr}}
</style>
