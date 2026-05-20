type FetchLikeError = {
  statusCode?: number;
  status?: number;
  data?: { statusMessage?: string; message?: string } | Blob | string;
  statusMessage?: string;
  message?: string;
};

const FETCH_NOISE_RE = /^\[(?:GET|POST|PUT|PATCH|DELETE)\]/i;
const HTTP_STATUS_TAIL_RE = /:\s*\d{3}\s*$/;

const isTechnicalMessage = (text: string) => {
  const value = text.trim();
  if (!value) {
    return true;
  }
  if (FETCH_NOISE_RE.test(value)) {
    return true;
  }
  if (value.includes("/api/") && HTTP_STATUS_TAIL_RE.test(value)) {
    return true;
  }
  if (/^FetchError:/i.test(value)) {
    return true;
  }
  return false;
};

const messageFromPayload = (payload: { statusMessage?: string; message?: string } | undefined) => {
  if (!payload) {
    return "";
  }
  const text = String(payload.message || payload.statusMessage || "").trim();
  return isTechnicalMessage(text) ? "" : text;
};

const messageFromStatus = (status: number | undefined, fallback: string) => {
  if (status === 401) {
    return "登录状态已失效或未登录，请先登录后再试";
  }
  if (status === 403) {
    return "暂无权限查看该数据";
  }
  if (status === 404) {
    return "未找到相关成绩数据，请先在个人档案绑定鼓众 ID，并通过「多端同步」更新数据";
  }
  if (status === 400) {
    return "请求参数有误，请检查后重试";
  }
  if (status && status >= 500) {
    return "服务暂时不可用，请稍后再试";
  }
  return fallback;
};

export const resolveViewerError = async (error: unknown, fallback: string) => {
  const err = error as FetchLikeError;
  const status = err.statusCode ?? err.status;

  if (err.data instanceof Blob) {
    try {
      const text = await err.data.text();
      const parsed = JSON.parse(text) as { statusMessage?: string; message?: string };
      const fromPayload = messageFromPayload(parsed);
      if (fromPayload) {
        return fromPayload;
      }
    } catch {
      // Ignore parse failures and fall back to status mapping.
    }
  } else if (typeof err.data === "string") {
    try {
      const parsed = JSON.parse(err.data) as { statusMessage?: string; message?: string };
      const fromPayload = messageFromPayload(parsed);
      if (fromPayload) {
        return fromPayload;
      }
    } catch {
      if (!isTechnicalMessage(err.data)) {
        return err.data.trim();
      }
    }
  } else {
    const fromPayload = messageFromPayload(err.data);
    if (fromPayload) {
      return fromPayload;
    }
  }

  const statusMessage = String(err.statusMessage || "").trim();
  if (statusMessage && !isTechnicalMessage(statusMessage)) {
    return statusMessage;
  }

  const message = String(err.message || "").trim();
  if (message && !isTechnicalMessage(message)) {
    return message;
  }

  return messageFromStatus(status, fallback);
};

export const viewerErrorAlertType = (message: string): "warning" | "error" => {
  if (/登录|权限|绑定|同步/.test(message)) {
    return "warning";
  }
  return "error";
};
