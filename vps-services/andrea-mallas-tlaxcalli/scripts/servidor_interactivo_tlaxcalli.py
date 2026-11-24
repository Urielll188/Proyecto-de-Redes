import subprocess
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
PLATAFORMA INTEGRAL 5 MÓDULOS v3.0 — MALLAS TLAXCALLI (AGENCIA TOPDIEGOZ)
Corriendo 24/7 en la Nueva VPS Ubuntu (8 GB RAM)
================================================================================
MÓDULO 1: Cazador INEGI + Apify en Lotes de 10 en 10 + Link Google Maps +
          Filtro "✅ Abierta / ❌ Cerrada en Maps".
MÓDULO 2: Cerradora IA "Ventas Mallas Tlaxcalli" (Voz de Mujer Mexicana Natural,
          Cero Alucinación "Celorio", Fotos `imágenes negocio pau`, Visión IA
          para fotos de máquinas de clientes y Cierre de 4 Datos).
MÓDULO 3: Logística de Ruteo + Billetera de Comisiones TopDiegoz ($2,500 MXN
          Instalación + $200 MXN por cada paquete entregado y pagado).
MÓDULO 4: Perseguidor de Seguimiento (Recuperación 24h/72h de "Dejados en Visto"
          + Desbloqueo a los 15 días de Lista VIP de Baleros desde $26 MXN).
MÓDULO 5: Director de Marketing Realista (Estudio de Mejora Fotográfica que
          CONSERVA LO REAL sin parecer IA falsa + Generador y Cola para
          Facebook, Instagram, TikTok y Estados de WhatsApp).
================================================================================
"""

import base64
import csv
import hashlib
import io
import json
import math
import mimetypes
import os
import re
import sqlite3
import ssl
import threading
import time
import urllib.parse
import urllib.request
import wave
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer, ThreadingHTTPServer

import modulo_1_motor_cazador as motor_m1

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
PROMPTS_DIR = os.path.join(BASE_DIR, "prompts")
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

PERFIL_PATH = os.path.join(SCRIPTS_DIR, "perfil_mallas_tlaxcalli.json")
PROMPT_PATH = os.path.join(PROMPTS_DIR, "system_prompt_tlaxcalli.md")
DB_PATH = os.path.join(DATA_DIR, "cazador_agencia.db")
OWNER_EMAIL_MALLAS = "ferrergbryanu10@gmail.com"

RUTAS_IMAGENES_PAU = [
    r"C:\Users\Hugo\Desktop\imágenes negocio pau",
    r"C:\Users\Hugo\Desktop\imagenes negocio pau",
    "/config/workspace/imágenes negocio pau",
    "/config/workspace/imagenes_negocio_pau",
    os.path.join(BASE_DIR, "imagenes_negocio_pau")
]
RUTAS_PUBLICIDAD_PAU = [
    "/config/workspace/publicidad_pau",
    os.path.join(BASE_DIR, "publicidad_pau")
]
for _r in (RUTAS_IMAGENES_PAU + RUTAS_PUBLICIDAD_PAU):
    try:
        os.makedirs(_r, exist_ok=True)
    except Exception:
        pass

SSL_CTX = ssl._create_unverified_context()

MODELOS_POOL_INFINITO = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
]

MODELOS_TTS_FEMENINO = [
    "gemini-2.5-flash-preview-tts",
    "gemini-3.8-flash-tts",
    "gemini-3.8-flash-lite-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-pro-preview-tts"
]

ESTADISTICAS_POOL = {
    "llamadas_totales": 0,
    "llamadas_exitosas": 0,
    "notas_voz_generadas": 0,
    "rotaciones_modelo": 0,
    "ultimo_modelo_usado": "gemini-flash-lite-latest",
    "ultimo_modelo_voz": "gemini-2.5-flash-preview-tts"
}

SESIONES_CHAT = {}
OFFSET_EXTRACCION_INEGI = {"actual": 1}


# ==============================================================================
# 1. INICIALIZACIÓN DE TABLAS DE LOS 5 MÓDULOS EN SQLITE
# ==============================================================================

def inicializar_tablas_ecosistema():
    conn = motor_m1.inicializar_bd_sqlite()
    cur = conn.cursor()

    # Columna estatus_maps en prospectos_cazador para el filtro Abierta/Cerrada en Google Maps
    cur.execute("PRAGMA table_info(prospectos_cazador)")
    cols = [r[1] for r in cur.fetchall()]
    if "estatus_maps" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN estatus_maps TEXT DEFAULT 'PENDIENTE_VERIFICAR'")
    if "fecha_ultimo_wa" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN fecha_ultimo_wa TEXT DEFAULT ''")
    if "frente_nombre" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN frente_nombre TEXT DEFAULT NULL")
    if "angulo_contacto" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN angulo_contacto TEXT DEFAULT NULL")

    # Tablas aditivas para Motor de Caza Multi-Frente y progreso persistente por frente/zona
    cur.execute("""
        CREATE TABLE IF NOT EXISTS frentes_caza (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_cliente_agencia TEXT NOT NULL,
            nombre_frente TEXT NOT NULL,
            keywords_busqueda TEXT DEFAULT '',
            ticket_estimado TEXT DEFAULT '',
            angulo_andrea TEXT DEFAULT '',
            activo INTEGER DEFAULT 1,
            creado_en TEXT DEFAULT (datetime('now'))
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS progreso_extraccion (
            id_cliente_agencia TEXT NOT NULL,
            frente_id INTEGER NOT NULL DEFAULT 0,
            zona TEXT NOT NULL,
            fuente TEXT NOT NULL,
            ultimo_offset INTEGER DEFAULT 0,
            actualizado_en TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (id_cliente_agencia, frente_id, zona, fuente)
        )
    """)

    # Tabla Módulo 3: Pedidos Cerrados Reales (CERO PEDIDOS FALSOS INVENTADOS)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS pedidos_comisiones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folio TEXT,
            cliente_tortilleria TEXT,
            telefono TEXT,
            direccion_gps TEXT,
            municipio TEXT,
            horario_recepcion TEXT,
            metodo_pago TEXT,
            tipo_pedido TEXT,
            monto_venta REAL,
            comision_agencia REAL,
            estatus_entrega TEXT,
            google_maps_url TEXT,
            fecha_cierre TEXT
        )
    """)
    # Limpiar los 2 pedidos demo anteriores para que el Agente CDO NUNCA invente ventas que no han ocurrido
    cur.execute("DELETE FROM pedidos_comisiones WHERE folio IN ('TLX-ORD-001', 'TLX-ORD-002')")
    cur.execute("PRAGMA table_info(pedidos_comisiones)")
    cols_ped = [row[1] for row in cur.fetchall()]
    if "id_cliente_agencia" not in cols_ped:
        cur.execute("ALTER TABLE pedidos_comisiones ADD COLUMN id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli'")
    cur.execute("""
        UPDATE pedidos_comisiones
        SET id_cliente_agencia = 'mallas_tlaxcalli'
        WHERE id_cliente_agencia IS NULL
           OR TRIM(id_cliente_agencia) = ''
           OR LOWER(TRIM(id_cliente_agencia)) = 'mallas_tlaxcalli'
    """)

    # Tabla Módulo 4: Seguimiento 24h/72h + Desbloqueo VIP Baleros ($26 MXN) a los 15 días
    cur.execute("""
        CREATE TABLE IF NOT EXISTS seguimiento_clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_tortilleria TEXT,
            telefono TEXT,
            municipio TEXT,
            etapa_seguimiento TEXT,
            ultimo_mensaje_cliente TEXT,
            dias_transcurridos INTEGER,
            mensaje_ia_sugerido TEXT,
            estatus TEXT,
            id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli'
        )
    """)
    cur.execute("DELETE FROM seguimiento_clientes WHERE telefono IN ('525533445566', '525566778899', '525541239876')")
    cur.execute("PRAGMA table_info(seguimiento_clientes)")
    cols_seg = [row[1] for row in cur.fetchall()]
    if "id_cliente_agencia" not in cols_seg:
        cur.execute("ALTER TABLE seguimiento_clientes ADD COLUMN id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli'")
    cur.execute("""
        UPDATE seguimiento_clientes
        SET id_cliente_agencia = 'mallas_tlaxcalli'
        WHERE id_cliente_agencia IS NULL
           OR TRIM(id_cliente_agencia) = ''
           OR LOWER(TRIM(id_cliente_agencia)) = 'mallas_tlaxcalli'
    """)

    # Tabla Bitácora Real de Mensajes Enviados por WhatsApp (Control de 50 diarios anti-bloqueo)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bitacora_envios_wa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telefono TEXT,
            nombre_negocio TEXT,
            municipio TEXT,
            mensaje TEXT,
            tipo_envio TEXT,
            fecha_hora TEXT,
            id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli'
        )
    """)
    cur.execute("PRAGMA table_info(bitacora_envios_wa)")
    cols_bit = [row[1] for row in cur.fetchall()]
    if "id_cliente_agencia" not in cols_bit:
        cur.execute("ALTER TABLE bitacora_envios_wa ADD COLUMN id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli'")
    cur.execute("""
        UPDATE bitacora_envios_wa
        SET id_cliente_agencia = 'mallas_tlaxcalli'
        WHERE id_cliente_agencia IS NULL
           OR TRIM(id_cliente_agencia) = ''
           OR LOWER(TRIM(id_cliente_agencia)) = 'mallas_tlaxcalli'
    """)

    # Normalizar prospectos existentes de Mallas Tlaxcalli y asegurar índice único compuesto (telefono, id_cliente_agencia)
    cur.execute("PRAGMA table_info(prospectos_cazador)")
    cols_prosp = [row[1] for row in cur.fetchall()]
    if cols_prosp:
        if "id_cliente_agencia" not in cols_prosp:
            cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli'")
        cur.execute("""
            UPDATE prospectos_cazador
            SET id_cliente_agencia = 'mallas_tlaxcalli'
            WHERE id_cliente_agencia IS NULL
               OR TRIM(id_cliente_agencia) = ''
               OR LOWER(TRIM(id_cliente_agencia)) = 'mallas_tlaxcalli'
        """)
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_prospecto_cliente_tel ON prospectos_cazador(id_cliente_agencia, telefono)")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_prospecto_tel_cliente ON prospectos_cazador(telefono, id_cliente_agencia)")

    # Tabla Multi-Nicho / Multi-Tenant con tenant base protegido 'mallas_tlaxcalli'
    cur.execute("""
        CREATE TABLE IF NOT EXISTS perfiles_nicho (
            cliente_id TEXT PRIMARY KEY,
            nombre_negocio TEXT NOT NULL,
            nombre_agente TEXT DEFAULT 'Andrea',
            giro_objetivo TEXT NOT NULL,
            codigo_scian_inegi TEXT DEFAULT '',
            keywords_busqueda TEXT DEFAULT '',
            oferta_gancho TEXT DEFAULT '',
            catalogo_y_reglas TEXT DEFAULT '',
            system_prompt TEXT DEFAULT '',
            saludos_frio_json TEXT DEFAULT '[]',
            municipios_json TEXT DEFAULT '[]',
            protegido INTEGER DEFAULT 0,
            activo INTEGER DEFAULT 1,
            fecha_creacion TEXT DEFAULT ''
        )
    """)

    prompt_tlax_default = ""
    if os.path.exists(PROMPT_PATH):
        try:
            with open(PROMPT_PATH, "r", encoding="utf-8") as fp:
                prompt_tlax_default = fp.read()
        except Exception:
            pass

    municipios_tlax_default = [
        "Ecatepec", "Ecatepec de Morelos", "Tultitlán", "Cuautitlán",
        "Cuautitlán Izcalli", "Tepotzotlán", "Naucalpan", "Tlalnepantla",
        "Atizapán", "Coacalco"
    ]
    catalogo_tlax_default = (
        "PAQUETE_MALLAS_1713: Paquete Completo de Mantenimiento Mallas Tlaxcalli en $1,713 MXN (precio lista $1,900; en refaccionaria $2,700+). "
        "Incluye 1 Malla Testalera (23 cm x 1.40 m) + 1 Malla Transportadora (10 pulg x 9 m Calibre 14 reforzado) + 1 Balero 7210B alemán con jaula de acero. "
        "Envío GRATIS a domicilio en CDMX y 9 municipios de Edomex. Pago contra entrega con transferencia o tarjeta Mercado Pago. "
        "Mayoreo para mecánicos (10+ piezas): Testalera Fierro $225 / Galv $230 / Transportadora $650."
    )
    cur.execute("""
        INSERT OR IGNORE INTO perfiles_nicho (
            cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
            codigo_scian_inegi, keywords_busqueda, oferta_gancho,
            catalogo_y_reglas, system_prompt, saludos_frio_json,
            municipios_json, protegido, activo, fecha_creacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'))
    """, (
        "mallas_tlaxcalli",
        "Mallas Tlaxcalli",
        "Andrea / Paola",
        "Tortillerías, Molinos de Nixtamal y Mecánicos de Maquinaria Tortilladora",
        "311830",
        "tortilleria, molino de nixtamal, maquinas tortilladoras, refacciones para tortilladoras, celorio, verduzco",
        "PAQUETE_MALLAS_1713 — Paquete Completo Mantenimiento $1,713 MXN (Testalera 23x140 + Transportadora 10x9m Cal 14 + Balero 7210B) con envío gratis",
        catalogo_tlax_default,
        prompt_tlax_default,
        "[]",
        json.dumps(municipios_tlax_default, ensure_ascii=False)
    ))
    cur.execute("UPDATE perfiles_nicho SET protegido = 1 WHERE cliente_id = 'mallas_tlaxcalli'")
    cur.execute("PRAGMA table_info(perfiles_nicho)")
    cols_nicho = [row[1] for row in cur.fetchall()]
    if "owner_email" not in cols_nicho:
        cur.execute("ALTER TABLE perfiles_nicho ADD COLUMN owner_email TEXT DEFAULT ''")
    if "modelo_negocio" not in cols_nicho:
        cur.execute("ALTER TABLE perfiles_nicho ADD COLUMN modelo_negocio TEXT DEFAULT 'DISTRIBUIDOR_B2B'")
    if "diagnostico_ia" not in cols_nicho:
        cur.execute("ALTER TABLE perfiles_nicho ADD COLUMN diagnostico_ia TEXT DEFAULT '{}'")
    if "zonas_objetivo" not in cols_nicho:
        cur.execute("ALTER TABLE perfiles_nicho ADD COLUMN zonas_objetivo TEXT DEFAULT 'CDMX y Area Metropolitana'")
    if "flujo_continuo_activo" not in cols_nicho:
        cur.execute("ALTER TABLE perfiles_nicho ADD COLUMN flujo_continuo_activo INTEGER DEFAULT 1")
    cur.execute("""
        UPDATE perfiles_nicho
        SET modelo_negocio = 'DISTRIBUIDOR_B2B'
        WHERE modelo_negocio IS NULL OR TRIM(modelo_negocio) = ''
    """)
    cur.execute("UPDATE perfiles_nicho SET owner_email = '' WHERE LOWER(TRIM(owner_email)) = ? AND cliente_id != 'mallas_tlaxcalli'", (OWNER_EMAIL_MALLAS,))
    cur.execute("UPDATE perfiles_nicho SET owner_email = ?, protegido = 1, modelo_negocio = 'DISTRIBUIDOR_B2B' WHERE cliente_id = 'mallas_tlaxcalli'", (OWNER_EMAIL_MALLAS,))
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_owner_email ON perfiles_nicho(owner_email) WHERE owner_email IS NOT NULL AND owner_email != ''")

    # Tabla de Números Autorizados como Dueños (Ing. Paola / Ing. Rocha) para usar su Agente CDO directo en WhatsApp
    cur.execute("""
        CREATE TABLE IF NOT EXISTS duenos_autorizados_wa (
            jid TEXT PRIMARY KEY,
            nombre TEXT,
            fecha_registro TEXT
        )
    """)

    # Tabla de Usuarios y Contraseñas de Administrador para WhatsApp
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admin_usuarios (
            usuario TEXT PRIMARY KEY,
            password TEXT,
            nombre TEXT,
            rol TEXT,
            fecha_creacion TEXT
        )
    """)
    cur.execute("INSERT OR IGNORE INTO admin_usuarios (usuario, password, nombre, rol, fecha_creacion) VALUES ('paola', 'Tlaxcalli2026', 'Ing. Paola Almanza', 'ADMIN_PRINCIPAL', datetime('now'))")
    cur.execute("INSERT OR IGNORE INTO admin_usuarios (usuario, password, nombre, rol, fecha_creacion) VALUES ('admin', '7210B', 'TopDiegoz SuperAdmin', 'SUPERADMIN', datetime('now'))")

    # Tabla de Configuración Persistente del Sistema (para no perder estado al reiniciar VPS)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS config_sistema (
            clave TEXT PRIMARY KEY,
            valor TEXT
        )
    """)
    cur.execute("INSERT OR IGNORE INTO config_sistema (clave, valor) VALUES ('motor_50_activo', '0')")

    conn.commit()
    conn.close()


def leer_config(clave: str, default: str = "") -> str:
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT valor FROM config_sistema WHERE clave = ?", (clave,))
        row = cur.fetchone()
        conn.close()
        return str(row[0]) if row and row[0] is not None else default
    except Exception:
        return default


def guardar_config(clave: str, valor: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO config_sistema (clave, valor) VALUES (?, ?)", (clave, str(valor)))
        conn.commit()
        conn.close()
    except Exception:
        pass


inicializar_tablas_ecosistema()

META_DIARIA_FRIO = int(os.environ.get("META_DIARIA_FRIO", "30"))

ESTADO_MOTOR_50_DIARIOS = {
    "activo": leer_config("motor_50_activo", "0") == "1",
    "meta_diaria": META_DIARIA_FRIO,
    "intervalo_minutos": f"8.5 a 12 minutos entre cada mensaje (Meta: {META_DIARIA_FRIO} diarios)",
    "ultimo_negocio_contactado": leer_config("ultimo_negocio_contactado", "Ninguno todavía")
}
EXCEL_VIVO_PATH = os.path.join(BASE_DIR, "data", "EXCEL_VIVO_MALLAS_TLAXCALLI.csv")


def exportar_excel_en_vivo() -> str:
    """
    Genera y actualiza en tiempo real el archivo Excel (.csv con UTF-8 BOM para abrir directo en Microsoft Excel)
    con todas las tortillerías cazadas, su estatus de WhatsApp y sus links exactos de Google Maps.
    """
    os.makedirs(os.path.dirname(EXCEL_VIVO_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, nombre, telefono, municipio, direccion, colonia, segmento_cliente,
               oferta_recomendada, estatus_contacto_wa, estatus_maps, google_maps_url,
               fecha_registro, latitud, longitud
        FROM prospectos_cazador
        WHERE estatus_clasificacion LIKE 'APROBADO%'
        ORDER BY id DESC
    """)
    filas = cur.fetchall()
    conn.close()

    with open(EXCEL_VIVO_PATH, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "Tortilleria_o_Negocio", "Telefono_WhatsApp", "Municipio",
            "Direccion", "Colonia", "Segmento", "Oferta_Mallas_Tlaxcalli",
            "Estatus_Mensaje_WhatsApp", "Verificacion_Google_Maps", "Link_Google_Maps", "Fecha_Registro"
        ])
        for r in filas:
            lat_r = r[12] if len(r) > 12 else ""
            lon_r = r[13] if len(r) > 13 else ""
            link = r[10]
            if not link or "&center=" in str(link):
                try:
                    link = motor_m1.construir_link_google_maps(r[1] or "", r[4] or "", r[3] or "", lat_r, lon_r)
                except Exception:
                    pass
            writer.writerow([r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], link, r[11]])
    return EXCEL_VIVO_PATH


def obtener_llaves_ia_backend() -> list:
    env = motor_m1.cargar_env()
    llaves = []
    if env.get("GEMINI_API_KEYS"):
        for k in env["GEMINI_API_KEYS"].split(","):
            if k.strip():
                llaves.append(k.strip())
    if env.get("GEMINI_API_KEY") and env["GEMINI_API_KEY"] not in llaves:
        llaves.append(env["GEMINI_API_KEY"])
    return llaves


def cargar_system_prompt() -> str:
    if os.path.exists(PROMPT_PATH):
        with open(PROMPT_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return "Eres la encargada de Ventas de Mallas Tlaxcalli."


MODELOS_NEGOCIO_VALIDOS = ("DISTRIBUIDOR_B2B", "SERVICIOS_B2B", "EMPRENDEDOR_B2C")


def normalizar_modelo_negocio(val: str) -> str:
    v = str(val or "").strip().upper()
    if v in MODELOS_NEGOCIO_VALIDOS:
        return v
    if "SERVICIO" in v or "INSTALACION" in v:
        return "SERVICIOS_B2B"
    if "B2C" in v or "PARTICULAR" in v or "EMPRENDEDOR" in v:
        return "EMPRENDEDOR_B2C"
    return "DISTRIBUIDOR_B2B"


def _limpiar_giro_texto(texto: str) -> str:
    limpio = re.sub(r"\s+", " ", str(texto or "").strip())
    patron_prefijo = r"^(?:yo\s+)?(?:hago|vendo|ofrezco|fabrico|soy|realizo|me\s+dedico\s+a|dedico\s+a|hacemos|vendemos|ofrecemos|fabricamos|somos|realizamos|nos\s+dedicamos\s+a)\s+"
    while True:
        nuevo = re.sub(patron_prefijo, "", limpio, flags=re.IGNORECASE).strip()
        if nuevo == limpio:
            break
        limpio = nuevo
    limpio = re.sub(r"^(?:hacer|vender|ofrecer|fabricar|realizar)\s+", "", limpio, flags=re.IGNORECASE).strip()
    return limpio[:70] or "tu producto o servicio"


def diagnosticar_modelo_heuristico(
    descripcion_idea: str,
    nicho_categoria: str = "",
    objetivo: str = "",
    cliente_objetivo_tipo: str = "",
    modalidad_entrega: str = "",
    volumen_compra: str = ""
) -> dict:
    idea_raw = str(descripcion_idea or "").strip()
    giro_limpio = _limpiar_giro_texto(idea_raw)
    texto_full = motor_m1.quitar_acentos(f"{idea_raw} {nicho_categoria} {objetivo}").lower()

    cli_tipo = str(cliente_objetivo_tipo or "").strip().lower()
    mod_entrega = str(modalidad_entrega or "").strip().lower()
    vol_compra = str(volumen_compra or "").strip().lower()

    kws_b2c = [
        "tupper", "tupperware", "catalogo", "comida", "postre", "postres", "ropa",
        "cosmetico", "cosmeticos", "maquillaje", "perfume", "perfumes", "venta directa",
        "colonia", "vecinos", "particular", "consumidor final", "avon", "mary kay",
        "shein", "zapatos", "tenis", "joyeria", "bisuteria", "pastel", "pasteles",
        "antojitos", "snacks", "bazar", "tienda de ropa", "menudeo", "impresion 3d",
        "impresiones 3d", "3d", "regalo", "regalos", "personaliz", "figuras"
    ]
    kws_servicios = [
        "instalacion", "instalaciones", "redes", "cableado", "estructurado", "wifi",
        "cctv", "camaras", "mantenimiento", "servicio", "servicios", "reparacion",
        "consultoria", "soporte tecnico", "soporte", "configuracion", "fibra optica",
        "conmutador", "servidor", "servidores", "arquitectura", "construccion",
        "electricista", "plomeria", "fumigacion", "limpieza industrial", "climatizacion",
        "aire acondicionado", "agencia", "desarrollo web", "software"
    ]

    hits_b2c = sum(1 for k in kws_b2c if k in texto_full)
    hits_serv = sum(1 for k in kws_servicios if k in texto_full)

    # 1. Regla Determinista B2C:
    # Si cliente_objetivo_tipo == "consumidor_final" y (volumen_compra == "menudeo" or modalidad_entrega in ("catalogo_estandar", "personalizado_bajo_pedido"))
    # O si el texto tiene indicadores claros B2C y no es un servicio exclusivo B2B
    es_b2c_determinado = (
        cli_tipo == "consumidor_final" and (
            vol_compra == "menudeo"
            or mod_entrega in ("catalogo_estandar", "personalizado_bajo_pedido")
            or not vol_compra
        )
    ) or (cli_tipo not in ("empresas_b2b", "ambos") and hits_b2c > 0 and hits_b2c >= hits_serv)

    # 2. Regla Determinista Servicios B2B:
    # Si modalidad_entrega == "servicio_en_sitio"
    # O (modalidad_entrega == "personalizado_bajo_pedido" y cliente_objetivo_tipo in ("empresas_b2b", "ambos") y volumen_compra == "proyecto")
    es_servicios_determinado = (
        mod_entrega == "servicio_en_sitio"
        or (mod_entrega == "personalizado_bajo_pedido" and cli_tipo in ("empresas_b2b", "ambos") and vol_compra == "proyecto")
        or (cli_tipo == "empresas_b2b" and hits_serv > 0)
        or (not es_b2c_determinado and hits_serv > 0 and hits_b2c == 0)
    )

    if es_b2c_determinado and not (cli_tipo == "empresas_b2b" and vol_compra == "mayoreo"):
        modelo = "EMPRENDEDOR_B2C"
        scores = {"distribuidor": 25, "servicios": 20, "particular": 95}
        es_personalizado = (
            mod_entrega == "personalizado_bajo_pedido"
            or any(w in texto_full for w in ("personaliz", "3d", "medida", "diseño", "diseno", "custom", "pedido"))
        )
        titulo = f"Modelo Recomendado: Particular / Emprendedor B2C (Inbound Seguro — {giro_limpio})"
        if es_personalizado:
            explicacion = (
                f"Al vender {giro_limpio} personalizado directo a personas (B2C), escribir en frío a desconocidos en WhatsApp genera "
                "reportes y bloqueos de chip. Conviene operar 100% Inbound: los clientes llegan atraídos por tus anuncios de 03 • ESTUDIO "
                "con enlace wa.me y Andrea solicita especificaciones (medidas, diseño, archivo o foto) para cotizar y cerrar de forma segura."
            )
            clientes_obj = f"Compradores de {giro_limpio}, personas que buscan regalos personalizados, coleccionistas o clientes que solicitan piezas a medida"
            enfoque_andrea = "Atención inbound personalizada: pedir detalles clave (medidas, material/color, diseño o archivo de referencia), resolver dudas y cotizar antes de confirmar el pedido"
            kws_sug = [
                f"{giro_limpio} personalizado",
                "pedidos a medida",
                "regalos personalizados",
                "catalogo digital",
                "entregas locales",
                "promociones especiales"
            ]
        else:
            explicacion = (
                f"Tu oferta de {giro_limpio} va dirigida al consumidor final (B2C). Enviar mensajes masivos en frío a personas desconocidas "
                "provoca reportes y bloqueos de chip. Conviene operar en Modo Inbound 24/7: atraes interesados con anuncios de 03 • ESTUDIO "
                "en redes sociales y Andrea atiende y cierra cada venta 24/7 en cuanto te escriben."
            )
            clientes_obj = f"Consumidores finales, seguidores en redes sociales y personas interesadas en {giro_limpio}"
            enfoque_andrea = f"Atención inbound de catálogo para {giro_limpio}, envío de promociones y cierre rápido de pedido a domicilio o entrega local"
            kws_sug = [
                f"{giro_limpio} catalogo",
                "pedidos a domicilio",
                "ofertas de temporada",
                "entregas locales",
                "catalogo digital",
                "promociones especiales"
            ]

    elif es_servicios_determinado:
        modelo = "SERVICIOS_B2B"
        scores = {"distribuidor": 48, "servicios": 95, "particular": 28}
        titulo = f"Modelo Recomendado: Servicios Técnicos y Proyectos B2B ({giro_limpio})"
        explicacion = (
            f"Tu modelo para {giro_limpio} requiere análisis técnico o visita en sitio. El mayor retorno está en prospectar empresas, "
            "oficinas, comercios y corporativos establecidos (B2B) mediante el Cazador INEGI/Maps, donde Andrea califica alcances técnicos "
            "y agenda levantamientos o visitas de cotización sin fricción."
        )
        clientes_obj = f"Empresas, oficinas, comercios, despachos o corporativos que requieran {giro_limpio}"
        enfoque_andrea = f"Diagnóstico consultivo para {giro_limpio}, levantamiento de requerimientos técnicos (medidas, especificaciones, archivos o visita en sitio) y cotización de proyecto"
        kws_sug = [
            f"servicios de {giro_limpio}",
            "levantamiento tecnico",
            "cotizacion corporativa",
            "mantenimiento y proyectos",
            "empresas y oficinas",
            "atencion a negocios"
        ]

    else:
        modelo = "DISTRIBUIDOR_B2B"
        scores = {"distribuidor": 95, "servicios": 45, "particular": 22}
        titulo = f"Modelo Recomendado: Proveedor Mayorista / Distribuidor B2B ({giro_limpio})"
        explicacion = (
            f"Tu oferta de {giro_limpio} tiene alto potencial como proveedor o distribuidor directo a negocios establecidos (B2B). "
            "El Cazador 24/7 localiza comercios que consumen tu producto de forma recurrente en INEGI/Google Maps y Andrea cierra paquetes "
            "o pedidos por volumen sin riesgo de spam al dirigirse a teléfonos comerciales."
        )
        clientes_obj = f"Comercios establecidos, distribuidores y compradores comerciales que consuman o revendan {giro_limpio}"
        enfoque_andrea = f"Presentación de catálogo mayorista para {giro_limpio}, escalas de precios por volumen y cierre de pedidos con entrega programada"
        kws_sug = [
            f"mayoreo de {giro_limpio}",
            "distribuidores locales",
            "proveedores comerciales",
            "pedidos por volumen",
            "tiendas del giro",
            "suministro recurrente"
        ]

    return {
        "ok": True,
        "origen_diagnostico": "heuristico",
        "modelo_recomendado": modelo,
        "scores": scores,
        "titulo_veredicto": titulo,
        "explicacion_estrategica": explicacion,
        "clientes_objetivo": clientes_obj,
        "keywords_sugeridas": kws_sug,
        "enfoque_andrea": enfoque_andrea,
        "cliente_objetivo_tipo": cli_tipo,
        "modalidad_entrega": mod_entrega,
        "volumen_compra": vol_compra
    }


def diagnosticar_modelo_negocio_ia(
    descripcion_idea: str,
    nicho_categoria: str = "",
    objetivo: str = "",
    cliente_objetivo_tipo: str = "",
    modalidad_entrega: str = "",
    volumen_compra: str = ""
) -> dict:
    base_heuristica = diagnosticar_modelo_heuristico(
        descripcion_idea,
        nicho_categoria,
        objetivo,
        cliente_objetivo_tipo=cliente_objetivo_tipo,
        modalidad_entrega=modalidad_entrega,
        volumen_compra=volumen_compra
    )
    idea_clean = str(descripcion_idea or "").strip()
    if not idea_clean:
        return base_heuristica
    giro_limpio_ia = _limpiar_giro_texto(idea_clean)

    llaves = obtener_llaves_ia_backend()
    if not llaves:
        return base_heuristica

    prompt_diag = (
        "Eres un Arquitecto de Estrategia Comercial B2B/B2C para WhatsApp y Prospección Automatizada en México.\n"
        "Analiza el siguiente negocio del usuario y clasifícalo en UNO de estos 3 modelos operativos:\n"
        "1. \"DISTRIBUIDOR_B2B\": Venta de productos físicos, refacciones, insumos o mercancía por mayoreo/lotes a otros negocios establecidos.\n"
        "2. \"SERVICIOS_B2B\": Servicios técnicos, instalaciones (redes, cableado estructurado, WiFi, CCTV, mantenimiento industrial, software, consultoría) o proyectos a medida para empresas, oficinas, escuelas o comercios.\n"
        "3. \"EMPRENDEDOR_B2C\": Venta directa al público general/consumidor final (ej. regalos personalizados, impresiones 3D a medida o por catálogo, Tupperware, comida, ropa, piezas sueltas), donde escribir en frío a desconocidos en WhatsApp causa bloqueos y conviene operar solo en modo Inbound con anuncios de 03 • ESTUDIO y enlaces wa.me.\n\n"
        "REGLAS DETERMINISTAS:\n"
        "- Si el cliente objetivo es 'consumidor_final' y compran al menudeo o bajo pedido/catálogo: DEBES asignar 'EMPRENDEDOR_B2C' (particular >= 88, distribuidor <= 45).\n"
        "- Si la modalidad es 'servicio_en_sitio' o proyecto para empresas ('personalizado_bajo_pedido' + 'empresas_b2b'/'ambos' + 'proyecto'): DEBES asignar 'SERVICIOS_B2B' (servicios >= 88).\n"
        "- Si el cliente objetivo es 'empresas_b2b' y compran por 'mayoreo': DEBES asignar 'DISTRIBUIDOR_B2B' (distribuidor >= 88).\n\n"
        "PROHIBICIÓN ESTRICTA:\n"
        "Queda TERMINANTEMENTE PROHIBIDO usar textos genéricos como 'talleres, tiendas minoristas, restaurantes' a menos que el negocio venda insumos a esos rubros. En 'clientes_objetivo', 'explicacion_estrategica' y 'enfoque_andrea', DEBES interpolar EXACTAMENTE el sustantivo del producto o servicio sin verbos en primera persona como 'hago' o 'vendo' (por ejemplo, para impresiones 3D: 'compradores de regalos personalizados, coleccionistas, emprendedores o despachos que requieran prototipos').\n"
        "Si es personalizado bajo pedido, Andrea debe solicitar medidas, color, material, diseño o archivo de referencia antes de cotizar.\n\n"
        f"DATOS DEL USUARIO:\n"
        f"- Producto o servicio limpio: {giro_limpio_ia}\n"
        f"- Descripción original: {idea_clean[:800]}\n"
        f"- Categoría seleccionada: {nicho_categoria}\n"
        f"- Objetivo de conversión: {objetivo}\n"
        f"- ¿Quién compra?: {cliente_objetivo_tipo or 'No especificado'}\n"
        f"- ¿Cómo entregas?: {modalidad_entrega or 'No especificado'}\n"
        f"- ¿Cómo compran?: {volumen_compra or 'No especificado'}\n\n"
        "Devuelve ÚNICAMENTE un JSON válido (sin bloques markdown) con esta estructura exacta:\n"
        "{\n"
        "  \"modelo_recomendado\": \"DISTRIBUIDOR_B2B\" | \"SERVICIOS_B2B\" | \"EMPRENDEDOR_B2C\",\n"
        "  \"scores\": {\"distribuidor\": 0-100, \"servicios\": 0-100, \"particular\": 0-100},\n"
        "  \"titulo_veredicto\": \"string corto y contundente\",\n"
        "  \"explicacion_estrategica\": \"explicación clara de 2-3 oraciones de por qué este modelo le da más ventas y cómo protege su WhatsApp\",\n"
        "  \"clientes_objetivo\": \"qué tipo específico de negocios o clientes debe buscar\",\n"
        "  \"keywords_sugeridas\": [\"termino 1\", \"termino 2\", \"termino 3\", \"termino 4\", \"termino 5\", \"termino 6\"],\n"
        "  \"enfoque_andrea\": \"cómo debe conducir y cerrar la conversación la asesora IA Andrea\"\n"
        "}"
    )

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt_diag}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 600
        }
    }

    t_inicio = time.time()
    modelos_rapidos = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"]
    for modelo in modelos_rapidos:
        for key in llaves[:2]:
            restante = 7.8 - (time.time() - t_inicio)
            if restante <= 1.2:
                return base_heuristica
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=min(7.5, max(1.5, restante))) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    txt = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                    m_json = re.search(r"\{.*\}", txt, flags=re.S)
                    if not m_json:
                        continue
                    parsed = json.loads(m_json.group(0))
                    mod_rec = normalizar_modelo_negocio(parsed.get("modelo_recomendado") or base_heuristica["modelo_recomendado"])

                    # Aplicar salvaguardas deterministas sobre el resultado de IA
                    cli_norm = str(cliente_objetivo_tipo or "").strip().lower()
                    mod_norm = str(modalidad_entrega or "").strip().lower()
                    vol_norm = str(volumen_compra or "").strip().lower()

                    raw_scores = parsed.get("scores") if isinstance(parsed.get("scores"), dict) else {}
                    scores = {
                        "distribuidor": max(0, min(100, int(raw_scores.get("distribuidor", base_heuristica["scores"]["distribuidor"])))),
                        "servicios": max(0, min(100, int(raw_scores.get("servicios", base_heuristica["scores"]["servicios"])))),
                        "particular": max(0, min(100, int(raw_scores.get("particular", base_heuristica["scores"]["particular"]))))
                    }

                    if cli_norm == "consumidor_final" and (vol_norm == "menudeo" or mod_norm in ("catalogo_estandar", "personalizado_bajo_pedido") or not vol_norm):
                        mod_rec = "EMPRENDEDOR_B2C"
                        scores["particular"] = max(88, scores["particular"])
                        scores["distribuidor"] = min(45, scores["distribuidor"])
                    elif mod_norm == "servicio_en_sitio" or (mod_norm == "personalizado_bajo_pedido" and cli_norm in ("empresas_b2b", "ambos") and vol_norm == "proyecto"):
                        mod_rec = "SERVICIOS_B2B"
                        scores["servicios"] = max(88, scores["servicios"])
                    elif cli_norm == "empresas_b2b" and vol_norm == "mayoreo":
                        mod_rec = "DISTRIBUIDOR_B2B"
                        scores["distribuidor"] = max(88, scores["distribuidor"])
                    elif base_heuristica["modelo_recomendado"] == "EMPRENDEDOR_B2C" and any(w in motor_m1.quitar_acentos(idea_clean).lower() for w in ("tupper", "catalogo", "colonia", "3d", "personaliz")):
                        mod_rec = "EMPRENDEDOR_B2C"
                        scores["particular"] = max(88, scores["particular"])
                        scores["distribuidor"] = min(45, scores["distribuidor"])

                    # Prohibición de textos genéricos en clientes_objetivo
                    cli_obj_raw = str(parsed.get("clientes_objetivo") or "").strip()
                    if ("talleres" in cli_obj_raw.lower() or "restaurantes" in cli_obj_raw.lower()) and not any(w in motor_m1.quitar_acentos(idea_clean).lower() for w in ("taller", "restaurante", "malla", "comida")):
                        cli_obj_raw = base_heuristica["clientes_objetivo"]
                    if not cli_obj_raw:
                        cli_obj_raw = base_heuristica["clientes_objetivo"]

                    # Sanitizar explicacion_estrategica si contiene talleres/restaurantes
                    exp_est_raw = str(parsed.get("explicacion_estrategica") or "").strip()
                    if ("talleres" in exp_est_raw.lower() or "restaurantes" in exp_est_raw.lower()) and not any(w in motor_m1.quitar_acentos(idea_clean).lower() for w in ("taller", "restaurante", "malla", "comida")):
                        exp_est_raw = base_heuristica["explicacion_estrategica"]
                    if not exp_est_raw:
                        exp_est_raw = base_heuristica["explicacion_estrategica"]

                    # Sanitizar enfoque_andrea
                    enf_andrea_raw = str(parsed.get("enfoque_andrea") or "").strip()
                    if not enf_andrea_raw:
                        enf_andrea_raw = base_heuristica["enfoque_andrea"]

                    kws_ia = parsed.get("keywords_sugeridas")
                    if not isinstance(kws_ia, list) or len(kws_ia) == 0:
                        kws_ia = base_heuristica["keywords_sugeridas"]
                    kws_clean = [str(k).strip() for k in kws_ia if str(k).strip()][:8]

                    return {
                        "ok": True,
                        "origen_diagnostico": f"gemini ({modelo})",
                        "modelo_recomendado": mod_rec,
                        "scores": scores,
                        "titulo_veredicto": str(parsed.get("titulo_veredicto") or base_heuristica["titulo_veredicto"]).strip(),
                        "explicacion_estrategica": exp_est_raw,
                        "clientes_objetivo": cli_obj_raw,
                        "keywords_sugeridas": kws_clean or base_heuristica["keywords_sugeridas"],
                        "enfoque_andrea": enf_andrea_raw,
                        "cliente_objetivo_tipo": cli_norm,
                        "modalidad_entrega": mod_norm,
                        "volumen_compra": vol_norm
                    }
            except Exception:
                continue

    return base_heuristica


def _validar_url_ssrf_segura(raw_url: str) -> tuple[bool, str, str]:
    import ipaddress
    import socket

    u = str(raw_url or "").strip()
    if not u:
        return False, "", "Por favor ingresa la URL de tu sitio web."

    # Si trae un esquema explícito distinto de http/https, rechazar con HTTP 400
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", u):
        if not re.match(r"^https?://", u, flags=re.I):
            return False, "", "Esquema no permitido. Solo se aceptan direcciones http:// o https://."
        url_norm = u
    elif u.lower().startswith(("javascript:", "file:", "data:", "ftp:", "gopher:")):
        return False, "", "Esquema de URL no permitido."
    else:
        url_norm = "https://" + u.lstrip("/")

    try:
        parsed = urllib.parse.urlparse(url_norm)
    except Exception:
        return False, "", "Formato de URL inválido."

    if parsed.scheme.lower() not in ("http", "https"):
        return False, "", "Solo se permiten esquemas http o https."

    host = (parsed.hostname or "").strip().lower()
    if not host:
        return False, "", "La URL no contiene un dominio válido."

    # Bloqueo directo de nombres locales o metadatos cloud
    dominios_bloqueados = {
        "localhost",
        "localhost.localdomain",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "[::1]",
        "metadata.google.internal",
        "169.254.169.254",
    }
    if (
        host in dominios_bloqueados
        or host.endswith(".local")
        or host.endswith(".internal")
        or host.endswith(".localhost")
        or host.endswith(".lan")
    ):
        return False, "", "URL bloqueada por seguridad SSRF: no se permiten dominios locales ni internos."

    # Revisión rápida de rangos IPv4 privados en texto
    if re.match(
        r"^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.|0\.)",
        host,
    ):
        return False, "", "URL bloqueada por seguridad SSRF: no se permiten direcciones IP privadas o loopback."

    def _ip_es_prohibida(ip_txt: str) -> bool:
        try:
            ip_obj = ipaddress.ip_address(ip_txt)
            return (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
                or ip_obj.is_unspecified
            )
        except Exception:
            return True

    # Si el host ya es una IP literal
    try:
        ipaddress.ip_address(host)
        if _ip_es_prohibida(host):
            return False, "", "URL bloqueada por seguridad SSRF: dirección IP privada o reservada."
    except ValueError:
        pass

    # Resolver DNS y verificar todas las IPs asociadas
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
        if not infos:
            return False, "", "No se pudo resolver el dominio del sitio web."
        for info in infos:
            sockaddr = info[4]
            if sockaddr and len(sockaddr) >= 1:
                ip_res = str(sockaddr[0]).split("%")[0]
                if _ip_es_prohibida(ip_res):
                    return False, "", "URL bloqueada por seguridad SSRF: el dominio resuelve a una IP privada o local."
    except Exception:
        return False, "", "No se pudo resolver el dominio indicado. Verifica que la URL exista."

    return True, url_norm, ""


def _limpiar_html_a_texto_estructurado(html_raw: str) -> dict:
    import html as html_lib

    raw = str(html_raw or "")
    m_title = re.search(r"<title[^>]*>([\s\S]*?)</title>", raw, flags=re.I)
    title = html_lib.unescape(re.sub(r"\s+", " ", m_title.group(1)).strip()) if m_title else ""

    def _buscar_meta(attr_name: str, attr_val: str) -> str:
        pat1 = rf'<meta[^>]+{attr_name}\s*=\s*["\']{re.escape(attr_val)}["\'][^>]+content\s*=\s*["\']([^"\']+)["\']'
        pat2 = rf'<meta[^>]+content\s*=\s*["\']([^"\']+)["\'][^>]+{attr_name}\s*=\s*["\']{re.escape(attr_val)}["\']'
        m = re.search(pat1, raw, flags=re.I) or re.search(pat2, raw, flags=re.I)
        return html_lib.unescape(m.group(1).strip()) if m else ""

    meta_desc = _buscar_meta("name", "description")
    og_title = _buscar_meta("property", "og:title")
    og_desc = _buscar_meta("property", "og:description")
    og_site = _buscar_meta("property", "og:site_name")
    og_image = _buscar_meta("property", "og:image") or _buscar_meta("name", "twitter:image")

    # Extraer encabezados H1, H2, H3 antes de limpiar etiquetas
    headings = []
    for m_h in re.finditer(r"<h[1-3][^>]*>([\s\S]*?)</h[1-3]>", raw, flags=re.I):
        h_txt = re.sub(r"<[^>]+>", " ", m_h.group(1))
        h_txt = html_lib.unescape(re.sub(r"\s+", " ", h_txt)).strip()
        if 3 <= len(h_txt) <= 140 and h_txt not in headings:
            headings.append(h_txt)
        if len(headings) >= 18:
            break

    # Eliminar scripts, estilos, nav, svg y comentarios
    limpio = re.sub(r"<!--[\s\S]*?-->", " ", raw)
    limpio = re.sub(r"<(script|style|noscript|svg|nav|iframe)[^>]*>[\s\S]*?</\1>", " ", limpio, flags=re.I)
    limpio = re.sub(r"<[^>]+>", " ", limpio)
    limpio = html_lib.unescape(limpio)
    limpio = re.sub(r"\s+", " ", limpio).strip()

    # Detectar menciones de precios ($1,200, $350 MXN, etc.)
    precios = []
    for m_p in re.finditer(r"\$\s?\d{1,3}(?:[.,]\d{3})*(?:\.\d{2})?(?:\s*(?:MXN|USD|pesos|c/u|mes))?", limpio, flags=re.I):
        p_val = m_p.group(0).strip()
        if p_val not in precios:
            precios.append(p_val)
        if len(precios) >= 10:
            break

    return {
        "title": title,
        "og_site": og_site,
        "og_title": og_title,
        "meta_desc": meta_desc or og_desc,
        "og_image": og_image,
        "headings": headings,
        "precios": precios,
        "texto": limpio[:4500],
    }


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        es_segura, _, err_msg = _validar_url_ssrf_segura(newurl)
        if not es_segura:
            raise urllib.error.URLError(err_msg or "Redirect bloqueado por seguridad SSRF")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _leer_respuesta_html_segura(resp, max_bytes: int = 450 * 1024) -> str:
    import gzip

    raw_bytes = resp.read(max_bytes)
    enc = str(resp.headers.get("Content-Encoding") or "").lower()
    if "gzip" in enc:
        try:
            raw_bytes = gzip.decompress(raw_bytes)
        except Exception:
            pass
    charset = resp.headers.get_content_charset() or "utf-8"
    try:
        return raw_bytes.decode(charset, errors="ignore")
    except Exception:
        return raw_bytes.decode("utf-8", errors="ignore")


def _extraer_logo_de_html(
    html_raw: str,
    base_url: str,
    og_image: str,
    t_inicio: float,
    opener=None,
) -> tuple[str | None, str | None]:
    raw = str(html_raw or "")
    candidatos = []

    # 1. Buscar etiquetas <img> que contengan 'logo' en class, id, alt o src
    for m_img in re.finditer(r"<img\b([^>]+)>", raw, flags=re.I):
        attrs = m_img.group(1)
        if not re.search(r"logo|brand|marca", attrs, flags=re.I):
            continue
        m_src = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs, flags=re.I)
        if m_src:
            src_val = m_src.group(1).strip()
            if src_val and not src_val.startswith("data:image/svg"):
                candidatos.append(src_val)

    # 2. Buscar apple-touch-icon o icon en <link>
    for m_lnk in re.finditer(r'<link\b[^>]+rel\s*=\s*["\'](?:apple-touch-icon|icon|shortcut icon)["\'][^>]*>', raw, flags=re.I):
        tag_lnk = m_lnk.group(0)
        m_href = re.search(r'\bhref\s*=\s*["\']([^"\']+)["\']', tag_lnk, flags=re.I)
        if m_href:
            candidatos.append(m_href.group(1).strip())

    # 3. Fallback a og:image
    if og_image:
        candidatos.append(og_image.strip())

    headers_ua = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }

    fallback_logo_url = None
    for cand in candidatos[:5]:
        if not cand:
            continue
        if cand.startswith("data:image/"):
            if len(cand) < 550000:
                return None, cand
            continue

        abs_url = urllib.parse.urljoin(base_url, cand)
        es_segura, abs_norm, _ = _validar_url_ssrf_segura(abs_url)
        if not es_segura:
            continue
        if not fallback_logo_url:
            fallback_logo_url = abs_norm

        # Si aún tenemos presupuesto de tiempo, descargar el logo (< 500 KB) y convertir a base64
        if (time.time() - t_inicio) < 8.8:
            try:
                req_img = urllib.request.Request(abs_norm, headers=headers_ua)
                resp_ctx = (
                    opener.open(req_img, timeout=2.5)
                    if opener is not None
                    else urllib.request.urlopen(req_img, context=SSL_CTX, timeout=2.5)
                )
                with resp_ctx as resp_img:
                    ctype = (resp_img.headers.get("Content-Type") or "").split(";")[0].strip().lower()
                    if ctype.startswith(("text/", "application/json", "application/javascript")):
                        continue
                    raw_bytes = resp_img.read(500 * 1024 + 1)
                    if 100 < len(raw_bytes) <= 500 * 1024:
                        head_low = raw_bytes[:120].lstrip().lower()
                        if head_low.startswith((b"<!doctype", b"<html")):
                            continue
                        if not ctype.startswith("image/"):
                            if abs_norm.lower().endswith(".png"):
                                ctype = "image/png"
                            elif abs_norm.lower().endswith((".jpg", ".jpeg")):
                                ctype = "image/jpeg"
                            elif abs_norm.lower().endswith(".webp"):
                                ctype = "image/webp"
                            elif abs_norm.lower().endswith(".svg") or b"<svg" in head_low:
                                ctype = "image/svg+xml"
                            elif abs_norm.lower().endswith(".ico"):
                                ctype = "image/x-icon"
                            else:
                                ctype = "image/png"
                        b64_str = base64.b64encode(raw_bytes).decode("ascii")
                        return abs_norm, f"data:{ctype};base64,{b64_str}"
            except Exception:
                continue

    return fallback_logo_url, None


def _sitio_principal_es_espanol(html_raw: str, info_main: dict) -> bool:
    head_lang = re.search(r'<html[^>]+lang\s*=\s*["\']([^"\']+)["\']', str(html_raw or "")[:1200], flags=re.I)
    if head_lang and head_lang.group(1).lower().startswith("es"):
        return True
    sample = _quitar_acentos_visual(
        f"{info_main.get('title', '')} {info_main.get('meta_desc', '')} {info_main.get('texto', '')[:1200]}".lower()
    )
    es_tokens = re.findall(r"\b(?:servicios|nosotros|empresas|soluciones|consultoria|soporte|mexico|redes|para|con|mas|productos|clientes|contacto)\b", sample)
    return len(es_tokens) >= 2


def _es_subpagina_plantilla_ingles(sub_url: str, sub_info: dict, sitio_es_espanol: bool) -> bool:
    if not sitio_es_espanol:
        return False
    path_low = (urllib.parse.urlparse(sub_url).path or "").lower()
    txt_low = _quitar_acentos_visual(
        f"{sub_info.get('title', '')} {' '.join(sub_info.get('headings', [])[:6])} {sub_info.get('texto', '')[:1200]}".lower()
    )
    # Palabras clásicas de plantillas demo en inglés (Astra/Elementor/WordPress)
    palabras_plantilla = ("plumbing", "hvac", "lorem ipsum", "dolor sit amet", "consectetur adipiscing", "roofing", "handyman", "sample page")
    if any(w in txt_low for w in palabras_plantilla):
        return True
    rutas_en = ("/services/", "/services", "/about/", "/about", "/home/", "/home", "/sample-page")
    if any(path_low.rstrip("/") == r.rstrip("/") for r in rutas_en):
        en_hits = len(re.findall(r"\b(?:services|about|contact|plumbing|heating|cooling|welcome|learn more|get started|our team)\b", txt_low))
        es_hits = len(re.findall(r"\b(?:servicios|nosotros|empresa|soluciones|soporte|contacto|clientes|mexico)\b", txt_low))
        if en_hits > es_hits:
            return True
    return False


def _construir_frentes_fallback(nombre_sitio: str, headings: list, giro_txt: str, cli_tipo: str, mod_ent: str) -> list:
    candidatos = []
    vistos = set()
    for h in headings:
        h_clean = re.sub(r"\s+", " ", str(h or "")).strip(" -|•:")
        if len(h_clean) < 4 or len(h_clean) > 65:
            continue
        low = _quitar_acentos_visual(h_clean.lower())
        if any(bad in low for bad in ("plumbing", "hvac", "lorem", "welcome", "inicio", "home", "contacto", "menu", "cookie", "privacy")):
            continue
        if low in vistos:
            continue
        vistos.add(low)
        candidatos.append(h_clean)
        if len(candidatos) >= 4:
            break

    if len(candidatos) < 3:
        defaults = [
            f"Empresas y Oficinas ({giro_txt[:28]})",
            f"Pymes y Comercios Locales",
            f"Proyectos e Instalaciones Corporativas",
        ]
        for d in defaults:
            if len(candidatos) >= 3:
                break
            candidatos.append(d)

    frentes = []
    for idx, c_nom in enumerate(candidatos[:4]):
        es_b2b = cli_tipo in ("empresas_b2b", "ambos") or mod_ent == "servicio_en_sitio"
        kws = f"{c_nom}, empresas, oficinas, negocios" if es_b2b else f"{c_nom}, comercios, clientes"
        ticket = "$8,000 - $35,000 MXN" if mod_ent == "servicio_en_sitio" else "$2,500 - $12,000 MXN"
        angulo = (
            f"Ofrecer diagnóstico o cotización de {c_nom} con {nombre_sitio}, resaltando soporte profesional y respuesta rápida."
        )
        frentes.append({
            "nombre_frente": c_nom[:58],
            "keywords_busqueda": kws[:120],
            "ticket_estimado": ticket,
            "angulo_andrea": angulo[:240],
        })
    return frentes


def extraer_conocimiento_web_ia(raw_url: str) -> tuple[int, dict]:
    t_inicio = time.time()
    es_segura, url_norm, err_ssrf = _validar_url_ssrf_segura(raw_url)
    if not es_segura:
        return 400, {"ok": False, "error": err_ssrf}

    headers_nav = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
    }

    safe_opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=SSL_CTX),
        _SafeRedirectHandler(),
    )

    html_principal = ""
    final_url = url_norm
    try:
        req = urllib.request.Request(url_norm, headers=headers_nav)
        with safe_opener.open(req, timeout=7.5) as resp:
            final_url = resp.geturl() or url_norm
            es_seg_final, _, err_red = _validar_url_ssrf_segura(final_url)
            if not es_seg_final:
                return 400, {"ok": False, "error": err_red}
            html_principal = _leer_respuesta_html_segura(resp, 450 * 1024)
    except urllib.error.HTTPError as e_http:
        return 400, {"ok": False, "error": f"El sitio web respondió con código HTTP {e_http.code}. Verifica la URL."}
    except Exception as e_net:
        return 400, {"ok": False, "error": f"No se pudo conectar al sitio web ({str(e_net)[:90]})."}

    info_main = _limpiar_html_a_texto_estructurado(html_principal)
    sitio_es = _sitio_principal_es_espanol(html_principal, info_main)
    parsed_base = urllib.parse.urlparse(final_url)
    host_base = (parsed_base.hostname or "").lower()

    # Detectar enlaces internos relevantes priorizando rutas en español cuando el sitio está en español
    subpaginas_texto = []
    patron_es = re.compile(
        r"(servicios|servicio|nosotros|soluciones|productos|catalogo|redes|cctv|soporte|telefonia|poliza|aspel|asesoria|capacitacion|instalacion|cotiza|paquete)",
        flags=re.I,
    )
    patron_en = re.compile(r"(service|pricing|plan|product|shop|about)", flags=re.I)
    enlaces_es = []
    enlaces_otros = []
    for m_a in re.finditer(r'<a\b[^>]+href\s*=\s*["\']([^"\'#]+)["\']', html_principal, flags=re.I):
        href = m_a.group(1).strip()
        if not href or href.lower().startswith(("mailto:", "tel:", "javascript:", "whatsapp:")):
            continue
        abs_link = urllib.parse.urljoin(final_url, href)
        p_link = urllib.parse.urlparse(abs_link)
        if (p_link.hostname or "").lower() != host_base:
            continue
        if abs_link.rstrip("/") == final_url.rstrip("/"):
            continue
        p_path = p_link.path or ""
        if sitio_es and re.match(r"^/(services|about|home)/?$", p_path, flags=re.I):
            continue
        if patron_es.search(p_path):
            if abs_link not in enlaces_es:
                enlaces_es.append(abs_link)
        elif patron_en.search(p_path):
            if abs_link not in enlaces_otros:
                enlaces_otros.append(abs_link)
        if len(enlaces_es) >= 6:
            break

    enlaces_candidatos = (enlaces_es + enlaces_otros)[:6]

    for sub_url in enlaces_candidatos:
        if len(subpaginas_texto) >= 3 or (time.time() - t_inicio) >= 7.0:
            break
        ok_sub, sub_norm, _ = _validar_url_ssrf_segura(sub_url)
        if not ok_sub:
            continue
        try:
            req_sub = urllib.request.Request(sub_norm, headers=headers_nav)
            with safe_opener.open(req_sub, timeout=2.0) as resp_sub:
                sub_html = _leer_respuesta_html_segura(resp_sub, 220 * 1024)
                info_sub = _limpiar_html_a_texto_estructurado(sub_html)
                if _es_subpagina_plantilla_ingles(sub_norm, info_sub, sitio_es):
                    continue
                if info_sub["texto"]:
                    subpaginas_texto.append(
                        f"[Subpágina {sub_norm}]: Encabezados: {' | '.join(info_sub['headings'][:6])}. Texto: {info_sub['texto'][:1200]}"
                    )
                for pr in info_sub["precios"]:
                    if pr not in info_main["precios"]:
                        info_main["precios"].append(pr)
                for hd in info_sub["headings"]:
                    if hd not in info_main["headings"] and len(info_main["headings"]) < 24:
                        info_main["headings"].append(hd)
        except Exception:
            continue

    logo_url, logo_data_url = _extraer_logo_de_html(
        html_principal, final_url, info_main.get("og_image") or "", t_inicio, opener=safe_opener
    )

    nombre_sitio = (
        info_main.get("og_site")
        or (info_main.get("title") or "").split("|")[0].split("—")[0].split("-")[0].strip()
        or host_base.replace("www.", "").split(".")[0].capitalize()
    )
    if len(nombre_sitio.strip(" .-")) < 2:
        nombre_sitio = host_base.replace("www.", "").split(".")[0].upper()
    nombre_sitio = nombre_sitio[:60]

    contexto_consolidado = (
        f"URL: {final_url}\n"
        f"Nombre detectado: {nombre_sitio}\n"
        f"Título: {info_main.get('title')}\n"
        f"Descripción Meta: {info_main.get('meta_desc')}\n"
        f"Encabezados principales: {' | '.join(info_main.get('headings', [])[:14])}\n"
        f"Precios detectados: {', '.join(info_main.get('precios', [])[:10]) or 'Cotización personalizada'}\n"
        f"Contenido página principal: {info_main.get('texto', '')[:2600]}\n"
        + ("\n".join(subpaginas_texto)[:2200] if subpaginas_texto else "")
    )

    # Heuristic fallback por si Gemini agota presupuesto de 12s
    texto_low = _quitar_acentos_visual(contexto_consolidado.lower())
    es_servicio_sitio = any(
        w in texto_low
        for w in (
            "instalacion",
            "cableado",
            "redes",
            "cctv",
            "mantenimiento",
            "consultoria",
            "levantamiento",
            "soporte",
            "ingenieria",
            "servicio tecnico",
            "corporativo",
            "proyectos",
            "aspel",
            "poliza",
            "capacitacion",
        )
    )
    es_personalizado = any(
        w in texto_low
        for w in ("personaliz", "a medida", "3d", "bajo pedido", "diseno personalizado", "cotiza tu")
    )
    es_b2b = es_servicio_sitio or any(
        w in texto_low for w in ("empresas", "corporativo", "industrial", "mayoreo", "distribuidor", "b2b", "oficinas")
    )

    cli_fallback = "empresas_b2b" if es_b2b else "consumidor_final"
    mod_fallback = (
        "servicio_en_sitio"
        if es_servicio_sitio
        else ("personalizado_bajo_pedido" if es_personalizado else "catalogo_estandar")
    )
    vol_fallback = "proyecto" if es_servicio_sitio else ("mayoreo" if "mayoreo" in texto_low else "menudeo")

    desc_base = (
        info_main.get("meta_desc")
        or " | ".join(info_main.get("headings", [])[:4])
        or info_main.get("title")
        or nombre_sitio
    ).strip()
    desc_base = re.sub(
        r"^(?:nosotros\s+|en\s+[\w\s]+)?(?:somos|ofrecemos|hacemos|vendemos|realizamos|brindamos)\s+",
        "",
        desc_base,
        flags=re.I,
    ).strip()
    desc_base = desc_base[:230].rsplit(" ", 1)[0] if len(desc_base) > 230 else desc_base
    if desc_base and nombre_sitio.lower() not in desc_base.lower():
        descripcion_fallback = f"{nombre_sitio}: {desc_base}."[:340]
    else:
        descripcion_fallback = (desc_base or nombre_sitio)[:340]

    headings_limpios = [h for h in info_main.get("headings", []) if len(h) >= 6][:6]
    beneficios_fallback = (
        headings_limpios[:3]
        if len(headings_limpios) >= 3
        else [
            "Atención profesional y garantía de calidad",
            "Cotización rápida por WhatsApp 24/7",
            "Cobertura y entrega puntual garantizada",
        ]
    )
    beneficios_fallback = [b[:60] for b in beneficios_fallback[:3]]

    catalogo_fallback = (
        f"BASE DE CONOCIMIENTO EXTRAÍDA DE {final_url}:\n"
        f"• Negocio: {nombre_sitio}\n"
        f"• Resumen Comercial: {descripcion_fallback}\n"
        f"• Servicios / Productos Detectados: {' | '.join(info_main.get('headings', [])[:10]) or descripcion_fallback}\n"
        f"• Precios Referenciales: {', '.join(info_main.get('precios', [])[:8]) or 'Cotización según alcance o pedido'}\n"
        f"• Instrucción para Andrea IA: Atiende dudas técnicas o de catálogo con base en estos servicios, califica el requerimiento del cliente y solicita sus datos para cerrar pedido o agendar visita técnica."
    )[:2400]

    titular_fallback = (info_main.get("headings", [nombre_sitio])[0] if info_main.get("headings") else nombre_sitio).upper()[:46]
    frentes_fallback = _construir_frentes_fallback(
        nombre_sitio,
        info_main.get("headings", []),
        descripcion_fallback,
        cli_fallback,
        mod_fallback,
    )

    resultado_base = {
        "ok": True,
        "url_analizada": final_url,
        "nombre_negocio": nombre_sitio,
        "descripcion_idea": descripcion_fallback,
        "catalogo_andrea": catalogo_fallback,
        "cliente_objetivo_tipo": cli_fallback,
        "modalidad_entrega": mod_fallback,
        "volumen_compra": vol_fallback,
        "logo_url": logo_url,
        "logo_data_url": logo_data_url,
        "titular_anuncio": titular_fallback,
        "beneficios_clave": beneficios_fallback,
        "frentes_caza": frentes_fallback,
    }

    llaves = obtener_llaves_ia_backend()
    if not llaves or (time.time() - t_inicio) >= 9.5:
        return 200, resultado_base

    prompt_web = (
        "Eres un Analista Comercial Senior de BLITZR. Analiza el contenido extraído del sitio web del usuario "
        "y sintetiza toda su oferta comercial en ESPAÑOL para configurar automáticamente su embudo de ventas, su agente Andrea IA y sus frentes de prospección.\n\n"
        f"DATOS EXTRAÍDOS DEL SITIO WEB:\n{contexto_consolidado}\n\n"
        "REGLAS ESTRICTAS:\n"
        "1. 'descripcion_idea': Resumen comercial claro y natural en español en 2 a 3 líneas (máx 320 caracteres) de qué ofrece la empresa, SIN verbos en primera persona al inicio (NO empieces con 'Somos', 'Vendemos', 'Hacemos'; empieza directo con el servicio o producto).\n"
        "2. 'catalogo_andrea': Base de conocimiento estructurada en español para que la IA Andrea responda en WhatsApp: incluye lista de servicios/productos detectados, precios o paquetes si aparecen, forma de trabajo y las 3 preguntas clave que Andrea debe hacer para cotizar o cerrar.\n"
        "3. Clasifica con precisión:\n"
        "   - 'cliente_objetivo_tipo': 'consumidor_final' | 'empresas_b2b' | 'ambos'\n"
        "   - 'modalidad_entrega': 'catalogo_estandar' | 'personalizado_bajo_pedido' | 'servicio_en_sitio'\n"
        "   - 'volumen_compra': 'menudeo' | 'mayoreo' | 'proyecto'\n"
        "4. 'titular_anuncio': Titular publicitario de alto impacto en MAYÚSCULAS (máx 44 caracteres) para el póster 1080x1350.\n"
        "5. 'beneficios_clave': Array de exactamente 3 puntos cortos y contundentes (máx 52 caracteres cada uno) con los diferenciadores o servicios clave.\n"
        "6. 'frentes_caza': Array de 3 a 4 líneas de prospección B2B/comercial reales extraídas del sitio, cada una con:\n"
        "   - 'nombre_frente': Nombre corto de la línea de negocio/servicio (ej. 'Redes y Cableado Estructurado', 'Cámaras CCTV Empresarial')\n"
        "   - 'keywords_busqueda': 3 a 5 palabras clave en español para buscar prospectos en Google Maps/INEGI (ej. 'oficinas corporativas, clinicas, escuelas, despachos')\n"
        "   - 'ticket_estimado': Rango estimado en MXN (ej. '$12,000 - $45,000 MXN')\n"
        "   - 'angulo_andrea': Qué debe destacar Andrea al abrir conversación para este frente (máx 180 caracteres).\n\n"
        "Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown) con estas llaves exactas:\n"
        "{\n"
        '  "nombre_negocio": "string",\n'
        '  "descripcion_idea": "string",\n'
        '  "catalogo_andrea": "string",\n'
        '  "cliente_objetivo_tipo": "consumidor_final" | "empresas_b2b" | "ambos",\n'
        '  "modalidad_entrega": "catalogo_estandar" | "personalizado_bajo_pedido" | "servicio_en_sitio",\n'
        '  "volumen_compra": "menudeo" | "mayoreo" | "proyecto",\n'
        '  "titular_anuncio": "string",\n'
        '  "beneficios_clave": ["beneficio 1", "beneficio 2", "beneficio 3"],\n'
        '  "frentes_caza": [{"nombre_frente": "string", "keywords_busqueda": "string", "ticket_estimado": "string", "angulo_andrea": "string"}]\n'
        "}"
    )

    payload_ia = {
        "contents": [{"role": "user", "parts": [{"text": prompt_web}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1200,
            "responseMimeType": "application/json",
        },
    }

    for modelo in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-2.5-flash"]:
        for key in llaves[:2]:
            restante = 11.5 - (time.time() - t_inicio)
            if restante <= 1.2:
                return 200, resultado_base
            url_api = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={key}"
            try:
                req_ia = urllib.request.Request(
                    url_api,
                    data=json.dumps(payload_ia).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req_ia, context=SSL_CTX, timeout=min(5.0, max(1.3, restante))) as resp_ia:
                    res_json = json.loads(resp_ia.read().decode("utf-8"))
                    txt_ia = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                    m_obj = re.search(r"\{[\s\S]*\}", txt_ia)
                    if not m_obj:
                        continue
                    parsed_ia = json.loads(m_obj.group(0))

                    cli_ia = str(parsed_ia.get("cliente_objetivo_tipo") or cli_fallback).strip().lower()
                    if cli_ia not in ("consumidor_final", "empresas_b2b", "ambos"):
                        cli_ia = cli_fallback

                    mod_ia = str(parsed_ia.get("modalidad_entrega") or mod_fallback).strip().lower()
                    if mod_ia not in ("catalogo_estandar", "personalizado_bajo_pedido", "servicio_en_sitio"):
                        mod_ia = mod_fallback

                    vol_ia = str(parsed_ia.get("volumen_compra") or vol_fallback).strip().lower()
                    if vol_ia not in ("menudeo", "mayoreo", "proyecto"):
                        vol_ia = vol_fallback

                    bens_ia = parsed_ia.get("beneficios_clave")
                    if not isinstance(bens_ia, list) or len(bens_ia) == 0:
                        bens_ia = beneficios_fallback
                    bens_clean = [str(b).strip()[:60] for b in bens_ia if str(b).strip()][:3]
                    while len(bens_clean) < 3:
                        bens_clean.append(beneficios_fallback[len(bens_clean) % len(beneficios_fallback)])

                    frentes_raw = parsed_ia.get("frentes_caza")
                    frentes_clean = []
                    if isinstance(frentes_raw, list):
                        for fr in frentes_raw[:4]:
                            if not isinstance(fr, dict):
                                continue
                            nf = str(fr.get("nombre_frente") or "").strip()[:60]
                            kf = str(fr.get("keywords_busqueda") or "").strip()[:140]
                            tf = str(fr.get("ticket_estimado") or "").strip()[:60]
                            af = str(fr.get("angulo_andrea") or "").strip()[:240]
                            if nf and kf:
                                frentes_clean.append({
                                    "nombre_frente": nf,
                                    "keywords_busqueda": kf,
                                    "ticket_estimado": tf or "$5,000 - $25,000 MXN",
                                    "angulo_andrea": af or f"Ofrecer solución en {nf} para su empresa.",
                                })
                    if not frentes_clean:
                        frentes_clean = frentes_fallback

                    desc_ia = str(parsed_ia.get("descripcion_idea") or descripcion_fallback).strip()
                    cat_ia = str(parsed_ia.get("catalogo_andrea") or catalogo_fallback).strip()[:2400]
                    tit_ia = str(parsed_ia.get("titular_anuncio") or titular_fallback).strip().upper()[:48]
                    nom_ia = str(parsed_ia.get("nombre_negocio") or nombre_sitio).strip()[:60]

                    return 200, {
                        "ok": True,
                        "url_analizada": final_url,
                        "nombre_negocio": nom_ia,
                        "descripcion_idea": desc_ia,
                        "catalogo_andrea": cat_ia,
                        "cliente_objetivo_tipo": cli_ia,
                        "modalidad_entrega": mod_ia,
                        "volumen_compra": vol_ia,
                        "logo_url": logo_url,
                        "logo_data_url": logo_data_url,
                        "titular_anuncio": tit_ia,
                        "beneficios_clave": bens_clean,
                        "frentes_caza": frentes_clean,
                    }
            except Exception:
                continue

    return 200, resultado_base


def obtener_nicho_bd(cliente_id: str = "mallas_tlaxcalli") -> dict:
    cid = motor_m1.normalizar_cliente_id(cliente_id)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
               codigo_scian_inegi, keywords_busqueda, oferta_gancho,
               catalogo_y_reglas, system_prompt, saludos_frio_json,
               municipios_json, protegido, activo, fecha_creacion,
               COALESCE(modelo_negocio, 'DISTRIBUIDOR_B2B'), COALESCE(diagnostico_ia, '{}'),
               COALESCE(zonas_objetivo, 'CDMX y Area Metropolitana'),
               COALESCE(flujo_continuo_activo, 1)
        FROM perfiles_nicho
        WHERE LOWER(cliente_id) = LOWER(?)
        LIMIT 1
    """, (cid,))
    row = cur.fetchone()
    if not row and cid != "mallas_tlaxcalli":
        cur.execute("""
            SELECT cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
                   codigo_scian_inegi, keywords_busqueda, oferta_gancho,
                   catalogo_y_reglas, system_prompt, saludos_frio_json,
                   municipios_json, protegido, activo, fecha_creacion,
                   COALESCE(modelo_negocio, 'DISTRIBUIDOR_B2B'), COALESCE(diagnostico_ia, '{}'),
                   COALESCE(zonas_objetivo, 'CDMX y Area Metropolitana'),
                   COALESCE(flujo_continuo_activo, 1)
            FROM perfiles_nicho
            WHERE cliente_id = 'mallas_tlaxcalli'
            LIMIT 1
        """)
        row = cur.fetchone()
    conn.close()
    if not row:
        return {
            "cliente_id": "mallas_tlaxcalli",
            "nombre_negocio": "Mallas Tlaxcalli",
            "nombre_agente": "Andrea / Paola",
            "giro_objetivo": "Tortillerías, Molinos de Nixtamal y Mecánicos de Maquinaria Tortilladora",
            "codigo_scian_inegi": "311830",
            "keywords_busqueda": "tortilleria, molino de nixtamal, maquinas tortilladoras",
            "oferta_gancho": "PAQUETE_MALLAS_1713",
            "catalogo_y_reglas": "",
            "system_prompt": cargar_system_prompt(),
            "protegido": True,
            "activo": True,
            "modelo_negocio": "DISTRIBUIDOR_B2B",
            "diagnostico_ia": {},
            "zonas_objetivo": "CDMX y Area Metropolitana",
            "flujo_continuo_activo": 1,
        }
    try:
        munis = json.loads(row[10] or "[]")
    except Exception:
        munis = []
    try:
        diag_obj = json.loads(row[15] or "{}") if isinstance(row[15], str) else (row[15] or {})
    except Exception:
        diag_obj = {}
    es_tlax = (str(row[0]).lower() == "mallas_tlaxcalli")
    return {
        "cliente_id": row[0],
        "nombre_negocio": row[1],
        "nombre_agente": row[2] or "Andrea",
        "giro_objetivo": row[3] or "",
        "codigo_scian_inegi": row[4] or "",
        "keywords_busqueda": row[5] or "",
        "oferta_gancho": row[6] or "",
        "catalogo_y_reglas": row[7] or "",
        "system_prompt": row[8] or "",
        "saludos_frio_json": row[9] or "[]",
        "municipios": munis,
        "protegido": bool(row[11]),
        "activo": bool(row[12]),
        "fecha_creacion": row[13] or "",
        "modelo_negocio": "DISTRIBUIDOR_B2B" if es_tlax else normalizar_modelo_negocio(row[14]),
        "diagnostico_ia": diag_obj,
        "zonas_objetivo": row[16] if len(row) > 16 and row[16] else "CDMX y Area Metropolitana",
        "flujo_continuo_activo": int(row[17]) if len(row) > 17 and row[17] is not None else 1,
    }


def construir_perfil_motor_desde_nicho(cliente_id: str = "mallas_tlaxcalli") -> dict:
    cid = motor_m1.normalizar_cliente_id(cliente_id)
    with open(PERFIL_PATH, "r", encoding="utf-8") as f:
        perfil_base = json.load(f)
    if cid == "mallas_tlaxcalli":
        perfil_base["id_cliente"] = "mallas_tlaxcalli"
        return perfil_base

    nicho = obtener_nicho_bd(cid)
    kws = [k.strip() for k in re.split(r"[,;\n]+", nicho.get("keywords_busqueda") or "") if k.strip()]
    if not kws and nicho.get("giro_objetivo"):
        kws = [nicho["giro_objetivo"].strip()]

    perfil_custom = json.loads(json.dumps(perfil_base))
    perfil_custom["id_cliente"] = nicho["cliente_id"]
    perfil_custom["nombre_empresa"] = nicho["nombre_negocio"]
    perfil_custom["giro_objetivo"] = nicho["giro_objetivo"]
    perfil_custom["oferta_gancho"] = nicho["oferta_gancho"]
    perfil_custom["busqueda"] = {
        "giro_principal": nicho["giro_objetivo"],
        "palabras_clave_maps": kws,
        "codigo_scian_inegi": nicho.get("codigo_scian_inegi", ""),
        "pais": "mx"
    }
    if nicho.get("municipios"):
        perfil_custom["cobertura_logistica"]["municipios_edomex_autorizados"] = nicho["municipios"]
    perfil_custom["reglas_clasificacion_oferta"] = {
        "palabras_clave_mayoreo": ["mayoreo", "distribuidor", "proveedor", "taller"],
        "oferta_menudeo": nicho.get("oferta_gancho") or f"Oferta Especial {nicho['nombre_negocio']}",
        "oferta_mayoreo": nicho.get("oferta_gancho") or f"Mayoreo {nicho['nombre_negocio']}"
    }
    return perfil_custom


def obtener_lista_nichos_con_metricas() -> list:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')), COUNT(*)
        FROM prospectos_cazador
        WHERE estatus_clasificacion LIKE 'APROBADO%'
        GROUP BY LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli'))
    """)
    conteo_prosp = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("""
        SELECT LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')), COUNT(*)
        FROM bitacora_envios_wa
        GROUP BY LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli'))
    """)
    conteo_bit = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("""
        SELECT cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
               codigo_scian_inegi, keywords_busqueda, oferta_gancho,
               catalogo_y_reglas, protegido, activo, fecha_creacion,
               COALESCE(modelo_negocio, 'DISTRIBUIDOR_B2B'), COALESCE(diagnostico_ia, '{}'),
               COALESCE(zonas_objetivo, 'CDMX y Area Metropolitana'),
               COALESCE(flujo_continuo_activo, 1)
        FROM perfiles_nicho
        ORDER BY protegido DESC, fecha_creacion ASC
    """)
    filas = cur.fetchall()
    conn.close()

    nichos = []
    for r in filas:
        cid = r[0]
        es_tlax = (str(cid).lower() == "mallas_tlaxcalli")
        try:
            diag_obj = json.loads(r[12] or "{}") if isinstance(r[12], str) else (r[12] or {})
        except Exception:
            diag_obj = {}
        nichos.append({
            "cliente_id": cid,
            "nombre_negocio": r[1],
            "nombre_agente": r[2] or "Andrea",
            "giro_objetivo": r[3] or "",
            "codigo_scian_inegi": r[4] or "",
            "keywords_busqueda": r[5] or "",
            "oferta_gancho": r[6] or "",
            "catalogo_y_reglas": r[7] or "",
            "protegido": bool(r[8]),
            "activo": bool(r[9]),
            "fecha_creacion": r[10] or "",
            "modelo_negocio": "DISTRIBUIDOR_B2B" if es_tlax else normalizar_modelo_negocio(r[11]),
            "diagnostico_ia": diag_obj,
            "zonas_objetivo": r[13] if len(r) > 13 and r[13] else "CDMX y Area Metropolitana",
            "flujo_continuo_activo": int(r[14]) if len(r) > 14 and r[14] is not None else 1,
            "total_prospectos": conteo_prosp.get(cid.lower(), 0),
            "enviados_wa": conteo_bit.get(cid.lower(), 0)
        })
    return nichos


def resolver_cliente_id_por_telefono_o_sesion(session_id: str, cliente_id_explicito: str = "") -> str:
    if cliente_id_explicito and str(cliente_id_explicito).strip():
        return motor_m1.normalizar_cliente_id(cliente_id_explicito)
    digs = re.sub(r"\D", "", str(session_id or ""))
    if len(digs) >= 10:
        ult10 = digs[-10:]
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("""
                SELECT COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')
                FROM prospectos_cazador
                WHERE telefono LIKE ?
                ORDER BY CASE WHEN fecha_ultimo_wa IS NOT NULL AND fecha_ultimo_wa != '' THEN 0 ELSE 1 END,
                         fecha_ultimo_wa DESC, id DESC
                LIMIT 1
            """, (f"%{ult10}",))
            row = cur.fetchone()
            conn.close()
            if row and row[0]:
                return motor_m1.normalizar_cliente_id(row[0])
        except Exception:
            pass
    return motor_m1.normalizar_cliente_id(leer_config("nicho_activo_default", "mallas_tlaxcalli"))


def obtener_nicho_por_email(email_raw: str) -> dict | None:
    email_norm = str(email_raw or "").strip().lower()
    if not email_norm:
        return None

    todos = obtener_lista_nichos_con_metricas()
    mapa_metricas = {n["cliente_id"].lower(): n for n in todos}

    if email_norm == OWNER_EMAIL_MALLAS:
        base_mallas = mapa_metricas.get("mallas_tlaxcalli") or obtener_nicho_bd("mallas_tlaxcalli")
        base_mallas["owner_email"] = OWNER_EMAIL_MALLAS
        base_mallas["es_mallas"] = True
        base_mallas["tiene_perfil"] = True
        base_mallas["modelo_negocio"] = "DISTRIBUIDOR_B2B"
        return base_mallas

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
               codigo_scian_inegi, keywords_busqueda, oferta_gancho,
               catalogo_y_reglas, system_prompt, protegido, activo,
               fecha_creacion, COALESCE(owner_email, ''),
               COALESCE(modelo_negocio, 'DISTRIBUIDOR_B2B'), COALESCE(diagnostico_ia, '{}'),
               COALESCE(zonas_objetivo, 'CDMX y Area Metropolitana'),
               COALESCE(flujo_continuo_activo, 1)
        FROM perfiles_nicho
        WHERE LOWER(TRIM(COALESCE(owner_email, ''))) = ?
          AND LOWER(cliente_id) != 'mallas_tlaxcalli'
        LIMIT 1
    """, (email_norm,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None

    cid = row[0]
    m_info = mapa_metricas.get(cid.lower(), {})
    try:
        diag_obj = json.loads(row[14] or "{}") if isinstance(row[14], str) else (row[14] or {})
    except Exception:
        diag_obj = {}
    return {
        "cliente_id": cid,
        "nombre_negocio": row[1],
        "nombre_agente": row[2] or "Andrea",
        "giro_objetivo": row[3] or "",
        "codigo_scian_inegi": row[4] or "",
        "keywords_busqueda": row[5] or "",
        "oferta_gancho": row[6] or "",
        "catalogo_y_reglas": row[7] or "",
        "system_prompt": row[8] or "",
        "protegido": bool(row[9]),
        "activo": bool(row[10]),
        "fecha_creacion": row[11] or "",
        "owner_email": row[12] or email_norm,
        "modelo_negocio": normalizar_modelo_negocio(row[13]),
        "diagnostico_ia": diag_obj,
        "zonas_objetivo": row[15] if len(row) > 15 and row[15] else "CDMX y Area Metropolitana",
        "flujo_continuo_activo": int(row[16]) if len(row) > 16 and row[16] is not None else 1,
        "es_mallas": False,
        "tiene_perfil": True,
        "total_prospectos": m_info.get("total_prospectos", 0),
        "enviados_wa": m_info.get("enviados_wa", 0)
    }


def _construir_catalogo_base_por_modelo(
    modelo_negocio: str,
    nombre_negocio: str,
    giro_objetivo: str,
    oferta_gancho: str,
    idea_base: str,
    modalidad_entrega: str = ""
) -> str:
    mod = normalizar_modelo_negocio(modelo_negocio)
    mod_ent = str(modalidad_entrega or "").strip().lower()
    idea_low = f"{idea_base} {giro_objetivo}".lower()
    es_personalizado = (
        mod_ent == "personalizado_bajo_pedido"
        or any(w in idea_low for w in ("personaliz", "3d", "medida", "diseno", "diseño", "custom", "pedido", "figura"))
    )

    if mod == "SERVICIOS_B2B":
        return (
            f"Negocio de Servicios B2B: {nombre_negocio}.\n"
            f"Clientes Objetivo: {giro_objetivo}.\n"
            f"Propuesta Técnica / Oferta: {oferta_gancho}.\n"
            f"Descripción del Servicio: {idea_base}\n"
            "FLUJO CONSULTIVO DE CIERRE (SERVICIOS / INSTALACIONES):\n"
            "1. Identifica la necesidad técnica del cliente (tipo de inmueble/oficina, cantidad de nodos/equipos o alcance del servicio).\n"
            "2. Destaca garantía profesional, atención a empresas y diagnóstico técnico.\n"
            "3. Solicita los 4 datos para agendar levantamiento técnico o visita de instalación: Nombre de Empresa/Contacto, Alcance del Servicio, Ubicación del Sitio y Fecha/Horario de Visita."
        )[:2500]
    if mod == "EMPRENDEDOR_B2C":
        if es_personalizado:
            return (
                f"Negocio B2C (Personalizado / Bajo Pedido): {nombre_negocio}.\n"
                f"Clientes Objetivo: {giro_objetivo}.\n"
                f"Oferta / Gancho: {oferta_gancho}.\n"
                f"Detalles y Catálogo: {idea_base}\n"
                "FLUJO DE ATENCIÓN INBOUND PERSONALIZADO (CERO SPAM EN FRÍO):\n"
                "1. Atiende con calidez a los clientes que solicitan cotización de piezas o pedidos a medida.\n"
                "2. Pide detalles clave antes de cotizar: medidas, material o color deseado, diseño o archivo de referencia (ej. STL/vector/foto) y cantidad.\n"
                "3. Cotiza tiempos de elaboración y entrega, y cierra solicitando: Nombre del cliente, Dirección de entrega o punto de encuentro y Anticipo/Método de pago."
            )[:2500]
        return (
            f"Negocio B2C (Venta al Público / Catálogo): {nombre_negocio}.\n"
            f"Clientes Objetivo: {giro_objetivo}.\n"
            f"Promoción / Oferta Principal: {oferta_gancho}.\n"
            f"Catálogo y Detalles: {idea_base}\n"
            "FLUJO DE ATENCIÓN INBOUND (CERO SPAM EN FRÍO):\n"
            "1. Atiende con calidez a los clientes que llegan desde redes sociales, estados de WhatsApp o recomendaciones.\n"
            "2. Comparte beneficios, precios claros y disponibilidad de catálogo.\n"
            "3. Cierra el pedido solicitando: Nombre del cliente, Producto/Paquete elegido, Dirección o Punto de Entrega y Método de pago."
        )[:2500]
    return (
        f"Proveedor / Distribuidor B2B: {nombre_negocio}.\n"
        f"Giro de Negocios Clientes: {giro_objetivo}.\n"
        f"Oferta Mayorista / Paquete Gancho: {oferta_gancho}.\n"
        f"Detalles de Producto: {idea_base}\n"
        "FLUJO DE CIERRE MAYORISTA / B2B:\n"
        "1. Presenta el ahorro y beneficio directo para el negocio del cliente.\n"
        "2. Resuelve dudas de calidad, envío y forma de pago.\n"
        "3. Cierra el pedido pidiendo los 4 datos: Nombre del Negocio, Dirección de Entrega, Horario de Recepción y Método de Pago."
    )[:2500]


def guardar_nicho_por_email(owner_email_raw: str, data: dict) -> tuple[int, dict]:
    email_norm = str(owner_email_raw or "").strip().lower()
    if not email_norm or "@" not in email_norm:
        return 400, {"ok": False, "error": "Correo de propietario (owner_email) inválido."}

    req_cid = str(data.get("cliente_id") or "").strip().lower()
    if email_norm != OWNER_EMAIL_MALLAS and req_cid == "mallas_tlaxcalli":
        return 403, {
            "ok": False,
            "error": "Acceso denegado: El perfil mallas_tlaxcalli está protegido exclusivamente para su propietario."
        }

    if email_norm == OWNER_EMAIL_MALLAS:
        return 200, {
            "ok": True,
            "tiene_perfil": True,
            "es_mallas": True,
            "owner_email": OWNER_EMAIL_MALLAS,
            "nicho": obtener_nicho_por_email(OWNER_EMAIL_MALLAS)
        }

    existente = obtener_nicho_por_email(email_norm)
    if existente and existente.get("cliente_id") and existente["cliente_id"].lower() != "mallas_tlaxcalli":
        cid = existente["cliente_id"]
    else:
        user_slug = re.sub(r"[^a-z0-9]", "_", email_norm.split("@")[0])[:18].strip("_") or "tenant"
        short_hash = hashlib.md5(email_norm.encode("utf-8")).hexdigest()[:6]
        cid = f"nicho_{user_slug}_{short_hash}"

    nombre_negocio = str(
        data.get("nombre_negocio")
        or data.get("headline")
        or (existente or {}).get("nombre_negocio")
        or ""
    ).strip()[:80]
    raw_idea = str(data.get("productDesc") or data.get("idea") or data.get("catalogo_prompt") or "").strip()
    if not nombre_negocio and raw_idea:
        nombre_negocio = raw_idea.split(".")[0].split("\n")[0].strip()[:48] or "Mi Negocio"
    if not nombre_negocio:
        nombre_negocio = "Mi Negocio"

    nombre_agente = str(
        data.get("nombre_agente")
        or (existente or {}).get("nombre_agente")
        or "Andrea"
    ).strip() or "Andrea"

    diag_input = data.get("diagnostico_ia")
    if isinstance(diag_input, str):
        try:
            diag_obj = json.loads(diag_input)
        except Exception:
            diag_obj = {}
    elif isinstance(diag_input, dict):
        diag_obj = dict(diag_input)
    else:
        diag_obj = (existente or {}).get("diagnostico_ia") or {}

    cli_tipo = str(data.get("cliente_objetivo_tipo") or (diag_obj.get("cliente_objetivo_tipo") if isinstance(diag_obj, dict) else "") or "")
    mod_ent = str(data.get("modalidad_entrega") or (diag_obj.get("modalidad_entrega") if isinstance(diag_obj, dict) else "") or "")
    vol_com = str(data.get("volumen_compra") or (diag_obj.get("volumen_compra") if isinstance(diag_obj, dict) else "") or "")

    if not diag_obj and raw_idea:
        diag_obj = diagnosticar_modelo_heuristico(
            raw_idea,
            str(data.get("niche") or ""),
            str(data.get("objective") or ""),
            cliente_objetivo_tipo=cli_tipo,
            modalidad_entrega=mod_ent,
            volumen_compra=vol_com
        )

    if isinstance(diag_obj, dict):
        if cli_tipo:
            diag_obj["cliente_objetivo_tipo"] = cli_tipo
        if mod_ent:
            diag_obj["modalidad_entrega"] = mod_ent
        if vol_com:
            diag_obj["volumen_compra"] = vol_com
        if data.get("logo_url"):
            diag_obj["logo_url"] = str(data.get("logo_url"))[:600]
        if data.get("logo_data_url") and len(str(data.get("logo_data_url"))) <= 180000:
            diag_obj["logo_data_url"] = str(data.get("logo_data_url"))
        if data.get("url_sitio_web"):
            diag_obj["url_sitio_web"] = str(data.get("url_sitio_web"))[:400]
        if isinstance(data.get("beneficios_clave"), list):
            diag_obj["beneficios_clave"] = [str(b).strip()[:80] for b in data.get("beneficios_clave") if str(b).strip()][:3]
        if data.get("titular_anuncio"):
            diag_obj["titular_anuncio"] = str(data.get("titular_anuncio")).strip()[:80]

    modelo_raw = (
        data.get("modelo_negocio")
        or (diag_obj.get("modelo_recomendado") if isinstance(diag_obj, dict) else "")
        or (existente or {}).get("modelo_negocio")
        or "DISTRIBUIDOR_B2B"
    )
    modelo_negocio = normalizar_modelo_negocio(modelo_raw)

    giro_objetivo = str(
        data.get("giro_objetivo")
        or (diag_obj.get("clientes_objetivo") if isinstance(diag_obj, dict) and not data.get("giro_objetivo") else "")
        or data.get("niche")
        or (existente or {}).get("giro_objetivo")
        or "Comercios y Clientes Potenciales"
    ).strip()[:160]

    kws_diag = diag_obj.get("keywords_sugeridas") if isinstance(diag_obj, dict) else None
    keywords = str(
        data.get("keywords_busqueda")
        or (", ".join(kws_diag) if isinstance(kws_diag, list) and len(kws_diag) > 0 else "")
        or (existente or {}).get("keywords_busqueda")
        or ""
    ).strip()
    if not keywords:
        fuente_kw = f"{nombre_negocio} {giro_objetivo} {raw_idea[:120]}"
        palabras = [
            w for w in re.split(r"[^a-záéíóúñ0-9]+", fuente_kw.lower())
            if len(w) >= 4 and w not in ("para", "con", "los", "las", "una", "uno", "del", "por", "que", "como", "producto", "fisico", "servicio", "local", "venta", "inmediata")
        ]
        vistos_kw = []
        for p_kw in palabras:
            if p_kw not in vistos_kw:
                vistos_kw.append(p_kw)
        keywords = ", ".join(vistos_kw[:6]) or giro_objetivo

    codigo_scian = str(
        data.get("codigo_scian_inegi")
        or (existente or {}).get("codigo_scian_inegi")
        or ""
    ).strip()

    oferta_gancho = str(
        data.get("oferta_gancho")
        or data.get("irresistibleOffer")
        or (existente or {}).get("oferta_gancho")
        or raw_idea[:180]
        or f"Promoción especial de {nombre_negocio}"
    ).strip()[:240]

    catalogo_custom = str(
        data.get("catalogo_prompt")
        or data.get("catalogo_andrea")
        or data.get("catalogo_y_reglas")
        or ""
    ).strip()
    if catalogo_custom and len(catalogo_custom) >= 80:
        catalogo_reglas = catalogo_custom[:2500]
    else:
        catalogo_reglas = _construir_catalogo_base_por_modelo(
            modelo_negocio,
            nombre_negocio,
            giro_objetivo,
            oferta_gancho,
            catalogo_custom or raw_idea or (existente or {}).get("catalogo_y_reglas") or oferta_gancho,
            modalidad_entrega=mod_ent
        )

    system_prompt_custom = str(data.get("system_prompt") or "").strip()[:2500]
    diag_json_str = json.dumps(diag_obj if isinstance(diag_obj, dict) else {}, ensure_ascii=False)
    zonas_obj = str(data.get("zonas_objetivo") or (existente or {}).get("zonas_objetivo") or "CDMX y Area Metropolitana").strip()[:220]
    flujo_cont = int(data.get("flujo_continuo_activo") if data.get("flujo_continuo_activo") is not None else ((existente or {}).get("flujo_continuo_activo") if (existente or {}).get("flujo_continuo_activo") is not None else 1))

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO perfiles_nicho (
            cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
            codigo_scian_inegi, keywords_busqueda, oferta_gancho,
            catalogo_y_reglas, system_prompt, saludos_frio_json,
            municipios_json, protegido, activo, fecha_creacion, owner_email,
            modelo_negocio, diagnostico_ia, zonas_objetivo, flujo_continuo_activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', 0, 1, datetime('now'), ?, ?, ?, ?, ?)
        ON CONFLICT(cliente_id) DO UPDATE SET
            nombre_negocio = excluded.nombre_negocio,
            nombre_agente = excluded.nombre_agente,
            giro_objetivo = excluded.giro_objetivo,
            codigo_scian_inegi = excluded.codigo_scian_inegi,
            keywords_busqueda = excluded.keywords_busqueda,
            oferta_gancho = excluded.oferta_gancho,
            catalogo_y_reglas = excluded.catalogo_y_reglas,
            system_prompt = CASE WHEN excluded.system_prompt != '' THEN excluded.system_prompt ELSE perfiles_nicho.system_prompt END,
            owner_email = excluded.owner_email,
            modelo_negocio = excluded.modelo_negocio,
            diagnostico_ia = excluded.diagnostico_ia,
            zonas_objetivo = excluded.zonas_objetivo,
            flujo_continuo_activo = excluded.flujo_continuo_activo,
            activo = 1
        WHERE perfiles_nicho.protegido = 0
    """, (
        cid, nombre_negocio, nombre_agente, giro_objetivo,
        codigo_scian, keywords, oferta_gancho,
        catalogo_reglas, system_prompt_custom, email_norm,
        modelo_negocio, diag_json_str, zonas_obj, flujo_cont
    ))

    # Persistir frentes_caza iniciales para tenants != mallas_tlaxcalli
    frentes_input = data.get("frentes_caza")
    if not isinstance(frentes_input, list) and isinstance(diag_obj, dict):
        frentes_input = diag_obj.get("frentes_caza")
    cur.execute("SELECT COUNT(*) FROM frentes_caza WHERE LOWER(id_cliente_agencia) = LOWER(?)", (cid,))
    cnt_frentes = cur.fetchone()[0]
    if isinstance(frentes_input, list) and len(frentes_input) > 0:
        if cnt_frentes == 0 or bool(data.get("reemplazar_frentes")):
            if bool(data.get("reemplazar_frentes")):
                cur.execute("DELETE FROM frentes_caza WHERE LOWER(id_cliente_agencia) = LOWER(?)", (cid,))
            for fr in frentes_input[:6]:
                if not isinstance(fr, dict):
                    continue
                nf = str(fr.get("nombre_frente") or "").strip()[:80]
                kf = str(fr.get("keywords_busqueda") or keywords).strip()[:160]
                tf = str(fr.get("ticket_estimado") or "").strip()[:60]
                af = str(fr.get("angulo_andrea") or "").strip()[:260]
                if nf:
                    cur.execute(
                        "INSERT INTO frentes_caza (id_cliente_agencia, nombre_frente, keywords_busqueda, ticket_estimado, angulo_andrea, activo) VALUES (?, ?, ?, ?, ?, 1)",
                        (cid, nf, kf, tf, af),
                    )
    elif cnt_frentes == 0 and modelo_negocio in ("DISTRIBUIDOR_B2B", "SERVICIOS_B2B"):
        for nf_def, kf_def in [
            (f"Empresas y Oficinas ({giro_objetivo[:30]})", keywords or giro_objetivo),
            (f"Comercios y Pymes Locales", f"comercios, negocios, {keywords or giro_objetivo}"),
            (f"Proyectos / Instalaciones ({nombre_negocio[:24]})", f"oficinas, empresas, {giro_objetivo}"),
        ]:
            cur.execute(
                "INSERT INTO frentes_caza (id_cliente_agencia, nombre_frente, keywords_busqueda, ticket_estimado, angulo_andrea, activo) VALUES (?, ?, ?, ?, ?, 1)",
                (cid, nf_def[:75], kf_def[:140], "Cotización por alcance", f"Presentar {nf_def} de {nombre_negocio} y ofrecer diagnóstico sin costo."),
            )

    conn.commit()
    conn.close()

    nicho_actualizado = obtener_nicho_por_email(email_norm)
    return 200, {
        "ok": True,
        "tiene_perfil": True,
        "es_mallas": False,
        "owner_email": email_norm,
        "cliente_id": cid,
        "nicho": nicho_actualizado
    }


def resolver_contexto_tenant_request(email_raw: str = "", cliente_id_raw: str = "") -> tuple[str | None, dict | None, bool]:
    """
    Resuelve de forma estricta el tenant (cliente_id, nicho_dict, es_mallas) según owner_email.
    CANDADO DE AISLAMIENTO:
    - Si viene email != ferrergbryanu10@gmail.com, NUNCA hace fallback a mallas_tlaxcalli.
      Si ese email aún no tiene perfil en perfiles_nicho, devuelve (None, None, False).
    """
    email_norm = str(email_raw or "").strip().lower()
    cid_clean = str(cliente_id_raw or "").strip()

    if email_norm:
        if email_norm == OWNER_EMAIL_MALLAS:
            nicho_m = obtener_nicho_por_email(OWNER_EMAIL_MALLAS)
            return "mallas_tlaxcalli", nicho_m, True
        nicho_u = obtener_nicho_por_email(email_norm)
        if not nicho_u:
            return None, None, False
        return nicho_u["cliente_id"], nicho_u, False

    if cid_clean:
        if cid_clean == "__SIN_PERFIL__":
            return None, None, False
        cid_norm = motor_m1.normalizar_cliente_id(cid_clean)
        nicho_c = obtener_nicho_bd(cid_norm)
        return cid_norm, nicho_c, (cid_norm == "mallas_tlaxcalli")

    nicho_def = obtener_nicho_bd("mallas_tlaxcalli")
    return "mallas_tlaxcalli", nicho_def, True


# ==============================================================================
# 2. GESTOR DE CARPETA `imágenes negocio pau`
# ==============================================================================

def asegurar_tarjetas_muestra_pau():
    carpeta_base = os.path.join(BASE_DIR, "imagenes_negocio_pau")
    os.makedirs(carpeta_base, exist_ok=True)
    laminas = [
        (
            "Muestra_1_Paquete_Mallas_Tlaxcalli_1713.svg",
            "PAQUETE COMPLETO MALLAS TLAXCALLI ($1,713 MXN)",
            "1 Malla Testalera (23cm x 1.40m) + 1 Transportadora (10 pulg x 9m Cal 14) + 1 Balero 7210B",
            "#f59e0b"
        ),
        (
            "Muestra_2_Malla_Transportadora_y_Testalera.svg",
            "MALLAS DE ALTA RESISTENCIA CALIBRE 14",
            "Compatibles con Celorio, Verduzco, Reto, Tapsa, Lenin, Apolo y Tortimex (85% del mercado)",
            "#10b981"
        ),
        (
            "Muestra_3_Balero_7210B_Aleman.svg",
            "BALERO 7210B CONTACTO ANGULAR (JAULA DE FIERRO)",
            "Registro Aleman para Reductor Principal • Envio GRATIS • Pago Contra Entrega",
            "#38bdf8"
        )
    ]
    for fname, titulo, sub, color in laminas:
        ruta = os.path.join(carpeta_base, fname)
        if not os.path.exists(ruta):
            svg = (
                f'<svg xmlns="http://www.w3.org/2000/svg" width="680" height="380" viewBox="0 0 680 380">'
                f'<rect width="680" height="380" rx="18" fill="#0f172a" stroke="{color}" stroke-width="4"/>'
                f'<rect x="28" y="24" width="210" height="30" rx="6" fill="{color}"/>'
                f'<text x="38" y="44" font-family="Arial" font-size="13" font-weight="bold" fill="#000">VENTAS MALLAS TLAXCALLI</text>'
                f'<circle cx="555" cy="185" r="82" fill="none" stroke="#64748b" stroke-width="12" stroke-dasharray="16 8"/>'
                f'<circle cx="555" cy="185" r="44" fill="none" stroke="{color}" stroke-width="10"/>'
                f'<text x="28" y="110" font-family="Arial" font-size="20" font-weight="bold" fill="#ffffff">{titulo}</text>'
                f'<text x="28" y="150" font-family="Arial" font-size="14" fill="#cbd5e1">{sub[:58]}</text>'
                f'<text x="28" y="174" font-family="Arial" font-size="14" fill="#cbd5e1">{sub[58:]}</text>'
                f'<rect x="28" y="215" width="390" height="70" rx="10" fill="#1e293b" stroke="#334155"/>'
                f'<text x="42" y="245" font-family="Arial" font-size="14" font-weight="bold" fill="#34d399">Envio a Domicilio GRATIS (CDMX y 9 Municipios Edomex)</text>'
                f'<text x="42" y="268" font-family="Arial" font-size="13" fill="#f8fafc">Pago al recibir: Transferencia o Terminal Mercado Pago</text>'
                f'<text x="28" y="340" font-family="Arial" font-size="12" fill="#94a3b8">Carpeta conectada: imagenes negocio pau</text>'
                f'</svg>'
            )
            with open(ruta, "w", encoding="utf-8") as f:
                f.write(svg)


def listar_imagenes_pau() -> list:
    asegurar_tarjetas_muestra_pau()
    fotos_reales = []
    muestras_svg = []
    vistos = set()

    for carpeta in RUTAS_IMAGENES_PAU:
        if not os.path.exists(carpeta):
            continue
        for nombre in sorted(os.listdir(carpeta)):
            ext = os.path.splitext(nombre)[1].lower()
            ruta_completa = os.path.join(carpeta, nombre)
            if not os.path.isfile(ruta_completa):
                continue
            clave = nombre.lower()
            if clave in vistos:
                continue
            if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                vistos.add(clave)
                fotos_reales.append({
                    "nombre": nombre,
                    "ruta": ruta_completa,
                    "url": f"/api/imagen_pau?file={urllib.parse.quote(nombre)}",
                    "tipo": "FOTO_REAL_PAOLA"
                })
            elif ext == ".svg":
                vistos.add(clave)
                muestras_svg.append({
                    "nombre": nombre,
                    "ruta": ruta_completa,
                    "url": f"/api/imagen_pau?file={urllib.parse.quote(nombre)}",
                    "tipo": "LAMINA_REFERENCIA"
                })

    return fotos_reales if len(fotos_reales) > 0 else muestras_svg


def listar_imagenes_producto_reales() -> list:
    return [f for f in listar_imagenes_pau() if f.get("tipo") == "FOTO_REAL_PAOLA"]


def listar_publicidad_pau() -> list:
    fotos = []
    vistos = set()
    for carpeta in RUTAS_PUBLICIDAD_PAU:
        if not os.path.exists(carpeta):
            continue
        for nombre in sorted(os.listdir(carpeta)):
            ext = os.path.splitext(nombre)[1].lower()
            ruta_completa = os.path.join(carpeta, nombre)
            if not os.path.isfile(ruta_completa):
                continue
            clave = nombre.lower()
            if clave in vistos:
                continue
            if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                vistos.add(clave)
                fotos.append({
                    "nombre": nombre,
                    "ruta": ruta_completa,
                    "url": f"/api/imagen_pau?file={urllib.parse.quote(nombre)}&cat=publicidad",
                    "tipo": "PUBLICIDAD_REAL_PAOLA"
                })
    return fotos


def limpiar_carpeta_imagenes(categoria: str = "producto") -> int:
    carpetas = RUTAS_PUBLICIDAD_PAU if categoria == "publicidad" else RUTAS_IMAGENES_PAU
    borrados = 0
    for carpeta in carpetas:
        if not os.path.exists(carpeta):
            continue
        for nombre in os.listdir(carpeta):
            ext = os.path.splitext(nombre)[1].lower()
            if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                try:
                    os.remove(os.path.join(carpeta, nombre))
                    borrados += 1
                except Exception:
                    pass
    return borrados


# ==============================================================================
# 3. CANDADO ANTI-ALUCINACIÓN + POOL IA + VOZ FEMENINA + GENERADOR MARKETING M5
# ==============================================================================

MARCAS_MAQUINAS_CONOCIDAS = [
    "celorio", "verduzco", "reto", "tapsa", "lenin", "apolo", "tortimex", "rodotec", "villamex"
]


def analizar_memoria_verificada_cliente(historial: list) -> str:
    textos_usuario = " ".join([
        m["content"].lower() for m in historial if m.get("role") == "user"
    ])
    marcas_dichas_por_cliente = [
        marca.title() for marca in MARCAS_MAQUINAS_CONOCIDAS
        if re.search(r"\b" + re.escape(marca) + r"\b", textos_usuario)
    ]
    dijo_no_sabe = any(frase in textos_usuario for frase in [
        "no se", "no sé", "no sabria", "no sabría", "desconozco", "no me acuerdo", "no conozco la marca", "no tiene marca"
    ])

    if not marcas_dichas_por_cliente:
        estado_maquina = (
            "EL CLIENTE AÚN NO HA DICHO NINGUNA MARCA DE MÁQUINA"
            + (" (DIJO EXPLÍCITAMENTE QUE NO SABE QUÉ MÁQUINA TIENE)." if dijo_no_sabe else ".")
            + " PROHIBIDO DECIR QUE TIENE UNA CELORIO O CUALQUIER OTRA MARCA. "
            + "Si pregunta qué máquina te dijo que tenía, responde honestamente que te comentó que no sabía qué máquina tenía."
        )
    else:
        estado_maquina = f"El cliente mencionó explícitamente la(s) máquina(s): {', '.join(marcas_dichas_por_cliente)}."

    return (
        "\n\n[AUDITORÍA DE MEMORIA EXACTA — OBEDECE ESTRICTAMENTE]:\n"
        f"- {estado_maquina}\n"
        "- Tu identidad es 'Ventas Mallas Tlaxcalli' (Asesora mujer). NUNCA te llames Martín.\n"
        "- Si el cliente pide fotos o imágenes, incluye al final `[ENVIAR_FOTOS_PRODUCTO]`.\n"
        "- PROHIBIDO desviarse a temas ajenos al negocio.\n"
        "- CAPACIDAD DE VOZ ACTIVA: Tu respuesta se convierte automáticamente en nota de voz real de WhatsApp con tu voz cuando el cliente pide audio. PROHIBIDO decir 'no puedo mandar audios', 'no puedo enviar notas de voz' o 'te lo escribo'. Habla directamente con naturalidad.\n"
        "- RECUERDA: MÁXIMO 2 RENGLONES, un solo dato a la vez y TERMINA SIEMPRE CON UNA PREGUNTA FÁCIL DE CONTESTAR QUE SÍ. Avanza un escalón de la escalera del sí; no repitas lo que ya dijiste."
    )


def detectar_solicitud_fotos(mensaje_usuario: str, respuesta_ia: str) -> bool:
    if "[ENVIAR_FOTOS_PRODUCTO]" in respuesta_ia:
        return True
    msg_norm = motor_m1.quitar_acentos(mensaje_usuario)
    palabras_foto = [
        "foto", "fotos", "imagen", "imagenes", "ver el paquete", "ver las mallas",
        "ver la malla", "ver el balero", "mandame foto", "muestrame", "ensenam", "catalogo"
    ]
    return any(p in msg_norm for p in palabras_foto)


def _limpiar_texto_para_lectura_completa(texto: str) -> str:
    t = re.sub(r"\[.*?\]", "", texto)
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"[*_#`~>•]", "", t)
    # Reemplazos fonéticos amigables para que la pronunciación sea 100% natural mexicana
    t = re.sub(r"\$1[,.]?713\b", "mil setecientos trece pesos", t)
    t = re.sub(r"\$2[,.]?700\b", "dos mil setecientos pesos", t)
    t = re.sub(r"\$1[,.]?000\b", "mil pesos", t)
    t = re.sub(r"\$200\b", "doscientos pesos", t)
    t = re.sub(r"\$2[,.]?500\b", "dos mil quinientos pesos", t)
    t = re.sub(r"\$26\b", "veintiséis pesos", t)
    t = re.sub(r"\b10\"\b", "diez pulgadas", t)
    t = re.sub(r"\b23cm\b", "veintitrés centímetros", t)
    t = re.sub(r"\b1\.40m\b", "un metro con cuarenta centímetros", t)
    t = re.sub(r"\bCal\s*14\b", "calibre catorce", t, flags=re.I)
    t = re.sub(r"\b7210B\b", "siete dos diez B", t)
    t = re.sub(r"\bCDMX\b", "Ciudad de México", t)
    t = re.sub(r"\bEdomex\b", "Estado de México", t, flags=re.I)
    t = re.sub(r"\bWA\b", "WhatsApp", t)
    t = re.sub(r"\bGPS\b", "ge pe ese", t)
    # Quitar emojis y símbolos no fonéticos que hacen que los motores TTS corten la lectura
    t = re.sub(r"[^\w\s,.;:¡!¿?\-$%/()áéíóúÁÉÍÓÚñÑüÜ]", " ", t)
    t = re.sub(r"\n+", ". ", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


def _dividir_en_bloques_oraciones(texto: str, max_chars: int = 280) -> list:
    oraciones = re.split(r"(?<=[.!?])\s+", texto)
    bloques = []
    actual = ""
    for oracion in oraciones:
        if not oracion.strip():
            continue
        if len(actual) + len(oracion) + 1 <= max_chars:
            actual = (actual + " " + oracion).strip()
        else:
            if actual:
                bloques.append(actual)
            if len(oracion) <= max_chars:
                actual = oracion.strip()
            else:
                # Si una sola oración es larguísima, partir por comas
                partes = oracion.split(",")
                temp = ""
                for p in partes:
                    if len(temp) + len(p) + 2 <= max_chars:
                        temp = (temp + ", " + p).strip(", ")
                    else:
                        if temp:
                            bloques.append(temp + ".")
                        temp = p.strip()
                actual = temp
    if actual:
        bloques.append(actual)
    return bloques if bloques else [texto]


def _sintetizar_bloque_pcm(bloque: str, llaves: list, modelo_fijo: str = "gemini-2.5-flash-preview-tts") -> tuple:
    # Directo al modelo SIN meter instrucciones en el texto (evita que el TTS lea las instrucciones en voz alta)
    payload = {
        "contents": [{"parts": [{"text": bloque}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": "Aoede"
                    }
                }
            }
        }
    }
    modelos = [modelo_fijo] + [m for m in MODELOS_TTS_FEMENINO if m != modelo_fijo]
    for modelo_tts in modelos:
        for key in llaves:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_tts}:generateContent?key={key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=25) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    part = res["candidates"][0]["content"]["parts"][0]["inlineData"]
                    return base64.b64decode(part["data"]), modelo_tts
            except Exception:
                continue
    return b"", ""


async def _async_sintetizar_dalia(texto_limpio: str, out_wav_path: str):
    import edge_tts
    tmp_mp3 = f"/tmp/dalia_{int(datetime.now().timestamp()*1000)}.mp3"
    # Modulación expresiva: mayor calidez, ritmo de venta y entonación ejecutiva dulce (+4% velocidad, +3Hz tono)
    # y si contiene signos exclamativos o interrogativos se interpreta con variaciones de prosodia
    comm = edge_tts.Communicate(texto_limpio, "es-MX-DaliaNeural", rate="+4%", pitch="+3Hz")
    await comm.save(tmp_mp3)
    subprocess.run(["ffmpeg", "-y", "-i", tmp_mp3, "-ar", "48000", "-ac", "1", out_wav_path],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    if os.path.exists(tmp_mp3):
        try: os.remove(tmp_mp3)
        except Exception: pass


def _texto_para_oido(texto: str) -> str:
    t = _limpiar_texto_para_lectura_completa(texto)
    t = re.sub(r"\$1[,.]?900\b", "mil novecientos pesos", t)
    t = re.sub(r"[\U0001F300-\U0001FAFF\u2600-\u27BF\uFE0F]", "", t)
    t = re.sub(r"\s*\n+\s*", ". ", t)
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


DIRECCION_VOZ_ANDREA = (
    "Lee en voz alta el siguiente mensaje de WhatsApp en español de México. "
    "Voz de mujer joven, cálida, cercana y sonriente, como una vendedora amable que platica con un cliente de confianza. "
    "Ritmo natural y relajado, entonación con subidas y bajadas reales, pausas breves en comas y puntos, "
    "sin sonar a locutora de radio ni a robot. Lee únicamente el texto entre comillas, sin agregar nada:"
)


def generar_nota_voz_femenina_wav(texto_hablado: str) -> dict:
    limpio = _texto_para_oido(texto_hablado)
    if not limpio:
        return {"ok": False, "error": "Texto vacío"}

    # Motor primario ultrarrápido y sin cuota: Microsoft Neural es-MX-DaliaNeural (edge-tts)
    try:
        ts_e = int(datetime.now().timestamp() * 1000)
        tmp_mp3 = f"/tmp/etts_{ts_e}.mp3"
        tmp_wav = f"/tmp/etts_{ts_e}.wav"
        edge_bin = "/config/python/bin/edge-tts" if os.path.exists("/config/python/bin/edge-tts") else "edge-tts"
        ffmpeg_static = "/config/workspace/AGENCIA_AUTOMATIZACION/MALLAS_TLAXCALLI/whatsapp_bridge/node_modules/ffmpeg-static/ffmpeg"
        ffmpeg_bin = ffmpeg_static if os.path.exists(ffmpeg_static) else "ffmpeg"
        subprocess.run(
            [edge_bin, "--voice", "es-MX-DaliaNeural", "--text", limpio, "--write-media", tmp_mp3],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=18, check=True
        )
        subprocess.run(
            [ffmpeg_bin, "-y", "-i", tmp_mp3, "-ar", "48000", "-ac", "1", tmp_wav],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=True
        )
        wav = open(tmp_wav, "rb").read()
        for f_ in (tmp_mp3, tmp_wav):
            try:
                os.remove(f_)
            except Exception:
                pass
        if len(wav) > 2000:
            ESTADISTICAS_POOL["notas_voz_generadas"] += 1
            ESTADISTICAS_POOL["ultimo_modelo_voz"] = "edge-tts (es-MX-DaliaNeural)"
            return {
                "ok": True,
                "audio_data_url": "data:audio/wav;base64," + base64.b64encode(wav).decode("ascii"),
                "modelo_voz": "edge-tts (es-MX-DaliaNeural)",
                "bloques_leidos": 1,
            }
    except Exception as e_edge:
        print(f"[TTS edge-tts fallback] {str(e_edge)[:120]}")

    llaves = obtener_llaves_ia_backend()
    voz = os.environ.get("VOZ_GEMINI_ANDREA", "Aoede")
    payload = {
        "contents": [{"parts": [{"text": f'{DIRECCION_VOZ_ANDREA}\n\n"{limpio}"'}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voz}}}
        }
    }
    import time
    for intento_tts in range(2):
        modelo_tts = "gemini-2.5-flash-preview-tts"
        for key in llaves:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_tts}:generateContent?key={key}"
            try:
                req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                             headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=40) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                part = res["candidates"][0]["content"]["parts"][0]["inlineData"]
                raw_pcm = base64.b64decode(part["data"])
                if len(raw_pcm) < 2000:
                    continue
                ts = int(datetime.now().timestamp() * 1000)
                tmp_pcm, tmp_wav = f"/tmp/gtts_{ts}.pcm", f"/tmp/gtts_{ts}.wav"
                with open(tmp_pcm, "wb") as fp:
                    fp.write(raw_pcm)
                # Solo cambio de contenedor/frecuencia, sin filtros que degraden la voz
                subprocess.run(["ffmpeg", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", tmp_pcm,
                                "-ar", "48000", "-ac", "1", tmp_wav],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                wav = open(tmp_wav, "rb").read()
                for f_ in (tmp_pcm, tmp_wav):
                    try: os.remove(f_)
                    except Exception: pass
                ESTADISTICAS_POOL["notas_voz_generadas"] += 1
                ESTADISTICAS_POOL["ultimo_modelo_voz"] = f"{modelo_tts} ({voz})"
                return {"ok": True,
                        "audio_data_url": "data:audio/wav;base64," + base64.b64encode(wav).decode("ascii"),
                        "modelo_voz": f"{modelo_tts} ({voz})", "bloques_leidos": 1}
            except Exception as e_tts:
                print(f"[TTS {modelo_tts} intento {intento_tts+1}] {str(e_tts)[:120]}")
                if "429" in str(e_tts) and intento_tts == 0:
                    time.sleep(2.0)
                continue
    # Política: si no hay voz natural disponible, NO se manda voz robótica; el puente manda texto.
    return {"ok": False, "error": "Sin cuota de voz natural; se envía texto"}


def transcribir_audio_gemini(audio_b64: str, mimetype: str = "audio/ogg") -> str:
    """
    Transcribe audio/nota de voz entrante de WhatsApp usando Gemini 2.5 Flash / 1.5 Flash multimodal.
    """
    llaves = obtener_llaves_ia_backend()
    if not llaves or not audio_b64:
        return ""
    clean_mime = mimetype.split(";")[0].strip() or "audio/ogg"
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {
                    "inline_data": {
                        "mime_type": clean_mime,
                        "data": audio_b64
                    }
                },
                {
                    "text": "Transcribe exactamente palabra por palabra lo que dice el cliente en este audio de WhatsApp en español mexicano. Devuelve ÚNICAMENTE el texto que dijo, sin explicaciones ni notas adicionales."
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 350
        }
    }
    for modelo in ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]:
        for key in llaves:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=25) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    cands = res.get("candidates", [])
                    if cands and "content" in cands[0] and "parts" in cands[0]["content"]:
                        partes = cands[0]["content"]["parts"]
                        txt = "".join([p.get("text", "") for p in partes]).strip()
                        if txt:
                            return txt
            except Exception:
                continue
    return ""


def _buscar_contexto_frente_prospecto(session_id: str, cid: str) -> tuple[str, str]:
    """Devuelve (frente_nombre, angulo_contacto) si el prospecto tiene frente asignado y cid != mallas_tlaxcalli."""
    if not cid or cid == "mallas_tlaxcalli":
        return "", ""
    digs = re.sub(r"\D", "", str(session_id or ""))
    if len(digs) < 10:
        return "", ""
    ult10 = digs[-10:]
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT COALESCE(frente_nombre, ''), COALESCE(angulo_contacto, '')
            FROM prospectos_cazador
            WHERE LOWER(COALESCE(id_cliente_agencia, '')) = LOWER(?)
              AND telefono LIKE ?
            ORDER BY id DESC LIMIT 1
        """, (cid, f"%{ult10}"))
        row = cur.fetchone()
        conn.close()
        if row:
            return str(row[0] or "").strip(), str(row[1] or "").strip()
    except Exception:
        pass
    return "", ""


def construir_system_prompt_nicho(nicho: dict, historial: list, frente_nombre: str = "", angulo_contacto: str = "") -> str:
    cid = motor_m1.normalizar_cliente_id(nicho.get("cliente_id", "mallas_tlaxcalli"))
    if cid == "mallas_tlaxcalli":
        return cargar_system_prompt() + analizar_memoria_verificada_cliente(historial)

    nombre_negocio = nicho.get("nombre_negocio") or cid
    nombre_agente = nicho.get("nombre_agente") or "Andrea"
    giro_obj = nicho.get("giro_objetivo") or "clientes comerciales"
    oferta = nicho.get("oferta_gancho") or "Oferta especial"
    modelo_neg = normalizar_modelo_negocio(nicho.get("modelo_negocio", "DISTRIBUIDOR_B2B"))
    # Truncado seguro a máximo 2,500 caracteres para latencia óptima
    catalogo_truncado = str(nicho.get("catalogo_y_reglas") or "")[:2500]
    prompt_custom = str(nicho.get("system_prompt") or "").strip()
    bloque_frente = ""
    if angulo_contacto:
        frente_lbl = f" ({frente_nombre})" if frente_nombre else ""
        bloque_frente = f"\n\n## ÁNGULO DE CONTACTO DEL PROSPECTO{frente_lbl}\n{angulo_contacto}\n"

    if modelo_neg == "SERVICIOS_B2B":
        regla_cierre = (
            "5. ENFOQUE CONSULTIVO DE SERVICIOS B2B: Haz 1 pregunta técnica breve para dimensionar el proyecto o instalación "
            "(ej. cantidad de equipos/nodos, tamaño de oficina/sitio o falla a resolver) y guía al cliente a agendar visita técnica o cotización formal.\n"
            "6. Cuando el cliente confirme la visita o servicio y tengas sus 4 datos (Nombre de Empresa/Cliente, Alcance/Servicio, Ubicación del Sitio y Fecha/Horario de Visita), añade al final:\n"
            '`[PEDIDO_CERRADO:{"cliente":"Empresa o Cliente","direccion":"Ubicacion del sitio","municipio":"Municipio","horario":"Fecha y horario visita","metodo_pago":"COTIZACION_SERVICIO","tipo_pedido":"Alcance del servicio","precio":"0"}]`'
        )
    elif modelo_neg == "EMPRENDEDOR_B2C":
        regla_cierre = (
            "5. ENFOQUE PARTICULAR B2C (ATENCIÓN INBOUND): Atiende con mucha amabilidad a los clientes que preguntan por tu catálogo o promociones, "
            "resuelve precios al instante y confirma su pedido a domicilio o punto de entrega.\n"
            "6. Cuando el cliente confirme su compra y tengas sus 4 datos (Nombre, Producto elegido, Dirección/Punto de entrega y Horario/Pago), añade al final:\n"
            '`[PEDIDO_CERRADO:{"cliente":"Nombre","direccion":"Direccion o Punto","municipio":"Municipio","horario":"Horario","metodo_pago":"CONTRA_ENTREGA","precio":"0"}]`'
        )
    else:
        regla_cierre = (
            "5. Si el cliente confirma pedido mayorista/comercial y ya dio sus 4 datos (nombre/negocio, dirección, horario y método de pago), añade al final:\n"
            '`[PEDIDO_CERRADO:{"cliente":"Nombre","direccion":"Direccion","municipio":"Municipio","horario":"Horario","metodo_pago":"METODO","precio":"0"}]`'
        )

    base = prompt_custom if prompt_custom else (
        f"# {nombre_agente.upper()} — ASESORA COMERCIAL DE {nombre_negocio.upper()} ({modelo_neg} • WhatsApp)\n\n"
        f"## QUIÉN ERES\n"
        f"Eres **{nombre_agente}**, asesora comercial de **{nombre_negocio}**, especializada en atender a **{giro_obj}**.\n"
        f"Eres mujer mexicana, cálida, ágil y persuasiva. Tu objetivo es resolver dudas con naturalidad y **CERRAR LA VENTA / SERVICIO**.\n\n"
        f"## OFERTA GANCHO PRINCIPAL\n{oferta}\n\n"
        f"## CATÁLOGO, PRECIOS Y REGLAS DEL NEGOCIO\n{catalogo_truncado}\n\n"
        f"## REGLAS DE ORO EN WHATSAPP\n"
        f"1. **MÁXIMO 2 RENGLONES (25-35 palabras).** Mensajes cortos y humanos.\n"
        f"2. **SIEMPRE termina con UNA sola pregunta fácil de contestar** para avanzar el cierre.\n"
        f"3. Suelta un beneficio o precio a la vez (Escalera del Sí).\n"
        f"4. CAPACIDAD DE VOZ ACTIVA: Nunca digas que eres IA ni que no puedes mandar audios.\n"
        f"{regla_cierre}"
        f"{bloque_frente}"
    )
    if prompt_custom and bloque_frente:
        return base + bloque_frente
    return base


def llamar_pool_ia_real(session_id: str, mensaje_usuario: str, incluir_voz: bool = False, cliente_id: str = "") -> dict:
    ESTADISTICAS_POOL["llamadas_totales"] += 1
    cid = resolver_cliente_id_por_telefono_o_sesion(session_id, cliente_id)
    nicho = obtener_nicho_bd(cid)

    if session_id not in SESIONES_CHAT:
        SESIONES_CHAT[session_id] = []
    historial = SESIONES_CHAT[session_id]
    historial.append({"role": "user", "content": mensaje_usuario})

    if cid == "mallas_tlaxcalli":
        sys_prompt_completo = construir_system_prompt_nicho(nicho, historial)
    else:
        f_nom, f_ang = _buscar_contexto_frente_prospecto(session_id, cid)
        sys_prompt_completo = construir_system_prompt_nicho(nicho, historial, frente_nombre=f_nom, angulo_contacto=f_ang)
    llaves = obtener_llaves_ia_backend()

    contents = []
    for m in historial[-16:]:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    for modelo in MODELOS_POOL_INFINITO:
        gen_cfg_chat = {
            "temperature": 0.3,
            "maxOutputTokens": 1000
        }
        if "2.5" in modelo:
            gen_cfg_chat["thinkingConfig"] = {"thinkingBudget": 0}
        payload = {
            "system_instruction": {"parts": [{"text": sys_prompt_completo}]},
            "contents": contents,
            "generationConfig": gen_cfg_chat
        }
        for key in llaves:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    texto_ia = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    mandar_fotos = detectar_solicitud_fotos(mensaje_usuario, texto_ia)

                    pedido_confirmado = False
                    datos_pedido = {}
                    m_pedido = re.search(r"\[PEDIDO_CERRADO:(\{.*?\})\]", texto_ia, flags=re.S)
                    if m_pedido:
                        try:
                            datos_pedido = json.loads(m_pedido.group(1))
                            tel_sess = re.sub(r"\D", "", session_id)
                            if tel_sess.startswith("521") and len(tel_sess) == 13:
                                tel_sess = "52" + tel_sess[3:]
                            elif len(tel_sess) == 10:
                                tel_sess = "52" + tel_sess
                            if not datos_pedido.get("telefono"):
                                datos_pedido["telefono"] = tel_sess or "525500000000"
                            pedido_confirmado = True
                        except Exception:
                            pedido_confirmado = False

                    texto_limpio = re.sub(r"\[PEDIDO_CERRADO:\{.*?\}\]", "", texto_ia, flags=re.S)
                    texto_limpio = texto_limpio.replace("[ENVIAR_FOTOS_PRODUCTO]", "").replace("``", "").strip()
                    if re.search(r"no puedo (mandar|enviar|grabar) (audio|nota|voz)", texto_limpio, flags=re.I):
                        texto_limpio = "¡Claro que sí! Mire, el paquete completo con las dos mallas calibre 14 y el balero alemán está en $1,900, pero si lo aparta hoy le queda en $1,713 con envío gratis y paga al recibir. ¿Se lo aparto?"

                    historial.append({"role": "assistant", "content": texto_limpio})
                    ESTADISTICAS_POOL["llamadas_exitosas"] += 1
                    ESTADISTICAS_POOL["ultimo_modelo_usado"] = modelo

                    resultado = {
                        "respuesta": texto_limpio,
                        "modelo_activo": modelo,
                        "fotos_adjuntas": listar_imagenes_pau() if mandar_fotos else [],
                        "pedido_confirmado": pedido_confirmado,
                        "datos_pedido": datos_pedido
                    }

                    if incluir_voz:
                        voz_res = generar_nota_voz_femenina_wav(texto_limpio)
                        if voz_res.get("ok"):
                            resultado["audio_data_url"] = voz_res["audio_data_url"]

                    return resultado
            except Exception:
                ESTADISTICAS_POOL["rotaciones_modelo"] += 1
                continue

    return {"respuesta": "⚠️ Rotando modelo del Pool, envía de nuevo.", "fotos_adjuntas": []}


def generar_campana_marketing_ia(
    enfoque: str,
    zona: str,
    owner_email: str = "",
    cliente_id: str = "",
    modelo_negocio: str = "",
    modalidad_entrega: str = ""
) -> dict:
    """
    Módulo 5 / 03 • ESTUDIO: Genera kit multicanal (Estados de WhatsApp,
    Facebook Marketplace/Grupos, Reels/TikTok y mensaje disparador wa.me)
    respetando Mallas Tlaxcalli para el tenant base y adaptándose al modelo
    y modalidad del usuario para cualquier otro negocio.
    """
    email_norm = str(owner_email or "").strip().lower()
    cid_req = str(cliente_id or "").strip()
    nicho_ctx = None
    cid_target = "mallas_tlaxcalli"

    if email_norm and email_norm != OWNER_EMAIL_MALLAS:
        cid_res, nicho_res, _ = resolver_contexto_tenant_request(email_norm, cid_req)
        if cid_res and nicho_res:
            cid_target = cid_res
            nicho_ctx = nicho_res
        else:
            cid_target = cid_req or "tenant_custom"
    elif cid_req and cid_req.lower() != "mallas_tlaxcalli":
        cid_target = motor_m1.normalizar_cliente_id(cid_req)
        nicho_ctx = obtener_nicho_bd(cid_target)

    es_mallas = (
        cid_target == "mallas_tlaxcalli"
        and (email_norm == OWNER_EMAIL_MALLAS or not email_norm)
        and not (enfoque and not any(w in enfoque.lower() for w in ("malla", "1,713", "1713", "tortill", "balero")))
    )

    zona_clean = str(zona or "CDMX y Zona Metropolitana").strip()

    if es_mallas:
        copy_wa_status = (
            "⚙️ *MALLAS TLAXCALLI* • Paquete Completo de Mantenimiento ($1,713 MXN): "
            "Testalera 23x140 + Transportadora Cal 14 + Balero 7210B alemán con Envío GRATIS y pago al recibir. "
            "📲 Responde este estado o toca el enlace para pedir tu kit con Paola hoy 👇"
        )
        copy_marketplace = (
            "🔥 PAQUETE COMPLETO MANTENIMIENTO TORTILLADORA ($1,713 MXN) — ENVÍO GRATIS\n\n"
            "✅ 1 Malla Testalera (23 cm x 1.40 m)\n"
            "✅ 1 Malla Transportadora (10 pulg x 9 m Calibre 14 reforzado)\n"
            "✅ 1 Balero 7210B alemán de alta duración\n"
            "💰 Ahorra casi $1,000 MXN directo de fábrica vs refaccionaria.\n"
            "🛡️ Cero riesgo: Pagas al recibir con Transferencia o Mercado Pago.\n"
            f"📍 Entregas sin costo en {zona_clean}\n\n"
            "📲 Pide tu paquete directo por WhatsApp aquí:"
        )
        copy_reels = (
            "🎥 [0-3s] ¿Sigues gastando más de $2,700 en refaccionaria cada que cambias mallas de tu tortilladora?\n"
            "🔧 [3-12s] Mira el acero Calibre 14 real de Mallas Tlaxcalli: Malla Testalera, Transportadora y Balero 7210B alemán juntos por solo $1,713 MXN.\n"
            "📲 [12-20s] Envío gratis hasta tu tortillería y pagas al recibir. Toca el enlace de WhatsApp en mi perfil y Paola agenda tu entrega hoy."
        )
        mensaje_disparador = "Hola Paola 👋 Vi su promoción del Paquete Completo de Mantenimiento ($1,713 MXN) con envío gratis y me gustaría pedir informes."
        prompt_mkt = f"""
Eres el Director de Marketing de Mallas Tlaxcalli.
Genera contenido comercial 100% realista, persuasivo y con jerga auténtica de dueños de tortillerías y mecánicos en México (sin sonar a robot ni IA falsa).
Enfoque de la campaña: {enfoque or 'Ahorro de $1,000 MXN vs Refaccionaria ($1,713 Paquete Completo)'}
Zona destacada: {zona_clean}

Reglas obligatorias del producto:
- Paquete Completo de Mantenimiento Mallas Tlaxcalli: $1,713 MXN con envío GRATIS a domicilio.
- Incluye los 3 productos indispensables juntos en un solo paquete:
  1. 1 Malla Testalera (23 cm x 1.40 m)
  2. 1 Malla Transportadora (10 pulgadas x 9 metros, Calibre 14 reforzado)
  3. 1 Balero 7210B alemán de alta duración
- Los 3 productos se venden y entregan SIEMPRE juntos como paquete completo (NO dar precios sueltos individuales).
- En refaccionaria gastan $2,700 a $2,737 MXN comprándolos por separado; con nosotros ahorran casi $1,000 MXN directo de fábrica.
- Cero riesgo: pagan al recibir con Transferencia o Terminal Mercado Pago (no efectivo).

Devuelve tu respuesta dividida claramente con estos 4 encabezados exactos:
### 📘 FACEBOOK (GRUPOS DE TORTILLEROS Y PÁGINA)
### 📸 INSTAGRAM (PIE DE FOTO + HASHTAGS)
### 🎵 TIKTOK / REELS (GUION DE VIDEO DE 20 SEGUNDOS MOSTRANDO EL ACERO REAL)
### 🟢 ESTADO DE WHATSAPP BUSINESS (TEXTO CORTO + LLAMADO A LA ACCIÓN)
"""
    else:
        idea_fuente = enfoque or (nicho_ctx or {}).get("oferta_gancho") or (nicho_ctx or {}).get("nombre_negocio") or "productos y servicios"
        giro_limpio = _limpiar_giro_texto(idea_fuente)
        nombre_neg = (nicho_ctx or {}).get("nombre_negocio") or giro_limpio[:40].capitalize()
        nombre_ag = (nicho_ctx or {}).get("nombre_agente") or "Andrea"
        diag_saved = (nicho_ctx or {}).get("diagnostico_ia") if isinstance((nicho_ctx or {}).get("diagnostico_ia"), dict) else {}
        mod_neg = normalizar_modelo_negocio(modelo_negocio or (nicho_ctx or {}).get("modelo_negocio") or diag_saved.get("modelo_recomendado") or "EMPRENDEDOR_B2C")
        mod_ent = str(modalidad_entrega or diag_saved.get("modalidad_entrega") or "").strip().lower()

        es_personalizado = (
            mod_ent == "personalizado_bajo_pedido"
            or any(w in giro_limpio.lower() for w in ("personaliz", "3d", "medida", "diseño", "diseno", "custom", "pedido"))
        )

        if es_personalizado:
            mensaje_disparador = f"Hola {nombre_ag} 👋 Vi su anuncio de {giro_limpio} y me gustaría cotizar un pedido personalizado."
            copy_wa_status = (
                f"✨ ¡Hacemos realidad tus ideas en *{giro_limpio}*! "
                "Trabajamos diseños personalizados a tu medida y modelos de catálogo. "
                f"📲 Responde este estado o toca el enlace para enviarnos tu idea, foto o medidas y {nombre_ag} te cotiza al instante 👇"
            )
            copy_marketplace = (
                f"🔥 {giro_limpio.upper()} — DISEÑOS PERSONALIZADOS Y CATÁLOGO\n\n"
                "✅ Piezas y pedidos hechos a tu medida con excelente acabado\n"
                "✅ Cotiza enviando tu idea, foto, medidas o archivo de referencia\n"
                f"✅ Atención inmediata 24/7 con {nombre_ag}\n"
                f"📍 Entregas y envíos seguros en {zona_clean}\n\n"
                "📲 Mándanos mensaje directo por WhatsApp aquí:"
            )
            copy_reels = (
                f"🎥 [0-3s] ¿Buscas {giro_limpio} hecho exactamente a tu gusto o medida?\n"
                "✨ [3-12s] Mira cómo cuidamos cada detalle en nuestros pedidos personalizados y de catálogo para que recibas una pieza única.\n"
                f"📲 [12-20s] Toca el enlace de WhatsApp en mi perfil, mándanos tu idea o foto de referencia y {nombre_ag} te cotiza en minutos."
            )
        elif mod_neg == "SERVICIOS_B2B" or mod_ent == "servicio_en_sitio":
            mensaje_disparador = f"Hola {nombre_ag} 👋 Vi su servicio de {giro_limpio} y me gustaría solicitar una cotización o visita técnica."
            copy_wa_status = (
                f"🛠️ Especialistas en *{giro_limpio}* para empresas, comercios y proyectos en {zona_clean}. "
                f"Diagnóstico profesional y atención inmediata. 📲 Toca el enlace para agendar cotización o visita técnica con {nombre_ag} 👇"
            )
            copy_marketplace = (
                f"🛠️ SERVICIO PROFESIONAL: {giro_limpio.upper()}\n\n"
                "✅ Atención especializada a empresas, oficinas, comercios y proyectos\n"
                "✅ Levantamiento técnico y cotización transparente\n"
                f"📍 Cobertura en {zona_clean} con garantía de servicio\n\n"
                f"📲 Agenda tu visita técnica o cotización por WhatsApp con {nombre_ag} aquí:"
            )
            copy_reels = (
                f"🎥 [0-3s] ¿Tu negocio o proyecto requiere {giro_limpio} con garantía profesional?\n"
                "🛠️ [3-12s] Así ejecutamos cada instalación y servicio en sitio cuidando tiempos y calidad técnica.\n"
                f"📲 [12-20s] Toca el enlace de WhatsApp en el perfil y {nombre_ag} agenda tu levantamiento o cotización hoy mismo."
            )
        else:
            mensaje_disparador = f"Hola {nombre_ag} 👋 Vi su catálogo de {giro_limpio} y me gustaría conocer precios y disponibilidad."
            copy_wa_status = (
                f"🔥 ¡Ya disponible en *{nombre_neg}*: {giro_limpio}! "
                f"Calidad garantizada y entregas rápidas en {zona_clean}. "
                f"📲 Responde este estado o toca el enlace para pedir el catálogo a {nombre_ag} 👇"
            )
            copy_marketplace = (
                f"✨ {giro_limpio.upper()} — DISPONIBLE CON ENTREGA RÁPIDA\n\n"
                "✅ Excelente calidad y precios directos\n"
                f"✅ Atención inmediata 24/7 con {nombre_ag}\n"
                f"📍 Entregas y envíos en {zona_clean}\n\n"
                "📲 Pide catálogo y haz tu pedido por WhatsApp aquí:"
            )
            copy_reels = (
                f"🎥 [0-3s] Si estabas buscando {giro_limpio} con entrega rápida y calidad garantizada, tienes que ver esto.\n"
                "✨ [3-12s] Mira de cerca las opciones de nuestro catálogo que más nos están pidiendo esta semana.\n"
                f"📲 [12-20s] Toca el enlace de WhatsApp en mi perfil y {nombre_ag} toma tu pedido al instante."
            )

        prompt_mkt = f"""
Eres un Director de Marketing Digital experto en conversión por WhatsApp en México.
Negocio: {nombre_neg}
Producto o Servicio: {giro_limpio}
Modelo Operativo: {mod_neg} ({mod_ent or 'estandar'})
Asesora IA que atiende en WhatsApp: {nombre_ag}
Zona: {zona_clean}

Devuelve contenido comercial atractivo, persuasivo y natural dividido con estos 4 encabezados:
### 📘 FACEBOOK (MARKETPLACE Y GRUPOS LOCALES)
### 📸 INSTAGRAM (PIE DE FOTO + HASHTAGS)
### 🎵 TIKTOK / REELS (GUION DE VIDEO DE 20 SEGUNDOS)
### 🟢 ESTADO DE WHATSAPP BUSINESS (TEXTO CORTO + LLAMADO A LA ACCIÓN)
"""

    contenido_base = (
        f"### 📘 FACEBOOK (MARKETPLACE Y GRUPOS)\n{copy_marketplace}\n\n"
        f"### 🎵 TIKTOK / REELS (GUION 20S)\n{copy_reels}\n\n"
        f"### 🟢 ESTADO DE WHATSAPP BUSINESS\n{copy_wa_status}"
    )

    llaves = obtener_llaves_ia_backend()
    payload = {
        "contents": [{"parts": [{"text": prompt_mkt}]}],
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 900}
    }
    for modelo in MODELOS_POOL_INFINITO[:2]:
        for key in llaves[:2]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=8) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    txt = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return {
                        "ok": True,
                        "contenido": txt or contenido_base,
                        "copy_whatsapp_status": copy_wa_status,
                        "copy_marketplace": copy_marketplace,
                        "copy_reels": copy_reels,
                        "mensaje_disparador_wa": mensaje_disparador,
                        "modelo": modelo
                    }
            except Exception:
                continue
    return {
        "ok": True,
        "contenido": contenido_base,
        "copy_whatsapp_status": copy_wa_status,
        "copy_marketplace": copy_marketplace,
        "copy_reels": copy_reels,
        "mensaje_disparador_wa": mensaje_disparador,
        "modelo": "heuristico_instantaneo"
    }


COLA_MENSAJES_PAOLA = []


def _mensaje_saliente_prospecto(pid: int, nombre: str, municipio: str, cliente_id: str = "mallas_tlaxcalli", angulo_contacto: str = "", frente_nombre: str = "") -> str:
    # Saludo dinámico según hora real en CDMX (UTC-6) + 6 variantes naturales anti-huella
    ahora_mx = datetime.now(timezone.utc) - timedelta(hours=6)
    hora_mx = ahora_mx.hour
    if hora_mx < 12:
        saludo_hora = "Buenos días"
    elif hora_mx < 19:
        saludo_hora = "Buenas tardes"
    else:
        saludo_hora = "Buenas noches"

    mun = (municipio or "su zona").strip()
    nom_raw = (nombre or "").strip()
    nombre_valido = (
        nom_raw
        and len(nom_raw) >= 3
        and not any(x in nom_raw.upper() for x in ("SIN NOMBRE", "N/A", "DESCONOCIDO", "PROSPECTO"))
    )
    ref_negocio = f"*{nom_raw}*" if nombre_valido else f"su negocio en *{mun}*"

    cid = motor_m1.normalizar_cliente_id(cliente_id)
    if cid == "mallas_tlaxcalli":
        saludos = [
            f"{saludo_hora}, disculpe la molestia 👋 Le saluda Paola de *Mallas Tlaxcalli*. Somos fabricantes directos de mallas y refacciones para tortilladora y andamos armando ruta por *{mun}*. Queríamos dejarle nuestro contacto para {ref_negocio} por si llegan a ocupar mallas o baleros sin frenar su turno. Si gusta le paso foto del paquete con envío gratis, sin compromiso. ¡Excelente jornada!",
            f"Qué tal, muy {saludo_hora.lower()}, disculpe interrumpir el turno 👋 Le escribe Paola de *Mallas Tlaxcalli*. Fabricamos mallas reforzadas para tortilladora y baleros, y seguido entregamos pedidos en *{mun}*. Les compartimos nuestro contacto directo para {ref_negocio} por si en algún momento necesitan refacción directo de fábrica. ¿Le gustaría ver la foto del paquete completo? Sin presión, aquí quedamos a la orden.",
            f"{saludo_hora}, disculpe que le escriba en horario de trabajo 👋 Soy Paola del taller *Mallas Tlaxcalli*. Hacemos mallas testaleras, transportadoras y baleros para máquina tortilladora con entrega directa en *{mun}* y pago al recibir. Si en {ref_negocio} llegan a requerir cambio, con gusto le mando fotos de referencia cuando tenga un chance. ¡Mucho éxito hoy!",
            f"Hola, {saludo_hora.lower()} 👋 Le saluda Paola de *Mallas Tlaxcalli*. Andamos visitando y entregando pedidos de mallas y baleros para tortilladora en la zona de *{mun}*. Le dejo este mensaje breve por si en {ref_negocio} buscan proveedor directo de taller con envío sin costo. Si le interesa, me responde y le mando el catálogo rápido. ¡Que tenga muy buena venta!",
            f"{saludo_hora}, un saludo cordial hasta *{mun}* 👋 Le escribe Paola de *Mallas Tlaxcalli*. Nos dedicamos a fabricar mallas de acero y refacciones para tortilladora, entregando directo en su local. Quedamos a la orden para {ref_negocio} para cuando necesiten mantenimiento preventivo o alguna urgencia. ¿Quiere que le comparta precios y fotos de nuestro paquete? Quedo pendiente sin compromiso.",
            f"Qué tal, {saludo_hora.lower()}, mucho gusto 👋 Soy Paola de *Mallas Tlaxcalli*. Somos taller fabricante de mallas y baleros para tortilladora y esta semana traemos ruta por *{mun}*. Le dejamos nuestro WhatsApp por si en {ref_negocio} ocupan cotizar refacciones directo de fábrica y con pago contra entrega. Si gusta le envío fotos del kit cuando guste. ¡Saludos!"
        ]
        return saludos[pid % len(saludos)]

    nicho = obtener_nicho_bd(cid)
    nom_emp = nicho.get("nombre_negocio") or cid
    agente = nicho.get("nombre_agente") or "Andrea"
    oferta = str(angulo_contacto or "").strip() or (f"{frente_nombre}: {nicho.get('oferta_gancho') or ''}".strip(": ") if frente_nombre else (nicho.get("oferta_gancho") or "nuestra promoción especial"))
    mod_neg = normalizar_modelo_negocio(nicho.get("modelo_negocio", "DISTRIBUIDOR_B2B"))
    if mod_neg == "SERVICIOS_B2B":
        saludos_serv = [
            f"{saludo_hora}, disculpe la molestia 👋 Le saluda {agente} de *{nom_emp}*. Nos especializamos en servicios e instalaciones técnicas para empresas en *{mun}* y queríamos ponernos a las órdenes de {ref_negocio}: {oferta}. ¿Les gustaría agendar una revisión o cotización sin compromiso?",
            f"Qué tal, muy {saludo_hora.lower()} 👋 Le escribe {agente} del área de proyectos de *{nom_emp}*. Andamos atendiendo empresas y comercios en *{mun}* y dejamos nuestro contacto para {ref_negocio} por si requieren apoyo en {oferta}. Si gusta le comparto nuestra ficha técnica por aquí.",
            f"{saludo_hora}, un gusto saludarle hasta *{mun}* 👋 Soy {agente} de *{nom_emp}*. Apoyamos a organizaciones como {ref_negocio} con soluciones profesionales ({oferta}). ¿Tienen algún requerimiento o proyecto próximo que podamos cotizarles sin costo?",
            f"Hola, {saludo_hora.lower()} 👋 Le saluda {agente} de *{nom_emp}*. Esta semana nuestro equipo técnico tiene agenda abierta en *{mun}* para visitas y diagnósticos en {ref_negocio} ({oferta}). ¿Le paso los detalles brevemente por este medio?"
        ]
        return saludos_serv[pid % len(saludos_serv)]

    saludos_nicho = [
        f"{saludo_hora}, disculpe la molestia 👋 Le saluda {agente} de *{nom_emp}*. Andamos atendiendo negocios en *{mun}* y queríamos ponernos a las órdenes de {ref_negocio} con {oferta}. ¿Gusta que le comparta los detalles rápido y sin compromiso? ¡Excelente día!",
        f"Qué tal, muy {saludo_hora.lower()} 👋 Le escribe {agente} de *{nom_emp}*. Vimos a {ref_negocio} en *{mun}* y le dejamos nuestro contacto directo por si les interesa aprovechar {oferta}. Si gusta le paso la información por aquí cuando tenga un minuto.",
        f"{saludo_hora}, un gusto saludarle hasta *{mun}* 👋 Soy {agente} de *{nom_emp}*. Estamos apoyando a negocios de su giro como {ref_negocio} con {oferta}. ¿Le gustaría que le envíe precios y catálogo breve sin compromiso?",
        f"Hola, {saludo_hora.lower()} 👋 Le saluda {agente} del equipo de *{nom_emp}*. Esta semana tenemos atención prioritaria en *{mun}* para {ref_negocio} con {oferta}. ¿Le comparto la ficha rápida por este medio? ¡Mucho éxito hoy!",
        f"{saludo_hora}, disculpe que le escriba brevemente 👋 Soy {agente} de *{nom_emp}*. Nos especializamos en atender a negocios en *{mun}* y tenemos disponible {oferta} para {ref_negocio}. Quedo a su orden si desea conocer los beneficios.",
        f"Qué tal, {saludo_hora.lower()}, cordial saludo 👋 Le escribe {agente} de *{nom_emp}*. Le dejo nuestro WhatsApp directo para {ref_negocio} en *{mun}*; contamos con {oferta}. Si le interesa revisarlo sin presión, dígame y le mando los detalles."
    ]
    return saludos_nicho[pid % len(saludos_nicho)]


def obtener_candidato_envio_50(cliente_id: str = "mallas_tlaxcalli", forzar: bool = False) -> dict:
    cid_filtro = motor_m1.normalizar_cliente_id(cliente_id or "mallas_tlaxcalli")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT activo, COALESCE(modelo_negocio, 'DISTRIBUIDOR_B2B') FROM perfiles_nicho WHERE LOWER(cliente_id) = LOWER(?)",
        (cid_filtro,)
    )
    row_act = cur.fetchone()
    modelo_nicho = "DISTRIBUIDOR_B2B" if cid_filtro == "mallas_tlaxcalli" else normalizar_modelo_negocio(row_act[1] if row_act else "DISTRIBUIDOR_B2B")

    # CANDADO ANTI-SPAM B2C: Ningún tenant EMPRENDEDOR_B2C puede disparar mensajes salientes en frío
    if modelo_nicho == "EMPRENDEDOR_B2C":
        conn.close()
        return {
            "ok": True,
            "candidato": None,
            "modelo_negocio": "EMPRENDEDOR_B2C",
            "motivo": "MODO_B2C_INBOUND_ONLY",
            "id_cliente_agencia": cid_filtro,
            "enviados_hoy": 0
        }

    if cid_filtro == "mallas_tlaxcalli" and not ESTADO_MOTOR_50_DIARIOS.get("activo", False) and not forzar:
        conn.close()
        return {
            "ok": False,
            "motivo": "MOTOR_PAUSADO",
            "modelo_negocio": modelo_nicho,
            "enviados_hoy": 0,
            "id_cliente_agencia": cid_filtro
        }

    hoy_prefijo = datetime.now().strftime("%Y-%m-%d")
    cur.execute(
        "SELECT COUNT(*) FROM bitacora_envios_wa WHERE fecha_hora LIKE ? AND LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)",
        (f"{hoy_prefijo}%", cid_filtro)
    )
    enviados_hoy = cur.fetchone()[0]

    if enviados_hoy >= ESTADO_MOTOR_50_DIARIOS["meta_diaria"]:
        conn.close()
        return {
            "ok": False,
            "motivo": "META_DIARIA_50_COMPLETADA",
            "modelo_negocio": modelo_nicho,
            "enviados_hoy": enviados_hoy,
            "id_cliente_agencia": cid_filtro
        }

    if row_act is not None and int(row_act[0]) == 0:
        conn.close()
        return {
            "ok": False,
            "motivo": "NICHO_INACTIVO",
            "modelo_negocio": modelo_nicho,
            "enviados_hoy": enviados_hoy,
            "id_cliente_agencia": cid_filtro
        }

    cur.execute("""
        SELECT id, nombre, telefono, municipio, direccion, google_maps_url,
               COALESCE(id_cliente_agencia, 'mallas_tlaxcalli'),
               COALESCE(frente_nombre, ''), COALESCE(angulo_contacto, '')
        FROM prospectos_cazador
        WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)
          AND (estatus_contacto_wa IS NULL OR estatus_contacto_wa IN ('PENDIENTE', 'PENDIENTE_ENVIO', 'VERIFICADO_WA', 'WHATSAPP_CONFIRMADO', ''))
          AND (estatus_clasificacion LIKE 'APROBADO%')
          AND (estatus_maps IS NULL OR estatus_maps != 'CERRADA_DESCARTADA')
        ORDER BY CASE WHEN estatus_contacto_wa IN ('VERIFICADO_WA', 'WHATSAPP_CONFIRMADO') THEN 0 ELSE 1 END, id ASC
        LIMIT 1
    """, (cid_filtro,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return {
            "ok": False,
            "motivo": "SIN_PROSPECTOS_PENDIENTES",
            "modelo_negocio": modelo_nicho,
            "enviados_hoy": enviados_hoy,
            "id_cliente_agencia": cid_filtro
        }

    pid, nombre, telefono, municipio, direccion, maps_url, cid_raw, frente_nom, angulo_c = row
    cid = motor_m1.normalizar_cliente_id(cid_raw or cid_filtro)
    # Fast-Path Legacy estricto para mallas_tlaxcalli
    if cid == "mallas_tlaxcalli":
        mensaje_wa = _mensaje_saliente_prospecto(pid, nombre, municipio, cliente_id="mallas_tlaxcalli")
    else:
        mensaje_wa = _mensaje_saliente_prospecto(
            pid, nombre, municipio, cliente_id=cid, angulo_contacto=angulo_c, frente_nombre=frente_nom
        )
    return {
        "ok": True,
        "id": pid,
        "id_cliente_agencia": cid,
        "modelo_negocio": modelo_nicho,
        "nombre": nombre,
        "telefono": telefono,
        "municipio": municipio,
        "mensaje": mensaje_wa,
        "enviados_hoy": enviados_hoy,
        "meta_diaria": ESTADO_MOTOR_50_DIARIOS["meta_diaria"]
    }


def confirmar_envio_50(pid: int, enviado: bool, motivo: str = "", telefono_real: str = "", mensaje: str = "", cliente_id: str = "") -> dict:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT nombre, telefono, municipio, COALESCE(id_cliente_agencia, 'mallas_tlaxcalli') FROM prospectos_cazador WHERE id = ?", (pid,))
    row = cur.fetchone()
    ahora_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not row:
        conn.close()
        return {"ok": False, "error": "ID no encontrado"}

    nombre, tel_bd, municipio, cid_raw = row
    cid = motor_m1.normalizar_cliente_id(cliente_id or cid_raw or "mallas_tlaxcalli")
    if not enviado:
        nuevo_est = "SIN_WHATSAPP" if "SIN_WHATSAPP" in motivo.upper() else "ERROR_ENVIO_WA"
        cur.execute("UPDATE prospectos_cazador SET estatus_contacto_wa = ? WHERE id = ?", (nuevo_est, pid))
        conn.commit()
        conn.close()
        exportar_excel_en_vivo()
        return {"ok": True, "estatus": nuevo_est, "id_cliente_agencia": cid}

    tel_final = telefono_real or tel_bd
    msg_final = mensaje or _mensaje_saliente_prospecto(pid, nombre, municipio, cliente_id=cid)
    cur.execute("""
        UPDATE prospectos_cazador
        SET estatus_contacto_wa = 'CONTACTADO_WA', fecha_ultimo_wa = ?
        WHERE id = ?
    """, (ahora_str, pid))
    cur.execute("""
        INSERT INTO bitacora_envios_wa (telefono, nombre_negocio, municipio, mensaje, tipo_envio, fecha_hora, id_cliente_agencia)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (tel_final, nombre, municipio, msg_final, "GOTEO_50_DIARIOS_ANTIBAN", ahora_str, cid))

    hoy_prefijo = datetime.now().strftime("%Y-%m-%d")
    cur.execute(
        "SELECT COUNT(*) FROM bitacora_envios_wa WHERE fecha_hora LIKE ? AND LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)",
        (f"{hoy_prefijo}%", cid)
    )
    enviados_hoy = cur.fetchone()[0]
    conn.commit()
    conn.close()

    if cid == "mallas_tlaxcalli":
        ultimo_txt = f"{nombre} ({municipio} - {tel_final})"
        ESTADO_MOTOR_50_DIARIOS["ultimo_negocio_contactado"] = ultimo_txt
        guardar_config("ultimo_negocio_contactado", ultimo_txt)
    exportar_excel_en_vivo()
    return {"ok": True, "estatus": "CONTACTADO_WA", "id_cliente_agencia": cid, "enviados_hoy": enviados_hoy, "nombre": nombre, "municipio": municipio}


def obtener_siguiente_envio_50_diarios(cliente_id: str = "mallas_tlaxcalli") -> dict:
    cand = obtener_candidato_envio_50(cliente_id=cliente_id)
    if not cand.get("ok"):
        return cand
    conf = confirmar_envio_50(cand["id"], True, mensaje=cand["mensaje"], cliente_id=cand.get("id_cliente_agencia", cliente_id))
    cand["enviados_hoy"] = conf.get("enviados_hoy", cand["enviados_hoy"] + 1)
    return cand


def _llamar_bridge_wa(endpoint: str, payload: dict, timeout: int = 8) -> dict:
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:8095{endpoint}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"ok": False, "error": str(e)}


def llamar_agente_ceo_paola(mensaje_paola: str, session_id: str = "wa_dueno_5215648847438") -> dict:
    """
    Agente CDO / Ejecutivo de IA exclusivo para dueños de Mallas Tlaxcalli.
    Opera 100% desde WhatsApp (chat propio sin necesitar hashtags):
    1. Informes 100% REALES desde SQLite (cero inventos).
    2. Adjunta Excel actualizado (`mándame el excel`).
    3. Envía mensajes directos a números dictados (`mándale mensaje al 55...`).
    4. Activa/pausa los 50 envíos diarios anti-bloqueo y dispara el 1er envío al instante.
    5. Busca tortillerías con INEGI/Apify, verifica cuáles tienen WhatsApp real,
       muestra o borra fotos de catálogo/publicidad y genera campañas Marketing M5.
    """
    with open(PERFIL_PATH, "r", encoding="utf-8") as f:
        perfil = json.load(f)
    bd = obtener_datos_completos_bd(perfil["id_cliente"])
    prospectos = bd["prospectos"]
    pedidos = bd["pedidos"]
    seguimientos = bd["seguimientos"]

    msg_low = motor_m1.quitar_acentos(mensaje_paola)
    # Detecta números escritos continuos o con espacios/guiones
    solo_dig_texto = re.sub(r"[^\d\n]+", " ", mensaje_paola)
    digitos_encontrados = re.findall(r"\b(?:\+?52\s?1?)?\s*(\d{10})\b", re.sub(r"(\d)[\s\-]+(\d)", r"\1\2", mensaje_paola))
    if not digitos_encontrados:
        digitos_encontrados = re.findall(r"\b(\d{10})\b", solo_dig_texto)

    accion_ejecutada = None
    link_wa_directo = ""
    fotos_enviar = []
    enviar_excel_wa = any(w in msg_low for w in [
        "excel", "archivo", "hoja de calculo", "tabla", "csv", "descargar base",
        "manda la base", "reporte", "resumen", "datos", "estatus", "status"
    ])

    # 1. Gestión de Fotos de Producto y Publicidad desde WhatsApp
    if any(w in msg_low for w in ["borra", "borrar", "elimina", "limpia"]) and any(w in msg_low for w in ["publicidad", "anuncio", "promo", "marketing"]):
        cant_b = limpiar_carpeta_imagenes("publicidad")
        accion_ejecutada = f"SE ELIMINARON {cant_b} IMAGEN(ES) DE LA CARPETA DE PUBLICIDAD."
    elif any(w in msg_low for w in ["borra", "borrar", "elimina", "limpia"]) and any(w in msg_low for w in ["foto", "imagen", "catalogo"]):
        cant_b = limpiar_carpeta_imagenes("producto")
        accion_ejecutada = f"SE ELIMINARON {cant_b} FOTO(S) REALES DEL CATÁLOGO DE PRODUCTO."
    elif any(w in msg_low for w in ["ver ", "muestra", "enseña", "ensename", "muestrame", "manda", "mandame"]) and any(w in msg_low for w in ["publicidad", "anuncio", "marketing"]) and "campana" not in msg_low:
        pub = listar_publicidad_pau()
        for p_img in pub[:5]:
            fotos_enviar.append({"ruta": p_img["ruta"], "caption": f"🎨 Publicidad guardada: {p_img['nombre']}"})
        accion_ejecutada = f"TIENES {len(pub)} IMAGEN(ES) REALES DE PUBLICIDAD GUARDADAS."
    elif any(w in msg_low for w in ["ver ", "muestra", "ensename", "muestrame", "cuales fotos", "cuantas fotos", "catalogo"]) and any(w in msg_low for w in ["foto", "fotos", "imagen", "imagenes", "catalogo"]):
        reales = listar_imagenes_producto_reales()
        for f_img in reales[:5]:
            fotos_enviar.append({"ruta": f_img["ruta"], "caption": f"📸 Catálogo Producto: {f_img['nombre']}"})
        accion_ejecutada = f"TIENES {len(reales)} FOTO(S) REALES DE PRODUCTO EN TU CATÁLOGO."

    # 2. ¿Ordenó mandarle mensaje a un número que encontró?
    elif digitos_encontrados and any(w in msg_low for w in ["manda", "mandale", "escribe", "escribele", "contacta", "ofrece", "mensaje", "prueba"]):
        tel_10 = digitos_encontrados[0]
        tel_12 = "52" + tel_10
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        maps_link = motor_m1.construir_link_google_maps("Tortillería Prospecto Directo", "Zona Autorizada", "Edomex/CDMX")
        cur.execute("SELECT id FROM prospectos_cazador WHERE id_cliente_agencia = ? AND telefono = ?", (perfil["id_cliente"], tel_12))
        ex_row = cur.fetchone()
        if ex_row:
            cur.execute("UPDATE prospectos_cazador SET estatus_contacto_wa = 'EN_COLA_ORDEN_PAOLA' WHERE id = ?", (ex_row[0],))
        else:
            cur.execute("""
                INSERT INTO prospectos_cazador (
                    id_cliente_agencia, nombre, telefono, direccion, colonia,
                    municipio, segmento_cliente, oferta_recomendada, modalidad_entrega,
                    estatus_clasificacion, score_prioridad, fuente, estatus_contacto_wa,
                    fecha_registro, google_maps_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                perfil["id_cliente"],
                f"Prospecto Directo ({tel_10})",
                tel_12,
                "Registrado por orden directa desde WhatsApp",
                "Centro",
                "Ecatepec",
                "MENUDEO_PAQUETE_1713",
                "Paquete Completo $1,713 MXN (Envío Gratis)",
                "ENTREGA_A_DOMICILIO_GRATIS",
                "APROBADO_RUTA_DIRECTA",
                100,
                "ORDEN_DIRECTA_DUENO",
                "EN_COLA_ORDEN_PAOLA",
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                maps_link
            ))
        conn.commit()
        conn.close()

        msg_saliente = (
            f"¡Hola, qué tal Jefe! Buen día 😊 Le escribimos del área de *Ventas de Mallas Tlaxcalli*. "
            f"Andamos en ruta entregando nuestro *Paquete Completo de Mantenimiento* (1 Malla Testalera 23cm x 1.40m + "
            f"1 Malla Transportadora 10\" x 9m Calibre 14 + 1 Balero 7210B alemán) por *$1,713 pesos con envío GRATIS* "
            f"hasta su negocio (en refaccionaria gasta más de $2,700). Paga hasta recibir con transferencia o tarjeta. "
            f"¿Gusta que le mande las fotos reales de nuestras mallas, Jefe?"
        )
        link_wa_directo = f"https://wa.me/{tel_12}?text={urllib.parse.quote(msg_saliente)}"
        COLA_MENSAJES_PAOLA.append({
            "telefono": tel_12,
            "mensaje": msg_saliente,
            "ordenado_por": "Dueño / Ing. Paola Almanza",
            "estatus": "EN_COLA_LISTO_PARA_ENVIAR",
            "link_wa": link_wa_directo,
            "fecha": datetime.now().strftime("%H:%M:%S")
        })
        exportar_excel_en_vivo()
        accion_ejecutada = f"SE REGISTRÓ EL NÚMERO {tel_12} Y SE ENCOLÓ EL DISPARO AUTOMÁTICO POR WHATSAPP EN ESTE INSTANTE (se enviará en < 5 seg si tiene WhatsApp activo)."

    # 3. ¿Pidió verificar números en WhatsApp (`onWhatsApp`)?
    elif any(k in msg_low for k in ["verifica whatsapp", "verifica cuales tienen", "revisa cuales tienen whatsapp", "filtra numeros", "filtrar whatsapp", "checa whatsapp"]):
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            SELECT id, telefono FROM prospectos_cazador
            WHERE estatus_clasificacion LIKE 'APROBADO%'
              AND (estatus_contacto_wa IS NULL OR estatus_contacto_wa IN ('PENDIENTE', 'PENDIENTE_ENVIO', ''))
            ORDER BY id ASC LIMIT 25
        """)
        lote_check = [{"id": r[0], "telefono": r[1]} for r in cur.fetchall()]
        conn.close()
        if lote_check:
            res_chk = _llamar_bridge_wa("/verificar_lote_wa", {"prospectos": lote_check}, timeout=25)
            if res_chk.get("ok"):
                accion_ejecutada = (
                    f"AUDITORÍA EN VIVO DE WHATSAPP ({len(lote_check)} números revisados): "
                    f"{res_chk.get('con_whatsapp', 0)} SÍ tienen WhatsApp activo (listos para enviar) y "
                    f"{res_chk.get('sin_whatsapp', 0)} son líneas fijas sin WhatsApp (marcados SIN_WHATSAPP para no desperdiciar envíos)."
                )
            else:
                accion_ejecutada = f"No se pudo completar verificación en puente WA ({res_chk.get('error', '')})."
        else:
            accion_ejecutada = "Todos los prospectos actuales ya fueron verificados previamente en WhatsApp."

    # 4. ¿Pidió activar o pausar el motor de 50 mensajes diarios anti-bloqueo?
    elif any(k in msg_low for k in [
        "activa los 50", "activar 50", "activa los envios", "activar los envios",
        "activar envios", "empieza a mandar", "inicia los envios", "iniciar envios",
        "arranca los 50", "arranca los envios", "enciende los envios", "envia 1 ahorita"
    ]):
        ESTADO_MOTOR_50_DIARIOS["activo"] = True
        guardar_config("motor_50_activo", "1")
        forzar_ahora = "envia 1 ahorita" in msg_low or "manda 1" in msg_low or True
        _llamar_bridge_wa("/activar_motor_ahora", {"forzar": forzar_ahora}, timeout=3)
        accion_ejecutada = (
            "MOTOR DE 80 ENVÍOS DIARIOS ACTIVADO Y GUARDADO EN SQLITE. "
            "En unos segundos verificará y enviará el 1er mensaje a una tortillería con WhatsApp activo y luego continuará cada 8 a 11 minutos."
        )
    elif any(k in msg_low for k in [
        "pausa los envios", "pausar envios", "deten los envios", "pausar 50", "apaga los envios", "para los envios",
        "pausa los mensajes", "pausar mensajes", "deten los mensajes", "detener mensajes", "para los mensajes", "parar mensajes",
        "apaga los mensajes", "no mandes mensajes", "ya no mandes", "cancela los envios", "frena los envios", "pausa",
        "pausalo", "detente", "frena", "deten el envio", "parar el envio", "suspender envios"
    ]):
        ESTADO_MOTOR_50_DIARIOS["activo"] = False
        guardar_config("motor_50_activo", "0")
        _llamar_bridge_wa("/control_motor", {"accion": "pausar"}, timeout=3)
        accion_ejecutada = "MOTOR DE ENVÍOS 80/DÍA PAUSADO POR COMPLETO EN SQLITE Y EN EL PUENTE DE WHATSAPP."

    elif any(k in msg_low for k in ["repara los links", "reparar mapas", "corrige mapas", "arregla mapas"]):
        rep = motor_m1.reparar_y_enriquecer_bd_existente()
        exportar_excel_en_vivo()
        accion_ejecutada = f"BASE REPARADA: {rep['con_pin_gps_exacto']} pines GPS exactos actualizados en Google Maps y {rep['eliminados_fuera_cobertura']} registros fuera de cobertura eliminados."

    # 6. ¿Pidió buscar / cazar más tortillerías? (Reconocimiento Inteligente 100% de Órdenes)
    elif any(k in msg_low for k in [
        "busca", "buscar", "caza", "cazar", "encuentra", "encontrar", "extrae", "extraer",
        "consigue", "conseguir", "agrega", "agregar", "prospecta", "prospectar",
        "rastrea", "rastrear", "nuevas", "mas tortiller", "dame tortiller", "saca tortiller",
        "tortillerias en", "tortilleria en"
    ]) and not digitos_encontrados:
        # Detectar cantidad deseada (por defecto 10, hasta 30)
        cant_pedida = 10
        m_num = re.search(r"\b(\d{1,2})\b", msg_low)
        if m_num:
            try:
                v = int(m_num.group(1))
                if 1 <= v <= 30:
                    cant_pedida = v
            except Exception:
                pass

        # Cobertura completa de municipios y zonas
        muni_buscado = "Ecatepec"
        muni_dict = {
            "ecatepec": "Ecatepec",
            "tlalnepantla": "Tlalnepantla",
            "naucalpan": "Naucalpan",
            "tultitlan": "Tultitlan",
            "coacalco": "Coacalco",
            "izcalli": "Cuautitlan Izcalli",
            "cuautitlan izcalli": "Cuautitlan Izcalli",
            "cuautitlan": "Cuautitlan",
            "atizapan": "Atizapan",
            "tepotzotlan": "Tepotzotlan",
            "tecamac": "Tecamac",
            "chalco": "Chalco",
            "neza": "Nezahualcoyotl",
            "nezahualcoyotl": "Nezahualcoyotl",
            "gam": "Gustavo A. Madero",
            "gustavo a madero": "Gustavo A. Madero",
            "azcapotzalco": "Azcapotzalco",
            "iztapalapa": "Iztapalapa",
            "cuauhtemoc": "Cuauhtemoc",
            "cdmx": "CDMX",
            "ciudad de mexico": "CDMX",
            "puebla": "Puebla",
            "tlaxcala": "Tlaxcala"
        }
        for k_m, v_m in muni_dict.items():
            if k_m in msg_low:
                muni_buscado = v_m
                break

        usar_apify = any(w in msg_low for w in ["apify", "maps", "google", "facebook", "instagram", "redes"])
        try:
            env = motor_m1.cargar_env()
            es_cdmx = muni_buscado.upper() in ["CDMX", "GUSTAVO A. MADERO", "AZCAPOTZALCO", "IZTAPALAPA", "CUAUHTEMOC"]
            if usar_apify:
                estado_q = "Ciudad de Mexico" if es_cdmx else "Estado de Mexico"
                nuevos = motor_m1.extraer_apify_google_maps(f"Tortilleria en {muni_buscado}, {estado_q}, Mexico", max(cant_pedida * 2, 20), env.get("APIFY_API_TOKEN", ""))
                fuente_tag = "APIFY GOOGLE PLACES & REDES SOCIALES (LOCALES ABIERTOS)"
            else:
                ini = OFFSET_EXTRACCION_INEGI["actual"]
                OFFSET_EXTRACCION_INEGI["actual"] += cant_pedida * 2
                clave_ent = "09" if es_cdmx else ("21" if muni_buscado.upper() == "PUEBLA" else ("29" if muni_buscado.upper() == "TLAXCALA" else "15"))
                nuevos = motor_m1.extraer_inegi_por_municipio(f"tortilleria {muni_buscado.lower()}", clave_ent, max(cant_pedida * 2, 20), env.get("INEGI_DENUE_TOKEN", ""), reg_ini=ini)
                fuente_tag = "INEGI DENUE (COORDENADAS EXACTAS)"

            clasif = [motor_m1.clasificar_negocio(r, perfil) for r in nuevos if r.get("telefono")]
            motor_m1.guardar_y_exportar(clasif, perfil["id_cliente"])

            # FILTRO EN VIVO: Verificar cuáles tienen WhatsApp real descartando líneas fijas o sin WhatsApp
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("""
                SELECT id, telefono FROM prospectos_cazador
                WHERE id_cliente_agencia = ? AND (estatus_contacto_wa IS NULL OR estatus_contacto_wa IN ('PENDIENTE', 'PENDIENTE_ENVIO', ''))
                ORDER BY id DESC LIMIT ?
            """, (perfil["id_cliente"], len(clasif) + 10))
            lote_chk = [{"id": r[0], "telefono": r[1]} for r in cur.fetchall()]
            conn.close()

            chk_res = _llamar_bridge_wa("/verificar_lote_wa", {"prospectos": lote_chk}, timeout=20)
            con_wa = chk_res.get("con_whatsapp", 0)
            sin_wa = chk_res.get("sin_whatsapp", 0)

            # Tomar los prospectos verificados con WhatsApp activo
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("""
                SELECT nombre, telefono, municipio, google_maps_url FROM prospectos_cazador
                WHERE id_cliente_agencia = ? AND estatus_contacto_wa = 'VERIFICADO_WA'
                ORDER BY id DESC LIMIT 4
            """, (perfil["id_cliente"],))
            verificados_db = cur.fetchall()
            conn.close()

            bd_info = obtener_datos_completos_bd(perfil["id_cliente"])
            prospectos = bd_info["prospectos"]
            exportar_excel_en_vivo()
            enviar_excel_wa = True

            muestra_cazados = []
            for idx, r_v in enumerate(verificados_db):
                muestra_cazados.append(f"{idx+1}. *{r_v[0]}* ({r_v[2]}) - Tel: {r_v[1]} (WhatsApp Activo ✅) | Maps: {r_v[3]}")

            sep_nl = chr(10)
            cazados_txt = sep_nl.join(muestra_cazados) if muestra_cazados else "Prospectos verificados."
            accion_ejecutada = (
                f"SE CAZARON Y AUDITARON PROSPECTOS VÍA {fuente_tag} EN {muni_buscado.upper()}." + sep_nl +
                f"Filtro en vivo WhatsApp: {con_wa} tortillerías con WhatsApp ACTIVO verificado y {sin_wa} líneas fijas descartadas." + sep_nl +
                f"Tortillerías abiertas con WhatsApp comprobado:" + sep_nl + cazados_txt + sep_nl +
                f"Base total en Excel: {len(prospectos)} prospectos."
            )
        except Exception as e_hunt:
            accion_ejecutada = f"Aviso al cazar en {muni_buscado}: {e_hunt}"

    # 7. ¿Pidió campaña de marketing / textos para redes desde WhatsApp?
    elif any(k in msg_low for k in ["campana", "marketing", "post para", "publicacion", "guion tiktok", "estado de whatsapp"]) and not digitos_encontrados:
        res_mkt = generar_campana_marketing_ia("Ahorro $1,713 MXN vs Refaccionaria + Envío Gratis", "Edomex Norte y CDMX")
        pub = listar_publicidad_pau()
        if pub:
            fotos_enviar.append({"ruta": pub[-1]["ruta"], "caption": "🎨 Tu imagen de publicidad lista para acompañar este copy."})
        return {
            "ok": True,
            "respuesta_ceo": res_mkt.get("contenido", "Error generando campaña."),
            "accion_ejecutada": "CAMPAÑA DE MARKETING M5 GENERADA",
            "fotos_enviar": fotos_enviar,
            "ruta_excel": EXCEL_VIVO_PATH
        }

    if enviar_excel_wa:
        exportar_excel_en_vivo()
        accion_ejecutada = (accion_ejecutada or "") + " SE GENERÓ Y ADJUNTÓ EL ARCHIVO EXCEL ACTUALIZADO."

    # Consultar bitácora y estatus reales
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    hoy_pref = datetime.now().strftime("%Y-%m-%d")
    cur.execute("SELECT COUNT(*) FROM bitacora_envios_wa WHERE fecha_hora LIKE ?", (f"{hoy_pref}%",))
    mensajes_enviados_hoy = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM prospectos_cazador WHERE estatus_contacto_wa = 'CONTACTADO_WA'")
    total_contactados_historico = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM prospectos_cazador WHERE estatus_contacto_wa = 'VERIFICADO_WA'")
    total_verificados_wa = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM prospectos_cazador WHERE estatus_contacto_wa = 'SIN_WHATSAPP'")
    total_sin_wa = cur.fetchone()[0]
    conn.close()

    fotos_prod_reales = len(listar_imagenes_producto_reales())
    fotos_pub_reales = len(listar_publicidad_pau())

    conteo_muni = {}
    for p in prospectos:
        m = p["municipio"]
        conteo_muni[m] = conteo_muni.get(m, 0) + 1

    muestra_5 = "\n".join([
        f"- {p['nombre']} ({p['municipio']}) | Tel: {p['telefono']}"
        for p in prospectos[:5]
    ])
    total_ventas_mxn = sum(float(x["monto_venta"]) for x in pedidos)
    resumen_pedidos = "\n".join([
        f"- Folio {x['folio']}: {x['cliente_tortilleria']} ({x['municipio']}) | ${x['monto_venta']} MXN | {x['metodo_pago']} | Estatus: {x['estatus_entrega']}"
        for x in pedidos
    ]) if pedidos else "NINGÚN PEDIDO CERRADO TODAVÍA ($0.00 MXN vendidos hasta este momento)."

    conn_hist = sqlite3.connect(DB_PATH)
    cur_hist = conn_hist.cursor()
    cur_hist.execute("""
        CREATE TABLE IF NOT EXISTS conversacion_dueno (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rol TEXT NOT NULL,
            mensaje TEXT NOT NULL,
            session_id TEXT DEFAULT 'wa_dueno_5215648847438',
            fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur_hist.execute("PRAGMA table_info(conversacion_dueno)")
    cols_exist = [c[1] for c in cur_hist.fetchall()]
    if "session_id" not in cols_exist:
        try:
            cur_hist.execute("ALTER TABLE conversacion_dueno ADD COLUMN session_id TEXT DEFAULT 'wa_dueno_5215648847438'")
            conn_hist.commit()
        except Exception:
            pass
    cur_hist.execute("INSERT INTO conversacion_dueno (rol, mensaje, session_id) VALUES ('dueno', ?, ?)", (mensaje_paola, session_id))
    conn_hist.commit()
    cur_hist.execute("SELECT rol, mensaje FROM conversacion_dueno WHERE session_id = ? ORDER BY id DESC LIMIT 8", (session_id,))
    filas_hist = cur_hist.fetchall()
    conn_hist.close()
    filas_hist.reverse()
    previos_h = filas_hist[:-1]
    historial_hilo = "\n".join([f"- {'Dueño' if r[0] == 'dueno' else 'Agente CDO'}: {r[1]}" for r in previos_h]) if previos_h else "(Inicio de conversación)"

    prompt_cdo = f"""
Eres **Maximus**, el asistente ejecutivo personal de Inteligencia Artificial exclusivo para los dueños de **Mallas Tlaxcalli** (Ing. Paola Almanza / Ing. Rocha).
Te escriben directamente desde su WhatsApp personal o desde su panel de control conectado al sistema.

HISTORIAL RECIENTE DE LA CONVERSACIÓN CON EL DUEÑO (SIGUE ESTE HILO CONVERSACIONAL DE FORMA FLUIDA Y NATURAL):
{historial_hilo}


DATOS 100% REALES Y AUDITADOS EN ESTE SEGUNDO (PROHIBIDO INVENTAR NADA):
- Total de Tortillerías Aprobadas en Excel / BD: {len(prospectos)} tortillerías en cobertura (con link exacto Google Maps).
- Desglose por municipio: {json.dumps(conteo_muni, ensure_ascii=False)}
- Estado WhatsApp de la base: {total_verificados_wa} verificadas con WA | {total_contactados_historico} ya contactadas por WA | {total_sin_wa} teléfonos fijos (sin WA) | {max(0, len(prospectos) - total_verificados_wa - total_contactados_historico - total_sin_wa)} pendientes de validar al conectar WhatsApp.
- Mensajes de WhatsApp enviados HOY: {mensajes_enviados_hoy} de {ESTADO_MOTOR_50_DIARIOS['meta_diaria']}
- Meta diaria configurada: 50 a 80 mensajes diarios de prospección.
- Estado del Motor Automático: {"ACTIVO (enviando prospección en horario comercial)" if ESTADO_MOTOR_50_DIARIOS["activo"] else "EN PAUSA (dime 'Activa los envíos' para arrancar)"}
- Fotos reales cargadas vía WhatsApp: {fotos_prod_reales} fotos de producto (para Ventas) | {fotos_pub_reales} imágenes de publicidad.
- Pedidos Cerrados Reales: {len(pedidos)} pedidos (${total_ventas_mxn:,.2f} MXN reales)
- Detalle de Pedidos: {resumen_pedidos}
- Muestra reciente del Excel:
{muestra_5}
- Acción recién ejecutada: {accion_ejecutada or 'Consulta Ejecutiva en Tiempo Real'}

REGLAS ESTRICTAS DE RESPUESTA:
1. Responde completo, claro y directo al grano (2 a 5 renglones máximo, nunca cortes la frase).
2. Si preguntan qué puedes hacer o cuáles son tus capacidades, lista claramente tus 6 funciones reales hoy:
   • Reportes en vivo y envío del Excel actualizado de tortillerías.
   • Verificar en automático cuáles de los números pendientes sí tienen WhatsApp ("Verifica WhatsApp").
   • Buscar nuevas tortillerías por municipio ("Busca 10 tortillerías en...").
   • Crear o editar flyers publicitarios con IA directo aquí (o mejorar fotos que te manden).
   • Activar o pausar los envíos en frío ("Activa los envíos" / "Pausa los envíos").
   • Mandarle mensaje directo a un número nuevo que te pasen.
3. Si te piden nota de voz o audio: responde natural, breve y amigable porque el sistema enviará tu respuesta en nota de voz.
4. Si preguntan por el desglose por municipio, lista los 5 municipios principales con su número exacto de tortillerías.
5. Cero inventos de ventas. Si hay 0 pedidos cerrados, di 0 con total honestidad.
6. Tono mexicano, cálido, seguro y ejecutivo.

Mensaje del dueño/a: "{mensaje_paola}"
"""
    llaves = obtener_llaves_ia_backend()
    for modelo in MODELOS_POOL_INFINITO:
        gen_cfg = {"temperature": 0.25, "maxOutputTokens": 1500}
        if "2.5" in modelo:
            gen_cfg["thinkingConfig"] = {"thinkingBudget": 0}
        payload = {
            "contents": [{"parts": [{"text": prompt_cdo}]}],
            "generationConfig": gen_cfg,
        }
        for key in llaves:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=18) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    txt = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    try:
                        conn_h2 = sqlite3.connect(DB_PATH)
                        conn_h2.cursor().execute("INSERT INTO conversacion_dueno (rol, mensaje) VALUES ('cdo', ?)", (txt,))
                        conn_h2.commit()
                        conn_h2.close()
                    except Exception:
                        pass
                    return {
                        "ok": True,
                        "respuesta_ceo": txt,
                        "accion_ejecutada": accion_ejecutada,
                        "link_wa_directo": link_wa_directo,
                        "fotos_enviar": fotos_enviar,
                        "enviar_excel_wa": enviar_excel_wa,
                        "ruta_excel": EXCEL_VIVO_PATH,
                        "mensajes_enviados_hoy": mensajes_enviados_hoy,
                        "pedidos_reales": len(pedidos),
                        "cola_pendiente": COLA_MENSAJES_PAOLA[-5:],
                        "modelo": modelo
                    }
            except Exception:
                continue
    return {"ok": False, "respuesta_ceo": "Error temporal en el Agente CDO."}



CACHE_GEOCODING_RUTA = {}

CENTROIDES_MUNICIPIOS_MX = {
    "cuauhtemoc": (19.4326, -99.1332),
    "centro": (19.4326, -99.1332),
    "cdmx": (19.4326, -99.1332),
    "benito juarez": (19.3984, -99.1577),
    "coyoacan": (19.3467, -99.1617),
    "miguel hidalgo": (19.4326, -99.2000),
    "azcapotzalco": (19.4869, -99.1859),
    "gustavo a. madero": (19.4873, -99.1236),
    "gustavo a madero": (19.4873, -99.1236),
    "gam": (19.4873, -99.1236),
    "venustiano carranza": (19.4239, -99.1074),
    "iztacalco": (19.3953, -99.0975),
    "iztapalapa": (19.3553, -99.0622),
    "tlahuac": (19.2869, -99.0051),
    "xochimilco": (19.2572, -99.1030),
    "tlalpan": (19.2897, -99.1672),
    "alvaro obregon": (19.3587, -99.2225),
    "cuajimalpa": (19.3556, -99.2997),
    "magdalena contreras": (19.3220, -99.2392),
    "milpa alta": (19.1922, -99.0231),
    "ecatepec": (19.6018, -99.0507),
    "nezahualcoyotl": (19.4006, -99.0148),
    "neza": (19.4006, -99.0148),
    "tlalnepantla": (19.5367, -99.1948),
    "naucalpan": (19.4785, -99.2396),
    "atizapan": (19.5562, -99.2675),
    "cuautitlan izcalli": (19.6458, -99.2163),
    "cuautitlan": (19.6710, -99.1804),
    "tultitlan": (19.6450, -99.1685),
    "coacalco": (19.6319, -99.1009),
    "tecámac": (19.7128, -98.9689),
    "tecamac": (19.7128, -98.9689),
    "chimalhuacan": (19.4208, -98.9535),
    "texcoco": (19.5118, -98.8829),
    "los reyes la paz": (19.3606, -98.9774),
    "la paz": (19.3606, -98.9774),
    "ixtapaluca": (19.3142, -98.8822),
    "valle de chalco": (19.2917, -98.9389),
    "chalco": (19.2647, -98.8975),
    "huixquilucan": (19.3622, -99.3497),
    "metepec": (19.2519, -99.6047),
    "toluca": (19.2826, -99.6557),
    "lerma": (19.2858, -99.5117),
    "zumpango": (19.7969, -99.0989),
    "nicolas romero": (19.6267, -99.3144),
    "puebla": (19.0414, -98.2063),
    "queretaro": (20.5888, -100.3899),
    "pachuca": (20.1011, -98.7591),
    "cuernavaca": (18.9242, -99.2216),
    "guadalajara": (20.6597, -103.3496),
    "monterrey": (25.6866, -100.3161),
}


def _distancia_haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r * c


def _geocodificar_direccion_ruta(direccion: str, municipio: str = "", t_inicio_global: float = 0.0) -> tuple:
    dir_clean = str(direccion or "").strip()
    muni_clean = str(municipio or "").strip()
    key_raw = f"{dir_clean}|{muni_clean}".lower().strip()
    if key_raw in CACHE_GEOCODING_RUTA:
        return CACHE_GEOCODING_RUTA[key_raw]

    # 1. Revisar si la cadena incluye coordenadas explícitas lat,lng
    m_coord = re.search(r"(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})", f"{dir_clean} {muni_clean}")
    if m_coord:
        try:
            lat_val = float(m_coord.group(1))
            lng_val = float(m_coord.group(2))
            if -90 <= lat_val <= 90 and -180 <= lng_val <= 180:
                CACHE_GEOCODING_RUTA[key_raw] = (lat_val, lng_val)
                return (lat_val, lng_val)
        except Exception:
            pass

    # 2. Intentar Nominatim dentro del presupuesto máximo de 5.5 segundos
    presupuesto_ok = (t_inicio_global <= 0.0) or ((time.time() - t_inicio_global) < 5.2)
    if presupuesto_ok and (dir_clean or muni_clean):
        q_parts = [p for p in [dir_clean, muni_clean, "Mexico"] if p]
        q_str = ", ".join(q_parts)
        try:
            url_nom = f"https://nominatim.openstreetmap.org/search?format=json&limit=1&q={urllib.parse.quote(q_str)}"
            req = urllib.request.Request(
                url_nom,
                headers={"User-Agent": "BlitzrLogistics/1.0 (logistica@blitzr.mx)"}
            )
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                datos_nom = json.loads(resp.read().decode("utf-8", errors="ignore"))
                if isinstance(datos_nom, list) and len(datos_nom) > 0:
                    lat_nom = float(datos_nom[0]["lat"])
                    lon_nom = float(datos_nom[0]["lon"])
                    CACHE_GEOCODING_RUTA[key_raw] = (lat_nom, lon_nom)
                    return (lat_nom, lon_nom)
        except Exception:
            pass

    # 3. Fallback determinista por centroide municipal + micro-offset por calle
    import hashlib
    texto_busqueda = _quitar_acentos_visual(f"{muni_clean} {dir_clean}".lower())
    base_lat, base_lon = (19.4326, -99.1332)
    matched_muni = False
    for k_muni, coords_muni in CENTROIDES_MUNICIPIOS_MX.items():
        if k_muni in texto_busqueda:
            base_lat, base_lon = coords_muni
            matched_muni = True
            break

    h_digest = hashlib.md5(key_raw.encode("utf-8", errors="ignore")).hexdigest()
    # Si encontramos el municipio, variamos +-0.008 grados (~800m); si no, variamos +-0.04 grados
    amplitud = 0.008 if matched_muni else 0.035
    off_lat = ((int(h_digest[:4], 16) / 65535.0) - 0.5) * 2.0 * amplitud
    off_lon = ((int(h_digest[4:8], 16) / 65535.0) - 0.5) * 2.0 * amplitud
    res_coords = (round(base_lat + off_lat, 6), round(base_lon + off_lon, 6))
    CACHE_GEOCODING_RUTA[key_raw] = res_coords
    return res_coords


def _extraer_hora_inicio_num(horario_str: str) -> float:
    txt = str(horario_str or "").strip().lower()
    if not txt:
        return 12.0
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|hrs|horas)?", txt)
    if not m:
        return 12.0
    hora = int(m.group(1))
    minuto = int(m.group(2) or 0)
    ampm = (m.group(3) or "").replace(".", "")
    if ampm == "pm" and hora < 12:
        hora += 12
    elif ampm == "am" and hora == 12:
        hora = 0
    elif not ampm and 1 <= hora <= 6:
        # Si dice "2 a 5" sin AM/PM suele ser 14:00
        if "tarde" in txt:
            hora += 12
    return float(hora) + (minuto / 60.0)


def optimizar_ruta_paradas(punto_partida: str, estrategia: str, paradas: list) -> dict:
    t0 = time.time()
    origen_txt = str(punto_partida or "").strip() or "Centro CDMX, Cuauhtemoc"
    estrategia_norm = str(estrategia or "cercanos_primero").strip().lower()
    if estrategia_norm not in ("cercanos_primero", "lejanos_primero", "por_horario"):
        estrategia_norm = "cercanos_primero"

    lat_orig, lon_orig = _geocodificar_direccion_ruta(origen_txt, "", t0)

    pendientes = []
    for idx, p in enumerate(paradas or []):
        if not isinstance(p, dict):
            continue
        item = dict(p)
        dir_p = str(item.get("direccion_gps") or item.get("direccion") or "").strip()
        muni_p = str(item.get("municipio") or "").strip()
        lat_p, lon_p = _geocodificar_direccion_ruta(dir_p, muni_p, t0)
        dist_orig = _distancia_haversine_km(lat_orig, lon_orig, lat_p, lon_p)
        hora_num = _extraer_hora_inicio_num(str(item.get("horario_recepcion") or item.get("horario") or ""))
        item["_lat"] = lat_p
        item["_lon"] = lon_p
        item["_dist_origen"] = dist_orig
        item["_hora_num"] = hora_num
        item["_idx_orig"] = idx
        pendientes.append(item)

    ordenadas = []
    curr_lat, curr_lon = lat_orig, lon_orig
    dist_acumulada = 0.0

    if estrategia_norm == "por_horario":
        # Ordenar cronológicamente por horario y desempatar por cercanía al punto actual
        while pendientes:
            min_hora = min(x["_hora_num"] for x in pendientes)
            candidatos_hora = [x for x in pendientes if abs(x["_hora_num"] - min_hora) <= 0.25]
            elegido = min(
                candidatos_hora,
                key=lambda x: _distancia_haversine_km(curr_lat, curr_lon, x["_lat"], x["_lon"])
            )
            pendientes.remove(elegido)
            dist_tramo = _distancia_haversine_km(curr_lat, curr_lon, elegido["_lat"], elegido["_lon"])
            dist_acumulada += dist_tramo
            curr_lat, curr_lon = elegido["_lat"], elegido["_lon"]
            orden_num = len(ordenadas) + 1
            horario_lbl = str(elegido.get("horario_recepcion") or "Horario abierto").strip()
            elegido["orden_parada"] = orden_num
            elegido["distancia_tramo_km"] = round(dist_tramo, 1)
            elegido["distancia_origen_km"] = round(elegido["_dist_origen"], 1)
            elegido["motivo_orden"] = f"Prioridad por horario ({horario_lbl}) • +{round(dist_tramo, 1)} km"
            ordenadas.append(elegido)

    elif estrategia_norm == "lejanos_primero":
        # 1. Arrancar en la parada más retirada del punto de partida
        if pendientes:
            primero = max(pendientes, key=lambda x: x["_dist_origen"])
            pendientes.remove(primero)
            dist_tramo = _distancia_haversine_km(curr_lat, curr_lon, primero["_lat"], primero["_lon"])
            dist_acumulada += dist_tramo
            curr_lat, curr_lon = primero["_lat"], primero["_lon"]
            primero["orden_parada"] = 1
            primero["distancia_tramo_km"] = round(dist_tramo, 1)
            primero["distancia_origen_km"] = round(primero["_dist_origen"], 1)
            primero["motivo_orden"] = f"Punto más lejano a {round(primero['_dist_origen'], 1)} km del origen (inicio retorno)"
            ordenadas.append(primero)

        # 2. Encadenar el regreso hacia el punto de partida
        while pendientes:
            elegido = min(
                pendientes,
                key=lambda x: (
                    _distancia_haversine_km(curr_lat, curr_lon, x["_lat"], x["_lon"]) * 0.7
                    + x["_dist_origen"] * 0.3
                )
            )
            pendientes.remove(elegido)
            dist_tramo = _distancia_haversine_km(curr_lat, curr_lon, elegido["_lat"], elegido["_lon"])
            dist_acumulada += dist_tramo
            curr_lat, curr_lon = elegido["_lat"], elegido["_lon"]
            orden_num = len(ordenadas) + 1
            elegido["orden_parada"] = orden_num
            elegido["distancia_tramo_km"] = round(dist_tramo, 1)
            elegido["distancia_origen_km"] = round(elegido["_dist_origen"], 1)
            elegido["motivo_orden"] = f"Retorno hacia origen • Tramo +{round(dist_tramo, 1)} km (a {round(elegido['_dist_origen'], 1)} km de base)"
            ordenadas.append(elegido)

    else:
        # cercanos_primero (Vecino más cercano desde el punto de partida)
        while pendientes:
            elegido = min(
                pendientes,
                key=lambda x: _distancia_haversine_km(curr_lat, curr_lon, x["_lat"], x["_lon"])
            )
            pendientes.remove(elegido)
            dist_tramo = _distancia_haversine_km(curr_lat, curr_lon, elegido["_lat"], elegido["_lon"])
            dist_acumulada += dist_tramo
            curr_lat, curr_lon = elegido["_lat"], elegido["_lon"]
            orden_num = len(ordenadas) + 1
            elegido["orden_parada"] = orden_num
            elegido["distancia_tramo_km"] = round(dist_tramo, 1)
            elegido["distancia_origen_km"] = round(elegido["_dist_origen"], 1)
            if orden_num == 1:
                elegido["motivo_orden"] = f"Más cercano al punto de partida ({round(dist_tramo, 1)} km)"
            else:
                elegido["motivo_orden"] = f"Siguiente más cercano • Tramo +{round(dist_tramo, 1)} km"
            ordenadas.append(elegido)

    # Limpiar llaves internas y construir URL multi-parada de Google Maps (máximo 9 paradas)
    segmentos_maps = [urllib.parse.quote(f"{origen_txt}, Mexico", safe="")]
    for p_ord in ordenadas[:9]:
        dir_g = str(p_ord.get("direccion_gps") or "").strip()
        muni_g = str(p_ord.get("municipio") or "").strip()
        destino_str = ", ".join([x for x in [dir_g, muni_g, "Mexico"] if x]) or "CDMX, Mexico"
        segmentos_maps.append(urllib.parse.quote(destino_str, safe=""))

    for p_ord in ordenadas:
        p_ord["lat"] = p_ord.pop("_lat", None)
        p_ord["lng"] = p_ord.pop("_lon", None)
        p_ord.pop("_dist_origen", None)
        p_ord.pop("_hora_num", None)
        p_ord.pop("_idx_orig", None)

    google_maps_multi_url = "https://www.google.com/maps/dir/" + "/".join(segmentos_maps)

    return {
        "ok": True,
        "punto_partida": origen_txt,
        "coords_origen": {"lat": lat_orig, "lng": lon_orig},
        "estrategia": estrategia_norm,
        "distancia_total_km": round(dist_acumulada, 1),
        "total_paradas": len(ordenadas),
        "google_maps_multi_url": google_maps_multi_url,
        "paradas_ordenadas": ordenadas,
    }


ESTADO_ULTIMO_FLYER_DUENO = {
    "titulo": "PAQUETE COMPLETO DE MANTENIMIENTO",
    "subtitulo": "Malla Testalera + Transportadora Calibre 14 + Balero 7210B Aleman",
    "badge": "ENVIO GRATIS CDMX Y EDOMEX",
    "precio": "$1,713 MXN",
    "precioAnterior": "$2,700 MXN",
    "tema": "industrial",
    "brillo": 0.03,
    "contraste": 1.06,
    "saturacion": 1.12,
    "zoom": 1.0
}

def _quitar_acentos_visual(txt: str) -> str:
    if not txt:
        return ""
    reemplazos = str.maketrans("áéíóúÁÉÍÓÚäëïöüÄËÏÖÜ", "aeiouAEIOUaeiouAEIOU")
    return str(txt).translate(reemplazos)

def procesar_edicion_flyer_ia(instruccion: str, base64_img: str = None, es_nueva_foto: bool = False) -> dict:
    global ESTADO_ULTIMO_FLYER_DUENO
    carpeta_prod = os.path.join(BASE_DIR, "imagenes_negocio_pau")
    carpeta_pub = os.path.join(BASE_DIR, "publicidad_pau")
    os.makedirs(carpeta_prod, exist_ok=True)
    os.makedirs(carpeta_pub, exist_ok=True)
    ruta_base_dueno = os.path.join(carpeta_prod, "ultima_base_dueno.jpg")

    if base64_img:
        try:
            clean_b64 = re.sub(r"^data:image/\w+;base64,", "", base64_img)
            with open(ruta_base_dueno, "wb") as fp:
                fp.write(base64.b64decode(clean_b64))
        except Exception as e_b64:
            print("Error guardando base64_img:", e_b64)

    if not os.path.exists(ruta_base_dueno):
        fotos_exist = listar_imagenes_producto_reales()
        if fotos_exist:
            import shutil
            shutil.copy2(fotos_exist[0]["ruta"], ruta_base_dueno)

    if es_nueva_foto and (not instruccion or instruccion.strip().lower() in ("publicidad redes sociales", "paquete mantenimiento mallas tlaxcalli")):
        ESTADO_ULTIMO_FLYER_DUENO = {
            "titulo": "PAQUETE COMPLETO DE MANTENIMIENTO",
            "subtitulo": "Malla Testalera + Transportadora Calibre 14 + Balero 7210B Aleman",
            "badge": "ENVIO GRATIS CDMX Y EDOMEX",
            "precio": "$1,713 MXN",
            "precioAnterior": "$2,700 MXN",
            "tema": "industrial",
            "brillo": 0.04,
            "contraste": 1.06,
            "saturacion": 1.12,
            "zoom": 1.0
        }
        resumen_cambios = "Iluminación optimizada y diseño industrial aplicado."
    else:
        resumen_cambios = "Ajustes aplicados al diseño publicitario."
        if instruccion and instruccion.strip():
            prompt_edit = f"""Eres el motor de edición gráfica de Blitzr Studio para Mallas Tlaxcalli.
Estado actual del flyer:
{json.dumps(ESTADO_ULTIMO_FLYER_DUENO, ensure_ascii=False)}

El usuario pidió esta modificación o instrucción: "{instruccion}"

Actualiza ÚNICAMENTE los campos que el usuario pidió cambiar (mantén los demás igual para conservar sus cambios previos).
Reglas de campos:
- "titulo": Texto principal en MAYUSCULAS SIN ACENTOS (máx 38 caracteres). Si pidió cambiar el título o texto principal, pon lo que pidió.
- "subtitulo": Texto secundario SIN ACENTOS (máx 95 caracteres). Si pidió agregar o cambiar algún detalle, teléfono, frase o especificación, ponlo aquí.
- "badge": Etiqueta superior en MAYUSCULAS SIN ACENTOS (máx 30 caracteres).
- "precio": Precio en formato "$1,713 MXN" (si pidió cambiar precio a otro número, actualízalo).
- "precioAnterior": Precio anterior ej. "$2,700 MXN" (si pidió quitar el precio anterior, pon "").
- "tema": Elige entre "industrial" (oscuro/ámbar/verde), "promo" (rojo/amarillo/dorado/oferta), o "catalogo" (azul/celeste/corporativo). Si pidió color rojo/amarillo/oferta usa "promo"; si pidió azul/limpio usa "catalogo"; si pidió oscuro/negro/industrial usa "industrial".
- "brillo": float entre -0.15 y 0.25 (default 0.03). Si pidió más luz/brillo/aclarar, súbelo a 0.14. Si pidió más oscuro, bájalo a -0.06.
- "contraste": float entre 0.90 y 1.35 (default 1.06). Si pidió más contraste o fuerza, pon 1.18.
- "saturacion": float entre 0.0 y 1.60 (default 1.12). Si pidió blanco y negro pon 0.0; si pidió más color pon 1.35.
- "zoom": float entre 1.0 y 1.45 (default 1.0). Si pidió acercar, zoom o agrandar la pieza, pon 1.25.
- "resumen_cambios": Una frase breve en español (máx 18 palabras) diciendo qué detalle cambiaste exactamente.

Devuelve SOLO un objeto JSON válido con esas llaves."""
            llaves = obtener_llaves_ia_backend()
            # Reglas deterministas inmediatas de respaldo por si la IA tarda o trunca
            inst_low = _quitar_acentos_visual(instruccion).lower()
            cambios_det = []
            if any(w in inst_low for w in ["rojo", "amarillo", "dorado", "promo", "oferta", "buen fin"]):
                ESTADO_ULTIMO_FLYER_DUENO["tema"] = "promo"
                cambios_det.append("color rojo promoción")
            elif any(w in inst_low for w in ["azul", "celeste", "catalogo", "corporativo", "limpio"]):
                ESTADO_ULTIMO_FLYER_DUENO["tema"] = "catalogo"
                cambios_det.append("estilo catálogo azul")
            elif any(w in inst_low for w in ["negro", "oscuro", "industrial", "taller"]):
                ESTADO_ULTIMO_FLYER_DUENO["tema"] = "industrial"
                cambios_det.append("tema industrial oscuro")

            m_precio = re.search(r"(?:precio|en|a|por)\s*\$?\s*(\d[\d,]{2,4})\b", inst_low)
            if m_precio:
                val_p = m_precio.group(1).replace(",", "")
                if len(val_p) == 4:
                    val_p = val_p[0] + "," + val_p[1:]
                ESTADO_ULTIMO_FLYER_DUENO["precio"] = f"${val_p} MXN"
                cambios_det.append(f"precio a ${val_p} MXN")

            if "quita" in inst_low and "anterior" in inst_low:
                ESTADO_ULTIMO_FLYER_DUENO["precioAnterior"] = ""
                cambios_det.append("sin precio anterior")

            if any(w in inst_low for w in ["mas luz", "mas brillo", "ilumina", "aclar"]):
                ESTADO_ULTIMO_FLYER_DUENO["brillo"] = 0.14
                cambios_det.append("+iluminación")
            elif any(w in inst_low for w in ["menos luz", "mas oscur"]):
                ESTADO_ULTIMO_FLYER_DUENO["brillo"] = -0.06
                cambios_det.append("tono más oscuro")

            if any(w in inst_low for w in ["zoom", "mas cerca", "acerca", "agranda"]):
                ESTADO_ULTIMO_FLYER_DUENO["zoom"] = 1.25
                cambios_det.append("zoom 1.25x en la pieza")

            m_tit = re.search(r"(?:titulo|que diga)\s+['\"]?([a-zA-Z0-9\s]{4,36}?)(?:['\"]|\s+y\s+|\s+en\s+color|,|$)", _quitar_acentos_visual(instruccion), flags=re.I)
            if m_tit:
                ESTADO_ULTIMO_FLYER_DUENO["titulo"] = m_tit.group(1).strip().upper()
                cambios_det.append(f"título '{ESTADO_ULTIMO_FLYER_DUENO['titulo']}'")

            if cambios_det:
                resumen_cambios = "Ajustes aplicados: " + ", ".join(cambios_det) + "."

            payload_ia = {
                "contents": [{"parts": [{"text": prompt_edit}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 900,
                    "thinkingConfig": {"thinkingBudget": 0}
                }
            }
            for mod_e in ["gemini-2.5-flash", "gemini-2.5-flash-lite"]:
                romper = False
                for key in llaves:
                    try:
                        url_e = f"https://generativelanguage.googleapis.com/v1beta/models/{mod_e}:generateContent?key={key}"
                        req_e = urllib.request.Request(url_e, data=json.dumps(payload_ia).encode("utf-8"), headers={"Content-Type": "application/json"})
                        with urllib.request.urlopen(req_e, context=SSL_CTX, timeout=12) as resp_e:
                            d_e = json.loads(resp_e.read().decode("utf-8"))
                            txt_json = d_e["candidates"][0]["content"]["parts"][0]["text"].strip()
                            parsed_e = json.loads(txt_json)
                            for k_f in ("titulo", "subtitulo", "badge", "precio", "precioAnterior", "tema"):
                                if k_f in parsed_e and parsed_e[k_f] is not None:
                                    val_str = str(parsed_e[k_f])
                                    if k_f in ("titulo", "subtitulo", "badge"):
                                        val_str = _quitar_acentos_visual(val_str)
                                    ESTADO_ULTIMO_FLYER_DUENO[k_f] = val_str
                            for k_num in ("brillo", "contraste", "saturacion", "zoom"):
                                if k_num in parsed_e and parsed_e[k_num] is not None:
                                    ESTADO_ULTIMO_FLYER_DUENO[k_num] = float(parsed_e[k_num])
                            if parsed_e.get("resumen_cambios"):
                                resumen_cambios = str(parsed_e["resumen_cambios"])
                            romper = True
                            break
                    except Exception as err_parse:
                        print("Error parseando edicion IA:", err_parse)
                        continue
                if romper:
                    break

    ts = int(datetime.now().timestamp() * 1000)
    nombre_temp = f"edit_activa_{ts}.jpg"
    ruta_temp = os.path.join(carpeta_prod, nombre_temp)

    brillo = max(-0.2, min(0.3, float(ESTADO_ULTIMO_FLYER_DUENO.get("brillo", 0.03))))
    contraste = max(0.8, min(1.5, float(ESTADO_ULTIMO_FLYER_DUENO.get("contraste", 1.06))))
    saturacion = max(0.0, min(1.8, float(ESTADO_ULTIMO_FLYER_DUENO.get("saturacion", 1.12))))
    zoom = max(1.0, min(1.6, float(ESTADO_ULTIMO_FLYER_DUENO.get("zoom", 1.0))))

    vf_parts = []
    if zoom > 1.02:
        vf_parts.append(f"crop=iw/{zoom:.2f}:ih/{zoom:.2f}:(iw-iw/{zoom:.2f})/2:(ih-ih/{zoom:.2f})/2")
    vf_parts.append("scale=960:740:force_original_aspect_ratio=increase,crop=960:740")
    vf_parts.append(f"eq=brightness={brillo:.2f}:contrast={contraste:.2f}:saturation={saturacion:.2f}")
    vf_parts.append("unsharp=5:5:0.8:5:5:0.0")
    vf_str = ",".join(vf_parts)

    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", ruta_base_dueno, "-vf", vf_str, "-q:v", "2", ruta_temp],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
        )
    except Exception:
        import shutil
        shutil.copy2(ruta_base_dueno, ruta_temp)

    params_og = urllib.parse.urlencode({
        "title": ESTADO_ULTIMO_FLYER_DUENO["titulo"][:44].upper(),
        "hook": ESTADO_ULTIMO_FLYER_DUENO["subtitulo"][:110],
        "badge": ESTADO_ULTIMO_FLYER_DUENO["badge"][:32].upper(),
        "price": ESTADO_ULTIMO_FLYER_DUENO["precio"],
        "oldPrice": ESTADO_ULTIMO_FLYER_DUENO["precioAnterior"],
        "theme": ESTADO_ULTIMO_FLYER_DUENO["tema"] if ESTADO_ULTIMO_FLYER_DUENO["tema"] in ("industrial", "promo", "catalogo") else "industrial",
        "ratio": "feed",
        "imageUrl": f"http://127.0.0.1:8090/api/imagen_pau?file={urllib.parse.quote(nombre_temp)}"
    })
    url_og = f"http://127.0.0.1:3010/api/og/banner?{params_og}"
    ruta_out_jpg = os.path.join(carpeta_pub, f"flyer_blitzr_{ts}.jpg")
    ruta_png_tmp = f"/tmp/og_{ts}.png"

    try:
        req_og = urllib.request.Request(url_og)
        with urllib.request.urlopen(req_og, timeout=15) as resp_og:
            png_bytes = resp_og.read()
        with open(ruta_png_tmp, "wb") as fp:
            fp.write(png_bytes)
        subprocess.run(
            ["ffmpeg", "-y", "-i", ruta_png_tmp, "-q:v", "2", ruta_out_jpg],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
        )
        jpg_bytes = open(ruta_out_jpg, "rb").read()
        b64_out = "data:image/jpeg;base64," + base64.b64encode(jpg_bytes).decode("ascii")
        return {
            "ok": True,
            "base64_resultado": b64_out,
            "resumen_cambios": resumen_cambios,
            "estado_flyer": ESTADO_ULTIMO_FLYER_DUENO,
            "ruta_guardada": ruta_out_jpg
        }
    except Exception as e_og:
        return {"ok": False, "error": str(e_og)}
    finally:
        for f_cl in (ruta_temp, ruta_png_tmp):
            try:
                if os.path.exists(f_cl):
                    os.remove(f_cl)
            except Exception:
                pass


# ==============================================================================
# 4. CONSULTAS SQLITE DE MÓDULOS 1, 3 Y 4
# ==============================================================================

def obtener_datos_completos_bd(id_cliente: str) -> dict:
    if not id_cliente or str(id_cliente).strip() == "__SIN_PERFIL__":
        return {
            "prospectos": [],
            "pedidos": [],
            "seguimientos": [],
            "bitacora_total": 0,
            "bitacora_hoy": 0
        }
    es_todos = str(id_cliente or "").upper() == "TODOS"
    cid_norm = "TODOS" if es_todos else motor_m1.normalizar_cliente_id(id_cliente)
    _, aprobados_db, _ = motor_m1.guardar_y_exportar([], cid_norm)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Mapear estatus_maps de cada teléfono y cliente
    if es_todos:
        cur.execute("SELECT LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')), telefono, estatus_maps FROM prospectos_cazador")
    else:
        cur.execute(
            "SELECT LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')), telefono, estatus_maps FROM prospectos_cazador WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)",
            (cid_norm,)
        )
    mapa_estatus = {(r[0], r[1]): (r[2] or "PENDIENTE_VERIFICAR") for r in cur.fetchall()}
    for p in aprobados_db:
        cid_p = motor_m1.normalizar_cliente_id(p.get("id_cliente_agencia", cid_norm)).lower()
        p["estatus_maps"] = mapa_estatus.get((cid_p, p["telefono"]), "PENDIENTE_VERIFICAR")

    # Métricas de bitácora de envíos WA por nicho
    hoy_pref = datetime.now().strftime("%Y-%m-%d")
    if es_todos:
        cur.execute("SELECT COUNT(*) FROM bitacora_envios_wa")
        bit_total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM bitacora_envios_wa WHERE fecha_hora LIKE ?", (f"{hoy_pref}%",))
        bit_hoy = cur.fetchone()[0]
    else:
        cur.execute(
            "SELECT COUNT(*) FROM bitacora_envios_wa WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)",
            (cid_norm,)
        )
        bit_total = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM bitacora_envios_wa WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?) AND fecha_hora LIKE ?",
            (cid_norm, f"{hoy_pref}%")
        )
        bit_hoy = cur.fetchone()[0]

    # Módulo 3: Pedidos y Comisiones (aislados por id_cliente_agencia)
    if es_todos:
        cur.execute("""
            SELECT id, folio, cliente_tortilleria, telefono, direccion_gps, municipio,
                   horario_recepcion, metodo_pago, tipo_pedido, monto_venta,
                   comision_agencia, estatus_entrega, google_maps_url, fecha_cierre
            FROM pedidos_comisiones
            ORDER BY id DESC
        """)
    else:
        cur.execute("""
            SELECT id, folio, cliente_tortilleria, telefono, direccion_gps, municipio,
                   horario_recepcion, metodo_pago, tipo_pedido, monto_venta,
                   comision_agencia, estatus_entrega, google_maps_url, fecha_cierre
            FROM pedidos_comisiones
            WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)
            ORDER BY id DESC
        """, (cid_norm,))
    pedidos = []
    for r in cur.fetchall():
        pedidos.append({
            "id": r[0],
            "folio": r[1],
            "cliente_tortilleria": r[2],
            "telefono": r[3],
            "direccion_gps": r[4],
            "municipio": r[5],
            "horario_recepcion": r[6],
            "metodo_pago": r[7],
            "tipo_pedido": r[8],
            "monto_venta": r[9],
            "comision_agencia": r[10],
            "estatus_entrega": r[11],
            "google_maps_url": r[12],
            "fecha_cierre": r[13]
        })

    # Módulo 4: Seguimiento (aislado por id_cliente_agencia)
    if es_todos:
        cur.execute("""
            SELECT id, nombre_tortilleria, telefono, municipio, etapa_seguimiento,
                   ultimo_mensaje_cliente, dias_transcurridos, mensaje_ia_sugerido, estatus
            FROM seguimiento_clientes
            ORDER BY id ASC
        """)
    else:
        cur.execute("""
            SELECT id, nombre_tortilleria, telefono, municipio, etapa_seguimiento,
                   ultimo_mensaje_cliente, dias_transcurridos, mensaje_ia_sugerido, estatus
            FROM seguimiento_clientes
            WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)
            ORDER BY id ASC
        """, (cid_norm,))
    seguimientos = []
    for r in cur.fetchall():
        seguimientos.append({
            "id": r[0],
            "nombre_tortilleria": r[1],
            "telefono": r[2],
            "municipio": r[3],
            "etapa_seguimiento": r[4],
            "ultimo_mensaje_cliente": r[5],
            "dias_transcurridos": r[6],
            "mensaje_ia_sugerido": r[7],
            "estatus": r[8]
        })

    conn.close()
    return {
        "prospectos": aprobados_db,
        "pedidos": pedidos,
        "seguimientos": seguimientos,
        "bitacora_total": bit_total,
        "bitacora_hoy": bit_hoy
    }


def _limpiar_cache_frentes_estado(cid: str) -> dict:
    cid_norm = motor_m1.normalizar_cliente_id(cid)
    if cid_norm == "mallas_tlaxcalli":
        return {
            "ok": True,
            "es_mallas": True,
            "cliente_id": "mallas_tlaxcalli",
            "flujo_continuo_activo": 0,
            "zonas_objetivo": "",
            "frentes": [],
            "progreso": [],
            "metricas": {"total": 0, "pendientes_y_confirmados": 0, "wa_confirmados": 0, "sin_wa": 0},
        }
    nicho = obtener_nicho_bd(cid_norm)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, nombre_frente, keywords_busqueda, ticket_estimado, angulo_andrea, activo, creado_en
        FROM frentes_caza
        WHERE LOWER(id_cliente_agencia) = LOWER(?)
        ORDER BY id ASC
    """, (cid_norm,))
    frentes = [
        {
            "id": r[0],
            "nombre_frente": r[1],
            "keywords_busqueda": r[2] or "",
            "ticket_estimado": r[3] or "",
            "angulo_andrea": r[4] or "",
            "activo": int(r[5]) if r[5] is not None else 1,
            "creado_en": r[6] or "",
        }
        for r in cur.fetchall()
    ]
    cur.execute("""
        SELECT frente_id, zona, fuente, ultimo_offset, actualizado_en
        FROM progreso_extraccion
        WHERE LOWER(id_cliente_agencia) = LOWER(?)
        ORDER BY actualizado_en DESC LIMIT 20
    """, (cid_norm,))
    progreso = [
        {
            "frente_id": r[0],
            "zona": r[1],
            "fuente": r[2],
            "ultimo_offset": r[3],
            "actualizado_en": r[4] or "",
        }
        for r in cur.fetchall()
    ]
    cur.execute("""
        SELECT COUNT(*),
               SUM(CASE WHEN estatus_contacto_wa IS NULL OR estatus_contacto_wa IN ('', 'PENDIENTE', 'PENDIENTE_ENVIO', 'VERIFICADO_WA', 'WHATSAPP_CONFIRMADO') THEN 1 ELSE 0 END),
               SUM(CASE WHEN estatus_contacto_wa IN ('VERIFICADO_WA', 'WHATSAPP_CONFIRMADO', 'CONTACTADO_WA') THEN 1 ELSE 0 END),
               SUM(CASE WHEN estatus_contacto_wa = 'SIN_WHATSAPP' THEN 1 ELSE 0 END)
        FROM prospectos_cazador
        WHERE LOWER(COALESCE(id_cliente_agencia, '')) = LOWER(?)
          AND estatus_clasificacion LIKE 'APROBADO%'
    """, (cid_norm,))
    m_row = cur.fetchone()
    conn.close()
    return {
        "ok": True,
        "es_mallas": False,
        "cliente_id": cid_norm,
        "flujo_continuo_activo": int(nicho.get("flujo_continuo_activo", 1)),
        "zonas_objetivo": nicho.get("zonas_objetivo") or "CDMX y Area Metropolitana",
        "frentes": frentes,
        "progreso": progreso,
        "metricas": {
            "total": int(m_row[0] or 0) if m_row else 0,
            "pendientes_y_confirmados": int(m_row[1] or 0) if m_row else 0,
            "wa_confirmados": int(m_row[2] or 0) if m_row else 0,
            "sin_wa": int(m_row[3] or 0) if m_row else 0,
        },
    }


def _obtener_y_avanzar_offset(cid: str, frente_id: int, zona: str, fuente: str, paso: int = 10) -> int:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT ultimo_offset FROM progreso_extraccion
        WHERE LOWER(id_cliente_agencia) = LOWER(?) AND frente_id = ? AND LOWER(zona) = LOWER(?) AND UPPER(fuente) = UPPER(?)
        LIMIT 1
    """, (cid, int(frente_id or 0), zona.strip(), fuente.strip()))
    row = cur.fetchone()
    offset_actual = int(row[0]) if row and row[0] is not None else 0
    nuevo_offset = offset_actual + paso
    cur.execute("""
        INSERT INTO progreso_extraccion (id_cliente_agencia, frente_id, zona, fuente, ultimo_offset, actualizado_en)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id_cliente_agencia, frente_id, zona, fuente) DO UPDATE SET
            ultimo_offset = excluded.ultimo_offset,
            actualizado_en = datetime('now')
    """, (cid, int(frente_id or 0), zona.strip(), fuente.upper(), nuevo_offset))
    conn.commit()
    conn.close()
    return offset_actual


def _disparar_validacion_wa_batch_async(cid: str, min_id_antes: int):
    def _run_val():
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("""
                SELECT id, telefono FROM prospectos_cazador
                WHERE LOWER(COALESCE(id_cliente_agencia, '')) = LOWER(?)
                  AND id > ?
                  AND (estatus_contacto_wa IS NULL OR estatus_contacto_wa IN ('', 'PENDIENTE', 'PENDIENTE_ENVIO'))
                ORDER BY id DESC LIMIT 25
            """, (cid, min_id_antes))
            rows = [{"id": r[0], "telefono": r[1]} for r in cur.fetchall() if r[1]]
            conn.close()
            if not rows:
                return
            _llamar_bridge_wa("/verificar_lote_wa", {"cliente_id": cid, "prospectos": rows}, timeout=25)
        except Exception:
            pass
    threading.Thread(target=_run_val, daemon=True).start()


def auto_abastecer_cliente(cid_raw: str, forzar: bool = False, frente_id_req: int | None = None, zona_override: str = "", fuente_preferida: str = "APIFY") -> dict:
    cid = motor_m1.normalizar_cliente_id(cid_raw or "")
    # CANDADO ESTRICTO FAST-PATH LEGACY: nunca tocar mallas_tlaxcalli
    if not cid or cid == "mallas_tlaxcalli":
        return {
            "ok": True,
            "fast_path_legacy": True,
            "omitido": True,
            "cliente_id": "mallas_tlaxcalli",
            "motivo": "mallas_tlaxcalli usa Fast-Path Legacy protegido",
        }

    nicho = obtener_nicho_bd(cid)
    modelo = normalizar_modelo_negocio(nicho.get("modelo_negocio", "DISTRIBUIDOR_B2B"))
    if modelo not in ("DISTRIBUIDOR_B2B", "SERVICIOS_B2B"):
        return {"ok": True, "omitido": True, "cliente_id": cid, "motivo": "MODO_B2C_INBOUND_ONLY"}

    flujo_activo = int(nicho.get("flujo_continuo_activo", 1))
    if flujo_activo == 0 and not forzar:
        return {"ok": True, "omitido": True, "cliente_id": cid, "motivo": "FLUJO_CONTINUO_PAUSADO"}

    estado = _limpiar_cache_frentes_estado(cid)
    pendientes_actuales = estado["metricas"]["pendientes_y_confirmados"]
    if pendientes_actuales >= 30 and not forzar:
        return {
            "ok": True,
            "omitido": True,
            "cliente_id": cid,
            "motivo": "BUFFER_SUFICIENTE",
            "pendientes_actuales": pendientes_actuales,
        }

    frentes_activos = [f for f in estado["frentes"] if int(f.get("activo", 1)) == 1]
    frente_sel = None
    if frente_id_req is not None:
        frente_sel = next((f for f in estado["frentes"] if int(f["id"]) == int(frente_id_req)), None)
    if not frente_sel and frentes_activos:
        idx_rot = int(time.time() // 60) % len(frentes_activos)
        frente_sel = frentes_activos[idx_rot]

    frente_id = int(frente_sel["id"]) if frente_sel else 0
    frente_nombre = frente_sel["nombre_frente"] if frente_sel else (nicho.get("giro_objetivo") or "Prospección General")
    angulo_contacto = frente_sel.get("angulo_andrea") if frente_sel else ""
    kws_src = (frente_sel.get("keywords_busqueda") if frente_sel else "") or nicho.get("keywords_busqueda") or nicho.get("giro_objetivo") or "empresas"
    kw_list = [k.strip() for k in re.split(r"[,;\n]+", kws_src) if k.strip()]
    kw_principal = kw_list[0] if kw_list else "empresas"

    zonas_raw = [z.strip() for z in re.split(r"[,\n;]+", str(zona_override or nicho.get("zonas_objetivo") or "CDMX")) if z.strip()]
    zona_sel = zonas_raw[int(time.time() // 120) % len(zonas_raw)] if zonas_raw else "CDMX"

    perfil = construir_perfil_motor_desde_nicho(cid)
    perfil["cobertura_logistica"] = {"municipios_edomex_autorizados": [], "alcaldias_cdmx_autorizadas": [], "colonias_zonas_rojas": []}
    env = motor_m1.cargar_env()

    conn = sqlite3.connect(DB_PATH)
    max_id_antes = conn.execute("SELECT COALESCE(MAX(id), 0) FROM prospectos_cazador").fetchone()[0]
    conn.close()

    fuente_usada = str(fuente_preferida or "APIFY").upper()
    offset_actual = _obtener_offset_progreso(cid, frente_id, zona_sel, fuente_usada, paso=10)
    nuevos = []
    if fuente_usada == "APIFY" and env.get("APIFY_API_TOKEN"):
        q_maps = f"{kw_principal} en {zona_sel}, Mexico"
        nuevos = motor_m1.extraer_apify_google_maps(q_maps, 10, env.get("APIFY_API_TOKEN", ""), perfil=perfil)

    if not nuevos and env.get("INEGI_DENUE_TOKEN"):
        fuente_usada = "INEGI"
        offset_inegi = _obtener_offset_progreso(cid, frente_id, zona_sel, "INEGI", paso=10)
        nuevos = motor_m1.extraer_inegi_por_zona_dinamica(
            kw_principal, zona_sel, 10, env.get("INEGI_DENUE_TOKEN", ""), reg_ini=max(1, offset_inegi + 1), perfil=perfil
        )

    for r in nuevos:
        r["frente_nombre"] = frente_nombre
        r["angulo_contacto"] = angulo_contacto
        if not r.get("municipio"):
            r["municipio"] = zona_sel

    clasificados = [motor_m1.clasificar_negocio(r, perfil) for r in nuevos]
    motor_m1.guardar_y_exportar(clasificados, cid)
    _disparar_validacion_wa_batch_async(cid, max_id_antes)

    bd_info = obtener_datos_completos_bd(cid)
    return {
        "ok": True,
        "omitido": False,
        "cliente_id": cid,
        "frente_id": frente_id,
        "frente_nombre": frente_nombre,
        "zona": zona_sel,
        "fuente": fuente_usada,
        "offset": offset_actual,
        "lote_extraido": len(nuevos),
        "total_acumulado": len(bd_info["prospectos"]),
    }


# ==============================================================================
# 5. SERVIDOR HTTP PÚBLICO BLINDADO (5 MÓDULOS COMPLETOS)
# ==============================================================================

class PublicSafeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/imagen_pau":
            qs = urllib.parse.parse_qs(parsed.query)
            fname = os.path.basename(qs.get("file", [""])[0])
            cat = qs.get("cat", [""])[0]
            carpetas_buscar = RUTAS_PUBLICIDAD_PAU if cat == "publicidad" else (RUTAS_IMAGENES_PAU + RUTAS_PUBLICIDAD_PAU)
            for carpeta in carpetas_buscar:
                posible = os.path.join(carpeta, fname)
                if os.path.isfile(posible):
                    mime, _ = mimetypes.guess_type(posible)
                    if os.path.splitext(posible)[1].lower() == ".svg":
                        mime = "image/svg+xml"
                    with open(posible, "rb") as f:
                        raw = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", mime or "application/octet-stream")
                    self.send_header("Content-Length", str(len(raw)))
                    self.end_headers()
                    self.wfile.write(raw)
                    return
            self.send_response(404)
            self.end_headers()
            return

        if parsed.path == "/excel_mallas_tlaxcalli.csv":
            ruta_csv = exportar_excel_en_vivo()
            with open(ruta_csv, "rb") as f:
                raw = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="EXCEL_VIVO_MALLAS_TLAXCALLI.csv"')
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return

        if parsed.path == "/api/obtener_candidato_envio_50":
            qs = urllib.parse.parse_qs(parsed.query)
            cid_q = motor_m1.normalizar_cliente_id((qs.get("cliente_id", ["mallas_tlaxcalli"])[0] or "mallas_tlaxcalli").strip())
            forzar_q = (qs.get("forzar", ["0"])[0] or "0").lower() in ("1", "true", "yes")
            cand = obtener_candidato_envio_50(cliente_id=cid_q, forzar=forzar_q)
            self._send_json(cand)
            return

        if parsed.path in ("/api/estatus_whatsapp", "/api/estatus_wa", "/estatus_wa"):
            qs = urllib.parse.parse_qs(parsed.query)
            email_q = (qs.get("email", [""])[0] or "").strip().lower()
            cid_q = (qs.get("cliente_id", [""])[0] or "").strip()

            if email_q:
                cid_target, nicho_ctx, es_mallas = resolver_contexto_tenant_request(email_q, cid_q)
                if not cid_target or not nicho_ctx:
                    self._send_json({
                        "ok": True,
                        "tiene_perfil": False,
                        "es_mallas": False,
                        "cliente_id": "",
                        "modelo_negocio": "DISTRIBUIDOR_B2B",
                        "conectado": False,
                        "qr": "",
                        "qr_data_url": "",
                        "pairingCode": "",
                        "codigo_8_digitos": "",
                        "miNumero": "",
                        "numero_vinculado": "",
                        "motorPausadoLocal": False,
                        "pausaRespuestasGeneral": False,
                        "erroresConsecutivosEnvio": 0,
                        "motor_50_activo": False
                    })
                    return
                modelo_nicho = normalizar_modelo_negocio(nicho_ctx.get("modelo_negocio", "DISTRIBUIDOR_B2B"))
            else:
                cid_target = motor_m1.normalizar_cliente_id(cid_q or "mallas_tlaxcalli")
                es_mallas = (cid_target == "mallas_tlaxcalli")
                nicho_ctx = obtener_nicho_bd(cid_target)
                modelo_nicho = "DISTRIBUIDOR_B2B" if es_mallas else normalizar_modelo_negocio(nicho_ctx.get("modelo_negocio", "DISTRIBUIDOR_B2B"))

            est = {
                "ok": True,
                "tiene_perfil": True,
                "es_mallas": es_mallas,
                "cliente_id": cid_target,
                "modelo_negocio": modelo_nicho,
                "conectado": False,
                "qr": "",
                "qr_data_url": "",
                "pairingCode": "",
                "codigo_8_digitos": "",
                "miNumero": "",
                "numero_vinculado": "",
                "motor_50_activo": False if modelo_nicho == "EMPRENDEDOR_B2C" else (ESTADO_MOTOR_50_DIARIOS["activo"] if es_mallas else True),
                "fotos_producto_reales": len(listar_imagenes_producto_reales()) if es_mallas else 0,
                "fotos_publicidad": len(listar_publicidad_pau()) if es_mallas else 0
            }

            bridge_ok = False
            try:
                url_bridge = f"http://127.0.0.1:8095/estatus_wa?cliente_id={urllib.parse.quote(cid_target)}"
                with urllib.request.urlopen(url_bridge, timeout=5) as resp_b:
                    datos_b = json.loads(resp_b.read().decode("utf-8"))
                    if isinstance(datos_b, dict):
                        est.update(datos_b)
                        est["modelo_negocio"] = modelo_nicho
                        bridge_ok = True
            except Exception:
                bridge_ok = False

            if not bridge_ok and es_mallas and os.path.exists("/tmp/estatus_wa.json"):
                try:
                    with open("/tmp/estatus_wa.json", "r", encoding="utf-8") as fw:
                        est.update(json.load(fw))
                except Exception:
                    pass

            self._send_json(est)
            return

        if parsed.path == "/qr":
            html_qr = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
            <title>Vincular WhatsApp — Mallas Tlaxcalli</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <style>body{background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}
            .box{background:#1e293b;border:2px solid #25d366;border-radius:16px;padding:26px;max-width:520px;width:100%}
            #qrBox{background:#fff;padding:18px;border-radius:12px;display:inline-block;margin:14px auto}
            .ok{background:#065f46;color:#34d399;padding:14px;border-radius:10px;font-weight:bold}
            input{background:#0f172a;border:1px solid #475569;color:#fff;padding:10px 12px;border-radius:8px;width:100%;font-size:0.95rem;margin-top:8px}
            button{background:#f59e0b;color:#000;border:none;padding:10px 16px;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:8px;width:100%;font-size:0.9rem}</style></head>
            <body><div class="box">
              <h2 style="color:#25d366;margin-top:0">📲 Conectar WhatsApp Mallas Tlaxcalli</h2>
              <p style="font-size:0.88rem;color:#cbd5e1">Opción 1: Abre WhatsApp -> <b>Dispositivos vinculados</b> -> <b>Vincular un dispositivo</b> y escanea este QR (firma Ubuntu Chrome):</p>
              <div id="estadoWA">Cargando código QR en vivo desde tu VPS Ubuntu...</div>
              <div id="qrBox" style="display:none"></div>

              <div style="margin-top:14px;padding:14px;background:#0f172a;border:1px solid #334155;border-radius:10px;text-align:left">
                <b style="color:#fbbf24;font-size:0.88rem">🔢 Opción 2 (Sin Cámara): Vincular con Código de 8 Dígitos</b>
                <p style="font-size:0.79rem;color:#94a3b8;margin:4px 0">En tu WhatsApp toca <b>"Vincular con el número de teléfono"</b>, escribe tu número de 10 dígitos y captura el código:</p>
                <input type="text" id="numTelCode" placeholder="Escribe tu número a 10 dígitos (ej. 5512345678)">
                <button onclick="pedirCodigo8()">Generar Código de 8 Dígitos para WhatsApp</button>
                <div id="resCodigo8" style="margin-top:10px;text-align:center;font-size:1.35rem;font-weight:900;color:#34d399;letter-spacing:3px"></div>
              </div>

              <div style="margin-top:14px;font-size:0.8rem;color:#cbd5e1;text-align:left;background:#0f172a;padding:12px;border-radius:8px;line-height:1.5">
                👑 <b>¡Todo Directo en tu Propio Chat de WhatsApp!</b><br>
                1. Abre tu chat <b>"(Tú) / Mensajes contigo mismo"</b> en tu celular: ahí te responde al instante tu <b>Agente CDO IA</b>.<br>
                2. Mándale ahí mismo tus <b>fotos reales del producto</b> (o escribe <code>publicidad</code> en el pie de foto para guardar flyers de marketing).<br>
                3. Pídele por voz/texto: <i>"Dame el reporte"</i>, <i>"Mándame el excel"</i>, <i>"Verifica WhatsApp"</i>, o <i>"Activa los envíos"</i>.
              </div>
            </div>
            <script>
              let ultimoQR = '';
              async function pedirCodigo8(){
                const t = document.getElementById('numTelCode').value.trim();
                const box = document.getElementById('resCodigo8');
                if(!t){ alert('Escribe los 10 dígitos del número de WhatsApp'); return; }
                box.textContent = '⏳ Generando código...';
                const r = await fetch('/api/pedir_codigo_wa', {
                  method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({telefono: t})
                });
                const d = await r.json();
                if(d.ok && d.codigo){
                  box.innerHTML = 'CÓDIGO: <span style="background:#064e3b;padding:6px 12px;border-radius:8px;border:1px solid #10b981">' + d.codigo + '</span>';
                } else {
                  box.innerHTML = '<span style="font-size:0.85rem;color:#f87171">Intenta de nuevo en 3 seg: '+(d.error||'')+'</span>';
                }
              }
              async function checar(){
                try{
                  const r = await fetch('/api/estatus_whatsapp');
                  const d = await r.json();
                  const st = document.getElementById('estadoWA');
                  const qb = document.getElementById('qrBox');
                  if(d.conectado){
                    qb.style.display='none';
                    st.innerHTML='<div class="ok">✅ ¡WHATSAPP CONECTADO EN VIVO!<br>Número: '+(d.numero_vinculado||'Activo')+'<br><br>Ya puedes usar todo desde tu celular en WhatsApp y ver cómo se mueven los nodos en n8n.</div>';
                  } else if(d.qr_data_url){
                    st.innerHTML='<span style="color:#34d399;font-weight:bold">✅ QR Oficial Listo — Escanéalo con tu celular:</span>';
                    qb.style.display='inline-block';
                    if(d.qr !== ultimoQR){
                      ultimoQR = d.qr;
                      qb.innerHTML = '<img src="'+d.qr_data_url+'" style="width:270px;height:270px;display:block">';
                    }
                  } else if(d.qr){
                    st.innerHTML='<span style="color:#fbbf24;font-weight:bold">⏳ Escanea el código QR con tu celular:</span>';
                    qb.style.display='inline-block';
                    if(d.qr !== ultimoQR){
                      ultimoQR = d.qr;
                      qb.innerHTML = '';
                      new QRCode(qb, {text: d.qr, width: 260, height: 260, correctLevel: QRCode.CorrectLevel.L});
                    }
                  } else {
                    st.innerHTML='⏳ Generando nuevo QR en el puente de WhatsApp (espera 3 segundos)...';
                  }
                }catch(e){}
              }
              setInterval(checar, 2000); checar();
            </script></body></html>"""
            body = html_qr.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/mi-nicho":
            qs = urllib.parse.parse_qs(parsed.query)
            email_q = (qs.get("owner_email", [""])[0] or qs.get("email", [""])[0] or "").strip().lower()
            cid_q = (qs.get("cliente_id", [""])[0] or "").strip()
            if not email_q and cid_q:
                cid_norm = motor_m1.normalizar_cliente_id(cid_q)
                nicho_c = obtener_nicho_bd(cid_norm)
                self._send_json({
                    "ok": True,
                    "tiene_perfil": True,
                    "es_mallas": (cid_norm == "mallas_tlaxcalli"),
                    "cliente_id": cid_norm,
                    "modelo_negocio": nicho_c.get("modelo_negocio", "DISTRIBUIDOR_B2B"),
                    "diagnostico_ia": nicho_c.get("diagnostico_ia", {}),
                    "nicho": nicho_c
                })
                return
            if not email_q:
                self._send_json({
                    "ok": True,
                    "tiene_perfil": False,
                    "es_mallas": False,
                    "owner_email": "",
                    "modelo_negocio": "DISTRIBUIDOR_B2B",
                    "diagnostico_ia": {},
                    "nicho": None,
                    "total_prospectos": 0,
                    "enviados_wa": 0
                })
                return

            nicho_u = obtener_nicho_por_email(email_q)
            if not nicho_u:
                self._send_json({
                    "ok": True,
                    "tiene_perfil": False,
                    "es_mallas": False,
                    "owner_email": email_q,
                    "modelo_negocio": "DISTRIBUIDOR_B2B",
                    "diagnostico_ia": {},
                    "nicho": None,
                    "total_prospectos": 0,
                    "enviados_wa": 0
                })
                return

            self._send_json({
                "ok": True,
                "tiene_perfil": True,
                "es_mallas": (email_q == OWNER_EMAIL_MALLAS),
                "owner_email": email_q,
                "cliente_id": nicho_u["cliente_id"],
                "modelo_negocio": nicho_u.get("modelo_negocio", "DISTRIBUIDOR_B2B"),
                "diagnostico_ia": nicho_u.get("diagnostico_ia", {}),
                "nicho": nicho_u,
                "total_prospectos": nicho_u.get("total_prospectos", 0),
                "enviados_wa": nicho_u.get("enviados_wa", 0)
            })
            return

        if parsed.path == "/api/nichos":
            qs = urllib.parse.parse_qs(parsed.query)
            email_q = (qs.get("email", [""])[0] or "").strip().lower()
            if email_q and email_q != OWNER_EMAIL_MALLAS:
                nicho_u = obtener_nicho_por_email(email_q)
                self._send_json({
                    "ok": True,
                    "nicho_default": nicho_u["cliente_id"] if nicho_u else "",
                    "nichos": [nicho_u] if nicho_u else []
                })
                return
            nichos = obtener_lista_nichos_con_metricas()
            self._send_json({
                "ok": True,
                "nicho_default": leer_config("nicho_activo_default", "mallas_tlaxcalli"),
                "nichos": nichos
            })
            return

        if parsed.path == "/api/cazador/frentes":
            qs = urllib.parse.parse_qs(parsed.query)
            email_q = (qs.get("email", [""])[0] or "").strip().lower()
            cid_q = (qs.get("cliente_id", [""])[0] or "").strip()
            cid_target, nicho_ctx, es_mallas = resolver_contexto_tenant_request(email_q, cid_q)
            if not cid_target or not nicho_ctx:
                self._send_json({"ok": False, "error": "Primero configura tu negocio en 01 • IDEA."}, status=400)
                return
            self._send_json(_limpiar_cache_frentes_estado(cid_target))
            return

        if parsed.path == "/api/datos_seguros":
            qs = urllib.parse.parse_qs(parsed.query)
            email_query = (qs.get("email", [""])[0] or "").strip().lower()
            cid_query = (qs.get("cliente_id", [""])[0] or "").strip()

            env = motor_m1.cargar_env()
            cid_target, nicho_ctx, es_mallas = resolver_contexto_tenant_request(email_query, cid_query)

            # Si es un correo externo que aún no ha creado su idea en 01 • IDEA, devolver pizarra 100% en blanco
            if not cid_target or not nicho_ctx:
                self._send_json({
                    "ok": True,
                    "tiene_perfil": False,
                    "es_mallas": False,
                    "cliente": "",
                    "cliente_id_activo": "",
                    "nicho_activo": None,
                    "nichos": [],
                    "municipios_autorizados": [
                        "Ecatepec", "Tultitlán", "Coacalco", "Naucalpan",
                        "Tlalnepantla", "Cuautitlán Izcalli", "Atizapán",
                        "Cuautitlán", "Tepotzotlán"
                    ],
                    "total_reales_bd": 0,
                    "bitacora_total": 0,
                    "bitacora_hoy": 0,
                    "meta_diaria_frio": ESTADO_MOTOR_50_DIARIOS["meta_diaria"],
                    "prospectos": [],
                    "pedidos": [],
                    "seguimientos": [],
                    "fotos_negocio_pau": [],
                    "cola_paola": [],
                    "n8n_live_url": "",
                    "last_fb_run_status": None,
                    "cazador_24_7": ESTADO_CAZADOR_24_7,
                    "seguridad": {
                        "inegi_conectado": bool(env.get("INEGI_DENUE_TOKEN")),
                        "apify_conectado": bool(env.get("APIFY_API_TOKEN")),
                        "ia_pool_conectado": len(obtener_llaves_ia_backend()) > 0,
                        "modelos_en_rotacion": len(MODELOS_POOL_INFINITO),
                        "estadisticas_pool": ESTADISTICAS_POOL
                    }
                })
                return

            perfil = construir_perfil_motor_desde_nicho(cid_target)
            bd_info = obtener_datos_completos_bd(cid_target)
            fotos_pau = listar_imagenes_pau() if es_mallas else []
            nichos_lista = obtener_lista_nichos_con_metricas() if es_mallas else [nicho_ctx]

            n8n_url = "https://agencia-topdiegozc-vsc-server.ngssgr.easypanel.host/proxy/5678/"
            if os.path.exists("/tmp/cf_n8n_vps.log"):
                try:
                    with open("/tmp/cf_n8n_vps.log", "r", encoding="utf-8", errors="ignore") as fn:
                        m_urls = re.findall(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", fn.read())
                        if m_urls:
                            n8n_url = m_urls[-1]
                except Exception:
                    pass

            try:
                import modulo_1b_cazador_facebook as motor_fb
                ultimo_fb = motor_fb.ESTADO_ULTIMA_CORRIDA_FB
            except Exception:
                ultimo_fb = None

            self._send_json({
                "ok": True,
                "tiene_perfil": True,
                "es_mallas": es_mallas,
                "cliente": perfil["nombre_empresa"],
                "cliente_id_activo": cid_target,
                "nicho_activo": nicho_ctx,
                "nichos": nichos_lista,
                "municipios_autorizados": perfil["cobertura_logistica"]["municipios_edomex_autorizados"],
                "total_reales_bd": len(bd_info["prospectos"]),
                "bitacora_total": bd_info.get("bitacora_total", 0),
                "bitacora_hoy": bd_info.get("bitacora_hoy", 0),
                "meta_diaria_frio": ESTADO_MOTOR_50_DIARIOS["meta_diaria"],
                "prospectos": bd_info["prospectos"],
                "pedidos": bd_info["pedidos"],
                "seguimientos": bd_info["seguimientos"],
                "fotos_negocio_pau": fotos_pau,
                "cola_paola": COLA_MENSAJES_PAOLA[-10:] if es_mallas else [],
                "n8n_live_url": n8n_url,
                "last_fb_run_status": ultimo_fb,
                "cazador_24_7": ESTADO_CAZADOR_24_7,
                "seguridad": {
                    "inegi_conectado": bool(env.get("INEGI_DENUE_TOKEN")),
                    "apify_conectado": bool(env.get("APIFY_API_TOKEN")),
                    "ia_pool_conectado": len(obtener_llaves_ia_backend()) > 0,
                    "modelos_en_rotacion": len(MODELOS_POOL_INFINITO),
                    "estadisticas_pool": ESTADISTICAS_POOL
                }
            })
            return

        html = generar_html_publico_seguro()
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8", errors="ignore") if length > 0 else "{}"
        try:
            clean_raw = raw.replace('\\"', '"').replace('\\:', ':').replace('\\,', ',')
            data = json.loads(clean_raw) if clean_raw.strip() else {}
            if not isinstance(data, dict):
                data = {"descripcion_idea": str(data)}
        except Exception:
            qs_body = urllib.parse.parse_qs(raw)
            if qs_body:
                data = {k: v[0] for k, v in qs_body.items() if v}
            else:
                m_desc = re.search(r"descripcion_idea\s*[\\:]*[:=]\s*(.+?)(?:[,}]|$)", raw)
                m_cli = re.search(r"cliente_objetivo_tipo\s*[\\:]*[:=]\s*(.+?)(?:[,}]|$)", raw)
                m_mod = re.search(r"modalidad_entrega\s*[\\:]*[:=]\s*(.+?)(?:[,}]|$)", raw)
                m_vol = re.search(r"volumen_compra\s*[\\:]*[:=]\s*(.+?)(?:[,}]|$)", raw)
                data = {
                    "descripcion_idea": re.sub(r'^[\\"\s]+|[\\"\s]+$', '', m_desc.group(1)) if m_desc else raw.strip(),
                    "cliente_objetivo_tipo": re.sub(r'^[\\"\s]+|[\\"\s]+$', '', m_cli.group(1)) if m_cli else "",
                    "modalidad_entrega": re.sub(r'^[\\"\s]+|[\\"\s]+$', '', m_mod.group(1)) if m_mod else "",
                    "volumen_compra": re.sub(r'^[\\"\s]+|[\\"\s]+$', '', m_vol.group(1)) if m_vol else ""
                }

        clean_path = self.path.split("?", 1)[0]
        qs_url = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if clean_path == "/api/diagnosticar-modelo":
            desc = str(
                data.get("descripcion_idea")
                or data.get("productDesc")
                or data.get("idea")
                or (qs_url.get("descripcion_idea", [""])[0])
                or ""
            ).strip()
            cat = str(data.get("nicho_categoria") or data.get("niche") or (qs_url.get("nicho_categoria", [""])[0]) or "").strip()
            obj = str(data.get("objetivo") or data.get("objective") or (qs_url.get("objetivo", [""])[0]) or "").strip()
            cliente_obj_tipo = str(data.get("cliente_objetivo_tipo") or (qs_url.get("cliente_objetivo_tipo", [""])[0]) or "").strip()
            mod_entrega = str(data.get("modalidad_entrega") or (qs_url.get("modalidad_entrega", [""])[0]) or "").strip()
            vol_compra = str(data.get("volumen_compra") or (qs_url.get("volumen_compra", [""])[0]) or "").strip()
            res_diag = diagnosticar_modelo_negocio_ia(
                desc,
                cat,
                obj,
                cliente_objetivo_tipo=cliente_obj_tipo,
                modalidad_entrega=mod_entrega,
                volumen_compra=vol_compra
            )
            self._send_json(res_diag, status=200)
            return

        if clean_path == "/api/extraer-web":
            raw_url = str(
                data.get("url")
                or data.get("website")
                or (qs_url.get("url", [""])[0])
                or ""
            ).strip()
            if not raw_url and raw:
                m_u = re.search(r"url\s*[\\:]*[:=]\s*([^\s,}\"]+)", raw)
                if m_u:
                    raw_url = re.sub(r'^[\\"\s]+|[\\"\s]+$', '', m_u.group(1))
            status_web, res_web = extraer_conocimiento_web_ia(raw_url)
            self._send_json(res_web, status=status_web)
            return

        if self.path == "/api/mi-nicho":
            owner_email = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            status_code, payload_res = guardar_nicho_por_email(owner_email, data)
            self._send_json(payload_res, status=status_code)
            return

        if self.path == "/api/nichos":
            owner_email = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            if owner_email and owner_email != OWNER_EMAIL_MALLAS:
                status_code, payload_res = guardar_nicho_por_email(owner_email, data)
                self._send_json(payload_res, status=status_code)
                return

            nombre_negocio = str(data.get("nombre_negocio") or "").strip()
            raw_cid = str(data.get("cliente_id") or nombre_negocio).strip()
            cid = motor_m1.normalizar_cliente_id(raw_cid)
            if not nombre_negocio:
                self._send_json({"ok": False, "error": "El nombre del negocio es obligatorio."}, status=400)
                return
            if cid == "mallas_tlaxcalli":
                self._send_json({
                    "ok": False,
                    "error": "El perfil base Mallas Tlaxcalli está protegido con candado y no puede ser modificado ni sobreescrito."
                }, status=403)
                return

            nombre_agente = str(data.get("nombre_agente") or "Andrea").strip() or "Andrea"
            giro_objetivo = str(data.get("giro_objetivo") or "").strip()
            if not giro_objetivo:
                self._send_json({"ok": False, "error": "El giro o cliente objetivo es obligatorio."}, status=400)
                return
            codigo_scian = str(data.get("codigo_scian_inegi") or "").strip()
            keywords = str(data.get("keywords_busqueda") or giro_objetivo).strip()
            oferta_gancho = str(data.get("oferta_gancho") or "").strip()
            # Truncado seguro a máximo 2,500 caracteres
            catalogo_reglas = str(data.get("catalogo_y_reglas") or "").strip()[:2500]
            system_prompt_custom = str(data.get("system_prompt") or "").strip()[:2500]

            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO perfiles_nicho (
                    cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
                    codigo_scian_inegi, keywords_busqueda, oferta_gancho,
                    catalogo_y_reglas, system_prompt, saludos_frio_json,
                    municipios_json, protegido, activo, fecha_creacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', 0, 1, datetime('now'))
                ON CONFLICT(cliente_id) DO UPDATE SET
                    nombre_negocio = excluded.nombre_negocio,
                    nombre_agente = excluded.nombre_agente,
                    giro_objetivo = excluded.giro_objetivo,
                    codigo_scian_inegi = excluded.codigo_scian_inegi,
                    keywords_busqueda = excluded.keywords_busqueda,
                    oferta_gancho = excluded.oferta_gancho,
                    catalogo_y_reglas = excluded.catalogo_y_reglas,
                    system_prompt = excluded.system_prompt
                WHERE perfiles_nicho.protegido = 0
            """, (
                cid, nombre_negocio, nombre_agente, giro_objetivo,
                codigo_scian, keywords, oferta_gancho,
                catalogo_reglas, system_prompt_custom
            ))
            conn.commit()
            conn.close()
            self._send_json({
                "ok": True,
                "cliente_id": cid,
                "nichos": obtener_lista_nichos_con_metricas()
            })
            return

        if self.path == "/api/nichos/toggle":
            cid = motor_m1.normalizar_cliente_id(data.get("cliente_id", ""))
            accion = str(data.get("accion") or "").lower()
            if accion in ("eliminar", "delete", "desproteger"):
                if cid == "mallas_tlaxcalli":
                    self._send_json({
                        "ok": False,
                        "error": "Mallas Tlaxcalli es el tenant principal protegido y no puede eliminarse ni desprotegerse."
                    }, status=403)
                    return
                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                cur.execute("DELETE FROM perfiles_nicho WHERE LOWER(cliente_id) = LOWER(?) AND protegido = 0", (cid,))
                conn.commit()
                conn.close()
                self._send_json({"ok": True, "nichos": obtener_lista_nichos_con_metricas()})
                return

            activo = 1 if bool(data.get("activo", True)) else 0
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("UPDATE perfiles_nicho SET activo = ? WHERE LOWER(cliente_id) = LOWER(?)", (activo, cid))
            cur.execute("UPDATE perfiles_nicho SET protegido = 1, owner_email = ? WHERE cliente_id = 'mallas_tlaxcalli'", (OWNER_EMAIL_MALLAS,))
            conn.commit()
            conn.close()
            self._send_json({"ok": True, "cliente_id": cid, "activo": bool(activo), "nichos": obtener_lista_nichos_con_metricas()})
            return

        if self.path == "/api/chat":
            session_id = data.get("session_id", "default_session")
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()

            if email_req:
                cid_resolved, nicho_ctx, _ = resolver_contexto_tenant_request(email_req, cid_req)
                if not cid_resolved or not nicho_ctx:
                    self._send_json({
                        "ok": False,
                        "error": "Primero configura tu producto o negocio en '01 • IDEA' para activar a tu asesora IA."
                    })
                    return
                cid_chat = cid_resolved
            else:
                cid_chat = cid_req

            if data.get("reset"):
                SESIONES_CHAT[session_id] = []
                nicho_r = obtener_nicho_bd(resolver_cliente_id_por_telefono_o_sesion(session_id, cid_chat))
                self._send_json({
                    "respuesta": f"¡Hola, qué tal! Buen día 😊 Le atiende {nicho_r.get('nombre_agente', 'Andrea')} de {nicho_r.get('nombre_negocio', 'nuestro equipo')}. ¿En qué le podemos apoyar hoy?"
                })
                return
            msg = data.get("mensaje", "")
            incluir_voz = bool(data.get("incluir_voz", False))
            resultado = llamar_pool_ia_real(session_id, msg, incluir_voz=incluir_voz, cliente_id=cid_chat)
            self._send_json(resultado)
            return

        if self.path == "/api/tts_voz_mujer":
            res_voz = generar_nota_voz_femenina_wav(data.get("texto", ""))
            self._send_json(res_voz)
            return

        if self.path == "/api/marcar_maps":
            tel = data.get("telefono", "")
            nuevo_estatus = data.get("estatus_maps", "ABIERTA_VERIFICADA")
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("UPDATE prospectos_cazador SET estatus_maps = ? WHERE telefono = ?", (nuevo_estatus, tel))
            conn.commit()
            conn.close()
            self._send_json({"ok": True})
            return

        if self.path == "/api/registrar_pedido":
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            cid_resolved, nicho_ctx, es_mallas = resolver_contexto_tenant_request(email_req, cid_req)
            if not cid_resolved or not nicho_ctx:
                self._send_json({
                    "ok": False,
                    "error": "Primero configura tu negocio en '01 • IDEA' antes de registrar pedidos."
                })
                return

            cliente = str(data.get("cliente") or data.get("cliente_tortilleria") or "Cliente").strip()
            tel = re.sub(r"\D", "", str(data.get("telefono", "525500000000")))
            if len(tel) == 10:
                tel = "52" + tel
            elif tel.startswith("521") and len(tel) == 13:
                tel = "52" + tel[3:]
            direccion = str(data.get("direccion") or data.get("direccion_gps") or "Dirección en cobertura").strip()
            muni = str(data.get("municipio") or "Ecatepec").strip()
            horario = str(data.get("horario") or data.get("horario_recepcion") or "9:00 AM a 4:00 PM").strip()
            pago = str(data.get("metodo_pago") or "TRANSFERENCIA_CONTRA_ENTREGA").strip()
            default_tipo = "1 Paquete Completo Mallas Tlaxcalli ($1,713)" if es_mallas else (nicho_ctx.get("oferta_gancho") or f"Pedido {nicho_ctx.get('nombre_negocio', '')}")
            tipo = str(data.get("tipo_pedido") or default_tipo).strip()
            raw_monto = data.get("monto_venta") if data.get("monto_venta") not in (None, "") else data.get("monto")
            if raw_monto in (None, ""):
                monto = 1713.0 if es_mallas else 0.0
            else:
                try:
                    monto = float(str(raw_monto).replace("$", "").replace(",", "").strip() or 0.0)
                except Exception:
                    monto = 1713.0 if es_mallas else 0.0

            raw_comision = data.get("comision_agencia") if data.get("comision_agencia") not in (None, "") else data.get("comision")
            if raw_comision in (None, ""):
                comision = 200.0
            else:
                try:
                    comision = float(str(raw_comision).replace("$", "").replace(",", "").strip() or 200.0)
                except Exception:
                    comision = 200.0

            # Permitir registrar múltiples paradas manuales si trae flag forzar_nuevo o distinta dirección
            forzar_nuevo = bool(data.get("forzar_nuevo", False))

            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            hoy_pref = datetime.now().strftime("%Y-%m-%d")
            ya_existe = None
            if not forzar_nuevo:
                cur.execute(
                    "SELECT id FROM pedidos_comisiones WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?) AND telefono = ? AND fecha_cierre LIKE ? ORDER BY id DESC LIMIT 1",
                    (cid_resolved, tel, f"{hoy_pref}%")
                )
                ya_existe = cur.fetchone()
            if not ya_existe:
                cur.execute("SELECT COUNT(*) FROM pedidos_comisiones")
                n = cur.fetchone()[0] + 1
                pref_folio = "TLX" if es_mallas else cid_resolved[:4].upper()
                folio = f"{pref_folio}-ORD-{n:03d}"
                maps_url = motor_m1.construir_link_google_maps(cliente, direccion, muni)
                cur.execute("""
                    INSERT INTO pedidos_comisiones (
                        folio, cliente_tortilleria, telefono, direccion_gps, municipio,
                        horario_recepcion, metodo_pago, tipo_pedido, monto_venta,
                        comision_agencia, estatus_entrega, google_maps_url, fecha_cierre,
                        id_cliente_agencia
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    folio, cliente, tel, direccion, muni, horario, pago, tipo,
                    monto, comision, "EN_RUTA_REPARTIDOR", maps_url,
                    datetime.now().strftime("%Y-%m-%d %H:%M"), cid_resolved
                ))
                conn.commit()
            conn.close()
            bd_info = obtener_datos_completos_bd(cid_resolved)
            self._send_json({"ok": True, "cliente_id": cid_resolved, "pedidos": bd_info["pedidos"], "duplicado": bool(ya_existe)})
            return

        if self.path == "/api/confirmar_entrega_comision":
            pedido_id = int(data.get("id", 0))
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            cid_resolved, _, _ = resolver_contexto_tenant_request(email_req, cid_req)
            if not cid_resolved:
                self._send_json({"ok": False, "error": "Perfil no encontrado."})
                return
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute(
                "UPDATE pedidos_comisiones SET estatus_entrega = 'ENTREGADO_Y_PAGADO' WHERE id = ? AND LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)",
                (pedido_id, cid_resolved)
            )
            conn.commit()
            conn.close()
            bd_info = obtener_datos_completos_bd(cid_resolved)
            self._send_json({"ok": True, "pedidos": bd_info["pedidos"]})
            return

        if clean_path == "/api/optimizar_ruta":
            punto_partida = str(data.get("punto_partida") or "Centro CDMX, Cuauhtemoc").strip()
            estrategia = str(data.get("estrategia") or "cercanos_primero").strip().lower()
            paradas_req = data.get("paradas")
            if not isinstance(paradas_req, list):
                email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
                cid_req = str(data.get("cliente_id") or "").strip()
                cid_resolved, _, _ = resolver_contexto_tenant_request(email_req, cid_req)
                if cid_resolved:
                    bd_info = obtener_datos_completos_bd(cid_resolved)
                    paradas_req = [
                        p for p in (bd_info.get("pedidos") or [])
                        if str(p.get("estatus_entrega") or "") == "EN_RUTA_REPARTIDOR"
                    ]
                else:
                    paradas_req = []
            res_ruta = optimizar_ruta_paradas(punto_partida, estrategia, paradas_req)
            self._send_json(res_ruta)
            return

        if clean_path in ("/api/generar_marketing", "/api/generar-campana"):
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            enfoque = str(data.get("enfoque") or data.get("descripcion_idea") or data.get("productDesc") or "").strip()
            zona = str(data.get("zona") or "CDMX y Zona Metropolitana").strip()
            mod_neg = str(data.get("modelo_negocio") or "").strip()
            mod_ent = str(data.get("modalidad_entrega") or "").strip()
            res = generar_campana_marketing_ia(
                enfoque=enfoque,
                zona=zona,
                owner_email=email_req,
                cliente_id=cid_req,
                modelo_negocio=mod_neg,
                modalidad_entrega=mod_ent
            )
            self._send_json(res)
            return

        if self.path == "/api/editar_flyer_ia":
            instruccion = str(data.get("texto", "") or "")
            base64_img = data.get("base64")
            es_nueva = bool(data.get("es_nueva_foto", False))
            res_ed = procesar_edicion_flyer_ia(instruccion, base64_img=base64_img, es_nueva_foto=es_nueva)
            self._send_json(res_ed)
            return

        if self.path == "/api/reiniciar_chat_cliente":
            sid = str(data.get("session_id", ""))
            if sid in SESIONES_CHAT:
                del SESIONES_CHAT[sid]
            self._send_json({"ok": True})
            return

        if self.path in ("/api/control_motor", "/control_motor"):
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            if email_req:
                cid_target, nicho_ctx, es_mallas = resolver_contexto_tenant_request(email_req, cid_req)
                if not cid_target or not nicho_ctx:
                    self._send_json({"ok": False, "error": "Primero configura tu negocio en 01 • IDEA."}, status=400)
                    return
            else:
                cid_target = motor_m1.normalizar_cliente_id(cid_req or "mallas_tlaxcalli")
                es_mallas = (cid_target == "mallas_tlaxcalli")

            accion = str(data.get("accion") or "").strip().lower()
            if "activo" in data:
                activo = bool(data.get("activo", False))
                if es_mallas:
                    ESTADO_MOTOR_50_DIARIOS["activo"] = activo
                    guardar_config("motor_50_activo", "1" if activo else "0")
                    guardar_config("auto_responder_activo", "1" if activo else "0")
                if not accion:
                    accion = "reanudar_frio" if activo else "pausar_frio"
            elif accion in ("reanudar_frio", "activar", "reanudar_todo") and es_mallas:
                ESTADO_MOTOR_50_DIARIOS["activo"] = True
                guardar_config("motor_50_activo", "1")
            elif accion in ("pausar_frio", "pausar", "pausar_todo") and es_mallas:
                ESTADO_MOTOR_50_DIARIOS["activo"] = False
                guardar_config("motor_50_activo", "0")

            res_bridge = _llamar_bridge_wa("/control_motor", {
                "cliente_id": cid_target,
                "accion": accion or "reanudar_frio"
            }, timeout=8)
            self._send_json({
                "ok": True,
                "cliente_id": cid_target,
                "activo": ESTADO_MOTOR_50_DIARIOS["activo"] if es_mallas else (not res_bridge.get("motorPausadoLocal", False)),
                "bridge": res_bridge
            })
            return

        if self.path in ("/api/vincular_wa", "/vincular_wa"):
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            telefono = str(data.get("telefono") or "").strip()
            if email_req:
                cid_target, nicho_ctx, _ = resolver_contexto_tenant_request(email_req, cid_req)
                if not cid_target or not nicho_ctx:
                    self._send_json({
                        "ok": False,
                        "error": "Primero registra tu producto o idea en '01 • IDEA' antes de vincular tu línea de WhatsApp."
                    }, status=400)
                    return
            else:
                cid_target = motor_m1.normalizar_cliente_id(cid_req or "mallas_tlaxcalli")

            res_vinc = _llamar_bridge_wa("/vincular_wa", {
                "cliente_id": cid_target,
                "telefono": telefono
            }, timeout=20)
            self._send_json(res_vinc)
            return

        if self.path in ("/api/desvincular_wa", "/desvincular_wa"):
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            if email_req:
                cid_target, nicho_ctx, _ = resolver_contexto_tenant_request(email_req, cid_req)
                if not cid_target or not nicho_ctx:
                    self._send_json({"ok": False, "error": "Perfil no encontrado."}, status=400)
                    return
            else:
                cid_target = motor_m1.normalizar_cliente_id(cid_req or "mallas_tlaxcalli")

            if cid_target == "mallas_tlaxcalli":
                self._send_json({
                    "ok": False,
                    "error": "La sesión principal de Mallas Tlaxcalli está protegida y no puede desvincularse."
                }, status=403)
                return

            res_desv = _llamar_bridge_wa("/desvincular_wa", {
                "cliente_id": cid_target
            }, timeout=12)
            self._send_json(res_desv)
            return

        if self.path == "/api/agente_ceo_pau":
            msg_pau = data.get("mensaje", "")
            incluir_voz = bool(data.get("incluir_voz", False))
            session_id = str(data.get("session_id", "wa_dueno_5215648847438"))
            try:
                res_ceo = llamar_agente_ceo_paola(msg_pau, session_id=session_id)
            except Exception as e_ceo:
                res_ceo = {"ok": True, "respuesta_ceo": f"Hola, te escucho con atención. ¿En qué puedo apoyarte hoy con Mallas Tlaxcalli? ({str(e_ceo)})"}
            if not isinstance(res_ceo, dict):
                res_ceo = {"ok": True, "respuesta_ceo": "Hola, te escucho con atención. ¿En qué puedo apoyarte hoy con Mallas Tlaxcalli?"}
            if incluir_voz and res_ceo.get("respuesta_ceo"):
                try:
                    voz = generar_nota_voz_femenina_wav(res_ceo["respuesta_ceo"])
                    if isinstance(voz, dict) and voz.get("ok"):
                        res_ceo["audio_data_url"] = voz.get("audio_data_url", "")
                except Exception as err_v:
                    print(f"Error generando voz: {err_v}")
            self._send_json(res_ceo)
            return

        if self.path == "/api/pedir_codigo_wa":
            tel = data.get("telefono", "")
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            if email_req:
                cid_target, nicho_ctx, _ = resolver_contexto_tenant_request(email_req, cid_req)
                if not cid_target or not nicho_ctx:
                    self._send_json({"ok": False, "error": "Primero registra tu negocio en 01 • IDEA."}, status=400)
                    return
            else:
                cid_target = motor_m1.normalizar_cliente_id(cid_req or "mallas_tlaxcalli")
            try:
                req = urllib.request.Request(
                    "http://127.0.0.1:8095/codigo_8_digitos",
                    data=json.dumps({"cliente_id": cid_target, "telefono": tel}).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    self._send_json(json.loads(resp.read().decode("utf-8")))
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)})
            return

        if self.path == "/api/siguiente_envio_50_diarios":
            forzar = bool(data.get("forzar", False))
            cid_req = motor_m1.normalizar_cliente_id(data.get("cliente_id") or "mallas_tlaxcalli")
            if cid_req == "mallas_tlaxcalli" and not ESTADO_MOTOR_50_DIARIOS["activo"] and not forzar:
                self._send_json({"ok": False, "motivo": "MOTOR_50_EN_PAUSA", "id_cliente_agencia": cid_req})
                return
            res_50 = obtener_siguiente_envio_50_diarios(cliente_id=cid_req)
            self._send_json(res_50)
            return

        if self.path == "/api/obtener_candidato_envio_50":
            forzar = bool(data.get("forzar", False))
            cid_req = motor_m1.normalizar_cliente_id(data.get("cliente_id") or "mallas_tlaxcalli")
            cand = obtener_candidato_envio_50(cliente_id=cid_req, forzar=forzar)
            self._send_json(cand)
            return

        if self.path == "/api/confirmar_envio_50":
            pid = int(data.get("id", 0))
            enviado = bool(data.get("enviado", False))
            motivo = str(data.get("motivo", ""))
            tel_real = str(data.get("telefono_real", ""))
            mensaje = str(data.get("mensaje", ""))
            cid_req = str(data.get("cliente_id") or "").strip()
            res_conf = confirmar_envio_50(pid, enviado, motivo=motivo, telefono_real=tel_real, mensaje=mensaje, cliente_id=cid_req)
            self._send_json(res_conf)
            return

        if self.path == "/api/marcar_lote_wa":
            resultados = data.get("resultados", [])
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            con_wa = 0
            sin_wa = 0
            for item in resultados:
                pid = int(item.get("id", 0))
                existe = bool(item.get("existe", False))
                tel_canon = str(item.get("telefono_canonico", ""))
                if existe:
                    con_wa += 1
                    if tel_canon:
                        cur.execute(
                            "UPDATE prospectos_cazador SET estatus_contacto_wa = 'VERIFICADO_WA' WHERE id = ?",
                            (pid,)
                        )
                    else:
                        cur.execute("UPDATE prospectos_cazador SET estatus_contacto_wa = 'VERIFICADO_WA' WHERE id = ?", (pid,))
                else:
                    sin_wa += 1
                    cur.execute("UPDATE prospectos_cazador SET estatus_contacto_wa = 'SIN_WHATSAPP' WHERE id = ?", (pid,))
            conn.commit()
            conn.close()
            exportar_excel_en_vivo()
            self._send_json({"ok": True, "con_wa": con_wa, "sin_wa": sin_wa})
            return

        if self.path == "/api/verificar_dueno_wa":
            jid = data.get("jid", "")
            texto = data.get("texto", "").strip()
            txt_low = texto.lower()
            autorizar_auto = bool(data.get("autorizar", False))
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()

            # 1. Cierre de sesión manual / cambio a Modo Cliente para pruebas
            if txt_low in ("#logout", "cerrar sesion", "cerrar sesión", "salir admin", "modo cliente", "modo clienta", "probar ventas"):
                cur.execute("DELETE FROM duenos_autorizados_wa WHERE jid = ?", (jid,))
                conn.commit()
                conn.close()
                sid_clean = f"wa_{jid}"
                if sid_clean in SESIONES_CHAT:
                    del SESIONES_CHAT[sid_clean]
                self._send_json({
                    "es_dueno": False,
                    "sesion_cerrada": True,
                    "mensaje_auth": "🛍️ *Modo Cliente Activado:* Sesión de administradora cerrada y memoria de prueba reiniciada.\n\nEscríbeme cualquier mensaje (ej. *'Hola, ¿qué precio tienen las mallas?'*) para que te atienda *Andrea (Ventas)*.\n_(Para volver a Modo Dueña escribe *#admin 7210B*)_"
                })
                return

            # 2. Validación de credenciales de usuario y contraseña / PIN
            cur.execute("SELECT usuario, password, nombre FROM admin_usuarios")
            usuarios_bd = cur.fetchall()

            login_exitoso = False
            nombre_auth = "Administrador"

            if autorizar_auto:
                login_exitoso = True
                nombre_auth = "Ing. Paola Almanza (Línea Vinculada)"
            else:
                for u, p, nom in usuarios_bd:
                    p_clean = p.strip()
                    # Soporta: '#login paola Tlaxcalli2026', '#admin Tlaxcalli2026', '#clave 7210B', o mandar la clave exacta
                    if (
                        p_clean.lower() in txt_low
                        or txt_low.startswith(f"#login {u.lower()}")
                        or txt_low == f"#admin {p_clean.lower()}"
                        or txt_low == f"#clave {p_clean.lower()}"
                        or txt_low == p_clean.lower()
                    ):
                        login_exitoso = True
                        nombre_auth = nom
                        break

            if login_exitoso:
                cur.execute("INSERT OR REPLACE INTO duenos_autorizados_wa (jid, nombre, fecha_registro) VALUES (?, ?, ?)",
                            (jid, nombre_auth, datetime.now().strftime("%Y-%m-%d %H:%M")))
                conn.commit()
                conn.close()
                self._send_json({
                    "es_dueno": True,
                    "recien_activado": (not autorizar_auto),
                    "nombre_admin": nombre_auth,
                    "mensaje_auth": f"🔐 ¡Acceso autorizado! Bienvenida {nombre_auth}.\n👑 Modo Administradora / CDO activo en este número."
                })
                return

            cur.execute("SELECT COUNT(*), nombre FROM duenos_autorizados_wa WHERE jid = ?", (jid,))
            row = cur.fetchone()
            es_dueno = bool(row and row[0] > 0)
            nombre_registrado = row[1] if es_dueno else ""
            conn.close()
            self._send_json({
                "es_dueno": es_dueno,
                "nombre_admin": nombre_registrado,
                "recien_activado": False
            })
            return

        if self.path == "/api/despachar_cola_paola":
            pendientes = [m for m in COLA_MENSAJES_PAOLA if m.get("estatus") == "EN_COLA_LISTO_PARA_ENVIAR"]
            for m in pendientes:
                m["estatus"] = "ENVIADO_POR_WHATSAPP"
            self._send_json({"ok": True, "despachados": pendientes})
            return

        if self.path == "/api/subir_foto_pau":
            nombre = re.sub(r"[^a-zA-Z0-9._-]", "_", data.get("nombre", "foto_pau.jpg"))
            caption = str(data.get("caption", "") or "")
            cap_low = motor_m1.quitar_acentos(caption)
            categoria = data.get("categoria", "")
            if not categoria:
                if any(k in cap_low for k in ["publicidad", "marketing", "promo", "anuncio", "flyer", "#publi", "#mkt", "estado", "red"]):
                    categoria = "publicidad"
                else:
                    categoria = "producto"

            b64_content = data.get("base64", "")
            if "," in b64_content:
                b64_content = b64_content.split(",", 1)[1]
            raw_bytes = base64.b64decode(b64_content)

            carpetas_dest = (
                RUTAS_PUBLICIDAD_PAU if categoria == "publicidad"
                else ["/config/workspace/imágenes negocio pau", "/config/workspace/imagenes_negocio_pau", os.path.join(BASE_DIR, "imagenes_negocio_pau")]
            )
            for carpeta in carpetas_dest:
                try:
                    os.makedirs(carpeta, exist_ok=True)
                    with open(os.path.join(carpeta, nombre), "wb") as out:
                        out.write(raw_bytes)
                except Exception:
                    pass

            tot_prod = len(listar_imagenes_producto_reales())
            tot_pub = len(listar_publicidad_pau())

            # Generar automáticamente la campaña y copys listos para redes sociales
            res_mkt = generar_campana_marketing_ia(
                enfoque="Paquete Completo de Mantenimiento $1,713 MXN (Malla Testalera + Transportadora Cal 14 + Balero 7210B alemán)",
                zona="Edomex y CDMX"
            )
            copy_mkt = res_mkt.get("contenido", "")

            msg_wa = (
                f"🎨 *¡IMAGEN RECIBIDA Y PUBLICIDAD GENERADA LISTA PARA PUBLICAR!* 🚀\n\n"
                f"📸 Guardada en: *{'Publicidad / Marketing' if categoria == 'publicidad' else 'Catálogo de Ventas'}* (`{nombre}`)\n"
                f"📊 Catálogo activo: *{tot_prod} fotos reales* | *{tot_pub} flyers de marketing*.\n\n"
                f"───────────────────────────────\n"
                f"📢 *PUBLICIDAD LISTA PARA REDES:*\n\n"
                f"{copy_mkt}\n\n"
                f"───────────────────────────────\n"
                f"📲 *Ya puedes copiar y pegar estos textos con la imagen adjunta en tus redes sociales de Mallas Tlaxcalli.*"
            )

            ruta_guardada = os.path.join(carpetas_dest[0], nombre) if carpetas_dest else ""

            self._send_json({
                "ok": True,
                "categoria": categoria,
                "total_producto": tot_prod,
                "total_publicidad": tot_pub,
                "mensaje_wa": msg_wa,
                "foto_retorno": ruta_guardada,
                "fotos": listar_imagenes_pau()
            })
            return

        if self.path == "/api/transcribir_audio":
            b64_audio = data.get("audio_b64", "")
            mime = data.get("mimetype", "audio/ogg")
            if not b64_audio:
                self._send_json({"ok": False, "texto": "", "error": "Sin audio"})
                return
            texto = transcribir_audio_gemini(b64_audio, mime)
            self._send_json({"ok": True, "texto": texto})
            return

        if clean_path == "/api/cazador/frentes":
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            cid, nicho_ctx, es_mallas = resolver_contexto_tenant_request(email_req, cid_req)
            if not cid or not nicho_ctx:
                self._send_json({"ok": False, "error": "Primero configura tu negocio en 01 • IDEA."}, status=400)
                return
            if es_mallas or cid == "mallas_tlaxcalli":
                self._send_json({"ok": False, "error": "mallas_tlaxcalli está protegido en Fast-Path Legacy."}, status=403)
                return

            accion = str(data.get("accion") or "crear").strip().lower()
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()

            if accion == "config":
                zonas_n = str(data.get("zonas_objetivo") or nicho_ctx.get("zonas_objetivo") or "CDMX y Area Metropolitana").strip()[:220]
                flujo_n = 1 if bool(data.get("flujo_continuo_activo", True)) else 0
                cur.execute(
                    "UPDATE perfiles_nicho SET zonas_objetivo = ?, flujo_continuo_activo = ? WHERE LOWER(cliente_id) = LOWER(?) AND protegido = 0",
                    (zonas_n, flujo_n, cid),
                )
            elif accion == "toggle_frente":
                fid = int(data.get("id") or 0)
                act = 1 if bool(data.get("activo", True)) else 0
                cur.execute(
                    "UPDATE frentes_caza SET activo = ? WHERE id = ? AND LOWER(id_cliente_agencia) = LOWER(?)",
                    (act, fid, cid),
                )
            elif accion == "eliminar":
                fid = int(data.get("id") or 0)
                cur.execute(
                    "DELETE FROM frentes_caza WHERE id = ? AND LOWER(id_cliente_agencia) = LOWER(?)",
                    (fid, cid),
                )
            else:
                fid = data.get("id")
                nf = str(data.get("nombre_frente") or "").strip()[:80]
                kf = str(data.get("keywords_busqueda") or nicho_ctx.get("keywords_busqueda") or "").strip()[:160]
                tf = str(data.get("ticket_estimado") or "").strip()[:60]
                af = str(data.get("angulo_andrea") or "").strip()[:260]
                if not nf:
                    conn.close()
                    self._send_json({"ok": False, "error": "El nombre del frente es obligatorio."}, status=400)
                    return
                if fid:
                    cur.execute("""
                        UPDATE frentes_caza SET nombre_frente = ?, keywords_busqueda = ?, ticket_estimado = ?, angulo_andrea = ?
                        WHERE id = ? AND LOWER(id_cliente_agencia) = LOWER(?)
                    """, (nf, kf, tf, af, int(fid), cid))
                else:
                    cur.execute("""
                        INSERT INTO frentes_caza (id_cliente_agencia, nombre_frente, keywords_busqueda, ticket_estimado, angulo_andrea, activo)
                        VALUES (?, ?, ?, ?, ?, 1)
                    """, (cid, nf, kf, tf, af))

            conn.commit()
            conn.close()
            self._send_json(_limpiar_cache_frentes_estado(cid))
            return

        if clean_path == "/api/cazar/auto-abastecer" or clean_path == "/api/cazador/auto-abastecer":
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            cid, nicho_ctx, es_mallas = resolver_contexto_tenant_request(email_req, cid_req)
            if not cid or not nicho_ctx:
                self._send_json({"ok": False, "error": "Primero configura tu negocio en 01 • IDEA."}, status=400)
                return
            if es_mallas or cid == "mallas_tlaxcalli":
                self._send_json({
                    "ok": True,
                    "fast_path_legacy": True,
                    "omitido": True,
                    "cliente_id": "mallas_tlaxcalli",
                    "motivo": "mallas_tlaxcalli usa flujo legacy protegido",
                })
                return
            forzar_auto = bool(data.get("forzar", True))
            fid_req = data.get("frente_id")
            zona_ov = str(data.get("zona") or "").strip()
            fuente_ov = str(data.get("fuente") or "APIFY").strip().upper()
            res_auto = auto_abastecer_cliente(
                cid,
                forzar=forzar_auto,
                frente_id_req=int(fid_req) if fid_req else None,
                zona_override=zona_ov,
                fuente_preferida=fuente_ov,
            )
            self._send_json(res_auto)
            return

        if self.path == "/api/cazar_lote_10":
            muni = str(data.get("municipio") or data.get("zona") or "Ecatepec").strip()
            if muni == "TODOS":
                muni = "Ecatepec"
            fuente = data.get("fuente", "INEGI")
            email_req = str(data.get("owner_email") or data.get("email") or "").strip().lower()
            cid_req = str(data.get("cliente_id") or "").strip()
            cid, nicho, es_tlaxcalli = resolver_contexto_tenant_request(email_req, cid_req)
            if not cid or not nicho:
                self._send_json({
                    "ok": False,
                    "error": "Primero define tu producto o idea en '01 • IDEA' para activar la búsqueda de prospectos de tu negocio."
                }, status=400)
                return

            # ================= FAST-PATH LEGACY OBLIGATORIO: MALLAS TLAXCALLI =================
            if es_tlaxcalli or cid == "mallas_tlaxcalli":
                perfil = construir_perfil_motor_desde_nicho("mallas_tlaxcalli")
                env = motor_m1.cargar_env()
                if fuente == "FACEBOOK":
                    try:
                        import modulo_1b_cazador_facebook as motor_fb
                    except ImportError:
                        from scripts import modulo_1b_cazador_facebook as motor_fb
                    modo = str(data.get("modo", "KEYWORD") or "KEYWORD").upper()
                    target_custom = str(data.get("target", "") or "").strip()
                    target_query = target_custom if target_custom else f"tortilleria maquinaria refacciones {muni}"

                    def _tarea_caza_fb_tlx():
                        try:
                            motor_fb.ejecutar_caza_facebook(
                                target_query,
                                municipio_default=muni,
                                max_posts=20,
                                cliente_id="mallas_tlaxcalli",
                                perfil_nicho=nicho
                            )
                        except Exception as err_fb:
                            print(f"   [!] Error en hilo asíncrono Facebook (mallas_tlaxcalli): {err_fb}")

                    threading.Thread(target=_tarea_caza_fb_tlx, daemon=True).start()
                    bd_info = obtener_datos_completos_bd("mallas_tlaxcalli")
                    self._send_json({
                        "ok": True,
                        "async": True,
                        "cliente_id": "mallas_tlaxcalli",
                        "fuente": "FACEBOOK",
                        "mensaje": f"Cazando en Facebook ({target_query}) para {nicho['nombre_negocio']}...",
                        "total_acumulado": len(bd_info["prospectos"]),
                        "prospectos": bd_info["prospectos"]
                    })
                    return

                if fuente == "APIFY":
                    estado_q = "Ciudad de Mexico" if "CDMX" in muni.upper() else "Estado de Mexico"
                    query_maps = f"Tortilleria en {muni}, {estado_q}, Mexico"
                    nuevos = motor_m1.extraer_apify_google_maps(query_maps, 10, env.get("APIFY_API_TOKEN", ""), perfil=perfil)
                else:
                    clave_ent = "09" if "CDMX" in muni.upper() else "15"
                    termino = "tortilleria cdmx" if clave_ent == "09" else f"tortilleria {muni.lower()}"
                    ini = OFFSET_EXTRACCION_INEGI["actual"]
                    OFFSET_EXTRACCION_INEGI["actual"] += 10
                    nuevos = motor_m1.extraer_inegi_por_municipio(termino, clave_ent, 10, env.get("INEGI_DENUE_TOKEN", ""), reg_ini=ini, perfil=perfil)

                clasificados = [motor_m1.clasificar_negocio(r, perfil) for r in nuevos]
                motor_m1.guardar_y_exportar(clasificados, "mallas_tlaxcalli")
                bd_info = obtener_datos_completos_bd("mallas_tlaxcalli")
                self._send_json({
                    "ok": True,
                    "cliente_id": "mallas_tlaxcalli",
                    "lote_extraido": len(nuevos[:10]),
                    "total_acumulado": len(bd_info["prospectos"]),
                    "prospectos": bd_info["prospectos"]
                })
                return

            # ================= FLUJO MULTI-FRENTE Y COBERTURA DINÁMICA (CLIENTES NUEVOS) =================
            if normalizar_modelo_negocio(nicho.get("modelo_negocio", "DISTRIBUIDOR_B2B")) == "EMPRENDEDOR_B2C":
                self._send_json({
                    "ok": False,
                    "error": "Modo Particular B2C activo: la prospección en frío está desactivada para proteger tu línea contra bloqueos. Atrae clientes con tus creativos de 02 • ESTUDIO y Andrea los atenderá 24/7."
                }, status=400)
                return

            perfil = construir_perfil_motor_desde_nicho(cid)
            perfil["cobertura_logistica"] = {"municipios_edomex_autorizados": [], "alcaldias_cdmx_autorizadas": [], "colonias_zonas_rojas": []}
            env = motor_m1.cargar_env()

            frente_id = int(data.get("frente_id") or 0)
            frente_nombre = str(data.get("frente_nombre") or "").strip()
            angulo_contacto = str(data.get("angulo_contacto") or "").strip()
            kws_frente = str(data.get("keywords_frente") or "").strip()
            if frente_id and not (frente_nombre and kws_frente):
                estado_fr = _limpiar_cache_frentes_estado(cid)
                match_fr = next((f for f in estado_fr["frentes"] if int(f["id"]) == frente_id), None)
                if match_fr:
                    frente_nombre = frente_nombre or match_fr["nombre_frente"]
                    angulo_contacto = angulo_contacto or match_fr["angulo_andrea"]
                    kws_frente = kws_frente or match_fr["keywords_busqueda"]

            kws_src = kws_frente or nicho.get("keywords_busqueda") or nicho.get("giro_objetivo") or "negocio"
            kws_nicho = [k.strip() for k in re.split(r"[,;\n]+", kws_src) if k.strip()]
            kw_principal = kws_nicho[0] if kws_nicho else "negocio"

            if fuente == "FACEBOOK":
                try:
                    import modulo_1b_cazador_facebook as motor_fb
                except ImportError:
                    from scripts import modulo_1b_cazador_facebook as motor_fb

                modo = str(data.get("modo", "KEYWORD") or "KEYWORD").upper()
                target_custom = str(data.get("target", "") or "").strip()
                target_query = target_custom if target_custom else f"{kw_principal} {muni}"

                def _tarea_caza_fb():
                    try:
                        motor_fb.ejecutar_caza_facebook(
                            target_query,
                            municipio_default=muni,
                            max_posts=20,
                            cliente_id=cid,
                            perfil_nicho=nicho
                        )
                    except Exception as err_fb:
                        print(f"   [!] Error en hilo asíncrono Facebook ({cid}): {err_fb}")

                threading.Thread(target=_tarea_caza_fb, daemon=True).start()
                bd_info = obtener_datos_completos_bd(cid)
                self._send_json({
                    "ok": True,
                    "async": True,
                    "cliente_id": cid,
                    "fuente": "FACEBOOK",
                    "mensaje": f"Cazando en Facebook ({target_query}) para {nicho['nombre_negocio']}...",
                    "total_acumulado": len(bd_info["prospectos"]),
                    "prospectos": bd_info["prospectos"]
                })
                return

            conn = sqlite3.connect(DB_PATH)
            max_id_antes = conn.execute("SELECT COALESCE(MAX(id), 0) FROM prospectos_cazador").fetchone()[0]
            conn.close()

            if fuente == "APIFY":
                _obtener_offset_progreso(cid, frente_id, muni, "APIFY", paso=10)
                query_maps = f"{kw_principal} en {muni}, Mexico"
                nuevos = motor_m1.extraer_apify_google_maps(
                    query_maps,
                    10,
                    env.get("APIFY_API_TOKEN", ""),
                    perfil=perfil
                )
            else:
                offset_inegi = _obtener_offset_progreso(cid, frente_id, muni, "INEGI", paso=10)
                nuevos = motor_m1.extraer_inegi_por_zona_dinamica(
                    kw_principal,
                    muni,
                    10,
                    env.get("INEGI_DENUE_TOKEN", ""),
                    reg_ini=max(1, offset_inegi + 1),
                    perfil=perfil
                )

            for r in nuevos:
                if frente_nombre:
                    r["frente_nombre"] = frente_nombre
                if angulo_contacto:
                    r["angulo_contacto"] = angulo_contacto
                if not r.get("municipio"):
                    r["municipio"] = muni

            clasificados = [motor_m1.clasificar_negocio(r, perfil) for r in nuevos]
            motor_m1.guardar_y_exportar(clasificados, cid)
            _disparar_validacion_wa_batch_async(cid, max_id_antes)
            bd_info = obtener_datos_completos_bd(cid)
            self._send_json({
                "ok": True,
                "cliente_id": cid,
                "frente_nombre": frente_nombre,
                "zona": muni,
                "lote_extraido": len(nuevos[:10]),
                "total_acumulado": len(bd_info["prospectos"]),
                "prospectos": bd_info["prospectos"]
            })
            return


def generar_html_publico_seguro() -> str:
    return r"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mallas Tlaxcalli v3.0 — Los 5 Módulos Completos (Agencia TopDiegoz en VPS Ubuntu)</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { --bg:#0f172a; --card:#1e293b; --border:#334155; --primary:#f59e0b; --accent:#10b981; --text:#f8fafc; --muted:#94a3b8; --wa:#25d366; --pink:#ec4899; --blue:#38bdf8; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); padding-bottom:60px; }
    header { background:#111827; border-bottom:1px solid var(--border); padding:16px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
    .tabs { display:flex; gap:8px; padding:12px 24px; background:#0b1120; border-bottom:1px solid var(--border); overflow-x:auto; }
    .tab { background:var(--card); color:var(--muted); border:1px solid var(--border); padding:10px 14px; border-radius:8px; font-weight:700; cursor:pointer; white-space:nowrap; font-size:0.81rem; }
    .tab.active { background:var(--primary); color:#000; border-color:var(--primary); }
    .container { max-width:1380px; margin:20px auto; padding:0 20px; }
    .pane { display:none; }
    .pane.active { display:block; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:20px; }
    .grid-4 { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin-bottom:18px; }
    .grid-2 { display:grid; grid-template-columns:1.15fr 0.85fr; gap:20px; }
    @media(max-width:920px){ .grid-2 { grid-template-columns:1fr; } }
    .stat { background:#111827; border:1px solid var(--border); padding:16px; border-radius:10px; }
    .stat-lbl { font-size:0.74rem; color:var(--muted); text-transform:uppercase; font-weight:700; }
    .stat-val { font-size:1.55rem; font-weight:800; margin-top:4px; }
    input, select, textarea { background:#0f172a; border:1px solid var(--border); color:#fff; padding:9px 12px; border-radius:8px; width:100%; font-family:inherit; }
    .btn { background:var(--wa); color:#000; border:none; padding:8px 13px; border-radius:8px; font-weight:800; cursor:pointer; font-size:0.79rem; display:inline-flex; align-items:center; gap:5px; text-decoration:none; }
    .btn-amber { background:var(--primary); color:#000; }
    .btn-pink { background:var(--pink); color:#fff; }
    .btn-blue { background:var(--blue); color:#000; }
    .btn-dark { background:#334155; color:#fff; }
    table { width:100%; border-collapse:collapse; font-size:0.81rem; margin-top:12px; }
    th { text-align:left; padding:10px; background:#0f172a; color:var(--muted); border-bottom:1px solid var(--border); }
    td { padding:10px; border-bottom:1px solid rgba(255,255,255,0.06); vertical-align:middle; }
    .badge { padding:3px 8px; border-radius:6px; font-size:0.71rem; font-weight:700; display:inline-block; }
    .b-ok { background:rgba(16,185,129,0.2); color:#34d399; }
    .b-warn { background:rgba(245,158,11,0.2); color:#fbbf24; }
    .b-red { background:rgba(239,68,68,0.2); color:#f87171; }
    .b-pink { background:rgba(236,72,153,0.2); color:#f472b6; }
    .chat-wrap { background:#0b141a; border:1px solid var(--border); border-radius:12px; height:550px; display:flex; flex-direction:column; }
    .chat-head { background:#202c33; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-radius:12px 12px 0 0; flex-wrap:wrap; gap:8px; }
    .chat-msgs { flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; }
    .msg { max-width:84%; padding:11px 14px; border-radius:12px; font-size:0.88rem; line-height:1.45; white-space:pre-wrap; }
    .msg.bot { background:#202c33; align-self:flex-start; color:#e9edef; }
    .msg.user { background:#005c4b; align-self:flex-end; color:#e9edef; }
    .voice-box { margin-top:8px; background:#111b21; border:1px solid #2a3942; border-radius:999px; padding:6px 12px; display:flex; align-items:center; gap:8px; }
    .voice-box audio { height:32px; max-width:240px; }
    .photo-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:8px; margin-top:8px; }
    .photo-grid img { width:100%; border-radius:8px; border:1px solid #334155; cursor:pointer; }
    .chips { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
    .chip { background:#2a3942; color:#cbd5e1; border:1px solid var(--border); padding:6px 11px; border-radius:999px; font-size:0.74rem; cursor:pointer; }
    .chip:hover { border-color:var(--primary); color:#fff; }
    .studio-img-wrap { background:#090d16; border:2px solid var(--border); border-radius:12px; padding:14px; text-align:center; position:relative; overflow:hidden; }
    .studio-img-wrap img { max-width:100%; max-height:280px; border-radius:8px; transition:filter 0.25s ease, transform 0.25s ease; }
    .watermark-badge { position:absolute; bottom:24px; right:24px; background:rgba(15,23,42,0.88); border:1px solid var(--primary); color:#fff; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:800; pointer-events:none; }
  </style>
</head>
<body>
  <header>
    <div>
      <div style="font-size:0.75rem; color:var(--accent); font-weight:800;">🟢 CORRIENDO 24/7 EN TU NUEVA VPS UBUNTU (8 GB RAM) • AGENCIA TOPDIEGOZ</div>
      <h2 style="margin-top:2px;">Ecosistema Completo 5 Módulos — Mallas Tlaxcalli (Ing. Paola Almanza / Ing. Rocha)</h2>
    </div>
    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
      <a href="/qr" target="_blank" class="btn" style="font-size:0.78rem; padding:7px 12px;">📲 Conectar WhatsApp Real (QR)</a>
      <a href="/excel_mallas_tlaxcalli.csv" target="_blank" class="btn btn-blue" style="font-size:0.78rem; padding:7px 12px;">📊 Descargar Excel en Vivo (.csv)</a>
      <a id="btnAbrirN8NHeader" href="https://agencia-topdiegozc-vsc-server.ngssgr.easypanel.host/proxy/5678/" target="_blank" class="btn btn-amber" style="font-size:0.78rem; padding:7px 12px;">⚡ Abrir Flujo Visual n8n en Vivo (VPS)</a>
    </div>
  </header>

  <div class="tabs">
    <button class="tab active" onclick="verTab('t-ceo', this)">👑 Agente CDO de Ing. Paola (WhatsApp Conectado a Todo + Excel + Flujo n8n)</button>
    <button class="tab" onclick="verTab('t-m1', this)">📍 Módulo 1: Cazador (10 en 10 + Google Maps + Filtro Abierta/Cerrada)</button>
    <button class="tab" onclick="verTab('t-m2', this)">👩‍💼 Módulo 2: Ventas IA (Voz Mujer + Cero Alucinación + Fotos Pau)</button>
    <button class="tab" onclick="verTab('t-m3', this)">💰 Módulo 3: Pedidos, Rutas y Mis Comisiones ($200 c/u + $2,500 Setup)</button>
    <button class="tab" onclick="verTab('t-m4', this)">🔄 Módulo 4: Seguimiento 24h/72h y Baleros VIP ($26 MXN a los 15 días)</button>
    <button class="tab" onclick="verTab('t-m5', this)">🎨 Módulo 5: Marketing Realista (Fotos Auténticas + FB / IG / TikTok / WA)</button>
  </div>

  <div class="container">
    <!-- ==================== AGENTE CDO DE ING. PAOLA + FLUJO N8N ==================== -->
    <div id="t-ceo" class="pane active">
      <div class="card" style="border-color:var(--primary); background:linear-gradient(135deg,#111827,#1e293b);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
          <div>
            <span class="badge b-warn">⚡ CERO PÁGINAS WEB PARA EL CLIENTE • TODO EN WHATSAPP + EXCEL + N8N</span>
            <h3 style="margin-top:6px;">WhatsApp Conectado a Todo + Hoja de Excel en Vivo + Flujo Visual n8n</h3>
            <p style="font-size:0.83rem; color:var(--muted); margin-top:4px;">
              La <strong>Ing. Paola</strong> no necesita abrir ninguna página web: todo lo tiene en un chat de <strong>WhatsApp en su teléfono</strong> (donde escribe <code>SOY PAOLA</code> una sola vez para activar su permiso de dueña, pide informes reales, pide su <strong>archivo Excel actualizado</strong> o manda mensajes a negocios) mientras <strong>n8n</strong> trabaja en tiempo real enviando los <strong>50 mensajes diarios sin bloqueo</strong>.
            </p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <a href="/qr" target="_blank" class="btn" style="padding:11px 16px; font-size:0.85rem;">
              📲 1. Escanear QR de WhatsApp
            </a>
            <a href="/excel_mallas_tlaxcalli.csv" target="_blank" class="btn btn-blue" style="padding:11px 16px; font-size:0.85rem;">
              📊 2. Descargar Hoja de Excel en Vivo
            </a>
            <a id="btnAbrirN8N" href="https://agencia-topdiegozc-vsc-server.ngssgr.easypanel.host/proxy/5678/" target="_blank" class="btn btn-amber" style="padding:11px 16px; font-size:0.85rem;">
              🔗 3. Ver Flujo n8n en Tiempo Real
            </a>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- CHAT WHATSAPP DEL AGENTE CDO DE LA ING. PAOLA -->
        <div>
          <div class="chat-wrap">
            <div class="chat-head" style="background:#1e1b4b; border-bottom:1px solid #4338ca;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:900; color:#000;">CDO</div>
                <div>
                  <strong>👑 Agente CDO IA — Exclusivo para Ing. Paola Almanza (WhatsApp)</strong>
                  <div style="font-size:0.72rem; color:#a5b4fc;">● Conectado en vivo a SQLite (M1, M2, M3, M4 y M5) • Informes + Cazar + Enviar Mensajes</div>
                </div>
              </div>
              <label style="font-size:0.74rem; display:flex; align-items:center; gap:5px; cursor:pointer; background:#111827; padding:6px 10px; border-radius:8px; border:1px solid var(--border);">
                <input type="checkbox" id="chkVozPaola" checked style="width:auto;"> 🎙️ Audio Ejecutivo
              </label>
            </div>

            <div class="chat-msgs" id="chatMsgsPaola">
              <div class="msg bot">
                ¡Hola <strong>Ing. Paola</strong>! Soy su <strong>Agente CDO de Inteligencia Artificial</strong> conectado en tiempo real a todo el ecosistema de <strong>Mallas Tlaxcalli</strong>.<br><br>Desde su WhatsApp usted puede:<br>1️⃣ <strong>Pedirme informes en vivo</strong> (cuántas ventas llevamos hoy, qué choferes van en ruta y cuántas tortillerías tenemos por municipio).<br>2️⃣ <strong>Ordenarme mandarle WhatsApp a un negocio que usted encontró</strong> (ej. <em>"Encontré la Tortillería La Guadalupana al número 5512345678, mándale mensaje ahorita"</em>).<br>3️⃣ <strong>Pedirme buscar tortillerías nuevas</strong> (ej. <em>"Búscame 10 tortillerías en Tlalnepantla con teléfono y Google Maps"</em>).
              </div>
            </div>

            <div style="padding:10px; background:#1e293b; display:flex; gap:8px;">
              <input type="text" id="inputPaola" placeholder="Escribe como la Ing. Paola (ej. 'Dame el informe del día' o 'Mándale mensaje al 5512345678')..." onkeypress="if(event.key==='Enter') enviarComandoPaola()">
              <button class="btn btn-amber" onclick="enviarComandoPaola()" id="btnSendPaola">Enviar a CDO</button>
            </div>
          </div>

          <div class="chips">
            <span class="chip" onclick="probarOrdenPaola('Dame el informe completo del negocio: ¿cuántos pedidos cerrados llevamos, cuánto dinero entró y cuántas tortillerías tenemos por municipio?')">📊 1. Pedir Informe Ejecutivo en Vivo</span>
            <span class="chip" onclick="probarOrdenPaola('Oye, pasé por Ecatepec y vi la Tortillería La Guadalupana abierta, su número es 5512345678, mándale mensaje de ventas ahorita por favor')">📲 2. Ordenar: "Mándale mensaje al negocio que encontré (5512345678)"</span>
            <span class="chip" onclick="probarOrdenPaola('Búscame 10 tortillerías reales en Tlalnepantla con su teléfono y link de Google Maps')">🔎 3. Ordenar: "Búscame 10 tortillerías en Tlalnepantla"</span>
            <span class="chip" onclick="probarOrdenPaola('¿Cuáles clientes cumplen 15 días para ofrecerles los baleros secundarios desde $26 pesos?')">🔄 4. Consultar Clientes VIP Baleros $26 MXN</span>
          </div>
        </div>

        <!-- PANEL DERECHO: COLA DE ENVÍOS ORDENADOS POR PAOLA + CÓMO FUNCIONA EN WHATSAPP -->
        <div class="card">
          <h3>📲 Disparos de WhatsApp Ordenados por la Ing. Paola</h3>
          <p style="font-size:0.82rem; color:var(--muted); margin:6px 0 12px;">
            Cada vez que la Ing. Paola le escribe a su Agente CDO: <em>"Mándale mensaje a este número que vi en la calle"</em>, el sistema lo guarda en SQLite y dispara (o genera el link directo) con el mensaje oficial del Paquete de $1,713 MXN:
          </p>
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Teléfono Destino</th>
                <th>Estatus</th>
                <th>Acción Inmediata</th>
              </tr>
            </thead>
            <tbody id="tbodyColaPaola">
              <tr><td colspan="4" style="color:var(--muted); text-align:center;">Haz clic en el chip #2 de la izquierda para probar cómo Paola ordena mandarle mensaje a un negocio que ella encontró.</td></tr>
            </tbody>
          </table>

          <div style="margin-top:16px; padding:14px; background:#111827; border:1px solid var(--border); border-radius:10px; font-size:0.81rem; line-height:1.5;">
            <strong style="color:var(--primary);">💡 ¿Cómo lo usa la Ing. Paola desde su propio celular en WhatsApp?</strong><br>
            • Cuando un <strong>cliente (tortillería o mecánico)</strong> escribe al WhatsApp del negocio, el nodo Router de <code>n8n</code> lo envía al <strong>Módulo 2 (Ventas Mallas Tlaxcalli)</strong> para cerrarle el paquete de $1,713 o mayoreo de 10+ piezas.<br>
            • Cuando escribe la <strong>Ing. Paola</strong> (o inicia su mensaje con <code>#pau</code> / <code>#cdo</code>), el Router de <code>n8n</code> la reconoce como dueña y la conecta con su <strong>Agente CDO</strong> para darle reportes, cazar prospectos o enviar mensajes a los números que ella indique.
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== MÓDULO 1: CAZADOR ==================== -->
    <div id="t-m1" class="pane">
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3>📍 Módulo 1: Cazador de Tortillerías Reales en Lotes de 10 en 10 + Verificación en Google Maps</h3>
            <p style="font-size:0.83rem; color:var(--muted); margin-top:4px;">
              Abre el botón <strong>"📍 Ver en Google Maps"</strong> para revisar la fachada del local. Si ves que sigue abierto, márcalo con <strong>"✅ Abierta"</strong>; si ya cerró, márcalo con <strong>"❌ Cerrada"</strong> para no gastar mensajes del chip.
            </p>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select id="filtroMuni" onchange="cambiarMunicipio()" style="width:185px;">
              <option value="TODOS">Todos los Municipios</option>
              <option value="Ecatepec">Ecatepec de Morelos</option>
              <option value="Tultitlán">Tultitlán</option>
              <option value="Coacalco">Coacalco</option>
              <option value="Naucalpan">Naucalpan</option>
              <option value="Tlalnepantla">Tlalnepantla</option>
              <option value="Cuautitlán Izcalli">Cuautitlán Izcalli</option>
              <option value="Atizapán">Atizapán</option>
              <option value="Cuautitlán">Cuautitlán</option>
              <option value="Tepotzotlán">Tepotzotlán</option>
            </select>
            <button class="btn btn-dark" onclick="cambiarLote(-1)">⬅️ 10 Ant.</button>
            <span class="badge b-warn" id="lblLoteActual" style="font-size:0.8rem; padding:7px 11px;">Lote #1 (1-10)</span>
            <button class="btn btn-dark" onclick="cambiarLote(1)">Sig. 10 ➡️</button>
            <button class="btn btn-amber" onclick="extraerNuevoLote10('INEGI')">⚡ +10 INEGI</button>
            <button class="btn btn-pink" onclick="extraerNuevoLote10('APIFY')">🗺️ +10 Apify Maps</button>
          </div>
        </div>

        <div style="margin-top:12px; padding:10px 14px; background:#111827; border:1px solid var(--border); border-radius:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:0.81rem;">
            🛡️ <strong>Regla Anti-Bloqueo del Chip:</strong> Trabajando de <strong>10 en 10</strong>. Solo envía WhatsApp a las tortillerías que verifiques abiertas en Google Maps.
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.78rem; color:var(--muted);">Redirigir prueba a tu celular (10 dígitos):</span>
            <input type="text" id="telPruebaInput" placeholder="Ej. 5512345678..." style="width:165px; padding:6px 10px;" oninput="renderTablaLote10()">
          </div>
        </div>

        <div id="statusM1" style="margin-top:8px; font-size:0.83rem; color:var(--accent);"></div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Tortillería Real</th>
              <th>1. Revisar en Google Maps</th>
              <th>2. ¿Sigue Abierta?</th>
              <th>Teléfono y Dirección</th>
              <th>Segmento</th>
              <th>3. Enviar Primer Mensaje</th>
            </tr>
          </thead>
          <tbody id="tbodyReales"></tbody>
        </table>
      </div>
    </div>

    <!-- ==================== MÓDULO 2: CERRADORA IA ==================== -->
    <div id="t-m2" class="pane">
      <div class="grid-2">
        <div>
          <div class="chat-wrap">
            <div class="chat-head">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:38px; height:38px; border-radius:50%; background:var(--pink); display:flex; align-items:center; justify-content:center; font-weight:800; color:#fff;">VT</div>
                <div>
                  <strong>Ventas Mallas Tlaxcalli (Asesora en Línea)</strong>
                  <div style="font-size:0.72rem; color:var(--accent);">● Voz Mexicana Natural • Cero Invención de Marcas • Fotos Pau</div>
                </div>
              </div>
              <div style="display:flex; gap:8px; align-items:center;">
                <label style="font-size:0.74rem; display:flex; align-items:center; gap:5px; cursor:pointer; background:#111827; padding:6px 10px; border-radius:8px; border:1px solid var(--border);">
                  <input type="checkbox" id="chkAutoVoz" checked style="width:auto;"> 🎙️ Responder con Voz de Mujer
                </label>
                <button class="btn btn-dark" onclick="resetChat()">🔄 Reiniciar</button>
              </div>
            </div>

            <div class="chat-msgs" id="chatMsgs">
              <div class="msg bot">
                ¡Hola, qué tal Jefe! Buen día 😊 Le saluda el área de <strong>Ventas de Mallas Tlaxcalli</strong>. Andamos entregando en CDMX y zona norte del Edomex (Ecatepec, Tultitlán, Coacalco, Naucalpan, Tlalnepantla e Izcalli) nuestro <strong>Paquete Completo de Mantenimiento en $1,713 pesos con envío GRATIS</strong>.<br><br>¿Sabe qué modelo de máquina tortilladora maneja usted o gusta que le mande fotos reales del paquete?
                <div style="margin-top:8px;">
                  <button class="btn btn-pink" style="padding:5px 10px; font-size:0.73rem;" onclick="escucharNotaVoz(this, '¡Hola, qué tal Jefe! Buen día. Le saluda el área de Ventas de Mallas Tlaxcalli. Andamos entregando nuestro paquete completo de mantenimiento en mil setecientos trece pesos con envío gratis hasta su tortillería. ¿Sabe qué máquina maneja usted o gusta que le mande fotos de las mallas y el balero?')">🔊 Escuchar Nota de Voz Femenina</button>
                </div>
              </div>
            </div>

            <div style="padding:10px; background:#1e293b; display:flex; gap:8px;">
              <input type="text" id="chatInput" placeholder="Escribe como cliente (ej. 'No sé qué máquina tengo', 'Mándame fotos', etc.)..." onkeypress="if(event.key==='Enter') enviarMensajeIA()">
              <button class="btn" onclick="enviarMensajeIA()" id="btnSendIA">Enviar</button>
              <button class="btn btn-amber" onclick="probarFrase('¿Me puedes mandar fotos de las mallas y del balero que manejan?')">📸 Pedir Fotos</button>
            </div>
          </div>

          <div class="chips">
            <span class="chip" onclick="probarFrase('La verdad no sé qué máquina tengo, apenas compré la tortillería')">1️⃣ Decir: "No sé qué máquina tengo"</span>
            <span class="chip" onclick="probarFrase('Oye, ¿te acuerdas qué máquina te dije hace rato que tenía?')">2️⃣ Trampa: "¿Qué máquina te dije que tenía?"</span>
            <span class="chip" onclick="probarFrase('¿Me mandas fotos reales de lo que incluye el paquete?')">📸 Pedir fotos de carpeta imágenes negocio pau</span>
            <span class="chip" onclick="probarFrase('Oye cambiando de tema, ¿quién crees que gane el partido de fútbol hoy?')">🛡️ Probar Candado Anti-Desvío</span>
            <span class="chip" onclick="probarFrase('Soy mecánico en Ecatepec, ¿en cuánto me salen 10 mallas?')">🔧 Probar Mayoreo Mecánicos (10+ pzas)</span>
          </div>
        </div>

        <div class="card">
          <h3>📝 Pasar Venta Cerrada al Módulo 3 (Suma $200 MXN a Tu Comisión)</h3>
          <p style="font-size:0.82rem; color:var(--muted); margin:6px 0 12px;">
            Cuando el cliente confirma los <strong>4 datos obligatorios de cierre</strong> en WhatsApp, se registra aquí (automáticamente o con un clic) para mandar al repartidor y sumar tus <strong>$200 MXN de comisión</strong>:
          </p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <input type="text" id="ordCliente" placeholder="1. Nombre del Cliente y Tortillería (ej. Tortillería El Sol - Don Juan)">
            <input type="text" id="ordTel" placeholder="Teléfono WhatsApp (ej. 525512345678)">
            <input type="text" id="ordDir" placeholder="2. Dirección completa o link GPS (Calle, No, Colonia)">
            <select id="ordMuni">
              <option value="Ecatepec">Municipio: Ecatepec de Morelos</option>
              <option value="Tlalnepantla">Municipio: Tlalnepantla</option>
              <option value="Naucalpan">Municipio: Naucalpan</option>
              <option value="Tultitlán">Municipio: Tultitlán</option>
              <option value="Coacalco">Municipio: Coacalco</option>
              <option value="Cuautitlán Izcalli">Municipio: Cuautitlán Izcalli</option>
              <option value="Atizapán">Municipio: Atizapán</option>
              <option value="CDMX">Municipio: CDMX</option>
            </select>
            <input type="text" id="ordHorario" placeholder="3. Horario de recepción (ej. Lunes a Viernes 9am a 3pm)">
            <select id="ordPago">
              <option value="TRANSFERENCIA_CONTRA_ENTREGA">4. Pago confirmado: Transferencia SPEI al recibir (Cero Efectivo)</option>
              <option value="TERMINAL_MERCADO_PAGO">4. Pago confirmado: Tarjeta en Terminal Física Mercado Pago</option>
            </select>
            <button class="btn btn-amber" style="justify-content:center; padding:11px;" onclick="registrarNuevoPedido()">
              ✅ Registrar Pedido Cerrado (+$200 MXN Comisión)
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== MÓDULO 3: LOGÍSTICA Y COMISIONES ==================== -->
    <div id="t-m3" class="pane">
      <div class="grid-4">
        <div class="stat">
          <div class="stat-lbl">Pago Setup / Instalación</div>
          <div class="stat-val" style="color:var(--primary);">$2,500 MXN</div>
        </div>
        <div class="stat">
          <div class="stat-lbl">Paquetes Cerrados (Módulo 2)</div>
          <div class="stat-val" id="statTotalPedidos">2</div>
        </div>
        <div class="stat">
          <div class="stat-lbl">Ventas Generadas a Tlaxcalli</div>
          <div class="stat-val" style="color:var(--blue);" id="statVentasCliente">$3,426 MXN</div>
        </div>
        <div class="stat">
          <div class="stat-lbl">Tus Comisiones ($200 c/u) + Setup</div>
          <div class="stat-val" style="color:var(--accent);" id="statMisComisiones">$2,900 MXN</div>
        </div>
      </div>

      <div class="card">
        <h3>🚚 Módulo 3: Hoja de Ruta para Repartidores + Validación de Pagos Contra Entrega</h3>
        <p style="font-size:0.83rem; color:var(--muted); margin-top:4px;">
          Aquí llevas el control estricto de cada pedido para que <strong>ninguna venta se pierda</strong>. Incluye botón para mandarle la ubicación GPS al chofer y botón para marcar cuando el cliente ya pagó con transferencia o terminal.
        </p>
        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Cliente / Tortillería</th>
              <th>Dirección y Link GPS Chofer</th>
              <th>Horario Recepción</th>
              <th>Método de Pago (Sin Efectivo)</th>
              <th>Venta / Tu Comisión</th>
              <th>Estatus y Acciones</th>
            </tr>
          </thead>
          <tbody id="tbodyPedidos"></tbody>
        </table>
      </div>
    </div>

    <!-- ==================== MÓDULO 4: SEGUIMIENTO Y RECOMPRA VIP ==================== -->
    <div id="t-m4" class="pane">
      <div class="card">
        <h3>🔄 Módulo 4: El Perseguidor (Recuperación 24h/72h + Desbloqueo de Baleros desde $26 MXN a los 15 Días)</h3>
        <p style="font-size:0.83rem; color:var(--muted); margin-top:4px;">
          El 70% de las tortillerías compran en el seguimiento. Este módulo detecta automáticamente a quiénes dejaron en visto a las 24h/72h y a quiénes ya cumplieron <strong>15 días de haber comprado su paquete de $1,713</strong> para ofrecerles la <strong>Lista Especial de Baleros desde $26 MXN</strong>.
        </p>
        <table>
          <thead>
            <tr>
              <th>Tortillería / Prospecto</th>
              <th>Municipio</th>
              <th>Etapa del Embudo</th>
              <th>Contexto / Última Interacción</th>
              <th>Mensaje / Nota de Voz Lista para Enviar</th>
              <th>Disparar Seguimiento</th>
            </tr>
          </thead>
          <tbody id="tbodySeguimiento"></tbody>
        </table>
      </div>
    </div>

    <!-- ==================== MÓDULO 5: DIRECTOR DE MARKETING REALISTA ==================== -->
    <div id="t-m5" class="pane">
      <div class="grid-2">
        <!-- ESTUDIO FOTOGRÁFICO REALISTA (CERO IA FALSA) -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <h3>📸 1. Estudio Fotográfico Realista ("imágenes negocio pau")</h3>
              <p style="font-size:0.81rem; color:var(--muted); margin-top:3px;">
                Mejora iluminación de taller, nitidez del acero Calibre 14 y contraste real <strong>sin deformar el producto ni parecer imagen falsa de IA</strong>.
              </p>
            </div>
            <div>
              <input type="file" id="fileFotoPau" accept="image/*" style="display:none" onchange="subirFotoPau(this)">
              <button class="btn btn-amber" onclick="document.getElementById('fileFotoPau').click()">📤 Subir Foto Real de Paola</button>
            </div>
          </div>

          <div class="studio-img-wrap" style="margin-top:14px;">
            <img id="imgEstudioPreview" src="" alt="Vista previa de producto Mallas Tlaxcalli">
            <div class="watermark-badge" id="badgeSelloAgua">⚙️ MALLAS TLAXCALLI • ENVÍO GRATIS ($1,713 MXN)</div>
          </div>

          <div style="margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <label style="font-size:0.76rem; color:var(--muted);">Seleccionar foto de <code>imágenes negocio pau</code>:</label>
              <select id="selFotoEstudio" onchange="cambiarFotoEstudio()"></select>
            </div>
            <div>
              <label style="font-size:0.76rem; color:var(--muted);">Modo de Revelado Realista (Sin IA Falsa):</label>
              <select id="selFiltroRealista" onchange="aplicarReveladoRealista()">
                <option value="natural">1. Acero Real Nítido (Luz de Taller Mejorada)</option>
                <option value="contraste">2. Alto Contraste Industrial (Resalta Tejido Cal 14)</option>
                <option value="calido">3. Luz Cálida de Tortillería (Tono Natural)</option>
                <option value="original">4. Foto Original Sin Retoque</option>
              </select>
            </div>
          </div>
        </div>

        <!-- GENERADOR MULTICANAL FB / IG / TIKTOK / WA -->
        <div class="card">
          <h3>🚀 2. Generador de Contenido Multi-Red (FB, IG, TikTok y Estados WA)</h3>
          <p style="font-size:0.81rem; color:var(--muted); margin-top:3px;">
            Crea en segundos los textos y guiones con los precios reales ($1,713 menudeo / $225-$650 mayoreo mecánicos) listos para publicar en cuanto conectemos las cuentas de Mallas Tlaxcalli:
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
            <div>
              <label style="font-size:0.76rem; color:var(--muted);">Ángulo de Venta:</label>
              <select id="mktEnfoque">
                <option value="Ahorro de casi $1,000 MXN vs Refaccionaria ($1,713 Paquete Completo con envío gratis)">🔥 Ahorro $1,713 vs $2,737 en Refaccionaria</option>
                <option value="Prevención: Los fierros no avisan antes de tronar a medio turno (Balero 7210B + 2 Mallas)">⚙️ Prevención: "Los fierros no avisan a medio turno"</option>
                <option value="Especial Mecánicos Mayoreo 10+ piezas combinables ($225 testalera fierro, $230 galv, $650 transportadora)">🔧 Especial Mecánicos: Mayoreo 10+ Piezas</option>
                <option value="Cero Riesgo: Envío Gratis y Pago Contra Entrega con Transferencia o Terminal">🛡️ Confianza Total: Paga hasta recibir en tus manos</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.76rem; color:var(--muted);">Zona Objetivo:</label>
              <select id="mktZona">
                <option value="Ecatepec, Tultitlán, Coacalco y CDMX">📍 Zona Norte: Ecatepec, Tultitlán, Coacalco y CDMX</option>
                <option value="Naucalpan, Tlalnepantla, Atizapán y Cuautitlán Izcalli">📍 Corredor Industrial: Naucalpan, Tlalnepantla e Izcalli</option>
              </select>
            </div>
          </div>
          <button class="btn btn-pink" style="width:100%; justify-content:center; padding:11px; margin-top:12px;" onclick="generarCampanaM5()" id="btnGenM5">
            ✨ Generar Campaña Completa (Facebook + Instagram + TikTok + WhatsApp Status)
          </button>
          <textarea id="txtResultadoM5" rows="12" style="margin-top:12px; font-size:0.82rem; line-height:1.45;" placeholder="Aquí aparecerán tus publicaciones listas para Facebook, Instagram, TikTok y Estados de WhatsApp..."></textarea>
        </div>
      </div>
    </div>
  </div>

  <script>
    let PROSPECTOS_GLOBALES = [];
    let PEDIDOS_GLOBALES = [];
    let SEGUIMIENTOS_GLOBALES = [];
    let FOTOS_PAU_GLOBALES = [];
    let PAGINA_LOTE = 0;
    const TAMANO_LOTE = 10;
    const SESSION_ID = 'sess_' + Math.random().toString(36).substring(2, 10);

    function verTab(id, btn) {
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      btn.classList.add('active');
    }

    async function cargarDatos() {
      const r = await fetch('/api/datos_seguros');
      const d = await r.json();
      PROSPECTOS_GLOBALES = d.prospectos || [];
      PEDIDOS_GLOBALES = d.pedidos || [];
      SEGUIMIENTOS_GLOBALES = d.seguimientos || [];
      FOTOS_PAU_GLOBALES = d.fotos_negocio_pau || [];
      if (d.n8n_live_url) {
        const b1 = document.getElementById('btnAbrirN8N');
        const b2 = document.getElementById('btnAbrirN8NHeader');
        if (b1) b1.href = d.n8n_live_url;
        if (b2) b2.href = d.n8n_live_url;
      }
      if (d.cola_paola && d.cola_paola.length > 0) {
        renderColaPaola(d.cola_paola);
      }
      renderTablaLote10();
      renderPedidosComisiones();
      renderSeguimiento();
      inicializarEstudioM5();
    }

    // ==================== AGENTE CDO DE ING. PAOLA ====================
    function probarOrdenPaola(txt) {
      document.getElementById('inputPaola').value = txt;
      enviarComandoPaola();
    }

    function renderColaPaola(cola) {
      const tb = document.getElementById('tbodyColaPaola');
      if (!cola || cola.length === 0) return;
      tb.innerHTML = '';
      cola.forEach(item => {
        const waHref = item.link_wa || `https://wa.me/${item.telefono}?text=${encodeURIComponent(item.mensaje || '')}`;
        tb.innerHTML += `<tr>
          <td><strong>${item.fecha || ''}</strong></td>
          <td><strong>${item.telefono}</strong></td>
          <td><span class="badge b-ok">${item.estatus || 'EN_COLA'}</span></td>
          <td><a href="${waHref}" target="_blank" class="btn">📲 Disparar WA Ahora</a></td>
        </tr>`;
      });
    }

    async function enviarComandoPaola() {
      const inp = document.getElementById('inputPaola');
      const txt = inp.value.trim();
      if (!txt) return;
      const box = document.getElementById('chatMsgsPaola');
      const btn = document.getElementById('btnSendPaola');
      const conVoz = document.getElementById('chkVozPaola').checked;

      box.innerHTML += `<div class="msg user">${txt}</div>`;
      inp.value = '';
      btn.textContent = conVoz ? '🎙️ Procesando...' : '⏳...';
      box.scrollTop = box.scrollHeight;

      const r = await fetch('/api/agente_ceo_pau', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({mensaje: txt, incluir_voz: conVoz})
      });
      const d = await r.json();
      btn.textContent = 'Enviar a CDO';

      let extras = '';
      if (d.accion_ejecutada) {
        extras += `<div style="margin-top:8px; padding:7px 10px; background:#064e3b; border:1px solid #10b981; border-radius:8px; font-size:0.78rem; color:#ecfdf5;">⚡ <strong>Acción ejecutada en base de datos:</strong> ${d.accion_ejecutada}</div>`;
      }
      if (d.link_wa_directo) {
        extras += `<div style="margin-top:8px;"><a href="${d.link_wa_directo}" target="_blank" class="btn">📲 Abrir WhatsApp con Mensaje Listo para ese Negocio</a></div>`;
      }
      if (d.audio_data_url) {
        extras += `<div class="voice-box"><span style="font-size:0.74rem; color:#fbbf24; font-weight:700;">🎙️ Audio CDO:</span><audio controls autoplay src="${d.audio_data_url}"></audio></div>`;
      }

      box.innerHTML += `<div class="msg bot">${d.respuesta_ceo || 'Listo Ing. Paola.'}${extras}</div>`;
      box.scrollTop = box.scrollHeight;

      if (d.cola_pendiente && d.cola_pendiente.length > 0) {
        renderColaPaola(d.cola_pendiente);
      }
      cargarDatos();
    }

    // ==================== MÓDULO 1 ====================
    function obtenerListaFiltrada() {
      const filtro = document.getElementById('filtroMuni').value.toLowerCase();
      return PROSPECTOS_GLOBALES.filter(p => filtro === 'todos' || p.municipio.toLowerCase().includes(filtro));
    }

    function cambiarMunicipio() { PAGINA_LOTE = 0; renderTablaLote10(); }

    function cambiarLote(delta) {
      const lista = obtenerListaFiltrada();
      const maxPag = Math.max(0, Math.ceil(lista.length / TAMANO_LOTE) - 1);
      PAGINA_LOTE = Math.min(maxPag, Math.max(0, PAGINA_LOTE + delta));
      renderTablaLote10();
    }

    async function marcarEstatusMaps(tel, estatus) {
      await fetch('/api/marcar_maps', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({telefono: tel, estatus_maps: estatus})
      });
      const item = PROSPECTOS_GLOBALES.find(x => x.telefono === tel);
      if (item) item.estatus_maps = estatus;
      renderTablaLote10();
    }

    function renderTablaLote10() {
      const lista = obtenerListaFiltrada();
      const ini = PAGINA_LOTE * TAMANO_LOTE;
      const fin = Math.min(ini + TAMANO_LOTE, lista.length);
      const lote10 = lista.slice(ini, fin);

      document.getElementById('lblLoteActual').textContent =
        `Lote #${PAGINA_LOTE + 1} (${lista.length ? ini + 1 : 0}-${fin} de ${lista.length})`;

      let numPrueba = document.getElementById('telPruebaInput').value.replace(/\D/g, '');
      if (numPrueba.length === 10) numPrueba = '52' + numPrueba;

      const tb = document.getElementById('tbodyReales');
      tb.innerHTML = '';

      lote10.forEach((p, idx) => {
        const numGlobal = ini + idx + 1;
        const est = p.estatus_maps || 'PENDIENTE_VERIFICAR';
        const cerrada = est === 'CERRADA_DESCARTADA';
        const verificada = est === 'ABIERTA_VERIFICADA';
        const destino = numPrueba.length >= 12 ? numPrueba : p.telefono;
        const msg = `¡Hola, qué tal Jefe de *${p.nombre}*! Buen día 😊 Le escribimos del área de *Ventas de Mallas Tlaxcalli*. Andamos entregando aquí en *${p.municipio}* nuestro *Paquete Completo de Mantenimiento* (1 Malla Testalera 23cm x 1.40m + 1 Malla Transportadora 10" x 9m Calibre 14 + 1 Balero 7210B alemán) por *$1,713 pesos con envío GRATIS* (en refaccionaria gasta más de $2,700). No pedimos anticipo, paga al recibir con transferencia o tarjeta. ¿Gusta que le mande fotos reales del paquete, Jefe?`;
        const waLink = `https://wa.me/${destino}?text=${encodeURIComponent(msg)}`;

        tb.innerHTML += `<tr style="${cerrada ? 'opacity:0.42;' : ''}">
          <td><strong>#${numGlobal}</strong></td>
          <td><strong>${p.nombre}</strong><br><small style="color:#94a3b8">${p.fuente}</small></td>
          <td>
            <a href="${p.google_maps_url}" target="_blank" class="btn btn-amber">📍 Ver en Google Maps</a>
          </td>
          <td>
            <div style="display:flex; gap:5px; align-items:center;">
              <button class="btn ${verificada ? '' : 'btn-dark'}" style="padding:5px 8px;" onclick="marcarEstatusMaps('${p.telefono}','ABIERTA_VERIFICADA')">✅ Abierta</button>
              <button class="btn ${cerrada ? 'b-red' : 'btn-dark'}" style="padding:5px 8px;" onclick="marcarEstatusMaps('${p.telefono}','CERRADA_DESCARTADA')">❌ Cerrada</button>
            </div>
          </td>
          <td><strong>${p.telefono}</strong><br><small>${p.direccion} (<strong>${p.municipio}</strong>)</small></td>
          <td><span class="badge b-ok">${p.segmento_cliente}</span></td>
          <td>
            ${cerrada
              ? '<span class="badge b-red">Descartada (Cerrada)</span>'
              : `<a href="${waLink}" target="_blank" class="btn">📲 Mandar WA</a>`}
          </td>
        </tr>`;
      });
    }

    async function extraerNuevoLote10(fuente) {
      const muni = document.getElementById('filtroMuni').value === 'TODOS' ? 'Ecatepec' : document.getElementById('filtroMuni').value;
      const st = document.getElementById('statusM1');
      st.textContent = `⏳ Extrayendo nuevo lote de 10 tortillerías reales en ${muni} vía ${fuente}...`;
      const r = await fetch('/api/cazar_lote_10', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({municipio: muni, fuente: fuente})
      });
      const d = await r.json();
      PROSPECTOS_GLOBALES = d.prospectos || [];
      st.textContent = `✅ ¡Lote de ${d.lote_extraido} tortillerías agregado con link a Google Maps! Total: ${d.total_acumulado}.`;
      renderTablaLote10();
    }

    // ==================== MÓDULO 2 & 3 ====================
    async function registrarNuevoPedido() {
      const cliente = document.getElementById('ordCliente').value.trim() || 'Tortillería Nueva Cerrada por IA';
      const telefono = document.getElementById('ordTel').value.trim() || '525511223344';
      const direccion = document.getElementById('ordDir').value.trim() || 'Av. Principal #100, Zona Autorizada';
      const municipio = document.getElementById('ordMuni').value;
      const horario = document.getElementById('ordHorario').value.trim() || 'Lunes a Viernes 10:00 AM a 3:00 PM';
      const metodo_pago = document.getElementById('ordPago').value;

      const r = await fetch('/api/registrar_pedido', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({cliente, telefono, direccion, municipio, horario, metodo_pago})
      });
      const d = await r.json();
      if (d.ok) {
        PEDIDOS_GLOBALES = d.pedidos || [];
        renderPedidosComisiones();
        alert('✅ ¡Pedido cerrado registrado! Se sumaron $200 MXN a tu billetera de comisiones en el Módulo 3.');
      }
    }

    async function confirmarEntregaComision(id) {
      const r = await fetch('/api/confirmar_entrega_comision', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id})
      });
      const d = await r.json();
      if (d.ok) {
        PEDIDOS_GLOBALES = d.pedidos || [];
        renderPedidosComisiones();
      }
    }

    function renderPedidosComisiones() {
      const tb = document.getElementById('tbodyPedidos');
      tb.innerHTML = '';
      let sumaVentas = 0;
      let sumaComisiones = 0;

      PEDIDOS_GLOBALES.forEach(p => {
        sumaVentas += Number(p.monto_venta || 0);
        sumaComisiones += Number(p.comision_agencia || 0);
        const pagado = p.estatus_entrega === 'ENTREGADO_Y_PAGADO';
        const msgChofer = `🚚 *HOJA DE RUTA MALLAS TLAXCALLI*\n*Folio:* ${p.folio}\n*Cliente:* ${p.cliente_tortilleria}\n*Tel:* ${p.telefono}\n*Dirección:* ${p.direccion_gps} (${p.municipio})\n*Horario:* ${p.horario_recepcion}\n*Cobrar:* $${p.monto_venta} MXN ÚNICAMENTE con *${p.metodo_pago}* (PROHIBIDO recibir efectivo).\n📍 *Mapa GPS:* ${p.google_maps_url}`;
        const linkChofer = `https://wa.me/?text=${encodeURIComponent(msgChofer)}`;

        tb.innerHTML += `<tr>
          <td><strong>${p.folio}</strong><br><small style="color:#94a3b8">${p.fecha_cierre}</small></td>
          <td><strong>${p.cliente_tortilleria}</strong><br><small>${p.telefono}</small></td>
          <td>
            ${p.direccion_gps} (<strong>${p.municipio}</strong>)<br>
            <a href="${p.google_maps_url}" target="_blank" style="color:var(--primary); font-size:0.76rem; font-weight:700;">📍 Abrir Mapa para Repartidor</a>
          </td>
          <td>${p.horario_recepcion}</td>
          <td><span class="badge b-warn">${p.metodo_pago}</span></td>
          <td>
            <strong>$${p.monto_venta} MXN</strong><br>
            <span class="badge b-ok">Tu Comisión: +$${p.comision_agencia} MXN</span>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <span class="badge ${pagado ? 'b-ok' : 'b-warn'}">${p.estatus_entrega}</span>
              <a href="${linkChofer}" target="_blank" class="btn btn-blue" style="padding:5px 9px;">🚚 Mandar Ruta a Chofer</a>
              ${!pagado ? `<button class="btn" style="padding:5px 9px;" onclick="confirmarEntregaComision(${p.id})">💰 Confirmar Pago Recibido</button>` : ''}
            </div>
          </td>
        </tr>`;
      });

      document.getElementById('statTotalPedidos').textContent = PEDIDOS_GLOBALES.length;
      document.getElementById('statVentasCliente').textContent = `$${sumaVentas.toLocaleString()} MXN`;
      document.getElementById('statMisComisiones').textContent = `$${(2500 + sumaComisiones).toLocaleString()} MXN`;
    }

    // ==================== MÓDULO 4: SEGUIMIENTO ====================
    function renderSeguimiento() {
      const tb = document.getElementById('tbodySeguimiento');
      tb.innerHTML = '';
      SEGUIMIENTOS_GLOBALES.forEach(s => {
        const esVip = s.etapa_seguimiento.includes('VIP_15_DIAS');
        const waUrl = `https://wa.me/${s.telefono}?text=${encodeURIComponent(s.mensaje_ia_sugerido)}`;
        const safeTxt = s.mensaje_ia_sugerido.replace(/'/g, "\\'");
        tb.innerHTML += `<tr>
          <td><strong>${s.nombre_tortilleria}</strong><br><small>${s.telefono}</small></td>
          <td><strong>${s.municipio}</strong></td>
          <td><span class="badge ${esVip ? 'b-pink' : 'b-warn'}">${s.etapa_seguimiento}</span></td>
          <td style="font-size:0.79rem; color:#cbd5e1;">${s.ultimo_mensaje_cliente}</td>
          <td style="font-size:0.8rem; color:#e2e8f0;">
            ${s.mensaje_ia_sugerido}
            <div style="margin-top:6px;">
              <button class="btn btn-pink" style="padding:4px 9px; font-size:0.72rem;" onclick="escucharNotaVoz(this, '${safeTxt}')">🎙️ Generar Nota de Voz de Seguimiento</button>
            </div>
          </td>
          <td><a href="${waUrl}" target="_blank" class="btn">📲 Enviar Seguimiento WA</a></td>
        </tr>`;
      });
    }

    // ==================== MÓDULO 5: MARKETING REALISTA ====================
    function inicializarEstudioM5() {
      const sel = document.getElementById('selFotoEstudio');
      sel.innerHTML = '';
      FOTOS_PAU_GLOBALES.forEach((f, i) => {
        sel.innerHTML += `<option value="${i}">${f.nombre} (${f.tipo})</option>`;
      });
      cambiarFotoEstudio();
    }

    function cambiarFotoEstudio() {
      const idx = Number(document.getElementById('selFotoEstudio').value || 0);
      const foto = FOTOS_PAU_GLOBALES[idx];
      if (foto) {
        document.getElementById('imgEstudioPreview').src = foto.url;
        aplicarReveladoRealista();
      }
    }

    function aplicarReveladoRealista() {
      const modo = document.getElementById('selFiltroRealista').value;
      const img = document.getElementById('imgEstudioPreview');
      if (modo === 'natural') {
        img.style.filter = 'brightness(1.06) contrast(1.12) saturate(1.05)';
      } else if (modo === 'contraste') {
        img.style.filter = 'contrast(1.25) brightness(1.04) saturate(0.95)';
      } else if (modo === 'calido') {
        img.style.filter = 'brightness(1.05) contrast(1.08) sepia(0.12) saturate(1.15)';
      } else {
        img.style.filter = 'none';
      }
    }

    async function generarCampanaM5() {
      const btn = document.getElementById('btnGenM5');
      const box = document.getElementById('txtResultadoM5');
      const enfoque = document.getElementById('mktEnfoque').value;
      const zona = document.getElementById('mktZona').value;
      btn.textContent = '⏳ Generando textos y guiones con IA para FB, IG, TikTok y WA...';
      btn.disabled = true;
      const r = await fetch('/api/generar_marketing', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enfoque, zona})
      });
      const d = await r.json();
      btn.textContent = '✨ Generar Campaña Completa (Facebook + Instagram + TikTok + WhatsApp Status)';
      btn.disabled = false;
      box.value = d.contenido || '';
    }

    function subirFotoPau(input) {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(e) {
        const r = await fetch('/api/subir_foto_pau', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({nombre: file.name, base64: e.target.result})
        });
        const d = await r.json();
        if (d.ok) {
          FOTOS_PAU_GLOBALES = d.fotos || [];
          inicializarEstudioM5();
          alert('✅ ¡Foto real guardada en imágenes negocio pau! Lista para enviarse por WhatsApp y usarse en Marketing.');
        }
      };
      reader.readAsDataURL(file);
    }

    // ==================== CHAT IA & VOZ ====================
    function probarFrase(txt) {
      document.getElementById('chatInput').value = txt;
      enviarMensajeIA();
    }

    async function escucharNotaVoz(btn, texto) {
      const orig = btn.innerHTML;
      btn.innerHTML = '⏳ Grabando voz de mujer...';
      btn.disabled = true;
      const r = await fetch('/api/tts_voz_mujer', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({texto: texto})
      });
      const d = await r.json();
      if (d.ok && d.audio_data_url) {
        const wrap = document.createElement('div');
        wrap.className = 'voice-box';
        wrap.innerHTML = `<span style="font-size:0.74rem; color:#f472b6; font-weight:700;">🎙️ Voz Ventas:</span><audio controls autoplay src="${d.audio_data_url}"></audio>`;
        btn.replaceWith(wrap);
      } else {
        btn.innerHTML = orig;
        btn.disabled = false;
      }
    }

    async function enviarMensajeIA() {
      const inp = document.getElementById('chatInput');
      const txt = inp.value.trim();
      if (!txt) return;
      const box = document.getElementById('chatMsgs');
      const btn = document.getElementById('btnSendIA');
      const conVoz = document.getElementById('chkAutoVoz').checked;

      box.innerHTML += `<div class="msg user">${txt}</div>`;
      inp.value = '';
      btn.textContent = conVoz ? '🎙️ Grabando...' : '...';
      box.scrollTop = box.scrollHeight;

      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({session_id: SESSION_ID, mensaje: txt, incluir_voz: conVoz})
      });
      const d = await r.json();
      btn.textContent = 'Enviar';

      let htmlExtras = '';
      if (d.fotos_adjuntas && d.fotos_adjuntas.length > 0) {
        htmlExtras += `<div class="photo-grid">` +
          d.fotos_adjuntas.map(f => `<img src="${f.url}" title="${f.nombre}" onclick="window.open('${f.url}','_blank')">`).join('') +
          `</div>`;
      }

      if (d.audio_data_url) {
        htmlExtras += `<div class="voice-box"><span style="font-size:0.74rem; color:#f472b6; font-weight:700;">🎙️ Voz Ventas:</span><audio controls autoplay src="${d.audio_data_url}"></audio></div>`;
      } else {
        const safeTxt = (d.respuesta || '').replace(/'/g, "\\'").replace(/\n/g, ' ');
        htmlExtras += `<div style="margin-top:8px;"><button class="btn btn-pink" style="padding:5px 10px; font-size:0.73rem;" onclick="escucharNotaVoz(this, '${safeTxt}')">🔊 Escuchar Nota de Voz Femenina</button></div>`;
      }

      box.innerHTML += `<div class="msg bot">${d.respuesta}${htmlExtras}</div>`;
      box.scrollTop = box.scrollHeight;
    }

    async function resetChat() {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({session_id: SESSION_ID, reset: true})
      });
      const d = await r.json();
      document.getElementById('chatMsgs').innerHTML = `<div class="msg bot">${d.respuesta}</div>`;
    }

    cargarDatos();
  </script>
</body>
</html>"""


CAZADOR_INTERVALO_MIN = max(5, int(os.environ.get("CAZADOR_INTERVALO_MIN", "45")))
_CAZADOR_24_7_LOCK = threading.Lock()
_CAZADOR_24_7_INICIADO = False
ESTADO_CAZADOR_24_7 = {
    "activo": False,
    "intervalo_min": CAZADOR_INTERVALO_MIN,
    "ciclos_completados": 0,
    "ultimo_ciclo": None,
    "ultima_fuente": None,
    "ultimo_municipio": None,
    "ultimos_nuevos": 0,
    "ultimo_error": None
}


def _notificar_dueno_wa(mensaje: str, cliente_id: str = "mallas_tlaxcalli") -> bool:
    try:
        payload = json.dumps({"mensaje": mensaje, "cliente_id": cliente_id}).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8095/notificar_dueno",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return bool(data.get("ok"))
    except Exception:
        return False


def _ejecutar_ciclo_cazador_24_7(ciclo_idx: int) -> None:
    nichos_todos = obtener_lista_nichos_con_metricas()
    nichos_activos = [
        n for n in nichos_todos
        if n.get("activo") and normalizar_modelo_negocio(n.get("modelo_negocio", "DISTRIBUIDOR_B2B")) in ("DISTRIBUIDOR_B2B", "SERVICIOS_B2B")
    ] or [obtener_nicho_bd("mallas_tlaxcalli")]
    nicho_actual = nichos_activos[ciclo_idx % len(nichos_activos)]
    cid = motor_m1.normalizar_cliente_id(nicho_actual.get("cliente_id", "mallas_tlaxcalli"))
    nombre_negocio = nicho_actual.get("nombre_negocio") or "Mallas Tlaxcalli"
    es_tlaxcalli = (cid == "mallas_tlaxcalli")

    # FAST-PATH LEGACY: mallas_tlaxcalli ejecuta exactamente su ciclo original sin frentes_caza ni geocoding dinámico
    if not es_tlaxcalli:
        res_auto = auto_abastecer_cliente(cid, forzar=False)
        ahora_mx = datetime.now(timezone.utc) - timedelta(hours=6)
        ESTADO_CAZADOR_24_7["ciclos_completados"] += 1
        ESTADO_CAZADOR_24_7["ultimo_ciclo"] = ahora_mx.strftime("%Y-%m-%d %H:%M:%S CDMX")
        ESTADO_CAZADOR_24_7["ultimo_nicho"] = cid
        ESTADO_CAZADOR_24_7["ultima_fuente"] = res_auto.get("fuente") or "APIFY"
        ESTADO_CAZADOR_24_7["ultimo_municipio"] = res_auto.get("zona") or "Dinámica"
        ESTADO_CAZADOR_24_7["ultimos_nuevos"] = int(res_auto.get("lote_extraido") or 0)
        ESTADO_CAZADOR_24_7["ultimo_error"] = None
        return

    fuentes = ["INEGI", "APIFY", "FACEBOOK"]
    fuente = fuentes[ciclo_idx % len(fuentes)]

    perfil = construir_perfil_motor_desde_nicho(cid)
    municipios = perfil.get("cobertura_logistica", {}).get("municipios_edomex_autorizados", []) or ["Ecatepec"]
    muni = municipios[ciclo_idx % len(municipios)]
    env = motor_m1.cargar_env()

    kws_nicho = (perfil.get("busqueda", {}) or {}).get("palabras_clave_maps") or []
    kw_principal = "tortilleria" if es_tlaxcalli else (kws_nicho[0] if kws_nicho else (nicho_actual.get("giro_objetivo") or "negocio"))

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(id), 0) FROM prospectos_cazador")
    max_id_antes = cur.fetchone()[0]
    conn.close()

    if fuente == "FACEBOOK":
        try:
            import modulo_1b_cazador_facebook as motor_fb
        except ImportError:
            from scripts import modulo_1b_cazador_facebook as motor_fb
        q_fb = f"tortilleria maquinaria refacciones {muni}" if es_tlaxcalli else f"{kw_principal} {muni}"
        motor_fb.ejecutar_caza_facebook(
            q_fb,
            municipio_default=muni,
            max_posts=15,
            cliente_id=cid,
            perfil_nicho=nicho_actual
        )
    elif fuente == "APIFY":
        estado_q = "Ciudad de Mexico" if "CDMX" in muni.upper() else "Estado de Mexico"
        q_maps = f"Tortilleria en {muni}, {estado_q}, Mexico" if es_tlaxcalli else f"{kw_principal} en {muni}, {estado_q}, Mexico"
        nuevos = motor_m1.extraer_apify_google_maps(
            q_maps,
            10,
            env.get("APIFY_API_TOKEN", ""),
            perfil=perfil
        )
        clasificados = [motor_m1.clasificar_negocio(r, perfil) for r in nuevos]
        motor_m1.guardar_y_exportar(clasificados, cid)
    else:
        clave_ent = "09" if "CDMX" in muni.upper() else "15"
        termino = ("tortilleria cdmx" if clave_ent == "09" else f"tortilleria {muni.lower()}") if es_tlaxcalli else (f"{kw_principal} cdmx" if clave_ent == "09" else f"{kw_principal} {muni.lower()}")
        ini = OFFSET_EXTRACCION_INEGI["actual"]
        OFFSET_EXTRACCION_INEGI["actual"] += 10
        nuevos = motor_m1.extraer_inegi_por_municipio(
            termino,
            clave_ent,
            10,
            env.get("INEGI_DENUE_TOKEN", ""),
            reg_ini=ini,
            perfil=perfil
        )
        clasificados = [motor_m1.clasificar_negocio(r, perfil) for r in nuevos]
        motor_m1.guardar_y_exportar(clasificados, cid)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        UPDATE prospectos_cazador
        SET estatus_contacto_wa = 'PENDIENTE_ENVIO',
            id_cliente_agencia = COALESCE(NULLIF(id_cliente_agencia, ''), ?)
        WHERE id > ? AND (estatus_contacto_wa IS NULL OR estatus_contacto_wa IN ('', 'PENDIENTE'))
    """, (cid, max_id_antes))
    conn.commit()
    cur.execute("""
        SELECT id, nombre, telefono, municipio
        FROM prospectos_cazador
        WHERE id > ?
        ORDER BY id ASC
    """, (max_id_antes,))
    nuevos_bd = cur.fetchall()
    conn.close()

    ahora_mx = datetime.now(timezone.utc) - timedelta(hours=6)
    hora_mx = ahora_mx.hour
    en_ventana_envio = (6 <= hora_mx < 23)

    ESTADO_CAZADOR_24_7["ciclos_completados"] += 1
    ESTADO_CAZADOR_24_7["ultimo_ciclo"] = ahora_mx.strftime("%Y-%m-%d %H:%M:%S CDMX")
    ESTADO_CAZADOR_24_7["ultimo_nicho"] = cid
    ESTADO_CAZADOR_24_7["ultima_fuente"] = fuente
    ESTADO_CAZADOR_24_7["ultimo_municipio"] = muni
    ESTADO_CAZADOR_24_7["ultimos_nuevos"] = len(nuevos_bd)
    ESTADO_CAZADOR_24_7["ultimo_error"] = None

    if len(nuevos_bd) >= 1:
        resumen_lista = "\n".join(
            f"• *{n[1]}* ({n[3]}) — `{n[2]}`" for n in nuevos_bd[:5]
        )
        extra_txt = f"\n_...y {len(nuevos_bd) - 5} más._" if len(nuevos_bd) > 5 else ""
        estado_cola = (
            "🚀 *Despacho inmediato activo (06:00–22:59 CDMX):* pasan directo a la cola de primer contacto."
            if en_ventana_envio
            else "🌙 *Cola nocturna (23:00–05:59 CDMX):* quedan retenidos en `PENDIENTE_ENVIO` y salen automáticamente a partir de las *06:00 AM*."
        )
        msg_dueno = (
            f"🕵️ *Cazador 24/7 — {len(nuevos_bd)} Prospecto(s) Nuevo(s)*\n"
            f"🏢 Negocio: *{nombre_negocio}* (`{cid}`)\n"
            f"📡 Fuente: *{fuente}* | 📍 Zona: *{muni}*\n\n"
            f"{resumen_lista}{extra_txt}\n\n"
            f"{estado_cola}"
        )
        _notificar_dueno_wa(msg_dueno, cliente_id=cid)
        print(f"🕵️ [CAZADOR 24/7] Ciclo #{ESTADO_CAZADOR_24_7['ciclos_completados']} ({cid}/{fuente}/{muni}): +{len(nuevos_bd)} nuevos prospectos -> PENDIENTE_ENVIO")


def _bucle_cazador_24_7() -> None:
    time.sleep(60)
    ciclo_idx = 0
    while True:
        try:
            _ejecutar_ciclo_cazador_24_7(ciclo_idx)
        except Exception as err:
            ESTADO_CAZADOR_24_7["ultimo_error"] = str(err)
            print(f"⚠️ [CAZADOR 24/7] Error en ciclo #{ciclo_idx}: {err}")
        ciclo_idx += 1
        time.sleep(CAZADOR_INTERVALO_MIN * 60)


def iniciar_worker_cazador_24_7() -> None:
    global _CAZADOR_24_7_INICIADO
    with _CAZADOR_24_7_LOCK:
        if _CAZADOR_24_7_INICIADO:
            return
        _CAZADOR_24_7_INICIADO = True
        ESTADO_CAZADOR_24_7["activo"] = True
        hilo = threading.Thread(target=_bucle_cazador_24_7, name="Cazador24x7Worker", daemon=True)
        hilo.start()
        print(f"🕵️ Worker Cazador 24/7 iniciado (intervalo cada {CAZADOR_INTERVALO_MIN} min, cola nocturna diferida 23:00-05:59 CDMX).")


if __name__ == "__main__":
    puerto = 8090
    iniciar_worker_cazador_24_7()
    print(f"Servidor Público Blindado v3.0 (5 Módulos Completos) activo en puerto {puerto}")
    server = ThreadingHTTPServer(("127.0.0.1", puerto), PublicSafeHandler)
    server.serve_forever()
