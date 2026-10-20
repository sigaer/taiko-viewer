<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { hasPracticeCourse, isPracticeMessage, playerMessage, PRACTICE_COURSES } from "~/utils/ourTaikoView";
import { downloadPracticeBundle } from "~/utils/practiceBundle";

defineOptions({ name: 'PracticePlayerPage' });
definePageMeta({
  contentLayout: "immersive",
  hidePageHeader: true,
  mobileNav: false,
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
  loadingBundle: "譜面と音源をダウンロード中…", loadingChart: "譜面と音源を準備中…",
  bundleFailed: "譜面と音源をダウンロードできませんでした。再読み込みしてください。",
  playerFailed: "プレイヤーを読み込めませんでした。再読み込みしてください。",
  playerDownloadFailed: "プレイヤーをダウンロードできませんでした。再読み込みしてください。",
  playerBootFailed: "プレイヤーを起動できませんでした。再読み込みしてください。",
  chartFailed: "譜面または音源を読み込めませんでした。再読み込みしてください。",
  failed: "読み込めませんでした。再試行してください。", missing: "この難易度の譜面はありません。",
  retry: "再読み込み", volume: "打音の音量", fullscreen: "全画面", exitFullscreen: "全画面を終了",
  finished: "練習が終了しました。", exited: "練習を終了しました。", ready: "プレイヤー内で開始してください。"
} : {
  title: "游玩练习", back: "返回歌曲", loading: "正在加载播放器…",
  loadingBundle: "正在下载谱面与音乐…", loadingChart: "正在准备谱面与音乐…",
  bundleFailed: "谱面与音乐下载失败，请重新加载。",
  playerFailed: "播放器加载失败，请重新加载。",
  playerDownloadFailed: "播放器下载失败，请重新加载。",
  playerBootFailed: "播放器启动失败，请重新加载。",
  chartFailed: "谱面或音乐读取失败，请重新加载。",
  failed: "加载失败，请重试。", missing: "此难度暂无可用谱面。",
  retry: "重新加载", volume: "鼓音音量", fullscreen: "全屏", exitFullscreen: "退出全屏",
  finished: "练习已结束。", exited: "已退出练习。", ready: "请在播放器中点击开始。"
});
useHead(() => ({ title: `${copy.value.title} · ${id}`, meta: [{ name: "robots", content: "noindex" }] }));
const iframe = ref<HTMLIFrameElement | null>(null);
const playerUrl = ref("");
const volume = ref(100);
const status = ref("loading");
const failure = ref("");
const expanded = ref(false);
const fullscreenButton = ref<HTMLButtonElement | null>(null);
const exitButton = ref<HTMLButtonElement | null>(null);
let savedOverflow: [string, string] | undefined;
let frameDocument: Document | null = null;
function exitExpanded(restoreFocus = true) {
  expanded.value = false;
  if (savedOverflow) {
    [document.documentElement.style.overflow, document.body.style.overflow] = savedOverflow;
    savedOverflow = undefined;
    if (restoreFocus) fullscreenButton.value?.focus();
  }
}
function escapeExpanded(event: KeyboardEvent) {
  if (event.key === "Escape" && expanded.value) exitExpanded();
}
function frameLoaded() {
  frameDocument?.removeEventListener("keydown", escapeExpanded);
  frameDocument = iframe.value?.contentDocument || null;
  frameDocument?.addEventListener("keydown", escapeExpanded);
  send("hello");
}
let origin = "";
let requestId = "";
let controller: AbortController | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let resources: Awaited<ReturnType<typeof downloadPracticeBundle>> | undefined;
let ready = false;
let loadSent = false;
let audioDecode: "native" | "software" = "native";
const loadingLabel = ref('');

