const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');

let ffmpegPath = 'ffmpeg';
try {
  ffmpegPath = require('ffmpeg-static');
} catch (_) {}

const MARKETING_API_URL_LOCAL = process.env.MARKETING_API_URL || 'http://127.0.0.1:3010/api/whatsapp/v1/marketing';
const MARKETING_API_URL_CLOUD = 'https://blitzr-studio.vercel.app/api/whatsapp/v1/marketing';
const MARKETING_API_URL = MARKETING_API_URL_LOCAL;
const MARKETING_API_SECRET = process.env.MARKETING_BRIDGE_SECRET || '';

let ultimoDraftId = null;
let ultimoVideoDraftId = null;
let ultimoVideoBase64 = null;

function consultarModuloMarketingUrl(targetUrl, payload, timeoutMs = 65000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      const bodyStr = JSON.stringify(payload);
      const req = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + MARKETING_API_SECRET,
            'Content-Length': Buffer.byteLength(bodyStr)
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.draftId) ultimoDraftId = parsed.draftId;
              if (parsed && parsed.videoDraftId) ultimoVideoDraftId = parsed.videoDraftId;
              resolve(parsed);
            } catch (e) {
              resolve({ ok: false, error: 'Respuesta no JSON', status: res.statusCode });
            }
          });
        }
      );
      req.on('error', (err) => resolve({ ok: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
      req.write(bodyStr);
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

async function consultarModuloMarketing(payload, timeoutMs = 65000) {
  const resLocal = await consultarModuloMarketingUrl(MARKETING_API_URL_LOCAL, payload, timeoutMs);
  if (resLocal && resLocal.ok) return resLocal;
  return consultarModuloMarketingUrl(MARKETING_API_URL_CLOUD, payload, timeoutMs);
}

function _oldConsultarModuloMarketing_unused(payload, timeoutMs = 65000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(MARKETING_API_URL);
      const client = urlObj.protocol === 'https:' ? https : http;
      const bodyStr = JSON.stringify(payload);

      const req = client.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST',
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + MARKETING_API_SECRET,
            'Content-Length': Buffer.byteLength(bodyStr)
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.draftId) {
                ultimoDraftId = parsed.draftId;
              }
              if (parsed && parsed.videoDraftId) {
                ultimoVideoDraftId = parsed.videoDraftId;
              }
              resolve(parsed);
            } catch (e) {
              resolve({ ok: false, error: 'Respuesta no JSON del modulo de marketing', status: res.statusCode });
            }
          });
        }
      );

      req.on('error', (err) => resolve({ ok: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Timeout consultando modulo de marketing' });
      });

      req.write(bodyStr);
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

function solicitarLocucionLocal(texto) {
  return new Promise((resolve) => {
    try {
      const bodyStr = JSON.stringify({ texto });
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 8090,
          path: '/api/tts_voz_mujer',
          method: 'POST',
          timeout: 25000,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr)
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            try {
              const j = JSON.parse(raw);
              if (j && j.ok && j.audio_data_url) {
                const b64 = j.audio_data_url.replace(/^data:audio\/\w+;base64,/, '');
                resolve(Buffer.from(b64, 'base64'));
                return;
              }
            } catch (_) {}
            resolve(null);
          });
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      req.write(bodyStr);
      req.end();
    } catch (_) {
      resolve(null);
    }
  });
}

function comprimirImagenBase64(b64) {
  if (!b64 || typeof b64 !== 'string') return b64;
  const clean = b64.replace(/^data:image\/\w+;base64,/, '');
  if (clean.length < 240000) return clean;
  const tmpIn = path.join('/tmp', 'in_' + Date.now() + '_' + Math.floor(Math.random() * 9999) + '.jpg');
  const tmpOut = path.join('/tmp', 'out_' + Date.now() + '_' + Math.floor(Math.random() * 9999) + '.jpg');
  try {
    fs.writeFileSync(tmpIn, Buffer.from(clean, 'base64'));
    execFileSync(ffmpegPath, ['-y', '-i', tmpIn, '-vf', "scale='min(960,iw)':-2", '-q:v', '5', tmpOut]);
    const outB64 = fs.readFileSync(tmpOut).toString('base64');
    return outB64;
  } catch (_) {
    return clean;
  } finally {
    try { fs.rmSync(tmpIn, { force: true }); } catch (_) {}
    try { fs.rmSync(tmpOut, { force: true }); } catch (_) {}
  }
}

