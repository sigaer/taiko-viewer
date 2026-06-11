import { cp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { recordAdminAction } from "./audit";
import { ensureDir, getAdminRuntimeConfig, safeJsonStringify } from "./shared";

export type AdminBackupSource = {
  path: string;
  alias?: string;
  optional?: boolean;
};

export const buildBackupTimestamp = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
};

export const createAdminBackupSnapshot = async (input: {
  category: "mutations" | "scheduled";
  label: string;
  reason: string;
  sources: AdminBackupSource[];
  actorId?: string | null;
  actorName?: string | null;
}) => {
  const { taikoAdminBackupDir } = getAdminRuntimeConfig();
  const timestamp = buildBackupTimestamp();
  const backupDir = resolve(taikoAdminBackupDir, input.category, `${timestamp}_${input.label}`);
  await ensureDir(backupDir);

  const manifest = {
    label: input.label,
    reason: input.reason,
    category: input.category,
    createdAt: new Date().toISOString(),
    files: [] as Array<{ source: string; target: string; size: number }>
  };

  for (const source of input.sources) {
    try {
      const targetPath = join(backupDir, source.alias || basename(source.path));
      await cp(source.path, targetPath, { recursive: true, force: true });
      const fileStat = await stat(targetPath);
      manifest.files.push({
        source: source.path,
        target: targetPath,
        size: fileStat.size
      });
    } catch (error) {
      if (!source.optional) {
        throw error;
      }
    }
  }

  await writeFile(join(backupDir, "manifest.json"), safeJsonStringify(manifest), "utf-8");
  await recordAdminAction({
    actorType: input.actorId ? "admin" : "system",
    actorId: input.actorId || "system-backup",
    actorName: input.actorName || "system-backup",
    source: "system-backup",
    targetType: "backup",
    targetKey: input.label,
    action: "create",
    extra: {
      reason: input.reason,
      backupDir,
      files: manifest.files
    }
  }).catch(() => undefined);

  return {
    backupDir,
    manifest
  };
};

export const listAdminBackups = async (limit = 12) => {
  const { taikoAdminBackupDir } = getAdminRuntimeConfig();
  const rows: Array<{
    name: string;
    path: string;
    category: string;
    createdAt: string;
    size: number;
    manifest: Record<string, unknown> | null;
  }> = [];

  for (const category of ["scheduled", "mutations"]) {
    const dir = resolve(taikoAdminBackupDir, category);
    try {
      const names = await readdir(dir);
      for (const name of names) {
        const filePath = join(dir, name);
        const fileStat = await stat(filePath);
        if (!fileStat.isDirectory()) continue;
        let manifest: Record<string, unknown> | null = null;
        try {
          manifest = JSON.parse(await readFile(join(filePath, "manifest.json"), "utf-8")) as Record<
            string,
            unknown
          >;
        } catch {
          manifest = null;
        }
        rows.push({
          name,
          path: filePath,
          category,
          createdAt: fileStat.mtime.toISOString(),
          size: fileStat.size,
          manifest
        });
      }
    } catch {
      // Ignore missing category folders.
    }
  }

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows.slice(0, limit);
};
