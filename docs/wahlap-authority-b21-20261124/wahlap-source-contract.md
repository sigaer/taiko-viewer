# Wahlap Song API Source Contract

本文件记录 2026-11-24 实际只读请求的观察结果；没有把未提供的字段补成官方能力。完整原始响应私有保存，公开报告不包含 Cookie 或账号信息。

| 项目 | 实际观察 / 候选约束 |
|---|---|
| Endpoint | `POST https://wl-taiko.wahlap.net/api/user/all/songs` |
| HTTP / envelope | HTTP **201**；`status: 0`、`message`、`requestId`、`data: {list,total}` |
| 请求 | `page` 从 1 开始，`pageSize`，`sort: 1`；不传 userid；认证通过现有私有会话提供 |
| 个性化字段 | `isPlayed` true / false / 省略的首 20 条结果相同；不能据此证明所有账号完全相同。Builder 的标准请求省略它，并从公共投影和语义 sourceRevision 中删除响应的 isPlayed |
| 完整分页 | pageSize=500：500 + 500 + 323 + 0（终止页）；total=**1323** 统计分类行，不是唯一歌曲数 |
| 完整性交叉检查 | pageSize=3000 单页的 list 与以上分页串接结果逐条相同 |
| 唯一身份 | **1128** 个 ID；195 个重复分类行；重复 ID 的日文名及 level_1…5 一致，分类、排序、open_day 可不同 |
| 字段并集 | family、id、isPlayed、level_1…5、open_day、song_name、song_name_jp、sort、subtitle、tag、type |
| 更新语义 | 未发现可靠的 server catalog revision / updatedAt。open_day 是分类上下文中的内容日期，不能当抓取时间；响应 Date 观察到与本机约 40 秒偏差；ETag 随 requestId 变化，不作 Catalog Revision |
| 请求限制 | 官方响应未声明速率额度。有限审计约 0.5 Hz 未见 429，不能解释为额度承诺。候选抓取默认间隔 2 秒，连接/读取超时 10/35 秒，最多 42 页，每页最多 2 MB，失败即停止 |

国行**歌曲当前列入目录**只接受这一个官方来源。level_N 正整数作为官方提供的“该难度有提供”的操作性元数据，结合歌曲列入目录形成 `cn_current_playable`。API 没有独立 chart release、机台物理可玩、授权/解锁或地区门店状态字段；不得把该操作性策略称作这些状态的证明。

`NOT_IN_CURRENT_CATALOG` 只有完整校验成功的官方目录才能产生；它不证明曾经下架，也不证明歌曲从未上架。raw、merged、rating、scoreline、ESE、OurTaiko 都不能覆写这个结果。

完整性校验拒绝：缺失页、顺序错误、变化的 total、总行数不符、缺少空终止页、非成功 HTTP/业务状态、非法 ID/难度、重复 ID 关键字段冲突。sourceRevision 是去除 isPlayed 后、按收到顺序序列化的语义负载 SHA-256；不是官方签发的版本。精确响应 SHA/size、查询和 fetch time 另列在 Source Manifest。

分页 API 没有观察到事务游标，校验不能数学证明请求期间服务器没有同数量替换记录。此次单页交叉检查增强当前证据；长期运营仍需监测总量、重复冲突和异常变化。实现没有擅自发明下架阈值，也没有退回其他曲库。

失败或不完整抓取仅更新 `fetch-status.json` 为 stale / complete=false，保留 last-known-good active pointer。没有有效历史 Snapshot 时，当前 CN 功能返回 unavailable；历史成绩保留原 ID。不得通过“空列表”清空官方目录。

实现：[Fetcher 与 validator](../../../bot/taiko_bot/catalog/wahlap.py)、[私有来源归档](../../../bot/taiko_bot/catalog/provenance.py)。冻结响应的精确字节与凭证分开保存；公开 Snapshot 不含个人 isPlayed，公开 Source Manifest 不含认证头。
