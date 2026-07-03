import { defaultPatientId } from '@/lib/connection-patient'
import { fetchResource, fetchResourceList, fetchSyntheticProfile } from '@/lib/hebrah-api'

async function fetchVmPatientBundle(baseUrl: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/Patient?_count=5`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`VM FHIR Patient search failed (${res.status})`)
  }
  return res.json() as Promise<{
    entry?: Array<{ resource?: { id?: string, resourceType?: string } }>
  }>
}

export default async function ParityPage() {
  const expectedPatientId = defaultPatientId()
  let controlPlaneIds: string[] = []
  let controlPlaneError: string | null = null
  let profile: Record<string, unknown> | null = null
  let vmPatientIds: string[] = []
  let vmError: string | null = null
  let vmPatientResource: Record<string, unknown> | null = null

  try {
    const list = await fetchResourceList('Patient')
    controlPlaneIds = list.ids
  } catch (e) {
    controlPlaneError = e instanceof Error ? e.message : 'Control plane list failed'
  }

  try {
    profile = await fetchSyntheticProfile()
    const baseUrl = String(profile.base_url ?? '')
    if (baseUrl) {
      const bundle = await fetchVmPatientBundle(baseUrl)
      vmPatientIds = (bundle.entry ?? [])
        .map(entry => entry.resource?.id)
        .filter((id): id is string => Boolean(id))

      const targetId = vmPatientIds[0] ?? expectedPatientId
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3009'}/api/hebrah/vm-fhir/Patient/${encodeURIComponent(targetId)}`,
          { cache: 'no-store' }
        )
        if (res.ok) {
          const data = await res.json() as { resource?: Record<string, unknown> }
          vmPatientResource = data.resource ?? null
        }
      } catch {
        // Optional single-resource read; list parity is enough
      }
    }
  } catch (e) {
    vmError = e instanceof Error ? e.message : 'VM FHIR unreachable'
  }

  const firstControlPlane = controlPlaneIds[0] ?? '—'
  const firstVm = vmPatientIds[0] ?? '—'
  const idsMatch = firstControlPlane !== '—' && firstControlPlane === firstVm

  return (
    <main>
      <h2>Control plane vs VM FHIR parity</h2>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Compares connection-scoped patient IDs from the control plane with the sidecar VM FHIR store.
        Requires a provisioned sandbox VM (WireGuard / sidecar on <code>10.8.0.2:8090</code>).
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Summary</h3>
        <p>
          Expected patient: <code>{expectedPatientId}</code>
        </p>
        <p>
          Match:{' '}
          <strong style={{ color: idsMatch ? 'green' : vmError ? '#666' : 'crimson' }}>
            {vmError ? 'VM unreachable' : idsMatch ? 'IDs match' : 'Mismatch'}
          </strong>
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
        <section>
          <h3>Control plane</h3>
          {controlPlaneError && <p style={{ color: 'crimson' }}>{controlPlaneError}</p>}
          <p>First Patient ID: <code>{firstControlPlane}</code></p>
          <pre style={{ background: '#f4f4f4', padding: '0.75rem', fontSize: '0.8rem', overflow: 'auto' }}>
            {JSON.stringify(controlPlaneIds, null, 2)}
          </pre>
        </section>

        <section>
          <h3>VM FHIR ({String(profile?.base_url ?? 'profile unavailable')})</h3>
          {vmError && <p style={{ color: 'crimson' }}>{vmError}</p>}
          <p>First Patient ID: <code>{firstVm}</code></p>
          <pre style={{ background: '#f4f4f4', padding: '0.75rem', fontSize: '0.8rem', overflow: 'auto' }}>
            {JSON.stringify(vmPatientIds, null, 2)}
          </pre>
          {vmPatientResource && (
            <>
              <h4 style={{ marginTop: '1rem' }}>Sample VM Patient resource</h4>
              <pre style={{ background: '#f4f4f4', padding: '0.75rem', fontSize: '0.75rem', overflow: 'auto' }}>
                {JSON.stringify(vmPatientResource, null, 2)}
              </pre>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
