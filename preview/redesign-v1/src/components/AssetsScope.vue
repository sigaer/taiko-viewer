<script setup>
import { computed } from 'vue'
import { provideAssetsMode } from './assets'

// 只在素材页使用：让子树固定用生成式（版本 A）或真实素材（版本 B、C）画法，与全局对照版本无关。
const props = defineProps({ mode: { type: String, required: true } })
provideAssetsMode(computed(() => props.mode))
</script>

<template>
  <div :class="mode === 'authentic' ? 'as-authentic' : 'as-generated'"><slot /></div>
</template>
