import { ref, watch, onBeforeUnmount } from 'vue';
import type { RecommendationToolPayload } from '~/types/recommendation-tool';
export function useRecommendationTool() {
  const data = ref<RecommendationToolPayload|null>(null), loading = ref(false), failed = ref(false);
  const account = useState<{id:number}|null>('account-user',()=>null);
  const bindingGeneration = useState('account-binding-generation',()=>0);
  let generation = 0, controller:AbortController|null = null;
  const invalidate = () => { generation++;controller?.abort();controller=null;data.value=null;loading.value=false;failed.value=false; };
  watch(()=>[account.value?.id,bindingGeneration.value],invalidate,{flush:'sync'});
  onBeforeUnmount(invalidate);
  const load = async (query:{n:number;dim:string;image:boolean}) => {
    invalidate(); const request = generation;
    controller = new AbortController(); loading.value=true;
    try {
      const result = await $fetch<RecommendationToolPayload>('/api/account/recommendation/tool',{query,signal:controller.signal,credentials:'include'});
      if (request===generation) data.value=result;
    } catch { if(request===generation) failed.value=true; }
    finally { if(request===generation){loading.value=false;controller=null;} }
  };
  return {data,loading,failed,load,invalidate};
}
