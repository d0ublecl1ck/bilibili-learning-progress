type LessonItem = {
  title: string
  durationText: string
  durationSeconds: number
  isActive: boolean
}

type ProgressSnapshot = {
  lessons: LessonItem[]
  currentIndex: number
  completedSeconds: number
  totalSeconds: number
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
      const durationText = node.querySelector<HTMLElement>(SELECTORS.duration)?.textContent?.trim() ?? ''

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

  return {
    lessons,
    currentIndex,
    completedSeconds,
    totalSeconds,
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
        width: 320px;
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
          <div class="blp-subtitle blp-lesson-count">0 / 0 节</div>
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
  }
}

function render(snapshot: ProgressSnapshot | null): void {
  const { button, pie, progressFill, summary, currentLesson, detail, lessonCount, lessonIndex } = ensureUi()

  if (!snapshot) {
    button.hidden = true
    return
  }

  button.hidden = false

  const { lessons, currentIndex, completedSeconds, totalSeconds } = snapshot
  const ratio = totalSeconds > 0 ? completedSeconds / totalSeconds : 0
  const percentage = Math.min(100, Math.round(ratio * 100))

  pie.style.setProperty('--progress-deg', `${ratio * 360}deg`)
  pie.querySelector('span')!.textContent = `${percentage}%`
  progressFill.style.width = `${ratio * 100}%`
  detail.textContent = `${formatDuration(completedSeconds)} / ${formatDuration(totalSeconds)}`
  lessonCount.textContent =
    currentIndex >= 0 ? `${currentIndex + 1} / ${lessons.length} 节` : `0 / ${lessons.length} 节`

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
