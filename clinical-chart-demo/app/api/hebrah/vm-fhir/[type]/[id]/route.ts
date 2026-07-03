import { NextResponse } from 'next/server'
import { fetchSyntheticProfile } from '@/lib/hebrah-api'

type Params = { params: Promise<{ type: string, id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { type, id } = await params
  const decodedId = decodeURIComponent(id)

  try {
    const profile = await fetchSyntheticProfile() as { base_url?: string }
    const baseUrl = profile.base_url?.replace(/\/$/, '')
    if (!baseUrl) {
      return NextResponse.json({ message: 'Profile missing base_url' }, { status: 502 })
    }

    const url = `${baseUrl}/${encodeURIComponent(type)}/${encodeURIComponent(decodedId)}`
    const res = await fetch(url, { cache: 'no-store' })
    const body = res.ok ? await res.json() : await res.text()

    if (!res.ok) {
      return NextResponse.json(
        { message: 'VM FHIR read failed', status: res.status, detail: body },
        { status: res.status === 404 ? 404 : 502 }
      )
    }

    return NextResponse.json({ resource: body, source: url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VM FHIR unreachable'
    return NextResponse.json({ message }, { status: 503 })
  }
}
