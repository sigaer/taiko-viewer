/** Old releases persisted search keywords as IDs. Keep their account metadata
 * available for recovery, but never pass a nickname to score storage/workers. */
export const requiresBindingReverification = (binding: {
  source: string | null; taiko_id: string; manual_account_id?: string | null;
} | null) => Boolean(binding && binding.source === "wahlap" && !binding.manual_account_id &&
  !/^[0-9]{1,25}$/.test(binding.taiko_id));
