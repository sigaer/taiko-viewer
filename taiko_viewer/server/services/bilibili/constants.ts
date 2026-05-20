export { BILIBILI_DYNAMIC_LIMIT, BILIBILI_DYNAMIC_UID } from "~/utils/bilibili";

export const BILIBILI_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const DYNAMIC_CACHE_TTL_MS = 10 * 60 * 1000;
export const IMAGE_CACHE_TTL_MS = 60 * 60 * 1000;
export const WBI_CACHE_TTL_MS = 60 * 60 * 1000;

export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_REDIRECT_HOPS = 5;

export const ALLOWED_IMAGE_HOST_SUFFIXES = [".hdslb.com", ".bilibili.com", ".bilivideo.com"];

export const DYNAMIC_FEATURES =
  "itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,forwardListHidden,decorationCard,commentsNewVersion,onlyfansAssetsV2,ugcDelete,onlyfansQaCard,avatarAutoTheme,sunflowerStyle,cardsEnhance,eva3CardOpus,eva3CardVideo,eva3CardComment,eva3CardUser";
