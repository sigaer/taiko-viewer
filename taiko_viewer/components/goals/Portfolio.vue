<script setup lang="ts">
import type { PortfolioGoalV2, CreatableGoalType } from '~/types/goal-portfolio';
import type { Target } from '~/utils/multi-objective/contracts';
const emit = defineEmits<{
    completed: [
    ];
}>();
const props = defineProps<{
    profileId: string;
    identity: string;
}>();
const { t, locale } = useI18n(), localePath = useLocalePath(), api = useViewerApiFetch();
const { data, loading, busy, error, unavailable, legacy, refresh, command, evaluate, retryWrite } = useGoalPortfolio(() => props.identity, () => props.profileId);
const ongoing = computed(() => data.value?.goals.filter(g => ['active', 'paused'].includes(g.lifecycleStatus)).sort((a, b) => a.userOrder - b.userOrder) || []);
const history = computed(() => data.value?.goals.filter(g => ['completed', 'cancelled'].includes(g.lifecycleStatus)) || []);
const creating = ref(false), songId = ref<number | null>(null), difficulty = ref(4), options = ref<Array<{
    goalType: CreatableGoalType;
    target: Target;
}>>([]), selected = ref<CreatableGoalType | null>(null), optionTitle = ref(''), optionsLoading = ref(false), createError = ref('');
let optionGeneration = 0;
const date = (s: string) => new Date(s).toLocaleString(locale.value === 'ja' ? 'ja-JP' : 'zh-CN', { dateStyle: 'short', timeStyle: 'short' });
const targetText = (target: Target | null) => !target ? t('portfolio.targetUnknown') : target.kind === 'score' ? `${t('portfolio.score')} ≥ ${target.threshold.toLocaleString()}` : target.kind === 'ng_reduction' ? `NG ≤ ${target.threshold}` : target.kind === 'rank' ? `${t('portfolio.rank')} ≥ ${target.threshold}` : target.kind === 'crown' ? t(`portfolio.crowns.${target.crown}`) : t('portfolio.targetUnknown');
function goalTypeText(type: string) { const key=`home.goal.types.${type}`;const label=t(key);return label===key?type:label; }
function openCreate(song?: number, course = 4) {
    creating.value = true;
    songId.value = song || null;
    difficulty.value = course;
    options.value = [];
    selected.value = null;
    createError.value = '';
    optionTitle.value = '';
    if (song)
        void nextTick(() => loadOptions());
}
async function loadOptions() {
    const generation = ++optionGeneration, identity = props.identity;
    optionsLoading.value = true;
    options.value = [];
    selected.value = null;
    createError.value = '';
    try {
        const result = await api<{
            profileId: string;
            title: string;
            options: Array<{
                goalType: CreatableGoalType;
                target: Target;
            }>;
        }>('/api/account/growth/goal-portfolio/options', { query: { profileId: props.profileId, songId: songId.value, difficultyType: difficulty.value } });
        if (generation !== optionGeneration || identity !== props.identity)
            return;
        options.value = result.options;
        optionTitle.value = result.title;
        if (!result.options.length)
            createError.value = 'noOptions';
    }
    catch {
        if (generation === optionGeneration && identity === props.identity)
            createError.value = 'optionsError';
    }
    finally {
        if (generation === optionGeneration)
            optionsLoading.value = false;
    }
}
watch([songId, difficulty], () => { optionGeneration++; options.value = []; selected.value = null; optionTitle.value = ''; optionsLoading.value = false; });
watch(() => props.identity, () => { optionGeneration++; creating.value = false; options.value = []; optionsLoading.value = false; });
async function create() {
    const choice = options.value.find(o => o.goalType === selected.value);
    if (!choice || !songId.value)
        return;
    await command([{ type: 'create_manual_goal', songId: songId.value, difficultyType: difficulty.value, goalType: choice.goalType, target: choice.target }]);
    if (!error.value)
        creating.value = false;
}
async function evaluateGoal(g: PortfolioGoalV2) {
    const result = await evaluate([g.id], g.lifecycleStatus === 'paused');
    if (result?.affectedGoals.some(g => g.lifecycleStatus === 'completed'))
        emit('completed');
}
function act(g: PortfolioGoalV2, type: 'pause_goal' | 'resume_goal' | 'cancel_goal') { return command([{ type, goalId: g.id, expectedGoalRevision: g.goalRevision }]); }
function priority(g: PortfolioGoalV2, e: Event) { return command([{ type: 'set_goal_priority', goalId: g.id, expectedGoalRevision: g.goalRevision, userPriority: Number((e.target as HTMLSelectElement).value) }]); }
function move(g: PortfolioGoalV2, delta: number) {
    const ids = ongoing.value.map(g => g.id), index = ids.indexOf(g.id), next = index + delta;
    if (next < 0 || next >= ids.length)
        return;
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    return command([{ type: 'reorder_goals', goalIds: ids, expectedGoalRevisions: Object.fromEntries(ongoing.value.map(g => [g.id, g.goalRevision])) }]);
}
defineExpose({ openCreate });
</script>

