# Viewer 1.9.0 — Forum discovery and player identity

Baseline: `40601208` (1.8.2). Release scope is Viewer only. No schema, Flutter,
posting/upload/permission, annual sync, or global SongCoverImage default changes.

## Implementation

| Area | Files | Behavior |
| --- | --- | --- |
| Associated song | `taiko_viewer/components/forum/ForumThreadCard.vue` | Dedicated SongCoverImage root class with explicit width/height/flex basis: 56px through 900px; 60px from 901px. The parent selector outranks the child's 100% rule regardless of CSS load order. `fit=cover`, two-line localized title, compact metadata, reduced padding/background, locale-aware song detail link. Same rules for compact and regular cards. Shared image loader/fallback is unchanged. |
| Section discovery | `components/forum/ThreadListPage.vue`, `utils/forumListQuery.ts`, `locales/zh.json`, `locales/ja.json` under `taiko_viewer` | API-derived section options, localized names and All sections. Dialog is draft-only; Apply writes the URL and resets page. Pagination/history preserve filters. Fixed route section takes precedence. Compose reads only applied filters. |
| Player titles | `taiko_viewer/components/forum/ForumUserBadge.vue`, `taiko_viewer/pages/forum/thread/[id].vue` | Shared compact single-line title below name/role; minimal hides ID while retaining title. Used by home/list cards, thread author, floors and replies. Missing titles create no label. |
| Release | `taiko_viewer/package.json`, `taiko_viewer/package-lock.json` | Minor feature release 1.9.0. Version projection continues to use package metadata; no numeric fallback exists to update. |

Title authority remains `loadBadgeMap()` in
`taiko_viewer/server/internal/forum/shared.ts`: left join
`web_taiko_bindings` with `b.is_current=1`, selecting `verified_title` and
`verified_titleplate_id`. The UI renders only `verifiedTitle`; it neither renders
the numeric plate ID nor constructs titleplate image URLs. No new DTO/API fields.

## URL/request contract

Example all-thread URL:
`/forum/discussions?sectionSlug=score-guides&keyword=Discovery&sort=hot&threadType=guide&difficultyType=5`.
The list GET preserves these fields and adds `page=1&pageSize=12` (plus an existing
songId when supplied). Pagination uses `page=2` with the same filters. Clearing
section removes `sectionSlug`. Compose becomes `/forum/new?section=score-guides`
and retains existing song/difficulty context. On
`/forum/section/general?sectionSlug=official`, both GET and compose use `general`.

Slug normalization accepts up to 64 lowercase ASCII letters/digits, underscores
or hyphens, beginning with a letter/digit. Invalid/oversized values are rejected
as empty rather than truncated into a different section. Well-formed unknown
slugs are handled by the existing parameterized backend query.

## Verification and evidence

- Pure URL/resource, locale, notification, title and version regression lives in
  the existing forum tests. Added section normalization, filter round-trip and
  page-clamping coverage, plus the new zh/ja control keys.
- Actual H3/MySQL HTTP chain passed in QA run `qa-c0220b59a550`.
  `SELECT DATABASE()` proved `viewer_community_core_test`; datadir ownership and
  explicit mutation opt-in were checked. Current binding titles were verified in
  home/list/thread/floor/reply DTOs, then reread after binding switch and unbind.
  Production connections/writes: zero. Private daemon exited.
- `taiko_viewer/scripts/verify_forum_discovery.mjs` exercises the actual Vue SFCs,
  Vue Router, Element Plus and production forum resource logic with controlled
  Nuxt data/SEO ports in `tests/fixtures/forumDiscoveryBrowserRuntime.mjs`.
  This component environment is not an SSR or real online acceptance test.
  The opt-in Nuxt preview also exposes the fixtures for manual review. Fixtures are
  confined to `preview/song-detail`: long zh/ja songs/titles, titleless users,
  original-cover fallback and exhausted fallback/placeholder. It measures
  390/414/1440px × zh/ja × light/dark × compact/regular and exercises every API
  section, draft cancellation/application, combinations, paging/history,
  fixed-section precedence, compose context, and author/floor/reply rendering.
- Completed browser run `qa-a9076aba7267`: **24/24** layout cases passed, plus
  both language filter/identity workflows. All nine API sections selectable,
  draft edits made zero list requests, history/paging/compose/fixed-section
  precedence passed. All measured covers were exactly **56×56** at 390/414px and
  **60×60** at 1440px. Original fallback, exhausted fallback/placeholder, titleless
  users and three detail author positions passed; zero browser errors. Reviewed
  mobile Japanese dark and desktop Chinese light screenshots. The listener on
  3208 exited. Resource details are in `browser-resources.json` beside the report.
- The broad existing `forumI18n.test.mjs` has two baseline failures in unrelated
  `home.growth.planTitle` expectations. Both baseline locale values were checked
  with `git show 40601208:...`; this release leaves that existing copy untouched.
  Run `qa-a21c5fc0c871` completed with **32 passed / 2 existing failures** across
  query/resource, translations, notification polling, thread title and version
  tests. There were no failures in the changed query/resource behavior or new
  translation keys.
- Online acceptance must use
  `taiko_viewer/scripts/verify_forum_discovery_online.mjs` after release. It reads
  real public APIs/pages with no response substitution, checks version, covers,
  API-derived localized options, apply/clear behavior and compose context, and
  compares a real titled author's DTO with the thread UI when such an author is
  present. Its evidence is separate from synthetic preview screenshots.

All QA uses `scripts/memory/run_qa.sh`; evidence is retained under the private
QA vault run's `evidence/` directory, including the runner manifest. Release uses
only `scripts/memory/run_build.sh /bin/bash scripts/deploy_forum_web.sh "<HEAD subject>"`.
