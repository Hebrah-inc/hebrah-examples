import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchPatient, fetchPatientList } from '@/lib/hebrah-api'
import { HebrahApiError } from '@/lib/hebrah-api'
import { parsePatient, patientArchetype, patientCkdStage, patientDisplayName, patientMrn } from '@/lib/fhir'

export default async function PatientsPage() {
  let patients: Array<{
    id: string
    name: string
    gender: string
    birthDate: string
    mrn: string
    ckdStage?: string | null
    archetype?: string | null
  }> = []
  let error: string | null = null

  try {
    const list = await fetchPatientList()
    const ids = list.patients.slice(0, 20)
    patients = await Promise.all(
      ids.map(async ({ id }) => {
        const raw = await fetchPatient(id)
        const patient = parsePatient(raw)
        return {
          id,
          name: patientDisplayName(patient),
          gender: patient.gender ?? '—',
          birthDate: patient.birthDate ?? '—',
          mrn: patientMrn(patient),
          ckdStage: patientCkdStage(patient),
          archetype: patientArchetype(patient)
        }
      })
    )
  } catch (e) {
    if (e instanceof HebrahApiError) {
      error = e.message
    } else if (e instanceof Error) {
      error = e.message
    } else {
      error = 'Failed to load patients'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Patients</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Synthetic FHIR patients & geriatric longitudinal cohorts from the hebrah control plane.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load patients</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Patient list</CardTitle>
          <CardDescription>{patients.length} patients available in sandbox</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Clinical Cohort / Archetype</TableHead>
                <TableHead>Patient ID</TableHead>
                <TableHead>MRN</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Birth date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map(patient => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <Link href={`/patients/${patient.id}`} className="font-semibold text-foreground hover:underline">
                      {patient.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {patient.ckdStage && (
                        <Badge variant="outline" className="text-[10px] border-amber-600/40 text-amber-700 bg-amber-500/10 font-mono">
                          CKD {patient.ckdStage}
                        </Badge>
                      )}
                      {patient.archetype ? (
                        <span className="text-xs text-muted-foreground capitalize">
                          {patient.archetype.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Standard Ambulatory</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{patient.id}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{patient.mrn}</TableCell>
                  <TableCell className="capitalize text-xs">{patient.gender}</TableCell>
                  <TableCell className="text-xs font-mono">{patient.birthDate}</TableCell>
                </TableRow>
              ))}
              {!patients.length && !error && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No patients found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
