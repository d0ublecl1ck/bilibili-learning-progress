# dashboard-pagination Specification

## Purpose

定义新标签页课程列表分页、每页数量选择、页码导航和分页栏布局位置，确保大量课程仍能以稳定、可控的信息密度展示。

## Requirements

### Requirement: 看板课程列表 MUST支持分页

系统 MUST 对新标签页的在学课程列表进行分页展示，默认每页展示 20 个课程。

#### Scenario: 默认分页

- **WHEN** 用户打开新标签页且存在超过 20 个在学课程
- **THEN** 系统 MUST 只在第一页展示前 20 个课程
- **AND** 系统 MUST 显示分页范围和翻页控件

#### Scenario: 课程数量不超过默认每页数量

- **WHEN** 在学课程数量不超过 20
- **THEN** 系统 MUST 展示全部课程
- **AND** 上一页和下一页按钮 MUST 处于不可用状态或不产生翻页效果

### Requirement: 用户 MUST能够选择每页数量

系统 MUST 允许用户将每页课程数量设置为 20、50 或 100。

#### Scenario: 切换到 50 条每页

- **WHEN** 用户选择每页 50 个课程
- **THEN** 系统 MUST 将课程列表按每页 50 个重新分页
- **AND** 当前页 MUST 重置为第一页

#### Scenario: 切换到 100 条每页

- **WHEN** 用户选择每页 100 个课程
- **THEN** 系统 MUST 将课程列表按每页 100 个重新分页
- **AND** 当前页 MUST 重置为第一页

### Requirement: 当前页 MUST保持在有效范围内

系统 MUST 在课程数量或每页数量变化后，将当前页限制在有效页码范围内。

#### Scenario: 当前页超过总页数

- **WHEN** 当前页码大于重新计算后的总页数
- **THEN** 系统 MUST 自动回落到最后一页

#### Scenario: 没有课程

- **WHEN** 在学课程数量为 0
- **THEN** 系统 MUST 将有效页码视为 1
- **AND** 系统 MUST 展示空状态

### Requirement: 分页控件 MUST位于课程列表底部

系统 MUST 将分页范围、每页数量选择和上一页/下一页控件放在课程列表底部，作为列表页脚操作区域。

#### Scenario: 查看分页控件位置

- **WHEN** 用户打开存在在学课程的学习看板
- **THEN** 系统 MUST 先展示当前页课程列表
- **AND** 系统 MUST 在课程列表之后展示分页栏

### Requirement: 每页数量选择 MUST位于分页栏中

系统 MUST 将每页数量选择控件放在底部分页栏内，并位于翻页按钮组左侧。

#### Scenario: 查看每页数量选择

- **WHEN** 用户查看底部分页栏
- **THEN** 系统 MUST 展示“每页展示”选择器
- **AND** 该选择器 MUST 位于上一页和下一页控件左侧
