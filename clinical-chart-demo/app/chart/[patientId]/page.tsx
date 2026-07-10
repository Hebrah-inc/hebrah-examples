import { fetchResource, fetchResourceList } from '@/lib/hebrah-api'

type Props = {
  params: Promise<{ patientId: string }>
  searchParams: Promise<{ wrote?: string }>
}

type FhirResource = Record<string, unknown>

const NOTE_TYPES = [
  { id: 'progress', label: 'Progress' },
  { id: 'soap', label: 'SOAP' },
  { id: 'admission', label: 'Admission' },
  { id: 'discharge', label: 'Discharge' },
  { id: 'operative', label: 'Operative' },
  { id: 'nursing', label: 'Nursing' }
] as const

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

async function loadNotesSection() {
  try {
    const list = await fetchResourceList('Composition')
    const writebackIds = list.ids.filter(id => id.startsWith('wb_comp_'))
    const seededIds = list.ids.filter(id => !id.startsWith('wb_comp_'))
    // Prefer writebacks first, then a seeded sample — up to 5 total
    const selected = [...writebackIds.slice(0, 4), ...seededIds.slice(0, 1)].slice(0, 5)
    const items: FhirResource[] = []
    for (const id of selected) {
      try {
        items.push(await fetchResource('Composition', id) as FhirResource)
      } catch {
        // skip missing
      }
    }
    return { type: 'Composition', items }
  } catch {
    return { type: 'Composition', items: [] as FhirResource[] }
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

export default async function ChartPage({ params, searchParams }: Props) {
  const { patientId } = await params
  const { wrote } = await searchParams
  const decodedId = decodeURIComponent(patientId)
  const wroteId = wrote ? decodeURIComponent(wrote) : null

  const [patient, problems, allergies, vitals, notes, imaging, genomics] = await Promise.all([
    fetchResource('Patient', decodedId).catch(() => null),
    loadSection('Condition'),
    loadSection('AllergyIntolerance'),
    loadSection('Observation'),
    loadNotesSection(),
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
      {wroteId ? (
        <p
          style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            background: '#e8f5e9',
            border: '1px solid #a5d6a7',
            fontSize: '0.9rem'
          }}
        >
          Chart note accepted as <code>{wroteId}</code>.{' '}
          <a href="/events">View writeback webhook →</a>
        </p>
      ) : null}
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

      <section style={{ marginTop: '1.5rem', maxWidth: 560 }}>
        <h3>Add note to EHR</h3>
        <p style={{ fontSize: '0.875rem', color: '#555', marginTop: '0.25rem' }}>
          Outbound writeback via <code>POST /v1/writeback/chart-note</code> — stores a{' '}
          <code>wb_comp_*</code> Composition and fires <code>sidecar.writeback.succeeded</code>.
        </p>
        <form
          action="/api/hebrah/chart-note"
          method="POST"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}
        >
          <input type="hidden" name="patientId" value={decodedId} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
            Note type
            <select name="noteType" defaultValue="progress" style={{ padding: '0.4rem' }}>
              {NOTE_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
            Note text
            <textarea
              name="noteText"
              required
              rows={4}
              placeholder="Patient reports improved sleep after adjusting evening dose."
              style={{ padding: '0.5rem', fontFamily: 'inherit' }}
            />
          </label>
          <button type="submit" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem' }}>
            Save note to EHR
          </button>
        </form>
      </section>

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
