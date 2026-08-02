export type TaskStatus = 'queued' | 'processing' | 'success' | 'failed'

export type Studio = {
  id: string
  name: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  entryUrl: string | null
  linkGenApiUrl: string | null
  linkGenUsername: string | null
  linkGenPassword: string | null
}

export type User = {
  id: string
  maskedKey: string
  note: string | null
  studioId: string
  enabled: boolean
  createdAt: string
  lastUsedAt: string | null
  taskCount: number
}

export type Task = {
  id: string
  publicId?: string
  url: string
  at?: string
  cookieAt?: string
  status: TaskStatus
  userId?: string
  studioId?: string
  userLabel?: string
  queueSeq?: string
  submittedAt: string
  processingStartedAt?: string
  completedAt?: string
  feedback?: string
  version?: number
}
