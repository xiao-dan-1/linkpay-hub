import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AppRoutes } from '../../app/routes'

describe('user key login', () => {
  it('logs in with one access key and enters the workbench', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('访问密钥')).toBeInTheDocument()
    expect(screen.queryByLabelText('账号')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('密码')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('访问密钥'), 'USR-ABCD-EFGH-JKMN-PQRS')
    await userEvent.click(screen.getByRole('button', { name: '进入工作台' }))

    expect(
      await screen.findByRole('heading', { name: '提交任务' }),
    ).toBeInTheDocument()
    expect(screen.getByText('客户 A')).toBeInTheDocument()
  })
})
