export type TaskStatus = 'queued' | 'processing' | 'success' | 'failed'

export type Studio = {
  id: string
  name: string
  registrationCode: string
  accessToken: string
  enabled: boolean
  createdAt: string
}

export type User = {
  id: string
  username: string
  password: string
  studioId: string
  enabled: boolean
  createdAt: string
}

export type Task = {
  id: string
  url: string
  status: TaskStatus
  userId: string
  studioId: string
  submittedAt: string
  processingStartedAt?: string
  completedAt?: string
}

export type Admin = {
  id: string
  username: string
  password: string
}

export type PrototypeState = {
  studios: Studio[]
  users: User[]
  tasks: Task[]
  admins: Admin[]
}
