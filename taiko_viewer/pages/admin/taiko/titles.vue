<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { AdminTitleConditionItem, AdminTitleConditionsPayload } from '~/types/admin-title';

defineI18nRoute(false);
definePageMeta({ layout: 'admin-taiko', middleware: 'admin-auth' });
useHead({ title: '称号条件' });

const api = useAdminApiFetch();
const keyword = ref('');
const missing = ref(false);
const page = ref(1);
const appliedKeyword = ref('');
const { data, pending, error, refresh } = await useLazyAsyncData<AdminTitleConditionsPayload>(
  'admin-title-conditions',
  () => api('/api/admin/titles', { query: { keyword: appliedKeyword.value, missing: missing.value ? '1' : undefined, page: page.value, pageSize: 20 } }),
  { server: false, watch: [appliedKeyword, missing, page], default: () => ({ items: [], total: 0, page: 1, pageSize: 20 }) }
);
const items = computed(() => data.value?.items || []);
const selected = ref<AdminTitleConditionItem | null>(null);
const form = reactive({ condition: '' });
const saving = ref(false);
const saveError = ref('');
const dialogOpen = computed({ get: () => Boolean(selected.value), set: (value: boolean) => { if (!value && !saving.value) selected.value = null; } });
function search() {
  const next = keyword.value.trim();
  if (page.value === 1 && appliedKeyword.value === next) { void refresh(); return; }
  page.value = 1; appliedKeyword.value = next;
}
function edit(row: AdminTitleConditionItem) {
  selected.value = { ...row };
  form.condition = row.condition;
  saveError.value = '';
}
async function save() {
  if (!selected.value || saving.value) return;
  saving.value = true; saveError.value = '';
  try {
    const result = await api<{ item: AdminTitleConditionItem; changed: boolean }>('/api/admin/titles/condition', { method: 'POST', retry: 0, body: {
      officialTitleId: selected.value.id, condition: form.condition,
      expectedLocalId: selected.value.localId, expectedLocalCondition: selected.value.localCondition
    } });
    ElMessage.success(!result.changed ? '条件未变化' : result.item.localCondition ? '称号条件已保存' : '已恢复官方条件');
    selected.value = null;
    await refresh();
  } catch (error: any) {
    saveError.value = error?.data?.statusMessage || error?.message || '保存失败，请重试';
  } finally { saving.value = false; }
}
</script>

<template>
  <div class="conditions">
    <form class="conditions__search" @submit.prevent="search">
      <label class="conditions__keyword">
        <span>搜索称号</span>
        <el-input v-model="keyword" placeholder="称号、获取条件或官方 ID" clearable />
      </label>
      <el-checkbox v-model="missing" @change="page = 1">仅看条件未知</el-checkbox>
      <el-button type="primary" native-type="submit" :loading="pending">查询</el-button>
    </form>
    <p class="conditions__count" role="status">共 {{ data?.total || 0 }} 个称号</p>
    <el-alert v-if="error" type="error" :closable="false" title="称号资料加载失败">
      <button type="button" class="conditions__edit" @click="refresh()">重新加载</button>
    </el-alert>
    <el-table v-loading="pending" :data="items" empty-text="没有符合条件的称号">
      <el-table-column label="称号" min-width="260">
        <template #default="{ row }">
          <DsTitlePlate :name="row.name" :plate="row.rarity" />
          <small class="conditions__identity">官方 #{{ row.id }} · 底板 #{{ row.rarity }}</small>
        </template>
      </el-table-column>
      <el-table-column label="获取条件" min-width="300">
        <template #default="{ row }"><span class="conditions__text">{{ row.condition || '暂无资料' }}</span></template>
      </el-table-column>
      <el-table-column label="来源" width="110">
        <template #default="{ row }">{{ row.ambiguous ? '记录重名' : row.localCondition ? '本地资料' : row.officialCondition ? '官方条件' : '暂无资料' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }"><button type="button" class="conditions__edit" :disabled="row.id === 0 || row.ambiguous" @click="edit(row)">编辑条件</button></template>
      </el-table-column>
    </el-table>
    <el-pagination v-if="(data?.total || 0) > 20" v-model:current-page="page" :total="data?.total || 0" :page-size="20" layout="prev, pager, next" :pager-count="5" />
    <el-dialog v-model="dialogOpen" title="编辑称号条件" width="min(600px, calc(100vw - 32px))" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" :append-to-body="false">
      <form v-if="selected" class="conditions__editor" @submit.prevent="save">
        <DsTitlePlate :name="selected.name" :plate="selected.rarity" />
        <p class="conditions__count">官方 #{{ selected.id }} · 底板 #{{ selected.rarity }}</p>
        <label class="conditions__field">
          <span>获取条件</span>
          <el-input v-model="form.condition" type="textarea" :rows="5" :maxlength="1000" show-word-limit :disabled="saving" aria-describedby="condition-hint" />
        </label>
        <p id="condition-hint" class="conditions__hint">留空后使用官方条件。</p>
        <p v-if="saveError" class="conditions__error" role="alert">{{ saveError }}</p>
        <div class="conditions__actions">
          <el-button :disabled="saving" @click="selected = null">取消</el-button>
          <el-button type="primary" native-type="submit" :loading="saving">保存条件</el-button>
        </div>
      </form>
    </el-dialog>
  </div>
</template>

<style scoped>
.conditions { --plate-ink: var(--admin-ink); --plate-ink-outline: var(--admin-surface); display: grid; gap: 16px; min-width: 0; }
.conditions__search { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
.conditions__keyword { display: grid; gap: 6px; flex: 1 1 240px; max-width: 480px; }
.conditions__count, .conditions__hint { margin: 0; color: var(--admin-ink-secondary); font-size: 13px; }
.conditions__identity { display: block; margin-top: 5px; color: var(--admin-ink-secondary); }
.conditions__text { white-space: pre-wrap; overflow-wrap: anywhere; }
.conditions__editor, .conditions__field { display: grid; gap: 12px; }
.conditions__actions { display: flex; justify-content: flex-end; gap: 8px; }
.conditions__error { margin: 0; color: var(--el-color-danger); }
.conditions__edit { border: 0; background: transparent; color: var(--admin-primary); font: inherit; font-size: 14px; min-height: 44px; padding: 0; cursor: pointer; }
.conditions__edit:hover { color: var(--admin-primary-hover); }
.conditions__edit:disabled { color: var(--admin-ink-muted); cursor: not-allowed; }
.conditions__edit:focus-visible { outline: 2px solid var(--admin-primary); outline-offset: 2px; }
</style>
