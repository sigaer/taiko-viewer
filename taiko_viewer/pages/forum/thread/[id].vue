<script setup lang="ts">
import { viewerScrollY, scrollViewerTo } from "~/utils/viewer-scroll";
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { ForumContentBlock, ForumThreadDetail } from "~/types/forum";
import { buildPageDescription } from "~/utils/seo";
import { FORUM_IMAGE_MAX_BYTES } from "~/utils/forum";
import { floorIdForNumber, onlyAuthorFloors, ownsItem, replyWindows, threadLink, windowOfPost } from "~/utils/rework/community";
import { browserDraftStorage, cleanReplyDraft, readDraft, removeDraft, replyDraftKey, writeDraft } from "~/utils/rework/communityDraft";

const route = useRoute();
const router = useRouter();
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
// Favourite, 只看楼主, and the author's own edit / delete (the server checks ownership again).
const favoriteBusy = ref(false);
const onlyOp = ref(false);
const editingPostId = ref<number | null>(null);
const ownBusy = ref(false);
const deletingThread = ref(false);

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
const viewerId = computed(() => accountUser.value?.id ?? null);
// The author's controls appear on a published, unlocked thread of their own (hidden threads are moderators' view).
const ownsThread = computed(() => Boolean(detail.value && detail.value.status === "published" && ownsItem(detail.value.author.id, viewerId.value, detail.value.isLocked)));
const editThreadTo = computed(() => (ownsThread.value ? localePath(`/forum/edit/${route.params.id}`) : ""));
// 只看楼主 keeps the floors the thread author posted (with all their replies), in the server order.
const visibleFloors = computed(() => (onlyOp.value && detail.value ? onlyAuthorFloors(detail.value.posts, detail.value.author.id) : detail.value?.posts || []));
// Replies mount in windows of at most REPLY_WINDOW items (V1.3 budget ≤ 60); one window when the thread fits.
// The server order is kept; a deep link (#reply-<id>) first shows the window that holds that post.
const replyWindowList = computed(() => replyWindows(visibleFloors.value));
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
  favoriteBusy.value = false; onlyOp.value = false; editingPostId.value = null; ownBusy.value = false; deletingThread.value = false;
  // The reply draft belongs to one account and one thread: stop saving, then load the new pair's draft.
  replyDraftReady = false;
  void nextTick(restoreReplyDraft);
};
watch(() => [accountUser.value?.id, route.params.id], resetPrivateState, { flush: 'sync' });
onDeactivated(() => {
  viewActive = false; requestGuard.invalidate();
  likingThread.value = false; activePostLikeId.value = null; uploadingImages.value = false;
  viewerOpen.value = false;
  favoriteBusy.value = false; ownBusy.value = false; deletingThread.value = false;
});

// Reply draft (localStorage, read only after mount): text, already uploaded image URLs and the reply target.
let replyDraftReady = false;
const currentReplyDraftKey = () => replyDraftKey(accountUser.value?.id, route.params.id);
const postExists = (id: number) => (detail.value?.posts || []).some((post) => post.id === id || post.replies.some((reply) => reply.id === id));
function restoreReplyDraft() {
  replyDraftReady = false;
  if (!threadPageMounted.value) return;
  const draft = readDraft(browserDraftStorage(), currentReplyDraftKey(), cleanReplyDraft);
  if (draft && !replyBody.value && !replyImages.value.length) {
    replyBody.value = draft.body;
    replyImages.value = [...draft.images];
    if (draft.targetId && (!detail.value || postExists(draft.targetId))) replyTarget.value = { id: draft.targetId, label: draft.targetLabel };
  }
  replyDraftReady = true;
}
watch(
  () => [replyBody.value, replyImages.value.join("\n"), replyTarget.value.id, replyTarget.value.label],
  () => {
    if (!replyDraftReady) return;
    writeDraft(browserDraftStorage(), currentReplyDraftKey(), {
      body: replyBody.value, images: replyImages.value, targetId: replyTarget.value.id, targetLabel: replyTarget.value.label
    }, cleanReplyDraft);
  }
);
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
  // A link to a post that 只看楼主 hides shows all floors again.
  if (onlyOp.value && windowOfPost(replyWindowList.value, replyId) < 0) onlyOp.value = false;
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
  restoreReplyDraft();
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
  requestAnimationFrame(() => scrollViewerTo({ top: scrollY, behavior: "auto" }));
};