<template>
 <section v-if="!legacy" class="goal-portfolio rw-panel" :aria-label="t('portfolio.title')" :aria-busy="busy || loading">
  <header class="portfolio-heading"><h2>{{ t('portfolio.title') }}</h2><button v-if="data?.capabilities.canCreateGoal" type="button" class="rw-btn" :disabled="busy" @click="openCreate()">{{ t('portfolio.create') }}</button></header>
  <p v-if="loading && !data" role="status">{{ t('portfolio.loading') }}</p>
  <div v-if="error" role="alert" class="portfolio-error"><p>{{ t(`portfolio.${unavailable ? 'unavailable' : error}`) }}</p><button type="button" class="rw-btn" :disabled="busy || loading" @click="retryWrite()">{{ t('portfolio.retry') }}</button></div>
  <template v-if="data">
   <p v-if="!data.capabilities.canCreateGoal" class="rw-note">{{ t('portfolio.sourceUnavailable') }}</p>
   <form v-if="creating" class="portfolio-create" @submit.prevent="loadOptions">
    <h3>{{ t('portfolio.create') }}</h3>
    <label>{{ t('portfolio.songId') }}<input v-model.number="songId" type="number" min="1" step="1" required :disabled="busy || optionsLoading"></label>
    <label>{{ t('portfolio.difficulty') }}<select v-model.number="difficulty" :disabled="busy || optionsLoading"><option v-for="n in 5" :key="n" :value="n">{{ t(`portfolio.difficulties.${n}`) }}</option></select></label>
    <div class="portfolio-actions"><button type="submit" class="rw-btn" :disabled="busy || optionsLoading">{{ t(optionsLoading ? 'portfolio.loading' : 'portfolio.chooseTarget') }}</button><button type="button" class="rw-btn" :disabled="busy" @click="creating=false">{{ t('portfolio.close') }}</button></div>
    <p v-if="createError" role="alert">{{ t(`portfolio.${createError}`) }}</p>
    <fieldset v-if="options.length"><legend>{{ optionTitle }}</legend><label v-for="option in options" :key="option.goalType"><input v-model="selected" type="radio" :value="option.goalType" :disabled="busy">{{ t(`home.goal.types.${option.goalType}`) }} · {{ targetText(option.target) }}</label><button type="button" class="rw-btn" :disabled="!selected || busy" @click="create">{{ t('portfolio.create') }}</button></fieldset>
   </form>
   <p v-if="!ongoing.length" class="rw-note">{{ t('portfolio.empty') }}</p>
   <ol v-else class="portfolio-list">
    <li v-for="(goal,index) in ongoing" :key="goal.id" class="portfolio-goal" :data-goal-id="goal.id">
     <NuxtLink :to="localePath({path:`/songs/${goal.songId}`,query:{difficulty:String(goal.difficultyType)}})" class="portfolio-title">{{ goal.displaySnapshot.title }}</NuxtLink>
     <p>{{ t(`portfolio.difficulties.${goal.difficultyType}`) }} · {{ goalTypeText(goal.goalType) }}</p>
     <p class="portfolio-state">{{ t(`portfolio.status.${goal.lifecycleStatus}`) }} · {{ t(`portfolio.availability.${goal.availability.state}`) }}</p>
     <p>{{ targetText(goal.target) }}</p>
     <p>{{ t('portfolio.evaluation') }}: {{ t(`portfolio.outcomes.${goal.latestEvaluation?.outcome || 'none'}`) }}</p>
     <label class="portfolio-priority">{{ t('portfolio.priority') }}<select :value="goal.userPriority" :disabled="busy" @change="priority(goal,$event)"><option v-for="priorityValue in 4" :key="priorityValue" :value="priorityValue-1">{{ priorityValue-1 }}</option></select></label>
     <p class="portfolio-dates">{{ t('portfolio.created') }} {{ date(goal.createdAt) }}<br>{{ t('portfolio.updated') }} {{ date(goal.updatedAt) }}</p>
     <div class="portfolio-actions">
      <button type="button" class="rw-btn" :disabled="busy" @click="act(goal,goal.lifecycleStatus==='paused'?'resume_goal':'pause_goal')">{{ t(goal.lifecycleStatus==='paused'?'portfolio.resume':'portfolio.pause') }}</button>
      <button type="button" class="rw-btn" :disabled="busy" @click="evaluateGoal(goal)">{{ t('portfolio.evaluate') }}</button>
      <button type="button" class="rw-btn" :disabled="busy || index===0" :aria-label="t('portfolio.moveUpGoal',{title:goal.displaySnapshot.title})" @click="move(goal,-1)">{{ t('portfolio.moveUp') }}</button>
      <button type="button" class="rw-btn" :disabled="busy || index===ongoing.length-1" :aria-label="t('portfolio.moveDownGoal',{title:goal.displaySnapshot.title})" @click="move(goal,1)">{{ t('portfolio.moveDown') }}</button>
      <button type="button" class="rw-btn" :disabled="busy" @click="act(goal,'cancel_goal')">{{ t('portfolio.cancel') }}</button>
     </div>
    </li>
   </ol>
   <details class="portfolio-history"><summary>{{ t('portfolio.history') }}</summary><ul class="portfolio-list"><li v-for="goal in history" :key="goal.id" class="portfolio-goal"><strong>{{ goal.displaySnapshot.title }}</strong><p>{{ goalTypeText(goal.goalType) }} · {{ t(`portfolio.status.${goal.lifecycleStatus}`) }}</p><p>{{ targetText(goal.target) }}</p><p>{{ date(goal.completedAt || goal.cancelledAt || goal.updatedAt) }}</p></li></ul><p v-if="!history.length">{{ t('portfolio.historyEmpty') }}</p><button v-if="data.pagination.nextCursor" type="button" class="rw-btn" :disabled="loading || busy" @click="refresh(data.pagination.nextCursor)">{{ t('portfolio.more') }}</button></details>
  </template>
 </section>
