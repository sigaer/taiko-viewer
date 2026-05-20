import { ProxyAgent, fetch as undiciFetch } from "undici";

const getProxyUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  return String(runtimeConfig.bilibiliHttpProxy || process.env.BILIBILI_HTTP_PROXY || "").trim();
};

export const bilibiliFetch = async (url: string, init?: RequestInit) => {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return fetch(url, init);
  }

  const dispatcher = new ProxyAgent(proxyUrl);
  return undiciFetch(url, {
    ...init,
    dispatcher
  }) as unknown as Response;
};
