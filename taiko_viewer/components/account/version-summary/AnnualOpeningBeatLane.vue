<script setup lang="ts">
defineProps<{ reducedMotion: boolean }>();

const notes = ["don", "don", "don", "ka", "don", "don", "ka", "ka", "don", "don", "don", "ka"];
</script>

<template>
  <div class="annual-beat-lane" :class="{ 'is-still': reducedMotion }" aria-hidden="true">
    <div class="annual-beat-lane__mascot"><span></span></div>
    <div class="annual-beat-lane__viewport">
      <div class="annual-beat-lane__track">
        <template v-for="copy in 2" :key="copy">
          <i
            v-for="(note, index) in notes"
            :key="`${copy}-${index}`"
            :class="`is-${note}`"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.annual-beat-lane {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  border-top: 3px solid #183e66;
  border-bottom: 3px solid #183e66;
  background: #f8f1d5;
  overflow: hidden;
}

.annual-beat-lane::before,
.annual-beat-lane::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(12, 56, 104, 0.42);
}

.annual-beat-lane::before { top: 5px; }
.annual-beat-lane::after { bottom: 5px; }

.annual-beat-lane__mascot {
  position: relative;
  z-index: 3;
  flex: 0 0 70px;
  height: 100%;
  display: grid;
  place-items: center;
  background: linear-gradient(90deg, #34a5c2, #76d6d2);
  border-right: 3px solid #183e66;
}

.annual-beat-lane__mascot span {
  width: 31px;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 38% 44%, #172f4d 0 2px, transparent 2.5px),
    radial-gradient(circle at 62% 44%, #172f4d 0 2px, transparent 2.5px),
    radial-gradient(ellipse at 50% 64%, #172f4d 0 7%, transparent 8%),
    #f44f43;
  border: 4px solid #ffffff;
  box-shadow: 0 0 0 2px #1b6e8d;
}

.annual-beat-lane__viewport {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.annual-beat-lane__track {
  width: max-content;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 9px;
  animation: annual-beat-scroll 8s linear infinite;
}

.annual-beat-lane__track i {
  position: relative;
  display: block;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px #17365d;
}

.annual-beat-lane__track i::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.annual-beat-lane__track .is-don { background: #f24d43; }
.annual-beat-lane__track .is-ka { background: #39a9dd; }

.annual-beat-lane.is-still .annual-beat-lane__track {
  animation: none;
}

@keyframes annual-beat-scroll {
  to { transform: translateX(calc(-50% - 4px)); }
}
</style>
