// Only the phone-sized Android Firefox default Shell owns an inner scroll port.
export function viewerScrollElement(): HTMLElement | null {
  if (typeof document === "undefined" || !document.documentElement.classList.contains("firefox-android") || !window.matchMedia("(max-width: 767px)").matches) return null;
  return document.querySelector<HTMLElement>(".rework-shell > .rework-main");
}
export function viewerScrollY(): number {
  return viewerScrollElement()?.scrollTop ?? (typeof window === "undefined" ? 0 : window.scrollY);
}
export function scrollViewerTo(options: ScrollToOptions): void {
  if (typeof window === "undefined") return;
  (viewerScrollElement() || window).scrollTo(options);
}
export function viewerScrollTarget(): EventTarget {
  return viewerScrollElement() || window;
}
