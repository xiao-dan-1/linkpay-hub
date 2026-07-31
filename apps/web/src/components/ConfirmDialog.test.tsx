import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>打开确认</button>
      <ConfirmDialog
        open={open}
        title="确认操作"
        description="确认后执行操作。"
        confirmLabel="确认"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

describe('ConfirmDialog', () => {
  it('locks page scrolling and restores focus after Escape', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: '打开确认' })
    await userEvent.click(opener)

    expect(document.body.style.overflow).toBe('hidden')
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })
})
