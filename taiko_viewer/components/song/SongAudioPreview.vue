<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { type BranchVariant, useSongBranchAudio } from '~/composables/useSongBranchAudio';
import type { SongBranchAudioVariants } from '~/types/content';
const props = defineProps<{ songId: number; selectedTrack: string; branchVariants: SongBranchAudioVariants }>();
const { locale } = useI18n();
const copy = computed(() => locale.value === 'ja' ? {
 preview:'試聴', drum:'打音', mix:'ミックス', pure:'インスト', audioMissing:'音源が見つかりません', baseAudioMissing:'基本音源が見つかりません', pureAudioMissing:'インスト音源が見つかりません', unmute:'ミュート解除', mute:'ミュート', volume:'打音の音量'
} : { preview:'试听', drum:'鼓点', mix:'混音', pure:'纯音乐', audioMissing:'音源不存在', baseAudioMissing:'基础音源不存在', pureAudioMissing:'纯音乐音源不存在', unmute:'取消静音', mute:'静音', volume:'鼓点音量' });
const apiBase = 'https://static.sakura-bot.cn';
const drumVolume = ref(1), drumMuted = ref(false), audioErrors = ref<Record<string, boolean>>({});
const drumAudioRefs = new Map<string, HTMLAudioElement>();
const { activeBranchVariants, hasBranchVariants, getBaseAudioUrl, getVariantAudioUrl, getVariantDisplayLabel, getPureAudioUrl } = useSongBranchAudio({ apiBase, songId: () => props.songId, selectedTrack: () => props.selectedTrack, branchVariants: () => props.branchVariants });
const currentDrumAudio = computed(() => getBaseAudioUrl('drum'));
const currentMixAudio = computed(() => getBaseAudioUrl('mix'));
const currentPureAudio = computed(() => getPureAudioUrl());
const getDrumVariantAudioUrl = (variant: BranchVariant) => getVariantAudioUrl('drum', variant);
const getMixVariantAudioUrl = (variant: BranchVariant) => getVariantAudioUrl('mix', variant);
const syncDrumState = () => { drumAudioRefs.forEach(audio => { audio.volume = drumVolume.value; audio.muted = drumMuted.value; }); };
const setDrumAudioRef = (key: string, el: Element | null) => { if (el instanceof HTMLAudioElement) drumAudioRefs.set(key, el); else drumAudioRefs.delete(key); syncDrumState(); };
const markAudioError = (key: string) => { audioErrors.value = { ...audioErrors.value, [key]: true }; };
const hasAudioError = (key: string) => !!audioErrors.value[key];
const getAudioErrorKey = (mode: 'drum'|'mix'|'pure', variant?: BranchVariant) => mode === 'pure' ? `pure-base-${props.songId}` : variant ? `${mode}-${props.songId}-${props.selectedTrack}-${variant.label}` : `${mode}-base-${props.songId}-${props.selectedTrack}`;
watch([drumVolume, drumMuted], syncDrumState);
watch([() => props.songId, () => props.selectedTrack], () => drumAudioRefs.clear());
</script>
<template>
<details class="song-audio"><summary>{{ copy.preview }}<span class="audio-summary-modes">{{ copy.drum }} · {{ copy.mix }} · {{ copy.pure }}</span></summary>
            <div class="audio-grid">
              <div class="audio-block">
                <div class="audio-head">
                  <strong>{{ copy.drum }}</strong>
                </div>
                <template v-if="hasBranchVariants">
                  <div class="variant-audios">
                    <div
                      v-for="variant in activeBranchVariants"
                      :key="`drum-${selectedTrack}-${variant.label}`"
                      class="variant-item"
                    >
                      <span class="variant-label" :class="{ merged: variant.aliases.length }">
                        {{ getVariantDisplayLabel(variant) }}
                      </span>
                      <audio
                        :ref="(el) => setDrumAudioRef(`drum-${selectedTrack}-${variant.label}`, el)"
                        :key="`drum-${songId}-${selectedTrack}-${variant.label}`"
                        :src="getDrumVariantAudioUrl(variant)"
                        class="audio-player"
                        controls
                        preload="none"
                        @loadedmetadata="syncDrumState"
                        @error="markAudioError(getAudioErrorKey('drum', variant))"
                      />
                      <p v-if="hasAudioError(getAudioErrorKey('drum', variant))" class="audio-error">{{ copy.audioMissing }}</p>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <audio
                    :ref="(el) => setDrumAudioRef(getAudioErrorKey('drum'), el)"
                    :key="currentDrumAudio"
                    :src="currentDrumAudio"
                    class="audio-player"
                    controls
                    preload="none"
                    @loadedmetadata="syncDrumState"
                    @error="markAudioError(getAudioErrorKey('drum'))"
                  />
                  <p v-if="hasAudioError(getAudioErrorKey('drum'))" class="audio-error">{{ copy.baseAudioMissing }}</p>
                </template>
                <div class="volume-row">
                  <button class="volume-btn" type="button" @click="drumMuted = !drumMuted">
                    {{ drumMuted ? copy.unmute : copy.mute }}
                  </button>
                  <input v-model.number="drumVolume" class="volume-slider" :aria-label="copy.volume" type="range" min="0" max="1" step="0.01" />
                  <span>{{ Math.round(drumVolume * 100) }}%</span>
                </div>
              </div>

              <div class="audio-block">
                <div class="audio-head">
                  <strong>{{ copy.mix }}</strong>
                </div>
                <template v-if="hasBranchVariants">
                  <div class="variant-audios">
                    <div
                      v-for="variant in activeBranchVariants"
                      :key="`mix-${selectedTrack}-${variant.label}`"
                      class="variant-item"
                    >
                      <span class="variant-label" :class="{ merged: variant.aliases.length }">
                        {{ getVariantDisplayLabel(variant) }}
                      </span>
                      <audio
                        :key="`mix-${songId}-${selectedTrack}-${variant.label}`"
                        :src="getMixVariantAudioUrl(variant)"
                        class="audio-player"
                        controls
                        preload="none"
                        @error="markAudioError(getAudioErrorKey('mix', variant))"
                      />
                      <p v-if="hasAudioError(getAudioErrorKey('mix', variant))" class="audio-error">{{ copy.audioMissing }}</p>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <audio
                    :key="`mix-base-${songId}-${selectedTrack}`"
                    :src="currentMixAudio"
                    class="audio-player"
                    controls
                    preload="none"
                    @error="markAudioError(getAudioErrorKey('mix'))"
                  />
                  <p v-if="hasAudioError(getAudioErrorKey('mix'))" class="audio-error">{{ copy.baseAudioMissing }}</p>
                </template>
              </div>

              <div class="audio-block">
                <div class="audio-head">
                  <strong>{{ copy.pure }}</strong>
                </div>
                <audio
                  :key="`pure-base-${songId}`"
                  :src="currentPureAudio"
                  class="audio-player"
                  controls
                  preload="none"
                  @error="markAudioError(getAudioErrorKey('pure'))"
                />
                <p v-if="hasAudioError(getAudioErrorKey('pure'))" class="audio-error">{{ copy.pureAudioMissing }}</p>
              </div>
            </div>
