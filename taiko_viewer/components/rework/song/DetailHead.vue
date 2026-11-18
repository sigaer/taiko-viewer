<script setup lang="ts">
// Song detail header: cover, genre / shelf state / versions, title (current language; a trailing "(…)" stays on one
// line), the other-language name, then artists, BPM, release date, ID and subtitle. Only catalog fields.
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
const artists = computed(() => (props.song.artists?.length ? props.song.artists.join(" / ") : "—"));
const openDay = computed(() => formatOpenDay(props.song.open_day) || props.song.open_day || "—");
</script>

<template>
  <ReworkPageHeader class="sd-head" :title-lang="names.titleLang">
    <template #lead>
      <DsCover class="sd-cover" :song-id="Number(song.id)" size="fill" priority />
    </template>
    <template #eyebrow>
      <span v-if="genreLabel" class="genre"><i v-if="genre" class="dot" :class="`g-${genre}`" aria-hidden="true" />{{ genreLabel }}</span>
      <span class="tag">{{ t(`rework.library.shelf.${shelfOf(song.shelf_status)}`) }}</span>
      <span v-for="version in song.version || []" :key="version" class="tag">{{ version }}</span>
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
  </ReworkPageHeader>
</template>

<style scoped>
.sd-cover {
  display: block;
  width: 112px;
  border-radius: var(--r-panel);
  overflow: hidden;
}
.genre {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
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
.tag {
  display: inline-flex;
  align-items: center;
  height: var(--tag-h);
  padding: 0 var(--sp-2);
  border-radius: var(--tag-radius);
  background: var(--tag-info-bg);
  color: var(--tag-info-ink);
  font-size: var(--fs-12);
}
.title-suffix {
  white-space: nowrap;
}
.other-name {
  margin: 4px 0 0;
  font-size: var(--fs-14);
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
  gap: var(--sp-1) var(--sp-5);
  margin: var(--sp-3) 0 0;
}
.facts > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.facts dt {
  font-size: var(--fs-12);
  color: var(--ink-3);
  white-space: nowrap;
}
.facts dd {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: 500;
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .sd-cover {
    width: 72px;
    border-radius: calc(var(--r-ctl) + 2px);
  }
  .facts {
    gap: var(--sp-1) var(--sp-4);
  }
}
</style>
