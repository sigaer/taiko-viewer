<script setup lang="ts">
const props = defineProps<{
  items: Array<{
    key: string;
    label: string;
  }>;
  activeIndex: number;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  select: [index: number];
}>();
</script>

<template>
  <nav class="story-progress" :aria-label="props.ariaLabel || 'Story progress'">
    <button
      v-for="(item, index) in props.items"
      :key="item.key"
      type="button"
      class="story-progress__item"
      :class="{ 'is-active': index === props.activeIndex }"
      :aria-current="index === props.activeIndex ? 'step' : undefined"
      @click="emit('select', index)"
    >
      <span class="story-progress__dot"></span>
      <span class="story-progress__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.story-progress {
  position: fixed;
  right: 20px;
  top: 50%;
  z-index: 15;
  display: grid;
  gap: 10px;
  transform: translateY(-50%);
  padding: 12px;
  border-radius: 26px;
  background: rgba(9, 17, 40, 0.36);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(18px);
  box-shadow: 0 18px 48px rgba(4, 10, 28, 0.24);
}

.story-progress__item {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  color: rgba(255, 239, 219, 0.64);
  cursor: pointer;
}

.story-progress__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: rgba(255, 255, 255, 0.08);
  transition:
    transform 0.25s ease,
    background-color 0.25s ease,
    border-color 0.25s ease;
}

.story-progress__label {
  max-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: max-width 0.25s ease;
}

.story-progress__item:hover .story-progress__label,
.story-progress__item.is-active .story-progress__label {
  max-width: 100px;
}

.story-progress__item.is-active {
  color: #fff4df;
}

.story-progress__item.is-active .story-progress__dot {
  transform: scale(1.08);
  background: linear-gradient(135deg, #ff6d46, #ffcb72);
  border-color: transparent;
}

@media (max-width: 960px) {
  .story-progress {
    top: auto;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    grid-auto-flow: column;
    align-items: center;
    padding: 10px 12px;
    border-radius: 999px;
  }

  .story-progress__label {
    display: none;
  }
}

@media (max-width: 720px) and (max-height: 780px) {
  .story-progress { padding: 8px 10px; gap: 7px; }
  .story-progress__dot { width: 10px; height: 10px; }
}
</style>
