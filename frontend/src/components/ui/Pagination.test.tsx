import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('marks the current page and moves on request', async () => {
    const onPageChange = vi.fn()
    renderWithProviders(<Pagination page={3} pageCount={9} onPageChange={onPageChange} />)

    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(4)

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('cannot walk off either end', () => {
    const { rerender } = renderWithProviders(<Pagination page={1} pageCount={5} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()

    rerender(<Pagination page={5} pageCount={5} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('collapses a long range around the current page', () => {
    renderWithProviders(<Pagination page={20} pageCount={40} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Page 40' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Page 10' })).not.toBeInTheDocument()
  })

  it('shows nothing but the summary when there is only one page', () => {
    renderWithProviders(<Pagination page={1} pageCount={1} onPageChange={vi.fn()} summary="3 of 3" />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByText('3 of 3')).toBeInTheDocument()
  })
})
