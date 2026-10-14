import { NextResponse } from 'next/server'
import { fetchVmFhir } from '@/lib/vm-fhir'

type Params = { params: Promise<{ type: string, id: string }> }

const FHIR_TYPE_PATTERN = /^[A-Za-z]{2,64}$/
const FHIR_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export async function GET(_request: Request, { params }: Params) {
  const { type, id } = await params
  const decodedId = decodeURIComponent(id)
  if (!FHIR_TYPE_PATTERN.test(type) || !FHIR_ID_PATTERN.test(decodedId)) {
    return NextResponse.json({ message: 'Invalid FHIR resource type or ID' }, { status: 400 })
  }

  try {
    const { res } = await fetchVmFhir(
      `/${encodeURIComponent(type)}/${encodeURIComponent(decodedId)}`
    )

    if (!res.ok) {
      return NextResponse.json(
        { message: 'VM FHIR read failed', status: res.status },
        { status: res.status === 404 ? 404 : 502 }
      )
    }

    const body = await res.json()
    return NextResponse.json({ resource: body })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VM FHIR unreachable'
    return NextResponse.json({ message }, { status: 503 })
  }
}
