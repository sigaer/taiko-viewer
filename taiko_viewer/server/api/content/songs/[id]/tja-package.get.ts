import { readFile, stat } from "node:fs/promises";
import { preparePracticeWav, withPracticeWave } from "~/server/utils/practiceAudio";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { sendStream, setHeader, getQuery } from "h3";
import { getSongCatalog, resolveSongTjaBundleSource } from "~/server/services/content";

const sanitizeFileNamePart = (value: string) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

const buildZipFileName = (songId: number, title: string) => {
  const safeTitle = sanitizeFileNamePart(title) || `song_${songId}`;
  return `${songId}_${safeTitle}_tja_bundle.zip`;
};

const buildContentDisposition = (fileName: string) => {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "download.zip";
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

export default defineEventHandler(async (event) => {
  const songId = Number(event.context.params?.id || 0);
  if (!Number.isInteger(songId) || songId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid song ID", message: "歌曲 ID 无效" });
  }

  const [songs, bundleSource] = await Promise.all([getSongCatalog(), resolveSongTjaBundleSource(songId)]);
  if (!bundleSource) {
    throw createError({
      statusCode: 404,
      statusMessage: "TJA bundle unavailable",
      message: "未找到可下载的 TJA 资源包"
    });
  }

  const song = songs.find((item) => Number(item.id) === songId);
  if (!song) {
    throw createError({ statusCode: 404, statusMessage: "Song not found", message: "歌曲不存在" });
  }

  const lifetime = new AbortController();
  const abort = () => lifetime.abort();
  event.node.res.once("close", abort);
  let converted: Awaited<ReturnType<typeof preparePracticeWav>> | undefined;
  let chart: string | undefined;
  try {
    if (getQuery(event).audio === "wav" && /\.ogg$/i.test(bundleSource.audioName)) {
      if ((await stat(bundleSource.tjaPath)).size > 2 * 1024 * 1024) throw new Error("Chart too large");
      const bytes = await readFile(bundleSource.tjaPath);
      try { chart = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { chart = new TextDecoder("shift_jis").decode(bytes); }
      chart = withPracticeWave(chart);
      converted = await preparePracticeWav(bundleSource.audioPath, lifetime.signal);
    }
    lifetime.signal.throwIfAborted();
  } catch (error) {
    event.node.res.off("close", abort);
    await converted?.cleanup();
    throw error;
  }

  const title = song.song_name_jp || song.song_name || `song_${songId}`;
  const output = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (error) => output.destroy(error));
  archive.pipe(output);
  output.once("close", () => {
    archive.abort();
    event.node.res.off("close", abort);
    void converted?.cleanup().catch(() => {});
  });
  event.node.res.once("close", () => output.destroy());
  if (chart !== undefined) archive.append(chart, { name: bundleSource.tjaName });
  else archive.file(bundleSource.tjaPath, { name: bundleSource.tjaName });
  archive.file(converted?.audioPath || bundleSource.audioPath, { name: converted?.audioName || bundleSource.audioName });

  setHeader(event, "Content-Type", "application/zip");
  setHeader(event, "Content-Disposition", buildContentDisposition(buildZipFileName(songId, title)));
  setHeader(event, "Cache-Control", "public, max-age=300");

  void archive.finalize().catch((error: Error) => {
    output.destroy(error);
  });

  return sendStream(event, output);
});
