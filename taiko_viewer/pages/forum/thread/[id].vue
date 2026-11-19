<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ForumContentBlock, ForumThreadDetail } from "~/types/forum";
import { buildPageDescription } from "~/utils/seo";
import { FORUM_IMAGE_MAX_BYTES } from "~/utils/forum";
import { replyWindows, windowOfPost } from "~/utils/rework/community";

const route = useRoute();
const { t } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const requestGuard = useAccountRequestGuard(false);
let viewActive = true;
let privateGeneration = 0;

definePageMeta({
  contentLayout: "wide",
  pageTitleKey: "forum.threadDetail",
  pageDescKey: "page.forum.thread.desc",
  navKey: "/forum",
  hidePageHeader: true,
  breadcrumbs: [{ labelKey: "forum.title", to: "/forum" }, { labelKey: "forum.threadDetail" }],
});

const replyBody = ref("");
const replyImages = ref<string[]>([]);
const replyTarget = ref<{ id: number | null; label: string }>({
  id: null,
  label: "",
});
const replyExpanded = ref(false);
const submitting = ref(false);
const uploadingImages = ref(false);
const likingThread = ref(false);
const activePostLikeId = ref<number | null>(null);
const revealedBlockedPostIds = ref<number[]>([]);
const replyInput = ref<{ focus?: () => void } | null>(null);

type ForumLikeMutationResult = {
  liked: boolean;
  likeCount: number;
};

// Visible text (moved from the inline zh / ja table to locales: rework.forum.thread.*).
const copy = computed(() => {
  const k = (key: string) => t(`rework.forum.thread.${key}`);
  return {
    uploadLimit: k("uploadLimit"), uploadDone: k("uploadDone"), uploadTooLarge: k("uploadTooLarge"), uploadFailed: k("uploadFailed"),
    loginForUpload: k("loginForUpload"), replySuccess: k("replySuccess"), replyFailed: k("replyFailed"), loginForReply: k("loginForReply"),
    likeRemoved: k("likeRemoved"), likeSuccess: k("likeSuccess"), likeFailed: k("likeFailed"), loginForLike: k("loginForLike"),
    articleBody: k("articleBody"), imageViewer: k("imageViewer"), closeImageViewer: k("closeImageViewer"),
    previousImage: k("previousImage"), nextImage: k("nextImage"), replyUnavailable: k("replyUnavailable")
  };
});

const threadResource = useForumResource<ForumThreadDetail>(
  `forum-thread-detail:${route.params.id}`, () => apiFetch(`/api/forum/threads/${route.params.id}`, { retry: 0 }),
  { context: () => String(route.params.id) }
);
const { data, pending: readPending, error: readFailure, refresh } = threadResource;
// Server-render failures stay as rendered until the page has hydrated (useForumHydratedState).
const { pending, error: readError } = useForumHydratedState(readPending, readFailure);
const mutationCurrent = (ticket: number, threadId: string) => viewActive && requestGuard.current(ticket) && String(route.params.id) === threadId;

useViewerSeo(() => ({
  title: data.value?.title || t("forum.threadDetail"),
  description: buildPageDescription(data.value?.summary || t("page.forum.thread.desc")),
  path: `/forum/thread/${route.params.id}`,
  keywords: ["论坛帖子", "太鼓达人社区"]
}));

const detail = computed(() => data.value);
const signedIn = computed(() => Boolean(accountUser.value));
// Replies mount in windows of at most REPLY_WINDOW items (V1.3 budget ≤ 60); one window when the thread fits.
// The server order is kept; a deep link (#reply-<id>) first shows the window that holds that post.
const replyWindowList = computed(() => replyWindows(detail.value?.posts || []));
const replyWindowIndex = ref(0);
const showReplyWindow = async (index: number) => {
  replyWindowIndex.value = Math.min(Math.max(0, index), Math.max(0, replyWindowList.value.length - 1));
  await nextTick();
  const heading = document.getElementById("replies-title");
  heading?.scrollIntoView({ block: "start", behavior: "auto" });
  heading?.focus({ preventScroll: true });
};
const firstContentImageIndex = computed(() =>
  detail.value?.contentBlocks.findIndex((block) => block.type !== "paragraph") ?? -1
);

