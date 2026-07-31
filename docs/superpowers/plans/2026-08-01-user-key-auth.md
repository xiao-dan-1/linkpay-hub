# User Key Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace user account/password authentication with administrator-created reusable access keys, while preserving task ownership, session security, and the existing light interface.

**Architecture:** Keep `User` as the task owner but replace credential fields with a nullable SHA-256 access-key hash plus safe display metadata. The API creates keys once, authenticates them through the existing HttpOnly session system, and serializes a shared user label into task responses. The React app removes registration, changes the login form to one key field, and turns the existing user-management page into key management using current panel, table, modal, and toast patterns.

**Tech Stack:** PostgreSQL, Prisma 7, Fastify 5, Zod, React 19, React Router 7, Vitest, Testing Library, TypeScript.

---

## File Structure

- `prisma/schema.prisma`: replace user password fields and remove the obsolete studio registration code.
- `prisma/migrations/20260801080000_user_key_auth/migration.sql`: preserve old users as disabled records, add key metadata, and drop registration/account columns.
- `packages/contracts/src/auth.ts`: define normalized user-key login and user session labels while leaving administrator credentials unchanged.
- `packages/contracts/src/admin.ts`: define create-key input/output and expanded key-list rows.
- `packages/contracts/src/task.ts`: rename public task submitter identity from `username` to `userLabel`.
- `apps/api/src/lib/user-keys.ts`: generate, normalize, hash, mask, and label user access keys.
- `apps/api/src/modules/auth/routes.ts`: replace user registration/password login with access-key login.
- `apps/api/src/modules/auth/session-service.ts`: resolve user sessions with the new display label.
- `apps/api/src/modules/admin/routes.ts`: add the administrator key-creation endpoint and remove registration-link rotation.
- `apps/api/src/modules/admin/admin-service.ts`: create/list/search/toggle keys and return safe key metadata.
- `apps/api/src/modules/tasks/serializers.ts`: expose `userLabel` without exposing credential material.
- `apps/api/src/modules/tasks/task-service.ts`: include and search the new user identity fields.
- `apps/api/src/cli/create-studio.ts`: create only the work-studio access link.
- `apps/web/src/api/auth.ts`, `apps/web/src/auth/AuthContext.tsx`: switch user login to one access key.
- `apps/web/src/api/admin.ts`, `apps/web/src/domain/models.ts`: consume key-management and user-label contracts.
- `apps/web/src/pages/user/UserLoginPage.tsx`: render the single-field key login.
- `apps/web/src/pages/user/UserWorkbenchPage.tsx`: display the session key identity.
- `apps/web/src/pages/admin/AdminUsersPage.tsx`: implement key creation, one-time reveal/copy, search, and enable/disable.
- `apps/web/src/pages/admin/AdminLayout.tsx`: rename navigation to “密钥管理”.
- `apps/web/src/pages/admin/AdminStudioPage.tsx`: remove user registration-link controls.
- `apps/web/src/components/TaskList.tsx`, `apps/web/src/components/TaskDetails.tsx`: display `userLabel`.
- `apps/web/src/styles/index.css`: style the key creation/reveal dialog and responsive key table.
- Existing contract, API, and web test files: replace account fixtures and assert key-only behavior.

### Task 1: Define the public contracts and key utility

**Files:**
- Modify: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/admin.ts`
- Modify: `packages/contracts/src/task.ts`
- Modify: `packages/contracts/test/contracts.test.ts`
- Create: `apps/api/src/lib/user-keys.ts`
- Create: `apps/api/test/user-keys.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add assertions that login trims and uppercases a valid key, rejects ambiguous/short keys, accepts an optional 200-character note, and parses task responses with `userLabel`:

```ts
expect(userKeyLoginSchema.parse({ key: ' usr-abcd-efgh-jkmn-pqrs ' })).toEqual({
  key: 'USR-ABCD-EFGH-JKMN-PQRS',
})
expect(() => userKeyLoginSchema.parse({ key: 'USR-ABCI-EFGH-JKMN-PQRS' })).toThrow()
expect(createUserKeySchema.parse({ note: '客户 A' })).toEqual({ note: '客户 A' })
expect(taskSchema.parse({
  publicId: 'TASK-AB12CD34',
  url: 'https://example.test/pay',
  status: 'queued',
  queueSeq: '1',
  submittedAt: '2026-08-01T00:00:00.000Z',
  userLabel: '客户 A',
  version: 0,
}).userLabel).toBe('客户 A')
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npm run test:run -w @studio/contracts -- test/contracts.test.ts`

