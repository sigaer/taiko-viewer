import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { H3Event, MultiPartData } from "h3";
import { createError, readMultipartFormData } from "h3";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import {
  type DeveloperApplicationRow,
  type DeveloperTokenRow,
  clipText,
  ensureNonEmpty,
  ensureValidEmail,
  getOssClient,
  normalizeEmail,
  readBearerTokenFromEvent,
  requireConfiguredOss,
  sendAccountMail,
  sha256,
  toIso
} from "./shared";

export type DeveloperApplicationPublic = {
  id: number;
  replyEmail: string;
  reason: string;
  imageUrls: string[];
  status: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
  applicant?: {
    id: number;
    username: string;
    email: string;
  };
  reviewer?: {
    id: number;
    username: string;
    email: string;
  } | null;
};

export type DeveloperTokenPublic = {
  id: number;
  tokenMask: string;
  status: string;
  issuedAt: string;
  lastUsedAt: string;
  revokedAt: string;
};

export type DeveloperApplicationMultipart = {
  reason: string;
  replyEmail: string;
  images: MultiPartData[];
};

export const DEVELOPER_APPLICATION_MAX_IMAGES = 4;
export const DEVELOPER_APPLICATION_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const DEVELOPER_TOKEN_LENGTH = 24;

const APPLICATION_IMAGE_PREFIX = "viewer/developer-applications";
const APPLICATION_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const TOKEN_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const readMultipartText = (part: MultiPartData | undefined) => Buffer.from(part?.data || []).toString("utf-8").trim();

const parseJsonArray = (value: string | null | undefined) => {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const getDeveloperReviewInbox = () => {
  const runtimeConfig = useRuntimeConfig();
  const value = String(runtimeConfig.developerReviewInbox || process.env.TAIKO_DEVELOPER_REVIEW_INBOX || "").trim();
  return value || "1106865024@qq.com";
};

export const readDeveloperApplicationMultipart = async (event: H3Event): Promise<DeveloperApplicationMultipart> => {
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到开发者申请内容" });
  }
  return {
    reason: readMultipartText(parts.find((item) => item.name === "reason")),
    replyEmail: readMultipartText(parts.find((item) => item.name === "replyEmail")),
    images: parts.filter((item) => item.filename && String(item.name || "").startsWith("images"))
  };
};

export const uploadDeveloperApplicationImages = async (userId: number, files: MultiPartData[]) => {
  if (!files.length) return [];
  if (files.length > DEVELOPER_APPLICATION_MAX_IMAGES) {
    throw createError({ statusCode: 400, statusMessage: `最多上传 ${DEVELOPER_APPLICATION_MAX_IMAGES} 张截图` });
  }
  const ossConfig = requireConfiguredOss();
  const client = getOssClient();
  const urls: string[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file?.data?.length) {
      throw createError({ statusCode: 400, statusMessage: "开发者申请截图为空" });
    }
    if ((file.data as Buffer).byteLength > DEVELOPER_APPLICATION_IMAGE_MAX_BYTES) {
      throw createError({ statusCode: 400, statusMessage: "开发者申请截图请控制在 8MB 以内" });
    }
    const mime = String(file.type || "").toLowerCase();
    if (!APPLICATION_IMAGE_MIME_TYPES.includes(mime)) {
      throw createError({ statusCode: 400, statusMessage: "开发者申请截图仅支持 JPG、PNG、WEBP、GIF" });
    }
    const webpBuffer = await sharp(file.data as Buffer, { animated: true })
      .rotate()
      .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
    const key = `${APPLICATION_IMAGE_PREFIX}/${userId}/${Date.now()}-${index + 1}.webp`;
    await client.put(key, webpBuffer, {
      headers: {
        "Content-Type": "image/webp"
      }
    });
    urls.push(`${ossConfig.publicBaseUrl.replace(/\/$/, "")}/${key}`);
  }
  return urls;
};