type ViewerImage = {
  url: string;
  alt: string;
};

// Images that failed to load show a placeholder and are left out of the viewer (presentation only).
const failedImageUrls = ref<string[]>([]);
const markImageFailed = (url: string) => {
  if (url && !failedImageUrls.value.includes(url)) failedImageUrls.value = [...failedImageUrls.value, url];
};
const imageViewerItems = computed<ViewerImage[]>(() => {
  const items: ViewerImage[] = [];
  const addBlocks = (blocks: ForumContentBlock[] | undefined) => {
    for (const block of blocks || []) {
      if (block.type === "image" && block.imageUrl && !failedImageUrls.value.includes(block.imageUrl)) {
        items.push({ url: block.imageUrl, alt: block.alt || block.caption || t("forum.threadDetail") });
      }
    }
  };
  addBlocks(detail.value?.contentBlocks);
  for (const post of detail.value?.posts || []) {
    if (!post.isBlockedAuthor || revealedBlockedPostIds.value.includes(post.id)) addBlocks(post.contentBlocks);
    for (const reply of post.replies) {
      if (!reply.isBlockedAuthor || revealedBlockedPostIds.value.includes(reply.id)) addBlocks(reply.contentBlocks);
    }
  }
  return items;
});

const viewerOpen = ref(false);
const viewerIndex = ref(0);
const viewerTrigger = ref<HTMLElement | null>(null);

const openImageViewer = (url: string, event?: MouseEvent) => {
  if (!url || !import.meta.client) return;
  const index = imageViewerItems.value.findIndex((item) => item.url === url);
  viewerIndex.value = index >= 0 ? index : 0;
  viewerTrigger.value = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  viewerOpen.value = true;
};

const resetPrivateState = () => {
  privateGeneration++;
  requestGuard.invalidate();
  replyBody.value = ''; replyImages.value = []; replyTarget.value = { id: null, label: '' };
  replyExpanded.value = false; submitting.value = false; uploadingImages.value = false;
  likingThread.value = false; activePostLikeId.value = null;
  revealedBlockedPostIds.value = []; viewerOpen.value = false;
  replyWindowIndex.value = 0;
};
watch(() => [accountUser.value?.id, route.params.id], resetPrivateState, { flush: 'sync' });
onDeactivated(() => {
  viewActive = false; requestGuard.invalidate();
  likingThread.value = false; activePostLikeId.value = null; uploadingImages.value = false;
  viewerOpen.value = false;
});
onActivated(() => { viewActive = true; });

const highlightedReplyId = ref<number | null>(null);
const threadPageMounted = ref(false);
let handledReplyHash = "";
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

const waitForRouteScroll = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

const scrollToReplyHash = async () => {
  if (!import.meta.client || !viewActive || !threadPageMounted.value || !detail.value || !route.hash || route.hash === handledReplyHash) return;
  const match = route.hash.match(/^#reply-(\d+)$/);
  if (!match) return;
  const replyId = Number(match[1]);
  const targetWindow = windowOfPost(replyWindowList.value, replyId);
  if (targetWindow >= 0) replyWindowIndex.value = targetWindow;
  await nextTick();
  await waitForRouteScroll();
  const request = requestGuard.capture(), requestedThread = String(route.params.id);
  let attempts = 0;
  const locate = () => {
    if (!mutationCurrent(request, requestedThread)) return;
    const target = document.getElementById(`reply-${replyId}`);
    if (!target && attempts++ < 4) {
      requestAnimationFrame(locate);
      return;
    }
    handledReplyHash = route.hash;
    if (!target) {
      document.getElementById("replies-title")?.scrollIntoView({ block: "start", behavior: "smooth" });
      ElMessage.info(copy.value.replyUnavailable);
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "auto" });
    target.focus({ preventScroll: true });
    highlightedReplyId.value = replyId;
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      highlightedReplyId.value = null;
      highlightTimer = null;
    }, 1800);
  };
  requestAnimationFrame(locate);
};

