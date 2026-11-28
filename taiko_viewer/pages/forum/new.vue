<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { isNavigationFailure } from "vue-router";
import { buildPageDescription } from "~/utils/seo";
import type { ForumSection } from "~/types/forum";
import type { SongCatalogItem, SongCatalogPagePayload, SongDetailPayload } from "~/types/content";
import { FORUM_IMAGE_MAX_BYTES, resolveForumSectionTranslation } from "~/utils/forum";
import { catalogRequestFor } from "~/utils/rework/catalog";
import { browserDraftStorage, cleanThreadDraft, readDraft, removeDraft, threadDraftKey, writeDraft } from "~/utils/rework/communityDraft";

type UploadedImage = {
  imageUrl: string;
  caption: string;
};

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const requestGuard = useAccountRequestGuard(false);
let viewActive = true;
let searchGeneration = 0;
let uploadGeneration = 0;
const publishedThreadId = ref<number | null>(null);
const navigationFailed = ref(false);
const uploadCount = ref(0);
const editorDisabled = computed(() => !accountUser.value || submitting.value || publishedThreadId.value !== null);
// Accepted creation receipts survive KeepAlive deactivation; they must not be
// submitted again merely because the following route transition was cancelled.
onActivated(() => { viewActive = true; });
onDeactivated(() => { viewActive = false; searchGeneration++; uploadGeneration++; uploadCount.value = 0; songLoading.value = false; });
onBeforeUnmount(() => { viewActive = false; searchGeneration++; });

definePageMeta({
  contentLayout: "reading",
  hidePageHeader: true,
  composerHeader: true,
  middleware: "account-auth",
  pageTitleKey: "forum.newThread",
  pageDescKey: "page.forum.new.desc",
  navKey: "/forum",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "forum.newThread", to: "/forum/new" }
  ]
});

useViewerSeo(() => ({
  title: t("forum.newThread"),
  description: buildPageDescription(t("page.forum.new.desc")),
  path: "/forum/new"
}));

const form = reactive({
  sectionSlug: "score-guides",
  threadType: "discussion",
  title: "",
  summary: "",
  tagsInput: "",
  songId: "",
  difficultyType: "",
  level: "",
  paragraphDraft: ""
});
form.sectionSlug = String(route.query.section || form.sectionSlug);

const paragraphBlocks = ref<string[]>([]);
const imageBlocks = ref<UploadedImage[]>([]);
const uploading = computed(() => uploadCount.value > 0);
const submitting = ref(false);
const showMoreOptions = ref(false);
const songQuery = ref("");
const songResults = ref<SongCatalogItem[]>([]);
const songLoading = ref(false);
const selectedSong = ref<SongCatalogItem | null>(null);
const contextualSong = ref(false);

// Visible text moved from the inline zh / ja table to locales (rework.forum.compose.*); the keys are the old names.
const COPY_KEYS = [
  "heading", "back", "section", "threadType", "title", "titlePlaceholder", "summary", "summaryPlaceholder", "tags",
  "tagsPlaceholder", "paragraphs", "paragraphDraftPlaceholder", "addParagraph", "images", "imageCaption", "uploadImage",
  "imageCaptionPlaceholder", "submit", "remove", "contentRequired", "uploadSuccess", "uploadTooLarge", "uploadFailed",
  "publishSuccess", "publishFailed", "viewPublished", "newPost", "navigationFailed", "moreOptions"
] as const;
const copy = computed(() => Object.fromEntries(COPY_KEYS.map((key) => [key, t(`rework.forum.compose.${key}`)])) as Record<(typeof COPY_KEYS)[number], string>);

const { data: sectionsData } = await useAsyncData<{ items: ForumSection[] }>(
  "forum-new-sections",
  () => apiFetch("/api/forum/sections"),
  {
    default: () => ({ items: [] })
  }
);

