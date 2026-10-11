import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import type { LegacyScorePayload as UserdataPayload } from "../../domain/score-read-contract";
import type { ManualOwner } from "./manual-ownership";
import { manualActorKey } from "./manual-grants";
import { LIFECYCLE_UUID, MANUAL_SOURCE_ID } from "./source-lifecycle";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";

export type ManualCreation = RowDataPacket & {
 operation_id: string; taiko_id: string; actor_kind: "viewer" | "bot"; actor_key: string;
 nickname: string; status: "pending" | "ready"; initial_current: string; current_sha256: string;
 prior_current: string | null; pending_key: string | null;
};
export const manualCreationHash = (raw: string) => createHash("sha256").update(raw).digest("hex");
export const manualCreationPendingKey = (owner: ManualOwner, nickname: string) =>
 manualCreationHash(JSON.stringify([owner.kind, manualActorKey(owner), nickname]));
export function normalizeManualNickname(value: unknown) {
 const nickname = String(value || "").trim();
 if (!nickname) throw createError({ statusCode: 400, statusMessage: "请输入账号昵称" });
 if ([...nickname].length > 24) throw createError({ statusCode: 400, statusMessage: "昵称最多 24 个字符" });
 return nickname;
}
export const blankManualUserdata = (taikoId: string, nickname: string, stamp: string): UserdataPayload => ({
 _meta: { full: true, source: "manual", schema_version: 2, manual: true, ts: stamp },
 profile: { mydon_name: nickname, userid: taikoId, province: "手动录入", is_disp_dan_on: false,
  gameCostume: { titleplate_id: 0, title: "手动录入", mydon_name: nickname,
   costume_1: 0, costume_2: 0, costume_3: 0, costume_4: 0, costume_5: 0,
   color_limb: 0, color_body: 0, color_face: 0, got_dan_max: 0,
   is_disp_dan_on: false, is_disp_tojiru_on: 0, dan_name: { grade: "00", level: 0 } } },
 songs: [], achievement: { count_level: 1, ary_crown_count: [0, 0, 0], ary_score_rank_count: [0, 0, 0, 0, 0, 0, 0] }
});
export function creationOwner(row: ManualCreation): ManualOwner {
 const owner: ManualOwner = row.actor_kind === "viewer" ? { kind: "viewer", userId: Number(row.actor_key) }
  : { kind: "bot", identityKey: row.actor_key };
 if (!["viewer", "bot"].includes(row.actor_kind) || manualActorKey(owner) !== row.actor_key) throw new PublicationUnavailableError();
 return owner;
}
export function validateManualCreation(row: ManualCreation) {
 if (!LIFECYCLE_UUID.test(row.operation_id) || !MANUAL_SOURCE_ID.test(row.taiko_id) ||
  !["pending", "ready"].includes(row.status) || !row.actor_key || row.actor_key.length > 191 ||
  typeof row.initial_current !== "string" || Buffer.byteLength(row.initial_current) > 32 * 1024 ||
  !/^[a-f0-9]{64}$/.test(row.current_sha256) || manualCreationHash(row.initial_current) !== row.current_sha256 ||
  (row.prior_current !== null && (typeof row.prior_current !== "string" || row.prior_current.length > 64))) throw new PublicationUnavailableError();
 try {
  const owner = creationOwner(row);
  if (normalizeManualNickname(row.nickname) !== row.nickname) throw new Error();
  const data = JSON.parse(row.initial_current), stamp = data?._meta?.ts;
  if (typeof stamp !== "string" || !/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(stamp) ||
   JSON.stringify(blankManualUserdata(row.taiko_id, row.nickname, stamp), null, 4) !== row.initial_current ||
   (row.status === "pending" ? row.pending_key !== manualCreationPendingKey(owner, row.nickname) : row.pending_key !== null)) throw new Error();
 } catch { throw new PublicationUnavailableError(); }
 return row;
}
