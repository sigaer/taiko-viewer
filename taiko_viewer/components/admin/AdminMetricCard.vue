<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  accent?: "gold" | "teal" | "rose" | "indigo";
}>();

const displayValue = computed(() =>
  typeof props.value === "number" && Number.isFinite(props.value)
    ? props.value.toLocaleString("zh-CN")
    : props.value
);
</script>

<template>
  <div class="admin-metric-card" :class="accent ? `accent-${accent}` : ''">
    <span class="admin-metric-card__label">
      <span>{{ label }}</span>
      <slot name="help" />
    </span>
    <strong class="admin-metric-card__value">{{ displayValue }}</strong>
    <span v-if="hint" class="admin-metric-card__hint">{{ hint }}</span>
    <slot />
  </div>
</template>

<style scoped>
.admin-metric-card {
  --metric-accent: var(--admin-primary, #006c76);
  position: relative;
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
  padding: 16px 18px;
  border-radius: var(--admin-radius, 12px);
  border: 1px solid var(--admin-border, #e3e8e8);
  background: var(--admin-surface, #ffffff);
  color: var(--admin-ink, #1b2426);
}

.admin-metric-card__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-ink-secondary, #5d6b6e);
}

.admin-metric-card__label::before {
  content: "";
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--metric-accent);
}

.admin-metric-card__value {
  font-size: clamp(24px, 2.6vw, 32px);
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.admin-metric-card__hint {
  color: var(--admin-ink-muted, #7a8789);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.accent-gold {
  --metric-accent: var(--admin-amber, #c98a2e);
}

.accent-teal {
  --metric-accent: var(--admin-primary, #006c76);
}

.accent-rose {
  --metric-accent: #b8576b;
}

.accent-indigo {
  --metric-accent: #4f63a8;
}
</style>
