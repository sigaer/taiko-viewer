<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import type { ForumThreadDetail } from "~/types/forum";
import { buildPageDescription } from "~/utils/seo";
import { resolveForumSectionTranslation } from "~/utils/forum";

const route = useRoute();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();

definePageMeta({
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
        articleActions: "記事の操作"
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
        articleActions: "文章操作"
      }
);
const getSectionName = (slug: string, fallback = slug) => resolveForumSectionTranslation(t, slug, fallback);
const getSongDifficultyLabel = (difficultyType: number | null, fallback: string) =>
  difficultyType ? t(`difficulty.${difficultyType}`) : fallback;

const { data, pending, refresh } = await useAsyncData<ForumThreadDetail>(
  () => `forum-thread-${route.params.id}`,
  () => apiFetch(`/api/forum/threads/${route.params.id}`),
);

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

const setReplyTarget = (id: number | null, label = "") => {
  replyTarget.value = { id, label };
  replyExpanded.value = true;
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
  if (!files.length || uploadingImages.value) return;
  if (replyImages.value.length >= 4) {
    ElMessage.warning(copy.value.uploadLimit);
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
      if (result.imageUrl) {
        replyImages.value.push(result.imageUrl);
      }
    }
    ElMessage.success(copy.value.uploadDone);
  } catch (error: any) {
    showActionError(error, copy.value.uploadFailed, copy.value.loginForUpload);
  } finally {
    uploadingImages.value = false;
    if (input) input.value = "";
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

const submitReply = async () => {
  if (
    (!replyBody.value.trim() && !replyImages.value.length) ||
    submitting.value
  )
    return;
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
    await apiFetch(`/api/forum/threads/${route.params.id}/replies`, {
      method: "POST",
      body: {
        bodyText: replyBody.value,
        contentBlocks,
        parentPostId: replyTarget.value.id || undefined,
      },
    });
    replyBody.value = "";
    replyImages.value = [];
    replyTarget.value = { id: null, label: "" };
    replyExpanded.value = false;
    ElMessage.success(copy.value.replySuccess);
    await refresh();
  } catch (error: any) {
    showActionError(error, copy.value.replyFailed, copy.value.loginForReply);
  } finally {
    submitting.value = false;
  }
};

const toggleThreadLike = async () => {
  if (likingThread.value) return;
  likingThread.value = true;
  try {
    const wasLiked = Boolean(detail.value?.viewerHasLiked);
    await apiFetch(`/api/forum/threads/${route.params.id}/like`, {
      method: "POST",
    });
    ElMessage.success(wasLiked ? copy.value.likeRemoved : copy.value.likeSuccess);
    await refresh();
  } catch (error: any) {
    showActionError(error, copy.value.likeFailed, copy.value.loginForLike);
  } finally {
    likingThread.value = false;
  }
};

