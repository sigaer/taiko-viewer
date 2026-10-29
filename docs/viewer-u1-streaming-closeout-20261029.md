# U1 流式解析优化交付与专用准入审批建议

日期：2026-10-29，Asia/Shanghai。基线main `41dfd6aa`（PR #43）。本文件随代码优化一并审查，状态仍归入[唯一Release Gate](viewer-1-release-gates-20261023.md)。生产沿用0.87.11；本轮没有真实上游请求、Cookie/Source正文读取、W1、部署或生产配置变更。

## 已验证的最终实现

响应仍按原64KiB分块写入独占创建的0700/0600私有目录/文件，下载时累计长度并流式计算SHA-256。移除全部chunks累积及整包join；下载、长度、fsync完成后，在同一文件描述符回卷并用ijson事件流验证。未知字段也解析到完整文档结束，不因提前取得业务字段而漏验坏尾部。不保留完整JSON树，songs逐项计数与身份检查，profile只保留精确身份匹配数量。

解析器在独立模块中，模块SHA-256嵌入适配器并在加载前核验；依赖不可用时在凭据读取前拒绝。支持原stdlib识别的UTF-8/BOM、UTF-16及UTF-32编码；使用标准库增量转码后交给成熟的YAJL解析器，没有自写JSON词法解析。重复字段保留最后值，分页字段集合、int/bool区别、3000条截断边界、精确唯一身份和原拒绝分类保留。YAJL采用标准JSON语法，不承诺stdlib对NaN/Infinity等非标准扩展的宽松接受。

固定四请求、参数、上游身份、认证头、TLS验证、禁重试/重定向、连接3s/读取10s、每响应8MiB/总16MiB、57s内部/58s外部及失败即停规则均未改变。没有提供新的生产读取入口。

## 最终验证与容量

最终代码重新通过 **25项原边界检查 + 9项精确回归**，不是沿用旧33项PASS。运行 `qa-cee466ee2b39`；包括最后编码兼容修正、身份、分页、重复字段、无关内容和坏尾部。随后 `qa-e8dda3dd9e26` 在原30%物理内存+3GiB/PSI门槛通过后，复用原六类合成输入完成最终容量复核。每个正常输入的四响应累计16MiB-4KiB，单大响应8MiB-4KiB。增加本地验证证书的TLS1.3 MemoryBIO握手与记录加解密，无socket或真实请求。

| 指标 | 优化前，同样本地TLS | 最终优化后，同样本地TLS |
| --- | ---: | ---: |
| cgroup memory.current采样峰值 | 247.92MiB | 78.98MiB |
| 完整进程树RSS采样峰值 | 276.83MiB | 102.31MiB |
| memory.events high增量 | 2 | 0 |
| max/OOM/oom_kill增量 | 0 | 0 |
| swap及swap事件增量 | 0 | 0 |
| 完成用例 | 5/6，密集JSON触发高水位后终止 | 6/6全部完成 |
| 墙钟 | 2.83s，提前终止 | 14.54s |

校准仍在父级QA High/Max=2/3GiB和互斥下，临时子cgroup High/Max=256/512MiB、SwapMax=0、2CPU；子进程、临时cgroup及合成正文全部清理。最终Unicode转义用例9.20s，明显慢于整包解析但处于原57s执行预算内；没有放宽超时。

测量限制：内核5.10没有memory.peak；上述10ms采样是观测下界，RSS合计重复计算共享页，不能将任一项追认为真实cgroup峰值上界。没有为缺失指标追加重复测试。MemoryBIO包含用户态TLS成本，未覆盖真实socket/内核网络队列；合成输入不是上游schema或Source候选完整性的证明。**优化与功能回归通过；新预算尚未获批，不把采样低于192MiB写成严格峰值验收通过。**

## 依赖及执行环境封存

