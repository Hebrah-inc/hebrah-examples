import { getConnectionId, getDockerWebhookUrl, getWebhookReceiverUrl } from '@/lib/env'
import { fetchSyntheticProfile } from '@/lib/hebrah-api'

export default async function HomePage() {
  let profile: Record<string, unknown> | null = null
  let error: string | null = null
  try {
    profile = await fetchSyntheticProfile()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load profile'
  }

  return (
    <main>
      <h2>Setup</h2>
      <ul>
        <li>Connection ID: <code>{getConnectionId() || '(set HEBRAH_CONNECTION_ID)'}</code></li>
        <li>
          Webhook URL (host / browser): <code>{getWebhookReceiverUrl()}</code>
        </li>
        <li>
          Webhook URL (Docker hebrah-api): <code>{getDockerWebhookUrl()}</code>
        </li>
      </ul>
      <p style={{ fontSize: '0.875rem', color: '#666' }}>
        Register the <strong>Docker</strong> URL in hebrah Settings or the connection Tests tab when
        hebrah-api runs in Docker Compose.
      </p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {profile && (
        <pre style={{ background: '#f4f4f4', padding: '1rem', overflow: 'auto' }}>
          {JSON.stringify(profile, null, 2)}
        </pre>
      )}
      <p style={{ marginTop: '1rem' }}>
        <a href="/parity">VM FHIR parity check</a> — compare control-plane patient IDs with sidecar VM.
      </p>
    </main>
  )
}
