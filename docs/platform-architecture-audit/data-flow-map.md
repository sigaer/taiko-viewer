# 当前真实数据流

实线表示源码可追踪调用；R 的位置由 Viewer 进程环境和 service cwd 支持。**未执行线上业务调用，所以网络可达性、远端部署版本和实际数据内容不在本图的验证结论内。**

## 成绩、写入与消费

```mermaid
flowchart TD
  Arcade[街机游玩] -. 上游原始生产过程未审计 .-> Wahlap[Wahlap 鼓众 API]
  Arcade -. 上游原始生产过程未审计 .-> Hiroba[Hiroba 页面及服务]
  CMD[Sakura Taiko 聊天命令] --> Pull[Python getUserData / Hiroba sync]
  Wahlap --> Pull
  Hiroba --> Pull
  Pull --> PW[Python save_userdata]
  PW --> C[中心 userdata current JSON]
  PW --> H[中心 full / delta snapshots]
  PW --> DA[持久 daily ability v1 / v2]
  Browser[登录后的 Viewer 用户] --> VA[Viewer account API]
  VA --> Edit[编辑 / 手动账号 / Kinoko 导入]
  Edit --> TW[TS Writer 与历史导入]
  TW --> C
  TW --> H
  VA --> Dispatch[127.0.0.1:3102 dispatch]
  Dispatch --> Pull
  C --> Dispatch
  Dispatch --> DW[local target 再写 snapshot]
  DW --> C
  DW --> H
  C --> VP[Viewer JSON 读取及 Python bridge]
  H --> VP
  C --> Open[developer userdata / taiko proxy API]
  H --> Open
  B[taiko-bot 命令] --> Open
  Open --> Cache[B 本地 userdata / history cache]
  Cache --> BCalc[B 自己的 Rating / 六维 / 推荐 / B30]
  B --> Proxy[Viewer 中心同步与绑定代理]
  Proxy --> Dispatch
  Proxy --> Pull
  VP --> Web[Web 产品展示]
```

本图 `Dispatch → Pull` 仅对应 R 的当前磁盘实现；A 源码 dispatch 尚无该调用。`proxyTaikoCenterHirobaSync` 直接在 R 启动 Python，不经过 Wahlap dispatch。手动账户走受 bot service token 保护的 internal API，和一般 taiko proxy 是不同信任边界。[E05](evidence-index.md#e05)、[E06](evidence-index.md#e06)、[E11](evidence-index.md#e11)、[E31](evidence-index.md#e31)

## Growth 事实、测量与缓存

```mermaid
flowchart LR
  Current[current JSON] --> Snapshot[readGoalSnapshot + revision]
  History[full / delta H] --> Evidence[来源识别与顺序回放]
  Evidence --> Daily[dailyProgress]
  Snapshot --> Daily
  Daily --> Facts[请求期 score facts]
  GoalDB[(Goal / evaluation DB)] --> GoalFacts[Goal completion facts]
  Current --> Py[Python growth_compute]
  Model[v1 model + chart metadata] --> Py
  Py --> State[Viewer Growth state / 今日计划]
  State --> Measure[(web_growth_measurements 条件写入)]
  DailyArchive[daily ability archive] --> Merge[按日合并与优先规则]
  Measure --> Merge
  Merge --> Passport[Passport / Weekly]
  Facts --> Passport
  GoalFacts --> Passport
  Evidence --> Recent[Recent Growth + DB cursor]
```

snapshot 是“观察到的状态”；measurement 是“当时的模型测量”；fact 是“依据证据推导的变化”。没有从原始街机完整 play log 到平台的已证实链。`GET growth/overview` 也可能保存 measurement；HTTP GET 不能自动当作只读探针。[E17](evidence-index.md#e17)、[E19](evidence-index.md#e19)、[E20](evidence-index.md#e20)

## 曲库、谱面和 v2 反向依赖

```mermaid
flowchart LR
  Official[Wahlap 公共曲库等上游] --> Job[Sakura song_update_task]
  TJA[ESE / 本地 TJA] --> Parse[tjaAnalyzer / roll parser / merge_index]
  Parse --> Job
  Job --> Songs[R songs JSON / 派生统计]
  Songs --> Content[Viewer content 与 public data API]
  Content --> BFiles[B songs / assets 缓存]
  Songs --> CorePy[R Python v1 计算]
  UpV2[配置的 v2 上游] --> V2[Viewer v2Constants]
  Supplement[console supplement + catalog] --> V2
  V2 --> CSV[Viewer constants_id_v2 导出]
  CSV --> RP[R taikob_v2_data + CSV fallback]
  CSV --> BP[B CSV 缓存与 v2 计算]
  ContentDB[内容 DB / Java guide API] --> Content
```

v2 上游 URL 默认 `https://cdn.ourtaiko.org/api/gugu_constants`，这是源码默认值，不宣称已确认运行时 override。Viewer 定数服务缓存 TTL 为 1h、最大 stale 7d；导出失败可退回中心本地 CSV。中心 Python 又通过 Viewer 读取 v2 数据，形成发布/可用性耦合。[E08](evidence-index.md#e08)、[E23](evidence-index.md#e23)、[E32](evidence-index.md#e32)

## import / 调用边界

```mermaid
flowchart TD
  BotEntry[A taiko/bot.py] --> Shared[A feature_handler_bootstrap]
  BotEntry --> Plugin[A plugins/taiko.py]
  Plugin --> Utils[A utils 计算 / 存储 / 网络 / 图片]
  Utils --> Mem[A taiko_runtime/memory]
  Mem --> RootMem[A 根级 runtime_memory]
  Viewer[Viewer personal / charts] --> Subprocess[Python 子进程 cwd=R]
  Subprocess --> RUtils[R recommendation_intelligence / utils]
  Subprocess --> GC[R growth_compute 动态源码加载]
  GC --> RScore[R score_calculator]
  BEntry[B plugins/taiko.py] --> Client[B viewer_client]
  BEntry --> BUtils[B 自己的 utils 副本]
  Upload[A miku upload service] --> Cookie[R config cookie 写入]
```

[imports.csv](evidence/imports.csv) 收录静态 import，**不等价于完整动态调用图**；Python 包初始化、Nuxt 自动导入、字符串嵌入 Python、动态 importlib 已用上述关键链补充。没有证据证明存在独立 taiko-core 或统一 Taiko Service。
