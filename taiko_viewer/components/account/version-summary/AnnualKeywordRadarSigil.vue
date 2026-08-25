<script setup lang="ts">
import { computed } from "vue";

export type AnnualKeywordRadarEntry = {
  key: string;
  label: string;
  value: number;
};

const props = defineProps<{
  entries: AnnualKeywordRadarEntry[];
  maxValue: number;
  highlightKey: string;
  active: boolean;
  reducedMotion: boolean;
  saveData: boolean;
}>();

const center = 180;
const outerRadius = 112;
const angleFor = (index: number, total: number) => -Math.PI / 2 + index * Math.PI * 2 / total;
const pointAt = (radius: number, index: number, total: number) => {
  const angle = angleFor(index, total);
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
};
const pointsText = (radius: number, total: number) => Array.from({ length: total }, (_, index) => {
  const point = pointAt(radius, index, total);
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}).join(" ");

const axes = computed(() => props.entries.map((entry, index) => ({
  ...entry,
  ...pointAt(outerRadius, index, props.entries.length)
})));
const polygonPoints = computed(() => props.entries.map((entry, index) => {
  const maximum = Number.isFinite(props.maxValue) && props.maxValue > 0 ? props.maxValue : 10;
  const normalized = Math.max(0, Math.min(Number(entry.value) / maximum, 1));
  const point = pointAt(outerRadius * normalized, index, props.entries.length);
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}).join(" "));
const nodes = computed(() => props.entries.map((entry, index) => {
  const maximum = Number.isFinite(props.maxValue) && props.maxValue > 0 ? props.maxValue : 10;
  const normalized = Math.max(0, Math.min(Number(entry.value) / maximum, 1));
  return {
    ...entry,
    ...pointAt(outerRadius * normalized, index, props.entries.length),
    highlighted: entry.key === props.highlightKey
  };
}));
const accessibleSummary = computed(() => props.entries.map((entry) => `${entry.label} ${entry.value}`).join("，"));
</script>

<template>
  <div
    class="keyword-radar-sigil"
    :class="{ 'is-active': active, 'is-static': reducedMotion || saveData }"
    role="img"
    :aria-label="`六维鼓面印记：${accessibleSummary}`"
  >
    <svg viewBox="0 0 360 360" aria-hidden="true">
      <defs>
        <radialGradient id="keyword-drum-surface" cx="50%" cy="44%" r="60%">
          <stop offset="0" stop-color="#143e62" stop-opacity=".84" />
          <stop offset=".68" stop-color="#071d36" stop-opacity=".72" />
          <stop offset="1" stop-color="#020c1c" stop-opacity=".08" />
        </radialGradient>
        <linearGradient id="keyword-sigil-fill" x1=".1" y1="0" x2=".9" y2="1">
          <stop offset="0" stop-color="#91fff0" stop-opacity=".62" />
          <stop offset=".55" stop-color="#29c6d5" stop-opacity=".3" />
          <stop offset="1" stop-color="#468fff" stop-opacity=".42" />
        </linearGradient>
        <linearGradient id="keyword-sigil-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#d1fff8" />
          <stop offset=".52" stop-color="#4ce6df" />
          <stop offset="1" stop-color="#83aaff" />
        </linearGradient>
      </defs>

      <circle class="keyword-radar-sigil__drum" cx="180" cy="180" r="145" />
      <circle class="keyword-radar-sigil__rim keyword-radar-sigil__rim--outer" cx="180" cy="180" r="144" />
      <circle class="keyword-radar-sigil__rim keyword-radar-sigil__rim--inner" cx="180" cy="180" r="132" />
      <path class="keyword-radar-sigil__strike" d="M57 113 A142 142 0 0 1 275 73" />
      <path class="keyword-radar-sigil__strike keyword-radar-sigil__strike--lower" d="M76 278 A142 142 0 0 0 297 254" />

      <g class="keyword-radar-sigil__grid">
        <polygon v-for="ratio in [.34, .67, 1]" :key="ratio" :points="pointsText(outerRadius * ratio, entries.length)" />
        <line v-for="axis in axes" :key="axis.key" x1="180" y1="180" :x2="axis.x" :y2="axis.y" />
      </g>

      <g class="keyword-radar-sigil__highlight">
        <line
          v-for="axis in axes.filter((entry) => entry.key === highlightKey)"
          :key="axis.key"
          x1="180" y1="180" :x2="axis.x" :y2="axis.y"
        />
      </g>

      <polygon class="keyword-radar-sigil__shape keyword-radar-sigil__shape--aura" :points="polygonPoints" />
      <polygon class="keyword-radar-sigil__shape keyword-radar-sigil__shape--core" :points="polygonPoints" />

      <g class="keyword-radar-sigil__nodes">
        <g
          v-for="(node, index) in nodes"
          :key="node.key"
          class="keyword-radar-sigil__node"
          :class="{ 'is-highlighted': node.highlighted }"
          :style="{ '--node-index': index }"
        >
          <circle class="keyword-radar-sigil__node-halo" :cx="node.x" :cy="node.y" :r="node.highlighted ? 12 : 7" />
          <circle class="keyword-radar-sigil__node-core" :cx="node.x" :cy="node.y" :r="node.highlighted ? 5 : 3.5" />
        </g>
      </g>

      <circle class="keyword-radar-sigil__heart" cx="180" cy="180" r="5" />
      <circle class="keyword-radar-sigil__heart-ring" cx="180" cy="180" r="13" />
    </svg>
  </div>
