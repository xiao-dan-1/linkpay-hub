import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminStudioPage } from './AdminStudioPage'

describe('AdminStudioPage', () => {
  it('shows the studio list and toggles create form', async () => {
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

    expect(await screen.findByText('演示工作室')).toBeInTheDocument()
    expect(screen.getByText('1 个工作室')).toBeInTheDocument()

    // Click to show create form
    await userEvent.click(screen.getByRole('button', { name: '创建工作室' }))
    expect(screen.getByPlaceholderText('工作室名称')).toBeInTheDocument()
  })
})
