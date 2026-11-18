<script setup lang="ts">
// ReworkGuideLevel — /guide/:difficulty/:level (slice F; frozen design: Guide.vue). Content and order as before:
// the distribution of the seven tags with the total, then one row per tag that opens its charts (loaded on first open,
// failed → retry, empty). The chart table keeps every column and scrolls inside itself on narrow screens; an open tag
// mounts GUIDE_ROW_STEP rows at a time (V1.3 budget), "show more" adds the next ones.
import type { PropType } from "vue";
import type { GuideSummaryTable, GuideTagItem } from "~/types/content";

type Row = { rowKey: string; id: number; title: string; count: number };
type Column = { prop: string; label: string };

const props = defineProps({
  difficulty: { type: Number, required: true },
  level: { type: Number, required: true },
  /** star pages of this difficulty (GUIDE_DIFFICULTY_OPTIONS max) */
  levels: { type: Number, default: 0 },
  summary: { type: Object as PropType<GuideSummaryTable>, required: true },
  summaryColumns: { type: Array as PropType<Column[]>, required: true },
  rows: { type: Array as PropType<Row[]>, required: true },
  expanded: { type: Array as PropType<number[]>, required: true },
  loading: { type: Array as PropType<number[]>, required: true },
  errors: { type: Object as PropType<Record<number, boolean>>, required: true },
  items: { type: Object as PropType<Record<number, { items: GuideTagItem[] } | undefined>>, required: true }
});
const emit = defineEmits<{ toggle: [row: Row]; retry: [row: Row] }>();
const { t } = useI18n();
const localePath = useLocalePath();
const uid = useId();
const GUIDE_ROW_STEP = 30;
const shown = reactive<Record<number, number>>({});
const tagItems = (id: number) => props.items[id]?.items || [];
const visible = (id: number) => tagItems(id).slice(0, shown[id] || GUIDE_ROW_STEP);
const more = (id: number) => (shown[id] = (shown[id] || GUIDE_ROW_STEP) + GUIDE_ROW_STEP);
const toneOf = (id: number) => (id <= 2 ? "over" : id >= 6 ? "under" : "mid");
</script>