</template>

<style scoped>
.keyword-radar-sigil{width:100%;height:100%;display:grid;place-items:center;contain:layout paint}.keyword-radar-sigil svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 18px 24px rgba(0,5,18,.38))}.keyword-radar-sigil__drum{fill:url(#keyword-drum-surface)}.keyword-radar-sigil__rim{fill:none;stroke:#72e6e0;vector-effect:non-scaling-stroke}.keyword-radar-sigil__rim--outer{stroke-width:1.1;stroke-dasharray:2 8;opacity:.52}.keyword-radar-sigil__rim--inner{stroke-width:.7;stroke-dasharray:46 18 3 14;opacity:.32}.keyword-radar-sigil__strike{fill:none;stroke:#f5d995;stroke-width:1.4;stroke-linecap:round;stroke-dasharray:2 9;opacity:.58}.keyword-radar-sigil__strike--lower{opacity:.25}.keyword-radar-sigil__grid polygon,.keyword-radar-sigil__grid line{fill:none;stroke:#61d8dd;stroke-width:.8;vector-effect:non-scaling-stroke}.keyword-radar-sigil__grid polygon{opacity:.25}.keyword-radar-sigil__grid polygon:last-of-type{stroke:#b8fff5;stroke-width:1.1;opacity:.5}.keyword-radar-sigil__grid line{opacity:.25}.keyword-radar-sigil__highlight line{stroke:#ffd77f;stroke-width:3;stroke-linecap:round;opacity:.86}.keyword-radar-sigil__shape{transform-box:fill-box;transform-origin:center}.keyword-radar-sigil__shape--aura{fill:none;stroke:#45fff0;stroke-width:8;stroke-linejoin:round;opacity:.13}.keyword-radar-sigil__shape--core{fill:url(#keyword-sigil-fill);stroke:url(#keyword-sigil-stroke);stroke-width:2.2;stroke-linejoin:round;opacity:.96}.keyword-radar-sigil__node{transform-box:fill-box;transform-origin:center}.keyword-radar-sigil__node-halo{fill:#57eee3;opacity:.16}.keyword-radar-sigil__node-core{fill:#bffff7;stroke:#0d5369;stroke-width:1.4}.keyword-radar-sigil__node.is-highlighted .keyword-radar-sigil__node-halo{fill:#ffdc86;opacity:.36}.keyword-radar-sigil__node.is-highlighted .keyword-radar-sigil__node-core{fill:#ffe4a1;stroke:#fff8d9;stroke-width:1.8}.keyword-radar-sigil__heart{fill:#fff5c6}.keyword-radar-sigil__heart-ring{fill:none;stroke:#a3fff3;stroke-width:1;opacity:.58}
.keyword-radar-sigil.is-active:not(.is-static) .keyword-radar-sigil__rim--outer{animation:keyword-rim-turn 18s linear infinite}.keyword-radar-sigil.is-active:not(.is-static) .keyword-radar-sigil__rim--inner{animation:keyword-rim-turn 24s linear infinite reverse}.keyword-radar-sigil.is-active:not(.is-static) .keyword-radar-sigil__grid{animation:keyword-grid-in .72s .28s cubic-bezier(.2,.74,.22,1) both}.keyword-radar-sigil.is-active:not(.is-static) .keyword-radar-sigil__shape{animation:keyword-shape-in .78s .44s cubic-bezier(.18,.82,.22,1) both}.keyword-radar-sigil.is-active:not(.is-static) .keyword-radar-sigil__node{animation:keyword-node-in .38s cubic-bezier(.18,.88,.3,1.3) both;animation-delay:calc(.68s + var(--node-index) * 70ms)}.keyword-radar-sigil.is-active:not(.is-static) .keyword-radar-sigil__highlight{animation:keyword-highlight-in .72s .82s ease-out both}.keyword-radar-sigil.is-active:not(.is-static) .keyword-radar-sigil__heart-ring{animation:keyword-heart-pulse 3.2s 1.4s ease-in-out infinite}
@keyframes keyword-rim-turn{to{transform:rotate(360deg);transform-origin:center}}@keyframes keyword-grid-in{from{opacity:0;transform:scale(.68);transform-origin:center}to{opacity:1;transform:scale(1);transform-origin:center}}@keyframes keyword-shape-in{from{opacity:0;transform:scale(.04)}to{opacity:1;transform:scale(1)}}@keyframes keyword-node-in{from{opacity:0;transform:scale(.15)}to{opacity:1;transform:scale(1)}}@keyframes keyword-highlight-in{from{opacity:0}to{opacity:1}}@keyframes keyword-heart-pulse{0%,100%{opacity:.38;transform:scale(.82);transform-origin:center}50%{opacity:.85;transform:scale(1.32);transform-origin:center}}
@media(prefers-reduced-motion:reduce){.keyword-radar-sigil *{animation:none!important}}
</style>
