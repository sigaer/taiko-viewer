<script setup lang="ts">
// ReworkDanCourse — one dan course (slice F; frozen design: Dan.vue). Used by every dan year page.
// Version switch (links to each year's page and its existing redirect), the grade rail of years that have several
// courses, the course: songs in their order (DsSongCell, linked to song detail when the catalogue has an exact title
// match, the chart's wiki page otherwise kept as a link), the pass conditions (red / gold per condition, per-song
// values listed in song order), the remaining wiki fragments and sections (tabs per song) as written, the source page
// and its last-modified line. No dan badges, personal records or statistics (RK-46).
import type { PropType } from "vue";
import {
  DAN_YEARS,
  danCourse,
  danRichHtml,
  danSongLocation,
  readNeighbours,
  type CatalogSong,
  type DanLink,
  type GradeGroup,
  type GradePage
} from "~/utils/rework/dan";

const props = defineProps({
  page: { type: Object as PropType<GradePage>, required: true },
  year: { type: String, required: true },
  /** grade rail (years with one page per grade); null for the single-course years */
  groups: { type: Array as PropType<readonly GradeGroup[] | null>, default: null },
  basePath: { type: String, required: true },
  /** catalogue song per dan song title (useDanSongLinks); missing = no link */
  links: { type: Object as PropType<Record<string, CatalogSong | null>>, default: () => ({}) },
  /** the year's full overview image, when there is one */
  overview: { type: Object as PropType<{ href: string } | null>, default: null }
});
const { t } = useI18n();
const localePath = useLocalePath();
const course = computed(() => danCourse(props.page));
const neighbours = computed(() => readNeighbours(props.page.navigationHtml));
const songs = computed(() => course.value.songs?.songs ?? []);
const rest = computed(() => props.page.sections.slice(1));
const details = computed(() => course.value.details.map(danRichHtml));
const nearItems = computed(() =>
  (["prevGrade", "nextGrade", "prevYear", "nextYear"] as const)
    .map((key) => ({ key, link: neighbours.value[key] as DanLink | null }))
    .filter((item) => item.link)
    .map(({ key, link }) => ({ key, label: link!.label, to: neighbourTo(link), back: key.startsWith("prev") }))
);

const linkFor = (title: string) => props.links[title] || null;
// The catalogue's Chinese title under the dan title (the Japanese one), as the song library shows the other-language name.
const subtitleFor = (title: string) => {
  const song = linkFor(title);
  return song?.song_name && song.song_name !== title ? song.song_name : null;
};
const neighbourTo = (link: DanLink | null) => (link?.to ? localePath(link.to) : null);

// Tabs of a section (攻略: one per song): the selected tab per section of the shown course.
const selected = reactive<Record<string, number>>({});
watch(
  () => props.page.slug,
  () => {
    for (const key of Object.keys(selected)) delete selected[key];
  }
);
const tabIndex = (title: string) => selected[title] ?? 0;
const uid = useId();
const tabId = (s: number, i: number) => `${uid}-tab-${s}-${i}`;
const panelId = (s: number) => `${uid}-panel-${s}`;
function onTabKey(event: KeyboardEvent, title: string, count: number, s: number) {
  const now = tabIndex(title);
  const next =
    event.key === "ArrowRight" ? (now + 1) % count : event.key === "ArrowLeft" ? (now - 1 + count) % count : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : -1;
  if (next < 0) return;
  event.preventDefault();
  selected[title] = next;
  nextTick(() => document.getElementById(tabId(s, next))?.focus());
}
const conditionValues = (values: string[]) =>
  values.length > 1 && values.length === songs.value.length
    ? values.map((value, i) => ({ order: songs.value[i]?.order || "", value }))
    : values.map((value) => ({ order: "", value }));
</script>

