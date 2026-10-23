<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ForumContentBlock, ForumThreadDetail } from "~/types/forum";
import { buildPageDescription } from "~/utils/seo";
import { FORUM_IMAGE_MAX_BYTES, resolveForumSectionTranslation } from "~/utils/forum";

const route = useRoute();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { accountUser } = useAccountState();
const requestGuard = useAccountRequestGuard(false);
let viewActive = true;
let privateGeneration = 0;
const { formatDateTime } = useViewerDateTime();

definePageMeta({
  contentLayout: "reading",
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

const copy = computed(() =>
  locale.value === "ja"
    ? {
        publishReply: "返信を書く",
        replyTarget: "現在の返信先：{label}",
        replyHint: "感想や攻略の補足を書いてください。",
        cancelTarget: "指定返信を解除",
        replyPlaceholder: "返信を書く…",
        uploading: "アップロード中...",
        addImage: "画像を追加（{count}/4）",
        imageHint: "画像のみの返信にも対応。最大 4 枚",
        remove: "削除",
        locked: "このスレッドはロックされています",
        submit: "返信を投稿",
        blockedFloor: "この投稿はブロックしたユーザーのため折りたたまれています。",
        blockedReply: "この返信はブロックしたユーザーのため折りたたまれています。",
        expand: "表示する",
        likeThread: "スレッドにいいね",
        likedThread: "いいね済み",
        replyThread: "返信",
        floorReply: "{username} さんの投稿に返信",
        replyToFloor: "投稿に返信",
        replyToUser: "@{username} へ返信",
        reply: "返信",
        liked: "いいね済み",
        like: "いいね",
        empty: "まだ返信はありません。",
        uploadLimit: "1 件の返信に添付できる画像は最大 4 枚です",
        uploadDone: "返信画像をアップロードしました",
        uploadTooLarge: "1枚の画像は20MB以内で選択してください",
        uploadFailed: "画像アップロードに失敗しました",
        loginForUpload: "ログイン後に画像をアップロードしてください",
        replySuccess: "返信を投稿しました",
        replyFailed: "返信投稿に失敗しました",
        loginForReply: "ログイン後に返信してください",
        likeRemoved: "いいねを取り消しました",
        likeSuccess: "いいねしました",
        likeFailed: "いいねに失敗しました",
        loginForLike: "ログイン後にいいねしてください",
        articleBody: "本文",
        articleActions: "記事の操作",
        imageViewer: "画像ビューア",
        closeImageViewer: "画像ビューアを閉じる",
        previousImage: "前の画像",
        nextImage: "次の画像",
        replyUnavailable: "この返信は利用できません"
      }
    : {
        publishReply: "发表回复",
        replyTarget: "当前回复给：{label}",
        replyHint: "分享你的看法或补充攻略。",
        cancelTarget: "取消定向回复",
        replyPlaceholder: "写下回复…",
        uploading: "上传中...",
        addImage: "添加图片（{count}/4）",
        imageHint: "支持纯图片回复，最多 4 张",
        remove: "移除",
        locked: "当前帖子已锁定",
        submit: "发布回复",
        blockedFloor: "该楼层来自已屏蔽用户，默认已折叠。",
        blockedReply: "该回复来自已屏蔽用户，默认已折叠。",
        expand: "展开查看",
        likeThread: "点赞主题",
        likedThread: "已点赞",
        replyThread: "回复",
        floorReply: "{username} 的楼层",
        replyToFloor: "回复楼层",
        replyToUser: "回复 @{username}",
        reply: "回复",
        liked: "已赞",
        like: "点赞",
        empty: "还没有回复",
        uploadLimit: "单条回复最多上传 4 张图片",
        uploadDone: "回复图片上传完成",
        uploadTooLarge: "单张图片不能超过 20MB",
        uploadFailed: "图片上传失败",
        loginForUpload: "请先登录后再上传图片",
        replySuccess: "回复成功",
        replyFailed: "回复发布失败",
        loginForReply: "请先登录后再回复",
        likeRemoved: "已取消点赞",
        likeSuccess: "点赞成功",
        likeFailed: "点赞失败",
        loginForLike: "请先登录后再点赞",
        articleBody: "正文",
        articleActions: "文章操作",
        imageViewer: "图片查看器",
        closeImageViewer: "关闭图片查看器",
        previousImage: "上一张图片",
        nextImage: "下一张图片",
        replyUnavailable: "这条回复已不可用"
      }
);
const getSectionName = (slug: string, fallback = slug) => resolveForumSectionTranslation(t, slug, fallback);
const getSongDifficultyLabel = (difficultyType: number | null, fallback: string) =>
  difficultyType ? t(`difficulty.${difficultyType}`) : fallback;

const threadResource = useForumResource<ForumThreadDetail>(
  `forum-thread-detail:${route.params.id}`, () => apiFetch(`/api/forum/threads/${route.params.id}`, { retry: 0 }),
  { context: () => String(route.params.id) }
);
const { data, pending, error: readError, refresh } = threadResource;
const mutationCurrent = (ticket: number, threadId: string) => viewActive && requestGuard.current(ticket) && String(route.params.id) === threadId;

useViewerSeo(() => ({
  title: data.value?.title || t("forum.threadDetail"),
  description: buildPageDescription(data.value?.summary || t("page.forum.thread.desc")),
  path: `/forum/thread/${route.params.id}`,
  keywords: ["论坛帖子", "太鼓达人社区"]
}));

const detail = computed(() => data.value);
const firstContentImageIndex = computed(() =>
  detail.value?.contentBlocks.findIndex((block) => block.type !== "paragraph") ?? -1
);

type ViewerImage = {
  url: string;
  alt: string;
};

const imageViewerItems = computed<ViewerImage[]>(() => {
  const items: ViewerImage[] = [];
  const addBlocks = (blocks: ForumContentBlock[] | undefined) => {
    for (const block of blocks || []) {
      if (block.type === "image" && block.imageUrl) {
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

const openReplyComposer = () => {
  replyExpanded.value = true;
  nextTick(() => replyInput.value?.focus?.());
};

const getReplyTargetUsername = (
  reply: ForumThreadDetail["posts"][number]["replies"][number],
  floor: ForumThreadDetail["posts"][number],
) => {
  if (!reply.parentPostId) return "";
  if (reply.parentPostId === floor.id) {
    return floor.author.username;
  }
  return (
    floor.replies.find((entry) => entry.id === reply.parentPostId)?.author
      .username || ""
  );
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

const isBlockedContentVisible = (postId: number) =>
  revealedBlockedPostIds.value.includes(postId);

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

const renderReplyBlocks = (
  post:
    | ForumThreadDetail["posts"][number]
    | ForumThreadDetail["posts"][number]["replies"][number],
) => {
  return post.contentBlocks?.length
    ? post.contentBlocks
    : post.bodyText
      ? [{ type: "paragraph", text: post.bodyText }]
      : [];
};
</script>

<template>
  <div class="forum-thread-page">
    <el-skeleton
      v-if="pending"
      class="panel-card thread-loading"
      animated
      :rows="10"
    />

    <ForumReadState v-else-if="readError" :pending="false" :error="readError" @retry="refresh" />
    <template v-else-if="detail">
      <article class="thread-article">
      <header class="thread-header">
        <div class="thread-header__top">
          <div class="thread-header__badges">
            <NuxtLink
              :to="localePath(`/forum/section/${detail.section.slug}`)"
              class="thread-section-pill"
              :style="{ '--accent': detail.section.accentColor }"
            >
              {{ getSectionName(detail.section.slug, detail.section.name) }}
            </NuxtLink>
            <span v-if="detail.isPinned" class="thread-state">{{ t("forum.states.pinned") }}</span>
            <span
              v-if="detail.isFeatured"
              class="thread-state thread-state--gold"
              >{{ t("forum.states.featured") }}</span
            >
            <span
              v-if="detail.isLocked"
              class="thread-state thread-state--muted"
              >{{ t("forum.states.locked") }}</span
            >
          </div>
          <h1>{{ detail.title }}</h1>
        </div>

        <div class="thread-header__meta">
          <ForumUserBadge :user="detail.author" minimal />
          <div class="thread-header__stats">
            <span>{{ detail.replyCount }} {{ t("forum.stats.reply") }}</span>
            <span>{{ detail.viewCount }} {{ t("forum.stats.view") }}</span>
            <span>{{ formatDateTime(detail.createdAt) }}</span>
          </div>
        </div>

        <NuxtLink
          v-if="detail.song"
          class="thread-song-bind"
          :to="localePath({ path: `/songs/${detail.song.id}`, query: detail.song.difficultyType ? { difficulty: String(detail.song.difficultyType) } : {}, hash: detail.song.difficultyType ? '#chart-ugc' : undefined })"
        >
          <ForumSafeImage :src="detail.song.coverUrl" :alt="detail.song.title" />
          <div>
            <strong>{{ detail.song.title }}</strong>
            <span>{{ getSongDifficultyLabel(detail.song.difficultyType, detail.song.difficultyLabel) }}<template v-if="detail.song.difficultyType"> · {{ detail.song.level || "?" }}{{ t("guide.starSuffix") }}</template></span>
            <small>{{ t("community.viewChart") }} →</small>
          </div>
        </NuxtLink>

        <div v-if="detail.tags.length" class="thread-tags">
          <span v-for="tag in detail.tags" :key="tag">#{{ tag }}</span>
        </div>

      </header>

      <section class="thread-content" :aria-label="copy.articleBody">
        <div
          v-for="(block, index) in detail.contentBlocks"
          :key="`${block.type}-${index}`"
          class="thread-block"
        >
          <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
          <figure v-else class="thread-image">
            <button
              type="button"
              class="thread-image__trigger"
              :aria-label="`${copy.imageViewer}: ${block.alt || detail.title}`"
              @click="openImageViewer(block.imageUrl || '', $event)"
            >
              <ForumSafeImage
                :src="block.imageUrl || ''"
                :alt="block.alt || detail.title"
                :priority="index === firstContentImageIndex"
              />
            </button>
            <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
          </figure>
        </div>
      </section>

      <div class="thread-actions" :aria-label="copy.articleActions">
        <el-button
          class="thread-action"
          :class="{ 'is-liked': detail.viewerHasLiked }"
          :aria-pressed="detail.viewerHasLiked"
          :loading="likingThread"
          @click="toggleThreadLike($event)"
        >
          <svg class="thread-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2 4.8 13a4.6 4.6 0 0 1 6.5-6.5L12 7.2l.7-.7A4.6 4.6 0 0 1 19.2 13L12 20.2Z" :fill="detail.viewerHasLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg>
          <span>{{ detail.viewerHasLiked ? copy.likedThread : copy.likeThread }}</span>
          <span class="thread-action__count">{{ detail.likeCount }}</span>
        </el-button>
        <el-button class="thread-action" @click="setReplyTarget(null)">
          <svg class="thread-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3v-13Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg>
          <span>{{ copy.replyThread }}</span>
          <span class="thread-action__count">{{ detail.replyCount }}</span>
        </el-button>
      </div>

      <section class="reply-section" aria-labelledby="replies-title">
        <div class="reply-section__divider" aria-hidden="true"></div>
        <h2 id="replies-title">{{ t("forum.stats.reply") }} {{ detail.replyCount }}</h2>
      <section class="reply-box" :class="{ 'is-expanded': replyExpanded }">
        <div v-if="replyExpanded" class="reply-box__head">
          <div>
            <h3>{{ replyExpanded ? copy.publishReply : copy.replyThread }}</h3>
            <p v-if="replyTarget.label">{{ copy.replyTarget.replace("{label}", replyTarget.label) }}</p>
            <p v-else>{{ copy.replyHint }}</p>
          </div>
          <el-button v-if="replyTarget.id" text @click="setReplyTarget(null)"
            >{{ copy.cancelTarget }}</el-button
          >
          <el-button v-if="replyExpanded" text @click="replyExpanded = false">{{ t("common.cancel") }}</el-button>
        </div>
        <el-input
          ref="replyInput"
          class="reply-box__field"
          v-model="replyBody"
          type="textarea"
          :rows="replyExpanded ? 5 : 1"
          maxlength="1000"
          show-word-limit
          :disabled="detail.isLocked || submitting"
          :placeholder="copy.replyPlaceholder"
          @focus="replyExpanded = true"
        />
        <el-button
          v-if="!replyExpanded"
          class="reply-box__open"
          text
          :aria-label="copy.publishReply"
          @click="openReplyComposer"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 12-7-3.5 7L17 19 5 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
        </el-button>
        <div v-if="replyExpanded" class="reply-box__upload">
          <label class="reply-upload-trigger">
            <input
              type="file"
              accept="image/*"
              multiple
              :disabled="
                detail.isLocked || submitting || uploadingImages || replyImages.length >= 4
              "
              @change="uploadReplyImages"
            />
            {{
              uploadingImages
                ? copy.uploading
                : copy.addImage.replace("{count}", String(replyImages.length))
            }}
          </label>
          <span>{{ copy.imageHint }}</span>
        </div>
        <div v-if="replyExpanded && replyImages.length" class="reply-image-grid">
          <div
            v-for="(imageUrl, index) in replyImages"
            :key="`${imageUrl}-${index}`"
            class="reply-image-card"
          >
            <ForumSafeImage :src="imageUrl" alt="reply image" />
            <el-button text size="small" :disabled="submitting" @click="removeReplyImage(index)"
              >{{ copy.remove }}</el-button
            >
          </div>
        </div>
        <el-button
          v-if="replyExpanded"
          type="primary"
          :disabled="detail.isLocked || uploadingImages"
          :loading="submitting"
          @click="submitReply"
        >
          {{ detail.isLocked ? copy.locked : copy.submit }}
        </el-button>
      </section>

      <section class="reply-list">
        <article
          v-for="post in detail.posts"
          :key="post.id"
          class="floor-card"
          :id="`reply-${post.id}`"
          :class="{ 'is-targeted': highlightedReplyId === post.id }"
          tabindex="-1"
        >
          <div class="floor-card__head">
            <div class="floor-card__user">
              <ForumUserBadge :user="post.author" compact />
              <span class="floor-badge">#{{ post.floorNo }}</span>
            </div>
            <div class="floor-card__meta">
              {{ formatDateTime(post.createdAt) }}
            </div>
          </div>
          <div
            v-if="post.isBlockedAuthor && !isBlockedContentVisible(post.id)"
            class="blocked-content-card"
          >
            <p>{{ copy.blockedFloor }}</p>
            <el-button text size="small" @click="toggleBlockedContent(post.id)"
              >{{ copy.expand }}</el-button
            >
          </div>
          <template v-else>
            <div
              v-for="(block, index) in renderReplyBlocks(post)"
              :key="`post-${post.id}-${index}`"
              class="thread-block floor-card__body"
            >
              <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
                <figure v-else class="thread-image">
                  <button
                    type="button"
                    class="thread-image__trigger"
                    :aria-label="`${copy.imageViewer}: ${block.caption || copy.reply}`"
                    @click="openImageViewer(block.imageUrl || '', $event)"
                  >
                    <ForumSafeImage
                      :src="block.imageUrl || ''"
                      :alt="block.caption || 'reply image'"
                    />
                  </button>
                  <figcaption v-if="block.caption">
                    {{ block.caption }}
                  </figcaption>
              </figure>
            </div>
          </template>
          <div class="floor-card__actions">
            <el-button
              class="reply-action"
              :class="{ 'is-liked': post.viewerHasLiked }"
              size="small"
              :aria-pressed="post.viewerHasLiked"
              :loading="activePostLikeId === post.id"
              :disabled="activePostLikeId !== null && activePostLikeId !== post.id"
              @click="togglePostLike(post.id, $event)"
            >
              <svg class="reply-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2 4.8 13a4.6 4.6 0 0 1 6.5-6.5L12 7.2l.7-.7A4.6 4.6 0 0 1 19.2 13L12 20.2Z" :fill="post.viewerHasLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg>
              <span>{{ post.viewerHasLiked ? copy.liked : copy.like }}</span>
              <span>{{ post.likeCount }}</span>
            </el-button>
            <el-button
              class="reply-action"
              size="small"
              @click="setReplyTarget(post.id, copy.floorReply.replace('{username}', post.author.username))"
              ><svg class="reply-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3v-13Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg><span>{{ copy.replyToFloor }}</span></el-button
            >
          </div>

          <div v-if="post.replies.length" class="sub-reply-list">
            <div
              v-for="reply in post.replies"
              :key="reply.id"
              class="sub-reply-item"
              :id="`reply-${reply.id}`"
              :class="{ 'is-targeted': highlightedReplyId === reply.id }"
              tabindex="-1"
            >
              <div class="sub-reply-item__head">
                <ForumUserBadge :user="reply.author" compact />
                <span>{{ formatDateTime(reply.createdAt) }}</span>
              </div>
              <p
                v-if="getReplyTargetUsername(reply, post)"
                class="sub-reply-item__target"
              >
                {{ copy.replyToUser.replace("{username}", getReplyTargetUsername(reply, post)) }}
              </p>
              <div
                v-if="
                  reply.isBlockedAuthor && !isBlockedContentVisible(reply.id)
                "
                class="blocked-content-card blocked-content-card--sub"
              >
                <p>{{ copy.blockedReply }}</p>
                <el-button
                  text
                  size="small"
                  @click="toggleBlockedContent(reply.id)"
                  >{{ copy.expand }}</el-button
                >
              </div>
              <template v-else>
                <div
                  v-for="(block, index) in renderReplyBlocks(reply)"
                  :key="`reply-${reply.id}-${index}`"
                  class="thread-block"
                >
                  <p v-if="block.type === 'paragraph'">{{ block.text }}</p>
                    <figure v-else class="thread-image">
                      <button
                        type="button"
                        class="thread-image__trigger"
                        :aria-label="`${copy.imageViewer}: ${block.caption || copy.reply}`"
                        @click="openImageViewer(block.imageUrl || '', $event)"
                      >
                        <ForumSafeImage
                          :src="block.imageUrl || ''"
                          :alt="block.caption || 'reply image'"
                        />
                      </button>
                      <figcaption v-if="block.caption">
                        {{ block.caption }}
                      </figcaption>
                  </figure>
                </div>
              </template>
              <div class="floor-card__actions">
                <el-button
                  class="reply-action"
                  :class="{ 'is-liked': reply.viewerHasLiked }"
                  size="small"
                  :aria-pressed="reply.viewerHasLiked"
                  :loading="activePostLikeId === reply.id"
                  :disabled="activePostLikeId !== null && activePostLikeId !== reply.id"
                  @click="togglePostLike(reply.id, $event)"
                >
                  <svg class="reply-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2 4.8 13a4.6 4.6 0 0 1 6.5-6.5L12 7.2l.7-.7A4.6 4.6 0 0 1 19.2 13L12 20.2Z" :fill="reply.viewerHasLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg>
                  <span>{{ reply.viewerHasLiked ? copy.liked : copy.like }}</span>
                  <span>{{ reply.likeCount }}</span>
                </el-button>
                <el-button
                  class="reply-action"
                  size="small"
                  @click="
                    setReplyTarget(reply.id, copy.replyToUser.replace('{username}', reply.author.username))
                  "
                  ><svg class="reply-action__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3v-13Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg><span>{{ copy.reply }}</span></el-button
                >
              </div>
            </div>
          </div>
        </article>

        <el-empty
          v-if="!detail.posts.length"
          :description="copy.empty"
        />
      </section>
      </section>
      </article>
    </template>

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
.forum-thread-page {
  --thread-nav-offset: calc(66px + env(safe-area-inset-bottom));
  --thread-composer-height: 64px;
  --thread-composer-inline-padding: 15px;
  --thread-composer-block-padding: 11px;
  --thread-composer-action-gap: 11px;
  display: grid;
}

.thread-article { max-width: 100%; }

.thread-header,
.thread-content,
.reply-box,
.floor-card {
  padding: 0;
}

.thread-content {
  max-width: 100%;
  padding-top: 26px;
  padding-bottom: 4px;
}

.reply-box {
  padding: var(--thread-composer-block-padding) var(--thread-composer-inline-padding);
  border: 0;
  border-top: 1px solid var(--viewer-border);
  border-radius: 0;
  background:color-mix(in srgb, var(--viewer-surface) 96%, transparent);
  box-shadow:none;
}

.reply-box:not(.is-expanded) { display: flex; align-items: center; gap: var(--thread-composer-action-gap); min-height: var(--thread-composer-height); }
.reply-box:not(.is-expanded) :deep(.el-textarea__inner) { min-height: 42px !important; }
.reply-box:not(.is-expanded) :deep(.el-input__count) { display: none; }
.reply-box__field { flex: 1 1 auto; min-width: 0; }
.reply-box :deep(.el-textarea__inner) { padding: 10px 13px; border-radius: 13px; }
.reply-box__open { flex: 0 0 42px; width: 42px; height: 42px; margin: 0; color:var(--viewer-accent-strong); }
.reply-box__open svg { width: 20px; height: 20px; }

.floor-card {
  border-bottom: 1px solid var(--viewer-border);
  border-radius: 0;
  background:transparent;
}

.thread-header__top h1 {
  margin: 14px 0 0;
  color:var(--viewer-text);
  font-size: clamp(30px, 5vw, 46px);
  line-height: 1.22;
}

.reply-box__head p,
.thread-content p {
  margin: 0;
  color:var(--viewer-text-muted);
  line-height: 1.9;
}

.thread-header__badges,
.thread-tags,
.thread-actions,
.floor-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.thread-section-pill,
.thread-state,
.thread-tags span,
.floor-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.thread-section-pill {
  color:var(--accent);
  text-decoration: none;
  background:color-mix(in srgb, var(--accent) 16%, var(--viewer-surface));
}

.thread-state {
  color:var(--viewer-warning);
  background:var(--viewer-surface-subtle);
}

.thread-state--gold {
  background:linear-gradient(135deg, var(--viewer-warning-surface), var(--viewer-warning-surface));
}

.thread-state--muted {
  color:var(--viewer-text-muted);
  background:var(--viewer-surface-subtle);
}

.thread-header__meta,
.floor-card__head,
.thread-song-bind,
.reply-box__head,
.sub-reply-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.thread-header__meta,
.thread-song-bind,
.thread-tags,
.thread-actions {
  margin-top: 16px;
}

.thread-header__stats,
.floor-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  color:var(--viewer-text-muted);
  font-size: 12px;
}

.thread-song-bind {
  justify-content: flex-start;
  padding: 12px 14px;
  border-radius: 20px;
  background:var(--viewer-surface-subtle);
  color:inherit;
  text-decoration: none;
}

.thread-song-bind img {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  object-fit: cover;
}

.thread-song-bind div {
  display: grid;
  gap: 4px;
}

.thread-song-bind span {
  color:var(--viewer-text-muted);
  font-size: 13px;
}

.thread-song-bind small {
  color:var(--viewer-error);
  font-size: 12px;
}

.thread-tags span {
  color:var(--viewer-primary);
  background:var(--viewer-surface-subtle);
}

.thread-block + .thread-block {
  margin-top: 18px;
}

.thread-image {
  display: grid;
  gap: 10px;
}

.thread-image__trigger {
  display: block;
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  border: 0;
  border-radius: 22px;
  background:transparent;
  cursor: zoom-in;
}

.thread-image__trigger:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--viewer-accent) 58%, transparent);
  outline-offset: 4px;
}

.thread-image img,
.thread-image__trigger :deep(img) {
  width: auto;
  max-width: 100%;
  border-radius: 22px;
  max-height: min(80vh, 900px);
  object-fit: contain;
  margin: 0 auto;
  background:transparent;
}

.floor-card,
.sub-reply-item {
  scroll-margin-top: 88px;
  scroll-margin-bottom: 120px;
  transition: background-color 180ms ease;
}

.floor-card.is-targeted,
.sub-reply-item.is-targeted {
  background:color-mix(in srgb, var(--viewer-accent) 12%, transparent);
}

.thread-image figcaption {
  color:var(--viewer-text-muted);
  font-size: 13px;
}

.reply-box {
  display: grid;
  gap: var(--thread-composer-action-gap);
}

.reply-box__upload {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  color:var(--viewer-text-muted);
  font-size: 13px;
}

.reply-upload-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 999px;
  background:var(--viewer-surface-subtle);
  color:var(--viewer-primary);
  cursor: pointer;
}

.reply-upload-trigger input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.reply-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.reply-image-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 18px;
  background:var(--viewer-surface-subtle);
}

.reply-list {
  display: grid;
  gap: 18px;
}

.thread-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; padding: 14px 0 24px; }
.thread-action,
.reply-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: 7px;
  margin-left: 0 !important;
  padding: 8px 11px;
  border: 0;
  border-radius: 10px;
  color:var(--viewer-text-muted);
  background:transparent;
  font-weight: 650;
  transition: background-color 140ms ease, color 140ms ease, opacity 140ms ease;
}
.reply-action { min-height: 38px; padding: 6px 9px; font-size: 12px; }
.thread-action__icon,
.reply-action__icon { width: 17px; height: 17px; flex: 0 0 auto; }
.thread-action__count { min-width: 1ch; }
.thread-action:hover,
.reply-action:hover { color:var(--viewer-text); background:color-mix(in srgb, var(--viewer-accent) 10%, transparent); }
.thread-action:active,
.reply-action:active { opacity: .78; background:color-mix(in srgb, var(--viewer-accent) 16%, transparent); }
.thread-action:focus-visible,
.reply-action:focus-visible { outline: 2px solid color-mix(in srgb, var(--viewer-accent) 58%, transparent); outline-offset: 2px; }
.thread-action.is-liked,
.reply-action.is-liked { color:var(--viewer-accent-strong); }
.reply-section { padding-top: 28px; }
.reply-section__divider { height: 1px; background:var(--viewer-border); }
.reply-section h2 { margin: 20px 0 16px; color:var(--viewer-text); font-size: 22px; }

