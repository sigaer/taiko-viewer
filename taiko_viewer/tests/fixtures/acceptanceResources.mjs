// Bounded Linux QA telemetry; no command lines, environments or user data.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
export async function monitorAcceptanceResources(output) {
 const cgroup=(await readFile('/proc/self/cgroup','utf8')).split('\n').find(line=>line.startsWith('0::'))?.slice(3);
 assert.ok(cgroup?.startsWith('/development.slice/development-qa.slice/'),'Run acceptance through scripts/memory/run_qa.sh');
 const root=`/sys/fs/cgroup${cgroup}`;
 const started=performance.now();let peak=0,busy=false;
 const sample=async()=>{if(busy)return;busy=true;try{peak=Math.max(peak,Number(await readFile(`${root}/memory.current`,'utf8')))}finally{busy=false}};
 await sample();
 const timer=setInterval(()=>{sample().catch(()=>{});},250);
 return async()=>{
  clearInterval(timer);await sample();
  const processes=[];
  for(const pid of (await readFile(`${root}/cgroup.procs`,'utf8')).trim().split(/\s+/).slice(0,256)){
   try{const lines=(await readFile(`/proc/${pid}/status`,'utf8')).split('\n');processes.push(Object.fromEntries(lines.filter(line=>/^(Name|VmRSS|VmHWM):/.test(line)).map(line=>line.split(/:\s*/,2))));}catch{}
  }
  const report={cgroup,durationMs:Math.round(performance.now()-started),sampledMemoryPeakBytes:peak,sampleIntervalMs:250,memoryEvents:await readFile(`${root}/memory.events`,'utf8'),processes};
  await writeFile(output,JSON.stringify(report,null,2));
 };
}
