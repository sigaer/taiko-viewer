const adminDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

export const formatAdminDateTime = (value: unknown, fallback = "-") => {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  const parts = Object.fromEntries(
    adminDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const adminClockFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const adminMonthDayFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric"
});

const toAdminDate = (value: unknown) => {
  const date =
    value instanceof Date ? value : typeof value === "number" ? new Date(value) : new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
};

/** HH:mm in Beijing time. */
export const formatAdminClock = (value: unknown, fallback = "—") => {
  const date = toAdminDate(value);
  if (!date) return fallback;
  const parts = Object.fromEntries(
    adminClockFormatter.formatToParts(date).map((part) => [part.type, part.value])
  ) as Record<string, string>;
  return `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
};

/** "M月D日" in Beijing time. */
export const formatAdminMonthDay = (value: unknown, fallback = "—") => {
  const date = toAdminDate(value);
  if (!date) return fallback;
  const parts = Object.fromEntries(
    adminMonthDayFormatter.formatToParts(date).map((part) => [part.type, part.value])
  ) as Record<string, string>;
  return `${parts.month}月${parts.day}日`;
};

/** Relative Chinese time such as "刚刚", "3 分钟前", "2 小时前", "昨天", "5 天前"; older values fall back to "M月D日". */
export const formatAdminRelativeTime = (value: unknown, now: number = Date.now(), fallback = "—") => {
  const date = toAdminDate(value);
  if (!date) return fallback;
  const diffSeconds = Math.round((now - date.getTime()) / 1000);
  if (diffSeconds < -60) return formatAdminDateTime(date, fallback);
  if (diffSeconds < 60) return "刚刚";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  return formatAdminMonthDay(date, fallback);
};
