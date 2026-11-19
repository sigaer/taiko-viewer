import { ref, watch, onBeforeUnmount } from 'vue';
import type { RecommendationToolPayload } from '~/types/recommendation-tool';
export function useRecommendationTool() {
  const data = ref<RecommendationToolPayload|null>(null), loading = ref(false), failed = ref(false);
  // Status and server message of the last failure: lets the page tell "no bound ID" and "no data yet" apart.
  const errorStatus = ref(0), errorMessage = ref('');
  const account = useState<{id:number}|null>('account-user',()=>null);
  const bindingGeneration = useState('account-binding-generation',()=>0);
  let generation = 0, controller:AbortController|null = null;
  const invalidate = () => { generation++;controller?.abort();controller=null;data.value=null;loading.value=false;failed.value=false;errorStatus.value=0;errorMessage.value=''; };
  watch(()=>[account.value?.id,bindingGeneration.value],invalidate,{flush:'sync'});
  onBeforeUnmount(invalidate);
  const load = async (query:{n:number;dim:string;image:boolean}) => {
    invalidate(); const request = generation;
    controller = new AbortController(); loading.value=true;
    try {
      const result = await $fetch<RecommendationToolPayload>('/api/account/recommendation/tool',{query,signal:controller.signal,credentials:'include'});
      if (request===generation) data.value=result;
    } catch (error:any) { if(request===generation){ failed.value=true; errorStatus.value=Number(error?.statusCode??error?.status??error?.response?.status)||0; errorMessage.value=String(error?.data?.statusMessage||error?.statusMessage||''); } }
    finally { if(request===generation){loading.value=false;controller=null;} }
  };
  return {data,loading,failed,errorStatus,errorMessage,load,invalidate};
}