const threadTypeOptions = computed(() => [
  { label: t("forum.types.discussion"), value: "discussion" },
  { label: t("forum.types.guide"), value: "guide" },
  { label: t("forum.types.achievement"), value: "achievement" },
  { label: t("forum.types.official"), value: "official" }
]);
const difficultyOptions = computed(() =>
  [1, 2, 3, 4, 5].filter((value) => !selectedSong.value || selectedSong.value[`level_${value}` as keyof SongCatalogItem] !== undefined && selectedSong.value[`level_${value}` as keyof SongCatalogItem] !== null && String(selectedSong.value[`level_${value}` as keyof SongCatalogItem]) !== "").map((value) => ({
    value: String(value),
    label: t(`difficulty.${value}`)
  }))
);
const selectedSongLevel = computed(() => {
  if (!selectedSong.value || !form.difficultyType) return "";
  return String(selectedSong.value[`level_${form.difficultyType}` as keyof SongCatalogItem] ?? "");
});

watch(() => accountUser.value?.id, () => {
  searchGeneration++;
  showMoreOptions.value = false;
  // Drafts and completion receipts are private to the current author.
  form.title = "";
  form.summary = "";
  form.tagsInput = "";
  form.paragraphDraft = "";
  form.songId = "";
  form.difficultyType = "";
  form.level = "";
  paragraphBlocks.value = [];
  imageBlocks.value = [];
  selectedSong.value = null;
  contextualSong.value = false;
  songQuery.value = "";
  songResults.value = [];
  songLoading.value = false;
  publishedThreadId.value = null;
  navigationFailed.value = false;
  submitting.value = false;
  uploadCount.value = 0;
  // Drafts are per account: stop saving, then load the new account's draft.
  threadDraftReady = false;
  draftRestored.value = false;
  void nextTick(restoreThreadDraft);
}, { flush: 'sync' });

const contextualSongId = Number(route.query.songId || 0);
const contextualDifficulty = Number(route.query.difficulty || 0);
if (Number.isInteger(contextualSongId) && contextualSongId > 0) {
  const request = requestGuard.capture();
  try {
    const payload = await apiFetch<SongDetailPayload>(`/api/content/songs/${contextualSongId}`);
    if (requestGuard.current(request) && payload.song) {
      selectedSong.value = payload.song;
      form.songId = String(payload.song.id);
      songQuery.value = payload.song.song_name;
      const hasDifficulty = contextualDifficulty >= 1 && contextualDifficulty <= 5 && payload.song[`level_${contextualDifficulty}` as keyof SongCatalogItem] !== undefined && payload.song[`level_${contextualDifficulty}` as keyof SongCatalogItem] !== null && String(payload.song[`level_${contextualDifficulty}` as keyof SongCatalogItem]).trim() !== "";
      if (hasDifficulty) {
        form.difficultyType = String(contextualDifficulty);
        contextualSong.value = true;
      }
    }
  } catch {}
}
const getSectionLabel = (section: ForumSection) => resolveForumSectionTranslation(t, section.slug, section.name);

