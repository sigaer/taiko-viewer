<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  reducedMotion: boolean;
  active?: boolean;
  /** Overall particle brightness. The fireworks are ambient, so this stays low. */
  opacity?: number;
}>(), {
  active: false,
  opacity: 0.62
});

type Burst = {
  x: number;
  y: number;
  startedAt: number;
  cadence: number;
  count: number;
  speed: number;
  hue: number;
  radiusBase: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  hue: number;
  drag: number;
};

// Staggered generators rather than one loop: every burst uses its own position,
// size, count and start offset so the sky never repeats the same shape twice.
// Cadences are deliberately shorter than a particle lifetime so consecutive
// bursts overlap and the sky is never empty between them.
const GENERATORS = [
  { x: 0.24, y: 0.20, count: 30, speed: 1.00, hue: 194, size: 1.00, delay: 0.00, cadence: 2.90 },
  { x: 0.72, y: 0.15, count: 23, speed: 0.86, hue: 258, size: 0.88, delay: 0.45, cadence: 3.30 },
  { x: 0.50, y: 0.30, count: 34, speed: 1.12, hue: 178, size: 1.08, delay: 1.10, cadence: 3.75 },
  { x: 0.14, y: 0.40, count: 18, speed: 0.74, hue: 205, size: 0.76, delay: 1.80, cadence: 3.50 },
  { x: 0.86, y: 0.38, count: 25, speed: 0.94, hue: 232, size: 0.94, delay: 2.40, cadence: 3.05 },
  { x: 0.38, y: 0.12, count: 21, speed: 0.82, hue: 188, size: 0.82, delay: 3.10, cadence: 3.90 },
  { x: 0.64, y: 0.46, count: 27, speed: 1.04, hue: 268, size: 1.02, delay: 3.70, cadence: 3.40 }
] as const;

// Playback speed of the whole display. Every time constant below (velocity,
// gravity, drag, particle lifetime, motion trail, burst cadence, opening delay)
// is scaled by it, so a larger value plays the exact same fireworks slower
// instead of turning them into a different, longer-lived effect: a particle
// still travels the same distance and falls the same way, it just takes
// PLAYBACK_TIME_SCALE times as long to do it.
const PLAYBACK_TIME_SCALE = 3;

const GRAVITY = 0.00034 / (PLAYBACK_TIME_SCALE * PLAYBACK_TIME_SCALE);
const DRAG = 0.00165 / PLAYBACK_TIME_SCALE;
const TRAIL_MS = 26 * PLAYBACK_TIME_SCALE;
const OPENING_COMPACT_MS = 1200 * PLAYBACK_TIME_SCALE;
const MAX_PARTICLES = 540;

const canvasRef = ref<HTMLCanvasElement | null>(null);
let context: CanvasRenderingContext2D | null = null;
let frame = 0;
let resizeObserver: ResizeObserver | null = null;
let size = { width: 0, height: 0, scale: 1 };
let particles: Particle[] = [];
let generators: Burst[] = [];
let lastTimestamp = 0;
let elapsed = 0;

const random = (min: number, max: number) => min + Math.random() * (max - min);

const buildGenerators = () => {
  generators = GENERATORS.map((generator) => ({
    x: generator.x,
    y: generator.y,
    startedAt: generator.delay * 1000 * PLAYBACK_TIME_SCALE,
    cadence: generator.cadence * 1000 * PLAYBACK_TIME_SCALE,
    count: Math.round(generator.count * random(0.86, 1.14)),
    speed: generator.speed * random(0.9, 1.1),
    hue: generator.hue + random(-12, 12),
    radiusBase: generator.size * random(0.88, 1.12)
  }));
};

