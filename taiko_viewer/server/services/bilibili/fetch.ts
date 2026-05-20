import { ProxyAgent, fetch as undiciFetch } from "undici";

const getProxyUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  return String(
    runtimeConfig.bilibiliHttpProxy ||
      process.env.BILIBILI_HTTP_PROXY ||
      "http://127.0.0.1:18888"
  ).trim();
};

export const bilibiliFetch = async (url: string, init?: RequestInit) => {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return fetch(url, init);
  }

  try {
    const dispatcher = new ProxyAgent(proxyUrl);
    return (await undiciFetch(url, {
      ...init,
      dispatcher
    })) as unknown as Response;
  } catch {
    return fetch(url, init);
  }
};
