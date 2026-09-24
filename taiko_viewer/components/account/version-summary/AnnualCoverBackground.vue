<script setup lang="ts">
import { gsap } from 'gsap';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { VersionSummaryViewModel } from '~/types/account-version-summary';
import { selectAnnualCoverSongs } from '~/utils/annualCoverFlow';
import type { AnnualCoverState } from '~/utils/annualCoverMotion';
import type { AnnualCoverRenderer } from '~/utils/annualCoverRenderer.client';

const props = defineProps<{ summary: VersionSummaryViewModel; state: AnnualCoverState; active: boolean; reducedMotion: boolean }>();
const root = ref<HTMLElement | null>(null), canvas = ref<HTMLCanvasElement | null>(null);
const canvasKey = ref(0);
const ready = ref(false), unavailable = ref(false);
const covers = computed(() => selectAnnualCoverSongs(props.summary, 12, 'period-overview'));
let renderer: AnnualCoverRenderer | null = null, observer: ResizeObserver | null = null;
let generation = 0, ticking = false, mounted = false, clockPrimed = false;
const tick = (_time: number, delta: number) => {
  if (clockPrimed) props.state.elapsed = (props.state.elapsed + Math.min(delta, 50)) % 36000;
  clockPrimed = true;
  renderer?.render();
};
const stop = () => { gsap.ticker.remove(tick); ticking = false; };
const fail = () => { unavailable.value = true; ready.value = false; stop(); renderer?.dispose(); renderer = null; };
const sync = () => {
  const run = ready.value && props.active && !props.reducedMotion;
  if (run && !ticking) { clockPrimed = false; renderer?.render(); gsap.ticker.add(tick); ticking = true; }
  else if (!run) stop();
};
const prepare = async () => {
  const token = ++generation;
  stop(); renderer?.dispose(); renderer = null; ready.value = false;
  canvasKey.value++;
  await nextTick();
  if (token !== generation || !mounted || props.reducedMotion || unavailable.value || !covers.value.length) return;
  try {
    const { createAnnualCoverRenderer } = await import('~/utils/annualCoverRenderer.client');
    if (token !== generation || !mounted || !canvas.value) return;
    const instance = createAnnualCoverRenderer(canvas.value, covers.value, props.state, fail);
    renderer = instance;
    await instance.prepare;
    if (token !== generation || !mounted || unavailable.value) { instance.dispose(); return; }
    instance.resize(root.value!.clientWidth, root.value!.clientHeight);
    ready.value = true; sync();
  } catch (error) {
    if (import.meta.dev) console.warn("[annual-cover] WebGL unavailable", error instanceof Error ? error.message : String(error));
    if (token === generation) fail();
  }
};
watch(() => [props.active, props.reducedMotion], sync);
watch(() => [props.summary.summaryId, props.reducedMotion], ([id], [previousId]) => {
  if (id !== previousId) unavailable.value = false;
  void prepare();
});
onMounted(() => {
  mounted = true;
  observer = new ResizeObserver(() => { if (ready.value) renderer?.resize(root.value!.clientWidth, root.value!.clientHeight); });
  observer.observe(root.value!); void prepare();
});
onBeforeUnmount(() => { mounted = false; generation++; stop(); observer?.disconnect(); renderer?.dispose(); renderer = null; });
</script>
<template>
  <div ref="root" class="annual-cover-background" :data-renderer="ready ? 'webgl' : 'static'" :data-running="ready && active && !reducedMotion" aria-hidden="true">
    <div v-show="!ready" class="annual-cover-background__still">
      <img v-for="(song,index) in covers.slice(0, 4)" :key="song.flowKey" :src="song.coverUrl || undefined" alt="" :class="`slot-${index}`" />
    </div>
    <canvas :key="canvasKey" ref="canvas" v-show="ready" />
  </div>
</template>
<style scoped>
.annual-cover-background,.annual-cover-background__still{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.annual-cover-background canvas{display:block;width:100%;height:100%;mask-image:linear-gradient(#000 0%,#000 18%,transparent 34%,transparent 66%,#000 82%,#000 100%)}
.annual-cover-background__still{perspective:900px}
.annual-cover-background__still img{position:absolute;left:50%;width:min(84%,352px);aspect-ratio:1;object-fit:cover;opacity:.65;transform:translateX(-50%) rotateX(64deg)}
.slot-0,.slot-1{transform:translateX(-50%) rotateX(-64deg)!important}
.slot-0{top:-10%}.slot-1{top:6%}.slot-2{bottom:6%}.slot-3{bottom:-10%}
@media(orientation:landscape) and (max-height:460px){.annual-cover-background canvas{mask-image:linear-gradient(90deg,#000,transparent 36%,transparent 64%,#000)}}
</style>
