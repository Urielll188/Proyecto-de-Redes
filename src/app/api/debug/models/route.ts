import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const key = process.env.GEMINI_API_KEY
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
