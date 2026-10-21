<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
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

definePageMeta({
  contentLayout: "reading",
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
const uploading = ref(false);
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
        discussionTip: "通常の交流、質問、体験共有に向いています。",
        guideTip: "譜面攻略、運手分解、練習ルート共有に向いています。",
        achievementTip: "戦績共有、全良報告、高得点の振り返りに向いています。",
        officialTip: "管理・モデレーター向けです。",
        heading: "新規投稿",
        back: "フォーラムへ戻る",
        section: "セクション",
        threadType: "投稿タイプ",
        discussion: "雑談",
        guide: "攻略",
        achievement: "戦績",
        official: "告知",
        title: "タイトル",
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
        paragraphs: "正文",
        paragraphDraftPlaceholder: "話したいことを書いてみましょう",
        paragraphCount: "{count} 段",
        addParagraph: "本文に追加",
        images: "画像",
        imageCount: "{count} 枚",
        uploadImage: "画像をアップロード",
        imageCaptionPlaceholder: "画像説明（任意）",
        submit: "投稿する",
        remove: "削除",
        contentRequired: "本文または画像を 1 つ以上追加してください",
        uploadSuccess: "画像をアップロードしました",
        uploadTooLarge: "1枚の画像は20MB以内で選択してください",
        uploadFailed: "画像アップロードに失敗しました",
        publishSuccess: "投稿を公開しました",
        publishFailed: "投稿に失敗しました"
      }
    : {
        discussionTip: "适合普通交流、提问和经验分享。",
        guideTip: "适合写谱面思路、手法拆解和练习路线。",
        achievementTip: "适合晒分、全良战报和冲分复盘。",
        officialTip: "仅供站务/版主用途。",
        heading: "发布新帖",
        back: "返回论坛",
        section: "版块",
        threadType: "帖子类型",
        discussion: "讨论",
        guide: "攻略",
        achievement: "战报",
        official: "公告",
        title: "标题",
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
        paragraphDraftPlaceholder: "想说点什么？",
        paragraphCount: "{count} 段",
        addParagraph: "加入正文",
        images: "插图",
        imageCount: "{count} 张",
        uploadImage: "上传图片",
        imageCaptionPlaceholder: "图片说明（可选）",
        submit: "发布主题",
        remove: "移除",
        contentRequired: "至少需要一段正文或一张图片",
        uploadSuccess: "图片上传完成",
        uploadTooLarge: "单张图片不能超过 20MB",
        uploadFailed: "图片上传失败",
        publishSuccess: "帖子已发布",
        publishFailed: "发帖失败"
      }
);

const { data: sectionsData } = await useAsyncData<{ items: ForumSection[] }>(
  "forum-new-sections",
  () => apiFetch("/api/forum/sections"),
  {
    default: () => ({ items: [] })
  }
);

const threadTypeTips = computed<Record<string, string>>(() => ({
  discussion: copy.value.discussionTip,
  guide: copy.value.guideTip,
  achievement: copy.value.achievementTip,
  official: copy.value.officialTip
}));
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