<template>
  <div class="dan">
    <nav class="dan-years" :aria-label="t('rework.danCourse.years')">
      <NuxtLink
        v-for="y in DAN_YEARS"
        :key="y"
        custom
        :to="localePath(`/grade/${y}`)"
      >
        <template #default="{ href, navigate }">
          <a :href="href" class="num" :aria-current="y === year ? 'page' : undefined" @click="navigate">{{ y }}</a>
        </template>
      </NuxtLink>
    </nav>

    <nav v-if="groups" class="dan-rail" :aria-label="t('rework.danCourse.grades')">
      <div v-for="group in groups" :key="group.key" class="dan-rail__group">
        <span class="dan-rail__label">{{ t(`rework.danCourse.group.${group.key}`) }}</span>
        <ul>
          <li v-for="slug in group.items" :key="slug">
            <NuxtLink custom :to="localePath(`${basePath}/${slug}`)">
              <template #default="{ href, navigate }">
                <a :href="href" lang="ja" :aria-current="slug === page.slug ? 'page' : undefined" @click="navigate">{{ slug }}</a>
              </template>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <section class="dan-head" :aria-labelledby="`${uid}-course`">
      <div class="dan-head__text">
        <h2 :id="`${uid}-course`" class="dan-head__title" lang="ja">{{ page.displayTitle }}</h2>
        <p class="dan-head__meta">
          <span class="num">{{ page.title }}</span>
          <span v-if="page.lastModified" class="dan-head__modified">{{ page.lastModified }}</span>
        </p>
      </div>
      <div class="dan-head__actions">
        <a v-if="overview" class="rw-btn rw-btn--sm" :href="overview.href" target="_blank" rel="noopener" :aria-label="t('page.home.guest.danOverviewAria')">
          {{ t("page.home.guest.danOverviewCta") }}<ReworkIcon name="open" class="dan-open" />
        </a>
        <a v-if="page.sourceUrl" class="rw-btn rw-btn--sm" :href="page.sourceUrl" target="_blank" rel="noopener noreferrer">
          {{ t("rework.danCourse.source") }}<ReworkIcon name="open" class="dan-open" />
        </a>
      </div>
    </section>

    <nav v-if="nearItems.length" class="dan-near" :aria-label="t('rework.danCourse.neighbours')">
      <template v-for="item in nearItems" :key="item.key">
        <NuxtLink v-if="item.to" class="dan-near__item" :class="`is-${item.key}`" :to="item.to">
          <span class="rw-vh">{{ t(`rework.danCourse.near.${item.key}`) }}</span>
          <span v-if="item.back" aria-hidden="true">←</span>
          <span lang="ja">{{ item.label }}</span>
          <span v-if="!item.back" aria-hidden="true">→</span>
        </NuxtLink>
        <span v-else class="dan-near__item" :class="`is-${item.key}`">
          <span class="rw-vh">{{ t(`rework.danCourse.near.${item.key}`) }}</span>
          <span v-if="item.back" aria-hidden="true">←</span>
          <span lang="ja">{{ item.label }}</span>
          <span v-if="!item.back" aria-hidden="true">→</span>
        </span>
      </template>
    </nav>

    <div class="dan-body">
      <ReworkPanel :title="t('rework.danCourse.songs')">
        <template v-if="course.songs?.totalCombo" #actions>
          <span class="dan-total">{{ t("rework.danCourse.totalCombo") }} <b class="num">{{ course.songs.totalCombo }}</b></span>
        </template>
        <ol v-if="songs.length" class="dan-songs">
          <li v-for="(song, i) in songs" :key="`${song.order}-${song.title}`" class="dan-song">
            <span class="dan-song__no"><span class="rw-vh" lang="ja">{{ song.order }}</span><b class="num" aria-hidden="true">{{ i + 1 }}</b></span>
            <div class="dan-song__main">
              <NuxtLink
                v-if="linkFor(song.matchTitle)"
                class="dan-song__link"
                :to="localePath(danSongLocation(linkFor(song.matchTitle)!.id, song.difficulty))"
              >
                <DsSongCell :song-id="linkFor(song.matchTitle)!.id" :title="song.matchTitle" title-lang="ja" :subtitle="subtitleFor(song.matchTitle)" subtitle-lang="zh-CN" cover-size="md" />
              </NuxtLink>
              <DsSongCell v-else :song-id="null" :title="song.matchTitle" title-lang="ja" cover-size="md" />
            </div>
            <div class="dan-song__diff">
              <DsDiff v-if="song.difficulty" :difficulty="song.difficulty" :star="song.star" :show-constant="false" />
              <span v-else lang="ja">{{ song.difficultyText }}</span>
            </div>
            <dl class="dan-song__kv">
              <div>
                <dt>{{ t("rework.danCourse.combo") }}</dt>
                <dd class="num">{{ song.combo || "—" }}</dd>
              </div>
              <div>
                <dt>BPM</dt>
                <dd class="num">{{ song.bpm || "—" }}</dd>
              </div>
            </dl>
            <a
              v-if="song.href"
              class="dan-song__wiki rw-link"
              :href="song.href"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="t('rework.danCourse.wikiAria', { title: song.title })"
            >wiki<ReworkIcon name="open" class="dan-open" /></a>
          </li>
        </ol>
      </ReworkPanel>

      <ReworkPanel :title="t('rework.danCourse.conditions')">
        <div v-if="course.conditions" class="dan-scroll" tabindex="0" role="region" :aria-label="t('rework.danCourse.conditions')">
          <table class="dan-cond">
            <thead>
              <tr>
                <th scope="col">{{ t("rework.danCourse.condition") }}</th>
                <th v-for="tier in course.conditions.tiers" :key="tier.label" scope="col">
                  <span class="dan-tier" :class="`is-${tier.kind}`"><i aria-hidden="true" />{{ t(`rework.danCourse.tier.${tier.kind}`) }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(column, c) in course.conditions.columns" :key="column">
                <th scope="row" lang="ja">{{ column }}</th>
                <td v-for="tier in course.conditions.tiers" :key="tier.label">
                  <ul class="dan-values">
                    <li v-for="(item, k) in conditionValues(tier.values[c] || [])" :key="k">
                      <span v-if="item.order" class="dan-values__order" lang="ja">{{ item.order }}</span>
                      <b lang="ja">{{ item.value }}</b>
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-for="(html, i) in details" :key="i" class="dan-rich" lang="ja" v-html="html" />
      </ReworkPanel>

      <ReworkPanel v-for="(section, s) in rest" :key="section.title" :title="section.title">
        <template v-if="section.tabs?.length">
          <div class="dan-tabs" role="tablist" :aria-label="section.title">
            <button
              v-for="(tab, i) in section.tabs"
              :id="tabId(s, i)"
              :key="`${tab.title}-${i}`"
              type="button"
              role="tab"
              lang="ja"
              :aria-selected="tabIndex(section.title) === i"
              :aria-controls="panelId(s)"
              :tabindex="tabIndex(section.title) === i ? 0 : -1"
              @click="selected[section.title] = i"
              @keydown="onTabKey($event, section.title, section.tabs.length, s)"
            >
              {{ tab.title }}
            </button>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div :id="panelId(s)" class="dan-rich" role="tabpanel" :aria-labelledby="tabId(s, tabIndex(section.title))" lang="ja" tabindex="0" v-html="danRichHtml(section.tabs[tabIndex(section.title)]?.html || '')" />
        </template>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-for="(block, i) in section.blocks" :key="i" class="dan-rich" lang="ja" v-html="danRichHtml(block.html)" />
      </ReworkPanel>
    </div>
  </div>
</template>

<style scoped>
.dan {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.dan-open {
  width: 14px;
  height: 14px;
  margin-left: 4px;
}

/* Version switch: links styled as the segmented control */
.dan-years {
  display: inline-flex;
  justify-self: start;
  flex-wrap: wrap;
  max-width: 100%;
  padding: 2px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
}
.dan-years a {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-4);
  border-radius: calc(var(--r-ctl) - 2px);
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-decoration: none;
}
.dan-years a[aria-current="page"] {
  background: var(--seg-on-bg);
  color: var(--seg-on-ink);
  font-weight: 700;
  box-shadow: 0 0 0 1px var(--seg-on-ring);
}
.dan-years a:focus-visible,
.dan-rail a:focus-visible,
.dan-near__item:focus-visible,
.dan-tabs button:focus-visible,
.dan-scroll:focus-visible,
.dan-rich:focus-visible,
.dan-song__link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

/* Grade rail: three labelled groups of chips; one scrolling row on phones */
.dan-rail {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3) var(--sp-5);
  min-width: 0;
}
.dan-rail__group {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}
.dan-rail__label {
  flex: none;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.dan-rail ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dan-rail a {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--ink);
  font-size: var(--fs-14);
  text-decoration: none;
  white-space: nowrap;
}
.dan-rail a:hover {
  border-color: var(--line-strong);
}
.dan-rail a[aria-current="page"] {
  border-color: var(--selected-line);
  background: var(--selected-bg);
  color: var(--selected-ink);
  font-weight: 700;
}

