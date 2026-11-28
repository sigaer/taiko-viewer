<script setup lang="ts">
// Edit one's own thread: title, the body blocks in their stored order (text, images with captions; new images are
// uploaded like on /forum/new and appended), summary and tags. Section, type and the related chart are not changed
// here. POST /api/forum/threads/:id/edit checks ownership and the lock again and answers with the thread detail.
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ForumThreadDetail } from "~/types/forum";
import { FORUM_IMAGE_MAX_BYTES } from "~/utils/forum";
import { fromEditableBlocks, isDerivedSummary, ownsItem, splitTags, tagsInputOf, toEditableBlocks, type EditableBlock } from "~/utils/rework/community";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const requestGuard = useAccountRequestGuard(false);
let viewActive = true;
let uploadGeneration = 0;
let blockSeq = 0;
onActivated(() => { viewActive = true; });
onDeactivated(() => { viewActive = false; uploadGeneration++; uploadCount.value = 0; });
onBeforeUnmount(() => { viewActive = false; uploadGeneration++; });

definePageMeta({
  contentLayout: "reading",
  hidePageHeader: true,
  composerHeader: true,
  middleware: "account-auth",
  pageTitleKey: "rework.forum.editor.heading",
  navKey: "/forum",
  breadcrumbs: [
    { labelKey: "forum.title", to: "/forum" },
    { labelKey: "rework.forum.editor.heading" }
  ]
});
useViewerSeo(() => ({ title: t("rework.forum.editor.heading"), description: t("page.forum.new.desc"), path: `/forum/edit/${route.params.id}`, robots: "noindex, nofollow" }));

const resource = useForumResource<ForumThreadDetail>(
  `forum-edit:${route.params.id}`, () => apiFetch(`/api/forum/threads/${route.params.id}`, { retry: 0 }),
  { context: () => String(route.params.id) }
);
const { data, pending: readPending, error: readFailure, refresh } = resource;
const { pending, error: readError } = useForumHydratedState(readPending, readFailure);

const form = reactive({ title: "", summary: "", tagsInput: "" });
const blocks = ref<EditableBlock[]>([]);
// The account and thread the form was filled for: a later re-read of the same thread keeps the unsaved edits.
const filledFor = ref("");
const saving = ref(false);
const uploadCount = ref(0);
const uploading = computed(() => uploadCount.value > 0);
const canEdit = computed(() => Boolean(data.value && data.value.status === "published" && ownsItem(data.value.author.id, accountUser.value?.id ?? null, data.value.isLocked)));
const blockedReason = computed(() => (!data.value || canEdit.value ? "" : data.value.isLocked ? t("rework.forum.thread.locked") : t("rework.forum.editor.notOwner")));
const threadPath = computed(() => localePath(`/forum/thread/${route.params.id}`));

watch([data, () => accountUser.value?.id], ([detail]) => {
  const owner = `${accountUser.value?.id || ""}:${route.params.id}`;
  if (!detail || filledFor.value === owner) return;
  filledFor.value = owner;
  form.title = detail.title;
  form.summary = isDerivedSummary(detail.summary, detail.contentBlocks) ? "" : detail.summary;
  form.tagsInput = tagsInputOf(detail.tags);
  blocks.value = toEditableBlocks(detail.contentBlocks);
}, { immediate: true });

const addParagraph = () => {
  if (saving.value) return;
  blocks.value.push({ key: `n${++blockSeq}`, type: "paragraph", text: "" });
};
const removeBlock = (index: number) => {
  if (!saving.value) blocks.value.splice(index, 1);
};

const validateImageFile = (file: File) => {
  if (file.size > FORUM_IMAGE_MAX_BYTES) {
    ElMessage.warning(t("rework.forum.compose.uploadTooLarge"));
    return false;
  }
  return true;
};
// The same upload request and size check as the composer (pages/forum/new.vue).
const uploadImage = async (options: any) => {
  if (!canEdit.value || saving.value || !viewActive) {
    options.onError?.(new Error(t("rework.forum.compose.uploadFailed")));
    return;
  }
  if (options.file && !validateImageFile(options.file)) {
    options.onError?.(new Error(t("rework.forum.compose.uploadTooLarge")));
    return;
  }
  const request = requestGuard.capture();
  const generation = uploadGeneration;
  uploadCount.value++;
  try {
    const body = new FormData();
    body.append("image", options.file);
    const result = await apiFetch<{ imageUrl: string }>("/api/forum/media/images", { method: "POST", body, retry: 0 });
    if (!requestGuard.current(request) || generation !== uploadGeneration) return;
    blocks.value.push({ key: `n${++blockSeq}`, type: "image", imageUrl: result.imageUrl, caption: "" });
    if (viewActive) ElMessage.success(t("rework.forum.compose.uploadSuccess"));
    options.onSuccess?.(result, options.file);
  } catch (error: any) {
    if (!requestGuard.current(request) || generation !== uploadGeneration) return;
    const statusCode = Number(error?.statusCode || error?.data?.statusCode || 0);
    const statusMessage = String(error?.data?.statusMessage || error?.message || "");
    if (viewActive) {
      if (statusCode === 413 || statusMessage.includes("20MB") || statusMessage.includes("图片过大")) ElMessage.warning(t("rework.forum.compose.uploadTooLarge"));
      else ElMessage.error(statusMessage || t("rework.forum.compose.uploadFailed"));
    }
    options.onError?.(error);
  } finally {
    if (requestGuard.current(request) && generation === uploadGeneration) uploadCount.value = Math.max(0, uploadCount.value - 1);
  }
};