// Draft (localStorage, read only after mount): text fields, paragraphs and the URLs of already uploaded images.
// Removed when the thread is accepted or the draft is discarded. Nothing storage-dependent renders on the server.
let threadDraftReady = false;
let composerMounted = false;
const draftRestored = ref(false);
const draftSnapshot = () => ({
  sectionSlug: form.sectionSlug, threadType: form.threadType, title: form.title, summary: form.summary, tagsInput: form.tagsInput,
  paragraphDraft: form.paragraphDraft, paragraphs: paragraphBlocks.value, images: imageBlocks.value
});
function restoreThreadDraft() {
  threadDraftReady = false;
  if (!composerMounted) return;
  const draft = readDraft(browserDraftStorage(), threadDraftKey(accountUser.value?.id), cleanThreadDraft);
  const untouched = !form.title && !form.summary && !form.tagsInput && !form.paragraphDraft && !paragraphBlocks.value.length && !imageBlocks.value.length;
  if (draft && untouched && publishedThreadId.value === null) {
    if (draft.sectionSlug && !route.query.section) form.sectionSlug = draft.sectionSlug;
    if (threadTypeOptions.value.some((option) => option.value === draft.threadType)) form.threadType = draft.threadType;
    form.title = draft.title;
    form.summary = draft.summary;
    form.tagsInput = draft.tagsInput;
    form.paragraphDraft = draft.paragraphDraft;
    paragraphBlocks.value = [...draft.paragraphs];
    imageBlocks.value = draft.images.map((image) => ({ ...image }));
    draftRestored.value = true;
  }
  threadDraftReady = true;
}
watch(() => JSON.stringify(draftSnapshot()), () => {
  if (!threadDraftReady || publishedThreadId.value !== null) return;
  writeDraft(browserDraftStorage(), threadDraftKey(accountUser.value?.id), draftSnapshot(), cleanThreadDraft);
});
const discardDraft = () => {
  if (submitting.value || publishedThreadId.value !== null) return;
  removeDraft(browserDraftStorage(), threadDraftKey(accountUser.value?.id));
  threadDraftReady = false;
  form.title = "";
  form.summary = "";
  form.tagsInput = "";
  form.paragraphDraft = "";
  paragraphBlocks.value = [];
  imageBlocks.value = [];
  draftRestored.value = false;
  threadDraftReady = true;
};
onMounted(() => {
  composerMounted = true;
  restoreThreadDraft();
});

const searchSongs = async () => {
  if (editorDisabled.value || !viewActive) return;
  const keyword = songQuery.value.trim();
  const search = ++searchGeneration;
  if (!keyword) { songResults.value = []; songLoading.value = false; return; }
  const request = requestGuard.capture();
  songLoading.value = true;
  try {
    // Shared catalog contract (utils/rework/catalog.ts): view=list, page 1, 8 results, the keyword, catalog order and
    // shelfStatus 0 (released songs) — the same songs the picker returned before.
    const payload = await apiFetch<SongCatalogPagePayload>("/api/content/songs", { query: catalogRequestFor({ q: keyword, shelf: "available", sort: "catalog", page: 1 }, 8), retry: 0 });
    if (viewActive && requestGuard.current(request) && search === searchGeneration && songQuery.value.trim() === keyword) songResults.value = payload.songs;
  } catch (error: any) {
    if (viewActive && requestGuard.current(request) && search === searchGeneration) {
      ElMessage.error(error?.data?.statusMessage || error?.message || t("errors.actionFailed"));
    }
  } finally {
    if (requestGuard.current(request) && search === searchGeneration) songLoading.value = false;
  }
};

const chooseSong = (song: SongCatalogItem) => {
  if (editorDisabled.value || !viewActive) return;
  searchGeneration++;
  songLoading.value = false;
  selectedSong.value = song;
  form.songId = String(song.id);
  songQuery.value = song.song_name;
  songResults.value = [];
  form.difficultyType = "";
};

watch(selectedSongLevel, (level) => {
  form.level = level;
}, { immediate: true });

const addParagraph = () => {
  if (editorDisabled.value || !form.paragraphDraft.trim()) return;
  paragraphBlocks.value.push(form.paragraphDraft.trim());
  form.paragraphDraft = "";
};

const removeParagraph = (index: number) => {
  if (editorDisabled.value) return;
  paragraphBlocks.value.splice(index, 1);
};

const removeImage = (index: number) => {
  if (editorDisabled.value) return;
  imageBlocks.value.splice(index, 1);
};

const validateImageFile = (file: File) => {
  if (file.size > FORUM_IMAGE_MAX_BYTES) {
    ElMessage.warning(copy.value.uploadTooLarge);
    return false;
  }
  return true;
};

