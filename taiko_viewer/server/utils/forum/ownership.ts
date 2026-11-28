// Author edit / delete of one's own thread or reply: the permission rules, as pure functions (no database, no H3) so
// they can be tested on their own. The handlers in ./threads.ts load the rows, ask these, and repeat the same
// conditions in the UPDATE's WHERE clause so a concurrent change cannot slip between the check and the write.
//
// Deletion is a soft state on the existing `status` column ('deleted'); no schema change. Moderators keep exactly the
// powers they had (pin / feature / lock / hide through moderation/action); these rules never let anyone change
// another member's content.

export type AuthorWriteTarget = {
  authorUserId: number;
  /** the thread's status (thread writes) or the post's status (reply writes) */
  status: string;
  /** reply writes: the status of the thread the reply belongs to */
  threadStatus?: string;
  isLocked: boolean;
};

export type AuthorWriteDecision =
  | { ok: true }
  | { ok: false; statusCode: number; statusMessage: string };

export const FORUM_DELETED_STATUS = "deleted";

export const decideAuthorWrite = (
  target: AuthorWriteTarget | null | undefined,
  viewerUserId: number,
  kind: "thread" | "post"
): AuthorWriteDecision => {
  const missing = kind === "thread" ? "帖子不存在" : "回复不存在";
  if (!target || target.status !== "published") return { ok: false, statusCode: 404, statusMessage: missing };
  if (kind === "post" && target.threadStatus !== "published") return { ok: false, statusCode: 404, statusMessage: "帖子不存在" };
  if (!Number.isSafeInteger(viewerUserId) || viewerUserId <= 0 || target.authorUserId !== viewerUserId) {
    return { ok: false, statusCode: 403, statusMessage: "只能修改自己发布的内容" };
  }
  if (target.isLocked) return { ok: false, statusCode: 400, statusMessage: "该帖子已锁定，暂时无法修改" };
  return { ok: true };
};

/** A floor (top-level reply) that other replies hang under is not deleted: its replies would lose their floor. */
export const decideFloorDelete = (isFloor: boolean, liveChildCount: number): AuthorWriteDecision =>
  isFloor && liveChildCount > 0
    ? { ok: false, statusCode: 400, statusMessage: "该楼层已有回复，暂时无法删除" }
    : { ok: true };

/** Thread detail visibility: deleted threads are gone for everyone; hidden ones stay visible to moderators. */
export const threadVisibleTo = (status: string, role: string | null | undefined) =>
  status === "published" || (status !== FORUM_DELETED_STATUS && /admin|moderator/.test(role || ""));
