import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { sessionStore } from '../../auth/session'
import { UserWorkbenchPage } from './UserWorkbenchPage'

describe('UserWorkbenchPage', () => {
  it('uses one unlimited input and labels the submitted-link list', async () => {
    sessionStore.setUserId('user-demo')
    render(
      <MemoryRouter>
        <AppProviders>
          <UserWorkbenchPage />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: '单条提交' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '批量提交' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '支付链接' }),
    ).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('button', { name: /查看任务 TASK-/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      '查看任务 TASK-1004',
      '查看任务 TASK-1003',
      '查看任务 TASK-1002',
      '查看任务 TASK-1001',
    ])
    const input = screen.getByLabelText('任务链接')
    fireEvent.change(input, {
      target: {
        value: 'https://one.test\nhttps://one.test\nftp://bad\nhttps://two.test',
      },
    })

    expect(screen.getByText(/有效 2 条/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '请修正无效链接' })).toBeDisabled()

    const links = Array.from(
      { length: 12 },
      (_, index) => `https://example.com/payment-${index}`,
    ).join('\n')
    fireEvent.change(input, { target: { value: links } })
    await userEvent.click(screen.getByRole('button', { name: '提交 12 条任务' }))

    expect(await screen.findByText('已创建 12 条任务')).toBeInTheDocument()
  })
})