const togglePostLike = async (postId: number) => {
  if (activePostLikeId.value === postId) return;
  activePostLikeId.value = postId;
  try {
    const allPosts = detail.value?.posts || [];
    const currentPost =
      allPosts.find((post) => post.id === postId) ||
      allPosts
        .flatMap((post) => post.replies)
        .find((reply) => reply.id === postId);
    const wasLiked = Boolean(currentPost?.viewerHasLiked);
    await apiFetch(`/api/forum/posts/${postId}/like`, {
      method: "POST",
    });
    ElMessage.success(wasLiked ? copy.value.likeRemoved : copy.value.likeSuccess);
    await refresh();
  } catch (error: any) {
    showActionError(error, copy.value.likeFailed, copy.value.loginForLike);
  } finally {
    activePostLikeId.value = null;
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
            <ForumSafeImage
              :src="block.imageUrl || ''"
              :alt="block.alt || detail.title"
              :priority="index === firstContentImageIndex"
            />
            <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
          </figure>
        </div>
      </section>

      <div class="thread-actions" :aria-label="copy.articleActions">
        <el-button class="thread-action" :type="detail.viewerHasLiked ? 'warning' : 'default'" :loading="likingThread" @click="toggleThreadLike">
          {{ detail.viewerHasLiked ? copy.likedThread : copy.likeThread }}
        </el-button>
        <el-button class="thread-action" type="primary" plain @click="setReplyTarget(null)">{{ copy.replyThread }}</el-button>
      </div>

      <section class="reply-section" aria-labelledby="replies-title">
        <div class="reply-section__divider" aria-hidden="true"></div>
        <h2 id="replies-title">{{ t("forum.stats.reply") }} {{ detail.replyCount }}</h2>
      <section class="reply-box" :class="{ 'is-expanded': replyExpanded }">
        <div class="reply-box__head">
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
          v-model="replyBody"
          type="textarea"
          :rows="replyExpanded ? 5 : 1"
          maxlength="1000"
          show-word-limit
          :disabled="detail.isLocked"
          :placeholder="copy.replyPlaceholder"
          @focus="replyExpanded = true"
        />
        <div v-if="replyExpanded" class="reply-box__upload">
          <label class="reply-upload-trigger">
            <input
              type="file"
              accept="image/*"
              multiple
              :disabled="
                detail.isLocked || uploadingImages || replyImages.length >= 4
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
            <el-button text size="small" @click="removeReplyImage(index)"
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
                <ForumSafeImage
                  :src="block.imageUrl || ''"
                  :alt="block.caption || 'reply image'"
                />
                <figcaption v-if="block.caption">
                  {{ block.caption }}
                </figcaption>
              </figure>
            </div>
          </template>
          <div class="floor-card__actions">
            <el-button
              size="small"
              :loading="activePostLikeId === post.id"
              @click="togglePostLike(post.id)"
            >
              {{ post.viewerHasLiked ? copy.liked : copy.like }} {{ post.likeCount }}
            </el-button>
            <el-button
              size="small"
              text
              @click="setReplyTarget(post.id, copy.floorReply.replace('{username}', post.author.username))"
              >{{ copy.replyToFloor }}</el-button
            >
          </div>

          <div v-if="post.replies.length" class="sub-reply-list">
            <div
              v-for="reply in post.replies"
              :key="reply.id"
              class="sub-reply-item"
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
                    <ForumSafeImage
                      :src="block.imageUrl || ''"
                      :alt="block.caption || 'reply image'"
                    />
                    <figcaption v-if="block.caption">
                      {{ block.caption }}
                    </figcaption>
                  </figure>
                </div>
              </template>
              <div class="floor-card__actions">
                <el-button
                  size="small"
                  :loading="activePostLikeId === reply.id"
                  @click="togglePostLike(reply.id)"
                >
                  {{ reply.viewerHasLiked ? copy.liked : copy.like }}
                  {{ reply.likeCount }}
                </el-button>
                <el-button
                  size="small"
                  text
                  @click="
                    setReplyTarget(reply.id, copy.replyToUser.replace('{username}', reply.author.username))
                  "
                  >{{ copy.reply }}</el-button
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
  </div>
</template>

<style scoped>
.forum-thread-page {
  display: grid;
}

.thread-article { max-width: 780px; }

.thread-header,
.thread-content,
.reply-box,
.floor-card {
  padding: 0;
}

.thread-content {
  max-width: 780px;
  padding-top: 26px;
  padding-bottom: 4px;
}

.reply-box {
  position: sticky;
  bottom: 16px;
  z-index: 8;
  border: 1px solid var(--viewer-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--viewer-surface) 96%, transparent);
  box-shadow: 0 12px 28px rgba(77, 55, 39, .14);
}

.reply-box:not(.is-expanded) { padding: 10px 12px; }
.reply-box:not(.is-expanded) .reply-box__head p { display: none; }
.reply-box:not(.is-expanded) .reply-box__head { margin: 0; }
.reply-box:not(.is-expanded) :deep(.el-textarea__inner) { min-height: 38px !important; }

.floor-card {
  border-bottom: 1px solid var(--viewer-border);
  border-radius: 0;
  background: transparent;
}

.thread-header__top h1 {
  margin: 14px 0 0;
  color: var(--viewer-text);
  font-size: clamp(30px, 5vw, 46px);
  line-height: 1.22;
}

.reply-box__head p,
.thread-content p {
  margin: 0;
  color: #6f5b4a;
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
  color: var(--accent);
  text-decoration: none;
  background: color-mix(in srgb, var(--accent) 16%, white);
}

.thread-state {
  color: #8a643f;
  background: rgba(255, 232, 184, 0.7);
}

.thread-state--gold {
  background: linear-gradient(135deg, #f8e7b4, #ffd970);
}

.thread-state--muted {
  color: #6a6258;
  background: rgba(165, 157, 147, 0.22);
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
  color: #7f6755;
  font-size: 12px;
}

.thread-song-bind {
  justify-content: flex-start;
  padding: 12px 14px;
  border-radius: 20px;
  background: rgba(255, 239, 219, 0.8);
  color: inherit;
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
  color: #7f6654;
  font-size: 13px;
}

.thread-song-bind small {
  color: #b25237;
  font-size: 12px;
}

.thread-tags span {
  color: #b35239;
  background: rgba(255, 234, 216, 0.8);
}

.thread-block + .thread-block {
  margin-top: 18px;
}

.thread-image {
  display: grid;
  gap: 10px;
}

.thread-image img {
  width: auto;
  max-width: 100%;
  border-radius: 22px;
  max-height: min(80vh, 900px);
  object-fit: contain;
  margin: 0 auto;
  background: transparent;
}

.thread-image figcaption {
  color: #836a57;
  font-size: 13px;
}

.reply-box {
  display: grid;
  gap: 14px;
}

.reply-box__upload {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  color: #836a57;
  font-size: 13px;
}

.reply-upload-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 234, 216, 0.9);
  color: #b35239;
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
  background: rgba(255, 247, 238, 0.92);
}

