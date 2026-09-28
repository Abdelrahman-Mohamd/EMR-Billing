import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { KeyValue } from './KeyValue'

describe('KeyValue', () => {
  it('pairs each label with its value', () => {
    renderWithProviders(<KeyValue items={[{ label: 'Tax ID', value: '84-7729301' }]} />)
    expect(screen.getByText('Tax ID')).toBeInTheDocument()
    expect(screen.getByText('84-7729301')).toBeInTheDocument()
  })

  it('says "None" for an empty value instead of reading out a dash', () => {
    renderWithProviders(<KeyValue items={[{ label: 'Organization', value: '' }]} />)
    // The dash is a shape for the eye; the word is what is announced.
    expect(screen.getByText('None')).toHaveClass('sr-only')
    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true')
  })
})
