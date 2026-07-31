import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { PrototypeRepository } from '../../data/repository'
import { resetDemoState } from '../../data/storage'
import { StudioPage } from './StudioPage'

describe('StudioPage', () => {
  beforeEach(() => resetDemoState())

  it('marks a queued task processing when opened and then completes it', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/studio-demo-8f3c2a']}>
        <AppProviders>
          <Routes>
            <Route path="/studio/:accessToken" element={<StudioPage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(
      screen.getByRole('button', { name: '查看任务 TASK-1001' }),
    )
    let dialog = await screen.findByRole('dialog', { name: '任务详情' })
    expect(within(dialog).getByText('处理中')).toBeInTheDocument()
    await userEvent.type(
      within(dialog).getByLabelText('处理反馈（可选）'),
      '支付链接已确认',
    )

    await userEvent.click(within(dialog).getByRole('button', { name: '处理成功' }))
    const confirmation = await screen.findByRole('dialog', { name: '确认处理成功' })
    await userEvent.click(within(confirmation).getByRole('button', { name: '确认成功' }))

    dialog = await screen.findByRole('dialog', { name: '任务详情' })
    expect(within(dialog).getByText('成功')).toBeInTheDocument()
    expect(within(dialog).getByText('支付链接已确认')).toBeInTheDocument()
  })

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

    expect(
      screen
        .getAllByRole('button', { name: /查看任务 TASK-/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      '查看任务 TASK-1001',
      '查看任务 TASK-1002',
      '查看任务 TASK-1003',
      '查看任务 TASK-1004',
      `查看任务 ${nextTask.id}`,
    ])

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'failed')
    await userEvent.click(
      screen.getByRole('button', { name: '查看任务 TASK-1004' }),
    )

    let dialog = await screen.findByRole('dialog', { name: '任务详情' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: '下一个任务' }),
    )

    dialog = await screen.findByRole('dialog', { name: '任务详情' })
    expect(within(dialog).getByText(nextTask.id)).toBeInTheDocument()
    expect(within(dialog).getByText('处理中')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: '下一个任务' }),
    ).toBeDisabled()
  })
})
