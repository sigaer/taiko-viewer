import type { HomeResolverStatus, HomeState } from "~/utils/homeState";

export type HomePresentation = "loading" | "guest" | "public_error" | "existing";

export const resolveHomePresentation = (
  status: HomeResolverStatus,
  homeState: HomeState | null
): HomePresentation => {
  if (status === "loading") return "loading";
  if (status === "error") return "public_error";
  return homeState === "guest" ? "guest" : "existing";
};

export const shouldHideHomeChrome = (
  navKey: unknown,
  presentation: HomePresentation
) => navKey === "/" && (presentation === "guest" || presentation === "public_error");
