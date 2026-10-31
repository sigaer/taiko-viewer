# Sakura Taiko Viewer

**My Taiko, in one place.**

Viewer 1.0.0收口My Viewer、Community、Training和Progress四条产品主线。见[正式版本说明、Contract 1.1冻结及已知限制](docs/releases/1.0.0.md)。

## Layout

- `taiko_viewer/`
  - Nuxt 3 web app and shared forum backend APIs
- `taiko_forum_app/`
  - Flutter Android client

## Production

- Web domain: `https://viewer.sakura-bot.cn`
- Viewer service: `taiko-viewer.service`
- Legacy redirect domain: `https://forum.sakura-bot.cn`
- Local sync dispatcher: `taiko-sync-receiver.service`，实际实现位于 `/home/sigaer/taiko/scripts/sync_dispatch_server.py`

## Common Commands

### Web

```bash
bash scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "$(git log -1 --pretty=%s)"
```

### Sakura Bot Sync Gateway

- `taiko-sync-receiver.service` 现在是服务端同步网关，不再接收网页直接上传的 zstd 成绩包。
- 网页只向论坛后端提交同步请求，论坛后端再调用 `http://127.0.0.1:3102/dispatch`。
- `Sakura bot` 网关会先从鼓众广场（Wahlap CN API）拉取网页绑定 ID 的 `userdata/{userid}data.json`，刷新历史快照，再将 zstd 数据转发到配置的目标接口。用户只需在网页端完成鼓众 ID 绑定，无需额外配置账号密码。
- 目标列表由网关自身提供：`http://127.0.0.1:3102/targets`
- 如需新增或调整同步目标，直接修改 `/home/sigaer/taiko/scripts/sync_dispatch_targets.py`

### App

```bash
cd taiko_forum_app
flutter pub get
flutter analyze
python3 scripts/release_build.py --summary "修复体验问题并优化论坛交互" --target-platform android-arm64 --no-pub --dart-define=TAIKO_FORUM_BASE_URL=https://viewer.sakura-bot.cn
```
