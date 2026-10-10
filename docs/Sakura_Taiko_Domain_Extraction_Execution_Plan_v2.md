# Sakura Taiko Domain Extraction Execution Plan v2

# RFC / Migration Playbook

## Document Purpose

本文件不是路线图，而是执行级迁移方案。

目标：

将当前分散在：

-   Sakura_bot
-   taiko-bot
-   taiko_viewer

中的太鼓领域逻辑逐步收敛为独立 Taiko Domain。

最终：

                    Sakura Taiko Domain

            +-------------+-------------+
            |             |             |
       Sakura_bot     taiko-bot      Viewer

       Adapter        Client       Product Layer

原则：

-   不一次性重写；
-   不直接移动文件；
-   不改变生产数据语义；
-   每阶段必须有可验证产物；
-   每阶段完成后旧系统仍可回滚。

------------------------------------------------------------------------

# 0. Overall Migration Principles

## 0.1 目标不是复制仓库

禁止：

    Sakura_bot taiko
            |
            copy
            |
    taiko-core

否则会形成第三套实现。

正确：

    Existing implementation
            |
            v
    Domain extraction
            |
            v
    Single source implementation

------------------------------------------------------------------------

## 0.2 三类代码必须分离

## Domain

属于太鼓知识：

-   Score
-   Chart
-   Rating
-   Dimension
-   Parser
-   Recommendation logic

## Adapter

属于应用：

-   Bot command
-   HTTP handler
-   QQ message
-   Web route

## Infrastructure

属于平台：

-   Storage
-   Database
-   Token
-   Authentication
-   Queue

------------------------------------------------------------------------

# Phase 0 --- Extraction Audit

## Goal

建立真实现状模型。

禁止：

-   修改代码
-   移动文件
-   新增 package

## Deliverables

必须产生：

    docs/taiko-domain-current-state-audit.md

------------------------------------------------------------------------

## 0.1 Repository Inventory

审计：

-   Sakura_bot
-   taiko-bot
-   Viewer

记录：

  项目           内容
  -------------- ------
  runtime        
  language       
  entry point    
  dependencies   
  storage        
  API            

------------------------------------------------------------------------

## 0.2 Module Classification

每个太鼓相关文件分类：

  类别             说明       未来
  ---------------- ---------- --------------
  Domain           太鼓业务   Taiko Domain
  Adapter          应用接口   原仓库
  Infrastructure   平台能力   重新设计
  Presentation     展示       客户端

不得存在 unknown。

------------------------------------------------------------------------

## 0.3 Duplicate Logic Report

重点：

-   Rating
-   六维
-   Score model
-   Chart parser
-   Recommendation

输出：

    duplicate-logic-report.md

------------------------------------------------------------------------

## 0.4 Data Flow Map

必须回答：

谁写：

-   score
-   history
-   userdata

谁读：

-   Sakura_bot
-   Viewer
-   taiko-bot

输出：

    data-flow-map.md

------------------------------------------------------------------------

# Phase 1 --- Contract Freeze

## Goal

建立统一数据语言。

产物：

    sakura-taiko-contract

------------------------------------------------------------------------

# User Contract

统一：

    User
    Binding
    External Identity
    Developer Identity

------------------------------------------------------------------------

# Chart Contract

统一：

    songId
    chartId
    difficulty
    level
    type

------------------------------------------------------------------------

# Score Contract

统一：

    song
    chart
    score
    good
    ok
    ng
    combo
    clear
    fullCombo
    dondafulCombo
    rank
    capturedAt
    source

------------------------------------------------------------------------

# Growth Contract

统一：

    Raw Score
        |
        v
    Observation
        |
        v
    Canonical Fact
        |
        v
    Projection

------------------------------------------------------------------------

# Contract Validation

要求：

旧输出：

    legacy implementation

新输出：

    contract output

Golden fixture 必须一致。

------------------------------------------------------------------------

# Phase 2 --- Taiko Core v0.1

## Goal

建立独立领域实现。

Repository:

    sakura-taiko-core

