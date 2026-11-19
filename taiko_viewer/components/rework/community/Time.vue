<script setup lang="ts">
// ReworkCommunityTime — a forum timestamp as <time datetime>. The server render and hydration show one fixed text
// (UTC+8, the site's time zone) so they always agree; after mount the text follows the visitor's time zone and the
// page language. `relative` (notifications): minutes / hours / yesterday after mount, the date beyond that.
import type { PropType } from "vue";
import { forumTimeText } from "~/utils/rework/community";

const props = defineProps({
  value: { type: String as PropType<string | null>, default: null },
  mode: { type: String as PropType<"datetime" | "date" | "relative">, default: "datetime" }
});
const { t, locale } = useI18n();
const mounted = ref(false);
const now = ref(0);
onMounted(() => {
  now.value = Date.now();
  mounted.value = true;
});
const text = computed(() => {
  if (!mounted.value) return forumTimeText(props.value, props.mode === "datetime" ? "datetime" : "date", locale.value, "Asia/Shanghai");
  if (props.mode === "relative") {
    const at = new Date(props.value || "").getTime();
    if (Number.isFinite(at)) {
      const minutes = Math.max(0, Math.floor((now.value - at) / 60000));
      if (minutes < 60) return t("forum.relativeMinutes", { count: minutes });
      if (minutes < 1440) return t("forum.relativeHours", { count: Math.floor(minutes / 60) });
      if (minutes < 2880) return t("forum.relativeYesterday");
    }
  }
  return forumTimeText(props.value, props.mode === "datetime" ? "datetime" : "date", locale.value);
});
const full = computed(() => (mounted.value ? forumTimeText(props.value, "datetime", locale.value) : undefined));
</script>

<template>
  <time class="num" :datetime="value || undefined" :title="mode === 'relative' ? full : undefined">{{ text }}</time>
</template>