watch([() => detail.value, () => route.hash], () => {
  if (!route.hash) {
    handledReplyHash = "";
    highlightedReplyId.value = null;
    return;
  }
  void scrollToReplyHash();
}, { immediate: true });

onMounted(() => {
  threadPageMounted.value = true;
  void scrollToReplyHash();
});
onDeactivated(() => {
  handledReplyHash = ''; highlightedReplyId.value = null;
  if (highlightTimer) { clearTimeout(highlightTimer); highlightTimer = null; }
});
onActivated(() => { void scrollToReplyHash(); });
onBeforeUnmount(() => {
  if (highlightTimer) clearTimeout(highlightTimer);
});

const setReplyTarget = (id: number | null, label = "") => {
  replyTarget.value = { id, label };
  replyExpanded.value = true;
  nextTick(() => replyInput.value?.focus?.());
};

const showActionError = (
  error: any,
  fallback: string,
  unauthenticatedMessage: string,
) => {
  const statusCode = Number(error?.statusCode || error?.data?.statusCode || 0);
  if (statusCode === 401) {
    ElMessage.warning(unauthenticatedMessage);
    return;
  }
  ElMessage.error(error?.data?.statusMessage || error?.message || fallback);
};

const uploadReplyImages = async (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const files = Array.from(input?.files || []);
  if (!files.length || uploadingImages.value || submitting.value || detail.value?.isLocked || !viewActive) return;
  const request = requestGuard.capture(), requestedThread = String(route.params.id);
  if (replyImages.value.length >= 4) {
    ElMessage.warning(copy.value.uploadLimit);
    if (input) input.value = "";
    return;
  }
  if (files.some((file) => file.size > FORUM_IMAGE_MAX_BYTES)) {
    ElMessage.warning(copy.value.uploadTooLarge);
    if (input) input.value = "";
    return;
  }
  uploadingImages.value = true;
  try {
    for (const file of files.slice(
      0,
      Math.max(0, 4 - replyImages.value.length),
    )) {
      const formData = new FormData();
      formData.append("image", file);
      const result = await apiFetch<{ imageUrl: string }>(
        "/api/forum/media/images",
        {
          method: "POST",
          body: formData,
        },
      );
      if (!mutationCurrent(request, requestedThread)) return;
      if (result.imageUrl) {
        replyImages.value.push(result.imageUrl);
      }
    }
    ElMessage.success(copy.value.uploadDone);
  } catch (error: any) {
    if (!mutationCurrent(request, requestedThread)) return;
    const statusCode = Number(error?.statusCode || error?.data?.statusCode || 0);
    const statusMessage = String(error?.data?.statusMessage || error?.message || "");
    if (statusCode === 413 || statusMessage.includes("20MB") || statusMessage.includes("图片过大")) {
      ElMessage.warning(copy.value.uploadTooLarge);
      return;
    }
    showActionError(error, copy.value.uploadFailed, copy.value.loginForUpload);
  } finally {
    if (mutationCurrent(request, requestedThread)) {
      uploadingImages.value = false;
      if (input) input.value = "";
    }
  }
};

const removeReplyImage = (index: number) => {
  replyImages.value.splice(index, 1);
};

const toggleBlockedContent = (postId: number) => {
  if (revealedBlockedPostIds.value.includes(postId)) {
    revealedBlockedPostIds.value = revealedBlockedPostIds.value.filter(
      (item) => item !== postId,
    );
  } else {
    revealedBlockedPostIds.value = [...revealedBlockedPostIds.value, postId];
  }
};

const restoreScrollPosition = async (scrollY: number) => {
  if (!import.meta.client) return;
  await nextTick();
  requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "auto" }));
};

