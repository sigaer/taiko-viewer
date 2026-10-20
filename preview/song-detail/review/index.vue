<script setup lang="ts">
definePageMeta({pageTitle:'设计预览',hidePageDescription:true,navKey:'/more'});
const state=ref('scores');
const pages=[['歌曲列表','/songs/available'],['歌曲详情','/songs/1455'],['普通推荐','/tools/recommend'],['资料与绑定','/account/profile'],['首页','/'],['成绩','/account/songs'],['成长','/my/growth'],['周报','/my/weekly'],['社区','/forum'],['开发者指南','/docs/score-token'],['设置','/settings'],['年度报告入口','/annual']];
const width=ref('414'),screen=ref('catalog'),theme=ref('light');
const screenshot=(stage:string)=>`/__review-assets/screenshots/${stage}-${screen.value}-${width.value}-${theme.value}-zh.png`;
const homeTheme=ref('light'),homeState=ref('scores');
const homeShot=(stage:string)=>`/__review-assets/screenshots/home-width-${stage}-1440-${homeTheme.value}-${homeState.value}-full.png`;
const contentScreen=ref('catalog'), contentCase=ref('414-light-zh');
const contentShot=(stage:string,suffix='')=>`/__review-assets/content-refinement-20261020/screenshots/${stage}-${contentScreen.value}-${contentCase.value}${suffix}.png`;
</script>
<template>
  <section class="review-page">
    <p class="review-note">只读设计预览 · 公开歌曲数据与合成个人记录 · 写入操作会被拒绝</p>
    <h2>连续浏览真实页面</h2>
    <label>个人数据 <select v-model="state"><option value="scores">有成绩</option><option value="empty">无成绩</option><option value="guest">未登录</option><option value="pending">待确认绑定</option><option value="unbound">未绑定</option><option value="failure">首页读取失败</option><option value="changes">有变化与今日记录</option><option value="unchanged">同步后无新变化</option><option value="recent-failure">仅最近变化读取失败</option></select></label>
    <nav><NuxtLink v-for="[label,path] in pages" :key="path" :to="`${path}?previewState=${state}`" external>{{ label }} →</NuxtLink></nav>
    <p>可通过菜单继续跨页导航。切换合成身份采用完整导航，避免把旧登录状态带入新预览；普通站内页面仍使用原有 Nuxt 路由。</p>
    <h2>本次内容收口 · 与 63fda22 对照</h2>
    <p>保持已通过的容器与推荐密度。这里的前后截图使用相同数据、Chromium 113、100% 缩放和模拟视口；歌曲截图已等到个人成绩完成加载。社区前后均使用同一份有内容的合成列表。</p>
    <div class="review-controls"><label>页面 <select v-model="contentScreen"><option value="catalog">歌曲列表</option><option value="song">歌曲详情</option><option value="recommend">20 条推荐</option><option value="profile">资料与绑定</option><option value="home">首页</option><option value="settings">设置</option><option value="developer">成绩 token 指南</option><option value="community">社区列表</option></select></label><label>视口 / 主题 / 语言 <select v-model="contentCase"><option value="414-light-zh">414×846 · 浅色中文</option><option value="390-light-zh">390×844 · 浅色中文</option><option value="1440-light-zh">1440×1000 · 浅色中文</option><option value="1440-dark-ja">1440×1000 · 暗色日文</option></select></label></div>
    <div class="review-pair"><figure v-for="stage in ['before','after']" :key="stage"><figcaption>{{ stage==='before'?'内容收口前 · 63fda22':'内容收口后' }}</figcaption><a :href="contentShot(stage)" target="_blank"><img loading="lazy" :src="contentShot(stage)" :alt="`${stage} ${contentScreen} ${contentCase}`"></a><p v-if="contentScreen==='song'"><a :href="contentShot(stage,'-scores')" target="_blank">成绩与讨论完成态</a> · <a :href="contentShot(stage,'-chart')" target="_blank">真实谱面节选</a></p><p v-else-if="['home','profile','community','settings','developer','recommend'].includes(contentScreen) && ['414-light-zh','1440-light-zh'].includes(contentCase)"><a :href="contentShot(stage,'-full')" target="_blank">查看完整页面</a></p></figure></div>
    <p><a href="/__review-assets/content-refinement-20261020/README.md">本次简短说明与状态截图</a></p>
    <h2>保留的公共基础历史对照</h2>

    <p>普通页面 1000px，正文与主要表单 800px，密集数据 1180px；都在侧栏右侧居中。播放器与年度演出保留专用画布，手机共用 20px 外围边距。</p>
    <div class="review-controls"><label>页面 <select v-model="screen"><option value="catalog">歌曲列表</option><option value="song">歌曲详情</option><option value="recommend">20 条推荐</option><option value="profile">资料与绑定</option></select></label><label>宽度 <select v-model="width"><option>414</option><option>390</option><option>820</option><option>1440</option></select></label><label>主题 <select v-model="theme"><option value="light">浅色</option><option value="dark">暗色</option></select></label></div>
    <div class="review-pair"><figure v-for="stage in ['before','after']" :key="stage"><figcaption>{{ stage==='before'?'公共基础前 · 55a979a':'公共基础完成时 · 63fda22' }}</figcaption><a :href="screenshot(stage)" target="_blank"><img :src="screenshot(stage)" :alt="`${stage} ${screen} ${width} ${theme}`"></a></figure></div>
    <p>其他适配截图：<a :href="`/__review-assets/screenshots/after-${screen}-1280-${theme}-zh.png`" target="_blank">1280</a> · <a :href="`/__review-assets/screenshots/after-${screen}-1920-${theme}-zh.png`" target="_blank">1920</a> · <a :href="`/__review-assets/screenshots/after-${screen}-414-light-ja.png`" target="_blank">日文 414</a> · <a :href="`/__review-assets/screenshots/after-${screen}-1440-dark-ja.png`" target="_blank">日文 1440 暗色</a></p>
    <h2>首页宽度 · 1440 同视口</h2>
    <div class="review-controls"><label>主题 <select v-model="homeTheme"><option value="light">浅色</option><option value="dark">暗色</option></select></label><label>数据 <select v-model="homeState"><option value="scores">正常合成记录</option><option value="failure">明确 503 失败</option></select></label></div>
    <p>已有公共样式下的空间调整：主体 1106px → 1000px，两侧留白约 43px → 96px。六首歌曲与顺序不变，按实际空间换行；手机保持 20px 页边距。</p>
    <div class="review-pair"><figure v-for="stage in ['before','after']" :key="stage"><figcaption>{{ stage==='before'?'宽度调整前':'1000px 居中后' }}</figcaption><a :href="homeShot(stage)" target="_blank"><img loading="lazy" :src="homeShot(stage)" :alt="`首页 ${stage} 1440 ${homeTheme} ${homeState}`"></a></figure></div>
    <p><a href="/__review-assets/migration.md">全站迁移表</a> · <a href="/__review-assets/README.md">改动与检查说明</a> · <a href="/__song-review/index.html">保留的歌曲页历史对照</a></p>
  </section>
</template>
<style scoped>
.review-page{max-width:1200px;margin:auto;display:grid;gap:20px}.review-page h2{font-size:22px;margin:8px 0 0}.review-page p{margin:0;line-height:1.7;color:var(--viewer-text-muted)}.review-note{padding:16px;background:var(--viewer-surface);border-radius:12px}label{display:inline-flex;align-items:center;gap:12px}select{min-height:44px;padding:8px;font:inherit;background:var(--viewer-surface);color:var(--viewer-text);border:1px solid var(--viewer-border);border-radius:6px}nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px 24px}a{color:var(--viewer-accent-strong);min-height:44px;align-content:center}nav a{display:block;text-decoration:none}.review-controls{display:flex;flex-wrap:wrap;gap:16px}.review-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;min-width:0}figcaption{margin-bottom:12px}.review-pair img{width:100%;height:auto;display:block}a:focus-visible,select:focus-visible{outline:3px solid var(--viewer-accent-strong);outline-offset:3px}
</style>
