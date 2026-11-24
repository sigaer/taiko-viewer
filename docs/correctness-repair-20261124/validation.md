# 独立集成验证与证据

所有QA通过既有 `scripts/memory/run_qa.sh`；Viewer构建通过 `run_build.sh`，只执行候选 `npm run build`，没有执行部署脚本。Node24.22.1，Python为生产安装解释器，业务代码来自候选；所有成绩／数据库测试输入均为合成。只读曲库／完整性扫描独立执行，未使用可恢复或重建资料的生产入口。

## 最终结果

| 验证 | 结果 | 证据 |
|---|---|---|
| Node既有基线 | 279/279 | qa-94bc18e06f5e |
| Node候选：Goal、Growth、Home、Recommendation、Publication、Golden | 309/309 | qa-c09a0a9adac7 |
| Python既有基线，实际installed Core0.1.1 | 55 passed / 4 existing skips | qa-cc9ba19cea89 |
| Python最终候选，source Core0.1.2 | 76 passed / 4 existing skips | qa-eabe775a9217 |
| A维度兼容installed0.1.1和source0.1.2 | 各4 unittest方法通过 | evidence/a-installed.log、a-source.log |
| A+B联合source Core | 12 unittest方法通过 | evidence/ab-source.log |
| A+B与未改生产Core0.1.1 | 22个失败断言/subtest，功能依赖门槛未通过 | qa-12321f5f0a48 |
| Viewer真实TS resolver → 三个adapter函数 → Core → Application | 7public+2aliases × 3 = 27组合通过，含下架与不存在里谱过滤 | qa-6d182848d624 |
| TJA真实HTTP与隔离worker | 1组合测试通过，含多编码、分支、并发、限制、错误、ratelimit；未设置真实语料reference root | qa-cc775fc15e7f |
| 实际曲库只读可用性 | 1387鬼/里，merged/raw均有明确shelf状态，与审计严格口径一致 | qa-5790320f6221 |
| 生产Core0.1.1副本 + 专用增量回补patch | 12方法 + 76 passed / 4 existing skips | qa-ddd4e7529cd3 |
| 最终Python wheels | Core0.1.2、Application0.9.2、Bot0.26.3均构建成功；仅验证构建，未发布／安装 | qa-1c2ccae6b9de |
| Viewer候选1.19.8构建 | exit0、Build complete，4GiB heap / 5GiB cgroup；采样Node RSS最高3846MiB | evidence/viewer-build-configured.log |
| 完整性只读扫描 | 1098归档/23930点，12异常sampleCount；Publication异常对象同inode；日期异常独立记录 | qa-61d85e2b5349 |

证据根目录：`/home/sigaer/taiko/qa-vault/runs/<qa-id>/evidence/output.log`；便于审阅的汇总日志在 `/var/tmp/taiko-correctness-20261124/evidence/`。运行器的原样副本见 [validation-runners](validation-runners/)，固定路径对应本次保留worktree；重跑前先核对路径与维护锁，不直接调用未隔离业务脚本。

四项跳过来自原有 `tests/offline/conftest.py`：三项真实用户成绩夹具、一项历史ESE指定曲目夹具。未新增skip或删除断言；这些不计入通过数。

桥接测试执行真实TypeScript解析器、真实Core和public投影，三个Python宿主使用实际函数体及合成provider；另有pytest正常模块导入／计算验证。它不等同于真实Bot进程或生产认证HTTP。原有模拟API回归不冒充真实SQL集成。

## 失败、修复与基线区分

1. 错误Python配置导致Node基线首次33失败；指定实际生产Python和合成runtime根后279全通过。属于测试配置问题。
2. 候选首次Python39失败：新增raw authority要求触发旧夹具不足。给确认国行的合成夹具显式提供raw，所有原业务断言保留，最终通过。
3. Viewer审计时间轴旧代码1000/1000ms，正确750/2000ms；`c-baseline.log`（qa-93d23aab55e6）记录修复前失败。
4. 新Core Balloon样例先失败2项：`.25`误读为25秒，end28而非3.25；qa-ef1875b869a4。修复数值解析、有限负delay、正BPM边界后21个新增Core样例通过。
5. HTTP首次因PrivateTmp隐藏/var/tmp中的runtime而503；fixture搬到QA scratch可见路径后通过，未禁用隔离。
6. Python首次构建缺少wheel命令，使用QA临时构建工具 setuptools80.9.0/wheel0.45.1后成功；生产解释器环境未安装／修改。
7. Viewer首次以默认Node heap构建，exit134/heap OOM。按既有deploy脚本的4096MiB heap、保持run_build5GiB预算重跑exit0。没有把未配置构建的OOM判为代码基线bug；本批未修改部署脚本。现有reverse-oidc文件的BigInt/es2019警告仍存在，本批未改该文件。
8. 将0.1.2整文件覆盖0.1.1的初始scratch实验因ClientSongStats缺失而失败（qa-737107b69187）。改为仅应用本批增量patch，避免带入client模型；12+76项通过。原始生产0.1.1仍未经修复。

## Core回补边界

回补文件在Bot候选：`docs/correctness-repair-20261124/core-center-backport.patch`。它只包含availability、candidate filtering、catalog identity、两个parser的修复；适配了center原有identity函数的上下文，没有引入client的identity_namespace或ClientSongStats。仅在QA scratch复制的生产包上应用。输入与patch SHA256见 [backport-inputs.json](backport-inputs.json)。

这不是新发行版本，也没有改center pin。发布前仍需把回补纳入有来源证明的Core维护分支／制品、分配版本并核对依赖；不得把本地同版本wheel覆盖公开版本。此次普通源码wheel只用于打包验收，QA scratch清理后未留作发布制品。

## 资源与性能

均为同机、串行、有界合成测试；不含真实账号读取、DB、HTTP网络或生产并发。普通推荐使用1500候选／20参考、25次；catalog使用3000首双难度、25次。baseline为A修复后/B修复前source Core。

| 项目 | baseline P50/P95 | candidate P50/P95 |
|---|---:|---:|
| catalog authority | 4.182 / 4.519 ms | 12.235 / 13.087 ms |
| 普通推荐20项 | 7.080 / 12.498 ms | 11.411 / 16.530 ms |
| Viewer parser，1000小节4000音符，15次 | 7.635 / 22.896 ms | 4.865 / 14.233 ms |

Python峰值RSS：75872 → 76064KiB；Node parser：81212 → 81524KiB。catalog多源正值校验有明确CPU开销，不能称零回归。绝对增量在本组合成样例约8ms/4ms，未触及本次资源预算；共享主机小样本不证明生产SLA或分数目标推荐性能。parser数据不包含全量富特征计算。

性能证据：qa-6a29c3260981、qa-a3571688ce9b、qa-daec379307b8、qa-e48878c12254。最终build没有OOM或预算越界退出。Node测试中的既有浏览器检查受单测试并发和QA cgroup约束。对应QA manifest记录childrenStopped；结束时无本批build/TJA服务残留。无未审阅heap dump、缓存清除或生产压测。
