import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { parsePatient, patientDisplayName, patientMrn } from '@/lib/fhir'

export default async function PatientsPage() {
  let patients: Array<{
    id: string
    name: string
    gender: string
    birthDate: string
    mrn: string
  }> = []
  let error: string | null = null

  try {
    const list = await fetchPatientList()
    const ids = list.patients.slice(0, 5)
    patients = await Promise.all(
      ids.map(async ({ id }) => {
        const raw = await fetchPatient(id)
        const patient = parsePatient(raw)
        return {
          id,
          name: patientDisplayName(patient),
          gender: patient.gender ?? '—',
          birthDate: patient.birthDate ?? '—',
          mrn: patientMrn(patient)
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
          Synthetic FHIR patients from the While sandbox control plane.
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
          <CardDescription>{patients.length} patients for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
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
                    <Link href={`/patients/${patient.id}`} className="font-medium hover:underline">
                      {patient.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{patient.id}</TableCell>
                  <TableCell className="font-mono text-xs">{patient.mrn}</TableCell>
                  <TableCell className="capitalize">{patient.gender}</TableCell>
                  <TableCell>{patient.birthDate}</TableCell>
                </TableRow>
              ))}
              {!patients.length && !error && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
