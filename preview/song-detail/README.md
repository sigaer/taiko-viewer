# Viewer 多页真实组件预览

本机工作树：`/var/tmp/viewer-song-preview-20261020`。分支：`design/song-detail-preview-20261020`。原 `song-detail` 路径保留，现已承载公共体系和第一批真实页面；当前目录 `pjskClient` 和原 Viewer 主工作区没有这个文件夹。

从服务器任意目录启动：

```bash
sudo bash /var/tmp/viewer-song-preview-20261020/preview/song-detail/run.sh
```

root 终端省略 sudo。脚本复用本机 Node 24 与已有依赖，并使用既有 systemd 内存隔离包装器；不要与 QA／构建并行运行。保持终端打开，Ctrl+C 停止。若服务已经运行，直接打开页面，不要再启动第二份。

**统一评审入口：** `http://127.0.0.1:3208/__review`。

远程 IDE 需在「端口」面板转发 `127.0.0.1:3208`，用面板显示的实际本地地址打开；本地端口被占用时可能改变，不能只凭服务器端口手写地址。若原转发失效，删除后重新转发，再在电脑的系统浏览器打开。

| 真实页面 | 路由 |
| --- | --- |
| 歌曲列表 | `/songs/available` |
| 歌曲详情 | `/songs/1455` |
| 普通推荐 | `/tools/recommend`，点击“查看推荐” |
| 资料／绑定 | `/account/profile` |
| 兼容检查 | `/`、`/account/songs`、`/my/growth`、`/my/weekly`、`/forum`、`/docs/score-token`、`/settings` |

中日文使用原有语言切换；浅／暗主题在设置页切换。可在任意页面 URL 加 `?previewState=scores`、`empty`、`guest`、`pending` 或 `unbound`；`failure` 明确模拟首页内容与成长读取 503；`recent-failure` 仅让近期变化读取失败，`unchanged` 表示同步后没有新变化，`changes` 展示有证据的合成 PB 与今日记录。切换合成身份请完整导航／刷新；普通站内导航继续使用真实 Nuxt 路由。`/songs/1` 无里谱，`/songs/627` 带分支音轨。

## 数据边界

- 公开歌曲来自已保存的公开 GET，目录样本 60 首；20 条推荐、账号、成绩及有限历史为明确的合成 fixture，不代表生产推荐质量或真实玩家事实。
- 读取实际 Vue 页面、组件、布局、composable 和国际化，保留 SSR 与客户端挂载。不使用 refine.js 或独立 HTML 原型替代页面。
- `serverDir` 仅指向本目录。普通生产业务 server 不加载，未知 API 不代理到生产。预览不携带生产凭据。
- 既有 `/api/account/growth/goal/preview` 的 POST 只返回合成的只读确认 DTO，用于查看原确认弹窗；它不写入目标。绑定、目标提交、同步、上传等写入一律拒绝为 405，不伪造保存成功。
- 同批推荐图片是预先保存的合成 SVG 样本，随列表数量匹配，不调用生产图片生成器。原谱面 PNG、封面、音频和播放器地址保持原能力；不对图片调色。

## 检查与历史

[本次内容收口与对照](../../docs/viewer-lightness-20261020/content-refinement-20261020/README.md)、[公共基础历史说明](../../docs/viewer-lightness-20261020/README.md)、[唯一迁移表](../../docs/viewer-lightness-20261020/migration.md)。统一评审页显示同输入、同浏览器／视口的前后图，旧设计资料与歌曲页历史图继续保留。

新截图脚本：`review/capture.py`。在该工作树根目录，以 root 通过 `scripts/memory/run_qa.sh` 运行；先停止预览，避免共用锁冲突。`before` 读取本机冻结的 `55a979a` 工作树；`after` 读取当前源码，二者共用同一只读数据根。`--content` 将对照基线改为冻结的 `63fda22`，写入独立的 `content-refinement-20261020` 子目录，覆盖八个真实页面；`--content --content-checks` 检查本次内容交互。`--space` 检查五类优先页面的 390／414／820／1280／1440／1920 浅暗布局；`--compat` 检查其他页面，`--checks` 检查控件、主题、跨页与拒绝写入。旧 `capture.py`／`capture-integration.py` 为之前交付的复现工具，会写旧截图目录，不用于本轮评审。

这些绝对路径和依赖链接属于这台主机，不是其他机器克隆后可直接使用的安装说明。预览不合入 main、不部署、不 bump；版本在实际准备发布时处理。
