<script setup lang="ts">
import { ElMessage } from "element-plus";
import { formatViewerTitle } from "~/composables/useViewerSeo";
import type { ForumThreadDetail } from "~/types/forum";

const route = useRoute();
const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

const pageMeta = {
  title: "帖子详情",
  desc: "查看太鼓论坛主题、楼层回复和相关互动。",
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/forum",
  breadcrumbs: [{ label: "论坛社区", to: "/forum" }, { label: "帖子详情" }],
});

const replyBody = ref("");
const replyImages = ref<string[]>([]);
const replyTarget = ref<{ id: number | null; label: string }>({
  id: null,
  label: "",
});
const submitting = ref(false);
const uploadingImages = ref(false);
const likingThread = ref(false);
const activePostLikeId = ref<number | null>(null);
const revealedBlockedPostIds = ref<number[]>([]);

const { data, pending, refresh } = await useAsyncData<ForumThreadDetail>(
  () => `forum-thread-${route.params.id}`,
  () => $fetch(`/api/forum/threads/${route.params.id}`, { headers }),
);

useSeoMeta({
  title: () => formatViewerTitle(data.value?.title || pageMeta.title),
  description: () => data.value?.summary || pageMeta.desc,
});

const detail = computed(() => data.value);

const setReplyTarget = (id: number | null, label = "") => {
  replyTarget.value = { id, label };
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
    ElMessage.warning("单条回复最多上传 4 张图片");
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
      const result = await $fetch<{ imageUrl: string }>(
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
    ElMessage.success("回复图片上传完成");
  } catch (error: any) {
    showActionError(error, "图片上传失败", "请先登录后再上传图片");
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
    await $fetch(`/api/forum/threads/${route.params.id}/replies`, {
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
    ElMessage.success("回复成功");
    await refresh();
  } catch (error: any) {
    showActionError(error, "回复发布失败", "请先登录后再回复");
  } finally {
    submitting.value = false;
  }
};

const toggleThreadLike = async () => {
  if (likingThread.value) return;
  likingThread.value = true;
  try {
    const wasLiked = Boolean(detail.value?.viewerHasLiked);
    await $fetch(`/api/forum/threads/${route.params.id}/like`, {
      method: "POST",
    });
    ElMessage.success(wasLiked ? "已取消点赞" : "点赞成功");
    await refresh();
  } catch (error: any) {
    showActionError(error, "点赞失败", "请先登录后再点赞");
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
    await $fetch(`/api/forum/posts/${postId}/like`, {
      method: "POST",
    });
    ElMessage.success(wasLiked ? "已取消点赞" : "点赞成功");
    await refresh();
  } catch (error: any) {
    showActionError(error, "点赞失败", "请先登录后再点赞");
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
      <section class="panel-card thread-header">
        <div class="thread-header__top">
          <div class="thread-header__badges">
            <NuxtLink
              :to="`/forum/section/${detail.section.slug}`"
              class="thread-section-pill"
              :style="{ '--accent': detail.section.accentColor }"
            >
              {{ detail.section.name }}
            </NuxtLink>
            <span v-if="detail.isPinned" class="thread-state">置顶</span>
            <span
              v-if="detail.isFeatured"
              class="thread-state thread-state--gold"
              >加精</span
            >
            <span
              v-if="detail.isLocked"
              class="thread-state thread-state--muted"
              >锁帖</span
            >
          </div>
          <h2>{{ detail.title }}</h2>
          <p>{{ detail.summary }}</p>
        </div>

        <div class="thread-header__meta">
          <ForumUserBadge :user="detail.author" />
          <div class="thread-header__stats">
            <span>{{ detail.replyCount }} 回复</span>
            <span>{{ detail.likeCount }} 点赞</span>
            <span>{{ detail.viewCount }} 浏览</span>
            <span>{{
              new Date(detail.createdAt).toLocaleString("zh-CN")
            }}</span>
          </div>
        </div>

        <div v-if="detail.song" class="thread-song-bind">
          <ForumSafeImage
            :src="detail.song.coverUrl"
            :alt="detail.song.title"
          />
          <div>
            <strong>{{ detail.song.title }}</strong>
            <span
              >{{ detail.song.difficultyLabel }} ·
              {{ detail.song.level || "?" }}星</span
            >
          </div>
        </div>

        <div v-if="detail.tags.length" class="thread-tags">
          <span v-for="tag in detail.tags" :key="tag">#{{ tag }}</span>
        </div>

        <div class="thread-actions">
          <el-button
            :type="detail.viewerHasLiked ? 'warning' : 'default'"
            :loading="likingThread"
            @click="toggleThreadLike"
          >
            {{ detail.viewerHasLiked ? "已点赞" : "点赞主题" }}
          </el-button>
          <el-button type="primary" plain @click="setReplyTarget(null)"
            >回复主题</el-button
          >
        </div>
      </section>

      <section class="panel-card thread-content">
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
            />
            <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
          </figure>
        </div>
      </section>

      <section class="panel-card reply-box">
        <div class="reply-box__head">
          <div>
            <h3>发表回复</h3>
            <p v-if="replyTarget.label">当前回复给：{{ replyTarget.label }}</p>
            <p v-else>对主题发表你的观点或继续补充攻略。</p>
          </div>
          <el-button v-if="replyTarget.id" text @click="setReplyTarget(null)"
            >取消定向回复</el-button
          >
        </div>
        <el-input
          v-model="replyBody"
          type="textarea"
          :rows="5"
          maxlength="1000"
          show-word-limit
          :disabled="detail.isLocked"
          placeholder="输入回复内容，可使用 @用户名 提及其他鼓友"
        />
        <div class="reply-box__upload">
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
                ? "上传中..."
                : `添加图片（${replyImages.length}/4）`
            }}
          </label>
          <span>支持纯图片回复，最多 4 张</span>
        </div>
        <div v-if="replyImages.length" class="reply-image-grid">
          <div
            v-for="(imageUrl, index) in replyImages"
            :key="`${imageUrl}-${index}`"
            class="reply-image-card"
          >
            <ForumSafeImage :src="imageUrl" alt="reply image" />
            <el-button text size="small" @click="removeReplyImage(index)"
              >移除</el-button
            >
          </div>
        </div>
        <el-button
          type="primary"
          :disabled="detail.isLocked || uploadingImages"
          :loading="submitting"
          @click="submitReply"
        >
          {{ detail.isLocked ? "当前帖子已锁定" : "发布回复" }}
        </el-button>
      </section>

      <section class="reply-list">
        <article
          v-for="post in detail.posts"
          :key="post.id"
          class="panel-card floor-card"
        >
          <div class="floor-card__head">
            <div class="floor-card__user">
              <ForumUserBadge :user="post.author" compact />
              <span class="floor-badge">#{{ post.floorNo }}</span>
            </div>
            <div class="floor-card__meta">
              {{ new Date(post.createdAt).toLocaleString("zh-CN") }}
            </div>
          </div>
          <div
            v-if="post.isBlockedAuthor && !isBlockedContentVisible(post.id)"
            class="blocked-content-card"
          >
            <p>该楼层来自已屏蔽用户，默认已折叠。</p>
            <el-button text size="small" @click="toggleBlockedContent(post.id)"
              >展开查看</el-button
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
              {{ post.viewerHasLiked ? "已赞" : "点赞" }} {{ post.likeCount }}
            </el-button>
            <el-button
              size="small"
              text
              @click="setReplyTarget(post.id, `${post.author.username} 的楼层`)"
              >回复楼层</el-button
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
                <span>{{
                  new Date(reply.createdAt).toLocaleString("zh-CN")
                }}</span>
              </div>
              <p
                v-if="getReplyTargetUsername(reply, post)"
                class="sub-reply-item__target"
              >
                回复 @{{ getReplyTargetUsername(reply, post) }}
              </p>
              <div
                v-if="
                  reply.isBlockedAuthor && !isBlockedContentVisible(reply.id)
                "
                class="blocked-content-card blocked-content-card--sub"
              >
                <p>该回复来自已屏蔽用户，默认已折叠。</p>
                <el-button
                  text
                  size="small"
                  @click="toggleBlockedContent(reply.id)"
                  >展开查看</el-button
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
                  {{ reply.viewerHasLiked ? "已赞" : "点赞" }}
                  {{ reply.likeCount }}
                </el-button>
                <el-button
                  size="small"
                  text
                  @click="
                    setReplyTarget(reply.id, `${reply.author.username} 的回复`)
                  "
                  >回复</el-button
                >
              </div>
            </div>
          </div>
        </article>

        <el-empty
          v-if="!detail.posts.length"
          description="还没有回复，抢个沙发吧"
        />
      </section>
    </template>
  </div>
</template>

<style scoped>
.forum-thread-page {
  display: grid;
  gap: 18px;
}

.thread-header,
.thread-content,
.reply-box,
.floor-card {
  padding: 20px;
}

.thread-header__top h2 {
  margin: 10px 0 10px;
  font-size: 34px;
  line-height: 1.22;
}

.thread-header__top p,
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
  width: 100%;
  border-radius: 22px;
  object-fit: cover;
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
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 247, 238, 0.92);
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

body.theme-dark .thread-header__top p,
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
body.theme-dark .sub-reply-item,
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

  .thread-header__top h2 {
    font-size: 28px;
  }
}
</style>
