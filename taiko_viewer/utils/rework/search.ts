export function searchShortcut(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean }, editable: boolean) {
  if (event.isComposing || event.altKey) return null;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') return 'toggle';
  if (!editable && !event.ctrlKey && !event.metaKey && event.key === '/') return 'open';
  return null;
}
export function searchSelection(key: string, current: number, count: number): number {
  if (!Number.isSafeInteger(count) || count < 1) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown') return current < 0 || current >= count - 1 ? 0 : current + 1;
  if (key === 'ArrowUp') return current <= 0 || current >= count ? count - 1 : current - 1;
  return Math.max(-1, Math.min(current, count - 1));
}
