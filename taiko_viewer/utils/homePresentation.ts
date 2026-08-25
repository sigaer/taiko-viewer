import type { HomeResolverStatus, HomeState } from "~/utils/homeState";

export type HomePresentation = "loading" | "guest" | "public_error" | "authenticated";

export const resolveHomePresentation = (
  status: HomeResolverStatus,
  homeState: HomeState | null
): HomePresentation => {
  if (status === "loading") return "loading";
  if (status === "error") return "public_error";
  return homeState === "guest" ? "guest" : "authenticated";
};

export const shouldHideHomeChrome = (
  navKey: unknown,
  presentation: HomePresentation
) => navKey === "/" && presentation !== "loading";

export const shouldShowPersonalRecommendation = (
  pending: boolean,
  hasRecommendation: boolean
) => pending || hasRecommendation;