Expected: FAIL because `userKeyLoginSchema` and `createUserKeySchema` do not exist and `taskSchema` does not accept the new identity field.

- [ ] **Step 3: Implement the contract schemas**

Use one unambiguous key schema and keep administrator login separate:

```ts
export const userAccessKeySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(
    /^USR-[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/,
    '请输入有效的用户密钥',
  ))

export const userKeyLoginSchema = z.object({ key: userAccessKeySchema })
export const adminLoginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
})

export const sessionPrincipalSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'admin', 'studio']),
  username: z.string().optional(),
  userLabel: z.string().optional(),
  studioId: z.string().uuid().optional(),
})
```

Define `createUserKeySchema`, `adminUserSchema`, and `createUserKeyResponseSchema` with `maskedKey`, nullable `note`/`lastUsedAt`, and nonnegative `taskCount`. Replace `taskSchema.username` with `taskSchema.userLabel`.

- [ ] **Step 4: Write failing key utility tests**

```ts
it('generates an 80-bit formatted access key and safe labels', () => {
  const key = createUserAccessKey()
  expect(key).toMatch(/^USR-[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/)
  expect(hashUserAccessKey(key)).toHaveLength(64)
  expect(keyDisplayParts(key)).toEqual({
    keyPrefix: key.slice(0, 8),
    keySuffix: key.slice(-4),
  })
  expect(maskUserAccessKey({ keyPrefix: key.slice(0, 8), keySuffix: key.slice(-4) }))
    .toBe(`${key.slice(0, 8)}-••••-••••-${key.slice(-4)}`)
  expect(taskUserLabel({ note: '客户 A', keyPrefix: null, keySuffix: null })).toBe('客户 A')
  expect(sessionUserLabel({ note: null, keyPrefix: null, keySuffix: 'PQRS' }))
    .toBe('密钥用户 · 尾号 PQRS')
})
```

- [ ] **Step 5: Run the utility test and verify RED**

Run: `npm run test:run -w @studio/api -- test/user-keys.test.ts`

Expected: FAIL because `apps/api/src/lib/user-keys.ts` does not exist.

- [ ] **Step 6: Implement the minimal key utility**

```ts
import { createHash, randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createUserAccessKey() {
  const bytes = randomBytes(10)
  let bits = 0
  let value = 0
  let encoded = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      encoded += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  const groups = encoded.match(/.{4}/g) ?? []
  return `USR-${groups.join('-')}`
}

export function normalizeUserAccessKey(key: string) {
  return key.trim().toUpperCase()
}

export function hashUserAccessKey(key: string) {
  return createHash('sha256').update(normalizeUserAccessKey(key)).digest('hex')
}

export function keyDisplayParts(key: string) {
  const normalized = normalizeUserAccessKey(key)
  return { keyPrefix: normalized.slice(0, 8), keySuffix: normalized.slice(-4) }
}

export function maskUserAccessKey(user: { keyPrefix: string | null; keySuffix: string | null }) {
  return user.keyPrefix && user.keySuffix
    ? `${user.keyPrefix}-••••-••••-${user.keySuffix}`
    : '历史用户'
}

export function taskUserLabel(user: { note: string | null; keyPrefix: string | null; keySuffix: string | null }) {
  return user.note?.trim() || maskUserAccessKey(user)
}

export function sessionUserLabel(user: { note: string | null; keyPrefix: string | null; keySuffix: string | null }) {
  return user.note?.trim() || `密钥用户 · 尾号 ${user.keySuffix ?? '----'}`
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
npm run test:run -w @studio/contracts -- test/contracts.test.ts
npm run test:run -w @studio/api -- test/user-keys.test.ts
git add packages/contracts apps/api/src/lib/user-keys.ts apps/api/test/user-keys.test.ts
git commit -m "feat: define reusable user access keys"
```

Expected: both targeted suites PASS.

