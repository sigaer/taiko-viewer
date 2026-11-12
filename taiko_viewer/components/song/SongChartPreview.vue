<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
const props = defineProps<{ songId:number; songTitle:string; difficulty:number; track:string; label:string; star:string; combo:string; folder:string; tjaBundleUrl:string; side?:string }>();
const { locale } = useI18n(), localePath=useLocalePath();
const url = computed(()=>`/api/content/songs/${props.songId}/chart-image?difficulty=${props.difficulty}&side=${props.side || 'single'}`);
const loaded=ref(false),failed=ref(false),expanded=ref(false);
const imageElement=ref<HTMLImageElement|null>(null);
const resolveCachedImage=()=>{
  if(!imageElement.value?.complete)return;
  loaded.value=imageElement.value.naturalWidth>0;
  failed.value=!loaded.value;
};
// A cached SSR image can finish before hydration installs the load listener.
onMounted(resolveCachedImage);
watch(url,async()=>{loaded.value=false;failed.value=false;expanded.value=false;await nextTick();resolveCachedImage();});
const copy=computed(()=>locale.value==='ja'?{notes:'最大ノーツ',open:'譜面全体 ↗',practice:'練習プレイヤー ↗',download:'TJA+OGG をダウンロード',loading:'譜面を読み込み中…',failed:'譜面を読み込めませんでした',excerpt:'譜面の一部',expand:'表示を広げる',collapse:'表示を戻す',scroll:'譜面の一部。横にスクロールできます。全体は譜面画像を開いて確認できます。'}:{notes:'最大物量',open:'完整谱面 ↗',practice:'打开练习播放器 ↗',download:'下载 TJA+OGG',loading:'正在读取谱面…',failed:'谱面暂时无法读取',excerpt:'谱面节选',expand:'展开节选',collapse:'收起节选',scroll:'谱面节选，可横向滚动；打开完整谱面查看全部内容。'});
</script>
<template>
  <section id="song-chart-workspace" class="song-chart-workspace" role="tabpanel" :aria-labelledby="`song-track-${track}`">
    <div class="chart-heading">
      <div class="chart-identity"><h2>{{ label }} <span>{{ star }}</span></h2><p>{{ copy.notes }} <strong>{{ combo }}</strong></p></div>
      <div class="chart-actions">
        <NuxtLink v-if="tjaBundleUrl" class="song-action song-action--primary" :to="localePath(`/ourtaikoview/${songId}/${difficulty}`)" target="_blank" rel="noopener noreferrer">{{ copy.practice }}</NuxtLink>
        <a class="chart-complete-link" :href="url" target="_blank" rel="noopener noreferrer">{{ copy.open }}</a>
      </div>
    </div>
    <div class="chart-excerpt-head"><span>{{ copy.excerpt }}</span><button type="button" class="chart-excerpt-toggle" :aria-expanded="expanded" :aria-controls="`chart-sheet-${songId}`" @click="expanded=!expanded">{{ expanded ? copy.collapse : copy.expand }}<span aria-hidden="true">{{ expanded ? '−' : '+' }}</span></button></div>
    <div :id="`chart-sheet-${songId}`" class="chart-sheet" :class="{ 'chart-sheet--expanded': expanded }" tabindex="0" role="region" :aria-label="copy.scroll" :aria-busy="!loaded&&!failed" :key="url">
      <p v-if="!loaded&&!failed" class="chart-state" role="status">{{ copy.loading }}</p>
      <p v-if="failed" class="chart-state" role="status">{{ copy.failed }}</p>
      <a v-show="!failed" :href="url" target="_blank" rel="noopener noreferrer" :aria-label="copy.open">
        <img ref="imageElement" :src="url" :alt="`${songTitle} · ${label} ${star}`" decoding="async" loading="eager" @load="loaded=true" @error="failed=true">
      </a>
    </div>
    <slot />
    <footer v-if="tjaBundleUrl" class="chart-footer"><a :href="tjaBundleUrl">{{ copy.download }}</a></footer>
  </section>
</template>
<style scoped>
.song-chart-workspace { min-width:0; border-radius:14px; overflow:hidden; background:var(--viewer-surface); padding:24px; }
.chart-heading{display:grid;gap:20px;}
.chart-identity{display:flex;align-items:baseline;gap:10px 20px;flex-wrap:wrap;}
h2{font-size:18px;line-height:1.5;margin:0;font-weight:600;}h2 span{font-weight:400;}
.chart-identity p{font-size:14px;margin:0;color:var(--viewer-text-muted);}.chart-identity strong{font-weight:500;color:var(--viewer-text);margin-left:4px;}
.chart-actions{display:flex;gap:12px;flex-wrap:wrap;}
.song-action{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 18px;border:1px solid var(--viewer-control-border);border-radius:8px;color:var(--viewer-text);text-decoration:none;font-size:15px;font-weight:600;line-height:1.5;}
.song-action--primary{background:var(--viewer-primary);border-color:var(--viewer-primary);color:var(--viewer-on-primary);}
.chart-complete-link{display:inline-flex;align-items:center;min-height:46px;padding:10px 0;color:var(--viewer-link);font-size:15px;text-decoration:none;}
.chart-excerpt-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px;font-size:14px;color:var(--viewer-text-muted);}
.chart-excerpt-toggle{display:inline-flex;align-items:center;justify-content:end;gap:10px;min-height:44px;padding:6px 0 6px 12px;border:0;background:transparent;color:var(--viewer-link);font:inherit;cursor:pointer;}
.chart-excerpt-toggle span{font-size:18px;}
.chart-sheet{height:280px;overflow-x:auto;overflow-y:hidden;position:relative;background:var(--viewer-surface);border-radius:6px;scrollbar-color:var(--viewer-control-border) var(--viewer-surface-subtle);}
.chart-sheet--expanded{height:560px;overflow-y:auto;}
.chart-sheet a{display:block;min-width:680px;}.chart-sheet img{display:block;width:100%;height:auto;}
/* A fixed excerpt window starts at the notation, not the duplicate image title.
   Expanding restores the unshifted original. No pixels or chart data are changed. */
.chart-sheet:not(.chart-sheet--expanded) a{position:relative;top:-64px;}
.chart-state{position:sticky;left:0;top:0;margin:0;padding:20px;font-size:14px;background:var(--viewer-surface);color:var(--viewer-text-muted);}
.chart-footer{padding:0;text-align:left;}.chart-footer a{display:inline-flex;align-items:center;min-height:44px;color:var(--viewer-link);font-size:14px;text-underline-offset:4px;}
a:focus-visible,.chart-excerpt-toggle:focus-visible,.chart-sheet:focus-visible{outline:3px solid var(--viewer-link);outline-offset:-3px;}
@media(max-width:767px){.song-chart-workspace{padding:20px 16px 12px}.chart-heading{gap:16px}.chart-actions{gap:20px;align-items:center}.song-action{padding:11px 15px}.chart-complete-link{font-size:14px}.chart-sheet{height:164px}.chart-sheet--expanded{height:560px}.chart-excerpt-head{margin-top:12px}.chart-sheet:not(.chart-sheet--expanded) a{top:-56px;}}
</style>
