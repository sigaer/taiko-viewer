# U1 独立只读适配器准备与执行授权核对

后续状态：用户已明确授权U1；首次资源失败后手动复查通过，明确继续后首请求401并停止，详见[准入历史](viewer-u1-admission-20261027.md)和[实际执行结果](viewer-u1-execution-20261027.md)。本文余下内容保留为PR #42的授权前准备快照，不再代表当前授权状态。

日期：2026-10-27，Asia/Shanghai。承接PR #41及main `2b2f8ddea222e6a007420a6b7fd06e5114bf0780`，沿用[原Source报告](viewer-source-integrity-20261025.md)、[U1/W1申请](viewer-source-repair-requests-20261026.md)和[唯一Gate](viewer-1-release-gates-20261023.md)。本轮只准备U1，不执行W1或改备份。Viewer仍为0.87.11 / `92e6106`，运行PID4179944、buildId和资源限制未变。

## 授权判定与单案状态

本轮消息要求“如果用户尚未明确授权U1，停止在准备阶段”，没有另行明确授予U1。过去的单案正文解析、一次性检查点、合成演练或合入PR均不代替U1。当前执行计划固定为 **NOT_GRANTED**，授权引用为空，没有写入任何“已授权”凭据或执行票据。

UTC 2026-10-26 16:12:33（北京时间10月27日00:12:33）再次通过只读SH及SQL read-only事务核对：sequence=2、committed与保留原commit完全一致；current引用428002B/`66b61224c72bee75a583d83febfc618319897ac6f088b1457952e795b12544c7`，实际428028B/`d186ad57ea8f36b20ac6106d58880b00dba63018384554bdca605fdfbf45feb2`。对象/projection的inode、mtime、ctime、完整绑定ID/属主/来源均与封存前提一致，无pending，歌曲锁仍0。

仅本案两个路径流式hash，没有再扫750对象或旧检查点，也没有解析Source正文。精确身份、manifest和绑定前提留在私有capsule中，不进入仓库或公开日志。

## 独立适配器及执行方式

新增 [source_u1_readonly.py](../scripts/readiness/source_u1_readonly.py) 和 [离线边界测试](../scripts/readiness/test_source_u1_readonly.py)。不导入或调用getUserData、save_userdata、dispatch、SQL、Writer、Source/绑定/业务缓存持久化。唯一写入目标是获批私有目录中的编号响应文件和脱敏摘要；读取脚本不能执行W1。

固定请求为原申请的songs POST（page1/pageSize3000/sort1/isPlayed=true/本案userid）、search POST（本案keyword/page1/pageSize10）、achievement GET和dojo GET。身份只从封存capsule加载，没有首项fallback；搜索必须恰好匹配一个本案userid。原读取代码的公开User-Agent、Referer及Content-Type已逐项比较；没有读取配置cookie。

单并发、最多4请求；禁重试、自动重定向、环境代理/netrc和凭据刷新，TLS验证保持开启。连接≤3s、读超时≤10s，逐块接收≤8MiB/响应、累计≤16MiB；未知长度达到上限而无法证明结束时拒绝，不为探测结尾继续超额读取。只接收未压缩/identity响应，压缩或未知编码停止，不暗中扩展解压预算。response hook在Requests内部redirect resolver运行前拒绝异常状态并关闭响应；真实Session.send配合禁止正文读取的假Adapter验证302/Location/超大gzip正文不会被预读（PR自动审查P2已处理）。状态失败、截断、身份不符、分页不明或到期均停止，剩余请求标为NOT_ISSUED。

分页策略有意保守：短于3000条本身不算完整。当前只认识明确且内部一致的 `playedRecords.pagination`（page/pageSize/total/hasNext）形状；**合成fixture不是实际Wahlap schema的证据**。真实响应缺少这个元数据或字段语义无法确认时，停止并记录NOT VERIFIED，不猜别名、不追加分页、不自动重试。若以后需要改变参数、请求范围或重新请求，应另行核对授权。

