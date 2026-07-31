# Task Ordering and Next Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the user payment-link list, lock in opposite default ordering for user and studio views, and add a studio-detail shortcut that opens the next task in the complete studio queue.

**Architecture:** Keep ordering in `PrototypeRepository`: user tasks remain descending and studio tasks remain ascending. `StudioPage` derives the next task from the complete ordered studio task array, not the filtered table, and delegates opening to the existing `openTask` path so queued tasks automatically enter processing. `TaskDetails` continues to render a generic footer supplied by the studio page.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, localStorage repository.

---

## File Structure

- `src/pages/user/UserWorkbenchPage.tsx`: rename the submitted-link section heading.
- `src/pages/user/UserWorkbenchPage.test.tsx`: verify the heading and newest-first rendered order.
- `src/data/repository.test.ts`: explicitly verify user descending and studio ascending task ordering.
- `src/pages/studio/StudioPage.tsx`: derive and open the next task from the complete studio queue.
- `src/pages/studio/StudioPage.test.tsx`: verify oldest-first display, filter-independent next navigation, queued-to-processing transition, and disabled terminal state.
- `src/styles/index.css`: lay out the next-task and result controls responsively.
- `docs/superpowers/specs/2026-08-01-studio-task-workbench-design.md`: already updated with the approved behavior.

### Task 1: Rename the User List and Lock In Ordering

**Files:**
- Modify: `src/pages/user/UserWorkbenchPage.test.tsx`
- Modify: `src/data/repository.test.ts`
- Modify: `src/pages/user/UserWorkbenchPage.tsx`

- [ ] **Step 1: Write the failing user-page test**

Update the existing test so the heading expectation is:

```tsx
expect(
  screen.getByRole('heading', { name: '支付链接' }),
).toBeInTheDocument()

const taskButtons = screen.getAllByRole('button', { name: /查看任务 TASK-/ })
expect(taskButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
  '查看任务 TASK-1004',
  '查看任务 TASK-1003',
  '查看任务 TASK-1002',
  '查看任务 TASK-1001',
])
```

- [ ] **Step 2: Run the user-page test and verify the heading failure**

Run:

```powershell
npm run test:run -- src/pages/user/UserWorkbenchPage.test.tsx
```

Expected: FAIL because the current heading is `我提交的支付链接`.

- [ ] **Step 3: Add explicit repository ordering assertions**

Replace the repository ordering test with assertions for both surfaces:

```ts
it('returns user tasks newest first and studio tasks oldest first', () => {
  const repository = new PrototypeRepository()
  const created = repository.createTasks(
    'user-demo',
    ['https://x.test', 'https://y.test'],
    '2026-08-02T00:00:00.000Z',
  )

  expect(repository.getUserTasks('user-demo').at(0)?.id).toBe(created.at(0)?.id)
  expect(repository.getStudioTasks('studio-demo').at(-1)?.id).toBe(created.at(-1)?.id)
})
```

- [ ] **Step 4: Implement the heading rename**

In `UserWorkbenchPage.tsx`, change:

```tsx
<h2>我提交的支付链接</h2>
```

to:

```tsx
<h2>支付链接</h2>
```

No ordering production change is required because `getUserTasks()` already sorts descending and `getStudioTasks()` already sorts ascending.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm run test:run -- src/pages/user/UserWorkbenchPage.test.tsx src/data/repository.test.ts
```

Expected: both files pass.

- [ ] **Step 6: Commit**

```powershell
git add src/pages/user/UserWorkbenchPage.tsx src/pages/user/UserWorkbenchPage.test.tsx src/data/repository.test.ts
git commit -m "feat: clarify payment link ordering"
```

### Task 2: Add Complete-Queue Next Navigation

**Files:**
- Modify: `src/pages/studio/StudioPage.test.tsx`
- Modify: `src/pages/studio/StudioPage.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write the failing studio navigation test**

Add imports:

```tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { PrototypeRepository } from '../../data/repository'
import { resetDemoState } from '../../data/storage'
```

Add setup and a second test:

