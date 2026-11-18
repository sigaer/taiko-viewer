# Stage 1 · 导航、搜索与曲库

2026-11-18，独立分支 `feature/viewer-rework-stage1`。依据已批准的 V1.3（冻结
5f770a2ddd2df970454f85fda09fa73008120b66）及 `06` 阶段 1；未合并、未部署。

首个实现切片已建立：六组导航与五项手机导航的路由模型、搜索快捷键/键盘选中
规则、统一曲库查询与旧列表 URL 转换、歌曲搜索到现有 `/api/content/songs`
服务端分页契约的适配。保留 `/ja` 与原查询参数，不引入模拟接口或原型 store。
手机搜索是动作，不是页面链接；成绩/成长/社区暂指向现有业务路由，避免提前
引用尚未实现的页面。模型尚未挂入现有外壳，因此没有用户可见变化或版本发布。

接续顺序：先针对 Keepalive + Teleport 做修复与运行回归，再接新导航外壳、
带焦点归还/combobox 键盘行为的全局搜索、统一曲库与服务端重定向。搜索别名
排序、密度图来源等未裁定字段保持待定；不以现有 keyword API 冒充完整原型
匹配语义，不添加年度报告或基础设施工作。页面接入时再做 minor 版本变更。

验证：qa-68c6a0f98af6 经 Linux static 隔离 runner，4 项 Node 测试通过，覆盖
分组边界、日文/旧 URL 查询保留、服务端分页字段及键盘/输入保护。尚未接入
页面，因此这不是 Stage 1 完成或浏览器验收声明。Phase 0 收口见父提交 3b1bf598。


Keepalive 前置修复：NuxtPage 显式 prop 会优先于路由 meta，导致 `keepalive:false`
失效；改用 Nuxt app 默认配置，保留 PracticePlayerPage 排除与普通页面缓存。
隔离真实 Nuxt/Element Plus 浏览器 qa-3a0db8518560 证实修复前不缓存声明失效；
qa-9f98f83f8625 修复后 5 项通过：同布局状态保留、跨布局/head、无布局缓存页的
Teleport 卸载、显式禁止缓存、零生命周期异常。当前 Vue 3.5.43/Nuxt 3.21.11/
Element Plus 2.13.2 未复现历史 Windows nextSibling 异常，不能声称复现并修复了
相同框架异常；未改依赖或删除样张既有保护。测试不连接数据库、使用独立网络。
参考 Nuxt 本地 page.js 的 `props.keepalive ?? route.meta.keepalive` 优先级及
[Vue KeepAlive 生命周期](https://vuejs.org/guide/built-ins/keep-alive)。
