import { createError } from "h3";
import type { Pool } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { readViewerCurrentBinding, requireViewerBindingOwner, type BindingRow } from "../../internal/account/binding-read.ts";
import { assertBindingIdentity, captureBindingIdentity } from "../../internal/account/binding-identity.ts";
import { sourceLifecycleFailure } from "../../internal/account/source-lifecycle.ts";
import { currentScoreScope, withDomainScoreRead, withDomainScoreWrite } from "../taiko-domain/publication.ts";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";

/** Capture the pool and scalar source identity before waiting. All source
 * consumers run inside the same lease, with live ownership proved at both ends.
 * Empty-profile callers never consume source files or tokens.
 */
export async function withViewerCurrentSource<T>(userId: number, mode: "read" | "write",
  task: (binding: BindingRow | null, db: Pool) => Promise<T>, { bindingRequired = true } = {}) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
  try {
    await ensureAccountSchema();
    const db = getAccountDb();
    await requireViewerBindingOwner(db, userId);
    const binding = await readViewerCurrentBinding(db, userId);
    if (!binding && bindingRequired) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
    const expected = binding && captureBindingIdentity(binding);
    const requireLiveScope = () => {
      if (expected && !currentScoreScope(expected.taiko_id)?.lease.alive()) throw new PublicationUnavailableError();
    };
    const prove = async () => {
      requireLiveScope();
      await requireViewerBindingOwner(db, userId);
      const fresh = await readViewerCurrentBinding(db, userId);
      if (expected) assertBindingIdentity(expected, fresh);
      else if (fresh) throw createError({ statusCode: 409, statusMessage: "profile-changed" });
      requireLiveScope();
    };
    const run = async () => {
      await prove();
      const result = await task(binding, db);
      await prove();
      return result;
    };
    return binding ? await (mode === "read" ? withDomainScoreRead : withDomainScoreWrite)(binding.taiko_id, run) : await run();
  } catch (error) { throw sourceLifecycleFailure(error); }
}
