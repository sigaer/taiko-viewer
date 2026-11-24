# Publication Integrity follow-up

只读原始文件调查。未调用 PublicationStore、shared lock、恢复入口或生产 HTTP；这些入口可能触发 recovery。私有 manifest、object、projection 字节及字段差异分别留存，未覆盖原始证据。

2026-11-24 04:09:53 UTC 复核与 Batch 2 一致：[逐项机器证据](integrity/publication-followup.json)，QA `qa-05992b52e3fe`。

| 项目 | Manifest / 实际 |
|---|---|
| Manifest SHA-256 | 20654bf3eb1b3b8a593142d713add63d0b64af3ae4869eedecccc7a8a92572dc |
| 对象声明 hash | 66b61224c72bee75a583d83febfc618319897ac6f088b1457952e795b12544c7 |
| 实际 hash | d186ad57ea8f36b20ac6106d58880b00dba63018384554bdca605fdfbf45feb2 |
| 声明 / 实际 size | 428002 / 428028 bytes，差 26 bytes |
| Object 与 projection | dev 65025、inode 5877662、nlink=2；同一个真实 inode，非两个独立内容副本 |
| mtime / ctime | 均为 1792230769908000000 ns；复读 stat/hash 稳定；不能据此归因写入者或准确损坏时刻 |
| 历史引用 | generation 2 引用同一坏对象；generation 1 的另一对象 hash/size 有效，size 428001 |
| pending | 未发现 pending.json |

复用 Batch 2 已完成的全量证据：916 个 current 引用中 915 有效、1 异常；两代历史 751 个对象、1499 个引用中 1 个坏引用。本批没有为增加测试数量再次扫描全部对象。

两代 JSON 比较有 3 个值差异、1 个字段成员差异，字段涉及 `_meta.ts`、`_meta.synced_at`、另一 `_meta` 值及 `dojo.version`。安全字段摘要见 [差异摘要](integrity/publication-field-difference-summary.json)。**这是两个不同已提交 generation 的比较，不是当前对象受损前后原字节对。** 不能据此断言差 26 bytes 是哪段修改，不能证明哪个 writer 执行过。

Bounded `/proc` 调查读取 379 个 PID 目录，观察时没有进程打开这个 inode；机器未保留 `/var/log/audit/audit.log`。这只能说明观察时没有可见打开描述符，不能追溯过去的写入进程。历史 writer 继续为 **UNKNOWN**。

源码证据表明正常 store 创建内容寻址对象，校验后用 hardlink 安装兼容 projection。后续对 projection 原 inode 的原地写入有能力污染对象；这是机制风险，不是对本次 writer 的归因。Batch 2 的 writer inventory 和已安装文件 parity 仍保留，当前代码一致不证明历史事故时运行的是同一制品。

Python read_object 与 Viewer rawObject 按实际 size/hash 拒绝该引用；旧直接文件 reader 可能仍接受 projection JSON，故存在消费者表现不一致。shared/exclusive store 入口可能检查 pending 并恢复 projection；无 pending 时不会因 hash 不符自动重建原对象，恢复过程也不能凭空还原正确字节。本批没有触发该行为。

影响范围仍为此前只读查询确认的 **1 个当前绑定账号**；历史访问人数和已失败请求数未知。本批未做生产请求或新用户访问实验，不宣称观察到了某个 HTTP 状态或 SLA 数量。坏引用对应的当前 Publication 读取依代码会被完整性门槛拒绝；历史请求须按具体引用判断。

后续独立修复需保留坏对象及 manifest 链，审查所有 legacy 原地写入口，评估独立 inode projection 和备份恢复。不能重新 hash 坏内容后改 manifest 将污染合法化，也不能直接用 generation 1 覆盖 generation 2。恢复方案及真实数据操作仍需单独审批；本批不执行。
