import { prepareViewerBindingVerification, confirmViewerBindingVerification } from "../../services/account/binding-verification";
import { removeViewerBinding, switchViewerBinding } from "../../services/account/binding-lifecycle";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { readViewerBindings } from "../../internal/account/binding-read.ts";
import {
  extractBindTitleInfo,
  fetchBindPlayerProfile,
  normalizeTaikoId,
  sanitizeBinding,
  BIND_VERIFY_TTL_MS,
  ensureNonEmpty
} from "../../internal/account/shared";

export const listBindings = async (userId: number) => {
  await ensureAccountSchema("source");
  const db = getAccountDb();
  const rows = await readViewerBindings(db, userId);
  return rows.map(sanitizeBinding);
};

const readBindingTitle = async (taikoId: string) => extractBindTitleInfo(await fetchBindPlayerProfile(taikoId));

export const startBindingVerification = (userId: number, taikoIdInput: unknown) => {
  const taikoId = normalizeTaikoId(taikoIdInput);
  ensureNonEmpty(taikoId, "请输入鼓众广场 ID");
  return prepareViewerBindingVerification(userId, taikoId, readBindingTitle, BIND_VERIFY_TTL_MS);
};

export const confirmBindingVerification = (userId: number, taikoIdInput: unknown) => {
  const taikoId = normalizeTaikoId(taikoIdInput);
  ensureNonEmpty(taikoId, "请输入鼓众广场 ID");
  return confirmViewerBindingVerification(userId, taikoId, readBindingTitle);
};

export const switchCurrentBinding = (userId: number, bindingIdInput: unknown) =>
  switchViewerBinding(userId, bindingIdInput);

export const removeBinding = (userId: number, bindingIdInput: unknown, forceInput?: unknown) =>
  removeViewerBinding(userId, bindingIdInput, forceInput);
