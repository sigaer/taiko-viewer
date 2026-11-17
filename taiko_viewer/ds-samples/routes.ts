// Route registration for the design-system sample pages (P0-26, D0-1 = A).
// Used only by the `pages:extend` hook in nuxt.config.ts; runs in Node at config time, never bundled.
//
// /_ds              ds-samples/index.vue
// /_ds/<slug>       ds-samples/sections/<NN->slug.vue   (auto-discovered; an optional numeric prefix only orders the list)
//
// The pages are registered only in `nuxt dev` or when TAIKO_DS_SAMPLES=1. A normal production build has neither the
// routes nor their code. They are outside pages/, so viewerPageRoutePatterns (traffic statistics) never sees them,
// and server/services/content/sitemap.ts uses a fixed list, so the sitemap never sees them either.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const DS_SAMPLES_ROUTE = "/_ds";
export const DS_SAMPLES_ROUTE_NAME = "ds-samples";

export interface DsSamplePage {
  name: string;
  path: string;
  file: string;
  meta: { layout: false; dsSample: string };
}

export function dsSamplesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TAIKO_DS_SAMPLES === "1" || env.NODE_ENV === "development";
}

/** `10-tokens.vue` → `tokens`; files starting with `_` are helpers, not sections. */
export function sectionSlug(file: string): string | null {
  if (!file.endsWith(".vue") || file.startsWith("_")) return null;
  const slug = file.replace(/\.vue$/, "").replace(/^\d+-/, "");
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

export function dsSamplePages(rootDir: string): DsSamplePage[] {
  const dir = join(rootDir, "ds-samples");
  const pages: DsSamplePage[] = [
    { name: DS_SAMPLES_ROUTE_NAME, path: DS_SAMPLES_ROUTE, file: join(dir, "index.vue"), meta: { layout: false, dsSample: "" } }
  ];
  const sections = join(dir, "sections");
  if (!existsSync(sections)) return pages;
  const seen = new Set<string>();
  for (const file of readdirSync(sections).sort()) {
    const slug = sectionSlug(file);
    if (!slug) continue;
    if (seen.has(slug)) throw new Error(`duplicate design-system sample slug: ${slug} (${file})`);
    seen.add(slug);
    pages.push({
      name: `${DS_SAMPLES_ROUTE_NAME}-${slug}`,
      path: `${DS_SAMPLES_ROUTE}/${slug}`,
      file: join(sections, file),
      meta: { layout: false, dsSample: slug }
    });
  }
  return pages;
}
