# gist-sync 规格

## Purpose

定义学习记录通过 GitHub Gist 跨设备同步的配置、数据格式、自动同步和失败处理，确保本地优先的数据能够安全备份和合并。

## Requirements

### Requirement: Gist 同步配置 MUST保存在本地

系统 MUST将 GitHub Token、Gist ID 和同步文件名保存在 `chrome.storage.local`，不得写入源码、页面 URL 或 Gist 数据文件。

#### Scenario: 保存同步配置

- **WHEN** 用户在同步设置弹窗中保存 Token、Gist ID 和文件名
- **THEN** 系统 MUST将配置保存到本地扩展存储
- **AND** 不得把 Token 写入 Gist JSON 内容

### Requirement: Gist 数据文件 MUST使用版本化 JSON 格式

系统 MUST在 Gist 文件中保存包含 `schemaVersion`、`updatedAt`、`courses` 和 `preferences` 的 JSON 数据。

#### Scenario: 推送本地学习记录

- **WHEN** 系统向 Gist 推送数据
- **THEN** Gist 文件内容必须是格式化 JSON
- **AND** 必须包含当前支持的 schema 版本号

### Requirement: 打开新标签页 MUST自动拉取合并

系统 MUST在新标签页打开且 Gist 配置完整时自动从 Gist 拉取数据，并与本地学习记录合并。

#### Scenario: 远端存在更新课程

- **WHEN** Gist 中某 BV 课程的 `updatedAt` 晚于本地记录
- **THEN** 系统 MUST采用远端课程记录

#### Scenario: 本地存在更新课程

- **WHEN** 本地某 BV 课程的 `updatedAt` 晚于远端记录
- **THEN** 系统 MUST保留本地课程记录

#### Scenario: 远端文件不存在

- **WHEN** Gist 中不存在指定同步文件
- **THEN** 系统 MUST使用本地数据创建该同步文件

### Requirement: 本地变化 MUST防抖自动推送

系统 MUST在课程记录或布局偏好发生本地变化后防抖推送到 Gist，避免频繁请求。

#### Scenario: 连续本地变化

- **WHEN** 短时间内发生多次本地学习记录变化
- **THEN** 系统 MUST合并为一次延迟推送

#### Scenario: 初次拉取尚未完成

- **WHEN** 新标签页打开后的初次 Gist 拉取合并尚未完成
- **THEN** 系统不得自动推送本地数据覆盖远端

### Requirement: 用户 MUST能够手动触发同步

系统 MUST在新标签页提供手动同步图标按钮，点击后执行拉取、合并并推送。

#### Scenario: 已配置时手动同步

- **WHEN** 用户已配置 Token 和 Gist ID 并点击同步按钮
- **THEN** 系统 MUST立即执行 Gist 拉取、合并和推送

#### Scenario: 未配置时手动同步

- **WHEN** 用户未配置 Token 或 Gist ID 并点击同步按钮
- **THEN** 系统 MUST打开同步设置弹窗
- **AND** 提示用户完成配置

### Requirement: 系统 MUST提供 Gist 配置帮助链接

同步设置弹窗 MUST提供跳转到 GitHub Token 创建页面和 Gist 页面的链接。

#### Scenario: 获取 Token

- **WHEN** 用户点击“获取 GitHub Token”
- **THEN** 系统 MUST在新标签中打开 GitHub Token 创建页面

#### Scenario: 创建或查看 Gist

- **WHEN** 用户点击“创建或查看 Gist”
- **THEN** 系统 MUST在新标签中打开 Gist 页面

### Requirement: 同步失败必须反馈给用户

系统 MUST在 GitHub API 请求失败、配置缺失或远端数据格式无效时展示可理解的同步状态和错误提示。

#### Scenario: Token 无效

- **WHEN** GitHub API 返回认证失败
- **THEN** 系统 MUST显示同步失败状态
- **AND** 错误信息必须提示 Gist 请求失败
