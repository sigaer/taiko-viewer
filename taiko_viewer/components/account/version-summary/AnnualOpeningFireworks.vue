<script setup lang="ts">
defineProps<{ reducedMotion: boolean; active?: boolean }>();

const stars = [
  { x: 8, y: 10, size: 5, delay: 0.1 }, { x: 19, y: 7, size: 3, delay: 0.7 },
  { x: 45, y: 6, size: 4, delay: 1.1 }, { x: 68, y: 11, size: 5, delay: 0.4 },
  { x: 84, y: 8, size: 4, delay: 1.5 }, { x: 94, y: 17, size: 3, delay: 0.9 },
  { x: 11, y: 40, size: 4, delay: 1.8 }, { x: 31, y: 32, size: 3, delay: 0.3 },
  { x: 58, y: 30, size: 3, delay: 1.2 }, { x: 81, y: 35, size: 5, delay: 0.6 },
  { x: 40, y: 49, size: 4, delay: 1.4 }, { x: 73, y: 53, size: 4, delay: 0.2 },
  { x: 24, y: 22, size: 2, delay: 1.7 }, { x: 91, y: 46, size: 2, delay: .8 }
];
</script>

<template>
  <div class="annual-fireworks" :class="{ 'is-still': reducedMotion, 'is-active': active }" aria-hidden="true">
    <svg viewBox="0 0 414 560" preserveAspectRatio="xMidYMid slice">
      <g class="annual-fireworks__burst annual-fireworks__burst--main">
        <path d="M138 164 C111 116 82 86 47 80" /><path d="M138 164 C119 108 112 72 96 48" />
        <path d="M139 164 C135 112 141 76 159 51" /><path d="M141 165 C157 112 181 77 207 72" />
        <path d="M143 166 C176 123 205 108 235 109" /><path d="M144 168 C183 143 217 137 252 149" />
        <path d="M144 169 C183 165 218 178 246 201" /><path d="M142 171 C177 187 198 213 204 247" />
        <path d="M140 171 C149 213 137 242 111 268" /><path d="M138 171 C120 211 94 233 59 240" />
        <path d="M137 169 C101 197 70 199 37 187" /><path d="M136 168 C99 176 65 164 39 143" />
        <path d="M137 166 C102 146 80 119 73 88" /><path d="M145 165 C169 144 195 134 223 135" />
        <path d="M139 164 C128 125 127 97 137 66" /><path d="M140 167 C155 186 175 199 200 207" />
        <path d="M141 166 C116 158 91 145 74 124" /><path d="M142 170 C167 168 194 174 219 190" />
        <path d="M139 168 C119 181 103 201 95 226" /><path d="M142 165 C161 131 179 113 201 101" />
      </g>
      <g class="annual-fireworks__burst annual-fireworks__burst--right">
        <path d="M320 214 C300 177 276 159 247 159" /><path d="M320 215 C314 173 319 141 335 119" />
        <path d="M322 215 C340 178 365 162 396 166" /><path d="M323 218 C355 200 383 202 409 218" />
        <path d="M322 219 C355 226 382 245 398 273" /><path d="M320 220 C337 252 337 282 324 312" />
        <path d="M318 218 C301 254 277 273 248 278" /><path d="M318 216 C286 220 264 234 245 257" />
        <path d="M319 216 C301 195 285 182 267 177" /><path d="M321 218 C341 229 361 246 372 267" />
      </g>
      <g class="annual-fireworks__burst annual-fireworks__burst--left-small">
        <path d="M53 386 C41 354 25 337 5 338" /><path d="M53 387 C52 354 58 332 73 318" />
        <path d="M55 388 C72 359 90 350 112 355" /><path d="M55 390 C81 387 101 398 113 417" />
        <path d="M53 390 C35 399 25 417 23 441" /><path d="M52 388 C37 375 25 366 12 365" />
      </g>
      <g class="annual-fireworks__burst annual-fireworks__burst--bottom">
        <path d="M188 490 C176 454 157 434 132 431" /><path d="M188 491 C185 451 191 424 208 408" />
        <path d="M190 491 C211 458 233 449 258 458" /><path d="M191 494 C218 491 241 504 254 527" />
        <path d="M187 493 C161 501 148 519 145 544" /><path d="M189 491 C170 482 155 468 147 451" />
      </g>
    </svg>
    <i
      v-for="(star, index) in stars"
      :key="index"
      class="annual-fireworks__star"
      :style="{ left: `${star.x}%`, top: `${star.y}%`, width: `${star.size}px`, height: `${star.size}px`, '--star-delay': `${star.delay}s` }"
    />
  </div>
</template>

<style scoped>
.annual-fireworks { position: absolute; inset: 0; overflow: hidden; color: #728399; pointer-events: none; }
.annual-fireworks svg { display: block; width: 100%; height: 100%; overflow: visible; }
.annual-fireworks__burst { fill: none; stroke: currentColor; stroke-linecap: round; stroke-dasharray: 420; stroke-dashoffset: 0; opacity: .48; }
.annual-fireworks__burst path { stroke-width: 1.9; }
.annual-fireworks__burst path:nth-child(3n) { stroke-width: 2.8; opacity: .62; }
.annual-fireworks__burst path:nth-child(4n) { stroke-width: 1.35; opacity: .33; }
.annual-fireworks__burst--main { color: #708194; }
.annual-fireworks__burst--right { color: #595d9b; opacity: .72; }
.annual-fireworks__burst--left-small { color: #4f95b5; opacity: .62; }
.annual-fireworks__burst--bottom { color: #688e9b; opacity: .52; }
.annual-fireworks.is-active:not(.is-still) .annual-fireworks__burst path { animation: annual-firework-draw 7.6s cubic-bezier(.22,.75,.2,1) infinite; }
.annual-fireworks.is-active:not(.is-still) .annual-fireworks__burst--right path { animation-delay: -2.8s; }
.annual-fireworks.is-active:not(.is-still) .annual-fireworks__burst--left-small path { animation-delay: -1.3s; }
.annual-fireworks.is-active:not(.is-still) .annual-fireworks__burst--bottom path { animation-delay: -4.4s; }
.annual-fireworks__star { position: absolute; display: block; border-radius: 50%; background: #91a1ad; opacity: .58; box-shadow: 0 0 0 1px rgba(171,210,220,.16); }
.annual-fireworks.is-active:not(.is-still) .annual-fireworks__star { animation: annual-star-pulse 3.8s ease-in-out var(--star-delay) infinite; }
.annual-fireworks.is-still .annual-fireworks__burst path { stroke-dashoffset: 0; animation: none; }
.annual-fireworks.is-still .annual-fireworks__star { animation: none; }
@keyframes annual-firework-draw { 0%, 8% { stroke-dashoffset: 420; opacity: 0; } 26%, 72% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: .42; } }
@keyframes annual-star-pulse { 0%, 100% { opacity: .28; transform: scale(.75); } 50% { opacity: .82; transform: scale(1.2); } }
@media (prefers-reduced-motion: reduce) { .annual-fireworks__burst path, .annual-fireworks__star { animation: none !important; } }
</style>
