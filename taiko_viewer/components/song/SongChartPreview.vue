<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
const props = defineProps<{ songId:number; songTitle:string; difficulty:number; track:string; label:string; star:string; combo:string; folder:string; tjaBundleUrl:string }>();
const { locale } = useI18n(), localePath=useLocalePath();
const url = computed(()=>`https://static.sakura-bot.cn/fumen/${props.folder}/${props.songId}.png`);
const loaded=ref(false),failed=ref(false);
const imageElement=ref<HTMLImageElement|null>(null);
const resolveCachedImage=()=>{
  if(!imageElement.value?.complete)return;
  loaded.value=imageElement.value.naturalWidth>0;
  failed.value=!loaded.value;
};
// A cached SSR image can finish before hydration installs the load listener.
onMounted(resolveCachedImage);
watch(url,async()=>{loaded.value=false;failed.value=false;await nextTick();resolveCachedImage();});
const copy=computed(()=>locale.value==='ja'?{notes:'最大ノーツ',open:'譜面画像を開く ↗',practice:'練習プレイヤー ↗',download:'TJA+OGG をダウンロード',loading:'譜面を読み込み中…',failed:'譜面を読み込めませんでした',scroll:'譜面の一部。横にスクロールできます。全体は譜面画像を開いて確認できます。'}:{notes:'最大物量',open:'查看完整谱面 ↗',practice:'打开练习播放器 ↗',download:'下载 TJA+OGG',loading:'正在读取谱面…',failed:'谱面暂时无法读取',scroll:'谱面节选，可横向滚动；打开完整谱面查看全部内容。'});
</script>
<template>
  <section id="song-chart-workspace" class="song-chart-workspace" role="tabpanel" :aria-labelledby="`song-track-${track}`">
    <div class="chart-heading">
      <div class="chart-identity"><h2>{{ label }} <span>{{ star }}</span></h2><p>{{ copy.notes }} <strong>{{ combo }}</strong></p></div>
      <div class="chart-actions">
        <NuxtLink v-if="tjaBundleUrl" class="song-action song-action--primary" :to="localePath(`/ourtaikoview/${songId}/${difficulty}`)" target="_blank" rel="noopener noreferrer">{{ copy.practice }}</NuxtLink>
        <a class="song-action" :href="url" target="_blank" rel="noopener noreferrer">{{ copy.open }}</a>
      </div>
    </div>
    <div class="chart-sheet" tabindex="0" role="region" :aria-label="copy.scroll" :aria-busy="!loaded&&!failed" :key="url">
      <p v-if="!loaded&&!failed" class="chart-state" role="status">{{ copy.loading }}</p>
      <p v-if="failed" class="chart-state" role="status">{{ copy.failed }}</p>
      <a v-show="!failed" :href="url" target="_blank" rel="noopener noreferrer" :aria-label="copy.open">
        <img ref="imageElement" :src="url" :alt="`${songTitle} · ${label} ${star}`" decoding="async" loading="eager" @load="loaded=true" @error="failed=true">
      </a>
    </div>
    <footer v-if="tjaBundleUrl" class="chart-footer"><a :href="tjaBundleUrl">{{ copy.download }}</a></footer>
    <slot />
  </section>
</template>
<style scoped>
.song-chart-workspace { min-width:0; border:1px solid var(--song-rule); border-radius:14px; overflow:hidden; background:var(--song-paper); }
.chart-heading{padding:22px 24px;display:grid;gap:18px;}
.chart-identity{display:flex;align-items:baseline;gap:10px 20px;flex-wrap:wrap;}
h2{font-size:19px;line-height:1.5;margin:0;font-weight:650;}h2 span{font-weight:500;}
.chart-identity p{font-size:14px;margin:0;color:var(--song-muted);}.chart-identity strong{font-weight:500;color:var(--song-ink);margin-left:4px;}
.chart-actions{display:flex;gap:12px;flex-wrap:wrap;}
.song-action{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 15px;border:1px solid var(--song-control);border-radius:7px;color:var(--song-ink);text-decoration:none;font-size:14px;font-weight:600;line-height:1.5;}
.song-action--primary{background:var(--song-red);border-color:var(--song-red);color:var(--song-on-red);}
.chart-sheet{height:320px;overflow-x:auto;overflow-y:hidden;position:relative;background:#fff;border-block:1px solid var(--song-rule);scrollbar-color:var(--song-control) var(--song-tint);}
.chart-sheet a{display:block;min-width:680px;}.chart-sheet img{display:block;width:100%;height:auto;}
.chart-state{position:sticky;left:0;top:0;margin:0;padding:20px;font-size:14px;background:var(--song-paper);color:var(--song-muted);}
.chart-footer{padding:12px 24px;text-align:right;}.chart-footer a{display:inline-flex;align-items:center;min-height:44px;color:var(--song-link);font-size:14px;text-underline-offset:4px;}
a:focus-visible,.chart-sheet:focus-visible{outline:3px solid var(--song-link);outline-offset:-3px;}
@media(max-width:767px){.chart-heading{padding:18px 16px;gap:16px}.chart-actions{gap:10px}.song-action{flex:1;padding:10px 8px;font-size:14px}.chart-sheet{height:260px}.chart-footer{padding:8px 16px;text-align:left}}
</style>
