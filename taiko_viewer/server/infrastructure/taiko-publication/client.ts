import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { assertScoreIdentity } from "../../domain/file-score-reader.ts";

export type PublicationReference = { sha256: string; bytes: number };
export type PublicationManifest = {
  schema: 1; identity: string; sequence: number; commitId: string;
  previousCommitId?: string; requestHash?: string;
  files: Record<string, PublicationReference>;
};
export type SourceBackupReceipt = {
  backupKey: string;
  source: { sequence: number; commitId: string };
};
type Message = Record<string, unknown> & { view?: PublicationManifest | null };
type Deferred = { resolve: (value: Message) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

export class PublicationUnavailableError extends Error {
  readonly statusCode = 503;
  readonly statusMessage = "成绩数据暂不可用，请稍后重试";
  constructor() { super("Score publication is unavailable"); this.name = "PublicationUnavailableError"; }
}

export type PublicationLease = {
  view: PublicationManifest | null;
  alive: () => boolean;
  put: (key: string, body: string) => Promise<PublicationReference>;
  remove: (key: string) => Promise<void>;
  backup: (backupKey: string) => Promise<SourceBackupReceipt>;
  publish: (options?: { replaceHistory?: boolean; transactionId?: string }) => Promise<PublicationManifest>;
  close: () => Promise<void>;
};
type Options = { root: string; repoRoot: string; identity: string; mode: "read" | "write"; python?: string; lifetimeSeconds?: number };
const MAX_MESSAGE_BYTES = 32 * 1024 * 1024;

/** One owned child retains the center kernel lease across the entire task.
 * Bodies use stdin; all failure messages omit stderr, paths and payloads.
 */
export async function openPublicationLease(options: Options): Promise<PublicationLease> {
  assertScoreIdentity(options.identity);
  const lifetime = options.lifetimeSeconds ?? 180;
  if (!Number.isInteger(lifetime) || lifetime < 1 || lifetime > 900) throw new PublicationUnavailableError();
  const child: ChildProcessWithoutNullStreams = spawn(options.python || "python3", [
    "-m", "taiko_store.bridge", "--root", options.root, "--identity", options.identity,
    "--mode", options.mode, "--lifetime", String(lifetime)
  ], { cwd: options.repoRoot, stdio: ["pipe", "pipe", "pipe"] });
  let pending: Deferred | undefined;
  let failed = false;
  let closing = false;
  let closed = false;
  let chunks: Buffer[] = [];
  let bytes = 0;
  let stderrBytes = 0;
  const exit = new Promise<void>(resolve => child.once("close", () => { closed = true; resolve(); }));

  const fail = () => {
    failed = true;
    if (pending) { clearTimeout(pending.timer); pending.reject(new PublicationUnavailableError()); pending = undefined; }
    chunks = []; bytes = 0;
    if (!closed) child.kill("SIGTERM");
  };
  const expect = (): Promise<Message> => {
    if (pending || failed || closed) return Promise.reject(new PublicationUnavailableError());
    return new Promise((resolve, reject) => {
      pending = { resolve, reject, timer: setTimeout(fail, 45_000) };
    });
  };
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.stdout.on("error", fail);
  child.stderr.on("error", fail);
  child.once("close", () => { if (pending || !closing) fail(); });
  // Drain but never retain or print subprocess diagnostics.
  child.stderr.on("data", (chunk: Buffer) => { stderrBytes += chunk.length; if (stderrBytes > 8192) fail(); });
  child.stdout.on("data", (chunk: Buffer) => {
    if (failed) return;
    let offset = 0;
    while (offset < chunk.length) {
      const end = chunk.indexOf(10, offset);
      const piece = chunk.subarray(offset, end < 0 ? chunk.length : end);
      bytes += piece.length;
      if (bytes > MAX_MESSAGE_BYTES) { fail(); return; }
      chunks.push(piece);
      if (end < 0) break;
      try {
        const response = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8")) as Message;
        chunks = []; bytes = 0;
        if (!pending || response.error) { fail(); return; }
        const waiting = pending;
        pending = undefined;
        clearTimeout(waiting.timer);
        waiting.resolve(response);
      } catch { fail(); return; }
      offset = end + 1;
    }
  });
  const lifetimeTimer = setTimeout(fail, (lifetime + 2) * 1000);
  const send = async (message: Message) => {
    if (pending || failed || closed) throw new PublicationUnavailableError();
    const encoded = JSON.stringify(message) + "\n";
    if (Buffer.byteLength(encoded) > MAX_MESSAGE_BYTES) throw new PublicationUnavailableError();
    const response = expect();
    child.stdin.write(encoded, error => { if (error) fail(); });
    return response;
  };
  const stop = async () => {
    clearTimeout(lifetimeTimer);
    if (closed) return;
    child.stdin.end();
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([exit, new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); })]);
    clearTimeout(timer);
    if (!closed) {
      child.kill("SIGKILL");
      await Promise.race([exit, new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); })]);
      clearTimeout(timer);
      if (!closed) throw new PublicationUnavailableError();
    }
    chunks = []; bytes = 0;
  };
  try {
    const ready = await expect();
    if (ready.ready !== true || ready.schema !== 1 || ready.view === undefined) throw new PublicationUnavailableError();
    const lease: PublicationLease = {
      view: ready.view,
      alive: () => !failed && !closed && !closing,
      async put(key, body) {
        const response = await send({ method: "put", key, body });
        const reference = response.reference as PublicationReference | undefined;
        if (!reference || !/^[a-f0-9]{64}$/.test(reference.sha256) ||
          !Number.isSafeInteger(reference.bytes) || reference.bytes < 0 || reference.bytes > 64 * 1024 * 1024) {
          throw new PublicationUnavailableError();
        }
        return reference;
      },
      async remove(key) { await send({ method: "remove", key }); },
      async backup(backupKey) {
        if (!/^[a-f0-9]{32}$/.test(backupKey)) throw new PublicationUnavailableError();
        const response = await send({ method: "backup", backupKey });
        const source = response.source as SourceBackupReceipt["source"] | undefined;
        if (response.backedUp !== true || response.backupKey !== backupKey || !source ||
          !Number.isSafeInteger(source.sequence) || source.sequence < 0 || !/^[a-f0-9]{32}$/.test(source.commitId) ||
          !response.view || response.view.identity !== options.identity) throw new PublicationUnavailableError();
        // Export may adopt exact legacy bytes as sequence zero. The scope's
        // reader must switch to that canonical view while retaining its EX.
        lease.view = response.view;
        return { backupKey, source };
      },
      async publish(publicationOptions = {}) {
        const response = await send({ method: "publish", ...publicationOptions });
        if (response.published !== true || !response.view) throw new PublicationUnavailableError();
        lease.view = response.view;
        return response.view;
      },
      async close() {
        if (closing) return;
        closing = true;
        try { if (!failed && !closed) await send({ method: "finish" }); }
        finally { await stop(); }
      }
    };
    return lease;
  } catch (error) {
    closing = true;
    fail();
    await stop();
    throw error;
  }
}

export async function withPublicationLease<T>(options: Options, task: (lease: PublicationLease) => Promise<T>): Promise<T> {
  const lease = await openPublicationLease(options);
  let result: T | undefined;
  let failure: unknown;
  let hasFailure = false;
  try { result = await task(lease); } catch (error) { failure = error; hasFailure = true; }
  try { await lease.close(); } catch (error) { if (!hasFailure) { failure = error; hasFailure = true; } }
  if (hasFailure) throw failure;
  return result as T;
}
