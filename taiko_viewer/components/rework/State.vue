<script setup lang="ts">
// ReworkState — the one way a reworked page shows loading, empty and failed (playbook §4).
//   loading  a skeleton that keeps the layout (`lines` bars, or the `skeleton` slot), role=status + aria-busy
//   empty    a title, optional text and actions (default slot)
//   failed   role=alert, the title (default: "加载失败") and a retry button that emits `retry`; extra actions go in
//            the default slot
// Signing in and binding are not states of this component: use ReworkGate.
import type { PropType } from "vue";

const props = defineProps({
  kind: { type: String as PropType<"loading" | "empty" | "failed">, required: true },
  title: { type: String, default: "" },
  text: { type: String, default: "" },
  /** loading: number of skeleton bars when no `skeleton` slot is given */
  lines: { type: Number, default: 3 },
  /** less padding, for a state inside a panel */
  compact: { type: Boolean, default: false },
  /** failed: label of the retry button (defaults to rework.state.retry) */
  retryLabel: { type: String, default: "" }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
const heading = computed(() => props.title || (props.kind === "failed" ? t("rework.state.failed") : ""));
</script>

<template>
  <div
    v-if="kind === 'loading'"
    class="rw-state rw-state--loading"
    :class="{ 'is-compact': compact }"
    role="status"
    aria-busy="true"
  >
    <span class="rw-vh">{{ title || t("rework.state.loading") }}</span>
    <slot name="skeleton">
      <span v-for="n in lines" :key="n" class="rw-state__bar" :class="{ 'is-short': n === lines && lines > 1 }" aria-hidden="true" />
    </slot>
  </div>
  <div
    v-else
    class="rw-state"
    :class="[`rw-state--${kind}`, { 'is-compact': compact }]"
    :role="kind === 'failed' ? 'alert' : undefined"
  >
    <p v-if="heading" class="rw-state__title">{{ heading }}</p>
    <p v-if="text" class="rw-state__text">{{ text }}</p>
    <div v-if="kind === 'failed' || $slots.default" class="rw-state__actions">
      <button v-if="kind === 'failed'" type="button" class="rw-btn" @click="emit('retry')">{{ retryLabel || t("rework.state.retry") }}</button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.rw-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-8) var(--sp-4);
  color: var(--ink-2);
  font-family: var(--font-ui);
}
.rw-state.is-compact {
  padding: var(--sp-3) 0;
  gap: var(--sp-2);
}
.rw-state__title {
  margin: 0;
  font-size: var(--fs-16);
  line-height: var(--lh-snug);
  color: var(--ink);
  overflow-wrap: anywhere;
}
.is-compact .rw-state__title {
  font-size: var(--fs-14);
}
.rw-state__text {
  margin: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.rw-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.rw-state--loading {
  gap: var(--sp-3);
  align-items: stretch;
}
.rw-state__bar {
  display: block;
  height: 14px;
  border-radius: var(--r-xs);
  background: var(--bg-sunk);
}
.rw-state__bar.is-short {
  width: 60%;
}
</style>
