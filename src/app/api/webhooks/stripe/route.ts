import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

// Inicializar Stripe omitiendo apiVersion fija para evitar conflictos con TS
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')

export async function POST(req: Request) {
  const body = await req.text()
  const headerPayload = await headers()
  const signature = headerPayload.get('stripe-signature') as string

  let event: Stripe.Event

  try {
    // 1. Validación Criptográfica
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (err: any) {
    console.error('⚠️ Error verificando firma del webhook:', err.message)
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // 2. Procesar el evento de pago exitoso
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Extraer metadata
    const userId = session.metadata?.userId
    const creditsToActivate = parseInt(session.metadata?.credits || '0', 10)

    if (!userId || creditsToActivate <= 0) {
      console.error('Faltan metadatos críticos en la sesión de Stripe')
      return new NextResponse('Invalid Metadata', { status: 400 })
    }

    try {
      // 3. Transacción atómica
      await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { creditsBalance: { increment: creditsToActivate } },
        })

        await tx.creditTransaction.create({
          data: {
            userId: userId,
            amount: creditsToActivate,
            balanceAfter: updatedUser.creditsBalance,
            type: 'PURCHASE',
            description: `Recarga de créditos vía Stripe (${creditsToActivate} crds)`,
          },
        })
      })
      
      console.log(`✅ ${creditsToActivate} créditos inyectados al usuario ${userId}`)
    } catch (dbError) {
      console.error('Error inyectando créditos en la BD:', dbError)
      return new NextResponse('Database Error', { status: 500 })
    }
  }

  return new NextResponse('Webhook recibido', { status: 200 })
}
