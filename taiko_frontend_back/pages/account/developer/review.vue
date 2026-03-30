<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { formatViewerTitle } from "~/composables/useViewerSeo";

type ReviewApplication = {
  id: number;
  replyEmail: string;
  reason: string;
  imageUrls: string[];
  status: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
  applicant?: {
    id: number;
    username: string;
    email: string;
  };
  reviewer?: {
    id: number;
    username: string;
    email: string;
  } | null;
};

type ReviewPayload = {
  pending: ReviewApplication[];
  history: ReviewApplication[];
  forbidden?: boolean;
  message?: string;
};

const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined;
const processingId = ref<number | null>(null);

const pageMeta = {
  title: "开发者审批",
  desc: "审批开发者权限申请，并签发可读取完整 JSON 的开发者 Token。"
};

definePageMeta({
  middleware: "account-auth",
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/account/developer/review",
  breadcrumbs: [
    { label: "账号系统", to: "/account/profile" },
    { label: "开发者权限", to: "/account/developer" },
    { label: "开发者审批", to: "/account/developer/review" }
  ]
});

useSeoMeta({
  title: formatViewerTitle(pageMeta.title),
  description: pageMeta.desc,
  ogTitle: formatViewerTitle(pageMeta.title),
  ogDescription: pageMeta.desc
});

const { data, pending, refresh } = await useAsyncData<ReviewPayload>(
  "account-developer-review",
  async () => {
    try {
      return await $fetch("/api/account/developer/review", { headers });
    } catch (error: any) {
      return {
        pending: [],
        history: [],
        forbidden: true,
        message: error?.data?.statusMessage || error?.message || "无权访问审批台"
      };
    }
  },
  {
    default: () => ({
      pending: [],
      history: []
    })
  }
);

const reviewState = computed(() => data.value);

const handleApprove = async (application: ReviewApplication) => {
  if (processingId.value) return;
  let reviewNote = "";
  try {
    const result = await ElMessageBox.prompt("可填写审批备注（选填）", `通过申请 #${application.id}`, {
      confirmButtonText: "通过",
      cancelButtonText: "取消",
      inputPlaceholder: "例如：请注意控制调用频率"
    });
    reviewNote = String(result.value || "").trim();
  } catch {
    return;
  }
  processingId.value = application.id;
  try {
    const result = await $fetch<{
      issuedToken: string | null;
      mailDelivered: boolean;
    }>("/api/account/developer/review", {
      method: "POST",
      body: {
        applicationId: application.id,
        action: "approve",
        reviewNote
      }
    });
    const message = result.mailDelivered
      ? `审批已通过，Token 已发往 ${application.replyEmail}`
      : "审批已通过，但邮件发送失败，请手动保存本次签发的 Token";
    ElMessage.success(message);
    if (result.issuedToken) {
      await ElMessageBox.alert(
        `本次签发 Token：${result.issuedToken}\n${result.mailDelivered ? "邮件已发送给申请人。" : "邮件发送失败，请你手动转交申请人。"}`,
        "审批完成",
        {
          confirmButtonText: "知道了"
        }
      );
    }
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "审批通过失败");
  } finally {
    processingId.value = null;
  }
};

const handleReject = async (application: ReviewApplication) => {
  if (processingId.value) return;
  let reviewNote = "";
  try {
    const result = await ElMessageBox.prompt("请输入不通过理由", `驳回申请 #${application.id}`, {
      confirmButtonText: "驳回",
      cancelButtonText: "取消",
      inputPlaceholder: "例如：当前用途描述不足，请补充接入场景",
      inputValidator: (value) => (String(value || "").trim() ? true : "请填写不通过理由")
    });
    reviewNote = String(result.value || "").trim();
  } catch {
    return;
  }
  processingId.value = application.id;
  try {
    await $fetch("/api/account/developer/review", {
      method: "POST",
      body: {
        applicationId: application.id,
        action: "reject",
        reviewNote
      }
    });
    ElMessage.success("申请已驳回");
    await refresh();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || "驳回失败");
  } finally {
    processingId.value = null;
  }
};
</script>

<template>
  <div class="developer-review-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <template v-else-if="reviewState.forbidden">
      <el-result icon="warning" title="无权访问开发者审批台" :sub-title="reviewState.message || '当前账号不是审批人'" />
    </template>

    <template v-else>
      <el-card class="panel-card">
        <div class="section-title">
          <h2>待审批申请</h2>
          <p>只有 `sigaer` 可访问此页面。审批通过后将自动签发 24 位开发者 Token。</p>
        </div>
        <el-empty v-if="!reviewState.pending.length" description="当前没有待审批的申请" />
        <div v-else class="application-list">
          <article v-for="application in reviewState.pending" :key="application.id" class="application-item">
            <div class="application-item__head">
              <div>
                <strong>#{{ application.id }} · {{ application.applicant?.username || "未知用户" }}</strong>
                <p>{{ application.applicant?.email || "-" }} · {{ application.replyEmail }}</p>
              </div>
              <span>{{ new Date(application.createdAt).toLocaleString() }}</span>
            </div>
            <p class="application-item__reason">{{ application.reason }}</p>
            <div v-if="application.imageUrls.length" class="image-preview-grid">
              <a
                v-for="url in application.imageUrls"
                :key="url"
                :href="url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img :src="url" alt="开发者申请截图" />
              </a>
            </div>
            <div class="application-item__actions">
              <el-button
                type="success"
                :loading="processingId === application.id"
                @click="handleApprove(application)"
              >
                通过
              </el-button>
              <el-button
                type="danger"
                plain
                :loading="processingId === application.id"
                @click="handleReject(application)"
              >
                驳回
              </el-button>
            </div>
          </article>
        </div>
      </el-card>

      <el-card class="panel-card">
        <div class="section-title">
          <h3>审批历史</h3>
          <p>最近处理过的开发者申请会保留在这里。</p>
        </div>
        <el-empty v-if="!reviewState.history.length" description="暂无审批历史" />
        <div v-else class="history-list">
          <div v-for="item in reviewState.history" :key="item.id" class="history-item">
            <div class="history-item__head">
              <strong>#{{ item.id }} · {{ item.applicant?.username || "未知用户" }}</strong>
              <span>{{ item.status }}</span>
            </div>
            <p>{{ item.replyEmail }}</p>
            <p v-if="item.reviewNote" class="history-item__note">{{ item.reviewNote }}</p>
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.developer-review-page {
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

.application-list,
.history-list {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.application-item,
.history-item {
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.82);
}

.application-item__head,
.history-item__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.application-item__head p,
.history-item p {
  margin: 6px 0 0;
  color: #7d6a5a;
}

.application-item__reason,
.history-item__note {
  margin: 12px 0 0;
  line-height: 1.8;
  white-space: pre-wrap;
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.image-preview-grid a {
  display: block;
}

.image-preview-grid img {
  width: 100%;
  border-radius: 12px;
  display: block;
}

.application-item__actions {
  display: flex;
  gap: 12px;
  margin-top: 14px;
}
</style>
