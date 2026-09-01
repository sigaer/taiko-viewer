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
      const spectrumRing = select(".growth-song-stage__spectrum-progress");
      const prismSweep = select(".growth-song-stage__prism-sweep");
      const spectrumAtmosphere = select(".near-spectrum-atmosphere__aurora, .near-spectrum-atmosphere__arc, .near-spectrum-atmosphere__beam");
      const nearMetric = select(".annual-profile-stage__primary em b");
      timeline
        .fromTo(spotlight, { autoAlpha: 0, clipPath: "polygon(49% 0,51% 0,57% 100%,43% 100%)" }, { autoAlpha: 1, clipPath: "polygon(45% 0,55% 0,76% 100%,24% 100%)", duration: .62, ease: "power2.out" }, 0)
        .fromTo(spectrumAtmosphere, { autoAlpha: 0, scale: .96 }, { autoAlpha: 1, scale: 1, duration: .7, stagger: .035, ease: "power2.out" }, .12)
        .to(title, { autoAlpha: 1, y: 0, duration: .42, ease: "power2.out" }, .06)
        .fromTo(visual, { autoAlpha: 0, y: 0, scale: .94 }, { autoAlpha: 1, y: 0, scale: 1, duration: .54, ease: "power2.out" }, .25)
        .fromTo(ticks, { autoAlpha: .12, scaleY: .2, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .13, stagger: .012, ease: "power2.out" }, .4)
        .fromTo(spectrumRing, { autoAlpha: .25, strokeDashoffset: 92 }, { autoAlpha: 1, strokeDashoffset: 0, duration: .62, ease: "power2.inOut" }, .55)
        .fromTo(finalTick, { autoAlpha: .06, scaleY: .12, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .22, ease: "power2.out" }, .92)
        .fromTo(prismSweep, { autoAlpha: .06, rotation: -88 }, { autoAlpha: 1, rotation: 58, duration: .62, ease: "power2.inOut" }, .83)
        .to(prismSweep, { autoAlpha: .58, rotation: 66, duration: .2, ease: "power1.out" }, 1.42)
        .fromTo(primary, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .44, ease: "power2.out" }, 1.05)
        .fromTo(nearMetric, { scale: 1, filter: "brightness(1) saturate(1)" }, { scale: 1.08, filter: "brightness(1.45) saturate(1.3)", duration: .14, ease: "power2.out" }, 1.2)
        .to(nearMetric, { scale: 1, filter: "brightness(1) saturate(1)", duration: .2, ease: "power2.inOut" }, 1.34)
        .fromTo(secondary, { autoAlpha: 0, y: -9 }, { autoAlpha: 1, y: 0, duration: .4, ease: "power2.out" }, 1.35)
        .to(copy, { autoAlpha: 1, y: 0, duration: .5, ease: "power2.out" }, 1.55);
      return;
    }

    const rim = select(".growth-song-stage__rim");
    const ticks = select(".growth-song-stage__tick-mark");
    const pressureLines = select(".challenge-pressure i");
    const impactRings = select(".growth-song-stage__impact-ring");
    const secondaryMetric = select(".annual-profile-stage__secondary strong");
    timeline
      .fromTo(spotlight, { autoAlpha: 0, clipPath: "polygon(49% 0,51% 0,56% 100%,44% 100%)" }, { autoAlpha: 1, clipPath: "polygon(48% 0,52% 0,64% 100%,36% 100%)", duration: .5, ease: "power2.out" }, 0)
      .to(title, { autoAlpha: 1, y: 0, duration: .38, ease: "power2.out" }, .08)
      .fromTo(pressureLines, { autoAlpha: 0, y: -48 }, { autoAlpha: .88, y: 0, duration: .54, stagger: .03, ease: "power2.out" }, .12)
      .fromTo(visual, { autoAlpha: 0, y: 0, scale: .9 }, { autoAlpha: 1, y: 0, scale: 1.035, duration: .34, ease: "back.out(1.55)" }, .25)
      .to(visual, { scale: 1, duration: .2, ease: "power2.inOut" }, .59)
      .fromTo(ticks, { autoAlpha: .3, scaleY: .42, transformOrigin: "50% 100%" }, { autoAlpha: 1, scaleY: 1, duration: .1, stagger: .006, ease: "power1.out" }, .48)
      .fromTo(rim, { scale: 1, filter: "brightness(1)" }, { scale: 1.026, filter: "brightness(1.8)", duration: .08, ease: "power2.out" }, .48)
      .to(rim, { scale: 1, filter: "brightness(1)", duration: .09, ease: "power1.in" }, .6)
      .to(rim, { scale: 1.022, filter: "brightness(1.65)", duration: .08, ease: "power2.out" }, .64)
      .to(rim, { scale: 1, filter: "brightness(1)", duration: .1, ease: "power1.in" }, .76)
      .fromTo(impactRings.slice(0, 1), { autoAlpha: .52, scale: 1 }, { autoAlpha: 0, scale: 1.25, duration: .64, ease: "power2.out" }, .68)
      .fromTo(impactRings.slice(1, 2), { autoAlpha: .5, scale: 1 }, { autoAlpha: 0, scale: 1.45, duration: .72, ease: "power2.out" }, .86)
      .fromTo(primary, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .38, ease: "power3.out" }, 1.02)
      .fromTo(secondary, { autoAlpha: 0, scale: .92 }, { autoAlpha: 1, scale: 1, duration: .36, ease: "power2.out" }, 1.2)
      .fromTo(secondaryMetric, { scale: 1, filter: "brightness(1)" }, { scale: 1.12, filter: "brightness(1.85)", duration: .12, ease: "power2.out" }, 1.3)
      .to(secondaryMetric, { scale: 1, filter: "brightness(1)", duration: .2, ease: "power2.inOut" }, 1.42)
      .to(copy, { autoAlpha: 1, y: 0, duration: .46, ease: "power2.out" }, 1.5);
  };
