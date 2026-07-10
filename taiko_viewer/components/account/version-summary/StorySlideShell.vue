<script setup lang="ts">
import { gsap } from "gsap";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    pageIndex: number;
    pageTotal: number;
    eyebrow: string;
    title: string;
    lead?: string;
    accent?: string;
    tone?: "ember" | "sunrise" | "aurora" | "royal" | "gold";
    active?: boolean;
    reducedMotion?: boolean;
  }>(),
  {
    lead: "",
    accent: "",
    tone: "ember",
    active: false,
    reducedMotion: false
  }
);

const rootRef = ref<HTMLElement | null>(null);
let tween: gsap.core.Timeline | null = null;

const playReveal = async () => {
  if (!rootRef.value || props.reducedMotion) return;
  await nextTick();
  const targets = rootRef.value.querySelectorAll<HTMLElement>("[data-animate]");
  tween?.kill();
  gsap.set(targets, { clearProps: "all" });
  tween = gsap.timeline();
  tween.fromTo(
    targets,
    {
      y: 36,
      opacity: 0,
      filter: "blur(12px)"
    },
    {
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      duration: 0.86,
      stagger: 0.08,
      ease: "power3.out"
    }
  );
};

watch(
  () => props.active,
  (active) => {
    if (active) {
      playReveal();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  tween?.kill();
});
</script>

<template>
  <section ref="rootRef" class="story-slide-shell" :class="[`tone-${tone}`, { 'is-active': active }]">
    <div class="story-slide-shell__backdrop">
      <span class="orb orb--primary"></span>
      <span class="orb orb--secondary"></span>
      <span class="arc arc--left"></span>
      <span class="arc arc--right"></span>
    </div>

    <div class="story-slide-shell__frame">
      <div class="story-slide-shell__meta" data-animate>
        <span>{{ String(pageIndex + 1).padStart(2, "0") }}</span>
        <i></i>
        <small>{{ String(pageTotal).padStart(2, "0") }}</small>
      </div>

      <div class="story-slide-shell__header">
        <p class="story-slide-shell__eyebrow" data-animate>{{ eyebrow }}</p>
        <h2 class="story-slide-shell__title" data-animate>{{ title }}</h2>
        <p v-if="lead" class="story-slide-shell__lead" data-animate>{{ lead }}</p>
        <div v-if="accent" class="story-slide-shell__accent" data-animate>{{ accent }}</div>
      </div>

      <div class="story-slide-shell__body">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.story-slide-shell {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  padding: 7.4rem 2rem 2.2rem;
  scroll-snap-align: start;
  overflow: hidden;
}

.story-slide-shell__backdrop,
.story-slide-shell__frame {
  position: relative;
  z-index: 1;
}

.story-slide-shell__backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.orb,
.arc {
  position: absolute;
  display: block;
}

.orb {
  border-radius: 50%;
  filter: blur(18px);
}

.orb--primary {
  width: 28rem;
  height: 28rem;
  left: -8rem;
  top: 8rem;
}

.orb--secondary {
  width: 20rem;
  height: 20rem;
  right: -5rem;
  bottom: 8rem;
}

.arc {
  border-radius: 999px;
  opacity: 0.82;
}

.arc--left {
  width: 22rem;
  height: 22rem;
  left: -9rem;
  bottom: -8rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.arc--right {
  width: 30rem;
  height: 30rem;
  right: -11rem;
  top: -9rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.story-slide-shell__frame {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 1.8rem;
  min-height: calc(100svh - 9.6rem);
  width: min(1180px, 100%);
  margin: 0 auto;
}

.story-slide-shell__meta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(12, 22, 52, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  box-shadow: 0 18px 44px rgba(4, 10, 28, 0.24);
}

.story-slide-shell__meta span,
.story-slide-shell__meta small {
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 243, 224, 0.84);
}

.story-slide-shell__meta i {
  width: 2.4rem;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.08), rgba(255, 205, 135, 0.72));
}