.floor-card__user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.floor-badge {
  color:var(--viewer-primary);
  background:var(--viewer-surface-subtle);
}

.floor-card__body,
.sub-reply-item p {
  margin: 16px 0;
  white-space: pre-wrap;
  line-height: 1.85;
}

.floor-card__head { padding-top: 4px; }
.floor-card__actions { margin-top: 12px; padding-bottom: 4px; }

.sub-reply-item__target {
  margin: 12px 0 -4px;
  color:var(--viewer-primary);
  font-size: 13px;
}

.sub-reply-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.sub-reply-item {
  padding: 16px 0 16px 28px;
  border-top: 1px solid var(--viewer-border);
}

.blocked-content-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background:var(--viewer-surface-subtle);
}

.blocked-content-card p {
  margin: 0;
}

.blocked-content-card--sub {
  margin-top: 12px;
}

.sub-reply-item__head span {
  color:var(--viewer-text-muted);
  font-size: 12px;
}



body.theme-dark .reply-box__head p,
body.theme-dark .thread-content p,
body.theme-dark .thread-header__stats,
body.theme-dark .floor-card__meta,
body.theme-dark .thread-song-bind span,
body.theme-dark .thread-image figcaption,
body.theme-dark .sub-reply-item__head span,
body.theme-dark .sub-reply-item__target,
body.theme-dark .reply-box__upload {
  color:var(--viewer-text-muted);
}

