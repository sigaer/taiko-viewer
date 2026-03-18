import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_DATA_NAMES = new Set(["title_wikitable", "title_wikitable_cn", "title_song_relations"]);

const resolveDataDirs = (configuredDir) => {
  const cwd = typeof process !== "undefined" ? process.cwd() : "";
  const dirs = [
    configuredDir,
    cwd ? resolve(cwd, "assets/data") : "",
    cwd ? resolve(cwd, "taiko_frontend_back/assets/data") : ""
  ].filter(Boolean);
  return Array.from(new Set(dirs));
};

export default defineEventHandler(async (event) => {
  const name = String(event.context.params?.name || "");
  if (!ALLOWED_DATA_NAMES.has(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported json name: ${name}`
    });
  }

  const runtimeConfig = useRuntimeConfig(event);
  const dataDirs = resolveDataDirs(String(runtimeConfig.dataDir || ""));
  const fileName = `${name}.json`;

  for (const dir of dataDirs) {
    const filePath = resolve(dir, fileName);
    try {
      await access(filePath, fsConstants.R_OK);
      const content = await readFile(filePath, "utf-8");
      setHeader(event, "Cache-Control", "no-store");
      return JSON.parse(content);
    } catch {
      // continue probing next candidate path
    }
  }

  throw createError({
    statusCode: 404,
    statusMessage: `Data file not found: ${fileName}`
  });
});
