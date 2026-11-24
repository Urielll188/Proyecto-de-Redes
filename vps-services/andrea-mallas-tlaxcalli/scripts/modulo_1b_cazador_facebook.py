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

# Patrones robustos para detectar números móviles de México (10 dígitos nacional) y enlaces wa.me / api.whatsapp.com
PATRON_WA_LINK = re.compile(
    r"(?:wa\.me/|api\.whatsapp\.com/send\?[^\"'\s>]*?phone=)\+?(?:521?|52)?(\d{10})\b",
    re.IGNORECASE,
)
PATRON_TEL_MEX = re.compile(
    r"(?:(?:\+?52[\s.-]*(?:1[\s.-]*)?)?(?:\(?\d{2,3}\)?[\s.-]*)\d{3,4}[\s.-]*\d{4}|\b\d{10}\b)"
)

PREFIJOS_INVALIDOS_FECHA = ("199", "200", "201", "202", "203", "000", "111", "999")

ESTADO_ULTIMA_CORRIDA_FB = {
    "timestamp": "",
    "target": "",
    "modo_extraccion": "",
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
    """Normaliza cualquier teléfono móvil mexicano válido (cualquier lada nacional) a 52 + 10 dígitos."""
    digitos = re.sub(r"\D", "", str(tel_crudo or ""))
    if digitos.startswith("521") and len(digitos) == 13:
        digitos = "52" + digitos[3:]
    elif digitos.startswith("044") and len(digitos) == 13:
        digitos = "52" + digitos[3:]
    elif digitos.startswith("045") and len(digitos) == 13:
        digitos = "52" + digitos[3:]
    elif len(digitos) == 10:
        digitos = "52" + digitos
    if len(digitos) != 12 or not digitos.startswith("52"):
        return ("", False)
    nacional_10 = digitos[2:]
    if nacional_10.startswith(PREFIJOS_INVALIDOS_FECHA) or nacional_10[0] in ("0", "1"):
        return ("", False)
    if len(set(nacional_10)) <= 2:
        return ("", False)
    return (digitos, True)


def extraer_posibles_telefonos(texto: str) -> list:
    """Extrae y normaliza teléfonos mexicanos en texto plano y enlaces wa.me / api.whatsapp.com sin restricción de lada."""
    if not texto:
        return []
    texto_dec = urllib.parse.unquote(str(texto))
    encontrados = []
    # 1. Priorizar enlaces directos wa.me / api.whatsapp.com/send?phone=
    for m_wa in PATRON_WA_LINK.findall(texto_dec):
        limpio, ok = limpiar_telefono_mexicano(m_wa)
        if ok and limpio not in encontrados:
            encontrados.append(limpio)
    # 2. Extraer números de 10 dígitos de cualquier estado de la República
    for c in PATRON_TEL_MEX.findall(texto_dec):
        limpio, ok = limpiar_telefono_mexicano(c)
        if ok and limpio not in encontrados:
            encontrados.append(limpio)
    return encontrados


def _extraer_actor_directo_fb(
    query_o_url: str,
    zona: str = "",
    max_posts: int = 20,
    apify_token: str = "",
    actor_id: str = "apify~facebook-search-scraper",
) -> list:
    """
    Modo 1: Intenta extracción estructurada directa en Apify con timeout estricto de 25s.
    Si devuelve HTTP != 200/201 (ej. 402/404/4xx), tarda >25s o trae 0 posts útiles, retorna [] para activar SERP.
    """
    if not apify_token or not actor_id:
        return []
    target = query_o_url.strip()
    es_url = target.startswith("http://") or target.startswith("https://")
    q_full = target if (not zona or zona.lower() in target.lower()) else f"{target} {zona}".strip()

    if es_url:
        payload = {"startUrls": [{"url": target}], "resultsLimit": min(max(max_posts, 5), 25), "maxPosts": min(max(max_posts, 5), 25)}
    else:
        queries_b2b = [q_full]
        if len(q_full) < 60:
            queries_b2b.append(f"{q_full} nueva sucursal OR bodega OR apertura")
        payload = {
            "queries": queries_b2b,
            "searchQuery": q_full,
            "resultsLimit": min(max(max_posts, 5), 25),
            "maxPosts": min(max(max_posts, 5), 25),
        }

    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items?token={apify_token}&timeout=22"
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "BlitzrHunter/1.0"},
        )
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=25) as resp:
            if getattr(resp, "status", 200) not in (200, 201):
                return []
            data = json.loads(resp.read().decode("utf-8"))
            if not isinstance(data, list) or not data:
                return []
            posts = []
            for item in data:
                if not isinstance(item, dict):
                    continue
                item_url = str(item.get("url") or item.get("postUrl") or item.get("pageUrl") or item.get("facebookUrl") or "").strip()
                autor = str(item.get("pageName") or item.get("userName") or item.get("title") or item.get("name") or "Empresa Facebook").strip()
                texto = " ".join(
                    str(item.get(k) or "").strip()
                    for k in ("text", "postText", "description", "about", "phone", "website", "whatsapp")
                    if item.get(k)
                ).strip()
                if not texto:
                    continue
                posts.append({
                    "id_post": (item_url.split("/")[-1] if item_url else autor)[:30],
                    "autor": autor.split("|")[0].split("-")[0].strip() or "Empresa Facebook",
                    "texto": f"{autor}. {texto}",
                    "url": item_url or "https://www.facebook.com",
                    "fecha": datetime.now().isoformat(),
                    "modo": "ACTOR_DIRECTO",
                })
            return posts
    except Exception as e:
        print(f"   [i] Actor directo Facebook ({actor_id}) no disponible o >25s ({e}) -> activando respaldo SERP B2B...")
        return []


