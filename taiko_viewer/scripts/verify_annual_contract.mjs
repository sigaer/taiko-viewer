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
assert.deepEqual(actualPages, expectedPages, "annual page registry order differs from the 21-page contract");
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
const annualOpeningAssetsSource = await read("utils/annualOpeningAssets.client.ts");
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
for (const asset of ["/title_resize.png", "/to_end.png", "/icon.png"]) {
  assert.equal(annualPage.includes(`href: "${asset}"`), true, `annual opening asset is not preloaded: ${asset}`);
}
assert.equal(await exists("public/title_resize.png"), true, "resized opening title art is missing");
assert.equal(annualOpeningAssetsSource.includes('"/title_resize.png"'), true, "opening artwork warmup uses the wrong title art");
assert.equal(annualPage.includes('href: "/title.png"'), false, "retired opening title art is still preloaded");
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
assert.equal((await read("components/account/version-summary/AnnualCoverBackground.vue")).includes("gsap.ticker.remove(tick)"), true, "cover renderer has no ticker cleanup");
assert.equal(storyPlayer.includes("PERIOD_OVERVIEW_DURATION_MS / 1000"), true, "period-to-overview no longer uses the transitionTime duration contract");

const openingSource = await read("components/account/version-summary/slides/OpeningSlide.vue");
const profileSource = await read("components/account/version-summary/slides/ProfileSlide.vue");
const openingCarouselSource = await read("components/account/version-summary/AnnualOpeningCarousel.vue");
const openingFireworksSource = await read("components/account/version-summary/AnnualOpeningFireworks.vue");
const openingBeatLaneSource = await read("components/account/version-summary/AnnualOpeningBeatLane.vue");
assert.equal(openingSource.includes("AnnualOpeningCarousel"), true, "opening cover carousel is missing");
assert.equal(openingSource.includes("AnnualOpeningFireworks"), true, "opening fireworks are missing");
assert.equal(openingSource.includes("AnnualOpeningBeatLane"), true, "opening beat lane is missing");
assert.equal(openingSource.includes('src="/title_resize.png"'), true, "opening does not use the resized title art");
assert.equal(openingSource.includes('src="/title.png"'), false, "opening still renders the retired title art");
assert.equal(openingSource.includes("bottom: calc(100% - var(--opening-carousel-top))"), true, "opening title is not anchored to the carousel boundary");
assert.equal(openingSource.includes("top: var(--opening-carousel-top)"), true, "opening carousel does not share its boundary token with the title");
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
const coverRendererSource = await read("utils/annualCoverRenderer.client.ts");
assert.equal((storyPlayer.match(/<AnnualPeriodOverviewScene/g) || []).length, 1, "player must own one persistent pair scene");
assert.equal(periodOverviewSceneSource.includes("AnnualCoverBackground"), true, "pair scene must use the shared WebGL background");
assert.equal(periodOverviewSceneSource.includes("summary.overview.uniqueSongs"), false, "overview still renders song count");
assert.equal(periodOverviewSceneSource.includes("summary.overview.uniqueCharts"), false, "overview still renders chart count");
assert.equal(periodOverviewSceneSource.includes("summary.overview.estimatedTimeText"), true, "overview missing play time");
assert.equal(coverRendererSource.includes("coverMotion(state.elapsed"), true, "cover motion must retain its independent phase");
assert.equal(coverRendererSource.includes("coverRotation(state.transitionTime)"), true, "cover planes must rotate locally");
assert.equal(periodOverviewSceneSource.includes('/蓝色白色背景图.png'), true, "period scene is missing the provided blue-white backdrop");
assert.equal(periodOverviewSceneSource.includes('data-visual-style="light-memory-tunnel"'), true, "period scene does not declare the light memory tunnel style");
assert.equal(periodOverviewSceneSource.includes('const mascotUrl = "/dance.gif"'), true, "period scene is missing the dancing pixel mascot");
const coverBackgroundSource = await read("components/account/version-summary/AnnualCoverBackground.vue");
assert.ok(coverBackgroundSource.includes('annual-cover-background__still'), "static cover fallback missing");
assert.ok(coverBackgroundSource.includes('props.reducedMotion'), "reduced motion must disable the renderer");
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
assert.equal(annualSummarySource.includes("firstActualPlayDate"), true, "annual summary lost first-observation provenance");
assert.equal(annualSummarySource.includes("reportingStartDay"), true, "annual day counting is not anchored to the version start");
assert.equal(annualSummarySource.includes("reportingEndDay"), true, "annual day counting does not cap itself at the reporting end");
assert.equal(annualSummarySource.includes("firstObservedSourceDay"), true, "annual day counting ignores the user's first observable day");
assert.equal(annualSummarySource.includes("firstObservedDate"), true, "annual day counting does not expose its bounded observation anchor");
assert.equal(annualSummarySource.includes("earliestPlayDay"), false, "annual day counting still uses a pre-window account observation");
assert.equal(annualSummarySource.includes("periodTotalDays"), true, "annual day counting does not resolve a period total");
assert.equal(annualSummarySource.includes("totalDays: periodTotalDays"), true, "period total days do not use the resolved reporting span");
assert.equal(periodOverviewSceneSource.includes("props.summary.period.firstObservedDate"), true, "Period scene does not display the first in-window observation");
assert.equal(periodOverviewSceneSource.includes('first: "这个版本里首次留下记录"'), true, "Period scene is missing the approved first-observation copy");
assert.equal(periodOverviewSceneSource.includes("这个版本的第一天"), false, "Period scene still claims every user starts on the version boundary");
assert.equal(periodOverviewSceneSource.includes("我们第一次相遇"), false, "Period scene still presents the account observation as a first encounter");
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
          // Copy-3B P2: the weekday headline is "one conclusion on one line", so its
          // trailing clause is intentionally empty; every other narrative field must
          // stay substantive.
          const mayBeEmpty = page === "weekday" && (field === "titleAfter" || field === "titleBefore");
          assert.ok(mayBeEmpty || copy[field].length > 3, `placeholder narrative copy: ${page}/${archetype}/${variant}/${field}`);
          if (page === "weekday" && field === "titleBefore") {
            // P2.1: the day is interpolated between titleBefore/titleAfter, so the
            // headline only has to carry text on one of the two sides.
            const headline = `${copy.titleBefore}${copy.titleAfter}`.trim();
            assert.ok(headline.length > 0, `weekday headline is empty: ${archetype}/${variant}`);
          }
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

