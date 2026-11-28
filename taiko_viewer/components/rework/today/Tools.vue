<script setup lang="ts">
// Feature grid of the home page, built from the navigation model (utils/rework/today.ts homeFeatures): an icon tile
// and the destination page's own name, and 全部功能 (/more).
//   default (PUBLIC_FEATURE_KEYS)       what the site offers, for visitors and players without data. It replaced the
//                                       four hand-written public tools (chart config, note count, guide, grade); their
//                                       analytics event home_public_tool_click is unchanged.
//   quick                               the phone's 常用 grid of a player with data (QUICK_FEATURE_KEYS), no event.
// Four columns on phones; on wider screens as many as fit.
import type { PropType } from "vue";
import { PUBLIC_FEATURE_KEYS, QUICK_FEATURE_KEYS, homeFeatures } from "~/utils/rework/today";
import { ALL_FEATURES } from "~/utils/rework/navigation";
import { trackViewerEvent } from "~/utils/analytics";

const props = defineProps({
  keys: { type: Array as PropType<readonly string[]>, default: undefined },
  title: { type: String, default: "" },
  quick: { type: Boolean, default: false }
});
const { t } = useI18n();
const localePath = useLocalePath();
const features = computed(() => homeFeatures(props.keys || (props.quick ? QUICK_FEATURE_KEYS : PUBLIC_FEATURE_KEYS)));
const heading = computed(() => props.title || t("page.home.guest.publicTools"));
const follow = (path: string) => {
  if (!props.quick) trackViewerEvent("home_public_tool_click", { home_state: "guest", tool_path: path });
};
</script>

<template>
  <ReworkPanel class="tt" :class="quick ? 'tt--quick' : 'guest-tools'" :title="heading">
    <template #actions>
      <NuxtLink class="rw-link tt-more" :to="localePath(ALL_FEATURES.to)">{{ t(ALL_FEATURES.labelKey) }}</NuxtLink>
    </template>
    <ul class="tt-grid">
      <li v-for="feature in features" :key="feature.key">
        <NuxtLink :to="localePath(feature.to)" class="tt-tool" @click="follow(feature.to)">
          <span class="tt-icon" :data-tint="feature.tint"><ReworkIcon :name="feature.icon" /></span>
          <span class="tt-name">{{ t(feature.labelKey) }}</span>
        </NuxtLink>
      </li>
    </ul>
  </ReworkPanel>
</template>

<style scoped>
.tt-more {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-13);
  font-weight: 600;
}
.tt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tt-grid li {
  min-width: 0;
}
.tt-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  min-height: var(--hit);
  padding: var(--sp-3) var(--sp-1);
  border-radius: var(--r-ctl);
  color: var(--ink);
  text-align: center;
  text-decoration: none;
}
.tt-tool:hover {
  background: var(--bg-sunk);
}
.tt-tool:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
.tt-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--bg-sunk);
  color: var(--ink-2);
}
.tt-icon[data-tint="brand"] {
  background: var(--selected-bg);
  color: var(--selected-ink);
}
.tt-icon[data-tint="info"] {
  background: var(--info-wash);
  color: var(--info-ink);
}
.tt-name {
  max-width: 100%;
  font-size: var(--fs-13);
  font-weight: 600;
  line-height: var(--lh-snug);
  overflow-wrap: anywhere;
}
@media (max-width: 767px) {
  .tt-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sp-3) var(--sp-1);
  }
  .tt-tool {
    padding: var(--sp-1) 0;
  }
  .tt-name {
    font-size: var(--fs-12);
  }
}
</style>
