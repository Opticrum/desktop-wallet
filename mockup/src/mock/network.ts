export const networkOverview = {
  nodes: 1284,
  channels: 6902,
  capacityCkb: 18_420_550.22,
  settlements24h: 3417,
}

export type CapacitySegment = {
  label: string
  pct: number
  color: string
}

export const capacityBreakdown: CapacitySegment[] = [
  { label: 'Payments', pct: 53, color: 'var(--donut-1)' },
  { label: 'Liquidity', pct: 29, color: 'var(--donut-2)' },
  { label: 'Bridges', pct: 11, color: 'var(--donut-3)' },
  { label: 'Other', pct: 7, color: 'var(--donut-4)' },
]