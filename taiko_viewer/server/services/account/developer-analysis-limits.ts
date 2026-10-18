import {createError} from 'h3';

/** One analysis subprocess at a time. Overload is rejected instead of queued. */
export const ANALYSIS_MAX_CONCURRENT=1;
/** Bound a child below the Viewer service's 2 GiB cgroup cap. */
export const ANALYSIS_ADDRESS_SPACE_BYTES=1024*1024*1024;
export const ANALYSIS_MAX_INPUT_BYTES=8*1024*1024;
export const ANALYSIS_MAX_OUTPUT_BYTES=8*1024*1024;
export const ANALYSIS_TIMEOUT_MS=60_000;

let active=0;
export function acquireDeveloperAnalysisSlot():()=>void{
 if(active>=ANALYSIS_MAX_CONCURRENT)throw createError({statusCode:503,statusMessage:'分析服务繁忙，请稍后重试',data:{code:'ANALYSIS_BUSY'}});
 active+=1;
 let released=false;
 return ()=>{if(released)return;released=true;active=Math.max(0,active-1);};
}
export function activeDeveloperAnalyses(){return active;}