const submitReply = async () => {
  if (
    (!replyBody.value.trim() && !replyImages.value.length) ||
    submitting.value || uploadingImages.value || detail.value?.isLocked || !viewActive
  )
    return;
  const request = requestGuard.capture(), requestedThread = String(route.params.id), generation = privateGeneration;
  submitting.value = true;
  try {
    const contentBlocks = [
      ...(replyBody.value.trim()
        ? [
            {
              type: "paragraph" as const,
              text: replyBody.value.trim(),
            },
          ]
        : []),
      ...replyImages.value.map((imageUrl) => ({
        type: "image" as const,
        imageUrl,
      })),
    ];
    const scrollY = import.meta.client ? window.scrollY : 0;
    const result = await apiFetch<ForumThreadDetail>(`/api/forum/threads/${requestedThread}/replies`, {
      method: "POST",
      body: {
        bodyText: replyBody.value,
        contentBlocks,
        parentPostId: replyTarget.value.id || undefined,
      },
    });
    // An accepted reply from this unchanged identity/thread retires its draft
    // even while away; only an active current view may consume the DTO.
    if (generation !== privateGeneration) return;
    replyBody.value = "";
    replyImages.value = [];
    replyTarget.value = { id: null, label: "" };
    replyExpanded.value = false;
    submitting.value = false;
    if (!mutationCurrent(request, requestedThread)) return;
    threadResource.accept(result);
    ElMessage.success(copy.value.replySuccess);
    await restoreScrollPosition(scrollY);
  } catch (error: any) {
    if (mutationCurrent(request, requestedThread)) showActionError(error, copy.value.replyFailed, copy.value.loginForReply);
  } finally {
    if (generation === privateGeneration) submitting.value = false;
  }
};

const toggleThreadLike = async (event?: MouseEvent) => {
  if (likingThread.value || !viewActive) return;
  const request = requestGuard.capture(), requestedThread = String(route.params.id);
  const trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const scrollY = import.meta.client ? window.scrollY : 0;
  likingThread.value = true;
  try {
    const wasLiked = Boolean(detail.value?.viewerHasLiked);
    const result = await apiFetch<ForumLikeMutationResult>(`/api/forum/threads/${requestedThread}/like`, {
      method: "POST",
    });
    if (!mutationCurrent(request, requestedThread)) return;
    if (detail.value) {
      detail.value.viewerHasLiked = result.liked;
      detail.value.likeCount = result.likeCount;
    }
    ElMessage.success(wasLiked ? copy.value.likeRemoved : copy.value.likeSuccess);
  } catch (error: any) {
    if (mutationCurrent(request, requestedThread)) showActionError(error, copy.value.likeFailed, copy.value.loginForLike);
  } finally {
    if (mutationCurrent(request, requestedThread)) {
      likingThread.value = false;
      await restoreScrollPosition(scrollY);
      trigger?.focus({ preventScroll: true });
    }
  }
};

const togglePostLike = async (postId: number, event?: MouseEvent) => {
  if (activePostLikeId.value !== null || !viewActive) return;
  const request = requestGuard.capture(), requestedThread = String(route.params.id);
  const trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const scrollY = import.meta.client ? window.scrollY : 0;
  activePostLikeId.value = postId;
  try {
    const allPosts = detail.value?.posts || [];
    const currentPost =
      allPosts.find((post) => post.id === postId) ||
      allPosts
        .flatMap((post) => post.replies)
        .find((reply) => reply.id === postId);
    const wasLiked = Boolean(currentPost?.viewerHasLiked);
    const result = await apiFetch<ForumLikeMutationResult>(`/api/forum/posts/${postId}/like`, {
      method: "POST",
    });
    if (!mutationCurrent(request, requestedThread)) return;
    if (currentPost) {
      currentPost.viewerHasLiked = result.liked;
      currentPost.likeCount = result.likeCount;
    }
    ElMessage.success(wasLiked ? copy.value.likeRemoved : copy.value.likeSuccess);
  } catch (error: any) {
    if (mutationCurrent(request, requestedThread)) showActionError(error, copy.value.likeFailed, copy.value.loginForLike);
  } finally {
    if (mutationCurrent(request, requestedThread)) {
      activePostLikeId.value = null;
      await restoreScrollPosition(scrollY);
      trigger?.focus({ preventScroll: true });
    }
  }
};

