# Admin Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the first administrator automatically from optional production environment variables without retaining or overwriting credentials in application code.

**Architecture:** Add a tested `bootstrapAdmin` service that validates optional credentials, creates the first administrator, and skips when one already exists. Run it in a one-shot Docker Compose service after migrations and before the API starts.

**Tech Stack:** TypeScript, Zod shared contracts, Prisma/PostgreSQL, Vitest, Docker Compose

---

### Task 1: Administrator bootstrap service

**Files:**
- Create: `apps/api/test/admin-bootstrap.test.ts`
- Create: `apps/api/src/services/admin-bootstrap.ts`
- Create: `apps/api/src/cli/bootstrap-admin.ts`

- [ ] **Step 1: Write failing service tests**

Test that empty configuration returns `disabled`, partial configuration rejects, complete configuration creates a hashed administrator, and an existing administrator returns `skipped` without changing its hash.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:run -w @studio/api -- test/admin-bootstrap.test.ts`

Expected: FAIL because `../src/services/admin-bootstrap.js` does not exist.

- [ ] **Step 3: Implement the minimal service and CLI**

Use `adminLoginSchema` for validation, `hashPassword` for persistence, and `prisma.admin.findFirst()` to make initialization idempotent. The CLI reads `ADMIN_BOOTSTRAP_USERNAME` and `ADMIN_BOOTSTRAP_PASSWORD`, prints only the resulting state, and always disconnects Prisma.

- [ ] **Step 4: Verify focused and full API tests**

Run:

```powershell
npm run test:run -w @studio/api -- test/admin-bootstrap.test.ts
npm run test:run -w @studio/api
```

Expected: all tests pass.

- [ ] **Step 5: Commit the service**

```powershell
git add apps/api/src/services/admin-bootstrap.ts apps/api/src/cli/bootstrap-admin.ts apps/api/test/admin-bootstrap.test.ts
git commit -m "feat: bootstrap first administrator"
```

### Task 2: Production configuration and startup ordering

**Files:**
- Modify: `.env.example`
- Modify: `compose.yaml`
- Modify: `docs/deployment.md`
- Modify: `docs/release-checklist.md`

- [ ] **Step 1: Add optional configuration documentation**

Document `ADMIN_BOOTSTRAP_USERNAME` and `ADMIN_BOOTSTRAP_PASSWORD`, including the requirement that both be supplied together and the recommendation to remove them after first creation.

- [ ] **Step 2: Add the one-shot Compose service**

Run `node apps/api/dist/cli/bootstrap-admin.js` after `migrate`, pass both optional variables, and make `api` depend on successful bootstrap completion.

- [ ] **Step 3: Validate configuration and production startup**

Run:

```powershell
docker compose --env-file .env.production config --quiet
npm run release:check -- -EnvFile .env.production -SkipInstall
```

Expected: Compose validates, bootstrap exits successfully, all tests pass, containers become healthy, and backup restoration succeeds.

- [ ] **Step 4: Commit deployment integration**

```powershell
git add .env.example compose.yaml docs/deployment.md docs/release-checklist.md
git commit -m "ops: run administrator bootstrap during startup"
```

