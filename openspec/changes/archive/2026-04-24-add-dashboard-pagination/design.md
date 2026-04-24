## Overview

分页在新标签页本地完成。看板仍从 `chrome.storage.local` 读取完整课程记录，排序后根据 `pageSize` 和 `currentPage` 进行切片，再交给现有网格或列表布局渲染。

## Data Model

新增 UI 状态，不写入 Gist：

```ts
type PageSize = 20 | 25 | 100
const [pageSize, setPageSize] = useState<PageSize>(20)
const [currentPage, setCurrentPage] = useState(1)
```

可选本地持久化：每页数量保存到 `window.localStorage` 的 `blp:newtab-page-size`，便于下次打开保留用户偏好。当前页不持久化，避免打开页面时进入过期页码。

## Rendering Flow

```text
coursesById
  -> Object.values
  -> updatedAt desc sort
  -> courseViews
  -> totalPages = ceil(courseViews.length / pageSize)
  -> safeCurrentPage = clamp(currentPage, 1, totalPages)
  -> pagedCourseViews = slice(start, end)
  -> render grid/list
```

## UI Behavior

- 分页控件放在课程列表上方或工具栏右侧附近，保持信息平台风格。
- 显示范围文案，例如 `1-20 / 86`。
- 提供上一页、下一页按钮。
- 提供每页数量选择：20、50、100。
- 总页数为 1 时仍可展示范围和每页数量选择，但上一页/下一页禁用。

## Edge Cases

- 课程数量为 0：显示空状态，不显示分页按钮或仅显示禁用状态。
- 删除或合并后当前页超过总页数：自动回落到最后一页。
- 修改每页数量：当前页重置为 1，避免用户落入空页。
- 同步拉取带来更多课程：保持当前页，必要时重新计算安全页码。

## Verification

- `npm run build`
- 手动检查：0 个课程、1 个课程、超过 20 个课程、切换 50/100、最后一页不足一页、网格和列表布局。
