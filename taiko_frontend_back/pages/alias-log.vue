<script setup lang="ts">
const pageMeta = {
  title: "别名修改日志",
  desc: "记录歌曲别名更新历史。"
};

definePageMeta({
  pageTitle: pageMeta.title,
  pageDesc: pageMeta.desc,
  navKey: "/alias-log",
  breadcrumbs: [{ label: "别名修改日志", to: "/alias-log" }]
});

useSeoMeta({
  title: pageMeta.title,
  description: pageMeta.desc,
  ogTitle: pageMeta.title,
  ogDescription: pageMeta.desc
});
</script>

<template>
  <div class="alias-log-page">
    <el-card class="panel-card">
      <div class="alias-log-empty">
        <div class="alias-log-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 6v6l3.5 2 M12 3a9 9 0 1 1-6.36 2.64 M4 4v4h4"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h3>别名修改日志</h3>
        <p>该页面预留用于后续接入别名变更记录。</p>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.alias-log-page {
  display: grid;
}

.alias-log-empty {
  min-height: 280px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
  color: #73573d;
}

.alias-log-icon {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(248, 224, 193, 0.85), rgba(255, 244, 230, 0.95));
  color: #a36b39;
  box-shadow: 0 10px 20px rgba(160, 120, 86, 0.16);
}

.alias-log-icon svg {
  width: 26px;
  height: 26px;
}

.alias-log-empty h3 {
  margin: 0;
  font-size: 22px;
}

.alias-log-empty p {
  margin: 0;
  font-size: 14px;
  color: #8b6d53;
}
</style>
