import { readBody } from "h3";
import {
  claimManualAccount,
  createManualAccount,
  deleteManualScore,
  detachManualAccount,
  getManualScore,
  issueManualClaimCode,
  permanentlyDeleteManualAccount,
  renameManualAccount,
  requireBotService,
  resolveManualTaikoIdForOwner,
  setManualAccountVisibility,
  upsertManualScore
} from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  requireBotService(event);
  const body = await readBody(event);
  const owner = {
    kind: "bot" as const,
    identityKey: String(body?.identityKey || "").trim()
  };
  const action = String(body?.action || "").trim();
  if (action === "create") return createManualAccount(owner, body?.nickname, body?.requestId);
  if (action === "claim") return claimManualAccount(owner, body?.code);
  if (action === "rename") {
    const taikoId = await resolveManualTaikoIdForOwner(owner, body?.taikoId);
    return renameManualAccount(owner, taikoId, body?.nickname);
  }
  if (action === "visibility") {
    const taikoId = await resolveManualTaikoIdForOwner(owner, body?.taikoId);
    return setManualAccountVisibility(owner, taikoId, body?.visible);
  }
  if (action === "claim-code") {
    const taikoId = await resolveManualTaikoIdForOwner(owner, body?.taikoId);
    return issueManualClaimCode(owner, taikoId);
  }
  if (action === "detach") return detachManualAccount(owner, body?.taikoId);
  if (action === "delete-account") {
    return permanentlyDeleteManualAccount(owner, body?.taikoId, body?.confirmed);
  }
  if (action === "score-upsert") return upsertManualScore(owner, body?.taikoId, body || {});
  if (action === "score-get") {
    return getManualScore(owner, body?.taikoId, body?.songNo, body?.level);
  }
  if (action === "score-delete") {
    return deleteManualScore(owner, body?.taikoId, body?.songNo, body?.level, body?.confirmed);
  }
  throw createError({ statusCode: 400, statusMessage: "不支持的手动账号操作" });
});
