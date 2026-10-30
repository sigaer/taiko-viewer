# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## 称号目录

称号一览从中心公共服务 `GET /api/titles` 读取，与 Bot 共用华立官方目录和五分钟按需刷新缓存。设置 `TAIKO_TITLE_API_BASE` 可覆盖默认地址 `http://127.0.0.1:9999`。展示条目及 ID 以官方目录为准，按规范化名称和称号底板类型匹配原 `/taiko/title/page` 本地称号资料，优先使用其中的已知条件和歌曲关联；缺失字段再用官方 API 信息，两边都未知的条件留空。本地资料接口失败时显示加载失败，不把暂时不可用误当成没有资料。页面不混入本地独有或自定义称号；自定义称号仍保存在 `taiko_custom_titles`，官方重名校验直接使用官方目录。
