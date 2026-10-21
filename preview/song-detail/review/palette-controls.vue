<!-- Local review fixture only; this directory is not a production page root. -->
<script setup lang="ts">
import { ElMessage, ElNotification } from 'element-plus';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/notification/style/css';
const text = ref('Viewer');
const choice = ref('current');
const dialog = ref(false);
const checked = ref(true);
const showMessages = () => {
  for (const type of ['success', 'warning', 'error', 'info'] as const) {
    ElMessage({ type, message: type, duration: 0, showClose: true });
  }
  ElNotification({ type: 'info', title: 'Viewer', message: 'Review fixture', duration: 0 });
};
</script>
<template>
  <div class="palette-controls">
    <el-card class="panel-card">
      <el-form label-position="top">
        <el-form-item label="Input"><el-input v-model="text" /></el-form-item>
        <el-form-item label="Disabled"><el-input model-value="Disabled" disabled /></el-form-item>
        <el-form-item label="Select"><el-select v-model="choice"><el-option label="Current" value="current" /><el-option label="Other" value="other" /><el-option label="Disabled" value="disabled" disabled /></el-select></el-form-item>
        <el-checkbox v-model="checked">Selected</el-checkbox>
        <el-button type="primary">Primary</el-button>
        <el-button type="primary" plain>Plain</el-button>
        <el-button type="primary" disabled>Disabled</el-button>
        <el-button class="open-dialog" @click="dialog = true">Dialog</el-button>
        <el-button class="show-messages" @click="showMessages">Messages</el-button>
      </el-form>
    </el-card>
    <el-alert v-for="type in ['success', 'warning', 'error', 'info'] as const" :key="type" :type="type" :title="type" show-icon :closable="false" />
    <el-dialog v-model="dialog" title="Viewer" width="min(480px, calc(100vw - 40px))"><p>Review fixture</p><el-input v-model="text" /></el-dialog>
  </div>
</template>
<style scoped>
.palette-controls { display: grid; gap: 16px; }
</style>
