<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { AnnualReaction } from '~/types/annual-reaction';

const props = defineProps<{ items: AnnualReaction[]; active: boolean }>();
const viewport = ref<HTMLElement | null>(null);
type Bubble = { key: number; reaction: AnnualReaction; lane: number; x: number; width: number };
const bubbles = ref<Bubble[]>([]);
const elements = new Map<number, HTMLElement>();
let nextKey = 0;
let cursor = 0;
let frame = 0;
let lastTime = 0;
let width = 363;
let height = 84;
let lanes = 4;
let observer: ResizeObserver | undefined;
let motion: MediaQueryList | undefined;
let mounted = false;
const gap = 72;
const setElement = (key: number, element: any) => {
  if (element instanceof HTMLElement) elements.set(key, element);
  else elements.delete(key);
};
const spawn = (lane: number, x: number, reaction?: AnnualReaction) => {
  const item = reaction || props.items[cursor++ % props.items.length];
  if (!item) return;
  bubbles.value.push({ key: ++nextKey, reaction: item, lane, x, width: 0 });
};
const tick = (time: number) => {
  const delta = lastTime ? Math.min(0.1, (time - lastTime) / 1000) : 0;
  lastTime = time;
  const speed = motion?.matches ? 22 : 52;
  for (const bubble of bubbles.value) {
    const element = elements.get(bubble.key);
    if (!element) continue;
    if (!bubble.width) bubble.width = element.offsetWidth;
    bubble.x -= delta * speed;
    element.style.transform = `translate3d(${bubble.x}px,0,0)`;
  }
  bubbles.value = bubbles.value.filter((bubble) => !bubble.width || bubble.x + bubble.width > 0);
  if (props.items.length) {
    for (let lane = 0; lane < lanes; lane++) {
      const occupants = bubbles.value.filter((bubble) => bubble.lane === lane);
      const tail = Math.max(...occupants.map((bubble) => bubble.x + bubble.width));
      if (!occupants.length || (occupants.every((bubble) => bubble.width) && tail + gap <= width)) {
        spawn(lane, width);
      }
    }
  }
  frame = requestAnimationFrame(tick);
};
const stop = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; };
const resume = () => {
  stop();
  if (mounted && props.active && !document.hidden) frame = requestAnimationFrame(tick);
};
watch(() => props.active, resume);
watch(() => props.items, (items, previous = []) => {
  const ids = new Set(items.map((item) => item.id));
  bubbles.value = bubbles.value.filter((bubble) => ids.has(bubble.reaction.id));
  if (!items.length) return;
  if (!bubbles.value.length) {
    // Stagger initial copies across the viewport so a one-item feed is visible
    // immediately, without adding any duplicate records to the server.
    for (let lane = 0; lane < lanes; lane++) spawn(lane, width * lane / lanes);
  } else {
    const oldIds = new Set(previous.map((item) => item.id));
    for (const item of items.filter((item) => !oldIds.has(item.id))) {
      const tails = Array.from({ length: lanes }, (_, lane) =>
        Math.max(0, ...bubbles.value.filter((bubble) => bubble.lane === lane).map((bubble) => bubble.x + (bubble.width || width))));
      const lane = tails.indexOf(Math.min(...tails));
      // Replace queued visual copies in this lane to show the new reaction now.
      // Existing content continues in the other lanes.
      bubbles.value = bubbles.value.filter((bubble) => bubble.lane !== lane);
      spawn(lane, 0, item);
    }
  }
}, { immediate: true });
onMounted(() => {
  mounted = true;
  motion = matchMedia('(prefers-reduced-motion: reduce)');
  observer = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    lanes = height >= 84 ? 4 : 3;
    bubbles.value = bubbles.value.filter((bubble) => bubble.lane < lanes);
  });
  if (viewport.value) observer.observe(viewport.value);
  document.addEventListener('visibilitychange', resume);
  resume();
});
onBeforeUnmount(() => { mounted = false; stop(); observer?.disconnect(); document.removeEventListener('visibilitychange', resume); });
</script>

<template>
  <div ref="viewport" class="annual-danmaku">
    <span v-for="bubble in bubbles" :key="bubble.key" :ref="(element) => setElement(bubble.key, element)"
      class="annual-danmaku__bubble" :data-reaction-id="bubble.reaction.id"
      :style="{ top: `${bubble.lane * height / lanes}px`, transform: `translate3d(${bubble.x}px,0,0)` }">
      <img :src="bubble.reaction.author.avatarUrl" :alt="bubble.reaction.author.username" @error="($event.target as HTMLImageElement).src = '/miku.png'">
      <span>{{ bubble.reaction.content }}</span>
    </span>
  </div>
</template>

<style scoped>
.annual-danmaku{position:absolute;inset:0;overflow:hidden;contain:layout paint}
.annual-danmaku__bubble{position:absolute;left:0;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;height:20px;box-sizing:border-box;color:#102d40;font-size:12px;line-height:18px;will-change:transform}
.annual-danmaku__bubble img{height:20px;width:20px;flex:none;border:1px solid #142b4380;border-radius:50%;box-sizing:border-box;object-fit:cover;background:#fff8}
.annual-danmaku__bubble>span{border:1px solid #142b4394;border-radius:999px;padding:0 8px;background:#ffffffb8}
</style>
