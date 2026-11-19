<script setup lang="ts">
// Audio preview of the song detail page (was components/song/SongAudioPreview.vue): drum track with mute and volume,
// mixed track and instrumental; branch variants (普通 / 玄人 / 达人 labels from the manifest) when the chart has them.
// Logic unchanged; presentation and copy moved to rework.songDetail.audio.*.
import { ref, watch } from "vue";
import { type BranchVariant, useSongBranchAudio } from "~/composables/useSongBranchAudio";
import type { SongBranchAudioVariants } from "~/types/content";

const props = defineProps<{ songId: number; selectedTrack: string; branchVariants: SongBranchAudioVariants }>();
const { t } = useI18n();
const apiBase = "https://static.sakura-bot.cn";
const drumVolume = ref(1);
const drumMuted = ref(false);
const audioErrors = ref<Record<string, boolean>>({});
const drumAudioRefs = new Map<string, HTMLAudioElement>();
const { activeBranchVariants, hasBranchVariants, getBaseAudioUrl, getVariantAudioUrl, getVariantDisplayLabel, getPureAudioUrl } = useSongBranchAudio({
  apiBase,
  songId: () => props.songId,
  selectedTrack: () => props.selectedTrack,
  branchVariants: () => props.branchVariants
});
const currentDrumAudio = computed(() => getBaseAudioUrl("drum"));
const currentMixAudio = computed(() => getBaseAudioUrl("mix"));
const currentPureAudio = computed(() => getPureAudioUrl());
const syncDrumState = () => {
  drumAudioRefs.forEach((audio) => {
    audio.volume = drumVolume.value;
    audio.muted = drumMuted.value;
  });
};
const setDrumAudioRef = (key: string, el: unknown) => {
  if (el instanceof HTMLAudioElement) drumAudioRefs.set(key, el);
  else drumAudioRefs.delete(key);
  syncDrumState();
};
const markAudioError = (key: string) => {
  audioErrors.value = { ...audioErrors.value, [key]: true };
};
const hasAudioError = (key: string) => !!audioErrors.value[key];
const errorKey = (mode: "drum" | "mix" | "pure", variant?: BranchVariant) =>
  mode === "pure" ? `pure-base-${props.songId}` : variant ? `${mode}-${props.songId}-${props.selectedTrack}-${variant.label}` : `${mode}-base-${props.songId}-${props.selectedTrack}`;
watch([drumVolume, drumMuted], syncDrumState);
watch([() => props.songId, () => props.selectedTrack], () => drumAudioRefs.clear());
</script>

