<script setup lang="ts">
import type { ForumThreadCard } from "~/types/forum";
import { resolveForumSectionTranslation } from "~/utils/forum";

const props = defineProps<{
  thread: ForumThreadCard;
  compact?: boolean;
}>();

const { t, locale } = useI18n();
const router = useRouter();
const localePath = useLocalePath();

const threadPath = computed(() => localePath(`/forum/thread/${props.thread.id}`));

const threadTypeLabelMap: Record<ForumThreadCard["threadType"], string> = {
  discussion: t("forum.types.discussion"),
  guide: t("forum.types.guide"),
  achievement: t("forum.types.achievement"),
  official: t("forum.types.official")
};

const statList = computed(() => [
  { label: t("forum.stats.reply"), value: props.thread.replyCount },
  { label: t("forum.stats.like"), value: props.thread.likeCount },
  { label: t("forum.stats.view"), value: props.thread.viewCount }
]);

const localizedSectionName = computed(
  () => resolveForumSectionTranslation(t, props.thread.section.slug, props.thread.section.name)
);
const localizedDifficultyLabel = computed(() =>
  props.thread.song?.difficultyType ? t(`difficulty.${props.thread.song.difficultyType}`) : t("difficulty.unknown")
);
const localizedSongTitle = computed(() => {
  if (!props.thread.song) return "";
  return locale.value === "ja" && props.thread.song.titleJp ? props.thread.song.titleJp : props.thread.song.title;
});

const isInteractiveTarget = (target: EventTarget | null, currentTarget: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  const interactiveTarget = target.closest("a, button, input, textarea, select, [role='button'], [role='link']");
  return Boolean(interactiveTarget && interactiveTarget !== currentTarget);
};

const openThread = () => {
  void router.push(threadPath.value);
};

const handleCardClick = (event: MouseEvent) => {
  if (isInteractiveTarget(event.target, event.currentTarget)) return;
  openThread();
};

const handleCardKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Enter" || isInteractiveTarget(event.target, event.currentTarget)) return;
  event.preventDefault();
  openThread();
};
</script>

<template>
  <article
    class="forum-thread-card"
    :class="{ compact, 'has-cover': thread.coverImageUrl }"
    role="link"
    tabindex="0"
    :aria-label="thread.title"
    @click="handleCardClick"
    @keydown="handleCardKeydown"
  >
    <div class="forum-thread-card__main">
      <div class="forum-thread-card__badges">
        <NuxtLink
          :to="localePath(`/forum/section/${thread.section.slug}`)"
          class="section-pill"
          :style="{ '--accent': thread.section.accentColor }"
        >
          {{ localizedSectionName }}
        </NuxtLink>
        <span class="type-pill" :class="`type-${thread.threadType}`">{{
          threadTypeLabelMap[thread.threadType]
        }}</span>
        <span v-if="thread.isPinned" class="state-pill">{{ t("forum.states.pinned") }}</span>
        <span v-if="thread.isFeatured" class="state-pill state-pill--gold">{{ t("forum.states.featured") }}</span>
        <span v-if="thread.isLocked" class="state-pill state-pill--muted">{{ t("forum.states.locked") }}</span>
      </div>
      <NuxtLink
        :to="threadPath"
        class="forum-thread-card__title"
      >
        {{ thread.title }}
      </NuxtLink>
      <p class="forum-thread-card__summary">{{ thread.summary }}</p>

      <div v-if="thread.tags.length" class="forum-thread-card__tags">
        <span v-for="tag in thread.tags" :key="tag">#{{ tag }}</span>
      </div>

      <NuxtLink v-if="thread.song" class="forum-thread-card__song"
        :to="localePath({ path: `/songs/${thread.song.id}`, query: thread.song.difficultyType ? { difficulty: String(thread.song.difficultyType) } : {} })">
        <SongCoverImage
          class="forum-thread-card__song-cover"
          :song-id="thread.song.id"
          :alt="localizedSongTitle"
          sizes="(min-width: 901px) 60px, 56px"
          fit="cover"
        />
        <div class="forum-thread-card__song-meta">
          <strong>{{ localizedSongTitle }}</strong>
          <span
            >{{ localizedDifficultyLabel }} ·
            {{ thread.song.level || "?" }}{{ t("guide.starSuffix", "星") }}</span
          >
        </div>
      </NuxtLink>

      <div class="forum-thread-card__footer">
        <ForumUserBadge :user="thread.author" compact minimal />
        <div class="forum-thread-card__stats">
          <span v-for="item in statList" :key="item.label"
            >{{ item.label }} {{ item.value }}</span
          >
        </div>
      </div>
    </div>

    <NuxtLink
      v-if="thread.coverImageUrl"
      :to="threadPath"
      class="forum-thread-card__cover"
    >
      <ForumSafeImage :src="thread.coverImageUrl" :alt="thread.title" />
    </NuxtLink>
  </article>
