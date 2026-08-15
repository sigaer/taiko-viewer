<script setup lang="ts">
import { computed, ref } from "vue";
import type { VersionSummaryAvailableVersion, VersionSummaryBinding, VersionSummaryViewModel } from "~/types/account-version-summary";

const props = defineProps<{
  modelValue: boolean;
  summary: VersionSummaryViewModel;
  selectedVersion: VersionSummaryAvailableVersion;
  currentBinding: VersionSummaryBinding | null;
  bindings: VersionSummaryBinding[];
  selectedBindingId: number | null;
  switchingBindingId: number | null;
  storyStarted: boolean;
  localeCode: "zh" | "ja";
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "change-binding": [bindingId: number | null];
  exit: [];
}>();

const { t, n } = useI18n();
const exitPending = ref(false);
const uiText = computed(() => ({
  title: t("annualSummary.drawer.title"),
  versionLabel: t("annualSummary.drawer.version"),
  bindingLabel: t("annualSummary.drawer.binding"),
  titleLabel: t("annualSummary.drawer.currentTitle"),
  exit: t("annualSummary.drawer.exit"),
  summaryLabel: t("annualSummary.drawer.summary"),
  summaryText: `${n(props.summary.overview.playCount)} · ${n(props.summary.overview.uniqueSongs)} · ${n(props.summary.overview.uniqueCharts || 0)}`
}));

const versionRangeText = computed(() =>
  props.summary.version.isOngoing
    ? `${props.summary.version.startDate} - ${props.summary.version.effectiveEndDate}`
    : `${props.summary.version.startDate} - ${props.summary.version.endDate || props.summary.version.effectiveEndDate}`
);

const bindingOptionLabel = (binding: VersionSummaryBinding) => {
  const title = String(binding.currentTitle || binding.verifiedTitle || "").trim();
  return title ? `${binding.taikoId} · ${title}` : binding.taikoId;
};

const requestExit = () => {
  exitPending.value = true;
  emit("update:modelValue", false);
};

const handleClosed = () => {
  if (!exitPending.value) return;
  exitPending.value = false;
  emit("exit");
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
    @closed="handleClosed"
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
        <el-button v-if="storyStarted" @click="requestExit">
          {{ uiText.exit }}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
:deep(.story-drawer) {
  background: linear-gradient(180deg, #f7fbff 0%, #e5f1ff 100%);
  color: #17365d;
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
    radial-gradient(circle at top right, rgba(57, 120, 200, 0.16), transparent 34%),
    linear-gradient(180deg, #f7fbff 0%, #e5f1ff 100%);
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
  color: #7890ab;
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
  color: #7890ab;
  font-size: 12px;
}

.story-drawer__panel {
  padding: 16px;
  border-radius: 22px;
  background: rgba(247, 251, 255, 0.78);
  border: 1px solid rgba(57, 120, 200, 0.16);
}

.story-drawer__panel strong {
  display: block;
  color: #17365d;
  font-size: 18px;
  line-height: 1.5;
}

.story-drawer__panel--soft {
  background: linear-gradient(135deg, rgba(57, 120, 200, 0.1), rgba(229, 241, 255, 0.82));
}

.story-drawer__select :deep(.el-input__wrapper) {
  min-height: 44px;
  border-radius: 14px;
  background: #f7fbff;
  box-shadow: inset 0 0 0 1px rgba(57, 120, 200, 0.16);
}

.story-drawer__select :deep(.el-input__inner) {
  color: #17365d;
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
