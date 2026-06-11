import { NextResponse } from 'next/server'
import { fetchSandboxCatalog } from '@/lib/hebrah-api'
import { HebrahApiError } from '@/lib/hebrah-api'

export async function GET() {
  try {
    const catalog = await fetchSandboxCatalog()
    return NextResponse.json(catalog)
  } catch (error) {
    if (error instanceof HebrahApiError) {
      return NextResponse.json(
        { message: error.message, detail: error.detail },
        { status: error.status }
      )
    }
    throw error
  }
}