<template>
  <details class="audio">
    <summary>
      <span class="audio-title">{{ t("rework.songDetail.audio.title") }}</span>
      <span class="audio-modes">{{ t("rework.songDetail.audio.drum") }} · {{ t("rework.songDetail.audio.mix") }} · {{ t("rework.songDetail.audio.pure") }}</span>
    </summary>
    <div class="audio-grid">
      <div class="audio-block">
        <h4>{{ t("rework.songDetail.audio.drum") }}</h4>
        <div v-if="hasBranchVariants" class="variants">
          <div v-for="variant in activeBranchVariants" :key="`drum-${selectedTrack}-${variant.label}`" class="variant">
            <span class="variant-label">{{ getVariantDisplayLabel(variant) }}</span>
            <audio
              :ref="(el) => setDrumAudioRef(`drum-${selectedTrack}-${variant.label}`, el)"
              :key="`drum-${songId}-${selectedTrack}-${variant.label}`"
              :src="getVariantAudioUrl('drum', variant)"
              controls
              preload="none"
              @loadedmetadata="syncDrumState"
              @error="markAudioError(errorKey('drum', variant))"
            />
            <p v-if="hasAudioError(errorKey('drum', variant))" class="audio-error">{{ t("rework.songDetail.audio.missing") }}</p>
          </div>
        </div>
        <template v-else>
          <audio
            :ref="(el) => setDrumAudioRef(errorKey('drum'), el)"
            :key="currentDrumAudio"
            :src="currentDrumAudio"
            controls
            preload="none"
            @loadedmetadata="syncDrumState"
            @error="markAudioError(errorKey('drum'))"
          />
          <p v-if="hasAudioError(errorKey('drum'))" class="audio-error">{{ t("rework.songDetail.audio.baseMissing") }}</p>
        </template>
        <div class="volume">
          <button type="button" class="rw-btn rw-btn--ghost rw-btn--sm" @click="drumMuted = !drumMuted">
            {{ drumMuted ? t("rework.songDetail.audio.unmute") : t("rework.songDetail.audio.mute") }}
          </button>
          <input v-model.number="drumVolume" class="volume-slider" :aria-label="t('rework.songDetail.audio.volume')" type="range" min="0" max="1" step="0.01" />
          <span class="num">{{ Math.round(drumVolume * 100) }}%</span>
        </div>
      </div>

      <div class="audio-block">
        <h4>{{ t("rework.songDetail.audio.mix") }}</h4>
        <div v-if="hasBranchVariants" class="variants">
          <div v-for="variant in activeBranchVariants" :key="`mix-${selectedTrack}-${variant.label}`" class="variant">
            <span class="variant-label">{{ getVariantDisplayLabel(variant) }}</span>
            <audio
              :key="`mix-${songId}-${selectedTrack}-${variant.label}`"
              :src="getVariantAudioUrl('mix', variant)"
              controls
              preload="none"
              @error="markAudioError(errorKey('mix', variant))"
            />
            <p v-if="hasAudioError(errorKey('mix', variant))" class="audio-error">{{ t("rework.songDetail.audio.missing") }}</p>
          </div>
        </div>
        <template v-else>
          <audio :key="`mix-base-${songId}-${selectedTrack}`" :src="currentMixAudio" controls preload="none" @error="markAudioError(errorKey('mix'))" />
          <p v-if="hasAudioError(errorKey('mix'))" class="audio-error">{{ t("rework.songDetail.audio.baseMissing") }}</p>
        </template>
      </div>

      <div class="audio-block is-wide">
        <h4>{{ t("rework.songDetail.audio.pure") }}</h4>
        <audio :key="`pure-base-${songId}`" :src="currentPureAudio" controls preload="none" @error="markAudioError(errorKey('pure'))" />
        <p v-if="hasAudioError(errorKey('pure'))" class="audio-error">{{ t("rework.songDetail.audio.pureMissing") }}</p>
      </div>
    </div>
  </details>
</template>

<style scoped>
.audio {
  border-top: 1px solid var(--line);
}
summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px var(--sp-3);
  min-height: var(--hit);
  cursor: pointer;
  list-style-position: inside;
  font-size: var(--fs-14);
  color: var(--ink);
  border-radius: var(--r-xs);
}
summary:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
.audio-title {
  font-weight: 600;
}
.audio-modes {
  font-size: var(--fs-13);
  color: var(--ink-3);
}
.audio[open] summary {
  margin-bottom: var(--sp-3);
}
.audio-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-5) var(--sp-6);
  padding-bottom: var(--sp-3);
}
.audio-block {
  min-width: 0;
}
.audio-block.is-wide {
  grid-column: 1 / -1;
}
h4 {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-13);
  font-weight: 600;
  color: var(--ink-2);
}
audio {
  display: block;
  width: 100%;
  height: 44px;
}
.variants {
  display: grid;
  gap: var(--sp-4);
}
.variant {
  display: grid;
  gap: var(--sp-2);
  min-width: 0;
}
.variant-label {
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.audio-error {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-13);
  color: var(--danger);
}
.volume {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-top: var(--sp-2);
  font-size: var(--fs-13);
  color: var(--ink-2);
}
.volume-slider {
  flex: 1;
  min-width: 0;
  min-height: var(--hit);
  accent-color: var(--accent);
}
@media (max-width: 767px) {
  .audio-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
