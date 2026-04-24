# course-tracking 规格

## Purpose

定义 Bilibili 课程识别、学习记录保存和手动加入学习列表的行为，确保扩展能够围绕 BV 号稳定追踪用户正在学习的课程。
## Requirements
### Requirement: 课程 MUST以 BV 号作为主键

系统 MUST从 `https://www.bilibili.com/video/<BV号>` 路径中提取 BV 号，并使用该 BV 号作为课程配置和学习记录的稳定主键。

#### Scenario: 从视频页提取 BV 号

- **WHEN** 用户访问 `https://www.bilibili.com/video/BV1Fzszz4Ek7?p=21`
- **THEN** 系统 MUST识别课程主键为 `BV1Fzszz4Ek7`

#### Scenario: 无法识别 BV 号

- **WHEN** 当前页面不是 Bilibili 视频详情页或路径中没有 BV 号
- **THEN** 系统不得写入课程学习记录
- **AND** 手动加入学习列表的按钮必须不可用或提示无法保存

### Requirement: 系统 MUST从分集列表计算学习记录

系统 MUST读取分集标题、分集时长和当前激活分集，并计算课程总时长、已学时长、总课时数、当前课时序号和当前课时标题；系统 MUST 在首次创建学习记录时保存添加时间，并在后续更新时保留原始添加时间。

#### Scenario: 当前课时可识别

- **WHEN** 分集列表存在且某个课时处于激活状态
- **THEN** 已学时长 MUST等于从第一节到当前激活课时的时长总和
- **AND** 当前课时序号 MUST按 1 起始展示

#### Scenario: 当前课时不可识别

- **WHEN** 分集列表存在但没有激活课时
- **THEN** 已学时长 MUST为 0
- **AND** 页面 MUST提示当前课时未识别

#### Scenario: 首次创建学习记录

- **WHEN** 当前 BV 课程首次被写入学习记录
- **THEN** 系统 MUST 写入 `createdAt`

#### Scenario: 更新已有学习记录

- **WHEN** 当前 BV 课程已有学习记录并再次更新
- **THEN** 系统 MUST 保留原有 `createdAt`
- **AND** 系统 MUST 更新 `updatedAt`

### Requirement: 用户 MUST能够手动加入在学课程

系统 MUST在视频页悬浮面板提供一个轻量按钮，用于将当前 BV 课程手动加入或移出学习列表。

#### Scenario: 未设置章节规则时手动加入

- **WHEN** 用户在未设置章节规则的课程页点击星标按钮
- **THEN** 系统 MUST将该 BV 课程写入学习记录
- **AND** 该课程在新标签页看板中显示为在学课程

#### Scenario: 再次点击取消手动记录

- **WHEN** 课程没有章节规则且用户再次点击已星标按钮
- **THEN** 系统 MUST从学习记录中移除该课程

#### Scenario: 设置章节规则的课程取消星标

- **WHEN** 课程已设置章节规则且用户取消星标
- **THEN** 系统仍必须保留该课程为在学课程
- **AND** 保留原因必须来自章节规则