export const generateDeveloperToken = () => {
  let token = "";
  while (token.length < DEVELOPER_TOKEN_LENGTH) {
    const random = randomBytes(1)[0] % TOKEN_ALPHABET.length;
    token += TOKEN_ALPHABET[random];
  }
  return token;
};

export const maskDeveloperToken = (token: string) => {
  if (token.length <= 10) {
    return `${token.slice(0, 2)}****${token.slice(-2)}`;
  }
  return `${token.slice(0, 6)}${"*".repeat(Math.max(4, token.length - 10))}${token.slice(-4)}`;
};

export const normalizeDeveloperApplicationInput = (payload: {
  reason: string;
  replyEmail: string;
}) => {
  const reason = clipText(String(payload.reason || ""), 4000);
  const replyEmail = normalizeEmail(payload.replyEmail);
  ensureNonEmpty(reason, "请输入开发者权限申请理由");
  ensureNonEmpty(replyEmail, "请输入接收反馈邮箱");
  ensureValidEmail(replyEmail);
  return {
    reason,
    replyEmail
  };
};

export const normalizeReviewNote = (value: unknown, required = false) => {
  const note = clipText(String(value || ""), 2000);
  if (required) {
    ensureNonEmpty(note, "请填写审批说明");
  }
  return note;
};

export const toDeveloperTokenPublic = (row: DeveloperTokenRow | null | undefined): DeveloperTokenPublic | null => {
  if (!row) return null;
  return {
    id: row.id,
    tokenMask: row.token_mask,
    status: String(row.status || "unknown"),
    issuedAt: toIso(row.issued_at),
    lastUsedAt: toIso(row.last_used_at),
    revokedAt: toIso(row.revoked_at)
  };
};

export const toDeveloperApplicationPublic = (
  row: (DeveloperApplicationRow & {
    applicant_id?: number | null;
    applicant_username?: string | null;
    applicant_email?: string | null;
    reviewer_id?: number | null;
    reviewer_username?: string | null;
    reviewer_email?: string | null;
  }) | null | undefined
): DeveloperApplicationPublic | null => {
  if (!row) return null;
  const applicantId = Number(row.applicant_id ?? row.user_id ?? 0) || 0;
  const applicantUsername = String(row.applicant_username || "").trim();
  const applicantEmail = String(row.applicant_email || "").trim();
  const reviewerId = Number(row.reviewer_id ?? row.reviewed_by_user_id ?? 0) || 0;
  const reviewerUsername = String(row.reviewer_username || "").trim();
  const reviewerEmail = String(row.reviewer_email || "").trim();
  return {
    id: row.id,
    replyEmail: row.reply_email,
    reason: row.reason,
    imageUrls: parseJsonArray(row.image_urls_json),
    status: String(row.status || "pending"),
    reviewNote: String(row.review_note || ""),
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    applicant:
      applicantId > 0 && applicantUsername
        ? {
            id: applicantId,
            username: applicantUsername,
            email: applicantEmail
          }
        : undefined,
    reviewer:
      reviewerId > 0 && reviewerUsername
        ? {
            id: reviewerId,
            username: reviewerUsername,
            email: reviewerEmail
          }
        : null
  };
};

