import { vi } from 'vitest'
import type { Task, TaskStatus, User } from '../domain/models'

type Principal = {
  id: string
  role: 'user' | 'admin' | 'studio'
  username?: string
  userLabel?: string
  studioId?: string
}

const now = '2026-08-01T00:00:00.000Z'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const STUDIO_ID = '22222222-2222-4222-8222-222222222222'
const ADMIN_ID = '33333333-3333-4333-8333-333333333333'
const CREATED_USER_ID = '44444444-4444-4444-8444-444444444444'

function fixtureTask(id: string, status: TaskStatus, index: number, at?: string): Task {
  return {
    id,
    publicId: id,
    url: `https://example.com/${status}`,
    at,
    status,
    queueSeq: String(index),
    submittedAt: `2026-08-01T0${index}:00:00.000Z`,
    ...(status !== 'queued' ? { processingStartedAt: `2026-08-01T0${index}:05:00.000Z`, version: 1 } : { version: 0 }),
    ...(status === 'success' || status === 'failed' ? { completedAt: `2026-08-01T0${index}:10:00.000Z`, version: 2 } : {}),
    userLabel: '客户 A',
  }
}

export const mockApiState: {
  userSession: Principal | null
  adminSession: Principal | null
  studioSession: Principal | null
  tasks: Task[]
  users: User[]
  studio: { id: string; name: string; enabled: boolean; createdAt: string; updatedAt: string; entryUrl: string | null }
} = {
  userSession: null,
  adminSession: null,
  studioSession: null,
  tasks: [],
  users: [],
  studio: { id: '', name: '', enabled: true, createdAt: now, updatedAt: now, entryUrl: null },
}

export function resetMockApiState() {
  mockApiState.userSession = { id: USER_ID, role: 'user', userLabel: '客户 A', studioId: STUDIO_ID }
  mockApiState.adminSession = { id: ADMIN_ID, role: 'admin', username: 'admin' }
  mockApiState.studioSession = { id: STUDIO_ID, role: 'studio', studioId: STUDIO_ID }
  mockApiState.tasks = [
    fixtureTask('TASK-1001', 'queued', 1, 'user@example.com'),
    fixtureTask('TASK-1002', 'processing', 2),
    fixtureTask('TASK-1003', 'success', 3, '@testuser'),
    fixtureTask('TASK-1004', 'failed', 4),
  ]
  mockApiState.users = [{
    id: USER_ID,
    maskedKey: 'USR-ABCD-••••-••••-PQRS',
    note: '客户 A',
    studioId: STUDIO_ID,
    enabled: true,
    createdAt: now,
    lastUsedAt: now,
    taskCount: 4,
  }]
  mockApiState.studio = {
    id: STUDIO_ID, name: '演示工作室', enabled: true, createdAt: now, updatedAt: now,
    entryUrl: 'http://localhost/studio/studio-demo-8f3c2a',
  }
}

function json(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { 'content-type': 'application/json' },
  })
}

function unauthorized() {
  return json({ error: { code: 'AUTH_REQUIRED', message: '登录状态已失效', requestId: 'test-request' } }, 401)
}

function apiTask(task: Task) {
  return {
    publicId: task.id,
    url: task.url,
    ...(task.at ? { at: task.at } : {}),
    status: task.status,
    queueSeq: task.queueSeq ?? '1',
    submittedAt: task.submittedAt,
    ...(task.processingStartedAt ? { processingStartedAt: task.processingStartedAt } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt } : {}),
    ...(task.feedback ? { feedback: task.feedback } : {}),
    ...(task.userLabel ? { userLabel: task.userLabel } : {}),
    version: task.version ?? 0,
  }
}

function studioApiTask(task: Task) {
  const { userLabel: _userLabel, ...rest } = apiTask(task)
  return rest
}

