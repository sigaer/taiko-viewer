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
  "speedProfile", "nearDondaful", "challenge", "pound", "highScore", "milestones",
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
for (const asset of ["/title.png", "/to_end.png", "/icon.png"]) {
  assert.equal(annualPage.includes(`href: "${asset}"`), true, `annual opening asset is not preloaded: ${asset}`);
}
assert.equal(annualPage.includes("/friend.png"), false, "removed opening utility asset is still preloaded");
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
assert.equal(openingSource.includes("friendReport"), false, "opening still offers the removed friend report entry");
assert.equal(openingSource.includes("/friend.png"), false, "opening still references the removed friend report artwork");
assert.equal(openingSource.includes("annual-opening__utilities"), false, "opening still renders the removed utility row");
assert.equal(openingSource.includes("jumpToResultPage"), true, "opening result-page shortcut is not connected");
assert.equal(openingSource.includes('emit("jump-to-end")'), true, "opening result-page shortcut does not request the closing page");
assert.equal(storyPlayer.includes('@jump-to-end="startStoryAtEnd"'), true, "opening result-page shortcut is not wired to story navigation");
assert.equal(storyPlayer.includes("const startStoryAtEnd"), true, "story player has no closing-page shortcut handler");
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
assert.equal(openingFireworksSource.includes("<canvas"), true, "opening fireworks lost their particle canvas");
assert.equal(openingFireworksSource.includes("requestAnimationFrame"), true, "opening fireworks are not animated");
assert.equal(/GRAVITY/.test(openingFireworksSource), true, "opening firework particles ignore gravity");
assert.equal(openingFireworksSource.includes("visibilitychange"), true, "opening fireworks keep running in a hidden document");
assert.equal(/GENERATORS\s*=\s*\[/.test(openingFireworksSource), true, "opening fireworks have no staggered burst schedule");
assert.equal(openingBeatLaneSource.includes("@keyframes annual-beat-scroll"), true, "opening beat lane is not animated");
assert.equal(openingCarouselSource.includes("reducedMotion"), true, "opening carousel ignores reduced motion");
assert.equal(openingFireworksSource.includes("is-still"), true, "opening fireworks ignore reduced motion");
const timeOfDaySource = await read("components/account/version-summary/slides/TimeOfDaySlide.vue");
// UX-2 corrective: the original 0.57.3 wheel geometry is the baseline. The ring
// bearing is fixed, and every slot carries its own half-sector so the label and
// its sector share one angle state instead of two independent animations.
assert.equal(timeOfDaySource.includes("time-wheel__rotor"), true, "time page lost its original rotor");
assert.equal(timeOfDaySource.includes("time-wheel__sector-flow"), true, "time sectors have no per-slot rotation group");
assert.equal(timeOfDaySource.includes("time-wheel__sectors"), true, "time sectors have no shared layer in the rotor coordinate space");
assert.equal(/@keyframes time-slot-flow/.test(timeOfDaySource), true, "time slots no longer travel the wheel");
assert.equal(/@keyframes time-slot-flow-sector/.test(timeOfDaySource), true, "per-slot sectors do not rotate with their slot");
assert.equal(timeOfDaySource.includes("sectorPath(0)"), true, "the wedge is not built on its group axis");
assert.equal(/@keyframes time-slot-counter/.test(timeOfDaySource), true, "time labels no longer keep their own upright angle");
assert.equal(timeOfDaySource.includes("time-wheel__shell"), false, "the rejected fixed-shell rewrite is back");
assert.equal(timeOfDaySource.includes("time-wheel__item"), false, "the rejected item rewrite is back");
assert.equal(timeOfDaySource.includes("--wheel-radius:min(88vw,45vh,370px)"), true, "time wheel lost its approved radius");
assert.equal(timeOfDaySource.includes("--wheel-y:50%"), true, "time wheel lost its approved stage position");
assert.equal(timeOfDaySource.includes("countDigits"), true, "time centre reel does not adapt to the digit count");
for (const digits of [2, 3, 4, 5]) {
  assert.equal(timeOfDaySource.includes(`is-digits-${digits}`), true, `time centre reel has no size for ${digits}-digit counts`);
}
assert.equal(timeOfDaySource.includes("tabular-nums"), true, "time centre reel is not using tabular figures");
assert.equal(timeOfDaySource.includes("overflow-wrap:anywhere"), true, "time centre reel cannot wrap an overlong count");
assert.equal(timeOfDaySource.includes('narrativeKey("timeOfDay"'), true, "time page does not render its data-typed theme copy");
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
// UX-2 corrective: the transition rotates every cover plane about its own centre
// (0.57.3 semantics) as a one-way state change led by Period -> Overview. It must
// never yoyo back, and no whole-stream rotation wrapper may come back.
assert.equal(/upperPlanes|lowerPlanes/.test(periodOverviewSceneSource), true, "period transition no longer rotates the cover planes themselves");
assert.equal(/\.set\(\[upperPlanes, lowerPlanes\], \{ rotationZ: 0 \}/.test(periodOverviewSceneSource), true, "period state is not reset to the rectangular pose");
assert.equal((periodOverviewSceneSource.match(/rotationZ: 45/g) || []).length, 2, "cover planes do not both rotate to the diamond pose");
assert.equal(/rotationZ: 0[^\n]*\}[^\n]*\.08/.test(periodOverviewSceneSource), false, "transition still reverses the rotation");
assert.equal(periodOverviewSceneSource.includes("period-overview-scene__cover-rotation"), false, "the rejected whole-stream rotation wrapper is back");
assert.equal(periodOverviewSceneSource.includes("--cover-rotation"), false, "rotation is still driven by a CSS variable instead of the timeline");
assert.equal(/\.to\([^)]*,\s*\{[^}]*rotationX/.test(periodOverviewSceneSource), false, "transition still compresses cover height with an X-axis rotation");
assert.equal(/\.pause\(\)/.test(periodOverviewSceneSource), false, "period transition still pauses the cover stream");
// The shared cover phase must keep advancing while the transition plays, because
// the slot animation is paused and the visible cover position comes from it.
assert.equal(
  /if \(coverClockTimestamp\) \{\s*coverStreamPhase\.value = \(coverStreamPhase\.value \+ timestamp - coverClockTimestamp\)/.test(storyPlayer),
  true,
  "cover phase is still frozen while the period transition runs"
);
assert.equal(/!transitionRunning\.value\) \{\s*coverStreamPhase/.test(storyPlayer), false, "cover phase still checks transitionRunning");
const coverStreamSource = verticalCoverSource;
assert.equal(coverStreamSource.includes("vertical-cover-stream__rotation"), false, "the rejected per-cover rotation layer is back");
assert.equal(coverStreamSource.includes("__plane"), true, "cover stream lost its plane element");
// UX-2: the ambient flow must not be gated on the scene's active flag.
assert.equal(verticalCoverSource.includes("is-flowing"), true, "cover stream has no independent flow state");
assert.equal(verticalCoverSource.includes("is-running"), false, "cover stream still ties its flow to the active flag");
assert.equal(verticalCoverSource.includes("flowing?: boolean"), true, "cover stream does not accept an independent flow flag");
assert.equal(storyPlayer.includes(":flowing="), true, "story player does not drive the independent cover flow");
// Both slide wrappers must forward the flow flag, otherwise the covers freeze
// whenever the pair transition takes over.
for (const [wrapper, name] of [[periodMotionSource, "PeriodSlide"], [overviewMotionSource, "OverviewSlide"]]) {
  assert.equal(wrapper.includes("flowing?: boolean"), true, `${name} does not accept the cover flow flag`);
  assert.equal(wrapper.includes(":flowing="), true, `${name} does not forward the cover flow flag`);
}
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
const storyDrawerSource = await read("components/account/version-summary/StoryDrawer.vue");
const annualProfileSource = await read("pages/account/profile.vue");
assert.equal(storyDrawerSource.includes("exitSettled"), true, "story exit can navigate twice from one click");
assert.equal(/emit\(["']exit["']\)/g.test(storyDrawerSource), true, "story drawer no longer emits its exit action");
assert.equal(
  storyDrawerSource.indexOf('emit("exit")') < storyDrawerSource.indexOf('@closed="'),
  true,
  "story exit still waits for the drawer leave transition"
);
assert.equal(
  /const \{ data, pending, refresh \} = useAsyncData<ProfilePayload>/.test(annualProfileSource),
  true,
  "profile payload became a suspending await again"
);
assert.equal(
  /const \{\s*data: myDonShowcaseData,[\s\S]{0,400}?\} = useAsyncData<MyDonShowcasePayload>/.test(annualProfileSource)
    && !/await useAsyncData<MyDonShowcasePayload>/.test(annualProfileSource),
  true,
  "profile showcase payload suspends the route after the profile payload"
);
const annualSummarySource = await read("utils/annualSummary.ts");
assert.equal(annualSummarySource.includes('ANNUAL_CALENDAR_TIME_ZONE = "Asia/Shanghai"'), true, "annual day counting lost its season time zone");
assert.equal(annualSummarySource.includes("calendarDaySpan"), true, "annual day counting has no calendar span helper");
assert.equal(annualSummarySource.includes("firstActualPlayDate"), true, "annual day counting ignores the proven first play day");
assert.equal(annualSummarySource.includes("earliestPlayDay"), true, "annual day counting is not anchored to a first play day");
assert.equal(annualSummarySource.includes("periodTotalDays"), true, "annual day counting does not resolve a period total");
assert.equal(annualSummarySource.includes("totalDays: periodTotalDays"), true, "period total days still pass through from upstream");
assert.equal(annualSummarySource.includes("seasonSpan"), false, "period total days is still capped by the season window");
const annualPeriodSchema = JSON.parse(await read("../../schemas/annual-summary-v4.schema.json"));
assert.equal(
  Object.prototype.hasOwnProperty.call(annualPeriodSchema.properties.period.properties, "firstActualPlayDate"),
  true,
  "the annual schema does not declare firstActualPlayDate"
);
assert.equal(
  annualPeriodSchema.properties.period.required.includes("firstActualPlayDate"),
  true,
  "firstActualPlayDate is not a required period field"
);
const zh = JSON.parse(zhSource).annualSummary;
const ja = JSON.parse(jaSource).annualSummary;
assert.equal(zh.slides.calendar.title, "虹2025 太鼓日历", "calendar title is not the approved product copy");
assert.equal(zh.slides.calendar.footnote, undefined, "calendar technical footnote remains");
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
  for (const key of ["title", "month", "monthSummary", "datePlayCount"]) {
    assert.equal(typeof locale.slides.calendar[key], "string", `missing calendar locale: ${key}`);
  }
  assert.equal(locale.slides.calendar.primary, undefined, "calendar still ships a second, untyped wording next to the typed narrative");
  // UX-2: the time page states its theme on the first beat, now through the typed narrative.
  assert.equal(locale.slides.time.theme, undefined, "time page still ships a second, untyped wording next to the typed narrative");
  assert.equal(typeof locale.slides.time.favorite, "string", "time page has no favourite-hour label");
}

// Copy typing: every archetype the selector can produce carries its own wording in
// both locales, and each of the five pages renders that wording through the shared
// selector instead of holding a hardcoded sentence.
const narrativeSource = await read("utils/annualNarrative.ts");
assert.equal(narrativeSource.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "").includes("Math.random"), false, "annual narrative selection is not deterministic");
const narrativePages = {
  timeOfDay: { archetypes: ["morning", "daytime", "evening", "late_night"], fields: ["theme"] },
  calendar: { archetypes: ["occasional", "sprint", "steady", "persistent"], fields: ["primary", "longest", "emotion1", "emotion2"] },
  speedProfile: { archetypes: ["mild", "cruise", "fast", "extreme"], fields: ["title", "lead", "detail"] },
  challenge: { archetypes: ["tap", "push", "siege", "vow"], fields: ["title", "lead"] },
  nearDondaful: { archetypes: ["razor_standard", "razor_ten_star", "near_standard", "near_ten_star", "distant_standard", "distant_ten_star"], fields: ["title", "lead"] },
  obsession: { archetypes: ["encounter", "burst", "attached", "devoted"], fields: ["closing1", "closing2"] },
  favoriteShift: { archetypes: ["handover", "transition", "flicker"], fields: ["line1", "line2"] },
  monthly: { archetypes: ["brief", "seasonal", "recurring", "year_round"], fields: ["footer1", "footer2"] },
  weekday: { archetypes: ["anchored", "weekend", "workday", "balanced"], fields: ["titleBefore", "titleAfter"] },
  lateNight: { archetypes: ["occasional", "familiar", "frequent", "nocturnal"], fields: ["line"] }
};
for (const locale of [zh, ja]) {
  for (const [page, { archetypes, fields }] of Object.entries(narrativePages)) {
    for (const archetype of archetypes) {
      const variants = locale.narrative?.[page]?.[archetype];
      assert.equal(typeof variants, "object", `missing ${page} narrative archetype: ${archetype}`);
      const entries = Object.entries(variants);
      assert.ok(entries.length >= 2 && entries.length <= 3, `${page}/${archetype} must ship 2-3 wording variants`);
      for (const [variant, copy] of entries) {
        for (const field of fields) {
          assert.equal(typeof copy[field], "string", `missing narrative copy: ${page}/${archetype}/${variant}/${field}`);
          assert.ok(copy[field].length > 3, `placeholder narrative copy: ${page}/${archetype}/${variant}/${field}`);
        }
      }
    }
  }
}
// The selector itself is exercised on synthetic edge cases, so a value the locale
// does not cover (or a non-deterministic variant) cannot ship unnoticed.
const { selectNarrative, NARRATIVE_VARIANTS } = await import(new URL("../utils/annualNarrative.ts", import.meta.url).href);
const syntheticSummary = (patch = {}) => ({ summaryId: "annual_contract_probe", version: { key: "annual_2026" }, ...patch });
const narrativeProbes = {
  timeOfDay: [undefined, { topPeriod: "early_morning" }, { topPeriod: "morning" }, { topPeriod: "noon" }, { topPeriod: "afternoon" },
    { topPeriod: "evening" }, { topPeriod: "late_night" }, { topPeriod: "dusk", favoriteHour: 0 }, { topPeriod: "dusk", favoriteHour: 10 },
    { topPeriod: "dusk", favoriteHour: 16 }, { topPeriod: "dusk", favoriteHour: 23 }],
  calendar: [undefined, { activeDays: 0, longestStreak: 0 }, { activeDays: 19, longestStreak: 5 }, { activeDays: 20, longestStreak: 3 },
    { activeDays: 59, longestStreak: 30 }, { activeDays: 60, longestStreak: 7 }, { activeDays: 400, longestStreak: 2 }],
  speedProfile: [undefined, { speed: 0 }, { speed: 1 }, { speed: 1.25 }, { speed: 1.26 }, { speed: 1.45 }, { speed: 1.6 }, { speed: 1.61 }, { speed: 4 }],
  challenge: [undefined, { playCount: 0 }, { playCount: 29 }, { playCount: 30 }, { playCount: 69 }, { playCount: 70 }, { playCount: 120 }, { playCount: 121 }],
  nearDondaful: [undefined, { okCount: 1, song: { stars: 9 } }, { okCount: 1, song: { stars: 10 } }, { okCount: 3, song: { stars: 8 } },
    { okCount: 6, song: { stars: 7 } }, { okCount: 10, song: { stars: 10 } }],
  obsession: [undefined, { activeDays: 1, playCount: 1 }, { activeDays: 5, playCount: 5 }, { activeDays: 6, playCount: 30 },
    { activeDays: 12, playCount: 20 }, { activeDays: 18, playCount: 30 }, { activeDays: 40, playCount: 80 }, { activeDays: 100, playCount: 120 }],
  favoriteShift: [undefined, { oldFavorite: { playCount: 10 }, newFavorite: { playCount: 1 } },
    { oldFavorite: { playCount: 10 }, newFavorite: { playCount: 10 } }, { oldFavorite: { playCount: 1 }, newFavorite: { playCount: 10 } },
    { oldFavorite: { playCount: 0 }, newFavorite: { playCount: 0 } }],
  monthly: [undefined, [], Array.from({ length: 1 }, (_, index) => ({ song: { name: `song-${index}` } })),
    Array.from({ length: 3 }, (_, index) => ({ song: { name: `song-${index}` } })),
    Array.from({ length: 6 }, (_, index) => ({ song: { name: `song-${index}` } })),
    Array.from({ length: 9 }, (_, index) => ({ song: { name: `song-${index}` } })),
    Array.from({ length: 12 }, (_, index) => ({ song: { name: `song-${index}` } }))],
  weekday: [undefined, { counts: [1, 1, 1, 1, 1, 1, 1], totalPlays: 7 }, { counts: [1, 1, 1, 1, 1, 20, 20], totalPlays: 45 },
    { counts: [30, 30, 30, 30, 30, 1, 1], totalPlays: 152 }, { counts: [1, 1, 40, 1, 1, 1, 1], totalPlays: 46 }],
  lateNight: [undefined, { activeDays: 1 }, { activeDays: 4 }, { activeDays: 12 }, { activeDays: 25 }, { activeDays: 80 }]
};
for (const [page, probes] of Object.entries(narrativeProbes)) {
  const declared = Object.keys(zh.narrative[page]);
  assert.equal(typeof NARRATIVE_VARIANTS[page], "number", `${page} has no declared variant count`);
  for (const probe of probes) {
    const summary = syntheticSummary({ [page]: probe === undefined ? null : probe });
    const selection = selectNarrative(page, summary);
    assert.equal(declared.includes(selection.archetype), true, `${page} selects an archetype the locale does not ship: ${selection.archetype}`);
    assert.ok(selection.variant >= 1 && selection.variant <= NARRATIVE_VARIANTS[page], `${page} variant out of range: ${selection.variant}`);
    assert.deepEqual(selectNarrative(page, summary), selection, `${page} selection is not stable for the same input`);
    for (const field of narrativePages[page].fields) {
      for (const variant of Object.keys(zh.narrative[page][selection.archetype])) {
        assert.equal(typeof zh.narrative[page][selection.archetype][variant][field], "string", `zh has no ${page}.${selection.archetype}.${variant}.${field}`);
        assert.equal(typeof ja.narrative[page][selection.archetype][variant][field], "string", `ja has no ${page}.${selection.archetype}.${variant}.${field}`);
      }
    }
  }
}
// A different account must be able to land on a different wording for the same archetype.
const probeVariants = new Set();
for (let index = 0; index < 40; index += 1) {
  probeVariants.add(selectNarrative("calendar", syntheticSummary({ summaryId: `annual_contract_probe_${index}`, calendarActivity: { activeDays: 80, longestStreak: 40 } })).variant);
}
assert.ok(probeVariants.size > 1, "one archetype always resolves to a single variant");

// Every typed page calls the shared selector (importing it is not enough).
for (const [file, token] of [
  ["components/account/version-summary/slides/TimeOfDaySlide.vue", 'selectNarrative("timeOfDay"'],
  ["components/account/version-summary/AnnualCalendarScene.vue", 'selectNarrative("calendar"'],
  ["components/account/version-summary/slides/SpeedProfileSlide.vue", 'selectNarrative("speedProfile"'],
  ["components/account/version-summary/slides/ChallengeSlide.vue", 'selectNarrative("challenge"'],
  ["components/account/version-summary/slides/NearDondafulSlide.vue", 'selectNarrative("nearDondaful"'],
  ["components/account/version-summary/slides/ObsessionSongSlide.vue", 'selectNarrative("obsession"'],
  ["components/account/version-summary/slides/FavoriteShiftSlide.vue", 'selectNarrative("favoriteShift"'],
  ["components/account/version-summary/AnnualMonthlyLeafScene.vue", 'selectNarrative("monthly"'],
  ["components/account/version-summary/AnnualWeekdayForestScene.vue", 'selectNarrative("weekday"'],
  ["components/account/version-summary/slides/LateNightSlide.vue", 'selectNarrative("lateNight"']
]) {
  const source = await read(file);
  assert.equal(source.includes(token), true, `${file} does not read the shared narrative selector`);
  assert.equal(source.includes("narrativeKey("), true, `${file} does not render typed narrative copy`);
}

const posterSlideSource = await read("components/account/version-summary/slides/LegacyPosterShare.vue");
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
assert.equal(annualConstantsSource.includes('ANNUAL_ALGORITHM_VERSION = "annual-observation-v4.3.0"'), true, "annual producer version is stale");
const annualRuntimeSource = await read("server/services/account/annual-summary/runtime.ts");
const annualRatingsSource = await read("server/services/account/annual-summary/ratings.ts");
const annualServiceSource = await read("server/services/account/annual-summary/index.ts");
assert.equal(annualServiceSource.includes("summary.provenance?.algorithmVersion !== ANNUAL_ALGORITHM_VERSION"), true, "stale annual summaries are still served");
assert.equal(annualRatingsSource.includes("getAnnualRatingDistribution"), true, "annual rating enrichment does not use the cache reader");
assert.equal(annualRuntimeSource.includes("export const getAnnualRatingDistribution = readCachedAnnualRatingDistribution"), true, "user rating lookup can rebuild the distribution");

const schemaCandidates = ["../../../schemas/annual-summary-v4.schema.json", "../../schemas/annual-summary-v4.schema.json"];
let schemaText = "";
for (const candidate of schemaCandidates) {
  try { schemaText = await read(candidate); break; } catch {}
}
assert.ok(schemaText, "annual summary schema is unavailable");
const schema = JSON.parse(schemaText);
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
