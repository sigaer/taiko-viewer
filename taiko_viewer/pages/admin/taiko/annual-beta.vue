<script setup lang="ts">
defineI18nRoute(false);definePageMeta({layout:'admin-taiko',middleware:'admin-auth'});useHead({title:'年度报告封闭测试'});
const includeInternal=ref(false);const api=useAdminApiFetch();const {data,refresh,error}=await useAsyncData<any>('beta-dashboard',()=>api('/api/admin/annual-beta',{query:{includeInternal:includeInternal.value?'1':'0'}}),{watch:[includeInternal]});const selected=ref('');const detail=ref<any>(null);const operationError=ref('');
const fields=['annual_entry_impression','annual_entry_click','beta_invite_gate_view','beta_invite_submit','beta_invite_validated','beta_invite_redeemed','auth_success','binding_success','data_sync_success','annual_build_success','annual_report_complete','annual_poster_open','annual_feedback_submit','annual_data_issue_submit'];
const labels=['首页入口曝光','首页入口点击','打开邀请验证','提交邀请码','邀请码验证通过','资格激活','登录成功','绑定成功','同步完成','报告生成成功','读完报告','查看海报','提交反馈','报告数据问题'];
const count=(key:string)=>Number(data.value?.funnel.find((x:any)=>x.event_name===key)?.participants||0);
const has=(p:any,key:string)=>String(p.completed_events||'').split(',').includes(key);
const open=async(p:any)=>{selected.value=person(p);detail.value=null;operationError.value='';try{detail.value=await api('/api/admin/annual-beta/participant',{query:{id:p.id}});}catch{operationError.value='无法加载时间线';}};
const manage=async(action:string,id:string,level?:number)=>{operationError.value='';try{await api('/api/admin/annual-beta/manage',{method:'POST',body:{action,id,level}});await refresh();}catch{operationError.value='操作失败，请重试';}};
const exclude=async(p:any)=>{operationError.value='';try{await api('/api/admin/annual-beta/manage',{method:'POST',body:{action:'exclude_analysis',id:p.id,excluded:!p.analysis_excluded}});await refresh();}catch{operationError.value='操作失败，请重试';}};
const pairs=[['首页入口点击','annual_entry_impression','annual_entry_click'],['提交邀请','annual_entry_click','beta_invite_submit'],['验证通过','beta_invite_submit','beta_invite_validated'],['完成登录','beta_invite_validated','auth_success'],['激活资格','auth_success','beta_invite_redeemed'],['开始绑定','beta_invite_redeemed','binding_start'],['绑定成功','binding_start','binding_success'],['数据就绪','binding_success','data_sync_success'],['发现报告入口','data_sync_success','annual_entry_ready'],['生成报告','annual_entry_ready','annual_build_success'],['打开报告','annual_build_success','annual_report_open'],['读完报告','annual_report_open','annual_report_complete'],['查看海报','annual_report_complete','annual_poster_open']];
const durations=[['完成登录','beta_invite_validated','auth_success'],['完成绑定','beta_invite_redeemed','binding_success'],['绑定验证','binding_verify_start','binding_success'],['同步数据','binding_success','data_sync_success'],['同步至发现报告','data_sync_success','annual_entry_ready'],['生成报告','annual_build_start','annual_build_success'],['阅读报告','annual_report_open','annual_report_complete']];
const duration=(start:string,end:string)=>{const rows=data.value?.times||[];const values=rows.filter((r:any)=>r.event_name===start).flatMap((a:any)=>{const b=rows.find((r:any)=>r.participant_id===a.participant_id&&r.event_name===end);const ms=b?new Date(b.first_at).getTime()-new Date(a.first_at).getTime():-1;return ms>=0?[ms/1000]:[];}).sort((a:number,b:number)=>a-b);return values.length?`${values[Math.floor(values.length/2)].toFixed(1)} 秒 · ${values.length} 人`:'—';};
const conversion=(a:string,b:string)=>{const rows=data.value?.times||[];const starts=rows.filter((r:any)=>r.event_name===a);const n=starts.filter((x:any)=>rows.some((y:any)=>y.participant_id===x.participant_id&&y.event_name===b&&new Date(y.first_at)>=new Date(x.first_at))).length;return `${n}/${starts.length}`;};

