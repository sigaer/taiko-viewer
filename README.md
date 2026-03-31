# Taiko Forum

Private dual-project repository for the Taiko forum service.

## Layout

- `taiko_frontend_back/`
  - Nuxt 3 web app and shared forum backend APIs
- `taiko_forum_app/`
  - Flutter Android client

## Production

- Web domain: `https://forum.sakura-bot.cn`
- Forum service: `taiko-forum.service`
- Viewer service: `taiko-viewer.service`
- Local sync receiver: `taiko-sync-receiver.service`，写入 `/home/sigaer/taiko/userdata`

## Common Commands

### Web

```bash
cd taiko_frontend_back
npm install
npm run build
sudo systemctl restart taiko-viewer taiko-forum taiko-sync-receiver
curl http://127.0.0.1:3102/health
```

### Sakura Bot Sync Gateway

- `taiko-sync-receiver.service` 现在是服务端同步网关，不再接收网页直接上传的 zstd 成绩包。
- 网页只向论坛后端提交同步请求，论坛后端再调用 `http://127.0.0.1:3102/dispatch`。
- `Sakura bot` 网关会在本地读取 `userdata/{userid}data.json`，按需刷新 `userdata/{userid}/data_*.json` 历史快照，并将 zstd 数据转发到配置的目标接口。
- 目标列表由网关自身提供：`http://127.0.0.1:3102/targets`
- 如需覆盖默认分发目标，可为 `taiko-sync-receiver.service` 设置环境变量 `TAIKO_SYNC_FORWARD_TARGETS_JSON`

### App

```bash
cd taiko_forum_app
flutter pub get
flutter analyze
python3 scripts/release_build.py --summary "修复体验问题并优化论坛交互" --target-platform android-arm64 --no-pub --dart-define=TAIKO_FORUM_BASE_URL=https://forum.sakura-bot.cn
```
