/** Shared operator identity for private operations and existing account review. */
export const DEVELOPER_REVIEWER_USERNAME = 'sigaer';
export const DEVELOPER_REVIEWER_EMAIL = '1106865024@qq.com';
export const isSiteOperator = (user: { username: unknown; email: unknown } | null | undefined) =>
  Boolean(user && String(user.username || '').trim() === DEVELOPER_REVIEWER_USERNAME &&
    String(user.email || '').trim().toLowerCase() === DEVELOPER_REVIEWER_EMAIL);
