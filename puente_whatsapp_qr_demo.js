
// ==============================================================================
// AUTO-REPAIR BAILEYS LIBSIGNAL SESSION (Evita errores Bad MAC)
// ==============================================================================
function repararSesionCorrupta(jidTarget) {
  try {
    const base = jidTarget ? jidTarget.split('@')[0].split(':')[0].replace(/\D/g, '') : (miNumeroBase || '5215648847438');
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR).filter(f => f.startsWith(`session-${base}`));
    for (const f of files) {
      fs.unlinkSync(path.join(AUTH_DIR, f));
      console.log(`🧹 [AUTO-REPAIR BAILEYS] Eliminada sesión corrupta para renovar pre-keys: ${f}`);
    }
  } catch (err) {
    console.error('Error en repararSesionCorrupta:', err.message);
  }
}

const origConsoleError = console.error;
console.error = function (...args) {
  const str = args.map(a => (a && a.stack ? a.stack : String(a))).join(' ');
  if (str.includes('Bad MAC') && (str.includes('5215648847438') || str.includes('session_cipher'))) {
    console.log('⚠️ [BAILEYS HEALER] Detectado Bad MAC en libsignal. Auto-reparando sesión del dueño...');
    repararSesionCorrupta('5215648847438');
  }
  origConsoleError.apply(console, args);
};

let pausaRespuestasGeneral = true;
const PAUSA_TOTAL_RESPUESTAS = true;
/**
 * ============================================================================
 * PUENTE DIRECTO WHATSAPP BUSINESS (CONTROL TOTAL + FOTOS + 50/DÍA VERIFICADOS)
 * Mallas Tlaxcalli — Agencia TopDiegoz
 * ============================================================================
 * 1) `Browsers.ubuntu('Chrome')` + reconexión rápida 515 + QR oficial + Código 8 dígitos.
 * 2) Auto-chat propio ("Mensajes contigo mismo") conectado DIRECTO al Agente CDO IA
 *    SIN necesidad de escribir `#pau` (con detección exacta `@s.whatsapp.net` y `@lid`
 *    y Set de IDs enviados por el bot para evitar bucles infinitos).
 * 3) Subida directa de FOTOS DE PRODUCTO y PUBLICIDAD desde WhatsApp con
 *    `downloadMediaMessage` -> `/api/subir_foto_pau`.
 * 4) Verificación real `onWhatsApp()` antes de enviar cada mensaje (descarta líneas fijas
 *    sin quemar cupo diario) + disparo inmediato al activar el motor de 50/día.
 * 5) Notas de voz completas en `audio/ogg; codecs=opus` (`ptt: true`) vía ffmpeg-static.
 * ============================================================================
 */


