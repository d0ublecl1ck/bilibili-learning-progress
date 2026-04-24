## MODIFIED Requirements

### Requirement: 看板 MUST展示在学课程统计

系统 MUST展示在学课程数量、总进度、已学总时长和课程总时长，并 MUST 在课程列表区域按当前排序与分页设置展示在学课程。

#### Scenario: 存在在学课程

- **WHEN** 本地存在一个或多个学习记录
- **THEN** 看板 MUST展示课程数量、累计进度、已学时长和总时长
- **AND** 课程列表 MUST 先按当前排序配置排序
- **AND** 课程列表 MUST 只展示当前页范围内的课程

#### Scenario: 不存在在学课程

- **WHEN** 本地没有学习记录
- **THEN** 看板 MUST展示空状态
- **AND** 空状态 MUST说明如何通过章节规则或星标加入课程
