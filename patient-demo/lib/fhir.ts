export interface FhirHumanName {
  family?: string
  given?: string[]
}

export interface FhirIdentifier {
  system?: string
  value?: string
  use?: string
}

export interface FhirPatient {
  resourceType?: string
  id?: string
  name?: FhirHumanName[]
  gender?: string
  birthDate?: string
  identifier?: FhirIdentifier[]
  telecom?: Array<{ system?: string, value?: string }>
  address?: Array<{
    line?: string[]
    city?: string
    state?: string
    postalCode?: string
  }>
  managingOrganization?: { display?: string }
}

export function parsePatient(raw: Record<string, unknown>): FhirPatient {
  return raw as FhirPatient
}

export function patientDisplayName(patient: FhirPatient) {
  const name = patient.name?.[0]
  if (!name) return patient.id ?? 'Unknown'
  const given = name.given?.join(' ') ?? ''
  return [given, name.family].filter(Boolean).join(' ') || patient.id || 'Unknown'
}

export function patientMrn(patient: FhirPatient) {
  const official = patient.identifier?.find(i => i.use === 'official')
  return official?.value ?? patient.identifier?.[0]?.value ?? '—'
}