即使四个原始输入都通过，适配器也只标记输入集待隔离Source验证，不自动生成/认可生产current，不声称完整Source或同一时刻原子快照。真实数据取得后，仍需按申请做隔离结构转换、完整性/来源与既有本案材料对照，才有具体候选长度/hash及新revision决策。

已生成的私有计划为现有证据区 `viewer-u1-preparation-20261026/private/u1-plan.json`，**NOT_GRANTED**。响应拟存于其下的 `responses-001`：父目录0700、文件0600、独占创建；目前响应目录尚未创建。凭据来源只通过运行配置路径和文件元数据确认，仍为现有Wahlap配置；助手、本轮命令及测试没有读取cookie值。未来获授权的进程才可将该凭据直接用于请求头，不写入响应摘要、命令行、PR或证据正文。

默认CLI仅检查准备状态，不加载凭据、创建网络会话或响应目录。未来执行必须先收到独立明确U1授权，再封存授权引用/到期时间/适配器及capsule hash，重新完成5分钟内的本案预检，并通过实时资源准入。计划文件标志本身不是用户授权。

经授权后的固定执行形式（**本轮没有运行真实获取**）：

```sh
bash scripts/memory/run_qa.sh /usr/bin/timeout --signal=TERM --kill-after=1s 58s \
  /opt/taiko-bot/current/bin/python -I -B \
  /var/tmp/viewer-u1-20261026/scripts/readiness/source_u1_readonly.py \
  --plan /home/sigaer/taiko/qa-vault/evidence/viewer-u1-preparation-20261026/private/u1-plan.json \
  --execute
```

内部57s计时，外部58s终止并在1s后强制终止owned进程；沿用QA维护互斥、2/3GiB、2CPU及磁盘边界，不放宽限制。准备时资源快照可用8,126,632KiB，执行门槛11,169,626KiB，尚不满足；即使取得授权，也不会跳过资源门槛或先载入cookie。授权、预检或准入失败均不能当成已完成上游获取。

## 验证与当前结果

25项离线测试PASS：未授权零副作用、不能把凭据文件当plan读取、四请求参数、身份/重复身份、分页/截断、状态/重定向/无重试、大小/累计上限、压缩、时限、异常脱敏、私有文件权限、受限读取及禁止持久化依赖。全部使用合成身份/凭据及fake transport，socket连接被禁止。真实请求头比对的初次失败记录保留，修正后通过。

另外对真实入口做未授权**拒绝测试**，审计钩子禁止任何配置cookie打开、DNS/socket事件、Source写入及响应目录创建；入口按预期退出3。四类尝试计数全部0，确认不是“读了凭据后才拒绝”。这是准备阶段的负向测试，不是U1实际执行。

| 审查项 | 当前结果 |
| --- | --- |
| 精确本案结果 | NOT VERIFIED；未访问上游 |
| 四请求状态/完整性 | 均NOT_ISSUED；没有响应正文或响应hash |
| 候选长度/hash/结构差异/来源证明 | 无候选，NOT VERIFIED |
| 是否完整当前Source | NOT VERIFIED；不能由离线fixture证明 |
| 恢复旧committed字节或新revision | 尚无数据可裁决；新获取内容不会直接追认为旧字节 |
| 后续权限 | U1仍待明确授权；可信候选形成后，W1仍须新的独立授权 |

证据留在现有私有区 `qa-vault/evidence/viewer-u1-preparation-20261026`：`case-precheck.json`、`execution-preparation.json`、`authorization-guard-proof.json`；最终离线运行 `qa-119f339155e4`，拒绝入口审计 `qa-14170ed746a8`，本案最新复核 `qa-fb5e663d82a5`。初始状态和失败测试分别留存，owned子进程均退出；不提交capsule、plan或私有资料。

结论：**准备/离线边界PASS；U1执行BLOCKED_PENDING_EXPLICIT_AUTHORIZATION；候选可信度NOT VERIFIED；W1未授权且未执行；Source仍fail-closed、RC仍BLOCKED。** 本轮上游请求0、cookie读取0、生产Source/Writer/manifest/verified/数据库权限及备份调度变更0，无版本升级或部署。
