<script setup lang="ts">
import { computed, ref } from "vue";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";
import type { VersionSummaryMonthlyFavorite } from "~/types/account-version-summary";

const props = defineProps<{
  item: VersionSummaryMonthlyFavorite;
  index: number;
  compact?: boolean;
  motionDisabled?: boolean;
}>();

const coverFailed = ref(false);
const leafSrc = computed(() => props.index % 2 === 0 ? "/monthly/leaf_1_11.png" : "/monthly/leaf_2_11.png");
const leafWidth = computed(() => props.compact
  ? (props.index % 2 === 0 ? "clamp(86px, 31vw, 128px)" : "clamp(112px, 40vw, 160px)")
  : ["clamp(104px, 29vw, 126px)", "clamp(158px, 43vw, 190px)", "clamp(110px, 30vw, 132px)", "clamp(158px, 43vw, 190px)", "clamp(188px, 51vw, 224px)", "clamp(150px, 41vw, 182px)"][props.index % 6]);

const handleCoverError = () => {
  coverFailed.value = true;
};
</script>

<template>
  <article
    class="monthly-leaf-item"
    :class="{ 'is-compact': compact, 'is-motion-disabled': motionDisabled }"
    :style="{ '--leaf-delay': `${Math.min(index * 70, 700)}ms`, '--leaf-width': leafWidth }"
    :aria-label="`${item.monthLabel} ${item.song.name}`"
  >
    <div class="monthly-leaf-item__month" data-annual-stage="visual">
      <img src="/monthly/circle_11.png" alt="" aria-hidden="true" width="40" height="40">
      <span>{{ item.monthLabel }}</span>
    </div>

    <div class="monthly-leaf-item__cover" data-annual-stage="data">
      <img class="monthly-leaf-item__ring" src="/monthly/circle_cover_11.png" alt="" aria-hidden="true" width="56" height="56">
      <div class="monthly-leaf-item__cover-inner">
        <img
          v-if="!coverFailed"
          class="monthly-leaf-item__cover-image"
          :src="item.song.coverUrl"
          :alt="`${item.song.name} 封面`"
          width="40"
          height="40"
          loading="lazy"
          decoding="async"
          @error="handleCoverError"
        >
        <AnnualArtworkFallback v-else class="monthly-leaf-item__cover-fallback" :label="`${item.song.name} 封面`" />
      </div>
    </div>

    <div class="monthly-leaf-item__leaf" data-annual-stage="visual">
      <img :src="leafSrc" alt="" aria-hidden="true" width="2172" height="724">
      <span :title="item.song.name">《{{ item.song.name }}》</span>
    </div>
  </article>
</template>

<style scoped>
.monthly-leaf-item{position:relative;display:flex;align-items:center;min-width:0;height:100%;padding-left:clamp(54px,16vw,68px);color:#14602d}.monthly-leaf-item__month{position:absolute;left:clamp(3px,2vw,10px);top:50%;width:40px;height:40px;transform:translateY(-50%);display:grid;place-items:center;z-index:3}.monthly-leaf-item__month img{position:absolute;inset:0;width:40px;height:40px}.monthly-leaf-item__month span{position:relative;z-index:1;font:700 clamp(12px,3.1vw,15px)/1 var(--viewer-font-family);white-space:nowrap;color:#26723b}.monthly-leaf-item__cover{position:relative;z-index:4;flex:0 0 56px;width:56px;height:56px}.monthly-leaf-item__ring{position:absolute;inset:0;width:56px;height:56px;z-index:1}.monthly-leaf-item__cover-inner{position:absolute;left:8px;top:8px;width:40px;height:40px;overflow:hidden;border-radius:50%;z-index:2;background:#d5e9cf}.monthly-leaf-item__cover-image,.monthly-leaf-item__cover-fallback{display:block;width:40px;height:40px;object-fit:cover;border-radius:50%}.monthly-leaf-item__cover-fallback :deep(.annual-artwork-fallback){min-height:40px}.monthly-leaf-item__leaf{position:relative;z-index:2;flex:0 1 var(--leaf-width);width:var(--leaf-width);max-width:calc(100% - 1px);min-width:0;height:min(46px,100%);margin-left:-1px;transform-origin:left center}.monthly-leaf-item__leaf>img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;transform-origin:left center;animation:monthly-leaf-grow 850ms cubic-bezier(.22,.8,.27,1) both;animation-delay:var(--leaf-delay);will-change:transform}.monthly-leaf-item__leaf span{position:absolute;left:clamp(22px,7vw,35px);right:clamp(12px,4vw,20px);top:50%;transform:translateY(-50%);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f2f8df;font:700 clamp(11px,2.8vw,14px)/1.2 var(--viewer-font-family);text-align:center;text-shadow:0 1px 2px rgba(0,35,13,.25)}
.monthly-leaf-item.is-compact{padding-left:clamp(50px,15vw,64px)}.monthly-leaf-item.is-compact .monthly-leaf-item__cover{transform:scale(.9);transform-origin:left center}.monthly-leaf-item.is-compact .monthly-leaf-item__leaf{margin-left:-6px;height:min(40px,100%)}.monthly-leaf-item.is-compact .monthly-leaf-item__leaf span{left:clamp(18px,5vw,28px);right:clamp(9px,3vw,15px);font-size:clamp(10px,2.5vw,12px)}
@keyframes monthly-leaf-grow{from{transform:scaleX(.03);opacity:.45}to{transform:scaleX(1);opacity:1}}
.monthly-leaf-item.is-motion-disabled .monthly-leaf-item__leaf>img{animation:none;transform:scaleX(1);will-change:auto}
@media (prefers-reduced-motion:reduce){.monthly-leaf-item__leaf>img{animation:none;transform:scaleX(1);will-change:auto}}
</style>