.story-slide-shell__header {
  display: grid;
  gap: 0.85rem;
  max-width: 52rem;
}

.story-slide-shell__eyebrow {
  margin: 0;
  color: rgba(255, 214, 166, 0.88);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
}

.story-slide-shell__title {
  margin: 0;
  color: #fff7eb;
  font-family: var(--viewer-display-font);
  font-size: clamp(2.7rem, 6vw, 5.8rem);
  line-height: 1.02;
  letter-spacing: 0.02em;
  text-wrap: balance;
  text-shadow: 0 16px 40px rgba(7, 11, 24, 0.34);
}

.story-slide-shell__lead {
  margin: 0;
  color: rgba(255, 237, 214, 0.88);
  font-size: clamp(1rem, 1.3vw, 1.12rem);
  line-height: 1.9;
  max-width: 44rem;
}

.story-slide-shell__accent {
  width: fit-content;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 244, 227, 0.88);
  font-size: 13px;
}

.story-slide-shell__body {
  display: grid;
  align-items: end;
}

.tone-ember {
  background:
    radial-gradient(circle at top left, rgba(255, 105, 66, 0.26), transparent 34%),
    linear-gradient(160deg, #09162f 0%, #101935 34%, #1e1024 100%);
}

.tone-sunrise {
  background:
    radial-gradient(circle at top right, rgba(255, 173, 87, 0.24), transparent 36%),
    linear-gradient(160deg, #0f1832 0%, #1c213d 36%, #2c1420 100%);
}

.tone-aurora {
  background:
    radial-gradient(circle at top center, rgba(255, 90, 58, 0.2), transparent 34%),
    linear-gradient(165deg, #071427 0%, #102847 48%, #0d2337 100%);
}

.tone-royal {
  background:
    radial-gradient(circle at top left, rgba(108, 176, 255, 0.18), transparent 38%),
    linear-gradient(165deg, #091226 0%, #0f1f3c 46%, #1d0f29 100%);
}

.tone-gold {
  background:
    radial-gradient(circle at top right, rgba(255, 191, 84, 0.22), transparent 34%),
    linear-gradient(165deg, #10172f 0%, #1d1530 42%, #2d1420 100%);
}

.tone-ember .orb--primary {
  background: radial-gradient(circle, rgba(255, 94, 65, 0.46), rgba(255, 94, 65, 0));
}

.tone-ember .orb--secondary {
  background: radial-gradient(circle, rgba(255, 180, 92, 0.3), rgba(255, 180, 92, 0));
}

.tone-sunrise .orb--primary,
.tone-gold .orb--secondary {
  background: radial-gradient(circle, rgba(255, 196, 109, 0.36), rgba(255, 196, 109, 0));
}

.tone-sunrise .orb--secondary,
.tone-gold .orb--primary {
  background: radial-gradient(circle, rgba(255, 108, 77, 0.26), rgba(255, 108, 77, 0));
}

.tone-aurora .orb--primary {
  background: radial-gradient(circle, rgba(91, 186, 255, 0.28), rgba(91, 186, 255, 0));
}

.tone-aurora .orb--secondary {
  background: radial-gradient(circle, rgba(255, 138, 78, 0.26), rgba(255, 138, 78, 0));
}

.tone-royal .orb--primary {
  background: radial-gradient(circle, rgba(105, 149, 255, 0.3), rgba(105, 149, 255, 0));
}

.tone-royal .orb--secondary {
  background: radial-gradient(circle, rgba(255, 112, 80, 0.24), rgba(255, 112, 80, 0));
}

@media (max-width: 720px) {
  .story-slide-shell {
    padding: 6.5rem 1rem 1.4rem;
  }

  .story-slide-shell__frame {
    gap: 1.2rem;
    min-height: calc(100svh - 7.9rem);
  }

  .story-slide-shell__meta {
    padding: 9px 12px;
    gap: 10px;
  }

  .story-slide-shell__meta i {
    width: 1.7rem;
  }
}
</style>