const person=(p:any)=>p.username || (p.user_id ? `用户 ${p.user_id}` : '未登录访客');
const cohortNames:Record<string,string>={wave1:'第一批',wave2:'第二批'};
const cohortLabel=(value:string)=>cohortNames[value] || '未分批';
const statusNames:Record<string,string>={available:'可使用',redeemed:'已使用',expired:'已过期',disabled:'已停用'};
const statusLabel=(value:string)=>statusNames[value] || '未知状态';
const hintLabels=['无提示','轻度提示','方向提示','直接指引'];
const mark=(p:any,key:string)=>has(p,key)?'已完成':'—';
const date=(value:string)=>value ? new Date(value).toLocaleString('zh-CN',{hour12:false}) : '—';
const eventLabels:Record<string,string>={...Object.fromEntries(fields.map((key,i)=>[key,labels[i]])),home_view:'访问首页',auth_start:'开始登录',auth_failure:'登录失败',binding_entry_impression:'看到绑定入口',binding_entry_click:'点击绑定入口',binding_start:'开始绑定',binding_id_submitted:'提交太鼓号',binding_verification_instruction_view:'查看绑定说明',binding_pending:'等待绑定验证',binding_verify_start:'开始验证绑定',binding_failure:'绑定失败',data_sync_start:'开始同步',data_sync_failure:'同步失败',annual_entry_ready:'年度入口就绪',annual_report_open:'打开报告',annual_slide_view:'浏览报告页面',annual_build_start:'开始生成报告',annual_build_failure:'报告生成失败',annual_unavailable:'数据不足',annual_share_action:'分享海报',annual_feedback_open:'打开反馈',annual_rating_rank_layout_anomaly:'排名页面显示异常'};
const answerLabels:Record<string,string>={expected_value:'预期数据',comment:'问题说明',start:'开始体验',auth:'注册与登录',binding:'绑定过程',incorrect:'发现的数据错误',suspectPage:'有疑问的页面',memorablePage:'印象最深的页面',share:'分享意愿',resembles:'符合程度（满分 5 分）'};
const feedbackAnswers=(raw:any)=>{try{const parsed=typeof raw==='string'?JSON.parse(raw):raw;return Object.entries(parsed||{}).filter(([key,value])=>answerLabels[key]&&value!==''&&value!=null).map(([key,value])=>({label:answerLabels[key],value}));}catch{return [];}};
const cohort=ref('wave2');
const codes=ref<any[]>([]);const codesVisible=ref(false);const codesLoading=ref(false);const codesError=ref('');const unavailable=ref(0);const copyMessage=ref('');
const hideCodes=()=>{codes.value=[];codesVisible.value=false;copyMessage.value='';unavailable.value=0;};
watch(cohort,()=>{hideCodes();codesError.value='';});
const showCodes=async()=>{
  hideCodes();codesError.value='';codesLoading.value=true;
  try{const result=await api<any>('/api/admin/annual-beta/invite-codes',{method:'POST',body:{cohort:cohort.value}});codes.value=result.invites;unavailable.value=result.unavailable;codesVisible.value=true;}
  catch(e:any){codesError.value=e.data?.statusMessage||'无法读取邀请码，请稍后重试';}
  finally{codesLoading.value=false;}
};
const copyCode=async(code:string)=>{try{await navigator.clipboard.writeText(code);copyMessage.value='邀请码已复制';}catch{copyMessage.value='复制失败，请选中邀请码手动复制';}};
onBeforeUnmount(hideCodes);
</script>
<template>
  <div class="admin-page-stack">
    <div class="beta-heading"><h1>年度报告封闭测试</h1><el-button @click="refresh">刷新数据</el-button></div>
    <p v-if="error||operationError" role="alert">{{operationError||'无法加载数据，请刷新重试'}}</p>
    <el-card>
      <h2>发放邀请码</h2>
      <div class="beta-toolbar">
        <label for="beta-cohort">邀请批次</label>
        <select id="beta-cohort" v-model="cohort" :disabled="codesLoading"><option value="wave2">第二批</option><option value="wave1">第一批</option></select>
        <el-button type="primary" :loading="codesLoading" @click="showCodes">{{codesVisible?'刷新可用邀请码':'查看可用邀请码'}}</el-button>
        <el-button v-if="codesVisible" @click="hideCodes">收起邀请码</el-button>
      </div>
      <p class="beta-muted">每个邀请码限一人使用，请单独发给测试者。</p>
      <p v-if="codesError" role="alert">{{codesError}}</p><p role="status">{{copyMessage}}</p>
      <template v-if="codesVisible">
        <p>{{cohortLabel(cohort)}} · 可发放 {{codes.length}} 个</p>
        <p v-if="unavailable">另有 {{unavailable}} 个邀请缺少邀请码原件，请联系维护人员。</p>
        <div v-if="codes.length" class="beta-table"><table><thead><tr><th>邀请码</th><th>有效期至</th><th>操作</th></tr></thead><tbody>
          <tr v-for="invite in codes" :key="invite.id"><td><code class="invite-code">{{invite.code}}</code></td><td>{{date(invite.expires_at)}}</td><td><el-button @click="copyCode(invite.code)">复制邀请码</el-button></td></tr>
        </tbody></table></div>
        <p v-else>本批暂无可发放的邀请码。</p>
      </template>
    </el-card>
    <template v-if="data">
      <div class="beta-heading"><h2>测试进展</h2><el-checkbox v-model="includeInternal">包含内部验证记录</el-checkbox></div>
      <div class="beta-funnel"><el-card v-for="(field,i) in fields" :key="field"><small>{{labels[i]}}</small><strong>{{count(field)}} <small>人</small></strong></el-card></div>
      <el-card><h2>邀请与激活</h2>
        <div class="beta-metrics"><span>已使用邀请 {{data.inviteTotals.consumedInvites}}</span><span>已获得资格 {{data.inviteTotals.entitledUsers}} 人</span><span>数据不足 {{count('annual_unavailable')}} 人</span></div>
        <p>自主完成激活 {{data.activation.activated||0}} / {{data.activation.eligible||0}} 人</p>
        <details><summary>查看转化与耗时</summary><p class="beta-muted">自主激活统计从首页进入、未接受直接指引，并完成邀请、登录、绑定、同步及打开报告的测试者。</p><div class="beta-metrics"><span v-for="[label,a,b] in pairs" :key="label">{{label}} {{conversion(a,b)}}</span></div><h3>耗时中位数</h3><div class="beta-metrics"><span v-for="[label,a,b] in durations" :key="label">{{label}} {{duration(a,b)}}</span></div></details>
      </el-card>
      <el-card><h2>参与测试的用户</h2>
        <p v-if="!data.participants.length">暂无参与记录。</p>
        <div v-else class="beta-table beta-participants"><table><thead><tr><th>用户</th><th>邀请批次／资格</th><th>登录</th><th>绑定</th><th>数据同步</th><th>提示程度</th><th>报告生成</th><th>阅读／海报</th><th>反馈／数据问题</th><th>操作</th></tr></thead><tbody>
          <tr v-for="p in data.participants" :key="p.id">
            <td><el-button link type="primary" @click="open(p)">{{person(p)}}</el-button><small v-if="p.analysis_excluded_effective">内部验证记录</small><small>最近访问 {{date(p.last_seen)}}</small></td>
            <td>{{cohortLabel(p.cohort)}}<small>{{p.invite_id?(p.entitlement_enabled?'资格已激活':'资格已停用'):'未兑换邀请'}}</small></td>
            <td>{{mark(p,'auth_success')}}</td><td>{{has(p,'binding_success')?'已绑定':has(p,'binding_failure')?'绑定失败':has(p,'binding_pending')?'等待验证':'—'}}</td>
            <td>{{has(p,'data_sync_success')?'已同步':has(p,'data_sync_failure')?'同步失败':'—'}}</td>
            <td><details><summary>{{hintLabels[p.hint_level]||'无提示'}}</summary><el-button v-for="n in 3" :key="n" link :disabled="p.hint_level>=n" @click="manage('hint',p.id,n)">记录{{hintLabels[n]}}</el-button></details></td>
            <td>{{has(p,'annual_build_success')?'已生成':has(p,'annual_unavailable')?'数据不足':has(p,'annual_build_failure')?'生成失败':'—'}}</td>
            <td>{{mark(p,'annual_report_complete')}} / {{mark(p,'annual_poster_open')}}</td><td>{{mark(p,'annual_feedback_submit')}} / {{mark(p,'annual_data_issue_submit')}}</td>
            <td><el-button link @click="open(p)">查看详情</el-button><el-button link @click="exclude(p)">{{p.analysis_excluded?'恢复统计':'排除统计'}}</el-button></td>
          </tr>
        </tbody></table></div>
      </el-card>
      <el-card><h2>邀请使用记录</h2>
        <p v-if="!data.invites.length">暂无邀请记录。</p>
        <div v-else class="beta-table"><table><thead><tr><th>批次</th><th>状态</th><th>使用次数</th><th>有效期至</th><th>操作</th></tr></thead><tbody>
          <tr v-for="invite in data.invites" :key="invite.id"><td>{{cohortLabel(invite.cohort)}}</td><td>{{statusLabel(invite.status)}}</td><td>{{invite.used_count}} / {{invite.max_uses}}</td><td>{{date(invite.expires_at)}}</td><td><el-popconfirm v-if="invite.status==='available'" title="停用后该邀请码将无法兑换，确定停用？" confirm-button-text="停用" cancel-button-text="取消" @confirm="manage('disable_invite',invite.id).then(hideCodes)"><template #reference><el-button type="danger" plain>停用</el-button></template></el-popconfirm><details><summary>记录详情</summary><span>内部记录编号</span><code>{{invite.id}}</code></details></td></tr>
        </tbody></table></div>
      </el-card>
      <el-card v-if="detail"><h2>{{selected}} · 参与详情</h2><el-button @click="detail=null">收起详情</el-button>
        <h3>操作时间线</h3><p v-if="!detail.events.length">暂无操作记录。</p><ol><li v-for="(e,i) in detail.events" :key="i"><span>{{date(e.occurred_at)}} · {{eventLabels[e.event_name]||'其他操作'}}</span><details><summary>技术详情</summary><code>{{e.event_name}}</code><pre>{{e.metadata_json}}</pre></details></li></ol>
        <h3>用户反馈</h3><p v-if="!detail.feedback.length">暂无反馈。</p><article v-for="(f,i) in detail.feedback" :key="i"><strong>{{f.kind==='issue'?'数据问题':'体验反馈'}}</strong><dl><template v-for="answer in feedbackAnswers(f.answers_json)" :key="answer.label"><dt>{{answer.label}}</dt><dd>{{answer.value}}</dd></template></dl><details><summary>技术详情</summary><pre>{{f.context_json}}</pre></details></article>
      </el-card>
    </template>
  </div>
