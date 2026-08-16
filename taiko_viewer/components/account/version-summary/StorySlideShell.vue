<script setup lang="ts">
import { gsap } from "gsap";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import AnnualScene from "./AnnualScene.vue";

const props = withDefaults(defineProps<{
  pageIndex: number; pageTotal: number; eyebrow: string; title: string; lead?: string; accent?: string;
  tone?: "ember" | "sunrise" | "aurora" | "royal" | "gold"; active?: boolean; reducedMotion?: boolean;
  mood?: string; intensity?: "low" | "medium" | "high";
}>(), { lead: "", accent: "", tone: "royal", active: false, reducedMotion: false });

const rootRef = ref<HTMLElement | null>(null);
let tween: gsap.core.Timeline | null = null;
const rootElement = () => (rootRef.value as unknown as { rootEl?: HTMLElement | null } | null)?.rootEl || null;
const playReveal = async () => {
  const root = rootElement();
  if (!root || props.reducedMotion) return;
  await nextTick();
  const targets = root.querySelectorAll<HTMLElement>("[data-animate]");
  tween?.kill();
  gsap.set(targets, { clearProps: "all" });
  tween = gsap.timeline().fromTo(targets, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .58, stagger: .055, ease: "power2.out" });
};
watch(() => props.active, (active) => { if (active) void playReveal(); }, { immediate: true });
onBeforeUnmount(() => tween?.kill());
</script>

<template>
  <AnnualScene ref="rootRef" class="story-slide-shell" :class="[`tone-${tone}`, { 'is-active': active }]" :active="active" :reduced-motion="reducedMotion" :mood="mood" :intensity="intensity">
    <template #background><slot name="background"><div class="story-slide-shell__backdrop"><i></i><i></i></div></slot></template>
    <template #atmosphere><slot name="atmosphere" /></template>
    <template #visual><slot name="visual" /></template>
    <template #data><slot name="data" /></template>
    <template #copy><slot name="copy" /></template>
    <div class="story-slide-shell__frame">
      <header class="story-slide-shell__header">
        <div class="story-slide-shell__heading" data-animate>
          <span class="story-slide-shell__page">{{ String(pageIndex + 1).padStart(2, "0") }} / {{ String(pageTotal).padStart(2, "0") }}</span>
          <p>{{ eyebrow }}</p><strong v-if="accent">{{ accent }}</strong>
        </div>
        <h2 data-animate>{{ title }}</h2>
        <p v-if="lead" class="story-slide-shell__lead" data-animate>{{ lead }}</p>
      </header>
      <div class="story-slide-shell__body"><slot /></div>
    </div>
  </AnnualScene>
</template>

