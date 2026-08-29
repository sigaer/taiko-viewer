import type { UserdataSong } from "../../internal/account/shared";
import { getCurrentBindingRow, readUserdata } from "../../internal/account/shared";
import { hasEffectiveScoreRecord } from "../../utils/account/songs";
import type { ResolvedUgcChart } from "./chart";
import { hasVerifiedPlayRecord } from "./verified-play-predicate";

export const hasVerifiedPlayInUserdata = (
  source: string,
  isCurrent: boolean,
  songs: UserdataSong[],
  songId: number,
  difficultyCode: number
) => {
  return hasVerifiedPlayRecord(source, isCurrent, songs, songId, difficultyCode, (song) =>
    hasEffectiveScoreRecord(song as UserdataSong)
  );
};

export const hasVerifiedPlayForChart = async (userId: number, chart: ResolvedUgcChart) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding || !binding.is_current || binding.source === "manual") return false;
  try {
    const userdata = await readUserdata(binding.taiko_id);
    return hasVerifiedPlayInUserdata(
      binding.source,
      Boolean(binding.is_current),
      userdata.songs || [],
      chart.songId,
      chart.difficultyCode
    );
  } catch {
    return false;
  }
};
