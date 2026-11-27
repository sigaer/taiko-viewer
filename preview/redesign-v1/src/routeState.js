import { reactive, watch, onScopeDispose } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * useQueryState(schema, options?) —— 把页面的筛选 / 切换状态与地址查询参数双向同步（裁决 R1–R2）。
 *
 * schema 的每个 key 是状态字段名：
 *   {
 *     type: 'string' | 'number' | 'boolean' | 'set',   // set = 字符串数组，地址里写成逗号列表
 *     default: any,                                     // 等于默认值时不写进地址
 *     param?: string,                                   // 地址里的参数名（默认同字段名）
 *     debounce?: number,                                // 毫秒；输入框关键词用 250
 *     values?: any[],                                   // 可选：合法取值，不在其中按默认值处理
 *   }
 *
 * 行为：
 *   - 从地址初始化；刷新或分享链接还原同一个视图。
 *   - 改字段 → router.replace（不堆历史），只改自己的参数，保留其余（from、q、m …）。
 *   - 浏览器后退 / 前进 → 字段跟着地址变。
 *   - 防抖计时器与监听在组件卸载时清理（R6）；离开当前路径后不再写地址。
 *
 * 用法（曲库）：
 *   import { useQueryState } from '../routeState'
 *   const f = useQueryState({
 *     q:     { type: 'string', default: '', debounce: 250 },
 *     shelf: { type: 'string', default: 'all', values: ['all', 'cn', 'other'] },
 *     genre: { type: 'set', default: [] },
 *     star:  { type: 'number', default: 0 },
 *     ura:   { type: 'boolean', default: false },
 *     sort:  { type: 'string', default: 'new' },
 *     view:  { type: 'string', default: 'table' },
 *   })
 *   // 模板里直接 v-model="f.q"；set 字段：f.genre = [...f.genre, 'anime']（整体替换，不要 push）
 *
 * 只在 setup() 里调用（需要 useRoute / useRouter）。
 */
export function useQueryState(schema, { router: r, route: rt } = {}) {
  const route = rt || useRoute()
  const router = r || useRouter()
  const keys = Object.keys(schema)
  const param = (k) => schema[k].param || k
  const homePath = route.path

  const same = (a, b) => (Array.isArray(a) || Array.isArray(b) ? (a || []).join(',') === (b || []).join(',') : a === b)
  const clone = (v) => (Array.isArray(v) ? [...v] : v)

  function decode(k, raw) {
    const s = schema[k]
    const v0 = Array.isArray(raw) ? raw[0] : raw
    let v
    if (v0 == null || v0 === '') v = clone(s.default)
    else if (s.type === 'number') {
      const n = Number(v0)
      v = Number.isFinite(n) ? n : clone(s.default)
    } else if (s.type === 'boolean') v = v0 === '1' || v0 === 'true' ? true : v0 === '0' || v0 === 'false' ? false : s.default
    else if (s.type === 'set') v = String(v0).split(',').filter(Boolean)
    else v = String(v0)
    if (s.values && !(s.type === 'set' ? v.every((x) => s.values.includes(x)) : s.values.includes(v))) v = clone(s.default)
    return v
  }
  function encode(k, v) {
    const s = schema[k]
    if (v == null || same(v, s.default) || (s.type === 'set' && !v.length && !(s.default || []).length)) return undefined
    if (s.type === 'boolean') return v ? '1' : '0'
    if (s.type === 'set') return v.join(',')
    if (s.type === 'number') return Number.isFinite(v) ? String(v) : undefined
    return String(v)
  }

  const timers = {}
  const state = reactive(Object.fromEntries(keys.map((k) => [k, decode(k, route.query[param(k)])])))

  // 地址 → 状态（后退 / 前进、外部链接）
  const stopRoute = watch(
    () => keys.map((k) => route.query[param(k)]),
    () => {
      if (route.path !== homePath) return
      for (const k of keys) {
        const v = decode(k, route.query[param(k)])
        if (!same(v, state[k]) && !timers[k]) state[k] = v
      }
    },
  )

  // 状态 → 地址
  function flush() {
    if (route.path !== homePath) return
    const query = { ...route.query }
    let changed = false
    for (const k of keys) {
      const enc = encode(k, state[k])
      const p = param(k)
      const cur = Array.isArray(query[p]) ? query[p][0] : query[p]
      if (enc === undefined) {
        if (p in query) {
          delete query[p]
          changed = true
        }
      } else if (cur !== enc) {
        query[p] = enc
        changed = true
      }
    }
    if (changed) router.replace({ path: route.path, query, hash: route.hash })
  }
  const stops = keys.map((k) =>
    watch(
      () => (Array.isArray(state[k]) ? state[k].join('\u0001') : state[k]),
      () => {
        const ms = schema[k].debounce
        if (!ms) return flush()
        clearTimeout(timers[k])
        timers[k] = setTimeout(() => {
          timers[k] = null
          flush()
        }, ms)
      },
    ),
  )

  onScopeDispose(() => {
    stopRoute()
    stops.forEach((s) => s())
    for (const k of keys) clearTimeout(timers[k])
  })

  return state
}
