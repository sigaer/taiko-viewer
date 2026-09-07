export type AnnualNavigationMotion = {
  visited: Set<number>;
  direction: "forward" | "backward" | "initial";
};

export const ANNUAL_NAVIGATION_MOTION_KEY = Symbol("annual-navigation-motion");
