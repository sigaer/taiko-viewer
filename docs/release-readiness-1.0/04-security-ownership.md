# 安全与身份边界审计

G2 = BLOCKED。审计停在源码证据，不执行真实ID探测或枚举。

## SEC-01 成绩读取入口缺少授权

Severity：P0；Status：BLOCKED。SOURCE：`8d70df2`，2026-10-10，E1；CONFIDENCE：源码HIGH，线上可利用性UNKNOWN。

调用链：

1. [developer/userdata路由](../../taiko_viewer/server/api/developer/userdata/[userid].get.ts)直接调用`getDeveloperUserdataByUserid`。
2. [account/developer.ts](../../taiko_viewer/server/utils/account/developer.ts)约287行只调用`enforceTaikoOpenQuota(event, "developer_userdata")`，检查userid非空，读取原始userdata并JSON.parse返回。
3. [taiko-open.ts](../../taiko_viewer/server/utils/taiko-open.ts)约166–195行：`requireDeveloperToken`默认false；无Authorization时返回null，走匿名IP配额。
4. [shared.ts](../../taiko_viewer/server/internal/account/shared.ts)约640、672行按传入ID解析文件路径并返回原始文本；该调用链未检查登录用户、binding owner、成绩token或目标用户公开同意。
5. 当前server middleware只有private-cache；它限制缓存，不提供授权。

Observed：当前实现允许匿名配额分支走到指定ID的完整成绩读取。Expected：读取私人完整成绩需要明确授权。Scope：有对应本地userdata且该应用路由可达的目标；实际网关拦截、线上路由开放、数据公开授权政策未核验。Risk：潜在跨账号成绩/个人profile暴露。**没有测试真实用户、没有确认发生泄漏。**

另一个输入问题：路径helper只做resolve，入口只校验非空。需在隔离环境检查ID白名单、路径边界和路由解码；本轮不提供公网探测，不把尚未验证的路径穿越另算已证实漏洞。

最小修复选项：先确定此入口应关闭、仅owner可读，还是采用明确用户委托授权；单独强制任意developer token仍不能证明该token有权读目标用户。负例须覆盖匿名、无效/撤销token、不同owner、删除/重绑、路径异常。Cost：合成账户/目录、真实guard与DB适配，memory runner；若写库须精确test DB及opt-in。Rollback：不能回退到匿名任意ID读取，必要时保持入口拒绝服务。Owner决定数据公开政策与紧急修复范围；本轮未修改。

## 其余边界

| 对象 | 已见保护 | 限制/待验 |
|---|---|---|
| Session | auth.ts检查有效期、HttpOnly、SameSite=lax、secure配置 | 生产代理信任/CSRF与跨域写负例未测；不凭cookie属性宣称完整防护 |
| Passport/measurement | 路由requireAccountUser、private/no-store；start/end binding检查；SQL owner/binding join | 当前SQL/晚到请求完整负例未执行；共享日存档身份合同需复核 |
| Goal | owner/binding/goal行锁、事务，生命周期清理 | 当前全流程并发/删除负例未执行 |
| Recent | authenticated ack入口及private/no-store | CAS、多设备和切换负例需继承检查后重验 |
| UGC | security.ts按账号/IP限流，桶有界，注明单实例 | chart关联/隐藏删除/管理员权限需全链负例；不能用于多实例保证 |
| 年度 | access.ts按账号及policy；security.ts签名、hash与render token时效 | share撤销、owner/job/下载全链及实际policy未知 |
| Developer token | 存在hash查找、撤销和touch逻辑 | 不能证明所有入口调用；SEC-01就是漏接授权的独立链 |

SEC-02：severity UNKNOWN，status UNKNOWN。认证GET会更新session.last_seen_at，部分ensureSchema可能触发初始化；Passport Overview可能写measurement。后续线上检查必须按真实副作用单独授权，不能包装成纯只读。日志中源码可见userId/bindingId字段，保留/访问控制未知，不导出原日志。
