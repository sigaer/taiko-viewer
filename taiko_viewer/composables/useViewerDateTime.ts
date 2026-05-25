const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
};

const DATE_ONLY_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
};

export const useViewerDateTime = () => {
  const { locale } = useI18n();

  const formatDateTime = (value?: string | number | Date | null) => {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", DATE_FORMAT_OPTIONS).format(date);
  };

  const formatDate = (value?: string | number | Date | null) => {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "zh-CN", DATE_ONLY_FORMAT_OPTIONS).format(date);
  };

  return {
    formatDateTime,
    formatDate
  };
};
