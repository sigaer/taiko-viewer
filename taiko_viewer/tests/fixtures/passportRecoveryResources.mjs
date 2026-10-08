import {readFile,writeFile} from 'node:fs/promises';
import {monitorAcceptanceResources} from './goalAcceptanceResources.mjs';
export async function monitorPassportResources(output) {
  const finish=await monitorAcceptanceResources(output);
  return async()=>{
    await finish();
    const report=JSON.parse(await readFile(output,'utf8'));
    const peak=await readFile(`/sys/fs/cgroup${report.cgroup}/memory.peak`,'utf8').catch(error=>{
      if(error.code!=='ENOENT')throw error;
      return null;
    });
    report.cgroupMemoryPeakBytes=peak===null?null:Number(peak);
    report.cgroupMemoryPeakUnavailable=peak===null;
    report.nodeMaxRssBytes=process.resourceUsage().maxRSS*1024;
    await writeFile(output,JSON.stringify(report,null,2));
  };
}