Structure:

    core/

    models/
    score/
    chart/
    rating/
    dimension/
    parser/
    recommendation/

    tests/

------------------------------------------------------------------------

# Migration Order

## Step 1

Models:

-   Player
-   Song
-   Chart
-   Score

## Step 2

Parser:

-   score parser
-   chart parser

## Step 3

Calculation:

-   Rating
-   Six Dimensions

## Step 4

Recommendation:

-   candidate
-   scoring

------------------------------------------------------------------------

# Forbidden Dependencies

Core 禁止：

-   NoneBot
-   QQ
-   HTTP framework
-   SQL
-   filesystem
-   Viewer UI

------------------------------------------------------------------------

# Golden Test

要求：

    old result == new result

覆盖：

-   Rating
-   六维
-   Score parsing
-   Chart parsing

------------------------------------------------------------------------

# Phase 3 --- Sakura_bot Extraction

## Goal

Sakura_bot 不再拥有太鼓领域实现。

Before:

    Sakura_bot

    plugins/taiko
        rating
        score
        parser
        command

After:

    Sakura_bot

    adapter/
        taiko_adapter

------------------------------------------------------------------------

## Keep

保留：

-   command
-   permission
-   message formatting

------------------------------------------------------------------------

## Remove

移除：

-   rating formula
-   score parser
-   chart model
-   difficulty calculation

------------------------------------------------------------------------

## Validation

执行：

-   command parity
-   output parity
-   regression tests

------------------------------------------------------------------------

# Phase 4 --- taiko-bot Alignment

## Goal

消除第二套实现。

检查：

-   rating
-   dimension
-   parser
-   score model

替换：

    local implementation

为：

    Taiko Domain Client

------------------------------------------------------------------------

# Phase 5 --- Viewer Boundary

## Current Risk

Viewer 可能直接依赖：

-   userdata
-   snapshot
-   internal format

------------------------------------------------------------------------

## Target

    Viewer

    API / Contract

    Taiko Domain

------------------------------------------------------------------------

## Migration

第一步：

只替换读取。

第二步：

Growth 使用 Canonical Fact。

第三步：

删除 Viewer 内重复逻辑。

------------------------------------------------------------------------

# Phase 6 --- Storage and Writer Consolidation

最后处理：

-   Writer ownership
-   P1a
-   Read Model
-   Database

原因：

必须先明确：

    谁定义数据

再决定：

    数据存在哪里

------------------------------------------------------------------------

# Testing Strategy

## Golden Tests

旧实现：

    legacy

新实现：

    core

必须一致。

------------------------------------------------------------------------

## Compatibility Tests

覆盖：

-   Sakura_bot
-   taiko-bot
-   Viewer

------------------------------------------------------------------------

## Regression

必须保持：

-   Rating
-   六维
-   推荐
-   成绩查询
-   Growth

------------------------------------------------------------------------

# Rollback Strategy

每阶段：

保留：

-   old implementation
-   adapter layer
-   compatibility tests

禁止：

一次删除旧逻辑。

------------------------------------------------------------------------

# Version Roadmap

    0.82.x
    Extraction Audit

    0.83.x
    Contract Freeze

    0.85.x
    Taiko Core v0.1

    0.87.x
    Sakura_bot Adapter Migration

    0.89.x
    taiko-bot Alignment

    0.91.x
    Viewer Contract Migration

    0.95.x
    Platform RC

    1.0.0
    Sakura Taiko Platform
    My Taiko, in one place.

------------------------------------------------------------------------

# Completion Definition

最终：

## Sakura_bot

只负责：

-   Bot framework
-   Adapter

## taiko-bot

只负责：

-   Client
-   Distribution

## Viewer

只负责：

-   Product experience

## Taiko Domain

负责：

-   太鼓规则
-   成绩模型
-   计算逻辑
-   基础能力

------------------------------------------------------------------------

# First Execution Step

开始时必须执行：

Phase 0 Audit。

禁止直接创建 Core。

先回答：

    现在三个项目到底重复了什么？

再决定：

    如何拆。
