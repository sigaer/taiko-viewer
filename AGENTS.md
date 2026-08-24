# Repository Notes

## Scope

- This repository only contains the Taiko forum web/backend project and the Flutter app.
- Do not add unrelated bot code, user data, cached assets, or deployment outputs.
- This path is a standalone Git repository.
- Work inside `/home/sigaer/taiko/taiko-forum` does not need `/home/sigaer/git/Sakura_bot/taiko` status checks, sync, commits, or pushes.
- Use /home/sigaer/taiko/taiko-forum/scripts/deploy_forum_web.sh to build and commit viewer

## Web

- Production viewer domain: `https://viewer.sakura-bot.cn`
- Legacy forum domain: `https://forum.sakura-bot.cn` redirects to the viewer domain.
- Source project: `taiko_viewer`
- Shared backend APIs live under `/api/forum/*` and `/api/account/*`
- Any user-visible web change must bump `taiko_viewer/package.json` version in the same change.
- After changing web code or web version, deploy with `scripts/deploy_forum_web.sh "<commit_message>"` instead of only restarting a single service.
- Baidu URL push: copy `deploy/baidu-push.env.example` to `deploy/baidu-push.env`, set `BAIDU_PUSH_TOKEN`, then run `scripts/baidu_push_urls.sh` (deploy script runs it automatically when configured).
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

## UI Copy and Specification Leakage

Do not copy explanatory language from prompts, task specifications, plans,
design rationale, implementation notes, or acceptance criteria directly into
user-facing UI.

Always distinguish between:

1. Product Copy
   - Information or actions the end user genuinely needs.
   - Examples: feature names, data, navigation labels, concise value
     propositions, and calls to action.
2. State Copy
   - Information required to understand an error, permission, empty state,
     loading state, or next action.
3. Implementation Rationale
   - Explanations for developers or reviewers about component purpose,
     omitted content, data sources, implementation phase, or deferred work.
   - Keep this in specifications, comments, docs, PRs, or code review; do not
     render it to end users by default.

Avoid explanatory subtitles added only to make a section feel complete.
Prefer nouns, actual data, actions, and concise value statements over
explanations of how the interface is implemented.

Before completing any user-facing UI task, review newly added visible strings:

- remove prompt/specification language and design rationale;
- remove redundant subtitles when the title and controls already communicate
  the purpose;
- retain necessary state, legal, source-attribution, accessibility, and error
  information.

If removing a sentence still leaves the user able to understand what the
section is and what action they can take, prefer removing it.

This rule applies to all Viewer UI, including Home, Personal Home, song detail,
forum, tools, annual recap, developer, settings, mobile, and desktop screens.
