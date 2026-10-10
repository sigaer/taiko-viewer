import { unzip, type Unzipped } from "fflate";

const MAX_BUNDLE = 64 * 1024 * 1024;
const MAX_CHART = 2 * 1024 * 1024;
const MAX_AUDIO = 100 * 1024 * 1024;
const audioMime: Record<string, string> = { ogg: "audio/ogg", mp3: "audio/mpeg", wav: "audio/wav" };

function extract(bytes: Uint8Array, select: (name: string) => boolean, limit: number, signal: AbortSignal) {
  return new Promise<Unzipped>((resolve, reject) => {
    signal.throwIfAborted();
    let total = 0;
    let invalid = false;
    let terminate = () => {};
    const abort = () => { terminate(); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    try {
      terminate = unzip(bytes, { filter: file => {
        if (!select(file.name)) return false;
        total += file.originalSize;
        if (!Number.isSafeInteger(total) || total > limit) { invalid = true; return false; }
        return true;
      } }, (error, files) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) reject(signal.reason);
        else if (error || invalid) reject(error || new Error("Bundle entry too large"));
        else resolve(files);
      });
    } catch (error) {
      signal.removeEventListener("abort", abort);
      reject(error);
    }
  });
}

export async function decodePracticeBundle(bytes: Uint8Array, signal: AbortSignal) {
  if (bytes.byteLength > MAX_BUNDLE) throw new Error("Bundle too large");
  const charts = await extract(bytes, name => /\.tja$/i.test(name), MAX_CHART, signal);
  const names = Object.keys(charts);
  if (names.length !== 1) throw new Error("Expected one TJA file");
  let chartText: string;
  try { chartText = new TextDecoder("utf-8", { fatal: true }).decode(charts[names[0]]); }
  catch { chartText = new TextDecoder("shift_jis").decode(charts[names[0]]); }
  const wave = /^\s*WAVE\s*:(.+?)\s*$/im.exec(chartText)?.[1]?.trim().replace(/\\/g, "/");
  if (!wave) throw new Error("Missing WAVE field");
  // The existing download endpoint flattens the TJA and WAVE into ZIP root entries.
  const audioName = wave.split("/").pop()!;
  const audioType = audioName.split(".").pop()!.toLowerCase();
  if (!audioMime[audioType]) throw new Error("Unsupported audio format");
  const files = await extract(bytes, name => name === audioName, MAX_AUDIO, signal);
  const audio = files[audioName];
  if (!audio?.byteLength) throw new Error("Matching WAVE audio not found");
  return { chartText, audioType, audioBlob: new Blob([audio as BlobPart], { type: audioMime[audioType] }) };
}

export async function downloadPracticeBundle(songId: number, signal: AbortSignal) {
  const response = await fetch(`/api/content/songs/${songId}/tja-package`, { signal });
  if (!response.ok || !response.body) throw new Error("Bundle download failed");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (Number(response.headers.get("content-length")) > MAX_BUNDLE) throw new Error("Bundle too large");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BUNDLE) throw new Error("Bundle too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  signal.throwIfAborted();
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  chunks.length = 0;
  return decodePracticeBundle(bytes, signal);
}