</template>
<style scoped>
.beta-heading,.beta-toolbar,.beta-metrics{display:flex;align-items:center;flex-wrap:wrap;gap:16px}.beta-heading{justify-content:space-between}.beta-funnel{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.beta-funnel strong{display:block;font-size:26px;margin-top:6px}.beta-funnel strong small{font-size:13px;font-weight:400}.beta-table{overflow:auto}.beta-table table{border-collapse:collapse;min-width:580px;width:100%}.beta-participants table{min-width:1320px}.beta-table th{white-space:nowrap}.beta-table th,.beta-table td{padding:12px;text-align:left;border-bottom:1px solid var(--el-border-color);vertical-align:top}.beta-table td small{display:block;margin-top:6px;color:var(--el-text-color-secondary)}.beta-table .el-button{margin:0 8px 4px 0}.beta-muted{color:var(--el-text-color-secondary)}.invite-code{font-size:16px;letter-spacing:.08em;white-space:nowrap;user-select:all}select{padding:8px 12px;background:var(--el-bg-color);color:var(--el-text-color-primary);border:1px solid var(--el-border-color);border-radius:6px;min-height:40px}summary{cursor:pointer;padding:8px 0}details code{display:block;overflow-wrap:anywhere}li{padding:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}h2{font-size:20px;margin:0 0 16px}h3{font-size:16px}.admin-page-stack{min-width:0} @media(max-width:600px){h1{font-size:24px}.beta-toolbar{gap:10px}.beta-funnel{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
