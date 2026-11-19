// The registered sample sections (ds-samples/routes.ts), in file-prefix order and grouped by prefix range.
// Groups follow the numbering convention in docs/design-system/viewer-ds.md §6:
//   10–29 tokens and type · 30–69 controls · 70–79 asset components · 80–99 notes and charts.
import { computed } from "vue";
import { useRouter } from "#imports";

export interface DsSection {
  slug: string;
  order: number;
}

export const DS_SECTION_GROUPS = [
  { id: "tokens-type", from: 0, to: 29 },
  { id: "controls", from: 30, to: 69 },
  { id: "asset-components", from: 70, to: 79 },
  { id: "notes-charts", from: 80, to: 999 }
] as const;

export function useDsSections() {
  const router = useRouter();
  const sections = computed<DsSection[]>(() => {
    const bySlug = new Map<string, number>();
    for (const route of router.getRoutes()) {
      const slug = route.meta?.dsSample;
      if (typeof slug === "string" && slug) bySlug.set(slug, Number(route.meta?.dsOrder ?? 999));
    }
    return [...bySlug].map(([slug, order]) => ({ slug, order })).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  });
  const groups = computed(() =>
    DS_SECTION_GROUPS.map((g) => ({ id: g.id, sections: sections.value.filter((s) => s.order >= g.from && s.order <= g.to) })).filter((g) => g.sections.length)
  );
  return { sections, groups };
}
