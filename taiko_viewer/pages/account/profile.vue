<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadFile, UploadInstance, UploadRawFile } from "element-plus";
import { buildPageDescription } from "~/utils/seo";

const { t, locale } = useI18n();
const apiFetch = useViewerApiFetch();
const { formatDateTime } = useViewerDateTime();
const { accountUser, fetchCurrentUser } = useAccountState();
await fetchCurrentUser();

definePageMeta({
  middleware: "account-auth",
  pageTitleKey: "account.profile",
  pageDescKey: "page.account.profile.desc",
  navKey: "/account/profile",
  breadcrumbs: [
    { labelKey: "account.title", to: "/account/profile" },
    { labelKey: "account.profile", to: "/account/profile" }
  ]
});

useViewerSeo(() => ({
  title: t("account.profile"),
  description: buildPageDescription(t("page.account.profile.desc")),
  path: "/account/profile"
}));

type ProfilePayload = {
  user: {
    id: number;
    username: string;
    email: string;
    emailVerified: boolean;
    avatarUrl: string;
    createdAt: string;
  };
  bindings: Array<{
    id: number;
    taikoId: string;
    isCurrent: boolean;
    verifiedTitle: string | null;
    verifiedTitleplateId: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  currentBinding: {
    id: number;
    taikoId: string;
    isCurrent: boolean;
    verifiedTitle: string | null;
    verifiedTitleplateId: number | null;
    currentTitle?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  pendingBinding: {
    taikoId: string;
    originalTitle: string;
    originalTitleplateId: number;
    expiresAt: string;
  } | null;
  verificationStatus: {
    emailVerified: boolean;
    taikoVerified: boolean;
  };
};

const myDonTick = ref(0);
const myDonErrored = ref(false);
const bindingInput = ref("");
const preparing = ref(false);
const confirming = ref(false);
const switchingId = ref<number | null>(null);
const deletingId = ref<number | null>(null);
const uploading = ref(false);
const removingAvatar = ref(false);
const avatarUploadRef = ref<UploadInstance>();
const avatarCropVisible = ref(false);
const avatarCropSourceUrl = ref("");
const avatarCropFileName = ref("");

const copy = computed(() =>
  locale.value === "ja"
    ? {
        uploadAvatar: "アバターをアップロード",
        resetAvatar: "デフォルトに戻す",
        emailVerified: "メール認証",
        taikoVerified: "ドンダーひろば ID 認証",
        verified: "認証済み",
        unverified: "未認証",
        currentBinding: "現在の連携 ID",
        currentTitle: "現在の称号",
        createdAt: "登録日時",
        unbound: "未連携",
        bindTitle: "ドンダーひろば ID を連携",
        bindDesc: "新しい ID を入力すると現在の称号を記録します。称号変更後に確認すると連携が完了します。",
        bindPlaceholder: "ドンダーひろば ID を入力",
        startVerify: "認証開始",
        pendingId: "確認待ち ID",
        pendingTitle: "記録した称号",
        emptyTitle: "（空）",
        expiresAt: "有効期限",
        confirmBinding: "称号変更済み。今すぐ確認",
        noBindings: "認証済みのドンダーひろば ID はまだありません",
        currentUsing: "現在使用中",
        switchCurrent: "現在の ID に切り替え",
        deleteBinding: "連携を削除",
        myDon: "マイドン",
        myDonNeedBinding: "先にドンダーひろば ID を連携してください",
        myDonFailed: "マイドンの生成に失敗しました。しばらくしてから再試行してください。",
        avatarUpdated: "アバターを更新しました",
        avatarUploadFailed: "アバター更新に失敗しました",
        avatarReset: "アバターをデフォルトに戻しました",
        avatarDeleteFailed: "アバター削除に失敗しました",
        avatarCropTitle: "アバターを調整",
        avatarCropHint: "画像をドラッグして表示位置を調整できます。",
        avatarCropWheelHint: "スライダーまたはマウスホイールで拡大率を変更できます。",
        avatarCropZoom: "拡大率",
        avatarCropConfirm: "この内容で保存",
        avatarCropLoadFailed: "画像の読み込みに失敗しました。別の画像を選択してください。",
        avatarCropFailed: "アバターの切り抜きに失敗しました",
        prepareFailed: "連携認証の開始に失敗しました",
        confirmSuccess: "連携完了。現在の ID を切り替えました",
        confirmFailed: "連携確認に失敗しました",
        switchSuccess: "現在の連携 ID を切り替えました",
        switchFailed: "連携切り替えに失敗しました",
        deleteSuccess: "連携を削除しました",
        deleteFailed: "連携削除に失敗しました",
        deleteConfirmTitle: "連携削除",
        deleteConfirm: "ドンダーひろば ID {id} の連携を削除しますか？",
        deleteConfirmButton: "削除",
        lastBindingTitle: "再確認",
        lastBindingConfirm: "これは最後のドンダーひろば ID です。削除すると現在の連携、マイドン、楽曲データ入口が未連携になります。削除しますか？",
        lastBindingButton: "最後の連携を削除"
      }
    : {
        uploadAvatar: "上传头像",
        resetAvatar: "恢复默认",
        emailVerified: "邮箱认证",
        taikoVerified: "鼓众 ID 认证",
        verified: "已验证",
        unverified: "未验证",
        currentBinding: "当前绑定 ID",
        currentTitle: "当前称号",
        createdAt: "注册时间",
        unbound: "未绑定",
        bindTitle: "绑定鼓众广场 ID",
        bindDesc: "输入新的鼓众 ID 后，系统会记录你当前的称号，修改称号后再确认即可完成绑定。",
        bindPlaceholder: "输入鼓众广场 ID",
        startVerify: "开始验证",
        pendingId: "待确认 ID",
        pendingTitle: "记录称号",
        emptyTitle: "（空）",
        expiresAt: "到期时间",
        confirmBinding: "我已修改称号，立即确认",
        noBindings: "当前还没有已验证的鼓众 ID",
        currentUsing: "当前使用",
        switchCurrent: "切换为当前",
        deleteBinding: "删除绑定",
        myDon: "我的小咚",
        myDonNeedBinding: "请先绑定鼓众广场 ID",
        myDonFailed: "我的小咚生成失败，请稍后重试",
        avatarUpdated: "头像已更新",
        avatarUploadFailed: "头像上传失败",
        avatarReset: "头像已恢复默认",
        avatarDeleteFailed: "头像删除失败",
        avatarCropTitle: "调整头像",
        avatarCropHint: "拖动图片可以调整圆形头像中的显示区域。",
        avatarCropWheelHint: "可用滑块或鼠标滚轮缩放图片。",
        avatarCropZoom: "缩放",
        avatarCropConfirm: "按当前裁剪保存",
        avatarCropLoadFailed: "图片加载失败，请重新选择",
        avatarCropFailed: "头像裁剪失败",
        prepareFailed: "绑定验证启动失败",
        confirmSuccess: "绑定成功，当前已切换到该 ID",
        confirmFailed: "绑定确认失败",
        switchSuccess: "当前绑定 ID 已切换",
        switchFailed: "绑定切换失败",
        deleteSuccess: "绑定已删除",
        deleteFailed: "绑定删除失败",
        deleteConfirmTitle: "删除绑定",
        deleteConfirm: "确定删除绑定的鼓众 ID {id} 吗？",
        deleteConfirmButton: "删除",
        lastBindingTitle: "二次确认",
        lastBindingConfirm: "这是你最后一个鼓众 ID。删除后，网页中的当前绑定、我的小咚和歌曲数据入口都会失去关联，请再次确认。",
        lastBindingButton: "确认删除最后一个绑定"
      }
);

const { data, pending, refresh } = await useAsyncData<ProfilePayload>(
  "account-profile",
  () => apiFetch("/api/account/profile"),
  {
    default: () => ({
      user: {
        id: 0,
        username: "",
        email: "",
        emailVerified: false,
        avatarUrl: "/default-avatar.svg",
        createdAt: ""
      },
      bindings: [],
      currentBinding: null,
      pendingBinding: null,
      verificationStatus: {
        emailVerified: false,
        taikoVerified: false
      }
    })
  }
);

const profile = computed(() => data.value);
const myDonUrl = computed(() => {
  if (!profile.value?.currentBinding) return "";
  return `/api/account/my-don?t=${myDonTick.value}`;
});

const refreshProfile = async () => {
  await refresh();
  await fetchCurrentUser(true);
  myDonTick.value += 1;
  myDonErrored.value = false;
};

const clearAvatarSelection = () => {
  if (avatarCropSourceUrl.value) {
    URL.revokeObjectURL(avatarCropSourceUrl.value);
  }
  avatarCropSourceUrl.value = "";
  avatarCropFileName.value = "";
  avatarUploadRef.value?.clearFiles();
};

const uploadAvatarFile = async (file: File) => {
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append("avatar", file);
    await apiFetch("/api/account/avatar", {
      method: "POST",
      body: formData
    });
    ElMessage.success(copy.value.avatarUpdated);
    await refreshProfile();
    return true;
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.avatarUploadFailed);
    return false;
  } finally {
    uploading.value = false;
  }
};

