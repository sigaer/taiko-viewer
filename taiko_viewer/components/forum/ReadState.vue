<script setup lang="ts">
defineProps<{ pending: boolean; error?: string }>();
defineEmits<{ retry: [] }>();
const { t, locale } = useI18n();
</script>
<template>
  <div v-if="pending" class="forum-read-state" role="status" aria-live="polite">{{ t('layout.loading') }}</div>
  <div v-else-if="error" class="forum-read-state" role="alert">
    <span>{{ error }}</span>
    <el-button @click="$emit('retry')">{{ locale === 'ja' ? '再試行' : '重试' }}</el-button>
  </div>
</template>
<style scoped>
.forum-read-state { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:16px 0; color:var(--viewer-text-muted); }
.forum-read-state button { min-height:44px; }
</style>
