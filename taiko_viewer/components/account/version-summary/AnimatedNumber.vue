<script setup lang="ts">
import { gsap } from "gsap";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  value: number;
  active?: boolean;
  reducedMotion?: boolean;
  progress?: number | null;
  duration?: number;
  delay?: number;
  decimals?: number;
}>(), { active: false, reducedMotion: false, progress: null, duration: 900, delay: 0, decimals: 0 });

const emit = defineEmits<{ complete: [value: number] }>();

const { locale } = useI18n();
const current = ref(0);
let tween: gsap.core.Tween | null = null;
let completedForValue: number | null = null;
const numberFormatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", {
  minimumFractionDigits: props.decimals,
  maximumFractionDigits: props.decimals
}));
const formatted = computed(() => numberFormatter.value.format(Number(current.value.toFixed(props.decimals))));
const finalValue = computed(() => Number(props.value || 0));

const setControlledValue = () => {
  if (props.progress === null || props.progress === undefined) return false;
  const progress = Math.max(0, Math.min(1, Number(props.progress) || 0));
  current.value = finalValue.value * progress;
  return true;
};

const play = () => {
  tween?.kill();
  if (!props.active) return;
  const target = finalValue.value;
  if (completedForValue !== target) completedForValue = null;
  if (props.reducedMotion) {
    current.value = target;
    if (completedForValue === null) {
      completedForValue = target;
      emit("complete", target);
    }
    return;
  }
  if (setControlledValue()) {
    if (Number(props.progress) >= 1 && completedForValue === null) {
      completedForValue = target;
      emit("complete", target);
    }
    return;
  }
  const state = { value: 0 };
  current.value = 0;
  tween = gsap.to(state, {
    value: finalValue.value,
    delay: props.delay / 1000,
    duration: props.duration / 1000,
    ease: "power2.out",
    onUpdate: () => { current.value = state.value; },
    onComplete: () => {
      current.value = target;
      if (completedForValue === null) {
        completedForValue = target;
        emit("complete", target);
      }
    }
  });
};

watch([() => props.value, () => props.active, () => props.reducedMotion, () => props.progress], play, { immediate: true });
watch(() => props.active, (active) => {
  if (!active) tween?.pause();
  else if (tween && !props.reducedMotion) tween.resume();
});
watch(() => locale.value, () => undefined);
onBeforeUnmount(() => tween?.kill());
</script>

<template>
  <span class="animated-number" :aria-label="numberFormatter.format(finalValue)">{{ formatted }}</span>
</template>

<style scoped>
.animated-number { display: inline-block; font-variant-numeric: tabular-nums; }
</style>
