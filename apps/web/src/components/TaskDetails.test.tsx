import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskDetails } from './TaskDetails'

describe('TaskDetails', () => {
  it('shows a QR code below the payment link and saved feedback', () => {
    render(
      <TaskDetails
        task={{
          id: 'TASK-QR',
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

    expect(screen.getByText('支付二维码')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '任务 TASK-QR 支付二维码' }),
    ).toBeInTheDocument()
    expect(screen.getByText('支付链接已确认')).toBeInTheDocument()
  })
})
