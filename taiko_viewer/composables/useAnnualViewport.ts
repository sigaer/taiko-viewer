import { nextTick, onBeforeUnmount, onMounted } from 'vue';

// A keyboard changes the visual viewport, not the story's design space. Keep
// that space stable while editing; give portals their own visible rectangle.
export const useAnnualViewport = (resync: () => void) => {
  let stageHeight = 0;
  let stageWidth = 0;
  let frame = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let blurTimer: ReturnType<typeof setTimeout> | undefined;
  let editing = false;
  let previous: Array<[string, string]> = [];
  const vars = ['--annual-stage-height', '--annual-visual-height', '--annual-visual-top', '--annual-visual-bottom'];
  const editable = (target: EventTarget | null) => target instanceof HTMLElement && (target.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=button]),[contenteditable=true]'));
  const measure = () => {
    frame = 0;
    const viewport = window.visualViewport;
    if (viewport && Math.abs(viewport.scale - 1) > .05) return;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    const width = window.innerWidth;
    const root = document.documentElement.style;
    root.setProperty('--annual-visual-height', `${height}px`);
    root.setProperty('--annual-visual-top', `${top}px`);
    root.setProperty('--annual-visual-bottom', `${Math.max(0, window.innerHeight - height - top)}px`);
    if (!stageHeight || !editing || Math.abs(width - stageWidth) > 80) {
      const changed = Math.abs(stageHeight - height) > 1 || stageWidth !== width;
      stageHeight = height; stageWidth = width;
      root.setProperty('--annual-stage-height', `${height}px`);
      if (changed) void nextTick(resync);
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const stable = () => {
    schedule(); clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { measure(); resync(); }, 180);
  };
  const focusIn = (event: FocusEvent) => { if (editable(event.target)) { clearTimeout(blurTimer); editing = true; schedule(); } };
  const focusOut = () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => { editing = editable(document.activeElement); stable(); }, 400);
  };
  onMounted(() => {
    previous = vars.map(name => [name, document.documentElement.style.getPropertyValue(name)]);
    measure();
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', stable);
    window.addEventListener('orientationchange', stable);
    window.addEventListener('pageshow', stable);
    document.addEventListener('visibilitychange', stable);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
  });
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame); clearTimeout(settleTimer); clearTimeout(blurTimer);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', stable);
    window.removeEventListener('orientationchange', stable);
    window.removeEventListener('pageshow', stable);
    document.removeEventListener('visibilitychange', stable);
    document.removeEventListener('focusin', focusIn);
    document.removeEventListener('focusout', focusOut);
    previous.forEach(([name, value]) => value ? document.documentElement.style.setProperty(name, value) : document.documentElement.style.removeProperty(name));
  });
};
