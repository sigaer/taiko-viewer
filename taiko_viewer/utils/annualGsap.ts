import { gsap } from 'gsap';

// Only annual timelines opt in. Optional sections may legitimately have no DOM;
// retain explicit positions of the remaining stages, without empty tweens.
export const createAnnualTimeline = (vars?: gsap.TimelineVars): gsap.core.Timeline => {
  const timeline = gsap.timeline(vars);
  for (const method of ['to', 'from', 'fromTo', 'set'] as const) {
    const original = timeline[method].bind(timeline) as (...args: any[]) => gsap.core.Timeline;
    (timeline as any)[method] = (targets: gsap.TweenTarget, ...args: any[]) => {
      const elements = gsap.utils.toArray(targets);
      return elements.length ? original(elements, ...args) : timeline;
    };
  }
  return timeline;
};

export const setAnnualTargets = (targets: gsap.TweenTarget, vars: gsap.TweenVars) => {
  const elements = gsap.utils.toArray(targets);
  if (elements.length) gsap.set(elements, vars);
};

export const requireAnnualTargets = (root: HTMLElement, selectors: string[]) => {
  const missing = selectors.filter(selector => !root.querySelector(selector));
  if (!missing.length) return true;
  if (import.meta.dev) console.warn('[annual-motion] Missing required targets', root.className, missing);
  return false;
};
