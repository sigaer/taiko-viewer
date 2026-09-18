## Execution Policy Override — 2026-09-10

Latest user instruction overrides historical execution/testing/deployment restrictions below; product definitions and Phase boundaries remain unchanged.

- Real business behavior first. Phase B-0 = PASS; DB Isolation = PASS; BLOCKED_PENDING_DB_ISOLATION = RESOLVED. Do not restart B-0 or require REFERENCES/fixtures/full staging.
- Continue existing Phase B code in the feature worktree. Verify real authenticated POST/GET, nonce retries, sanitize, rate limit, hidden, Poster immediate append/reload and moving barrage; Forum thread delta must remain zero.
- Each Phase may release independently after its product Gate is ready. For Phase B: audit changes, bump minor version, create release commit, integrate into main, then use only scripts/deploy_forum_web.sh with the HEAD subject. No manual push, output replacement or restart; stop if the script fails.
- Before release, mutations use the isolated test DB with SELECT DATABASE() and explicit mutation opt-in. After release, authorized real online smoke verifies the product; ordinary bugs are fixed forward. Final Gate B PASS follows online smoke.
- Only the final integration agent deploys. No Phase C/D work during Phase B. Existing historical no-deploy/feature-only/exhaustive-test rules do not override this policy.

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

## Annual Poster Community Collaboration

All Agents participating in the annual Poster community project must read, before modifying code:

1. `docs/annual-poster-community-plan.md`
2. `docs/annual-poster-community-status.md`
3. the latest relevant handoff in `docs/annual-poster-community-handoffs.md`
4. `git status` and `git diff`

The status file is authoritative for the current Phase and Gate. Do not infer phase completion merely because code exists. A Gate that is not explicitly `PASS` forbids entering the next Phase. Locked Decisions must not be reopened or changed without Coordinator approval. Only one write Agent may modify an implementation area at a time; other Agents are read-only audit/QA by default. Child Agents may not deploy. Only the final integration Agent may deploy, and Viewer deployment must use `scripts/deploy_forum_web.sh "<HEAD subject>"`; if the deployment script fails, stop without fallback. Ordinary Viewer/UI work must not modify `deploy_forum_web.sh` unless explicitly requested by the user.

For annual Poster Phase B–F integration or migration tests, never connect to production DB. Mutating tests must require an actual `SELECT DATABASE()` result ending in `_test` and explicit `TAIKO_ALLOW_TEST_DB_MUTATION=1`; an environment variable name alone is not proof of safety. Do not copy production data into test databases, and treat any production write as a Gate blocker. Test secrets remain outside Git, status/handoff documents and shell-visible command text.

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

## Memory safety for development and validation

- Read `docs/memory-engineering-guidelines.md` before new browser/large-data QA.
- Run ad-hoc QA through `bash scripts/memory/run_qa.sh <absolute-command> [args...]`; isolation failure is not permission to run unbounded. Keep standard deploy procedure unchanged and do not overlap QA with builds.
- Never deep-assert Buffers or large binary arrays. Use streaming file hashes or `Buffer.equals()` with a short boolean failure; no binary dump/diff/stringification.
- Bound browser/page/worker concurrency, total runtime and logs; close pages/contexts/browser in finally. Temporary dev servers must be cleaned up at task end and child/listener exit verified.
- Store large artifacts on disk-backed `/var/tmp`, not tmpfs `/tmp`. No unreviewed heap dumps, cache purges, swapoff or broad process killing.
