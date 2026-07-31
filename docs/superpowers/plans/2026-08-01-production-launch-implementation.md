# Production Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-only prototype with a Docker-deployable React, Fastify, Prisma, and PostgreSQL production system while preserving the confirmed user, studio, and administrator workflows.

**Architecture:** Convert the repository into npm workspaces with `apps/web`, `apps/api`, and `packages/contracts`. The API owns authentication, authorization, validation, task state transitions, audit logs, pagination, and concurrency. PostgreSQL is the source of truth; Nginx serves the SPA and proxies `/api`; Docker Compose runs the production stack.

**Tech Stack:** React 19, Vite, TypeScript, Fastify, Zod, Prisma, PostgreSQL 16, Argon2id, Vitest, Testing Library, Docker Compose, Nginx.

---

## Delivery Phases

1. Workspace and shared-contract foundation.
2. PostgreSQL, API shell, authentication, and security.
3. User, studio, and administrator business APIs.
4. Frontend migration from localStorage to HTTP APIs.
5. Containers, backup, deployment documentation, and release gates.

Every phase ends with passing tests and a commit.

## File Structure

```text
apps/web/                 Existing React application
apps/api/                 Fastify production API
packages/contracts/       Shared Zod request/response contracts
prisma/                   Schema, migrations, and initialization
infra/nginx/              Reverse proxy configuration
infra/backup/             Backup and restore scripts
scripts/                  Release verification
compose.yaml               Production stack
```

### Task 1: Convert to npm Workspaces

**Files:**
- Modify: `package.json`
- Create: `apps/web/package.json`
- Move: `src`, `index.html`, `vite.config.ts`, `tsconfig.json` into `apps/web`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`

- [ ] **Step 1: Verify the existing baseline**

```powershell
npm run test:run
npm run build
```

Expected: 16 test files, 27 tests, and the Vite production build pass.

- [ ] **Step 2: Write the root workspace manifest**

Use this script structure in root `package.json`:

```json
{
  "name": "studio-task-platform",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:web": "npm run dev -w @studio/web",
    "dev:api": "npm run dev -w @studio/api",
    "build": "npm run build -ws --if-present",
    "test:run": "npm run test:run -ws --if-present",
    "typecheck": "npm run typecheck -ws --if-present",
    "db:generate": "prisma generate",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy"
  }
}
```

Keep Prisma, TSX, and TypeScript as root development dependencies. Check official package compatibility with the installed Node.js LTS before locking versions.

- [ ] **Step 3: Move the frontend without behavior changes**

```powershell
New-Item -ItemType Directory -Force apps/web | Out-Null
git mv src apps/web/src
git mv index.html apps/web/index.html
git mv vite.config.ts apps/web/vite.config.ts
git mv tsconfig.json apps/web/tsconfig.json
```

Create `apps/web/package.json` from the current frontend dependencies and scripts. Add `@studio/contracts` as a workspace dependency.

- [ ] **Step 4: Create the contracts workspace**

Create `packages/contracts/package.json` with Zod, TypeScript, and Vitest. Create `packages/contracts/src/index.ts`:

```ts
export const CONTRACTS_VERSION = 1
```

- [ ] **Step 5: Reinstall and verify**

```powershell
Remove-Item package-lock.json
npm install
npm run test:run -w @studio/web
npm run build -w @studio/web
```

Expected: all existing frontend behavior remains green after the move.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json apps packages
git commit -m "build: create production workspaces"
```

### Task 2: Define Shared Contracts

**Files:**
- Create: `packages/contracts/src/common.ts`
- Create: `packages/contracts/src/auth.ts`
- Create: `packages/contracts/src/task.ts`
- Create: `packages/contracts/src/admin.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/contracts.test.ts`

- [ ] **Step 1: Write failing schema tests**

