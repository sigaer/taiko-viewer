# Phase 4 — taiko-bot Alignment

验收结论：**Gate 4 PASS**。客户端 `d50134332a7e4a5247db9063fdc12b5e950e987c` / 0.2.0 已推送；Core tag `v0.1.2` 已推送。证据见 [phase4-validation.json](evidence/phase4-validation.json)。

## 4.1 差异与宿主审计

客户端 baseline `46c8646847f8d642b53043b6123d8763e26c0a16`。原有 `web.conf` / `v1_test_report.md` 用户工作保留，未纳入此次变更；当前没有运行中的 taiko-bot 业务进程。
继续使用中心代理和本地读取缓存；不变更 userdata/history writer，也不变更 Viewer API/manifest/asset 协议。

## 4.2 Core 客户端策略

Core `0b7319d94b041daafb0a0d32e3ccc95e50da8810` / tag `v0.1.2` 已 push；contract `0.1.0` / schema `1.0`。
独立安装包 29/29 tests PASS，52 runtime Python modules 全部符合无 filesystem/SQL/framework/HTTP 的依赖边界。
保留所有此前中心 Golden，另冻结构/输入差异的 86 组客户端案例；不默认切换中心线上 Core 0.1.1。

差异通过显式值/profile 收敛：Hiroba 无 region/crowns 的客户端结构、公开可见范围、v1 pair identity、v2/target title identity、13 字段 SongStats、宽松 CSV、star progress、position 和 scoreline 来源/解析。
v1/v2 算术、六维、推荐评分和连打规则引用同一 Core。宿主提供 cache/catalog/grade names 和逐条 capture timestamps。

## 4.3 客户端委托

14 模块，188 个符号及规则表委托；Python 最低版本 3.11，客户端版本 0.2.0。
已通过 43 原有回归 + 5 宿主边界回归；安装后的客户端 wheel 验证 14 模块源码一致，真实 NoneBot command import PASS。
命令源码 SHA-256 `25014419bda9da3a47754b114d556590f11d6a5bc0e21f2be739c7bfba6645b1` 与 baseline 相同。
新增宿主测试保护版本 pin、空推荐的按需读取、star 数据集隔离、null/zero 区分及宿主时钟。

## 4.4 安装、推送与 Gate

固定 Git revision 安装 PASS：Contract `23f89b4`，Core `0b7319d`，实际 VCS commit 与请求 pin 完全一致，52 Core 源模块与安装包一致。规则表收敛后 48/48 客户端回归 PASS；最终 wheel 14 模块及真实命令 import PASS，commit 后源码与该 wheel 再核对一致。

客户端 0.2.0 wheel SHA-256 `2a29f8d3fc51aacbcb45f82c11f52b82df13eb1718d3945e6572c9c3429ba90a`；Core 0.1.2 wheel `f34c1d0a3e58f5a7ce232ca50741e3235260eb8dabaedd95b41d84e7d0d0d47f`。构建/缓存/runtime 数据不包含在 wheel/release Git 变更中。

本机没有在运行的客户端，因此不虚构客户端线上 adapter 连接验收；真实 installed command/module 加载、既有命令回归及固定源安装完成此次客户端发布 Gate。中心已在 Phase 3 完成线上切换，当前依赖仍保持 0.1.1。
私有 Core/Contract 源安装要求授权 SSH 读取权限；没有权限的消费者需要维护者提供固定 wheel，未改变仓库可见性。
所有 QA 经 memory runner，合成输入和 isolated storage，禁止真实 HTTP/生产个人数据读取/生产 mutation；临时目录清理。

## 回退

恢复客户端 baseline 及原依赖环境；0.2.0 重装固定 Core 0.1.2 / Contract 0.1.0 wheel。没有 schema/DB/线上 userdata 迁移。
中心依赖和 Viewer 线上运行版本不随本阶段变化；恢复客户端时不改动中心运行环境。
