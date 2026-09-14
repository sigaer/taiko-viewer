const OPENING_TITLE_ART_SRC = "/title.png";

let artworkPromise: Promise<boolean> | null = null;

/** Preload the Opening title art and resolve only after the image decodes. */
export const preloadAnnualOpeningArtwork = () => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (artworkPromise) return artworkPromise;

  artworkPromise = new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(ready);
    };
    const onLoad = async () => {
      if (!image.naturalWidth) return finish(false);
      if (typeof image.decode !== "function") return finish(true);
      try {
        await image.decode();
        finish(true);
      } catch {
        finish(false);
      }
    };
    const timeout = window.setTimeout(() => finish(false), 8000);
    image.decoding = "async";
    image.onload = () => { void onLoad(); };
    image.onerror = () => finish(false);
    image.src = OPENING_TITLE_ART_SRC;
    if (image.complete) void onLoad();
  });

  return artworkPromise;
};
