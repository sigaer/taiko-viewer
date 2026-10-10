# Sakura Taiko Domain Extraction Program

## Goal

将 Sakura_bot 中的太鼓领域能力逐步抽离，形成独立 Taiko Domain。

目标：

-   Sakura_bot 不再包含太鼓领域实现；
-   taiko-bot 不再复制太鼓逻辑；
-   Viewer 不直接依赖底层太鼓数据格式；
-   三个项目共享统一 Contract。

最终架构：

                    Sakura Taiko Domain

            +-------------+-------------+
            |             |             |
       Sakura_bot    taiko-bot      Viewer

       Adapter       Client        Product Layer

------------------------------------------------------------------------

# Phase 0 --- Taiko Domain Extraction Audit

目标：

确认当前真实状态，不假设职责。

审计：

-   Sakura_bot
-   taiko-bot
-   Viewer

输出：

-   Repository Inventory
-   Responsibility Matrix
-   Data Flow Map
-   Duplicate Logic Report
-   API Boundary Audit
-   Risk Map

本阶段：

-   不改代码
-   不迁移
-   不部署

------------------------------------------------------------------------

# Phase 1 --- Contract Layer

建立统一协议：

## User Contract

统一：

-   user
-   binding
-   external identity

## Score Contract

统一：

-   chart
-   score
-   good
-   ok
-   ng
-   combo
-   clear
-   full combo
-   dondaful combo
-   rank
-   source

## Chart Contract

统一：

-   song
-   difficulty
-   level
-   metadata

## Growth Contract

统一：

    Score
     ↓
    Observation
     ↓
    Canonical Fact
     ↓
    Growth Projection

------------------------------------------------------------------------

# Phase 2 --- Taiko Core v0.1

建立：

    sakura-taiko-core

迁移：

-   score model
-   chart model
-   parser
-   rating
-   six dimensions
-   recommendation base logic

不包含：

-   QQ/Bot command
-   token
-   SQL
-   filesystem
-   UI

要求：

旧实现与新实现 Golden Test 一致。

------------------------------------------------------------------------

# Phase 3 --- Sakura_bot Adapter Migration

目标：

Sakura_bot 只保留：

-   Bot Framework
-   Command
-   Permission
-   Message Adapter

太鼓能力通过：

    Taiko Core Adapter

调用。

删除：

-   rating implementation
-   score parser
-   chart logic
-   difficulty logic

------------------------------------------------------------------------

# Phase 4 --- taiko-bot Alignment

目标：

taiko-bot 从：

    复制太鼓逻辑

变为：

    Taiko Core Client

避免：

-   两套 Rating
-   两套六维
-   两套成绩模型

------------------------------------------------------------------------

# Phase 5 --- Viewer Boundary

Viewer 不再直接理解：

-   userdata JSON
-   snapshot 文件
-   底层成绩格式

改为：

    Viewer
     |
    Contract/API
     |
    Taiko Domain

Viewer 保留：

-   Goal
-   Growth Narrative
-   Passport
-   Weekly
-   Community UX

------------------------------------------------------------------------

# Phase 6 --- Storage / Writer Consolidation

最后处理：

-   Writer ownership
-   P1a
-   Read Model
-   Database Canonical

原则：

先确定：

    谁定义数据

再决定：

    数据存在哪里

------------------------------------------------------------------------

# Version Roadmap

    0.82.x
    Taiko Domain Audit Complete

    0.83.x
    Contract Layer Freeze

    0.85.x
    Taiko Core v0.1

    0.88.x
    Sakura_bot Adapter Migration

    0.90.x
    taiko-bot Alignment

    0.95.x
    Platform Release Candidate

    1.0.0
    Sakura Taiko Platform
    My Taiko, in one place.

------------------------------------------------------------------------

# Completion Standard

最终目标：

一个用户身份； 一个成绩标准； 一个历史标准； 一个开发接口标准；
多个客户端。
