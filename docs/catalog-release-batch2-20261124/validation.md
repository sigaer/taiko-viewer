# Independent Validation / Evidence Index

全部实际读取、代码修改、命令执行和Git提交由主代理完成。三个Native子代理均报告没有任何可调用工具，未执行读取、审计、测试或提交；没有将其结论冒充独立执行PASS。独立worktree已建立但没有多个代理写同一文件。测试与构建通过既有维护锁串行执行，没有绕过内存隔离。

| 检查 | 最终结果 | QA / 日志 |
|---|---|---|
| Core必需契约 | 12方法 PASS | qa-6dc9a50bfe1e / rc-installed-contract.log |
| Python回归 | 76 PASS /4既有skip | qa-dddedcfa9777 / rc-installed-python.log |
| Node原基线候选 | 309/309 | qa-eece7b51cc36 / node-regressions.log |
| Node最终安装制品环境 | 310/310（含Kinoko新回归） | qa-398e34d1daf0 / node-installed-final.log |
| 27跨语言桥接 | 18 PASS、Client9 FAIL | qa-792a22393a96 / rc-installed-bridge.log；bridge-cases.json逐项 |
| Python最终wheel build | Core/Contract/Application/Bot/Memory五包两次逐字节一致；pip check PASS；Center resolver0、Client1 | qa-ec622987b6ce / final-artifacts-fixed.log；release-manifest.json |
| Viewer build | exit0，Build complete，Node24.22.1，4GiB heap/5GiB cgroup | viewer-build.log；run_build标准隔离，未运行deploy |
| Catalog只读基础审计 | 2993歌曲、12052 chart正难度并集、7差异、494 consumer引用 | qa-f6a0473a4f7c / catalog-audit.log |
| Publication /11+3 Measurement | 916current完整hash、1异常；14日志/2绑定 | qa-33b57dd8344f / integrity-audit.log |
| 历史对象、writer、身份与xlsx补审 | 751unique对象、1499引用、1坏引用、312源码写位置、9工作表、3失效映射资源 | qa-530f9045cc92 / deep-audit-complete.log |
| Measurement合成重现 | writer0样本接受、reader0拒绝、1接受 | qa-c979facce5ef / measurement-contract.log |
| 全量TJA最终 | 3003，1832 COMPLETE/1171 PARTIAL | qa-435ab1f4042d / tja-final-corrected.log |
| Source alias /实际资源根复核 | 2990 source关联、558歧义搜索别名、2987有资源/6缺失或未知 | qa-95878fbf890f / alias-audit-final.log |
| 原TJA私有冻结 | 3003逐一重新hash与扫描匹配 | qa-3ba8fd7d81b2 / corpus-freeze.log |

QA原始输出与资源/隔离manifest：`/home/sigaer/taiko/qa-vault/runs/<qa-id>/evidence/`。便于审阅的日志：`/var/tmp/taiko-batch2-20261124/evidence/`。Viewer build日志采样最高Node RSS3630MiB；这是日志采样，不声称OS瞬时峰值。构建既有reverse-oidc BigInt/es2019警告仍存在。

Python4个skip为原tests/offline/conftest对历史真实玩家/特定私有ESE夹具的隔离规则，没有新增skip或删除断言。测试的业务输入均为合成；完整性调查原始资料只读，单独存私有证据。没有生产认证HTTP、真实Bot上线、SQL写入集成或生产并发压测。

## 保留的失败与修正

- 初次PyPI直连无可用包；使用已存在CN代理重试，未换生产代理。
- 初次真实新Core安装后原宿主版本检查拒绝、Application上限不兼容；制作有新版本的配套Application/Bot候选，未mock版本检查。
- 额外旧Core全仓23方法有3方法/128旧空集与availability断言不兼容；原日志installed-core-original.log保留，详见Core报告，不能声称全仓PASS。
- Center可选依赖首次缺pil-utils，补后发现Pillow<12等实际依赖；以已有生产依赖wheel补齐并重跑最终pip/Center resolver/Python/Node。
- 深度调查首次用生产解释器缺openpyxl，改用新venv工具；第二次在全量TJA文件重建前找不到task artifact，最终完整重跑成功。没有取消隔离或改用未保护业务入口。
- ESE单源2990与任务3003不符，查证13补充原TJA，最终来源分区扫描3003；先前扫描全部留证。
- 扫描报告初版BPM/DELAY命令时刻不足以表示同槽位原始次序，改为明确null精确时刻和前后DELAY边界；parser业务源码未改，最终全量重跑。绝对音频对齐和动态LEVELHOLD始终未标已支持。
- 最终自检发现扫描器把明确未知命令时刻null当成非有限值，误归993个INVALID；仅修扫描器分类，加Golden状态断言，全量3003重新执行后恢复1832/1171。错误版本与首次归档保留，未修改parser或原谱。
- Client9项桥接失败与resolver失败仍未修复，明确阻止全系统Release，不被其他PASS覆盖。

## 数据与原工作区保护

原Viewer工作区的title_song_relations修改、研究/脚本/CSV/TJA未跟踪文件，Bot的web.conf与既有未跟踪报告保持原状；未stash/reset/clean。原候选分支HEAD仍26930740/62c4d3e。未修改生产userdata/history/Publication、songs/assets/config/keys/DB/OSS；源原文只复制到私有QA证据，不移动或重建业务目录。

所有新脚本是审计/候选构建入口；真实数据库读调查通过readonly事务，未调用应用schema初始化/Publication shared恢复路径。结束时没有本批临时HTTP/dev服务；systemd隔离任务退出后由wrapper回收子进程。

最终交付联检：`qa-6b248274d7c9`重新流式读回3003文件/5,253,837个event，验证源原文归档3003个hash、13个制品hash、报告本地链接及6个安装writer源码一致性；正确分类1832 COMPLETE/1171 PARTIAL。见`delivery-verification.json`。私有持久证据包位置/hash见`durable-evidence.json`；其中包括原始失败输出，禁止公开分发。
