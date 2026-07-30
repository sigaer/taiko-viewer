<script setup lang="ts">
defineProps<{ reducedMotion: boolean }>();

const donIconUrl = "/api/content/assets/don";
const oniMeasure14To16 = Array.from({ length: 3 }, (_, measureIndex) =>
  [..."1110111011102220"].map((value, beatIndex) => ({
    key: `${measureIndex}-${beatIndex}`,
    note: value === "1" ? "don" : value === "2" ? "ka" : "",
    measureStart: beatIndex === 0
  }))
).flat();
</script>

<template>
  <div class="annual-beat-lane" :class="{ 'is-still': reducedMotion }" aria-hidden="true">
    <div class="annual-beat-lane__mascot">
      <span class="annual-beat-lane__don">
        <span class="annual-beat-lane__shell"></span>
        <img :src="donIconUrl" alt="" />
        <i class="is-left-arm"></i>
        <i class="is-right-arm"></i>
        <i class="is-left-foot"></i>
        <i class="is-right-foot"></i>
      </span>
    </div>
    <div class="annual-beat-lane__viewport">
      <div class="annual-beat-lane__track">
        <div
          v-for="copy in 2"
          :key="copy"
          class="annual-beat-lane__sequence"
        >
          <span
            v-for="beat in oniMeasure14To16"
            :key="`${copy}-${beat.key}`"
            class="annual-beat-lane__beat"
            :class="{ 'is-measure-start': beat.measureStart }"
          >
            <i v-if="beat.note" :class="`is-${beat.note}`"></i>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.annual-beat-lane {
  --beat-step: 20px;
  --beat-sequence-width: 960px;
  position: relative;
  height: 100%;
  border-top: 2px solid #151515;
  border-bottom: 2px solid #151515;
  background: #d7d7d7;
  overflow: visible;
}

.annual-beat-lane::before,
.annual-beat-lane::after {
  content: "";
  position: absolute;
  z-index: 2;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.86);
  pointer-events: none;
}

.annual-beat-lane::before { top: 2px; }
.annual-beat-lane::after { bottom: 2px; }

.annual-beat-lane__mascot {
  position: absolute;
  z-index: 6;
  left: 5px;
  bottom: -8px;
  width: 67px;
  height: 59px;
  pointer-events: none;
  filter: drop-shadow(0 3px 1px rgba(18, 39, 52, 0.18));
}

.annual-beat-lane__don {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
}

.annual-beat-lane__shell {
  position: absolute;
  z-index: 1;
  left: 7px;
  top: 7px;
  width: 45px;
  height: 38px;
  border: 2px solid #1f2530;
  border-radius: 52% 38% 42% 52%;
  background:
    radial-gradient(circle at 44% 38%, rgba(255, 255, 255, 0.48), transparent 35%),
    #82cbd1;
  transform: rotate(5deg);
}

.annual-beat-lane__don img {
  position: absolute;
  z-index: 3;
  top: 7px;
  right: 4px;
  width: 43px;
  height: 43px;
  object-fit: contain;
}

.annual-beat-lane__don i {
  position: absolute;
  z-index: 2;
  display: block;
  width: 9px;
  height: 15px;
  border: 2px solid #1f2530;
  border-radius: 55% 55% 48% 48%;
  background: #fffdf4;
}

.annual-beat-lane__don .is-left-arm {
  left: 4px;
  top: 29px;
  transform: rotate(20deg);
}

.annual-beat-lane__don .is-right-arm {
  right: 0;
  top: 31px;
  transform: rotate(-18deg);
}

.annual-beat-lane__don .is-left-foot {
  left: 24px;
  bottom: 0;
  transform: rotate(5deg);
}

.annual-beat-lane__don .is-right-foot {
  right: 13px;
  bottom: 1px;
  transform: rotate(-7deg);
}

.annual-beat-lane__viewport {
  position: absolute;
  inset: 0 0 0 67px;
  overflow: hidden;
  border-left: 2px solid #222833;
  background:
    linear-gradient(180deg, transparent 48%, rgba(255, 255, 255, 0.48) 49% 52%, transparent 53%);
}

.annual-beat-lane__viewport::before {
  content: "";
  position: absolute;
  z-index: 4;
  left: 2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #2b3038;
  box-shadow: 2px 0 0 rgba(255, 255, 255, 0.72);
  pointer-events: none;
}

.annual-beat-lane__track {
  position: absolute;
  inset: 0 auto 0 0;
  width: max-content;
  display: flex;
  align-items: center;
  animation: annual-beat-scroll 11.5s linear infinite;
  will-change: transform;
}

.annual-beat-lane__sequence {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(48, var(--beat-step));
  width: var(--beat-sequence-width);
  height: 100%;
}

.annual-beat-lane__beat {
  position: relative;
  display: grid;
  width: var(--beat-step);
  height: 100%;
  place-items: center;
  border-left: 1px solid rgba(60, 60, 60, 0.13);
}

.annual-beat-lane__beat.is-measure-start {
  border-left-color: rgba(28, 28, 28, 0.62);
}

.annual-beat-lane__beat i {
  position: relative;
  z-index: 2;
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #f5f5f5;
  box-shadow:
    0 0 0 1px #686868,
    0 2px 1px rgba(0, 0, 0, 0.2),
    inset 2px 2px 2px rgba(255, 255, 255, 0.42);
}

.annual-beat-lane__beat i::after {
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.34);
}

.annual-beat-lane__beat .is-don { background: #f34d48; }
.annual-beat-lane__beat .is-ka { background: #42b9e8; }

.annual-beat-lane.is-still .annual-beat-lane__track {
  animation: none;
}

@keyframes annual-beat-scroll {
  to { transform: translate3d(-50%, 0, 0); }
}
</style>
