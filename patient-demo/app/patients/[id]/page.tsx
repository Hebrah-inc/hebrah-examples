import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PatientActions } from '@/components/patient-actions'
import { parsePatient, patientDisplayName, patientMrn } from '@/lib/fhir'
import { fetchPatient } from '@/lib/hebrah-api'
import { HebrahApiError } from '@/lib/hebrah-api'

export default async function PatientDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  try {
    const raw = await fetchPatient(id)
    const patient = parsePatient(raw)

    return (
      <div className="space-y-6">
        <div>
          <Link href="/patients" className="text-sm text-muted-foreground hover:underline">
            ← Back to patients
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{patientDisplayName(patient)}</h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{id}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Demographics</CardTitle>
              <CardDescription>FHIR R4 Patient resource</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">MRN:</span> {patientMrn(patient)}</p>
              <p><span className="text-muted-foreground">Gender:</span> {patient.gender ?? '—'}</p>
              <p><span className="text-muted-foreground">Birth date:</span> {patient.birthDate ?? '—'}</p>
              <p>
                <span className="text-muted-foreground">Organization:</span>{' '}
                {patient.managingOrganization?.display ?? '—'}
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
              <CardTitle>Sandbox actions</CardTitle>
              <CardDescription>Trigger mock clinical webhooks for this patient</CardDescription>
            </CardHeader>
            <CardContent>
              <PatientActions patientId={id} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Raw FHIR JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    if (error instanceof HebrahApiError && error.status === 404) {
      notFound()
    }

    const message = error instanceof HebrahApiError
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