</template>

<style scoped>
.forum-thread-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 18px;
  padding: 20px;
  border-radius: 24px;
  background:var(--viewer-surface-subtle);
  border: 1px solid var(--viewer-border);
  box-shadow:0 18px 28px var(--viewer-shadow);
  cursor: pointer;
  -webkit-tap-highlight-color:transparent;
  transition: background-color 140ms ease, border-color 140ms ease, opacity 140ms ease;
}

.forum-thread-card:hover {
  background:color-mix(in srgb, var(--viewer-surface) 92%, var(--viewer-accent) 8%);
}

.forum-thread-card:active {
  background:color-mix(in srgb, var(--viewer-surface) 86%, var(--viewer-accent) 14%);
}

.forum-thread-card:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--viewer-accent) 56%, transparent);
  outline-offset: 3px;
}

.forum-thread-card.compact {
  grid-template-columns: minmax(0, 1fr);
  padding: 18px 8px;
  border: 0;
  border-bottom: 1px solid var(--viewer-border);
  border-radius: 0;
  background:transparent;
  box-shadow:none;
}

.forum-thread-card.compact:hover {
  background:color-mix(in srgb, var(--viewer-surface) 90%, var(--viewer-accent) 10%);
}

.forum-thread-card.compact:active {
  background:color-mix(in srgb, var(--viewer-surface) 84%, var(--viewer-accent) 16%);
}

.forum-thread-card.compact .forum-thread-card__main { gap: 10px; }
.forum-thread-card.compact .forum-thread-card__footer { flex-wrap: wrap; }
.forum-thread-card.compact .forum-thread-card__badges { order: -1; }
.forum-thread-card.compact .forum-thread-card__title { font-size: 18px; }
.forum-thread-card.compact .forum-thread-card__summary { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.5; font-size: 13px; }
.forum-thread-card.compact .forum-thread-card__badges { gap: 6px; }
.forum-thread-card.compact .section-pill,
.forum-thread-card.compact .type-pill,
.forum-thread-card.compact .state-pill { padding: 3px 8px; font-size: 12px; }
.forum-thread-card.compact .forum-thread-card__cover { min-height: 0; height: 100px; align-self: start; border-radius: 12px; }

.forum-thread-card__main {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.forum-thread-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.section-pill,
.type-pill,
.state-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  text-decoration: none;
}

.section-pill {
  color:var(--accent);
  background:color-mix(in srgb, var(--accent) 18%, var(--viewer-surface));
}

.type-pill {
  color:var(--viewer-on-primary);
}

.type-discussion {
  background:linear-gradient(135deg, var(--viewer-primary), var(--viewer-primary-hover));
}

.type-guide {
  background:linear-gradient(135deg, var(--viewer-primary), var(--viewer-primary-hover));
}

.type-achievement {
  background:linear-gradient(135deg, var(--viewer-warning), var(--viewer-warning));
}

.type-official {
  background:linear-gradient(135deg, var(--viewer-info), var(--viewer-info));
}

