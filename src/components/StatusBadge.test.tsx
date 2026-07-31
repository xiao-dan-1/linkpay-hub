import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it.each([
    ['queued', '排队中'],
    ['processing', '处理中'],
    ['success', '成功'],
    ['failed', '失败'],
  ] as const)('labels %s with text', (status, label) => {
    render(<StatusBadge status={status} />)

    expect(screen.getByText(label)).toHaveAttribute('data-status', status)
  })
})