const submitReply = async () => {
  if (
    (!replyBody.value.trim() && !replyImages.value.length) ||
    submitting.value || uploadingImages.value || detail.value?.isLocked || !viewActive
  )
    return;
  const request = requestGuard.capture(), requestedThread = String(route.params.id), generation = privateGeneration;
  const draftKey = currentReplyDraftKey();
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
    const scrollY = import.meta.client ? viewerScrollY() : 0;
    const result = await apiFetch<ForumThreadDetail>(`/api/forum/threads/${requestedThread}/replies`, {
      method: "POST",
      body: {
        bodyText: replyBody.value,
        contentBlocks,
        parentPostId: replyTarget.value.id || undefined,
      },
    });
    // An accepted reply retires its stored draft (that account and thread) in any case.
    removeDraft(browserDraftStorage(), draftKey);
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
  const scrollY = import.meta.client ? viewerScrollY() : 0;
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
  const scrollY = import.meta.client ? viewerScrollY() : 0;
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

// Favourite (threads/:id/favorite with the wanted state, so a repeated click cannot flip it twice).
const toggleFavorite = async (event?: MouseEvent) => {
  if (favoriteBusy.value || !viewActive || !detail.value) return;
  const request = requestGuard.capture(), requestedThread = String(route.params.id);
  const trigger = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const wanted = !detail.value.viewerHasFavorited;
  favoriteBusy.value = true;
  try {
    const result = await apiFetch<{ favorited: boolean; favoriteCount: number }>(`/api/forum/threads/${requestedThread}/favorite`, {
      method: "POST",
      body: { enabled: wanted }
    });
    if (!mutationCurrent(request, requestedThread)) return;
    if (detail.value) detail.value.viewerHasFavorited = result.favorited;
    ElMessage.success(result.favorited ? t("rework.forum.tools.favoriteAdded") : t("rework.forum.tools.favoriteRemoved"));
  } catch (error: any) {
    if (mutationCurrent(request, requestedThread)) showActionError(error, t("rework.forum.tools.favoriteFailed"), t("rework.forum.tools.loginForFavorite"));
  } finally {
    if (mutationCurrent(request, requestedThread)) {
      favoriteBusy.value = false;
      trigger?.focus({ preventScroll: true });
    }
  }
};

// Copy the thread link, or a post's (#reply-<id>, the deep-link format above).
const copyLink = async (postId?: number) => {
  if (!import.meta.client) return;
  const link = threadLink(window.location.origin, localePath(`/forum/thread/${route.params.id}`), postId);
  try {
    await navigator.clipboard.writeText(link);
    ElMessage.success(t("rework.forum.tools.copied"));
  } catch {
    ElMessage.error(t("rework.forum.tools.copyFailed"));
  }
};

const setOnlyOp = (value: boolean) => {
  onlyOp.value = value;
  replyWindowIndex.value = 0;
};

// Jump to a floor number: the existing #reply-<id> deep link does the window, scroll, focus and highlight.
const jumpToFloor = async (value: string) => {
  const posts = detail.value?.posts || [];
  const id = floorIdForNumber(posts, value);
  if (id === null) {
    ElMessage.warning(t("rework.forum.tools.floorMissing"));
    return;
  }
  if (onlyOp.value && windowOfPost(replyWindowList.value, id) < 0) onlyOp.value = false;
  handledReplyHash = "";
  const hash = `#reply-${id}`;
  if (route.hash === hash) await scrollToReplyHash();
  else await router.replace({ query: route.query, hash });
};

// The author's own replies: edit in place, delete after confirmation. Both answer with the thread detail.
const startEdit = (postId: number) => {
  if (ownBusy.value) return;
  editingPostId.value = postId;
};
const cancelEdit = () => {
  if (!ownBusy.value) editingPostId.value = null;
};
const saveEdit = async (postId: number, payload: { bodyText: string; images: string[] }) => {
  if (ownBusy.value || !viewActive) return;
  const request = requestGuard.capture(), requestedThread = String(route.params.id);
  ownBusy.value = true;
  try {
    const result = await apiFetch<ForumThreadDetail>(`/api/forum/posts/${postId}/edit`, {
      method: "POST",
      body: {
        bodyText: payload.bodyText,
        contentBlocks: payload.images.map((imageUrl) => ({ type: "image" as const, imageUrl }))
      }
    });
    if (!mutationCurrent(request, requestedThread)) return;
    threadResource.accept(result);
    editingPostId.value = null;
    ElMessage.success(t("rework.forum.tools.saved"));
  } catch (error: any) {
    if (mutationCurrent(request, requestedThread)) showActionError(error, t("rework.forum.tools.saveFailed"), copy.value.loginForReply);
  } finally {
    if (mutationCurrent(request, requestedThread)) ownBusy.value = false;
  }
};
const confirmDelete = async (title: string, message: string) => {
  try {
    await ElMessageBox.confirm(message, title, { type: "warning", confirmButtonText: t("rework.forum.tools.delete"), cancelButtonText: t("common.cancel") });
    return true;
  } catch {
    return false;
  }
};
const removePost = async (postId: number) => {
  if (ownBusy.value || !viewActive) return;
  const requestedThread = String(route.params.id);
  if (!(await confirmDelete(t("rework.forum.tools.deleteReplyTitle"), t("rework.forum.tools.deleteReplyConfirm")))) return;
  if (!viewActive || String(route.params.id) !== requestedThread) return;
  const request = requestGuard.capture();
  ownBusy.value = true;
  try {
    const result = await apiFetch<ForumThreadDetail>(`/api/forum/posts/${postId}/delete`, { method: "POST" });
    if (!mutationCurrent(request, requestedThread)) return;
    threadResource.accept(result);
    if (editingPostId.value === postId) editingPostId.value = null;
    ElMessage.success(t("rework.forum.tools.deleted"));
  } catch (error: any) {
    if (mutationCurrent(request, requestedThread)) showActionError(error, t("rework.forum.tools.deleteFailed"), copy.value.loginForReply);
  } finally {
    if (mutationCurrent(request, requestedThread)) ownBusy.value = false;
  }
};
const removeThread = async () => {
  if (deletingThread.value || !viewActive || !ownsThread.value) return;
  const requestedThread = String(route.params.id);
  if (!(await confirmDelete(t("rework.forum.tools.deleteThreadTitle"), t("rework.forum.tools.deleteThreadConfirm")))) return;
  if (!viewActive || String(route.params.id) !== requestedThread) return;
  const request = requestGuard.capture();
  deletingThread.value = true;
  try {
    await apiFetch<{ ok: boolean }>(`/api/forum/threads/${requestedThread}/delete`, { method: "POST" });
    // The stored reply draft of a deleted thread has nowhere to go.
    removeDraft(browserDraftStorage(), replyDraftKey(accountUser.value?.id, requestedThread));
    if (!mutationCurrent(request, requestedThread)) return;
    ElMessage.success(t("rework.forum.tools.deleted"));
    await navigateTo(localePath("/forum/me"));
  } catch (error: any) {
    if (mutationCurrent(request, requestedThread)) showActionError(error, t("rework.forum.tools.deleteFailed"), copy.value.loginForReply);
  } finally {
    if (mutationCurrent(request, requestedThread)) deletingThread.value = false;
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
        <ReworkCommunityCard class="thread-card">
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
          :favorited="detail.viewerHasFavorited"
          :favorite-busy="favoriteBusy"
          :edit-to="editThreadTo"
          :deleting="deletingThread"
          @like="toggleThreadLike"
          @reply="setReplyTarget(null)"
          @favorite="toggleFavorite"
          @copy="copyLink()"
          @remove="removeThread"
        />
        </ReworkCommunityCard>
        <ReworkCommunityReplies
          :count="detail.replyCount"
          :windows="replyWindowList"
          :index="replyWindowIndex"
          :op-id="detail.author.id"
          :highlighted-id="highlightedReplyId"
          :revealed-ids="revealedBlockedPostIds"
          :active-like-id="activePostLikeId"
          :viewer-label="copy.imageViewer"
          :viewer-id="viewerId"
          :locked="detail.isLocked"
          :editing-id="editingPostId"
          :own-busy="ownBusy"
          :only-op="onlyOp"
          :has-floors="detail.posts.length > 0"
          @window="showReplyWindow"
          @like="togglePostLike"
          @reply="setReplyTarget"
          @reveal="toggleBlockedContent"
          @open="openImageViewer"
          @failed="markImageFailed"
          @copy="copyLink"
          @edit="startEdit"
          @cancel-edit="cancelEdit"
          @save="saveEdit"
          @remove="removePost"
          @update:only-op="setOnlyOp"
          @jump="jumpToFloor"
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
  min-width: 0;
}
@media (max-width: 767px) {
  .forum-thread-page {
    padding-bottom: 72px;
  }
}
</style>
