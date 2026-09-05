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
const current = ref<number | null>(null);
let tween: gsap.core.Tween | null = null;
let completedForValue: number | null = null;
const numberFormatter = computed(() => new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", {
  minimumFractionDigits: props.decimals,
  maximumFractionDigits: props.decimals
}));
const formatted = computed(() => current.value === null
  ? "--"
  : numberFormatter.value.format(Number(current.value.toFixed(props.decimals))));
const finalValue = computed(() => Number(props.value || 0));
// 最终格式化文本用于 ghost 占位，保证组件布局宽度始终等于最终值宽度。
const finalText = computed(() => numberFormatter.value.format(finalValue.value));

const setControlledValue = () => {
  if (props.progress === null || props.progress === undefined) return false;
  const progress = Math.max(0, Math.min(1, Number(props.progress) || 0));
  current.value = finalValue.value * progress;
  return true;
};

const play = () => {
  tween?.kill();
  tween = null;
  const target = finalValue.value;
  if (!props.active) {
    current.value = null;
    return;
  }
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
  // count-up 开始前隐藏数值（显示 "--"），避免 delay 期间短暂显示 0.0000；
  // 滚动从目标值的 30% 起步，避免动画起点闪现 0。
  current.value = null;
  const state = { value: target * 0.3 };
  tween = gsap.to(state, {
    value: finalValue.value,
    delay: props.delay / 1000,
    duration: props.duration / 1000,
    ease: "power2.out",
    onStart: () => { current.value = state.value; },
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
  <span class="animated-number" :aria-label="finalText">
    <span class="animated-number__ghost" aria-hidden="true">{{ finalText }}</span>
    <span class="animated-number__value">{{ formatted }}</span>
  </span>
</template>

<style scoped>
.animated-number {
  display: inline-grid;
  grid-template-areas: "number";
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: 1;
}
.animated-number__ghost,
.animated-number__value {
  grid-area: number;
  min-width: 0;
}
.animated-number__ghost {
  visibility: hidden;
  pointer-events: none;
}
</style>
