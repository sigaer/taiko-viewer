// Design System V1.3 breakpoints and bottom-space contract (04 §11 → V1.2 §5.1, §5.3a).
// For new design-system code only; existing pages keep their own breakpoints (720, 960, …).
// Layout follows CSS media queries; these numbers exist for scripts, tests and media-query strings,
// not for choosing the rendered structure in JS (that would break hydration).

/** Upper bounds (inclusive, px) of the three ranges below desktop. */
export const DS_BREAKPOINTS = Object.freeze({
  /** ≤767: phone */
  mobile: 767,
  /** 768–1099: tablet */
  tablet: 1099,
  /** 1100–1239: narrow desktop; ≥1240 is wide desktop */
  desktop: 1239
});

export type DsViewportRange = "mobile" | "tablet" | "desktop" | "wide";

/** Media-query strings matching the CSS the spec prescribes. */
export const DS_MEDIA = Object.freeze({
  mobile: `(max-width: ${DS_BREAKPOINTS.mobile}px)`,
  tabletDown: `(max-width: ${DS_BREAKPOINTS.tablet}px)`,
  desktopDown: `(max-width: ${DS_BREAKPOINTS.desktop}px)`,
  fromTablet: `(min-width: ${DS_BREAKPOINTS.mobile + 1}px)`,
  fromDesktop: `(min-width: ${DS_BREAKPOINTS.tablet + 1}px)`,
  wide: `(min-width: ${DS_BREAKPOINTS.desktop + 1}px)`
});

/** Which range a viewport width falls in (for tests and scripts). */
export function dsViewportRange(width: number): DsViewportRange {
  if (!Number.isFinite(width) || width <= DS_BREAKPOINTS.mobile) return "mobile";
  if (width <= DS_BREAKPOINTS.tablet) return "tablet";
  if (width <= DS_BREAKPOINTS.desktop) return "desktop";
  return "wide";
}

/**
 * Bottom-space custom properties (declared in assets/css/ds/tokens.css under html.ds-preview).
 * --shell-bottom: space taken by the fixed shell (bottom tab bar + safe area on phones);
 * --dock-h: height of the page's own fixed bottom bar (0 when none);
 * --kb-h: height covered by the soft keyboard (0 when none).
 * Fixed bottom elements position themselves from these; they never hard-code the tab-bar height.
 * Writers (shell, useDock, keyboard inset) belong to stage 1 / the community stage.
 */
export const DS_BOTTOM_SPACE = Object.freeze({
  shellBottom: "--shell-bottom",
  dockHeight: "--dock-h",
  keyboardHeight: "--kb-h"
});

/** Default values of the bottom-space properties and the layout sizes they derive from (px unless noted). */
export const DS_LAYOUT = Object.freeze({
  tabBarHeight: 62,
  barHeight: 60,
  barHeightMobile: 52,
  subtabHeightMobile: 44,
  railWidth: 84,
  contentMax: 1480,
  gutter: 28,
  gutterMobile: 16,
  hit: 44
});