const uploadImage = async (options: any) => {
  if (editorDisabled.value || !viewActive) {
    options.onError?.(new Error(copy.value.uploadFailed));
    return;
  }
  if (options.file && !validateImageFile(options.file)) {
    options.onError?.(new Error(copy.value.uploadTooLarge));
    return;
  }
  const request = requestGuard.capture();
  const generation = uploadGeneration;
  uploadCount.value++;
  try {
    const body = new FormData();
    body.append("image", options.file);
    const result = await apiFetch<{ imageUrl: string }>("/api/forum/media/images", {
      method: "POST",
      body,
      retry: 0
    });
    if (!requestGuard.current(request) || generation !== uploadGeneration) return;
    imageBlocks.value.push({
      imageUrl: result.imageUrl,
      caption: ""
    });
    if (viewActive) ElMessage.success(copy.value.uploadSuccess);
    options.onSuccess?.(result, options.file);
  } catch (error: any) {
    if (!requestGuard.current(request) || generation !== uploadGeneration) return;
    const statusCode = Number(error?.statusCode || error?.data?.statusCode || 0);
    const statusMessage = String(error?.data?.statusMessage || error?.message || "");
    const isOversized = statusCode === 413 || statusMessage.includes("20MB") || statusMessage.includes("图片过大");
    if (viewActive) {
      if (isOversized) ElMessage.warning(copy.value.uploadTooLarge);
      else ElMessage.error(statusMessage || copy.value.uploadFailed);
    }
    options.onError?.(error);
  } finally {
    if (requestGuard.current(request) && generation === uploadGeneration) uploadCount.value = Math.max(0, uploadCount.value - 1);
  }
};

const startAnotherThread = () => {
  if (submitting.value || !accountUser.value || !viewActive || publishedThreadId.value === null) return;
  form.title = "";
  form.summary = "";
  form.tagsInput = "";
  form.paragraphDraft = "";
  paragraphBlocks.value = [];
  imageBlocks.value = [];
  publishedThreadId.value = null;
  navigationFailed.value = false;
};

const viewPublishedThread = async () => {
  if (!publishedThreadId.value || submitting.value || !accountUser.value || !viewActive) return;
  const request = requestGuard.capture();
  submitting.value = true;
  navigationFailed.value = false;
  try {
    const failure = await router.push(localePath(`/forum/thread/${publishedThreadId.value}`));
    if (requestGuard.current(request) && isNavigationFailure(failure)) navigationFailed.value = true;
  } catch {
    if (requestGuard.current(request)) navigationFailed.value = true;
  } finally {
    if (requestGuard.current(request)) submitting.value = false;
  }
};

