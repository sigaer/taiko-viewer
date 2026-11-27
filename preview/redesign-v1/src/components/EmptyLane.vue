<script setup>
import { prefersReducedMotion } from '../motion'

/**
 * 空状态 / 错误状态 / 加载状态 / 权限引导的统一形态：一条空谱面 + 判定圈。
 * 空 = 还没有音符飞过来；错误 = 判定圈变成不可色；加载 = 音符流过（减少动效时为静止的三个音符）。
 * props: title、text、tone（'empty' | 'error' | 'loading'）、compact
 * slot default：操作按钮
 */
defineProps({
  title: { type: String, required: true },
  text: { type: String, default: '' },
  tone: { type: String, default: 'empty' }, // empty | error | loading
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="el" :class="[tone, { compact }]" :role="tone === 'loading' ? 'status' : undefined" :aria-busy="tone === 'loading' ? 'true' : undefined">
    <div class="strip" aria-hidden="true">
      <i class="judge-ring" />
      <template v-if="tone === 'loading'">
        <template v-if="prefersReducedMotion"><i class="still s1" /><i class="still ka s2" /><i class="still s3" /></template>
        <template v-else><i class="fly n1" /><i class="fly ka n2" /><i class="fly n3" /></template>
      </template>
    </div>
    <h3 class="t-h2">{{ title }}</h3>
    <p v-if="text" class="t-small">{{ text }}</p>
    <div v-if="$slots.default" class="acts"><slot /></div>
  </div>
</template>

<style scoped>
.el {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 40px 20px 44px;
}
.el.compact {
  padding: 24px 16px 28px;
}
.strip {
  position: relative;
  width: min(280px, 100%);
  height: 44px;
  margin-bottom: 12px;
  border-radius: var(--r-note);
  background: var(--lane);
  overflow: hidden;
}
.strip::before {
  content: '';
  position: absolute;
  inset: 9px 0;
  border-top: 1px solid var(--lane-line);
  border-bottom: 1px solid var(--lane-line);
}
.judge-ring {
  position: absolute;
  left: 12px;
  top: 7px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--lane-ink-2);
}
.error .judge-ring {
  border-color: var(--judge-ng);
  background: color-mix(in srgb, var(--judge-ng) 30%, transparent);
}
.fly,
.still {
  position: absolute;
  top: 13px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--lane-don);
  box-shadow: inset 0 0 0 2.5px var(--note-ring);
}
.fly {
  left: 100%;
  animation: fly 1.5s linear infinite;
}
.fly.ka,
.still.ka {
  background: var(--lane-ka);
}
.n2 {
  animation-delay: 0.5s;
}
.n3 {
  animation-delay: 1s;
}
.s1 {
  left: 38%;
}
.s2 {
  left: 58%;
}
.s3 {
  left: 78%;
}
@keyframes fly {
  to {
    left: 18px;
    opacity: 0.2;
  }
}
p {
  max-width: 36em;
}
.acts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}
</style>
