# newtab-dashboard 规格

## Purpose

定义 Chrome 新标签页学习看板的展示、布局切换、跳转和设置入口，确保用户能够以高信息密度查看和继续学习课程。

## Requirements

### Requirement: 扩展 MUST覆盖 Chrome 新标签页

系统 MUST通过 Manifest V3 的 `chrome_url_overrides.newtab` 将新标签页替换为学习看板。

#### Scenario: 打开新标签页

- **WHEN** 用户打开 Chrome 新标签页
- **THEN** 系统 MUST展示学习看板

### Requirement: 看板 MUST展示在学课程统计

系统 MUST展示在学课程数量、总进度、已学总时长和课程总时长。

#### Scenario: 存在在学课程

- **WHEN** 本地存在一个或多个学习记录
- **THEN** 看板 MUST展示课程数量、累计进度、已学时长和总时长

#### Scenario: 不存在在学课程

- **WHEN** 本地没有学习记录
- **THEN** 看板 MUST展示空状态
- **AND** 空状态 MUST说明如何通过章节规则或星标加入课程

### Requirement: 看板 MUST支持网格和列表布局

系统 MUST提供网格布局和列表布局，且用户选择 MUST在本地持久化。

#### Scenario: 切换到网格布局

- **WHEN** 用户点击“网格”布局按钮
- **THEN** 课程 MUST以卡片网格展示
- **AND** 下次打开新标签页仍优先使用网格布局

#### Scenario: 切换到列表布局

- **WHEN** 用户点击“列表”布局按钮
- **THEN** 课程 MUST以一行一个的高信息密度列表展示
- **AND** 下次打开新标签页仍优先使用列表布局

### Requirement: 课程卡片 MUST跳转回学习页面

系统 MUST允许用户点击课程条目跳转到对应的 Bilibili 学习页面。

#### Scenario: 点击课程条目

- **WHEN** 用户点击某个课程条目
- **THEN** 浏览器 MUST打开该学习记录保存的课程 URL

### Requirement: 同步配置 MUST通过轻量入口进入

系统 MUST NOT 将 GitHub Token、Gist ID 和文件名配置常驻平铺在主页上；系统 MUST 通过图标按钮打开设置弹窗。

#### Scenario: 打开同步设置

- **WHEN** 用户点击同步设置图标按钮
- **THEN** 系统 MUST打开包含 Token、Gist ID、文件名和帮助链接的设置弹窗

#### Scenario: 未配置时点击手动同步

- **WHEN** 用户未配置 Gist 同步但点击手动同步按钮
- **THEN** 系统 MUST打开同步设置弹窗
- **AND** 提示用户先填写 Token 和 Gist ID
