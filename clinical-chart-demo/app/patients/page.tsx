import Link from 'next/link'
import { fetchResourceList } from '@/lib/hebrah-api'

export default async function PatientsPage() {
  let ids: string[] = []
  let error: string | null = null
  try {
    const list = await fetchResourceList('Patient')
    ids = list.ids
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to list patients'
  }

  return (
    <main>
      <h2>Patients (connection-scoped)</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <ul>
        {ids.map((id) => (
          <li key={id}>
            <Link href={`/chart/${encodeURIComponent(id)}`}>{id}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