function send(type: string, payload?: unknown) {
  if (origin) iframe.value?.contentWindow?.postMessage(playerMessage(type, requestId, payload), origin);
}
function clearTimer() { clearTimeout(timer); }
function stop() {
  exitExpanded(false);
  frameDocument?.removeEventListener("keydown", escapeExpanded);
  frameDocument = null;
  clearTimer();
  controller?.abort();
  send("unload");
  playerUrl.value = "";
  resources = undefined;
  ready = false;
  loadSent = false;
}
function fail(message: string) {
  stop();
  failure.value = message;
  status.value = "error";
}
function sendVolume() {
  if (ready) send("setDrumVolume", { volume: Number(volume.value) });
}
async function startCourse() {
  if (!ready || !resources || loadSent || !playerUrl.value) return;
  loadSent = true;
  loadingLabel.value = copy.value.loadingChart;
  sendVolume();
  const activeId = requestId;
  const activeResources = resources;
  try {
    const audioBytes = await activeResources.audioBlob.arrayBuffer();
    if (requestId !== activeId || controller?.signal.aborted || !iframe.value) return;
    iframe.value.contentWindow?.postMessage(playerMessage("load", activeId, {
      chartText: activeResources.chartText, audioType: activeResources.audioType,
      audioBytes, audioDecode,
      course: PRACTICE_COURSES[difficulty - 1],
      practice: true, autoPlay: false, replay: false
    }), origin, [audioBytes]);
  } catch {
    if (requestId === activeId && !controller?.signal.aborted) fail(copy.value.chartFailed);
  }
}
function receive(event: MessageEvent) {
  if (!isPracticeMessage(event, iframe.value?.contentWindow ?? null, origin)) return;
  const data = event.data;
  if (data.requestId && data.requestId !== requestId) return;
  if (data.type === "ready") {
    if (ready || !playerUrl.value) return;
    ready = true;
    startCourse();
    return;
  }
  if (data.type === "error") {
    const code = String(data.payload?.code || '');
    if (code === 'AUDIO_DECODE_FAILED' && audioDecode === 'native' && resources && data.requestId === requestId) {
      audioDecode = 'software';
      requestId = crypto.randomUUID();
      loadSent = false;
      void startCourse();
      return;
    }
    fail(code === 'PLAYER_BOOT_FAILED' ? copy.value.playerBootFailed :
      code === 'PLAYER_DOWNLOAD_FAILED' ? copy.value.playerDownloadFailed :
      code.startsWith('PLAYER_') ? copy.value.playerFailed : copy.value.chartFailed);
  }
  else if (data.type === "loaded" || data.type === "finished") {
    clearTimer();
    resources = undefined;
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
  audioDecode = "native";
  status.value = "loading";
  loadingLabel.value = copy.value.loadingBundle;
  requestId = crypto.randomUUID();
  const current = new AbortController();
  controller = current;
  timer = setTimeout(() => fail(!resources ? copy.value.bundleFailed : !ready ? copy.value.playerFailed : copy.value.chartFailed), 180_000);
  const url = new URL("/practice-player/index.html", origin);
  url.searchParams.set("requestId", requestId);
  playerUrl.value = url.href;
  try {
    const result = await downloadPracticeBundle(id, current.signal);
    if (current.signal.aborted) return;
    if (!hasPracticeCourse(result.chartText, difficulty)) { fail(copy.value.missing); return; }
    resources = result;
    loadingLabel.value = copy.value.loading;
    startCourse();
  } catch {
    if (!current.signal.aborted) fail(copy.value.bundleFailed);
  }
}
async function fullscreen() {
  const target = iframe.value;
  if (!target || expanded.value) return;
  if (typeof target.requestFullscreen === "function" && document.fullscreenEnabled) {
    try { await target.requestFullscreen(); return; }
    catch { /* Fall back when native fullscreen is unavailable or denied. */ }
  }
  if (iframe.value !== target || expanded.value) return;
  savedOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
  document.documentElement.style.overflow = document.body.style.overflow = "hidden";
  expanded.value = true;
  await nextTick();
  exitButton.value?.focus();
}
onMounted(() => {
  origin = window.location.origin;
  window.addEventListener("message", receive);
  window.addEventListener("keydown", escapeExpanded);
  void load();
});
onBeforeUnmount(() => {
  window.removeEventListener("message", receive);
  window.removeEventListener("keydown", escapeExpanded);
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
      <button v-if="playerUrl" ref="fullscreenButton" type="button" @click="fullscreen">{{ copy.fullscreen }}</button>
      <button type="button" @click="load">{{ copy.retry }}</button>
    </div>
    <p v-if="failure" role="alert">{{ failure }}</p>
    <p v-else role="status">{{ status === 'loading' ? loadingLabel : status === 'finished' ? copy.finished : status === 'exit' ? copy.exited : copy.ready }}</p>
    <div class="player-stage" :class="{ 'is-expanded': expanded }">
      <div v-if="expanded" class="expanded-controls">
        <button ref="exitButton" type="button" @click="exitExpanded()">{{ copy.exitFullscreen }}</button>
      </div>
    <iframe v-if="playerUrl" :key="playerUrl" ref="iframe" :src="playerUrl" :title="copy.title"
      allow="autoplay; fullscreen" allowfullscreen @load="frameLoaded" />
    </div>
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

<style scoped>
:global(.app-content:has(.player-stage.is-expanded)) { z-index: 10000; }
.player-stage.is-expanded { position: fixed; inset: 0; z-index: 10000; width: 100%; height: 100dvh; display: flex; flex-direction: column; box-sizing: border-box; background: #171717; color: white; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); overscroll-behavior: none; }
.expanded-controls { display: flex; justify-content: flex-end; flex: 0 0 auto; padding: 4px 8px; }
.expanded-controls button { min-height: 44px; }
.is-expanded iframe { flex: 1 1 0; min-height: 0; height: 100%; aspect-ratio: auto; border-radius: 0; }
</style>
