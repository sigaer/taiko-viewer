import type { H3Event, MultiPartData } from "h3";
import { createError, readMultipartFormData } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import {
  ALLOWED_IMAGE_FORMATS,
  ALLOWED_IMAGE_MIME_TYPES,
  detectImageFormat,
  ensureForumProfile,
  ensureForumSchema,
  getOssClient,
  IMAGE_MAX_BYTES,
  requireConfiguredOss,
  sanitizeInt
} from "../../internal/forum/shared";
import sharp from "sharp";

export const readForumImageMultipart = async (event: H3Event) => {
  const files = await readMultipartFormData(event);
  if (!files?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到上传文件" });
  }
  const image = files.find((item) => item.name === "image") || files[0];
  if (!image) {
    throw createError({ statusCode: 400, statusMessage: "未收到论坛图片" });
  }
  return image;
};

export const uploadForumImage = async (event: H3Event, file: MultiPartData) => {
  await ensureForumSchema();
  const user = await requireAccountUser(event);
  await ensureForumProfile(user.id);
  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到论坛图片" });
  }
  if ((file.data as Buffer).byteLength > IMAGE_MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "论坛图片过大，请控制在 8MB 以内" });
  }
  const mime = String(file.type || "").toLowerCase();
  const detectedFormat = await detectImageFormat(file.data as Buffer);
  const allowedMime = ALLOWED_IMAGE_MIME_TYPES.includes(mime as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]);
  if (!allowedMime && !ALLOWED_IMAGE_FORMATS.has(detectedFormat)) {
    throw createError({ statusCode: 400, statusMessage: "仅支持 JPG、PNG、WEBP、GIF 图片" });
  }
  const buffer = await sharp(file.data as Buffer, { animated: true })
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const meta = await sharp(buffer).metadata();
  const ossConfig = requireConfiguredOss();
  const client = getOssClient();
  const key = `forum/threads/${user.id}/${Date.now()}.webp`;
  await client.put(key, buffer, {
    headers: {
      "Content-Type": "image/webp"
    }
  });
  const url = `${ossConfig.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  return {
    imageUrl: url,
    width: sanitizeInt(meta.width),
    height: sanitizeInt(meta.height)
  };
};
