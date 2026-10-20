<script setup lang="ts">
import { nextTick } from 'vue';
const props = defineProps<{ tracks: Array<{key:string;label:string;star:string}>; modelValue:string }>();
const emit = defineEmits<{ 'update:modelValue': [value:string] }>();
const { locale } = useI18n();
const onKeydown = async (event:KeyboardEvent, index:number) => {
  let next:number;
  if(event.key==='Home') next=0;
  else if(event.key==='End') next=props.tracks.length-1;
  else if(event.key==='ArrowRight') next=(index+1)%props.tracks.length;
  else if(event.key==='ArrowLeft') next=(index-1+props.tracks.length)%props.tracks.length;
  else return;
  event.preventDefault();emit('update:modelValue',props.tracks[next].key);
  await nextTick();document.getElementById(`song-track-${props.tracks[next].key}`)?.focus();
};
</script>
<template>
  <div class="difficulty-tabs" role="tablist" :aria-label="locale==='ja'?'譜面の難易度':'谱面难度'">
    <button v-for="(track,index) in tracks" :id="`song-track-${track.key}`" :key="track.key" type="button" role="tab" class="difficulty-tab" :aria-selected="modelValue===track.key" :tabindex="modelValue===track.key?0:-1" aria-controls="song-chart-workspace" :data-track="track.key" @click="emit('update:modelValue',track.key)" @keydown="onKeydown($event,index)">
      <span>{{ track.label }}</span><span class="difficulty-star">{{ track.star }}</span>
    </button>
  </div>
</template>
<style scoped>
.difficulty-tabs { display:flex; gap:26px; border-bottom:1px solid var(--viewer-border); margin:30px 0 28px; }
.difficulty-tab { display:flex; align-items:center; justify-content:center; gap:8px; min-height:54px; padding:10px 10px 13px; color:var(--viewer-text); font:inherit; font-size:15px; background:transparent; border:0; border-bottom:3px solid transparent; cursor:pointer; }
.difficulty-star {font-size:14px;font-weight:400;}
.difficulty-tab[aria-selected=true] { color:var(--viewer-primary); border-bottom-color:var(--viewer-primary); font-weight:600; }
.difficulty-tab:hover {background:var(--viewer-surface-subtle);}
.difficulty-tab:focus-visible {outline:3px solid var(--viewer-link);outline-offset:3px;}
@media(max-width:767px){.difficulty-tabs{gap:0;margin:20px 0 24px}.difficulty-tab{flex:1;min-width:0;flex-direction:column;gap:4px;padding:8px 0 11px;font-size:14px;line-height:1.5}.difficulty-star{font-size:14px}}
@media(prefers-reduced-motion:no-preference){.difficulty-tab{transition:color 120ms ease,background-color 120ms ease;}}
</style>