### Task 2: Migrate user identities without losing tasks

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260801080000_user_key_auth/migration.sql`
- Modify: `apps/api/test/database.test.ts`
- Modify: all API test user/studio fixtures that still write removed columns
- Modify: `apps/api/src/cli/create-studio.ts`

- [ ] **Step 1: Write the failing database expectation**

Change the database test fixture to create a user with safe key metadata and assert the task relation survives:

```ts
const user = await prisma.user.create({
  data: {
    accessKeyHash: 'a'.repeat(64),
    keyPrefix: 'USR-ABCD',
    keySuffix: 'PQRS',
    note: '数据库样本',
    studioId: studio.id,
  },
})
expect(user.note).toBe('数据库样本')
```

- [ ] **Step 2: Run the database test and verify RED**

Run: `npm run test:run -w @studio/api -- test/database.test.ts`

Expected: FAIL because the generated Prisma client has no key fields.

- [ ] **Step 3: Update the Prisma model and migration**

Use nullable credential fields so disabled historical rows remain valid:

```prisma
model Studio {
  id              String   @id @default(uuid())
  name            String
  accessTokenHash String   @unique
  tokenVersion    Int      @default(0)
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  users           User[]
  tasks           Task[]
}

model User {
  id            String            @id @default(uuid())
  accessKeyHash String?           @unique
  keyPrefix     String?
  keySuffix     String?
  note          String?
  lastUsedAt    DateTime?
  studioId      String
  enabled       Boolean           @default(true)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  studio        Studio            @relation(fields: [studioId], references: [id], onDelete: Restrict)
  tasks         Task[]
  submissionBatches SubmissionBatch[]

  @@index([studioId])
}
```

Migration SQL:

```sql
ALTER TABLE "User"
  ADD COLUMN "accessKeyHash" TEXT,
  ADD COLUMN "keyPrefix" TEXT,
  ADD COLUMN "keySuffix" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);

UPDATE "User" SET "enabled" = false;

DROP INDEX "User_normalizedUsername_key";
ALTER TABLE "User"
  DROP COLUMN "username",
  DROP COLUMN "normalizedUsername",
  DROP COLUMN "passwordHash";

DROP INDEX "Studio_registrationCodeHash_key";
ALTER TABLE "Studio" DROP COLUMN "registrationCodeHash";

