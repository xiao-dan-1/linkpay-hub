import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskList } from './TaskList'

describe('TaskList', () => {
  it('renders status text and opens the selected task', async () => {
    const onSelect = vi.fn()
    const tasks = [
      {
        id: 'T1',
        url: 'https://a.test',
        status: 'queued' as const,
        userId: 'U1',
        studioId: 'S1',
        submittedAt: '2026-08-01T00:00:00.000Z',
      },
    ]

    render(<TaskList tasks={tasks} users={[]} onSelect={onSelect} />)

    expect(screen.getByText('排队中')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /查看任务 T1/ }))
    expect(onSelect).toHaveBeenCalledWith(tasks[0])
  })
})
