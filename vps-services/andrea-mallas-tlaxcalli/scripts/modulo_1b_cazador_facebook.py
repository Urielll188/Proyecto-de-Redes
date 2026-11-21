#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
MÓDULO 1B: CAZADOR DE LEADS EN FACEBOOK (GRUPOS Y PUBLICACIONES PÚBLICAS)
Agencia Blitzr / Mallas Tlaxcalli
================================================================================
- Desacoplado al 100% de modulo_1_motor_cazador.py (CERO regresiones en INEGI/Maps).
- Extrae posts públicos mediante el Actor de Apify (cero cookies personales, cero riesgo IP).
- Pre-filtro estricto con RegEx para extraer teléfonos mexicanos (+52 / 10 dígitos).
- Clasificación estructurada JSON con Gemini (usando el pool infinito de modelos y llaves).
- Inserción limpia en cazador_agencia.db con fuente='FACEBOOK' y enlace directo al post.
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

# Patrón robusto para detectar números de teléfono de México (celulares y fijos)
PATRON_TEL_MEX = re.compile(
    r"(?:(?:\+?52\s*(?:1\s*)?)?(?:\(?\d{2,3}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4}|\b\d{10}\b)"
)


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


def extraer_apify_facebook(query_o_url: str, max_posts: int = 20, apify_token: str = "") -> list:
    """
    Invoca el scraper de Facebook en Apify para grupos o publicaciones públicas.
    Soporta:
    1. URL directa de grupo público (ej: https://www.facebook.com/groups/...)
    2. Palabra clave de búsqueda comercial (ej: tortilleria maquinaria Ecatepec)
    """
    if not apify_token:
        print("   [!] Error en Cazador Facebook: Falta APIFY_API_TOKEN.")
        return []

    # Usamos el actor estándar de Apify para publicaciones de Facebook
    url = f"https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items?token={apify_token}"

    query_o_url = query_o_url.strip()
    es_url = query_o_url.startswith("http://") or query_o_url.startswith("https://")

    payload = {
        "maxPosts": min(max(max_posts, 5), 30),
        "scrapeComments": False,
    }

    if es_url:
        payload["startUrls"] = [{"url": query_o_url}]
    else:
        # Búsqueda por palabra clave en publicaciones públicas
        query_encoded = urllib.parse.quote(query_o_url)
        payload["startUrls"] = [{"url": f"https://www.facebook.com/search/posts?q={query_encoded}"}]

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=90) as resp:
            items = json.loads(resp.read().decode("utf-8"))
            if not isinstance(items, list):
                return []

            posts_extraidos = []
            for it in items:
                texto = str(it.get("text") or it.get("postText") or it.get("message") or "").strip()
                post_url = str(it.get("url") or it.get("postUrl") or it.get("canonicalUrl") or "").strip()
                autor = str(it.get("author") or it.get("user") or {}).strip()
                if isinstance(it.get("author"), dict):
                    autor = str(it.get("author", {}).get("name") or "Usuario Facebook")
                elif not autor or autor.startswith("{"):
                    autor = "Contacto Facebook"

                if not texto:
                    continue

                posts_extraidos.append({
                    "id_post": str(it.get("id") or it.get("postId") or "")[:20],
                    "autor": autor,
                    "texto": texto,
                    "url": post_url or f"https://facebook.com/{query_encoded if not es_url else ''}",
                    "fecha": it.get("time") or datetime.now().isoformat(),
                })
            return posts_extraidos
    except Exception as e:
        print(f"   [!] Aviso extracción Apify Facebook: {e}")
        return []


