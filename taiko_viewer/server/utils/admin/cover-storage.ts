import * as EsaSdk from "@alicloud/esa20240910";
import { $OpenApiUtil } from "@alicloud/openapi-core";
import { createError } from "h3";
import { getOssClient, getOssRuntimeConfig } from "~/server/internal/account/shared";

const COVER_PREFIX = "cover";
let cachedEsaSiteId = 0;

const getCoverObjectKey = (songId: number) => `${COVER_PREFIX}/${songId}.png`;

const getErrorStatus = (error: any) =>
  Number(error?.status || error?.statusCode || error?.res?.status || 0);

const createEsaClient = () => {
  const storage = getOssRuntimeConfig();
  const runtimeConfig = useRuntimeConfig();
  const EsaClient =
    (EsaSdk.default as unknown as { default?: typeof EsaSdk.default }).default || EsaSdk.default;
  return new EsaClient(
    new $OpenApiUtil.Config({
      accessKeyId: storage.accessKeyId,
      accessKeySecret: storage.accessKeySecret,
      regionId: String(runtimeConfig.esaRegion || "cn-hangzhou")
    })
  );
};

const resolveEsaSiteId = async () => {
  if (cachedEsaSiteId) return cachedEsaSiteId;
  const runtimeConfig = useRuntimeConfig();
  const configuredSiteId = Number(runtimeConfig.esaSiteId || 0);
  if (Number.isSafeInteger(configuredSiteId) && configuredSiteId > 0) {
    cachedEsaSiteId = configuredSiteId;
    return cachedEsaSiteId;
  }

  const siteName = String(runtimeConfig.esaSiteName || "sakura-bot.cn").trim();
  const response = await createEsaClient().listSites(
    new EsaSdk.ListSitesRequest({
      siteName,
      siteSearchType: "exact",
      pageNumber: 1,
      pageSize: 10
    })
  );
  const site = response.body?.sites?.find(
    (item) => item.siteName === siteName && Number(item.siteId || 0) > 0
  );
  if (!site?.siteId) {
    throw createError({ statusCode: 502, statusMessage: "未找到封面域名对应的 ESA 站点" });
  }
  cachedEsaSiteId = Number(site.siteId);
  return cachedEsaSiteId;
};

const purgeCoverCache = async (songId: number) => {
  const storage = getOssRuntimeConfig();
  const coverUrl = `${storage.publicBaseUrl.replace(/\/$/, "")}/${getCoverObjectKey(songId)}`;
  try {
    const response = await createEsaClient().purgeCaches(
      new EsaSdk.PurgeCachesRequest({
        siteId: await resolveEsaSiteId(),
        type: "file",
        content: new EsaSdk.PurgeCachesRequestContent({ files: [coverUrl] })
      })
    );
    return String(response.body?.taskId || "");
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: "OSS 已更新，但封面边缘缓存刷新失败，请重试",
      cause: error
    });
  }
};

export const coverObjectExists = async (songId: number) => {
  try {
    await getOssClient().head(getCoverObjectKey(songId));
    return true;
  } catch (error) {
    if (getErrorStatus(error) === 404) return false;
    throw error;
  }
};

export const uploadCoverObject = async (songId: number, buffer: Buffer) => {
  const objectKey = getCoverObjectKey(songId);
  await getOssClient().put(objectKey, buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
  const cacheTaskId = await purgeCoverCache(songId);
  return { objectKey, cacheTaskId };
};

export const deleteCoverObject = async (songId: number) => {
  const client = getOssClient();
  await client.delete(getCoverObjectKey(songId));
  if (await coverObjectExists(songId)) {
    throw createError({ statusCode: 502, statusMessage: "OSS 封面删除校验失败，请重试" });
  }
  const cacheTaskId = await purgeCoverCache(songId);
  return { cacheTaskId };
};
