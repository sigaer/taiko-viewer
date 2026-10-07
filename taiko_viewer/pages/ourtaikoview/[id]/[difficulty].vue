<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { hasPracticeCourse, isPracticeMessage, playerMessage, PRACTICE_COURSES } from "~/utils/ourTaikoView";
import { downloadPracticeBundle } from "~/utils/practiceBundle";

definePageMeta({
  key: route => route.fullPath,
  validate: route => /^[1-9]\d*$/.test(String(route.params.id)) &&
    Number.isSafeInteger(Number(route.params.id)) && /^[1-5]$/.test(String(route.params.difficulty))
});
const route = useRoute();
const localePath = useLocalePath();
const { locale, t } = useI18n();
const id = Number(route.params.id);
const difficulty = Number(route.params.difficulty);
const copy = computed(() => locale.value === "ja" ? {
  title: "プレイ練習", back: "楽曲に戻る", loading: "プレイヤーを読み込み中…",
  failed: "読み込めませんでした。再試行してください。", missing: "この難易度の譜面はありません。",
  retry: "再読み込み", volume: "打音の音量", fullscreen: "全画面", fullscreenFailed: "全画面に切り替えられませんでした。",
  finished: "練習が終了しました。", exited: "練習を終了しました。", ready: "プレイヤー内で開始してください。"
} : {
  title: "游玩练习", back: "返回歌曲", loading: "正在加载播放器…",
  failed: "加载失败，请重试。", missing: "此难度暂无可用谱面。",
  retry: "重新加载", volume: "鼓音音量", fullscreen: "全屏", fullscreenFailed: "无法进入全屏，请重试。",
  finished: "练习已结束。", exited: "已退出练习。", ready: "请在播放器中点击开始。"
});
useHead(() => ({ title: `${copy.value.title} · ${id}`, meta: [{ name: "robots", content: "noindex" }] }));
const iframe = ref<HTMLIFrameElement | null>(null);
const playerUrl = ref("");
const volume = ref(100);
const status = ref("loading");
const failure = ref("");
const fullscreenError = ref(false);
let origin = "";
let requestId = "";
let controller: AbortController | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let resources: Awaited<ReturnType<typeof downloadPracticeBundle>> | undefined;
let ready = false;

function send(type: string, payload?: unknown) {
  if (origin) iframe.value?.contentWindow?.postMessage(playerMessage(type, requestId, payload), origin);
}
function clearTimer() { clearTimeout(timer); }
function stop() {
  clearTimer();
  controller?.abort();
  send("unload");
  playerUrl.value = "";
  resources = undefined;
  ready = false;
}
function fail(message: string) {
  stop();
  failure.value = message;
  status.value = "error";
}
function sendVolume() {
  if (ready) send("setDrumVolume", { volume: Number(volume.value) });
}
function receive(event: MessageEvent) {
  if (!isPracticeMessage(event, iframe.value?.contentWindow ?? null, origin)) return;
  const data = event.data;
  if (data.type === "ready") {
    if (ready || !resources || !playerUrl.value) return;
    ready = true;
    sendVolume();
    send("load", {
      ...resources,
      course: PRACTICE_COURSES[difficulty - 1],
      practice: true, autoPlay: false, replay: false
    });
    return;
  }
  if (data.requestId && data.requestId !== requestId) return;
  if (data.type === "error") fail(copy.value.failed);
  else if (data.type === "loaded" || data.type === "finished") {
    clearTimer();
    status.value = data.type;
  } else if (data.type === "exit") {
    stop();
    status.value = "exit";
  }
}
async function load() {
  stop();
  resources = undefined;
  failure.value = "";
  fullscreenError.value = false;
  status.value = "loading";
  requestId = crypto.randomUUID();
  const current = new AbortController();
  controller = current;
  timer = setTimeout(() => fail(copy.value.failed), 180_000);
  try {
    const result = await downloadPracticeBundle(id, current.signal);
    if (current.signal.aborted) return;
    if (!hasPracticeCourse(result.chartText, difficulty)) { fail(copy.value.missing); return; }
    resources = result;
    const url = new URL("/practice-player/index.html", origin);
    url.searchParams.set("parentOrigin", origin);
    playerUrl.value = url.href;
  } catch {
    if (!current.signal.aborted) fail(copy.value.failed);
  }
}
async function fullscreen() {
  try {
    await iframe.value?.requestFullscreen();
    fullscreenError.value = false;
  } catch { fullscreenError.value = true; }
}
onMounted(() => {
  origin = window.location.origin;
  window.addEventListener("message", receive);
  void load();
});
onBeforeUnmount(() => {
  window.removeEventListener("message", receive);
  stop();
});
</script>

<template>
  <main class="practice-page">
    <NuxtLink :to="localePath(`/songs/${id}`)">{{ copy.back }}</NuxtLink>
    <h1>{{ copy.title }} · {{ t(`difficulty.${difficulty}`) }}</h1>
    <div class="practice-controls">
      <label>{{ copy.volume }}
        <input v-model.number="volume" type="range" min="0" max="100" step="1" @input="sendVolume" />
        <output>{{ volume }}</output>
      </label>
      <button v-if="playerUrl" type="button" @click="fullscreen">{{ copy.fullscreen }}</button>
      <button type="button" @click="load">{{ copy.retry }}</button>
    </div>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <p v-else role="status">{{ status === 'loading' ? copy.loading : status === 'finished' ? copy.finished : status === 'exit' ? copy.exited : copy.ready }}</p>
    <p v-if="fullscreenError" role="alert">{{ copy.fullscreenFailed }}</p>
    <iframe v-if="playerUrl" :key="requestId" ref="iframe" :src="playerUrl" :title="copy.title"
      allow="autoplay; fullscreen" allowfullscreen @load="send('hello')" />
  </main>
</template>

<style scoped>
.practice-page { width: min(1440px, 100%); margin: 0 auto; padding: 24px 16px; }
h1 { font-size: clamp(1.25rem, 3vw, 2rem); margin: 20px 0; }
.practice-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
label { display: flex; align-items: center; gap: 10px; }
output { min-width: 3ch; font-variant-numeric: tabular-nums; }
button { padding: 8px 16px; border: 1px solid currentColor; border-radius: 10px; background: transparent; color: inherit; cursor: pointer; }
iframe { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 12px; background: #171717; }
iframe:fullscreen { width: 100vw; height: 100vh; border-radius: 0; }
</style>
