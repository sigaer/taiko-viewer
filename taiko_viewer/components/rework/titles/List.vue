<script setup lang="ts">
// ReworkTitlesList — /titles (slice F; frozen design: Titles.vue). Every title of the official catalogue as before:
// the game plate (DsTitlePlate: the plate image when the catalogue's plate number is in the asset map, the text form
// otherwise; the number itself stays in its own column), the condition and the linked songs. The list is long, so it
// is filtered by a keyword on the client and mounted TITLES_PAGE_SIZE rows at a time (V1.3: ≤ 60 mounted rows).
import type { PropType } from "vue";
import type { TitleCatalogItem } from "~/types/content";
import { pageCount } from "~/utils/rework/catalog";

const TITLES_PAGE_SIZE = 50;
const props = defineProps({
  titles: { type: Array as PropType<TitleCatalogItem[]>, required: true },
  pending: { type: Boolean, default: false },
  failed: { type: Boolean, default: false }
});
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const keyword = ref("");
const page = ref(1);
const norm = (text: string) => text.normalize("NFKC").toLowerCase();
const filtered = computed(() => {
  const q = norm(keyword.value.trim());
  if (!q) return props.titles;
  return props.titles.filter((title) => norm(title.name).includes(q) || norm(title.condition || "").includes(q) || String(title.rarity) === q);
});
const count = computed(() => Math.max(1, pageCount(filtered.value.length, TITLES_PAGE_SIZE)));
const rows = computed(() => filtered.value.slice((page.value - 1) * TITLES_PAGE_SIZE, page.value * TITLES_PAGE_SIZE));
watch(keyword, () => (page.value = 1));
watch(count, (n) => {
  if (page.value > n) page.value = Math.max(1, n);
});
const head = ref<HTMLElement | null>(null);
function select(n: number) {
  page.value = n;
  nextTick(() => {
    head.value?.scrollIntoView({ block: "start" });
    head.value?.focus({ preventScroll: true });
  });
}
</script>

<template>
  <div class="tl">
    <ReworkState v-if="pending" kind="loading" :lines="8" />
    <ReworkState v-else-if="failed" kind="failed" :title="t('page.titles.loadFailed')" @retry="emit('retry')" />
    <ReworkState v-else-if="!titles.length" kind="empty" :title="t('page.titles.empty')" />
    <template v-else>
      <div class="tl-bar">
        <label class="rw-field tl-search">
          <span class="rw-vh">{{ t("rework.titlesPage.search") }}</span>
          <input v-model="keyword" class="rw-input rw-input--block" type="search" :placeholder="t('rework.titlesPage.search')" autocomplete="off" />
        </label>
        <p ref="head" class="tl-sum" role="status" aria-live="polite" tabindex="-1">
          {{ t("rework.titlesPage.summary", { total: filtered.length, page: page, pages: count }) }}
        </p>
      </div>
      <ReworkState v-if="!filtered.length" kind="empty" :title="t('rework.titlesPage.noMatch')" compact>
        <button type="button" class="rw-btn" @click="keyword = ''">{{ t("rework.titlesPage.clear") }}</button>
      </ReworkState>
      <div v-else class="tl-scroll">
        <table class="tl-table">
          <thead>
            <tr>
              <th scope="col" class="tl-rarity">{{ t("page.titles.columns.rarity") }}</th>
              <th scope="col">{{ t("page.titles.columns.name") }}</th>
              <th scope="col">{{ t("page.titles.columns.condition") }}</th>
              <th scope="col">{{ t("page.titles.columns.songs") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="title in rows" :key="title.id || `${title.name}-${title.rarity}-${title.condition}`">
              <td class="tl-rarity num" :data-label="t('page.titles.columns.rarity')">{{ title.rarity }}</td>
              <th scope="row" class="tl-name"><DsTitlePlate :name="title.name" :plate="title.rarity" form="plate" /></th>
              <td>{{ title.condition }}</td>
              <td class="tl-songs">
                <template v-if="title.songIds.length">
                  <NuxtLink v-for="songId in title.songIds" :key="songId" class="rw-link num" :to="localePath(`/songs/${songId}`)">#{{ songId }}</NuxtLink>
                </template>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ReworkPager v-if="count > 1" :page="page" :count="count" @select="select" />
    </template>
  </div>
</template>

<style scoped>
.tl {
  display: grid;
  gap: var(--sp-4);
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.tl-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-5);
}
.tl-search {
  flex: 1 1 280px;
  max-width: 480px;
}
.tl-sum {
  margin: 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.tl-sum:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.tl-scroll {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
}
.tl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-14);
}
.tl-table th,
.tl-table td {
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: middle;
  overflow-wrap: anywhere;
}
.tl-table thead th {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
  white-space: nowrap;
}
.tl-table tbody tr:last-child > * {
  border-bottom: 0;
}
.tl-rarity {
  width: 72px;
  color: var(--ink-3);
}
.tl-name {
  width: 252px;
  font-weight: 600;
}
.tl-songs {
  width: 160px;
}
.tl-songs a {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  margin-right: var(--sp-3);
}

/* Below 768 px each title is a block: plate, condition, songs; the plate number moves to the end of the block */
@media (max-width: 767px) {
  .tl-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .tl-table,
  .tl-table tbody,
  .tl-table tr,
  .tl-table th,
  .tl-table td {
    display: block;
    width: auto;
  }
  .tl-table tr {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--line);
  }
  .tl-table tbody tr:last-child {
    border-bottom: 0;
  }
  .tl-table th,
  .tl-table td {
    padding: 0;
    border: 0;
  }
  .tl-rarity {
    order: 9;
    font-size: var(--fs-12);
  }
  .tl-rarity::before {
    content: attr(data-label) " ";
  }
}
</style>