const handleAvatarSelect = (file: UploadFile) => {
  const raw = file.raw as UploadRawFile | undefined;
  if (!raw) {
    avatarUploadRef.value?.clearFiles();
    return;
  }
  clearAvatarSelection();
  avatarCropSourceUrl.value = URL.createObjectURL(raw);
  avatarCropFileName.value = raw.name || "avatar";
  avatarCropVisible.value = true;
};

const handleAvatarCropConfirm = async (payload: { blob: Blob; fileName: string }) => {
  const croppedFile = new File([payload.blob], payload.fileName, {
    type: payload.blob.type || "image/webp"
  });
  const uploaded = await uploadAvatarFile(croppedFile);
  if (!uploaded) return;
  avatarCropVisible.value = false;
};

const handleAvatarCropError = (message: string) => {
  ElMessage.error(message || copy.value.avatarCropFailed);
  avatarCropVisible.value = false;
};

const handleAvatarCropClosed = () => {
  clearAvatarSelection();
};

const removeAvatar = async () => {
  removingAvatar.value = true;
  try {
    await apiFetch("/api/account/avatar", {
      method: "DELETE"
    });
    ElMessage.success(copy.value.avatarReset);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.avatarDeleteFailed);
  } finally {
    removingAvatar.value = false;
  }
};