固定依赖见 [requirements](../scripts/readiness/source_u1_requirements.txt) 与[依赖锁](../scripts/readiness/source_u1_dependencies.lock.json)。已封存隔离的U1工具环境：CPython3.11.4/Linux x86_64，requests2.34.2、ijson3.6.0/yajl2_c、OpenSSL1.1.1n；禁用system-site-packages后，以`-I -B`验证无全局包回退、C扩展加载及八种编码可用。requests及其依赖沿用当前安装构件的精确版本/文件，ijson来自本机已有安装，不向生产Python安装包。生产`/opt/taiko-bot/current`没有因此获得ijson，不可将源码合入当作生产工具环境已切换。

| 文件 | SHA-256 |
| --- | --- |
| source_u1_readonly.py | `12becf8c7fb7a5ab1a218f18e9811c36044b7773f1403b8c1dc6ba89523f4fde` |
| source_u1_json.py | `40d735a7aa7288a463abe624c59eece6d33698dfad91ff03633394b0cd3dbdc7` |
| source_u1_requirements.txt | `9a9c4a10aee9b0af7d4c57bb0b6ff5164dca6b19aac046926e9d821b3f3396fc` |
| source_u1_dependencies.lock.json | `947d36ffca17ef25e7beae6a5a223e84d38a7309b2fad521d554b1500621361b` |

独立工具环境归档SHA-256：`7c3add7f63e04e9353fcce55675647d2051c3cc3cb95b4ec2e7ba09ca2d14994`。
依赖逐文件清单SHA-256：`f5ca6a6dbc055fe6249f06fe8d263d63f5416921e7542671efda65cb3fd07cc1`。

完整归档与逐文件清单只在私有QA证据中；锁文件给出每个发行包的版本、文件数和安装树SHA-256，不把安装树哈希冒充PyPI wheel哈希。适配器主文件hash绑定解析模块hash，执行前须核对整个已审查代码/依赖组合。未来真实U1应使用这套已验证的独立工具环境，不能在生产Python缺依赖时绕过检查。测试驱动和TLS模拟源也封存在私有证据中。

## 可单独批准的U1专用策略建议

**本PR只交付代码，不启用任何新准入策略。现行外层30%物理内存+3GiB、PSI full avg10<2继续有效。适配器内原25%检查也没有在本轮改写；真实执行必须经过既有外层控制器，不能直接调用CLI绕过30%规则。**

可供审批的具体策略是：仅限一次固定范围U1，保留30%主机余量，将额外预算改为512MiB任务硬上限+1GiB主机/控制器缓冲，即 `MemAvailable >= ceil(0.30 * MemTotal + 1.5GiB)`。现有QA父级2/3GiB、维护互斥、PSI<2、CPU/磁盘/超时/响应限制不变，U1全流程限制在256/512MiB临时子cgroup且不依赖swap；不更改通用QA、Annual或生产服务策略。

该建议具备最终功能回归及显著降低的实测占用证据，但仍包含没有内核峰值和真实网络开销测量的局限。因此建议审批人仅在**明确接受该测量局限及内存超限可能使本次U1失败**时批准一次限定试行，不批准全局常开规则。未获此项明确批准前继续原公式，不自动采纳较小预算、不重新获取上游、不重新签发执行票据。批准策略也不代替实际U1的明确启动指令、最新本案预检和独立新票据；W1仍须可信候选形成后另行授权。

这是一份待批准的具体执行策略，不声称已经证明峰值≤192MiB、已形成可信Source候选或关闭RC阻断。

## 私有证据索引

- 最终精确回归：`qa-cee466ee2b39/evidence`。
- 优化前同TLS基线：`qa-5f24376b486f/evidence`；预算拒绝和清理证据原样保留。
- 最终六类容量：`qa-e8dda3dd9e26/evidence`，包含逐用例结果、内存事件/采样、swap和清理。
- 独立环境及哈希：`qa-2fdfc5522b97/evidence`，含runtime归档、依赖逐文件清单和兼容验证结果。
- 早期运行及资源失败记录保留，不追认为最终代码验证。

本轮唯一完成项为U1解析优化交付；上游获取仍未执行，Source保持既有fail-closed，候选可信度NOT VERIFIED，W1未授权，RC仍BLOCKED。生产0.87.11、安全运行时、自启关闭、Source/Writer/manifest/verified、数据库权限与备份调度均未改变。
