# D — Integrity Investigator（只读）

依据用户提供的 2026-11-23 Intelligence Foundation Audit、主代理源码检查及 `qa-61d85e2b5349` 原始文件复核。Native D 完成因果审查；因子代理没有可用工具，实际读取由主代理执行。未调用有恢复／重建副作用的 Publication API，未调用 Growth HTTP，未连接数据库，未修改数据。

| 问题 | 根因与证据 | 风险 | 建议与未证实部分 |
|---|---|---|---|
| Weekly 跨版本差值 | `growth-weekly/composer.ts` 标记 incompatible 后仍做首尾减法；`weekly/Change.vue` 展示差值，未解释 mismatch。Passport 已按版本分段。 | 高：可把模型变化解释为玩家成长 | 下一批禁止不兼容差值或明确不可比；保留跨版本负例。本批仅调查，未改 UI/逻辑。 |
| Publication 校验 | 稳定 manifest 声明 428002 bytes，对象实际 428028，hash 不匹配。异常对象与兼容投影同 inode、链接数 2。Publication `_install` 的 hardlink 投影让原地写入可污染内容寻址对象。 | 高：对象完整性受破坏 | 后续隔离 inode、审计所有写入路径，保留原始证据。共享 inode 已确认，实际写入者与具体写入时间未知；不能直接声称 hardlink 创建操作造成了那 26 bytes 差异。 |
| Measurement persistence | 扫描 1098 个归档、23930 个点，12 个 sampleCount 不合法，未发现非法 rating/dimensions。Python writer 没有正整数样本数门槛；Viewer daily archive reader 要求正整数及完整维度。读取异常阻止后续 upsert，而 Overview 可继续返回。 | 高：测量缺失、成长记录不完整 | 统一写入／读取契约和错误分类。12 个点尚未逐条对应历史 11 次日志错误，不能认定全部为同一原因或全部为 0。 |
| 异常日期 | `2765-01-01` 与 capturedAt 同日，origin=`historical-snapshot`，computedAt=`2026-10-11T10:22:54.042398+08:00`；合法 sampleCount=1329。当前仅检查格式及日期内部一致性。 | 中：排序、窗口与归档污染 | 追踪历史快照时间源和转换，增加合理未来时间边界；具体转换错误及写入者未确认。 |
| Core 版本 | 生产 Bot0.26.3/Application0.9.2/Core0.1.1；vendored Core0.1.2。center/client 分别 pin0.1.1/0.1.2。 | 高：源码通过不能代表生产算法兼容 | 保留版本边界，为 center 制作明确版本的补丁制品并验证；不能无审查切换到 client Core。 |
| Viewer 制品来源 | 生产版本1.19.7、Node24.22.1可确认；缺少独立 Git SHA/构建输入清单。 | 中：难以证明生产与源码逐字一致 | 后续建立不可变构建清单与 dependency/hash 证据；版本号一致不是 commit 证明。 |

以上三个数据异常分别调查，不合并为同一根因。报告不含账号标识、真实成绩或密钥。没有数据修复、回填或部署。
