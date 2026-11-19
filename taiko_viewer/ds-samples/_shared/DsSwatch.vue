<script setup lang="ts">
// A colour swatch for one token. The resolved value is read after mount (sample page only).
const props = defineProps<{ token: string; on?: string }>();
const el = ref<HTMLElement | null>(null);
const value = ref("");
const read = () => {
  if (el.value) value.value = getComputedStyle(el.value).getPropertyValue(props.token).trim();
};
onMounted(read);
onActivated(read);
const { theme } = useViewerTheme();
watch(theme, () => nextTick(read));
</script>

<template>
  <figure ref="el" class="ds-swatch" :data-token="token">
    <span class="ds-swatch__chip" :style="{ background: `var(${token})`, borderColor: on ? `var(${on})` : undefined }" />
    <figcaption>
      <code>{{ token }}</code>
      <span class="ds-swatch__value">{{ value }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.ds-swatch {
  margin: 0;
  width: 168px;
  font-size: var(--fs-12);
  color: var(--ink-2);
}
.ds-swatch__chip {
  display: block;
  height: 48px;
  border-radius: var(--r-ctl);
  border: 1px solid var(--line);
  margin-bottom: var(--sp-1);
}
.ds-swatch code {
  display: block;
  color: var(--ink);
  font-size: var(--fs-12);
  overflow-wrap: anywhere;
}
.ds-swatch__value {
  font-family: var(--font-num);
  color: var(--ink-3);
}
</style>
