# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## 称号目录

后台 `/admin/taiko/titles` 可人工编辑官方称号的获取条件，按名称及底板找到本地资料，只更新条件；缺少本地资料时补建记录。留空恢复官方条件，保存后核对结果并记录审计。每日称号同步保留现有人工条件，Viewer 刷新后读取修正。

称号一览从中心公共服务 `GET /api/titles` 读取，与 Bot 共用华立官方目录和五分钟按需刷新缓存。设置 `TAIKO_TITLE_API_BASE` 可覆盖默认地址 `http://127.0.0.1:9999`。展示条目及 ID 以官方目录为准，按规范化名称和称号底板类型匹配原 `/taiko/title/page` 本地称号资料，优先使用其中的已知条件和歌曲关联；缺失字段再用官方 API 信息，两边都未知的条件留空。本地资料接口失败时显示加载失败，不把暂时不可用误当成没有资料。页面不混入本地独有或自定义称号；自定义称号仍保存在 `taiko_custom_titles`，官方重名校验直接使用官方目录。

每日曲库任务随后生成 `assets/data/title_song_relations.json`（schema v2）。保留曲名及原有双向索引，新增歌曲 `song_ids`、官方称号 `title_ids`、`by_song_id` 和按官方称号底板区分的 `title_bindings`。歌曲匹配先检查保留大小写的规范化中日文名称，再回退到忽略大小写的名称；保留有效标点，统一全半角、空白和弯引号。里谱链接的末尾 `(裏)` 可回退到歌曲名，已核对的译名和上游拼写差异使用显式别名。同名候选结合曲库的街机身份筛选；只有明确核对的多 ID 组合才同时关联，新增候选仍保留歧义。每条关系和索引记录 `song_match_method`，选项、系列和全曲条件不作为单曲关系。曲名中的“或”等字符不参与难度判断。缺失歌曲或未消除的歌曲/称号歧义仍跳过该称号的发布，不做模糊猜测。

生成成功后调用 `scripts/sync_title_song_relations.py --apply`，通过已有管理 API 补充本地称号和关联歌曲。按名称及底板匹配本地记录，绝不将官方称号 ID 用作本地行 ID；现有记录仅合并歌曲 ID，保留人工条件和关联，不删除记录。新记录使用官方已知条件。写入无自动重试，完成后重新分页读取核对；失败令每日任务报错。Viewer 下次刷新页面即读取更新后的资料，无需每日重新构建站点。

凭据放在 Git 外的 `/home/sigaer/taiko/data/title_sync.json`，格式参考仓库 `deploy/title-sync.example.json`，权限设为 `600`。支持 `username`/`password` 或 `token`；过期 token 必须更新，定时任务宜使用可重新登录的账号。手动检查时省略 `--apply`：

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 taiko_viewer/scripts/sync_title_song_relations.py --report /var/tmp/taiko-title-sync/plan.json
```

生产每日任务由 taiko-bot 的 `taiko_bot.offline.title_update` 编排，仍在 Asia/Shanghai 每日 09:42 的曲库更新流程末尾执行。独立运行该模块默认只预览，加 `--cached` 使用现有官方缓存，加 `--apply` 才发布。测试使用合成数据及本地 HTTP 服务，不连接实际数据库。

称号底板使用 `public/assets/my-don/title-plate-slices/manifest.json` 的 73 种编号资源，覆盖当前目录的全部底板类型。新增切片沿用去掉原图底部 45 像素的规则，原有 9 张切片保留原始字节；原始素材位于 Git 外的 `/home/sigaer/taiko/assets/name_plate`。切片清单记录尺寸、文字区域和 SHA-256，生成的 `utils/ds/titlePlateSlices.ts` 供前端按实际底板 ID 查找。长称号缩至 10px 后按文字区域横向适配，保留底图和完整称号。重建或核对素材时运行：

```bash
bash scripts/memory/run_qa.sh /usr/bin/python3 taiko_viewer/scripts/generate_title_plate_slices.py
bash scripts/memory/run_qa.sh /usr/bin/python3 taiko_viewer/scripts/generate_title_plate_slices.py --check
```
