<script setup lang="ts">
import { computed } from "vue";
import type { VersionSummaryAvailableVersion, VersionSummaryBinding, VersionSummaryViewModel } from "~/types/account-version-summary";

const props = defineProps<{
  modelValue: boolean;
  summary: VersionSummaryViewModel;
  selectedVersion: VersionSummaryAvailableVersion;
  currentBinding: VersionSummaryBinding | null;
  bindings: VersionSummaryBinding[];
  selectedBindingId: number | null;
  switchingBindingId: number | null;
  manualRefreshing: boolean;
  storyStarted: boolean;
  localeCode: "zh" | "ja";
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "change-binding": [bindingId: number | null];
  refresh: [];
  exit: [];
}>();

const uiText = computed(() =>
  props.localeCode === "ja"
    ? {
        title: "ストーリー設定",
        versionLabel: "対象バージョン",
        bindingLabel: "連携 ID",
        titleLabel: "現在の称号",
        refresh: "再生成",
        exit: "入口へ戻る",
        summaryLabel: "この版のメモ",
        summaryText: `${props.summary.overview.playCount} 回 / ${props.summary.period.activeDays} 日 / ${props.summary.overview.uniqueSongs} 曲`
      }
    : {
        title: "故事设置",
        versionLabel: "统计版本",
        bindingLabel: "当前绑定",
        titleLabel: "当前称号",
        refresh: "重新生成",
        exit: "回到入口",
        summaryLabel: "这一版的记忆",
        summaryText: `${props.summary.overview.playCount} 次 / ${props.summary.period.activeDays} 天 / ${props.summary.overview.uniqueSongs} 首歌`
      }
);

const versionRangeText = computed(() =>
  props.summary.version.isOngoing
    ? `${props.summary.version.startDate} - ${props.summary.version.effectiveEndDate}`
    : `${props.summary.version.startDate} - ${props.summary.version.endDate || props.summary.version.effectiveEndDate}`
);

const bindingOptionLabel = (binding: VersionSummaryBinding) => {
  const title = String(binding.currentTitle || binding.verifiedTitle || "").trim();
  return title ? `${binding.taikoId} · ${title}` : binding.taikoId;
};
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    size="min(420px, 92vw)"
    :with-header="false"
    :append-to-body="true"
    custom-class="story-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="story-drawer__body">
      <div class="story-drawer__head">
        <div>
          <p>{{ uiText.title }}</p>
          <h3>{{ selectedVersion.name }}</h3>
        </div>
        <span>{{ versionRangeText }}</span>
      </div>

      <div class="story-drawer__panel">
        <span>{{ uiText.versionLabel }}</span>
        <strong>{{ selectedVersion.name }}</strong>
      </div>

      <div class="story-drawer__panel">
        <span>{{ uiText.bindingLabel }}</span>
        <el-select
          :model-value="selectedBindingId"
          class="story-drawer__select"
          :disabled="!bindings.length || Boolean(switchingBindingId)"
          @change="emit('change-binding', $event)"
        >
          <el-option
            v-for="binding in bindings"
            :key="binding.id"
            :label="bindingOptionLabel(binding)"
            :value="binding.id"
          />
        </el-select>
      </div>

      <div v-if="currentBinding?.currentTitle" class="story-drawer__panel">
        <span>{{ uiText.titleLabel }}</span>
        <strong>{{ currentBinding.currentTitle }}</strong>
      </div>

      <div class="story-drawer__panel story-drawer__panel--soft">
        <span>{{ uiText.summaryLabel }}</span>
        <strong>{{ uiText.summaryText }}</strong>
      </div>

      <div class="story-drawer__actions">
        <el-button type="primary" :loading="manualRefreshing" @click="emit('refresh')">
          {{ uiText.refresh }}
        </el-button>
        <el-button v-if="storyStarted" @click="emit('exit')">
          {{ uiText.exit }}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
:deep(.story-drawer) {
  background: linear-gradient(180deg, rgba(9, 19, 44, 0.98) 0%, rgba(18, 15, 37, 0.98) 100%);
  color: #fff4df;
}

:deep(.story-drawer .el-drawer__body) {
  padding: 0;
}

.story-drawer__body {
  min-height: 100%;
  padding: 28px 22px;
  display: grid;
  gap: 16px;
  background:
    radial-gradient(circle at top right, rgba(255, 174, 95, 0.18), transparent 34%),
    linear-gradient(180deg, rgba(9, 19, 44, 0.96) 0%, rgba(20, 14, 40, 0.98) 100%);
}

.story-drawer__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.story-drawer__head p,
.story-drawer__panel span {
  margin: 0 0 8px;
  color: rgba(255, 230, 196, 0.68);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.story-drawer__head h3 {
  margin: 0;
  font-family: var(--viewer-display-font);
  font-size: 34px;
  line-height: 1;
}

.story-drawer__head > span {
  color: rgba(255, 240, 218, 0.7);
  font-size: 12px;
}

.story-drawer__panel {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.story-drawer__panel strong {
  display: block;
  color: #fff8ed;
  font-size: 18px;
  line-height: 1.5;
}

.story-drawer__panel--soft {
  background: linear-gradient(135deg, rgba(255, 117, 76, 0.12), rgba(255, 193, 94, 0.12));
}

.story-drawer__select :deep(.el-input__wrapper) {
  min-height: 44px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.story-drawer__select :deep(.el-input__inner) {
  color: #fff7eb;
}

.story-drawer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
}

.story-drawer__actions :deep(.el-button) {
  min-width: 140px;
  border-radius: 999px;
}

@media (max-width: 720px) {
  .story-drawer__body {
    padding: 24px 16px;
  }

  .story-drawer__head {
    flex-direction: column;
    align-items: start;
  }
}
</style>
