type Segment = {
  label: string
  pct: number
  color: string
}

type DonutChartProps = {
  segments: Segment[]
  centerLabel: string
  centerSub?: string
}

const RADIUS = 15.91549430918954

export function DonutChart({ segments, centerLabel, centerSub }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.pct, 0) || 100
  let offset = 0

  return (
    <div className="donut-wrap">
      <div className="donut-svg">
        <svg viewBox="0 0 36 36" width="100%" height="100%" aria-hidden="true">
          <circle cx="18" cy="18" r={RADIUS} className="donut-track" />
          {segments.map((s) => {
            const normalized = (s.pct / total) * 100
            const seg = (
              <circle
                key={s.label}
                cx="18"
                cy="18"
                r={RADIUS}
                className="donut-segment"
                stroke={s.color}
                strokeDasharray={`${normalized} ${100 - normalized}`}
                strokeDashoffset={25 - offset}
              />
            )
            offset += normalized
            return seg
          })}
        </svg>
        <div className="donut-center">
          <div className="donut-center-kicker">Total</div>
          <div className="donut-center-value">{centerLabel}</div>
          {centerSub && <div className="donut-center-sub">{centerSub}</div>}
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((s) => (
          <div className="donut-legend-row" key={s.label}>
            <span
              className="donut-legend-swatch"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="donut-legend-label">{s.label}</span>
            <span className="donut-legend-pct">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}