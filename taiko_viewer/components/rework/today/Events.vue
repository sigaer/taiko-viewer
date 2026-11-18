<script setup lang="ts">
// Current events of the home page (was components/home/HomeCurrentEvents.vue): two operator banners (static files,
// unchanged loading attributes) and the Bilibili feed, created only when the section comes near the viewport
// (IntersectionObserver, 220 px) and removed when the feed reports it is unavailable — as before.
defineProps<{ events: Array<{ image: string; title: string }> }>();

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
  <div ref="sectionRef" class="te guest-events">
    <ReworkPanel plain :title="t('page.home.guest.currentEvents')">
      <ul class="te-list">
        <li v-for="event in events.slice(0, 2)" :key="event.image" class="te-card">
          <img :src="event.image" :alt="event.title" width="800" height="239" loading="lazy" decoding="async" />
          <h3 class="te-name">{{ event.title }}</h3>
        </li>
      </ul>
    </ReworkPanel>
    <div v-if="dynamicsAvailable" class="te-feed">
      <LazyReworkTodayFeed v-if="showDynamics" :limit="1" @unavailable="dynamicsAvailable = false" />
      <ReworkState v-else kind="loading" :lines="3" compact />
    </div>
  </div>
</template>

<style scoped>
.te {
  display: grid;
  gap: var(--sp-5);
  min-width: 0;
}
.te-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.te-card {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.te-card img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 800 / 239;
  border-radius: var(--r-panel);
  background: var(--bg-sunk);
  object-fit: cover;
}
.te-name {
  margin: 0;
  color: var(--ink);
  font-size: var(--fs-14);
  font-weight: 600;
  line-height: var(--lh-snug);
}
@media (max-width: 767px) {
  .te-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
