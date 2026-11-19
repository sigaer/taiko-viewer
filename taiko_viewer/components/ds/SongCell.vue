<script lang="ts">
// DsSongCell — cover + song title + difficulty (06 stage 0 SongCell, 12 B8.2 / B8.5, P0-24).
// Built from DsCover and DsDiff. A title in the other language carries its own `lang` (Japanese glyphs for a Japanese
// title on a Chinese page). Long titles are one line with an ellipsis and the full text in `title`.

/** Base language of a BCP 47 tag ("ja-JP" → "ja"). */
export const baseLang = (tag: string | null | undefined) => String(tag || "").toLowerCase().split("-")[0];

/** `lang` attribute for a text: set only when its language differs from the page's. */
export function textLang(textLangTag: string | null | undefined, pageLocale: string): string | undefined {
  if (!textLangTag) return undefined;
  return baseLang(textLangTag) === baseLang(pageLocale) ? undefined : textLangTag;
}
</script>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  songId: { type: Number as PropType<number | null>, default: null },
  /** Title in the display language */
  title: { type: String, required: true },
  /** Language of `title` ("ja", "zh-CN", "en"); marked when it differs from the page */
  titleLang: { type: String, default: undefined },
  /** Second title (the other language), optional */
  subtitle: { type: String as PropType<string | null>, default: null },
  subtitleLang: { type: String, default: undefined },
  difficulty: { type: [Number, String] as PropType<number | string | null>, default: null },
  star: { type: [Number, String] as PropType<number | string | null>, default: null },
  constant: { type: [Number, String] as PropType<number | string | null>, default: null },
  /** false where the data source has no constants (DsDiff showConstant): no "—" slot */
  showConstant: { type: Boolean, default: true },
  coverSize: { type: String as PropType<"sm" | "md" | "lg">, default: "md" }
});

const { locale } = useI18n();
const titleAttr = computed(() => textLang(props.titleLang, locale.value));
const subtitleAttr = computed(() => textLang(props.subtitleLang, locale.value));
const sub = computed(() => (props.subtitle && props.subtitle !== props.title ? props.subtitle : ""));
</script>

<template>
  <div class="ds-songcell" :class="`ds-songcell--${coverSize}`">
    <DsCover :song-id="songId" :size="coverSize" />
    <div class="ds-songcell__body">
      <span class="ds-songcell__title" :lang="titleAttr" :title="title">{{ title }}</span>
      <span v-if="sub" class="ds-songcell__sub" :lang="subtitleAttr" :title="sub">{{ sub }}</span>
      <DsDiff v-if="difficulty !== null && difficulty !== ''" class="ds-songcell__diff" :difficulty="difficulty" :star="star" :constant="constant" :show-constant="showConstant" />
    </div>
  </div>
</template>

<style scoped>
.ds-songcell {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.ds-songcell__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1 1 auto;
  gap: 3px;
  min-width: 0;
}
.ds-songcell__title,
.ds-songcell__sub {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ds-songcell__title {
  font-size: var(--fs-14);
  font-weight: 600;
  line-height: var(--lh-snug);
  color: var(--ink);
}
.ds-songcell__sub {
  font-size: var(--fs-12);
  line-height: var(--lh-snug);
  color: var(--ink-3);
}
</style>
