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

### App

```bash
cd taiko_forum_app
flutter pub get
flutter analyze
python3 scripts/release_build.py --summary "修复体验问题并优化论坛交互" --target-platform android-arm64 --no-pub --dart-define=TAIKO_FORUM_BASE_URL=https://forum.sakura-bot.cn
```
