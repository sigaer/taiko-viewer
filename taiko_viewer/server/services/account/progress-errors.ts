import { createError } from "h3";

/** Emit only fixed error categories. Child errors contain argv, IDs and paths. */
export function failProgressPython(stage: string, error: unknown): never {
  const child = error as { code?: unknown; signal?: unknown; killed?: boolean; stderr?: unknown } | undefined;
  const stderr = Buffer.isBuffer(child?.stderr)
    ? child.stderr.subarray(-8192).toString("utf8")
    : typeof child?.stderr === "string" ? child.stderr.slice(-8192) : "";
  const killed = child?.killed === true && child.signal === "SIGKILL";
  let category = "worker_failure";
  if (killed) category = "worker_killed";
  else if (child?.code === "ENOENT" || child?.code === "EACCES") category = "worker_start";
  else if (/KeyError: ['"]fileName['"]/.test(stderr)) category = "history_contract";
  else if (/ModuleNotFoundError:|ImportError:/.test(stderr)) category = "python_import";
  else if (/FileNotFoundError:/.test(stderr)) category = "missing_input_or_asset";
  else if (/KeyError:/.test(stderr)) category = "python_key";
  else if (/ValueError:/.test(stderr)) category = "python_value";
  else if (/TypeError:/.test(stderr)) category = "python_type";
  const exitCode = typeof child?.code === "number" && Number.isInteger(child.code) ? child.code : null;
  console.error("[progress-image]", { stage, category, exitCode });
  throw createError({
    statusCode: killed ? 503 : 500,
    statusMessage: "Progress image unavailable",
    message: "进度图生成失败，请稍后重试"
  });
}

export function failProgressOutput(stage: string): never {
  console.error("[progress-image]", { stage, category: "invalid_output" });
  throw createError({ statusCode: 500, statusMessage: "Progress image unavailable", message: "进度图生成失败，请稍后重试" });
}
