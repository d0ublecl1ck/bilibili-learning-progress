# chapter-progress 规格

## Purpose

定义章节匹配规则、章节分组、章节时长和章节进度的行为，确保课程分集能够按用户输入的标题特征稳定聚合，并在学习过程中提供可解释的章节级完成度。

## Requirements

### Requirement: 章节规则 MUST按 BV 号持久化

系统 MUST将用户输入的章节匹配规则按 BV 号保存到 Bilibili 页面可访问的 `localStorage` 中，避免用户下次访问同一课程时重复输入。

#### Scenario: 保存章节规则

- **WHEN** 用户在 `BV1Fzszz4Ek7` 页面输入 `第*章`
- **THEN** 系统 MUST以包含该 BV 号的键保存该规则

#### Scenario: 重新打开同一课程

- **WHEN** 用户再次访问 `BV1Fzszz4Ek7` 页面
- **THEN** 系统 MUST自动恢复该课程此前保存的章节规则

### Requirement: 章节规则 MUST支持通配写法和正则写法

系统 MUST支持用户输入 `第*章` 这类通配写法，并支持 `第.*章` 这类标准正则写法。

#### Scenario: 使用通配规则

- **WHEN** 用户输入 `第*章`
- **THEN** 系统 MUST将其解释为可匹配任意中间文本的章节规则

#### Scenario: 使用标准正则

- **WHEN** 用户输入 `第.*章`
- **THEN** 系统 MUST按 JavaScript 正则表达式匹配课时标题

#### Scenario: 规则无法解析

- **WHEN** 用户输入无法构造匹配器的规则
- **THEN** 系统 MUST显示错误提示
- **AND** 不得中断总进度计算

### Requirement: 未匹配课时 MUST归入“其他”

系统 MUST将无法通过章节规则匹配到章节名称的课时归入“其他”。

#### Scenario: 部分课时无法匹配

- **WHEN** 课程中部分标题不包含章节标识
- **THEN** 这些课时必须统一归入“其他”章节

### Requirement: 系统 MUST计算每个章节的进度

系统 MUST按章节汇总课时数、总时长、已学时长和进度百分比，并标识当前课时所在章节。

#### Scenario: 当前课时在某章节内

- **WHEN** 当前激活课时属于“第二章”
- **THEN** “第二章”必须显示为当前章节
- **AND** 该章节已学时长必须包含该章节中序号不晚于当前课时的课时时长
