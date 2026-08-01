import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminStudioPage } from './AdminStudioPage'

describe('AdminStudioPage', () => {
  it('shows the studio list with create form', async () => {
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
    expect(screen.getByPlaceholderText('工作室名称')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /创建/ })).toBeInTheDocument()
  })
})
