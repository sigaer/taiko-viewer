<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps<{
  events: Array<{ image: string; title: string }>;
}>();

const { t } = useI18n();
const sectionRef = ref<HTMLElement | null>(null);
const showDynamics = ref(false);
const dynamicsAvailable = ref(true);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (!("IntersectionObserver" in window)) {
    showDynamics.value = true;
    return;
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      showDynamics.value = true;
      observer?.disconnect();
      observer = null;
    },
    { rootMargin: "220px 0px" }
  );
  if (sectionRef.value) observer.observe(sectionRef.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <section ref="sectionRef" class="guest-events" aria-labelledby="guest-events-title">
    <HomeSectionHeader
      heading-id="guest-events-title"
      :title="t('page.home.guest.currentEvents')"
    />
    <div class="guest-events__grid">
      <article v-for="event in events.slice(0, 2)" :key="event.image" class="guest-event-card panel-card">
        <img :src="event.image" :alt="event.title" loading="lazy" decoding="async" />
        <div><h3>{{ event.title }}</h3></div>
      </article>
    </div>
    <div v-if="dynamicsAvailable" class="guest-events__dynamic panel-card">
      <LazyHomeBilibiliDynamicFeed
        v-if="showDynamics"
        :limit="1"
        @unavailable="dynamicsAvailable = false"
      />
      <div v-else class="guest-events__placeholder shimmer-card" aria-hidden="true"></div>
    </div>
  </section>
</template>

<style scoped>
.guest-events {
  display: grid;
  gap: 14px;
}

.guest-events__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.guest-event-card {
  position: relative;
  min-height: 220px;
  overflow: hidden;
  background:var(--viewer-surface);
}

.guest-event-card img {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: cover;
}

.guest-event-card div {
  position: absolute;
  inset: auto 0 0;
  padding: 42px 16px 16px;
  background:var(--viewer-surface-subtle);
}

.guest-event-card h3 {
  margin: 0;
  color:var(--viewer-text);
  font-size: clamp(16px, 2vw, 22px);
  line-height: 1.25;
}

.guest-events__dynamic {
  min-height: 180px;
  padding: 18px;
}

.guest-events__placeholder {
  min-height: 144px;
  border-radius: 14px;
}

@media (max-width: 720px) {
  .guest-events__grid {
    grid-template-columns: 1fr;
  }

  .guest-event-card {
    min-height: 180px;
  }

  .guest-events__grid .guest-event-card:nth-child(n + 2) {
    display: none;
  }
}
</style>
