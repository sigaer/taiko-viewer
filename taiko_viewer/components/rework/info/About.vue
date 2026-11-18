<script setup lang="ts">
// ReworkInfoAbout — /about (slice F). Content, credits and the link as before, word for word; restyled only.
import type { PropType } from "vue";

defineProps({
  team: { type: Array as PropType<{ name: string; role: string; avatar: string }[]>, required: true },
  stacks: { type: Array as PropType<string[]>, required: true }
});
const { t } = useI18n();
</script>

<template>
  <div class="ab">
    <ReworkPanel :title="t('rework.aboutPage.teamTitle')">
      <p class="ab-desc">{{ t("rework.aboutPage.teamDesc") }}</p>
      <ul class="ab-team">
        <li v-for="member in team" :key="member.name" class="ab-member">
          <img class="ab-avatar" :src="member.avatar" :alt="member.name" width="44" height="44" loading="lazy" decoding="async" />
          <div class="ab-member__text">
            <span class="ab-name">{{ member.name }}</span>
            <span class="ab-role">{{ member.role }}</span>
          </div>
        </li>
      </ul>
    </ReworkPanel>
    <ReworkPanel :title="t('rework.aboutPage.stackTitle')">
      <p class="ab-desc">{{ t("rework.aboutPage.stackDesc") }}</p>
      <ul class="ab-stack">
        <li v-for="stack in stacks" :key="stack" class="rw-tag">{{ stack }}</li>
      </ul>
    </ReworkPanel>
    <ReworkPanel :title="t('rework.aboutPage.linksTitle')">
      <a class="rw-link ab-link" href="https://www.ourtaiko.org/" target="_blank" rel="noopener noreferrer">Ourtaiko<ReworkIcon name="open" class="ab-open" /></a>
    </ReworkPanel>
  </div>
</template>

<style scoped>
.ab {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
  font-family: var(--font-ui);
  color: var(--ink);
}
.ab-desc {
  margin: calc(var(--sp-2) * -1) 0 var(--sp-4);
  font-size: var(--fs-14);
  color: var(--ink-2);
}
.ab-team {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--sp-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ab-member {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  padding: var(--sp-3);
  border: 1px solid var(--line);
  border-radius: var(--r-ctl);
}
.ab-avatar {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--bg-sunk);
}
.ab-member__text {
  display: grid;
  min-width: 0;
}
.ab-name {
  font-size: var(--fs-16);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.ab-role {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.ab-stack {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.ab-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--hit);
  font-size: var(--fs-16);
}
.ab-open {
  width: 16px;
  height: 16px;
  margin-left: 4px;
}
</style>
