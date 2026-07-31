import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from './AppProviders'
import { AppRoutes } from './routes'

describe('application routes', () => {
  it('redirects anonymous users to login', async () => {
    render(
      <MemoryRouter initialEntries={['/user/workbench']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: '用户登录' }),
    ).toBeInTheDocument()
  })

  it('shows an invalid studio state for unknown tokens', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/unknown']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: '入口已失效' }),
    ).toBeInTheDocument()
  })
})
