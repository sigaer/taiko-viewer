<script setup>
import { store } from '../store'
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="pop" tag="div" class="toasts" role="status" aria-live="polite">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">
        <i class="note" :class="t.kind === 'ok' ? '' : 'ka'" />
        <span>{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toasts {
  position: fixed;
  z-index: var(--z-toast);
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 32px);
}
.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px 10px 12px;
  border-radius: var(--r-note);
  background: var(--lane);
  color: var(--lane-ink);
  font-size: var(--fs-14);
  font-weight: 500;
  box-shadow: var(--shadow-pop);
}
@media (max-width: 767px) {
  .toasts {
    bottom: calc(var(--tab-h) + 20px + env(safe-area-inset-bottom));
  }
}
</style>
