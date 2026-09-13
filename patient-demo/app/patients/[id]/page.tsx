import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PatientActions } from '@/components/patient-actions'
import { MedicationTimeline } from '@/components/medication-timeline'
import { EgfrTrajectoryChart } from '@/components/egfr-trajectory-chart'
import {
  FhirCondition,
  FhirMedicationRequest,
  FhirObservation,
  parsePatient,
  patientArchetype,
  patientCkdStage,
  patientDisplayName,
  patientMrn
} from '@/lib/fhir'
import {
  fetchPatient,
  fetchPatientConditions,
  fetchPatientMedications,
  fetchPatientObservations,
  HebrahApiError
} from '@/lib/hebrah-api'
import { Activity, Pill, User, ShieldAlert, FileText, Zap } from 'lucide-react'

export default async function PatientDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    const [raw, rawMeds, rawObs, rawConditions] = await Promise.all([
      fetchPatient(id),
      fetchPatientMedications(id),
      fetchPatientObservations(id),
      fetchPatientConditions(id)
    ])

    const patient = parsePatient(raw)
    const medications = (rawMeds || []) as FhirMedicationRequest[]
    const observations = (rawObs || []) as FhirObservation[]
    const conditions = (rawConditions || []) as FhirCondition[]

    const archetype = patientArchetype(patient)
    const ckdStage = patientCkdStage(patient)
    const activeMedsCount = medications.filter(m => m.status === 'active').length

    return (
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <Link href="/patients" className="text-xs text-muted-foreground hover:underline">
              ← Back to patient directory
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {patientDisplayName(patient)}
              </h2>
              {ckdStage && (
                <Badge variant="outline" className="border-amber-600/40 text-amber-700 bg-amber-500/10 font-mono text-xs">
                  CKD Stage {ckdStage}
                </Badge>
              )}
              {activeMedsCount >= 5 && (
                <Badge variant="outline" className="border-emerald-600/40 text-emerald-700 bg-emerald-500/10 text-xs">
                  Polypharmacy ({activeMedsCount} active)
                </Badge>
              )}
              {archetype && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {archetype.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              ID: {id} · MRN: {patientMrn(patient)} · DOB: {patient.birthDate ?? '—'} · Gender: {patient.gender ?? '—'}
            </p>
          </div>
        </div>

        {/* Tabbed Clinical Content */}
        <Tabs defaultValue="medications" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl mb-4">
            <TabsTrigger value="medications" className="gap-1.5">
              <Pill className="h-4 w-4" />
              Medications ({medications.length})
            </TabsTrigger>
            <TabsTrigger value="renal" className="gap-1.5">
              <Activity className="h-4 w-4" />
              eGFR Trajectory
            </TabsTrigger>
            <TabsTrigger value="overview" className="gap-1.5">
              <User className="h-4 w-4" />
              Demographics & Problems
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5">
              <Zap className="h-4 w-4" />
              Sandbox Actions
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Longitudinal Medications */}
          <TabsContent value="medications" className="space-y-4">
            <MedicationTimeline medications={medications} patientId={id} />
          </TabsContent>

          {/* Tab 2: Renal Function & eGFR Trajectory */}
          <TabsContent value="renal" className="space-y-4">
            <EgfrTrajectoryChart observations={observations} patientId={id} />
          </TabsContent>

          {/* Tab 3: Demographics & Problems */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Demographics</CardTitle>
                  <CardDescription>FHIR R4 Patient resource details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Full Name:</span> {patientDisplayName(patient)}</p>
                  <p><span className="text-muted-foreground">MRN:</span> {patientMrn(patient)}</p>
                  <p><span className="text-muted-foreground">Gender:</span> {patient.gender ?? '—'}</p>
                  <p><span className="text-muted-foreground">Birth Date:</span> {patient.birthDate ?? '—'}</p>
                  <p>
                    <span className="text-muted-foreground">Managing Organization:</span>{' '}
                    {patient.managingOrganization?.display ?? 'hebrah Clinical Network'}
                  </p>
                  {patient.address?.[0] && (
                    <p>
                      <span className="text-muted-foreground">Address:</span>{' '}
                      {[...(patient.address[0].line ?? []), patient.address[0].city, patient.address[0].state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Problem List</CardTitle>
                  <CardDescription>ICD-10-CM conditions recorded in chart</CardDescription>
                </CardHeader>
                <CardContent>
                  {conditions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No active conditions recorded.</p>
                  ) : (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 text-muted-foreground border-b">
                          <tr>
                            <th className="p-2 font-medium">Condition</th>
                            <th className="p-2 font-medium">ICD-10</th>
                            <th className="p-2 font-medium">Onset</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {conditions.map((c) => {
                            const code = c.code?.coding?.[0]?.code ?? '—'
                            const text = c.code?.coding?.[0]?.display ?? c.code?.text ?? 'Condition'
                            const onset = (c.onsetDateTime ?? c.recordedDate ?? '').slice(0, 10)
                            return (
                              <tr key={c.id ?? code} className="hover:bg-muted/20">
                                <td className="p-2 font-medium text-foreground">{text}</td>
                                <td className="p-2 font-mono text-muted-foreground">{code}</td>
                                <td className="p-2 font-mono text-muted-foreground">{onset || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Raw Patient Resource (JSON)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] max-h-60">
                  {JSON.stringify(raw, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Sandbox Actions */}
          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Clinical Event Triggers</CardTitle>
                <CardDescription>Trigger mock clinical webhooks for this patient chart</CardDescription>
              </CardHeader>
              <CardContent>
                <PatientActions patientId={id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  } catch (error) {
    if (error instanceof HebrahApiError && error.status === 404) {
      notFound()
    }

    const message =
      error instanceof HebrahApiError
        ? error.message
        : error instanceof Error
        ? error.message
        : 'Failed to load patient'

    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load patient</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }
}