</template>

<style scoped>
.goal-portfolio { padding: 24px; min-width: 0; display: grid; gap: 16px; }
.portfolio-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.portfolio-heading h2 { margin: 0; font-size: 1.25rem; }
.portfolio-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.portfolio-goal,.portfolio-create { border: 1px solid var(--line, var(--el-border-color)); border-radius: 12px; padding: 16px; min-width: 0; overflow-wrap: anywhere; }
.portfolio-goal p { margin: 8px 0; }
.portfolio-title { font-weight: 700; color: inherit; }
.portfolio-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.goal-portfolio button,.goal-portfolio input,.goal-portfolio select,.goal-portfolio summary { min-height: 44px; }
.goal-portfolio button { white-space: normal; }
.goal-portfolio button:disabled { opacity: .5; }
.goal-portfolio :is(input,select) { max-width: 100%; background: var(--surface, var(--el-fill-color-blank)); color: inherit; border: 1px solid var(--ctl-border, var(--el-border-color)); border-radius: 8px; padding: 8px; font: inherit; }
.goal-portfolio label { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.portfolio-create { display: grid; gap: 12px; }
.portfolio-create fieldset { display: grid; gap: 8px; min-width: 0; }
.portfolio-history summary { cursor: pointer; display: list-item; padding-block: 12px; }
.portfolio-dates { font-size: .875rem; }
.portfolio-error { color: var(--el-color-danger); }
@media (max-width: 480px) { .goal-portfolio { padding: 16px; } .portfolio-goal,.portfolio-create { padding: 12px; } }
</style>
