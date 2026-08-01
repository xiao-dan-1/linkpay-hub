import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskList } from './TaskList'

describe('TaskList', () => {
  it('renders status text and opens the selected task', async () => {
    const onSelect = vi.fn()
    const now = new Date()
    const tasks = [
      {
        id: 'T1',
        url: 'https://a.test',
        status: 'processing' as const,
        userId: 'U1',
        studioId: 'S1',
        submittedAt: now.toISOString(),
      },
    ]

    render(<TaskList tasks={tasks} users={[]} onSelect={onSelect} />)

    expect(screen.getByText('处理中')).toBeInTheDocument()
    expect(screen.getByText('https://a.test')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '扫码' }))
    expect(onSelect).toHaveBeenCalledWith(tasks[0])
  })
})
