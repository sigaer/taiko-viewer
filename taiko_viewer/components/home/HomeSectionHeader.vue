<script setup lang="ts">
defineProps<{
  title: string;
  headingId?: string;
  description?: string;
  linkLabel?: string;
  linkTo?: string;
}>();
</script>

<template>
  <header class="home-section-head">
    <div>
      <h2 :id="headingId">{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>
    <NuxtLink v-if="linkLabel && linkTo" :to="linkTo" class="home-section-head__link">
      {{ linkLabel }}
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    </NuxtLink>
  </header>
</template>

<style scoped>
.home-section-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.home-section-head h2 {
  margin: 0;
  color: var(--viewer-text);
  font-size: clamp(21px, 2.4vw, 28px);
  line-height: 1.2;
}

.home-section-head p {
  margin: 6px 0 0;
  color: var(--viewer-text-muted);
  font-size: 13px;
  line-height: 1.55;
}

.home-section-head__link {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #85583d;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.home-section-head__link svg {
  width: 18px;
  height: 18px;
}

.home-section-head__link:focus-visible {
  outline: 3px solid #a85f3e;
  outline-offset: 3px;
  border-radius: 6px;
}
</style>
