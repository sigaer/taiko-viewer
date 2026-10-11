import { createHash } from "node:crypto";
import { PublicationUnavailableError } from "./client.ts";

const MAX_BYTES = 8 * 1024 * 1024;
/** MySQL JSON may reorder object keys. Hash a canonical JSON representation
 * which survives storage/reload; retain array order and raw string fields.
 */
export function encodeSqlRecoveryBackup(value: unknown) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new PublicationUnavailableError();
    const raw = JSON.stringify(value, (_key, item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const ordered = Object.create(null);
      for (const key of Object.keys(item).sort()) ordered[key] = item[key];
      return ordered;
    });
    if (Buffer.byteLength(raw) > MAX_BYTES) throw new PublicationUnavailableError();
    return raw;
  } catch { throw new PublicationUnavailableError(); }
}

export function decodeSqlRecoveryBackup(value: unknown, expectedSha256: string): unknown {
  try {
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new PublicationUnavailableError();
    if (typeof value === "string" && Buffer.byteLength(value) > MAX_BYTES) throw new PublicationUnavailableError();
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (createHash("sha256").update(encodeSqlRecoveryBackup(parsed)).digest("hex") !== expectedSha256) throw new PublicationUnavailableError();
    return parsed;
  } catch { throw new PublicationUnavailableError(); }
}
