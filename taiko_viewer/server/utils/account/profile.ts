import { createError } from "h3";
import type { H3Event, MultiPartData } from "h3";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { requireAccountUser } from "./auth";
import { listBindings } from "./bindings";
import { getQqBinding } from "./qq";
import {
  type AccountRow,
  AVATAR_MAX_BYTES,
  DEFAULT_AVATAR,
  enrichBindingWithCurrentTitle,
  getOssClient,
  getPendingBinding,
  readAvatarMultipart,
  requireConfiguredOss,
  sanitizePublicUser,
  type BindingSummary
} from "../../internal/account/shared";
import sharp from "sharp";

export const getAccountProfile = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [userRows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT * FROM web_user_accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const user = userRows[0];
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const bindings = await listBindings(userId);
  const baseCurrentBinding = bindings.find((item) => item.isCurrent) || bindings[0] || null;
  const currentBinding = baseCurrentBinding
    ? await enrichBindingWithCurrentTitle(baseCurrentBinding)
    : null;
  const pendingBinding = await getPendingBinding(userId);
  const qqBinding = await getQqBinding(userId);
  return {
    user: sanitizePublicUser(user),
    bindings,
    currentBinding,
    pendingBinding,
    qqBinding,
    verificationStatus: {
      emailVerified: Boolean(user.email_verified),
      taikoVerified: Boolean(currentBinding)
    }
  };
};

export const uploadAvatarForUser = async (userId: number, file: MultiPartData) => {
  await ensureAccountSchema();
  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到头像文件" });
  }
  if ((file.data as Buffer).byteLength > AVATAR_MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "头像文件过大，请控制在 4MB 以内" });
  }
  const mime = String(file.type || "").toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    throw createError({ statusCode: 400, statusMessage: "仅支持 JPG、PNG、WEBP、GIF 图片" });
  }

  const buffer = await sharp(file.data as Buffer)
    .rotate()
    .resize(320, 320, { fit: "cover" })
    .webp({ quality: 84 })
    .toBuffer();

  const ossConfig = requireConfiguredOss();
  const client = getOssClient();
  const key = `${ossConfig.avatarPrefix.replace(/^\/+|\/+$/g, "")}/${userId}/${Date.now()}.webp`;
  await client.put(key, buffer, {
    headers: {
      "Content-Type": "image/webp"
    }
  });
  const url = `${ossConfig.publicBaseUrl.replace(/\/$/, "")}/${key}`;

  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT avatar_key FROM web_user_accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const oldKey = rows[0]?.avatar_key;
  await db.execute(
    "UPDATE web_user_accounts SET avatar_url = ?, avatar_key = ? WHERE id = ?",
    [url, key, userId]
  );

  if (oldKey && oldKey !== key) {
    try {
      await client.delete(oldKey);
    } catch {
      // Ignore old avatar deletion failure.
    }
  }

  return { avatarUrl: url };
};

export const removeAvatarForUser = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT avatar_key FROM web_user_accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const avatarKey = rows[0]?.avatar_key;
  if (avatarKey) {
    try {
      await getOssClient().delete(avatarKey);
    } catch {
      // Ignore missing remote avatar.
    }
  }
  await db.execute("UPDATE web_user_accounts SET avatar_url = NULL, avatar_key = NULL WHERE id = ?", [userId]);
  return { avatarUrl: DEFAULT_AVATAR };
};

export { readAvatarMultipart };

export const getProfileResponse = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  return getAccountProfile(user.id);
};
