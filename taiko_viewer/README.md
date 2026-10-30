# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## 称号目录

称号一览从中心公共服务 `GET /api/titles` 读取，与 Bot 共用华立官方目录和五分钟按需刷新缓存。设置 `TAIKO_TITLE_API_BASE` 可覆盖默认地址 `http://127.0.0.1:9999`。未知条件留空；页面不混入数据库自定义称号或 wiki 推导条件。自定义称号仍保存在 `taiko_custom_titles`，官方重名校验也使用同一官方目录。
