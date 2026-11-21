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
import io
import json
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
            estatus TEXT
        )
    """)
    cur.execute("DELETE FROM seguimiento_clientes WHERE telefono IN ('525533445566', '525566778899', '525541239876')")

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


def obtener_nicho_bd(cliente_id: str = "mallas_tlaxcalli") -> dict:
    cid = motor_m1.normalizar_cliente_id(cliente_id)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT cliente_id, nombre_negocio, nombre_agente, giro_objetivo,
               codigo_scian_inegi, keywords_busqueda, oferta_gancho,
               catalogo_y_reglas, system_prompt, saludos_frio_json,
               municipios_json, protegido, activo, fecha_creacion
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
                   municipios_json, protegido, activo, fecha_creacion
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
            "activo": True
        }
    try:
        munis = json.loads(row[10] or "[]")
    except Exception:
        munis = []
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
        "fecha_creacion": row[13] or ""
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
               catalogo_y_reglas, protegido, activo, fecha_creacion
        FROM perfiles_nicho
        ORDER BY protegido DESC, fecha_creacion ASC
    """)
    filas = cur.fetchall()
    conn.close()

    nichos = []
    for r in filas:
        cid = r[0]
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


def construir_system_prompt_nicho(nicho: dict, historial: list) -> str:
    cid = motor_m1.normalizar_cliente_id(nicho.get("cliente_id", "mallas_tlaxcalli"))
    if cid == "mallas_tlaxcalli":
        return cargar_system_prompt() + analizar_memoria_verificada_cliente(historial)

    nombre_negocio = nicho.get("nombre_negocio") or cid
    nombre_agente = nicho.get("nombre_agente") or "Andrea"
    giro_obj = nicho.get("giro_objetivo") or "clientes comerciales"
    oferta = nicho.get("oferta_gancho") or "Oferta especial"
    # Truncado seguro a máximo 2,500 caracteres para latencia óptima
    catalogo_truncado = str(nicho.get("catalogo_y_reglas") or "")[:2500]
    prompt_custom = str(nicho.get("system_prompt") or "").strip()

    base = prompt_custom if prompt_custom else (
        f"# {nombre_agente.upper()} — ASESORA COMERCIAL DE {nombre_negocio.upper()} (WhatsApp)\n\n"
        f"## QUIÉN ERES\n"
        f"Eres **{nombre_agente}**, asesora comercial de **{nombre_negocio}**, especializada en atender a **{giro_obj}**.\n"
        f"Eres mujer mexicana, cálida, ágil y persuasiva. Tu objetivo es resolver dudas con naturalidad y **CERRAR LA VENTA / PEDIDO**.\n\n"
        f"## OFERTA GANCHO PRINCIPAL\n{oferta}\n\n"
        f"## CATÁLOGO, PRECIOS Y REGLAS DEL NEGOCIO\n{catalogo_truncado}\n\n"
        f"## REGLAS DE ORO EN WHATSAPP\n"
        f"1. **MÁXIMO 2 RENGLONES (25-35 palabras).** Mensajes cortos y humanos.\n"
        f"2. **SIEMPRE termina con UNA sola pregunta fácil de contestar** para avanzar el cierre.\n"
        f"3. Suelta un beneficio o precio a la vez (Escalera del Sí).\n"
        f"4. CAPACIDAD DE VOZ ACTIVA: Nunca digas que eres IA ni que no puedes mandar audios.\n"
        f"5. Si el cliente confirma pedido y ya dio sus 4 datos (nombre/negocio, dirección, horario y método de pago), añade al final:\n"
        f'`[PEDIDO_CERRADO:{{"cliente":"Nombre","direccion":"Direccion","municipio":"Municipio","horario":"Horario","metodo_pago":"METODO","precio":"0"}}]`'
    )
    return base