// The legacy "更多分享方式 · 30 天链接" entry was removed: the Poster saves the share card
// directly and keeps no secondary share dialog.
const posterSlideSource = await read("components/account/version-summary/slides/PosterSlide.vue");
assert.equal(posterSlideSource.includes("LegacyPosterShare"), false, "the legacy share dialog is still mounted");
assert.equal(posterSlideSource.includes("poster-scene__legacy"), false, "the legacy share entry is still rendered");
assert.equal(posterSlideSource.includes("annualSummary.staticPoster.legacy"), false, "the legacy share label is still referenced");
assert.equal(await exists("components/account/version-summary/slides/LegacyPosterShare.vue"), false, "the legacy share component still exists");
assert.equal(posterSlideSource.includes("saveShareCard"), true, "the share-card save action is missing");

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
const annualPeriodSource = await read("utils/annualPeriod.ts");
assert.equal(annualPeriodSource.includes('endInclusive: "2026-09-30"'), true, "annual inclusive end date is not fixed");
assert.equal(annualPeriodSource.includes('endExclusive: "2026-10-01"'), true, "annual exclusive end date is not fixed");
assert.equal(annualPeriodSource.includes('calendarDays: 357'), true, "annual calendar-day count is not fixed");
assert.equal(annualPeriodSource.includes('revision: "annual-report-2026-r2-final-window"'), true, "annual report revision is missing");
assert.equal(annualConstantsSource.includes('from "~/utils/annualPeriod"'), true, "server does not consume the canonical reporting window");
assert.equal(annualConstantsSource.includes('ANNUAL_PUBLIC_OPEN_AT = "2026-10-02T00:00:00+08:00"'), true, "annual public opening is not configured");
const viewerAlgorithmVersion = /ANNUAL_ALGORITHM_VERSION = "([^"]+)"/.exec(annualConstantsSource)?.[1];
assert.ok(viewerAlgorithmVersion, "annual producer version is missing from the viewer constants");
let generatorConstantsSource = "";
for (const candidate of ["../../../plugins/utils/annual_summary/constants.py", "../../plugins/utils/annual_summary/constants.py"]) {
  try { generatorConstantsSource = await read(candidate); break; } catch {}
}
assert.ok(generatorConstantsSource, "annual generator constants are unavailable for the version contract");
const generatorAlgorithmVersion = /ALGORITHM_VERSION = "([^"]+)"/.exec(generatorConstantsSource)?.[1];
assert.equal(viewerAlgorithmVersion, generatorAlgorithmVersion, "annual producer version drifted between viewer and generator");
assert.equal(viewerAlgorithmVersion, "annual-observation-v4.5.2", "unexpected annual producer version for this release");
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

