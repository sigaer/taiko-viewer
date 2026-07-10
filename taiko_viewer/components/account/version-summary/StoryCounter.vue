<script setup lang="ts">
import { gsap } from "gsap";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    value: number;
    active?: boolean;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    reducedMotion?: boolean;
  }>(),
  {
    active: false,
    decimals: 0,
    prefix: "",
    suffix: "",
    reducedMotion: false
  }
);

const displayValue = ref(0);
let tween: gsap.core.Tween | null = null;

const numberFormatter = computed(
  () =>
    new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: props.decimals,
      maximumFractionDigits: props.decimals
    })
);

const formattedText = computed(
  () => `${props.prefix}${numberFormatter.value.format(displayValue.value)}${props.suffix}`
);

const syncValue = (instant: boolean) => {
  tween?.kill();
  if (instant || props.reducedMotion) {
    displayValue.value = props.value;
    return;
  }

  const state = { count: displayValue.value };
  tween = gsap.to(state, {
    count: props.value,
    duration: 1.1,
    ease: "power2.out",
    onUpdate: () => {
      displayValue.value = Number(state.count.toFixed(props.decimals));
    }
  });
};

watch(
  () => props.active,
  (active) => {
    if (active) {
      syncValue(false);
    }
  },
  { immediate: true }
);

watch(
  () => props.value,
  () => {
    syncValue(!props.active);
  }
);

onMounted(() => {
  syncValue(!props.active);
});

onBeforeUnmount(() => {
  tween?.kill();
});
</script>

<template>
  <span>{{ formattedText }}</span>
</template>
