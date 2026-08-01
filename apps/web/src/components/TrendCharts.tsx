import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '@linkpay/contracts'

interface TrendChartsProps {
  daily: TrendPoint[]
}

/** Format a YYYY-MM-DD string to a short display form (M/D). Timezone-safe. */
function shortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(m!, 10)}/${parseInt(d!, 10)}`
}

/**
 * Hex colors drawn from the project's CSS design tokens.
 * These mirror: --text-muted, --primary, --success, --failed, --primary-soft.
 * Duplicated here as inline constants so recharts (which renders SVG)
 * can reference them without CSS custom properties.
 */
const COLORS = {
  submitted: '#6d7b8d',
  completed: '#08a9bd',
  success: '#15803d',
  failed: '#dc2626',
  primarySoft: '#ddf6f8',
  border: '#dce6ec',
  surface: '#ffffff',
} as const

export function TrendCharts({ daily }: TrendChartsProps) {
  const dailyWithRate = useMemo(
    () =>
      daily.map((d) => ({
        ...d,
        rate:
          d.success + d.failed > 0
            ? Math.round((d.success / (d.success + d.failed)) * 100)
            : null,
      })),
    [daily],
  )

  if (daily.length === 0) return null

  return (
    <section className="trends-section">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TRENDS</p>
          <h2>趋势分析</h2>
          <p>查看近期任务提交和成功率的变化趋势。</p>
        </div>
      </div>

      <div className="trends-charts">
        {/* Chart 1 — Task volume over time */}
        <article className="trend-chart-card">
          <h3>任务提交与完成趋势</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={daily} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: COLORS.submitted }}
                axisLine={{ stroke: COLORS.border }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: COLORS.submitted }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) => shortDate(String(label))}
                contentStyle={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 11,
                  background: COLORS.surface,
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: COLORS.submitted }}
              />
              <Line
                type="monotone"
                dataKey="submitted"
                name="提交"
                stroke={COLORS.submitted}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="completed"
                name="完成"
                stroke={COLORS.completed}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="success"
                name="成功"
                stroke={COLORS.success}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="failed"
                name="失败"
                stroke={COLORS.failed}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>

        {/* Chart 2 — Success rate over time */}
        <article className="trend-chart-card">
          <h3>成功率趋势</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyWithRate} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: COLORS.submitted }}
                axisLine={{ stroke: COLORS.border }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11, fill: COLORS.submitted }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) => shortDate(String(label))}
                formatter={(value) => [`${value}%`, '成功率']}
                contentStyle={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 11,
                  background: COLORS.surface,
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              />
              {/* Reference line at 80% */}
              <Line
                type="monotone"
                dataKey={() => 80}
                stroke={COLORS.border}
                strokeDasharray="4 4"
                strokeWidth={1}
                dot={false}
                activeDot={false}
                name="80% 参考线"
              />
              <Area
                type="monotone"
                dataKey="rate"
                name="成功率"
                stroke={COLORS.success}
                strokeWidth={2}
                fill={COLORS.primarySoft}
                fillOpacity={0.6}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </article>
      </div>
    </section>
  )
}
