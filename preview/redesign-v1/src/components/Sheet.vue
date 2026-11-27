<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import Icon from './Icon.vue'
import { L } from '../store'
import { trapTab, restoreFocus } from '../focusTrap'

/**
 * 弹层：桌面是居中对话框，手机是底部抽屉。同一个组件、同一份内容。
 * props: open、title（对话框名称，经 aria-labelledby 关联）、width（桌面最大宽度 px）
 * slots: default（正文）、foot（底部操作区）
 * events: close（Esc、点遮罩、关闭按钮）
 * 打开时焦点落到第一个输入项（没有则落到关闭按钮），Tab 限制在弹层内；关闭时焦点还给打开它的元素。
 */
const titleId = useId()
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: Number, default: 520 },
})
const emit = defineEmits(['close'])
const box = ref(null)
const closeBtn = ref(null)
let opener = null
function onKey(e) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'Tab') trapTab(e, box.value)
}
// 打开：焦点落到第一个输入项，没有输入项就落到关闭按钮；关闭：还给打开它的元素
watch(
  () => props.open,
  async (v, old) => {
    if (!v && !old) return
    document.documentElement.style.overflow = v ? 'hidden' : ''
    if (v) {
      opener = document.activeElement
      window.addEventListener('keydown', onKey)
      await nextTick()
      const field = box.value?.querySelector('.sheet-body :is(input, select, textarea):not([disabled])')
      ;(field || closeBtn.value)?.focus({ preventScroll: true })
    } else {
      window.removeEventListener('keydown', onKey)
      restoreFocus(opener)
      opener = null
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (props.open) {
    document.documentElement.style.overflow = ''
    restoreFocus(opener)
  }
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="scrim" @click.self="emit('close')">
        <div ref="box" class="sheet" role="dialog" aria-modal="true" :aria-labelledby="titleId" :style="{ '--w': width + 'px' }">
          <i class="grab" />
          <header class="sheet-head">
            <h2 :id="titleId" class="t-h2">{{ title }}</h2>
            <button ref="closeBtn" class="icon-btn" :aria-label="L('关闭', '閉じる')" @click="emit('close')"><Icon name="close" /></button>
          </header>
          <div class="sheet-body"><slot /></div>
          <footer v-if="$slots.foot" class="sheet-foot"><slot name="foot" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-sheet);
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--scrim);
}
.sheet {
  width: min(var(--w), 100%);
  max-height: min(86dvh, 820px);
  display: flex;
  flex-direction: column;
  background: var(--overlay-bg);
  border-radius: var(--overlay-radius);
  box-shadow: var(--overlay-shadow), 0 0 0 1px var(--overlay-line);
  animation: rise var(--dur-2) var(--ease-out);
}
@keyframes rise {
  from {
    transform: translateY(12px) scale(0.98);
    opacity: 0;
  }
}
.grab {
  display: none;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px 10px var(--overlay-pad);
}
.sheet-body {
  padding: 4px var(--overlay-pad) var(--overlay-pad);
  overflow-y: auto;
}
.sheet-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px var(--overlay-pad);
  border-top: 1px solid var(--line);
}
@media (max-width: 767px) {
  .scrim {
    padding: 0;
    place-items: end stretch;
  }
  .sheet {
    width: 100%;
    max-height: 90dvh;
    border-radius: var(--r-sheet) var(--r-sheet) 0 0;
    padding-bottom: env(safe-area-inset-bottom);
    animation: up var(--dur-3) var(--ease-out);
  }
  @keyframes up {
    from {
      transform: translateY(100%);
    }
  }
  .grab {
    display: block;
    width: 40px;
    height: 4px;
    margin: 8px auto 0;
    border-radius: 2px;
    background: var(--line-strong);
  }
  .sheet-foot > :deep(*) {
    flex: 1;
  }
}
</style>