.dan-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-3) var(--sp-5);
  min-width: 0;
}
.dan-head__text {
  min-width: 0;
}
.dan-head__title {
  margin: 0;
  font-size: var(--fs-22);
  font-weight: 800;
  line-height: var(--lh-tight);
}
.dan-head__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--sp-3);
  margin: 6px 0 0;
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.dan-head__modified {
  color: var(--ink-3);
}
.dan-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.dan-near {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2) var(--sp-4);
  font-size: var(--fs-14);
}
.dan-near__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--hit);
  min-width: 0;
  color: var(--ink-3);
}
a.dan-near__item {
  color: var(--link);
  text-decoration: none;
}
a.dan-near__item:hover {
  text-decoration: underline;
}
.dan-near__item.is-nextGrade,
.dan-near__item.is-nextYear {
  justify-self: end;
  grid-column: 2;
}
.dan-near__item.is-prevGrade,
.dan-near__item.is-prevYear {
  grid-column: 1;
}

.dan-body {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
}
.dan-total {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.dan-total b {
  font-size: var(--fs-16);
  color: var(--ink);
}

/* Songs in their order */
.dan-songs {
  margin: 0 calc(var(--sp-5) * -1);
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}
.dan-song {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--sp-3) var(--sp-4);
  padding: var(--sp-3) var(--sp-5);
  border-bottom: 1px solid var(--line);
}
.dan-song:last-child {
  border-bottom: 0;
}
.dan-song__no b {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-size: var(--fs-16);
  line-height: 1;
}
.dan-song__main {
  min-width: 0;
}
.dan-song__link {
  display: block;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-ctl);
}
.dan-song__link:hover :deep(.ds-songcell__title) {
  color: var(--link);
  text-decoration: underline;
}
.dan-song__kv {
  display: flex;
  gap: var(--sp-4);
  margin: 0;
}
.dan-song__kv > div {
  display: flex;
  flex-direction: column-reverse;
  min-width: 52px;
}
.dan-song__kv dt {
  font-size: var(--fs-11);
  color: var(--ink-3);
}
.dan-song__kv dd {
  margin: 0;
  font-size: var(--fs-16);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.dan-song__wiki {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
}

/* Pass conditions */
.dan-scroll {
  overflow-x: auto;
  margin: 0 calc(var(--sp-5) * -1);
  padding: 0 var(--sp-5);
}
.dan-cond {
  width: 100%;
  min-width: 420px;
  border-collapse: collapse;
  font-size: var(--fs-14);
}
.dan-cond th,
.dan-cond td {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
.dan-cond thead th {
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
  border-bottom-color: var(--line-strong);
}
.dan-cond tbody th {
  font-weight: 600;
  white-space: nowrap;
}
.dan-cond tbody tr:last-child > * {
  border-bottom: 0;
}
.dan-tier {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.dan-tier i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
}
.dan-tier.is-gold i {
  background: var(--warn);
}
.dan-values {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dan-values b {
  font-weight: 600;
}
.dan-values__order {
  margin-right: var(--sp-2);
  font-size: var(--fs-12);
  color: var(--ink-3);
}

/* Tabs of a section */
.dan-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: var(--sp-3);
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
}
.dan-tabs button {
  flex: none;
  min-height: var(--hit);
  padding: 0 var(--sp-3);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: var(--fs-14);
  cursor: pointer;
}
.dan-tabs button[aria-selected="true"] {
  border-bottom-color: var(--tab-line);
  color: var(--ink);
  font-weight: 700;
}

/* Wiki fragments as written: reading width, tables scroll inside themselves */
.dan-rich {
  max-width: 72em;
  min-width: 0;
  font-size: var(--fs-14);
  line-height: var(--lh-body);
  overflow-wrap: anywhere;
}
.dan-rich + .dan-rich {
  margin-top: var(--sp-4);
}
.dan-scroll + .dan-rich {
  margin-top: var(--sp-5);
}
.dan-rich :deep(ul) {
  margin: 0;
  padding-left: 1.25em;
}
.dan-rich :deep(.list1) {
  padding-left: 1.1em;
}
.dan-rich :deep(li) {
  margin: 2px 0;
}
.dan-rich :deep(.h-scrollable) {
  overflow-x: auto;
  margin: var(--sp-2) 0;
}
.dan-rich :deep(table) {
  border-collapse: collapse;
  font-size: var(--fs-13);
  line-height: 1.5;
}
.dan-rich :deep(td),
.dan-rich :deep(th) {
  padding: 6px 10px;
  border: 1px solid var(--line);
  vertical-align: top;
  overflow-wrap: normal;
}
.dan-rich :deep(thead td) {
  background: var(--bg-sunk);
  color: var(--ink-2);
}
.dan-rich :deep([data-dan-tone="pass"]),
.dan-rich :deep([data-dan-tone="gold"]) {
  white-space: nowrap;
}
.dan-rich :deep([data-dan-tone="pass"])::before,
.dan-rich :deep([data-dan-tone="gold"])::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--danger);
  vertical-align: middle;
}
.dan-rich :deep([data-dan-tone="gold"])::before {
  background: var(--warn);
}
.dan-rich :deep([data-dan-tone="shade"]) {
  background: var(--bg-sunk);
}
.dan-rich :deep([data-dan-tone="rule"]) {
  padding: 0;
  height: 6px;
  background: var(--line);
}
.dan-rich :deep([data-dan-tone="mark"]) {
  color: var(--ink);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--line-strong);
  text-underline-offset: 3px;
}
.dan-rich :deep(a) {
  color: var(--link);
}

@media (max-width: 1099px) {
  .dan-song {
    grid-template-columns: 44px minmax(0, 1fr) auto;
  }
  .dan-song__no {
    grid-row: span 2;
    align-self: start;
  }
  .dan-song__kv {
    grid-column: 2;
  }
  .dan-song__wiki {
    grid-column: 3;
    justify-self: end;
  }
}
@media (max-width: 767px) {
  .dan-rail {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .dan-rail ul {
    flex-wrap: nowrap;
  }
  .dan-songs {
    margin: 0 calc(var(--sp-4) * -1);
  }
  .dan-song {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: var(--sp-2) var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
  }
  .dan-song__no {
    grid-row: span 3;
  }
  .dan-song__no b {
    width: 28px;
    height: 28px;
    font-size: var(--fs-14);
  }
  .dan-song__diff,
  .dan-song__kv {
    grid-column: 2;
  }
  .dan-song__wiki {
    grid-column: 2;
    justify-self: start;
  }
  .dan-scroll {
    margin: 0 calc(var(--sp-4) * -1);
    padding: 0 var(--sp-4);
  }
}
</style>
