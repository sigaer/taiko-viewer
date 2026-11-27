<script setup lang="ts">
import type { SongCatalogItem, SongCatalogPagePayload } from "~/types/content";
import { catalogLocation, searchAllState, songSearchRequest, songTitle } from "~/utils/rework/catalog";
import { COMMON_FEATURES, FEATURES } from "~/utils/rework/navigation";
import { searchSelection } from "~/utils/rework/search";
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [navigate?: string] }>();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const api = useViewerApiFetch();
const dialog = ref<HTMLDialogElement>();
const input = ref<HTMLInputElement>();
const query = ref("");
const songs = ref<SongCatalogItem[]>([]);
const total = ref(0);
const loading = ref(false);
const failed = ref(false);
const selected = ref(-1);
const viewport = ref<Record<string, string>>({});
const id = useId();
let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;
let generation = 0;
const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().trim();
// Page results come from the navigation model (utils/rework/navigation.ts): every feature with its group's name.
// An empty query shows the common features only; typing filters every feature by its label.
const actions = computed(() => {
  const q = normalize(query.value);
  return (q ? FEATURES : COMMON_FEATURES)
    .map((x) => ({
      id: "page-" + x.key,
      label: t(x.labelKey),
      to: localePath(x.to),
      kind: "page",
      icon: x.icon,
      group: x.groupKey ? t(x.groupKey) : t("rework.page"),
      song: null,
    }))
    .filter((x) => !q || normalize(x.label).includes(q));
});
const shownSongs = computed(() => songs.value.slice(0, 8));
// Last option: every match in the library, only when the panel shows fewer songs than the API found.
const viewAll = computed(() =>
  total.value > shownSongs.value.length && query.value.trim()
    ? [
        {
          id: "all-results",
          label: t("rework.viewAll", { count: total.value }),
          to: catalogLocation(searchAllState(query.value.trim()), localePath),
          kind: "all",
          icon: "songs",
          group: "",
          song: null,
        },
      ]
    : [],
);
const results = computed(() => [
  ...shownSongs.value.map((song) => ({
    id: "song-" + song.id,
    label: songTitle(song, locale.value),
    to: localePath("/songs/" + song.id),
    kind: "song",
    icon: "music",
    group: t("rework.song"),
    song,
  })),
  ...actions.value,
  ...viewAll.value,
]);
const optionId = (index: number) => `${id}-option-${index}`;
function cancelRequest() {
  clearTimeout(timer);
  controller?.abort();
  generation++;
  loading.value = false;
}
function search() {
  cancelRequest();
  songs.value = [];
  total.value = 0;
  failed.value = false;
  selected.value = -1;
  if (!props.open || !query.value.trim()) return;
  loading.value = true;
  const current = generation;
  timer = setTimeout(async () => {
    controller = new AbortController();
    try {
      const payload = await api<SongCatalogPagePayload>("/api/content/songs", {
        query: songSearchRequest(query.value.trim()),
        signal: controller.signal,
        timeout: 8000,
      });
      if (current === generation) {
        songs.value = payload.songs.slice(0, 8);
        total.value = Number(payload.total) || 0;
        selected.value = -1;
      }
    } catch {
      if (current === generation && !controller?.signal.aborted)
        failed.value = true;
    } finally {
      if (current === generation) loading.value = false;
    }
  }, 160);
}
watch([query, locale], search);
function sizeViewport() {
  const v = window.visualViewport;
  viewport.value = v
    ? { "--search-height": `${v.height}px`, "--search-top": `${v.offsetTop}px` }
    : {};
}
function close(to?: string) {
  cancelRequest();
  dialog.value?.close();
  emit("close", to);
}
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (open) {
      dialog.value?.showModal();
      sizeViewport();
      input.value?.focus();
      search();
    } else {
      cancelRequest();
      dialog.value?.close();
    }
  },
  { flush: "post" },
);
function key(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    selected.value = searchSelection(
      event.key,
      selected.value,
      results.value.length,
    );
    nextTick(() =>
      document
        .getElementById(optionId(selected.value))
        ?.scrollIntoView({ block: "nearest" }),
    );
  } else if (event.key === "Enter") {
    event.preventDefault();
    const result = results.value[selected.value < 0 ? 0 : selected.value];
    if (result) close(result.to);
  }
}
onMounted(() => {
  window.visualViewport?.addEventListener("resize", sizeViewport);
  window.visualViewport?.addEventListener("scroll", sizeViewport);
});
onBeforeUnmount(() => {
  cancelRequest();
  dialog.value?.close();
  window.visualViewport?.removeEventListener("resize", sizeViewport);
  window.visualViewport?.removeEventListener("scroll", sizeViewport);
});
</script>
<template>
  <dialog
    ref="dialog"
    class="search-panel"
    :style="viewport"
    :aria-label="t('rework.search')"
    @cancel.prevent="close()"
    @click="$event.target === $event.currentTarget && close()"
  >
    <div class="search-frame">
      <div class="search-input-row">
        <ReworkIcon name="search" /><input
          ref="input"
          v-model="query"
          role="combobox"
          :aria-label="t('rework.searchPlaceholder')"
          :placeholder="t('rework.searchPlaceholder')"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="`${id}-results`"
          :aria-activedescendant="
            selected >= 0 ? optionId(selected) : undefined
          "
          autocomplete="off"
          spellcheck="false"
          @keydown="key"
        /><button type="button" @click="close()">
          {{ t("rework.cancel") }}
        </button>
      </div>
      <div class="search-scroll" @touchmove.passive="input?.blur()">
        <p class="search-state" role="status" aria-live="polite">
          {{
            loading
              ? t("rework.loading")
              : failed
                ? t("rework.searchError")
                : t("rework.results", { count: results.length - viewAll.length })
          }}
        </p>
        <p v-if="!query.trim() && actions.length" :id="`${id}-common`" class="search-group">{{ t("rework.shell.common") }}</p>
        <ul
          :id="`${id}-results`"
          role="listbox"
          :aria-label="t('rework.resultsLabel')"
        >
          <li
            v-for="(result, index) in results"
            :id="optionId(index)"
            :key="result.id"
            role="option"
            :aria-selected="selected === index"
            :class="{ selected: selected === index }"
            @pointermove="selected = index"
            @pointerdown.prevent
            @click="close(result.to)"
          >
            <DsCover
              v-if="result.song"
              :song-id="result.song.id"
              size="md"
            /><span v-else class="result-icon" :class="{ 'is-primary': result.id === 'page-syncScores' }"><ReworkIcon :name="result.icon" /></span><span
              class="result-label"
              >{{ result.label
              }}<small v-if="result.group">{{ result.group }}</small></span
            ><span aria-hidden="true">↵</span>
          </li>
        </ul>
        <p v-if="!loading && !failed && !results.length" class="search-state">
          {{ t("rework.noResults") }}
        </p>
        <div v-if="!query" class="search-examples">
          <button type="button" @click="query = t('rework.exampleSong')">
            {{ t("rework.exampleSong") }}</button
          ><button type="button" @click="query = t('rework.exampleCategory')">
            {{ t("rework.exampleCategory") }}
          </button>
        </div>
        <button v-if="failed" class="retry" type="button" @click="search">
          {{ t("rework.retry") }}
        </button>
      </div>
    </div>
  </dialog>
