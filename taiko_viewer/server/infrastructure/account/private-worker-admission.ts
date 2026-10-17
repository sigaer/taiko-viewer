import { createError } from "h3";
const unavailable=()=>createError({statusCode:503,statusMessage:"同步服务暂不可用，请稍后重试。"});
let active = 0;
const queue: Array<() => void> = [];
export async function enterPrivateWorker() {
  if (active < 2) { active++; return; }
  if (queue.length >= 8) throw unavailable();
  await new Promise<void>((resolve, reject) => {
    const ready = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { const index = queue.indexOf(ready); if (index >= 0) queue.splice(index, 1); reject(unavailable()); }, 30_000);
    queue.push(ready);
  });
}
export function leavePrivateWorker() { const next = queue.shift(); if (next) next(); else active--; }
