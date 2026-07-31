# Studio Task Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bright-theme, clickable three-surface React prototype where registered users submit link tasks, the single studio processes its own FIFO queue without login, and an administrator monitors users, tasks, and studio links.

**Architecture:** Use a Vite React single-page application with route-separated user, studio, and administrator surfaces. Keep all prototype data behind a typed repository backed by `localStorage`; React contexts expose session and reactive data refresh so no page reads storage directly. Business rules such as URL parsing and task status transitions remain framework-independent and are covered by Vitest before page work begins.

**Tech Stack:** React 19, TypeScript, Vite, React Router, Lucide React, plain CSS design tokens, Vitest, Testing Library, jsdom.

---

## Planned File Structure

```text
package.json                         dependencies and scripts
vite.config.ts                      Vite and Vitest configuration
tsconfig.json                       TypeScript configuration
index.html                          SPA entry document
src/main.tsx                        React entry point
src/app/App.tsx                     router composition
src/app/AppProviders.tsx            data and session providers
src/app/routes.tsx                  route table and guards
src/styles/index.css                global light-theme tokens and responsive rules
src/domain/models.ts                shared data and status types
src/domain/taskRules.ts             URL parsing and task transition rules
src/data/seed.ts                    deterministic demo data
src/data/storage.ts                 localStorage adapter
src/data/repository.ts              typed prototype data API
src/data/DataContext.tsx            reactive repository bridge
src/auth/session.ts                 local session storage adapter
src/auth/AuthContext.tsx            user/admin login state
src/auth/RouteGuards.tsx            protected route wrappers
src/components/AppShell.tsx         shared application chrome
src/components/StatusBadge.tsx      accessible task status label
src/components/StatCard.tsx         metric card
src/components/ConfirmDialog.tsx    destructive/final action confirmation
src/components/TaskDetails.tsx      shared task detail content
src/components/TaskList.tsx         responsive table/card task list
src/components/ToastRegion.tsx      transient feedback
src/pages/NotFoundPage.tsx          404 page
src/pages/InvalidStudioPage.tsx     invalid/disabled studio state
src/pages/user/UserLoginPage.tsx    user login
src/pages/user/UserRegisterPage.tsx studio-bound registration
src/pages/user/UserWorkbenchPage.tsx submit and inspect own tasks
src/pages/studio/StudioPage.tsx      queue and processing controls
src/pages/admin/AdminLoginPage.tsx   admin login
src/pages/admin/AdminLayout.tsx      admin navigation shell
src/pages/admin/AdminDashboard.tsx   metrics and recent tasks
src/pages/admin/AdminTasksPage.tsx   all-task search and filtering
src/pages/admin/AdminUsersPage.tsx   enable/disable users
src/pages/admin/AdminStudioPage.tsx  studio name, links, and reset
src/test/setup.ts                    Testing Library setup and storage cleanup
src/**/*.test.ts(x)                 unit and integration tests beside features
```

## Task 1: Scaffold the React and Test Runtime

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/test/setup.ts`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write the failing application smoke test**

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the product identity', () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByText('任务工作台')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Create package and compiler configuration**

```json
// package.json
{
  "name": "studio-task-workbench",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "lucide-react": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Install dependencies and verify the smoke test fails**

Run: `npm install && npm run test:run -- src/app/App.test.tsx`

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 4: Add the minimum application entry**

```tsx
// src/app/App.tsx
export function App() {
  return <main><h1>任务工作台</h1></main>
}
```

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </React.StrictMode>,
)
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

afterEach(() => localStorage.clear())
```

```html
<!-- index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>任务工作台</title>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

- [ ] **Step 5: Run the smoke test and commit**

Run: `npm run test:run -- src/app/App.test.tsx`

Expected: PASS.

```powershell
git add package.json package-lock.json vite.config.ts tsconfig.json index.html src
git commit -m "chore: scaffold React prototype"
```

## Task 2: Define Domain Types, Demo Seed, and Storage Adapter

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/data/seed.ts`
- Create: `src/data/storage.ts`
- Test: `src/data/storage.test.ts`

- [ ] **Step 1: Write storage initialization and reset tests**

```ts
// src/data/storage.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_USER_ID } from './seed'
import { loadState, resetDemoState, saveState } from './storage'

