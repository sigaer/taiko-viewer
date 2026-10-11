import { createError } from "h3";

export type BindingIdentity = {
  id: string | number; taiko_id: string; source: string | null;
  manual_account_id?: string | null;
};
/** Capture scalar identity, never retain a caller's mutable binding object. */
export const captureBindingIdentity = (binding: BindingIdentity): BindingIdentity => Object.freeze({
  id: String(binding.id), taiko_id: binding.taiko_id, source: binding.source,
  manual_account_id: binding.manual_account_id || null
});
export function assertBindingIdentity(expected: BindingIdentity, current: BindingIdentity | null | undefined) {
  if (!current || String(current.id) !== String(expected.id) || current.taiko_id !== expected.taiko_id ||
    current.source !== expected.source || (current.manual_account_id || null) !== (expected.manual_account_id || null)) {
    throw createError({ statusCode: 409, statusMessage: "profile-changed" });
  }
  return current;
}
