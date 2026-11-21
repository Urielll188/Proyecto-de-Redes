#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
MÓDULO 1B: CAZADOR DE LEADS EN FACEBOOK (GRUPOS Y PUBLICACIONES PÚBLICAS)
Agencia Blitzr / Mallas Tlaxcalli
================================================================================
- Desacoplado al 100% de modulo_1_motor_cazador.py (CERO regresiones en INEGI/Maps).
- Modo Dual Inteligente:
  1. Si recibe URL directa (grupo o página), extrae con Actor de Facebook / SERP.
  2. Si recibe búsqueda/palabra clave o municipio, realiza Google SERP Dorking
     con Apify (`apify~google-search-scraper`) indexando publicaciones y páginas
     públicas de Facebook con teléfonos, sin bloqueos de login de Meta.
- Pre-filtro estricto con RegEx para extraer teléfonos mexicanos (+52 / 10 dígitos).
- Clasificación estructurada JSON con Gemini (usando el pool infinito de modelos y llaves).
- Inserción limpia en cazador_agencia.db con fuente='FACEBOOK' y enlace directo al post.
- Registra el último estado en ESTADO_ULTIMA_CORRIDA_FB para auditoría y Dashboard.
================================================================================
"""

import json
import os
import re
import sqlite3
import ssl
import urllib.parse
import urllib.request
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
ENV_PATH = os.path.join(BASE_DIR, ".env")
DB_PATH = os.path.join(DATA_DIR, "cazador_agencia.db")
SSL_CTX = ssl._create_unverified_context()

# Patrón robusto para detectar números de teléfono de México
PATRON_TEL_MEX = re.compile(
    r"(?:(?:\+?52\s*(?:1\s*)?)?(?:\(?\d{2,3}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4}|\b\d{10}\b)"
)

ESTADO_ULTIMA_CORRIDA_FB = {
    "timestamp": "",
    "target": "",
    "status": "INACTIVO",
    "posts_extraidos": 0,
    "con_telefono": 0,
    "aprobados_ia": 0,
    "guardados_bd": 0,
    "mensaje": "Sin ejecuciones recientes."
}


def cargar_env() -> dict:
    """Lee variables de entorno desde .env local si existe."""
    env = dict(os.environ)
    if os.path.exists(ENV_PATH):
        try:
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                for linea in f:
                    linea = linea.strip()
                    if linea and not linea.startswith("#") and "=" in linea:
                        k, v = linea.split("=", 1)
                        env[k.strip()] = v.strip().strip('"').strip("'")
        except Exception:
            pass
    return env


def limpiar_telefono_mexicano(tel_crudo: str) -> tuple:
    """Normaliza un teléfono mexicano al formato estándar 52 + 10 dígitos."""
    digitos = re.sub(r"\D", "", str(tel_crudo or ""))
    if digitos.startswith("521") and len(digitos) == 13:
        digitos = "52" + digitos[3:]
    elif len(digitos) == 10:
        digitos = "52" + digitos
    es_valido = len(digitos) == 12 and digitos.startswith("52")
    return (digitos if es_valido else "", es_valido)


def extraer_posibles_telefonos(texto: str) -> list:
    """Extrae y normaliza todos los teléfonos mexicanos encontrados en un texto."""
    if not texto:
        return []
    encontrados = []
    candidatos = PATRON_TEL_MEX.findall(texto)
    for c in candidatos:
        limpio, ok = limpiar_telefono_mexicano(c)
        if ok and limpio not in encontrados:
            encontrados.append(limpio)
    return encontrados


def extraer_facebook_apify(query_o_url: str, max_posts: int = 20, apify_token: str = "") -> list:
    """
    Extracción robusta de publicaciones públicas de Facebook mediante Apify.
    Usa Google SERP Indexing (apify~google-search-scraper) para capturar posts y grupos de Facebook
    con números visibles, evitando el muro de autenticación privado de Meta.
    """
    if not apify_token:
        print("   [!] Error en Cazador Facebook: Falta APIFY_API_TOKEN.")
        return []

    target = query_o_url.strip()
    es_url = target.startswith("http://") or target.startswith("https://")

    if es_url:
        search_query = f'site:{target} ("55" OR "cel" OR "whatsapp" OR "tel" OR "52")'
    else:
        search_query = f'site:facebook.com "{target}" ("55" OR "cel" OR "whatsapp" OR "tel")'

    payload = {
        "queries": search_query,
        "maxPagesPerQuery": 1,
        "resultsPerPage": min(max(max_posts, 10), 30),
    }

    url = f"https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token={apify_token}"

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not isinstance(data, list) or not data:
                return []

            posts = []
            organic = data[0].get("organicResults", [])
            for res in organic:
                item_url = str(res.get("url") or "").strip()
                title = str(res.get("title") or "Tortillería Facebook").strip()
                snippet = str(res.get("description") or "").strip()
                texto_completo = f"{title}. {snippet}"

                if "facebook.com" not in item_url:
                    continue

                posts.append({
                    "id_post": item_url.split("/")[-1][:30],
                    "autor": title.split("|")[0].split("-")[0].strip(),
                    "texto": texto_completo,
                    "url": item_url,
                    "fecha": datetime.now().isoformat(),
                })
            return posts
    except Exception as e:
        print(f"   [!] Error extrayendo Facebook vía Apify SERP: {e}")
        return []


def clasificar_post_gemini(texto_post: str, autor: str, municipio_fallback: str, llaves: list, modelos: list) -> dict:
    """Clasifica un post mediante Gemini con salida JSON estricta."""
    prompt = f"""Analiza este contenido público de Facebook y determina si es un NEGOCIO, TALLER, TORTILLERÍA o CLIENTE POTENCIAL para mallas antiadherentes y refacciones de tortilladoras.

