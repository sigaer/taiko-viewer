<script setup lang="ts">
import { computed, ref } from "vue";
import AnnualArtworkFallback from "./AnnualArtworkFallback.vue";
import type { VersionSummaryMonthlyFavorite } from "~/types/account-version-summary";

const props = defineProps<{
  item: VersionSummaryMonthlyFavorite;
  index: number;
  compact?: boolean;
  motionDisabled?: boolean;
  density?: number;
  sharedLongestName?: number;
  isTop?: boolean;
}>();

const coverFailed = ref(false);
const leafSrc = computed(() => props.index % 2 === 0 ? "/monthly/leaf_1_11.png" : "/monthly/leaf_2_11.png");

// 歌名严格单行：先按长度选字号档，再据此估算歌名渲染宽度，
// 让叶片在“数据密度宽度”与“容纳歌名所需宽度”之间取较大值（不超过最高月份上限），
// 从而在不牺牲可读性的前提下完整呈现长歌名。
const nameChars = computed(() => [...String(props.item.song?.name || "")]);
const nameLength = computed(() => nameChars.value.length);

// 估算歌名（含《》两个全角括号）在指定字号下的渲染宽度。
const estimateNameWidth = (fontSize: number) => {
  let width = fontSize * 2; // 《》
  for (const ch of nameChars.value) {
    const code = ch.codePointAt(0) ?? 0;
    width += code > 0xff ? fontSize : fontSize * 0.58;
  }
  return width;
};

// 字号档：css 为实际 clamp 字号，max 为该档上限（用于估算叶片保底宽度）。
const fontSpec = computed(() => {
  const length = nameLength.value;
  if (props.compact) {
    if (length > 16) return { max: 8, css: "clamp(7px, 1.8vw, 8px)" };
    if (length > 11) return { max: 9, css: "clamp(8px, 2vw, 9px)" };
    if (length > 7) return { max: 10.5, css: "clamp(9px, 2.3vw, 10.5px)" };
    return { max: 12, css: "clamp(10px, 2.6vw, 12px)" };
  }
  if (length > 20) return { max: 9, css: "clamp(8px, 1.9vw, 9px)" };
  if (length > 13) return { max: 10.5, css: "clamp(9px, 2.2vw, 10.5px)" };
  if (length > 8) return { max: 12, css: "clamp(10.5px, 2.6vw, 12px)" };
  return { max: 14, css: "clamp(12px, 3vw, 14px)" };
});
const leafFontSize = computed(() => fontSpec.value.css);

const leafWidth = computed(() => {
  const density = Math.min(1, Math.max(0, props.density ?? 0.45));
  const minWidth = props.compact ? 88 : 98;
  const maxWidth = props.compact ? 148 : 224;
  const dataWidth = Math.round(minWidth + (maxWidth - minWidth) * density);
  const padding = props.compact ? 34 : 46;
  const sharedLength = Math.max(nameLength.value, props.sharedLongestName || 0);
  const nameMinWidth = Math.round(estimateNameWidth(fontSpec.value.max) + padding + Math.max(0, sharedLength - nameLength.value) * fontSpec.value.max * 0.35);
  return `${Math.min(maxWidth, Math.max(dataWidth, nameMinWidth))}px`;
});

const handleCoverError = () => {
  coverFailed.value = true;
};
</script>

<template>
  <article
    class="monthly-leaf-item"
    :class="{ 'is-compact': compact, 'is-motion-disabled': motionDisabled, 'is-top': isTop }"
    :style="{ '--leaf-delay': `${Math.min(index * 70, 700)}ms`, '--leaf-width': leafWidth, '--leaf-font': leafFontSize }"
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
.monthly-leaf-item{position:relative;display:flex;align-items:center;min-width:0;height:100%;padding-left:clamp(54px,16vw,68px);color:#14602d}.monthly-leaf-item__month{position:absolute;left:clamp(3px,2vw,10px);top:50%;width:40px;height:40px;transform:translateY(-50%);display:grid;place-items:center;z-index:3}.monthly-leaf-item__month img{position:absolute;inset:0;width:40px;height:40px}.monthly-leaf-item__month span{position:relative;z-index:1;font:700 clamp(12px,3.1vw,15px)/1 var(--viewer-font-family);white-space:nowrap;color:#26723b}.monthly-leaf-item__cover{position:relative;z-index:4;flex:0 0 56px;width:56px;height:56px}.monthly-leaf-item__ring{position:absolute;inset:0;width:56px;height:56px;z-index:1}.monthly-leaf-item__cover-inner{position:absolute;left:8px;top:8px;width:40px;height:40px;overflow:hidden;border-radius:50%;z-index:2;background:#d5e9cf}.monthly-leaf-item__cover-image,.monthly-leaf-item__cover-fallback{display:block;width:40px;height:40px;object-fit:cover;border-radius:50%}.monthly-leaf-item__cover-fallback :deep(.annual-artwork-fallback){min-height:40px}.monthly-leaf-item__leaf{position:relative;z-index:2;flex:0 1 var(--leaf-width);width:var(--leaf-width);max-width:calc(100% - 1px);min-width:0;height:min(46px,100%);margin-left:-1px;transform-origin:left center}.monthly-leaf-item__leaf>img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;transform-origin:left center;animation:monthly-leaf-grow 850ms cubic-bezier(.22,.8,.27,1) both;animation-delay:var(--leaf-delay);will-change:transform}.monthly-leaf-item__leaf span{position:absolute;left:clamp(16px,6.5vw,30px);right:clamp(8px,3.5vw,16px);top:50%;transform:translateY(-50%);white-space:nowrap;overflow:hidden;text-overflow:clip;color:#f2f8df;font:700 var(--leaf-font,clamp(11px,2.8vw,14px))/1 var(--viewer-font-family);text-align:center;text-shadow:0 1px 2px rgba(0,35,13,.25)}
.monthly-leaf-item.is-compact{padding-left:clamp(50px,15vw,64px)}.monthly-leaf-item.is-compact .monthly-leaf-item__cover{transform:scale(.9);transform-origin:left center}.monthly-leaf-item.is-compact .monthly-leaf-item__leaf{margin-left:-6px;height:min(40px,100%)}.monthly-leaf-item.is-compact .monthly-leaf-item__leaf span{left:clamp(14px,5vw,26px);right:clamp(7px,3vw,13px)}.monthly-leaf-item.is-top .monthly-leaf-item__leaf>img{filter:drop-shadow(0 0 8px rgba(88,180,60,.5)) saturate(1.2)}.monthly-leaf-item.is-top .monthly-leaf-item__month img{filter:drop-shadow(0 0 5px rgba(119,179,19,.55))}.monthly-leaf-item.is-top .monthly-leaf-item__month span{color:#3f8f1e;font-weight:800}
@keyframes monthly-leaf-grow{from{transform:scaleX(.03);opacity:.45}to{transform:scaleX(1);opacity:1}}
.monthly-leaf-item.is-motion-disabled .monthly-leaf-item__leaf>img{animation:none;transform:scaleX(1);will-change:auto}
@media (prefers-reduced-motion:reduce){.monthly-leaf-item__leaf>img{animation:none;transform:scaleX(1);will-change:auto}}
</style>