</script>

<template>
  <div class="forum-thread-page">
    <ReworkState v-if="pending" kind="loading" :lines="10" class="thread-loading" />
    <ReworkState v-else-if="readError" kind="failed" :text="readError" @retry="refresh">
      <NuxtLink :to="localePath('/forum')" class="rw-btn">{{ t("rework.forum.thread.back") }}</NuxtLink>
    </ReworkState>
    <ReworkCommunityThreadLayout v-else-if="detail" :has-side="Boolean(detail.song)">
      <template #head><ReworkCommunityThreadHead :thread="detail" /></template>
      <template #side><ReworkCommunityChartCard v-if="detail.song" :song="detail.song" /></template>
      <article class="thread-article">
        <section class="thread-content" :aria-label="copy.articleBody">
          <ReworkCommunityBlocks
            body
            :blocks="detail.contentBlocks"
            :viewer-label="copy.imageViewer"
            :fallback-alt="detail.title"
            :priority-index="firstContentImageIndex"
            @open="openImageViewer"
            @failed="markImageFailed"
          />
        </section>
        <ReworkCommunityThreadActions
          :liked="detail.viewerHasLiked"
          :like-count="detail.likeCount"
          :reply-count="detail.replyCount"
          :busy="likingThread"
          @like="toggleThreadLike"
          @reply="setReplyTarget(null)"
        />
        <ReworkCommunityReplies
          :count="detail.replyCount"
          :windows="replyWindowList"
          :index="replyWindowIndex"
          :op-id="detail.author.id"
          :highlighted-id="highlightedReplyId"
          :revealed-ids="revealedBlockedPostIds"
          :active-like-id="activePostLikeId"
          :viewer-label="copy.imageViewer"
          @window="showReplyWindow"
          @like="togglePostLike"
          @reply="setReplyTarget"
          @reveal="toggleBlockedContent"
          @open="openImageViewer"
          @failed="markImageFailed"
        >
          <ReworkCommunityReplyBox
            ref="replyInput"
            v-model:body="replyBody"
            v-model:expanded="replyExpanded"
            :images="replyImages"
            :target-label="replyTarget.label"
            :has-target="Boolean(replyTarget.id)"
            :locked="detail.isLocked"
            :submitting="submitting"
            :uploading="uploadingImages"
            :signed-in="signedIn"
            :redirect="route.fullPath"
            @submit="submitReply"
            @upload="uploadReplyImages"
            @remove="removeReplyImage"
            @clear-target="setReplyTarget(null)"
          />
        </ReworkCommunityReplies>
      </article>
    </ReworkCommunityThreadLayout>

    <ForumMediaViewer
      v-model:visible="viewerOpen"
      v-model:index="viewerIndex"
      :items="imageViewerItems"
      :trigger="viewerTrigger"
      :label="copy.imageViewer"
      :close-label="copy.closeImageViewer"
      :previous-label="copy.previousImage"
      :next-label="copy.nextImage"
    />
  </div>
</template>

<style scoped>
/* Layout only: colours, type and spacing come from the reworked components (DS tokens). Below 768 px the reply box
   is fixed above the bottom navigation, so the page keeps room for it under the last reply. */
.forum-thread-page {
  display: grid;
  min-width: 0;
}
.thread-article {
  min-width: 0;
}
.thread-content {
  margin-top: 8px;
}
@media (max-width: 767px) {
  .forum-thread-page {
    padding-bottom: 72px;
  }
}
</style>
