<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryViewModel } from "~/types/account-version-summary";
import AnnualArtworkFallback from "../AnnualArtworkFallback.vue";
import AnnualFavoriteShiftGinkgoScene from "../AnnualFavoriteShiftGinkgoScene.vue";
import { hasUsableText, isUsableMetric } from "~/utils/annualPresentation";

const props = defineProps<{
  summary: VersionSummaryViewModel;
  pageIndex: number;
  pageTotal: number;
  active: boolean;
  reducedMotion: boolean;
}>();

const formatter = new Intl.NumberFormat("zh-CN");
const favoriteShift = computed(() => props.summary.favoriteShift);
const safeSongName = (value: unknown) => hasUsableText(value)
  && !["undefined", "null", "nan"].includes(value.trim().toLowerCase())
  ? value.trim()
  : "这首歌";
const safeCoverUrl = (value: unknown) => hasUsableText(value)
  && !["undefined", "null"].includes(value.trim().toLowerCase())
  ? value.trim()
  : "";
const formatPlayCount = (value: unknown) => isUsableMetric(value)
  ? formatter.format(Math.round(value))
  : "";

const oldSongName = computed(() => safeSongName(favoriteShift.value?.oldFavorite.name));
const newSongName = computed(() => safeSongName(favoriteShift.value?.newFavorite.name));
const oldCoverUrl = computed(() => safeCoverUrl(favoriteShift.value?.oldFavorite.coverUrl));
const newCoverUrl = computed(() => safeCoverUrl(favoriteShift.value?.newFavorite.coverUrl));
const oldPlayCountText = computed(() => formatPlayCount(favoriteShift.value?.oldFavorite.playCount));
const newPlayCountText = computed(() => formatPlayCount(favoriteShift.value?.newFavorite.playCount));
</script>

<template>
  <AnnualFavoriteShiftGinkgoScene
    v-if="favoriteShift"
    :active="active"
    :reduced-motion="reducedMotion"
    :old-song-name="oldSongName"
    :old-play-count-text="oldPlayCountText"
    :new-song-name="newSongName"
    :new-play-count-text="newPlayCountText"
  >
    <template #oldCover>
      <el-image v-if="oldCoverUrl" :src="oldCoverUrl" :alt="oldSongName" fit="cover">
        <template #error>
          <AnnualArtworkFallback label="歌曲封面" />
        </template>
      </el-image>
      <AnnualArtworkFallback v-else label="歌曲封面" />
    </template>

    <template #newCover>
      <el-image v-if="newCoverUrl" :src="newCoverUrl" :alt="newSongName" fit="cover">
        <template #error>
          <AnnualArtworkFallback label="歌曲封面" />
        </template>
      </el-image>
      <AnnualArtworkFallback v-else label="歌曲封面" />
    </template>
  </AnnualFavoriteShiftGinkgoScene>
</template>
