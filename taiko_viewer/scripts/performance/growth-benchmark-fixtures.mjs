import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const baseInstant = Date.parse("2025-10-07T01:00:00Z");
const local = iso => new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 19).replace("T", " ");
const chart = id => ({ song_no: id, level: 4, high_score: 900000, best_score_rank: 4, good_cnt: 480, ok_cnt: 10, ng_cnt: 10, combo_cnt: 300, stage_cnt: 1, clear_cnt: 1, full_combo_cnt: 0, dondaful_combo_cnt: 0, highscore_datetime: "2025-10-07T01:00:00Z", update_datetime: "2025-10-07T01:00:00Z" });
export const fixtureCases = ["real", "iso-full", "local-full", "mixed", "no-baseline", "invalid", "boundary", "truncated"];
export async function prepareFixture(mode, out, realRoot = "/home/sigaer/taiko/userdata") {
  if (mode === "real") {
    let id = "", count = 0;
    for (const entry of await readdir(realRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const names = (await readdir(resolve(realRoot, entry.name)).catch(() => [])).filter(n => n.startsWith("data_") && n.endsWith(".json"));
      if (names.length > count) { id = entry.name; count = names.length; }
    }
    if (!id) throw new Error("No readonly history sample");
    const current = JSON.parse(await readFile(resolve(realRoot, `${id}data.json`), "utf8"));
    return { userdataDir: realRoot, id, current: current.songs || [], owned: false };
  }
  const userdataDir = resolve(out, `fixture-${mode}`), id = "synthetic";
  await mkdir(resolve(userdataDir, id), { recursive: true, mode: 0o700 });
  const large = ["iso-full", "local-full"].includes(mode);
  const count = large || mode === "truncated" ? 2001 : mode === "boundary" ? 12 : 40;
  const localDates = ["local-full", "truncated"].includes(mode);
  const songs = Array.from({ length: large ? 500 : mode === "truncated" ? 1 : 6 }, (_, i) => chart(i + 1));
  for (let i = 0; i < count; i++) {
    const iso = new Date(baseInstant + i * 365 * 86400000 / (count - 1)).toISOString();
    const changed = songs[i % songs.length];
    changed.high_score++; changed.stage_cnt++;
    changed.update_datetime = iso; changed.highscore_datetime = iso;
    if (mode === "boundary") {
      const at = ["2026-10-07T15:59:59Z", "2026-10-07T16:00:00Z", "2026-10-07T16:00:00.001Z", "2026-10-08T00:01:00+08:00"][i % 4];
      changed.update_datetime = at; changed.highscore_datetime = at;
      if (i === 5) changed.stage_cnt = 0;
      if (i === 7) changed.full_combo_cnt = 1;
    }
    const full = mode !== "no-baseline" && (large || i === 0 || i % 10 === 0);
    const rows = full ? songs : [changed];
    const payload = { songs: rows.map(row => localDates ? { ...row, update_datetime: local(row.update_datetime), highscore_datetime: local(row.highscore_datetime) } : row), _meta: { full, ts: mode === "truncated" ? local(iso) : iso, writer_source: mode === "boundary" && i === 8 ? "manual-score" : "wahlap" } };
    const name = `data_${iso.replaceAll("-", "").slice(0, 8)}_${iso.slice(11, 19).replaceAll(":", "")}.json`;
    await writeFile(resolve(userdataDir, id, name), mode === "invalid" && i === 5 ? "bad-json" : mode === "invalid" && i === 15 ? '{"songs":null}' : JSON.stringify(payload));
  }
  return { userdataDir, id, current: songs.map(row => localDates ? { ...row, update_datetime: local(row.update_datetime), highscore_datetime: local(row.highscore_datetime) } : { ...row }), owned: true };
}