</details></template>
<style scoped>

.song-audio { margin-top:12px; }
summary { min-height:48px; align-content:center; cursor:pointer; font-size:15px; color:var(--viewer-text); }
.audio-summary-modes{font-size:14px;margin-left:12px;color:var(--viewer-text-muted);}
.song-audio[open] summary{margin-bottom:16px;}
.audio-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px 28px; }
.audio-block { min-width:0; }
.audio-block:last-child { grid-column:1/-1; }
.audio-head { margin-bottom:10px; font-size:14px; }
.audio-head strong {font-weight:500;}
.audio-player { width:100%; display:block; height:44px; }
.volume-row { display:flex; gap:12px; align-items:center; margin-top:10px; font-size:14px; color:var(--viewer-text-muted); }
.volume-btn { min-height:44px; flex-shrink:0; padding:8px 0; border:0; background:transparent; color:var(--viewer-link); font:inherit; cursor:pointer; }
.volume-slider { min-width:0; flex:1; min-height:44px; accent-color:var(--viewer-link); }
.variant-audios { display:grid; gap:16px; }
.variant-item { display:grid; gap:8px; min-width:0; }
.variant-label {font-size:14px;color:var(--viewer-text-muted);}
.audio-error { margin:8px 0 0; font-size:14px; color:var(--viewer-primary); }
.volume-btn:focus-visible {outline:3px solid var(--viewer-link);outline-offset:3px;}
summary:focus-visible {outline:3px solid var(--viewer-link);outline-offset:3px;}
@media(max-width:767px) { .audio-grid{grid-template-columns:1fr;gap:22px}.audio-block:last-child{grid-column:auto} }
</style>
