import { gsap } from "gsap";
import { createAnnualTimeline, setAnnualTargets } from "~/utils/annualGsap";
import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from "vue";

type AnnualRoot = HTMLElement | { rootEl?: HTMLElement | null } | null;
export type AnnualReenterMode = "resume" | "restart" | "final";
type AnnualEffectCleanup = () => void;

export type AnnualMotionEffectScope = {
  requestFrame: (callback: FrameRequestCallback) => number;
  setTimeout: (callback: () => void, delay: number) => number;
  setInterval: (callback: () => void, delay: number) => number;
  listen: (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => AnnualEffectCleanup;
  onCleanup: (cleanup: AnnualEffectCleanup) => AnnualEffectCleanup;
};

export type AnnualTimelineOptions = {
  reenter?: AnnualReenterMode;
  configureTimeline?: (context: {
    root: HTMLElement;
    timeline: gsap.core.Timeline;
    group: (stage: string) => NodeListOf<HTMLElement>;
    select: (selector: string) => HTMLElement[];
    fallback: HTMLElement[];
  }) => void;
};

const resolveRoot = (value: AnnualRoot) => {
  if (typeof HTMLElement !== "undefined" && value instanceof HTMLElement) return value;
  return value?.rootEl || null;
};
const isSaveDataEnabled = () => process.client
  && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

const createEffectScope = () => {
  const cleanups = new Set<AnnualEffectCleanup>();
  let disposed = false;

  const onCleanup = (cleanup: AnnualEffectCleanup) => {
    if (disposed) cleanup();
    else cleanups.add(cleanup);
    return cleanup;
  };

  const requestFrame = (callback: FrameRequestCallback) => {
    let cleanup: AnnualEffectCleanup = () => undefined;
    const frame = window.requestAnimationFrame((timestamp) => {
      cleanups.delete(cleanup);
      callback(timestamp);
    });
    cleanup = () => window.cancelAnimationFrame(frame);
    onCleanup(cleanup);
    return frame;
  };

  const setAnnualTimeout = (callback: () => void, delay: number) => {
    let cleanup: AnnualEffectCleanup = () => undefined;
    const timer = window.setTimeout(() => {
      cleanups.delete(cleanup);
      callback();
    }, delay);
    cleanup = () => window.clearTimeout(timer);
    onCleanup(cleanup);
    return timer;
  };

  const setAnnualInterval = (callback: () => void, delay: number) => {
    const timer = window.setInterval(callback, delay);
    onCleanup(() => window.clearInterval(timer));
    return timer;
  };

  const listen = (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(type, listener, options);
    return onCleanup(() => target.removeEventListener(type, listener, options));
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of [...cleanups].reverse()) cleanup();
    cleanups.clear();
  };

  return {
    scope: {
      requestFrame,
      setTimeout: setAnnualTimeout,
      setInterval: setAnnualInterval,
      listen,
      onCleanup
    } satisfies AnnualMotionEffectScope,
    dispose
  };
};

