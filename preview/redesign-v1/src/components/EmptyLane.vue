<script setup>
// 空状态 / 错误状态 / 权限引导的统一形态：一条空谱面 + 判定圈。
// 空 = 还没有音符飞过来；错误 = 判定圈变成不可色；加载 = 音符流过。
defineProps({
  title: { type: String, required: true },
  text: { type: String, default: '' },
  tone: { type: String, default: 'empty' }, // empty | error | loading
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="el" :class="[tone, { compact }]">
    <div class="strip" aria-hidden="true">
      <i class="hit" />
      <template v-if="tone === 'loading'">
        <i class="fly n1" /><i class="fly ka n2" /><i class="fly n3" />
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
.hit {
  position: absolute;
  left: 12px;
  top: 7px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--lane-ink) 70%, transparent);
}
.error .hit {
  border-color: var(--judge-ng);
  background: color-mix(in srgb, var(--judge-ng) 30%, transparent);
}
.fly {
  position: absolute;
  top: 13px;
  left: 100%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--lane-don);
  box-shadow: inset 0 0 0 2.5px var(--lane-ring);
  animation: fly 1.5s linear infinite;
}
.fly.ka {
  background: var(--lane-ka);
}
.n2 {
  animation-delay: 0.5s;
}
.n3 {
  animation-delay: 1s;
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
