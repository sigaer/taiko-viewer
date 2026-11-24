import { isAbsolute } from "node:path";

/** Deployment-controlled executable; never derived from an HTTP request. */
export function getTaikoPython(override?: string) {
  const executable = override ?? (process.env.TAIKO_PYTHON_EXECUTABLE || "/usr/bin/python3");
  if (!isAbsolute(executable) || executable.includes("\0")) {
    throw new Error("TAIKO_PYTHON_EXECUTABLE must be an absolute executable path");
  }
  return executable;
}

export function getTaikoPythonEnv(repoRoot: string) {
  const { PYTHONPATH: _path, PYTHONHOME: _home, ...environment } = process.env;
  return {
    ...environment,
    TAIKO_OFFLINE_ROOT: repoRoot,
    TAIKO_CENTER_ROOT: repoRoot,
    TAIKO_RUNTIME_ROOT: repoRoot
  };
}
import { captureCatalogAuthority } from '../services/content/catalogAuthority.ts';

export async function getCatalogPythonEnv(repoRoot: string) {
  const { data, root } = await captureCatalogAuthority();
  return { ...getTaikoPythonEnv(repoRoot),
    TAIKO_CATALOG_ROOT: root,
    TAIKO_CATALOG_REVISION: data.catalogRevision };
}
