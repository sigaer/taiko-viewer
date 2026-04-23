# Repository Notes

## Scope

- This repository only contains the Taiko forum web/backend project and the Flutter app.
- Do not add unrelated bot code, user data, cached assets, or deployment outputs.
- This path is a standalone Git repository.
- Work inside `/home/sigaer/taiko/taiko-forum` does not need `/home/sigaer/git/Sakura_bot/taiko` status checks, sync, commits, or pushes.

## Web

- Production forum domain: `https://forum.sakura-bot.cn`
- Source project: `taiko_frontend_back`
- Shared backend APIs live under `/api/forum/*` and `/api/account/*`
- Any user-visible web change must bump `taiko_frontend_back/package.json` version in the same change.
- After changing web code or web version, deploy with `scripts/deploy_forum_web.sh "<commit_message>"` instead of only restarting a single service.
- If the homepage/version badge reads from fallback strings, update those fallbacks together with the package version.

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
