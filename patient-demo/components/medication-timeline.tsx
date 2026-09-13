'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MedicationChain,
  groupMedicationsIntoChains,
  FhirMedicationRequest
} from '@/lib/fhir'
import {
  Pill,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCw,
  ShieldAlert,
  Filter
} from 'lucide-react'

interface MedicationTimelineProps {
  medications: FhirMedicationRequest[]
  patientId: string
}

export function MedicationTimeline({ medications, patientId }: MedicationTimelineProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'stopped'>('all')
  const [expandedDrug, setExpandedDrug] = useState<string | null>(null)

  const chains: MedicationChain[] = groupMedicationsIntoChains(medications)

  const activeCount = chains.filter(c => c.status === 'active').length
  const stoppedCount = chains.filter(c => c.status === 'stopped').length
  const fridCount = chains.filter(c => c.isFrid && c.status === 'active').length

  const filteredChains = chains.filter(c => {
    if (filter === 'active') return c.status === 'active'
    if (filter === 'stopped') return c.status === 'stopped'
    return true
  })

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Longitudinal Medication Timeline</CardTitle>
            </div>
            <CardDescription>
              18-month longitudinal refill chaining via FHIR R4 priorPrescription links
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-600/30 text-emerald-700 bg-emerald-500/10">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              {activeCount} Active {activeCount >= 5 && '· Polypharmacy (≥5)'}
            </Badge>

            {stoppedCount > 0 && (
              <Badge variant="outline" className="border-amber-600/30 text-amber-700 bg-amber-500/10">
                <RotateCw className="mr-1 h-3.5 w-3.5" />
                {stoppedCount} Deprescribed / Stopped
              </Badge>
            )}

            {fridCount > 0 && (
              <Badge variant="outline" className="border-rose-600/30 text-rose-700 bg-rose-500/10">
                <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                {fridCount} Fall-Risk Drug (FRID)
              </Badge>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
            <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({chains.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('active')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === 'active' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Active ({activeCount})
              </button>
              {stoppedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter('stopped')}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    filter === 'stopped' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Stopped ({stoppedCount})
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {medications.length} total FHIR MedicationRequests
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {filteredChains.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No medications matching the selected filter.
          </div>
        ) : (
          filteredChains.map((chain) => {
            const isExpanded = expandedDrug === chain.drugName
            return (
              <div
                key={chain.drugName}
                className={`rounded-lg border transition-all ${
                  chain.status === 'stopped'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : chain.isFrid
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : 'border-border bg-card'
                } p-4`}
              >
                {/* Chain Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base tracking-tight text-foreground">
                        {chain.drugName}
                      </span>
                      {chain.status === 'active' && (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-normal text-xs">
                          Active
                        </Badge>
                      )}
                      {chain.status === 'stopped' && (
                        <Badge variant="outline" className="border-amber-600 text-amber-700 bg-amber-50 text-xs">
                          Stopped / Deprescribed
                        </Badge>
                      )}
                      {chain.isFrid && (
                        <Badge variant="outline" className="border-rose-500 text-rose-700 bg-rose-50 text-xs">
                          Beers FRID
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{chain.drugClass}</span>
                      {' · '}RxNorm CID: <span className="font-mono text-foreground/70">{chain.rxnorm}</span>
                      {' · '}{chain.dosage}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-right text-xs">
                    <span className="text-muted-foreground">
                      {chain.refillCount > 0 ? `${chain.refillCount} refills chained` : 'Single fill'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setExpandedDrug(isExpanded ? null : chain.drugName)}
                    >
                      {isExpanded ? 'Hide history' : 'View refill chain'}
                    </Button>
                  </div>
                </div>

                {/* Deprescribing Rationale Callout if Stopped */}
                {chain.deprescribingRationale && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-600/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <span className="font-semibold">Deprescribing Rationale (FHIR statusReason):</span>{' '}
                      {chain.deprescribingRationale}
                    </div>
                  </div>
                )}

                {/* Horizontal Refill Timeline Nodes */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1 text-xs">
                    {chain.orders.map((order, orderIdx) => {
                      const isFirst = orderIdx === 0
                      const isLast = orderIdx === chain.orders.length - 1
                      const dateStr = (order.authoredOn ?? '').slice(0, 10)
                      const isStoppedOrder = order.status === 'stopped'

                      return (
                        <React.Fragment key={order.id ?? orderIdx}>
                          <div
                            className={`flex shrink-0 flex-col items-center rounded-md border p-2 text-center transition-shadow ${
                              isStoppedOrder
                                ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                                : isLast && chain.status === 'active'
                                ? 'border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-xs'
                                : 'border-border/60 bg-muted/30 text-foreground/80'
                            }`}
                          >
                            <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                              {isFirst ? 'Initiation' : isStoppedOrder ? 'Deprescribed' : `Refill #${orderIdx}`}
                            </span>
                            <span className="font-semibold font-mono text-xs">{dateStr}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {order.dispenseRequest?.expectedSupplyDuration?.value ?? 90}d supply
                            </span>
                            {order.priorPrescription && (
                              <span className="mt-1 inline-flex items-center text-[9px] text-primary/80" title={order.priorPrescription.display}>
                                🔗 chained
                              </span>
                            )}
                          </div>

                          {!isLast && (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                          )}
                        </React.Fragment>
                      )
                    })}
                  </div>
                </div>

                {/* Detailed Table (Expanded) */}
                {isExpanded && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Order Chain Audit Trail</p>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 text-muted-foreground border-b">
                          <tr>
                            <th className="p-2 font-medium">Order ID</th>
                            <th className="p-2 font-medium">Date</th>
                            <th className="p-2 font-medium">Type</th>
                            <th className="p-2 font-medium">Status</th>
                            <th className="p-2 font-medium">priorPrescription Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {chain.orders.map((o, idx) => (
                            <tr key={o.id} className="hover:bg-muted/20">
                              <td className="p-2 font-mono text-foreground">{o.id}</td>
                              <td className="p-2 font-mono">{(o.authoredOn ?? '').slice(0, 10)}</td>
                              <td className="p-2">
                                {idx === 0 ? (
                                  <Badge variant="outline" className="text-[10px]">Initiation</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">Refill #{idx}</Badge>
                                )}
                              </td>
                              <td className="p-2 capitalize">
                                <span className={o.status === 'active' ? 'text-emerald-600 font-semibold' : o.status === 'stopped' ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                                  {o.status}
                                </span>
                              </td>
                              <td className="p-2 font-mono text-[11px] text-muted-foreground">
                                {o.priorPrescription?.reference ?? 'None (Initial Fill)'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
