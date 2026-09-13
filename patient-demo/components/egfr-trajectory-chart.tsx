'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EgfrDataPoint, FhirObservation, extractEgfrSeries } from '@/lib/fhir'
import { Activity, TrendingDown, AlertCircle, Calendar, Info } from 'lucide-react'

interface EgfrTrajectoryChartProps {
  observations: FhirObservation[]
  patientId: string
}

export function EgfrTrajectoryChart({ observations, patientId }: EgfrTrajectoryChartProps) {
  const points: EgfrDataPoint[] = extractEgfrSeries(observations)
  const [hoveredPoint, setHoveredPoint] = useState<EgfrDataPoint | null>(null)

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Renal Function & eGFR Trajectory</CardTitle>
          </div>
          <CardDescription>LOINC 98979-8 derived via race-free CKD-EPI 2021 equation</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No longitudinal renal observations recorded for this chart.
          </p>
        </CardContent>
      </Card>
    )
  }

  const baseline = points[0]
  const current = points[points.length - 1]
  const delta = Number((current.egfr - baseline.egfr).toFixed(1))
  const isDeclining = delta < -5.0

  // SVG dimensions & coordinate scales
  const svgWidth = 600
  const svgHeight = 220
  const padding = { top: 20, right: 30, bottom: 35, left: 45 }
  const plotWidth = svgWidth - padding.left - padding.right
  const plotHeight = svgHeight - padding.top - padding.bottom

  // Y scale: 0 to 90 mL/min/1.73m2
  const maxY = 90
  const minY = 0
  const getY = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val))
    return padding.top + plotHeight - ((clamped - minY) / (maxY - minY)) * plotHeight
  }

  // X scale: evenly spaced points along time
  const getX = (index: number) => {
    if (points.length === 1) return padding.left + plotWidth / 2
    return padding.left + (index / (points.length - 1)) * plotWidth
  }

  // Polyline points string
  const polylinePoints = points.map((p, idx) => `${getX(idx)},${getY(p.egfr)}`).join(' ')

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Renal Function & eGFR Trajectory</CardTitle>
            </div>
            <CardDescription>
              Race-free CKD-EPI 2021 equation (LOINC 98979-8) across 18-month longitudinal visit schedule
            </CardDescription>
          </div>

          <Badge variant="outline" className={`font-medium border-${current.stageColor}-500/40 text-${current.stageColor}-700 bg-${current.stageColor}-500/10`}>
            Stage {current.stage} ({current.stageLabel})
          </Badge>
        </div>

        {/* Clinical KPI Summary Strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-3">
          <div className="rounded-md border bg-muted/20 p-2.5">
            <span className="text-[11px] text-muted-foreground uppercase font-mono tracking-wider">Current eGFR</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">{current.egfr}</span>
              <span className="text-xs text-muted-foreground">mL/min</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-2.5">
            <span className="text-[11px] text-muted-foreground uppercase font-mono tracking-wider">Baseline eGFR</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground/80">{baseline.egfr}</span>
              <span className="text-xs text-muted-foreground">mL/min</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-2.5">
            <span className="text-[11px] text-muted-foreground uppercase font-mono tracking-wider">18-mo Trajectory (Δ)</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold font-mono tracking-tight ${delta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
              <span className="text-xs text-muted-foreground">mL/min</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 p-2.5">
            <span className="text-[11px] text-muted-foreground uppercase font-mono tracking-wider">Serum Creatinine</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {current.creatinine !== undefined ? `${current.creatinine}` : '—'}
              </span>
              <span className="text-xs text-muted-foreground">mg/dL</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Acute Decline / Progression Alert */}
        {isDeclining && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-semibold">Clinical Alert — Progressive Renal Decline:</span> Patient demonstrates an
              accelerated decline of {Math.abs(delta)} mL/min/1.73m² from baseline (transitioned to {current.stage}).
              Evaluate for renal dose adjustments and nephrotoxic drug avoidance (e.g. holding Metformin at eGFR &lt; 30).
            </div>
          </div>
        )}

        {/* SVG Chart Container */}
        <div className="relative rounded-lg border bg-card p-2 overflow-hidden">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible select-none">
            <defs>
              <linearGradient id="egfrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Shaded CKD Reference Bands */}
            {/* G1 & G2: >= 60 */}
            <rect x={padding.left} y={getY(90)} width={plotWidth} height={getY(60) - getY(90)} fill="#10b981" fillOpacity="0.06" />
            {/* G3a: 45 - 59 */}
            <rect x={padding.left} y={getY(60)} width={plotWidth} height={getY(45) - getY(60)} fill="#eab308" fillOpacity="0.08" />
            {/* G3b: 30 - 44 */}
            <rect x={padding.left} y={getY(45)} width={plotWidth} height={getY(30) - getY(45)} fill="#f97316" fillOpacity="0.10" />
            {/* G4: 15 - 29 */}
            <rect x={padding.left} y={getY(30)} width={plotWidth} height={getY(15) - getY(30)} fill="#ef4444" fillOpacity="0.12" />
            {/* G5: < 15 */}
            <rect x={padding.left} y={getY(15)} width={plotWidth} height={getY(0) - getY(15)} fill="#991b1b" fillOpacity="0.16" />

            {/* Horizontal Stage Threshold Grid Lines */}
            {[60, 45, 30, 15].map(threshold => (
              <g key={threshold}>
                <line
                  x1={padding.left}
                  y1={getY(threshold)}
                  x2={padding.left + plotWidth}
                  y2={getY(threshold)}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 6}
                  y={getY(threshold) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] font-mono"
                >
                  {threshold}
                </text>
              </g>
            ))}

            {/* Y Axis Label */}
            <text
              transform={`rotate(-90 ${padding.left - 28} ${padding.top + plotHeight / 2})`}
              x={padding.left - 28}
              y={padding.top + plotHeight / 2}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-medium"
            >
              eGFR (mL/min/1.73m²)
            </text>

            {/* X Axis Time Labels */}
            {points.map((p, idx) => (
              <text
                key={p.id}
                x={getX(idx)}
                y={padding.top + plotHeight + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px] font-mono"
              >
                {p.periodQuarter || p.date.slice(2, 7)}
              </text>
            ))}

            {/* Shaded Area Below Curve */}
            <polygon
              points={`${getX(0)},${padding.top + plotHeight} ${polylinePoints} ${getX(points.length - 1)},${padding.top + plotHeight}`}
              fill="url(#egfrGradient)"
            />

            {/* Trajectory Polyline */}
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylinePoints}
            />

            {/* Data Points */}
            {points.map((p, idx) => {
              const cx = getX(idx)
              const cy = getY(p.egfr)
              const isHovered = hoveredPoint?.id === p.id

              return (
                <g
                  key={p.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill={isHovered ? '#1d4ed8' : '#3b82f6'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  {isHovered && (
                    <text
                      x={cx}
                      y={cy - 10}
                      textAnchor="middle"
                      className="fill-foreground font-bold font-mono text-[11px]"
                    >
                      {p.egfr}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Hovered Point Detail Callout or Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-t pt-3">
          <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
            <span className="font-medium text-foreground">Bands:</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> &gt;=60 Normal</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> 45-59 G3a</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 30-44 G3b</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> 15-29 G4</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-800" /> &lt;15 G5</span>
          </div>

          {hoveredPoint && (
            <div className="font-mono text-xs text-foreground bg-muted/40 px-2 py-0.5 rounded border">
              {hoveredPoint.date}: <strong>{hoveredPoint.egfr} mL/min</strong> (Stage {hoveredPoint.stage})
              {hoveredPoint.creatinine !== undefined && ` · Cr: ${hoveredPoint.creatinine} mg/dL`}
            </div>
          )}
        </div>

        {/* Longitudinal Renal Panel Table */}
        <div className="mt-2 rounded-md border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="p-2 font-medium">Draw Date</th>
                <th className="p-2 font-medium">Period</th>
                <th className="p-2 font-medium">eGFR (CKD-EPI 2021)</th>
                <th className="p-2 font-medium">Serum Creatinine</th>
                <th className="p-2 font-medium">CKD Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {points.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 font-mono">
                  <td className="p-2 font-medium text-foreground">{p.date}</td>
                  <td className="p-2 text-muted-foreground">{p.periodQuarter || '—'}</td>
                  <td className="p-2 font-bold text-foreground">{p.egfr} mL/min/1.73m²</td>
                  <td className="p-2">{p.creatinine !== undefined ? `${p.creatinine} mg/dL` : '—'}</td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      Stage {p.stage}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
