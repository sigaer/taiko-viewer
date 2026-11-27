<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import CommandPalette from './components/CommandPalette.vue'
import ProtoPanel from './components/ProtoPanel.vue'
import Toasts from './components/Toasts.vue'
import { embedded } from './store'

const route = useRoute()
const bare = computed(() => route.meta.bare)
const isReview = computed(() => route.path.startsWith('/review'))
</script>

<template>
  <RouterView v-if="bare" />
  <AppShell v-else>
    <!-- 路由切换不做转场：动效只回应操作与状态变化（见 Design System · 动效） -->
    <RouterView :key="route.path" />
  </AppShell>
  <CommandPalette />
  <Toasts />
  <ProtoPanel v-if="!embedded && !isReview" />
</template>
