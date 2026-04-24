import { getLearningCoursesStorageKey, type LearningCourseRecord } from '../learningStore'

type LessonItem = {
  title: string
  durationText: string
  durationSeconds: number
  isActive: boolean
}

type ChapterProgress = {
  name: string
  totalSeconds: number
  completedSeconds: number
  lessonCount: number
  isCurrent: boolean
}

type ProgressSnapshot = {
  lessons: LessonItem[]
  chapters: ChapterProgress[]
  currentIndex: number
  completedSeconds: number
  totalSeconds: number
  videoId: string | null
  chapterPattern: string
  chapterPatternError: string | null
}

const SELECTORS = {
  lessonList: '.video-pod__body > .list',
  lessonItem: '.video-pod__body > .list > div',
  title: '.title-txt',
  duration: '.stat-item.duration',
} as const

const ROOT_ID = 'bili-learning-progress-root'

let currentUrl = window.location.href
let observer: MutationObserver | null = null
let refreshTimer: number | null = null
let mounted = false
let lastSyncedRecord = ''

function parseDurationToSeconds(value: string): number {
  const parts = value
    .trim()
    .split(':')
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item))

  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return minutes * 60 + seconds
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
  }

  return 0
}

function getCourseTitle(lessons: LessonItem[], videoId: string | null): string {
  const rawTitle = document.querySelector('h1')?.textContent?.trim() || document.title
  const cleanTitle = rawTitle.replace(/_哔哩哔哩_bilibili$/i, '').trim()
  return cleanTitle || lessons[0]?.title || videoId || '未命名课程'
}

function getCurrentVideoId(): string | null {
  const match = window.location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i)
  return match?.[1] ?? null
}

function getChapterPatternStorageKey(videoId: string): string {
  return `blp:chapter-pattern:${videoId}`
}

function readChapterPattern(videoId: string | null): string {
  if (!videoId) {
    return ''
  }

  try {
    return window.localStorage.getItem(getChapterPatternStorageKey(videoId)) ?? ''
  } catch {
    return ''
  }
}

function saveChapterPattern(videoId: string | null, pattern: string): void {
  if (!videoId) {
    return
  }

  try {
    const storageKey = getChapterPatternStorageKey(videoId)

    if (pattern.trim()) {
      window.localStorage.setItem(storageKey, pattern)
      return
    }

    window.localStorage.removeItem(storageKey)
  } catch {
    return
  }
}

function readLearningCourses(
  callback: (courses: Record<string, LearningCourseRecord>) => void,
): void {
  chrome.storage.local.get(getLearningCoursesStorageKey(), (result) => {
    const courses = result[getLearningCoursesStorageKey()]
    callback(courses && typeof courses === 'object' ? courses : {})
  })
}

function writeLearningCourses(courses: Record<string, LearningCourseRecord>): void {
  chrome.storage.local.set({ [getLearningCoursesStorageKey()]: courses })
}

function getCourseRecord(
  snapshot: ProgressSnapshot,
  isPinned: boolean,
): LearningCourseRecord | null {
  if (!snapshot.videoId) {
    return null
  }

  return {
    videoId: snapshot.videoId,
    title: getCourseTitle(snapshot.lessons, snapshot.videoId),
    url: window.location.href,
    chapterPattern: snapshot.chapterPattern,
    isPinned,
    lessonCount: snapshot.lessons.length,
    totalSeconds: snapshot.totalSeconds,
    completedSeconds: snapshot.completedSeconds,
    currentIndex: snapshot.currentIndex,
    currentTitle:
      snapshot.currentIndex >= 0 ? (snapshot.lessons[snapshot.currentIndex]?.title ?? '') : '',
    updatedAt: Date.now(),
  }
}

