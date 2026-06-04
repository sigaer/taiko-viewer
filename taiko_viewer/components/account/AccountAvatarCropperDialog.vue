<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

type CropperCopy = {
  title: string;
  hint: string;
  wheelHint: string;
  zoom: string;
  cancel: string;
  confirm: string;
  imageLoadFailed: string;
  cropFailed: string;
};

const props = withDefaults(defineProps<{
  modelValue: boolean;
  sourceUrl: string;
  fileName?: string;
  loading?: boolean;
  copy: CropperCopy;
}>(), {
  fileName: "",
  loading: false
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [payload: { blob: Blob; fileName: string }];
  error: [message: string];
  closed: [];
}>();

const cropFrameSize = 280;
const outputSize = 640;
const minZoom = 1;
const maxZoom = 4;

const imageElement = ref<HTMLImageElement | null>(null);
const imageReady = ref(false);
const zoom = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const naturalWidth = ref(0);
const naturalHeight = ref(0);
const pointerState = ref<{ id: number; x: number; y: number } | null>(null);

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value)
});

const baseScale = computed(() => {
  if (!naturalWidth.value || !naturalHeight.value) return 1;
  return Math.max(cropFrameSize / naturalWidth.value, cropFrameSize / naturalHeight.value);
});

const imageScale = computed(() => baseScale.value * zoom.value);
const renderedWidth = computed(() => naturalWidth.value * imageScale.value);
const renderedHeight = computed(() => naturalHeight.value * imageScale.value);

const previewImageStyle = computed(() => ({
  width: `${renderedWidth.value}px`,
  height: `${renderedHeight.value}px`,
  transform: `translate(-50%, -50%) translate(${offsetX.value}px, ${offsetY.value}px)`
}));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const applyClampedOffset = (x: number, y: number) => {
  const limitX = Math.max((renderedWidth.value - cropFrameSize) / 2, 0);
  const limitY = Math.max((renderedHeight.value - cropFrameSize) / 2, 0);
  offsetX.value = clamp(x, -limitX, limitX);
  offsetY.value = clamp(y, -limitY, limitY);
};

const resetCropState = () => {
  zoom.value = 1;
  offsetX.value = 0;
  offsetY.value = 0;
  naturalWidth.value = 0;
  naturalHeight.value = 0;
  imageReady.value = false;
  pointerState.value = null;
};

const closeDialog = () => {
  if (props.loading) return;
  dialogVisible.value = false;
};

const stopDrag = () => {
  pointerState.value = null;
};

const handleImageLoad = (event: Event) => {
  const target = event.target as HTMLImageElement | null;
  if (!target?.naturalWidth || !target.naturalHeight) {
    imageReady.value = false;
    emit("error", props.copy.imageLoadFailed);
    return;
  }
  naturalWidth.value = target.naturalWidth;
  naturalHeight.value = target.naturalHeight;
  zoom.value = 1;
  applyClampedOffset(0, 0);
  imageReady.value = true;
};

const handleImageError = () => {
  imageReady.value = false;
  emit("error", props.copy.imageLoadFailed);
};

const handlePointerDown = (event: PointerEvent) => {
  if (!imageReady.value) return;
  pointerState.value = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY
  };
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
};

const handlePointerMove = (event: PointerEvent) => {
  const activePointer = pointerState.value;
  if (!activePointer || activePointer.id !== event.pointerId) return;
  const deltaX = event.clientX - activePointer.x;
  const deltaY = event.clientY - activePointer.y;
  applyClampedOffset(offsetX.value + deltaX, offsetY.value + deltaY);
  pointerState.value = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY
  };
};

const handlePointerUp = (event: PointerEvent) => {
  if (pointerState.value?.id !== event.pointerId) return;
  (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
  stopDrag();
};

const handleWheel = (event: WheelEvent) => {
  if (!imageReady.value) return;
  event.preventDefault();
  const nextZoom = clamp(zoom.value + (event.deltaY < 0 ? 0.12 : -0.12), minZoom, maxZoom);
  zoom.value = Number(nextZoom.toFixed(2));
};

const exportCrop = async () => {
  if (!imageElement.value || !imageReady.value) {
    emit("error", props.copy.cropFailed);
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext("2d");
  if (!context) {
    emit("error", props.copy.cropFailed);
    return;
  }

  const scale = imageScale.value;
  const sourceWidth = cropFrameSize / scale;
  const sourceHeight = cropFrameSize / scale;
  const sourceX = naturalWidth.value / 2 - sourceWidth / 2 - offsetX.value / scale;
  const sourceY = naturalHeight.value / 2 - sourceHeight / 2 - offsetY.value / scale;

  context.drawImage(
    imageElement.value,
    clamp(sourceX, 0, Math.max(naturalWidth.value - sourceWidth, 0)),
    clamp(sourceY, 0, Math.max(naturalHeight.value - sourceHeight, 0)),
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputSize,
    outputSize
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.92);
  });

  if (!blob) {
    emit("error", props.copy.cropFailed);
    return;
  }

  const normalizedFileName = props.fileName.replace(/\.[^.]+$/, "") || "avatar";
  emit("confirm", {
    blob,
    fileName: `${normalizedFileName}.webp`
  });
};

