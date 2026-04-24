## MODIFIED Requirements

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
