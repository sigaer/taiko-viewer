<script setup lang="ts">
definePageMeta({layout:false});
const theme=ref('light'),locale=ref('zh'),state=ref('home-deep');
const cookie=useCookie('song_preview_state'),themeCookie=useCookie('taiko_theme');
function go(path:string){cookie.value=state.value;themeCookie.value=theme.value;localStorage.setItem('taiko_theme',theme.value);window.location.href=(locale.value==='ja'?'/ja':'')+path+'?previewState='+state.value;}
const frames=[['1440','light','zh'],['390','light','zh'],['414','dark','ja']];
</script>
<template>
 <main class="state-review">
  <h1>首页与 My Taiko · 状态预览</h1><p>隔离合成数据，真实 Nuxt 页面。近期事实确认仅返回合成 token 的受控响应，不保存或转发；其他写入拒绝。</p>
  <label>主题 <select v-model="theme"><option>light</option><option>dark</option></select></label><label>语言 <select v-model="locale"><option>zh</option><option>ja</option></select></label>
  <label>状态 <select v-model="state"><option v-for="value in ['home-deep','guest','unbound','empty','auth-failure','binding-failure','scores-failure','overview-failure','recent-failure']" :key="value">{{ value }}</option></select></label>
  <div><button @click="go('/')">首页</button><button @click="go('/my')">My Taiko</button></div>
  <section v-for="page in ['home','my']" :key="page"><h2>{{ page }}</h2><details v-for="[width,t,l] in frames" :key="width"><summary>{{ width }} · {{ t }} · {{ l }}</summary><div class="pair"><figure v-for="stage in ['before','after']" :key="stage"><figcaption>{{ stage }}</figcaption><img :src="`/__batch2-shots/${stage}-${page}-${width}-${t}-${l}.png`" :alt="`${stage} ${page}`" loading="lazy"></figure></div></details></section>
 </main>
</template>
<style scoped>
.state-review{max-width:1100px;margin:32px auto;padding:20px;font-family:system-ui;color:var(--viewer-text);background:var(--viewer-bg)}label{display:inline-flex;align-items:center;gap:8px;margin:0 16px 12px 0}button,select,summary{min-height:44px;font:inherit}button{margin:8px;padding:8px 16px;cursor:pointer}summary{align-content:center;cursor:pointer}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%;height:auto}section{margin-top:28px}@media(max-width:600px){.pair{grid-template-columns:1fr}}
</style>