<template>
  <div class="gl">
    <nav v-if="levels > 1" class="gl-levels" :aria-label="t(`difficulty.${difficulty}`)">
      <NuxtLink v-for="n in levels" :key="n" custom :to="localePath(`/guide/${difficulty}/${n}`)">
        <template #default="{ href, navigate }">
          <a :href="href" class="num" :aria-current="n === level ? 'page' : undefined" :aria-label="t('rework.guidePage.levelAria', { difficulty: t(`difficulty.${difficulty}`), level: n })" @click="navigate">★{{ n }}</a>
        </template>
      </NuxtLink>
    </nav>

    <ReworkPanel :title="t('guide.difficultyDistribution')">
      <div class="gl-scroll" tabindex="0" role="region" :aria-label="t('guide.difficultyDistribution')">
        <table class="gl-dist">
          <caption class="rw-vh">{{ t("page.guide.detail.summaryLabel") }}</caption>
          <thead>
            <tr>
              <th v-for="column in summaryColumns" :key="column.prop" scope="col" :class="{ 'is-total': column.prop === 'total' }">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td v-for="column in summaryColumns" :key="column.prop" class="num" :class="{ 'is-total': column.prop === 'total' }">
                {{ summary[column.prop as keyof GuideSummaryTable] ?? "—" }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReworkPanel>

    <ReworkPanel :title="t('guide.detailTable')">
      <ul class="gl-tags">
        <li v-for="row in rows" :key="row.rowKey" class="gl-tag" :class="`is-${toneOf(row.id)}`">
          <h3 class="gl-tag__head">
            <button
              :id="`${uid}-${row.id}-btn`"
              type="button"
              class="gl-tag__toggle"
              :aria-expanded="expanded.includes(row.id)"
              :aria-controls="`${uid}-${row.id}`"
              @click="emit('toggle', row)"
            >
              <ReworkIcon name="forward" class="gl-tag__chev" />
              <span class="gl-tag__title">{{ row.title }}</span>
              <span class="gl-tag__count num">{{ row.count }}</span>
            </button>
          </h3>
          <div v-if="expanded.includes(row.id)" :id="`${uid}-${row.id}`" class="gl-tag__body" role="region" :aria-labelledby="`${uid}-${row.id}-btn`">
            <ReworkState v-if="loading.includes(row.id)" kind="loading" :lines="4" compact />
            <ReworkState v-else-if="errors[row.id]" kind="failed" :title="t('guide.loadFailed')" :retry-label="t('common.retry')" compact @retry="emit('retry', row)" />
            <ReworkState v-else-if="!tagItems(row.id).length" kind="empty" :title="t('guide.empty')" compact />
            <template v-else>
              <div class="gl-scroll" tabindex="0" role="region" :aria-label="row.title">
                <table class="gl-items">
                  <thead>
                    <tr>
                      <th scope="col">{{ t("page.guide.detail.columns.tag") }}</th>
                      <th scope="col">BPM</th>
                      <th scope="col">{{ t("page.guide.detail.columns.category") }}</th>
                      <th scope="col">{{ t("page.guide.detail.columns.attribute") }}</th>
                      <th scope="col">{{ t("page.guide.detail.columns.feature") }}</th>
                      <th scope="col">{{ t("page.guide.detail.columns.noteCount") }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in visible(row.id)" :key="item.rowKey">
                      <th scope="row">{{ item.title }}</th>
                      <td class="num">{{ item.bpm }}</td>
                      <td>{{ item.category }}</td>
                      <td>{{ item.tag }}</td>
                      <td class="gl-items__feature">{{ item.feature }}</td>
                      <td class="num">{{ item.noteCount }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="tagItems(row.id).length > visible(row.id).length" class="gl-more">
                <span class="rw-count">{{ visible(row.id).length }} / {{ tagItems(row.id).length }}</span>
                <button type="button" class="rw-btn rw-btn--sm" @click="more(row.id)">{{ t("rework.guidePage.more") }}</button>
              </div>
            </template>
          </div>
        </li>
      </ul>
    </ReworkPanel>
  </div>
</template>

<style scoped>
.gl {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.gl-levels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.gl-levels a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
  color: var(--ink);
  text-decoration: none;
}
.gl-levels a[aria-current="page"] {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}
.gl-levels a:focus-visible,
.gl-scroll:focus-visible,
.gl-tag__toggle:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.gl-scroll {
  overflow-x: auto;
  min-width: 0;
}
.gl-dist {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  table-layout: fixed;
}
.gl-dist th,
.gl-dist td {
  padding: var(--sp-2);
  text-align: center;
  border-bottom: 1px solid var(--line);
}
.gl-dist th {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
.gl-dist td {
  font-size: var(--fs-22);
  font-weight: 700;
  border-bottom: 0;
}
.gl-dist .is-total {
  border-left: 1px solid var(--line-strong);
}

.gl-tags {
  margin: 0 calc(var(--sp-5) * -1);
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}
.gl-tag {
  border-bottom: 1px solid var(--line);
}
.gl-tag:last-child {
  border-bottom: 0;
}
.gl-tag__head {
  margin: 0;
  font-size: inherit;
}
.gl-tag__toggle {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: 52px;
  padding: 0 var(--sp-5);
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--fs-16);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.gl-tag.is-over .gl-tag__toggle {
  border-left-color: var(--danger);
}
.gl-tag.is-under .gl-tag__toggle {
  border-left-color: var(--info-line);
}
.gl-tag__toggle:hover {
  background: var(--bg-sunk);
}
.gl-tag__chev {
  width: 18px;
  height: 18px;
  color: var(--ink-3);
}
.gl-tag__toggle[aria-expanded="true"] .gl-tag__chev {
  transform: rotate(90deg);
}
@media (prefers-reduced-motion: no-preference) {
  .gl-tag__chev {
    transition: transform var(--dur-1);
  }
}
.gl-tag__count {
  min-width: 3ch;
  text-align: right;
  color: var(--ink-2);
}
.gl-tag__body {
  padding: 0 var(--sp-5) var(--sp-4);
}
.gl-items {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
  font-size: var(--fs-14);
}
.gl-items th,
.gl-items td {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: keep-all;
}
/* Column widths: short columns (BPM, category, attribute, notes) stay on one line; the title (width 240) and the feature
   text (width 300, its own line breaks kept) wrap. Table cells ignore min-width, so the widths are set as `width` on the
   wrapping columns and the table scrolls inside its region instead of squeezing a column to one character. */
.gl-items tbody th {
  width: 240px;
  white-space: normal;
}
.gl-items td.gl-items__feature {
  width: 300px;
  white-space: pre-line;
}
.gl-items thead th {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
  white-space: nowrap;
}
.gl-items tbody th {
  font-weight: 600;
}
.gl-items td.gl-items__feature {
  color: var(--ink-2);
}
.gl-more {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
  margin-top: var(--sp-3);
}
@media (max-width: 767px) {
  .gl-tags {
    margin: 0 calc(var(--sp-4) * -1);
  }
  .gl-tag__toggle {
    padding: 0 var(--sp-4);
  }
  .gl-tag__body {
    padding: 0 var(--sp-4) var(--sp-4);
  }
}
</style>
