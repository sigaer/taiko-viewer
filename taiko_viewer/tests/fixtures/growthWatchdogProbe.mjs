// A synchronous blocked worker proves the parent watchdog can stop CPU/event-loop stalls.
import { openSync, appendFileSync, fsyncSync, closeSync } from "node:fs";
const [mode, out, variant] = process.argv.slice(2);
const fd = openSync(`${out}/${mode}-${variant}.stages.jsonl`, "ax", 0o600);
appendFileSync(fd, JSON.stringify({ stage: "watchdog-probe-checkpoint", status: "complete", wallMs: 0, processMaxRssBytes: process.resourceUsage().maxRSS * 1024 }) + "\n");
fsyncSync(fd); closeSync(fd);
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000);
