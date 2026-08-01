import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskDetails } from './TaskDetails'

describe('TaskDetails', () => {
  it('shows the payment link and saved feedback', () => {
    render(
      <TaskDetails
        task={{
          id: 'TASK-1',
          url: 'https://pay.example.test/checkout/1',
          status: 'success',
          userId: 'user-demo',
          studioId: 'studio-demo',
          submittedAt: '2026-08-01T00:00:00.000Z',
          feedback: '支付链接已确认',
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('https://pay.example.test/checkout/1')).toBeInTheDocument()
    expect(screen.getByText('支付链接已确认')).toBeInTheDocument()
  })

  it('shows the processing countdown for unfinished tasks', () => {
    render(
      <TaskDetails
        task={{
          id: 'TASK-1',
          url: 'https://pay.example.test/checkout/1',
          status: 'queued',
          userId: 'user-demo',
          studioId: 'studio-demo',
          submittedAt: '2026-08-01T00:00:00.000Z',
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('处理时限倒计时')).toBeInTheDocument()
    expect(screen.getByTitle('从提交起 15 分钟')).toBeInTheDocument()
  })
})