CREATE UNIQUE INDEX "User_accessKeyHash_key" ON "User"("accessKeyHash");
```

- [ ] **Step 4: Regenerate Prisma and update fixtures**

Run `npm run db:generate`, then replace every test `User` fixture with deterministic `accessKeyHash`, `keyPrefix`, `keySuffix`, and optional `note`; remove `registrationCodeHash` from every `Studio` fixture. Change `create-studio.ts` to emit only `Studio URL: ${appOrigin}/studio/${accessToken}`.

- [ ] **Step 5: Apply migrations to development and test databases**

Run:

```powershell
npm run db:migrate:deploy
$env:DATABASE_URL=$env:TEST_DATABASE_URL; npm run db:migrate:deploy
```

Expected: both databases report all migrations applied; existing development users become disabled and historical tasks remain.

- [ ] **Step 6: Run database tests and commit**

Run:

```powershell
npm run test:run -w @studio/api -- test/database.test.ts
git add prisma apps/api/src/cli/create-studio.ts apps/api/test
git commit -m "feat: migrate users to access key identities"
```

Expected: database test PASS and TypeScript fixtures compile.

### Task 3: Add administrator key creation and safe key management

**Files:**
- Modify: `apps/api/test/admin.test.ts`
- Modify: `apps/api/src/modules/admin/routes.ts`
- Modify: `apps/api/src/modules/admin/admin-service.ts`

- [ ] **Step 1: Write failing administrator API tests**

Cover one-time key creation, safe persistence/listing, search, and session revocation:

```ts
const created = await app.inject({
  method: 'POST',
  url: '/api/v1/admin/user-keys',
  headers: writeHeaders(),
  payload: { note: '客户 A' },
})
expect(created.statusCode).toBe(201)
expect(created.json().accessKey).toMatch(/^USR-[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/)
expect(created.json().user).toMatchObject({ note: '客户 A', enabled: true, taskCount: 0 })

const stored = await prisma.user.findUniqueOrThrow({ where: { id: created.json().user.id } })
expect(stored.accessKeyHash).not.toBe(created.json().accessKey)

const listed = await app.inject({
  method: 'GET',
  url: '/api/v1/admin/users?search=%E5%AE%A2%E6%88%B7%20A',
  headers: { cookie: adminCookie },
})
expect(JSON.stringify(listed.json())).not.toContain(created.json().accessKey)
expect(listed.json().items[0]).toMatchObject({ note: '客户 A', maskedKey: expect.stringContaining('••••') })
```

- [ ] **Step 2: Run the administrator test and verify RED**

Run: `npm run test:run -w @studio/api -- test/admin.test.ts`

Expected: FAIL with 404 for `POST /api/v1/admin/user-keys`.

- [ ] **Step 3: Add the route and service method**

Parse `createUserKeySchema`, get the authenticated administrator id, create a key for the single studio, write `user.key_created`, and return the full key only from the creation response:

```ts
app.post(
  '/api/v1/admin/user-keys',
  { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
  async (request, reply) => {
    const adminId = adminPrincipal(request.principal)
    const body = createUserKeySchema.parse(request.body)
    return reply.code(201).send(await adminService.createUserKey(adminId, body.note))
  },
)
```

The service must trim blank notes to `null`, store only `hashUserAccessKey(accessKey)`, include `_count.tasks`, serialize `lastUsedAt`, and use `maskUserAccessKey`. `listUsers` searches `note`, `keyPrefix`, and `keySuffix`. `updateUserEnabled` keeps transactionally deleting all user sessions when disabled and logs `user.key_enabled_updated`.

- [ ] **Step 4: Remove obsolete registration-link rotation**

Delete `/api/v1/admin/studio/rotate-registration`, `adminService.rotateRegistration`, and their tests. Keep work-studio access rotation unchanged.

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
npm run test:run -w @studio/api -- test/admin.test.ts
git add apps/api/src/modules/admin apps/api/test/admin.test.ts
git commit -m "feat: let administrators manage user keys"
```

Expected: administrator suite PASS and no API response contains a stored raw key.

### Task 4: Authenticate users with keys and revoke disabled sessions

**Files:**
- Modify: `apps/api/test/auth.test.ts`
- Modify: `apps/api/src/modules/auth/routes.ts`
- Modify: `apps/api/src/modules/auth/session-service.ts`

- [ ] **Step 1: Replace the user registration test with key-login tests**

Create a fixture user with `hashUserAccessKey('USR-ABCD-EFGH-JKMN-PQRS')`, then assert valid login, normalized lowercase input, `lastUsedAt`, unified invalid/disabled errors, HttpOnly cookie creation, and immediate disabled-session rejection:

```ts
const login = await app.inject({
  method: 'POST',
  url: '/api/v1/auth/user/key-login',
  headers: writeHeaders(protection),
  payload: { key: ' usr-abcd-efgh-jkmn-pqrs ' },
})
expect(login.statusCode).toBe(200)
expect(login.json()).toMatchObject({
  principal: { role: 'user', userLabel: '客户 A' },
})
expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).lastUsedAt).not.toBeNull()
```

- [ ] **Step 2: Run the authentication test and verify RED**

Run: `npm run test:run -w @studio/api -- test/auth.test.ts`

Expected: FAIL with 404 for the key-login route.

- [ ] **Step 3: Implement key login and session labels**

Remove user registration and `/api/v1/auth/user/login`. Add `/api/v1/auth/user/key-login`, parse `userKeyLoginSchema`, look up `accessKeyHash`, require both user and studio enabled, update `lastUsedAt`, write `user.key_login`, issue the existing user cookie, and return `sessionUserLabel(user)`. Invalid, disabled, or legacy users all return status 401 with code `AUTH_INVALID_KEY` and message `密钥无效或已停用`.

Update `SessionService.resolve('user')` to select key identity fields and return:

```ts
principal = {
  id: user.id,
  role,
  userLabel: sessionUserLabel(user),
  studioId: user.studioId,
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
npm run test:run -w @studio/api -- test/auth.test.ts
git add apps/api/src/modules/auth apps/api/test/auth.test.ts
git commit -m "feat: authenticate users with access keys"
```

Expected: authentication suite PASS.

### Task 5: Propagate safe user labels through tasks and the end-to-end flow

**Files:**
- Modify: `apps/api/test/studio-tasks.test.ts`
- Modify: `apps/api/test/user-tasks.test.ts`
- Modify: `apps/api/test/e2e-flow.test.ts`
- Modify: `apps/api/src/modules/tasks/serializers.ts`
- Modify: `apps/api/src/modules/tasks/task-service.ts`
- Modify: `apps/api/src/modules/admin/admin-service.ts`

- [ ] **Step 1: Write failing task-label expectations**

Change task fixtures to key users and assert studio/admin responses expose a note or masked key as `userLabel`, never a hash or raw key:

```ts
expect(response.json().items[0].userLabel).toBe('客户 A')
expect(JSON.stringify(response.json())).not.toContain('accessKeyHash')
```

Change the end-to-end flow to create a key through the administrator API, log in through `/api/v1/auth/user/key-login`, submit/complete a task, and disable that key.

- [ ] **Step 2: Run the three suites and verify RED**

Run:

```powershell
npm run test:run -w @studio/api -- test/studio-tasks.test.ts test/user-tasks.test.ts test/e2e-flow.test.ts
```

Expected: FAIL because serializers still require `username` and the end-to-end flow still uses registration.

- [ ] **Step 3: Serialize and search safe labels**

Change task includes to select `{ note: true, keyPrefix: true, keySuffix: true }`. Change `serializeTask` to append `userLabel: taskUserLabel(task.user)` when a user is included. Search admin/studio task lists across `user.note`, `user.keyPrefix`, and `user.keySuffix` instead of `username`.

- [ ] **Step 4: Run suites and commit**

Run:

```powershell
npm run test:run -w @studio/api -- test/studio-tasks.test.ts test/user-tasks.test.ts test/e2e-flow.test.ts
git add apps/api/src/modules/tasks apps/api/src/modules/admin/admin-service.ts apps/api/test
git commit -m "feat: expose safe user labels in task flows"
```

Expected: all three suites PASS.

### Task 6: Replace the React account flow with key login

**Files:**
- Modify: `apps/web/src/pages/user/UserAuthFlow.test.tsx`
- Modify: `apps/web/src/auth/AuthContext.test.tsx`
- Modify: `apps/web/src/app/routes.test.tsx`
- Modify: `apps/web/src/test/mockApi.ts`
- Modify: `apps/web/src/api/auth.ts`
- Modify: `apps/web/src/auth/AuthContext.tsx`
- Modify: `apps/web/src/app/routes.tsx`
- Modify: `apps/web/src/pages/user/UserLoginPage.tsx`
- Delete: `apps/web/src/pages/user/UserRegisterPage.tsx`
- Modify: `apps/web/src/pages/user/UserWorkbenchPage.tsx`

- [ ] **Step 1: Write failing key-login UI tests**

Replace registration coverage with:

```ts
render(<MemoryRouter initialEntries={['/login']}><AppProviders><AppRoutes /></AppProviders></MemoryRouter>)
expect(screen.getByLabelText('访问密钥')).toBeInTheDocument()
expect(screen.queryByLabelText('账号')).not.toBeInTheDocument()
expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
await userEvent.type(screen.getByLabelText('访问密钥'), 'USR-ABCD-EFGH-JKMN-PQRS')
await userEvent.click(screen.getByRole('button', { name: '进入工作台' }))
expect(await screen.findByRole('heading', { name: '提交任务' })).toBeInTheDocument()
expect(screen.getByText('客户 A')).toBeInTheDocument()
```

Add a route assertion that `/s/obsolete/register` renders the standard not-found page.

- [ ] **Step 2: Run web auth tests and verify RED**

Run:

```powershell
npm run test:run -w @studio/web -- src/pages/user/UserAuthFlow.test.tsx src/auth/AuthContext.test.tsx src/app/routes.test.tsx
```

Expected: FAIL because the page still renders account/password fields and registration route.

- [ ] **Step 3: Implement the key-only client flow**

Change `authApi.loginUser(key)` to post `{ key }` to `/api/v1/auth/user/key-login`; remove `registerUser`. Change `UserPrincipal` to require `userLabel`, and change `AuthValue.loginUser` to accept one key. Remove the registration route/import/file.

Update the login page to preserve the current two-panel visual design but render only:

```tsx
<label>
  <span>访问密钥</span>
  <div className="input-with-icon">
    <KeyRound size={17} />
    <input
      aria-label="访问密钥"
      value={accessKey}
      onChange={(event) => setAccessKey(event.target.value)}
      autoComplete="off"
      spellCheck={false}
      placeholder="USR-XXXX-XXXX-XXXX-XXXX"
      required
    />
  </div>
</label>
```

Display `user.userLabel` in the workbench identity chip. Update mock API state and task fixtures to use `userLabel` and implement the key-login endpoint.

- [ ] **Step 4: Run tests and commit**

Run:

```powershell
npm run test:run -w @studio/web -- src/pages/user/UserAuthFlow.test.tsx src/auth/AuthContext.test.tsx src/app/routes.test.tsx
git add apps/web/src
git commit -m "feat: add user key login interface"
```

Expected: targeted web suites PASS.

### Task 7: Build administrator key management and remove registration settings

**Files:**
- Modify: `apps/web/src/pages/admin/AdminUsersPage.test.tsx`
- Modify: `apps/web/src/pages/admin/AdminStudioPage.test.tsx`
- Modify: `apps/web/src/api/admin.ts`
- Modify: `apps/web/src/domain/models.ts`
- Modify: `apps/web/src/pages/admin/AdminUsersPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminLayout.tsx`
- Modify: `apps/web/src/pages/admin/AdminStudioPage.tsx`
- Modify: `apps/web/src/components/TaskList.tsx`
- Modify: `apps/web/src/components/TaskDetails.tsx`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/src/test/mockApi.ts`

- [ ] **Step 1: Write failing administrator key UI tests**

Test creation with a note, one-time reveal, clipboard copy, masked listing, and disable confirmation:

```ts
await userEvent.click(await screen.findByRole('button', { name: '创建密钥' }))
await userEvent.type(screen.getByLabelText('密钥备注（可选）'), '客户 B')
await userEvent.click(screen.getByRole('button', { name: '生成密钥' }))
const reveal = await screen.findByRole('dialog', { name: '密钥已创建' })
expect(within(reveal).getByText(/^USR-/)).toBeInTheDocument()
await userEvent.click(within(reveal).getByRole('button', { name: '复制密钥' }))
await userEvent.click(within(reveal).getByRole('button', { name: '我已保存' }))
expect(await screen.findByText('客户 B')).toBeInTheDocument()
expect(screen.getByText(/••••/)).toBeInTheDocument()
```

Assert the studio settings page has no “用户注册链接” or “轮换注册链接”.

- [ ] **Step 2: Run administrator web tests and verify RED**

Run:

```powershell
npm run test:run -w @studio/web -- src/pages/admin/AdminUsersPage.test.tsx src/pages/admin/AdminStudioPage.test.tsx
```

Expected: FAIL because no create-key UI exists and registration settings are still visible.

- [ ] **Step 3: Implement API/domain consumption**

Add `createUserKey(note?: string)` using `createUserKeyResponseSchema`. Replace the `User` model with `maskedKey`, nullable `note`/`lastUsedAt`, and `taskCount`. Change `Task.username` to `Task.userLabel` and update task adapters/components.

- [ ] **Step 4: Implement the key-management page**

Keep the existing header/table/panel visual language. Add a primary “创建密钥” button, search placeholder `搜索备注、前缀或尾号`, seven-column table, and two modal states:

1. Create modal with optional 200-character textarea and cancel/generate actions.
2. Reveal modal with warning `完整密钥只显示这一次，请立即复制保存。`, monospaced key, copy button, and `我已保存` close button.

Use `navigator.clipboard.writeText`, keep the reveal modal open when copying fails, refresh the list after creation, and continue using `ConfirmDialog` for disable.

- [ ] **Step 5: Remove registration-link settings and update navigation**

Rename the sidebar item to `密钥管理`. In `AdminStudioPage`, keep studio name, metrics, and work-studio entry rotation only; update copy and confirmation text accordingly.

- [ ] **Step 6: Add responsive styles**

Extend current `.modal`, `.user-table`, and `.button` styles with `.key-create-form`, `.key-reveal`, `.key-value`, `.key-note`, and mobile table labels. Do not introduce a new color system, type scale, radius scale, or icon style.

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
npm run test:run -w @studio/web -- src/pages/admin/AdminUsersPage.test.tsx src/pages/admin/AdminStudioPage.test.tsx
git add apps/web/src
git commit -m "feat: add administrator key management"
```

Expected: both administrator page suites PASS.

### Task 8: Full verification and release readiness

**Files:**
- Modify only files required by failures discovered through tests or build.

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
npm run test:run
npm run typecheck
npm run build
```

Expected: every suite passes, TypeScript reports no errors, and Vite/API builds complete.

- [ ] **Step 2: Verify database and security invariants**

Run targeted database queries against the test database and confirm:

- `User.accessKeyHash` contains 64-character hashes only.
- No raw `USR-...` value exists in `User`, `AuditLog`, or `Session` rows.
- Disabling a key removes all matching user sessions.
- Historical disabled users and their tasks remain queryable.

- [ ] **Step 3: Verify the local production flow without Docker**

Use the canonical development addresses only:

- Web: `http://127.0.0.1:5174`
- API: `http://127.0.0.1:3001`

Log in as the configured administrator, create and copy a key, log in as that user, submit a link, open/complete it in the work-studio view, confirm feedback in the user/admin views, disable the key, and confirm the existing user session is rejected.

- [ ] **Step 4: Final commit**

```powershell
git status --short
git diff --check
git add -A
git commit -m "chore: verify user key authentication release"
```

If there are no remaining changes after verification, omit the empty commit. Expected: clean working tree.