async function pingMarketing() {
  return consultarModuloMarketing({ accion: 'ping' }, 10000);
}

async function editarFotoEstudio({ base64, imageUrl, nombre, tema, usarFondoIA, texto, precio, precioAnterior }) {
  return consultarModuloMarketing({
    accion: 'editar_foto_estudio',
    base64: comprimirImagenBase64(base64),
    imageUrl,
    nombre,
    tema: tema || 'industrial',
    usarFondoIA: Boolean(usarFondoIA),
    texto: texto || '',
    precio: precio || '$1,713 MXN',
    precioAnterior: precioAnterior || '$2,700 MXN'
  });
}

async function generarImagenIA({ texto, base64, tema, usarFondoIA, precio, precioAnterior }) {
  return consultarModuloMarketing({
    accion: 'generar_imagen_ia',
    texto: texto || 'Paquete Mantenimiento Mallas Tlaxcalli',
    base64: comprimirImagenBase64(base64),
    tema: tema || 'industrial',
    usarFondoIA: Boolean(usarFondoIA),
    precio: precio || '$1,713 MXN',
    precioAnterior: precioAnterior || '$2,700 MXN'
  });
}

async function generarVideoComercial({ texto, fotosBase64, precio, precioAnterior }) {
  const fotosCompactas = Array.isArray(fotosBase64)
    ? fotosBase64.slice(0, 3).map(f => comprimirImagenBase64(f))
    : [];
  const f0 = fotosCompactas[0] || null;
  const f1 = fotosCompactas[1] || f0;
  const f2 = fotosCompactas[2] || f0;

  const baseTexto = texto || 'Paquete Mantenimiento Mallas Tlaxcalli';

  const [s1, s2, s3] = await Promise.all([
    generarImagenIA({
      texto: baseTexto + ' — Oferta Directa de Fabrica',
      tema: 'promo',
      usarFondoIA: false,
      base64: f0,
      precio,
      precioAnterior
    }),
    generarImagenIA({
      texto: 'Malla Testalera + Transportadora Calibre 14 + Balero 7210B Aleman',
      tema: 'industrial',
      usarFondoIA: false,
      base64: f1,
      precio,
      precioAnterior
    }),
    generarImagenIA({
      texto: 'Ingenieria en Acero Calibre 14 y Envios Gratis a Domicilio',
      tema: 'catalogo',
      usarFondoIA: !f2,
      base64: f2,
      precio,
      precioAnterior
    })
  ]);

  const slidesB64 = [s1, s2, s3]
    .filter(s => s && s.ok && s.base64_resultado)
    .map(s => s.base64_resultado);

  if (slidesB64.length === 0) {
    return { ok: false, error: 'No se pudieron generar las escenas visuales del video comercial' };
  }

  const principal = (s2 && s2.ok ? s2 : s1) || {};
  if (principal.draftId) {
    ultimoDraftId = principal.draftId;
  }

  const locucionTexto =
    '¡Atención dueño de tortillería! Deja de pagar más de dos mil setecientos pesos en refaccionaria. En Mallas Tlaxcalli te llevamos el paquete completo de mantenimiento con malla testalera, malla transportadora calibre catorce y balero alemán setenta y dos diez B por solo mil setecientos trece pesos, con envío gratis hasta tu negocio. ¡Pídelo hoy por WhatsApp!';

  const tmpDir = path.join('/tmp', 'mkt_vid_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const slideFiles = [];
    for (let i = 0; i < slidesB64.length; i++) {
      const b64Clean = slidesB64[i].replace(/^data:image\/\w+;base64,/, '');
      const sPath = path.join(tmpDir, 'slide_' + i + '.jpg');
      fs.writeFileSync(sPath, Buffer.from(b64Clean, 'base64'));
      slideFiles.push(sPath);
    }

    let listContent = '';
    for (const sf of slideFiles) {
      listContent += "file '" + sf + "'\nduration 4.2\n";
    }
    listContent += "file '" + slideFiles[slideFiles.length - 1] + "'\n";
    const listPath = path.join(tmpDir, 'slides.txt');
    fs.writeFileSync(listPath, listContent, 'utf-8');

    const audioBuf = await solicitarLocucionLocal(locucionTexto);

    const outMp4 = path.join(tmpDir, 'comercial_tlaxcalli.mp4');
    const vfFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x09090b,fps=25,format=yuv420p';

    if (audioBuf && audioBuf.length > 500) {
      const wavPath = path.join(tmpDir, 'voz.wav');
      fs.writeFileSync(wavPath, audioBuf);
      // Mezclar locución femenina IA (100% volumen) con cama musical ambiental cálida (7% volumen)
      execFileSync(ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-i', wavPath,
        '-f', 'lavfi',
        '-i', 'sine=frequency=220:sample_rate=44100',
        '-filter_complex', '[1:a]volume=1.15[voz];[2:a]volume=0.03,afade=t=in:st=0:d=1,afade=t=out:st=10.5:d=2[bg];[voz][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]',
        '-map', '0:v',
        '-map', '[aout]',
        '-vf', vfFilter,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '25',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-t', '12.6',
        outMp4
      ]);
    } else {
      execFileSync(ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-vf', vfFilter,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '25',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-t', '12.6',
        outMp4
      ]);
    }

    const videoBuffer = fs.readFileSync(outMp4);
    const videoBase64 = videoBuffer.toString('base64');
    ultimoVideoBase64 = videoBase64;

    const saveRes = await consultarModuloMarketing({
      accion: 'guardar_video_comercial',
      videoBase64,
      texto: baseTexto,
      precio: precio || '$1,713 MXN',
      precioAnterior: precioAnterior || '$2,700 MXN'
    });

    if (saveRes && saveRes.videoDraftId) {
      ultimoVideoDraftId = saveRes.videoDraftId;
    }

    return {
      ok: true,
      videoBuffer,
      videoBase64,
      videoDraftId: (saveRes && saveRes.videoDraftId) || null,
      videoPublicUrl: (saveRes && saveRes.videoPublicUrl) || null,
      posterDraftId: principal.draftId || ultimoDraftId,
      posterPublicUrl: principal.public_url || null,
      base64_poster: principal.base64_resultado || null,
      locucion_voz: locucionTexto,
      copies: principal.copies || {},
      caption_sugerido: principal.caption_sugerido || ''
    };
  } catch (err) {
    return { ok: false, error: 'Error compilando MP4 con ffmpeg: ' + err.message };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

async function solicitarPublicacionRedes({ texto, precio, precioAnterior, canales, imageUrl, base64, draftId }) {
  return consultarModuloMarketing({
    accion: 'solicitar_publicacion_redes',
    texto,
    precio: precio || '$1,713 MXN',
    precioAnterior: precioAnterior || '$2,700 MXN',
    canales: canales || ['whatsapp_estado', 'facebook', 'instagram', 'tiktok'],
    imageUrl,
    base64: comprimirImagenBase64(base64),
    draftId: draftId || ultimoDraftId
  });
}

async function confirmarPublicacionRedes({ canales, texto, draftId, videoDraftId, base64, videoBase64 }) {
  const finalDraftId = draftId || ultimoDraftId;
  const finalVideoDraftId = videoDraftId || ultimoVideoDraftId;
  return consultarModuloMarketing({
    accion: 'confirmar_publicacion_redes',
    canales: canales || ['whatsapp_estado', 'facebook', 'instagram', 'tiktok'],
    texto,
    draftId: finalDraftId,
    videoDraftId: finalVideoDraftId,
    base64: finalDraftId ? undefined : comprimirImagenBase64(base64),
    videoBase64: finalVideoDraftId ? undefined : (videoBase64 || ultimoVideoBase64)
  }, 85000);
}

function obtenerUltimoVideoBase64() {
  return ultimoVideoBase64;
}

module.exports = {
  consultarModuloMarketing,
  pingMarketing,
  editarFotoEstudio,
  generarImagenIA,
  generarVideoComercial,
  solicitarPublicacionRedes,
  confirmarPublicacionRedes,
  obtenerUltimoVideoBase64
};