def llamar_pool_ia_real(session_id: str, mensaje_usuario: str, incluir_voz: bool = False, cliente_id: str = "") -> dict:
    ESTADISTICAS_POOL["llamadas_totales"] += 1
    cid = resolver_cliente_id_por_telefono_o_sesion(session_id, cliente_id)
    nicho = obtener_nicho_bd(cid)

    if session_id not in SESIONES_CHAT:
        SESIONES_CHAT[session_id] = []
    historial = SESIONES_CHAT[session_id]
    historial.append({"role": "user", "content": mensaje_usuario})

    sys_prompt_completo = construir_system_prompt_nicho(nicho, historial)
    llaves = obtener_llaves_ia_backend()

    contents = []
    for m in historial[-16:]:
        role = "user" if m["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})

    payload = {
        "system_instruction": {"parts": [{"text": sys_prompt_completo}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.6,
            "maxOutputTokens": 400
        }
    }

    for modelo in MODELOS_POOL_INFINITO:
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


def generar_campana_marketing_ia(enfoque: str, zona: str) -> dict:
    """
    Módulo 5: Genera los 4 posts reales listos para publicar en Facebook,
    Instagram, TikTok y Estados de WhatsApp respetando las reglas de Mallas Tlaxcalli.
    """
    prompt_mkt = f"""
Eres el Director de Marketing de Mallas Tlaxcalli.
Genera contenido comercial 100% realista, persuasivo y con jerga auténtica de dueños de tortillerías y mecánicos en México (sin sonar a robot ni IA falsa).
Enfoque de la campaña: {enfoque}
Zona destacada: {zona}

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
    llaves = obtener_llaves_ia_backend()
    payload = {
        "contents": [{"parts": [{"text": prompt_mkt}]}],
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 900}
    }
    for modelo in MODELOS_POOL_INFINITO:
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
                        conn_h2.cursor().execute("INSERT INTO conversacion_dueno (rol, mensaje, session_id) VALUES ('cdo', ?, ?)", (txt, session_id))
                        conn_h2.commit()
                        conn_h2.close()
                    except Exception:
                        pass
                    return {"ok": True, "contenido": txt, "modelo": modelo}
            except Exception:
                continue
    return {"ok": False, "contenido": "Error temporal generando campaña."}


COLA_MENSAJES_PAOLA = []


def _mensaje_saliente_prospecto(pid: int, nombre: str, municipio: str, cliente_id: str = "mallas_tlaxcalli") -> str:
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
    oferta = nicho.get("oferta_gancho") or "nuestra promoción especial"
    saludos_nicho = [
        f"{saludo_hora}, disculpe la molestia 👋 Le saluda {agente} de *{nom_emp}*. Andamos atendiendo negocios en *{mun}* y queríamos ponernos a las órdenes de {ref_negocio} con {oferta}. ¿Gusta que le comparta los detalles rápido y sin compromiso? ¡Excelente día!",
        f"Qué tal, muy {saludo_hora.lower()} 👋 Le escribe {agente} de *{nom_emp}*. Vimos a {ref_negocio} en *{mun}* y le dejamos nuestro contacto directo por si les interesa aprovechar {oferta}. Si gusta le paso la información por aquí cuando tenga un minuto.",
        f"{saludo_hora}, un gusto saludarle hasta *{mun}* 👋 Soy {agente} de *{nom_emp}*. Estamos apoyando a negocios de su giro como {ref_negocio} con {oferta}. ¿Le gustaría que le envíe precios y catálogo breve sin compromiso?",
        f"Hola, {saludo_hora.lower()} 👋 Le saluda {agente} del equipo de *{nom_emp}*. Esta semana tenemos atención prioritaria en *{mun}* para {ref_negocio} con {oferta}. ¿Le comparto la ficha rápida por este medio? ¡Mucho éxito hoy!",
        f"{saludo_hora}, disculpe que le escriba brevemente 👋 Soy {agente} de *{nom_emp}*. Nos especializamos en atender a negocios en *{mun}* y tenemos disponible {oferta} para {ref_negocio}. Quedo a su orden si desea conocer los beneficios.",
        f"Qué tal, {saludo_hora.lower()}, cordial saludo 👋 Le escribe {agente} de *{nom_emp}*. Le dejo nuestro WhatsApp directo para {ref_negocio} en *{mun}*; contamos con {oferta}. Si le interesa revisarlo sin presión, dígame y le mando los detalles."
    ]
    return saludos_nicho[pid % len(saludos_nicho)]


def obtener_candidato_envio_50() -> dict:
    if not ESTADO_MOTOR_50_DIARIOS.get("activo", False):
        return {"ok": False, "motivo": "MOTOR_PAUSADO", "enviados_hoy": 0}
    """
    Entrega el siguiente candidato pendiente SIN marcarlo todavía como enviado;
    el puente WhatsApp verifica primero con `onWhatsApp()` que el número exista en WhatsApp
    y luego confirma en `/api/confirmar_envio_50` para NO quemar el cupo diario en líneas fijas.
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    hoy_prefijo = datetime.now().strftime("%Y-%m-%d")
    cur.execute("SELECT COUNT(*) FROM bitacora_envios_wa WHERE fecha_hora LIKE ?", (f"{hoy_prefijo}%",))
    enviados_hoy = cur.fetchone()[0]

    if enviados_hoy >= ESTADO_MOTOR_50_DIARIOS["meta_diaria"]:
        conn.close()
        return {"ok": False, "motivo": "META_DIARIA_50_COMPLETADA", "enviados_hoy": enviados_hoy}

    cur.execute("SELECT LOWER(cliente_id) FROM perfiles_nicho WHERE activo = 0")
    inactivos = {r[0] for r in cur.fetchall()}

    cur.execute("""
        SELECT id, nombre, telefono, municipio, direccion, google_maps_url, COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')
        FROM prospectos_cazador
        WHERE (estatus_contacto_wa IS NULL OR estatus_contacto_wa IN ('PENDIENTE', 'PENDIENTE_ENVIO', 'VERIFICADO_WA', ''))
          AND (estatus_clasificacion LIKE 'APROBADO%')
          AND (estatus_maps IS NULL OR estatus_maps != 'CERRADA_DESCARTADA')
        ORDER BY CASE WHEN estatus_contacto_wa = 'VERIFICADO_WA' THEN 0 ELSE 1 END, id ASC
        LIMIT 25
    """)
    filas = cur.fetchall()
    conn.close()
    row = None
    for cand_r in filas:
        cid_cand = motor_m1.normalizar_cliente_id(cand_r[6])
        if cid_cand.lower() not in inactivos:
            row = cand_r
            break

    if not row:
        return {"ok": False, "motivo": "SIN_PROSPECTOS_PENDIENTES", "enviados_hoy": enviados_hoy}

    pid, nombre, telefono, municipio, direccion, maps_url, cid_raw = row
    cid = motor_m1.normalizar_cliente_id(cid_raw)
    mensaje_wa = _mensaje_saliente_prospecto(pid, nombre, municipio, cliente_id=cid)
    return {
        "ok": True,
        "id": pid,
        "id_cliente_agencia": cid,
        "nombre": nombre,
        "telefono": telefono,
        "municipio": municipio,
        "mensaje": mensaje_wa,
        "enviados_hoy": enviados_hoy,
        "meta_diaria": ESTADO_MOTOR_50_DIARIOS["meta_diaria"]
    }


def confirmar_envio_50(pid: int, enviado: bool, motivo: str = "", telefono_real: str = "", mensaje: str = "") -> dict:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT nombre, telefono, municipio, COALESCE(id_cliente_agencia, 'mallas_tlaxcalli') FROM prospectos_cazador WHERE id = ?", (pid,))
    row = cur.fetchone()
    ahora_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if not row:
        conn.close()
        return {"ok": False, "error": "ID no encontrado"}

    nombre, tel_bd, municipio, cid_raw = row
    cid = motor_m1.normalizar_cliente_id(cid_raw)
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
    cur.execute("SELECT COUNT(*) FROM bitacora_envios_wa WHERE fecha_hora LIKE ?", (f"{hoy_prefijo}%",))
    enviados_hoy = cur.fetchone()[0]
    conn.commit()
    conn.close()

    ultimo_txt = f"{nombre} ({municipio} - {tel_final})"
    ESTADO_MOTOR_50_DIARIOS["ultimo_negocio_contactado"] = ultimo_txt
    guardar_config("ultimo_negocio_contactado", ultimo_txt)
    exportar_excel_en_vivo()
    return {"ok": True, "estatus": "CONTACTADO_WA", "id_cliente_agencia": cid, "enviados_hoy": enviados_hoy, "nombre": nombre, "municipio": municipio}


def obtener_siguiente_envio_50_diarios() -> dict:
    cand = obtener_candidato_envio_50()
    if not cand.get("ok"):
        return cand
    conf = confirmar_envio_50(cand["id"], True, mensaje=cand["mensaje"])
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
Eres el **Agente CDO (Director de Operaciones e Inteligencia Comercial con IA)** exclusivo de **Mallas Tlaxcalli** (Ing. Paola Almanza / Ing. Rocha / TopDiegoz).
Te escriben directamente desde su WhatsApp personal conectado al sistema.

HISTORIAL RECIENTE DE LA CONVERSACIÓN CON EL DUEÑO (SIGUE ESTE HILO CONVERSACIONAL DE FORMA FLUIDA Y NATURAL):
{historial_hilo}


DATOS 100% REALES Y AUDITADOS EN ESTE SEGUNDO (PROHIBIDO INVENTAR NADA):
- Total de Tortillerías Aprobadas en Excel / BD: {len(prospectos)} tortillerías en cobertura (con link exacto Google Maps).
- Desglose por municipio: {json.dumps(conteo_muni, ensure_ascii=False)}
- Estado WhatsApp de la base: {total_verificados_wa} verificadas con WA | {total_sin_wa} descartadas sin WA | {total_contactados_historico} ya contactadas.
- Mensajes de WhatsApp enviados HOY: {mensajes_enviados_hoy} de {ESTADO_MOTOR_50_DIARIOS['meta_diaria']}
- Meta diaria configurada: 80 mensajes diarios de prospección.
- Estado del Motor Automático (80 mensajes/día): {"ACTIVO (enviando hasta 80 mensajes/día en horario comercial)" if ESTADO_MOTOR_50_DIARIOS["activo"] else "EN PAUSA (dime 'Activa los envíos' para arrancar los 80 envíos diarios)"}
- Fotos reales cargadas vía WhatsApp: {fotos_prod_reales} fotos de producto (para Ventas M2) | {fotos_pub_reales} imágenes de publicidad (para Marketing M5).
- Pedidos Cerrados Reales: {len(pedidos)} pedidos (${total_ventas_mxn:,.2f} MXN reales)
- Detalle de Pedidos: {resumen_pedidos}
- Muestra reciente del Excel:
{muestra_5}
- Acción recién ejecutada: {accion_ejecutada or 'Consulta Ejecutiva en Tiempo Real'}

REGLAS ESTRICTAS DE RESPUESTA:
1. MÁXIMO 1 A 2 PÁRRAFOS CORTOS (máximo 35 palabras en total). Ve directo al grano sin rodeos.
2. CERO sermones o repetición de explicaciones pasadas. PROHIBIDO volver a explicar el desglose de 236 negocios, DENUE o filtros a menos que te lo pregunten explícitamente.
3. Si piden reporte o estatus: Da ÚNICAMENTE los números clave (Total base, con WhatsApp activo, pedidos cerrados) y confirma que adjuntas el Excel.
4. Si piden editar imagen, foto, flyer o video: Confirma en una sola línea ejecutiva que el motor visual lo está procesando.
5. Cero inventos de ventas. Si hay 0 pedidos cerrados, di 0 con total honestidad.
6. Tono mexicano, cálido, seguro y profesional. Apto para nota de voz natural y breve.

Mensaje del dueño/a: "{mensaje_paola}"
"""
    llaves = obtener_llaves_ia_backend()
    payload = {
        "contents": [{"parts": [{"text": prompt_cdo}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 200}
    }
    for modelo in MODELOS_POOL_INFINITO:
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

    # Módulo 3: Pedidos y Comisiones
    cur.execute("""
        SELECT id, folio, cliente_tortilleria, telefono, direccion_gps, municipio,
               horario_recepcion, metodo_pago, tipo_pedido, monto_venta,
               comision_agencia, estatus_entrega, google_maps_url, fecha_cierre
        FROM pedidos_comisiones
        ORDER BY id DESC
    """)
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

    # Módulo 4: Seguimiento
    cur.execute("""
        SELECT id, nombre_tortilleria, telefono, municipio, etapa_seguimiento,
               ultimo_mensaje_cliente, dias_transcurridos, mensaje_ia_sugerido, estatus
        FROM seguimiento_clientes
        ORDER BY id ASC
    """)
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

        if parsed.path == "/api/estatus_whatsapp":
            est = {
                "conectado": False,
                "qr": "",
                "numero_vinculado": "",
                "motor_50_activo": ESTADO_MOTOR_50_DIARIOS["activo"],
                "fotos_producto_reales": len(listar_imagenes_producto_reales()),
                "fotos_publicidad": len(listar_publicidad_pau())
            }
            if os.path.exists("/tmp/estatus_wa.json"):
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

        if parsed.path == "/api/nichos":
            nichos = obtener_lista_nichos_con_metricas()
            self._send_json({
                "ok": True,
                "nicho_default": leer_config("nicho_activo_default", "mallas_tlaxcalli"),
                "nichos": nichos
            })
            return

        if parsed.path == "/api/datos_seguros":
            qs = urllib.parse.parse_qs(parsed.query)
            cid_query = (qs.get("cliente_id", [""])[0] or "").strip()
            cid_target = "TODOS" if cid_query.upper() == "TODOS" else motor_m1.normalizar_cliente_id(cid_query or "mallas_tlaxcalli")

            env = motor_m1.cargar_env()
            perfil = construir_perfil_motor_desde_nicho("mallas_tlaxcalli" if cid_target == "TODOS" else cid_target)

            bd_info = obtener_datos_completos_bd(cid_target)
            fotos_pau = listar_imagenes_pau()
            nichos_lista = obtener_lista_nichos_con_metricas()

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
                "cliente": perfil["nombre_empresa"],
                "cliente_id_activo": cid_target,
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
                "cola_paola": COLA_MENSAJES_PAOLA[-10:],
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
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        data = json.loads(raw)

        if self.path == "/api/nichos":
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
            cur.execute("UPDATE perfiles_nicho SET protegido = 1 WHERE cliente_id = 'mallas_tlaxcalli'")
            conn.commit()
            conn.close()
            self._send_json({"ok": True, "cliente_id": cid, "activo": bool(activo), "nichos": obtener_lista_nichos_con_metricas()})
            return

        if self.path == "/api/chat":
            session_id = data.get("session_id", "default_session")
            cid_chat = str(data.get("cliente_id") or "").strip()
            if data.get("reset"):
                SESIONES_CHAT[session_id] = []
                nicho_r = obtener_nicho_bd(resolver_cliente_id_por_telefono_o_sesion(session_id, cid_chat))
                self._send_json({
                    "respuesta": f"¡Hola, qué tal! Buen día 😊 Le atiende {nicho_r.get('nombre_agente', 'Andrea')} de {nicho_r.get('nombre_negocio', 'Mallas Tlaxcalli')}. ¿En qué le podemos apoyar hoy?"
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
            cliente = data.get("cliente", "Tortillería Cliente")
            tel = re.sub(r"\D", "", str(data.get("telefono", "525500000000")))
            if len(tel) == 10:
                tel = "52" + tel
            elif tel.startswith("521") and len(tel) == 13:
                tel = "52" + tel[3:]
            direccion = data.get("direccion", "Dirección en cobertura")
            muni = data.get("municipio", "Ecatepec")
            horario = data.get("horario", "9:00 AM a 4:00 PM")
            pago = data.get("metodo_pago", "TRANSFERENCIA_CONTRA_ENTREGA")
            tipo = data.get("tipo_pedido", "1 Paquete Completo Mallas Tlaxcalli ($1,713)")
            monto = float(data.get("monto", 1713.0))
            comision = float(data.get("comision", 200.0))

            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            hoy_pref = datetime.now().strftime("%Y-%m-%d")
            cur.execute(
                "SELECT id FROM pedidos_comisiones WHERE telefono = ? AND fecha_cierre LIKE ? ORDER BY id DESC LIMIT 1",
                (tel, f"{hoy_pref}%")
            )
            ya_existe = cur.fetchone()
            if not ya_existe:
                cur.execute("SELECT COUNT(*) FROM pedidos_comisiones")
                n = cur.fetchone()[0] + 1
                folio = f"TLX-ORD-{n:03d}"
                maps_url = motor_m1.construir_link_google_maps(cliente, direccion, muni)
                cur.execute("""
                    INSERT INTO pedidos_comisiones (
                        folio, cliente_tortilleria, telefono, direccion_gps, municipio,
                        horario_recepcion, metodo_pago, tipo_pedido, monto_venta,
                        comision_agencia, estatus_entrega, google_maps_url, fecha_cierre
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    folio, cliente, tel, direccion, muni, horario, pago, tipo,
                    monto, comision, "EN_RUTA_REPARTIDOR", maps_url, datetime.now().strftime("%Y-%m-%d %H:%M")
                ))
                conn.commit()
            conn.close()
            with open(PERFIL_PATH, "r", encoding="utf-8") as f:
                perfil = json.load(f)
            bd_info = obtener_datos_completos_bd(perfil["id_cliente"])
            self._send_json({"ok": True, "pedidos": bd_info["pedidos"], "duplicado": bool(ya_existe)})
            return

        if self.path == "/api/confirmar_entrega_comision":
            pedido_id = int(data.get("id", 0))
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("UPDATE pedidos_comisiones SET estatus_entrega = 'ENTREGADO_Y_PAGADO' WHERE id = ?", (pedido_id,))
            conn.commit()
            conn.close()
            with open(PERFIL_PATH, "r", encoding="utf-8") as f:
                perfil = json.load(f)
            bd_info = obtener_datos_completos_bd(perfil["id_cliente"])
            self._send_json({"ok": True, "pedidos": bd_info["pedidos"]})
            return

        if self.path == "/api/generar_marketing":
            enfoque = data.get("enfoque", "Ahorro de $1,000 MXN vs Refaccionaria ($1,713 Paquete Completo)")
            zona = data.get("zona", "Ecatepec, Tlalnepantla, Naucalpan y CDMX")
            res = generar_campana_marketing_ia(enfoque, zona)
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

        if self.path == "/api/control_motor":
            activo = bool(data.get("activo", False))
            ESTADO_MOTOR_50_DIARIOS["activo"] = activo
            guardar_config("motor_50_activo", "1" if activo else "0")
            guardar_config("auto_responder_activo", "1" if activo else "0")
            self._send_json({"ok": True, "activo": activo})
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
            try:
                req = urllib.request.Request(
                    "http://127.0.0.1:8095/codigo_8_digitos",
                    data=json.dumps({"telefono": tel}).encode("utf-8"),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    self._send_json(json.loads(resp.read().decode("utf-8")))
            except Exception as e:
                self._send_json({"ok": False, "error": str(e)})
            return

        if self.path == "/api/siguiente_envio_50_diarios":
            forzar = bool(data.get("forzar", False))
            if not ESTADO_MOTOR_50_DIARIOS["activo"] and not forzar:
                self._send_json({"ok": False, "motivo": "MOTOR_50_EN_PAUSA"})
                return
            res_50 = obtener_siguiente_envio_50_diarios()
            self._send_json(res_50)
            return

        if self.path == "/api/obtener_candidato_envio_50":
            forzar = bool(data.get("forzar", False))
            if not ESTADO_MOTOR_50_DIARIOS["activo"] and not forzar:
                self._send_json({"ok": False, "motivo": "MOTOR_50_EN_PAUSA"})
                return
            cand = obtener_candidato_envio_50()
            self._send_json(cand)
            return

        if self.path == "/api/confirmar_envio_50":
            pid = int(data.get("id", 0))
            enviado = bool(data.get("enviado", False))
            motivo = str(data.get("motivo", ""))
            tel_real = str(data.get("telefono_real", ""))
            mensaje = str(data.get("mensaje", ""))
            res_conf = confirmar_envio_50(pid, enviado, motivo=motivo, telefono_real=tel_real, mensaje=mensaje)
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

        if self.path == "/api/cazar_lote_10":
            muni = data.get("municipio", "Ecatepec")
            if muni == "TODOS":
                muni = "Ecatepec"
            fuente = data.get("fuente", "INEGI")
            cid = motor_m1.normalizar_cliente_id(data.get("cliente_id", "mallas_tlaxcalli"))
            nicho = obtener_nicho_bd(cid)
            perfil = construir_perfil_motor_desde_nicho(cid)
            es_tlaxcalli = (cid == "mallas_tlaxcalli")
            env = motor_m1.cargar_env()

            kws_nicho = (perfil.get("busqueda", {}) or {}).get("palabras_clave_maps") or []
            kw_principal = "tortilleria" if es_tlaxcalli else (kws_nicho[0] if kws_nicho else (nicho.get("giro_objetivo") or "negocio"))

            if fuente == "FACEBOOK":
                try:
                    import modulo_1b_cazador_facebook as motor_fb
                except ImportError:
                    from scripts import modulo_1b_cazador_facebook as motor_fb

                modo = str(data.get("modo", "KEYWORD") or "KEYWORD").upper()
                target_custom = str(data.get("target", "") or "").strip()
                if modo == "GROUP" and target_custom:
                    target_query = target_custom
                elif target_custom:
                    target_query = target_custom
                elif es_tlaxcalli:
                    target_query = f"tortilleria maquinaria refacciones {muni}"
                else:
                    target_query = f"{kw_principal} {muni}"

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

                t = threading.Thread(target=_tarea_caza_fb, daemon=True)
                t.start()

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

            if fuente == "APIFY":
                estado_q = "Ciudad de Mexico" if "CDMX" in muni.upper() else "Estado de Mexico"
                query_maps = f"Tortilleria en {muni}, {estado_q}, Mexico" if es_tlaxcalli else f"{kw_principal} en {muni}, {estado_q}, Mexico"
                nuevos = motor_m1.extraer_apify_google_maps(
                    query_maps,
                    10,
                    env.get("APIFY_API_TOKEN", ""),
                    perfil=perfil
                )
            else:
                clave_ent = "09" if "CDMX" in muni.upper() else "15"
                if es_tlaxcalli:
                    termino = "tortilleria cdmx" if clave_ent == "09" else f"tortilleria {muni.lower()}"
                else:
                    termino = f"{kw_principal} cdmx" if clave_ent == "09" else f"{kw_principal} {muni.lower()}"
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
            bd_info = obtener_datos_completos_bd(cid)
            self._send_json({
                "ok": True,
                "cliente_id": cid,
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


def _notificar_dueno_wa(mensaje: str) -> bool:
    try:
        payload = json.dumps({"mensaje": mensaje}).encode("utf-8")
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
    nichos_activos = [n for n in nichos_todos if n.get("activo")] or [obtener_nicho_bd("mallas_tlaxcalli")]
    nicho_actual = nichos_activos[ciclo_idx % len(nichos_activos)]
    cid = motor_m1.normalizar_cliente_id(nicho_actual.get("cliente_id", "mallas_tlaxcalli"))
    nombre_negocio = nicho_actual.get("nombre_negocio") or "Mallas Tlaxcalli"
    es_tlaxcalli = (cid == "mallas_tlaxcalli")

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
        _notificar_dueno_wa(msg_dueno)
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