describe('prototype storage', () => {
  beforeEach(() => localStorage.clear())

  it('seeds the single studio and demo user when empty', () => {
    const state = loadState()
    expect(state.studios).toHaveLength(1)
    expect(state.users.some((user) => user.id === DEMO_USER_ID)).toBe(true)
  })

  it('persists mutations and resets to deterministic demo data', () => {
    const state = loadState()
    saveState({ ...state, users: [] })
    expect(loadState().users).toHaveLength(0)
    expect(resetDemoState().users.some((user) => user.id === DEMO_USER_ID)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/data/storage.test.ts`

Expected: FAIL because the domain and storage modules do not exist.

- [ ] **Step 3: Add exact shared types**

```ts
// src/domain/models.ts
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

export type Admin = { id: string; username: string; password: string }

export type PrototypeState = {
  studios: Studio[]
  users: User[]
  tasks: Task[]
  admins: Admin[]
}
```

- [ ] **Step 4: Add deterministic seed and storage implementation**

```ts
// src/data/seed.ts
import type { PrototypeState } from '../domain/models'

export const DEMO_STUDIO_ID = 'studio-demo'
export const DEMO_USER_ID = 'user-demo'
export const DEMO_ADMIN_ID = 'admin-demo'

export function createDemoState(): PrototypeState {
  return {
    studios: [{
      id: DEMO_STUDIO_ID,
      name: '演示工作室',
      registrationCode: 'demo-studio',
      accessToken: 'studio-demo-8f3c2a',
      enabled: true,
      createdAt: '2026-08-01T00:00:00.000Z',
    }],
    users: [{
      id: DEMO_USER_ID,
      username: 'demo',
      password: 'Demo123!',
      studioId: DEMO_STUDIO_ID,
      enabled: true,
      createdAt: '2026-08-01T01:00:00.000Z',
    }],
    admins: [{ id: DEMO_ADMIN_ID, username: 'admin', password: 'Admin123!' }],
    tasks: [
      { id: 'TASK-1001', url: 'https://example.com/queued', status: 'queued', userId: DEMO_USER_ID, studioId: DEMO_STUDIO_ID, submittedAt: '2026-08-01T02:00:00.000Z' },
      { id: 'TASK-1002', url: 'https://example.com/processing', status: 'processing', userId: DEMO_USER_ID, studioId: DEMO_STUDIO_ID, submittedAt: '2026-08-01T02:10:00.000Z', processingStartedAt: '2026-08-01T02:20:00.000Z' },
      { id: 'TASK-1003', url: 'https://example.com/success', status: 'success', userId: DEMO_USER_ID, studioId: DEMO_STUDIO_ID, submittedAt: '2026-08-01T02:30:00.000Z', processingStartedAt: '2026-08-01T02:40:00.000Z', completedAt: '2026-08-01T02:50:00.000Z' },
      { id: 'TASK-1004', url: 'https://example.com/failed', status: 'failed', userId: DEMO_USER_ID, studioId: DEMO_STUDIO_ID, submittedAt: '2026-08-01T03:00:00.000Z', processingStartedAt: '2026-08-01T03:10:00.000Z', completedAt: '2026-08-01T03:20:00.000Z' },
    ],
  }
}
```

```ts
// src/data/storage.ts
import type { PrototypeState } from '../domain/models'
import { createDemoState } from './seed'

const STORAGE_KEY = 'studio-task-workbench:v1'

export function saveState(state: PrototypeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadState(): PrototypeState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) return JSON.parse(raw) as PrototypeState
  const seeded = createDemoState()
  saveState(seeded)
  return seeded
}

export function resetDemoState(): PrototypeState {
  const state = createDemoState()
  saveState(state)
  return state
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- src/data/storage.test.ts`

Expected: PASS with 2 tests.

```powershell
git add src/domain src/data
git commit -m "feat: add prototype data model and storage"
```

## Task 3: Implement Link Parsing and Task State Rules

**Files:**
- Create: `src/domain/taskRules.ts`
- Test: `src/domain/taskRules.test.ts`

- [ ] **Step 1: Write failing rule tests**

```ts
// src/domain/taskRules.test.ts
import { describe, expect, it } from 'vitest'
import { completeTaskState, openTaskState, parseSubmittedLinks } from './taskRules'

describe('parseSubmittedLinks', () => {
  it('removes blanks and same-submit duplicates while reporting invalid URLs', () => {
    const result = parseSubmittedLinks('https://a.test\n\nhttps://a.test\nftp://bad\nhttps://b.test')
    expect(result.valid).toEqual(['https://a.test', 'https://b.test'])
    expect(result.blankCount).toBe(1)
    expect(result.duplicateCount).toBe(1)
    expect(result.invalid).toEqual(['ftp://bad'])
  })

  it('rejects more than ten unique valid links', () => {
    const input = Array.from({ length: 11 }, (_, index) => `https://example.com/${index}`).join('\n')
    expect(() => parseSubmittedLinks(input)).toThrow('单次最多提交 10 条链接')
  })
})

describe('task transitions', () => {
  const queued = { id: 'T1', url: 'https://a.test', status: 'queued' as const, userId: 'U1', studioId: 'S1', submittedAt: '2026-08-01T00:00:00.000Z' }

  it('opens a queued task once', () => {
    const processing = openTaskState(queued, '2026-08-01T01:00:00.000Z')
    expect(processing.status).toBe('processing')
    expect(openTaskState(processing, '2026-08-01T02:00:00.000Z').processingStartedAt).toBe('2026-08-01T01:00:00.000Z')
  })

  it('only completes processing tasks', () => {
    expect(() => completeTaskState(queued, 'success', '2026-08-01T02:00:00.000Z')).toThrow('只有处理中的任务可以完成')
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm run test:run -- src/domain/taskRules.test.ts`

Expected: FAIL because `taskRules.ts` does not exist.

- [ ] **Step 3: Implement the framework-independent rules**

```ts
// src/domain/taskRules.ts
import type { Task } from './models'

export function parseSubmittedLinks(input: string) {
  const lines = input.split(/\r?\n/).map((line) => line.trim())
  const blankCount = lines.filter((line) => !line).length
  const invalid: string[] = []
  const valid: string[] = []
  const seen = new Set<string>()
  let duplicateCount = 0

  for (const line of lines.filter(Boolean)) {
    if (!/^https?:\/\//i.test(line)) {
      invalid.push(line)
    } else if (seen.has(line)) {
      duplicateCount += 1
    } else {
      seen.add(line)
      valid.push(line)
    }
  }

  if (valid.length > 10) throw new Error('单次最多提交 10 条链接')
  return { valid, invalid, blankCount, duplicateCount }
}

export function openTaskState(task: Task, now: string): Task {
  if (task.status !== 'queued') return task
  return { ...task, status: 'processing', processingStartedAt: now }
}

export function completeTaskState(task: Task, result: 'success' | 'failed', now: string): Task {
  if (task.status !== 'processing') throw new Error('只有处理中的任务可以完成')
  return { ...task, status: result, completedAt: now }
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/domain/taskRules.test.ts`

Expected: PASS with 4 tests.

```powershell
git add src/domain
git commit -m "feat: add task submission and transition rules"
```

## Task 4: Build the Typed Repository API

**Files:**
- Create: `src/data/repository.ts`
- Test: `src/data/repository.test.ts`

- [ ] **Step 1: Write failing repository workflow tests**

```ts
// src/data/repository.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { PrototypeRepository } from './repository'
import { resetDemoState } from './storage'

describe('PrototypeRepository', () => {
  beforeEach(() => resetDemoState())

  it('registers a user against the studio registration code', () => {
    const repository = new PrototypeRepository()
    const user = repository.registerUser('demo-studio', 'new-user', 'secret1')
    expect(user.studioId).toBe('studio-demo')
  })

  it('creates independent queued tasks and returns them FIFO', () => {
    const repository = new PrototypeRepository()
    const created = repository.createTasks('user-demo', ['https://x.test', 'https://y.test'], '2026-08-02T00:00:00.000Z')
    expect(created).toHaveLength(2)
    expect(repository.getStudioTasks('studio-demo').at(-1)?.id).toBe(created.at(-1)?.id)
  })

  it('opens and completes a task while preserving terminal states', () => {
    const repository = new PrototypeRepository()
    const opened = repository.openTask('TASK-1001', 'studio-demo', '2026-08-02T01:00:00.000Z')
    expect(opened.status).toBe('processing')
    expect(repository.completeTask(opened.id, 'studio-demo', 'success', '2026-08-02T02:00:00.000Z').status).toBe('success')
    expect(() => repository.completeTask(opened.id, 'studio-demo', 'failed', '2026-08-02T03:00:00.000Z')).toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to confirm failure**

Run: `npm run test:run -- src/data/repository.test.ts`

Expected: FAIL because `PrototypeRepository` does not exist.

- [ ] **Step 3: Implement repository methods with storage isolation**

```ts
// src/data/repository.ts
import type { Task, TaskStatus, User } from '../domain/models'
import { completeTaskState, openTaskState } from '../domain/taskRules'
import { loadState, resetDemoState, saveState } from './storage'

export class PrototypeRepository {
  getState() { return loadState() }
  reset() { return resetDemoState() }

  getStudioByRegistrationCode(code: string) {
    return loadState().studios.find((studio) => studio.registrationCode === code && studio.enabled)
  }

  getStudioByAccessToken(token: string) {
    return loadState().studios.find((studio) => studio.accessToken === token && studio.enabled)
  }

  authenticateUser(username: string, password: string) {
    return loadState().users.find((user) => user.username === username && user.password === password && user.enabled)
  }

  authenticateAdmin(username: string, password: string) {
    return loadState().admins.find((admin) => admin.username === username && admin.password === password)
  }

  registerUser(code: string, username: string, password: string): User {
    const state = loadState()
    const studio = state.studios.find((item) => item.registrationCode === code && item.enabled)
    if (!studio) throw new Error('注册链接已失效')
    if (state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) throw new Error('账号已存在')
    if (password.length < 6) throw new Error('密码至少需要 6 位')
    const user: User = { id: crypto.randomUUID(), username, password, studioId: studio.id, enabled: true, createdAt: new Date().toISOString() }
    saveState({ ...state, users: [...state.users, user] })
    return user
  }

  createTasks(userId: string, urls: string[], now = new Date().toISOString()): Task[] {
    const state = loadState()
    const user = state.users.find((item) => item.id === userId && item.enabled)
    if (!user) throw new Error('用户不存在或已停用')
    const tasks = urls.map((url, index): Task => ({ id: `TASK-${Date.now()}-${index + 1}`, url, status: 'queued', userId, studioId: user.studioId, submittedAt: now }))
    saveState({ ...state, tasks: [...state.tasks, ...tasks] })
    return tasks
  }

  getUserTasks(userId: string) {
    return loadState().tasks.filter((task) => task.userId === userId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  }

  getStudioTasks(studioId: string) {
    return loadState().tasks.filter((task) => task.studioId === studioId).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  }

  openTask(taskId: string, studioId: string, now = new Date().toISOString()) {
    const state = loadState()
    const task = state.tasks.find((item) => item.id === taskId && item.studioId === studioId)
    if (!task) throw new Error('任务不存在')
    const updated = openTaskState(task, now)
    saveState({ ...state, tasks: state.tasks.map((item) => item.id === taskId ? updated : item) })
    return updated
  }

  completeTask(taskId: string, studioId: string, result: Extract<TaskStatus, 'success' | 'failed'>, now = new Date().toISOString()) {
    const state = loadState()
    const task = state.tasks.find((item) => item.id === taskId && item.studioId === studioId)
    if (!task) throw new Error('任务不存在')
    const updated = completeTaskState(task, result, now)
    saveState({ ...state, tasks: state.tasks.map((item) => item.id === taskId ? updated : item) })
    return updated
  }

  setUserEnabled(userId: string, enabled: boolean) {
    const state = loadState()
    saveState({ ...state, users: state.users.map((user) => user.id === userId ? { ...user, enabled } : user) })
  }

  updateStudioName(studioId: string, name: string) {
    const state = loadState()
    saveState({ ...state, studios: state.studios.map((studio) => studio.id === studioId ? { ...studio, name } : studio) })
  }
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/data/repository.test.ts`

Expected: PASS with 3 tests.

```powershell
git add src/data
git commit -m "feat: add typed prototype repository"
```

## Task 5: Add Reactive Data and Session Providers

**Files:**
- Create: `src/data/DataContext.tsx`
- Create: `src/auth/session.ts`
- Create: `src/auth/AuthContext.tsx`
- Create: `src/app/AppProviders.tsx`
- Test: `src/auth/AuthContext.test.tsx`

- [ ] **Step 1: Write a failing user login/logout provider test**

```tsx
// src/auth/AuthContext.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../app/AppProviders'
import { useAuth } from './AuthContext'

function Harness() {
  const auth = useAuth()
  return <>
    <span>{auth.user?.username ?? '访客'}</span>
    <button onClick={() => auth.loginUser('demo', 'Demo123!')}>登录</button>
    <button onClick={auth.logoutUser}>退出</button>
  </>
}

describe('AuthContext', () => {
  it('logs in and out through the repository', async () => {
    render(<AppProviders><Harness /></AppProviders>)
    await userEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(screen.getByText('demo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '退出' }))
    expect(screen.getByText('访客')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm run test:run -- src/auth/AuthContext.test.tsx`

Expected: FAIL because the providers do not exist.

- [ ] **Step 3: Implement session persistence and reactive data API**

```ts
// src/auth/session.ts
const USER_SESSION_KEY = 'studio-task-workbench:user-session'
const ADMIN_SESSION_KEY = 'studio-task-workbench:admin-session'

export const sessionStore = {
  getUserId: () => localStorage.getItem(USER_SESSION_KEY),
  setUserId: (id: string | null) => id ? localStorage.setItem(USER_SESSION_KEY, id) : localStorage.removeItem(USER_SESSION_KEY),
  getAdminId: () => localStorage.getItem(ADMIN_SESSION_KEY),
  setAdminId: (id: string | null) => id ? localStorage.setItem(ADMIN_SESSION_KEY, id) : localStorage.removeItem(ADMIN_SESSION_KEY),
}
```

```tsx
// src/data/DataContext.tsx
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { PrototypeRepository } from './repository'

const repository = new PrototypeRepository()
const DataContext = createContext({ repository, version: 0, refresh: () => {} })

export function DataProvider({ children }: PropsWithChildren) {
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((value) => value + 1), [])
  const value = useMemo(() => ({ repository, version, refresh }), [version, refresh])
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
```

```tsx
// src/auth/AuthContext.tsx
import { createContext, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Admin, User } from '../domain/models'
import { useData } from '../data/DataContext'
import { sessionStore } from './session'

type AuthValue = {
  user?: User
  admin?: Admin
  loginUser(username: string, password: string): void
  logoutUser(): void
  loginAdmin(username: string, password: string): void
  logoutAdmin(): void
  setRegisteredUser(user: User): void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const { repository, version } = useData()
  const state = repository.getState()
  const [userId, setUserId] = useState(sessionStore.getUserId())
  const [adminId, setAdminId] = useState(sessionStore.getAdminId())
  const user = state.users.find((item) => item.id === userId && item.enabled)
  const admin = state.admins.find((item) => item.id === adminId)

  const value = useMemo<AuthValue>(() => ({
    user,
    admin,
    loginUser(username, password) {
      const matched = repository.authenticateUser(username, password)
      if (!matched) throw new Error('账号、密码错误或账号已停用')
      sessionStore.setUserId(matched.id); setUserId(matched.id)
    },
    logoutUser() { sessionStore.setUserId(null); setUserId(null) },
    loginAdmin(username, password) {
      const matched = repository.authenticateAdmin(username, password)
      if (!matched) throw new Error('管理员账号或密码错误')
      sessionStore.setAdminId(matched.id); setAdminId(matched.id)
    },
    logoutAdmin() { sessionStore.setAdminId(null); setAdminId(null) },
    setRegisteredUser(registered) { sessionStore.setUserId(registered.id); setUserId(registered.id) },
  }), [admin, repository, user, version])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
```

```tsx
// src/app/AppProviders.tsx
import type { PropsWithChildren } from 'react'
import { AuthProvider } from '../auth/AuthContext'
import { DataProvider } from '../data/DataContext'

export function AppProviders({ children }: PropsWithChildren) {
  return <DataProvider><AuthProvider>{children}</AuthProvider></DataProvider>
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/auth/AuthContext.test.tsx`

Expected: PASS.

```powershell
git add src/auth src/data/DataContext.tsx src/app/AppProviders.tsx
git commit -m "feat: add session and reactive data providers"
```

## Task 6: Create the Shared Light-Theme UI Foundation

**Files:**
- Create: `src/styles/index.css`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/StatCard.tsx`
- Create: `src/components/AppShell.tsx`
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/components/ToastRegion.tsx`
- Test: `src/components/StatusBadge.test.tsx`

- [ ] **Step 1: Write a failing accessible status test**

```tsx
// src/components/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each([
    ['queued', '排队中'],
    ['processing', '处理中'],
    ['success', '成功'],
    ['failed', '失败'],
  ] as const)('labels %s with text', (status, label) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toHaveAttribute('data-status', status)
  })
})
```

- [ ] **Step 2: Implement the component primitives**

```tsx
// src/components/StatusBadge.tsx
import type { TaskStatus } from '../domain/models'

const labels: Record<TaskStatus, string> = { queued: '排队中', processing: '处理中', success: '成功', failed: '失败' }

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-${status}`} data-status={status}>{labels[status]}</span>
}
```

```tsx
// src/components/StatCard.tsx
export function StatCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: string }) {
  return <article className={`stat-card stat-${tone}`}><span>{label}</span><strong>{value}</strong></article>
}
```

```tsx
// src/components/AppShell.tsx
import type { PropsWithChildren, ReactNode } from 'react'

export function AppShell({ title, subtitle, actions, children }: PropsWithChildren<{ title: string; subtitle?: string; actions?: ReactNode }>) {
  return <div className="app-shell"><header className="app-header"><div><p className="eyebrow">TASK WORKBENCH</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div>{actions}</div></header>{children}</div>
}
```

```tsx
// src/components/ConfirmDialog.tsx
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; description: string; confirmLabel: string; onConfirm(): void; onCancel(): void }) {
  if (!open) return null
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><p>{description}</p><div className="modal-actions"><button className="button secondary" onClick={onCancel}>取消</button><button className="button danger" onClick={onConfirm}>{confirmLabel}</button></div></section></div>
}
```

- [ ] **Step 3: Add the design tokens and responsive primitives**

```css
/* src/styles/index.css */
:root {
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  color: #172033; background: #f3f7fa;
  --surface: #ffffff; --surface-soft: #f7fafc; --border: #dce6ec;
  --primary: #08a9bd; --primary-dark: #087d91; --text-muted: #6d7b8d;
  --queued: #d97706; --processing: #2563eb; --success: #15803d; --failed: #dc2626;
  --shadow: 0 12px 30px rgba(20, 43, 58, .08); --radius: 16px;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: #f3f7fa; }
button, input, textarea, select { font: inherit; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible { outline: 3px solid rgba(8,169,189,.28); outline-offset: 2px; }
.app-shell { width: min(1440px, calc(100% - 32px)); margin: 24px auto; }
.app-header, .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
.app-header { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding: 24px; margin-bottom: 18px; }
.eyebrow { color: var(--primary); font-size: 12px; font-weight: 800; letter-spacing: .12em; }
.button { border: 0; border-radius: 11px; padding: 11px 16px; cursor: pointer; background: var(--primary); color: white; font-weight: 700; }
.button.secondary { background: #e9f5f7; color: var(--primary-dark); }
.button.danger { background: var(--failed); }
.stats-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.stat-card { padding: 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; }
.stat-card strong { display: block; margin-top: 8px; font-size: 28px; }
.status-badge { display: inline-flex; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 800; }
.status-queued { color: var(--queued); background: #fff7e6; } .status-processing { color: var(--processing); background: #edf4ff; }
.status-success { color: var(--success); background: #ecfdf3; } .status-failed { color: var(--failed); background: #fff0f0; }
.modal-backdrop { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(23,32,51,.35); z-index: 50; }
.modal { width: min(440px, calc(100% - 32px)); background: white; border-radius: 16px; padding: 24px; box-shadow: var(--shadow); }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
@media (max-width: 800px) { .app-shell { width: min(100% - 20px, 1440px); margin: 10px auto; } .app-header { align-items: flex-start; flex-direction: column; } .stats-grid { grid-template-columns: repeat(2, 1fr); } }
```

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/components/StatusBadge.test.tsx`

Expected: PASS with 4 parameterized cases.

```powershell
git add src/components src/styles
git commit -m "feat: add bright workbench design system"
```

## Task 7: Implement Routing, Guards, Login, and Registration

**Files:**
- Create: `src/auth/RouteGuards.tsx`
- Create: `src/app/routes.tsx`
- Modify: `src/app/App.tsx`
- Create: `src/pages/user/UserLoginPage.tsx`
- Create: `src/pages/user/UserRegisterPage.tsx`
- Create: `src/pages/admin/AdminLoginPage.tsx`
- Create: `src/pages/NotFoundPage.tsx`
- Create: `src/pages/InvalidStudioPage.tsx`
- Test: `src/pages/user/UserAuthFlow.test.tsx`

- [ ] **Step 1: Write the failing registration-to-workbench integration test**

```tsx
// src/pages/user/UserAuthFlow.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AppRoutes } from '../../app/routes'

describe('user registration', () => {
  it('registers from the studio link and enters the workbench', async () => {
    render(<MemoryRouter initialEntries={['/s/demo-studio/register']}><AppProviders><AppRoutes /></AppProviders></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('账号'), 'fresh-user')
    await userEvent.type(screen.getByLabelText('密码'), 'secret1')
    await userEvent.type(screen.getByLabelText('确认密码'), 'secret1')
    await userEvent.click(screen.getByRole('button', { name: '注册并进入工作台' }))
    expect(await screen.findByRole('heading', { name: '提交任务' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Add guards and the complete route skeleton**

```tsx
// src/auth/RouteGuards.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function UserGuard() { return useAuth().user ? <Outlet /> : <Navigate to="/login" replace /> }
export function AdminGuard() { return useAuth().admin ? <Outlet /> : <Navigate to="/admin/login" replace /> }
```

```tsx
// src/app/App.tsx
import { AppProviders } from './AppProviders'
import { AppRoutes } from './routes'

export function App() { return <AppProviders><AppRoutes /></AppProviders> }
```

Route `index` and `*`, user login/register/workbench, studio token, admin login/dashboard/tasks/users/studio. Nest user routes under `UserGuard` and admin routes under `AdminGuard`; use `<Navigate to="/login" replace />` for `/`.

- [ ] **Step 3: Implement the three account forms**

Each form must use visible `<label>` elements, local error text with `role="alert"`, disabled submit while processing, and navigation on success. `UserRegisterPage` must read `registrationCode` from `useParams`, validate matching passwords, call `repository.registerUser`, call `refresh`, then `setRegisteredUser`. `UserLoginPage` calls `loginUser`; `AdminLoginPage` calls `loginAdmin`.

```tsx
// essential UserRegisterPage submit path
const onSubmit = (event: FormEvent) => {
  event.preventDefault()
  if (password !== confirmation) return setError('两次输入的密码不一致')
  try {
    const user = repository.registerUser(registrationCode!, username.trim(), password)
    refresh(); setRegisteredUser(user); navigate('/user/workbench')
  } catch (cause) { setError(cause instanceof Error ? cause.message : '注册失败') }
}
```

- [ ] **Step 4: Run the auth flow test and full suite**

Run: `npm run test:run -- src/pages/user/UserAuthFlow.test.tsx && npm run test:run`

Expected: registration test and all earlier tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app src/auth src/pages
git commit -m "feat: add routed user and admin authentication"
```

## Task 8: Build Reusable Task List and Detail Components

**Files:**
- Create: `src/components/TaskList.tsx`
- Create: `src/components/TaskDetails.tsx`
- Test: `src/components/TaskList.test.tsx`

- [ ] **Step 1: Write a failing sorted task list test**

```tsx
// src/components/TaskList.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskList } from './TaskList'

describe('TaskList', () => {
  it('renders status text and opens the selected task', async () => {
    const onSelect = vi.fn()
    const tasks = [{ id: 'T1', url: 'https://a.test', status: 'queued' as const, userId: 'U1', studioId: 'S1', submittedAt: '2026-08-01T00:00:00.000Z' }]
    render(<TaskList tasks={tasks} users={[]} onSelect={onSelect} />)
    expect(screen.getByText('排队中')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /查看任务 T1/ }))
    expect(onSelect).toHaveBeenCalledWith(tasks[0])
  })
})
```

- [ ] **Step 2: Implement task list and shared detail content**

`TaskList` renders semantic table headers on desktop and CSS-driven card rows on narrow screens. Each row includes task ID, truncated clickable URL, optional username, submitted time, `StatusBadge`, and a named “查看任务 {id}” button. `TaskDetails` displays all timestamps, opens links with `target="_blank" rel="noreferrer"`, and accepts an optional action slot so studio controls remain outside shared presentation.

- [ ] **Step 3: Add table/card responsive CSS**

Add `.task-table`, `.task-card-list`, `.task-link`, `.details-grid`, and `.drawer` rules. At widths below `720px`, hide the table and show task cards; at larger widths, reverse those displays. The drawer uses `position: fixed`, fills the screen on mobile, and limits width to `520px` on desktop.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/components/TaskList.test.tsx`

Expected: PASS.

```powershell
git add src/components src/styles/index.css
git commit -m "feat: add reusable task list and details"
```

## Task 9: Implement the User Submission Workbench

**Files:**
- Create: `src/pages/user/UserWorkbenchPage.tsx`
- Test: `src/pages/user/UserWorkbenchPage.test.tsx`

- [ ] **Step 1: Write failing single and batch submission tests**

```tsx
// src/pages/user/UserWorkbenchPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { UserWorkbenchPage } from './UserWorkbenchPage'
import { sessionStore } from '../../auth/session'

describe('UserWorkbenchPage', () => {
  it('submits unique valid links and reports invalid lines', async () => {
    sessionStore.setUserId('user-demo')
    render(<MemoryRouter><AppProviders><UserWorkbenchPage /></AppProviders></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '批量提交' }))
    await userEvent.type(screen.getByLabelText('任务链接'), 'https://one.test\nhttps://one.test\nftp://bad\nhttps://two.test')
    expect(screen.getByText(/有效 2 条/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '提交 2 条任务' }))
    expect(await screen.findByText('已创建 2 条任务')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement user workbench behavior**

The page must:

1. Read the current user from `useAuth` and their studio from `repository.getState()`.
2. Keep mode (`single` or `batch`), raw input, status filter, search term, selected task, and feedback in local state.
3. Call `parseSubmittedLinks` on every input change and display valid, blank, duplicate, and invalid counts.
4. Disable submit when there are zero valid links or any invalid links.
5. Call `repository.createTasks(user.id, parsed.valid)`, `refresh()`, clear input, and announce “已创建 N 条任务”.
6. Derive statistics and filtered task rows from `repository.getUserTasks(user.id)`.
7. Render `TaskDetails` as read-only when a task is selected.
8. Provide logout through `logoutUser` and navigation to `/login`.

- [ ] **Step 3: Add submission and filter styling**

Add two-column desktop layout for submission and summary, segmented mode buttons, textarea with 160px minimum height, validation summary, filters, and mobile stacking. Keep the primary action cyan and all status counts text-labeled.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/pages/user/UserWorkbenchPage.test.tsx`

Expected: PASS.

```powershell
git add src/pages/user src/styles/index.css
git commit -m "feat: add user task submission workbench"
```

## Task 10: Implement the Studio Queue and Automatic Processing

**Files:**
- Create: `src/pages/studio/StudioPage.tsx`
- Test: `src/pages/studio/StudioPage.test.tsx`

- [ ] **Step 1: Write failing automatic-open and completion tests**

```tsx
// src/pages/studio/StudioPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { StudioPage } from './StudioPage'

describe('StudioPage', () => {
  it('marks a queued task processing when opened and then completes it', async () => {
    render(<MemoryRouter initialEntries={['/studio/studio-demo-8f3c2a']}><AppProviders><Routes><Route path="/studio/:accessToken" element={<StudioPage />} /></Routes></AppProviders></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '查看任务 TASK-1001' }))
    expect(await screen.findByText('处理中')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '处理成功' }))
    await userEvent.click(screen.getByRole('button', { name: '确认成功' }))
    expect(await screen.findByText('成功')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement studio token validation and FIFO queue**

The page reads `accessToken`, resolves the enabled studio, and renders `InvalidStudioPage` when absent. Tasks come from `repository.getStudioTasks(studio.id)`, remain FIFO by submitted time, and can be filtered by status or URL. Opening a queued task calls `repository.openTask`, then `refresh`, and uses the returned task as the selected detail so the first render of the drawer already says “处理中”.

- [ ] **Step 3: Implement terminal-state confirmations**

Show “处理成功” and “处理失败” only for processing tasks. Each opens `ConfirmDialog`; confirm calls `repository.completeTask(selected.id, studio.id, result)`, refreshes data, updates selected task, and announces the final result. Completed tasks render read-only details and never show result buttons.

- [ ] **Step 4: Add studio statistics and responsive layout**

Calculate queued, processing, today-success, and today-failed counts using the local date. Place the queue count in the header, metrics below it, and filters directly above the task list. On mobile, keep result actions sticky at the bottom of the full-screen drawer.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- src/pages/studio/StudioPage.test.tsx`

Expected: PASS.

```powershell
git add src/pages/studio src/styles/index.css
git commit -m "feat: add studio processing queue"
```

## Task 11: Implement Admin Navigation, Dashboard, and Task Search

**Files:**
- Create: `src/pages/admin/AdminLayout.tsx`
- Create: `src/pages/admin/AdminDashboard.tsx`
- Create: `src/pages/admin/AdminTasksPage.tsx`
- Test: `src/pages/admin/AdminTasksPage.test.tsx`

- [ ] **Step 1: Write a failing admin filter test**

```tsx
// src/pages/admin/AdminTasksPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminTasksPage } from './AdminTasksPage'

describe('AdminTasksPage', () => {
  it('filters by status and username or URL text', async () => {
    render(<MemoryRouter><AppProviders><AdminTasksPage /></AppProviders></MemoryRouter>)
    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'failed')
    expect(screen.getByText('https://example.com/failed')).toBeInTheDocument()
    expect(screen.queryByText('https://example.com/success')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement admin shell and nested navigation**

`AdminLayout` includes links to overview, all tasks, users, and studio settings; it marks the active route, displays the admin username, and logs out to `/admin/login`. On mobile, navigation becomes a horizontally scrollable tab row.

- [ ] **Step 3: Implement dashboard metrics**

`AdminDashboard` reads state, renders user total, task total, and four status totals, followed by the ten most recent tasks. Use `TaskList` in read-only mode and `TaskDetails` for inspection.

- [ ] **Step 4: Implement all-task search and filtering**

`AdminTasksPage` joins tasks to users, searches task ID, URL, or username case-insensitively, filters by the four statuses, and renders a result count. Admin task details are read-only; no status mutation controls appear.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- src/pages/admin/AdminTasksPage.test.tsx`

Expected: PASS.

```powershell
git add src/pages/admin src/styles/index.css
git commit -m "feat: add admin dashboard and task monitoring"
```

## Task 12: Implement User Management and Studio Settings

**Files:**
- Create: `src/pages/admin/AdminUsersPage.tsx`
- Create: `src/pages/admin/AdminStudioPage.tsx`
- Test: `src/pages/admin/AdminUsersPage.test.tsx`
- Test: `src/pages/admin/AdminStudioPage.test.tsx`

- [ ] **Step 1: Write failing user enable/disable test**

```tsx
// src/pages/admin/AdminUsersPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminUsersPage } from './AdminUsersPage'

describe('AdminUsersPage', () => {
  it('requires confirmation before disabling a user', async () => {
    render(<MemoryRouter><AppProviders><AdminUsersPage /></AppProviders></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '停用 demo' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '确认停用' }))
    expect(screen.getByText('已停用')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement user management**

Render username, enabled state, created time, task count, and latest submitted time. Enabling applies immediately; disabling requires `ConfirmDialog`. After `repository.setUserEnabled`, call `refresh` and announce success. Preserve task history and do not offer user deletion.

- [ ] **Step 3: Write failing studio settings and reset test**

```tsx
// src/pages/admin/AdminStudioPage.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminStudioPage } from './AdminStudioPage'

describe('AdminStudioPage', () => {
  it('updates the studio name', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(<MemoryRouter><AppProviders><AdminStudioPage /></AppProviders></MemoryRouter>)
    await userEvent.clear(screen.getByLabelText('工作室名称'))
    await userEvent.type(screen.getByLabelText('工作室名称'), '新的工作室')
    await userEvent.click(screen.getByRole('button', { name: '保存名称' }))
    expect(screen.getByDisplayValue('新的工作室')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Implement studio settings and demo reset**

Show only the single studio. Save non-empty names through `repository.updateStudioName`. Build absolute links with `window.location.origin`, display and copy `/s/{registrationCode}/register` and `/studio/{accessToken}`, and show clipboard success/failure feedback. Reset requires confirmation, calls `repository.reset()`, `refresh()`, clears user session, and retains the current administrator session.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- src/pages/admin/AdminUsersPage.test.tsx src/pages/admin/AdminStudioPage.test.tsx`

Expected: PASS.

```powershell
git add src/pages/admin
git commit -m "feat: add admin user and studio management"
```

## Task 13: Finish Routes, Empty States, Accessibility, and Responsive Behavior

**Files:**
- Modify: `src/app/routes.tsx`
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/TaskList.tsx`
- Modify: `src/styles/index.css`
- Test: `src/app/routes.test.tsx`

- [ ] **Step 1: Write route guard and invalid-token tests**

```tsx
// src/app/routes.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from './AppProviders'
import { AppRoutes } from './routes'

describe('application routes', () => {
  it('redirects anonymous users to login', async () => {
    render(<MemoryRouter initialEntries={['/user/workbench']}><AppProviders><AppRoutes /></AppProviders></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '用户登录' })).toBeInTheDocument()
  })

  it('shows an invalid studio state for unknown tokens', async () => {
    render(<MemoryRouter initialEntries={['/studio/unknown']}><AppProviders><AppRoutes /></AppProviders></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: '入口已失效' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Complete the route table**

Ensure every route in the design spec resolves, the root redirects to user login, user/admin guards redirect correctly, invalid studio links render `InvalidStudioPage`, and unknown routes render `NotFoundPage` with buttons to user and admin login.

- [ ] **Step 3: Complete keyboard and dialog behavior**

Add `Escape` handling to drawers and dialogs, focus the first dialog button when opened, return focus to the opener when closed, add `aria-live="polite"` to feedback regions, and prevent body scroll while modal surfaces are open. Use real `<button>` elements for all actions and visible labels for every field.

- [ ] **Step 4: Verify responsive layouts in CSS**

At 1440px, 1024px, 768px, and 390px widths verify: no page-level horizontal overflow; stats wrap; task table becomes cards below 720px; admin navigation remains reachable; studio detail becomes full-screen; primary actions remain visible. Add only the CSS rules required to satisfy these checks.

- [ ] **Step 5: Run routes and full tests, then commit**

Run: `npm run test:run -- src/app/routes.test.tsx && npm run test:run`

Expected: all tests PASS.

```powershell
git add src
git commit -m "feat: complete routes accessibility and responsive states"
```

## Task 14: Final Build and End-to-End Prototype Verification

**Files:**
- Modify only files implicated by verification failures.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm run test:run`

Expected: all unit and integration tests PASS with zero unhandled errors.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript exits successfully and Vite writes a `dist/` bundle without errors.

- [ ] **Step 3: Start the prototype for interaction verification**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL, normally `http://127.0.0.1:5173/`.

- [ ] **Step 4: Verify the exact acceptance flow**

1. Open `/s/demo-studio/register`, register a new user, and confirm automatic entry into `/user/workbench`.
2. Submit one valid link and verify one queued task appears.
3. Submit a batch containing two valid links, a duplicate, a blank line, and an invalid line; verify counts and blocked submission until the invalid line is removed.
4. Open `/studio/studio-demo-8f3c2a`, verify only the single studio queue appears in FIFO order.
5. Open the new queued task and verify it becomes processing immediately.
6. Mark it successful through the confirmation dialog and verify the terminal state.
7. Return to the user workbench and verify the successful status is visible.
8. Log in at `/admin/login` with `admin / Admin123!`; verify metrics, task filters, user disable confirmation, studio-name editing, link copying, and demo reset.
9. Refresh each surface and verify local data persists.
10. Repeat the main flow at 390px viewport width and verify controls remain usable.

- [ ] **Step 5: Inspect working tree and commit verification fixes**

Run: `git status --short`

Expected: only deliberate verification fixes are present. If fixes were needed:

```powershell
git add src package.json package-lock.json
git commit -m "fix: polish prototype verification flow"
```

- [ ] **Step 6: Record final verification result**

Run: `git log --oneline -10 && npm run test:run && npm run build`

Expected: recent feature commits are present; tests and build both PASS.

## Plan Self-Review

- Spec coverage: all user, studio, administrator, data-persistence, status-transition, error, responsive, and accessibility requirements map to Tasks 1–14.
- Scope: one frontend prototype and one local data repository; no backend, payment, CDK, multi-studio UI, notes, attachments, or operator accounts.
- Type consistency: `TaskStatus`, `PrototypeState`, repository methods, route parameters, and session identifiers use the same names throughout the plan.
- Completeness scan: every implementation step names the concrete behavior, files, commands, and expected result.