// ---------------------------------------------------------------- Copy-3B FinalTitle
const finalTitleKeys = [
  "final_archive_collector", "final_archive_dan", "final_archive_explorer", "final_archive_regular",
  "final_devotion", "final_devotion_endurance", "final_devotion_growth", "final_devotion_precision",
  "final_devotion_speed", "final_early", "final_endurance", "final_endurance_devotion",
  "final_endurance_exploration", "final_endurance_growth", "final_endurance_nocturnal",
  "final_endurance_precision", "final_endurance_speed", "final_exploration",
  "final_exploration_endurance", "final_exploration_growth", "final_growth", "final_growth_devotion",
  "final_growth_endurance", "final_growth_exploration", "final_growth_precision", "final_growth_speed",
  "final_keeper", "final_nocturnal", "final_nocturnal_devotion", "final_nocturnal_endurance",
  "final_nocturnal_exploration", "final_nocturnal_growth", "final_nocturnal_precision",
  "final_nocturnal_speed", "final_precision", "final_precision_devotion", "final_precision_endurance",
  "final_precision_growth", "final_precision_speed", "final_speed", "final_speed_devotion",
  "final_speed_endurance", "final_speed_exploration", "final_speed_growth", "final_speed_precision"
];
const danPresentationKeys = ["dan_kanzui_gold", "dan_kanzui_red", "dan_fullgood_gold", "dan_fullgood_red", "dan_gold_pass", "dan_major_progress"];
const requiredEvidenceKeys = [
  ...danPresentationKeys, "dan_mark_progress", "dan_standing_gold_pass", "dan_standing_kanzui_gold",
  "growth_breakthrough", "precision_full_combo", "speed_high", "endurance_volume", "exploration_breadth",
  "devotion_song", "nocturnal_days", "sparse_basic"
];
const annualLocales = {};
for (const locale of ["zh", "ja"]) {
  const bundle = JSON.parse(await read(`locales/${locale}.json`));
  const annual = bundle.annualSummary;
  annualLocales[locale] = annual;
  assert.deepEqual(Object.keys(annual.finalTitles).sort(), [...finalTitleKeys].sort(), `${locale}: finalTitles dictionary drifted from the 45-key whitelist`);
  for (const key of danPresentationKeys) assert.ok(annual.danPresentation[key]?.title, `${locale}: missing dan presentation ${key}`);
  for (const key of requiredEvidenceKeys) assert.ok(annual.finalEvidence.templates[key], `${locale}: missing evidence template ${key}`);
  for (const key of ["sparse_basic_no_days", "endurance_volume_no_days"]) assert.ok(annual.finalEvidence.templates[key], `${locale}: missing no-days evidence template ${key}`);
  // the Finale must not be able to fall back to the raw key or to an empty body
  for (const key of finalTitleKeys) assert.ok(annual.finalTitles[key].title && annual.finalTitles[key].title.length >= 2, `${locale}: empty title for ${key}`);
  // legacy alias block stays until every consumer is migrated
  assert.ok(Object.keys(annual.titles).length >= 8, `${locale}: legacy titles alias block disappeared`);
  for (const key of Object.keys(annual.titles).filter((item) => item.startsWith("breakthrough_"))) {
    assert.ok(annual.breakthroughTitles[key]?.title, `${locale}: breakthrough title ${key} is missing from breakthroughTitles`);
  }
}
assert.ok(Object.keys(annualLocales.zh.finalTitles).every((key) => annualLocales.zh.finalTitles[key].body), "zh FinalTitle bodies are incomplete");
assert.ok(Object.keys(annualLocales.ja.finalTitles).every((key) => annualLocales.ja.finalTitles[key].body), "ja FinalTitle bodies are incomplete");
for (const key of finalTitleKeys) {
  assert.ok(annualLocales.zh.finalTitles[key].body, `zh FinalTitle ${key} is missing body`);
  assert.ok(annualLocales.ja.finalTitles[key].body, `ja FinalTitle ${key} is missing body`);
  assert.notEqual(annualLocales.ja.finalTitles[key].title, annualLocales.zh.finalTitles[key].title, `ja FinalTitle ${key} is untranslated`);
}
for (const key of danPresentationKeys) {
  assert.ok(annualLocales.zh.danPresentation[key].body, `zh Dan presentation ${key} is missing body`);
  assert.ok(annualLocales.ja.danPresentation[key].body, `ja Dan presentation ${key} is missing body`);
}
assert.equal(annualLocales.zh.finalTitles.final_keeper.title, "留白待成章");
assert.equal(annualLocales.ja.finalTitles.final_keeper.title, "余白の章");
assert.equal(annualLocales.zh.danPresentation.dan_kanzui_gold.title, "凌霄贯律");
assert.equal(annualLocales.zh.danPresentation.dan_kanzui_red.title, "澄境执律");

