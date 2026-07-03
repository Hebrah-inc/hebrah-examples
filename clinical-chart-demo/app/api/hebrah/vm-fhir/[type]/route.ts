import { NextResponse } from 'next/server'
import { fetchVmFhir } from '@/lib/vm-fhir'

type Params = { params: Promise<{ type: string }> }

export async function GET(request: Request, { params }: Params) {
  const { type } = await params
  const { search } = new URL(request.url)
  const query = search || ''

  try {
    const { res, url } = await fetchVmFhir(`/${encodeURIComponent(type)}${query}`)
    const body = res.ok ? await res.json() : await res.text()

    if (!res.ok) {
      return NextResponse.json(
        { message: 'VM FHIR search failed', status: res.status, detail: body, source: url },
        { status: res.status === 404 ? 404 : 502 }
      )
    }

    return NextResponse.json({ bundle: body, source: url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VM FHIR unreachable'
    return NextResponse.json({ message }, { status: 503 })
  }
}
