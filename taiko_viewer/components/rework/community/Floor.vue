<script setup lang="ts">
// ReworkCommunityFloor — one floor of a thread (its post and the replies inside it, 楼中楼 with a left rule), as a card.
// Ids stay `reply-<post id>` with tabindex=-1 so `#reply-<id>` links land on them (scroll, focus, highlight are the
// page's). A blocked author's post is folded until revealed. Like, reply, copy link, and — on one's own posts while
// the thread is open — edit and delete only emit; the page does the requests (the server checks ownership again).
// `entry.head` is false when the floor's own post is mounted in the previous reply window (only its replies here).
import type { PropType } from "vue";
import type { ForumContentBlock } from "~/types/forum";
import type { WindowFloor } from "~/utils/rework/community";
import { ownsItem, replyTargetName } from "~/utils/rework/community";

const props = defineProps({
  entry: { type: Object as PropType<WindowFloor>, required: true },
  /** the thread author's user id (楼主 tag) */
  opId: { type: Number, default: 0 },
  highlightedId: { type: Number as PropType<number | null>, default: null },
  revealedIds: { type: Array as PropType<number[]>, default: () => [] },
  activeLikeId: { type: Number as PropType<number | null>, default: null },
  viewerLabel: { type: String, required: true },
  /** the signed-in member (own posts get edit / delete) */
  viewerId: { type: Number as PropType<number | null>, default: null },
  /** the thread is locked: no edit / delete */
  locked: { type: Boolean, default: false },
  editingId: { type: Number as PropType<number | null>, default: null },
  /** a post edit or delete is in flight */
  ownBusy: { type: Boolean, default: false }
});
const emit = defineEmits<{
  like: [id: number, event: MouseEvent];
  reply: [id: number, label: string];
  reveal: [id: number];
  open: [url: string, event: MouseEvent];
  failed: [url: string];
  copy: [id: number];
  edit: [id: number];
  cancelEdit: [];
  save: [id: number, payload: { bodyText: string; images: string[] }];
  remove: [id: number, isFloor: boolean];
}>();
const { t } = useI18n();
const floor = computed(() => props.entry.floor);
const folded = (id: number, blocked: boolean) => blocked && !props.revealedIds.includes(id);
const blocksOf = (post: { contentBlocks?: unknown[]; bodyText: string }) =>
  (post.contentBlocks?.length ? post.contentBlocks : post.bodyText ? [{ type: "paragraph", text: post.bodyText }] : []) as ForumContentBlock[];
const likeBusy = (id: number) => props.activeLikeId === id;
const likeDisabled = (id: number) => props.activeLikeId !== null && props.activeLikeId !== id;
const mine = (authorId: number) => ownsItem(authorId, props.viewerId, props.locked);
</script>

