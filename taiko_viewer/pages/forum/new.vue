<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { isNavigationFailure } from "vue-router";
import { buildPageDescription } from "~/utils/seo";
import type { ForumSection } from "~/types/forum";
import type { SongCatalogItem, SongCatalogPagePayload, SongDetailPayload } from "~/types/content";
import { FORUM_IMAGE_MAX_BYTES, resolveForumSectionTranslation } from "~/utils/forum";

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

const copy = computed(() =>
  locale.value === "ja"
    ? {
        heading: "新規投稿",
        back: "フォーラムへ戻る",
        section: "セクション",
        threadType: "投稿タイプ",
        discussion: "雑談",
        guide: "攻略",
        achievement: "戦績",
        official: "告知",
        title: "タイトル（任意）",
        titlePlaceholder: "例：虹2025 三曲段の攻略メモ",
        summary: "概要",
        summaryPlaceholder: "未入力の場合は本文1段目から自動抽出します",
        tags: "タグ",
        tagsPlaceholder: "空白またはカンマ区切り。例：段位 全良 配速",
        songId: "関連曲",
        songIdPlaceholder: "曲名を検索して選択",
        difficulty: "関連難易度",
        level: "星数",
        levelPlaceholder: "例：10",
        paragraphs: "本文",
        paragraphDraftPlaceholder: "何かシェアしよう",
        paragraphCount: "{count} 段",
        addParagraph: "本文に追加",
        images: "画像",
        uploadingImages: "{count}枚をアップロード中…",
        imageCaption: "説明",
        uploadImage: "画像をアップロード",
        imageCaptionPlaceholder: "画像説明（任意）",
        submit: "投稿する",
        remove: "削除",
        contentRequired: "本文または画像を 1 つ以上追加してください",
        uploadSuccess: "画像をアップロードしました",
        uploadTooLarge: "1枚の画像は20MB以内で選択してください",
        uploadFailed: "画像アップロードに失敗しました",
        publishSuccess: "投稿を公開しました",
        publishFailed: "投稿に失敗しました",
        viewPublished: "投稿を見る",
        newPost: "新しい投稿",
        navigationFailed: "投稿は公開済みですが、ページを開けませんでした。"
      }
    : {
        heading: "发新帖",
        back: "返回社区",
        section: "版块",
        threadType: "帖子类型",
        discussion: "讨论",
        guide: "攻略",
        achievement: "战报",
        official: "公告",
        title: "标题（选填）",
        titlePlaceholder: "例如：虹2025 三曲段过段思路整理",
        summary: "摘要",
        summaryPlaceholder: "不填则自动从首段正文提取",
        tags: "标签",
        tagsPlaceholder: "用空格或逗号分隔，如：段位 全良 配速",
        songId: "关联歌曲",
        songIdPlaceholder: "搜索歌曲后选择",
        difficulty: "关联难度",
        level: "星级",
        levelPlaceholder: "例如 10",
        paragraphs: "正文",
        paragraphDraftPlaceholder: "分享点什么？",
        paragraphCount: "{count} 段",
        addParagraph: "加入正文",
        images: "图片",
        uploadingImages: "正在上传 {count} 张…",
        imageCaption: "说明",
        uploadImage: "上传图片",
        imageCaptionPlaceholder: "图片说明（可选）",
        submit: "发布",
        remove: "移除",
        contentRequired: "至少需要一段正文或一张图片",
        uploadSuccess: "图片上传完成",
        uploadTooLarge: "单张图片不能超过 20MB",
        uploadFailed: "图片上传失败",
        publishSuccess: "帖子已发布",
        publishFailed: "发帖失败",
        viewPublished: "查看帖子",
        newPost: "再发一帖",
        navigationFailed: "帖子已发布，但未能打开帖子页面。"
      }
);

const { data: sectionsData } = await useAsyncData<{ items: ForumSection[] }>(
  "forum-new-sections",
  () => apiFetch("/api/forum/sections"),
  {
    default: () => ({ items: [] })
  }
);

