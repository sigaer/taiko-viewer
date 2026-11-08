<script setup lang="ts">
import type { AccountTitle } from "~/types/account-title";

defineProps<{ titles?: AccountTitle[] }>();
</script>

<template>
  <span v-if="titles?.length" class="account-titles">
    <span v-for="title in titles" :key="title.key" class="account-title" :data-title-key="title.key">
      {{ title.name }}
    </span>
  </span>
</template>

<style scoped>
.account-titles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.account-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  padding: 3px 9px;
  border: 1px solid var(--viewer-border);
  border-radius: 6px;
  color: var(--viewer-text);
  background: var(--viewer-surface-subtle);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

.account-title::before {
  content: "";
  flex: 0 0 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, #d66b8d, #c69b42, #549d86, #6888ce, #aa78bb);
}
</style>