REGLAS:
1. Si es meme, queja política o empleo para repartidor/chofer, marca "es_negocio_valido": false.
2. Si es una tortillería, molino de nixtamal, técnico o taller de maquinaria de maíz, marca "es_negocio_valido": true.
3. Extrae el nombre comercial (o el nombre más formal del local).
4. Si menciona municipio o colonia en el texto, extráelo; de lo contrario usa "{municipio_fallback}".

Texto:
\"\"\"{texto_post}\"\"\"
Autor/Título: {autor}

Responde ÚNICAMENTE con este JSON válido (sin markdown, sin bloques ```):
{{
  "es_negocio_valido": true,
  "nombre_comercial": "Nombre del Negocio",
  "municipio": "Municipio detectado",
  "segmento": "TORTILLERIA" o "MECANICO_MAQUINARIA"
}}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 180,
            "responseMimeType": "application/json",
        },
    }

    for modelo in modelos:
        for key in llaves:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent?key={key}"
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=12) as resp:
                    raw = json.loads(resp.read().decode("utf-8"))
                    cand_text = raw["candidates"][0]["content"]["parts"][0]["text"].strip()
                    res_json = json.loads(cand_text)
                    if isinstance(res_json, dict):
                        return res_json
            except Exception:
                continue

    # Fallback heurístico
    es_valido = any(k in texto_post.lower() for k in ["tortill", "nixtamal", "molino", "malla", "teflon", "maquin", "celorio"])
    return {
        "es_negocio_valido": es_valido,
        "nombre_comercial": autor or f"Tortillería Facebook ({municipio_fallback})",
        "municipio": municipio_fallback,
        "segmento": "TORTILLERIA",
    }


def ejecutar_caza_facebook(target: str, municipio_default: str = "Ecatepec", max_posts: int = 20) -> dict:
    """Función orquestadora de Facebook con métricas para auditoría."""
    global ESTADO_ULTIMA_CORRIDA_FB
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    ESTADO_ULTIMA_CORRIDA_FB = {
        "timestamp": ahora,
        "target": target,
        "status": "EJECUTANDO",
        "posts_extraidos": 0,
        "con_telefono": 0,
        "aprobados_ia": 0,
        "guardados_bd": 0,
        "mensaje": f"Iniciando extracción en Facebook para '{target}'..."
    }

    env = cargar_env()
    apify_token = env.get("APIFY_API_TOKEN", "")

    # Obtener llaves de Gemini
    llaves = []
    if env.get("GEMINI_API_KEYS"):
        for k in env["GEMINI_API_KEYS"].split(","):
            if k.strip():
                llaves.append(k.strip())
    if env.get("GEMINI_API_KEY") and env["GEMINI_API_KEY"] not in llaves:
        llaves.append(env["GEMINI_API_KEY"])

    modelos = [
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
    ]

    posts = extraer_facebook_apify(target, max_posts=max_posts, apify_token=apify_token)
    ESTADO_ULTIMA_CORRIDA_FB["posts_extraidos"] = len(posts)

    if not posts:
        ESTADO_ULTIMA_CORRIDA_FB["status"] = "SIN_RESULTADOS"
        ESTADO_ULTIMA_CORRIDA_FB["mensaje"] = "Apify no devolvió resultados para la búsqueda."
        return ESTADO_ULTIMA_CORRIDA_FB

    con_tel = 0
    aprobados = 0
    guardados = 0

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    for p in posts:
        telefonos = extraer_posibles_telefonos(p["texto"])
        if not telefonos:
            continue
        con_tel += 1

        clasif = clasificar_post_gemini(p["texto"], p["autor"], municipio_default, llaves, modelos)
        if not clasif.get("es_negocio_valido", False):
            continue
        aprobados += 1

        tel_principal = telefonos[0]
        nombre = str(clasif.get("nombre_comercial") or p["autor"]).strip()
        muni = str(clasif.get("municipio") or municipio_default).strip()
        direccion = f"Publicación en Facebook: {p['url'][:100]}"
        post_link = p["url"]

        try:
            cur.execute("""
                INSERT OR IGNORE INTO prospectos_cazador (
                    id_cliente_agencia, nombre, telefono, direccion, colonia,
                    municipio, segmento_cliente, oferta_recomendada, modalidad_entrega,
                    estatus_clasificacion, score_prioridad, fuente, estatus_contacto_wa,
                    fecha_registro, google_maps_url, latitud, longitud
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?
                )
            """, (
                "mallas_tlaxcalli",
                nombre,
                tel_principal,
                direccion,
                "Contacto Facebook",
                muni,
                clasif.get("segmento", "TORTILLERIA"),
                "PAQUETE_MALLAS_1713",
                "ENTREGA_A_DOMICILIO_GRATIS",
                "APROBADO_FACEBOOK",
                85,
                "FACEBOOK",
                "PENDIENTE_ENVIO",
                ahora,
                post_link,
                "",
                ""
            ))
            if cur.rowcount > 0:
                guardados += 1
        except Exception as e:
            print(f"   [!] Error insertando lead Facebook: {e}")

    conn.commit()
    conn.close()

    ESTADO_ULTIMA_CORRIDA_FB["con_telefono"] = con_tel
    ESTADO_ULTIMA_CORRIDA_FB["aprobados_ia"] = aprobados
    ESTADO_ULTIMA_CORRIDA_FB["guardados_bd"] = guardados
    ESTADO_ULTIMA_CORRIDA_FB["status"] = "COMPLETADO"
    ESTADO_ULTIMA_CORRIDA_FB["mensaje"] = (
        f"Apify extrajo {len(posts)} publicaciones -> {con_tel} con teléfono -> "
        f"{aprobados} aprobados por IA -> {guardados} leads nuevos guardados en BD."
    )

    print(f"✅ [CAZADOR FACEBOOK] {ESTADO_ULTIMA_CORRIDA_FB['mensaje']}")
    return ESTADO_ULTIMA_CORRIDA_FB


if __name__ == "__main__":
    import sys
    target_arg = sys.argv[1] if len(sys.argv) > 1 else "tortilleria ecatepec"
    muni_arg = sys.argv[2] if len(sys.argv) > 2 else "Ecatepec"
    res = ejecutar_caza_facebook(target_arg, muni_arg, max_posts=15)
    print(json.dumps(res, indent=2))
