import { defaultPatientId } from '@/lib/connection-patient'
import { fetchResourceList, fetchSyntheticProfile } from '@/lib/hebrah-api'
import { getPublicAppUrl } from '@/lib/env'
import { resolveVmFhirBaseUrl } from '@/lib/vm-fhir'

async function fetchVmPatientBundle(appUrl: string) {
  const res = await fetch(
    `${appUrl}/api/hebrah/vm-fhir/Patient?_count=5`,
    { cache: 'no-store' }
  )
  if (!res.ok) {
    const detail = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(detail.message ?? `VM FHIR Patient search failed (${res.status})`)
  }
  const data = await res.json() as {
    bundle?: { entry?: Array<{ resource?: { id?: string, resourceType?: string } }> }
    source?: string
  }
  return {
    bundle: data.bundle ?? {},
    source: data.source ?? null
  }
}

export default async function ParityPage() {
  const expectedPatientId = defaultPatientId()
  const appUrl = getPublicAppUrl().replace(/\/$/, '')
  let controlPlaneIds: string[] = []
  let controlPlaneError: string | null = null
  let profile: Record<string, unknown> | null = null
  let vmFhirBaseUrl: string | null = null
  let vmPatientIds: string[] = []
  let vmError: string | null = null
  let vmPatientResource: Record<string, unknown> | null = null
  let vmFetchSource: string | null = null

  try {
    const list = await fetchResourceList('Patient')
    controlPlaneIds = list.ids
  } catch (e) {
    controlPlaneError = e instanceof Error ? e.message : 'Control plane list failed'
  }

  try {
    profile = await fetchSyntheticProfile()
    vmFhirBaseUrl = resolveVmFhirBaseUrl(profile as { base_url?: string, host_base_url?: string })
    if (vmFhirBaseUrl) {
      const { bundle, source } = await fetchVmPatientBundle(appUrl)
      vmFetchSource = source
      vmPatientIds = (bundle.entry ?? [])
        .map(entry => entry.resource?.id)
        .filter((id): id is string => Boolean(id))

      const targetId = vmPatientIds[0] ?? expectedPatientId
      try {
        const res = await fetch(
          `${appUrl}/api/hebrah/vm-fhir/Patient/${encodeURIComponent(targetId)}`,
          { cache: 'no-store' }
        )
        if (res.ok) {
          const data = await res.json() as { resource?: Record<string, unknown> }
          vmPatientResource = data.resource ?? null
        }
      } catch {
        // Optional single-resource read; list parity is enough
      }
    } else if (profile?.base_url) {
      vmError = 'No host-reachable VM FHIR URL (profile.host_base_url missing). '
        + 'Point hebrah-api ORCHESTRATOR_URL at a running Firecracker/QEMU orchestrator '
        + '(not Docker simulated-only), ensure the sidecar VM is running, '
        + 'or set HEBRAH_VM_FHIR_BASE_URL in .env.'
    } else {
      vmError = 'Profile missing VM FHIR base URL'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'VM FHIR unreachable'
    const usingGuest = Boolean(vmFhirBaseUrl?.includes('10.8.0.2'))
    vmError = usingGuest
      ? `${msg} — guest WireGuard URL is not reachable from your Mac. `
        + 'Need profile.host_base_url (hebrah-api ORCHESTRATOR_URL → real orchestrator) '
        + 'or HEBRAH_VM_FHIR_BASE_URL.'
      : msg
  }

  const firstControlPlane = controlPlaneIds[0] ?? '—'
  const firstVm = vmPatientIds[0] ?? '—'
  const idsMatch = firstControlPlane !== '—' && firstControlPlane === firstVm
  const guestBaseUrl = String(profile?.base_url ?? 'profile unavailable')
  const hostBaseUrl = profile?.host_base_url ? String(profile.host_base_url) : null

  return (
    <main>
      <h2>Control plane vs VM FHIR parity</h2>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Compares connection-scoped patient IDs from the control plane with the sidecar VM FHIR store.
        VM reads use <code>host_base_url</code> from the synthetic EHR profile (localhost port-forward)
        or <code>HEBRAH_VM_FHIR_BASE_URL</code> — not the guest WireGuard address (
        <code>10.8.0.2:8090</code>), which is not reachable from your Mac.
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
        {vmFhirBaseUrl && (
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
            VM FHIR endpoint: <code>{vmFhirBaseUrl}</code>
            {vmFetchSource && vmFetchSource !== vmFhirBaseUrl && (
              <> (fetched via <code>{vmFetchSource}</code>)</>
            )}
          </p>
        )}
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
          <h3>VM FHIR</h3>
          <p style={{ fontSize: '0.8rem', color: '#666' }}>
            Guest: <code>{guestBaseUrl}</code>
            {hostBaseUrl && (
              <>
                <br />
                Host: <code>{hostBaseUrl}</code>
              </>
            )}
          </p>
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
