import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminUsersPage } from './AdminUsersPage'

describe('AdminUsersPage', () => {
  it('requires confirmation before disabling a user', async () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminUsersPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: '停用 demo' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '确认停用' }))

    expect(await screen.findByText('已停用')).toBeInTheDocument()
  })
})
