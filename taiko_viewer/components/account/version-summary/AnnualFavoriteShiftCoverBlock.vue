<script setup lang="ts">
defineSlots<{ default(): unknown }>();
</script>

<template>
  <div class="favorite-shift-cover-block">
    <img
      class="favorite-shift-cover-block__base"
      src="/favoriteShift/cover_bg_7.png"
      alt=""
      aria-hidden="true"
    >
    <div class="favorite-shift-cover-block__artwork">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.favorite-shift-cover-block {
  position: relative;
  width: var(--favorite-shift-cover-size, 211px);
  height: var(--favorite-shift-cover-size, 211px);
}

.favorite-shift-cover-block__base {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.favorite-shift-cover-block__artwork {
  position: absolute;
  z-index: 2;
  left: 27.962%;
  top: 13.744%;
  width: 61.137%;
  height: 61.137%;
  overflow: hidden;
  border-radius: 7.75%;
  background: #cadf8d;
}

.favorite-shift-cover-block__artwork :deep(.el-image),
.favorite-shift-cover-block__artwork :deep(.annual-artwork-fallback) {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 100%;
}

.favorite-shift-cover-block__artwork :deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
