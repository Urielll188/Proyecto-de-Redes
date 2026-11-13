import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawParam } = await context.params
    const cleanId = rawParam.replace(/\.(jpg|jpeg|png|webp|mp4)$/i, '').trim()

    if (!cleanId) {
      return new NextResponse('ID inválido', { status: 400 })
    }

    const item = await prisma.contentVault.findUnique({
      where: { id: cleanId },
      select: { visualPrompt: true },
    })

    if (!item || !item.visualPrompt || !item.visualPrompt.startsWith('data:')) {
      return new NextResponse('Media no encontrada', { status: 404 })
    }

    const mimeMatch = item.visualPrompt.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+);base64,/)
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const base64Data = item.visualPrompt.replace(/^data:[a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+;base64,/, '')
    const mediaBuffer = Buffer.from(base64Data, 'base64')

    return new NextResponse(new Uint8Array(mediaBuffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(mediaBuffer.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err: any) {
    console.error('[Media Route Error]:', err)
    return new NextResponse('Error interno sirviendo media', { status: 500 })
  }
}
