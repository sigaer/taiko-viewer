import * as THREE from 'three';
import { createCoverQuality } from './annualCoverQuality';
import { annualCoverTexturePath } from './annualCoverTexture';
import { coverMotion, coverPitch, coverRotation, type AnnualCoverState } from './annualCoverMotion';

type Cover = { songNo: number; coverUrl?: string | null };
export type AnnualCoverRenderer = {
  prepare: Promise<void>;
  resize: (width: number, height: number) => void;
  render: () => void;
  dispose: () => void;
};

export const createAnnualCoverRenderer = (
  canvas: HTMLCanvasElement, covers: Cover[], state: AnnualCoverState, failed: () => void
): AnnualCoverRenderer => {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false });
  if (!context) throw new Error('WebGL2 unavailable');
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: false });
  const quality = createCoverQuality(window.devicePixelRatio || 1);
  renderer.setPixelRatio(quality.ratio);
  canvas.dataset.pixelRatio = String(quality.ratio);
  renderer.setClearColor(0x000000, 0);
  // Unlit artwork is composited in its original display RGB, like the HTML
  // images. No lighting/HDR operation requires a linear-light round trip.
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 2200);
  camera.position.z = 900;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const textures = new Map<string, THREE.Texture>();
  const controllers = new Set<AbortController>();
  const bitmaps = new Set<ImageBitmap>();
  let disposed = false, firstFrame = true, width = 1, height = 1, lastFrame = 0;
  const slots = Array.from({ length: covers.length ? 12 : 0 }, (_, i) => {
    const upper = i < 6, index = i % 6;
    const pool = covers.filter((_, j) => j % 2 === (upper ? 0 : 1));
    const song = (pool.length ? pool : covers)[index % (pool.length || covers.length)];
    const material = new THREE.MeshBasicMaterial({ map: placeholder, color: 0xc3e2ff, transparent: true, opacity: 0, depthWrite: false });
    material.color.convertLinearToSRGB();
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return { mesh, material, upper, index, url: annualCoverTexturePath(song), applied: false };
  });
  const render = () => {
    if (disposed) return;
    const now = performance.now();
    if (state.transitionTime > 0 && state.transitionTime < 1600) quality.reset();
    else if (lastFrame) {
      const ratio = quality.sample(now - lastFrame);
      if (ratio !== renderer.getPixelRatio()) {
        // Resize and draw in this same callback: never expose a cleared canvas.
        renderer.setPixelRatio(ratio); canvas.dataset.pixelRatio = String(ratio);
      }
    }
    lastFrame = now;
    const landscape = width > height && height <= 460;
    const size = Math.min(landscape ? height * .75 : width * .84, 352);
    for (const slot of slots) {
      const motion = coverMotion(state.elapsed, slot.index, slot.upper);
      if (!slot.applied && (firstFrame || motion.opacity < .001) && textures.has(slot.url)) {
        slot.material.map = textures.get(slot.url)!;
        slot.material.color.set(0xffffff);
        slot.material.needsUpdate = true;
        slot.applied = true;
      }
      const distance = motion.travel;
      const z = -380 * (1 - distance);
      const perspectiveScale = (900 - z) / 900;
      const axis = (landscape ? width : height) * (.23 + distance * .4) * perspectiveScale;
      slot.mesh.position.set(landscape ? (slot.upper ? -axis : axis) : 0, landscape ? 0 : (slot.upper ? axis : -axis), z);
      slot.mesh.scale.setScalar(size);
      slot.mesh.rotation.set(coverPitch(slot.upper), 0, coverRotation(state.transitionTime));
      if (landscape) slot.mesh.rotation.y = Math.PI * .12;
      slot.mesh.visible = motion.opacity > .001;
      slot.material.opacity = motion.opacity;
    }
    renderer.render(scene, camera);
    firstFrame = false;
  };
  const resize = (w: number, h: number) => {
    if (disposed || w <= 0 || h <= 0) return;
    width = w; height = h;
    camera.aspect = width / height;
    camera.fov = 2 * Math.atan(height / 1800) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  };
  const load = async (url: string) => {
    const controller = new AbortController(); controllers.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    let bitmap: ImageBitmap | undefined;
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader(), chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > 8 * 1024 * 1024) { await reader.cancel(); return; }
        chunks.push(value);
      }
      bitmap = await createImageBitmap(new Blob(chunks as BlobPart[]), { resizeWidth: 400, resizeHeight: 400, imageOrientation: 'flipY' });
      if (disposed || controller.signal.aborted) { bitmap.close(); return; }
      const texture = new THREE.Texture(bitmap);
      texture.colorSpace = THREE.NoColorSpace; texture.flipY = false; texture.needsUpdate = true;
      textures.set(url, texture); bitmaps.add(bitmap);
    } catch { bitmap?.close(); /* A failed cover keeps its neutral plane. */ }
    finally { clearTimeout(timeout); controllers.delete(controller); }
  };
  const queue = [...new Set(slots.map(s => s.url).filter(Boolean))];
  const prepare = Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (!disposed && queue.length) await load(queue.shift()!);
  })).then(() => undefined);
  const contextLost = (event: Event) => { event.preventDefault(); failed(); };
  canvas.addEventListener('webglcontextlost', contextLost);
  return {
    prepare, resize, render,
    dispose() {
      if (disposed) return; disposed = true;
      canvas.removeEventListener('webglcontextlost', contextLost);
      controllers.forEach(c => c.abort()); controllers.clear();
      slots.forEach(s => s.material.dispose()); geometry.dispose(); placeholder.dispose();
      textures.forEach(t => t.dispose()); textures.clear();
      bitmaps.forEach(b => b.close()); bitmaps.clear();
      scene.clear(); renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    }
  };
};
