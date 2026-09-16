// One serial initialization avoids anonymous cookie/participant races on first load.
let initialization: Promise<unknown> | null = null;
export const useAnnualBeta = () => {
 const api=useViewerApiFetch();const route=useRoute();const {locale}=useI18n();
 const status=useState<any>('annual-beta-status',()=>null);
 const refresh=async()=>status.value=await api('/api/annual-beta/status');
 const track=(name:string,metadata:Record<string,unknown>={})=> {
  if(!import.meta.client)return;
  if(!initialization)initialization=refresh().catch(()=>{initialization=null;});
  void initialization.then(()=>api('/api/annual-beta/events',{method:'POST',headers:{'x-beta-route':route.path,'x-viewer-locale':locale.value},body:{name,metadata}})).catch(()=>{});
 };
 return {status,refresh,track};
};
