import { useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_GIST_SYNC_FILE_NAME,
  GIST_SYNC_META_STORAGE_KEY,
  getGistSyncConfig,
  pullMergePushGist,
  pushLocalToGist,
  setGistSyncConfig,
  type GistSyncConfig,
} from '../gistSync'
import { getLearningCoursesStorageKey, type LearningCourseRecord } from '../learningStore'
import './NewTab.css'

type LearningCoursesById = Record<string, LearningCourseRecord>
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'unconfigured'
type LayoutMode = 'grid' | 'list'
type PageSize = 20 | 50 | 100
type SortField = 'updatedAt' | 'createdAt' | 'progress' | 'learnedDuration'
type SortDirection = 'asc' | 'desc'

type CourseViewModel = {
  course: LearningCourseRecord
  percentage: number
  ratio: number
  currentIndexLabel: string
  updatedAtLabel: string
  sourceLabel: string
}

type SyncFormState = {
  token: string
  gistId: string
  fileName: string
}

const LAYOUT_OPTIONS: Array<{ label: string; value: LayoutMode }> = [
  { label: '网格', value: 'grid' },
  { label: '列表', value: 'list' },
]
const PAGE_SIZE_OPTIONS: PageSize[] = [20, 50, 100]
const DEFAULT_PAGE_SIZE: PageSize = 20
const SORT_FIELD_OPTIONS: Array<{ label: string; value: SortField }> = [
  { label: '更新时间', value: 'updatedAt' },
  { label: '添加时间', value: 'createdAt' },
  { label: '学习进度', value: 'progress' },
  { label: '学习时长', value: 'learnedDuration' },
]
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens?type=beta'
const GITHUB_GISTS_URL = 'https://gist.github.com/'

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}小时${minutes.toString().padStart(2, '0')}分`
  }

  return `${minutes}分钟`
}

function formatUpdatedAt(updatedAt: number): string {
  if (!updatedAt) {
    return '未知时间'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(updatedAt))
}

function getProgressRatio(course: LearningCourseRecord): number {
  return course.totalSeconds > 0 ? course.completedSeconds / course.totalSeconds : 0
}

function getStoredLayout(): LayoutMode {
  const storedLayout = window.localStorage.getItem('blp:newtab-layout')
  return storedLayout === 'grid' || storedLayout === 'list' ? storedLayout : 'list'
}

function getStoredPageSize(): PageSize {
  const storedPageSize = Number(window.localStorage.getItem('blp:newtab-page-size'))
  return PAGE_SIZE_OPTIONS.includes(storedPageSize as PageSize)
    ? (storedPageSize as PageSize)
    : DEFAULT_PAGE_SIZE
}

function getStoredSortField(): SortField {
  const storedSortField = window.localStorage.getItem('blp:newtab-sort-field')
  return SORT_FIELD_OPTIONS.some((option) => option.value === storedSortField)
    ? (storedSortField as SortField)
    : 'updatedAt'
}

function getStoredSortDirection(): SortDirection {
  const storedSortDirection = window.localStorage.getItem('blp:newtab-sort-direction')
  return storedSortDirection === 'asc' || storedSortDirection === 'desc'
    ? storedSortDirection
    : 'desc'
}

function getCreatedAt(course: LearningCourseRecord): number {
  return course.createdAt ?? course.updatedAt
}

function getSortValue(course: LearningCourseRecord, sortField: SortField): number {
  if (sortField === 'createdAt') {
    return getCreatedAt(course)
  }

  if (sortField === 'progress') {
    return course.totalSeconds > 0 ? course.completedSeconds / course.totalSeconds : 0
  }

  if (sortField === 'learnedDuration') {
    return course.completedSeconds
  }

  return course.updatedAt
}

function sortCourses(
  courses: LearningCourseRecord[],
  sortField: SortField,
  sortDirection: SortDirection,
): LearningCourseRecord[] {
  const directionMultiplier = sortDirection === 'asc' ? 1 : -1

  return [...courses].sort((first, second) => {
    const primaryDiff = getSortValue(first, sortField) - getSortValue(second, sortField)

    if (primaryDiff !== 0) {
      return primaryDiff * directionMultiplier
    }

    return second.updatedAt - first.updatedAt
  })
}

function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1))
}

function getSyncStatusLabel(status: SyncStatus): string {
  if (status === 'syncing') {
    return '同步中'
  }

  if (status === 'synced') {
    return '已同步'
  }

  if (status === 'error') {
    return '同步失败'
  }

  if (status === 'unconfigured') {
    return '未配置 Gist'
  }

  return '等待同步'
}

function getSyncFormState(config: GistSyncConfig | null): SyncFormState {
  return {
    token: config?.token ?? '',
    gistId: config?.gistId ?? '',
    fileName: config?.fileName ?? DEFAULT_GIST_SYNC_FILE_NAME,
  }
}

function getCourseViewModel(course: LearningCourseRecord): CourseViewModel {
  const ratio = getProgressRatio(course)
  const percentage = Math.min(100, Math.round(ratio * 100))

  return {
    course,
    percentage,
    ratio,
    currentIndexLabel:
      course.currentIndex >= 0
        ? `第 ${course.currentIndex + 1} / ${course.lessonCount} 节`
        : '未识别当前课时',
    updatedAtLabel: formatUpdatedAt(course.updatedAt),
    sourceLabel: course.chapterPattern ? '章节规则' : '手动记录',
  }
}

export const NewTab = () => {
  const [coursesById, setCoursesById] = useState<LearningCoursesById>({})
  const [layout, setLayout] = useState<LayoutMode>(getStoredLayout)
  const [pageSize, setPageSize] = useState<PageSize>(getStoredPageSize)
  const [sortField, setSortField] = useState<SortField>(getStoredSortField)
  const [sortDirection, setSortDirection] = useState<SortDirection>(getStoredSortDirection)
  const [currentPage, setCurrentPage] = useState(1)
  const [syncConfig, setSyncConfig] = useState<GistSyncConfig | null>(null)
  const [syncForm, setSyncForm] = useState<SyncFormState>(() => getSyncFormState(null))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [canAutoPush, setCanAutoPush] = useState(false)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem('blp:newtab-layout', layout)
  }, [layout])

  useEffect(() => {
    window.localStorage.setItem('blp:newtab-page-size', String(pageSize))
  }, [pageSize])

  useEffect(() => {
    window.localStorage.setItem('blp:newtab-sort-field', sortField)
  }, [sortField])

  useEffect(() => {
    window.localStorage.setItem('blp:newtab-sort-direction', sortDirection)
  }, [sortDirection])

  useEffect(() => {
    let cancelled = false

    getGistSyncConfig().then((config) => {
      if (cancelled) {
        return
      }

      setSyncConfig(config)
      setSyncForm(getSyncFormState(config))

      if (!config?.token || !config.gistId) {
        setSyncStatus('unconfigured')
        setSyncMessage('填写 Token 和 Gist ID 后会自动同步。')
        return
      }

      setCanAutoPush(false)
      setSyncStatus('syncing')
      setSyncMessage('正在打开页面后自动拉取 Gist 数据。')
      pullMergePushGist(config)
        .then((result) => {
          if (cancelled) {
            return
          }

          setSyncStatus('synced')
          setSyncMessage(result.message)
          setLastSyncedAt(Date.now())
          setCanAutoPush(true)
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return
          }

          setSyncStatus('error')
          setSyncMessage(error instanceof Error ? error.message : 'Gist 自动同步失败。')
          setCanAutoPush(false)
        })
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const storageKey = getLearningCoursesStorageKey()

    chrome.storage.local.get([storageKey, GIST_SYNC_META_STORAGE_KEY], (result) => {
      const nextCourses = result[storageKey]
      const syncMeta = result[GIST_SYNC_META_STORAGE_KEY]
      setCoursesById(nextCourses && typeof nextCourses === 'object' ? nextCourses : {})

      if (syncMeta?.lastSyncedAt && typeof syncMeta.lastSyncedAt === 'number') {
        setLastSyncedAt(syncMeta.lastSyncedAt)
      }
    })

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      const courseChange = changes[storageKey]
      const syncMetaChange = changes[GIST_SYNC_META_STORAGE_KEY]

      if (syncMetaChange?.newValue?.lastSyncedAt) {
        setLastSyncedAt(syncMetaChange.newValue.lastSyncedAt)
      }

      if (!courseChange) {
        return
      }

      const nextCourses = courseChange.newValue
      setCoursesById(nextCourses && typeof nextCourses === 'object' ? nextCourses : {})
    }

    chrome.storage.local.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.local.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  useEffect(() => {
    if (!canAutoPush || !syncConfig?.token || !syncConfig.gistId) {
      return
    }

    const pushTimer = window.setTimeout(() => {
      setSyncStatus('syncing')
      setSyncMessage('本地变化将在防抖后自动推送。')
      pushLocalToGist(syncConfig)
        .then((result) => {
          setSyncStatus('synced')
          setSyncMessage(result.message)
          setLastSyncedAt(Date.now())
        })
        .catch((error: unknown) => {
          setSyncStatus('error')
          setSyncMessage(error instanceof Error ? error.message : 'Gist 自动推送失败。')
        })
    }, 1200)

    return () => {
      window.clearTimeout(pushTimer)
    }
  }, [canAutoPush, coursesById, layout, syncConfig])

  const runManualSync = () => {
    if (!syncConfig?.token || !syncConfig.gistId) {
      setIsSyncModalOpen(true)
      setSyncStatus('unconfigured')
      setSyncMessage('请先填写 Token 和 Gist ID。')
      return
    }

    setCanAutoPush(false)
    setSyncStatus('syncing')
    setSyncMessage('正在手动同步：拉取、合并并推送。')
    pullMergePushGist(syncConfig)
      .then((result) => {
        setSyncStatus('synced')
        setSyncMessage(result.message)
        setLastSyncedAt(Date.now())
        setCanAutoPush(true)
      })
      .catch((error: unknown) => {
        setSyncStatus('error')
        setSyncMessage(error instanceof Error ? error.message : '手动同步失败。')
        setCanAutoPush(false)
      })
  }

  const saveSyncConfig = () => {
    const nextConfig = {
      token: syncForm.token,
      gistId: syncForm.gistId,
      fileName: syncForm.fileName || DEFAULT_GIST_SYNC_FILE_NAME,
    }

    setCanAutoPush(false)
    setSyncStatus('syncing')
    setSyncMessage('正在保存配置并同步。')
    setGistSyncConfig(nextConfig)
      .then(() => {
        setSyncConfig(nextConfig)
        return pullMergePushGist(nextConfig)
      })
      .then((result) => {
        setSyncStatus('synced')
        setSyncMessage(result.message)
        setLastSyncedAt(Date.now())
        setCanAutoPush(true)
      })
      .catch((error: unknown) => {
        setSyncStatus('error')
        setSyncMessage(error instanceof Error ? error.message : 'Gist 配置或同步失败。')
        setCanAutoPush(false)
      })
  }

  const courses = useMemo(
    () => sortCourses(Object.values(coursesById), sortField, sortDirection),
    [coursesById, sortDirection, sortField],
  )
  const courseViews = useMemo(() => courses.map(getCourseViewModel), [courses])
  const totalCourses = courses.length
  const totalPages = Math.max(1, Math.ceil(courseViews.length / pageSize))
  const safeCurrentPage = clampPage(currentPage, totalPages)
  const pageStartIndex = (safeCurrentPage - 1) * pageSize
  const pageEndIndex = Math.min(pageStartIndex + pageSize, courseViews.length)
  const pagedCourseViews = courseViews.slice(pageStartIndex, pageEndIndex)
  const pageRangeLabel =
    courseViews.length > 0
      ? `${pageStartIndex + 1}-${pageEndIndex} / ${courseViews.length}`
      : '0 / 0'
  const totalSeconds = courses.reduce((sum, course) => sum + course.totalSeconds, 0)
  const completedSeconds = courses.reduce((sum, course) => sum + course.completedSeconds, 0)
  const overallRatio = totalSeconds > 0 ? completedSeconds / totalSeconds : 0
  const overallPercentage = Math.min(100, Math.round(overallRatio * 100))

  useEffect(() => {
    const nextPage = clampPage(currentPage, totalPages)

    if (nextPage !== currentPage) {
      setCurrentPage(nextPage)
    }
  }, [currentPage, totalPages])

  const updatePageSize = (nextPageSize: PageSize) => {
    setPageSize(nextPageSize)
    setCurrentPage(1)
  }

  const updateSortField = (nextSortField: SortField) => {
    setSortField(nextSortField)
    setCurrentPage(1)
  }

  const updateSortDirection = (nextSortDirection: SortDirection) => {
    setSortDirection(nextSortDirection)
    setCurrentPage(1)
  }

  return (
    <main className="learning-page">
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Bilibili Learning Progress</p>
          <h1>学习追踪</h1>
        </div>
        <div className="summary-strip" aria-label="学习统计">
          <div>
            <span>课程</span>
            <strong>{totalCourses}</strong>
          </div>
          <div>
            <span>总进度</span>
            <strong>{overallPercentage}%</strong>
          </div>
          <div>
            <span>已学</span>
            <strong>{formatDuration(completedSeconds)}</strong>
          </div>
          <div>
            <span>总时长</span>
            <strong>{formatDuration(totalSeconds)}</strong>
          </div>
        </div>
      </section>

      <section className="toolbar" aria-label="视图设置">
        <p>设置过章节正则，或点击课程页星标按钮的课程会出现在这里。</p>
        <div className="toolbar-actions">
          <button
            className={`sync-icon-button ${syncStatus}`}
            type="button"
            title="立即同步"
            aria-label="立即同步 Gist 数据"
            disabled={syncStatus === 'syncing'}
            onClick={runManualSync}
          >
            ↻
          </button>
          <button
            className={`sync-icon-button ${syncStatus}`}
            type="button"
            title="Gist 同步设置"
            aria-label="打开 Gist 同步设置"
            onClick={() => setIsSyncModalOpen(true)}
          >
            ⚙
          </button>
          <span className={`sync-badge ${syncStatus}`}>{getSyncStatusLabel(syncStatus)}</span>
          <div className="list-control">
            <label htmlFor="sort-field">排序:</label>
            <select
              id="sort-field"
              aria-label="排序字段"
              value={sortField}
              onChange={(event) => updateSortField(event.target.value as SortField)}
            >
              {SORT_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="sort-direction-button"
            type="button"
            title={
              sortDirection === 'desc' ? '当前为降序，点击切换升序' : '当前为升序，点击切换降序'
            }
            aria-label={sortDirection === 'desc' ? '切换为升序' : '切换为降序'}
            onClick={() => updateSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
          >
            {sortDirection === 'desc' ? '↓' : '↑'}
          </button>
          <div className="layout-toggle" role="group" aria-label="布局切换">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                aria-pressed={layout === option.value}
                className={layout === option.value ? 'active' : ''}
                key={option.value}
                type="button"
                onClick={() => setLayout(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {isSyncModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setIsSyncModalOpen(false)}
        >
          <section
            className="sync-modal"
            aria-label="Gist 同步设置"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Gist Sync</p>
                <h2>同步设置</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="关闭同步设置"
                onClick={() => setIsSyncModalOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="modal-copy">
              打开新标签页会自动拉取 Gist 数据，本地课程或布局变化会防抖自动推送。
            </p>
            <div className="sync-fields">
              <label>
                GitHub Token
                <input
                  type="password"
                  placeholder="需要 Gist 读写权限"
                  value={syncForm.token}
                  onChange={(event) =>
                    setSyncForm((form) => ({ ...form, token: event.target.value }))
                  }
                />
              </label>
              <label>
                Gist ID
                <input
                  type="text"
                  placeholder="例如 9f8e..."
                  value={syncForm.gistId}
                  onChange={(event) =>
                    setSyncForm((form) => ({ ...form, gistId: event.target.value }))
                  }
                />
              </label>
              <label>
                文件名
                <input
                  type="text"
                  value={syncForm.fileName}
                  onChange={(event) =>
                    setSyncForm((form) => ({ ...form, fileName: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="sync-links">
              <a href={GITHUB_TOKEN_URL} target="_blank" rel="noreferrer">
                获取 GitHub Token
              </a>
              <a href={GITHUB_GISTS_URL} target="_blank" rel="noreferrer">
                创建或查看 Gist
              </a>
            </div>
            <div className="modal-footer">
              <p>
                {syncMessage}
                {lastSyncedAt ? ` 上次同步：${formatUpdatedAt(lastSyncedAt)}` : ''}
              </p>
              <button type="button" onClick={saveSyncConfig} disabled={syncStatus === 'syncing'}>
                保存并同步
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {courseViews.length > 0 ? (
        <>
          <section className={`course-collection ${layout}`} aria-label="正在学习的课程">
            {pagedCourseViews.map((view) => (
              <a
                className="course-item"
                href={view.course.url}
                key={view.course.videoId}
                title={view.course.title}
              >
                <div className="main-info">
                  <div className="title-row">
                    <h2>{view.course.title}</h2>
                    <span className="source-chip">{view.sourceLabel}</span>
                  </div>
                  <p>{view.course.currentTitle || '打开课程页继续学习'}</p>
                </div>
                <div className="meta-grid">
                  <div>
                    <span>BV号</span>
                    <strong>{view.course.videoId}</strong>
                  </div>
                  <div>
                    <span>位置</span>
                    <strong>{view.currentIndexLabel}</strong>
                  </div>
                  <div>
                    <span>更新</span>
                    <strong>{view.updatedAtLabel}</strong>
                  </div>
                </div>
                <div className="progress-block">
                  <div className="progress-head">
                    <span>
                      {formatDuration(view.course.completedSeconds)} /{' '}
                      {formatDuration(view.course.totalSeconds)}
                    </span>
                    <strong>{view.percentage}%</strong>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <div className="progress-fill" style={{ width: `${view.ratio * 100}%` }} />
                  </div>
                </div>
              </a>
            ))}
          </section>
          <section className="pagination-bar" aria-label="分页控制">
            <span>当前显示 {pageRangeLabel} 条</span>
            <div className="pagination-controls">
              <div className="list-control">
                <label htmlFor="page-size">每页展示:</label>
                <select
                  id="page-size"
                  aria-label="每页条数"
                  value={pageSize}
                  onChange={(event) => updatePageSize(Number(event.target.value) as PageSize)}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} 条
                    </option>
                  ))}
                </select>
              </div>
              <div className="pagination-actions">
                <button
                  type="button"
                  aria-label="上一页"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((page) => clampPage(page - 1, totalPages))}
                >
                  <svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="page-indicator">
                  <span>第</span>
                  <input readOnly value={safeCurrentPage} aria-label="当前页" />
                  <span>/ {totalPages} 页</span>
                </div>
                <button
                  type="button"
                  aria-label="下一页"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => clampPage(page + 1, totalPages))}
                >
                  <svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="empty-card">
          <div className="empty-icon">☆</div>
          <h2>还没有正在学习的课程</h2>
          <p>打开 Bilibili 分集视频页，填写章节匹配规则，或点击进度面板右上角星标按钮。</p>
        </section>
      )}
    </main>
  )
}

export default NewTab