body.theme-dark .thread-song-bind,
body.theme-dark .reply-image-card {
  background:var(--viewer-surface-subtle);
}

body.theme-dark .reply-box {
  background:color-mix(in srgb, var(--viewer-surface) 96%, transparent);
}

body.theme-dark .reply-box :deep(.el-textarea__inner) {
  color:var(--viewer-text);
  background:var(--viewer-surface-subtle);
  box-shadow:0 0 0 1px var(--viewer-shadow) inset;
}

body.theme-dark .reply-box :deep(.el-textarea__inner::placeholder) {
  color:var(--viewer-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .floor-card,
  .sub-reply-item { transition: none; }
}

body.theme-dark .reply-upload-trigger,
body.theme-dark .blocked-content-card {
  background:var(--viewer-surface-subtle);
  color:var(--viewer-text-muted);
}

@media (max-width: 960px) {
  .thread-header__meta,
  .floor-card__head,
  .thread-song-bind,
  .reply-box__head,
  .sub-reply-item__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .thread-header__top h1 {
    font-size: 28px;
  }

  .forum-thread-page { padding-bottom: calc(var(--thread-nav-offset) + var(--thread-composer-height) + 16px); }
  .reply-list { padding-bottom: 24px; }
  .reply-box { position: fixed; left: 0; right: 0; bottom: var(--thread-nav-offset); z-index: 25; }
  .reply-box.is-expanded { max-height: min(62vh, 460px); overflow: hidden; }
  .thread-header { padding: 0; }
  .thread-content, .floor-card { padding-left: 4px; padding-right: 4px; }
}
</style>
