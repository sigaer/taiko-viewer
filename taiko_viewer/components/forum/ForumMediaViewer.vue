<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  index: number;
  items: Array<{ url: string; alt: string }>;
  trigger: HTMLElement | null;
  label: string;
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  "update:index": [value: number];
}>();

const viewerElement = ref<HTMLDivElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const preservedScrollY = ref(0);
let bodyOverflow = "";
let bodyLocked = false;

const currentImage = computed(() => props.items[props.index] || null);

const close = () => emit("update:visible", false);

const changeImage = (offset: number) => {
  if (props.items.length < 2) return;
  emit("update:index", (props.index + offset + props.items.length) % props.items.length);
};

const restorePage = async () => {
  if (!import.meta.client || !bodyLocked) return;
  document.body.style.overflow = bodyOverflow;
  bodyLocked = false;
  await nextTick();
  requestAnimationFrame(() => {
    window.scrollTo({ top: preservedScrollY.value, behavior: "auto" });
    props.trigger?.focus({ preventScroll: true });
  });
};

watch(() => props.visible, async (visible) => {
  if (!import.meta.client) return;
  if (!visible) {
    await restorePage();
    return;
  }
  preservedScrollY.value = window.scrollY;
  bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  bodyLocked = true;
  await nextTick();
  closeButton.value?.focus({ preventScroll: true });
});

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.visible) return;
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    changeImage(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    changeImage(1);
  } else if (event.key === "Tab") {
    const focusable = Array.from(viewerElement.value?.querySelectorAll<HTMLElement>("button:not([disabled])") || []);
    if (!focusable.length) return;
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex]?.focus();
  }
};

onMounted(() => window.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  if (import.meta.client && bodyLocked) document.body.style.overflow = bodyOverflow;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && currentImage"
      ref="viewerElement"
      class="forum-media-viewer"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      @click.self="close"
    >
      <button
        ref="closeButton"
        type="button"
        class="forum-media-viewer__close"
        :aria-label="closeLabel"
        @click="close"
      >
        <span aria-hidden="true">×</span>
      </button>
      <button
        v-if="items.length > 1"
        type="button"
        class="forum-media-viewer__nav forum-media-viewer__nav--previous"
        :aria-label="previousLabel"
        @click="changeImage(-1)"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <figure class="forum-media-viewer__figure">
        <img :src="currentImage.url" :alt="currentImage.alt" />
        <figcaption v-if="items.length > 1">{{ index + 1 }} / {{ items.length }}</figcaption>
      </figure>
      <button
        v-if="items.length > 1"
        type="button"
        class="forum-media-viewer__nav forum-media-viewer__nav--next"
        :aria-label="nextLabel"
        @click="changeImage(1)"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.forum-media-viewer {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
  background: rgba(14, 10, 8, 0.9);
}

.forum-media-viewer__figure {
  display: grid;
  place-items: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 42px 0 12px;
  overflow: auto;
  overscroll-behavior: contain;
}

.forum-media-viewer__figure img {
  display: block;
  width: auto;
  max-width: min(94vw, 1200px);
  height: auto;
  max-height: none;
  margin: auto;
  border-radius: 12px;
  touch-action: pinch-zoom;
}

.forum-media-viewer__figure figcaption { color: #f7eee7; font-size: 13px; }

.forum-media-viewer__close,
.forum-media-viewer__nav {
  position: absolute;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 50%;
  color: #fff;
  background: rgba(25, 19, 15, 0.72);
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}

.forum-media-viewer__close:hover,
.forum-media-viewer__close:focus-visible,
.forum-media-viewer__nav:hover,
.forum-media-viewer__nav:focus-visible {
  border-color: rgba(255, 255, 255, 0.62);
  background: rgba(75, 54, 42, 0.92);
  outline: none;
}

.forum-media-viewer__close {
  top: max(18px, env(safe-area-inset-top));
  right: max(18px, env(safe-area-inset-right));
}

.forum-media-viewer__close span { font-size: 32px; font-weight: 300; line-height: 1; }

.forum-media-viewer__nav {
  top: 50%;
  transform: translateY(-50%);
  font-size: 38px;
  font-weight: 300;
  line-height: 1;
}

.forum-media-viewer__nav--previous { left: max(18px, env(safe-area-inset-left)); }
.forum-media-viewer__nav--next { right: max(18px, env(safe-area-inset-right)); }

@media (prefers-reduced-motion: reduce) {
  .forum-media-viewer__close,
  .forum-media-viewer__nav { transition: none; }
}
</style>