const submit = async () => {
  if (submitting.value || uploading.value || !accountUser.value || !viewActive) return;
  if (publishedThreadId.value !== null) { await viewPublishedThread(); return; }
  const request = requestGuard.capture();
  // Submit a snapshot; do not remove the editable text before acceptance.
  const draft = form.paragraphDraft.trim();
  const contentBlocks = [
    ...[...paragraphBlocks.value.map(text => text.trim()).filter(Boolean), ...(draft ? [draft] : [])].map((text) => ({ type: "paragraph" as const, text })),
    ...imageBlocks.value.map((image) => ({
      type: "image" as const,
      imageUrl: image.imageUrl,
      caption: image.caption || undefined
    }))
  ];
  if (!contentBlocks.length) {
    ElMessage.error(copy.value.contentRequired);
    return;
  }
  const draftKey = threadDraftKey(accountUser.value?.id);
  submitting.value = true;
  try {
    const thread = await apiFetch<{ id: number }>("/api/forum/threads", {
      method: "POST",
      retry: 0,
      body: {
        sectionSlug: form.sectionSlug,
        threadType: form.threadType,
        title: form.title,
        locale: locale.value,
        summary: form.summary,
        tags: form.tagsInput
          .split(/[\s,，#]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        songId: form.songId || undefined,
        difficultyType: form.difficultyType || undefined,
        level: form.level || undefined,
        contentBlocks
      }
    });
    // The accepted thread retires the stored draft of the account that posted it.
    removeDraft(browserDraftStorage(), draftKey);
    if (!requestGuard.current(request)) return;
    publishedThreadId.value = thread.id;
    draftRestored.value = false;
    if (viewActive) ElMessage.success(copy.value.publishSuccess);
  } catch (error: any) {
    if (requestGuard.current(request) && viewActive) {
      ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.publishFailed);
    }
  } finally {
    if (requestGuard.current(request)) submitting.value = false;
  }
  // A failed route transition is not a failed creation and cannot resend POST.
  if (requestGuard.current(request) && viewActive && publishedThreadId.value !== null) await viewPublishedThread();
};
</script>

<template>
  <div class="forum-new-page">
    <section class="composer-panel">
      <ReworkCommunityComposerBar
        :title="copy.heading"
        :back-to="localePath('/forum')"
        :back-label="copy.back"
        :submit-label="copy.submit"
        :disabled="editorDisabled || uploading"
        :busy="submitting"
        @submit="submit"
      />
      <section v-if="publishedThreadId !== null" class="composer-published rw-note" role="status">
        <p>{{ navigationFailed ? copy.navigationFailed : copy.publishSuccess }}</p>
        <button type="button" class="rw-btn rw-btn--primary" :disabled="submitting" :aria-busy="submitting || undefined" @click="viewPublishedThread">{{ copy.viewPublished }}</button>
        <button type="button" class="rw-btn" :disabled="submitting" @click="startAnotherThread">{{ copy.newPost }}</button>
      </section>
      <section v-if="draftRestored && publishedThreadId === null" class="composer-draft rw-note" role="status">
        <p>{{ t("rework.forum.tools.draftRestored") }}</p>
        <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" :disabled="submitting" @click="discardDraft">{{ t("rework.forum.tools.discardDraft") }}</button>
      </section>
      <form class="composer-form" novalidate @submit.prevent>
        <fieldset class="composer-fieldset" :disabled="editorDisabled">
          <div class="rw-form composer-row">
            <label class="rw-field">
              <span class="rw-field__label">{{ copy.section }}</span>
              <select v-model="form.sectionSlug" class="rw-select">
                <option v-for="section in sectionsData.items" :key="section.id" :value="section.slug">{{ getSectionLabel(section) }}</option>
              </select>
            </label>
            <div class="rw-field">
              <span id="composer-type-label" class="rw-field__label">{{ copy.threadType }}</span>
              <div class="rw-seg type-chips" role="group" aria-labelledby="composer-type-label">
                <button v-for="option in threadTypeOptions" :key="option.value" type="button" :disabled="editorDisabled" :aria-pressed="form.threadType === option.value" @click="form.threadType = option.value">{{ option.label }}</button>
              </div>
            </div>
          </div>

          <label class="rw-field composer-title">
            <span class="rw-field__label">{{ copy.title }}</span>
            <input v-model="form.title" class="rw-input composer-title__input" maxlength="120" :placeholder="copy.titlePlaceholder" />
            <span class="rw-count composer-counter num">{{ form.title.length }} / 120</span>
          </label>

          <section class="rw-field block-editor block-editor--body">
            <div class="block-editor__head">
              <label for="composer-body" class="rw-field__label">{{ copy.paragraphs }}</label>
              <span v-if="form.threadType === 'guide'" class="rw-count">{{ t("rework.forum.compose.paragraphCount", { count: paragraphBlocks.length }) }}</span>
            </div>
            <textarea id="composer-body" v-model="form.paragraphDraft" class="rw-input rw-textarea composer-body" rows="8" maxlength="4000" :placeholder="copy.paragraphDraftPlaceholder" />
            <span class="rw-count composer-counter num">{{ form.paragraphDraft.length }} / 4000</span>
            <div v-if="form.threadType === 'guide'" class="block-editor__actions">
              <button type="button" class="rw-btn" @click="addParagraph"><ReworkIcon name="plus" />{{ copy.addParagraph }}</button>
            </div>
            <ol v-if="paragraphBlocks.length" class="block-list">
              <li v-for="(text, index) in paragraphBlocks" :key="`paragraph-${index}`" class="block-list__item">
                <textarea v-model="paragraphBlocks[index]" class="rw-input rw-textarea" rows="3" maxlength="4000" :aria-label="t('rework.forum.compose.paragraphN', { n: index + 1 })" />
                <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" @click="removeParagraph(index)"><ReworkIcon name="trash" />{{ copy.remove }}</button>
              </li>
            </ol>
          </section>

          <ReworkCommunityComposerImages :images="imageBlocks" :disabled="editorDisabled" :uploading="uploading" :upload-count="uploadCount" @remove="removeImage">
            <el-upload :key="accountUser?.id || 'guest'" class="composer-image-upload" :disabled="editorDisabled" :show-file-list="false" multiple :http-request="uploadImage" :before-upload="validateImageFile" accept="image/*">
              <button type="button" class="composer-image-upload__trigger" :disabled="editorDisabled" :aria-label="copy.uploadImage" :title="copy.uploadImage" :aria-busy="uploading || undefined">
                <ReworkIcon :name="uploading ? 'upload' : 'plus'" />
              </button>
            </el-upload>
          </ReworkCommunityComposerImages>

          <ReworkCommunitySongPicker
            v-model:query="songQuery"
            v-model:difficulty="form.difficultyType"
            :results="songResults"
            :loading="songLoading"
            :selected="selectedSong"
            :difficulty-options="difficultyOptions"
            :level="selectedSongLevel"
            :disabled="editorDisabled"
            @search="searchSongs"
            @choose="chooseSong"
          />

          <details class="more-options" :open="showMoreOptions" @toggle="showMoreOptions = ($event.target as HTMLDetailsElement).open">
            <summary class="rw-btn rw-btn--ghost more-options__summary"><ReworkIcon name="chevron" />{{ copy.moreOptions }}</summary>
            <div class="more-options__body">
              <label class="rw-field">
                <span class="rw-field__label">{{ copy.summary }}</span>
                <textarea v-model="form.summary" class="rw-input rw-textarea" rows="2" maxlength="280" :placeholder="copy.summaryPlaceholder" />
                <span class="rw-count composer-counter num">{{ form.summary.length }} / 280</span>
              </label>
              <label class="rw-field">
                <span class="rw-field__label">{{ copy.tags }}</span>
                <input v-model="form.tagsInput" class="rw-input" :placeholder="copy.tagsPlaceholder" />
              </label>
            </div>
          </details>
        </fieldset>
      </form>
    </section>
  </div>
</template>

<style scoped>
/* Layout only (no DS tokens in pages): the composer bar, images and song picker are reworked components; fields use
   the shared rw-* classes. */
.forum-new-page {
  display: flex;
  justify-content: center;
}
.composer-panel {
  width: 100%;
  min-width: 0;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}
.composer-published {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 20px;
}
.composer-published p {
  flex: 1 1 100%;
  margin: 0;
}
.composer-draft {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 20px;
}
.composer-draft p {
  margin: 0;
}
.composer-form {
  min-width: 0;
}
.composer-fieldset {
  display: grid;
  gap: 24px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.composer-row {
  align-items: flex-start;
}
.composer-title__input {
  width: 100%;
  min-height: 52px;
  font-size: 1.25rem;
  font-weight: 700;
}
.composer-counter {
  align-self: flex-end;
}
.block-editor__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.composer-body {
  width: 100%;
  min-height: 220px;
}
.block-editor__actions {
  display: flex;
  justify-content: flex-end;
}
.block-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.block-list__item {
  display: grid;
  gap: 4px;
  justify-items: end;
}
.block-list__item textarea {
  width: 100%;
}
.composer-image-upload :deep(.el-upload) {
  display: block;
  width: 100%;
  height: 100%;
}
.more-options__summary {
  justify-content: flex-start;
  list-style: none;
}
.more-options__summary::-webkit-details-marker {
  display: none;
}
.more-options__summary svg {
  width: 18px;
  height: 18px;
  transform: rotate(-90deg);
}
.more-options[open] .more-options__summary svg {
  transform: none;
}
.more-options__body {
  display: grid;
  gap: 16px;
  padding-top: 12px;
}
.more-options__body .rw-input {
  width: 100%;
}
@media (max-width: 767px) {
  .composer-row .rw-field {
    flex: 1 1 100%;
  }
  .composer-body {
    min-height: 240px;
  }
}
</style>