<template>
  <li class="cf" :class="{ 'is-continued': !entry.head }">
    <article
      v-if="entry.head"
      :id="`reply-${floor.id}`"
      class="cf__post"
      :class="{ 'is-targeted': highlightedId === floor.id }"
      tabindex="-1"
    >
      <header class="cf__head">
        <ReworkCommunityAuthor :user="floor.author" :size="32" titles="text" :op="floor.author.id === opId" link>
          <ReworkCommunityTime class="cf__time" :value="floor.createdAt" />
        </ReworkCommunityAuthor>
        <span class="cf__no num">#{{ floor.floorNo }}</span>
      </header>
      <ReworkCommunityPostEditor
        v-if="editingId === floor.id"
        class="cf__body"
        :blocks="blocksOf(floor)"
        :saving="ownBusy"
        @save="(payload) => emit('save', floor.id, payload)"
        @cancel="emit('cancelEdit')"
      />
      <div v-else-if="folded(floor.id, floor.isBlockedAuthor)" class="cf__blocked">
        <p>{{ t("rework.forum.thread.blockedFloor") }}</p>
        <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" @click="emit('reveal', floor.id)">{{ t("rework.forum.thread.expand") }}</button>
      </div>
      <ReworkCommunityBlocks v-else class="cf__body" :blocks="blocksOf(floor)" :viewer-label="viewerLabel" :fallback-alt="t('rework.forum.thread.reply')" @open="(url, event) => emit('open', url, event)" @failed="(url) => emit('failed', url)" />
      <div v-if="editingId !== floor.id" class="cf__acts">
        <button
          type="button"
          class="cf__act"
          :class="{ 'is-on': floor.viewerHasLiked }"
          :aria-pressed="floor.viewerHasLiked"
          :aria-busy="likeBusy(floor.id) || undefined"
          :disabled="likeBusy(floor.id) || likeDisabled(floor.id)"
          @click="emit('like', floor.id, $event)"
        >
          <ReworkIcon :name="floor.viewerHasLiked ? 'heartFilled' : 'heart'" /><span>{{ floor.viewerHasLiked ? t("rework.forum.thread.liked") : t("rework.forum.thread.like") }}</span><b class="num">{{ floor.likeCount }}</b>
        </button>
        <button type="button" class="cf__act" @click="emit('reply', floor.id, t('rework.forum.thread.floorReply', { username: floor.author.username }))">
          <ReworkIcon name="reply" /><span>{{ t("rework.forum.thread.replyToFloor") }}</span>
        </button>
        <button type="button" class="cf__act cf__icon" :aria-label="t('rework.forum.tools.copyFloorLink')" :title="t('rework.forum.tools.copyFloorLink')" @click="emit('copy', floor.id)">
          <ReworkIcon name="link" />
        </button>
        <template v-if="mine(floor.author.id)">
          <button type="button" class="cf__act cf__icon" :aria-label="t('rework.forum.tools.edit')" :title="t('rework.forum.tools.edit')" :disabled="ownBusy" @click="emit('edit', floor.id)">
            <ReworkIcon name="edit" />
          </button>
          <button type="button" class="cf__act cf__icon is-danger" :aria-label="t('rework.forum.tools.delete')" :title="t('rework.forum.tools.delete')" :disabled="ownBusy" @click="emit('remove', floor.id, true)">
            <ReworkIcon name="trash" />
          </button>
        </template>
      </div>
    </article>
    <div v-else class="cf__cont">
      <span class="num">#{{ floor.floorNo }}</span> {{ floor.author.username }}
    </div>
    <ol v-if="entry.replies.length" class="cf__replies">
      <li
        v-for="reply in entry.replies"
        :id="`reply-${reply.id}`"
        :key="reply.id"
        class="cf__reply"
        :class="{ 'is-targeted': highlightedId === reply.id }"
        tabindex="-1"
      >
        <header class="cf__head">
          <ReworkCommunityAuthor :user="reply.author" :size="24" titles="none" :op="reply.author.id === opId" link>
            <ReworkCommunityTime class="cf__time" :value="reply.createdAt" />
          </ReworkCommunityAuthor>
        </header>
        <p v-if="replyTargetName(reply, floor)" class="cf__target">{{ t("rework.forum.thread.replyToUser", { username: replyTargetName(reply, floor) }) }}</p>
        <ReworkCommunityPostEditor
          v-if="editingId === reply.id"
          :blocks="blocksOf(reply)"
          :saving="ownBusy"
          @save="(payload) => emit('save', reply.id, payload)"
          @cancel="emit('cancelEdit')"
        />
        <div v-else-if="folded(reply.id, reply.isBlockedAuthor)" class="cf__blocked">
          <p>{{ t("rework.forum.thread.blockedReply") }}</p>
          <button type="button" class="rw-btn rw-btn--sm rw-btn--ghost" @click="emit('reveal', reply.id)">{{ t("rework.forum.thread.expand") }}</button>
        </div>
        <ReworkCommunityBlocks v-else :blocks="blocksOf(reply)" :viewer-label="viewerLabel" :fallback-alt="t('rework.forum.thread.reply')" @open="(url, event) => emit('open', url, event)" @failed="(url) => emit('failed', url)" />
        <div v-if="editingId !== reply.id" class="cf__acts">
          <button
            type="button"
            class="cf__act"
            :class="{ 'is-on': reply.viewerHasLiked }"
            :aria-pressed="reply.viewerHasLiked"
            :aria-busy="likeBusy(reply.id) || undefined"
            :disabled="likeBusy(reply.id) || likeDisabled(reply.id)"
            @click="emit('like', reply.id, $event)"
          >
            <ReworkIcon :name="reply.viewerHasLiked ? 'heartFilled' : 'heart'" /><span>{{ reply.viewerHasLiked ? t("rework.forum.thread.liked") : t("rework.forum.thread.like") }}</span><b class="num">{{ reply.likeCount }}</b>
          </button>
          <button type="button" class="cf__act" @click="emit('reply', reply.id, t('rework.forum.thread.replyToUser', { username: reply.author.username }))">
            <ReworkIcon name="reply" /><span>{{ t("rework.forum.thread.reply") }}</span>
          </button>
          <button type="button" class="cf__act cf__icon" :aria-label="t('rework.forum.tools.copyFloorLink')" :title="t('rework.forum.tools.copyFloorLink')" @click="emit('copy', reply.id)">
            <ReworkIcon name="link" />
          </button>
          <template v-if="mine(reply.author.id)">
            <button type="button" class="cf__act cf__icon" :aria-label="t('rework.forum.tools.edit')" :title="t('rework.forum.tools.edit')" :disabled="ownBusy" @click="emit('edit', reply.id)">
              <ReworkIcon name="edit" />
            </button>
            <button type="button" class="cf__act cf__icon is-danger" :aria-label="t('rework.forum.tools.delete')" :title="t('rework.forum.tools.delete')" :disabled="ownBusy" @click="emit('remove', reply.id, false)">
              <ReworkIcon name="trash" />
            </button>
          </template>
        </div>
      </li>
    </ol>
  </li>
