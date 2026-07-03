const CLINICAL_CHART_RESOURCE_TYPES = new Set([
  'Condition',
  'AllergyIntolerance',
  'Observation',
  'Composition',
  'Immunization',
  'Procedure',
  'DiagnosticReport',
  'ImagingStudy'
])

export type ClinicalScenarioOption = {
  id: string
  label: string
}

export const FALLBACK_CLINICAL_SCENARIOS: ClinicalScenarioOption[] = [
  { id: 'clinical_problem_lifecycle', label: 'Clinical problem lifecycle' },
  { id: 'allergy_documented', label: 'Allergy documented' },
  { id: 'immunization_administered', label: 'Immunization administered' },
  { id: 'procedure_performed', label: 'Procedure performed' },
  { id: 'vitals_and_labs', label: 'Vitals and labs' },
  { id: 'note_and_care_plan', label: 'Note signed and care plan updated' },
  { id: 'imaging_ct_workflow', label: 'CT imaging workflow' },
  { id: 'genomic_panel_reported', label: 'Genomic panel reported' }
]

export const DEFAULT_HL7_TEMPLATES: ClinicalScenarioOption[] = [
  { id: 'oru_r01_problem', label: 'ORU — problem added' },
  { id: 'oru_r01_allergy', label: 'ORU — allergy documented' },
  { id: 'oru_r01_vitals', label: 'ORU — vital recorded' },
  { id: 'mdm_t02_note', label: 'MDM — note signed' },
  { id: 'vxu_v04_immunization', label: 'VXU — immunization' },
  { id: 'ref_i13_referral', label: 'REF — referral completed' },
  { id: 'oru_r01_imaging', label: 'ORU — imaging report finalized' },
  { id: 'oru_r01_genomic', label: 'ORU — genomic result reported' }
]

type SandboxDomainLike = {
  resource_types?: string[]
  scenarios?: Array<{ id: string, name: string }>
}

export function filterClinicalScenarios(domains: SandboxDomainLike[]): ClinicalScenarioOption[] {
  const seen = new Set<string>()
  const result: ClinicalScenarioOption[] = []

  for (const domain of domains) {
    const resourceTypes = domain.resource_types ?? []
    const isClinical = resourceTypes.some(type => CLINICAL_CHART_RESOURCE_TYPES.has(type))
    if (!isClinical) continue

    for (const scenario of domain.scenarios ?? []) {
      if (seen.has(scenario.id)) continue
      seen.add(scenario.id)
      result.push({ id: scenario.id, label: scenario.name })
    }
  }

  return result.length > 0 ? result : FALLBACK_CLINICAL_SCENARIOS
}
