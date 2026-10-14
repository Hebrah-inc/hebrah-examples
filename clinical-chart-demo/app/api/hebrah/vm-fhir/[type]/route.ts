import { NextResponse } from 'next/server'
import { fetchVmFhir } from '@/lib/vm-fhir'

type Params = { params: Promise<{ type: string }> }

const FHIR_TYPE_PATTERN = /^[A-Za-z]{2,64}$/

export async function GET(request: Request, { params }: Params) {
  const { type } = await params
  if (!FHIR_TYPE_PATTERN.test(type)) {
    return NextResponse.json({ message: 'Invalid FHIR resource type' }, { status: 400 })
  }
  const { search } = new URL(request.url)
  const query = search || ''

  try {
    const { res } = await fetchVmFhir(`/${encodeURIComponent(type)}${query}`)

    if (!res.ok) {
      return NextResponse.json(
        { message: 'VM FHIR search failed', status: res.status },
        { status: res.status === 404 ? 404 : 502 }
      )
    }

    const body = await res.json()
    return NextResponse.json({ bundle: body })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VM FHIR unreachable'
    return NextResponse.json({ message }, { status: 503 })
  }
}
