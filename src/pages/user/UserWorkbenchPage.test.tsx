import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { sessionStore } from '../../auth/session'
import { UserWorkbenchPage } from './UserWorkbenchPage'

describe('UserWorkbenchPage', () => {
  it('validates a batch and submits only unique valid links', async () => {
    sessionStore.setUserId('user-demo')
    render(
      <MemoryRouter>
        <AppProviders>
          <UserWorkbenchPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: '批量提交' }))
    const input = screen.getByLabelText('任务链接')
    await userEvent.type(
      input,
      'https://one.test\nhttps://one.test\nftp://bad\nhttps://two.test',
    )

    expect(screen.getByText(/有效 2 条/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '请修正无效链接' })).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(
      input,
      'https://one.test\nhttps://one.test\nhttps://two.test',
    )
    await userEvent.click(screen.getByRole('button', { name: '提交 2 条任务' }))

    expect(await screen.findByText('已创建 2 条任务')).toBeInTheDocument()
  })
})
