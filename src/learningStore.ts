export type LearningCourseRecord = {
  videoId: string
  title: string
  url: string
  chapterPattern: string
  isPinned: boolean
  lessonCount: number
  totalSeconds: number
  completedSeconds: number
  currentIndex: number
  currentTitle: string
  createdAt: number
  updatedAt: number
}

export const LEARNING_COURSES_STORAGE_KEY = 'blp:learning-courses'

export function getLearningCoursesStorageKey(): string {
  return LEARNING_COURSES_STORAGE_KEY
}