const prepareBinding = async () => {
  if (!bindingInput.value.trim() || preparing.value) return;
  preparing.value = true;
  try {
    const result = await apiFetch<{ message: string }>("/api/account/bindings/prepare", {
      method: "POST",
      body: { taikoId: bindingInput.value.trim() }
    });
    ElMessage.success(result.message);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.prepareFailed);
  } finally {
    preparing.value = false;
  }
};

const confirmBinding = async (taikoId?: string | null) => {
  const target = taikoId || profile.value?.pendingBinding?.taikoId;
  if (!target || confirming.value) return;
  confirming.value = true;
  try {
    await apiFetch("/api/account/bindings/confirm", {
      method: "POST",
      body: { taikoId: target }
    });
    ElMessage.success(copy.value.confirmSuccess);
    bindingInput.value = "";
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.confirmFailed);
  } finally {
    confirming.value = false;
  }
};

const switchBinding = async (bindingId: number) => {
  if (switchingId.value === bindingId) return;
  switchingId.value = bindingId;
  try {
    await apiFetch("/api/account/bindings/current", {
      method: "POST",
      body: { bindingId }
    });
    ElMessage.success(copy.value.switchSuccess);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.switchFailed);
  } finally {
    switchingId.value = null;
  }
};

const deleteBinding = async (binding: NonNullable<ProfilePayload["bindings"]>[number]) => {
  if (deletingId.value === binding.id) return;

  const isLastBinding = (profile.value?.bindings.length || 0) <= 1;
  try {
    await ElMessageBox.confirm(
      copy.value.deleteConfirm.replace("{id}", binding.taikoId),
      copy.value.deleteConfirmTitle,
      {
      type: "warning",
      confirmButtonText: copy.value.deleteConfirmButton,
      cancelButtonText: t("common.cancel")
    });

    if (isLastBinding) {
      await ElMessageBox.confirm(
        copy.value.lastBindingConfirm,
        copy.value.lastBindingTitle,
        {
          type: "error",
          confirmButtonText: copy.value.lastBindingButton,
          cancelButtonText: t("common.cancel")
        }
      );
    }
  } catch {
    return;
  }

  deletingId.value = binding.id;
  try {
    await apiFetch("/api/account/bindings/remove", {
      method: "POST",
      body: {
        bindingId: binding.id,
        force: isLastBinding
      }
    });
    ElMessage.success(copy.value.deleteSuccess);
    await refreshProfile();
  } catch (error: any) {
    ElMessage.error(error?.data?.statusMessage || error?.message || copy.value.deleteFailed);
  } finally {
    deletingId.value = null;
  }
};
</script>

