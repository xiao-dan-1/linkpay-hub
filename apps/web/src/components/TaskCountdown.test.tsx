import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskCountdown } from './TaskCountdown'

describe('TaskCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down from 15 minutes', () => {
    render(<TaskCountdown submittedAt="2026-08-01T00:00:00.000Z" />)
    expect(screen.getByText('15:00')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(60_000) })
    expect(screen.getByText('14:00')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText('13:59')).toBeInTheDocument()
  })

  it('shows 可能过期 after the 15-minute timeout', () => {
    render(<TaskCountdown submittedAt="2026-08-01T00:00:00.000Z" />)
    act(() => { vi.advanceTimersByTime(15 * 60 * 1000) })
    expect(screen.getByText('可能过期')).toBeInTheDocument()
  })
})
