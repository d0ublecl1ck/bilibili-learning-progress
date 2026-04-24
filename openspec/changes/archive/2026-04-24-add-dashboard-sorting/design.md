## Overview

排序在新标签页本地完成，并位于分页之前。课程记录先映射为视图模型，再按用户选择的字段和方向排序，最后进行分页切片。

## Data Model

新增 UI 状态：

```ts
type SortField = 'updatedAt' | 'createdAt' | 'progress' | 'learnedDuration'
type SortDirection = 'asc' | 'desc'
```

排序偏好保存到 `window.localStorage`：

- `blp:newtab-sort-field`
- `blp:newtab-sort-direction`

为支持“添加时间”，学习记录需要 `createdAt`：

```ts
type LearningCourseRecord = {
  createdAt: number
  updatedAt: number
}
```

兼容策略：旧记录没有 `createdAt` 时使用 `updatedAt` 作为回退值，不阻塞排序。

## Sorting Rules

- 更新时间：使用 `updatedAt`。
- 添加时间：使用 `createdAt ?? updatedAt`。
- 学习进度：使用 `completedSeconds / totalSeconds`，总时长为 0 时视为 0。
- 学习时长：使用 `completedSeconds`。
- 字段值相同时使用 `updatedAt` 降序作为稳定回退。
- 排序变化后重置当前页为 1。

## Rendering Flow

```text
coursesById
  -> Object.values
  -> courseViews
  -> sort(courseViews, field, direction)
  -> paginate(sortedCourseViews)
  -> render grid/list
```

## UI

排序控件与每页数量一样属于列表展示控制，放在分页栏中更符合列表工具区语义。控件包括：

- 排序字段 select
- 顺序/反序按钮或 select

## Verification

- `openspec validate add-dashboard-sorting --strict`
- `npm run build`
- 手动检查 4 个排序字段、升序/降序、分页重置、旧数据无 `createdAt` 的兼容。
