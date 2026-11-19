import type { Router } from "vue-router";
import { viewerScrollElement } from "./viewer-scroll.ts";

const STORAGE_KEY = "viewer-firefox-scroll-v1";
const LIMIT = 60;
type Position = { top: number; left: number };

export function createFirefoxScrollStore(storage?: Pick<Storage, "getItem" | "setItem">) {
  const entries = new Map<string, Position>();
  const valid = (p: Position) => p && Number.isFinite(p.top) && p.top >= 0 && Number.isFinite(p.left) && p.left >= 0;
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw && raw.length < 131072) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) for (const row of list.slice(-LIMIT)) {
        if (Array.isArray(row) && typeof row[0] === "string" && row[0].length <= 2100 && valid(row[1])) entries.set(row[0], { top: row[1].top, left: row[1].left });
      }
    }
  } catch { /* Private browsing / storage denial must not break navigation. */ }
  return {
    get: (key: string) => entries.get(key),
    set(key: string, value: Position) {
      if (key.length > 2100 || !valid(value)) return;
      entries.delete(key);
      entries.set(key, { ...value });
      while (entries.size > LIMIT) entries.delete(entries.keys().next().value!);
    },
    persist() { try { storage?.setItem(STORAGE_KEY, JSON.stringify([...entries])); } catch { /* quota / disabled storage */ } }
  };
}

// Called after Nuxt's initial router setup, which installs its own scrollBehavior.
// Delegate to that behavior first so page loading/transition completion and native
// browser semantics stay owned by Nuxt. Only the Firefox phone Shell consumes it.
export function installFirefoxScrollRestoration(router: Router) {
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* optional */ }
  const store = createFirefoxScrollStore(storage);
  const key = (path: string) => `${window.history.state?.position ?? 0}:${path}`;
  let currentKey = key(router.currentRoute.value.fullPath);
  let moving = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelRestore = () => {};
  const capture = () => {
    const el = viewerScrollElement();
    if (el && !moving) store.set(currentKey, { top: el.scrollTop, left: el.scrollLeft });
  };
  const persist = () => { capture(); store.persist(); };
  const onScroll = (event: Event) => {
    if (event.target !== viewerScrollElement() || moving) return;
    capture();
    clearTimeout(timer);
    timer = setTimeout(() => store.persist(), 150);
  };
  const restore = (position: Position) => {
    cancelRestore();
    const el = viewerScrollElement();
    if (!el) { moving = false; return; }
    // Async page data may not have restored a long list yet. Wait a bounded time
    // for its content, but stop immediately on user interaction or navigation.
    moving = true;
    let observer: ResizeObserver | undefined;
    let frame: number;
    let deadline: ReturnType<typeof setTimeout>;
    const finish = () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      for (const name of ["pointerdown", "touchstart", "wheel", "keydown"]) el.removeEventListener(name, finish);
      moving = false;
      cancelRestore = () => {};
    };
    const apply = (force = false) => {
      if (!el.isConnected) return finish();
      if (force || el.scrollHeight - el.clientHeight >= position.top - 1) {
        el.scrollTo({ ...position, behavior: "instant" });
        finish();
      }
    };
    cancelRestore = finish;
    for (const name of ["pointerdown", "touchstart", "wheel", "keydown"]) el.addEventListener(name, finish, { passive: true });
    if (typeof ResizeObserver !== "undefined" && el.firstElementChild) {
      observer = new ResizeObserver(() => apply());
      observer.observe(el.firstElementChild);
    }
    frame = requestAnimationFrame(() => apply());
    deadline = setTimeout(() => apply(true), 2000);
  };
  const removeBefore = router.beforeEach(() => { cancelRestore(); capture(); store.persist(); moving = true; });
  const removeAfter = router.afterEach((to, _from, failure) => {
    if (failure) { moving = false; return; }
    currentKey = key(to.fullPath);
  });
  const native = router.options.scrollBehavior;
  const behavior: NonNullable<Router["options"]["scrollBehavior"]> = async (to, from, saved) => {
    const result = await native?.(to, from, saved);
    // Ignore a late resolution from a page that has already been superseded.
    if (router.currentRoute.value.fullPath !== to.fullPath) return false;
    if (!viewerScrollElement()) { moving = false; return result; }
    const previous = saved ? store.get(key(to.fullPath)) : undefined;
    if (previous) restore(previous);
    else if (to.hash && result !== false) {
      try { document.getElementById(decodeURIComponent(to.hash.slice(1)))?.scrollIntoView({ block: "start", behavior: "instant" }); } catch { /* malformed hash */ }
      moving = false;
    } else if (result && typeof result === "object" && !("el" in result)) restore({ top: result.top ?? 0, left: result.left ?? 0 });
    else moving = false;
    return false;
  };
  router.options.scrollBehavior = behavior;
  document.addEventListener("scroll", onScroll, true);
  window.addEventListener("pagehide", persist);
  const reloaded = store.get(currentKey);
  if (reloaded) restore(reloaded);
  else if (router.currentRoute.value.hash && viewerScrollElement()) {
    try { document.getElementById(decodeURIComponent(router.currentRoute.value.hash.slice(1)))?.scrollIntoView({ block: "start" }); } catch { /* malformed hash */ }
  }
  return () => {
    cancelRestore();
    persist();
    clearTimeout(timer);
    removeBefore();
    removeAfter();
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("pagehide", persist);
    if (router.options.scrollBehavior === behavior) router.options.scrollBehavior = native;
  };
}