const finalTitleSource = await read("utils/annualSummary.ts");
assert.ok(finalTitleSource.includes("annualSummary.finalTitles."), "FinalTitle no longer reads the curated dictionary");
assert.ok(finalTitleSource.includes("annualSummary.danPresentation."), "strong Dan presentation is not wired");
assert.ok(finalTitleSource.includes("annualSummary.breakthroughTitles."), "breakthrough dictionary is not decoupled");

// Annual UX Detail P1: page transitions no longer emit the one-shot drum SFX;
// Opening critical assets are decoded/primed before the story is shown, and the
// share poster uses the versioned background URL so stale CDN bytes cannot win.
const storyPlayerSource = await read("components/account/version-summary/StoryPlayer.vue");
assert.equal(storyPlayerSource.includes("playDrum"), false, "annual page-turn SFX is still wired");
const annualOpeningPageSource = await read("pages/account/version-summary.vue");
assert.equal(annualOpeningPageSource.includes("preloadAnnualOpeningArtwork"), true, "Opening artwork preload is missing");
assert.equal(annualOpeningPageSource.includes("openingCriticalAssetsReadyId"), true, "Opening critical asset gate is missing");
const openingAssetsSource = await read("utils/annualOpeningAssets.client.ts");
assert.equal(openingAssetsSource.includes("image.decode"), true, "Opening artwork preload does not await decode");
const shareGridSource = await read("components/account/version-summary/AnnualShareGrid.vue");
assert.equal(shareGridSource.includes("square_bg_v2.png"), true, "Poster background is not versioned");
assert.equal(/annualSummary\.titles\.\$\{finalTitleKey\}/.test(finalTitleSource), false, "FinalTitle still reads the shared titles namespace");
assert.equal(finalTitleSource.includes("DAN_PRESENTATION_EVIDENCE"), false, "legacy evidence keys must not select the main presentation");

const pluginCandidates = ["../../../plugins/utils/annual_summary", "../../plugins/utils/annual_summary"];
let pluginRoot = "";
for (const candidate of pluginCandidates) {
  try { await read(`${candidate}/finaltitle_model.py`); pluginRoot = candidate; break; } catch {}
}
assert.ok(pluginRoot, "annual_summary package is unavailable for the cross-language contract");
const danModelSource = await read(`${pluginRoot}/finaltitle_model.py`);
const whitelistBlock = danModelSource.slice(danModelSource.indexOf("FINAL_TITLE_KEYS"), danModelSource.indexOf("EVIDENCE_DAN_STRONG"));
for (const key of finalTitleKeys) assert.ok(whitelistBlock.includes(`"${key}"`), `generator whitelist is missing ${key}`);
assert.ok(danModelSource.includes('return mark in (2, 5)') === false, "kanzui helper must live in dan_state");
const danStateSource = await read(`${pluginRoot}/dan_state.py`);
assert.ok(danStateSource.includes("return mark in (2, 5)"), "kanzui is not defined as mark 2 or 5");