```ts
import { describe, expect, it } from 'vitest'
import { createTaskChunkSchema, taskSchema, userLoginSchema } from '../src'

describe('production contracts', () => {
  it('validates login credentials', () => {
    expect(userLoginSchema.parse({ username: 'demo', password: 'secret12' }).username).toBe('demo')
    expect(() => userLoginSchema.parse({ username: 'demo', password: '1' })).toThrow()
  })

  it('limits transport chunks to 200 links', () => {
    const urls = Array.from({ length: 200 }, (_, index) => `https://example.test/${index}`)
    expect(createTaskChunkSchema.parse({ batchId: crypto.randomUUID(), urls }).urls).toHaveLength(200)
    expect(() => createTaskChunkSchema.parse({ batchId: crypto.randomUUID(), urls: [...urls, 'https://extra.test'] })).toThrow()
  })

  it('defines the public task response', () => {
    expect(taskSchema.parse({
      publicId: 'TASK-AB12CD34', url: 'https://example.test/pay', status: 'queued',
      queueSeq: '1', submittedAt: '2026-08-01T00:00:00.000Z', version: 0,
    }).status).toBe('queued')
  })
})
```

- [ ] **Step 2: Verify RED**

```powershell
npm run test:run -w @studio/contracts
```

Expected: FAIL because the schemas do not exist.

- [ ] **Step 3: Implement the contracts**

Define:

```ts
export const taskStatusSchema = z.enum(['queued', 'processing', 'success', 'failed'])
export const paymentUrlSchema = z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))
export const createTaskChunkSchema = z.object({
  batchId: z.string().uuid(),
  urls: z.array(paymentUrlSchema).min(1).max(200),
})
export const completeTaskSchema = z.object({
  result: z.enum(['success', 'failed']),
  feedback: z.string().trim().max(2000).optional(),
  version: z.number().int().nonnegative(),
})
```

Also define stable API error, pagination, session principal, login, registration, admin user update, studio update, audit log, task, and task-list schemas. Export every schema from `src/index.ts`.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npm run test:run -w @studio/contracts
npm run typecheck -w @studio/contracts
git add packages/contracts
git commit -m "feat: define shared API contracts"
```

