#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), "utf8");
const exists = (path) => access(resolve(root, path)).then(() => true, () => false);
const generatedTypeCheck = spawnSync(process.execPath, ["scripts/generate_annual_types.mjs", "--check"], { cwd: root, encoding: "utf8" });
assert.equal(generatedTypeCheck.status, 0, generatedTypeCheck.stderr || "generated annual types are stale");

const expectedPages = [
  "opening", "profile", "period", "overview",
  "favorite", "obsession", "favoriteShift", "keyword", "ratingRank",
  "monthly", "weekday", "calendar", "timeOfDay", "lateNight",
  "speedProfile", "nearDondaful", "challenge", "pound", "highScore", "milestones", "breakthrough",
  "final", "poster"
];

const requiredRoutes = [
  "server/api/account/annual-summaries/[key].get.ts",
  "server/api/account/annual-summaries/[key]/build.post.ts",
  "server/api/account/annual-summary-jobs/[jobId].get.ts",
  "server/api/account/annual-summaries/[key]/posters.post.ts",
  "server/api/account/annual-poster-jobs/[jobId].get.ts",
  "server/api/account/annual-summaries/[key]/shares.post.ts",
  "server/api/account/annual-shares/[shareId].patch.ts",
  "server/api/account/annual-shares/[shareId].delete.ts",
  "server/api/annual/shares/[token].get.ts",
  "server/api/admin/annual-summaries/[summaryId]/events.get.ts"
];

for (const route of requiredRoutes) assert.equal(await exists(route), true, `missing route: ${route}`);
assert.equal(await exists("server/api/account/version-summary.get.ts"), false, "legacy schema 3 route still exists");

