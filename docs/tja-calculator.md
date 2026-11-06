# Viewer TJA 定数计算

入口：`/tools/tja-constants`（日语 `/ja/tools/tja-constants`）。公开工具，无需账号。

单个 `.tja` 文件不超过 512 KiB；支持 UTF-8/BOM、CP932 和 GB18030。自动编码依次尝试上述编码；旧编码存在歧义时可手动选择。所有难度与分支分别计算，双打 P1/P2 不合并。返回 75% / 主 / 99% 三项定数、体力 / 手速 / 爆发 / 复合 / 节奏五项能力定数，以及音符数和原始指标。精度依赖游玩成绩，不生成静态精度定数。

## 算法与构建

`taiko_viewer/vendor/tja/sources.json` 固定 OurTaiko Constants、TJAAnalyzer、TJARenderer 的 tree 和 Git blob SHA。源码及各自 LICENSE 入库，未修改上游算法。沿用家用机 V2 补全的全量 13 项校准参数，不对上传谱面重新校准。

`npm run build` / `npm run dev` 的前置脚本校验全部源码身份并准备 `.tja-runtime`。Nitro compiled hook 将运行文件复制进 `.output/server/tja-runtime`；运行时从正式发布产物读取。生成目录不入库。构建、计算都不下载上游资源。Python 仅依赖标准库；解析器在构建时使用现有 esbuild 打包。

`POST /api/tools/tja-constants` 接收原始文件字节，Content-Type 为 `application/octet-stream`，可选 `x-tja-encoding` 为 `auto`、`utf-8-sig`、`cp932`、`gb18030`。响应是 `types/tja-calculator.ts` 定义的结果；错误通过 `data.code` 返回。JSON 下载在浏览器本地生成。

## 资源与隐私

- 上传流限制 512 KiB、10 秒、每个 Viewer 进程最多四个读取者；每个 IP 每分钟最多六次。仅信任本机反向代理传入的 X-Real-IP。
- 固定 systemd unit `taiko-tja-calculator.service` 实现单机跨 Viewer 进程互斥，不建立任务队列；繁忙时返回可重试错误。
- 每次计算运行在短生命周期 cgroup：MemoryHigh 384 MiB、MemoryMax 512 MiB、无 swap、CPUQuota 100%、TasksMax 32、25 秒总期限和两秒停止期限。主进程退出后，服务期限仍会终止全部子进程。无法建立隔离时不回退到无限制进程。
- 计算进程 PrivateNetwork、ProtectSystem=strict、ProtectHome=read-only、NoNewPrivileges；无法访问远端分析接口。最多 12 段谱面、36 个分支结果，每分支最多 20,000 个可判定音符。
- 上传只经过内存和 stdin，不记录正文、不写入 DB、不保存谱面文件。短时结果缓存最多 16 条、五分钟有效；缓存包含标题和指标，不包含谱面正文，重启即清空。API 返回 no-store。
- 算法异常、音符间隔不对应或音符不足时返回分支错误，不静默发布零值。文件结构不完整时整体拒绝。

部署依赖本机 systemd、`/usr/bin/python3` 和 Viewer 使用的 Node。仅通过标准 `scripts/deploy_forum_web.sh` 发布，不需要另建常驻服务或手动重启。

## 验证

从仓库根目录运行（不要与构建重叠）：

```bash
bash scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node taiko_viewer/scripts/prepare_tja_runtime.mjs
bash scripts/memory/run_qa.sh /usr/bin/env TJA_REFERENCE_ROOT=/home/sigaer/git/ESE_autosync /www/server/nvm/versions/node/v24.13.0/bin/node --test taiko_viewer/tests/tjaCalculator.test.mjs
bash scripts/memory/run_qa.sh /www/server/nvm/versions/node/v24.13.0/bin/node taiko_viewer/scripts/verify_tja_calculator_browser.mjs
```

HTTP 测试使用真实隔离 worker，并核对现有家用机数据中的参考谱面（误差 < 1e-9）；可选参考目录仅只读。浏览器验证在受限进程内启动临时 Viewer，不连接业务数据库，退出时清理浏览器与服务。证据由 QA vault 保存。

1.8.0 发布前验证：HTTP/隔离进程、三种编码、分支、畸形/超限输入、并发拒绝、限流及五张参考谱面一致性通过（QA `qa-80814217c800`）；真实浏览器的上传、难度/分支切换、下载、拖放、取消等待、忙碌重试、中文/日文、375px 手机、桌面与深色主题通过（QA `qa-2146ab03370e`）。临时 3197 端口已关闭。