function syncLearningCourse(snapshot: ProgressSnapshot): void {
  const videoId = snapshot.videoId

  if (!videoId) {
    return
  }

  readLearningCourses((courses) => {
    const existingRecord = courses[videoId]
    const shouldKeepRecord =
      snapshot.chapterPattern.trim().length > 0 || existingRecord?.isPinned === true

    if (!shouldKeepRecord) {
      if (existingRecord) {
        delete courses[videoId]
        writeLearningCourses(courses)
        lastSyncedRecord = ''
      }
      return
    }

    const nextRecord = getCourseRecord(snapshot, existingRecord?.isPinned === true)

    if (!nextRecord) {
      return
    }

    const nextSerializedRecord = JSON.stringify({ ...nextRecord, updatedAt: 0 })

    if (nextSerializedRecord === lastSyncedRecord) {
      return
    }

    courses[videoId] = nextRecord
    writeLearningCourses(courses)
    lastSyncedRecord = nextSerializedRecord
  })
}

function togglePinnedCourse(
  snapshot: ProgressSnapshot,
  callback: (isPinned: boolean) => void,
): void {
  const videoId = snapshot.videoId

  if (!videoId) {
    callback(false)
    return
  }

  readLearningCourses((courses) => {
    const existingRecord = courses[videoId]
    const nextPinned = existingRecord?.isPinned !== true
    const nextRecord = getCourseRecord(snapshot, nextPinned)

    if (!nextRecord) {
      callback(false)
      return
    }

    if (nextPinned || snapshot.chapterPattern.trim()) {
      courses[videoId] = nextRecord
    } else {
      delete courses[videoId]
    }

    writeLearningCourses(courses)
    lastSyncedRecord = ''
    callback(nextPinned)
  })
}

