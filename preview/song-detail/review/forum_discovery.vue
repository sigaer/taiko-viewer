<script setup lang="ts">
import { discoveryThreads } from '../server/utils/forum-discovery-fixtures';
</script>

<template>
  <div class="discovery-preview">
    <ForumThreadCard v-for="thread in discoveryThreads.slice(0, 3)" :key="thread.id" :thread="thread" />
  </div>
</template>

<style scoped>
.discovery-preview { display: grid; gap: 16px; min-width: 0; }
</style>
