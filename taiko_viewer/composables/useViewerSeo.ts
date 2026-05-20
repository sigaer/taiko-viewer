import { computed } from "vue";
import {
  SITE_TITLE,
  CANONICAL_BASE_URL,
  DEFAULT_OG_IMAGE,
  buildPageKeywords,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  formatViewerTitle
} from "~/utils/seo";

type BreadcrumbJsonLdItem = {
  name: string;
  path: string;
};

type ViewerSeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
  breadcrumbs?: BreadcrumbJsonLdItem[];
  siteSchema?: boolean;
};

const normalizeCanonicalPath = (path: string) => {
  const normalized = `/${String(path || "/")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")}`;
  return normalized === "//" ? "/" : normalized;
};

const buildCanonicalUrl = (path: string) => `${CANONICAL_BASE_URL}${normalizeCanonicalPath(path)}`;

const buildBreadcrumbJsonLd = (items: BreadcrumbJsonLdItem[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: buildCanonicalUrl(item.path)
  }))
});

export const useViewerSeo = (input: MaybeRefOrGetter<ViewerSeoInput>) => {
  const payload = computed(() => toValue(input));
  const canonicalUrl = computed(() => buildCanonicalUrl(payload.value.path));
  const imageUrl = computed(() => payload.value.image || DEFAULT_OG_IMAGE);
  const pageTitle = computed(() => formatViewerTitle(payload.value.title));
  const keywordsContent = computed(() => buildPageKeywords(payload.value.keywords || []));

  useSeoMeta(() => ({
    title: pageTitle.value,
    description: payload.value.description,
    keywords: keywordsContent.value,
    ogTitle: pageTitle.value,
    ogDescription: payload.value.description,
    ogImage: imageUrl.value,
    ogUrl: canonicalUrl.value,
    ogSiteName: SITE_TITLE
  }));

  useHead(() => {
    const scripts: Array<{ type: string; children: string }> = [];
    if (payload.value.siteSchema) {
      scripts.push(
        { type: "application/ld+json", children: JSON.stringify(buildWebSiteJsonLd()) },
        { type: "application/ld+json", children: JSON.stringify(buildOrganizationJsonLd()) }
      );
    }
    if (payload.value.breadcrumbs?.length) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify(buildBreadcrumbJsonLd(payload.value.breadcrumbs))
      });
    }
    return {
      link: [{ rel: "canonical", href: canonicalUrl.value }],
      meta: [{ property: "og:type", content: "website" }],
      script: scripts
    };
  });
};