.state-pill {
  color:var(--viewer-warning);
  background:var(--viewer-surface-subtle);
}

.state-pill--gold {
  background:linear-gradient(135deg, var(--viewer-warning-surface), var(--viewer-warning-surface));
}

.state-pill--muted {
  color:var(--viewer-text-muted);
  background:var(--viewer-surface-subtle);
}

.forum-thread-card__title {
  font-size: 24px;
  line-height: 1.24;
  color:var(--viewer-text);
  text-decoration: none;
}

.forum-thread-card__summary {
  margin: 0;
  color:var(--viewer-text-muted);
  line-height: 1.8;
}

.forum-thread-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color:var(--viewer-primary);
  font-size: 12px;
}

.forum-thread-card__song {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: center;
  padding: 4px 0;
  color: var(--viewer-text);
  text-decoration: none;
}

.forum-thread-card__song .forum-thread-card__song-cover {
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  border-radius: 8px;
  overflow: hidden;
}

.forum-thread-card__song-meta {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.forum-thread-card__song strong {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.4;
}

.forum-thread-card__song span,
.forum-thread-card__stats {
  color:var(--viewer-text-muted);
  font-size: 12px;
}

.forum-thread-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.forum-thread-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.forum-thread-card__cover {
  display: block;
  min-height: 160px;
  border-radius: 22px;
  overflow: hidden;
  box-shadow:inset 0 0 0 1px var(--viewer-shadow);
}

.forum-thread-card__cover img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

body.theme-dark .forum-thread-card {
  background:var(--viewer-surface-subtle);
  border-color:var(--viewer-border);
}

body.theme-dark .forum-thread-card.compact {
  background:transparent;
  border-color:var(--viewer-border);
}

body.theme-dark .forum-thread-card:hover {
  background:color-mix(in srgb, var(--viewer-surface) 88%, var(--viewer-accent) 12%);
}

body.theme-dark .forum-thread-card:active {
  background:color-mix(in srgb, var(--viewer-surface) 80%, var(--viewer-accent) 20%);
}

body.theme-dark .forum-thread-card.compact:hover {
  background:color-mix(in srgb, var(--viewer-surface) 88%, var(--viewer-accent) 12%);
}

body.theme-dark .forum-thread-card.compact:active {
  background:color-mix(in srgb, var(--viewer-surface) 80%, var(--viewer-accent) 20%);
}

body.theme-dark .forum-thread-card__title {
  color:var(--viewer-text);
}

body.theme-dark .forum-thread-card__summary,
body.theme-dark .forum-thread-card__song span,
body.theme-dark .forum-thread-card__stats {
  color:var(--viewer-text-muted);
}

@media (max-width: 900px) {
  .forum-thread-card {
    grid-template-columns: 1fr;
  }

  .forum-thread-card__title {
    font-size: 21px;
  }

  .forum-thread-card.compact { grid-template-columns: minmax(0, 1fr); }
  .forum-thread-card.compact .forum-thread-card__title { font-size: 17px; }

  .forum-thread-card__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (min-width:901px) {
  .forum-thread-card.has-cover { grid-template-columns:minmax(0, 1fr) 180px; }
  .forum-thread-card__song .forum-thread-card__song-cover { width:60px; height:60px; flex-basis:60px; }
}
.forum-thread-card.compact.has-cover { grid-template-columns:minmax(0, 1fr) 128px; }
.forum-thread-card__title, .forum-thread-card__summary, .forum-thread-card__tags, .forum-thread-card__song { overflow-wrap:anywhere; }
.forum-thread-card__stats span { white-space:nowrap; }
@media (max-width:600px) {
  .forum-thread-card.has-cover, .forum-thread-card.compact.has-cover { grid-template-columns:minmax(0, 1fr); }
  .forum-thread-card.compact .forum-thread-card__cover { width:128px; height:88px; }
  .forum-thread-card.compact .forum-thread-card__stats { justify-content:flex-start; }
}
</style>