const contextualSongId = Number(route.query.songId || 0);
const contextualDifficulty = Number(route.query.difficulty || 0);
if (Number.isInteger(contextualSongId) && contextualSongId > 0) {
  try {
    const payload = await apiFetch<SongDetailPayload>(`/api/content/songs/${contextualSongId}`);
    if (payload.song) {
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
  const keyword = songQuery.value.trim();
  if (!keyword) { songResults.value = []; return; }
  songLoading.value = true;
  try {
    const payload = await apiFetch<SongCatalogPagePayload>("/api/content/songs", { query: { view: "list", shelfStatus: 0, page: 1, pageSize: 8, keyword } });
    songResults.value = payload.songs;
  } finally {
    songLoading.value = false;
  }
};

const chooseSong = (song: SongCatalogItem) => {
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
  if (!form.paragraphDraft.trim()) return;
  paragraphBlocks.value.push(form.paragraphDraft.trim());
  form.paragraphDraft = "";
};

const removeParagraph = (index: number) => {
  paragraphBlocks.value.splice(index, 1);
};

const removeImage = (index: number) => {
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
  if (options.file && !validateImageFile(options.file)) {
    options.onError?.(new Error(copy.value.uploadTooLarge));
    return;
  }
  uploading.value = true;
  try {
    const body = new FormData();
    body.append("image", options.file);
    const result = await apiFetch<{ imageUrl: string }>("/api/forum/media/images", {
      method: "POST",
      body
    });
    imageBlocks.value.push({
      imageUrl: result.imageUrl,
      caption: ""
    });
    ElMessage.success(copy.value.uploadSuccess);
    options.onSuccess?.(result, options.file);
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || error?.data?.statusCode || 0);
    const statusMessage = String(error?.data?.statusMessage || error?.message || "");
    const isOversized = statusCode === 413 || statusMessage.includes("20MB") || statusMessage.includes("图片过大");
    if (isOversized) {
      ElMessage.warning(copy.value.uploadTooLarge);
    } else {
      ElMessage.error(statusMessage || copy.value.uploadFailed);
    }
    options.onError?.(error);
  } finally {
    uploading.value = false;
  }
};

const submit = async () => {
  if (submitting.value) return;
  if (form.paragraphDraft.trim()) {
    addParagraph();
  }
  const contentBlocks = [
    ...paragraphBlocks.value.map((text) => ({ type: "paragraph" as const, text })),
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
      body: {
        sectionSlug: form.sectionSlug,
        threadType: form.threadType,
        title: form.title,
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
    ElMessage.success(copy.value.publishSuccess);
    await router.push(localePath(`/forum/thread/${thread.id}`));
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.publishFailed);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="forum-new-page">
    <section class="composer-panel">
      <div class="composer-panel__head">
        <div><p class="composer-context">{{ locale === 'ja' ? '話したいことを入力してください' : '选择版块并开始讨论' }}</p><p>{{ threadTypeTips[form.threadType] }}</p></div>
        <NuxtLink :to="localePath('/forum')" class="composer-back-link">{{ copy.back }}</NuxtLink>
      </div>

      <section v-if="contextualSong && selectedSong" class="composer-context-card" aria-live="polite">
        <img :src="`/api/content/covers/${selectedSong.id}`" :alt="selectedSong.song_name" />
        <div><strong>{{ locale === 'ja' && selectedSong.song_name_jp ? selectedSong.song_name_jp : selectedSong.song_name }}</strong><span>{{ t(`community.discussingChart`) }} · {{ t(`difficulty.${form.difficultyType}`) }} · {{ form.level }}{{ t("guide.starSuffix") }}</span></div>
      </section>

      <el-form label-position="top">
        <div class="composer-grid composer-grid--compact"><el-form-item :label="copy.section"><el-select v-model="form.sectionSlug"><el-option v-for="section in sectionsData.items" :key="section.id" :label="getSectionLabel(section)" :value="section.slug" /></el-select></el-form-item><el-form-item :label="copy.threadType"><div class="type-chips"><button v-for="option in threadTypeOptions" :key="option.value" type="button" :class="{ active: form.threadType === option.value }" :aria-pressed="form.threadType === option.value" @click="form.threadType = option.value">{{ option.label }}</button></div></el-form-item></div>

        <el-form-item :label="copy.title">
          <el-input v-model="form.title" maxlength="120" show-word-limit :placeholder="copy.titlePlaceholder" />
        </el-form-item>

        <section class="block-editor block-editor--body"><div class="block-editor__head"><h3>{{ copy.paragraphs }}</h3><span v-if="form.threadType === 'guide'">{{ copy.paragraphCount.replace("{count}", String(paragraphBlocks.length)) }}</span></div><el-input v-model="form.paragraphDraft" type="textarea" :rows="8" maxlength="4000" show-word-limit :placeholder="copy.paragraphDraftPlaceholder" /><div v-if="form.threadType === 'guide'" class="block-editor__actions"><el-button type="primary" plain @click="addParagraph">{{ copy.addParagraph }}</el-button></div><div v-if="form.threadType === 'guide'" class="block-list"><div v-for="(text, index) in paragraphBlocks" :key="`paragraph-${index}`" class="block-list__item"><p>{{ text }}</p><el-button text @click="removeParagraph(index)">{{ copy.remove }}</el-button></div></div></section>

        <details class="more-options" :open="showMoreOptions" @toggle="showMoreOptions = ($event.target as HTMLDetailsElement).open"><summary>{{ locale === 'ja' ? 'その他の設定' : '更多选项' }}</summary><div class="more-options__body"><el-form-item :label="copy.summary"><el-input v-model="form.summary" maxlength="280" show-word-limit :placeholder="copy.summaryPlaceholder" /></el-form-item><el-form-item :label="copy.tags"><el-input v-model="form.tagsInput" :placeholder="copy.tagsPlaceholder" /></el-form-item><div class="song-picker"><label>{{ copy.songId }}</label><div class="song-picker__search"><el-input v-model="songQuery" :placeholder="copy.songIdPlaceholder" @keyup.enter="searchSongs" /><el-button :loading="songLoading" @click="searchSongs">{{ t('common.search') }}</el-button></div><div v-if="songResults.length" class="song-picker__results"><button v-for="song in songResults" :key="song.id" type="button" @click="chooseSong(song)"><span>{{ locale === 'ja' && song.song_name_jp ? song.song_name_jp : song.song_name }}</span><small>#{{ song.id }} · {{ song.type }}</small></button></div><p v-if="selectedSong" class="song-picker__selected">{{ locale === 'ja' && selectedSong.song_name_jp ? selectedSong.song_name_jp : selectedSong.song_name }}</p></div><div v-if="selectedSong" class="composer-grid composer-grid--song"><el-form-item :label="copy.difficulty"><el-select v-model="form.difficultyType" clearable><el-option v-for="option in difficultyOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item><el-form-item :label="copy.level"><el-input v-model="form.level" :placeholder="copy.levelPlaceholder" /></el-form-item></div></div></details>

        <section class="block-editor block-editor--attachments">
          <div class="block-editor__head">
            <h3>{{ copy.images }}</h3>
            <span>{{ copy.imageCount.replace("{count}", String(imageBlocks.length)) }}</span>
          </div>
          <el-upload :show-file-list="false" :http-request="uploadImage" :before-upload="validateImageFile" accept="image/*">
            <el-button :loading="uploading">{{ copy.uploadImage }}</el-button>
          </el-upload>
          <div class="image-grid">
            <div v-for="(image, index) in imageBlocks" :key="image.imageUrl" class="image-card">
              <img :src="image.imageUrl" alt="forum illustration" />
              <el-input v-model="image.caption" maxlength="120" :placeholder="copy.imageCaptionPlaceholder" />
              <el-button text @click="removeImage(index)">{{ copy.remove }}</el-button>
            </div>
          </div>
        </section>

        <div class="composer-submit">
          <el-button type="primary" :loading="submitting" @click="submit">{{ copy.submit }}</el-button>
        </div>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
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

.composer-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.composer-panel__head h2 {
  margin: 0;
  font-size: 32px;
}

.composer-context { margin: 0; color:var(--viewer-text); font-size: 22px; font-weight: 750; }

.composer-panel__head p {
  margin: 8px 0 0;
  color:var(--viewer-text-muted);
  line-height: 1.8;
}

.composer-back-link {
  color:var(--viewer-error);
  text-decoration: none;
}

.composer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.type-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.type-chips button { min-height: 38px; padding: 0 11px; border: 1px solid var(--viewer-border); border-radius: 9px; color:var(--viewer-text-muted); background:transparent; font: inherit; font-size: 12px; cursor: pointer; }
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

.block-editor__actions,
.composer-submit {
  display: flex;
  justify-content: flex-end;
}

.block-list,
.image-grid {
  display: grid;
  gap: 12px;
}

.block-list__item,
.image-card {
  padding: 14px;
  border-radius: 18px;
  background:var(--viewer-surface-subtle);
}

.block-list__item p {
  margin: 0 0 10px;
  white-space: pre-wrap;
  line-height: 1.8;
}

.image-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.image-card {
  display: grid;
  gap: 10px;
}

.image-card img {
  width: 100%;
  border-radius: 18px;
}

body.theme-dark .composer-panel__head p,
body.theme-dark .block-editor__head span {
  color:var(--viewer-text-muted);
}

body.theme-dark .block-editor {
  background:var(--viewer-surface-subtle);
}

body.theme-dark .block-editor--body { background:transparent; }

body.theme-dark .block-list__item,
body.theme-dark .image-card {
  background:var(--viewer-overlay);
}

@media (max-width: 860px) {
  .composer-panel__head,
  .composer-grid,
  .composer-grid--song {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .image-grid {
    grid-template-columns: 1fr;
  }

  .composer-panel { padding: 16px; }
  .composer-grid--song { grid-template-columns: 1fr; }
}
</style>
