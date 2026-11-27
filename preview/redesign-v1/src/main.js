import { createApp } from 'vue'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/noto-sans-jp'
import './styles/tokens.css'
import './styles/base.css'
import './styles/domain.css'
import App from './App.vue'
import { router } from './router'
import { store } from './store'
import { sync } from './sync'
import { datasetInfo } from './mock/data'

createApp(App).use(router).mount('#app')

// 仅限设计原型：给浏览器验收脚本（qa/）读取状态与数据生成耗时。正式实现不要暴露。
window.__TV__ = { store, sync, datasetInfo, router }
