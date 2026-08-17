import { gsap } from "gsap";
import { nextTick, onBeforeUnmount, watch, type Ref } from "vue";

type AnnualRoot = HTMLElement | { rootEl?: HTMLElement | null } | null;

const resolveRoot = (value: AnnualRoot) => value instanceof HTMLElement ? value : value?.rootEl || null;

export const useAnnualTimeline = (
  rootRef: Ref<AnnualRoot>,
  active: Ref<boolean>,
  reducedMotion: Ref<boolean>
) => {
  let timeline: gsap.core.Timeline | null = null;
  let generation = 0;
  const saveData = () => process.client && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

  const build = async () => {
    const generationAtStart = ++generation;
    await nextTick();
    const root = resolveRoot(rootRef.value);
    if (!root || generationAtStart !== generation) return;
    timeline?.kill();
    const all = [...root.querySelectorAll<HTMLElement>("[data-animate], [data-annual-stage]")];
    const unique = [...new Set(all)];
    timeline = gsap.timeline({ paused: true });
    if (reducedMotion.value || saveData()) {
      gsap.set(unique, { clearProps: "all", autoAlpha: 1, y: 0, scale: 1 });
      return;
    }

    const group = (stage: string) => root.querySelectorAll<HTMLElement>(`[data-annual-stage="${stage}"]`);
    const staged = ["title", "visual", "data", "copy"].flatMap((stage) => [...group(stage)]);
    const fallback = unique.filter((element) => !staged.includes(element));
    gsap.set(unique, { autoAlpha: 0, y: 18 });
    timeline
      .to(group("title"), { autoAlpha: 1, y: 0, duration: .5, ease: "power2.out" }, .3)
      .to(group("visual"), { autoAlpha: 1, y: 0, duration: .58, stagger: .05, ease: "back.out(1.2)" }, .72)
      .to(group("data"), { autoAlpha: 1, y: 0, duration: .58, stagger: .08, ease: "power2.out" }, 1.18)
      .to(group("copy"), { autoAlpha: 1, y: 0, duration: .58, stagger: .06, ease: "power2.out" }, 1.95)
      .to(fallback, { autoAlpha: 1, y: 0, duration: .58, stagger: .055, ease: "power2.out" }, .3);
    if (active.value) timeline.play(0);
  };

  watch([active, reducedMotion], ([isActive]) => {
    if (!timeline) {
      void build();
      return;
    }
    if (reducedMotion.value || saveData()) {
      timeline.pause();
      const root = resolveRoot(rootRef.value);
      if (root) gsap.set(root.querySelectorAll<HTMLElement>("[data-animate], [data-annual-stage]"), { clearProps: "all", autoAlpha: 1, y: 0, scale: 1 });
    } else if (isActive) {
      timeline.play();
    } else {
      timeline.pause();
    }
  });
  watch(rootRef, () => void build(), { flush: "post" });
  void build();

  onBeforeUnmount(() => {
    generation += 1;
    timeline?.kill();
    timeline = null;
  });

  return { buildAnnualTimeline: build };
};
