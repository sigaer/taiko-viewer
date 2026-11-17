# Viewer CI 与生产部署

## 日常路径

`Deploy Taiko Viewer` 在 PR、main push 和手动运行时执行同一套验证：
现有账号/社区/成长/API 回归、发布边界测试、Contract 生成检查与 Python Golden、完整 Nuxt 生产构建。
验证统一由可复用的 `developer-api-batch1.yml` 执行，不再重复触发旧工作流。

验证通过且 `DEPLOY_ENABLED=true` 时，main 的 push 或手动运行会通过 SSH 部署生产。
没有额外人工审批步骤。PR、功能分支的手动运行只验证；main 的手动运行会部署。
没有设置开关时部署 job 跳过，验证仍运行。

GitHub 只传递本次验证的完整提交 SHA。主机使用现有路径：

```
restricted SSH entry
  → scripts/memory/run_build.sh
  → scripts/deploy_forum_web.sh --ci SHA
  → 干净 main 快进 / npm ci / Nuxt build
  → 原有服务切换 / 健康检查 / 失败回滚
```

CI 构建用于验证，生产构建仍由标准脚本在主机内存隔离下执行，使用主机现有 schema 和环境。
不从 GitHub 下载或替换生产 `.output`。运行数据、私有配置、DB、歌曲和 OSS 保持现有位置。
CI 模式不创建提交、不推送 GitHub，因此不会产生 main push 触发循环；手动发布入口保持原用法。
合并提交无需使用版本号前缀，产品版本仍由 `taiko_viewer/package.json` 管理。

工作流串行部署且不取消正在进行的发布。服务器在快进前与切换前重新核对远端 main 和测试 SHA，
旧任务遇到新提交会失败退出，等待新提交自己的 CI。
跟踪文件有未提交修改、生产分支分叉或未跟踪文件阻挡快进时均停止，不执行 stash、reset、clean。
每日更新的 `assets/data/title_song_relations.json` 必须检查后提交，再合并发布；不能让自动部署丢弃它。

## 首次启用

1. 合并工作流 PR，让 main CI 全部通过。开关此时保持未设置或 `false`。
2. 在生产 checkout 检查 `git status`，验证并提交现有跟踪文件变化；不要删除未跟踪的开发文档或脚本。
   然后 `git fetch origin main`、`git merge --ff-only origin/main`，确保主机已有这套 CI 入口。
   若提交了额外数据更新，等待该提交的 CI 验证通过。
3. 在主机创建专用密钥并安装限定命令（不复用日常登录密钥）：

   ```sh
   install -d -m 0700 /root/.config/taiko-viewer-ci
   ssh-keygen -t ed25519 -N '' -C taiko-viewer-actions -f /root/.config/taiko-viewer-ci/id_ed25519
   bash scripts/release/install-viewer-ci-ssh.sh /root/.config/taiko-viewer-ci/id_ed25519.pub
   ```

   私钥只留在该私有路径和 GitHub Secret。安装器向 root 的 authorized_keys 追加
   `restrict,command="/usr/local/libexec/taiko-viewer-ci-ssh"` 专用公钥，保留其他登录密钥。
   该入口只接受 `deploy <完整 SHA>`；生产服务当前以 root 运行，因此部署入口也使用 root。
   入口不提供 shell、PTY、转发或任意命令执行。
4. 在仓库 Settings → Secrets and variables → Actions 设置：

   | 类型 | 名称 | 值 |
   | --- | --- | --- |
   | Secret | `DEPLOY_HOST` | GitHub runner 能连接到的生产 SSH 域名或 IPv4 地址 |
   | Secret | `DEPLOY_PORT` | SSH 端口；未设置时默认 22 |
   | Secret | `DEPLOY_USER` | `root` |
   | Secret | `DEPLOY_KEY` | 上述专用私钥的完整内容 |
   | Secret | `DEPLOY_KNOWN_HOSTS` | 已在主机侧核对的 SSH host key known_hosts 行 |
   | Variable | `DEPLOY_ENABLED` | 最后设置为 `true` |

   Host key 从生产 `/etc/ssh/ssh_host_ed25519_key.pub` 获取；known_hosts 行形式为
   `HOST ssh-ed25519 BASE64`，非 22 端口使用 `[HOST]:PORT`。
   不要只信任 runner 临时扫描到的 key，也不要关闭主机验证。
   当前 GitHub 连接器没有管理 Actions secrets/variables 的接口，这一步需要仓库设置权限。
5. Actions → Deploy Taiko Viewer → Run workflow → **main**，检查 validate、deploy 均通过及站点健康。
   从此合并或推送 main 会自动执行验证与部署。设 `DEPLOY_ENABLED=false` 可暂停后续自动上线。

## 开发与故障

本机 QA 继续使用 `scripts/memory/run_qa.sh`；部署继续使用 `scripts/memory/run_build.sh`
包裹标准脚本。不要同时启动 QA 与生产构建。

失败发生在构建/源码检查阶段时，线上产物不切换。
服务切换后健康检查失败时，沿用标准脚本恢复上一份产物；修正代码后发布新提交。
如果 main 已前进，重跑最新 main 的工作流；不要重跑旧 SHA 来回滚生产。
工作流不会自动迁移数据库，迁移仍需遵守现有隔离验证与发布流程。

可复用工作流使用 GitHub 的 [workflow_call](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)，
SSH 只对 deploy job 提供，验证 job 不继承部署 secrets。
