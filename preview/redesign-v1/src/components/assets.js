// 素材画法开关（V1.3）：组件默认跟随根元素的 data-assets（store 的对照版本）；
// 素材页（#/review/assets）用 <AssetsScope mode="generated|authentic"> 在局部固定一种画法，做前后对照。
import { computed, inject, provide } from 'vue'
import { authentic } from '../store'

const KEY = Symbol('assets-mode')

/** 当前组件应使用真实素材画法吗（computed<boolean>）。 */
export function useAuthentic() {
  const scoped = inject(KEY, null)
  return computed(() => (scoped && scoped.value ? scoped.value === 'authentic' : authentic.value))
}

/** 在子树里固定画法：modeRef 是 ref / computed，值为 'generated' | 'authentic' | null（null = 跟随全局）。 */
export function provideAssetsMode(modeRef) {
  provide(KEY, modeRef)
}
