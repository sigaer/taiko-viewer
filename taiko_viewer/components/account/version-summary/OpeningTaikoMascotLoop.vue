<script setup lang="ts">
import FrameSequencePlayer from "./FrameSequencePlayer.vue";

withDefaults(defineProps<{
  active: boolean;
  reducedMotion: boolean;
  saveData?: boolean;
}>(), { saveData: false });
</script>

<template>
  <FrameSequencePlayer
    src-dir="/Loop"
    :frame-count="49"
    :fps="12"
    :loop="true"
    :active="active"
    :reduced-motion="reducedMotion"
    :save-data="saveData"
    alt=""
  />
</template>