const threadTypeOptions = computed(() => [
  { label: copy.value.discussion, value: "discussion" },
  { label: copy.value.guide, value: "guide" },
  { label: copy.value.achievement, value: "achievement" },
  { label: copy.value.official, value: "official" }
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

const searchSongs = async () => {
  if (editorDisabled.value || !viewActive) return;
  const keyword = songQuery.value.trim();
  const search = ++searchGeneration;
  if (!keyword) { songResults.value = []; songLoading.value = false; return; }
  const request = requestGuard.capture();
  songLoading.value = true;
  try {
    const payload = await apiFetch<SongCatalogPagePayload>("/api/content/songs", { query: { view: "list", shelfStatus: 0, page: 1, pageSize: 8, keyword }, retry: 0 });
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
    if (!requestGuard.current(request)) return;
    publishedThreadId.value = thread.id;
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
      <header class="composer-panel__head">
        <NuxtLink :to="localePath('/forum')" class="composer-back-link">{{ copy.back }}</NuxtLink>
        <h1>{{ copy.heading }}</h1>
        <el-button type="primary" :disabled="editorDisabled || uploading" :loading="submitting" @click="submit">{{ copy.submit }}</el-button>
      </header>
      <section v-if="publishedThreadId !== null" class="composer-published" role="status">
        <p>{{ navigationFailed ? copy.navigationFailed : copy.publishSuccess }}</p>
        <el-button :loading="submitting" @click="viewPublishedThread">{{ copy.viewPublished }}</el-button>
        <el-button :disabled="submitting" @click="startAnotherThread">{{ copy.newPost }}</el-button>
      </section>
      <el-form label-position="top" :disabled="editorDisabled">
        <el-form-item class="composer-title" :label="copy.title">
          <el-input v-model="form.title" maxlength="120" show-word-limit :placeholder="copy.titlePlaceholder" />
        </el-form-item>
        <section class="block-editor block-editor--body">
          <div class="block-editor__head">
            <h3>{{ copy.paragraphs }}</h3>
            <span v-if="form.threadType === 'guide'">{{ copy.paragraphCount.replace("{count}", String(paragraphBlocks.length)) }}</span>
          </div>
          <el-input v-model="form.paragraphDraft" type="textarea" :rows="8" maxlength="4000" show-word-limit :placeholder="copy.paragraphDraftPlaceholder" :aria-label="copy.paragraphs" />
          <div v-if="form.threadType === 'guide'" class="block-editor__actions">
            <el-button type="primary" plain @click="addParagraph">{{ copy.addParagraph }}</el-button>
          </div>
          <div v-if="paragraphBlocks.length" class="block-list">
            <div v-for="(text, index) in paragraphBlocks" :key="`paragraph-${index}`" class="block-list__item">
              <el-input v-model="paragraphBlocks[index]" type="textarea" :rows="3" maxlength="4000" :aria-label="`${copy.paragraphs} ${index + 1}`" />
              <el-button text @click="removeParagraph(index)">{{ copy.remove }}</el-button>
            </div>
          </div>
          <div class="composer-media-grid" :aria-label="copy.images" :aria-busy="uploading">
            <div v-for="(image, index) in imageBlocks" :key="image.imageUrl" class="composer-image">
              <div class="composer-image__preview">
                <img :src="image.imageUrl" :alt="image.caption || `${copy.images} ${index + 1}`" />
              </div>
              <div class="composer-image__actions">
                <button type="button" class="composer-image__remove" :disabled="editorDisabled" :aria-label="`${copy.remove} ${copy.images} ${index + 1}`" @click="removeImage(index)">
                  <span aria-hidden="true">×</span>
                </button>
                <details class="composer-image__caption">
                  <summary>{{ copy.imageCaption }}</summary>
                  <el-input v-model="image.caption" type="textarea" :rows="3" maxlength="120" :placeholder="copy.imageCaptionPlaceholder" :aria-label="`${copy.imageCaptionPlaceholder} ${index + 1}`" />
                </details>
              </div>
            </div>
            <el-upload :key="accountUser?.id || 'guest'" class="composer-image-upload" :disabled="editorDisabled" :show-file-list="false" multiple :http-request="uploadImage" :before-upload="validateImageFile" accept="image/*">
              <el-button class="composer-image-upload__trigger" :loading="uploading" :aria-label="copy.uploadImage" :title="copy.uploadImage">
                <span v-if="!uploading" aria-hidden="true">+</span>
              </el-button>
            </el-upload>
          </div>
          <p v-if="uploading" class="composer-upload-status" role="status">{{ copy.uploadingImages.replace("{count}", String(uploadCount)) }}</p>
        </section>
        <details class="more-options" :open="showMoreOptions" @toggle="showMoreOptions = ($event.target as HTMLDetailsElement).open">
          <summary>{{ locale === 'ja' ? 'その他の設定' : '更多选项' }}</summary>
          <div class="more-options__body">
            <div class="composer-grid composer-grid--compact">
              <el-form-item :label="copy.section">
                <el-select v-model="form.sectionSlug">
                  <el-option v-for="section in sectionsData.items" :key="section.id" :label="getSectionLabel(section)" :value="section.slug" />
                </el-select>
              </el-form-item>
              <el-form-item :label="copy.threadType">
                <div class="type-chips">
                  <button v-for="option in threadTypeOptions" :key="option.value" type="button" :disabled="editorDisabled" :class="{ active: form.threadType === option.value }" :aria-pressed="form.threadType === option.value" @click="form.threadType = option.value">{{ option.label }}</button>
                </div>
              </el-form-item>
            </div>
            <section v-if="contextualSong && selectedSong" class="composer-context-card" aria-live="polite">
              <img :src="`/api/content/covers/${selectedSong.id}`" :alt="selectedSong.song_name" />
              <div>
                <strong>{{ locale === 'ja' && selectedSong.song_name_jp ? selectedSong.song_name_jp : selectedSong.song_name }}</strong>
                <span>{{ t(`community.discussingChart`) }} · {{ t(`difficulty.${form.difficultyType}`) }} · {{ form.level }}{{ t("guide.starSuffix") }}</span>
              </div>
            </section>
            <el-form-item :label="copy.summary">
              <el-input v-model="form.summary" maxlength="280" show-word-limit :placeholder="copy.summaryPlaceholder" />
            </el-form-item>
            <el-form-item :label="copy.tags">
              <el-input v-model="form.tagsInput" :placeholder="copy.tagsPlaceholder" />
            </el-form-item>
            <div class="song-picker">
              <label for="composer-song-search">{{ copy.songId }}</label>
              <div class="song-picker__search">
                <el-input id="composer-song-search" v-model="songQuery" :placeholder="copy.songIdPlaceholder" @keyup.enter="searchSongs" />
                <el-button :loading="songLoading" @click="searchSongs">{{ t('common.search') }}</el-button>
              </div>
              <div v-if="songResults.length" class="song-picker__results">
                <button v-for="song in songResults" :key="song.id" type="button" :disabled="editorDisabled" @click="chooseSong(song)">
                  <span>{{ locale === 'ja' && song.song_name_jp ? song.song_name_jp : song.song_name }}</span>
                  <small>#{{ song.id }} · {{ song.type }}</small>
                </button>
              </div>
              <p v-if="selectedSong" class="song-picker__selected">{{ locale === 'ja' && selectedSong.song_name_jp ? selectedSong.song_name_jp : selectedSong.song_name }}</p>
            </div>
            <div v-if="selectedSong" class="composer-grid composer-grid--song">
              <el-form-item :label="copy.difficulty">
                <el-select v-model="form.difficultyType" clearable>
                  <el-option v-for="option in difficultyOptions" :key="option.value" :label="option.label" :value="option.value" />
                </el-select>
              </el-form-item>
              <el-form-item :label="copy.level">
                <el-input :model-value="selectedSongLevel" readonly :placeholder="copy.levelPlaceholder" />
              </el-form-item>
            </div>
          </div>
        </details>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.composer-published { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 16px; }
.composer-published p { margin: 0; }

.forum-new-page {
  display: flex;
  justify-content: center;
}

.composer-panel {
  width: 100%;
  padding: 4px 0 24px;
}

.composer-context-card { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding: 10px 12px; border: 1px solid var(--viewer-border); border-radius: 14px; background:var(--viewer-surface); }
.composer-context-card img { width: 56px; height: 56px; border-radius: 10px; object-fit: cover; }
.composer-context-card div { display: grid; gap: 4px; min-width: 0; }
.composer-context-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.composer-context-card span { color:var(--viewer-text-muted); font-size: 13px; }

.composer-back-link {
  color:var(--viewer-error);
  text-decoration: none;
}

.composer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.type-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.type-chips button { min-height: 44px; padding: 0 11px; border: 1px solid var(--viewer-border); border-radius: 9px; color:var(--viewer-text-muted); background:transparent; font: inherit; font-size: 12px; cursor: pointer; }
.type-chips button.active { border-color:var(--viewer-accent-strong); color:var(--viewer-on-primary); background:var(--viewer-primary); }

.composer-grid--song {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.composer-grid--compact { margin-bottom: 2px; }
.more-options { margin-top: 12px; border-top: 1px solid var(--viewer-border); border-bottom: 1px solid var(--viewer-border); }
.more-options summary { padding: 14px 2px; color:var(--viewer-accent-strong); font-weight: 700; cursor: pointer; }
.more-options__body { display: grid; gap: 4px; padding: 4px 0 12px; }
.song-picker { display: grid; gap: 8px; margin: 2px 0 10px; }
.song-picker > label { color:var(--viewer-text); font-size: 14px; font-weight: 600; }
.song-picker__search { display: flex; gap: 8px; }
.song-picker__search .el-input { flex: 1; }
.song-picker__results { display: grid; gap: 4px; max-height: 240px; overflow-y: auto; padding: 4px; border: 1px solid var(--viewer-border); border-radius: 12px; background:var(--viewer-surface); }
.song-picker__results button { display: grid; gap: 2px; padding: 9px 10px; border: 0; border-radius: 8px; color:var(--viewer-text); background:transparent; text-align: left; cursor: pointer; }
.song-picker__results button:hover, .song-picker__results button:focus-visible { background:color-mix(in srgb, var(--viewer-accent-strong) 10%, var(--viewer-surface)); outline: none; }
.song-picker__results small { color:var(--viewer-text-muted); }
.song-picker__selected { margin: 0; padding: 8px 10px; border-radius: 8px; color:var(--viewer-accent-strong); background:color-mix(in srgb, var(--viewer-accent-strong) 10%, var(--viewer-surface)); font-size: 13px; }

.block-editor {
  display: grid;
  gap: 12px;
  padding: 18px;
  margin-top: 10px;
  border-radius: 22px;
  background:var(--viewer-surface-subtle);
}

.block-editor--body { padding: 0; margin-top: 5px; border-radius: 0; background:transparent; }
.block-editor--body .block-editor__head h3 { font-size: 15px; }

.block-editor__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.block-editor__head h3 {
  margin: 0;
  font-size: 18px;
}

.block-editor__head span {
  color:var(--viewer-text-muted);
  font-size: 12px;
}

.block-editor__actions {
  display: flex;
  justify-content: flex-end;
}

.block-list {
  display: grid;
  gap: 12px;
}

.block-list__item {
  padding: 14px;
  border-radius: 18px;
  background:var(--viewer-surface-subtle);
}

.block-list__item p {
  margin: 0 0 10px;
  white-space: pre-wrap;
  line-height: 1.8;
}

.composer-media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  align-items: start;
  gap: 10px;
}
.composer-image { min-width: 0; }
.composer-image__preview { position: relative; aspect-ratio: 1; }
.composer-image__preview img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
.composer-image__actions { position: relative; }
.composer-image__remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--viewer-text-muted);
  background: transparent;
  font-size: 24px;
  z-index: 1;
  cursor: pointer;
}
.composer-image__remove:disabled { color: var(--viewer-text-disabled); cursor: not-allowed; }
.composer-image__caption summary { padding-right: 44px; display: flex; align-items: center; min-height: 44px; color: var(--viewer-text-muted); font-size: 13px; cursor: pointer; }
.composer-image-upload :deep(.el-upload) { display: block; }
.composer-image-upload__trigger {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  padding: 0;
  border: 1px dashed var(--viewer-control-border);
  border-radius: 10px;
  background: transparent;
  color: var(--viewer-text-muted);
  font-size: 30px;
}
.composer-upload-status { margin: 0; color: var(--viewer-text-muted); font-size: 13px; }

body.theme-dark .block-editor__head span {
  color:var(--viewer-text-muted);
}

body.theme-dark .block-editor {
  background:var(--viewer-surface-subtle);
}

body.theme-dark .block-editor--body { background:transparent; }

body.theme-dark .block-list__item {
  background:var(--viewer-overlay);
}

@media (max-width: 860px) {
  .composer-grid,
  .composer-grid--song {
    grid-template-columns: 1fr;
  }

  .composer-grid--song { grid-template-columns: 1fr; }
}
.composer-panel__head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; position: sticky; top: 0; z-index: 20; margin-bottom: 18px; gap: 16px; padding: 10px 0; background: var(--viewer-surface); }
.composer-panel__head h1 { margin: 0; font-size: 20px; }
.composer-panel__head > .el-button { justify-self: end; min-height: 44px; }
.composer-back-link { display: flex; align-items: center; min-height: 44px; font-size: 14px; }
.more-options summary { min-height: 44px; box-sizing: border-box; }
@media (max-width: 960px) {
  .composer-panel { padding: 0 0 calc(16px + env(safe-area-inset-bottom)); }
  .composer-panel__head {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 12px;
    margin-bottom: 20px;
    padding: max(16px, env(safe-area-inset-top)) 0 12px;
    /* Match the canvas while keeping scrolled content behind sticky navigation. */
    background: var(--viewer-bg);
  }
  .composer-panel__head h1 {
    font-size: 18px;
    font-weight: 600;
    color: var(--viewer-text);
  }
  .composer-panel__head .composer-back-link {
    justify-self: start;
    color: var(--viewer-text-muted);
  }
  .composer-panel__head > .el-button {
    height: 44px;
    padding-inline: 18px;
    border-radius: 12px;
    box-shadow: none;
  }
  .composer-title { display: none; }
  .block-editor--body :deep(.el-textarea__inner) { min-height: 240px; font-size: 16px; line-height: 1.7; }
}
</style>
