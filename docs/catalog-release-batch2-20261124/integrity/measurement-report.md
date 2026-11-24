# Measurement Integrity Report

状态：只读调查、合成重现；未回填或修改真实Measurement/成绩/生产表。原始journal含账号标识，保存在0700证据目录，不进Git。对生产DB只在显式read-only事务中执行SELECT，结束rollback/close；没有运行自动建表/schema迁移或应用服务入口。

## 11次原始失败逐条核对

日志窗口：2026-11-22至2026-11-24；原审计11次全部属于同一组绑定A，发生于上海时间2026-11-22。`measurement-event-matrix.json`逐条记录时间、归档字段、existing measurement计数、可知/不可知revision；private ledger保留journal cursor、实际user/binding和查询结果。

| 原事件 | 上海时间 | 绑定 | writer当日行 / reader | 同日SQL现存 | scoreRevision / retry |
|---|---|---|---|---|---|
| 1 | 23:32:38.951992 | A | sampleCount0；Invalid daily ability point | 0 | 请求revision未记录；首次观察失败 |
| 2 | 23:32:44.137543 | A | 同一当日行 | 0 | 未记录；同绑定重复请求 |
| 3 | 23:32:48.043188 | A | 同上 | 0 | 同上 |
| 4 | 23:34:00.325038 | A | 同上 | 0 | 同上 |
| 5 | 23:34:08.106897 | A | 同上 | 0 | 同上 |
| 6 | 23:34:23.813445 | A | 同上 | 0 | 同上 |
| 7 | 23:34:25.901129 | A | 同上 | 0 | 同上 |
| 8 | 23:34:27.806206 | A | 同上 | 0 | 同上 |
| 9 | 23:37:53.790333 | A | 同上 | 0 | 同上 |
| 10 | 23:37:58.336924 | A | 同上 | 0 | 同上 |
| 11 | 23:38:04.290548 | A | 同上 | 0 | 同上 |

当日归档捕获于23:32:18.779256+08:00、计算于23:32:19.230243+08:00，origin=snapshot，rating与六维有限但sampleCount=0。本次只读SQL观察中A共有7条其他日期measurement、该日0条。关联的原始成绩历史文件仍存在并已hash留证。

额外发现：次日2026-11-23绑定B的23:06:20.228299、23:06:44.643312、23:39:01.820710三次同类失败。B当日归档同样sampleCount0，捕获于23:06:02.013238+08:00；本次SQL观察B无measurement。它们不算进原11次，合计14次日志、2个绑定/用户组。

## 根因与可复现链路

1. Python `runtime/player/center/daily_ability.py:store_measurement`只检rating/dimensions有限性，sample_count原样写入，允许0。`capture_snapshot_v1`按可计算results数量传入len(results)；原始成绩存在但没有匹配可计算chart时可以得到0。
2. Viewer `growth-history/daily-archive.ts:readDailyAbilityArchive`要求sampleCount为整数且>=1；否则抛`Invalid daily ability point`。这与日志、原始payload相符。
3. `account/growth.ts`先读当日archive，再决定是否SQL upsert。reader抛错后直接进入catch，**没有到upsert**；catch日志后Overview仍可继续返回。不是SQL INSERT报错，也不是DB唯一键冲突。
4. `measurement-contract-reproduction.json`使用实际writer函数及实际Viewer reader，在QA合成目录中重现writer接受0→reader拒绝0，并以sampleCount1作阳性对照；没有访问真实成绩或应用写入口。

0样本的更早成因尚未逐条证明：可能没有可匹配rating结果；不能从sampleCount0倒推出源成绩丢失。最明确的根因是已确认的写/读契约不一致与catch链阻止SQL后备。

## scoreRevision、重试与重复处理

`readCurrent`的revision为原始current字节SHA-256。失败logger只保留userId/bindingId/error，不包含snapshot.revision、modelRevision或requestId；不能恢复11个请求的精确revision。本批保留archive `bxx.source`、相关history哈希/时间、当前manifest/引用关联（private `measurement-source-association.json`）作为推断候选，**不把归档sourceRef冒充每次HTTP请求的已证实revision**。因此逐条精确revision确认仍是证据缺口。

这些是同一绑定在短时间内的重复请求，不等于11份独立记录丢失。源码没有在此catch后安排持久化自动retry；后续Overview请求再次经过同一坏行仍失败。不存在因为第2次被去重而丢失第1次的证据。

SQL `upsertGrowthMeasurement`使用INSERT IGNORE；表unique为(binding_id,score_revision,algorithm_version)，查询又以binding内同score_revision或过去同日existing记录阻止插入。它的重复保护在reader失败链中未执行。本批既不改去重规则，也不以放开跨算法插入来替代Weekly产品规则。

## Actual data loss / impact

确认：A/11次、B/3次的对应日期在本次SQL中没有measurement；0样本归档仍存在、原始成绩历史仍可读，未观察到分数被删除。不能证明失去了14个有效能力值：当前已知writer payload本身为0样本，且缺每请求的原始computed payload/revision。不能仅凭今天SQL为空证明过去某时刻也为空。此问题造成测量持久化/归档消费的覆盖缺口，而非已证实真实成绩丢失。

Overview catch可让页面继续显示；请求包含相关日期archive的History/Weekly/Passport消费可能被reader异常阻断，应在独立修复中建立空样本/未知/无测量的统一语义，保持历史原值、明确错误分类。不能先自动补一个0或套用今天模型回算。

## Locked product decisions / 未实施修复

Kinoko `2765-01-01`为手动导入标记，不列作待修数据异常；新增回归覆盖当前日期与2765日期都不生成play/growth事件。Weekly跨模型比较保留首尾与差值；候选只补了模型变化/版本未知说明，计算逻辑未禁用差值。是否回填、怎样处理0样本、怎样扩充日志的非敏感revision关联需独立批准；本批没有修改真实Measurement。