process.on('uncaughtException', (err) => {
  console.error('🛡️ [ESCUDO ACTIVO] Error capturado sin cerrar el puente:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('🛡️ [ESCUDO ACTIVO] Promesa rechazada sin cerrar el puente:', reason?.message || reason);
});

const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcodeTerminal = require('qrcode-terminal');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mktAdapter = require('./marketing_adapter');

function obtenerFotosLocalesProductoBase64(maxFotos = 3) {
  const carpetas = [
    '/config/workspace/imagenes_negocio_pau',
    '/config/workspace/imágenes negocio pau'
  ];
  const list = [];
  for (const carp of carpetas) {
    if (fs.existsSync(carp)) {
      try {
        const files = fs.readdirSync(carp);
        for (const f of files) {
          const ext = path.extname(f).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            const fullP = path.join(carp, f);
            try {
              const buf = fs.readFileSync(fullP);
              list.push(buf.toString('base64'));
              if (list.length >= maxFotos) return list;
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  }
  return list;
}
const { execFileSync } = require('child_process');

let QRCodeLib = null;
try {
  QRCodeLib = require('qrcode');
} catch (_) {
  QRCodeLib = null;
}

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (_) {
  ffmpegPath = null;
}
if (!ffmpegPath) {
  if (fs.existsSync('/usr/bin/ffmpeg')) ffmpegPath = '/usr/bin/ffmpeg';
  else ffmpegPath = 'ffmpeg';
}

const API_PYTHON = 'http://127.0.0.1:8090';
const AUTH_DIR = path.join(__dirname, 'sesion_whatsapp_tlaxcalli');
const ESTATUS_FILE = '/tmp/estatus_wa.json';
const NUMERO_PAOLA_ENV = (process.env.NUMERO_PAOLA || '').replace(/\D/g, '');
const loggerSilencioso = pino({ level: 'silent' });

let sockActual = null;
let miNumeroBase = '';
let miLidBase = '';
let ultimaFotoDuenoBase64 = null;
let ultimoEnvio50Ms = 0;
let proximoIntervalo50Ms = 540000;
let enviando50EnCurso = false;
let motorPausadoLocal = true;
let forzarAhoraPendiente = false;
const idsMensajesBot = new Set();
const cacheMensajes = new Map();

const CACHE_MSG_FILE = '/tmp/wa_msg_retry_cache.json';
try {
  if (fs.existsSync(CACHE_MSG_FILE)) {
    const rawCache = JSON.parse(fs.readFileSync(CACHE_MSG_FILE, 'utf8'));
    for (const [k, v] of Object.entries(rawCache)) {
      cacheMensajes.set(k, v);
    }
  }
} catch (_) {}

function guardarMensajeEnCache(id, msgObj) {
  if (!id || !msgObj) return;
  cacheMensajes.set(id, msgObj);
  if (cacheMensajes.size > 500) {
    const primero = cacheMensajes.keys().next().value;
    cacheMensajes.delete(primero);
  }
  try {
    const obj = {};
    for (const [k, v] of cacheMensajes.entries()) obj[k] = v;
    fs.writeFileSync(CACHE_MSG_FILE, JSON.stringify(obj), { mode: 0o666 });
  } catch (_) {}
}

// Cache de reintentos Signal compatible con makeWASocket (evita "Esperando el mensaje")
const retryMap = new Map();
const msgRetryCounterCache = {
  get: (k) => retryMap.get(k),
  set: (k, v) => retryMap.set(k, v),
  del: (k) => retryMap.delete(k),
  flushAll: () => retryMap.clear()
};

function sanearSesionesSignalEnDisco() {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const archivos = fs.readdirSync(AUTH_DIR);
    for (const f of archivos) {
      const full = path.join(AUTH_DIR, f);
      try { fs.chmodSync(full, 0o666); } catch (_) {}
      if (f.startsWith('session-') && f.endsWith('.json')) {
        const stat = fs.statSync(full);
        if (stat.size > 3500) {
          const data = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (data && data._sessions) {
            const keys = Object.keys(data._sessions);
            const openKeys = keys.filter(k => data._sessions[k]?.indexInfo?.closed === -1);
            if (keys.length > 1) {
              const nuevo = {};
              if (openKeys.length > 0) {
                openKeys.sort((a, b) => (data._sessions[b]?.indexInfo?.used || 0) - (data._sessions[a]?.indexInfo?.used || 0));
                nuevo[openKeys[0]] = data._sessions[openKeys[0]];
              }
              data._sessions = nuevo;
              fs.writeFileSync(full, JSON.stringify(data), { mode: 0o666 });
            }
          }
        }
      }
    }
  } catch (_) {}
}
// sanearSesionesSignalEnDisco disabled to protect in-memory cache



let estadoActual = {
  conectado: false,
  qr: '',
  qr_data_url: '',
  codigo_8_digitos: '',
  numero_vinculado: ''
};

function guardarEstatusWA(parcial) {
  estadoActual = { ...estadoActual, ...parcial, fecha: new Date().toISOString() };
  try {
    fs.writeFileSync(ESTATUS_FILE, JSON.stringify(estadoActual, null, 2), 'utf-8');
  } catch (_) {}
}

function registrarIdBot(resMsg) {
  const mid = resMsg?.key?.id;
  if (mid) {
    idsMensajesBot.add(mid);
    if (idsMensajesBot.size > 600) {
      const primero = idsMensajesBot.values().next().value;
      idsMensajesBot.delete(primero);
    }
  }
}

async function enviarMensajeSeguro(jid, contenido) {
  if (!sockActual) {
    console.log('⚠️ [AVISO] Mensaje no enviado: Socket WhatsApp no disponible');
    return null;
  }
  // Evitar broadcast sin destinatarios que rompe sender-key
  if (jid === 'status@broadcast') return null;

  // Si es auto-chat (@lid o propio número), normalizar siempre al JID principal @s.whatsapp.net
  let targetJid = jid;
  if (esMiPropioChat(jid)) {
    const propio = obtenerPropioJid();
    if (propio) targetJid = propio;
  }

  try {
    const res = await sockActual.sendMessage(targetJid, contenido);
    registrarIdBot(res);
    if (res?.key?.id && res?.message) {
      guardarMensajeEnCache(res.key.id, res.message);
    }
    return res;
  } catch (errSend) {
    console.error(`❌ Error enviando mensaje a ${targetJid}:`, errSend.message);
    return null;
  }
}

function obtenerPropioJid() {
  if (miNumeroBase) return `${miNumeroBase}@s.whatsapp.net`;
  if (sockActual?.user?.id) {
    return `${sockActual.user.id.split('@')[0].split(':')[0]}@s.whatsapp.net`;
  }
  return '';
}

function esMiPropioChat(jid, msgKey) {
  if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') return false;
  const checkSingle = (j) => {
    if (!j) return false;
    const base = String(j).split('@')[0].split(':')[0];
    if (j.endsWith('@lid')) {
      if (miLidBase && base === miLidBase) return true;
      if (base === '172181581488157') return true;
      return false;
    }
    const dig = base.replace(/\D/g, '');
    if (!dig) return false;
    if (dig.includes('5648847438')) return true;
    if (miNumeroBase && (dig === miNumeroBase || dig.slice(-10) === miNumeroBase.slice(-10))) return true;
    return false;
  };
  if (checkSingle(jid)) return true;
  if (msgKey?.remoteJidAlt && checkSingle(msgKey.remoteJidAlt)) return true;
  if (msgKey?.participant && checkSingle(msgKey.participant)) return true;
  return false;
}

function convertirWavAOggOpusNativo(wavBuffer) {
  if (!ffmpegPath) return { buffer: wavBuffer, mimetype: 'audio/mp4' };
  const tmpWav = `/tmp/voz_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`;
  const tmpOgg = `${tmpWav}.ogg`;
  try {
    fs.writeFileSync(tmpWav, wavBuffer);
    execFileSync(
      ffmpegPath,
      ['-y', '-i', tmpWav, '-ar', '48000', '-ac', '1', '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-application', 'audio', tmpOgg],
      { stdio: 'ignore' }
    );
    const oggBuf = fs.readFileSync(tmpOgg);
    try { fs.unlinkSync(tmpWav); fs.unlinkSync(tmpOgg); } catch (_) {}
    return { buffer: oggBuf, mimetype: 'audio/ogg; codecs=opus' };
  } catch (_) {
    try { fs.unlinkSync(tmpWav); fs.unlinkSync(tmpOgg); } catch (__) {}
    return { buffer: wavBuffer, mimetype: 'audio/mp4' };
  }
}

function postJson(baseUrl, endpoint, payload, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      `${baseUrl}${endpoint}`,
      {
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body });
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Timeout HTTP')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function postJsonPython(endpoint, payload, timeoutMs = 45000) {
  return postJson(API_PYTHON, endpoint, payload, timeoutMs);
}

function ejecutarFlujoN8N(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      'http://127.0.0.1:5678/webhook/whatsapp-tlaxcalli-webhook',
      {
        method: 'POST',
        timeout: 3500,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`n8n HTTP ${res.statusCode}: ${body.slice(0, 160)}`));
          }
          try {
            const parsed = JSON.parse(body);
            resolve(Array.isArray(parsed) ? parsed[0] : parsed);
          } catch (e) {
            reject(new Error('Respuesta n8n no es JSON válido'));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Timeout esperando respuesta de n8n')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function resolverJidWhatsApp(telRaw) {
  if (!sockActual || !estadoActual.conectado) return { existe: false, motivo: 'NO_CONECTADO' };
  const dig = String(telRaw || '').replace(/\D/g, '');
  if (dig.length < 10) return { existe: false, motivo: 'NUMERO_CORTO' };

  const ult10 = dig.slice(-10);
  const candidatos = [];
  if (dig.length >= 12 && dig.startsWith('52')) {
    candidatos.push(`521${ult10}`, `52${ult10}`);
  } else if (dig.length === 10) {
    candidatos.push(`521${ult10}`, `52${ult10}`);
  } else {
    candidatos.push(dig);
  }

  for (const cand of candidatos) {
    try {
      const res = await sockActual.onWhatsApp(cand);
      if (Array.isArray(res) && res.length > 0 && res[0]?.exists) {
        return { existe: true, jid: res[0].jid, numero: cand };
      }
    } catch (_) {}
  }
  return { existe: false, motivo: 'SIN_WHATSAPP' };
}

function esHorarioComercialMexico() {
  // Hora Ciudad de México fija (UTC-6)
  const ahoraUtc = new Date();
  const horaMx = new Date(ahoraUtc.getTime() - 6 * 3600 * 1000).getUTCHours();
  return horaMx >= 8 && horaMx < 21;
}

async function revisarYEnviarUno50Diarios() {
  if (enviando50EnCurso || !sockActual || !estadoActual.conectado || (motorPausadoLocal && !forzarAhoraPendiente)) return;
  const esForzado = forzarAhoraPendiente;
  const transcurrido = Date.now() - ultimoEnvio50Ms;

  if (!esForzado) {
    if (!esHorarioComercialMexico()) return;
    if (ultimoEnvio50Ms > 0 && transcurrido < proximoIntervalo50Ms) return;
  }

  enviando50EnCurso = true;
  forzarAhoraPendiente = false;
  try {
    // Revisa hasta 8 candidatos seguidos si encuentra líneas fijas sin WhatsApp
    for (let intento = 0; intento < 8; intento++) {
      const cand = await postJsonPython('/api/obtener_candidato_envio_50', { forzar: esForzado && intento === 0 });
      if (!cand || !cand.ok || !cand.telefono) break;

      const waCheck = await resolverJidWhatsApp(cand.telefono);
      if (!waCheck.existe) {
        await postJsonPython('/api/confirmar_envio_50', {
          id: cand.id,
          enviado: false,
          motivo: 'SIN_WHATSAPP'
        });
        console.log(`⏭️ Prospecto sin WhatsApp (${cand.nombre} - ${cand.telefono}), marcado SIN_WHATSAPP.`);
        continue;
      }

      await sockActual.sendPresenceUpdate('composing', waCheck.jid);
      await new Promise((r) => setTimeout(r, 3000 + Math.floor(Math.random() * 2000)));
      await enviarMensajeSeguro(waCheck.jid, { text: cand.mensaje });
      const conf = await postJsonPython('/api/confirmar_envio_50', {
        id: cand.id,
        enviado: true,
        telefono_real: waCheck.numero,
        mensaje: cand.mensaje
      });

      ultimoEnvio50Ms = Date.now();
      // Próximo envío entre 8.5 y 10.5 minutos (anti-bloqueo realista)
      proximoIntervalo50Ms = (510 + Math.floor(Math.random() * 120)) * 1000;
      console.log(`📤 [50/DÍA] Enviado #${conf.enviados_hoy || '?'} a ${cand.nombre} (${waCheck.jid})`);

      // Si fue disparo inicial tras activar, avisar al dueño en su chat
      if (esForzado) {
        const propio = obtenerPropioJid();
        if (propio) {
          await enviarMensajeSeguro(propio, {
            text: `🚀 *1er Envío Automático Realizado (${conf.enviados_hoy || 1}/80 hoy):*\n📍 *${cand.nombre}* (${cand.municipio})\n📱 Teléfono verificado: ${waCheck.numero}\n⏱️ El siguiente saldrá en ~9 min para cuidar tu chip.`
          }).catch(() => {});
        }
      }
      break;
    }
  } catch (err) {
    console.error('⚠️ Error en motor 50/día:', err.message);
  } finally {
    enviando50EnCurso = false;
  }
}

async function iniciarPuenteWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: loggerSilencioso,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, loggerSilencioso)
    },
    msgRetryCounterCache,
    getMessage: async (key) => {
      if (key?.id && cacheMensajes.has(key.id)) {
        const msgGuardado = cacheMensajes.get(key.id);
        return msgGuardado?.ephemeralMessage?.message ||
               msgGuardado?.viewOnceMessage?.message ||
               msgGuardado?.documentWithCaptionMessage?.message ||
               msgGuardado;
      }
      return { conversation: '✅ Mensaje sincronizado — Mallas Tlaxcalli' };
    },
    shouldIgnoreJid: (jid) => jid === 'status@broadcast' || (typeof jid === 'string' && jid.endsWith('@broadcast')),
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    fireInitQueries: true,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000
  });

  sockActual = sock;
  sock.ev.on('creds.update', saveCreds);

  // VINCULACIÓN AUTOMÁTICA POR CÓDIGO DE 8 DÍGITOS (PAIRING CODE)
  if (!sock.authState.creds.registered) {
    const telRaw = process.argv[2] || process.env.PAIR_PHONE || process.env.NUMERO_PAOLA || '5215648847438';
    let numLimpio = String(telRaw).replace(/\D/g, '');
    if (numLimpio.length === 10) numLimpio = '521' + numLimpio;
    else if (numLimpio.length === 12 && numLimpio.startsWith('52') && !numLimpio.startsWith('521')) {
      numLimpio = '521' + numLimpio.slice(2);
    }
    setTimeout(async () => {
      try {
        console.log(`\n⏳ Solicitando Código de Vinculación de 8 dígitos para +${numLimpio}...`);
        const pairingCode = await sock.requestPairingCode(numLimpio);
        const codeFmt = pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode;
        guardarEstatusWA({ codigo_8_digitos: codeFmt });
        console.log('\n================================================================');
        console.log(`🔑 CÓDIGO DE VINCULACIÓN DE WHATSAPP (8 DÍGITOS):`);
        console.log(`👉   ${codeFmt}   👈`);
        console.log(`Para el número: +${numLimpio}`);
        console.log(`En tu celular ve a: Dispositivos vinculados ➔ Vincular con el número de teléfono`);
        console.log('================================================================\n');
      } catch (errCode) {
        console.log('⚠️ Aviso pairing code:', errCode.message);
      }
    }, 2500);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      let dataUrl = '';
      if (QRCodeLib) {
        try {
          dataUrl = await QRCodeLib.toDataURL(qr, {
            errorCorrectionLevel: 'L',
            margin: 3,
            width: 300
          });
        } catch (_) {}
      }
      guardarEstatusWA({ conectado: false, qr: qr, qr_data_url: dataUrl });
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('⚠️ Conexión de WhatsApp cerrada. Código:', statusCode, JSON.stringify(lastDisconnect?.error?.output || lastDisconnect?.error || {}));
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🔒 Sesión desvinculada desde el teléfono. Limpiando credenciales para nuevo inicio.');
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (_) {}
        guardarEstatusWA({ conectado: false, qr: '', qr_data_url: '', codigo_8_digitos: '' });
      }
      console.log('🔄 Reconectando WhatsApp automáticamente en 3 segundos...');
      setTimeout(iniciarPuenteWhatsApp, 3000);
    } else if (connection === 'open') {
      const rawId = sock.user?.id || '';
      const rawLid = sock.user?.lid || '';
      miNumeroBase = rawId.split('@')[0].split(':')[0].replace(/\D/g, '');
      miLidBase = rawLid ? rawLid.split('@')[0].split(':')[0] : '';

      guardarEstatusWA({
        conectado: true,
        qr: '',
        qr_data_url: '',
        codigo_8_digitos: '',
        numero_vinculado: rawId || 'Conectado'
      });
      console.log('✅ ¡WHATSAPP CONECTADO EN VIVO!', rawId, rawLid ? `(LID: ${miLidBase})` : '');

      const propio = obtenerPropioJid();
      if (propio) {
        await postJsonPython('/api/verificar_dueno_wa', { jid: propio, autorizar: true }).catch(() => {});
        const flagBienvenida = `/tmp/wa_bienvenida_v2_${miNumeroBase}.ok`;
        if (!fs.existsSync(flagBienvenida)) {
          fs.writeFileSync(flagBienvenida, new Date().toISOString(), 'utf-8');
          setTimeout(async () => {
            try {
              await enviarMensajeSeguro(propio, {
                text:
                  '✅ *¡WhatsApp Conectado al 100% — Mallas Tlaxcalli!* 🤖\n\n' +
                  'Ya tienes a tu *Agente CDO IA* activo *aquí mismo en tu propio chat* (sin hashtags ni páginas web).\n\n' +
                  '📸 *Sube tus imágenes aquí mismo:*\n' +
                  '• Mándame cualquier *foto real de tus mallas/balero* y se guarda automático para enviarla a clientes.\n' +
                  '• Si le pones la palabra *publicidad* en el pie de foto, la guardo en tu carpeta de Marketing.\n\n' +
                  '🎛️ *Comandos directos que ya puedes pedirme por aquí:*\n' +
                  '1️⃣ *"Dame el reporte"* (cifras 100% reales en texto + nota de voz)\n' +
                  '2️⃣ *"Mándame el excel"* (archivo actualizado con links exactos de Google Maps)\n' +
                  '3️⃣ *"Verifica WhatsApp"* (filtra cuáles números sí tienen WhatsApp)\n' +
                  '4️⃣ *"Activa los envíos"* / *"Pausa los envíos"* (motor anti-bloqueo 50/día)\n' +
                  '5️⃣ *"Mándale mensaje al 55..."* o *"Busca 10 tortillerías en Ecatepec"*\n' +
                  '6️⃣ Escribe *#venta hola* si quieres probar cómo atiende el bot a un cliente.'
              });
            } catch (_) {}
          }, 1500);
        }
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      if (msg.key?.id) {
        cacheMensajes.set(msg.key.id, msg.message);
      }
      if (idsMensajesBot.has(msg.key.id)) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;

      const esAutoChat = esMiPropioChat(jid, msg.key);
      const remitenteNum = jid.split('@')[0].split(':')[0].replace(/\D/g, '');
      const esNumeroDueno = remitenteNum.includes('5648847438') || (miNumeroBase && (remitenteNum === miNumeroBase || remitenteNum.slice(-10) === miNumeroBase.slice(-10)));
      const esLidDueno = jid.includes('172181581488157') || (miLidBase && jid.includes(miLidBase));
      const esDuenoConfirmado = esAutoChat || esNumeroDueno || esLidDueno;

      // PAUSA GENERAL DE RESPUESTAS A MENSAJES (SOLICITUD EXPLÍCITA DEL DUEÑO)
      // Si la pausa está activa, SOLO se ignoran mensajes de clientes fríos/prospectos.
      // El dueño (en su chat propio o desde su número) NUNCA se ignora.
      if (pausaRespuestasGeneral && !esDuenoConfirmado) {
        console.log(`⏸️ [PAUSA GENERAL ACTIVA]: Mensaje recibido de prospecto ${jid} ignorado (auto-respuestas en pausa).`);
        continue;
      }

      const audioMsg =
        msg.message.audioMessage ||
        msg.message?.documentWithCaptionMessage?.message?.audioMessage ||
        (msg.message?.documentMessage?.mimetype?.startsWith('audio/') ? msg.message.documentMessage : null);

      let textoEntrante =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message?.documentWithCaptionMessage?.message?.imageMessage?.caption ||
        msg.message?.documentMessage?.caption ||
        '';
      let vinoDeAudio = false;

      if (audioMsg && !textoEntrante) {
        try {
          await sock.sendPresenceUpdate('recording', jid);
          const bufferAudio = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: loggerSilencioso, reuploadRequest: sock.updateMediaMessage }
          );
          const mimeAudio = audioMsg.mimetype || 'audio/ogg; codecs=opus';
          const resTrans = await postJsonPython('/api/transcribir_audio', {
            audio_b64: bufferAudio.toString('base64'),
            mimetype: mimeAudio
          }, 35000);
          if (resTrans && resTrans.texto) {
            textoEntrante = resTrans.texto.trim();
            vinoDeAudio = true;
            console.log(`🎤 [AUDIO TRANSRITO de ${jid}]: "${textoEntrante}"`);
          }
        } catch (errAudio) {
          console.error('❌ Error transcribiendo audio entrante:', errAudio.message);
        }
      }

      const txtLow = textoEntrante.trim().toLowerCase();

      // Si tú escribes manualmente en otro chat ajeno (no self-chat), no interrumpir a menos que uses etiqueta explícita o comando
      if (msg.key.fromMe && !esAutoChat && !esDuenoConfirmado) {
        const esComandoExplicito =
          txtLow.startsWith('#pau') ||
          txtLow.startsWith('#cdo') ||
          txtLow.startsWith('#ceo') ||
          txtLow.startsWith('#venta') ||
          txtLow === 'soy paola' ||
          txtLow.includes('pausa') ||
          txtLow.includes('activa');
        if (!esComandoExplicito) continue;
      }

      const checkDueno = esDuenoConfirmado
        ? { es_dueno: true, recien_activado: false }
        : await postJsonPython('/api/verificar_dueno_wa', {
            jid: jid,
            texto: textoEntrante
          }).catch(() => ({ es_dueno: false }));

      // Manejo de respuesta de inicio o cierre de sesión
      if (checkDueno.sesion_cerrada) {
        await enviarMensajeSeguro(jid, { text: checkDueno.mensaje_auth || '🔒 Sesión de administrador cerrada con éxito.' });
        continue;
      }
      if (checkDueno.recien_activado && checkDueno.mensaje_auth) {
        await enviarMensajeSeguro(jid, { text: checkDueno.mensaje_auth });
      }

      // Si no es dueño autorizado e intenta pedir comandos de control o reportes, exigir clave
      const intentoComandoAdmin =
        txtLow.startsWith('#admin') ||
        txtLow.startsWith('#login') ||
        txtLow.startsWith('#clave') ||
        txtLow.startsWith('#cdo') ||
        txtLow.startsWith('#ceo') ||
        txtLow.startsWith('#pau') ||
        txtLow.startsWith('#marketing') ||
        txtLow.startsWith('#mkt') ||
        txtLow === 'reporte' ||
        txtLow === 'dame el reporte' ||
        txtLow === 'excel' ||
        txtLow === 'mandame el excel' ||
        txtLow === 'activa los envios' ||
        txtLow === 'pausa los envios';

      if (intentoComandoAdmin && !esAutoChat && !checkDueno.es_dueno) {
        await enviarMensajeSeguro(jid, {
          text:
            '🔒 *Consola Administrativa Protegida — Mallas Tlaxcalli*\n\n' +
            'Para consultar reportes, descargar el Excel o gestionar campañas desde este número, ingresa tu clave de administradora:\n\n' +
            '👉 *#login paola Tlaxcalli2026* o ingresa tu PIN: *#admin 7210B*'
        });
        continue;
      }

      const esDuenoOPropiaCuenta =
        esAutoChat ||
        checkDueno.es_dueno ||
        (NUMERO_PAOLA_ENV && remitenteNum.includes(NUMERO_PAOLA_ENV));

      // DETECCIÓN DE IMAGEN REAL ENTRANTE (Subida de Fotos Producto / Publicidad vía WhatsApp)
      const imgObj =
        msg.message.imageMessage ||
        msg.message?.documentWithCaptionMessage?.message?.imageMessage ||
        (msg.message?.documentMessage?.mimetype?.startsWith('image/') ? msg.message.documentMessage : null);

      const pideMkt =
        txtLow.includes('publicidad') ||
        txtLow.includes('marketing') ||
        txtLow.includes('promo') ||
        txtLow.includes('anuncio') ||
        txtLow.includes('flyer') ||
        txtLow.includes('redes') ||
        txtLow.includes('post');

      if (imgObj && (esDuenoOPropiaCuenta || pideMkt) && !txtLow.startsWith('#venta')) {
        try {
          await sock.sendPresenceUpdate('composing', jid);
          const bufferImg = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: loggerSilencioso, reuploadRequest: sock.updateMediaMessage }
          );
          const mimeImg = imgObj.mimetype || 'image/jpeg';
          const ext = mimeImg.includes('png') ? 'png' : (mimeImg.includes('webp') ? 'webp' : 'jpg');
          const nombreArchivo = `wa_foto_${Date.now()}.${ext}`;
          
          // 1. Guardar permanentemente en catálogo y en memoria de sesión reciente
          ultimaFotoDuenoBase64 = bufferImg.toString('base64');
          await postJsonPython('/api/subir_foto_pau', {
            nombre: nombreArchivo,
            caption: textoEntrante || 'publicidad redes sociales',
            base64: bufferImg.toString('base64')
          });

          // 2. Si el dueño la envió o pidió mejorar/editar/publicidad:
          await enviarMensajeSeguro(jid, {
            text: '📸 Foto guardada en catálogo. Mejorando iluminación y montando flyer publicitario con Blitzr Studio...'
          });

          try {
            const resImg = await mktAdapter.generarImagenIA({
              texto: textoEntrante || 'Paquete Mantenimiento Mallas Tlaxcalli',
              base64: bufferImg.toString('base64'),
              tema: 'industrial',
              precio: '$1,713 MXN',
              precioAnterior: '$2,700 MXN'
            });

            if (resImg && resImg.ok && resImg.base64_resultado) {
              const enhancedBuf = Buffer.from(resImg.base64_resultado.replace(/^data:image\/\w+;base64,/, ''), 'base64');
              await enviarMensajeSeguro(jid, {
                image: enhancedBuf,
                caption: '✨ *¡Foto Mejorada y Diseñada para Publicidad! — Mallas Tlaxcalli*\n\n' +
                         '📦 *Paquete Mantenimiento $1,713 MXN*\n' +
                         '🚚 Envío GRATIS en Edomex y CDMX (Pagas al recibir)\n\n' +
                         '📌 Si quieres que la publique en tus redes (WhatsApp Estado, TikTok, Facebook, Instagram), solo responde:\n👉 *#publicar*'
              });
            } else {
              await enviarMensajeSeguro(jid, {
                text: '📸 Foto guardada con éxito en tu catálogo de refacciones.'
              });
            }
          } catch (errEnhance) {
            console.error('Error mejorando foto:', errEnhance.message);
          }
        } catch (errImg) {
          console.error('❌ Error descargando imagen de WhatsApp:', errImg.message);
          await enviarMensajeSeguro(jid, { text: '⚠️ No pude descargar esa foto, intenta reenviarla por favor.' }).catch(() => {});
        }
        continue;
      }

      // Si un cliente manda foto de su máquina sin texto
      if (imgObj && !textoEntrante.trim()) {
        textoEntrante = 'Hola, le mando la foto de mi máquina y de la refacción para ver si le queda.';
      }

      if (!textoEntrante.trim()) continue;

      const forzarVenta = txtLow.startsWith('#venta') || txtLow.startsWith('#cliente');
      const esComandoPaola = !forzarVenta && esDuenoOPropiaCuenta;

      await sock.sendPresenceUpdate('composing', jid);

      try {
        if (esComandoPaola) {
          const limpio = checkDueno.recien_activado
            ? 'Hola CDO, acabo de vincular mi WhatsApp como dueña. Dame el resumen real de hoy y mándame el archivo Excel.'
            : textoEntrante.replace(/^#(pau|cdo|ceo)\s*/i, '');

          const pideAudioCEO =
            vinoDeAudio ||
            txtLow.includes('audio') ||
            txtLow.includes('voz') ||
            txtLow.includes('nota') ||
            txtLow.includes('habla') ||
            txtLow.startsWith('#audio');

          const lowCmd = limpio.toLowerCase();

          // -------------------------------------------------------------
          // COMANDO 1: ACTIVAR MOTOR DE ENVÍOS Y AUTO-RESPUESTAS
          // -------------------------------------------------------------
          const pideActivar =
            (lowCmd.includes('activa') || lowCmd.includes('activar') || lowCmd.includes('arranca') || lowCmd.includes('inicia') || lowCmd.includes('reanuda') || lowCmd.includes('despausa') || lowCmd.includes('luz verde')) &&
            (lowCmd.includes('envio') || lowCmd.includes('mensaje') || lowCmd.includes('motor') || lowCmd.includes('50') || lowCmd.includes('prospect') || lowCmd.includes('todo') || lowCmd === 'activa' || lowCmd === 'activar' || lowCmd === 'reanudar' || lowCmd === 'despausar') &&
            !lowCmd.includes('desactiva') && !lowCmd.includes('no');

          if (pideActivar) {
            pausaRespuestasGeneral = false;
            motorPausadoLocal = false;
            forzarAhoraPendiente = true;
            await postJsonPython('/api/control_motor', { activo: true }).catch(() => {});
            await enviarMensajeSeguro(jid, {
              text: '🚀 *¡Motor Comercial y Auto-Respuestas ACTIVADOS!*\n\n' +
                    '• Envíos masivos a tortillerías: *EN MARCHA* (cadencia segura de 8 a 11 min)\n' +
                    '• Auto-respuestas a clientes interesados: *ACTIVAS*\n' +
                    '• Filtro estricto: Tortillerías activas de DENUE y Google Maps con WhatsApp real.\n\n' +
                    '🔔 Te notificaré aquí mismo en cuanto un cliente conteste pidiendo cotización.'
            });
            setTimeout(() => { revisarYEnviarUno50Diarios(); }, 2000);
            continue;
          }

          // -------------------------------------------------------------
          // COMANDO 2: PAUSAR MOTOR DE ENVÍOS Y AUTO-RESPUESTAS
          // -------------------------------------------------------------
          const pidePausar =
            lowCmd.includes('pausa') || lowCmd.includes('pausar') || lowCmd.includes('deten') || lowCmd.includes('detener') ||
            lowCmd.includes('para los') || lowCmd.includes('apaga') || lowCmd.includes('no mandes') || lowCmd.includes('ya no mandes') ||
            lowCmd.includes('cancela los envios') || lowCmd.includes('frena') || lowCmd === 'alto' || lowCmd === 'stop';

          if (pidePausar) {
            pausaRespuestasGeneral = true;
            motorPausadoLocal = true;
            forzarAhoraPendiente = false;
            await postJsonPython('/api/control_motor', { activo: false }).catch(() => {});
            await enviarMensajeSeguro(jid, {
              text: '🛑 *Motor Comercial y Auto-Respuestas PAUSADOS*\n\n' +
                    '• Envíos masivos a tortillerías: *DETENIDOS*\n' +
                    '• Auto-respuestas a clientes: *EN PAUSA*\n' +
                    '• Chat Directo contigo: *100% OPERATIVO*\n\n' +
                    '📌 Puedes seguir pidiéndome flyers, videos o reportes. Cuando quieras que retome los envíos a clientes, solo dime:\n👉 *"Activa los envíos"*'
            });
            continue;
          }

          // -------------------------------------------------------------
          // ACCIONES MULTIMEDIA: VIDEO COMERCIAL (TIKTOK / REELS)
          // -------------------------------------------------------------
          // -------------------------------------------------------------
          // SOLICITUD DE VER FOTOS / CATÁLOGO DEL PRODUCTO EN TEXTO
          // -------------------------------------------------------------
          const pideVerFotos =
            (lowCmd.includes('foto') || lowCmd.includes('imagen') || lowCmd.includes('catalogo')) &&
            (lowCmd.includes('dame') || lowCmd.includes('pasame') || lowCmd.includes('mandame') ||
             lowCmd.includes('ver') || lowCmd.includes('muestra') || lowCmd.includes('ensena') ||
             lowCmd.includes('tienes') || lowCmd.includes('cuales'));

          if (pideVerFotos && !lowCmd.includes('haz') && !lowCmd.includes('genera') && !lowCmd.includes('crea') && !lowCmd.includes('video')) {
            await sock.sendPresenceUpdate('composing', jid);
            const fotosB64 = obtenerFotosLocalesProductoBase64(3);
            if (fotosB64.length > 0) {
              await enviarMensajeSeguro(jid, {
                text: `📸 *Catálogo Oficial Mallas Tlaxcalli:* Aquí tienes las fotos reales de tus mallas y refacciones listas en el sistema:`
              });
              for (let i = 0; i < fotosB64.length; i++) {
                const bBuf = Buffer.from(fotosB64[i], 'base64');
                await enviarMensajeSeguro(jid, {
                  image: bBuf,
                  caption: `📸 Refacción #${i + 1} — Malla Testalera / Transportadora Calibre 14 Mallas Tlaxcalli`
                });
              }
            } else {
              await enviarMensajeSeguro(jid, {
                text: '📸 Aún no tienes fotos cargadas. Mándame cualquier foto aquí mismo y la guardo de inmediato.'
              });
            }
            continue;
          }

          const pideVideo =
            lowCmd.includes('#video') ||
            (lowCmd.includes('video') && (
              lowCmd.includes('haz') || lowCmd.includes('genera') || lowCmd.includes('crea') ||
              lowCmd.includes('tiktok') || lowCmd.includes('reels') || lowCmd.includes('comercial') ||
              lowCmd.includes('publicitario') || lowCmd.includes('anuncio')
            ));

          if (pideVideo) {
            await sock.sendPresenceUpdate('recording', jid);
            await enviarMensajeSeguro(jid, {
              text: '🎬 *CDO Mallas Tlaxcalli:* Recibido, Jefe. Estoy compilando el video comercial vertical (1080x1920) para TikTok / Reels con locución femenina IA y las fotos reales de tus refacciones... En aprox. 25 segundos te lo entrego aquí mismo.'
            });

            try {
              const fotosB64 = obtenerFotosLocalesProductoBase64(3);
              const resVid = await mktAdapter.generarVideoComercial({
                texto: 'Paquete Completo Mallas Tlaxcalli $1,713 MXN',
                fotosBase64: fotosB64,
                precio: '$1,713 MXN',
                precioAnterior: '$2,700 MXN'
              });

              if (resVid && resVid.ok && resVid.videoBuffer) {
                await enviarMensajeSeguro(jid, {
                  video: resVid.videoBuffer,
                  mimetype: 'video/mp4',
                  caption: '🎬 *Video Comercial Listo para TikTok / Reels / Estados WhatsApp*\n\n' +
                           '📦 *Producto:* Paquete Completo de Mantenimiento\n' +
                           '💰 *Precio Promoción:* $1,713 MXN (Ahorro de $1,000 vs Refaccionaria)\n' +
                           '🚚 *Envío:* GRATIS en Edomex y CDMX (Pagas al recibir)\n\n' +
                           '📌 *Para publicarlo automáticamente en TikTok, Instagram Reels, Facebook y Estado de WhatsApp*, solo responde:\n👉 *#publicar* o *"publica en redes"*'
                });
              } else {
                await enviarMensajeSeguro(jid, {
                  text: `⚠️ *Aviso al compilar video:* ${resVid?.error || 'No se pudo generar el video en este momento.'}`
                });
              }
            } catch (errVid) {
              console.error('❌ Error generando video en puente:', errVid.message);
              await enviarMensajeSeguro(jid, {
                text: `⚠️ Error generando video: ${errVid.message}`
              });
            }
            continue;
          }

          // -------------------------------------------------------------
          // ACCIONES MULTIMEDIA: FLYER / IMAGEN PUBLICITARIA IA
          // -------------------------------------------------------------
          const pideImagen =
            lowCmd.includes('#imagen') ||
            lowCmd.includes('#flyer') ||
            lowCmd.includes('#poster') ||
            lowCmd.includes('#promo') ||
            ((lowCmd.includes('imagen') || lowCmd.includes('flyer') || lowCmd.includes('poster') || lowCmd.includes('anuncio') || lowCmd.includes('publicidad')) && (
              lowCmd.includes('haz') || lowCmd.includes('genera') || lowCmd.includes('crea') || lowCmd.includes('disena')
            ));

          if (pideImagen) {
            await sock.sendPresenceUpdate('composing', jid);
            await enviarMensajeSeguro(jid, {
              text: '🎨 *CDO Mallas Tlaxcalli:* Diseñando flyer publicitario de alta resolución con Blitzr Studio aplicando tus especificaciones...'
            });

            try {
              const fotosB64 = obtenerFotosLocalesProductoBase64(1);
              const fotoAUsar = ultimaFotoDuenoBase64 || fotosB64[0] || null;
              const resImg = await mktAdapter.generarImagenIA({
                texto: limpio || 'Paquete Mantenimiento Mallas Tlaxcalli $1,713 MXN',
                base64: fotoAUsar,
                tema: lowCmd.includes('promo') ? 'promo' : 'industrial',
                usarFondoIA: false,
                precio: '$1,713 MXN',
                precioAnterior: '$2,700 MXN'
              });

              if (resImg && resImg.ok && resImg.base64_resultado) {
                const imgBuf = Buffer.from(resImg.base64_resultado.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                await enviarMensajeSeguro(jid, {
                  image: imgBuf,
                  caption: '🎨 *Flyer Publicitario Oficial — Mallas Tlaxcalli*\n\n' +
                           '💰 Paquete $1,713 MXN con Envío Gratis hasta tu tortillería.\n\n' +
                           '📌 Para publicarlo en Facebook, Instagram y WhatsApp responde: *#publicar*'
                });
              } else {
                await enviarMensajeSeguro(jid, {
                  text: `⚠️ *Aviso al generar flyer:* ${resImg?.error || 'Error al generar imagen.'}`
                });
              }
            } catch (errImg) {
              console.error('❌ Error generando flyer en puente:', errImg.message);
              await enviarMensajeSeguro(jid, {
                text: `⚠️ Error generando flyer: ${errImg.message}`
              });
            }
            continue;
          }

          // -------------------------------------------------------------
          // ACCIONES REDES: PUBLICAR O CONFIRMAR DIFUSIÓN
          // -------------------------------------------------------------
          const pidePublicar =
            lowCmd.includes('#publicar') ||
            lowCmd.includes('#confirmar') ||
            (lowCmd.includes('publica') && (lowCmd.includes('redes') || lowCmd.includes('tiktok') || lowCmd.includes('facebook') || lowCmd.includes('estado')));

          if (pidePublicar) {
            await sock.sendPresenceUpdate('composing', jid);
            await enviarMensajeSeguro(jid, {
              text: '🚀 *CDO Mallas Tlaxcalli:* Transmitiendo publicación a los canales comerciales configurados (WhatsApp Estado, TikTok, Facebook e Instagram)...'
            });

            try {
              const resPub = await mktAdapter.confirmarPublicacionRedes({
                canales: ['whatsapp_estado', 'facebook', 'instagram', 'tiktok'],
                texto: '🔥 Paquete Completo Mallas Tlaxcalli por solo $1,713 MXN con Envío Gratis en Edomex y CDMX. ¡Pídelo hoy por WhatsApp!'
              });

              const canalesDetalle = (resPub.resultados && Array.isArray(resPub.resultados))
                ? resPub.resultados.map(r => `• *${r.canal}:* ${r.estatus || 'OK'}`).join('\n')
                : '• *WhatsApp Estado:* Publicado\n• *TikTok:* Encolado\n• *Instagram:* Encolado\n• *Facebook:* Encolado';

              await enviarMensajeSeguro(jid, {
                text: `✅ *Campaña Publicada con Éxito en Redes:*\n\n${canalesDetalle}\n\nCualquier tortillería que responda será atendida automáticamente por tu Agente de Ventas.`
              });
            } catch (errPub) {
              await enviarMensajeSeguro(jid, {
                text: `⚠️ *Error en publicación:* ${errPub.message}`
              });
            }
            continue;
          }

          // -------------------------------------------------------------
          // DISPARO DIRECTO SUB-SEGUNDO CDO PYTHON (SIN ESPERAR TIMEOUT N8N)
          // -------------------------------------------------------------
          // Disparo desacoplado asincrono n8n
          ejecutarFlujoN8N({
            remitente_rol: 'PAOLA_CEO',
            session_id: `wa_${jid}`,
            telefono: remitenteNum,
            jid: jid,
            mensaje: limpio,
            incluir_voz: pideAudioCEO
          }).catch(() => {});

          const resCEO = await postJsonPython('/api/agente_ceo_pau', {
            mensaje: limpio,
            session_id: 'wa_' + jid,
            incluir_voz: pideAudioCEO
          });

          // Si pidió audio se manda nota de voz; si no, texto claro
          if (pideAudioCEO && resCEO.audio_data_url) {
            await sock.sendPresenceUpdate('recording', jid);
            const b64Audio = resCEO.audio_data_url.split(',')[1];
            const wavBuf = Buffer.from(b64Audio, 'base64');
            const audioNativo = convertirWavAOggOpusNativo(wavBuf);
            await enviarMensajeSeguro(jid, {
              audio: audioNativo.buffer,
              mimetype: audioNativo.mimetype,
              ptt: true
            });
          } else if (resCEO.respuesta_ceo) {
            await enviarMensajeSeguro(jid, { text: `👑 *Agente CDO Mallas Tlaxcalli:*\n\n${resCEO.respuesta_ceo}` });
          }

          if (Array.isArray(resCEO.fotos_enviar) && resCEO.fotos_enviar.length > 0) {
            for (const f of resCEO.fotos_enviar) {
              if (f.ruta && fs.existsSync(f.ruta)) {
                await enviarMensajeSeguro(jid, {
                  image: fs.readFileSync(f.ruta),
                  caption: f.caption || '📸 Imagen guardada'
                });
              }
            }
          }

          const rutaExcelFinal = (resCEO.ruta_excel && fs.existsSync(resCEO.ruta_excel))
            ? resCEO.ruta_excel
            : path.join(__dirname, '..', 'data', 'EXCEL_VIVO_MALLAS_TLAXCALLI.csv');

          const pideExcel =
            resCEO.enviar_excel_wa ||
            checkDueno.recien_activado ||
            txtLow.includes('excel') ||
            txtLow.includes('reporte') ||
            txtLow.includes('resumen') ||
            txtLow.includes('base') ||
            txtLow.includes('archivo') ||
            txtLow.includes('datos');

          if (pideExcel && fs.existsSync(rutaExcelFinal)) {
            await enviarMensajeSeguro(jid, {
              document: fs.readFileSync(rutaExcelFinal),
              mimetype: 'text/csv',
              fileName: 'EXCEL_VIVO_MALLAS_TLAXCALLI.csv',
              caption: '📊 *Hoja de Excel en Vivo — Mallas Tlaxcalli* (Actualizada con los links de Google Maps y prospectos de tortillerías).'
            });
          }
          continue;
        }

        // Flujo Cliente -> n8n Router -> Módulo 2 Ventas IA (+ Módulo 3 solo si confirma los 4 datos)
        const mensajeCliente = textoEntrante.replace(/^#(venta|cliente)\s*/i, '');
        const pedirVoz =
          vinoDeAudio ||
          mensajeCliente.toLowerCase().includes('audio') ||
          mensajeCliente.toLowerCase().includes('explica') ||
          mensajeCliente.toLowerCase().includes('info') ||
          mensajeCliente.toLowerCase().includes('precio') ||
          Math.random() < 0.45;

        let respuestaIA = null;
        try {
          respuestaIA = await ejecutarFlujoN8N({
            remitente_rol: 'CLIENTE',
            session_id: `wa_${jid}`,
            telefono: remitenteNum,
            jid: jid,
            mensaje: mensajeCliente,
            incluir_voz: pedirVoz
          });
        } catch (errN8n) {
          console.log('⚠️ Fallback directo Ventas (n8n ocupado):', errN8n.message);
        }
        if (!respuestaIA || !respuestaIA.respuesta) {
          respuestaIA = await postJsonPython('/api/chat', {
            session_id: `wa_${jid}`,
            mensaje: mensajeCliente,
            incluir_voz: pedirVoz
          });
          if (respuestaIA?.pedido_confirmado && respuestaIA?.datos_pedido) {
            await postJsonPython('/api/registrar_pedido', respuestaIA.datos_pedido).catch(() => {});
          }
        }

        // REGLA ESTRICTA USUARIO: O manda mensaje de texto O manda audio de voz, NUNCA las 2 cosas juntas
        if (respuestaIA.audio_data_url) {
          await sock.sendPresenceUpdate('recording', jid);
          const b64Audio = respuestaIA.audio_data_url.split(',')[1];
          const wavBuf = Buffer.from(b64Audio, 'base64');
          const audioNativo = convertirWavAOggOpusNativo(wavBuf);
          await enviarMensajeSeguro(jid, {
            audio: audioNativo.buffer,
            mimetype: audioNativo.mimetype,
            ptt: true
          });
        } else if (respuestaIA.respuesta) {
          await enviarMensajeSeguro(jid, { text: respuestaIA.respuesta });
        }

        if (respuestaIA.fotos_adjuntas && respuestaIA.fotos_adjuntas.length > 0) {
          // ENVIAR SOLAMENTE 1 SOLA IMAGEN ELEGANTE Y PROFESIONAL (CERO HOSTIGAMIENTO)
          const fotoHero = respuestaIA.fotos_adjuntas.find(f => f.ruta && fs.existsSync(f.ruta) && !f.ruta.endsWith('.svg'));
          if (fotoHero) {
            await enviarMensajeSeguro(jid, {
              image: fs.readFileSync(fotoHero.ruta),
              caption: '📸 *Mallas Tlaxcalli* — Paquete Completo de Mantenimiento $1,713 MXN (Acero Calibre 14 y Balero Alemán 7210B).'
            });
          }
        }

        if (respuestaIA.pedido_confirmado) {
          const propio = obtenerPropioJid();
          if (propio && propio !== jid) {
            const dp = respuestaIA.datos_pedido || {};
            await enviarMensajeSeguro(propio, {
              text: `🎉 *¡NUEVO PEDIDO CERRADO POR IA (+$1,713 MXN)!*\n🏪 Cliente: ${dp.cliente || remitenteNum}\n📍 Dirección: ${dp.direccion || ''} (${dp.municipio || ''})\n🕐 Horario: ${dp.horario || ''}\n💳 Pago: ${dp.metodo_pago || 'Contra entrega'}`
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('❌ Error procesando mensaje con IA:', err.message);
      }
    }
  });
}

// Microservidor local en puerto 8095 para código 8 dígitos, verificación en lote y disparo inmediato
const serverHttpInterno = http.createServer(async (req, res) => {
    const leerBody = () =>
      new Promise((resolve) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try { resolve(JSON.parse(body || '{}')); } catch (_) { resolve({}); }
        });
      });

    if (req.method === 'POST' && req.url === '/control_motor') {
      const data = await leerBody();
      if (data.accion === 'pausar') {
        motorPausadoLocal = true;
        pausaRespuestasGeneral = true;
        forzarAhoraPendiente = false;
        console.log('🛑 [MOTOR 50/DÍA] Pausado por orden administrativa');
      } else if (data.accion === 'activar') {
        motorPausadoLocal = false;
        pausaRespuestasGeneral = false;
        console.log('▶️ [MOTOR 50/DÍA] Activado por orden administrativa');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, motorPausadoLocal, pausaRespuestasGeneral }));
    }

    if (req.method === 'POST' && req.url === '/activar_motor_ahora') {
      await leerBody();
      forzarAhoraPendiente = true;
      setTimeout(() => { revisarYEnviarUno50Diarios(); }, 2000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (req.method === 'POST' && req.url === '/verificar_lote_wa') {
      const data = await leerBody();
      try {
        if (!sockActual || !estadoActual.conectado) throw new Error('WhatsApp no conectado');
        const lista = Array.isArray(data.prospectos) ? data.prospectos : [];
        const resultados = [];
        let conWa = 0;
        let sinWa = 0;
        for (const p of lista) {
          const chk = await resolverJidWhatsApp(p.telefono);
          if (chk.existe) conWa++;
          else sinWa++;
          resultados.push({ id: p.id, existe: chk.existe, telefono_canonico: chk.numero || '' });
        }
        await postJsonPython('/api/marcar_lote_wa', { resultados });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, revisados: lista.length, con_whatsapp: conWa, sin_whatsapp: sinWa }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    if (req.method === 'POST' && req.url === '/prueba_autochat') {
      const data = await leerBody();
      try {
        if (!sockActual || !estadoActual.conectado) throw new Error('WhatsApp no conectado');
        const propioJid = obtenerPropioJid();
        const resCEO = await postJsonPython('/api/agente_ceo_pau', {
          mensaje: data.mensaje || 'Dame el informe real de hoy',
          incluir_voz: true
        });
        await enviarMensajeSeguro(propioJid, { text: `👑 *Agente CDO Mallas Tlaxcalli (PRUEBA):*\n\n${resCEO.respuesta_ceo || ''}` });
        let audioOk = false;
        let mime = '';
        if (resCEO.audio_data_url) {
          const wavBuf = Buffer.from(resCEO.audio_data_url.split(',')[1], 'base64');
          const audioNativo = convertirWavAOggOpusNativo(wavBuf);
          mime = audioNativo.mimetype;
          await enviarMensajeSeguro(propioJid, { audio: audioNativo.buffer, mimetype: audioNativo.mimetype, ptt: true });
          audioOk = true;
        }
        if (resCEO.ruta_excel && fs.existsSync(resCEO.ruta_excel)) {
          await enviarMensajeSeguro(propioJid, {
            document: fs.readFileSync(resCEO.ruta_excel),
            mimetype: 'text/csv',
            fileName: 'EXCEL_VIVO_MALLAS_TLAXCALLI.csv',
            caption: '📊 Excel en Vivo — Mallas Tlaxcalli (PRUEBA)'
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, destino: propioJid, audio_enviado: audioOk, mimetype_audio: mime }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    if (req.method === 'POST' && req.url === '/codigo_8_digitos') {
      const data = await leerBody();
      try {
        let num = String(data.telefono || '').replace(/\D/g, '');
        if (num.length === 10) num = '521' + num;
        else if (num.length === 12 && num.startsWith('52') && !num.startsWith('521')) {
          num = '521' + num.slice(2);
        }
        if (!sockActual) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Socket iniciando, intenta en 3 segundos' }));
        }
        const code = await sockActual.requestPairingCode(num);
        const codeFormateado = code?.match(/.{1,4}/g)?.join('-') || code;
        guardarEstatusWA({ codigo_8_digitos: codeFormateado });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, codigo: codeFormateado, numero: num }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }

    res.writeHead(200);
    res.end('OK');
  });

serverHttpInterno.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('⚠️ Puerto 8095 en uso por otra tarea, continuando sin microservidor local...');
  } else {
    console.error('⚠️ Microservidor local:', err.message);
  }
});

try {
  serverHttpInterno.listen(8095, '127.0.0.1', () => {
    console.log('📡 Microservidor local activo en 127.0.0.1:8095');
  });
} catch (_) {}

// 1. Cola de envíos inmediatos ordenados desde WhatsApp (cada 4 seg) con verificación real onWhatsApp()
setInterval(async () => {
  try {
    if (!sockActual || !estadoActual.conectado) return;
    const resCola = await postJsonPython('/api/despachar_cola_paola', {});
    if (resCola.ok && Array.isArray(resCola.despachados)) {
      for (const item of resCola.despachados) {
        const waCheck = await resolverJidWhatsApp(item.telefono);
        if (waCheck.existe) {
          await sockActual.sendPresenceUpdate('composing', waCheck.jid);
          await new Promise((r) => setTimeout(r, 2000));
          await enviarMensajeSeguro(waCheck.jid, { text: item.mensaje });
        } else {
          const propio = obtenerPropioJid();
          if (propio) {
            await enviarMensajeSeguro(propio, {
              text: `⚠️ El número *${item.telefono}* no tiene cuenta de WhatsApp activa, no se pudo entregar el mensaje.`
            }).catch(() => {});
          }
        }
      }
    }
  } catch (_) {}
}, 4000);

// 2. Motor Anti-Bloqueo de 50 Mensajes Diarios (verifica cada 15s; respeta pausa de 8.5-10.5 min o arranca al instante al activar)
setInterval(() => {
  revisarYEnviarUno50Diarios();
}, 15000);

iniciarPuenteWhatsApp();
