<script setup lang="ts">
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";
import data from "../data/atoms.json";

defineOptions({ name: "DsSampleSongCell" });

/** Both orders, so each page shows a title in its own language and one in the other language. */
const orders = [
  { key: "zh + ja", cells: data.songCells.map((s) => ({ ...s, title: s.zh, titleLang: "zh-CN", subtitle: s.ja, subtitleLang: "ja" })) },
  { key: "ja + zh", cells: data.songCells.map((s) => ({ ...s, title: s.ja, titleLang: "ja", subtitle: s.zh, subtitleLang: "zh-CN" })) }
];
/** A Japanese-only title shown as is on either page (needs lang="ja" on a Chinese page). */
const jaOnly = data.songCells.map((s) => ({ ...s, title: s.ja, titleLang: "ja" }));
</script>

<template>
  <DsSampleShell title="song-cell">
    <DsSampleBlock v-for="order in orders" :key="order.key" :name="`${order.key} · same name / long / missing cover`">
      <div class="ds-s-list" :data-testid="`songcell-${order.key === 'zh + ja' ? 'zh' : 'ja'}`">
        <DsSongCell
          v-for="s in order.cells"
          :key="s.id"
          :song-id="s.id"
          :title="s.title"
          :title-lang="s.titleLang"
          :subtitle="s.subtitle"
          :subtitle-lang="s.subtitleLang"
          :difficulty="s.difficulty"
          :star="s.star"
          :constant="s.constant"
        />
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="ja title only · 200px (truncation)">
      <div class="ds-s-list ds-s-narrow" data-testid="songcell-narrow">
        <DsSongCell v-for="s in jaOnly" :key="s.id" :song-id="s.id" :title="s.title" :title-lang="s.titleLang" :difficulty="s.difficulty" :star="s.star" :constant="s.constant" />
      </div>
    </DsSampleBlock>
    <DsSampleBlock name="cover sm / lg · no difficulty">
      <div class="ds-s-list" data-testid="songcell-sizes">
        <DsSongCell :song-id="data.songCells[0].id" :title="data.songCells[0].ja" title-lang="ja" cover-size="sm" />
        <DsSongCell :song-id="data.songCells[0].id" :title="data.songCells[0].ja" title-lang="ja" cover-size="lg" :difficulty="4" :star="10" />
      </div>
    </DsSampleBlock>
  </DsSampleShell>
</template>

<style scoped>
.ds-s-list {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  width: 100%;
  max-width: 420px;
  min-width: 0;
}
.ds-s-narrow {
  max-width: 200px;
}
</style>
