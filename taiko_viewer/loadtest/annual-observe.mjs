import {readFile,writeFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
export async function observeAnnual(c){
 const root=JSON.parse(await readFile(c.isolationEvidence,'utf8')).root;
 const proof=JSON.parse(await readFile(c.isolationEvidence,'utf8'));
 const samples=[],units={},start=Date.now();let busy=false,failure=null;
 const cg='/sys/fs/cgroup/development.slice/development-qa.slice';
 const read=async p=>readFile(p,'utf8').catch(()=>null);
 const tick=async()=>{if(busy)return;busy=true;try{
  const names=(await readdir(cg)).filter(n=>/^taiko-annual-(generator|renderer)-/.test(n));
  const workers=[];
  for(const name of names){const p=`${cg}/${name}`,pids=await read(`${p}/cgroup.procs`);if(!pids?.trim())continue;
   const memory=await read(`${p}/memory.current`);workers.push({name,pids:pids.trim().split('\n').map(Number),memory:Number(memory)});
   try { if(!units[name])units[name]={firstSeen:Date.now(),networkFilters:JSON.parse(execFileSync('/usr/bin/python3',['loadtest/check-cgroup-network.py',p],{encoding:'utf8'})),properties:execFileSync('systemctl',['show',name,'-p','IPAddressDeny','-p','IPAddressAllow','-p','ProtectSystem','-p','ReadWritePaths','-p','MemoryMax','-p','RuntimeMaxUSec'],{encoding:'utf8'}),processes:await Promise.all(pids.trim().split('\n').map(async pid=>({pid:Number(pid),cmdline:(await read(`/proc/${pid}/cmdline`))?.replaceAll('\0',' ')})))};
   } catch(e) {if((await read(`${p}/cgroup.procs`))?.trim())throw e;continue;}
   units[name].lastSeen=Date.now();
   for(const item of units[name].processes){if(item.cmdline?.includes('annual_python_worker.py'))item.cmdline=(await read(`/proc/${item.pid}/cmdline`))?.replaceAll('\0',' ')||item.cmdline;}
  }
  const mem=await read('/proc/meminfo'),psi=await read('/proc/pressure/memory');
  const available=Number(mem?.match(/MemAvailable:\s+(\d+)/)?.[1])/1024,full=Number(psi?.match(/full avg10=([\d.]+)/)?.[1]);
  if(!Number.isFinite(available)||available<c.minAvailableMiB||!Number.isFinite(full)||full>=c.maxMemoryPsiFull)throw Error('host pressure or monitoring lost');
  const prod=execFileSync('systemctl',['show','taiko-viewer.service','-p','MainPID','-p','NRestarts'],{encoding:'utf8'});
  if(!prod.includes('MainPID=3542853')||!prod.includes('NRestarts=0'))throw Error('production identity changed');
  const mysqlStatus=await read(`/proc/${proof.mysqlPid}/status`),mysqlIO=await read(`/proc/${proof.mysqlPid}/io`),serverStatus=await read(`/proc/${c.serverPid}/status`);
  if(!mysqlStatus||!mysqlIO||!serverStatus)throw Error('owned database/server monitoring lost');
  samples.push({at:Date.now()-start,availableMiB:available,fullPsi:full,workers,mysqlStatus,mysqlIO,serverStatus,generator:await read(`${root}/admission/generator.json`),renderer:await read(`${root}/admission/renderer.json`)});
 }catch(e){failure=e.message;process.kill(process.pid,'SIGTERM');}finally{busy=false;}};
 await tick();const timer=setInterval(tick,200);
 return async()=>{clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,25));await writeFile(`${c.output}/observations-${Date.now()}.json`,JSON.stringify({failure,units,samples},null,2));};
}
