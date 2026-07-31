import type { Task, TaskStatus, User } from '../domain/models'
import { completeTaskState, openTaskState } from '../domain/taskRules'
import { loadState, resetDemoState, saveState } from './storage'

export class PrototypeRepository {
  getState() {
    return loadState()
  }

  reset() {
    return resetDemoState()
  }

  getStudioByRegistrationCode(code: string) {
    return loadState().studios.find(
      (studio) => studio.registrationCode === code && studio.enabled,
    )
  }

  getStudioByAccessToken(token: string) {
    return loadState().studios.find(
      (studio) => studio.accessToken === token && studio.enabled,
    )
  }

  authenticateUser(username: string, password: string) {
    return loadState().users.find(
      (user) =>
        user.username === username && user.password === password && user.enabled,
    )
  }

  authenticateAdmin(username: string, password: string) {
    return loadState().admins.find(
      (admin) => admin.username === username && admin.password === password,
    )
  }

  registerUser(code: string, username: string, password: string): User {
    const state = loadState()
    const studio = state.studios.find(
      (item) => item.registrationCode === code && item.enabled,
    )

    if (!studio) {
      throw new Error('注册链接已失效')
    }

    if (
      state.users.some(
        (user) => user.username.toLowerCase() === username.toLowerCase(),
      )
    ) {
      throw new Error('账号已存在')
    }

    if (password.length < 6) {
      throw new Error('密码至少需要 6 位')
    }

    const user: User = {
      id: crypto.randomUUID(),
      username,
      password,
      studioId: studio.id,
      enabled: true,
      createdAt: new Date().toISOString(),
    }

    saveState({ ...state, users: [...state.users, user] })
    return user
  }

  createTasks(
    userId: string,
    urls: string[],
    now = new Date().toISOString(),
  ): Task[] {
    const state = loadState()
    const user = state.users.find((item) => item.id === userId && item.enabled)

    if (!user) {
      throw new Error('用户不存在或已停用')
    }

    const tasks = urls.map(
      (url): Task => ({
        id: `TASK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        url,
        status: 'queued',
        userId,
        studioId: user.studioId,
        submittedAt: now,
      }),
    )

    saveState({ ...state, tasks: [...state.tasks, ...tasks] })
    return tasks
  }

  getUserTasks(userId: string) {
    return loadState()
      .tasks.filter((task) => task.userId === userId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  }

  getStudioTasks(studioId: string) {
    return loadState()
      .tasks.filter((task) => task.studioId === studioId)
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  }

  openTask(
    taskId: string,
    studioId: string,
    now = new Date().toISOString(),
  ) {
    const state = loadState()
    const task = state.tasks.find(
      (item) => item.id === taskId && item.studioId === studioId,
    )

    if (!task) {
      throw new Error('任务不存在')
    }

    const updated = openTaskState(task, now)
    saveState({
      ...state,
      tasks: state.tasks.map((item) => (item.id === taskId ? updated : item)),
    })
    return updated
  }

  completeTask(
    taskId: string,
    studioId: string,
    result: Extract<TaskStatus, 'success' | 'failed'>,
    now = new Date().toISOString(),
  ) {
    const state = loadState()
    const task = state.tasks.find(
      (item) => item.id === taskId && item.studioId === studioId,
    )

    if (!task) {
      throw new Error('任务不存在')
    }

    const updated = completeTaskState(task, result, now)
    saveState({
      ...state,
      tasks: state.tasks.map((item) => (item.id === taskId ? updated : item)),
    })
    return updated
  }

  setUserEnabled(userId: string, enabled: boolean): void {
    const state = loadState()
    saveState({
      ...state,
      users: state.users.map((user) =>
        user.id === userId ? { ...user, enabled } : user,
      ),
    })
  }

  updateStudioName(studioId: string, name: string): void {
    const state = loadState()
    saveState({
      ...state,
      studios: state.studios.map((studio) =>
        studio.id === studioId ? { ...studio, name } : studio,
      ),
    })
  }
}
