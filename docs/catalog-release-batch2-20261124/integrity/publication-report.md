# Publication Integrity Report

状态：只读取证；没有覆盖对象、重建Publication、调用恢复入口或修改业务数据。原始证据保存在 `/var/tmp/taiko-batch2-20261124/evidence/integrity-private/`（0700，不进Git）；公开报告只含去标识结论。初次QA `qa-33b57dd8344f`；历史补充调查见 `publication-historical-summary.json` 对应QA。

## 已确认事实

对916个已提交Publication的current引用逐一计算实际SHA-256，而非只查长度；发现1个异常，其余915个当前引用在本次读取中hash/size符合。没有据此宣称系统内所有历史对象均有效。逐个读取的manifest/object稳定性已记录，不声称获得跨全部账号的全局一致快照。

| 项目 | Manifest声明 / 实际观察 |
|---|---|
| 当前manifest hash | `20654bf3eb1b3b8a593142d713add63d0b64af3ae4869eedecccc7a8a92572dc` |
| 声明对象hash | `66b61224c72bee75a583d83febfc618319897ac6f088b1457952e795b12544c7` |
| 实际对象hash | `d186ad57ea8f36b20ac6106d58880b00dba63018384554bdca605fdfbf45feb2` |
| 声明 / 实际长度 | 428002 / 428028 bytes，差26 bytes |
| 对象 / projection | dev65025、inode5877662，两者完全相同，link count2 |
| 稳定性 | manifest原字节复读相同；对象hash前后stat相同 |
| 当前sequence / pending | sequence2；未发现pending.json |

对象、projection和committed原字节都单独复制留证；不是只保存解析后的JSON。mtime/ctime记录在 `publication-summary.json`，但ctime可以由链接/元数据变动产生，不能据此归因具体写入时刻或进程。两代历史manifest及其引用/对象hash/size检查见私有 `publication-historical-objects.json` 与公开汇总；generation1与generation2是独立版本，不将新坏对象直接替换成旧版本。

## Writer provenance

Bot `taiko_store/publication.py:_put_stream`按原始字节计算hash后创建内容寻址对象；`read_object`验证size/hash。`_install`在校验后使用`os.link`创建兼容projection，再原子替换projection路径。因此投影与对象共享inode是代码设计及本次stat共同确认的事实。任何后续对projection原inode的原地截断/改写，都可以改变内容寻址对象。

当前安装Bot0.26.3的6个关键Python writer/reader文件与候选源码逐文件SHA比对见`python-writer-installed-parity.json`；这证明当前代码对应关系，不证明历史损坏时刻运行的是同一制品。

`writer-provenance-inventory.json`列出候选源码中与userdata/Publication相关的文件写入位置；重点链路包括center `userdata_storage.py`、`taiko_store/bridge.py`、同步dispatch、手工编辑/导入和历史维护工具。正常store写入应stage新对象并原子替换投影；仅看到`json.dump`或`writeFile`并不证明它写过这个inode。**目前缺少当时write syscall审计、进程身份或可靠的旧新原字节配对，不能确定是哪一个writer造成这26 bytes变化。** 不将hardlink创建本身等同于已发生的内容破坏操作。

## Reader / Automatic recovery

Python `PublicationStore.read_object`先验证长度再hash；Viewer `server/infrastructure/taiko-publication/reader.ts:rawObject`也验证实际长度和hash，失败为PublicationUnavailable。`projection-integrity.ts`在同inode时采用元数据捷径，但`rawObject`仍验原字节；不能用“同inode”证明内容符合名称。旧直接file reader能读projection字节，可能表现为“旧路径看起来正常、新Publication路径拒绝”，构成消费者语义分裂。

`PublicationStore._lock`的shared入口遇pending会升级恢复锁；exclusive入口也调用`_recover`。`_recover`依据已提交代恢复projection，不会从受损对象重构原内容，`_install`又要校验该对象。无pending时不会因current hash不符自动重建。故本次只读原始文件，不调用shared/reader/API来“看看会不会恢复”。

## Public impact / 范围

已证实一个source的current对象完整性失败。凡读此source当前Publication的路径会被长度/hash门槛拒绝；历史请求是否受影响取决于其引用是否指向坏对象，历史补充清单逐引用列出。绑定影响采用只读数据库查询，当前绑定账号数见 `publication-historical-summary.json`；这个时点的绑定数不代表全部过去访问人数。没有执行生产HTTP请求、自动恢复、对象替换或真实用户交互，不能给出已发生失败请求数或SLA影响。

## 后续修复提案，未实施

单独变更应消除可写projection与内容寻址对象共享inode的风险，并审计所有legacy写入口；原子复制/独立inode仅是候选方案，需验证读一致性、空间和恢复协议。先保留坏对象及完整manifest链，再从已验证备份/历史版本寻找正确原字节；恢复哪一代、如何保留审计链必须单独审阅。禁止以重新hash坏对象并改manifest的方式把污染合法化，也不静默重生成Publication。
