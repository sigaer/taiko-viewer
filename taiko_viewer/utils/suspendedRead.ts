// Only use for page-owned GET AsyncData. Shared catalogs and business writes
// have a different lifetime and must not be passed to this helper.
export type SuspensibleRead = {
  data: { value: unknown };
  error: { value: unknown };
  status: { value: string };
  clear: () => void;
  refresh: (options?: { dedupe?: 'cancel' | 'defer' }) => Promise<unknown>;
};

export function suspendPendingRead(read: SuspensibleRead): boolean {
  if (read.status.value !== 'pending') return false;
  // Nuxt clear() aborts its handler signal, but also erases the accepted DTO.
  // Restore that same reference so leaving during a refresh keeps good data.
  const data = read.data.value;
  const error = read.error.value;
  read.clear();
  read.data.value = data;
  read.error.value = error;
  return true;
}
