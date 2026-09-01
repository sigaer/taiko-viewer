import type { AnnualTimelineOptions } from "~/composables/useAnnualTimeline";

export type GrowthMotionPreset = "growth-near-rainbow" | "growth-challenge-knock";

type ConfigureAnnualTimeline = NonNullable<AnnualTimelineOptions["configureTimeline"]>;

export const createAnnualGrowthTimeline = (resolvePreset: () => GrowthMotionPreset): ConfigureAnnualTimeline =>
  ({ timeline, group, select }) => {
    const title = group("title");
    const visual = select(".annual-profile-stage__stage-motion");
    const data = [...group("data")];
    const primary = data.filter((element) => element.classList.contains("annual-profile-stage__primary"));
    const secondary = data.filter((element) => element.classList.contains("annual-profile-stage__secondary"));
    const copy = group("copy");
    const spotlight = select(".annual-profile-stage__spotlight");

    if (resolvePreset() === "growth-near-rainbow") {
      const ticks = select(".growth-song-stage__tick:not(.is-final-tick) .growth-song-stage__tick-mark");
      const finalTick = select(".growth-song-stage__tick.is-final-tick .growth-song-stage__tick-mark");
      const prismSweep = select(".growth-song-stage__prism-sweep");
      timeline
        .fromTo(spotlight, { autoAlpha: 0, clipPath: "polygon(49% 0,51% 0,57% 100%,43% 100%)" }, { autoAlpha: 1, clipPath: "polygon(45% 0,55% 0,76% 100%,24% 100%)", duration: .62, ease: "power2.out" }, 0)
        .to(title, { autoAlpha: 1, y: 0, duration: .42, ease: "power2.out" }, .06)
        .fromTo(visual, { autoAlpha: 0, y: 0, scale: .94 }, { autoAlpha: 1, y: 0, scale: 1, duration: .54, ease: "power2.out" }, .18)
        .fromTo(ticks, { autoAlpha: .16, scaleY: .25, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .13, stagger: .012, ease: "power2.out" }, .42)
        .fromTo(finalTick, { autoAlpha: .08, scaleY: .15, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .2, ease: "power2.out" }, .84)
        .fromTo(prismSweep, { autoAlpha: .08, rotation: -82 }, { autoAlpha: .96, rotation: 42, duration: .62, ease: "power2.inOut" }, .74)
        .to(prismSweep, { autoAlpha: .52, rotation: 50, duration: .2, ease: "power1.out" }, 1.34)
        .fromTo(primary, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .44, ease: "power2.out" }, .95)
        .fromTo(secondary, { autoAlpha: 0, y: -9 }, { autoAlpha: 1, y: 0, duration: .4, ease: "power2.out" }, 1.15)
        .to(copy, { autoAlpha: 1, y: 0, duration: .5, ease: "power2.out" }, 1.38);
      return;
    }

    const rim = select(".growth-song-stage__rim");
    const ticks = select(".growth-song-stage__tick-mark");
    const pressureLines = select(".challenge-pressure i");
    const impactRings = select(".growth-song-stage__impact-ring");
    const secondaryMetric = select(".annual-profile-stage__secondary strong");
    timeline
      .fromTo(spotlight, { autoAlpha: 0, clipPath: "polygon(48% 0,52% 0,61% 100%,39% 100%)" }, { autoAlpha: 1, clipPath: "polygon(42% 0,58% 0,82% 100%,18% 100%)", duration: .5, ease: "power2.out" }, 0)
      .to(title, { autoAlpha: 1, y: 0, duration: .38, ease: "power2.out" }, .08)
      .fromTo(pressureLines, { autoAlpha: 0, y: -34 }, { autoAlpha: .78, y: 0, duration: .5, stagger: .035, ease: "power2.out" }, .12)
      .fromTo(visual, { autoAlpha: 0, y: 0, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1.02, duration: .34, ease: "back.out(1.45)" }, .28)
      .to(visual, { scale: 1, duration: .2, ease: "power2.inOut" }, .62)
      .fromTo(ticks, { autoAlpha: .3, scaleY: .42, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .1, stagger: .006, ease: "power1.out" }, .48)
      .fromTo(rim, { scale: 1, filter: "brightness(1)" }, { scale: 1.018, filter: "brightness(1.55)", duration: .08, ease: "power2.out" }, .52)
      .to(rim, { scale: 1, filter: "brightness(1)", duration: .09, ease: "power1.in" }, .6)
      .to(rim, { scale: 1.014, filter: "brightness(1.42)", duration: .08, ease: "power2.out" }, .68)
      .to(rim, { scale: 1, filter: "brightness(1)", duration: .1, ease: "power1.in" }, .76)
      .fromTo(impactRings.slice(0, 1), { autoAlpha: .45, scale: 1 }, { autoAlpha: 0, scale: 1.18, duration: .6, ease: "power2.out" }, .72)
      .fromTo(impactRings.slice(1, 2), { autoAlpha: .45, scale: 1 }, { autoAlpha: 0, scale: 1.28, duration: .66, ease: "power2.out" }, .86)
      .fromTo(primary, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .38, ease: "power3.out" }, .95)
      .fromTo(secondary, { autoAlpha: 0, scale: .94 }, { autoAlpha: 1, scale: 1, duration: .36, ease: "power2.out" }, 1.14)
      .fromTo(secondaryMetric, { scale: 1, filter: "brightness(1)" }, { scale: 1.08, filter: "brightness(1.55)", duration: .12, ease: "power2.out" }, 1.22)
      .to(secondaryMetric, { scale: 1, filter: "brightness(1)", duration: .18, ease: "power2.inOut" }, 1.34)
      .to(copy, { autoAlpha: 1, y: 0, duration: .46, ease: "power2.out" }, 1.34);
  };
