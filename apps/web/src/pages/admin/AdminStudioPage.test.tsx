import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminStudioPage } from './AdminStudioPage'

describe('AdminStudioPage', () => {
  it('updates the studio name', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminStudioPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.clear(screen.getByLabelText('工作室名称'))
    await userEvent.type(screen.getByLabelText('工作室名称'), '新的工作室')
    await userEvent.click(screen.getByRole('button', { name: '保存名称' }))

    expect(screen.getByDisplayValue('新的工作室')).toBeInTheDocument()
  })
})
