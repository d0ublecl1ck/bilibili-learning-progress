# 项目说明

## 目标

本项目是一个 Chrome 扩展，用于在 Bilibili 分集视频课程中追踪学习进度，并在新标签页集中展示正在学习的课程。

## 技术栈

- TypeScript
- React 18
- Vite
- Chrome Extension Manifest V3
- `chrome.storage.local`
- GitHub Gist REST API

## 领域术语

- BV 号：Bilibili 视频路径中的 `BV...` 标识，用作课程级数据主键。
- 课时：Bilibili 分集列表中的单个视频条目。
- 章节：从课时标题中按用户配置的匹配规则提取出的分组名称。
- 在学课程：已设置章节匹配规则，或用户手动星标加入学习列表的课程。
- 学习记录：以 BV 号为键保存的课程标题、跳转地址、课时数、总时长、已学时长、当前位置、章节规则与更新时间。
- Gist 同步：将本地学习记录序列化为 JSON 文件并通过 GitHub Gist 拉取、合并和推送。

## 业务原则

- 以本地数据为主要数据源，Gist 仅作为跨设备同步和备份通道。
- 不要求用户在每次访问同一 BV 课程时重新输入章节规则。
- 未匹配到章节规则的课时必须归入“其他”。
- 用户界面应优先清晰、紧凑和实用，避免过度装饰。
- Token 等敏感配置只能保存在本地扩展存储中，不得写入 Gist 文件或源码。

## 数据流

```text
Bilibili 视频页
  | 读取分集标题、时长、当前激活课时
  v
content script 悬浮面板
  | 保存章节规则到页面 localStorage
  | 同步在学课程到 chrome.storage.local
  v
newtab 学习看板
  | 读取 chrome.storage.local
  | 打开时拉取 Gist 并合并
  | 本地变化后防抖推送到 Gist
  v
GitHub Gist JSON 文件
```

## 开发约束

- 修改功能前应先创建 OpenSpec change，并在 proposal、design、tasks、spec delta 完成后再实现。
- OpenSpec 文档使用中文。
- 对外部网络、Token、存储结构、同步策略的变更必须包含安全和失败场景。
- 变更完成后运行 `npm run build` 作为最低验证。
