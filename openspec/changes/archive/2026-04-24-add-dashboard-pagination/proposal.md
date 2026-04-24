## Why

学习看板当前一次性展示所有在学课程。随着课程数量增加，页面会变长，列表视图和网格视图都缺少快速定位和控制展示密度的能力。

需要为看板增加分页，让默认信息密度保持稳定，同时允许用户将每页数量调整为 20、50 或 100。

```text
课程记录列表 -> 排序 -> 分页切片 -> 网格/列表渲染
                    ^
                    |
              每页数量 + 当前页
```

## What Changes

- 新标签页课程列表增加分页状态。
- 默认每页展示 20 个课程。
- 用户可以选择每页 20、50 或 100 个课程。
- 当前页超出总页数时自动回落到最后一页。
- 布局切换、同步状态和课程跳转保持不变。

## Non-goals

- 不增加搜索、筛选或排序配置。
- 不改变 Gist 同步数据结构。
- 不改变课程记录的生成和合并策略。

## Capabilities

### New Capabilities

- `dashboard-pagination`: 定义新标签页课程列表分页、每页数量选择和页码导航行为。

### Modified Capabilities

- `newtab-dashboard`: 看板课程列表从全量展示改为分页展示。

## Impact

- 影响 `src/newtab/NewTab.tsx` 的课程列表渲染流程。
- 影响 `src/newtab/NewTab.css` 的工具栏和分页控件样式。
- 不影响 content script、Gist API 客户端或 Manifest 权限。
