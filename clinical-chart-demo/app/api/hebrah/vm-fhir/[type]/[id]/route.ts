import { NextResponse } from 'next/server'
import { fetchVmFhir } from '@/lib/vm-fhir'

type Params = { params: Promise<{ type: string, id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { type, id } = await params
  const decodedId = decodeURIComponent(id)

  try {
    const { res, url } = await fetchVmFhir(
      `/${encodeURIComponent(type)}/${encodeURIComponent(decodedId)}`
    )
    const body = res.ok ? await res.json() : await res.text()

    if (!res.ok) {
      return NextResponse.json(
        { message: 'VM FHIR read failed', status: res.status, detail: body, source: url },
        { status: res.status === 404 ? 404 : 502 }
      )
    }

    return NextResponse.json({ resource: body, source: url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VM FHIR unreachable'
    return NextResponse.json({ message }, { status: 503 })
  }
}
