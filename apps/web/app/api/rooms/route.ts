import { NextResponse } from 'next/server'

// Proxy the realtime service's room list so the browser fetches it same-origin
// (no CORS, no extra nginx route). In dev: localhost:7243; in prod: the compose service.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REALTIME = process.env.REALTIME_INTERNAL_URL || 'http://localhost:7243'

export async function GET() {
  try {
    const res = await fetch(`${REALTIME}/rooms`, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json([])
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json([])
  }
}
