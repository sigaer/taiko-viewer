<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import DsSampleShell from "../_shared/DsSampleShell.vue";
import DsSampleBlock from "../_shared/DsSampleBlock.vue";

defineOptions({ name: "DsSampleElementPlus" });

const text = ref("");
const select = ref("oni");
const checked = ref(true);
const radio = ref("a");
const on = ref(true);
const seg = ref("week");
const dialog = ref(false);
const drawer = ref(false);
const options = ["easy", "normal", "hard", "oni", "ura"].map((value) => ({ value, label: value }));
const rows = [
  { id: 1, name: "row-1", value: 1004290 },
  { id: 2, name: "row-2", value: 987650 },
  { id: 3, name: "row-3", value: 812300 }
];
const message = (type: "success" | "warning" | "error" | "info") => ElMessage({ type, message: `message ${type}`, duration: 4000 });
const messageBox = () => ElMessageBox.confirm("message-box", "confirm", { type: "warning" }).catch(() => {});
</script>

<template>
  <DsSampleShell title="element-plus">
    <DsSampleBlock name="input / select">
      <el-input v-model="text" placeholder="placeholder" style="width: 220px" data-testid="ds-ep-input" />
      <el-select v-model="select" style="width: 180px" data-testid="ds-ep-select" popper-class="ds-ep-select-popper">
        <el-option v-for="o in options" :key="o.value" :value="o.value" :label="o.label" />
      </el-select>
      <el-input-number :model-value="3" :min="0" :max="10" />
    </DsSampleBlock>
    <DsSampleBlock name="checkbox / radio / switch / segmented">
      <el-checkbox v-model="checked">checkbox</el-checkbox>
      <el-radio-group v-model="radio">
        <el-radio value="a">radio a</el-radio>
        <el-radio value="b">radio b</el-radio>
      </el-radio-group>
      <el-switch v-model="on" data-testid="ds-ep-switch" />
      <el-segmented v-model="seg" :options="['day', 'week', 'month']" />
    </DsSampleBlock>
    <DsSampleBlock name="tag">
      <el-tag>primary</el-tag>
      <el-tag type="info" data-testid="ds-ep-tag-info">info</el-tag>
      <el-tag type="success">success</el-tag>
      <el-tag type="warning">warning</el-tag>
      <el-tag type="danger">danger</el-tag>
    </DsSampleBlock>
    <DsSampleBlock name="teleported: dialog / drawer / message / message-box / tooltip / dropdown">
      <el-button type="primary" data-testid="ds-ep-open-dialog" @click="dialog = true">dialog</el-button>
      <el-button data-testid="ds-ep-open-drawer" @click="drawer = true">drawer</el-button>
      <el-button data-testid="ds-ep-message" @click="message('success')">message</el-button>
      <el-button @click="message('error')">message error</el-button>
      <el-button @click="messageBox">message-box</el-button>
      <el-tooltip content="tooltip" placement="top" popper-class="ds-ep-tooltip">
        <el-button data-testid="ds-ep-tooltip-trigger">tooltip</el-button>
      </el-tooltip>
      <el-tooltip content="tooltip light" effect="light" placement="top">
        <el-button>tooltip light</el-button>
      </el-tooltip>
      <el-dropdown trigger="click" popper-class="ds-ep-dropdown">
        <el-button data-testid="ds-ep-dropdown-trigger">dropdown</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>item-1</el-dropdown-item>
            <el-dropdown-item>item-2</el-dropdown-item>
            <el-dropdown-item disabled>item-3</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </DsSampleBlock>
    <DsSampleBlock name="table">
      <el-table :data="rows" style="width: 100%" highlight-current-row>
        <el-table-column prop="id" label="id" width="80" />
        <el-table-column prop="name" label="name" />
        <el-table-column prop="value" label="value" />
      </el-table>
    </DsSampleBlock>

    <el-dialog v-model="dialog" title="dialog" width="420px" class="ds-ep-dialog" append-to-body>
      <p>dialog</p>
      <template #footer>
        <el-button @click="dialog = false">secondary</el-button>
        <el-button type="primary" @click="dialog = false">primary</el-button>
      </template>
    </el-dialog>
    <el-drawer v-model="drawer" title="drawer" size="320px" class="ds-ep-drawer" append-to-body>
      <p>drawer</p>
    </el-drawer>
  </DsSampleShell>
</template>
