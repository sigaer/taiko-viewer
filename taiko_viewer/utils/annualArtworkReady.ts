// A distant navigation mounts its destination before moving the viewport. Decode
// the finite visible artwork set while the outgoing page still covers the stage.
export const prepareAnnualArtwork = async (root: HTMLElement, timeoutMs = 1200) => {
  const images = [...root.querySelectorAll<HTMLImageElement>('img')].slice(0, 16);
  if (!images.length) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all(images.map(image => image.decode().catch(() => undefined))),
      new Promise<void>(resolve => { timer = setTimeout(resolve, timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
};