def clasificar_post_gemini(texto_post: str, autor: str, municipio_fallback: str, llaves: list, modelos: list) -> dict:
    """
    Clasifica un post mediante Gemini con salida JSON estricta:
    - Descarta memes, quejas, ofertas de empleo de repartidor, etc.
    - Confirma si es un negocio/taller real del gremio o prospecto calificado.
    - Identifica nombre comercial, teléfono y municipio.
    """
    prompt = f"""Analiza esta publicación de Facebook y determina si es un NEGOCIO, TALLER, TORTILLERÍA o CLIENTE REAL potencial para refacciones y mallas antiadherentes de tortilladoras.

REGLAS ESTRICTAS:
1. Si es meme, queja política, oferta de empleo para repartidor/chofer, o no tiene relación comercial con tortillas, maíz o maquinaria, marca "es_negocio_valido": false.
2. Si es una tortillería, molino de nixtamal, técnico o taller de maquinaria de maíz, marca "es_negocio_valido": true.
3. Extrae el nombre comercial más apropiado (o el nombre del autor si no hay nombre de local).
4. Si menciona municipio o colonia en el texto, extráelo; de lo contrario usa "{municipio_fallback}".

Texto del post:
\"\"\"{texto_post}\"\"\"
Autor: {autor}

Responde ÚNICAMENTE con este JSON válido (sin markdown, sin bloques ```):
{{
  "es_negocio_valido": true,
  "nombre_comercial": "Nombre del Negocio",
  "municipio": "Municipio detectado",
  "segmento": "TORTILLERIA" o "MECANICO_MAQUINARIA",
  "resumen_oferta": "Breve nota de lo que vende u ofrece"
}}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 200,
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

    # Fallback heurístico si fallaran todos los modelos
    es_valido = any(k in texto_post.lower() for k in ["tortill", "nixtamal", "molino", "malla", "teflon", "maquin"])
    return {
        "es_negocio_valido": es_valido,
        "nombre_comercial": autor or f"Tortillería Facebook ({municipio_fallback})",
        "municipio": municipio_fallback,
        "segmento": "TORTILLERIA",
        "resumen_oferta": "Contacto extraído desde publicación de Facebook",
    }


def ejecutar_caza_facebook(target: str, municipio_default: str = "Ecatepec", max_posts: int = 20) -> dict:
    """
    Función orquestadora de Facebook:
    1. Extrae posts públicos con Apify.
    2. Aplica filtro RegEx para solo procesar los que tengan teléfono mexicano.
    3. Clasifica con Gemini usando la cascada de modelos/llaves.
    4. Guarda los leads aprobados en cazador_agencia.db con estatus 'PENDIENTE_ENVIO'.
    """
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

    posts = extraer_apify_facebook(target, max_posts=max_posts, apify_token=apify_token)
    if not posts:
        return {"ok": True, "extraidos": 0, "guardados": 0, "mensaje": "No se encontraron posts nuevos."}

    leads_guardados = 0
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    for p in posts:
        telefonos = extraer_posibles_telefonos(p["texto"])
        if not telefonos:
            continue  # Filtro RegEx: descarta posts sin teléfono, ahorra tokens

        clasif = clasificar_post_gemini(p["texto"], p["autor"], municipio_default, llaves, modelos)
        if not clasif.get("es_negocio_valido", False):
            continue

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
                85,  # Score alto para leads activos en redes
                "FACEBOOK",
                "PENDIENTE_ENVIO",
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                post_link,
                "",
                ""
            ))
            if cur.rowcount > 0:
                leads_guardados += 1
        except Exception as e:
            print(f"   [!] Error insertando lead Facebook: {e}")

    conn.commit()
    conn.close()

    print(f"✅ [CAZADOR FACEBOOK] Completado: {len(posts)} posts analizados, {leads_guardados} leads guardados en BD.")
    return {
        "ok": True,
        "posts_analizados": len(posts),
        "leads_guardados": leads_guardados,
    }


if __name__ == "__main__":
    import sys
    target_arg = sys.argv[1] if len(sys.argv) > 1 else "tortilleria maquinaria Ecatepec"
    muni_arg = sys.argv[2] if len(sys.argv) > 2 else "Ecatepec"
    res = ejecutar_caza_facebook(target_arg, muni_arg, max_posts=10)
    print(json.dumps(res, indent=2))
