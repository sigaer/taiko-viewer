<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  active?: boolean;
  reducedMotion?: boolean;
  trigger?: number;
  mode?: "ambient" | "burst";
  originX?: string;
  originY?: string;
}>(), { active: false, reducedMotion: false, trigger: 0, mode: "ambient", originX: "50%", originY: "50%" });

const emit = defineEmits<{ complete: [] }>();
const running = ref(false);
let timer: number | null = null;
const play = () => {
  if (!props.active) return;
  running.value = false;
  window.requestAnimationFrame(() => { running.value = true; });
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    running.value = false;
    emit("complete");
  }, props.reducedMotion ? 140 : 760);
};
watch(() => props.trigger, play);
watch(() => props.active, (active) => { if (!active) running.value = false; });
onBeforeUnmount(() => { if (timer) window.clearTimeout(timer); });
</script>

<template>
  <div
    class="taiko-ripple"
    :class="[`mode-${mode}`, { 'is-running': running }]"
    :style="{ '--ripple-x': originX, '--ripple-y': originY }"
    aria-hidden="true"
  >
    <i></i><i></i><i></i>
  </div>
</template>

<style scoped>
.taiko-ripple { position: absolute; inset: 0; z-index: 8; overflow: hidden; pointer-events: none; }
.taiko-ripple i { position: absolute; left: var(--ripple-x); top: var(--ripple-y); width: 8px; aspect-ratio: 1; border: 2px solid rgba(255,255,255,.84); border-radius: 50%; transform: translate(-50%,-50%) scale(0); opacity: 0; }
.taiko-ripple.is-running i { animation: taiko-ripple-expand .76s cubic-bezier(.18,.75,.24,1) both; }
.taiko-ripple.is-running i:nth-child(2) { animation-delay: .09s; }
.taiko-ripple.is-running i:nth-child(3) { animation-delay: .18s; }
.taiko-ripple.mode-burst i { width: 12px; border-color: rgba(255,226,147,.9); }
@keyframes taiko-ripple-expand { 0% { transform: translate(-50%,-50%) scale(0); opacity: .9; } 70% { opacity: .42; } 100% { transform: translate(-50%,-50%) scale(90); opacity: 0; } }
@media(prefers-reduced-motion:reduce){.taiko-ripple.is-running i{animation-duration:.12s}}
</style>