def extraer_facebook_apify(
    query_o_url: str,
    max_posts: int = 20,
    apify_token: str = "",
    zona: str = "",
    es_tlaxcalli: bool = False,
    offset: int = 0,
    actor_fb: str = "",
) -> list:
    """
    Extracción nacional B2B de publicaciones y páginas públicas de Facebook mediante Apify.
    - Para mallas_tlaxcalli: conserva intacta la búsqueda SERP original.
    - Para clientes B2B nacionales:
      1. Intenta primero Actor directo de Facebook (`apify~facebook-search-scraper` o `APIFY_FB_ACTOR`) con timeout de 25s.
      2. Si falla, tarda >25s o devuelve 0 resultados con teléfono, cae automáticamente a Google SERP Dorking B2B
         sin sesgo de lada "55", capturando enlaces wa.me y celulares de cualquier estado de México.
    """
    if not apify_token:
        print("   [!] Error en Cazador Facebook: Falta APIFY_API_TOKEN.")
        return []

    target = query_o_url.strip()
    es_url = target.startswith("http://") or target.startswith("https://")

    # Candado Fast-Path Legacy para Mallas Tlaxcalli
    if es_tlaxcalli:
        if es_url:
            search_query = f'site:{target} ("55" OR "cel" OR "whatsapp" OR "tel" OR "52")'
        else:
            search_query = f'site:facebook.com "{target}" ("55" OR "cel" OR "whatsapp" OR "tel")'
        queries_serp = [search_query]
    else:
        # 1. Intentar Actor Directo de Facebook primero (timeout 25s)
        actor_usar = (actor_fb or os.environ.get("APIFY_FB_ACTOR") or "apify~facebook-search-scraper").strip()
        posts_directos = _extraer_actor_directo_fb(
            target, zona=zona, max_posts=max_posts, apify_token=apify_token, actor_id=actor_usar
        )
        if posts_directos and any(extraer_posibles_telefonos(p.get("texto", "")) for p in posts_directos):
            return posts_directos

        # 2. Respaldo SERP B2B Nacional garantizado (sin restricción a lada "55")
        zona_clean = (zona or "").strip()
        if es_url:
            q_principal = f'site:{target} ("whatsapp" OR "wa.me" OR "cel" OR "tel" OR "cotizaciones")'
            queries_serp = [q_principal]
        else:
            if zona_clean and zona_clean.lower() not in target.lower():
                q_principal = f'site:facebook.com "{target}" "{zona_clean}" ("whatsapp" OR "wa.me" OR "cel" OR "tel" OR "cotizaciones")'
                q_expansion = f'site:facebook.com {target} "{zona_clean}" ("wa.me" OR "whatsapp" OR "nueva sucursal" OR "bodega" OR "apertura" OR "contacto")'
            else:
                q_principal = f'site:facebook.com "{target}" ("whatsapp" OR "wa.me" OR "cel" OR "tel" OR "cotizaciones")'
                q_expansion = f'site:facebook.com {target} ("wa.me" OR "whatsapp" OR "sucursal" OR "bodega" OR "cotizaciones")'
            queries_serp = [q_principal, q_expansion] if offset == 0 else [q_expansion, q_principal]

    payload = {
        "queries": "\n".join(queries_serp),
        "maxPagesPerQuery": 1,
        "resultsPerPage": min(max(max_posts, 10), 40),
        "countryCode": "mx",
        "languageCode": "es",
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
            urls_vistas = set()
            for page_data in data:
                if not isinstance(page_data, dict):
                    continue
                organic = page_data.get("organicResults", [])
                for res in organic:
                    item_url = str(res.get("url") or "").strip()
                    if not item_url or "facebook.com" not in item_url or item_url in urls_vistas:
                        continue
                    urls_vistas.add(item_url)
                    title = str(res.get("title") or ("Tortillería Facebook" if es_tlaxcalli else "Empresa Facebook")).strip()
                    snippet = str(res.get("description") or "").strip()
                    texto_completo = f"{title}. {snippet} {item_url}"

                    posts.append({
                        "id_post": item_url.split("/")[-1][:30],
                        "autor": title.split("|")[0].split("-")[0].strip(),
                        "texto": texto_completo,
                        "url": item_url,
                        "fecha": datetime.now().isoformat(),
                        "modo": "SERP_B2B",
                    })
            return posts
    except Exception as e:
        print(f"   [!] Error extrayendo Facebook vía Apify SERP: {e}")
        return []


def clasificar_post_gemini(texto_post: str, autor: str, municipio_fallback: str, llaves: list, modelos: list, perfil_nicho: dict = None) -> dict:
    """Clasifica un post mediante Gemini con salida JSON estricta."""
    cid = str((perfil_nicho or {}).get("cliente_id") or "mallas_tlaxcalli").strip().lower()
    es_tlaxcalli = (cid == "mallas_tlaxcalli")

    if es_tlaxcalli:
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
    else:
        giro_obj = (perfil_nicho or {}).get("giro_objetivo") or "Empresa / Negocio B2B"
        kws_obj = (perfil_nicho or {}).get("keywords_busqueda") or giro_obj
        nom_neg = (perfil_nicho or {}).get("nombre_negocio") or cid
        prompt = f"""Analiza este contenido público de Facebook y determina si corresponde a una EMPRESA, NEGOCIO REAL, SUCURSAL o PROSPECTO COMERCIAL B2B válido para "{nom_neg}" (giro/frente objetivo: {giro_obj}; palabras clave: {kws_obj}).

REGLAS ESTRICTAS DE FILTRADO B2B:
1. Si es meme, grupo de compra-venta informal/tianguis, oferta de empleo para chofer/ayudante, queja política o spam personal, marca "es_negocio_valido": false.
2. Si es una empresa, comercio establecido, fábrica, clínica, despacho, constructora, distribuidora, bodega o negocio real con teléfono o WhatsApp comercial, marca "es_negocio_valido": true.
3. Extrae el nombre comercial limpio de la empresa o negocio (sin emojis ni frases largas).
4. Si menciona municipio, ciudad o estado en el texto, extráelo; de lo contrario usa "{municipio_fallback}".

Texto:
\"\"\"{texto_post}\"\"\"
Autor/Título: {autor}

Responde ÚNICAMENTE con este JSON válido (sin markdown, sin bloques ```):
{{
  "es_negocio_valido": true,
  "nombre_comercial": "Nombre de la Empresa",
  "municipio": "Ciudad o Municipio detectado",
  "segmento": "{giro_obj[:30].upper()}"
}}"""

    for modelo in modelos:
        gen_cfg = {
            "temperature": 0.2,
            "maxOutputTokens": 240,
            "responseMimeType": "application/json",
        }
        if "2.5" in modelo:
            gen_cfg["thinkingConfig"] = {"thinkingBudget": 0}
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": gen_cfg,
        }
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
    if es_tlaxcalli:
        es_valido = any(k in texto_post.lower() for k in ["tortill", "nixtamal", "molino", "malla", "teflon", "maquin", "celorio"])
        seg_def = "TORTILLERIA"
    else:
        txt_low = texto_post.lower()
        es_spam_informal = any(bad in txt_low for bad in ["meme", "tanda", "solicito chofer", "busco trabajo", "compra venta libre"])
        es_valido = not es_spam_informal
        seg_def = str((perfil_nicho or {}).get("giro_objetivo") or "EMPRESA_FB_B2B")[:30].upper()
    return {
        "es_negocio_valido": es_valido,
        "nombre_comercial": autor or f"Empresa Facebook ({municipio_fallback})",
        "municipio": municipio_fallback,
        "segmento": seg_def,
    }


