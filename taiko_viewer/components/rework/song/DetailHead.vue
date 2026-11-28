<script setup lang="ts">
// Song detail header card: cover, genre and shelf chips, title (current language; a trailing "(…)" stays on one
// line), the other-language name, artists / BPM / release date / ID / subtitle, the version tags, and the chart
// actions on the right (`actions` slot; stacked under the text from 768 to 1099 px, in the phone dock below). Only
// catalog fields.
import type { SongCatalogItem } from "~/types/content";
import { formatOpenDay, genreKey, shelfOf, songNames } from "~/utils/rework/catalog";

const props = defineProps<{ song: SongCatalogItem }>();
const { t, locale } = useI18n();
const names = computed(() => songNames(props.song, locale.value));
const titleParts = computed(() => {
  const full = names.value.title;
  const suffix = full.match(/\([^()]*\)$/)?.[0] || "";
  return { name: suffix ? full.slice(0, -suffix.length) : full, suffix };
});
const genre = computed(() => genreKey(props.song.type));
const genreLabel = computed(() => (genre.value ? t(`rework.library.genre.${genre.value}`) : String(props.song.type || "")));
const shelf = computed(() => shelfOf(props.song.shelf_status));
const artists = computed(() => (props.song.artists?.length ? props.song.artists.join(" / ") : "—"));
const openDay = computed(() => formatOpenDay(props.song.open_day) || props.song.open_day || "—");
</script>

<template>
  <section class="sd-headcard">
    <ReworkPageHeader class="sd-head" :title-lang="names.titleLang">
      <template #lead>
        <DsCover class="sd-cover" :song-id="Number(song.id)" size="fill" priority />
      </template>
      <template #eyebrow>
        <span v-if="genreLabel" class="chip genre"><i v-if="genre" class="dot" :class="`g-${genre}`" aria-hidden="true" />{{ genreLabel }}</span>
        <span class="chip tag" :class="`is-${shelf}`">{{ t(`rework.library.shelf.${shelf}`) }}</span>
      </template>
      <template #title>{{ titleParts.name }}<wbr v-if="titleParts.suffix" /><span v-if="titleParts.suffix" class="title-suffix">{{ titleParts.suffix }}</span></template>
      <p v-if="names.subtitle" class="other-name" :lang="names.subtitleLang">{{ names.subtitle }}</p>
      <dl class="facts">
        <div><dt>{{ t("rework.songDetail.facts.artists") }}</dt><dd>{{ artists }}</dd></div>
        <div><dt>BPM</dt><dd class="num">{{ song.bpm || "—" }}</dd></div>
        <div><dt>{{ t("rework.songDetail.facts.openDay") }}</dt><dd class="num">{{ openDay }}</dd></div>
        <div><dt>ID</dt><dd class="num">{{ song.id }}</dd></div>
        <div v-if="song.subtitle"><dt>{{ t("rework.songDetail.facts.subtitle") }}</dt><dd>{{ song.subtitle }}</dd></div>
      </dl>
      <ul v-if="song.version?.length" class="versions" :aria-label="t('rework.songDetail.facts.versions')">
        <li v-for="version in song.version" :key="version">{{ version }}</li>
      </ul>
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </ReworkPageHeader>
  </section>
</template>

<style scoped>
.sd-headcard {
  padding: var(--sp-6);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.sd-cover {
  display: block;
  width: 148px;
  border-radius: var(--r-panel);
  overflow: hidden;
}
.sd-head :deep(.rw-head__eyebrow) {
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 11px;
  border-radius: var(--r-note);
  background: var(--bg-sunk);
  color: var(--ink);
  font-size: var(--fs-12);
  font-weight: 700;
}
.genre {
  padding-left: 9px;
}
.tag {
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
}
.tag.is-available {
  background: var(--ok-wash);
  color: var(--ink);
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: var(--r-note);
  background: currentColor;
}
.g-namco { color: var(--genre-namco); }
.g-pops { color: var(--genre-pops); }
.g-kids { color: var(--genre-kids); }
.g-classic { color: var(--genre-classic); }
.g-variety { color: var(--genre-variety); }
.g-game { color: var(--genre-game); }
.g-vocaloid { color: var(--genre-vocaloid); }
.g-anime { color: var(--genre-anime); }
.title-suffix {
  white-space: nowrap;
}
.other-name {
  margin: 4px 0 0;
  font-size: var(--fs-16);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.other-name:lang(ja) {
  font-family: var(--font-cjk-jp);
}
.other-name:lang(zh-CN) {
  font-family: var(--font-cjk-sc);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px var(--sp-6);
  margin: var(--sp-3) 0 0;
}
.facts > div {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-width: 0;
}
.facts dt {
  font-size: var(--fs-14);
  color: var(--ink-3);
  white-space: nowrap;
}
.facts dd {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.versions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: var(--sp-3) 0 0;
  padding: 0;
  list-style: none;
}
.versions li {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 var(--sp-2);
  border: 1px solid var(--line);
  border-radius: var(--r-xs);
  font-size: var(--fs-12);
  font-weight: 600;
  color: var(--ink-2);
}
@media (max-width: 1099px) {
  .sd-headcard .sd-head {
    flex-wrap: wrap;
  }
  .sd-head :deep(.rw-head__body) {
    flex: 1 1 320px;
  }
  .sd-head :deep(.rw-head__actions) {
    flex: 1 1 100%;
  }
  .sd-head :deep(.rw-head__actions .sa-head) {
    flex-direction: row;
    flex-wrap: wrap;
    width: auto;
  }
  .sd-head :deep(.rw-head__actions .sa-btn) {
    width: auto;
    flex: 1 1 180px;
  }
}
@media (max-width: 767px) {
  .sd-headcard {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .sd-headcard .sd-head {
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: var(--sp-4);
  }
  .sd-cover {
    width: 96px;
  }
  .sd-headcard .sd-head :deep(.rw-head__body) {
    flex: 1 1 0;
  }
  .sd-head :deep(.rw-head__actions) {
    display: none;
  }
  .other-name {
    font-size: var(--fs-13);
  }
  .facts {
    gap: 2px var(--sp-4);
    margin-top: var(--sp-2);
  }
  .facts dt,
  .facts dd {
    font-size: var(--fs-13);
  }
}
</style>
