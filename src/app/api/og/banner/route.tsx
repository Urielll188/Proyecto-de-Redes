import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

let bebasFontPromise: Promise<ArrayBuffer> | null = null
let montserratBoldPromise: Promise<ArrayBuffer> | null = null

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

function loadMontserratFont(): Promise<ArrayBuffer> {
  if (!montserratBoldPromise) {
    montserratBoldPromise = fetch(
      'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-700-normal.ttf'
    ).then((res) => {
      if (!res.ok) throw new Error('No se pudo descargar Montserrat')
      return res.arrayBuffer()
    })
  }
  return montserratBoldPromise
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get('title') || 'PAQUETE COMPLETO DE MANTENIMIENTO'
    const hook =
      searchParams.get('hook') ||
      'Malla Testalera + Transportadora Calibre 14 + Balero 7210B Aleman con Envio Gratis'
    const imageUrl = searchParams.get('imageUrl')
    const badgeText = searchParams.get('badge') || 'ENVIO GRATIS CDMX Y EDOMEX'
    const brandName = searchParams.get('brand') || 'MALLAS TLAXCALLI'
    const priceText = searchParams.get('price') || '$1,713 MXN'
    const oldPriceText = searchParams.get('oldPrice') || '$2,700 MXN'
    const theme = (searchParams.get('theme') || 'industrial').toLowerCase()
    const ratio = (searchParams.get('ratio') || 'feed').toLowerCase()

    const isReel = ratio === 'reel' || ratio === '9:16'
    const width = 1080
    const height = isReel ? 1920 : 1350

    const [bebasData, montserratData] = await Promise.all([
      loadBebasFont(),
      loadMontserratFont(),
    ])

    // Configuración de las 3 plantillas de agencia
    const palettes: Record<
      string,
      {
        bgGradient: string
        glowTop: string
        glowBottom: string
        accent: string
        accentText: string
        subBrand: string
        cardBg: string
        borderAccent: string
        ctaBg: string
        ctaText: string
        ctaLabel: string
      }
    > = {
      industrial: {
        bgGradient: 'linear-gradient(160deg, #09090b 0%, #18181b 50%, #09090b 100%)',
        glowTop: 'radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, transparent 70%)',
        glowBottom: 'radial-gradient(circle, rgba(16, 185, 129, 0.20) 0%, transparent 70%)',
        accent: '#f59e0b',
        accentText: '#09090b',
        subBrand: 'CALIDAD INDUSTRIAL DIRECTA DE FABRICA',
        cardBg: 'rgba(18, 18, 22, 0.96)',
        borderAccent: 'rgba(245, 158, 11, 0.45)',
        ctaBg: '#10b981',
        ctaText: '#052e16',
        ctaLabel: 'PEDIR POR WHATSAPP >>',
      },
      promo: {
        bgGradient: 'linear-gradient(155deg, #1f0808 0%, #09090b 55%, #180606 100%)',
        glowTop: 'radial-gradient(circle, rgba(239, 68, 68, 0.32) 0%, transparent 70%)',
        glowBottom: 'radial-gradient(circle, rgba(250, 204, 21, 0.22) 0%, transparent 70%)',
        accent: '#facc15',
        accentText: '#09090b',
        subBrand: 'OFERTA ESPECIAL DE FABRICA • AHORRA $1,000 MXN',
        cardBg: 'rgba(24, 10, 10, 0.96)',
        borderAccent: 'rgba(250, 204, 21, 0.55)',
        ctaBg: '#facc15',
        ctaText: '#09090b',
        ctaLabel: 'APARTAR OFERTA HOY >>',
      },
      catalogo: {
        bgGradient: 'linear-gradient(160deg, #020617 0%, #0f172a 52%, #020617 100%)',
        glowTop: 'radial-gradient(circle, rgba(56, 189, 248, 0.28) 0%, transparent 70%)',
        glowBottom: 'radial-gradient(circle, rgba(37, 99, 235, 0.24) 0%, transparent 70%)',
        accent: '#38bdf8',
        accentText: '#020617',
        subBrand: 'INGENIERIA EN ACERO CALIBRE 14 Y BALEROS ALEMANES',
        cardBg: 'rgba(15, 23, 42, 0.96)',
        borderAccent: 'rgba(56, 189, 248, 0.50)',
        ctaBg: '#38bdf8',
        ctaText: '#020617',
        ctaLabel: 'COTIZAR EN 1 MINUTO >>',
      },
    }

    const p = palettes[theme] || palettes.industrial
    const imageBoxHeight = isReel ? '1160px' : '740px'

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: p.bgGradient,
            padding: isReel ? '70px 56px 80px 56px' : '44px 52px',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'Montserrat',
          }}
        >
          {/* Iluminación radial superior */}
          <div
            style={{
              position: 'absolute',
              top: '-180px',
              right: '-120px',
              width: '700px',
              height: '700px',
              borderRadius: '50%',
              background: p.glowTop,
            }}
          />

          {/* Iluminación ambiental inferior */}
          <div
            style={{
              position: 'absolute',
              bottom: '-160px',
              left: '-120px',
              width: '620px',
              height: '620px',
              borderRadius: '50%',
              background: p.glowBottom,
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
                  fontSize: isReel ? '62px' : '56px',
                  color: '#ffffff',
                  letterSpacing: '2.5px',
                  lineHeight: 1,
                }}
              >
                {brandName}
              </span>
              <span
                style={{
                  fontFamily: 'Montserrat',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: p.accent,
                  letterSpacing: '2.5px',
                  textTransform: 'uppercase',
                  marginTop: '6px',
                }}
              >
                {p.subBrand}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: p.accent,
                borderRadius: '999px',
                padding: '12px 28px',
              }}
            >
              <span
                style={{
                  fontFamily: 'Bebas Neue',
                  color: p.accentText,
                  fontSize: '27px',
                  letterSpacing: '1.5px',
                }}
              >
                {badgeText.toUpperCase()}
              </span>
            </div>
          </div>

          {/* 2. VITRINA CENTRAL DEL PRODUCTO */}
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: '100%',
              height: imageBoxHeight,
              alignItems: 'center',
              justifyContent: 'center',
              margin: '16px 0',
              backgroundColor: 'rgba(15, 15, 20, 0.88)',
              borderRadius: '34px',
              border: `3px solid ${p.borderAccent}`,
              overflow: 'hidden',
              boxShadow: '0 28px 65px rgba(0, 0, 0, 0.8)',
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
                    color: p.accent,
                    letterSpacing: '2px',
                  }}
                >
                  ACERO CALIBRE 14 + BALERO ALEMAN
                </span>
              </div>
            )}

            {/* Etiqueta flotante de precio en esquina inferior derecha */}
            {priceText ? (
              <div
                style={{
                  position: 'absolute',
                  bottom: '26px',
                  right: '26px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  backgroundColor: 'rgba(9, 9, 11, 0.94)',
                  border: `2px solid ${p.accent}`,
                  borderRadius: '24px',
                  padding: '14px 30px',
                  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.8)',
                }}
              >
                {oldPriceText ? (
                  <span
                    style={{
                      fontFamily: 'Montserrat',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#a1a1aa',
                      letterSpacing: '1px',
                      marginBottom: '4px',
                    }}
                  >
                    REFACCIONARIA: {oldPriceText}
                  </span>
                ) : null}
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: isReel ? '64px' : '56px',
                    color: p.accent,
                    lineHeight: 1,
                    letterSpacing: '1.5px',
                  }}
                >
                  OFERTA: {priceText}
                </span>
              </div>
            ) : null}
          </div>

          {/* 3. TARJETA INFERIOR DE CONVERSIÓN CON DOBLE TIPOGRAFÍA */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: p.cardBg,
              border: `2px solid ${p.borderAccent}`,
              borderRadius: '30px',
              padding: isReel ? '34px 38px' : '26px 34px',
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
                  maxWidth: '590px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: isReel ? '58px' : '50px',
                    color: '#ffffff',
                    lineHeight: 1.02,
                    letterSpacing: '1.5px',
                  }}
                >
                  {title.slice(0, 44).toUpperCase()}
                </span>
                <span
                  style={{
                    fontFamily: 'Montserrat',
                    fontSize: isReel ? '22px' : '18px',
                    color: '#e4e4e7',
                    marginTop: '10px',
                    lineHeight: 1.35,
                    fontWeight: 700,
                  }}
                >
                  {hook.slice(0, 110)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: p.ctaBg,
                  borderRadius: '20px',
                  padding: isReel ? '22px 32px' : '18px 30px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Bebas Neue',
                    fontSize: isReel ? '36px' : '32px',
                    color: p.ctaText,
                    letterSpacing: '1.5px',
                  }}
                >
                  {p.ctaLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width,
        height,
        fonts: [
          {
            name: 'Bebas Neue',
            data: bebasData,
            style: 'normal',
            weight: 400,
          },
          {
            name: 'Montserrat',
            data: montserratData,
            style: 'normal',
            weight: 700,
          },
        ],
      }
    )
  } catch (error: any) {
    console.error('Error generando flyer publicitario:', error)
    return new Response(`Error al componer banner: ${error.message}`, { status: 500 })
  }
}
