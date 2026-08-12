import { buildAnalyticsRouteTemplate } from "~/utils/analytics";

type ViewerMetric = {
  name: string;
  id: string;
  value: number;
  delta: number;
  rating: string;
  navigationType: string;
};

type ViewerNavigator = Navigator & {
  connection?: { effectiveType?: string; saveData?: boolean };
};

const getDeviceCategory = () => {
  const width = window.innerWidth;
  if (width <= 767) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
};

const shouldSample = (rate: number, version: string) => {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  const key = `viewer-web-vitals-sample:${version}`;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored !== null) return stored === "1";
    const sampled = Math.random() < rate;
    sessionStorage.setItem(key, sampled ? "1" : "0");
    return sampled;
  } catch {
    return Math.random() < rate;
  }
};

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const measurementId = String(runtimeConfig.public.googleAnalyticsId || "").trim();
  const sampleRate = Math.min(1, Math.max(0, Number(runtimeConfig.public.webVitalsSampleRate || 0)));
  const appVersion = String(runtimeConfig.public.appVersion || "dev");

  if (!measurementId || !shouldSample(sampleRate, appVersion)) return;

  nuxtApp.hook("app:mounted", () => {
    window.setTimeout(async () => {
      const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");
      const report = (metric: ViewerMetric) => {
        if (typeof window.gtag !== "function") return;
        const connection = (navigator as ViewerNavigator).connection;
        window.gtag("event", "web_vital", {
          metric_name: metric.name,
          metric_id: metric.id,
          metric_value: metric.name === "CLS" ? Math.round(metric.value * 1000) : Math.round(metric.value),
          metric_delta: metric.name === "CLS" ? Math.round(metric.delta * 1000) : Math.round(metric.delta),
          metric_rating: metric.rating,
          navigation_type: metric.navigationType,
          route_template: buildAnalyticsRouteTemplate(window.location.pathname),
          device_category: getDeviceCategory(),
          effective_connection_type: connection?.effectiveType || "unknown",
          save_data: connection?.saveData ? "yes" : "no",
          app_version: appVersion,
          non_interaction: true
        });
      };

      onCLS(report);
      onFCP(report);
      onINP(report);
      onLCP(report);
      onTTFB(report);
    }, 1500);
  });
});