```tsx
beforeEach(() => resetDemoState())

it('opens the next task from the complete queue even when it is filtered out', async () => {
  const repository = new PrototypeRepository()
  const [nextTask] = repository.createTasks(
    'user-demo',
    ['https://example.com/newest'],
    '2026-08-02T00:00:00.000Z',
  )

  render(
    <MemoryRouter initialEntries={['/studio/studio-demo-8f3c2a']}>
      <AppProviders>
        <Routes>
          <Route path="/studio/:accessToken" element={<StudioPage />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  )

  const visibleOrder = screen
    .getAllByRole('button', { name: /查看任务 TASK-/ })
    .map((button) => button.getAttribute('aria-label'))
  expect(visibleOrder).toEqual([
    '查看任务 TASK-1001',
    '查看任务 TASK-1002',
    '查看任务 TASK-1003',
    '查看任务 TASK-1004',
    `查看任务 ${nextTask.id}`,
  ])

  await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'failed')
  await userEvent.click(screen.getByRole('button', { name: '查看任务 TASK-1004' }))

  let dialog = await screen.findByRole('dialog', { name: '任务详情' })
  await userEvent.click(within(dialog).getByRole('button', { name: '下一个任务' }))

  dialog = await screen.findByRole('dialog', { name: '任务详情' })
  expect(within(dialog).getByText(nextTask.id)).toBeInTheDocument()
  expect(within(dialog).getByText('处理中')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: '下一个任务' })).toBeDisabled()
})
```

- [ ] **Step 2: Run the studio test and verify the missing-button failure**

Run:

```powershell
npm run test:run -- src/pages/studio/StudioPage.test.tsx
```

Expected: FAIL because `下一个任务` does not exist.

- [ ] **Step 3: Derive the next task from the complete studio queue**

In `StudioPage.tsx`, import `ChevronRight` and derive the next task after `selectedUser`:

```tsx
const selectedTaskIndex = selectedTask
  ? tasks.findIndex((task) => task.id === selectedTask.id)
  : -1
const nextTask = selectedTaskIndex >= 0 ? tasks[selectedTaskIndex + 1] : undefined
```

Add a navigation handler that reuses the existing open behavior:

```tsx
const openNextTask = () => {
  if (nextTask) openTask(nextTask)
}
```

- [ ] **Step 4: Render next navigation for every selected task**

Replace the current `actions` expression with:

```tsx
actions={selectedTask ? (
  <div className="studio-detail-actions">
    {selectedTask.status === 'processing' ? (
      <div className="studio-feedback-fields">
        <label htmlFor="processing-feedback">处理反馈（可选）</label>
        <textarea
          id="processing-feedback"
          value={processingFeedback}
          onChange={(event) => setProcessingFeedback(event.target.value)}
          rows={3}
          placeholder="填写需要同步给用户的处理说明"
        />
      </div>
    ) : null}
    <div className="studio-action-row">
      <button className="button ghost" disabled={!nextTask} onClick={openNextTask}>
        下一个任务<ChevronRight size={17} />
      </button>
      {selectedTask.status === 'processing' ? (
        <div className="result-action-buttons">
          <button className="button danger" onClick={() => setPendingResult('failed')}>
            <XCircle size={17} />处理失败
          </button>
          <button className="button" onClick={() => setPendingResult('success')}>
            <CheckCircle2 size={17} />处理成功
          </button>
        </div>
      ) : null}
    </div>
  </div>
) : undefined}
```

- [ ] **Step 5: Add responsive footer styles**

Replace the old studio feedback/action rules with:

```css
.studio-detail-actions,
.studio-feedback-fields {
  width: 100%;
  display: grid;
  gap: 10px;
}

.studio-feedback-fields label {
  font-size: 13px;
  font-weight: 800;
}

.studio-feedback-fields textarea {
  width: 100%;
  min-height: 78px;
  resize: vertical;
  padding: 11px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 11px;
  outline: 0;
  color: var(--text);
  background: var(--surface);
}

.studio-feedback-fields textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(8, 169, 189, 0.12);
}

.studio-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.result-action-buttons {
  display: flex;
  gap: 10px;
}
```

In the mobile media query add:

```css
.studio-action-row {
  align-items: stretch;
  flex-direction: column;
}

.result-action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm run test:run -- src/pages/studio/StudioPage.test.tsx src/components/TaskDetails.test.tsx
```

Expected: both files pass; the new test proves full-queue navigation, queued-to-processing transition, and disabled end state.

- [ ] **Step 7: Commit**

```powershell
git add src/pages/studio/StudioPage.tsx src/pages/studio/StudioPage.test.tsx src/styles/index.css
git commit -m "feat: add next task navigation"
```

### Task 3: Full Verification

**Files:**
- Verify: all source and test files

- [ ] **Step 1: Run the complete test suite**

```powershell
npm run test:run
```

Expected: all test files and tests pass with zero failures.

- [ ] **Step 2: Run the production build**

```powershell
npm run build
```

Expected: TypeScript checks and Vite production build complete with exit code 0.

- [ ] **Step 3: Verify repository state**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and no uncommitted implementation changes.
