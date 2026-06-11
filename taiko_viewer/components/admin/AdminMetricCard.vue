<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
  accent?: "gold" | "teal" | "rose" | "indigo";
}>();
</script>

<template>
  <div class="admin-metric-card" :class="accent ? `accent-${accent}` : ''">
    <span class="admin-metric-card__label">{{ label }}</span>
    <strong class="admin-metric-card__value">{{ value }}</strong>
    <span v-if="hint" class="admin-metric-card__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.admin-metric-card {
  display: grid;
  gap: 8px;
  min-height: 128px;
  padding: 20px;
  border-radius: 22px;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 38%),
    linear-gradient(145deg, rgba(13, 18, 30, 0.96), rgba(29, 39, 58, 0.92));
  color: #f8f7f1;
  box-shadow: 0 18px 36px rgba(18, 23, 38, 0.18);
}

.admin-metric-card__label {
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(248, 247, 241, 0.76);
}

.admin-metric-card__value {
  font-size: clamp(30px, 4vw, 42px);
  line-height: 1;
}

.admin-metric-card__hint {
  color: rgba(248, 247, 241, 0.72);
  font-size: 13px;
}

.accent-gold {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 38%),
    linear-gradient(145deg, rgba(58, 39, 12, 0.96), rgba(120, 82, 21, 0.92));
}

.accent-teal {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.2), transparent 38%),
    linear-gradient(145deg, rgba(7, 52, 62, 0.96), rgba(22, 114, 131, 0.92));
}

.accent-rose {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 38%),
    linear-gradient(145deg, rgba(77, 21, 36, 0.96), rgba(147, 52, 77, 0.92));
}

.accent-indigo {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 38%),
    linear-gradient(145deg, rgba(21, 33, 75, 0.96), rgba(68, 86, 171, 0.92));
}
</style>
