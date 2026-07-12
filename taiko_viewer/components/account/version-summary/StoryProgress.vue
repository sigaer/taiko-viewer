<script setup lang="ts">
import { computed } from "vue";
import type { AnnualChapterKey } from "~/composables/useAnnualPages";

const props = defineProps<{
  items: Array<{ key: string; label: string; chapter: AnnualChapterKey; chapterLabel: string }>;
  activeIndex: number;
  ariaLabel?: string;
}>();

const emit = defineEmits<{ select: [index: number] }>();
const chapters = computed(() => {
  const result: Array<{ key: AnnualChapterKey; label: string; firstIndex: number; active: boolean; complete: boolean }> = [];
  props.items.forEach((item, index) => {
    if (!result.some((entry) => entry.key === item.chapter)) {
      result.push({ key: item.chapter, label: item.chapterLabel, firstIndex: index, active: false, complete: false });
    }
  });
  const current = props.items[props.activeIndex]?.chapter;
  const currentChapterIndex = result.findIndex((chapter) => chapter.key === current);
  return result.map((chapter, index) => ({ ...chapter, active: index === currentChapterIndex, complete: index < currentChapterIndex }));
});
</script>

<template>
  <nav class="story-progress" :aria-label="props.ariaLabel || 'Story progress'">
    <div class="story-progress__chapters">
      <button
        v-for="chapter in chapters"
        :key="chapter.key"
        type="button"
        :class="{ 'is-active': chapter.active, 'is-complete': chapter.complete }"
        :aria-current="chapter.active ? 'step' : undefined"
        @click="emit('select', chapter.firstIndex)"
      >
        <i aria-hidden="true"></i><span>{{ chapter.label }}</span>
      </button>
    </div>
    <p class="story-progress__page" aria-live="polite">
      <strong>{{ String(activeIndex + 1).padStart(2, "0") }}</strong>
      <span>/ {{ String(items.length).padStart(2, "0") }}</span>
      <small>{{ items[activeIndex]?.label }}</small>
    </p>
  </nav>
</template>

<style scoped>
.story-progress {
  position: fixed;
  left: clamp(14px, 3vw, 34px);
  right: clamp(148px, 18vw, 230px);
  top: max(18px, env(safe-area-inset-top));
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 20px;
  color: #17365d;
}
.story-progress__chapters { min-width: 0; flex: 1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
.story-progress__chapters button { appearance:none; min-width:0; border:0; padding:5px 0; color:#6b83a0; background:transparent; cursor:pointer; text-align:left; }
.story-progress__chapters i { display:block; height:4px; border-radius:99px; background:rgba(57,120,200,.16); overflow:hidden; }
.story-progress__chapters button.is-complete i,.story-progress__chapters button.is-active i { background:#3978c8; }
.story-progress__chapters button.is-active i { background:linear-gradient(90deg,#3978c8,#17365d); }
.story-progress__chapters span { display:block; margin-top:5px; font-size:11px; font-weight:700; letter-spacing:.08em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.story-progress__chapters button.is-active span { color:#17365d; }
.story-progress__page { flex:0 0 auto; display:flex; align-items:baseline; gap:5px; margin:0; }
.story-progress__page strong { color:#17365d; font:700 22px/1 var(--viewer-display-font); }
.story-progress__page span { color:#7890ab; font-size:11px; }
.story-progress__page small { max-width:84px; margin-left:5px; color:#3978c8; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
button:focus-visible { outline:2px solid #3978c8; outline-offset:3px; border-radius:5px; }
@media(max-width:720px){
  .story-progress{left:12px;right:104px;top:max(10px,env(safe-area-inset-top));gap:9px}
  .story-progress__chapters{gap:4px}.story-progress__chapters span{display:none}.story-progress__chapters i{height:3px}
  .story-progress__page strong{font-size:17px}.story-progress__page small{display:none}
}
</style>
