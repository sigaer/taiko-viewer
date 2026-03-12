# Repository Notes

## Scope

- This repository only contains the Taiko forum web/backend project and the Flutter app.
- Do not add unrelated bot code, user data, cached assets, or deployment outputs.

## Web

- Production forum domain: `https://forum.sakura-bot.cn`
- Source project: `taiko_frontend_back`
- Shared backend APIs live under `/api/forum/*` and `/api/account/*`

## App

- Source project: `taiko_forum_app`
- Android external version format: `major.minor.patch.build`
- `pubspec.yaml` remains `major.minor.patch+build`
- Release builds must use `taiko_forum_app/scripts/release_build.py`

## Release Policy

- Infer version bumps from the actual release scope:
  - `build`: repackaging, asset refresh, copy changes
  - `patch`: bug fixes and compatible UX corrections
  - `minor`: backward-compatible features and new screens
  - `major`: breaking changes or migration-requiring releases
- Prefer passing `--summary "<变更摘要>"` to the release script so the inferred bump is logged.

## Ignore Rules

- Keep generated directories out of git:
  - `node_modules`
  - `.nuxt`
  - `.output`
  - `build`
  - `.dart_tool`
  - coverage, logs, local caches
