import { getLearningCoursesStorageKey, type LearningCourseRecord } from './learningStore'

export type GistSyncConfig = {
  token: string
  gistId: string
  fileName: string
}

export type GistSyncData = {
  schemaVersion: 1
  updatedAt: number
  courses: Record<string, LearningCourseRecord>
  preferences: {
    newtabLayout: 'grid' | 'list'
  }
}

export type GistSyncResult = {
  pulled: boolean
  pushed: boolean
  message: string
}

export const GIST_SYNC_CONFIG_STORAGE_KEY = 'blp:gist-sync-config'
export const GIST_SYNC_META_STORAGE_KEY = 'blp:gist-sync-meta'
export const DEFAULT_GIST_SYNC_FILE_NAME = 'bilibili-learning-progress.json'

const GITHUB_GIST_API_BASE = 'https://api.github.com/gists'

function assertValidConfig(config: GistSyncConfig): void {
  if (!config.token.trim()) {
    throw new Error('请先填写 GitHub Token。')
  }

  if (!config.gistId.trim()) {
    throw new Error('请先填写 Gist ID。')
  }

  if (!config.fileName.trim()) {
    throw new Error('请先填写 Gist 文件名。')
  }
}

function getStoredLayout(): 'grid' | 'list' {
  const storedLayout = window.localStorage.getItem('blp:newtab-layout')
  return storedLayout === 'grid' || storedLayout === 'list' ? storedLayout : 'list'
}

function getLocalCourses(): Promise<Record<string, LearningCourseRecord>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(getLearningCoursesStorageKey(), (result) => {
      const courses = result[getLearningCoursesStorageKey()]
      resolve(courses && typeof courses === 'object' ? courses : {})
    })
  })
}

function setLocalCourses(courses: Record<string, LearningCourseRecord>): Promise<void> {
  return chrome.storage.local.set({ [getLearningCoursesStorageKey()]: courses })
}

export function getGistSyncConfig(): Promise<GistSyncConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(GIST_SYNC_CONFIG_STORAGE_KEY, (result) => {
      const config = result[GIST_SYNC_CONFIG_STORAGE_KEY]

      if (!config || typeof config !== 'object') {
        resolve(null)
        return
      }

      resolve({
        token: typeof config.token === 'string' ? config.token : '',
        gistId: typeof config.gistId === 'string' ? config.gistId : '',
        fileName:
          typeof config.fileName === 'string' && config.fileName.trim()
            ? config.fileName
            : DEFAULT_GIST_SYNC_FILE_NAME,
      })
    })
  })
}

export function setGistSyncConfig(config: GistSyncConfig): Promise<void> {
  return chrome.storage.local.set({
    [GIST_SYNC_CONFIG_STORAGE_KEY]: {
      token: config.token.trim(),
      gistId: config.gistId.trim(),
      fileName: config.fileName.trim() || DEFAULT_GIST_SYNC_FILE_NAME,
    },
  })
}

export function getLocalSyncData(courses: Record<string, LearningCourseRecord>): GistSyncData {
  return {
    schemaVersion: 1,
    updatedAt: Date.now(),
    courses,
    preferences: {
      newtabLayout: getStoredLayout(),
    },
  }
}

function parseRemoteSyncData(content: string): GistSyncData | null {
  try {
    const data = JSON.parse(content) as Partial<GistSyncData>

    if (data.schemaVersion !== 1 || !data.courses || typeof data.courses !== 'object') {
      return null
    }

    return {
      schemaVersion: 1,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
      courses: data.courses as Record<string, LearningCourseRecord>,
      preferences: {
        newtabLayout: data.preferences?.newtabLayout === 'grid' ? 'grid' : 'list',
      },
    }
  } catch {
    return null
  }
}

function mergeCourses(
  localCourses: Record<string, LearningCourseRecord>,
  remoteCourses: Record<string, LearningCourseRecord>,
): Record<string, LearningCourseRecord> {
  const mergedCourses = { ...localCourses }

  Object.entries(remoteCourses).forEach(([videoId, remoteCourse]) => {
    const localCourse = mergedCourses[videoId]

    if (!localCourse || remoteCourse.updatedAt > localCourse.updatedAt) {
      mergedCourses[videoId] = remoteCourse
    }
  })

  return mergedCourses
}

async function requestGist(config: GistSyncConfig): Promise<Record<string, { content?: string }>> {
  assertValidConfig(config)

  const response = await fetch(`${GITHUB_GIST_API_BASE}/${encodeURIComponent(config.gistId)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw new Error(`拉取 Gist 失败：${response.status}`)
  }

  const gist = await response.json()
  return gist.files && typeof gist.files === 'object' ? gist.files : {}
}

async function updateGist(config: GistSyncConfig, data: GistSyncData): Promise<void> {
  assertValidConfig(config)

  const response = await fetch(`${GITHUB_GIST_API_BASE}/${encodeURIComponent(config.gistId)}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      files: {
        [config.fileName]: {
          content: `${JSON.stringify(data, null, 2)}\n`,
        },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`推送 Gist 失败：${response.status}`)
  }
}

export async function pullMergePushGist(config: GistSyncConfig): Promise<GistSyncResult> {
  assertValidConfig(config)

  const localCourses = await getLocalCourses()
  const files = await requestGist(config)
  const remoteContent = files[config.fileName]?.content
  const remoteData = typeof remoteContent === 'string' ? parseRemoteSyncData(remoteContent) : null
  const mergedCourses = remoteData ? mergeCourses(localCourses, remoteData.courses) : localCourses

  await setLocalCourses(mergedCourses)

  const nextData = getLocalSyncData(mergedCourses)
  await updateGist(config, nextData)
  await chrome.storage.local.set({
    [GIST_SYNC_META_STORAGE_KEY]: {
      lastSyncedAt: nextData.updatedAt,
      status: 'synced',
      message: remoteData ? '已自动拉取并推送最新数据。' : '已创建 Gist 同步文件。',
    },
  })

  return {
    pulled: Boolean(remoteData),
    pushed: true,
    message: remoteData ? '已自动拉取并推送最新数据。' : '已创建 Gist 同步文件。',
  }
}

export async function pushLocalToGist(config: GistSyncConfig): Promise<GistSyncResult> {
  assertValidConfig(config)

  const courses = await getLocalCourses()
  const data = getLocalSyncData(courses)
  await updateGist(config, data)
  await chrome.storage.local.set({
    [GIST_SYNC_META_STORAGE_KEY]: {
      lastSyncedAt: data.updatedAt,
      status: 'synced',
      message: '本地变化已自动推送。',
    },
  })

  return {
    pulled: false,
    pushed: true,
    message: '本地变化已自动推送。',
  }
}