const registry = await read("composables/useAnnualPages.ts");
const actualPages = [...registry.matchAll(/\{\s*key:\s*"([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(actualPages, expectedPages, "annual page registry order differs from the 23-page contract");

const storyPlayer = await read("components/account/version-summary/StoryPlayer.vue");
const annualBgmSource = await read("utils/annualBgm.client.ts");
const sidebarSource = await read("components/SidebarNav.vue");
assert.equal(/AudioContext|createOscillator|createGain/.test(storyPlayer), false, "runtime synthesized audio remains");
assert.equal(storyPlayer.includes("data:audio/wav;base64,"), true, "local one-shot drum asset is missing");
assert.equal(storyPlayer.includes('v-if="started"'), true, "story controls are visible before the opening start action");
assert.equal(storyPlayer.includes('@start="startStory"'), true, "opening start action is not connected to story navigation");
assert.equal(annualBgmSource.includes('/audio/annual/natsumatsuri-303-old.ogg'), true, "annual BGM is missing");
assert.equal(await exists("public/audio/annual/natsumatsuri-303-old.ogg"), true, "annual BGM asset is missing");
const playBgmSource = storyPlayer.match(/const playBgm = async \(\) => \{[\s\S]*?\n\};/)?.[0] || "";
assert.equal(playBgmSource.includes("props.started"), false, "annual BGM still waits for the opening start action");
assert.equal(storyPlayer.includes('window.addEventListener("pagehide"'), true, "annual BGM is not stopped on page exit");
assert.equal(storyPlayer.includes("onBeforeRouteLeave"), true, "annual BGM has no route-leave cleanup");
assert.equal(storyPlayer.includes("await playBgm();\n  await goToPage"), false, "opening start still triggers a duplicate BGM play request");
assert.equal(annualBgmSource.includes("activeOwner"), true, "annual BGM is not protected by a unique owner");
assert.equal(annualBgmSource.includes("pendingPlay"), true, "annual BGM play requests are not deduplicated");
assert.equal(annualBgmSource.includes("PRIMED_OWNER"), true, "annual BGM cannot be adopted from the navigation gesture");
assert.equal(sidebarSource.includes("primeAnnualBgm()"), true, "annual navigation does not start BGM inside its user gesture");
assert.equal(storyPlayer.includes("debugTransitionTime"), true, "period transition has no development-time freeze control");

const openingSource = await read("components/account/version-summary/slides/OpeningSlide.vue");
const openingCarouselSource = await read("components/account/version-summary/AnnualOpeningCarousel.vue");
const openingFireworksSource = await read("components/account/version-summary/AnnualOpeningFireworks.vue");
const openingBeatLaneSource = await read("components/account/version-summary/AnnualOpeningBeatLane.vue");
assert.equal(openingSource.includes("AnnualOpeningCarousel"), true, "opening cover carousel is missing");
assert.equal(openingSource.includes("AnnualOpeningFireworks"), true, "opening fireworks are missing");
assert.equal(openingSource.includes("AnnualOpeningBeatLane"), true, "opening beat lane is missing");
assert.equal(/emit\(["']start["']\)/.test(openingSource), true, "opening start button is missing");
assert.equal(openingCarouselSource.includes("linear infinite"), true, "opening cover flow is not continuous and linear");
assert.equal(openingCarouselSource.includes("setInterval"), false, "opening cover flow still advances in timed steps");
assert.equal(openingFireworksSource.includes("@keyframes annual-firework-draw"), true, "opening fireworks are not animated");
assert.equal(openingBeatLaneSource.includes("@keyframes annual-beat-scroll"), true, "opening beat lane is not animated");
assert.equal(openingCarouselSource.includes("reducedMotion"), true, "opening carousel ignores reduced motion");
assert.equal(openingFireworksSource.includes("is-still"), true, "opening fireworks ignore reduced motion");
assert.equal(openingBeatLaneSource.includes("is-still"), true, "opening beat lane ignores reduced motion");
const periodMotionSource = await read("components/account/version-summary/slides/PeriodSlide.vue");
const overviewMotionSource = await read("components/account/version-summary/slides/OverviewSlide.vue");
const periodOverviewSceneSource = await read("components/account/version-summary/AnnualPeriodOverviewScene.vue");
const verticalCoverSource = await read("components/account/version-summary/AnnualVerticalCoverStream.vue");
assert.equal(periodMotionSource.includes("AnnualPeriodOverviewScene"), true, "period page does not use the shared transition scene");
assert.equal(overviewMotionSource.includes("AnnualPeriodOverviewScene"), true, "overview page does not use the shared transition scene");
assert.equal(overviewMotionSource.includes("StorySlideShell"), false, "overview page still uses the generic slide shell");
assert.equal(periodOverviewSceneSource.includes("AnnualVerticalCoverStream"), true, "shared period scene has no cover stream");
assert.equal(periodOverviewSceneSource.includes("summary.overview.uniqueSongs"), true, "overview scene is missing the song count");
assert.equal(periodOverviewSceneSource.includes("summary.overview.uniqueCharts"), true, "overview scene is missing the chart count");
assert.equal(periodOverviewSceneSource.includes("summary.overview.estimatedTimeText"), true, "overview scene is missing total play time");
assert.equal(/currentClearCharts|currentFullComboCharts|currentDondafulCharts|currentKiwamiCharts/.test(periodOverviewSceneSource), false, "overview scene still exposes the old achievement grid");
assert.equal(verticalCoverSource.includes("linear infinite"), true, "period cover stream is not continuous and linear");
assert.equal(verticalCoverSource.includes("ZONE_SLOT_COUNT = 6"), true, "period cover stream does not use a gap-free fixed cadence");
assert.equal(verticalCoverSource.includes("vertical-cover-stream__fallback"), true, "period cover stream has no visual fallback plane");
assert.equal(verticalCoverSource.includes("ANNUAL_COVER_PHASE_KEY"), true, "period cover instances do not share one animation phase");
assert.equal(verticalCoverSource.includes("rotateX(72deg) scale(.74)"), true, "lower cover corridor lost its inward perspective");
assert.equal(verticalCoverSource.includes("rotateX(-72deg) scale(.74)"), true, "upper cover corridor lost its inward perspective");
assert.equal(periodOverviewSceneSource.includes("rotationX: 0, scale: 1"), false, "transition still flattens covers into front-facing squares");
assert.equal(/\.to\(upperPlanes,\s*\{[^}]*scale/.test(periodOverviewSceneSource), false, "transition changes upper cover geometry instead of only rotating its face");
assert.equal(/\.to\(lowerPlanes,\s*\{[^}]*scale/.test(periodOverviewSceneSource), false, "transition changes lower cover geometry instead of only rotating its face");
assert.equal(periodOverviewSceneSource.includes("period-overview-scene__previous-planes"), false, "period transition still mounts a separate outgoing cover stream");
assert.equal(periodOverviewSceneSource.includes("period-overview-scene__next-planes"), false, "period transition still mounts a separate incoming cover stream");
assert.equal((periodOverviewSceneSource.match(/<AnnualVerticalCoverStream/g) || []).length, 1, "period transition does not preserve a single cover plane set");
assert.equal(periodOverviewSceneSource.includes('/annual-period-background.webp'), true, "period scene is missing the blue-white image texture");
assert.equal(await exists("public/annual-period-background.webp"), true, "period blue-white image texture is missing");

const zhSource = await read("locales/zh.json");
const jaSource = await read("locales/ja.json");
assert.equal(/虹2025|2025 \/ 版本总结/.test(`${zhSource}\n${jaSource}`), false, "legacy 2025 annual copy remains");
const zh = JSON.parse(zhSource).annualSummary;
const ja = JSON.parse(jaSource).annualSummary;
const annualCopySource = JSON.stringify({ zh, ja });
const implementationCopyPattern = /尚未全良|无不可且良数|读取当前最佳记录|最佳记[录錄]选项画像|站内样本中的参考位置|信赖? Wahlap|可信 Wahlap|固定优先级选择|当前ベスト記録|ベスト記録オプション|サイト内サンプルでの参考位置|信頼できる Wahlap|stage_delta|option_flg|record_updated_at|observed_at|highscore_datetime|MetricStatus|current_archive|version_observed|batch_last_play_proxy|source_highscore_time|schema\s*v?4|快照|排序规则|スナップショット/;
assert.equal(
  implementationCopyPattern.test(annualCopySource),
  false,
  "implementation-oriented copy is exposed in the annual story"
);
for (const [key, placeholder] of [
  ["opening", "{nickname}"], ["favorite", "{favoriteSong}"], ["obsession", "{obsessionDays}"],
  ["weekday", "{topWeekday}"], ["near", "{nearSong}"], ["challenge", "{challengeCount}"],
  ["timeOfDay", "{favoriteHour}"], ["rating", "{ratingSample}"], ["final", "{finalTitle}"]
]) {
  assert.equal(JSON.stringify(zh.copy[key]).includes(placeholder), true, `zh annual copy is not personalized: ${key}`);
  assert.equal(JSON.stringify(ja.copy[key]).includes(placeholder), true, `ja annual copy is not personalized: ${key}`);
}
for (const locale of [zh, ja]) {
  for (const page of expectedPages) assert.equal(typeof locale.pages[page], "string", `missing page locale: ${page}`);
  for (const key of ["renewShare", "revokeShare"]) assert.equal(typeof locale.controls[key], "string", `missing control locale: ${key}`);
  for (const key of ["ready", "renewed", "revoked", "expires", "privacy"]) assert.equal(typeof locale.share[key], "string", `missing share locale: ${key}`);
}

const componentNames = {
  opening: "OpeningSlide", profile: "ProfileSlide", period: "PeriodSlide", overview: "OverviewSlide",
  favorite: "FavoriteSongSlide", obsession: "ObsessionSongSlide", favoriteShift: "FavoriteShiftSlide",
  keyword: "KeywordSlide", ratingRank: "RatingRankSlide", monthly: "MonthlyFavoritesSlide",
  weekday: "WeekdayActivitySlide", calendar: "CalendarActivitySlide", timeOfDay: "TimeOfDaySlide",
  lateNight: "LateNightSlide", speedProfile: "SpeedProfileSlide", nearDondaful: "NearDondafulSlide",
  challenge: "ChallengeSlide", pound: "PoundSlide", highScore: "HighScoreSlide", milestones: "MilestonesSlide",
  breakthrough: "BreakthroughSlide", final: "FinalTitleSlide", poster: "PosterSlide"
};
const annualSources = await Promise.all([
  read("components/account/version-summary/StorySlideShell.vue"),
  read("components/account/version-summary/AnnualPeriodOverviewScene.vue"),
  ...expectedPages.map((page) => read(`components/account/version-summary/slides/${componentNames[page]}.vue`))
]);
for (const source of annualSources) {
  assert.equal(source.includes("虹2025"), false, "legacy 2025 annual component copy remains");
  assert.equal(/#ee7062|rgba\(238,\s*112,\s*98/i.test(source), false, "coral is used outside drum accents");
  for (const match of source.matchAll(/font-size:\s*([0-9.]+)px/gi)) {
    assert.ok(Number(match[1]) >= 10, `annual UI contains sub-10px text: ${match[0]}`);
  }
  for (const match of source.matchAll(/font-size:\s*0\.([0-9]+)rem/gi)) {
    assert.ok(Number(`0.${match[1]}`) * 16 >= 10, `annual UI contains sub-10px text: ${match[0]}`);
  }
}

const breakthroughSource = await read("components/account/version-summary/slides/BreakthroughSlide.vue");
assert.equal(breakthroughSource.includes("summary.breakthrough.evidence"), true, "breakthrough page does not render type-specific evidence");
assert.equal(/summary\.breakthrough\.(scoreDelta|playDelta)/.test(breakthroughSource), false, "breakthrough page still renders unconditional numeric deltas");

assert.equal(periodOverviewSceneSource.includes("summary.period.firstRecordAt || props.summary.version.startDate"), true, "period page exposes an empty first-record placeholder");
assert.equal(periodOverviewSceneSource.includes("summary.period.lastRecordAt || props.summary.version.effectiveEndDate"), true, "period page exposes an empty last-record placeholder");
assert.equal(periodOverviewSceneSource.includes("summary.copy.period.body"), true, "period page lacks its period narrative");

const finalTitleSource = await read("components/account/version-summary/slides/FinalTitleSlide.vue");
assert.equal(finalTitleSource.includes("AnnualDrumWindow"), true, "final title page does not carry the player's MyDon");
assert.equal(finalTitleSource.includes("summary.finalTitle.evidenceText"), true, "final title evidence is not shown");
assert.equal(finalTitleSource.includes("summary.poster.keyword"), false, "final title page still exposes an unavailable keyword placeholder");

const drumWindowSource = await read("components/account/version-summary/AnnualDrumWindow.vue");
assert.equal(drumWindowSource.includes('@error="imageFailed = true"'), true, "drum artwork has no failed-image fallback");
assert.equal(drumWindowSource.includes("AnnualArtworkFallback"), true, "drum artwork fallback is not visual");
for (const component of ["MonthlyFavoritesSlide", "FavoriteShiftSlide", "LateNightSlide", "MilestonesSlide"]) {
  const source = await read(`components/account/version-summary/slides/${component}.vue`);
  assert.equal(source.includes("#error"), true, `${component} has no cover failure fallback`);
}

const posterSlideSource = await read("components/account/version-summary/slides/PosterSlide.vue");
assert.equal(posterSlideSource.includes("createShareAndPoster"), false, "share creation and poster rendering are still one action");
assert.equal(posterSlideSource.includes("const createShare ="), true, "share creation action is missing");
assert.equal(posterSlideSource.includes("const generatePoster ="), true, "poster generation action is missing");
assert.equal(/downloadPoster\(\).*downloadFallback|downloadPoster\(\)\) ElMessage\.success\(t\("annualSummary\.share\.downloadFallback"\)\)/s.test(posterSlideSource), true, "Web Share has no PNG download fallback");
for (const match of posterSlideSource.matchAll(/min-height:\s*([0-9.]+)px/gi)) {
  assert.ok(Number(match[1]) >= 44, `poster action is shorter than 44px: ${match[0]}`);
}

const annualPageSource = await read("pages/account/version-summary.vue");
assert.equal(annualPageSource.includes("jobStatus.status"), false, "raw annual job status is exposed to users");
assert.equal(annualPageSource.includes("jobStatusLabel"), true, "localized annual job status is missing");
assert.equal(/个良/.test(JSON.stringify(zh.annualSummary || zh)), false, "near-dondaful copy uses the wrong Chinese judgment");
assert.equal(/鼓点|鼓槌|あと可/.test(JSON.stringify(ja)), false, "Japanese annual copy contains mixed-language judgment or instrument terms");
assert.equal(annualPageSource.includes("const storyStarted = ref(false)"), true, "opening is bypassed before the user starts");
assert.equal(annualPageSource.includes("AnnualBuildPrelude"), true, "annual build prelude is missing");
assert.equal(annualPageSource.includes("void buildSummary()"), true, "missing annual summary is not built automatically");
assert.equal(annualPageSource.includes("重新生成"), false, "successful annual summary still exposes rebuild copy");

const annualConstantsSource = await read("server/services/account/annual-summary/constants.ts");
assert.equal(annualConstantsSource.includes('ANNUAL_END_DATE = "2026-10-01"'), true, "annual end date is not fixed");
assert.equal(annualConstantsSource.includes('ANNUAL_PUBLIC_OPEN_AT = "2026-10-02T00:00:00+08:00"'), true, "annual public opening is not configured");
const annualRuntimeSource = await read("server/services/account/annual-summary/runtime.ts");
const annualRatingsSource = await read("server/services/account/annual-summary/ratings.ts");
assert.equal(annualRatingsSource.includes("getAnnualRatingDistribution"), true, "annual rating enrichment does not use the cache reader");
assert.equal(annualRuntimeSource.includes("export const getAnnualRatingDistribution = readCachedAnnualRatingDistribution"), true, "user rating lookup can rebuild the distribution");

const schema = JSON.parse(await read("../../schemas/annual-summary-v4.schema.json"));
assert.equal(schema.properties.schemaVersion.const, 4);
assert.ok(schema.required.includes("provenance"));
assert.ok(schema.$defs.annualObservationEvent.required.includes("timePrecision"));

const deprecatedSources = [
  await read("server/services/account/annual-summary/index.ts"),
  await read("utils/annualSummary.ts"),
  registry
].join("\n");
assert.equal(/schemaVersion\s*[:=]\s*3\b/.test(deprecatedSources), false, "schema 3 compatibility remains");

process.stdout.write(JSON.stringify({ ok: true, pageCount: actualPages.length, locales: ["zh", "ja"], schemaVersion: 4 }) + "\n");
