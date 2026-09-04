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
  "opening", "period", "overview",
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
assert.deepEqual(actualPages, expectedPages, "annual page registry order differs from the 22-page contract");
const registryEntries = [...registry.matchAll(/\{\s*key:\s*"([^"]+)"[^\n]*\}/g)];
assert.equal(registryEntries.length, expectedPages.length, "annual page registry entries are not statically inspectable");
for (const [entry, page] of registryEntries) {
  for (const field of ["sceneType", "mainFocus", "motionPreset", "mood", "intensity"]) {
    assert.equal(entry.includes(`${field}:`), true, `${page} is missing scene metadata: ${field}`);
  }
}
assert.equal(registry.includes('"profile-stage"'), true, "profile-stage is missing from AnnualSceneMood");
assert.equal(registry.includes("bgMood:"), false, "legacy bgMood remains in the annual page registry");

const storyPlayer = await read("components/account/version-summary/StoryPlayer.vue");
const clickLoveSource = await read("plugins/clicklove.client.js");
const annualPage = await read("pages/account/version-summary.vue");
const annualSceneSource = await read("components/account/version-summary/AnnualScene.vue");
const storySlideShellSource = await read("components/account/version-summary/StorySlideShell.vue");
const annualTimelineSource = await read("composables/useAnnualTimeline.ts");
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
assert.equal(annualBgmSource.includes("preloadAnnualBgm"), true, "annual BGM has no route-level preload helper");
assert.equal(annualPage.includes('rel: "preload"'), true, "annual opening assets are not declared as route preloads");
for (const asset of ["/title.png", "/friend.png", "/to_end.png", "/icon.png"]) {
  assert.equal(annualPage.includes(`href: "${asset}"`), true, `annual opening asset is not preloaded: ${asset}`);
}
assert.equal(annualPage.includes("preloadAnnualBgm()"), true, "annual route does not warm the BGM resource");
assert.equal(sidebarSource.includes("primeAnnualBgm()"), true, "annual navigation does not start BGM inside its user gesture");
assert.equal(storyPlayer.includes("debugTransitionTime"), true, "period transition has no development-time freeze control");
for (const layer of ["background", "atmosphere", "visual", "data", "copy", "transition"]) {
  assert.equal(annualSceneSource.includes(`data-layer="${layer}"`), true, `AnnualScene is missing the ${layer} layer`);
}
assert.equal(annualSceneSource.includes('<slot name="transition" />'), true, "AnnualScene has no transition slot");
assert.equal(storySlideShellSource.includes('<slot name="transition" />'), true, "StorySlideShell does not forward the transition slot");
for (const binding of ["sceneType", "mainFocus", "motionPreset", "mood", "intensity"]) {
  assert.equal(storyPlayer.includes(`slide.${binding}`), true, `StoryPlayer does not expose ${binding}`);
}
assert.equal(annualTimelineSource.includes("gsap.context"), true, "annual page timelines are not scoped to a GSAP context");
assert.equal(annualTimelineSource.includes("context?.revert()"), true, "annual page timeline context is not reverted");
for (const lifecycleApi of ["requestFrame", "setTimeout", "setInterval", "listen", "onCleanup"]) {
  assert.equal(annualTimelineSource.includes(lifecycleApi), true, `annual motion scope is missing ${lifecycleApi}`);
}
assert.equal(annualTimelineSource.includes("onAnnualMotionActive"), true, "annual motion scope is not exposed to scene pages");
assert.equal(annualSceneSource.includes("data-motion-state"), true, "AnnualScene does not expose its motion lifecycle state");
assert.equal(annualSceneSource.includes("animation: none !important"), true, "AnnualScene reduced motion does not use a stable CSS state");
assert.equal(annualSceneSource.includes("animation-duration: 1ms"), false, "AnnualScene still depends on synthetic 1ms animation completion");
assert.equal(storyPlayer.includes("transitionWatchdog"), true, "period-to-overview navigation has no completion watchdog");
assert.equal(clickLoveSource.includes('closest(".story-player, .annual-page")'), true, "global click hearts still leak celebration effects into annual story scenes");
assert.equal(storyPlayer.includes("settleTransitionMotion"), true, "period-to-overview transition has no deterministic settle path");
assert.equal(storyPlayer.includes(":active=\"documentVisible && activeIndex === index\""), true, "background scenes remain active while the document is hidden");
assert.equal(storyPlayer.includes("stopCoverClock()"), true, "the annual cover RAF has no shared stop path");
assert.equal(storyPlayer.includes("PERIOD_OVERVIEW_DURATION_MS / 1000"), true, "period-to-overview no longer uses the transitionTime duration contract");

const openingSource = await read("components/account/version-summary/slides/OpeningSlide.vue");
const profileSource = await read("components/account/version-summary/slides/ProfileSlide.vue");
const openingCarouselSource = await read("components/account/version-summary/AnnualOpeningCarousel.vue");
const openingFireworksSource = await read("components/account/version-summary/AnnualOpeningFireworks.vue");
const openingBeatLaneSource = await read("components/account/version-summary/AnnualOpeningBeatLane.vue");
assert.equal(openingSource.includes("AnnualOpeningCarousel"), true, "opening cover carousel is missing");
assert.equal(openingSource.includes("AnnualOpeningFireworks"), true, "opening fireworks are missing");
assert.equal(openingSource.includes("AnnualOpeningBeatLane"), true, "opening beat lane is missing");
assert.equal(/emit\(["']start["']\)/.test(openingSource), true, "opening start button is missing");
for (const [source, page] of [[openingSource, "opening"], [profileSource, "profile"]]) {
  assert.equal(source.includes("<AnnualScene"), true, `${page} is not mounted as an AnnualScene`);
  for (const layer of ["background", "atmosphere", "visual", "data", "copy", "transition"]) {
    assert.equal(source.includes(`<template #${layer}>`), true, `${page} does not use the ${layer} scene layer`);
  }
  assert.equal(source.includes("useAnnualTimeline"), true, `${page} does not use the annual motion lifecycle`);
}
assert.equal(openingSource.includes("annual-opening__report"), false, "opening still contains the report-style lower panel");
assert.equal(openingSource.includes("motionScope?.setTimeout"), true, "opening navigation watchdog is outside the annual motion lifecycle");
assert.equal(profileSource.includes("StorySlideShell"), false, "profile still uses the report-style slide shell");
assert.equal(profileSource.includes("<article"), false, "profile still renders fact cards as its primary structure");
assert.equal(profileSource.includes('mood="profile-stage"'), true, "profile does not use its independent stage mood");
for (const signature of ["profile-spotlight-open", "profile-portrait-develop", "profile-ribbon-unfurl", "profile-badge-light"]) {
  assert.equal(profileSource.includes(signature), true, `profile is missing motion signature: ${signature}`);
}
assert.equal(registry.includes('key: "profile"'), false, "profile remains registered in the annual story flow");
assert.equal(/import\s+ProfileSlide\b/.test(registry), false, "unused ProfileSlide import remains in the annual registry");
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
assert.equal(periodOverviewSceneSource.includes("summary.overview.uniqueSongs"), false, "overview scene still renders the song count");
assert.equal(periodOverviewSceneSource.includes("summary.overview.uniqueCharts"), false, "overview scene still renders the chart count");
assert.equal(periodOverviewSceneSource.includes("summary.overview.estimatedTimeText"), true, "overview scene is missing total play time");
assert.equal(/currentClearCharts|currentFullComboCharts|currentDondafulCharts|currentKiwamiCharts/.test(periodOverviewSceneSource), false, "overview scene still exposes the old achievement grid");
assert.equal(verticalCoverSource.includes("linear infinite"), true, "period cover stream is not continuous and linear");
assert.equal(verticalCoverSource.includes("ZONE_SLOT_COUNT = 6"), true, "period cover stream does not use a gap-free fixed cadence");
assert.equal(verticalCoverSource.includes("49.95%"), true, "period cover stream no longer keeps the 0.46.11 three-plane cadence");
assert.equal((verticalCoverSource.match(/50%, 100%/g) || []).length, 2, "upper and lower cover streams do not remain visible for half a cycle");
assert.equal(verticalCoverSource.includes("vertical-cover-stream__fallback"), true, "period cover stream has no visual fallback plane");
assert.equal(verticalCoverSource.includes("ANNUAL_COVER_PHASE_KEY"), true, "period cover instances do not share one animation phase");
assert.equal(verticalCoverSource.includes("rotateX(72deg) scale(.74)"), true, "lower cover corridor lost its inward perspective");
assert.equal(verticalCoverSource.includes("rotateX(-72deg) scale(.74)"), true, "upper cover corridor lost its inward perspective");
assert.equal(periodOverviewSceneSource.includes("rotationZ: 0"), true, "transition does not start from the 0.46.11 cover orientation");
assert.equal((periodOverviewSceneSource.match(/rotationZ:\s*45/g) || []).length, 2, "cover faces do not rotate 45 degrees into a diamond");
assert.equal(/\.to\((?:upper|lower)Planes,\s*\{[^}]*rotationX/.test(periodOverviewSceneSource), false, "transition still compresses cover height with an X-axis rotation");
assert.equal(/\.to\(upperPlanes,\s*\{[^}]*scale/.test(periodOverviewSceneSource), false, "transition changes upper cover geometry instead of only rotating its face");
assert.equal(/\.to\(lowerPlanes,\s*\{[^}]*scale/.test(periodOverviewSceneSource), false, "transition changes lower cover geometry instead of only rotating its face");
assert.equal(periodOverviewSceneSource.includes("period-overview-scene__previous-planes"), false, "period transition still mounts a separate outgoing cover stream");
assert.equal(periodOverviewSceneSource.includes("period-overview-scene__next-planes"), false, "period transition still mounts a separate incoming cover stream");
assert.equal((periodOverviewSceneSource.match(/<AnnualVerticalCoverStream/g) || []).length, 1, "period transition does not preserve a single cover plane set");
assert.equal(periodOverviewSceneSource.includes('/蓝色白色背景图.png'), true, "period scene is missing the provided blue-white backdrop");
assert.equal(periodOverviewSceneSource.includes('data-visual-style="light-memory-tunnel"'), true, "period scene does not declare the light memory tunnel style");
assert.equal(periodOverviewSceneSource.includes('const mascotUrl = "/dance.gif"'), true, "period scene is missing the dancing pixel mascot");
assert.equal(periodOverviewSceneSource.includes("width: min(84vw, 352px)"), true, "period reduced state lost the reference cover width");
assert.equal(periodOverviewSceneSource.includes("rotateX(-80deg)"), true, "period reduced state lost the upper reference pitch");
assert.equal(periodOverviewSceneSource.includes("rotateX(80deg)"), true, "period reduced state lost the lower reference pitch");
for (const stageToken of ["--memory-white", "--memory-blue", "--memory-violet", "--memory-ink"]) {
  assert.equal(periodOverviewSceneSource.includes(stageToken), true, `period scene is missing memory tunnel token: ${stageToken}`);
}
assert.equal(await exists("public/蓝色白色背景图.png"), true, "period blue-white backdrop is missing");
assert.equal(await exists("public/dance.gif"), true, "period dancing pixel mascot is missing");

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
  for (const key of ["title", "primary", "longest", "emotionLine1", "emotionLine2", "footnote", "month", "monthSummary", "datePlayCount"]) {
    assert.equal(typeof locale.slides.calendar[key], "string", `missing calendar locale: ${key}`);
  }
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
  read("components/account/version-summary/AnnualCalendarScene.vue"),
  read("components/account/version-summary/AnnualMonthDotGrid.vue"),
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

const calendarSlideSource = await read("components/account/version-summary/slides/CalendarActivitySlide.vue");
const annualCalendarSource = await read("components/account/version-summary/AnnualCalendarScene.vue");
const annualMonthDotGridSource = await read("components/account/version-summary/AnnualMonthDotGrid.vue");
assert.equal(calendarSlideSource.includes("AnnualCalendarScene"), true, "calendar page does not use its dedicated annual scene");
assert.equal(calendarSlideSource.includes('v-if="summary.calendarActivity"'), true, "calendar page lost its availability guard");
assert.equal(calendarSlideSource.includes("StorySlideShell"), false, "calendar page still uses the dashboard slide shell");
assert.equal(annualCalendarSource.includes('/蓝色白色背景图.png'), true, "calendar scene is missing the provided blue-white backdrop");
assert.equal(annualCalendarSource.includes("Calendar.png"), false, "calendar reference image is used by the implementation");
assert.equal(annualCalendarSource.includes("useAnnualTimeline"), true, "calendar scene does not use the annual motion lifecycle");
assert.equal(annualCalendarSource.includes("repeat(3, minmax(0, 1fr))"), true, "calendar scene is not a three-column month grid");
assert.equal(annualCalendarSource.includes("repeat(4, minmax(0, 1fr))"), true, "calendar scene is not a four-row month grid");
assert.equal(annualMonthDotGridSource.includes("repeat(7, minmax(0, 1fr))"), true, "calendar month is not a seven-column dot grid");
assert.equal(annualMonthDotGridSource.includes("while (output.length < 42)"), true, "calendar month does not preserve stable six-week geometry");

const weekdaySlideSource = await read("components/account/version-summary/slides/WeekdayActivitySlide.vue");
const weekdayForestSource = await read("components/account/version-summary/AnnualWeekdayForestScene.vue");
assert.equal(weekdaySlideSource.includes("AnnualWeekdayForestScene"), true, "weekday page does not use its dedicated forest scene");
assert.equal(weekdaySlideSource.includes('v-if="summary.weekdayActivity"'), true, "weekday page lost its availability guard");
assert.equal(weekdaySlideSource.includes("StorySlideShell"), false, "weekday page still uses the dashboard slide shell");
assert.equal(weekdayForestSource.includes("useAnnualTimeline"), true, "weekday forest scene does not use the annual motion lifecycle");
assert.equal(weekdayForestSource.includes('/weekday/backgorund_12.png'), true, "weekday forest scene is missing the provided watercolor backdrop");
assert.equal(weekdayForestSource.includes("aspect-ratio:853/1844"), true, "weekday overlays no longer share the backdrop aspect ratio");
assert.equal(weekdayForestSource.includes("height:max(100%,216.18vw)"), true, "weekday overlay coordinates no longer follow the cover-scaled backdrop");
assert.equal(weekdayForestSource.includes("Math.round(count / maxCount.value * 6)"), true, "weekday icons no longer express relative activity");
assert.equal(weekdayForestSource.includes("slice(0, 5)"), true, "weekday workday traits are not derived from Monday through Friday");
assert.equal(weekdayForestSource.includes("slice(5)"), true, "weekday weekend traits are not derived from Saturday and Sunday");
for (const asset of ["002", "036", "038", "006", "010", "023", "034"]) {
  assert.equal(await exists(`public/weekday/${asset}_key.png`), true, `weekday icon asset is missing: ${asset}_key.png`);
}
assert.equal(await exists("public/weekday/backgorund_12.png"), true, "weekday watercolor backdrop is missing");

const obsessionSlideSource = await read("components/account/version-summary/slides/ObsessionSongSlide.vue");
const obsessionSceneSource = await read("components/account/version-summary/AnnualObsessionGreenEchoScene.vue");
const obsessionCoverSource = await read("components/account/version-summary/AnnualObsessionCoverBlock.vue");
assert.equal(obsessionSlideSource.includes("AnnualObsessionGreenEchoScene"), true, "obsession page does not use its dedicated green echo scene");
assert.equal(obsessionSlideSource.includes('new Intl.NumberFormat("zh-CN")'), true, "obsession metrics are not formatted for Chinese");
assert.equal(obsessionSlideSource.includes('"这首歌"'), true, "obsession song has no safe Chinese fallback");
assert.equal(obsessionSlideSource.includes("StorySlideShell"), false, "obsession page still uses the dashboard slide shell");
assert.equal(obsessionSlideSource.includes("obsession-slide__metrics"), false, "obsession page still renders metric cards");
assert.equal(obsessionSlideSource.includes("obsession-slide__echoes"), false, "obsession page still renders echo dots");
assert.equal(obsessionSceneSource.includes("useAnnualTimeline"), true, "obsession scene does not use the annual motion lifecycle");
assert.equal(obsessionSceneSource.includes("saveData"), true, "obsession scene does not reduce motion for save-data mode");
assert.equal(obsessionSceneSource.includes('/obsession/background_6.png'), true, "obsession scene is missing the green watercolor backdrop");
assert.equal(obsessionSceneSource.includes("2025版本报告-N6-效果图-v1.0.png"), false, "obsession reference image is used by the implementation");
assert.equal(obsessionSceneSource.includes("cover_bg.png"), false, "obsession example cover is used by the implementation");
assert.equal(obsessionCoverSource.includes(":src=\"coverUrl\""), true, "obsession cover is not rendered from live song data");
assert.equal(obsessionCoverSource.includes("AnnualArtworkFallback"), true, "obsession cover has no visual fallback");
for (const asset of ["2025版本报告-N6-效果图-v1.0.png", "background_6.png", "cover_bg.png"]) {
  assert.equal(await exists(`public/obsession/${asset}`), true, `obsession asset is missing: ${asset}`);
}

const lateNightSlideSource = await read("components/account/version-summary/slides/LateNightSlide.vue");
const lateNightSceneSource = await read("components/account/version-summary/AnnualLateNightFireworksScene.vue");
assert.equal(lateNightSlideSource.includes("AnnualLateNightFireworksScene"), true, "late-night page does not use its dedicated fireworks scene");
assert.equal(lateNightSlideSource.includes('v-if="summary.lateNight"'), true, "late-night page lost its availability guard");
assert.equal(lateNightSlideSource.includes("StorySlideShell"), false, "late-night page still uses the dashboard slide shell");
assert.equal(lateNightSlideSource.includes('new Intl.NumberFormat("zh-CN")'), true, "late-night metrics are not formatted for Chinese");
assert.equal(lateNightSlideSource.includes('"某个深夜"'), true, "late-night time has no safe Chinese fallback");
assert.equal(lateNightSlideSource.includes('"这首歌"'), true, "late-night song has no safe Chinese fallback");
assert.equal(lateNightSceneSource.includes("useAnnualTimeline"), true, "late-night scene does not use the annual motion lifecycle");
assert.equal(lateNightSceneSource.includes("saveData"), true, "late-night scene does not reduce motion for save-data mode");
assert.equal(lateNightSceneSource.includes('/lateNight/background_14.png'), true, "late-night scene is missing the fireworks backdrop");
assert.equal(lateNightSceneSource.includes('/lateNight/cover_bg_14.png'), true, "late-night scene is missing the transparent cover frame");
assert.equal(lateNightSceneSource.includes("2025版本报告-N14-效果图-v1.0.png"), false, "late-night reference image is used by the implementation");
assert.equal(lateNightSceneSource.includes("陪你到深夜"), true, "late-night scene is missing its fixed Chinese memory line");
for (const asset of ["2025版本报告-N14-效果图-v1.0.png", "background_14.png", "cover_bg_14.png"]) {
  assert.equal(await exists(`public/lateNight/${asset}`), true, `late-night asset is missing: ${asset}`);
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
assert.equal(finalTitleSource.includes("segmentAnnualTitle"), true, "final title is not revealed by grapheme");
assert.equal(finalTitleSource.includes("isUsableMetric"), true, "final title still renders zero-valued metrics");

const animatedNumberSource = await read("components/account/version-summary/AnimatedNumber.vue");
assert.equal(animatedNumberSource.includes('emit("complete", target)'), true, "animated number has no completion feedback event");
assert.equal(animatedNumberSource.includes("completedForValue"), true, "animated number completion can fire more than once");
const favoriteSource = await read("components/account/version-summary/slides/FavoriteSongSlide.vue");
const favoriteCountRingSource = await read("components/account/version-summary/FavoriteSongPlayCountRing.vue");
const favoriteOrbitSource = await read("components/account/version-summary/FavoriteSongOrbitDecor.vue");
const favoriteClosingSource = await read("components/account/version-summary/FavoriteSongMemoryCopy.vue");
assert.equal(favoriteCountRingSource.includes("AnimatedNumber"), true, "favorite song count ring does not use the shared counter");
assert.equal(favoriteSource.includes("hasPlayCount"), true, "favorite song does not hide an unavailable play count");
assert.equal(favoriteSource.includes("songNoText"), true, "favorite song does not guard an unavailable song number");
assert.equal(favoriteOrbitSource.includes("favorite-song-orbit__guide-line"), true, "favorite song lacks its cover-to-count guide line");
assert.equal(favoriteClosingSource.includes("<em>鼓点</em>"), true, "favorite song closing copy lacks its rhythmic accent");
for (const [component, guard] of [["RatingRankSlide", "hasPosition"], ["SpeedProfileSlide", "isUsableMetric(summary.speedProfile.chartCount)"]]) {
  const source = await read(`components/account/version-summary/slides/${component}.vue`);
  assert.equal(source.includes(guard), true, `${component} does not suppress its empty statistic card`);
}
const keywordSigilSource = await read("components/account/version-summary/AnnualKeywordSigilScene.vue");
assert.equal(keywordSigilSource.includes("radarEntries.length >= 3"), true, "keyword sigil does not suppress an incomplete radar shape");
assert.equal(keywordSigilSource.includes("useAnnualTimeline"), true, "keyword sigil does not use the annual motion lifecycle");
assert.equal(keywordSigilSource.includes("StorySlideShell"), false, "keyword sigil still uses the report-style slide shell");

const drumWindowSource = await read("components/account/version-summary/AnnualDrumWindow.vue");
assert.equal(drumWindowSource.includes('@error="imageFailed = true"'), true, "drum artwork has no failed-image fallback");
assert.equal(drumWindowSource.includes("AnnualArtworkFallback"), true, "drum artwork fallback is not visual");
const growthSongStageSource = await read("components/account/version-summary/AnnualGrowthSongStage.vue");
const profileStageFrameSource = await read("components/account/version-summary/AnnualProfileStageFrame.vue");
const growthMotionSource = await read("utils/annualGrowthMotion.ts");
const nearDondafulSource = await read("components/account/version-summary/slides/NearDondafulSlide.vue");
const challengeSource = await read("components/account/version-summary/slides/ChallengeSlide.vue");
for (const [source, page] of [[nearDondafulSource, "nearDondaful"], [challengeSource, "challenge"]]) {
  assert.equal(source.includes("AnnualGrowthSongStage"), true, `${page} does not use the shared growth song stage`);
  assert.equal(source.includes("AnnualProfileStageFrame"), true, `${page} does not use the transplanted profile stage frame`);
  assert.equal(source.includes("StorySlideShell"), false, `${page} still uses the report-style slide shell`);
  assert.equal(source.includes("saveData"), true, `${page} does not reduce effects for save-data mode`);
}
assert.equal(growthSongStageSource.includes("AnnualArtworkFallback"), true, "growth song stage has no visual fallback");
assert.equal(growthSongStageSource.includes('tone?: "near" | "challenge"'), true, "growth song stage does not distinguish its two tones");
for (const slot of ["header", "center", "primary-panel", "secondary-panel", "footer"]) {
  assert.equal(profileStageFrameSource.includes(`name="${slot}"`), true, `profile stage frame is missing ${slot} slot`);
}
assert.equal(profileStageFrameSource.includes("useAnnualTimeline"), true, "profile stage frame does not use the annual motion lifecycle");
assert.equal(profileStageFrameSource.includes("createAnnualGrowthTimeline"), true, "profile stage frame does not use the dedicated growth choreography module");
for (const anchorToken of ["--stage-center-x", "--stage-top", "--stage-size", "--main-panel-top", "--secondary-panel-top", "--footer-copy-bottom"]) {
  assert.equal(profileStageFrameSource.includes(anchorToken), true, `profile stage frame is missing shared anchor token: ${anchorToken}`);
}
assert.equal(profileStageFrameSource.includes("annual-profile-stage__stage-slot"), true, "growth stage has no stable positioning wrapper");
assert.equal(profileStageFrameSource.includes("annual-profile-stage__stage-motion"), true, "growth stage has no isolated motion wrapper");
assert.equal(growthMotionSource.includes('select(".annual-profile-stage__stage-motion")'), true, "growth motion still targets the layout positioning wrapper");
assert.equal(profileStageFrameSource.includes("annual-profile-stage__alignment-debug"), true, "profile stage has no optional alignment overlay");
assert.equal(growthSongStageSource.includes("growth-song-stage__orbit"), true, "growth orbit is not anchored inside the song disc");
assert.equal(profileStageFrameSource.includes("annual-profile-stage__orbit"), false, "growth orbit remains detached from the song disc");
assert.equal(growthMotionSource.includes("growth-near-rainbow"), true, "near rainbow motion preset is missing");
assert.equal(growthMotionSource.includes("growth-challenge-knock"), true, "challenge knock motion preset is missing");
assert.equal(nearDondafulSource.includes("motion-preset=\"growth-near-rainbow\""), true, "near page does not select its rainbow motion preset");
assert.equal(challengeSource.includes("motion-preset=\"growth-challenge-knock\""), true, "challenge page does not select its knock motion preset");
assert.equal(growthSongStageSource.includes("growth-song-stage__prism-sweep"), true, "near stage has no prism sweep");
assert.equal(growthSongStageSource.includes("growth-song-stage__spectrum-ring"), true, "near stage has no large spectrum achievement ring");
assert.equal(growthSongStageSource.includes("stroke-dasharray: 92 8"), true, "near spectrum ring does not preserve the final-step gap");
assert.equal(growthSongStageSource.includes("growth-song-stage__impact-ring"), true, "challenge stage has no knock impact rings");
assert.equal(growthSongStageSource.includes("growth-song-stage__impact-residue"), true, "challenge stage has no static impact residue");
assert.equal(nearDondafulSource.includes("near-prism-dust"), true, "near page has no restrained spectral particles");
assert.equal(nearDondafulSource.includes("near-spectrum-atmosphere"), true, "near page has no spectrum stage atmosphere");
assert.equal(challengeSource.includes("challenge-pressure"), true, "challenge page has no pressure lines");
assert.equal(challengeSource.includes("challenge-door-light"), true, "challenge page has no cold door-slit spotlight");
assert.equal(/#f2c45f|#ffe08a|#ffd700|gold/i.test(challengeSource), false, "challenge page misuses gold completion semantics");
assert.equal(/prism|rainbow|spectrum|#ff9d|#c590/i.test(challengeSource), false, "challenge page misuses rainbow completion semantics");
assert.equal(nearDondafulSource.includes("<span>下一次落槌，也许就会亮成完整彩虹。</span>"), true, "near footer is not split into stable lines");
assert.equal(challengeSource.includes("<span>而你也没有转身。</span>"), true, "challenge footer is not split into stable lines");
for (const component of ["FavoriteShiftSlide", "LateNightSlide", "MilestonesSlide"]) {
  const source = await read(`components/account/version-summary/slides/${component}.vue`);
  assert.equal(source.includes("#error"), true, `${component} has no cover failure fallback`);
}
const monthlyLeafItemSource = await read("components/account/version-summary/AnnualMonthlyLeafItem.vue");
assert.equal(monthlyLeafItemSource.includes('@error="handleCoverError"'), true, "monthly leaf cover has no failure handler");
assert.equal(monthlyLeafItemSource.includes("AnnualArtworkFallback"), true, "monthly leaf cover has no visual fallback");

const posterSlideSource = await read("components/account/version-summary/slides/PosterSlide.vue");
assert.equal(posterSlideSource.includes("createShareAndPoster"), false, "share creation and poster rendering are still one action");
assert.equal(posterSlideSource.includes("const createShare ="), true, "share creation action is missing");
assert.equal(posterSlideSource.includes("const generatePoster ="), true, "poster generation action is missing");
assert.equal(/downloadPoster\(\).*downloadFallback|downloadPoster\(\)\) ElMessage\.success\(t\("annualSummary\.share\.downloadFallback"\)\)/s.test(posterSlideSource), true, "Web Share has no PNG download fallback");
assert.equal(posterSlideSource.includes('v-if="posterUrl" type="button" @click="downloadPoster"'), true, "generated PNG has no independent save action");
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
assert.equal(annualConstantsSource.includes('ANNUAL_END_DATE = "2026-09-11"'), true, "annual end date is not fixed");
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