<template>
  <div class="profile-page">
    <el-card v-if="pending" class="panel-card">
      <el-skeleton :rows="8" animated />
    </el-card>

    <template v-else-if="profile">
      <section class="profile-grid">
        <el-card class="panel-card profile-main-card">
          <div class="profile-main">
            <div class="avatar-block">
              <el-avatar :size="132" :src="profile.user.avatarUrl" class="profile-avatar">
                {{ profile.user.username.slice(0, 1) }}
              </el-avatar>
              <div class="avatar-actions">
                <el-upload
                  ref="avatarUploadRef"
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  :on-change="handleAvatarSelect"
                >
                  <el-button :loading="uploading">{{ copy.uploadAvatar }}</el-button>
                </el-upload>
                <el-button plain :loading="removingAvatar" @click="removeAvatar">{{ copy.resetAvatar }}</el-button>
              </div>
            </div>
            <div class="profile-info">
              <h2>{{ profile.user.username }}</h2>
              <p>{{ profile.user.email }}</p>
              <div class="status-list">
                <div class="status-chip" :class="profile.verificationStatus.emailVerified ? 'ok' : 'pending'">
                  <span>{{ copy.emailVerified }}</span>
                  <strong>{{ profile.verificationStatus.emailVerified ? copy.verified : copy.unverified }}</strong>
                </div>
                <div class="status-chip" :class="profile.verificationStatus.taikoVerified ? 'ok' : 'pending'">
                  <span>{{ copy.taikoVerified }}</span>
                  <strong>{{ profile.verificationStatus.taikoVerified ? copy.verified : copy.unverified }}</strong>
                </div>
              </div>
              <div class="meta-grid">
                <div>
                  <span>{{ copy.currentBinding }}</span>
                  <strong>{{ profile.currentBinding?.taikoId || copy.unbound }}</strong>
                </div>
                <div>
                  <span>{{ copy.currentTitle }}</span>
                  <strong>{{ profile.currentBinding?.currentTitle || "-" }}</strong>
                </div>
                <div>
                  <span>{{ copy.createdAt }}</span>
                  <strong>{{ formatDateTime(profile.user.createdAt) }}</strong>
                </div>
              </div>
            </div>
          </div>
        </el-card>

        <el-card class="panel-card binding-card">
          <div class="section-title">
            <h3>{{ copy.bindTitle }}</h3>
            <p>{{ copy.bindDesc }}</p>
          </div>
          <div class="bind-input-row">
            <el-input v-model="bindingInput" :placeholder="copy.bindPlaceholder" />
            <el-button type="primary" :loading="preparing" @click="prepareBinding">{{ copy.startVerify }}</el-button>
          </div>
          <div v-if="profile.pendingBinding" class="pending-box">
            <div>
              <strong>{{ copy.pendingId }}：</strong>{{ profile.pendingBinding.taikoId }}
            </div>
            <div>
              <strong>{{ copy.pendingTitle }}：</strong>{{ profile.pendingBinding.originalTitle || copy.emptyTitle }}
            </div>
            <div>
              <strong>{{ copy.expiresAt }}：</strong>{{ formatDateTime(profile.pendingBinding.expiresAt) }}
            </div>
            <el-button type="success" :loading="confirming" @click="confirmBinding()">{{ copy.confirmBinding }}</el-button>
          </div>
          <el-empty v-if="!profile.bindings.length" :description="copy.noBindings" />
          <div v-else class="binding-list">
            <div v-for="binding in profile.bindings" :key="binding.id" class="binding-item">
              <div>
                <strong>{{ binding.taikoId }}</strong>
                <p>{{ binding.verifiedTitle || "-" }}</p>
              </div>
              <div class="binding-actions">
                <el-button
                  :type="binding.isCurrent ? 'primary' : 'default'"
                  :loading="switchingId === binding.id"
                  @click="switchBinding(binding.id)"
                >
                  {{ binding.isCurrent ? copy.currentUsing : copy.switchCurrent }}
                </el-button>
                <el-button
                  type="danger"
                  plain
                  :loading="deletingId === binding.id"
                  @click="deleteBinding(binding)"
                >
                  {{ copy.deleteBinding }}
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </section>

      <el-card class="panel-card mydon-card">
        <div class="section-title">
          <h3>{{ copy.myDon }}</h3>
        </div>
        <div v-if="!profile.currentBinding" class="mydon-empty">
          <el-empty :description="copy.myDonNeedBinding" />
        </div>
        <div v-else-if="!myDonErrored" class="mydon-frame">
          <img :src="myDonUrl" alt="我的小咚" class="mydon-image" @error="myDonErrored = true" />
        </div>
        <div v-else class="mydon-empty">
          <el-empty :description="copy.myDonFailed" />
        </div>
      </el-card>

      <AccountAvatarCropperDialog
        v-model="avatarCropVisible"
        :source-url="avatarCropSourceUrl"
        :file-name="avatarCropFileName"
        :loading="uploading"
        :copy="{
          title: copy.avatarCropTitle,
          hint: copy.avatarCropHint,
          wheelHint: copy.avatarCropWheelHint,
          zoom: copy.avatarCropZoom,
          cancel: t('common.cancel'),
          confirm: copy.avatarCropConfirm,
          imageLoadFailed: copy.avatarCropLoadFailed,
          cropFailed: copy.avatarCropFailed
        }"
        @confirm="handleAvatarCropConfirm"
        @error="handleAvatarCropError"
        @closed="handleAvatarCropClosed"
      />
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  display: grid;
  gap: 18px;
}