const spawnBurst = (generator: Burst, short = false) => {
  const base = Math.min(size.width, size.height);
  const strength = generator.speed * base * (short ? 0.00062 : 0.00105) / PLAYBACK_TIME_SCALE;
  // An explosion is never evenly distributed: the whole ring is rotated, the
  // radial gaps are jittered and a few embers get far more speed than the rest.
  const twist = random(0, Math.PI * 2);
  const bias = random(-0.4, 0.4);
  for (let index = 0; index < generator.count; index += 1) {
    if (particles.length >= MAX_PARTICLES) break;
    const t = index / generator.count;
    const angle = twist + t * Math.PI * 2 + random(-0.11, 0.11) + bias;
    const speed = strength * random(0.52, 1.28) * (1 + Math.cos(angle * 2) * 0.16);
    particles.push({
      x: generator.x * size.width + random(-3, 3),
      y: generator.y * size.height + random(-3, 3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      ttl: random(1000, 1750) * PLAYBACK_TIME_SCALE,
      size: generator.radiusBase * random(0.7, 1.9) * size.scale,
      hue: generator.hue + random(-16, 16),
      drag: DRAG * random(0.78, 1.24)
    });
  }
};

const advance = (timestamp: number, forceDuration = 0) => {
  const delta = forceDuration || Math.min(lastTimestamp ? timestamp - lastTimestamp : 16, 48);
  lastTimestamp = timestamp;
  elapsed += delta;

  for (const generator of generators) {
    const local = elapsed - generator.startedAt;
    if (local < 0) continue;
    const within = local % generator.cadence;
    // The first pass plays a compact burst so the sky is alive immediately.
    const compact = elapsed < OPENING_COMPACT_MS;
    if (within < delta) spawnBurst(generator, compact);
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life += delta;
    if (particle.life >= particle.ttl) {
      particles.splice(index, 1);
      continue;
    }
    const damping = Math.max(0, 1 - particle.drag * delta);
    particle.vx *= damping;
    particle.vy = particle.vy * damping + GRAVITY * delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
  }
};

const draw = () => {
  if (!context) return;
  const { width, height, scale } = size;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  for (const particle of particles) {
    const progress = particle.life / particle.ttl;
    const alpha = (1 - progress) * (1 - progress) * 0.9;
    if (alpha <= 0.01) continue;
    // A short motion trail reads as speed without a real motion-blur pass.
    const trailX = particle.x - particle.vx * TRAIL_MS;
    const trailY = particle.y - particle.vy * TRAIL_MS;
    context.strokeStyle = `hsla(${particle.hue}, 82%, 86%, ${alpha})`;
    context.lineWidth = particle.size;
    context.beginPath();
    context.moveTo(trailX, trailY);
    context.lineTo(particle.x, particle.y);
    context.stroke();
  }
  context.globalCompositeOperation = "source-over";
};

const renderFrame = (timestamp: number) => {
  advance(timestamp);
  draw();
  frame = window.requestAnimationFrame(renderFrame);
};

const renderStatic = () => {
  particles = [];
  buildGenerators();
  lastTimestamp = 0;
  elapsed = 0;
  // Three settled bursts give reduced-motion users a legible still image.
  for (const generator of generators.slice(0, 3)) {
    spawnBurst(generator, false);
    advance(0, 520 * PLAYBACK_TIME_SCALE);
  }
  draw();
};

const stop = () => {
  if (!frame) return;
  window.cancelAnimationFrame(frame);
  frame = 0;
};

const start = () => {
  if (frame || !context) return;
  lastTimestamp = 0;
  frame = window.requestAnimationFrame(renderFrame);
};

const resize = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  size = { width: rect.width, height: rect.height, scale };
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  if (props.reducedMotion) renderStatic();
  else draw();
};

const sync = () => {
  if (!canvasRef.value) return;
  const shouldRun = props.active && !props.reducedMotion && !document.hidden;
  if (shouldRun) start();
  else {
    stop();
    if (props.reducedMotion) renderStatic();
  }
};

const handleVisibility = () => sync();

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  context = canvas.getContext("2d");
  buildGenerators();
  resize();
  resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvas);
  document.addEventListener("visibilitychange", handleVisibility);
  sync();
});

watch(() => [props.active, props.reducedMotion], () => sync());

onBeforeUnmount(() => {
  stop();
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.removeEventListener("visibilitychange", handleVisibility);
  particles = [];
  context = null;
});
</script>

<template>
  <div
    class="annual-fireworks"
    :class="{ 'is-still': reducedMotion, 'is-active': active }"
    :style="{ '--firework-opacity': opacity }"
    aria-hidden="true"
  >
    <canvas ref="canvasRef" class="annual-fireworks__canvas"></canvas>
  </div>
</template>

<style scoped>
.annual-fireworks { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.annual-fireworks__canvas {
  display: block;
  width: 100%;
  height: 100%;
  /* Ambient layer: bright enough to read as an explosion, dim enough that the
     cover title, the year and the two opening actions stay the focus. */
  opacity: var(--firework-opacity, .62);
  transition: opacity .4s ease;
}
.annual-fireworks.is-still .annual-fireworks__canvas { opacity: calc(var(--firework-opacity, .62) * .78); }
@media (prefers-reduced-motion: reduce) { .annual-fireworks__canvas { transition: none; } }
</style>
