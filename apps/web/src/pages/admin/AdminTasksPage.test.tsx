import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminTasksPage } from './AdminTasksPage'

describe('AdminTasksPage', () => {
  it('filters by status and username or URL text', async () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminTasksPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.selectOptions(screen.getByLabelText('状态筛选'), 'failed')

    expect(await screen.findByText('https://example.com/failed')).toBeInTheDocument()
    expect(screen.queryByText('https://example.com/success')).not.toBeInTheDocument()
  })
})
