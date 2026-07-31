export type TaskStatus = 'queued' | 'processing' | 'success' | 'failed'

export type Studio = {
  id: string
  name: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type User = {
  id: string
  username: string
  studioId: string
  enabled: boolean
  createdAt: string
}

export type Task = {
  id: string
  publicId?: string
  url: string
  status: TaskStatus
  userId?: string
  studioId?: string
  username?: string
  queueSeq?: string
  submittedAt: string
  processingStartedAt?: string
  completedAt?: string
  feedback?: string
  version?: number
}