watch(
  () => zoom.value,
  (value) => {
    const normalized = clamp(value, minZoom, maxZoom);
    if (normalized !== value) {
      zoom.value = normalized;
      return;
    }
    applyClampedOffset(offsetX.value, offsetY.value);
  }
);

watch(
  () => props.sourceUrl,
  () => {
    resetCropState();
  }
);

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      stopDrag();
    }
  }
);

onBeforeUnmount(() => {
  stopDrag();
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="copy.title"
    width="560px"
    class="avatar-cropper-dialog"
    :close-on-click-modal="!loading"
    :close-on-press-escape="!loading"
    :show-close="!loading"
    @closed="
      resetCropState();
      emit('closed');
    "
  >
    <div class="avatar-cropper">
      <div
        class="avatar-cropper__stage"
        :class="{ 'is-dragging': !!pointerState, 'is-loading': !imageReady }"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
        @pointerleave="handlePointerUp"
        @wheel="handleWheel"
      >
        <img
          ref="imageElement"
          :src="sourceUrl"
          alt=""
          class="avatar-cropper__image"
          :style="previewImageStyle"
          draggable="false"
          @load="handleImageLoad"
          @error="handleImageError"
        />
        <div class="avatar-cropper__frame"></div>
        <div v-if="!imageReady" class="avatar-cropper__placeholder">
          <span class="avatar-cropper__spinner" aria-hidden="true"></span>
        </div>
      </div>

      <div class="avatar-cropper__controls">
        <div class="avatar-cropper__hint">
          <p>{{ copy.hint }}</p>
          <p>{{ copy.wheelHint }}</p>
        </div>
        <div class="avatar-cropper__zoom-row">
          <span>{{ copy.zoom }}</span>
          <el-slider v-model="zoom" :min="minZoom" :max="maxZoom" :step="0.01" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="avatar-cropper__footer">
        <el-button :disabled="loading" @click="closeDialog">{{ copy.cancel }}</el-button>
        <el-button type="primary" :loading="loading" :disabled="!imageReady" @click="exportCrop">
          {{ copy.confirm }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.avatar-cropper {
  display: grid;
  gap: 18px;
}

.avatar-cropper__stage {
  position: relative;
  width: 280px;
  height: 280px;
  margin: 0 auto;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(135deg, #fbf3ec, #f1e4d8);
  touch-action: none;
  cursor: grab;
}

.avatar-cropper__stage.is-dragging {
  cursor: grabbing;
}

.avatar-cropper__stage.is-loading {
  cursor: wait;
}

.avatar-cropper__image {
  position: absolute;
  top: 50%;
  left: 50%;
  user-select: none;
  transform-origin: center;
  max-width: none;
}

.avatar-cropper__frame {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 999px rgba(26, 24, 30, 0.48);
  pointer-events: none;
}

.avatar-cropper__placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #ffffff;
  font-size: 26px;
  background: rgba(36, 31, 28, 0.18);
}

.avatar-cropper__spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.36);
  border-top-color: #ffffff;
  animation: avatar-cropper-spin 0.9s linear infinite;
}

.avatar-cropper__controls {
  display: grid;
  gap: 14px;
}

.avatar-cropper__hint {
  display: grid;
  gap: 4px;
}

.avatar-cropper__hint p {
  margin: 0;
  color: #7d6a5a;
  font-size: 13px;
  line-height: 1.6;
}

.avatar-cropper__zoom-row {
  display: grid;
  gap: 10px;
}

.avatar-cropper__zoom-row span {
  color: #5a4738;
  font-weight: 600;
}

.avatar-cropper__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.avatar-cropper-dialog :deep(.el-dialog) {
  max-width: calc(100vw - 24px);
}

.avatar-cropper-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}

@keyframes avatar-cropper-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
