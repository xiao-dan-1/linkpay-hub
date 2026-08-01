import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../app/AppProviders'
import { mockApiState } from '../test/mockApi'
import { useAuth } from './AuthContext'

function Harness() {
  const auth = useAuth()

  return (
    <>
      <span>{auth.user?.userLabel ?? '访客'}</span>
      <button onClick={() => auth.loginUser('USR-ABCD-EFGH-JKMN-PQRS')}>登录</button>
      <button onClick={auth.logoutUser}>退出</button>
    </>
  )
}

describe('AuthContext', () => {
  it('logs in and out through the production API', async () => {
    mockApiState.userSession = null
    render(
      <AppProviders>
        <Harness />
      </AppProviders>,
    )

    expect(await screen.findByText('访客')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(screen.getByText('客户 A')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '退出' }))
    expect(screen.getByText('访客')).toBeInTheDocument()
  })
})