.reply-list {
  display: grid;
  gap: 16px;
}

.thread-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; padding: 14px 0 24px; border-bottom: 1px solid var(--viewer-border); }
.thread-action { border-radius: 999px; }
.reply-section { padding-top: 28px; }
.reply-section__divider { height: 1px; background: var(--viewer-border); }
.reply-section h2 { margin: 20px 0 14px; color: var(--viewer-text); font-size: 22px; }

.floor-card__user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.floor-badge {
  color: #c74f32;
  background: rgba(255, 234, 213, 0.9);
}

.floor-card__body,
.sub-reply-item p {
  margin: 16px 0;
  white-space: pre-wrap;
  line-height: 1.85;
}

.sub-reply-item__target {
  margin: 12px 0 -4px;
  color: #b35239;
  font-size: 13px;
}

.sub-reply-list {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.sub-reply-item {
  padding: 14px 0 0 28px;
  border-top: 1px solid var(--viewer-border);
}

.blocked-content-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(212, 222, 231, 0.48);
}

.blocked-content-card p {
  margin: 0;
}

.blocked-content-card--sub {
  margin-top: 12px;
}

.sub-reply-item__head span {
  color: #7e6754;
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
  color: #cab8aa;
}

body.theme-dark .thread-song-bind,
body.theme-dark .reply-image-card {
  background: rgba(64, 43, 31, 0.72);
}

body.theme-dark .reply-upload-trigger,
body.theme-dark .blocked-content-card {
  background: rgba(64, 43, 31, 0.72);
  color: #f2dac2;
}

@media (max-width: 860px) {
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

  .forum-thread-page { padding-bottom: 150px; }
  .reply-box { bottom: calc(72px + env(safe-area-inset-bottom)); }
  .reply-box.is-expanded { position: fixed; left: 10px; right: 10px; bottom: calc(72px + env(safe-area-inset-bottom)); max-height: min(62vh, 460px); overflow-y: auto; }
  .thread-header { padding: 0; }
  .thread-content, .floor-card { padding-left: 4px; padding-right: 4px; }
}
</style>
