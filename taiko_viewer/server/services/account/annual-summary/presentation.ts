import { getSongCatalog, getSongCoverUrl } from "~/server/services/content";
import type { SongCatalogItem } from "~/types/content";
import type { AnnualLocale, AnnualSummaryV4 } from "./types";

const resolveSongName = (item: SongCatalogItem | undefined, locale: AnnualLocale, fallback: unknown) => {
  const zh = String(item?.song_name || "").trim();
  const ja = String(item?.song_name_jp || "").trim();
  return locale === "ja" ? ja || zh || String(fallback || "") : zh || ja || String(fallback || "");
};

export const enrichAnnualSummary = async (summary: AnnualSummaryV4, locale: AnnualLocale): Promise<AnnualSummaryV4> => {
  const catalog = await getSongCatalog();
  const songs = new Map<number, SongCatalogItem>(catalog.map((item) => [Number(item.id), item]));

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) output[key] = visit(child);

    const songNo = Number(source.songNo || 0);
    if (Number.isInteger(songNo) && songNo > 0) {
      const item = songs.get(songNo);
      const level = Number(source.level || 0);
      const stars = item && level >= 1 && level <= 5 ? Number(item[`level_${level}` as keyof SongCatalogItem]) : NaN;
      output.name = resolveSongName(item, locale, source.name || source.songName || source.songNameJa);
      output.subtitle = String(item?.subtitle || source.subtitle || "").trim();
      output.coverUrl = getSongCoverUrl(songNo);
      output.stars = Number.isFinite(stars) ? stars : null;
    }
    return output;
  };

  return visit(summary) as AnnualSummaryV4;
};