export const sendDeveloperApplicationNotification = async (payload: {
  applicantUsername: string;
  applicantEmail: string;
  replyEmail: string;
  reason: string;
  imageUrls: string[];
  createdAt: string;
}) => {
  const imageBlock = payload.imageUrls.length
    ? `<p><strong>截图：</strong></p><ul>${payload.imageUrls.map((url) => `<li><a href="${url}">${url}</a></li>`).join("")}</ul>`
    : "<p><strong>截图：</strong>未上传</p>";
  await sendAccountMail({
    to: getDeveloperReviewInbox(),
    subject: "Sakura Taiko Viewer 开发者权限新申请",
    text: [
      "收到新的开发者权限申请。",
      `申请人：${payload.applicantUsername} <${payload.applicantEmail}>`,
      `反馈邮箱：${payload.replyEmail}`,
      `提交时间：${payload.createdAt}`,
      `申请理由：${payload.reason}`,
      payload.imageUrls.length ? `截图：${payload.imageUrls.join(" | ")}` : "截图：未上传",
      "审批入口：/account/developer/review"
    ].join("\n"),
    html: `<div style="font-family: sans-serif; line-height: 1.7;">
      <h2>新的开发者权限申请</h2>
      <p><strong>申请人：</strong>${payload.applicantUsername} &lt;${payload.applicantEmail}&gt;</p>
      <p><strong>反馈邮箱：</strong>${payload.replyEmail}</p>
      <p><strong>提交时间：</strong>${payload.createdAt}</p>
      <p><strong>申请理由：</strong></p>
      <p style="white-space: pre-wrap;">${payload.reason}</p>
      ${imageBlock}
      <p><strong>审批入口：</strong>/account/developer/review</p>
    </div>`
  });
};

export const sendDeveloperApprovedMail = async (payload: {
  email: string;
  username: string;
  token: string;
  reviewNote: string;
}) => {
  const reviewNoteHtml = payload.reviewNote ? `<p><strong>审批备注：</strong>${payload.reviewNote}</p>` : "";
  await sendAccountMail({
    to: payload.email,
    subject: "Sakura Taiko Viewer 开发者权限申请已通过",
    text: [
      `${payload.username}，你的开发者权限申请已通过。`,
      `开发者 Token：${payload.token}`,
      payload.reviewNote ? `审批备注：${payload.reviewNote}` : "",
      "请妥善保管该 Token，并通过 Authorization: Bearer <token> 调用开发者 API。"
    ]
      .filter(Boolean)
      .join("\n"),
    html: `<div style="font-family: sans-serif; line-height: 1.7;">
      <p>${payload.username}，你的开发者权限申请已通过。</p>
      <p><strong>开发者 Token：</strong></p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 0.08em;">${payload.token}</p>
      ${reviewNoteHtml}
      <p>请妥善保管该 Token，并通过 <code>Authorization: Bearer &lt;token&gt;</code> 调用开发者 API。</p>
    </div>`
  });
};

export const sendDeveloperRejectedMail = async (payload: {
  email: string;
  username: string;
  reviewNote: string;
}) => {
  await sendAccountMail({
    to: payload.email,
    subject: "Sakura Taiko Viewer 开发者权限申请未通过",
    text: [`${payload.username}，你的开发者权限申请未通过。`, `未通过理由：${payload.reviewNote}`].join("\n"),
    html: `<div style="font-family: sans-serif; line-height: 1.7;">
      <p>${payload.username}，你的开发者权限申请未通过。</p>
      <p><strong>未通过理由：</strong>${payload.reviewNote}</p>
    </div>`
  });
};

export const getActiveDeveloperTokenRow = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<DeveloperTokenRow>[]>(
    "SELECT * FROM web_developer_tokens WHERE user_id = ? AND status = 'active' ORDER BY issued_at DESC, id DESC LIMIT 1",
    [userId]
  );
  return rows[0] || null;
};

export const getDeveloperTokenRowByHash = async (tokenInput: string) => {
  await ensureAccountSchema();
  const token = String(tokenInput || "").trim();
  ensureNonEmpty(token, "缺少开发者 token");
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<DeveloperTokenRow>[]>(
    "SELECT * FROM web_developer_tokens WHERE token_hash = ? AND status = 'active' LIMIT 1",
    [sha256(token)]
  );
  return rows[0] || null;
};

export const touchDeveloperToken = async (tokenId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  await db.execute("UPDATE web_developer_tokens SET last_used_at = NOW() WHERE id = ?", [tokenId]);
};

export const readDeveloperBearerToken = (event: H3Event) => readBearerTokenFromEvent(event);