export const useAnnualTimeline = (
  rootRef: Ref<AnnualRoot>,
  active: Ref<boolean>,
  reducedMotion: Ref<boolean>,
  options: AnnualTimelineOptions = {}
) => {
  let context: gsap.Context | null = null;
  let timeline: gsap.core.Timeline | null = null;
  let generation = 0;
  let documentVisible = true;
  let wasRunnable = false;
  let timelineCompleted = false;
  let activeEffectScope: ReturnType<typeof createEffectScope> | null = null;
  const activationHandlers = new Set<(scope: AnnualMotionEffectScope) => void | AnnualEffectCleanup>();
  const reenter = options.reenter || "resume";

  const motionDisabled = () => reducedMotion.value || isSaveDataEnabled();
  const canRun = () => active.value && documentVisible && !motionDisabled();

  const disposeActiveEffects = () => {
    activeEffectScope?.dispose();
    activeEffectScope = null;
  };

  const startActiveEffects = () => {
    if (!canRun() || activeEffectScope) return;
    activeEffectScope = createEffectScope();
    for (const activate of activationHandlers) {
      const cleanup = activate(activeEffectScope.scope);
      if (cleanup) activeEffectScope.scope.onCleanup(cleanup);
    }
  };

  const syncActiveEffects = () => {
    if (canRun()) startActiveEffects();
    else disposeActiveEffects();
  };

  const destroyTimeline = () => {
    timeline?.kill();
    timeline = null;
    context?.revert();
    context = null;
    timelineCompleted = false;
    wasRunnable = false;
  };

  const showStableState = (root: HTMLElement) => {
    const elements = root.querySelectorAll<HTMLElement>("[data-animate], [data-annual-stage]");
    setAnnualTargets(elements, { clearProps: "all", autoAlpha: 1, y: 0, scale: 1 });
  };

  const syncTimeline = () => {
    const runnable = canRun();
    if (!timeline) {
      wasRunnable = runnable;
      return;
    }

    if (motionDisabled()) {
      timeline.pause();
      const root = resolveRoot(rootRef.value);
      if (root) showStableState(root);
    } else if (!runnable) {
      timeline.pause();
    } else if (!wasRunnable && reenter === "restart") {
      timeline.restart();
    } else if (reenter === "final" && timelineCompleted) {
      timeline.progress(1).pause();
    } else {
      timeline.play();
    }
    wasRunnable = runnable;
  };

  const syncLifecycle = () => {
    syncTimeline();
    syncActiveEffects();
  };

  const build = async () => {
    const generationAtStart = ++generation;
    await nextTick();
    const root = resolveRoot(rootRef.value);
    if (!root || generationAtStart !== generation) return;

    destroyTimeline();
    const all = [...root.querySelectorAll<HTMLElement>("[data-animate], [data-annual-stage]")];
    const unique = [...new Set(all)];
    if (motionDisabled()) {
      showStableState(root);
      syncActiveEffects();
      return;
    }

    context = gsap.context(() => {
      const group = (stage: string) => root.querySelectorAll<HTMLElement>(`[data-annual-stage="${stage}"]`);
      const staged = ["title", "visual", "data", "copy"].flatMap((stage) => [...group(stage)]);
      const fallback = unique.filter((element) => !staged.includes(element));
      setAnnualTargets(unique, { autoAlpha: 0, y: 18 });
      timeline = createAnnualTimeline({
        paused: true,
        onComplete: () => { timelineCompleted = true; }
      });
      if (options.configureTimeline) {
        options.configureTimeline({
          root,
          timeline,
          group,
          select: (selector) => [...root.querySelectorAll<HTMLElement>(selector)],
          fallback
        });
      } else {
        timeline
          .to(group("title"), { autoAlpha: 1, y: 0, duration: .5, ease: "power2.out" }, .3)
          .to(group("visual"), { autoAlpha: 1, y: 0, duration: .58, stagger: .05, ease: "back.out(1.2)" }, .72)
          .to(group("data"), { autoAlpha: 1, y: 0, duration: .58, stagger: .08, ease: "power2.out" }, 1.18)
          .to(group("copy"), { autoAlpha: 1, y: 0, duration: .58, stagger: .06, ease: "power2.out" }, 1.95)
          .to(fallback, { autoAlpha: 1, y: 0, duration: .58, stagger: .055, ease: "power2.out" }, .3);
      }
    }, root);
    syncLifecycle();
  };

  const onActiveEffect = (activate: (scope: AnnualMotionEffectScope) => void | AnnualEffectCleanup) => {
    activationHandlers.add(activate);
    if (activeEffectScope) {
      const cleanup = activate(activeEffectScope.scope);
      if (cleanup) activeEffectScope.scope.onCleanup(cleanup);
    }
    return () => {
      activationHandlers.delete(activate);
      // Active registrations share one scope and are rebuilt together to avoid stale resources.
      disposeActiveEffects();
      startActiveEffects();
    };
  };

  const handleVisibilityChange = () => {
    documentVisible = !document.hidden;
    syncLifecycle();
  };

  watch([active, reducedMotion], ([, nextReduced], [, previousReduced]) => {
    if (nextReduced !== previousReduced) {
      timeline?.pause();
      disposeActiveEffects();
      void build();
    } else {
      syncLifecycle();
    }
  });
  watch(rootRef, () => void build(), { flush: "post" });

  onMounted(() => {
    documentVisible = !document.hidden;
    document.addEventListener("visibilitychange", handleVisibilityChange);
    syncLifecycle();
  });
  void build();

  onBeforeUnmount(() => {
    generation += 1;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    disposeActiveEffects();
    activationHandlers.clear();
    destroyTimeline();
  });

  return {
    buildAnnualTimeline: build,
    onAnnualMotionActive: onActiveEffect
  };
};
