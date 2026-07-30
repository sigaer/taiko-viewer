<script setup lang="ts">
defineProps<{ reducedMotion: boolean }>();

const stars = [
  { x: 8, y: 10, size: 6, delay: 0.1 },
  { x: 20, y: 7, size: 4, delay: 0.7 },
  { x: 45, y: 5, size: 4, delay: 1.1 },
  { x: 67, y: 12, size: 6, delay: 0.4 },
  { x: 75, y: 7, size: 5, delay: 1.5 },
  { x: 92, y: 12, size: 4, delay: 0.9 },
  { x: 12, y: 37, size: 5, delay: 1.8 },
  { x: 32, y: 31, size: 4, delay: 0.3 },
  { x: 58, y: 29, size: 4, delay: 1.2 },
  { x: 81, y: 34, size: 6, delay: 0.6 },
  { x: 39, y: 50, size: 5, delay: 1.4 },
  { x: 73, y: 52, size: 5, delay: 0.2 }
];
</script>

<template>
  <div class="annual-fireworks" :class="{ 'is-still': reducedMotion }" aria-hidden="true">
    <svg viewBox="0 0 414 310" preserveAspectRatio="xMidYMid slice">
      <g class="annual-fireworks__burst annual-fireworks__burst--large">
        <path d="M138 111 C111 70 83 46 49 44" />
        <path d="M139 111 C119 61 114 35 99 23" />
        <path d="M139 111 C139 65 145 36 163 25" />
        <path d="M141 112 C160 69 184 48 213 48" />
        <path d="M143 114 C176 84 202 76 236 81" />
        <path d="M143 115 C178 104 211 105 251 124" />
        <path d="M139 115 C105 92 78 87 38 91" />
        <path d="M138 116 C103 106 75 112 45 139" />
        <path d="M138 116 C118 122 99 140 90 166" />
        <path d="M140 115 C147 137 165 153 191 163" />
      </g>
      <g class="annual-fireworks__burst annual-fireworks__burst--right">
        <path d="M319 137 C299 105 277 93 251 94" />
        <path d="M320 138 C315 102 319 78 334 65" />
        <path d="M321 138 C340 105 363 93 393 98" />
        <path d="M322 140 C352 122 381 122 414 139" />
        <path d="M322 142 C355 143 382 157 402 181" />
        <path d="M320 142 C338 167 341 191 333 214" />
        <path d="M318 142 C301 165 279 177 253 177" />
        <path d="M317 140 C287 140 267 151 250 169" />
      </g>
      <g class="annual-fireworks__burst annual-fireworks__burst--left-small">
        <path d="M52 237 C42 213 27 203 8 205" />
        <path d="M53 238 C52 212 58 197 70 190" />
        <path d="M54 238 C69 217 86 211 104 217" />
        <path d="M54 240 C77 236 94 244 105 258" />
        <path d="M52 240 C35 245 26 257 24 276" />
      </g>
      <g class="annual-fireworks__burst annual-fireworks__burst--bottom">
        <path d="M180 263 C169 232 150 218 126 217" />
        <path d="M181 263 C178 231 185 210 201 199" />
        <path d="M182 263 C203 238 225 232 248 241" />
        <path d="M183 265 C207 262 228 273 241 292" />
        <path d="M180 265 C157 271 145 285 143 305" />
      </g>
    </svg>

    <i
      v-for="(star, index) in stars"
      :key="index"
      class="annual-fireworks__star"
      :style="{
        left: `${star.x}%`,
        top: `${star.y}%`,
        width: `${star.size}px`,
        height: `${star.size}px`,
        '--star-delay': `${star.delay}s`
      }"
    />
  </div>
</template>

<style scoped>
.annual-fireworks {
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: #6b7d91;
  pointer-events: none;
}

.annual-fireworks svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.annual-fireworks__burst {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.55;
  stroke-linecap: round;
  opacity: 0.52;
}

.annual-fireworks__burst path {
  stroke-dasharray: 420;
  stroke-dashoffset: 420;
  animation: annual-firework-draw 4.8s cubic-bezier(0.22, 0.75, 0.2, 1) infinite;
}

.annual-fireworks__burst--large {
  color: #708194;
}

.annual-fireworks__burst--large path:nth-child(3n + 1) { animation-delay: -0.35s; }
.annual-fireworks__burst--large path:nth-child(3n + 2) { animation-delay: -0.18s; }
.annual-fireworks__burst--right {
  color: #4f58a1;
}
.annual-fireworks__burst--right path { animation-delay: -2.4s; }
.annual-fireworks__burst--left-small {
  color: #3e91bb;
}
.annual-fireworks__burst--left-small path { animation-delay: -1.35s; }
.annual-fireworks__burst--bottom {
  color: #5aa879;
}
.annual-fireworks__burst--bottom path { animation-delay: -3.15s; }

.annual-fireworks__star {
  position: absolute;
  display: block;
  background: #78899a;
  opacity: 0.72;
  clip-path: polygon(50% 0, 61% 36%, 100% 50%, 61% 64%, 50% 100%, 39% 64%, 0 50%, 39% 36%);
  animation: annual-star-pulse 2.6s ease-in-out var(--star-delay) infinite;
}

.annual-fireworks.is-still .annual-fireworks__burst path {
  stroke-dashoffset: 0;
  animation: none;
}

.annual-fireworks.is-still .annual-fireworks__star {
  animation: none;
}

@keyframes annual-firework-draw {
  0%, 10% { stroke-dashoffset: 420; opacity: 0; }
  34%, 72% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}

@keyframes annual-star-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.72) rotate(0deg); }
  50% { opacity: 0.88; transform: scale(1.12) rotate(20deg); }
}
</style>