</template>
<style scoped>
.search-panel {
  padding: 0;
  border: 1px solid var(--overlay-line);
  border-radius: var(--r-panel);
  background: var(--overlay-bg);
  color: var(--ink);
  width: min(640px, calc(100vw - 40px));
  max-height: min(680px, 80dvh);
  margin: 10dvh auto auto;
  box-shadow: var(--shadow-pop);
  overflow: hidden;
  font-family: var(--font-ui);
}
.search-panel::backdrop {
  background: var(--scrim);
}
.search-frame {
  display: flex;
  flex-direction: column;
  max-height: inherit;
}
.search-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.search-input-row input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 16px;
  min-height: 44px;
  outline-offset: 2px;
}
.search-input-row button,
.search-examples button,
.retry {
  min-height: 44px;
  border: 0;
  border-radius: var(--r-ctl);
  padding: 0 12px;
  background: var(--bg-sunk);
  color: var(--link);
  font: inherit;
  cursor: pointer;
}
.search-scroll {
  overflow: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding: 8px;
}
.search-state {
  font-size: 13px;
  color: var(--ink-3);
  padding: 8px 12px;
  margin: 0;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 8px 12px;
  border-radius: var(--r-ctl);
  cursor: pointer;
}
li.selected {
  background: var(--bg-sunk);
}
.search-group {
  margin: 0;
  padding: 6px 12px 4px;
  font-size: var(--fs-12);
  font-weight: 700;
  color: var(--ink-3);
}
.result-icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  color: var(--ink);
}
.result-icon svg {
  width: 20px;
  height: 20px;
}
.result-icon.is-primary {
  background: var(--action-bg);
  color: var(--action-ink);
}
.result-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.result-label small {
  display: block;
  font-size: 12px;
  color: var(--ink-3);
}
.search-examples {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
@media (max-width: 767px) {
  .search-panel {
    position: fixed;
    inset: var(--search-top, 0px) 0 auto;
    width: 100%;
    max-width: none;
    height: var(--search-height, 100dvh);
    max-height: var(--search-height, 100dvh);
    margin: 0;
    border: 0;
    border-radius: 0;
  }
  .search-frame {
    height: 100%;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .search-scroll {
    flex: 1;
  }
}
</style>
