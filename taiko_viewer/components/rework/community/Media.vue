<script setup lang="ts">
// ReworkCommunityMedia — a forum image (list thumbnail, thread / reply content). Loads when it comes near the
// viewport (as ForumSafeImage did); before that the box shows the surface colour, never an <img> without a source.
// A failed load is reported with `failed` and nothing else is shown in its place: the caller removes a thumbnail or
// draws its own placeholder (Blocks). There is no substitute picture (same rule as covers). Avatars are DsPlayerAvatar.
const props = defineProps({
  src: { type: String, default: "" },
  alt: { type: String, default: "" },
  priority: { type: Boolean, default: false }
});
const emit = defineEmits<{ failed: [src: string]; loaded: [src: string] }>();
const box = ref<HTMLElement | null>(null);
const img = ref<HTMLImageElement | null>(null);
const near = ref(props.priority);
const state = ref<"loading" | "loaded">("loading");
let observer: IntersectionObserver | null = null;

const fail = () => emit("failed", props.src);
const onLoad = () => {
  state.value = "loaded";
  emit("loaded", props.src);
};
watch(
  () => props.src,
  (value) => {
    state.value = "loading";
    if (!value && import.meta.client) fail();
  }
);
onMounted(() => {
  if (!props.src) return fail();
  // A server-rendered <img> may have failed before the listener existed
  if (img.value?.complete) {
    if (img.value.naturalWidth === 0) fail();
    else onLoad();
  }
  if (near.value) return;
  if (!("IntersectionObserver" in window)) {
    near.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      near.value = true;
      observer?.disconnect();
      observer = null;
    },
    { rootMargin: "180px 0px" }
  );
  if (box.value) observer.observe(box.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <span ref="box" class="cmd" :class="`is-${state}`">
    <img
      v-if="near && src"
      ref="img"
      class="cmd__img"
      :src="src"
      :alt="alt"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'low'"
      decoding="async"
      @load="onLoad"
      @error="fail"
    />
  </span>
</template>

<style scoped>
.cmd {
  display: block;
  max-width: 100%;
}
.cmd.is-loading {
  background: var(--bg-sunk);
}
.cmd__img {
  display: block;
}
</style>
