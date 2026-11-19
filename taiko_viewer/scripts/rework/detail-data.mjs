// Synthetic files for the song detail and constants self-checks (slice A). Everything the two pages read from files
// is written here, so the real APIs and the real SSR run over it:
//   song_data.json              TAIKO_SONG_DATA_PATH             /api/content/songs/:id, chart images, V2 rows
//   rating.json                 TAIKO_RATING_STRUCT_PATH         rating entries (six-dimension radar, combo)
//   branch_audio_manifest.json  TAIKO_BRANCH_AUDIO_MANIFEST_PATH branch audio variants
//   assets/fumens/<folder>/…    TAIKO_REPO_ROOT                  /api/content/songs/:id/chart-image
//   tja/…, logs/…, viewer-cache/song-tja-index.json              TJA bundle (tjaBundleUrl, /tja-package)
//   viewer-cache/v2-constants.json  TAIKO_VIEWER_CACHE_DIR       V2 constants (the remote source's last snapshot)
// Database / sign-in data (account scores, chart UGC, related threads) are not files: see detail-scenarios.mjs.
import { mkdir, stat, utimes, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { crc32, deflateSync } from "node:zlib";

const GENRES = ["南梦宫原创音乐", "流行音乐", "儿童音乐", "古典音乐", "综合音乐", "游戏音乐", "博歌乐音乐", "动漫音乐"];
export const IDS = {
  full: 1, // every field, five charts, chart images, TJA bundle, branch audio, rating radar, V2 for hard/oni/edit
  sides: 2, // oni has P1 / P2 charts (ourtaiko_difficulties)
  removed: 3, // shelf_status 1 → the page adds list=removed
  other: 4, // shelf_status 2, no rating values → no six-dimension block
  sparse: 5, // long title with a "(…)" suffix, no Japanese name, no BPM / artists / date / images / V2
  canonical: 100, // legacy id 99 → /songs/99 answers 301 to /songs/100
  noEdit: 6 // no ura oni
};
export const CONSTANT_SONGS = 60; // ids 1…60 have V2 rows for hard / oni / edit (edit where level_5 exists)

const chartValues = (id, d) => {
  const base = 6 + d * 1.6 + (id % 7) * 0.31;
  const r = (x) => Math.round(x * 100) / 100;
  return {
    totalNotes: 300 + id * 7 + d * 120,
    sub_constant_1: r(base - 0.42),
    main_constant: r(base),
    sub_constant_2: r(base + 0.37),
    stamina: r(base - 1.1 + (id % 3) * 0.4),
    handspeed: r(base + 0.6 - (id % 4) * 0.3),
    burst: r(base - 0.2 + (id % 5) * 0.25),
    complex: r(base - 0.8 + (id % 2) * 0.9),
    rhythm: r(base + 0.1 - (id % 6) * 0.15)
  };
};

export function buildDetailData() {
  const songs = [];
  for (let id = 1; id <= CONSTANT_SONGS; id++) {
    const song = {
      id,
      song_name: `合成曲目 ${id}`,
      song_name_jp: `テスト楽曲 ${id}`,
      type: GENRES[id % GENRES.length],
      bpm: String(120 + id),
      open_day: `${(id % 12) + 1}/${(id % 27) + 1}/2024`,
      shelf_status: 0,
      level_1: 2 + (id % 3),
      level_2: 4 + (id % 3),
      level_3: 6 + (id % 3),
      level_4: 8 + (id % 3),
      ...(id % 3 === 0 || id === IDS.full ? { level_5: 9 + (id % 2) } : {})
    };
    song.max_combo = [200 + id, 300 + id, 450 + id, 300 + id * 7 + 4 * 120, song.level_5 ? 300 + id * 7 + 5 * 120 : ""];
    songs.push(song);
  }
  Object.assign(songs[IDS.full - 1], {
    song_name: "合成曲目 1 千本桜",
    song_name_jp: "テスト楽曲 1 千本桜",
    subtitle: "合成副标题 from サンプル",
    type: "博歌乐音乐",
    version: ["v1", "nijiiro"],
    artists: ["合成作曲", "テスト歌唱"],
    level_5: 10
  });
  Object.assign(songs[IDS.sides - 1], {
    ourtaiko_difficulties: [
      { difficulty: 4, side: "p1", level: 9 },
      { difficulty: 4, side: "p2", level: 10 }
    ]
  });
  Object.assign(songs[IDS.removed - 1], { shelf_status: 1 });
  Object.assign(songs[IDS.other - 1], { shelf_status: 2 });
  Object.assign(songs[IDS.sparse - 1], {
    song_name: "很长很长的合成曲目标题用于检查换行与截断 Extended Long Mix(Long Version)",
    song_name_jp: undefined,
    bpm: undefined,
    open_day: undefined,
    artists: undefined
  });
  Object.assign(songs[IDS.noEdit - 1], { level_5: undefined });
  songs[IDS.noEdit - 1].max_combo[4] = "";
  songs.push({
    id: IDS.canonical,
    legacy_ids: [99],
    song_name: "合成曲目 100 归并",
    song_name_jp: "テスト楽曲 100",
    type: "游戏音乐",
    bpm: "180",
    open_day: "5/5/2025",
    shelf_status: 0,
    level_1: 3,
    level_2: 5,
    level_3: 7,
    level_4: 9
  });
  const rating = {
    songs: [
      { id: 1, level: 4, combo: 1000, 曲名: "合成曲目 1", 复合处理: 31.5, 平均密度: 22.1, 瞬间密度: 40.2, 叩き分け: 18.4, BPM变化: 5, hs变化: 2.25 },
      { id: 1, level: 5, combo: 1120, 曲名: "合成曲目 1", 复合处理: 35.5, 平均密度: 25.1, 瞬间密度: 44.2, 叩き分け: 20.4, BPM变化: 6, hs变化: 3.5 },
      { id: 2, level: 4, combo: 900, 复合处理: 12, 平均密度: 9, 瞬间密度: 15, 叩き分け: 7, BPM变化: 0, hs变化: 0 }
    ]
  };
  const branchManifest = {
    songs: { [IDS.full]: { ONI: [{ label: "普通" }, { label: "玄人", aliases: ["达人"] }] } }
  };
  const v2Payload = {};
  for (const song of songs) {
    if (song.id > CONSTANT_SONGS || song.id === IDS.sparse) continue;
    v2Payload[song.id] = { hard: chartValues(song.id, 3), oni: chartValues(song.id, 4), ...(song.level_5 ? { edit: chartValues(song.id, 5) } : {}) };
  }
  return { songs: songs.map((s) => JSON.parse(JSON.stringify(s))), rating, branchManifest, v2Payload };
}

/** V2 rows the constants API derives from the payload (same filter as buildV2ConstantsRows for this data). */
export function expectedV2Rows(data) {
  const rows = [];
  for (const [id, charts] of Object.entries(data.v2Payload)) {
    const song = data.songs.find((s) => s.id === Number(id));
    for (const difficulty of ["hard", "oni", "edit"]) {
      const c = charts[difficulty];
      if (!c) continue;
      rows.push({ id: Number(id), songName: song.song_name, difficulty, totalNotes: c.totalNotes, subConstant1: c.sub_constant_1, mainConstant: c.main_constant, subConstant2: c.sub_constant_2, stamina: c.stamina, handspeed: c.handspeed, burst: c.burst, complex: c.complex, rhythm: c.rhythm });
    }
  }
  return rows;
}

/** A small valid PNG (RGB stripes). */
export function stripedPng(width, height, seed = 0) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const band = Math.floor((x + seed * 37) / 40) % 3;
      const i = row + 1 + x * 3;
      raw[i] = band === 0 ? 230 : 250;
      raw[i + 1] = band === 1 ? 200 : 245;
      raw[i + 2] = y % 60 < 4 ? 120 : 240;
    }
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed) >>> 0);
    return Buffer.concat([len, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const FOLDERS = ["Kantan", "Futsuu", "Muzukashii", "Oni", "InnerOni"];

/** Write every file under `dir`. Returns helpers to break / restore the song file for the SSR failure check. */
export async function writeDetailFiles(dir, data = buildDetailData()) {
  const songFile = resolve(dir, "song_data.json");
  const writeSongs = async (content, offsetMs) => {
    await writeFile(songFile, content);
    const when = new Date(Date.now() + offsetMs);
    await utimes(songFile, when, when);
  };
  await writeSongs(JSON.stringify(data.songs), 0);
  await writeFile(resolve(dir, "rating.json"), JSON.stringify(data.rating));
  await writeFile(resolve(dir, "branch_audio_manifest.json"), JSON.stringify(data.branchManifest));
  // chart images: song 1 every difficulty; song 2 oni single / P1 / P2; song 6 oni
  for (const [id, difficulty, side] of [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 4, "p1"], [2, 4, "p2"], [6, 4], [3, 4], [4, 4]]) {
    const folder = resolve(dir, "assets", "fumens", FOLDERS[difficulty - 1]);
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, `${id}${side ? `-${side}` : ""}.png`), stripedPng(1200, 640, id + difficulty));
  }
  // TJA bundle for song 1: a TJA with WAVE, the audio file, the sync report naming the TJA root, and the index cache
  const tjaRoot = resolve(dir, "tja");
  await mkdir(resolve(tjaRoot, "song1"), { recursive: true });
  await writeFile(resolve(tjaRoot, "song1", "song1.tja"), "TITLE:Synthetic\nBPM:150\nWAVE:song1.ogg\nCOURSE:Oni\nLEVEL:9\n#START\n1010,\n#END\n");
  await writeFile(resolve(tjaRoot, "song1", "song1.ogg"), Buffer.from("OggS synthetic audio placeholder"));
  await mkdir(resolve(dir, "logs"), { recursive: true });
  const report = resolve(dir, "logs", "ese_audio_sync_report.json");
  await writeFile(report, JSON.stringify({ repo: { repo_path: tjaRoot } }));
  const cache = resolve(dir, "viewer-cache");
  await mkdir(cache, { recursive: true });
  const indexCache = async () => {
    const cacheKey = [(await stat(songFile)).mtimeMs, (await stat(report)).mtimeMs, tjaRoot].join(":");
    const index = {
      tja_root: tjaRoot,
      song_count: data.songs.length,
      matched_count: 1,
      unresolved_count: data.songs.length - 1,
      matches: { 1: { tja_path: resolve(tjaRoot, "song1", "song1.tja"), rel_path: "song1/song1.tja" } }
    };
    await writeFile(resolve(cache, "song-tja-index.json"), JSON.stringify({ version: 1, savedAt: new Date().toISOString(), data: { cacheKey, data: index } }));
  };
  await indexCache();
  // V2: the persisted snapshot of the remote source, fresh (within the one-hour TTL), so no refresh is attempted
  const fetchedAt = new Date().toISOString();
  await writeFile(resolve(cache, "v2-constants.json"), JSON.stringify({ version: 1, savedAt: fetchedAt, data: { payload: data.v2Payload, fetchedAt, expiresAt: Date.now() + 3600000 } }));
  return {
    data,
    breakSongs: () => writeSongs("not json", 2000),
    restoreSongs: async () => {
      await writeSongs(JSON.stringify(data.songs), 4000);
      await indexCache();
    }
  };
}