const save = async () => {
  if (saving.value || uploading.value || !canEdit.value || !viewActive) return;
  const contentBlocks = fromEditableBlocks(blocks.value);
  if (!contentBlocks.length) {
    ElMessage.error(t("rework.forum.compose.contentRequired"));
    return;
  }
  const request = requestGuard.capture(), requested = String(route.params.id);
  saving.value = true;
  try {
    await apiFetch<ForumThreadDetail>(`/api/forum/threads/${requested}/edit`, {
      method: "POST",
      retry: 0,
      body: { title: form.title, summary: form.summary, tags: splitTags(form.tagsInput), contentBlocks, locale: locale.value }
    });
    if (!requestGuard.current(request) || String(route.params.id) !== requested) return;
    // The next visit fills the form from the saved thread; the thread page reads it again when it opens.
    filledFor.value = "";
    ElMessage.success(t("rework.forum.tools.saved"));
    await router.push(localePath(`/forum/thread/${requested}`));
  } catch (error: any) {
    if (requestGuard.current(request) && viewActive) ElMessage.error(error?.data?.statusMessage || error?.message || t("rework.forum.tools.saveFailed"));
  } finally {
    if (requestGuard.current(request)) saving.value = false;
  }
};
</script>

<template>
  <div class="forum-edit-page">
    <section class="composer-panel">
      <ReworkCommunityComposerBar
        :title="t('rework.forum.editor.heading')"
        :back-to="threadPath"
        :back-label="t('rework.forum.editor.back')"
        :submit-label="t('rework.forum.tools.save')"
        :disabled="!canEdit || uploading"
        :busy="saving"
        @submit="save"
      />
      <ReworkState v-if="pending" kind="loading" :lines="8" />
      <ReworkState v-else-if="readError" kind="failed" :text="readError" @retry="refresh" />
      <ReworkState v-else-if="blockedReason" kind="empty" :title="blockedReason">
        <NuxtLink :to="threadPath" class="rw-btn">{{ t("rework.forum.editor.back") }}</NuxtLink>
      </ReworkState>
      <form v-else-if="data" class="composer-form" novalidate @submit.prevent>
        <fieldset class="composer-fieldset" :disabled="saving">
          <label class="rw-field">
            <span class="rw-field__label">{{ t("rework.forum.compose.title") }}</span>
            <input v-model="form.title" class="rw-input composer-title__input" maxlength="120" :placeholder="t('rework.forum.compose.titlePlaceholder')" />
            <span class="rw-count composer-counter num">{{ form.title.length }} / 120</span>
          </label>
          <ReworkCommunityBlockEditor :blocks="blocks" :disabled="saving" :uploading="uploading" :upload-count="uploadCount" @add="addParagraph" @remove="removeBlock">
            <template #upload>
              <el-upload :key="accountUser?.id || 'guest'" class="edit-image-upload" :disabled="saving || !canEdit" :show-file-list="false" multiple :http-request="uploadImage" :before-upload="validateImageFile" accept="image/*">
                <button type="button" class="rw-btn" :disabled="saving || !canEdit" :aria-busy="uploading || undefined"><ReworkIcon name="image" />{{ t("rework.forum.compose.uploadImage") }}</button>
              </el-upload>
            </template>
          </ReworkCommunityBlockEditor>
          <label class="rw-field">
            <span class="rw-field__label">{{ t("rework.forum.compose.summary") }}</span>
            <textarea v-model="form.summary" class="rw-input rw-textarea" rows="2" maxlength="280" :placeholder="t('rework.forum.compose.summaryPlaceholder')" />
            <span class="rw-count composer-counter num">{{ form.summary.length }} / 280</span>
          </label>
          <label class="rw-field">
            <span class="rw-field__label">{{ t("rework.forum.compose.tags") }}</span>
            <input v-model="form.tagsInput" class="rw-input" :placeholder="t('rework.forum.compose.tagsPlaceholder')" />
          </label>
        </fieldset>
      </form>
    </section>
  </div>
</template>

<style scoped>
/* Layout only; the composer bar and block editor are reworked components, fields use the shared rw-* classes. */
.forum-edit-page {
  display: flex;
  justify-content: center;
}
.composer-panel {
  width: 100%;
  min-width: 0;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
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
.composer-title__input {
  width: 100%;
  min-height: 52px;
  font-size: 1.25rem;
  font-weight: 700;
}
.composer-counter {
  align-self: flex-end;
}
.rw-field .rw-input {
  width: 100%;
}
.edit-image-upload :deep(.el-upload) {
  display: inline-flex;
}
</style>
