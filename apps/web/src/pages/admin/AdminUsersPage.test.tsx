import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AdminUsersPage } from './AdminUsersPage'

describe('AdminUsersPage', () => {
  it('creates, reveals, copies, and then masks a reusable key', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminUsersPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: '创建密钥' }))
    await userEvent.type(screen.getByLabelText('备注'), '客户 B')
    await userEvent.click(screen.getByRole('button', { name: '生成密钥' }))

    const reveal = await screen.findByRole('dialog', { name: '密钥已创建' })
    const fullKey = within(reveal).getByText(/^USR-/).textContent!
    await userEvent.click(within(reveal).getByRole('button', { name: '复制密钥' }))
    expect(writeText).toHaveBeenCalledWith(fullKey)
    await userEvent.click(within(reveal).getByRole('button', { name: '我已保存' }))

    expect(await screen.findByText('客户 B')).toBeInTheDocument()
    expect(screen.queryByText(fullKey)).not.toBeInTheDocument()
    expect(screen.getAllByText(/••••/).length).toBeGreaterThan(0)
  })

  it('requires confirmation before disabling a key', async () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminUsersPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: '停用 客户 A' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '确认停用' }))

    expect(await screen.findByText('已停用')).toBeInTheDocument()
  })

  it('creates a key with a custom value', async () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminUsersPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: '创建密钥' }))
    await userEvent.type(screen.getByLabelText('自定义密钥'), 'CUSTOM-01')
    await userEvent.click(screen.getByRole('button', { name: '生成密钥' }))

    const reveal = await screen.findByRole('dialog', { name: '密钥已创建' })
    expect(within(reveal).getByText('CUSTOM-01')).toBeInTheDocument()
    await userEvent.click(within(reveal).getByRole('button', { name: '我已保存' }))
  })

  it('copies a stored key from the list', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminUsersPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: '复制 客户 A' }))
    expect(writeText).toHaveBeenCalledWith('USR-BCDE-FGHJ-KMNP-QRST')
    expect(await screen.findByText('完整密钥已复制（客户 A）')).toBeInTheDocument()
  })

  it('requires confirmation before deleting a key', async () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <AdminUsersPage />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: '删除 客户 A' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('客户 A 已删除')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除 客户 A' })).not.toBeInTheDocument()
  })
})
