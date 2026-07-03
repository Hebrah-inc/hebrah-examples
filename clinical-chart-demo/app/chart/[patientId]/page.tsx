import { fetchResource, fetchResourceList } from '@/lib/hebrah-api'

type Props = { params: Promise<{ patientId: string }> }

type FhirResource = Record<string, unknown>

async function loadSection(type: string) {
  try {
    const list = await fetchResourceList(type)
    const firstId = list.ids[0]
    if (!firstId) return { type, items: [] as FhirResource[] }
    const resource = await fetchResource(type, firstId)
    return { type, items: [resource as FhirResource] }
  } catch {
    return { type, items: [] as FhirResource[] }
  }
}

async function loadImagingSection() {
  try {
    const [studies, reports] = await Promise.all([
      fetchResourceList('ImagingStudy'),
      fetchResourceList('DiagnosticReport')
    ])
    const items: FhirResource[] = []
    if (studies.ids[0]) {
      items.push(await fetchResource('ImagingStudy', studies.ids[0]) as FhirResource)
    }
    for (const reportId of reports.ids) {
      if (!reportId.startsWith('imgdr_')) continue
      items.push(await fetchResource('DiagnosticReport', reportId) as FhirResource)
      break
    }
    return { type: 'Imaging', items }
  } catch {
    return { type: 'Imaging', items: [] as FhirResource[] }
  }
}

async function loadGenomicsSection(patientId: string) {
  try {
    const list = await fetchResourceList('Observation')
    const genomicIds = list.ids.filter(id => id.startsWith('genomic_'))
    const items: FhirResource[] = []
    for (const obsId of genomicIds.slice(0, 2)) {
      items.push(await fetchResource('Observation', obsId, patientId) as FhirResource)
    }
    return { type: 'Genomics', items }
  } catch {
    return { type: 'Genomics', items: [] as FhirResource[] }
  }
}

export default async function ChartPage({ params }: Props) {
  const { patientId } = await params
  const decodedId = decodeURIComponent(patientId)

  const [patient, problems, allergies, vitals, notes, imaging, genomics] = await Promise.all([
    fetchResource('Patient', decodedId).catch(() => null),
    loadSection('Condition'),
    loadSection('AllergyIntolerance'),
    loadSection('Observation'),
    loadSection('Composition'),
    loadImagingSection(),
    loadGenomicsSection(decodedId)
  ])

  const vitalsFiltered = {
    ...vitals,
    items: vitals.items.filter(item => !String(item.id ?? '').startsWith('genomic_'))
  }

  return (
    <main>
      <h2>Chart — {decodedId}</h2>
      <section>
        <h3>Demographics</h3>
        <pre style={{ background: '#f4f4f4', padding: '0.75rem' }}>{JSON.stringify(patient, null, 2)}</pre>
      </section>
      {[
        { title: 'Problems', data: problems },
        { title: 'Allergies', data: allergies },
        { title: 'Vitals / Labs', data: vitalsFiltered },
        { title: 'Notes', data: notes },
        { title: 'Imaging', data: imaging },
        { title: 'Genomics', data: genomics }
      ].map(({ title, data }) => (
        <section key={title} style={{ marginTop: '1rem' }}>
          <h3>{title}</h3>
          <pre style={{ background: '#f4f4f4', padding: '0.75rem', fontSize: '0.85rem' }}>
            {JSON.stringify(data.items, null, 2)}
          </pre>
        </section>
      ))}
      <form action={`/api/hebrah/scenario`} method="POST" style={{ marginTop: '1.5rem' }}>
        <input type="hidden" name="patientId" value={decodedId} />
        <input type="hidden" name="scenarioId" value="clinical_problem_lifecycle" />
        <button type="submit">Run clinical_problem_lifecycle → events</button>
      </form>
      <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
        <a href={`/clinical?patientId=${encodeURIComponent(decodedId)}`}>More scenarios and HL7 inject</a>
      </p>
    </main>
  )
}
