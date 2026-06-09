import { NextResponse } from 'next/server'
import { callGuesser } from '@deviation/shared/server'

// Solo-mode AI endpoint. Multiplayer runs the same guesser inside the realtime service.
export const runtime = 'nodejs'

interface Body {
  image?: string
  options?: string[]
  category?: string
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body
  const out = await callGuesser(body.image ?? '', body.options ?? [], body.category ?? '')
  return NextResponse.json(out)
}