export function installMockApi() {
  resetMockApiState()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const path = url.pathname
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}

    if (path === '/api/v1/csrf') return json({ token: 'csrf-token-value-that-is-long-enough' })
    if (path === '/api/v1/auth/user/session') return mockApiState.userSession ? json({ principal: mockApiState.userSession }) : unauthorized()
    if (path === '/api/v1/auth/admin/session') return mockApiState.adminSession ? json({ principal: mockApiState.adminSession }) : unauthorized()
    if (path === '/api/v1/auth/studio/session') return mockApiState.studioSession ? json({ principal: mockApiState.studioSession }) : unauthorized()
    if (path === '/api/v1/auth/user/key-login' && method === 'POST') {
      mockApiState.userSession = { id: USER_ID, role: 'user', userLabel: '客户 A', studioId: STUDIO_ID }
      return json({ principal: mockApiState.userSession })
    }
    if (path === '/api/v1/auth/admin/login' && method === 'POST') {
      mockApiState.adminSession = { id: ADMIN_ID, role: 'admin', username: String(body.username) }
      return json({ principal: mockApiState.adminSession })
    }
    if (path === '/api/v1/auth/user/logout' && method === 'POST') { mockApiState.userSession = null; return json(undefined, 204) }
    if (path === '/api/v1/auth/admin/logout' && method === 'POST') { mockApiState.adminSession = null; return json(undefined, 204) }
    if (path.startsWith('/api/v1/auth/studio/exchange/') && method === 'POST') {
      if (path.endsWith('/unknown')) return json({ error: { code: 'STUDIO_LINK_INVALID', message: '工作室入口无效', requestId: 'test-request' } }, 404)
      mockApiState.studioSession = { id: STUDIO_ID, role: 'studio', studioId: STUDIO_ID }
      return json({ principal: mockApiState.studioSession })
    }

    if (path === '/api/v1/user/task-batches' && method === 'POST') {
      return json({ batchId: '11111111-1111-4111-8111-111111111111', requestedCount: body.requestedCount, createdCount: 0 }, 201)
    }
    if (path.includes('/api/v1/user/task-batches/') && path.endsWith('/chunks') && method === 'POST') {
      const urls = body.urls as string[]
      const created = urls.map((taskUrl, index) => {
        const id = `TASK-NEW-${mockApiState.tasks.length + index + 1}`
        return { id, taskUrl }
      })
      for (const item of created) {
        mockApiState.tasks.push({
          id: item.id, publicId: item.id, url: item.taskUrl,
          ...(typeof body.at === 'string' && body.at.trim() ? { at: body.at.trim() } : {}),
          status: 'queued',
          queueSeq: String(mockApiState.tasks.length + 1), submittedAt: new Date().toISOString(),
          version: 0, userLabel: '客户 A',
        })
      }
      return json({
        batchId: body.batchId,
        createdCount: created.length,
        cumulativeCreatedCount: created.length,
        taskPublicIds: created.map((item) => item.id),
      }, 201)
    }
    if (path === '/api/v1/user/tasks') {
      return json({ items: [...mockApiState.tasks].reverse().map(apiTask), page: { hasMore: false, nextCursor: null } })
    }
    const userTaskMatch = path.match(/^\/api\/v1\/user\/tasks\/([^/]+)$/)
    if (userTaskMatch) {
      const id = decodeURIComponent(userTaskMatch[1])
      const index = mockApiState.tasks.findIndex((task) => task.id === id)
      if (index < 0) return json({ error: { code: 'NOT_FOUND', message: '任务不存在', requestId: 'test-request' } }, 404)
      if (method === 'PATCH') {
        const task = mockApiState.tasks[index]
        if (task.status !== 'queued' && task.status !== 'failed') return json({ error: { code: 'TASK_NOT_EDITABLE', message: '只有排队中或失败的任务可以编辑', requestId: 'test-request' } }, 409)
        task.url = String(body.url)
        task.at = typeof body.at === 'string' ? body.at : undefined
        task.status = 'queued'
        task.processingStartedAt = undefined
        task.completedAt = undefined
        task.feedback = undefined
        task.version = (task.version ?? 0) + 1
        return json(apiTask(task))
      }
      if (method === 'DELETE') {
        const task = mockApiState.tasks[index]
        if (task.status !== 'queued' && task.status !== 'failed') return json({ error: { code: 'TASK_NOT_DELETABLE', message: '只有排队中或失败的任务可以删除', requestId: 'test-request' } }, 409)
        mockApiState.tasks.splice(index, 1)
        return json(null, 204)
      }
    }
    if (path === '/api/v1/studio/tasks') {
      return json({ items: mockApiState.tasks.map(studioApiTask), page: { hasMore: false, nextCursor: null } })
    }
    const studioTaskMatch = path.match(/^\/api\/v1\/studio\/tasks\/([^/]+)\/(open|complete|next)$/)
    if (studioTaskMatch && method === 'POST') {
      const id = decodeURIComponent(studioTaskMatch[1])
      const action = studioTaskMatch[2]
      const index = mockApiState.tasks.findIndex((task) => task.id === id)
      if (index < 0) return json({ error: { code: 'NOT_FOUND', message: '任务不存在', requestId: 'test-request' } }, 404)
      if (action === 'next') {
        const next = mockApiState.tasks[index + 1]
        if (!next) return json({ task: null })
        if (next.status === 'queued') {
          next.status = 'processing'; next.processingStartedAt = new Date().toISOString(); next.version = (next.version ?? 0) + 1
        }
        return json({ task: studioApiTask(next) })
      }
      const task = mockApiState.tasks[index]
      if (action === 'open' && task.status === 'queued') {
        task.status = 'processing'; task.processingStartedAt = new Date().toISOString(); task.version = (task.version ?? 0) + 1
      }
      if (action === 'complete') {
        task.status = body.result as 'success' | 'failed'; task.feedback = String(body.feedback ?? ''); task.completedAt = new Date().toISOString(); task.version = (task.version ?? 0) + 1
      }
      return json(studioApiTask(task))
    }

    if (path === '/api/v1/admin/dashboard') {
      const count = (status: TaskStatus) => mockApiState.tasks.filter((task) => task.status === status).length
      return json({ users: mockApiState.users.length, tasks: mockApiState.tasks.length, queued: count('queued'), processing: count('processing'), success: count('success'), failed: count('failed') })
    }
    if (path === '/api/v1/admin/trends') {
      const days = Number(url.searchParams.get('days') ?? 30)
      const daily: Array<{ date: string; submitted: number; completed: number; success: number; failed: number }> = []
      const cursor = new Date()
      cursor.setDate(cursor.getDate() - days + 1)
      for (let i = 0; i < days; i++) {
        const date = cursor.toISOString().slice(0, 10)
        // Deterministic values so tests can assert on specific days
        const n = (i * 7 + 3) % 20
        const submitted = i === days - 1 ? 4 : i === days - 2 ? 3 : 2 + (n % 3)
        const completed = i === days - 1 ? 3 : i === days - 2 ? 2 : 1 + (n % 2)
        const success = i === days - 1 ? 2 : i === days - 2 ? 2 : (n % 2)
        const failed = completed - success
        daily.push({ date, submitted, completed, success, failed })
        cursor.setDate(cursor.getDate() + 1)
      }
      return json({ daily })
    }
    if (path === '/api/v1/admin/tasks') {
      const status = url.searchParams.get('status')
      const search = url.searchParams.get('search')?.toLowerCase()
      const tasks = [...mockApiState.tasks].reverse().filter((task) => (!status || task.status === status) && (!search || task.url.toLowerCase().includes(search) || task.id.toLowerCase().includes(search) || task.userLabel?.toLowerCase().includes(search)))
      return json({ items: tasks.map(apiTask), page: { hasMore: false, nextCursor: null } })
    }
    if (path.startsWith('/api/v1/admin/tasks/')) {
      const id = decodeURIComponent(path.split('/').at(-1)!)
      const index = mockApiState.tasks.findIndex((item) => item.id === id)
      if (index < 0) return json({ error: { code: 'NOT_FOUND', message: '任务不存在', requestId: 'test-request' } }, 404)
      if (method === 'PATCH') {
        const task = mockApiState.tasks[index]
        if (task.status !== 'queued' && task.status !== 'failed') return json({ error: { code: 'TASK_NOT_EDITABLE', message: '只有排队中或失败的任务可以编辑', requestId: 'test-request' } }, 409)
        task.url = String(body.url)
        task.at = typeof body.at === 'string' ? body.at : undefined
        task.status = 'queued'
        task.processingStartedAt = undefined
        task.completedAt = undefined
        task.feedback = undefined
        task.version = (task.version ?? 0) + 1
        return json(apiTask(task))
      }
      if (method === 'DELETE') {
        const task = mockApiState.tasks[index]
        if (task.status !== 'queued' && task.status !== 'failed') return json({ error: { code: 'TASK_NOT_DELETABLE', message: '只有排队中或失败的任务可以删除', requestId: 'test-request' } }, 409)
        mockApiState.tasks.splice(index, 1)
        return json(null, 204)
      }
      return json(apiTask(mockApiState.tasks[index]))
    }
    if (path === '/api/v1/admin/users') {
      const search = url.searchParams.get('search')?.toLowerCase()
      const users = mockApiState.users.filter((user) => !search || user.note?.toLowerCase().includes(search) || user.maskedKey.toLowerCase().includes(search))
      return json({ items: users, page: { hasMore: false, nextCursor: null } })
    }
    if (path === '/api/v1/admin/user-keys' && method === 'POST') {
      const customKey = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : null
      const user: User = {
        id: CREATED_USER_ID,
        maskedKey: customKey ? `${customKey.slice(0, 8)}-••••-••••-${customKey.slice(-4)}` : 'USR-BCDE-••••-••••-QRST',
        note: String(body.note ?? '').trim() || null,
        studioId: STUDIO_ID,
        enabled: true,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        taskCount: 0,
      }
      mockApiState.users.unshift(user)
      return json({ user, accessKey: customKey ?? 'USR-BCDE-FGHJ-KMNP-QRST' }, 201)
    }
    const userKeyMatch = path.match(/^\/api\/v1\/admin\/users\/([^/]+)\/key$/)
    if (userKeyMatch && method === 'GET') {
      const user = mockApiState.users.find((item) => item.id === userKeyMatch[1])
      if (!user) return json({ error: { code: 'NOT_FOUND', message: '密钥不存在', requestId: 'test-request' } }, 404)
      return json({ accessKey: 'USR-BCDE-FGHJ-KMNP-QRST' })
    }
    const userMatch = path.match(/^\/api\/v1\/admin\/users\/([^/]+)$/)
    if (userMatch && method === 'PATCH') {
      const user = mockApiState.users.find((item) => item.id === userMatch[1])!
      user.enabled = Boolean(body.enabled)
      return json(user)
    }
    if (userMatch && method === 'DELETE') {
      const index = mockApiState.users.findIndex((item) => item.id === userMatch[1])
      if (index < 0) return json({ error: { code: 'NOT_FOUND', message: '密钥不存在', requestId: 'test-request' } }, 404)
      mockApiState.users.splice(index, 1)
      return json(undefined, 204)
    }
    if (path === '/api/v1/admin/studios' && method === 'GET') return json([mockApiState.studio])
    if (path === '/api/v1/admin/studio' && method === 'GET') return json(mockApiState.studio)
    if (path === '/api/v1/admin/studio' && method === 'POST') {
      const s = { id: 'studio-new', name: String(body.name), enabled: true, createdAt: now, updatedAt: now, entryUrl: 'http://localhost/studio/new-token' }
      return json({ studio: s, accessToken: 'new-token' }, 201)
    }
    if (path.startsWith('/api/v1/admin/studios/') && path.endsWith('/rotate-access') && method === 'POST') {
      mockApiState.studio.entryUrl = 'http://localhost/studio/new-access'; return json({ url: 'http://localhost/studio/new-access' })
    }
    if (path.startsWith('/api/v1/admin/studios/') && method === 'PATCH') { mockApiState.studio.name = String(body.name); return json(mockApiState.studio) }
    if (path === '/api/v1/admin/audit-logs') return json({ items: [], page: { hasMore: false, nextCursor: null } })

    return json({ error: { code: 'NOT_FOUND', message: `No mock for ${method} ${path}`, requestId: 'test-request' } }, 404)
  }))
}
