import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

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
    const title = searchParams.get('title') || 'PAQUETE COMPLETO DE MANTENIMIENTO'
    const hook =
      searchParams.get('hook') ||
      'Malla Testalera + Transportadora Calibre 14 + Balero 7210B Alemán • Pago al recibir'
    const imageUrl = searchParams.get('imageUrl')
    const badgeText = searchParams.get('badge') || 'ENVÍO GRATIS CDMX Y EDOMEX'
    const brandName = searchParams.get('brand') || 'MALLAS TLAXCALLI'
    const priceText = searchParams.get('price') || '$1,713 MXN'
    const oldPriceText = searchParams.get('oldPrice') || '$2,700 MXN'

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
            background: 'linear-gradient(160deg, #09090b 0%, #18181b 50%, #09090b 100%)',
            padding: '44px 52px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Iluminación radial cálida superior */}
          <div
            style={{
              position: 'absolute',
              top: '-180px',
              right: '-120px',
              width: '680px',
              height: '680px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(245, 158, 11, 0.24) 0%, rgba(234, 179, 8, 0.08) 50%, transparent 72%)',
            }}
          />

          {/* Iluminación ambiental inferior */}
          <div
            style={{
              position: 'absolute',
              bottom: '-160px',
              left: '-120px',
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)',
            }}
          />

          {/* 1. CABECERA DE MARCA */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: 'Bebas Neue',
                  fontSize: '54px',
                  color: '#ffffff',
                  letterSpacing: '2.5px',
                  lineHeight: 1,
                }}
              >
                {brandName}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#f59e0b',
                  letterSpacing: '3.5px',
                  textTransform: 'uppercase',
                  marginTop: '4px',
                }}
              >
                CALIDAD INDUSTRIAL DIRECTA DE FÁBRICA
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#f59e0b',
                borderRadius: '999px',
                padding: '10px 26px',
              }}
            >
              <span
                style={{
                  fontFamily: 'Bebas Neue',
                  color: '#09090b',
                  fontSize: '26px',
                  letterSpacing: '1.2px',
                }}
              >
                ★ {badgeText.toUpperCase()}
              </span>
            </div>
          </div>

          {/* 2. VITRINA CENTRAL DEL PRODUCTO (Limpia, sin parches encima de la foto) */}
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: '100%',
              height: '750px',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '16px 0',
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              borderRadius: '32px',
              border: '2px solid rgba(245, 158, 11, 0.35)',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Producto"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  textAlign: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: '72px',
                    color: '#f59e0b',
                    letterSpacing: '2px',
                  }}
                >
                  ACERO CALIBRE 14 + BALERO ALEMÁN
                </span>
                <span
                  style={{
                    fontSize: '26px',
                    color: '#e4e4e7',
                    marginTop: '12px',
                  }}
                >
                  Máxima resistencia y durabilidad para tu negocio
                </span>
              </div>
            )}

            {/* Etiqueta de precio en esquina inferior derecha (discreta y elegante) */}
            {priceText ? (
              <div
                style={{
                  position: 'absolute',
                  bottom: '22px',
                  right: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  backgroundColor: 'rgba(9, 9, 11, 0.92)',
                  border: '2px solid #f59e0b',
                  borderRadius: '22px',
                  padding: '12px 26px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
                }}
              >
                {oldPriceText ? (
                  <span
                    style={{
                      fontSize: '18px',
                      color: '#a1a1aa',
                      textDecoration: 'line-through',
                      fontWeight: '700',
                    }}
                  >
                    Antes: {oldPriceText}
                  </span>
                ) : null}
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: '54px',
                    color: '#fbbf24',
                    lineHeight: 1,
                    letterSpacing: '1px',
                  }}
                >
                  {priceText}
                </span>
              </div>
            ) : null}
          </div>

          {/* 3. TARJETA INFERIOR DE CONVERSIÓN */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 15, 18, 0.96)',
              border: '2px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '28px',
              padding: '26px 34px',
              zIndex: 10,
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  maxWidth: '610px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: '50px',
                    color: '#ffffff',
                    lineHeight: 1.02,
                    letterSpacing: '1.5px',
                  }}
                >
                  {title.slice(0, 44).toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    color: '#d4d4d8',
                    marginTop: '8px',
                    lineHeight: 1.35,
                    fontWeight: '500',
                  }}
                >
                  {hook.slice(0, 110)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#10b981',
                  borderRadius: '20px',
                  padding: '18px 30px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: '34px',
                    color: '#052e16',
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
