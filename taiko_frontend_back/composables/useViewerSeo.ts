import { computed } from "vue";

const CANONICAL_BASE_URL = "https://viewer.sakura-bot.cn";
const DEFAULT_OG_IMAGE = "https://static.sakura-bot.cn/banner.png";

type BreadcrumbJsonLdItem = {
  name: string;
  path: string;
};

type ViewerSeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  breadcrumbs?: BreadcrumbJsonLdItem[];
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
  useSeoMeta(() => ({
    title: payload.value.title,
    description: payload.value.description,
    ogTitle: payload.value.title,
    ogDescription: payload.value.description,
    ogImage: imageUrl.value,
    ogUrl: canonicalUrl.value
  }));
  useHead(() => {
    const scripts =
      payload.value.breadcrumbs && payload.value.breadcrumbs.length
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(buildBreadcrumbJsonLd(payload.value.breadcrumbs))
            }
          ]
        : [];
    return {
      link: [
        {
          rel: "canonical",
          href: canonicalUrl.value
        }
      ],
      meta: [
        {
          property: "og:title",
          content: payload.value.title
        },
        {
          property: "og:description",
          content: payload.value.description
        },
        {
          property: "og:image",
          content: imageUrl.value
        },
        {
          property: "og:url",
          content: canonicalUrl.value
        },
        {
          property: "og:type",
          content: "website"
        }
      ],
      script: scripts
    };
  });
};