def ejecutar_caza_facebook(
    target: str,
    municipio_default: str = "Ecatepec",
    max_posts: int = 20,
    cliente_id: str = "mallas_tlaxcalli",
    perfil_nicho: dict = None,
    frente_nombre: str = None,
    angulo_contacto: str = None,
    zona: str = "",
    offset: int = 0,
) -> dict:
    """Función orquestadora de Facebook B2B nacional con extracción wa.me y soporte multi-frente."""
    global ESTADO_ULTIMA_CORRIDA_FB
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cid_norm = re.sub(r"[^a-z0-9_-]", "_", str(cliente_id or "mallas_tlaxcalli").strip().lower()).strip("_") or "mallas_tlaxcalli"
    es_tlaxcalli = (cid_norm == "mallas_tlaxcalli")
    zona_efectiva = (zona or municipio_default or "CDMX").strip()
    oferta_nicho = "PAQUETE_MALLAS_1713" if es_tlaxcalli else (str((perfil_nicho or {}).get("oferta_gancho") or frente_nombre or "Oferta Especial").strip())

    ESTADO_ULTIMA_CORRIDA_FB = {
        "timestamp": ahora,
        "target": target,
        "zona": zona_efectiva,
        "cliente_id": cid_norm,
        "frente_nombre": frente_nombre or "",
        "modo_extraccion": "LEGACY_TLAXCALLI" if es_tlaxcalli else "DUAL_B2B_NACIONAL",
        "status": "EJECUTANDO",
        "posts_extraidos": 0,
        "con_telefono": 0,
        "aprobados_ia": 0,
        "guardados_bd": 0,
        "nuevos_prospectos": [],
        "mensaje": f"Iniciando extracción en Facebook para '{target}' ({zona_efectiva} | {cid_norm})..."
    }

    env = cargar_env()
    apify_token = env.get("APIFY_API_TOKEN", "")
    actor_fb = env.get("APIFY_FB_ACTOR", "apify~facebook-search-scraper")

    # Obtener llaves de Gemini
    llaves = []
    if env.get("GEMINI_API_KEYS"):
        for k in env["GEMINI_API_KEYS"].split(","):
            if k.strip():
                llaves.append(k.strip())
    if env.get("GEMINI_API_KEY") and env["GEMINI_API_KEY"] not in llaves:
        llaves.append(env["GEMINI_API_KEY"])

    modelos = [
        "gemini-2.5-flash",
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
    ]

    posts = extraer_facebook_apify(
        target,
        max_posts=max_posts,
        apify_token=apify_token,
        zona=zona_efectiva,
        es_tlaxcalli=es_tlaxcalli,
        offset=offset,
        actor_fb=actor_fb,
    )
    ESTADO_ULTIMA_CORRIDA_FB["posts_extraidos"] = len(posts)
    if posts:
        ESTADO_ULTIMA_CORRIDA_FB["modo_extraccion"] = posts[0].get("modo", ESTADO_ULTIMA_CORRIDA_FB["modo_extraccion"])

    if not posts:
        ESTADO_ULTIMA_CORRIDA_FB["status"] = "SIN_RESULTADOS"
        ESTADO_ULTIMA_CORRIDA_FB["mensaje"] = "Apify no devolvió resultados para la búsqueda."
        return ESTADO_ULTIMA_CORRIDA_FB

    con_tel = 0
    aprobados = 0
    guardados = 0
    nuevos_prospectos = []

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    perfil_clasif = dict(perfil_nicho or {})
    perfil_clasif["cliente_id"] = cid_norm
    if frente_nombre and not es_tlaxcalli:
        perfil_clasif["giro_objetivo"] = frente_nombre

    for p in posts:
        telefonos = extraer_posibles_telefonos(p["texto"])
        if not telefonos:
            continue
        con_tel += 1

        clasif = clasificar_post_gemini(p["texto"], p["autor"], zona_efectiva, llaves, modelos, perfil_nicho=perfil_clasif)
        if not clasif.get("es_negocio_valido", False):
            continue
        aprobados += 1

        tel_principal = telefonos[0]
        nombre = str(clasif.get("nombre_comercial") or p["autor"]).strip()[:120]
        muni = str(clasif.get("municipio") or zona_efectiva).strip()[:80]
        direccion = f"Publicación en Facebook: {p['url'][:100]}"
        post_link = p["url"]
        seg_val = clasif.get("segmento", "TORTILLERIA" if es_tlaxcalli else (frente_nombre or "PROSPECTO_FB")[:30].upper())

        try:
            if es_tlaxcalli:
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
                    cid_norm,
                    nombre,
                    tel_principal,
                    direccion,
                    "Contacto Facebook",
                    muni,
                    seg_val,
                    oferta_nicho,
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
            else:
                cur.execute("""
                    INSERT OR IGNORE INTO prospectos_cazador (
                        id_cliente_agencia, nombre, telefono, direccion, colonia,
                        municipio, segmento_cliente, oferta_recomendada, modalidad_entrega,
                        estatus_clasificacion, score_prioridad, fuente, estatus_contacto_wa,
                        fecha_registro, google_maps_url, latitud, longitud,
                        frente_nombre, angulo_contacto
                    ) VALUES (
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?
                    )
                """, (
                    cid_norm,
                    nombre,
                    tel_principal,
                    direccion,
                    "Contacto Facebook B2B",
                    muni,
                    seg_val,
                    oferta_nicho,
                    "COBERTURA_NACIONAL_B2B",
                    "APROBADO_FACEBOOK",
                    88,
                    "FACEBOOK",
                    "PENDIENTE_ENVIO",
                    ahora,
                    post_link,
                    "",
                    "",
                    frente_nombre,
                    angulo_contacto,
                ))
            if cur.rowcount > 0:
                guardados += 1
                nuevos_prospectos.append({
                    "nombre": nombre,
                    "telefono": tel_principal,
                    "municipio": muni,
                    "fuente": "FACEBOOK",
                    "frente_nombre": frente_nombre,
                    "angulo_contacto": angulo_contacto,
                })
        except Exception as e:
            print(f"   [!] Error insertando lead Facebook: {e}")

    conn.commit()
    conn.close()

    ESTADO_ULTIMA_CORRIDA_FB["con_telefono"] = con_tel
    ESTADO_ULTIMA_CORRIDA_FB["aprobados_ia"] = aprobados
    ESTADO_ULTIMA_CORRIDA_FB["guardados_bd"] = guardados
    ESTADO_ULTIMA_CORRIDA_FB["nuevos_prospectos"] = nuevos_prospectos
    ESTADO_ULTIMA_CORRIDA_FB["status"] = "COMPLETADO"
    ESTADO_ULTIMA_CORRIDA_FB["mensaje"] = (
        f"Apify ({ESTADO_ULTIMA_CORRIDA_FB['modo_extraccion']}) extrajo {len(posts)} publicaciones -> "
        f"{con_tel} con teléfono/wa.me -> {aprobados} aprobados por IA -> {guardados} leads B2B guardados en BD."
    )

    print(f"✅ [CAZADOR FACEBOOK] {ESTADO_ULTIMA_CORRIDA_FB['mensaje']}")
    return ESTADO_ULTIMA_CORRIDA_FB


if __name__ == "__main__":
    import sys
    target_arg = sys.argv[1] if len(sys.argv) > 1 else "tortilleria ecatepec"
    muni_arg = sys.argv[2] if len(sys.argv) > 2 else "Ecatepec"
    res = ejecutar_caza_facebook(target_arg, muni_arg, max_posts=15)
    print(json.dumps(res, indent=2))
