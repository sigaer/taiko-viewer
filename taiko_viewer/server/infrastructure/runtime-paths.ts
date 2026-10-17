import { resolve } from "node:path";

// Host configuration is shared by product adapters and storage composition.
export function getRuntimePaths() {
  const runtimeConfig = useRuntimeConfig();
  const repoRoot = String(runtimeConfig.repoRoot || process.env.TAIKO_REPO_ROOT || resolve(process.cwd(), ".."));
  const userdataDir = String(runtimeConfig.userdataDir || process.env.TAIKO_USERDATA_DIR || resolve(repoRoot, "userdata"));
  const configPath = String(runtimeConfig.taikoConfigPath || process.env.TAIKO_CONFIG_PATH || resolve(repoRoot, "config.json"));
  const cacheDir = String(runtimeConfig.accountCacheDir || process.env.TAIKO_ACCOUNT_CACHE_DIR || resolve(process.cwd(), ".data", "account-cache"));
  return { repoRoot, userdataDir, configPath, cacheDir };
}
