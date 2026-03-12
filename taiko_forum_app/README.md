# Taiko Forum App

Flutter source for the Taiko forum mobile app. This server now includes a local Flutter + Android SDK toolchain and can build the Android debug APK directly.

## Stack

- Flutter + Material 3
- `provider` for app state
- `http` for API calls
- `shared_preferences` for session persistence
- `image_picker` for post image uploads

## API

- Default base URL: `https://forum.sakura-bot.cn`
- Override with `--dart-define=TAIKO_FORUM_BASE_URL=https://forum.sakura-bot.cn`
- For local debugging, point `TAIKO_FORUM_BASE_URL` to your own backend or emulator bridge URL.

## Notes

- Web and App share the same `/api/forum/*` endpoints.
- App login uses the existing `/api/account/auth/login` endpoint and stores the returned `sessionToken` as a bearer token.
- Android package name: `cn.sakura_bot.taiko_forum`
- Android app label: `太鼓论坛`
- Android external version format: `major.minor.patch.build`
- Debug build command:
  `flutter build apk --debug --dart-define=TAIKO_FORUM_BASE_URL=https://forum.sakura-bot.cn`
- Release build command with automatic bump inference:
  `python3 scripts/release_build.py --summary "新增设置页和关注拉黑功能" --split-per-abi --no-pub --dart-define=TAIKO_FORUM_BASE_URL=https://forum.sakura-bot.cn`
- Explicit override example:
  `python3 scripts/release_build.py --bump patch --summary "修复安装降级提示" --split-per-abi --no-pub --dart-define=TAIKO_FORUM_BASE_URL=https://forum.sakura-bot.cn`
- Dry-run release preview:
  `python3 scripts/release_build.py --dry-run --summary "新增设置页和个人资料管理" --split-per-abi`
