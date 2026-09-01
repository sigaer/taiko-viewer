import type { AnnualTimelineOptions } from "~/composables/useAnnualTimeline";

export type GrowthMotionPreset = "growth-near-rainbow" | "growth-challenge-knock";

type ConfigureAnnualTimeline = NonNullable<AnnualTimelineOptions["configureTimeline"]>;

export const createAnnualGrowthTimeline = (resolvePreset: () => GrowthMotionPreset): ConfigureAnnualTimeline =>
  ({ timeline, group, select }) => {
    const title = group("title");
    const visualStage = group("visual");
    const visual = select(".annual-profile-stage__center");
    const data = [...group("data")];
    const primary = data.filter((element) => element.classList.contains("annual-profile-stage__primary"));
    const secondary = data.filter((element) => element.classList.contains("annual-profile-stage__secondary"));
    const copy = group("copy");
    const spotlight = select(".annual-profile-stage__spotlight");

    if (resolvePreset() === "growth-near-rainbow") {
      const ticks = select(".growth-song-stage__tick:not(.is-final-tick)");
      const finalTick = select(".growth-song-stage__tick.is-final-tick");
      const prismSweep = select(".growth-song-stage__prism-sweep");
      timeline
        .fromTo(spotlight, { autoAlpha: 0, clipPath: "polygon(49% 0,51% 0,57% 100%,43% 100%)" }, { autoAlpha: 1, clipPath: "polygon(45% 0,55% 0,76% 100%,24% 100%)", duration: .62, ease: "power2.out" }, 0)
        .to(title, { autoAlpha: 1, y: 0, duration: .42, ease: "power2.out" }, .06)
        .to(visualStage, { autoAlpha: 1, y: 0, duration: .01 }, .18)
        .fromTo(visual, { autoAlpha: 0, y: 0, scale: .94 }, { autoAlpha: 1, y: 0, scale: 1, duration: .54, ease: "power2.out" }, .18)
        .fromTo(ticks, { autoAlpha: .16, scaleY: .25, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .13, stagger: .012, ease: "power2.out" }, .42)
        .fromTo(finalTick, { autoAlpha: .08, scaleY: .15, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .2, ease: "power2.out" }, .84)
        .fromTo(prismSweep, { autoAlpha: 0, rotation: -72 }, { autoAlpha: .92, rotation: 38, duration: .54, ease: "power2.inOut" }, .72)
        .to(prismSweep, { autoAlpha: .34, duration: .24, ease: "power1.out" }, 1.18)
        .fromTo(primary, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .44, ease: "power2.out" }, .95)
        .fromTo(secondary, { autoAlpha: 0, y: -9 }, { autoAlpha: 1, y: 0, duration: .4, ease: "power2.out" }, 1.15)
        .to(copy, { autoAlpha: 1, y: 0, duration: .5, ease: "power2.out" }, 1.38);
      return;
    }

    const ticks = select(".growth-song-stage__tick");
    const pressureLines = select(".challenge-pressure i");
    const impactRings = select(".growth-song-stage__impact-ring");
    timeline
      .fromTo(spotlight, { autoAlpha: 0, clipPath: "polygon(48% 0,52% 0,61% 100%,39% 100%)" }, { autoAlpha: 1, clipPath: "polygon(42% 0,58% 0,82% 100%,18% 100%)", duration: .5, ease: "power2.out" }, 0)
      .to(title, { autoAlpha: 1, y: 0, duration: .38, ease: "power2.out" }, .08)
      .fromTo(pressureLines, { autoAlpha: 0, y: -18 }, { autoAlpha: .72, y: 0, duration: .46, stagger: .035, ease: "power2.out" }, .16)
      .to(visualStage, { autoAlpha: 1, y: 0, duration: .01 }, .32)
      .fromTo(visual, { autoAlpha: 0, y: 0, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1.025, duration: .34, ease: "power3.out" }, .32)
      .to(visual, { scale: 1, duration: .14, ease: "power2.inOut" }, .66)
      .fromTo(ticks, { autoAlpha: .28, scaleY: .45, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .08, stagger: .006, ease: "power1.out" }, .58)
      .fromTo(impactRings, { autoAlpha: 0, scale: .93 }, { autoAlpha: .72, scale: 1.04, duration: .13, stagger: .06, ease: "power2.out" }, .58)
      .to(impactRings, { autoAlpha: 0, scale: 1.09, duration: .16, stagger: .04, ease: "power1.out" }, .75)
      .fromTo(primary, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .36, ease: "power3.out" }, .85)
      .fromTo(secondary, { autoAlpha: 0, scale: .9 }, { autoAlpha: 1, scale: 1, duration: .42, ease: "power2.out" }, 1.08)
      .to(copy, { autoAlpha: 1, y: 0, duration: .46, ease: "power2.out" }, 1.34);
  };
