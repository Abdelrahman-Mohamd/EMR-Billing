import type { ComponentProps } from 'react'
import { DetailCard } from '@/components/ui/DetailCard'
import { cn } from '@/lib/utils/cn'
import { SCROLL_MARGIN } from './chart-scroll'

export { CardEmpty, CardGroup } from '@/components/ui/DetailCard'

/**
 * One group of the chart, on a card (user, 2026-10-02: the one-page chart
 * needs its content grouped, not just spaced): the UI kit's `DetailCard`, with
 * room above it for the chart's menu to jump to (the sticky row of pills below
 * 1024px, and a little air).
 */
export function ChartCard({ className, ...props }: ComponentProps<typeof DetailCard>) {
  return <DetailCard {...props} className={cn(SCROLL_MARGIN, className)} />
}
