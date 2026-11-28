// Drafts of the reply box and the composer, kept in the browser (localStorage) so a refresh or a closed tab does not
// lose them. Pure helpers: the storage is passed in, so nothing here runs during server rendering, and the pages read
// a draft only after mount. Only text and the URLs of images that were already uploaded are kept, never image bytes.
// A draft belongs to one account (its id is part of the key) and is removed once the post is accepted.

export const DRAFT_PREFIX = "taiko-forum-draft:v1";
const MAX_TEXT = 4000;
const MAX_PARAGRAPHS = 50;
const MAX_IMAGES = 50;
const MAX_URL = 1024;

export interface ReplyDraft {
  body: string;
  images: string[];
  targetId: number | null;
  targetLabel: string;
}
export interface ThreadDraft {
  sectionSlug: string;
  threadType: string;
  title: string;
  summary: string;
  tagsInput: string;
  paragraphDraft: string;
  paragraphs: string[];
  images: Array<{ imageUrl: string; caption: string }>;
}
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const validId = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export const replyDraftKey = (userId: unknown, threadId: unknown) =>
  validId(userId) && validId(Number(threadId)) ? `${DRAFT_PREFIX}:reply:${userId}:${Number(threadId)}` : null;
export const threadDraftKey = (userId: unknown) => (validId(userId) ? `${DRAFT_PREFIX}:thread:${userId}` : null);

const text = (value: unknown, max = MAX_TEXT) => (typeof value === "string" ? value.slice(0, max) : "");
// Uploaded images are https URLs returned by /api/forum/media/images; anything else (data:, blob:) is dropped.
const imageUrl = (value: unknown) =>
  typeof value === "string" && value.length <= MAX_URL && /^https:\/\/\S+$/.test(value) ? value : "";

export function cleanReplyDraft(input: unknown): ReplyDraft | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const targetId = validId(raw.targetId) ? (raw.targetId as number) : null;
  const draft: ReplyDraft = {
    body: text(raw.body, 1000),
    images: (Array.isArray(raw.images) ? raw.images : []).map(imageUrl).filter(Boolean).slice(0, 4),
    targetId,
    targetLabel: targetId ? text(raw.targetLabel, 200) : ""
  };
  return draft.body.trim() || draft.images.length ? draft : null;
}

export function cleanThreadDraft(input: unknown): ThreadDraft | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const images: ThreadDraft["images"] = [];
  for (const item of Array.isArray(raw.images) ? raw.images : []) {
    if (!item || typeof item !== "object") continue;
    const url = imageUrl((item as Record<string, unknown>).imageUrl);
    if (url && images.length < MAX_IMAGES) images.push({ imageUrl: url, caption: text((item as Record<string, unknown>).caption, 160) });
  }
  const draft: ThreadDraft = {
    sectionSlug: /^[a-z0-9][a-z0-9_-]{0,63}$/.test(String(raw.sectionSlug || "")) ? String(raw.sectionSlug) : "",
    threadType: /^[a-z]{1,16}$/.test(String(raw.threadType || "")) ? String(raw.threadType) : "",
    title: text(raw.title, 120),
    summary: text(raw.summary, 280),
    tagsInput: text(raw.tagsInput, 200),
    paragraphDraft: text(raw.paragraphDraft),
    paragraphs: (Array.isArray(raw.paragraphs) ? raw.paragraphs : []).map((p) => text(p)).filter((p) => p.trim()).slice(0, MAX_PARAGRAPHS),
    images
  };
  const hasContent =
    [draft.title, draft.summary, draft.tagsInput, draft.paragraphDraft].some((v) => v.trim()) || draft.paragraphs.length > 0 || draft.images.length > 0;
  return hasContent ? draft : null;
}

export function readDraft<T>(storage: DraftStorage | null | undefined, key: string | null, clean: (input: unknown) => T | null): T | null {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? clean(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Saves the cleaned draft; an empty draft removes the key. Storage errors (quota, private mode) are ignored. */
export function writeDraft<T>(storage: DraftStorage | null | undefined, key: string | null, draft: unknown, clean: (input: unknown) => T | null): void {
  if (!storage || !key) return;
  try {
    const value = clean(draft);
    if (value) storage.setItem(key, JSON.stringify(value));
    else storage.removeItem(key);
  } catch {}
}

export function removeDraft(storage: DraftStorage | null | undefined, key: string | null): void {
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {}
}

/** window.localStorage when it can be used (in the browser and not blocked); null otherwise. */
export function browserDraftStorage(): DraftStorage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
