# dashboard-sorting Specification

## Purpose

定义新标签页课程列表排序字段、排序方向、排序与分页协同关系以及排序控件布局，确保用户能按不同学习目标重排在学课程。

## Requirements

### Requirement: 看板课程列表 MUST支持排序字段选择

系统 MUST 允许用户按更新时间、添加时间、学习进度和学习时长排序在学课程。

#### Scenario: 按更新时间排序

- **WHEN** 用户选择更新时间排序
- **THEN** 系统 MUST 使用课程记录的 `updatedAt` 对课程列表排序

#### Scenario: 按添加时间排序

- **WHEN** 用户选择添加时间排序
- **THEN** 系统 MUST 使用课程记录的 `createdAt` 对课程列表排序
- **AND** 当旧记录没有 `createdAt` 时 MUST 使用 `updatedAt` 作为回退值

#### Scenario: 按学习进度排序

- **WHEN** 用户选择学习进度排序
- **THEN** 系统 MUST 使用已学时长除以总时长得到的进度比例排序

#### Scenario: 按学习时长排序

- **WHEN** 用户选择学习时长排序
- **THEN** 系统 MUST 使用课程已学时长排序

### Requirement: 看板课程列表 MUST支持排序方向切换

系统 MUST 允许用户通过图标按钮在升序和降序之间切换当前排序字段。

#### Scenario: 选择升序

- **WHEN** 用户选择升序
- **THEN** 系统 MUST 将较小排序值的课程排在前面

#### Scenario: 选择降序

- **WHEN** 用户选择降序
- **THEN** 系统 MUST 将较大排序值的课程排在前面

### Requirement: 排序 MUST先于分页执行

系统 MUST 先按排序配置得到完整有序课程列表，再按分页配置截取当前页数据。

#### Scenario: 排序后查看第一页

- **WHEN** 用户改变排序字段或排序方向
- **THEN** 系统 MUST 重置到第一页
- **AND** 第一页 MUST 展示排序后列表的前一页数据

### Requirement: 排序控件 MUST位于列表头部工具栏

系统 MUST 将排序字段和排序方向控件放在课程列表上方的工具栏中，而不是分页栏中。

#### Scenario: 查看排序控件

- **WHEN** 用户打开学习看板
- **THEN** 系统 MUST 在顶部工具栏展示排序字段和排序方向控件
- **AND** 底部分页栏 MUST 只保留每页数量和翻页控件

### Requirement: 排序方向控件 MUST使用图标按钮

系统 MUST 使用单个图标按钮表示排序方向，并在点击后切换升序和降序。

#### Scenario: 点击排序方向按钮

- **WHEN** 用户点击排序方向图标按钮
- **THEN** 系统 MUST 在升序和降序之间切换
- **AND** 系统 MUST 重置到第一页
