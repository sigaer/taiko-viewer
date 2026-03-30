<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { formatViewerTitle } from "~/composables/useViewerSeo";

type BindingSummary = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  createdAt: string;
  updatedAt: string;
};

type SyncResult = {
  targetId: string;
  label: string;
  ok: boolean;
  statusCode: number;
  message: string;
  receivedBytes: number;
  decompressedBytes: number;
  songCount: number | null;
};

type SyncLog = {
  id: number;
  taikoId: string;
  status: string;
  targetIds: string[];
  results: SyncResult[];
  originalBytes: number;
  compressedBytes: number;
  createdAt: string;
  updatedAt: string;
};

type SyncOverviewPayload = {
  currentBinding: BindingSummary | null;
  targets: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  cooldownRemainingSeconds: number;
  cooldownUntil: string;
  lastSync: SyncLog | null;
};

const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

const pageMeta = {
  title: "多端同步",
  desc: "将当前绑定 ID 的完整成绩 JSON 压缩后分发到选中的服务目标。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/sync",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "多端同步", to: "/account/sync" }
  ]
});

useSeoMeta({
  title: formatViewerTitle(pageMeta.title),
  description: pageMeta.desc,
  ogTitle: formatViewerTitle(pageMeta.title),
  ogDescription: pageMeta.desc
});

const selectedTargetIds = ref<string[]>([]);
const submitting = ref(false);
const cooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

const { data, pending, refresh } = await useAsyncData<SyncOverviewPayload>(
  "account-sync-overview",
  () => $fetch("/api/account/sync/targets", { headers }),
  {
    default: () => ({
      currentBinding: null,
      targets: [],
      cooldownRemainingSeconds: 0,
      cooldownUntil: "",
      lastSync: null
    })
  }
);

const overview = computed(() => data.value);
const compressionRatio = computed(() => {
  const log = overview.value?.lastSync;
  if (!log?.originalBytes) return "";
  return `${((log.compressedBytes / log.originalBytes) * 100).toFixed(1)}%`;
});

const startCooldown = (seconds: number) => {
  cooldown.value = Math.max(0, seconds);
  if (cooldownTimer) clearInterval(cooldownTimer);
  if (cooldown.value <= 0) return;
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 1000);
};

watch(
  () => overview.value?.cooldownRemainingSeconds || 0,
  (value) => startCooldown(value),
  { immediate: true }
);

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
});

const submitSync = async () => {
  if (submitting.value) return;
  if (!selectedTargetIds.value.length) {
    ElMessage.warning("请先勾选至少一个同步目标");
    return;
  }
  submitting.value = true;
  try {
    await $fetch("/api/account/sync", {
      method: "POST",
      body: {
        targetIds: selectedTargetIds.value
      }
    });
    ElMessage.success("同步请求已提交");
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "同步失败");
    await refresh();
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="sync-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <template v-else>
      <el-card class="panel-card">
        <div class="section-title">
          <h2>多端同步</h2>
          <p>当前只同步“当前绑定 ID”的完整 `userdata` JSON，提交后会进入 30 分钟冷却。</p>
        </div>
        <div v-if="overview.currentBinding" class="binding-meta">
          <div>
            <span>当前绑定 ID</span>
            <strong>{{ overview.currentBinding.taikoId }}</strong>
          </div>
          <div>
            <span>当前称号</span>
            <strong>{{ overview.currentBinding.verifiedTitle || "-" }}</strong>
          </div>
          <div>
            <span>冷却状态</span>
            <strong>{{ cooldown > 0 ? `剩余 ${cooldown}s` : "可立即同步" }}</strong>
          </div>
        </div>
        <el-empty v-else description="请先绑定鼓众 ID 后再使用多端同步" />
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>同步目标</h3>
          <p>勾选后会将完整成绩数据压缩并分发到对应服务。</p>
        </div>
        <el-empty v-if="!overview.targets.length" description="当前没有可用的同步目标" />
        <el-checkbox-group v-else v-model="selectedTargetIds" class="target-list">
          <label v-for="target in overview.targets" :key="target.id" class="target-item">
            <el-checkbox :label="target.id">
              <span class="target-label">{{ target.label }}</span>
            </el-checkbox>
            <p>{{ target.description }}</p>
          </label>
        </el-checkbox-group>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!overview.currentBinding || cooldown > 0 || !overview.targets.length"
          @click="submitSync"
        >
          {{ cooldown > 0 ? `冷却中 ${cooldown}s` : "开始同步" }}
        </el-button>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>最近一次同步</h3>
          <p>展示最近一次同步请求的压缩体积和逐目标返回结果。</p>
        </div>
        <el-empty v-if="!overview.lastSync" description="还没有同步记录" />
        <template v-else>
          <div class="last-sync-meta">
            <div>
              <span>同步时间</span>
              <strong>{{ new Date(overview.lastSync.createdAt).toLocaleString() }}</strong>
            </div>
            <div>
              <span>整体状态</span>
              <strong>{{ overview.lastSync.status }}</strong>
            </div>
            <div>
              <span>压缩体积</span>
              <strong>{{ overview.lastSync.compressedBytes }} / {{ overview.lastSync.originalBytes }} bytes</strong>
            </div>
            <div>
              <span>压缩比例</span>
              <strong>{{ compressionRatio || "-" }}</strong>
            </div>
          </div>
          <div class="result-list">
            <div v-for="result in overview.lastSync.results" :key="`${overview.lastSync.id}-${result.targetId}`" class="result-item">
              <div class="result-item__head">
                <strong>{{ result.label }}</strong>
                <el-tag :type="result.ok ? 'success' : 'danger'" effect="light">
                  {{ result.ok ? "成功" : "失败" }}
                </el-tag>
              </div>
              <p>HTTP {{ result.statusCode }} · {{ result.message }}</p>
            </div>
          </div>
        </template>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.sync-page {
  display: grid;
  gap: 18px;
}

.section-title h2,
.section-title h3 {
  margin: 0;
}

.section-title p {
  margin: 8px 0 0;
  color: #7d6a5a;
  line-height: 1.8;
}

.binding-meta,
.last-sync-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.binding-meta div,
.last-sync-meta div {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.82);
}

.binding-meta span,
.last-sync-meta span {
  color: #7d6a5a;
  font-size: 13px;
}

.target-list {
  display: grid;
  gap: 12px;
  margin: 18px 0;
}

.target-item {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.82);
}

.target-item p,
.result-item p {
  margin: 0;
  color: #7d6a5a;
  line-height: 1.7;
}

.target-label {
  font-weight: 600;
}

.result-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.result-item {
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.82);
}

.result-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
</style>
