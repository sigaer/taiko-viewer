const within = async (task: Promise<unknown>, ms: number): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([task.then(() => true, () => false), new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), ms); })]); }
  finally { clearTimeout(timer); }
};
const imageReady = async (image: HTMLImageElement, timeout: number) => {
  image.loading = 'eager';
  if (!image.complete) {
    let cleanup = () => {};
    const loaded = new Promise<void>((resolve, reject) => {
      const load = () => resolve(); const error = () => reject(new Error('image failed'));
      image.addEventListener('load', load); image.addEventListener('error', error);
      cleanup = () => { image.removeEventListener('load', load); image.removeEventListener('error', error); };
    });
    const ok = await within(loaded, timeout); cleanup();
    if (!ok) return false;
  }
  return image.naturalWidth > 0 && (typeof image.decode !== 'function' || await within(image.decode(), timeout));
};
// Used by both capture pages. Error handlers own the component's fallback;
// readiness is rechecked after Vue replaces the failed node/source.
export const prepareAnnualAssets = async (root: HTMLElement, timeout = 4000) => {
  let fallbacks = 0;
  if (document.fonts && !await within(document.fonts.ready, timeout)) root.style.fontFamily = 'sans-serif';
  const backgroundTasks = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].flatMap(element => {
    const background = getComputedStyle(element).backgroundImage;
    return Array.from(background.matchAll(/url\(["']?([^"')]+)["']?\)/g)).map(async match => {
      const image = new Image(); image.src = match[1];
      if (!await imageReady(image, timeout)) { element.style.backgroundImage = 'none'; element.style.backgroundColor = '#e5f1fb'; fallbacks++; }
    });
  });
  await Promise.all(backgroundTasks);
  for (let pass = 0; pass < 3; pass++) {
    await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
      if (await imageReady(image, timeout)) return;
      fallbacks++;
      image.dispatchEvent(new Event('error'));
      await new Promise(resolve => setTimeout(resolve, 0));
      // Managed covers and MyDon swap to their existing Vue fallback. If an
      // unmanaged decorative asset fails, remove the broken glyph explicitly.
      if (pass === 2 && image.isConnected && !image.naturalWidth) {
        image.removeAttribute('srcset'); image.src = '/default-avatar.svg';
        if (!await imageReady(image, timeout)) throw new Error('Annual asset fallback unavailable');
      }
    }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (Array.from(root.querySelectorAll('img')).every(image => image.hidden || image.complete && image.naturalWidth > 0)) break;
  }
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  return { fallbacks };
};