// ---------------------------------------------------------------- Copy-3B UX P2
for (const [locale, bundle] of Object.entries({ zh, ja })) {
  // D: 主 Header 只表达一个结论 → titleAfter 为空，titleBefore 足够短（390px 单行）
  const weekday = bundle.narrative.weekday;
  for (const archetype of Object.keys(weekday)) {
    for (const [variant, copy] of Object.entries(weekday[archetype])) {
      // P2/P2.1: 主 Header 只表达一个结论 → 日期两侧最多只有一侧带文字（另一侧为空），
      // 且带文字的一侧必须短到能在 390px 单行显示。
      const before = copy.titleBefore.trim();
      const after = copy.titleAfter.trim();
      assert.ok(before.length > 0 || after.length > 0, `${locale}: weekday headline is empty (${archetype}/${variant})`);
      // 日期（2 字）插在中间，因此整句长度 = before + day + after，必须能单行显示；
      // 尾句只能是短修饰，不能重新变成第二个分句（P2 的问题就是尾句过长）。
      const tailLimit = locale === "zh" ? 6 : 8;
      const totalLimit = locale === "zh" ? 14 : 15;
      if (before.length > 0 && after.length > 0) {
        assert.ok(after.length <= tailLimit, `${locale}: weekday headline tail is too long (${archetype}/${variant}: ${after})`);
      }
      assert.ok(before.length + 2 + after.length <= totalLimit, `${locale}: weekday headline too long for one line (${archetype}/${variant})`);
    }
  }
}
// P2.1: "工作日" 文案断言该天是工作日，因此 workday archetype 不能显示周六/周日。
const { weekdayHeadlineIndex } = await import(resolve(root, "utils/annualNarrative.ts"));
const workdayMixed = [4, 4, 4, 4, 4, 5, 0]; // 周六单日最高，但工作日占比 80% → workday archetype
assert.equal(weekdayHeadlineIndex("workday", workdayMixed, 5), 0, "workday headline must fall back to the busiest working day");
assert.equal(weekdayHeadlineIndex("workday", [0, 0, 3, 0, 1, 6, 6], 5), 2, "workday headline must pick the busiest Mon-Fri day");
assert.equal(weekdayHeadlineIndex("workday", [0, 0, 0, 0, 0, 3, 3], 5), 5, "workday without working-day plays keeps the real top day");
assert.equal(weekdayHeadlineIndex("weekend", workdayMixed, 5), 5, "non-workday archetypes keep the real top day");
assert.equal(weekdayHeadlineIndex("balanced", workdayMixed, 5), 5, "non-workday archetypes keep the real top day");
assert.equal(weekdayHeadlineIndex("anchored", workdayMixed, 5), 5, "non-workday archetypes keep the real top day");
const weekdayScene = await read("components/account/version-summary/AnnualWeekdayForestScene.vue");
assert.ok(weekdayScene.includes("weekdayHeadlineIndex(narrative.value.archetype"), "weekday scene does not apply the workday headline rule");

const profilePage = await read("pages/account/profile.vue");
assert.ok(profilePage.includes("needsBindingOnboarding"), "unbound first-screen CTA is missing");
assert.ok(profilePage.includes("onboarding-card"), "unbound first-screen CTA markup is missing");
assert.ok(profilePage.includes("focusBindingForm"), "binding CTA does not reveal the real binding form");
assert.ok(profilePage.includes("pendingBoxRef"), "challenge confirmation scroll target is missing");
assert.ok(profilePage.includes("revealElement("), "state-change scroll helper is missing");
assert.equal(/scrollTo\(\s*\d/.test(profilePage), false, "hard-coded pixel scrolling is not allowed");
const pendingMarkupIndex = profilePage.indexOf('class="pending-box"');
const manualMarkupIndex = profilePage.indexOf('class="manual-account-panel"');
assert.ok(pendingMarkupIndex >= 0 && manualMarkupIndex >= 0 && pendingMarkupIndex < manualMarkupIndex, "pending confirmation must appear before manual account panel");
const finaleSlide = await read("components/account/version-summary/slides/AnnualFinaleSlide.vue");
assert.ok(finaleSlide.includes("annual-finale-scene__evidence"), "Finale evidence line is missing");
assert.ok(finaleSlide.includes("finalTitle.narrativeBody"), "Finale narrative body is not separated from evidence");
assert.equal(finaleSlide.includes("｜"), false, "Finale must not join evidence and body with a separator");
const annualSource = await read("utils/annualSummary.ts");
assert.ok(annualSource.includes("finalTitle.narrativeBody = narrativeBody"), "resolver does not expose the narrative body");
assert.ok(annualSource.includes("finalTitle.evidenceText = finalEvidence.text"), "resolver does not expose the evidence text");

process.stdout.write(JSON.stringify({ ok: true, pageCount: actualPages.length, locales: ["zh", "ja"], schemaVersion: 4 }) + "\n");
