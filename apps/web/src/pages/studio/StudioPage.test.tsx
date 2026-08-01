import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { mockApiState } from '../../test/mockApi'
import { StudioPage } from './StudioPage'

describe('StudioPage', () => {
  it('marks a queued task processing when opened and then completes it', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/studio-demo-8f3c2a']}>
        <AppProviders>
          <Routes>
            <Route path="/studio/:accessToken" element={<StudioPage />} />
            <Route path="/studio/workbench" element={<StudioPage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    )

    expect(screen.queryByText('提交用户')).not.toBeInTheDocument()

    const taskCard = (await screen.findByText('https://example.com/queued')).closest('.queue-row') as HTMLElement
    await userEvent.click(within(taskCard).getByRole('button', { name: '扫码' }))
    let dialog = await screen.findByRole('dialog', { name: '任务详情' })
    expect(within(dialog).getByText('处理中')).toBeInTheDocument()
    expect(within(dialog).queryByText('提交用户')).not.toBeInTheDocument()
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
    mockApiState.tasks.push({
      id: 'TASK-NEWEST', publicId: 'TASK-NEWEST', url: 'https://example.com/newest',
      status: 'queued', queueSeq: '5', submittedAt: '2026-08-02T00:00:00.000Z',
      version: 0, userLabel: '客户 A',
    })

    render(
      <MemoryRouter initialEntries={['/studio/studio-demo-8f3c2a']}>
        <AppProviders>
          <Routes>
            <Route path="/studio/:accessToken" element={<StudioPage />} />
            <Route path="/studio/workbench" element={<StudioPage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    )

    const openButtons = await screen.findAllByRole('button', { name: '扫码' })
    expect(openButtons.length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText('https://example.com/queued')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/newest')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'failed')
    const failedCard = screen.getByText('https://example.com/failed').closest('.queue-row') as HTMLElement
    await userEvent.click(within(failedCard).getByRole('button', { name: '扫码' }))

    let dialog = await screen.findByRole('dialog', { name: '任务详情' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: '下一个任务' }),
    )

    dialog = await screen.findByRole('dialog', { name: '任务详情' })
    expect(within(dialog).getByText('TASK-NEWEST')).toBeInTheDocument()
    expect(within(dialog).getByText('处理中')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '下一个任务' })).toBeEnabled()
  })
})
