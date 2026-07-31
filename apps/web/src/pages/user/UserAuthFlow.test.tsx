import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '../../app/AppProviders'
import { AppRoutes } from '../../app/routes'

describe('user registration', () => {
  it('registers from the studio link and enters the workbench', async () => {
    render(
      <MemoryRouter initialEntries={['/s/demo-studio/register']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('账号'), 'fresh-user')
    await userEvent.type(screen.getByLabelText('密码'), 'secret12')
    await userEvent.type(screen.getByLabelText('确认密码'), 'secret12')
    await userEvent.click(
      screen.getByRole('button', { name: '注册并进入工作台' }),
    )

    expect(
      await screen.findByRole('heading', { name: '提交任务' }),
    ).toBeInTheDocument()
  })
})
