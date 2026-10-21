<script setup lang="ts">
const { theme, setTheme } = useViewerTheme();
const { locale } = useI18n();
const pages = [{name:'成绩 / 成績',path:'/account/songs',key:'scores'},{name:'B30',path:'/tools/b30',key:'b30'},{name:'进度 / 進捗',path:'/tools/progress',key:'progress'}];
const states = ['scores','manual','empty','options-failure','image-failure','scores-failure','catalog-failure','unbound','guest'];
const prefix = computed(() => locale.value === 'ja' ? '/ja' : '');
</script>
<template>
  <section class="batch-review">
    <h1>Viewer 第二批 UI · 合成数据预览</h1>
    <p>真实 Nuxt 页面与组件；固定图片仅供页面验证，不是计算结果。所有业务写入被拒绝，不连接生产账号。</p>
    <div><el-button @click="setTheme(theme === 'dark' ? 'light' : 'dark')">浅 / 暗</el-button><a :href="locale === 'ja' ? '/__batch2' : '/ja/__batch2'">中文 / 日本語</a></div>
    <section v-for="page in pages" :key="page.key">
      <h2>{{ page.name }}</h2>
      <nav><a v-for="state in states" :key="state" :href="`${prefix}${page.path}?previewState=${state}`">{{ state }}</a></nav>
      <details><summary>同输入前后对照 · 1440 / 390 / 414</summary>
        <div v-for="sample in [{width:1440,theme:'light',lang:'zh'},{width:390,theme:'light',lang:'zh'},{width:414,theme:'dark',lang:'ja'}]" :key="sample.width" class="comparison">
          <figure v-for="stage in ['before','after']" :key="stage"><figcaption>{{ stage }} · {{ sample.width }} · {{ sample.theme }} · {{ sample.lang }}</figcaption><a :href="`/__batch2-shots/${stage}-${page.key}-${sample.width}-${sample.theme}-${sample.lang}-scores.png`" target="_blank"><img :src="`/__batch2-shots/${stage}-${page.key}-${sample.width}-${sample.theme}-${sample.lang}-scores.png`" loading="lazy" alt="同输入真实页面截图" /></a></figure>
        </div>
      </details>
    </section>
  </section>
</template>
<style scoped>
.batch-review { display:grid; gap:20px; }
h1 { font-size:24px; margin:0; } h2 { font-size:19px; }
p { color:var(--viewer-text-muted); line-height:1.7; }
a { color:var(--viewer-link); } nav { display:flex; gap:16px; flex-wrap:wrap; }
summary { padding-block:16px; cursor:pointer; color:var(--viewer-link); }
.comparison { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
figure { margin:0; min-width:0; } figcaption { margin-bottom:8px; } img { max-width:100%; height:auto; }
</style>
