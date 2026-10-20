# 歌曲详情真实组件本地预览

这是独立分支的本地 Nuxt 预览根，读取实际的 `taiko_viewer/pages/songs/[id].vue`、组件、布局、composable 和国际化文件。没有移植 `refine.js`，也没有复制歌曲页处理器。保留 Nuxt SSR 与客户端挂载，用生产的 DTO 类型提供预览输入。

## 本机启动位置

这份交付位于独立工作树 `/var/tmp/viewer-song-preview-20261020`，分支为 `design/song-detail-preview-20261020`。`/home/sigaer/pjskClient` 和原 Viewer 主工作区没有这个 `preview` 文件夹；不用在这两个目录中执行相对路径命令，也不用切换或覆盖它们的分支。

在这台服务器的任意目录执行以下命令（普通用户终端）：

```bash
sudo bash /var/tmp/viewer-song-preview-20261020/preview/song-detail/run.sh
```

如果终端已经是 root，直接执行 `bash /var/tmp/viewer-song-preview-20261020/preview/song-detail/run.sh`。本机复用的依赖目录和既有 systemd 内存隔离包装器由 root 管理，普通用户直接执行会遇到权限问题；无需修改生产依赖的权限或重新安装依赖。

等待终端完成 Nuxt 构建后，打开 `http://127.0.0.1:3208/songs/1455?previewState=scores`。脚本仅监听服务器回环地址；如果通过 SSH／VS Code Remote 开发，先在编辑器的「端口」面板转发服务器的 `3208`，再用本机浏览器打开上述地址。终端 Ctrl+C 结束；不要与本仓库 QA 或构建并行运行。默认使用主机已有 Node 24，可通过 `SONG_PREVIEW_NODE` 指定同版本可执行文件。复用现有依赖，无新增包或安装步骤。

这里的绝对路径、Node 路径和依赖链接是这台服务器的设置，不是其他机器克隆仓库后可直接使用的安装说明。

可选视图：

| 检查 | URL |
| --- | --- |
| 长标题、有里谱、合成成绩 | `/songs/1455?previewState=scores` |
| 已登录、无成绩 | `/songs/1455?previewState=empty` |
| 未登录 | `/songs/1455?previewState=guest` |
| 无里谱 | `/songs/1?previewState=scores` |
| 日语长标题 | `/ja/songs/1455?previewState=scores` |
| 分支音轨 | `/songs/627?previewState=scores` |
| 推荐来源目标入口 | `/songs/1455?difficulty=4&recommendation=preview-only-invalid&previewState=scores` |

状态切换通过本地 `song_preview_state` Cookie 影响 fixture；它不代表真实登录。目标入口仍使用原组件的来源条件。`preview-only-invalid` 不是有效推荐凭证；点击后会收到本地 405，不会创建目标，也不会伪造确认成功。

公开歌曲、难度、分析、分支音轨与下载地址来自 `fixtures/sources.json` 记录的现有公开 GET。个人账号、成绩和社区空数据为合成；预览没有读取生产用户记录。谱面 PNG、音频使用既有静态资源地址；TJA 下载转到现有公开 GET。

这个预览根将 `serverDir` 指向自身的只读 fixture middleware，**不加载业务 server 目录**。所有 API 的 POST、PUT、PATCH、DELETE 等非 GET/HEAD 请求均返回 405；未知 API 返回 404。它不提供演示写入后端。标准应用的配置、服务端路由、认证和 API 没有改变。

浏览器截图脚本 `capture.py` 必须在该独立工作树根目录通过既有 QA 包装器运行（本机 root 终端，先结束预览服务）：

```bash
cd /var/tmp/viewer-song-preview-20261020
bash scripts/memory/run_qa.sh /usr/bin/python3 "$PWD/preview/song-detail/capture.py" after
```

`before` 使用本机保存的 0.86.2 生产源码构件作为只读源，复用同一个预览根和相同输入；因此新旧对照不受登录数据或 API 响应差异影响。它不是生产私人账号截图。旧源码路径记录在脚本中，只用于本机复现；标准应用不引用该路径。