### Task 3: Add PostgreSQL and Prisma Foundation

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/db.ts`
- Create: `apps/api/test/database.test.ts`
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `.env.example`

- [ ] **Step 1: Create the API workspace**

Add Fastify, Prisma client, Zod, Argon2, cookie, Helmet, rate-limit, CSRF protection, TSX, TypeScript, and Vitest. Resolve exact versions only after checking official Node.js compatibility.

Required scripts:

```json
{
  "dev": "tsx watch src/server.ts",
  "build": "tsc -p tsconfig.build.json",
  "typecheck": "tsc --noEmit",
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 2: Write the failing database test**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db'

describe('database schema', () => {
  beforeAll(async () => {
    await prisma.auditLog.deleteMany()
    await prisma.task.deleteMany()
    await prisma.user.deleteMany()
    await prisma.studio.deleteMany()
  })
  afterAll(() => prisma.$disconnect())

  it('assigns a stable increasing queue sequence', async () => {
    const studio = await prisma.studio.create({ data: {
      name: '测试工作室', registrationCodeHash: 'registration-hash', accessTokenHash: 'access-hash',
    } })
    const user = await prisma.user.create({ data: {
      username: 'demo', normalizedUsername: 'demo', passwordHash: 'password-hash', studioId: studio.id,
    } })
    const first = await prisma.task.create({ data: {
      publicId: 'TASK-ONE', url: 'https://one.test', userId: user.id, studioId: studio.id,
    } })
    const second = await prisma.task.create({ data: {
      publicId: 'TASK-TWO', url: 'https://two.test', userId: user.id, studioId: studio.id,
    } })
    expect(second.queueSeq > first.queueSeq).toBe(true)
  })
})
```

- [ ] **Step 3: Verify RED**

Start a disposable PostgreSQL 16 database, set `DATABASE_URL`, and run:

```powershell
npm run test:run -w @studio/api -- database.test.ts
```

Expected: FAIL because the Prisma schema and client do not exist.

- [ ] **Step 4: Implement the schema**

Create enums for task status and principal type. Create `Studio`, `User`, `Admin`, `Task`, `Session`, `AuditLog`, and `SubmissionBatch`. The task model must include:

```prisma
model Task {
  id                  String     @id @default(uuid())
  publicId            String     @unique
  queueSeq            BigInt     @unique @default(autoincrement())
  url                 String
  status              TaskStatus @default(queued)
  userId              String
  studioId            String
  submittedAt         DateTime   @default(now())
  processingStartedAt DateTime?
  completedAt         DateTime?
  feedback            String?
  version             Int        @default(0)
  user                 User       @relation(fields: [userId], references: [id], onDelete: Restrict)
  studio               Studio     @relation(fields: [studioId], references: [id], onDelete: Restrict)

  @@index([studioId, queueSeq])
  @@index([userId, queueSeq])
  @@index([studioId, status, queueSeq])
}
```

Store only password and token hashes. Add unique indexes for normalized usernames and per-user idempotency keys.

- [ ] **Step 5: Add configuration and Prisma client**

Validate `DATABASE_URL`, `APP_ORIGIN`, `COOKIE_SECRET`, `NODE_ENV`, and session durations with Zod. Create `.env.example`:

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://studio:studio_dev_password@localhost:5432/studio_tasks
APP_ORIGIN=http://127.0.0.1:5173
COOKIE_SECRET=local-development-cookie-secret-change-before-production
USER_SESSION_HOURS=168
STUDIO_SESSION_HOURS=12
```

- [ ] **Step 6: Generate, migrate, verify, and commit**

```powershell
npm run db:generate
npm run db:migrate:dev -- --name initial_production_schema
npm run test:run -w @studio/api -- database.test.ts
git add apps/api prisma .env.example package.json package-lock.json
git commit -m "feat: add production database foundation"
```

### Task 4: Build the Fastify Shell and Security Plugins

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/lib/errors.ts`
- Create: `apps/api/src/plugins/security.ts`
- Create: `apps/api/src/plugins/request-context.ts`
- Create: `apps/api/src/modules/health/routes.ts`
- Create: `apps/api/test/health.test.ts`

- [ ] **Step 1: Write failing health tests**

```ts
expect((await app.inject({ method: 'GET', url: '/health/live' })).statusCode).toBe(200)
expect((await app.inject({ method: 'GET', url: '/health/ready' })).json()).toEqual({ status: 'ready' })
expect((await app.inject({ method: 'GET', url: '/missing' })).json()).toMatchObject({
  error: { code: 'NOT_FOUND', requestId: expect.any(String) },
})
```

- [ ] **Step 2: Verify RED**

```powershell
npm run test:run -w @studio/api -- health.test.ts
```

- [ ] **Step 3: Implement `buildApp()`**

Register request IDs, Cookie parsing, Helmet, same-origin policy, role-specific rate limits, CSRF protection, Zod error conversion, and centralized `ApiError` responses. Register `/health/live`, `/health/ready`, and `/api/v1` routes.

- [ ] **Step 4: Implement health behavior**

`live` checks the process only. `ready` executes `SELECT 1` through Prisma and returns HTTP 503 when PostgreSQL is unavailable.

- [ ] **Step 5: Verify and commit**

```powershell
npm run test:run -w @studio/api -- health.test.ts
npm run typecheck -w @studio/api
git add apps/api
git commit -m "feat: add secure Fastify application"
```

### Task 5: Implement Authentication and Sessions

**Files:**
- Create: `apps/api/src/lib/passwords.ts`
- Create: `apps/api/src/lib/tokens.ts`
- Create: `apps/api/src/modules/auth/session-service.ts`
- Create: `apps/api/src/modules/auth/routes.ts`
- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/cli/create-admin.ts`
- Create: `apps/api/src/cli/create-studio.ts`
- Create: `apps/api/test/auth.test.ts`

- [ ] **Step 1: Write failing integration tests**

Cover registration through a studio code, user login, wrong password, disabled user, admin login, studio token exchange, logout, session expiry, and studio `tokenVersion` invalidation.

The cookie assertions must include:

```ts
expect(response.headers['set-cookie']).toContain('HttpOnly')
expect(response.headers['set-cookie']).toContain('SameSite=Lax')
```

- [ ] **Step 2: Verify RED**

```powershell
npm run test:run -w @studio/api -- auth.test.ts
```

- [ ] **Step 3: Implement password and token primitives**

Use Argon2id for passwords. Generate raw session, registration, and access tokens with 32 random bytes encoded as URL-safe base64. Persist SHA-256 hashes only.

- [ ] **Step 4: Implement database sessions**

`SessionService.create()` stores token hash, principal, expiry, and optional studio token version. `resolve()` rejects expired sessions, disabled users/admins/studios, and rotated studio tokens.

- [ ] **Step 5: Implement routes and role guards**

Add registration; user, admin, and studio login/session/logout; CSRF token; and guards `requireUser`, `requireAdmin`, and `requireStudio`. Cookie names and paths must prevent one role from authenticating as another.

- [ ] **Step 6: Add initialization commands**

`create-admin` securely creates the first administrator. `create-studio` creates the single studio and prints raw registration/access links once. Re-running either command must not overwrite existing records.

- [ ] **Step 7: Verify and commit**

```powershell
npm run test:run -w @studio/api -- auth.test.ts
npm run typecheck -w @studio/api
git add apps/api prisma package.json package-lock.json
git commit -m "feat: add production authentication"
```

### Task 6: Implement User Task APIs

**Files:**
- Create: `apps/api/src/modules/tasks/task-service.ts`
- Create: `apps/api/src/modules/tasks/user-routes.ts`
- Create: `apps/api/src/modules/tasks/serializers.ts`
- Create: `apps/api/test/user-tasks.test.ts`

- [ ] **Step 1: Write failing user-task tests**

Cover:

```text
create a batch and a 200-link chunk
retry the same idempotency key without duplicates
reject non-HTTP(S) links
return user tasks in queueSeq DESC order
prevent access to another user's task
return a stable cursor and next page
```

- [ ] **Step 2: Verify RED**

```powershell
npm run test:run -w @studio/api -- user-tasks.test.ts
```

- [ ] **Step 3: Implement batch and chunk transactions**

Create batches for the authenticated user only. Normalize and deduplicate each chunk, insert tasks in one transaction, and save the idempotency key with the result. A repeated key returns the original response.

- [ ] **Step 4: Implement user list and detail queries**

Filter by authenticated `userId`, order by `queueSeq DESC`, and support status, search, and cursor pagination. Never accept a user ID from the request body or query.

- [ ] **Step 5: Verify and commit**

```powershell
npm run test:run -w @studio/api -- user-tasks.test.ts
git add apps/api
git commit -m "feat: add user task APIs"
```

### Task 7: Implement Studio Queue and Concurrency

**Files:**
- Create: `apps/api/src/modules/tasks/studio-routes.ts`
- Modify: `apps/api/src/modules/tasks/task-service.ts`
- Create: `apps/api/test/studio-tasks.test.ts`

- [ ] **Step 1: Write failing studio tests**

Cover:

```text
studio list uses queueSeq ASC
opening queued task writes processingStartedAt once
opening processing task is idempotent
terminal task is read-only
completion requires processing state and matching version
two concurrent completions return one success and one HTTP 409
next ignores active filters and uses the full queue
next queued task automatically becomes processing
studio cannot access another studio's task
```

- [ ] **Step 2: Verify RED**

```powershell
npm run test:run -w @studio/api -- studio-tasks.test.ts
```

- [ ] **Step 3: Implement transactional opening**

Conditionally update where status is `queued`. If no row changes, return the current task when it is already processing or terminal. Write an audit record only for the first queued-to-processing transition.

- [ ] **Step 4: Implement optimistic completion**

Conditionally update by task ID, studio ID, `processing` status, and expected version. Increment version and set completion time and trimmed feedback. Return HTTP 409 when the row changed concurrently.

- [ ] **Step 5: Implement next navigation**

Query the smallest `queueSeq` greater than the current task within the studio. Reuse the same open operation before returning the next task. Return `null` when the current task is last.

- [ ] **Step 6: Verify and commit**

```powershell
npm run test:run -w @studio/api -- studio-tasks.test.ts
git add apps/api
git commit -m "feat: add concurrent studio queue processing"
```

### Task 8: Implement Administrator APIs and Audit Logs

**Files:**
- Create: `apps/api/src/modules/admin/admin-service.ts`
- Create: `apps/api/src/modules/admin/routes.ts`
- Create: `apps/api/src/lib/audit.ts`
- Create: `apps/api/test/admin.test.ts`

- [ ] **Step 1: Write failing administrator tests**

Cover dashboard counts, task pagination, user enable/disable, user-session revocation, studio name update, registration-code rotation, access-token rotation, old studio-session invalidation, and paginated audit logs.

- [ ] **Step 2: Verify RED**

```powershell
npm run test:run -w @studio/api -- admin.test.ts
```

- [ ] **Step 3: Implement mutations with audit records**

Every administrator mutation writes its audit record in the same transaction. Raw rotated codes are returned once. Access-token rotation increments `tokenVersion` and invalidates all previous studio sessions.

- [ ] **Step 4: Implement administrator reads**

Dashboard counts and task/user/audit lists use server-side filters and pagination. Administrator task details are read-only.

- [ ] **Step 5: Verify and commit**

```powershell
npm run test:run -w @studio/api -- admin.test.ts
git add apps/api
git commit -m "feat: add administrator operations and audit logs"
```

### Task 9: Migrate the Frontend to HTTP APIs

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/api/auth.ts`
- Create: `apps/web/src/api/tasks.ts`
- Create: `apps/web/src/api/admin.ts`
- Replace: `apps/web/src/auth/AuthContext.tsx`
- Replace: `apps/web/src/data/DataContext.tsx`
- Modify: all page components and tests
- Delete after migration: `apps/web/src/data/repository.ts`, `seed.ts`, `storage.ts`, `auth/session.ts`

- [ ] **Step 1: Add an HTTP test harness**

Use Mock Service Worker or a typed fetch stub. Mock HTTP requests and shared contract responses rather than page state.

- [ ] **Step 2: Write failing authentication UI tests**

Cover user registration, login, logout, session restoration, disabled-user errors, administrator login, and studio access-token exchange.

- [ ] **Step 3: Implement the typed API client**

The client sends Cookies, attaches CSRF tokens to writes, validates responses with shared schemas, converts API errors, and handles HTTP 401 without storing tokens in localStorage.

- [ ] **Step 4: Replace AuthContext**

Resolve the session for the current route on startup. Store only principal, loading state, and authentication actions. Remove browser session storage.

- [ ] **Step 5: Write failing user-workbench tests**

Cover unlimited textarea input, automatic 200-link chunks, per-chunk idempotency, progress, partial retry, newest-first results, filters, search, and task details.

- [ ] **Step 6: Migrate the user workbench**

Create one batch, submit chunks sequentially, retain successful chunks when another fails, and refresh server data after completion.

- [ ] **Step 7: Write failing studio tests**

Cover oldest-first queue, task opening, exact-link QR, optional feedback, required success/failure, HTTP 409 refresh, and full-queue next navigation.

- [ ] **Step 8: Migrate the studio workbench**

Use API pagination and mutations. Exchange the private link for a studio Cookie and replace the URL with `/studio/workbench`. On conflict, reload the selected task and explain that another operator updated it.

- [ ] **Step 9: Migrate administrator pages**

Use server dashboard, task, user, studio, rotation, and audit-log endpoints. Show rotated links once with copy controls.

- [ ] **Step 10: Delete prototype persistence and verify**

```powershell
rg "localStorage|PrototypeRepository|createDemoState" apps/web/src
npm run test:run -w @studio/web
npm run build -w @studio/web
```

Expected: no business localStorage or prototype repository remains; web tests and build pass.

- [ ] **Step 11: Commit**

```powershell
git add apps/web packages/contracts
git commit -m "feat: connect all frontends to production APIs"
```

### Task 10: Add Docker, Nginx, and Backups

**Files:**
- Create: `Dockerfile.api`
- Create: `Dockerfile.web`
- Create: `compose.yaml`
- Create: `infra/nginx/default.conf`
- Create: `infra/backup/backup.sh`
- Create: `infra/backup/backup.ps1`
- Create: `.dockerignore`
- Modify: `.gitignore`
- Create: `docs/deployment.md`

- [ ] **Step 1: Create multi-stage images**

The web image builds Vite assets. The API image generates Prisma client, compiles TypeScript, runs as a non-root user, and starts after a one-shot migration service succeeds.

- [ ] **Step 2: Create the Compose stack**

Define `postgres`, `migrate`, `api`, `web`, `nginx`, and `backup` with health checks, named volumes, restart policies, and no public PostgreSQL port.

- [ ] **Step 3: Create Nginx configuration**

Serve SPA history fallback, proxy `/api`, set CSP and `Referrer-Policy: no-referrer`, limit request bodies, and provide production HTTPS redirect configuration.

- [ ] **Step 4: Add backup and restore scripts**

Run daily compressed `pg_dump`, retain seven days locally, support copying backups off-host, and document restoration into a separate verification database.

- [ ] **Step 5: Write deployment documentation**

Document prerequisites, `.env.production`, DNS, TLS, firewall, migrations, administrator/studio initialization, update, rollback, backup restore, logs, and token rotation.

- [ ] **Step 6: Verify and commit**

```powershell
docker compose config
docker compose build
docker compose up -d
docker compose ps
Invoke-WebRequest http://127.0.0.1/health/ready -UseBasicParsing
git add Dockerfile.api Dockerfile.web compose.yaml infra .dockerignore .gitignore docs/deployment.md
git commit -m "ops: add production container deployment"
```

### Task 11: Add End-to-End and Release Gates

**Files:**
- Create: `apps/api/test/e2e-flow.test.ts`
- Create: `scripts/release-check.ps1`
- Create: `scripts/release-check.sh`
- Modify: root `package.json`
- Create: `docs/release-checklist.md`

- [ ] **Step 1: Write the failing end-to-end API test**

The flow registers and logs in a user, submits multiple links, exchanges a studio token, processes the first task, opens the next task, reads feedback as the user, logs in as administrator, disables the user, and verifies the user session is rejected.

- [ ] **Step 2: Verify RED and complete missing integration wiring**

```powershell
npm run test:run -w @studio/api -- e2e-flow.test.ts
```

Only fix missing route registration, transaction boundaries, and serializers until this flow passes.

- [ ] **Step 3: Create release-check scripts**

Run in this order and stop on first failure:

```text
npm ci
workspace type checks
all unit and integration tests
web and API production builds
Prisma migration status
Docker Compose validation and image build
container health checks
backup and restore verification
```

- [ ] **Step 4: Run the complete release gate**

```powershell
.\scripts\release-check.ps1
```

Expected: every command exits with code 0, containers are healthy, and the restored verification database contains the expected schema and initialization records.

- [ ] **Step 5: Check for prototype and secret leakage**

```powershell
rg "Demo123|Admin123|resetDemoState|PrototypeRepository|localStorage" . --glob "!docs/superpowers/**" --glob "!node_modules/**"
git status --short
```

Expected: no demo credentials, prototype persistence, raw secrets, dumps, or uncommitted release files remain.

- [ ] **Step 6: Commit**

```powershell
git add apps scripts docs package.json package-lock.json
git commit -m "test: add production release gate"
```

## Completion Criteria

- All workspace type checks and tests pass.
- Web and API production builds pass.
- Migrations apply to empty and existing PostgreSQL databases.
- Docker Compose starts healthy from a clean environment.
- Full user, studio, and administrator flow passes.
- Concurrent completion returns one success and one conflict.
- Backup restoration succeeds in a separate database.
- No demo credentials, localStorage business data, raw secrets, or database dumps remain tracked.
- Deployment and release documentation contain every required command.
