import { isAbsolute } from "node:path";

/** Deployment/internal configuration only; never selected from request data. */
export function getPublicationPython(override?: string) {
  const executable = override ?? (process.env.TAIKO_PYTHON_EXECUTABLE || "/usr/bin/python3");
  if (!isAbsolute(executable) || executable.includes("\0")) {
    throw new Error("Invalid publication interpreter configuration");
  }
  return executable;
}