.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
  gap: 18px;
}

.profile-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 22px;
  align-items: center;
}

.avatar-block {
  display: grid;
  gap: 14px;
  justify-items: center;
}

.avatar-actions {
  display: grid;
  gap: 10px;
}

.profile-info h2 {
  margin: 0;
  font-size: 30px;
}

.profile-info p {
  margin: 6px 0 18px;
  color: #7d6a5a;
}

.status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.status-chip {
  min-width: 150px;
  padding: 12px 14px;
  border-radius: 14px;
  display: grid;
  gap: 4px;
}

.status-chip.ok {
  background: rgba(121, 197, 135, 0.16);
}

.status-chip.pending {
  background: rgba(233, 174, 77, 0.16);
}

.status-chip span,
.meta-grid span {
  color: #7d6a5a;
  font-size: 13px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.meta-grid div {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.8);
  display: grid;
  gap: 4px;
}

.section-title h3 {
  margin: 0;
  font-size: 22px;
}

.section-title p {
  margin: 6px 0 16px;
  color: #7d6a5a;
  line-height: 1.7;
}

.bind-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 14px;
}

.pending-box {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 247, 218, 0.8);
  margin-bottom: 14px;
}

.binding-list {
  display: grid;
  gap: 12px;
}

.binding-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 248, 240, 0.78);
}

.binding-item p {
  margin: 6px 0 0;
  color: #7d6a5a;
}

.binding-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.mydon-frame {
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 244, 232, 0.8), rgba(255, 255, 255, 0.9));
  padding: 12px;
}

.mydon-image {
  width: 100%;
  display: block;
  border-radius: 14px;
}

@media (max-width: 1100px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .profile-main {
    grid-template-columns: 1fr;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .bind-input-row {
    grid-template-columns: 1fr;
  }

  .binding-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .binding-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
