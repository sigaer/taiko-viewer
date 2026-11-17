<script setup lang="ts">
// DsSiteTitle — site title tag (04 §7.7 site title, P0-22; production AccountTitle).
// A neutral small tag with a 3px --site-title-bar stripe on the left; never a plate. Next to a game title plate it
// wraps to the next line when the row is too narrow (the parent row uses flex-wrap).
import { computed, type PropType } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  /** AccountTitle.name; empty → nothing is rendered */
  name: { type: String as PropType<string | null>, default: null }
});

const { t } = useI18n();
const text = computed(() => (typeof props.name === "string" ? props.name.trim() : ""));
</script>

<template>
  <span v-if="text" class="ds-site-title" :title="t('ds.siteTitle.kind')">{{ text }}</span>
</template>

<style scoped>
.ds-site-title {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: none;
  max-width: 100%;
  height: var(--tag-h);
  padding: 0 7px 0 9px;
  overflow: hidden;
  border-radius: var(--tag-radius);
  background: var(--bg-sunk);
  color: var(--ink-2);
  font-size: var(--fs-12);
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
}
.ds-site-title::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--site-title-bar);
}
</style>