<style scoped>
.story-slide-shell{position:relative;height:100vh;height:100svh;height:100dvh;padding:var(--story-slide-top-padding,4.7rem) clamp(12px,3vw,32px) var(--story-slide-bottom-padding,3.8rem);overflow:hidden;color:#17365d;background:linear-gradient(145deg,#f7fbff 0%,#e5f1ff 100%)}.story-slide-shell__backdrop{position:absolute;inset:0;pointer-events:none;overflow:hidden}.story-slide-shell__backdrop i{position:absolute;width:min(50vw,620px);aspect-ratio:1;border-radius:50%;border:1px solid rgba(57,120,200,.12)}.story-slide-shell__backdrop i:first-child{left:-22%;bottom:-58%}.story-slide-shell__backdrop i:last-child{right:-24%;top:-68%;box-shadow:inset 0 0 0 28px rgba(247,251,255,.28),inset 0 0 0 30px rgba(57,120,200,.08)}.tone-gold{background:linear-gradient(145deg,#f7fbff 0%,#e5f1ff 52%,#e5f1ff 100%)}.tone-ember{background:linear-gradient(145deg,#f7fbff 0%,#e5f1ff 52%,#e5f1ff 100%)}.tone-aurora{background:linear-gradient(145deg,#f7fbff 0%,#e5f1ff 58%,#f7fbff 100%)}.story-slide-shell__frame{position:relative;z-index:1;width:min(1120px,100%);height:calc(100vh - var(--story-slide-top-padding,4.7rem) - var(--story-slide-bottom-padding,3.8rem));height:calc(100dvh - var(--story-slide-top-padding,4.7rem) - var(--story-slide-bottom-padding,3.8rem));margin:auto;display:grid;grid-template-rows:auto minmax(0,1fr);gap:clamp(8px,1.8vh,18px)}.story-slide-shell__header{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(220px,.85fr);grid-template-areas:"heading lead" "title lead";gap:5px 24px;align-items:end}.story-slide-shell__heading{grid-area:heading;display:flex;align-items:center;gap:10px;min-width:0}.story-slide-shell__page{flex:0 0 auto;padding:5px 8px;border-radius:99px;color:#3978c8;background:#f7fbff;border:1px solid rgba(57,120,200,.16);font:700 10px/1 var(--viewer-font-family)}.story-slide-shell__heading p{margin:0;color:#3978c8;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.story-slide-shell__heading>strong{padding:4px 8px;border-radius:99px;color:#3978c8;background:rgba(57,120,200,.08);font-size:10px;white-space:nowrap}.story-slide-shell__header h2{grid-area:title;margin:0;color:#17365d;font:700 clamp(2rem,4.7vw,4.4rem)/1.02 var(--viewer-display-font);text-wrap:balance}.story-slide-shell__lead{grid-area:lead;margin:0;color:#5c7697;font-size:clamp(12px,1.25vw,15px);line-height:1.6}.story-slide-shell__body{min-width:0;min-height:0;display:grid;align-items:stretch}.story-slide-shell__body :deep(>*){height:100%;min-height:0}.story-slide-shell__body :deep(strong),.story-slide-shell__body :deep(h3),.story-slide-shell__body :deep(b){color:#17365d!important}.story-slide-shell__body :deep(span),.story-slide-shell__body :deep(small),.story-slide-shell__body :deep(p){color:#5c7697}.story-slide-shell__body :deep(article),.story-slide-shell__body :deep([class*="__panel"]),.story-slide-shell__body :deep(.heat),.story-slide-shell__body :deep(.bars),.story-slide-shell__body :deep(.clock){border-color:rgba(57,120,200,.16)!important;background-color:rgba(247,251,255,.76)!important;box-shadow:none!important;backdrop-filter:none!important}.story-slide-shell__body :deep([class*="__image"]),.story-slide-shell__body :deep([class*="__cover"]){box-shadow:0 16px 36px rgba(23,54,93,.16)!important}.story-slide-shell__body :deep(.progress){background:rgba(57,120,200,.12)!important}.story-slide-shell__body :deep(.progress i){background:linear-gradient(90deg,#3978c8,#3978c8)!important}.story-slide-shell__body :deep(.clock__center){background:#f7fbff!important;border-color:rgba(57,120,200,.2)!important}.story-slide-shell__body :deep(.heat i){background:rgba(57,120,200,calc(.1 + var(--heat)*.78))!important;box-shadow:none!important}@media(max-width:720px){.story-slide-shell{padding-inline:10px}.story-slide-shell__frame{gap:6px}.story-slide-shell__header{grid-template-columns:1fr;grid-template-areas:"heading" "title" "lead";gap:2px}.story-slide-shell__header h2{font-size:clamp(1.55rem,7vw,2.45rem)}.story-slide-shell__lead{font-size:12px;line-height:1.35;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.story-slide-shell__heading p{font-size:12px}.story-slide-shell__heading>strong{display:none}}@media(max-width:720px) and (max-height:650px){.story-slide-shell__header h2{font-size:1.45rem}.story-slide-shell__lead{-webkit-line-clamp:1}.story-slide-shell__frame{gap:4px}}@media (orientation:landscape) and (min-width:721px) and (max-height:460px){.story-slide-shell{padding-inline:24px}.story-slide-shell__frame{gap:5px}.story-slide-shell__header{grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);grid-template-areas:"title lead";gap:18px;align-items:center}.story-slide-shell__heading{display:none}.story-slide-shell__header h2{font-size:clamp(1.55rem,3.7vw,2rem);line-height:1}.story-slide-shell__lead{font-size:12px;line-height:1.35;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}}@media(prefers-reduced-motion:reduce){.story-slide-shell *{scroll-behavior:auto!important}}
.story-slide-shell__body :deep(span),
.story-slide-shell__body :deep(small),
.story-slide-shell__body :deep(p) { color: #5c7697 !important; }
</style>
