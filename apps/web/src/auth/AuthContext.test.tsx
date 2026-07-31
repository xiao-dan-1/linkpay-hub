import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../app/AppProviders'
import { useAuth } from './AuthContext'

function Harness() {
  const auth = useAuth()

  return (
    <>
      <span>{auth.user?.username ?? '访客'}</span>
      <button onClick={() => auth.loginUser('demo', 'Demo123!')}>登录</button>
      <button onClick={auth.logoutUser}>退出</button>
    </>
  )
}

describe('AuthContext', () => {
  it('logs in and out through the repository', async () => {
    render(
      <AppProviders>
        <Harness />
      </AppProviders>,
    )

    await userEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(screen.getByText('demo')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '退出' }))
    expect(screen.getByText('访客')).toBeInTheDocument()
  })
})
