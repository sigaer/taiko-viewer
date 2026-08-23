<script setup lang="ts">
defineProps<{
  isJapanese: boolean;
  hasSong: boolean;
  fallback: string;
}>();
</script>

<template>
  <p class="favorite-song-memory-copy">
    <template v-if="!hasSong">{{ fallback }}</template>
    <template v-else-if="isJapanese">
      この曲も、きっと<br />あなたの鼓点を覚えています。
    </template>
    <template v-else>
      它大概已经<br />很熟悉你的 <em>鼓点</em> 了。
    </template>
  </p>
</template>

<style scoped>
.favorite-song-memory-copy {
  margin: 0;
  color: #f8f2e8;
  font: 500 clamp(1.25rem, 5.6vw, 1.65rem)/1.5 var(--viewer-font-family);
  letter-spacing: 0.025em;
  text-align: center;
  text-shadow: 0 4px 24px rgba(0, 5, 19, 0.92);
  text-wrap: balance;
}

.favorite-song-memory-copy em {
  color: #62d9d0;
  font-style: normal;
  text-shadow: 0 0 14px rgba(64, 211, 202, 0.42);
}

@media (max-height: 700px) and (orientation: portrait) {
  .favorite-song-memory-copy { font-size: clamp(1rem, 4.7vw, 1.25rem); line-height: 1.4; }
}

@media (orientation: landscape) and (max-height: 460px) {
  .favorite-song-memory-copy { text-align: left; font-size: clamp(1rem, 2.5vw, 1.25rem); }
}
</style>
