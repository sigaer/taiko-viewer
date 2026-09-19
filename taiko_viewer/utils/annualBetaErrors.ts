type InviteErrorCopy = Record<string, string>;

const COPY: Record<"zh" | "ja", InviteErrorCopy> = {
  zh: {
    used_invite: "此邀请码已被使用，请联系发放者获取新的邀请码。",
    invalid_invite: "邀请码无效，请确认输入完整且没有多余字符。",
    expired_invite: "此邀请码已过期，请联系发放者获取新的邀请码。",
    disabled_invite: "此邀请码已停用，请联系发放者获取新的邀请码。",
    pending_expired: "邀请码验证已过期，请重新输入邀请码。",
    pending_used: "本次邀请码验证已失效，请重新输入邀请码。"
  },
  ja: {
    used_invite: "この招待コードは使用済みです。新しいコードを発行元にお問い合わせください。",
    invalid_invite: "招待コードが無効です。入力内容に不足や余分な文字がないか確認してください。",
    expired_invite: "この招待コードは期限切れです。新しいコードを発行元にお問い合わせください。",
    disabled_invite: "この招待コードは無効化されています。新しいコードを発行元にお問い合わせください。",
    pending_expired: "招待コードの確認期限が切れました。もう一度入力してください。",
    pending_used: "この招待コードの確認は無効になりました。もう一度入力してください。"
  }
};

const errorPayload = (error: unknown): Record<string, any> | null => {
  if (!error || typeof error !== "object") return null;
  const data = (error as Record<string, any>).data;
  return data && typeof data === "object" ? data : null;
};

export const annualBetaInviteErrorMessage = (error: unknown, locale: string) => {
  const payload = errorPayload(error);
  const code = String(payload?.data?.code || payload?.code || "");
  return COPY[locale === "ja" ? "ja" : "zh"][code] || String(payload?.statusMessage || "");
};
