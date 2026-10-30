import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// Caché a nivel de módulo para descargar la fuente una sola vez
let bebasFontPromise: Promise<ArrayBuffer> | null = null

function loadBebasFont(): Promise<ArrayBuffer> {
  if (!bebasFontPromise) {
    bebasFontPromise = fetch(
      'https://cdn.jsdelivr.net/fontsource/fonts/bebas-neue@latest/latin-400-normal.ttf'
    ).then((res) => {
      if (!res.ok) throw new Error('No se pudo descargar Bebas Neue')
      return res.arrayBuffer()
    })
  }
  return bebasFontPromise
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get('title') || 'OFERTA EXCLUSIVA'
    const hook = searchParams.get('hook') || 'Edición especial. Pide la tuya directo al WhatsApp.'
    const imageUrl = searchParams.get('imageUrl')
    const badgeText = searchParams.get('badge') || 'EDICIÓN LIMITADA'

    // Obtener tipografía desde caché de memoria
    const fontData = await loadBebasFont()

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(145deg, #022c22 0%, #09090b 45%, #051b14 100%)',
            padding: '50px 60px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Destello de fondo angular esmeralda/dorado */}
          <div
            style={{
              position: 'absolute',
              top: '-140px',
              right: '-140px',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(234, 179, 8, 0.12) 50%, transparent 70%)',
            }}
          />

          {/* Destello ambiental inferior */}
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '-120px',
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.22) 0%, transparent 70%)',
            }}
          />

          {/* 1. CABECERA: Marca y Badge Superior */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: 'Bebas Neue',
                  fontSize: '52px',
                  color: '#ffffff',
                  letterSpacing: '3px',
                  lineHeight: 1,
                }}
              >
                BLITZR <span style={{ color: '#3b82f6' }}>PRO</span>
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#34d399',
                  letterSpacing: '4px',
                  textTransform: 'uppercase',
                  marginTop: '4px',
                }}
              >
                PRODUCT SHOWCASE
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#eab308',
                borderRadius: '12px',
                padding: '10px 22px',
                boxShadow: '0 8px 24px rgba(234, 179, 8, 0.35)',
              }}
            >
              <span
                style={{
                  fontFamily: 'Bebas Neue',
                  color: '#000000',
                  fontSize: '26px',
                  letterSpacing: '1px',
                }}
              >
                ⚡ {badgeText.toUpperCase()}
              </span>
            </div>
          </div>

          {/* 2. ZONA CENTRAL: Producto Integrado con Aura y Badges Flotantes */}
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: '100%',
              height: '670px',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '15px 0',
            }}
          >
            {/* Aura circular de luz para contrastar el producto */}
            <div
              style={{
                position: 'absolute',
                width: '520px',
                height: '520px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.16) 0%, transparent 70%)',
              }}
            />

            {/* Imagen del Producto */}
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Producto"
                style={{
                  width: '90%',
                  height: '100%',
                  objectFit: 'contain',
                  zIndex: 2,
                }}
              />
            ) : (
              <div
                style={{
                  zIndex: 2,
                  color: '#71717a',
                  fontFamily: 'Bebas Neue',
                  fontSize: '44px',
                  letterSpacing: '2px',
                }}
              >
                FOTOGRAFÍA DEL PRODUCTO
              </div>
            )}

            {/* Badge Flotante Izquierdo: Disponibilidad y Stock */}
            <div
              style={{
                position: 'absolute',
                top: '40px',
                left: '0px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(6, 78, 59, 0.94)',
                border: '2px solid #34d399',
                borderRadius: '20px',
                padding: '16px 24px',
                maxWidth: '290px',
                zIndex: 5,
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
              }}
            >
              <span
                style={{
                  fontFamily: 'Bebas Neue',
                  fontSize: '32px',
                  color: '#ffffff',
                  lineHeight: 1,
                  letterSpacing: '1px',
                }}
              >
                DISPONIBLE HOY
              </span>
              <span
                style={{
                  fontSize: '14px',
                  color: '#d1fae5',
                  fontWeight: '600',
                  marginTop: '4px',
                }}
              >
                Garantía y Calidad 100%
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: '#fbbf24',
                  fontWeight: '700',
                  marginTop: '6px',
                  textTransform: 'uppercase',
                }}
              >
                🔥 Alta Demanda
              </span>
            </div>

            {/* Badge Flotante Derecho: Envío Directo */}
            <div
              style={{
                position: 'absolute',
                bottom: '30px',
                right: '0px',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(9, 9, 11, 0.94)',
                border: '2px solid #eab308',
                borderRadius: '16px',
                padding: '14px 22px',
                zIndex: 5,
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
              }}
            >
              <span
                style={{
                  fontFamily: 'Bebas Neue',
                  fontSize: '26px',
                  color: '#fef08a',
                  letterSpacing: '1px',
                }}
              >
                🚀 ENVÍO INMEDIATO DISPONIBLE
              </span>
            </div>
          </div>

          {/* 3. PIE DE CONVERSIÓN: Titular Comercial y Botón Grande */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(9, 9, 11, 0.90)',
              border: '2px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px',
              padding: '24px 32px',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '580px' }}>
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: '48px',
                    color: '#ffffff',
                    lineHeight: 1,
                    letterSpacing: '1.5px',
                  }}
                >
                  {title.slice(0, 36).toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: '17px',
                    color: '#a1a1aa',
                    marginTop: '6px',
                    lineHeight: 1.3,
                  }}
                >
                  {hook.slice(0, 85)}...
                </span>
              </div>

              {/* Botón de Conversión a WhatsApp */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#2563eb',
                  border: '2px solid #60a5fa',
                  borderRadius: '18px',
                  padding: '16px 30px',
                  boxShadow: '0 8px 25px rgba(37, 99, 235, 0.45)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: '32px',
                    color: '#ffffff',
                    letterSpacing: '1.5px',
                  }}
                >
                  PEDIR POR WHATSAPP ➔
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1350,
        fonts: [
          {
            name: 'Bebas Neue',
            data: fontData,
            style: 'normal',
            weight: 400,
          },
        ],
      }
    )
  } catch (error: any) {
    console.error('Error generando flyer publicitario:', error)
    return new Response(`Error al componer banner: ${error.message}`, { status: 500 })
  }
}