function updatePinButton(button: HTMLButtonElement, snapshot: ProgressSnapshot): void {
  if (!snapshot.videoId) {
    button.disabled = true
    button.textContent = '☆'
    button.title = '未识别 BV 号，无法加入学习列表'
    return
  }

  button.disabled = false
  readLearningCourses((courses) => {
    const isLearning =
      snapshot.chapterPattern.trim().length > 0 || courses[snapshot.videoId!]?.isPinned === true
    button.textContent = isLearning ? '★' : '☆'
    button.title = isLearning ? '已在学习列表中，点击取消手动记录' : '加入学习列表'
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, '\\$&')
}

function createWildcardRegex(pattern: string): RegExp {
  const wildcardPattern = pattern
    .split('*')
    .map((part) => escapeRegExp(part))
    .join('.*')

  return new RegExp(wildcardPattern, 'i')
}

function createChapterRegex(pattern: string): { regex: RegExp | null; error: string | null } {
  const trimmedPattern = pattern.trim()

  if (!trimmedPattern) {
    return { regex: null, error: null }
  }

  if (trimmedPattern.includes('*') && !trimmedPattern.includes('.*')) {
    return { regex: createWildcardRegex(trimmedPattern), error: null }
  }

  try {
    return { regex: new RegExp(trimmedPattern, 'i'), error: null }
  } catch {
    try {
      return { regex: createWildcardRegex(trimmedPattern), error: null }
    } catch {
      return { regex: null, error: '章节规则无法解析，请检查正则表达式。' }
    }
  }
}

function getChapterName(title: string, chapterRegex: RegExp | null): string {
  if (!chapterRegex) {
    return '其他'
  }

  const match = title.match(chapterRegex)
  return match?.[0]?.trim() || '其他'
}

function buildChapterProgress(
  lessons: LessonItem[],
  currentIndex: number,
  chapterRegex: RegExp | null,
): ChapterProgress[] {
  const chapters = new Map<string, ChapterProgress>()

  lessons.forEach((lesson, index) => {
    const name = getChapterName(lesson.title, chapterRegex)
    const chapter = chapters.get(name) ?? {
      name,
      totalSeconds: 0,
      completedSeconds: 0,
      lessonCount: 0,
      isCurrent: false,
    }

    chapter.totalSeconds += lesson.durationSeconds
    chapter.lessonCount += 1

    if (currentIndex >= 0 && index <= currentIndex) {
      chapter.completedSeconds += lesson.durationSeconds
    }

    if (index === currentIndex) {
      chapter.isCurrent = true
    }

    chapters.set(name, chapter)
  })

  return Array.from(chapters.values())
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes.toString().padStart(2, '0')}分`
  }

  if (minutes > 0) {
    return `${minutes}分${seconds.toString().padStart(2, '0')}秒`
  }

  return `${seconds}秒`
}

function getProgressSnapshot(): ProgressSnapshot | null {
  const nodes = Array.from(document.querySelectorAll<HTMLDivElement>(SELECTORS.lessonItem))

  if (nodes.length === 0) {
    return null
  }

  const lessons = nodes
    .map<LessonItem | null>((node) => {
      const title = node.querySelector<HTMLElement>(SELECTORS.title)?.textContent?.trim() ?? ''
      const durationText =
        node.querySelector<HTMLElement>(SELECTORS.duration)?.textContent?.trim() ?? ''

      if (!title || !durationText) {
        return null
      }

      return {
        title,
        durationText,
        durationSeconds: parseDurationToSeconds(durationText),
        isActive: node.classList.contains('active'),
      }
    })
    .filter((item): item is LessonItem => item !== null)

  if (lessons.length === 0) {
    return null
  }

  const currentIndex = lessons.findIndex((lesson) => lesson.isActive)
  const totalSeconds = lessons.reduce((sum, lesson) => sum + lesson.durationSeconds, 0)
  const completedSeconds =
    currentIndex >= 0
      ? lessons.slice(0, currentIndex + 1).reduce((sum, lesson) => sum + lesson.durationSeconds, 0)
      : 0
  const videoId = getCurrentVideoId()
  const chapterPattern = readChapterPattern(videoId)
  const { regex: chapterRegex, error: chapterPatternError } = createChapterRegex(chapterPattern)

  return {
    lessons,
    chapters: buildChapterProgress(lessons, currentIndex, chapterRegex),
    currentIndex,
    completedSeconds,
    totalSeconds,
    videoId,
    chapterPattern,
    chapterPatternError,
  }
}

function createRoot(): ShadowRoot {
  const existingRoot = document.getElementById(ROOT_ID)

  if (existingRoot?.shadowRoot) {
    return existingRoot.shadowRoot
  }

  const host = document.createElement('div')
  host.id = ROOT_ID
  document.documentElement.appendChild(host)
  return host.attachShadow({ mode: 'open' })
}

function ensureUi(): {
  button: HTMLButtonElement
  pie: HTMLElement
  progressFill: HTMLElement
  summary: HTMLElement
  currentLesson: HTMLElement
  detail: HTMLElement
  lessonCount: HTMLElement
  lessonIndex: HTMLElement
  pinButton: HTMLButtonElement
  patternInput: HTMLInputElement
  patternHint: HTMLElement
  chapterList: HTMLElement
} {
  const root = createRoot()

  if (!mounted) {
    const style = document.createElement('style')
    style.textContent = `
      :host {
        all: initial;
      }

      .blp-shell {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #f8fafc;
      }

      .blp-fab {
        width: 56px;
        height: 56px;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
        background: linear-gradient(135deg, #fb7299 0%, #ff9f7f 100%);
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        box-shadow: 0 18px 45px rgba(251, 114, 153, 0.35);
      }

      .blp-shell:hover .blp-panel,
      .blp-shell:focus-within .blp-panel {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .blp-panel {
        position: absolute;
        right: 0;
        bottom: 72px;
        width: 360px;
        padding: 18px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        background:
          radial-gradient(circle at top right, rgba(251, 114, 153, 0.24), transparent 36%),
          linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.32);
        backdrop-filter: blur(18px);
        opacity: 0;
        transform: translateY(12px) scale(0.98);
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease;
      }

      .blp-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .blp-title {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
      }

      .blp-subtitle {
        color: rgba(226, 232, 240, 0.78);
        font-size: 12px;
      }

      .blp-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .blp-pin {
        width: 30px;
        height: 30px;
        border: 1px solid rgba(226, 232, 240, 0.16);
        border-radius: 999px;
        cursor: pointer;
        background: rgba(15, 23, 42, 0.42);
        color: #fbbf24;
        font-size: 16px;
        line-height: 1;
      }

      .blp-pin:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .blp-grid {
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 16px;
        align-items: center;
      }

      .blp-pie {
        --progress-deg: 0deg;
        width: 92px;
        height: 92px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background:
          radial-gradient(circle closest-side, #0f172a 68%, transparent 70% 100%),
          conic-gradient(#fb7299 0deg, #ff9f7f var(--progress-deg), rgba(148, 163, 184, 0.18) var(--progress-deg), rgba(148, 163, 184, 0.18) 360deg);
      }

      .blp-pie-label {
        font-size: 18px;
        font-weight: 700;
      }

      .blp-summary {
        margin: 0 0 8px;
        font-size: 14px;
        line-height: 1.5;
      }

      .blp-current {
        margin: 0 0 10px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(226, 232, 240, 0.82);
      }

      .blp-progress {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.18);
      }

      .blp-progress-fill {
        width: 0;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #fb7299 0%, #ff9f7f 100%);
        transition: width 180ms ease;
      }

      .blp-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }

      .blp-card {
        padding: 12px;
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.42);
      }

      .blp-label {
        display: block;
        margin-bottom: 6px;
        font-size: 11px;
        color: rgba(226, 232, 240, 0.72);
      }

      .blp-value {
        font-size: 14px;
        font-weight: 700;
      }

      .blp-chapter-control {
        margin-top: 14px;
      }

      .blp-input {
        box-sizing: border-box;
        width: 100%;
        height: 34px;
        margin-top: 8px;
        padding: 0 10px;
        border: 1px solid rgba(226, 232, 240, 0.16);
        border-radius: 10px;
        outline: none;
        background: rgba(15, 23, 42, 0.5);
        color: #f8fafc;
        font-size: 12px;
      }

      .blp-input:focus {
        border-color: rgba(251, 114, 153, 0.72);
        box-shadow: 0 0 0 3px rgba(251, 114, 153, 0.16);
      }

      .blp-hint {
        min-height: 16px;
        margin-top: 6px;
        color: rgba(226, 232, 240, 0.66);
        font-size: 11px;
        line-height: 1.45;
      }

      .blp-hint-error {
        color: #fca5a5;
      }

      .blp-chapters {
        display: grid;
        gap: 8px;
        max-height: 220px;
        overflow: auto;
        margin-top: 12px;
        padding-right: 2px;
      }

      .blp-chapter {
        padding: 10px;
        border: 1px solid rgba(226, 232, 240, 0.08);
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.32);
      }

      .blp-chapter-current {
        border-color: rgba(251, 114, 153, 0.42);
        background: rgba(251, 114, 153, 0.12);
      }

      .blp-chapter-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }

      .blp-chapter-name {
        overflow: hidden;
        color: #f8fafc;
        font-size: 12px;
        font-weight: 700;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .blp-chapter-meta {
        flex: 0 0 auto;
        color: rgba(226, 232, 240, 0.72);
        font-size: 11px;
      }

      .blp-chapter-progress {
        height: 6px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.16);
      }

      .blp-chapter-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #fb7299 0%, #ff9f7f 100%);
      }
    `

    const wrapper = document.createElement('div')
    wrapper.className = 'blp-shell'
    wrapper.innerHTML = `
      <button class="blp-fab" type="button" aria-label="查看 Bilibili 学习进度">进度</button>
      <section class="blp-panel" aria-live="polite">
        <div class="blp-head">
          <div>
            <h2 class="blp-title">学习总进度</h2>
            <div class="blp-subtitle">按当前激活课时向前累计</div>
          </div>
          <div class="blp-actions">
            <button class="blp-pin" type="button" aria-label="加入学习列表" title="加入学习列表">☆</button>
            <div class="blp-subtitle blp-lesson-count">0 / 0 节</div>
          </div>
        </div>
        <div class="blp-grid">
          <div class="blp-pie" role="img" aria-label="当前学习进度饼图">
            <span class="blp-pie-label">0%</span>
          </div>
          <div>
            <p class="blp-summary">等待课程列表加载...</p>
            <p class="blp-current">请打开带有分集课程列表的 Bilibili 视频页。</p>
            <div class="blp-progress">
              <div class="blp-progress-fill"></div>
            </div>
          </div>
        </div>
        <div class="blp-meta">
          <div class="blp-card">
            <span class="blp-label">已学习时长</span>
            <span class="blp-value blp-detail">0秒 / 0秒</span>
          </div>
          <div class="blp-card">
            <span class="blp-label">当前课时</span>
            <span class="blp-value blp-index">未识别</span>
          </div>
        </div>
        <div class="blp-chapter-control">
          <label class="blp-label" for="blp-chapter-pattern">章节匹配规则</label>
          <input
            id="blp-chapter-pattern"
            class="blp-input"
            type="text"
            placeholder="例如：第.*章 或 第*章"
            autocomplete="off"
            spellcheck="false"
          />
          <div class="blp-hint">按 BV 号保存在 localStorage，未匹配视频归入“其他”。</div>
        </div>
        <div class="blp-chapters" aria-label="章节进度列表"></div>
      </section>
    `

    root.append(style, wrapper)
    mounted = true
  }

  return {
    button: root.querySelector<HTMLButtonElement>('.blp-fab')!,
    pie: root.querySelector<HTMLElement>('.blp-pie')!,
    progressFill: root.querySelector<HTMLElement>('.blp-progress-fill')!,
    summary: root.querySelector<HTMLElement>('.blp-summary')!,
    currentLesson: root.querySelector<HTMLElement>('.blp-current')!,
    detail: root.querySelector<HTMLElement>('.blp-detail')!,
    lessonCount: root.querySelector<HTMLElement>('.blp-lesson-count')!,
    lessonIndex: root.querySelector<HTMLElement>('.blp-index')!,
    pinButton: root.querySelector<HTMLButtonElement>('.blp-pin')!,
    patternInput: root.querySelector<HTMLInputElement>('.blp-input')!,
    patternHint: root.querySelector<HTMLElement>('.blp-hint')!,
    chapterList: root.querySelector<HTMLElement>('.blp-chapters')!,
  }
}

function renderChapters(chapterList: HTMLElement, chapters: ChapterProgress[]): void {
  chapterList.replaceChildren(
    ...chapters.map((chapter) => {
      const ratio = chapter.totalSeconds > 0 ? chapter.completedSeconds / chapter.totalSeconds : 0
      const percentage = Math.min(100, Math.round(ratio * 100))
      const item = document.createElement('div')
      item.className = chapter.isCurrent ? 'blp-chapter blp-chapter-current' : 'blp-chapter'
      item.innerHTML = `
        <div class="blp-chapter-row">
          <span class="blp-chapter-name"></span>
          <span class="blp-chapter-meta"></span>
        </div>
        <div class="blp-chapter-progress" aria-hidden="true">
          <div class="blp-chapter-fill"></div>
        </div>
      `

      item.querySelector<HTMLElement>('.blp-chapter-name')!.textContent = chapter.name
      item.querySelector<HTMLElement>('.blp-chapter-meta')!.textContent =
        `${percentage}% · ${chapter.lessonCount}节 · ${formatDuration(chapter.completedSeconds)} / ${formatDuration(
          chapter.totalSeconds,
        )}`
      item.querySelector<HTMLElement>('.blp-chapter-fill')!.style.width = `${ratio * 100}%`
      return item
    }),
  )
}

function bindPatternInput(input: HTMLInputElement): void {
  if (input.dataset.blpBound === 'true') {
    return
  }

  input.dataset.blpBound = 'true'
  input.addEventListener('input', () => {
    saveChapterPattern(getCurrentVideoId(), input.value)
    lastSyncedRecord = ''
    refresh()
  })
}

function bindPinButton(button: HTMLButtonElement): void {
  if (button.dataset.blpBound === 'true') {
    return
  }

  button.dataset.blpBound = 'true'
  button.addEventListener('click', () => {
    const snapshot = getProgressSnapshot()

    if (!snapshot) {
      return
    }

    togglePinnedCourse(snapshot, () => {
      refresh()
    })
  })
}

function render(snapshot: ProgressSnapshot | null): void {
  const {
    button,
    pie,
    progressFill,
    summary,
    currentLesson,
    detail,
    lessonCount,
    lessonIndex,
    pinButton,
    patternInput,
    patternHint,
    chapterList,
  } = ensureUi()

  bindPatternInput(patternInput)
  bindPinButton(pinButton)

  if (!snapshot) {
    button.hidden = true
    return
  }

  button.hidden = false

  const {
    lessons,
    chapters,
    currentIndex,
    completedSeconds,
    totalSeconds,
    videoId,
    chapterPattern,
    chapterPatternError,
  } = snapshot
  const ratio = totalSeconds > 0 ? completedSeconds / totalSeconds : 0
  const percentage = Math.min(100, Math.round(ratio * 100))

  pie.style.setProperty('--progress-deg', `${ratio * 360}deg`)
  pie.querySelector('span')!.textContent = `${percentage}%`
  progressFill.style.width = `${ratio * 100}%`
  detail.textContent = `${formatDuration(completedSeconds)} / ${formatDuration(totalSeconds)}`
  lessonCount.textContent =
    currentIndex >= 0 ? `${currentIndex + 1} / ${lessons.length} 节` : `0 / ${lessons.length} 节`
  if (patternInput.value !== chapterPattern) {
    patternInput.value = chapterPattern
  }

  patternInput.disabled = !videoId
  patternHint.textContent = chapterPatternError
    ? chapterPatternError
    : videoId
      ? `已按 ${videoId} 保存，未匹配视频归入“其他”。`
      : '未识别 BV 号，暂时无法保存章节规则。'
  patternHint.classList.toggle('blp-hint-error', chapterPatternError !== null)
  renderChapters(chapterList, chapters)
  syncLearningCourse(snapshot)
  updatePinButton(pinButton, snapshot)

  if (currentIndex >= 0) {
    const currentLessonTitle = lessons[currentIndex]?.title ?? '未知课时'
    lessonIndex.textContent = `第 ${currentIndex + 1} 节`
    summary.textContent = `当前已累计学习 ${formatDuration(completedSeconds)}，占总课程的 ${percentage}%。`
    currentLesson.textContent = `正在学习：${currentLessonTitle}`
  } else {
    lessonIndex.textContent = '未识别'
    summary.textContent = '已识别课程列表，但还没有找到当前激活课时。'
    currentLesson.textContent = '请展开课程列表后重试。'
  }
}

function refresh(): void {
  render(getProgressSnapshot())
}

function startObserver(): void {
  observer?.disconnect()

  observer = new MutationObserver(() => {
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer)
    }

    refreshTimer = window.setTimeout(() => {
      refresh()
    }, 120)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  })
}

function watchLocationChanges(): void {
  window.setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href
      refresh()
    }
  }, 500)
}

function init(): void {
  if (!window.location.href.startsWith('https://www.bilibili.com/video/')) {
    return
  }

  ensureUi()
  refresh()
  startObserver()
  watchLocationChanges()
}

init()