</template>

<style scoped>
.cf {
  list-style: none;
  padding: var(--sp-2) var(--sp-4) var(--sp-1);
  border: 1px solid var(--line);
  border-radius: var(--r-panel);
  background: var(--surface);
  font-family: var(--font-ui);
  color: var(--ink);
}
.cf.is-continued {
  padding-top: 0;
}
.cf__post,
.cf__reply {
  scroll-margin-top: 88px;
  scroll-margin-bottom: 160px;
  border-radius: var(--r-ctl);
  transition: background-color 180ms ease;
}
.cf__post {
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-2) var(--sp-1);
  margin: 0 calc(var(--sp-2) * -1);
}
.cf__post:focus,
.cf__reply:focus {
  outline: none;
}
.cf__post:focus-visible,
.cf__reply:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.is-targeted {
  background: var(--row-sel-bg);
}
.cf__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  min-width: 0;
}
.cf__time {
  font-size: var(--fs-12);
  color: var(--ink-3);
  white-space: nowrap;
}
.cf__no {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 var(--sp-2);
  border-radius: var(--tag-radius);
  background: var(--bg-sunk);
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.cf__body {
  padding-left: 40px;
}
.cf__blocked {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2) var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-ctl);
  background: var(--bg-sunk);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.cf__post > .cf__blocked {
  margin-left: 40px;
}
.cf__blocked p {
  margin: 0;
}
.cf__acts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
  margin-left: 32px;
}
.cf__act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--hit);
  padding: 0 var(--sp-2);
  border: 0;
  border-radius: var(--r-ctl);
  background: transparent;
  color: var(--ink-2);
  font: inherit;
  font-size: var(--fs-12);
  font-weight: 600;
  cursor: pointer;
}
.cf__icon {
  justify-content: center;
  min-width: var(--hit);
  padding: 0;
}
.cf__act :deep(svg) {
  width: 16px;
  height: 16px;
}
.cf__act:hover {
  background: var(--bg-sunk);
  color: var(--ink);
}
.cf__act:active {
  background: var(--selected-bg);
}
.cf__act:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.cf__act.is-on {
  color: var(--selected-ink);
}
.cf__act.is-danger:hover {
  color: var(--danger);
  background: var(--danger-wash);
}
.cf__act:disabled {
  cursor: default;
  opacity: 0.6;
}
.cf__act[aria-busy="true"] {
  cursor: progress;
}
.cf__cont {
  padding: var(--sp-3) 0 0 40px;
  font-size: var(--fs-12);
  color: var(--ink-3);
}
.cf__replies {
  display: grid;
  gap: 0;
  margin: 0 0 var(--sp-3) 40px;
  padding: 0 0 0 var(--sp-3);
  border-left: 2px solid var(--line-strong);
}
.cf__reply {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3) var(--sp-2) 0;
}
.cf__reply + .cf__reply {
  border-top: 1px solid var(--line);
}
.cf__reply .cf__acts {
  margin: calc(var(--sp-1) * -1) 0 0 calc(var(--sp-2) * -1);
}
.cf__reply :deep(.cb) {
  gap: var(--sp-2);
  line-height: 1.7;
}
.cf__target {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--link);
}
@media (max-width: 767px) {
  .cf {
    padding-inline: var(--sp-3);
  }
  .cf__body,
  .cf__post > .cf__blocked {
    padding-left: 0;
    margin-left: 0;
  }
  .cf__acts {
    margin-left: calc(var(--sp-2) * -1);
  }
  .cf__replies {
    margin-left: var(--sp-2);
  }
  .cf__cont {
    padding-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cf__post,
  .cf__reply {
    transition: none;
  }
}
</style>
