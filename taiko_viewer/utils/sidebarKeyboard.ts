// Element Plus 2.13 initializes its keyboard helper only for horizontal menus.
// Keep the vertical sidebar operable without rebuilding menu components.
export function handleSidebarMenuKeydown(event: KeyboardEvent) {
  const item = event.target as HTMLElement;
  if (item.getAttribute('role') !== 'menuitem') return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const title = item.querySelector<HTMLElement>(':scope > .el-sub-menu__title');
    (title || item).click();
    return;
  }
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const menu = event.currentTarget as HTMLElement;
  const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .filter(node => node.getClientRects().length && !node.closest('[inert]'));
  if (!items.length) return;
  event.preventDefault();
  const index = items.indexOf(item);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}
