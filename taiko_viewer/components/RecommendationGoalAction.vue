<script setup lang="ts">
import { difficultyLabelKey } from '~/utils/difficulty';
import type { GoalType } from '~/types/player-goal';
import type { RecommendationGoalPreview } from '~/types/recommendation-tool';
const props = defineProps<{token:string;songId:number;difficultyType:number}>();
const {t,locale} = useI18n(), localePath = useLocalePath(), apiFetch = useViewerApiFetch();
const account = useState<{id:number}|null>('account-user',()=>null), bindingGeneration = useState('account-binding-generation',()=>0);
const homeGeneration = useState('account-home-generation',()=>0);
const dialog = ref<HTMLDialogElement|null>(null), preview = ref<RecommendationGoalPreview|null>(null), selected = ref<GoalType|null>(null);
const busy = ref(false), failed = ref(false), stale = ref(false), saved = ref(false), invalid = ref(false);
let generation=0, controller:AbortController|null=null, focus:HTMLElement|null=null;
const copy = computed(()=>locale.value==='ja'?{open:'目標を選ぶ',view:'目標を見る',done:'目標を設定しました',unavailable:'現在この譜面には目標を設定できません',refresh:'状態が変わりました。推薦を更新して、もう一度確認してください。'}:{open:'选择目标',view:'查看目标',done:'目标已设定',unavailable:'当前谱面暂无可设定目标',refresh:'状态已变化，请刷新推荐后重新确认。'});
function reset(){generation++;controller?.abort();controller=null;dialog.value?.close();preview.value=null;selected.value=null;busy.value=false;failed.value=false;saved.value=false;}
watch(()=>[account.value?.id,bindingGeneration.value],()=>{reset();invalid.value=true;},{flush:'sync'});
watch(()=>props.token,()=>{reset();invalid.value=false;stale.value=false;});
onBeforeUnmount(reset);
function close(){dialog.value?.close();selected.value=null;focus?.focus();}
async function open(){
  if(busy.value||invalid.value)return;
  reset();const request=generation;busy.value=true;stale.value=false;focus=document.activeElement as HTMLElement;controller=new AbortController();
  try {
    const result=await apiFetch<RecommendationGoalPreview>('/api/account/growth/goal/preview',{method:'POST',body:{recommendationToken:props.token},signal:controller.signal});
    if(request!==generation)return;
    if(result.songId!==props.songId||result.difficultyType!==props.difficultyType){stale.value=true;return;}
    preview.value=result;await nextTick();if(request===generation)dialog.value?.showModal();
  }catch(error){if(request===generation){stale.value=Number((error as any)?.statusCode)===409;failed.value=!stale.value;}}
  finally{if(request===generation){busy.value=false;controller=null;}}
}
const same = computed(()=>preview.value?.activeGoal?.songId===props.songId&&preview.value?.activeGoal?.difficultyType===props.difficultyType);
async function confirm(){
  if(busy.value||!preview.value||!selected.value||invalid.value)return;
  const request=generation,p=preview.value;busy.value=true;failed.value=false;controller=new AbortController();
  try {
    const result=await apiFetch<{profileId:string}>('/api/account/growth/goal',{method:'POST',signal:controller.signal,body:{profileId:p.profileId,expectedActiveGoalId:p.activeGoal?.id||null,songId:p.songId,difficultyType:p.difficultyType,goalType:selected.value,scoreRevision:p.scoreRevision,source:'ordinary-recommendation',recommendationToken:props.token}});
    if(request!==generation||result.profileId!==p.profileId)return;
    saved.value=true;close();homeGeneration.value++;
  }catch(error){if(request===generation){close();preview.value=null;stale.value=true;invalid.value=true;}}
  finally{if(request===generation){busy.value=false;controller=null;}}
}
</script>
<template>
  <div class="recommendation-goal-action">
    <template v-if="saved"><span role="status">{{ copy.done }}</span> <NuxtLink :to="localePath('/my/growth')">{{ copy.view }}</NuxtLink></template>
    <button v-else data-song-action :disabled="busy||invalid" :aria-busy="busy" @click="open">{{ copy.open }}</button>
    <p v-if="stale" role="alert">{{ copy.refresh }}</p><p v-else-if="failed" role="alert">{{ t('home.goal.error') }}</p>
    <dialog :ref="element => dialog = element as HTMLDialogElement | null" class="goal-dialog" @cancel.prevent="close" @close="focus?.focus()" :aria-label="t('home.goal.question')">
      <template v-if="preview">
        <h2>{{ t(same?'home.goal.selected':preview.activeGoal?'home.goal.replaceConfirm':'home.goal.question') }}</h2>
        <strong>{{ preview.title }}</strong><p>{{ t(difficultyLabelKey(preview.difficultyType)) }} · {{ preview.starLevel }}★</p>
        <template v-if="same"><p>{{ t(`home.goal.types.${preview.activeGoal!.goalType}`) }}</p><NuxtLink :to="localePath('/my/growth')">{{ copy.view }}</NuxtLink></template>
        <template v-else>
          <p v-if="preview.activeGoal">{{ preview.activeGoal.title }} · {{ t(`home.goal.types.${preview.activeGoal.goalType}`) }}</p>
          <fieldset v-if="preview.goalOptions.length" :disabled="busy" :aria-label="t('home.goal.question')"><label v-for="option in preview.goalOptions" :key="option"><input v-model="selected" type="radio" :name="`goal-${songId}-${difficultyType}`" :value="option">{{ t(`home.goal.types.${option}`) }}</label></fieldset>
          <p v-else>{{ copy.unavailable }}</p>
        </template>
        <div class="goal-actions"><button :disabled="busy" @click="close">{{ t('home.goal.cancel') }}</button><button v-if="!same&&preview.goalOptions.length" :disabled="busy||!selected" @click="confirm">{{ t(busy?'home.goal.saving':'home.goal.confirm') }}</button></div>
      </template>
    </dialog>
  </div>
</template>
<style scoped>
.recommendation-goal-action button { min-height:44px; padding:8px 14px; border:1px solid var(--el-border-color);border-radius:10px;background:var(--el-bg-color);color:var(--el-text-color-primary);font:inherit;cursor:pointer; }
button:disabled {opacity:.55;cursor:default;} button:focus-visible,a:focus-visible {outline:3px solid var(--viewer-accent-strong);outline-offset:2px;}
.goal-dialog {max-width:min(480px,calc(100vw - 48px));box-sizing:border-box;border:1px solid var(--el-border-color);border-radius:14px;padding:24px;background:var(--el-bg-color);color:var(--el-text-color-primary);overflow-wrap:anywhere;}
.goal-dialog::backdrop {background:var(--viewer-overlay);} fieldset {display:grid;gap:12px;margin:16px 0;border:0;padding:0;}label {display:flex;align-items:center;gap:8px;min-height:44px;} .goal-actions {display:flex;flex-wrap:wrap;gap:12px;margin-top:16px;}p {font-size:14px;}
</style>
