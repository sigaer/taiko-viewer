# Updated Roadmap / Unresolved Risks and Release Gates

## 本批已完成的基础

可追溯Center Core RC与实际安装验证；来源/依赖清单；Catalog源与身份/区域/发布语义审计；统一Authority+快照+中央policy目标契约及逐消费者迁移计划；Publication只读取证；原11次Measurement逐条关联、额外3次与合成重现；3003份TJA时间线扫描与Golden；7个领域知识主题。候选Weekly仅新增模型变化说明，跨版本差值保持；Kinoko2765仅作为导入标记回归保护。

## 发布Gate

| Gate | 当前状态 / 精确退出条件 |
|---|---|
| Core来源、实际wheel安装 | PASS_SCOPED：源码commit、两次byte-identical构建、hash与-I import路径验证；不能推广为已部署 |
| Center/Application/Bot候选依赖 | PASS_SCOPED：基础pip check、Center extra真实resolver及12+76；未在线启动真实Bot |
| Client / 全系统兼容 | BLOCKED：27桥接18通过/Client9失败；需要Client能力与Center策略兼容的独立设计/制品，不准直接切换pin |
| 全仓Core历史golden迁移 | OPEN：额外23方法中的3方法/128旧契约断言失败，必须审查并迁移旧空集/缺状态fixture语义；不能删除测试掩盖 |
| Viewer基础回归/候选构建 | PASS_SCOPED：310（原309+Kinoko回归），Weekly双语言SSR及320/390/1440布局；只本地build |
| Publication integrity | OPEN：1个current损坏、writer进程与26bytes原因未证实；修复需单独审批与inode/恢复协议验证 |
| Measurement integrity | INVESTIGATED_WITH_GAPS：11+3次链路确认；精确请求scoreRevision未被日志记录，不能伪造；0样本统一契约与任何回填需另审 |
| Catalog Authority | DESIGN_READY / NOT_ACTIVATED：来源需共同manifest、身份冲突/7难度差异/缺资源逐项决策，批准schema/policy后才做Builder与消费者迁移 |
| Canonical timeline | BASELINE_READY_SCOPED：3003扫描完成；1171 partial、音频绝对对齐、动态LEVELHOLD及长音符重叠仍未验证 |
| Domain Knowledge | PRIMER_READY：官方/项目/经验/假设已分级；真实曲例待专家复核，不等于Agent知识能力验收 |
| 生产在线 / 全系统Release | NOT_REQUESTED / NOT_RUN：本批禁止发布部署/生产写入，不能宣称Release-ready PASS |

## 后续顺序与批准边界

R1：审阅本批RC与兼容矩阵；决定单一Core如何保留Center/Client各自profile，迁移Core旧golden，补全27桥接。无批准不切生产pin、不发包。

R2：批准Publication修复设计，先定位/约束所有legacy写入口，验证独立inode、并发reader、pending恢复与回滚；保留旧损坏证据。数据恢复另批、逐source审批，不能用代码发布顺带重建。

R3：明确0样本Measurement状态、writer/reader统一schema、reader异常后的行为、去重和非敏感revision日志；用合成正/负例证明。精确历史请求revision缺失列为不可恢复证据，不承诺自动回填；任何真实补测量须独立审批。

R4：按Catalog迁移矩阵M0–M6，批准中央policy与schema，建立Builder/immutable snapshot的原型与diff账本，证明原子激活、混版本拒绝、缓存失效/rollback；一次迁移一组消费者并删除其旧规则。源JSON相同不构成迁移完成。

R5：扩Golden与专家标注，先把PARTIAL诊断按根因拆解；音频绝对对齐、动态分支/LEVELHOLD分别专项验证。其后才考虑Chart Intelligence；新推荐算法和Taiko Agent是独立项目，当前无实现授权。

保留原候选分支、本批独立worktree、失败与成功日志、私有原始证据及最终SHA清单等待验收。未merge main、未push、未发布Release、未部署、未改真实成绩/生产DB/Publication对象、未回填Measurement。
