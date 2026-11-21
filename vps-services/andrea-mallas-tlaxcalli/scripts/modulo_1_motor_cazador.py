#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
MÓDULO 1: EL CAZADOR REAL MULTI-CLIENTE (INEGI DENUE OFICIAL + APIFY MAPS)
Agencia de Automatizaciones TopDiegoz — Cliente #1: Mallas Tlaxcalli
================================================================================
- 100% conectado en vivo a la API del INEGI DENUE (consulta por coordenadas reales
  de cada municipio autorizado para precisión exacta) y Apify Google Maps.
- Construye Links DIRECTOS Y VERIFICABLES de Google Maps usando coordenadas reales
  (`?api=1&query=lat,lon` o `query_place_id=...` de Google Maps) para que al abrir
  el mapa SIEMPRE marque el local exacto y su fachada en Street View.
- Filtra únicamente tortillerías, molinos de nixtamal y talleres/mecánicos de
  máquinas tortilladoras dentro de cobertura (CDMX + 9 municipios Edomex).
- Preserva estatus de WhatsApp y verificación Maps en SQLite al actualizar datos.
================================================================================
"""

import csv
import json
import os
import re
import sqlite3
import ssl
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
ENV_PATH = os.path.join(BASE_DIR, ".env")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "cazador_agencia.db")
SSL_CTX = ssl._create_unverified_context()

# Puntos centrales reales por municipio autorizado (Edomex + CDMX) para consultas DENUE por radio exacto
CENTROS_MUNICIPIOS = {
    "ecatepec": ("19.6018", "-99.0506", "Ecatepec de Morelos", "15"),
    "ecatepec de morelos": ("19.6018", "-99.0506", "Ecatepec de Morelos", "15"),
    "tultitlan": ("19.6456", "-99.1689", "Tultitlán", "15"),
    "coacalco": ("19.6319", "-99.1045", "Coacalco de Berriozábal", "15"),
    "naucalpan": ("19.4779", "-99.2389", "Naucalpan de Juárez", "15"),
    "tlalnepantla": ("19.5396", "-99.1948", "Tlalnepantla de Baz", "15"),
    "cuautitlan izcalli": ("19.6540", "-99.2089", "Cuautitlán Izcalli", "15"),
    "cuautitlan": ("19.6712", "-99.1806", "Cuautitlán", "15"),
    "atizapan": ("19.5567", "-99.2577", "Atizapán de Zaragoza", "15"),
    "atizapan de zaragoza": ("19.5567", "-99.2577", "Atizapán de Zaragoza", "15"),
    "tepotzotlan": ("19.7136", "-99.2225", "Tepotzotlán", "15"),
    "cdmx": ("19.4869", "-99.1136", "Ciudad de México", "09"),
    "gustavo a. madero": ("19.4869", "-99.1136", "Gustavo A. Madero", "09"),
    "azcapotzalco": ("19.4873", "-99.1859", "Azcapotzalco", "09"),
    "iztapalapa": ("19.3574", "-99.0671", "Iztapalapa", "09"),
    "cuauhtemoc": ("19.4326", "-99.1332", "Cuauhtémoc", "09"),
    "venustiano carranza": ("19.4310", "-99.0933", "Venustiano Carranza", "09"),
}


def cargar_env() -> dict:
    """Lee las llaves privadas desde .env sin exponerlas nunca al navegador."""
    env = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if linea and not linea.startswith("#") and "=" in linea:
                    k, v = linea.split("=", 1)
                    env[k.strip()] = v.strip()
    return env


def quitar_acentos(texto: str) -> str:
    if not texto:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(texto))
    return "".join([c for c in nfkd if not unicodedata.combining(c)]).lower().strip()


def _coord_valida(val: str) -> str:
    s = str(val or "").strip()
    if not s:
        return ""
    try:
        f = float(s)
        if abs(f) > 1.0:
            return f"{f:.7f}".rstrip("0").rstrip(".")
    except Exception:
        pass
    return ""


def construir_link_google_maps(nombre: str, direccion: str, municipio: str, lat: str = "", lon: str = "") -> str:
    """
    Construye un link directo y 100% preciso en Google Maps.
    REGLA DE ORO: Si existen coordenadas reales (lat, lon) del INEGI o Google Maps,
    usa `?api=1&query=lat,lon` para clavar el pin en el local exacto (no texto ambiguo).
    """
    lat_ok = _coord_valida(lat)
    lon_ok = _coord_valida(lon)
    if lat_ok and lon_ok:
        return f"https://www.google.com/maps/search/?api=1&query={lat_ok},{lon_ok}"

    dir_limpia = re.sub(r"\bNINGUNO\b|\bS/N\b|\b0\b", "", str(direccion or ""), flags=re.I)
    dir_limpia = re.sub(r"\s{2,}", " ", dir_limpia).strip(" ,")
    consulta = f"{nombre}, {dir_limpia}, {municipio}, Mexico".strip(", ")
    q_encoded = urllib.parse.quote(consulta)
    return f"https://www.google.com/maps/search/?api=1&query={q_encoded}"


def _extraer_municipio_denue(ubicacion: str, fallback: str = "") -> str:
    partes = [re.sub(r"\s+", " ", p).strip() for p in str(ubicacion or "").split(",") if p.strip()]
    if len(partes) >= 3:
        # Formato clásico DENUE: "LOCALIDAD, Municipio, ESTADO"
        return partes[-2].title()
    elif len(partes) == 2:
        # Formato 2 partes: "Municipio, ESTADO"
        return partes[0].title()
    elif len(partes) == 1:
        return partes[0].title()
    return fallback


def normalizar_cliente_id(cliente_id: str) -> str:
    cid = re.sub(r"[^a-z0-9_-]", "_", quitar_acentos(str(cliente_id or "mallas_tlaxcalli"))).strip("_")
    if not cid or cid == "mallas_tlaxcalli":
        return "mallas_tlaxcalli"
    return cid


def _es_giro_valido_tlaxcalli(nombre: str, clase_actividad: str) -> bool:
    """
    Evita contaminación con tiendas de abarrotes, pollerías o restaurantes que por casualidad
    mencionen 'tortilla'. Acepta tortillerías, molinos de nixtamal y talleres/refacciones de maquinaria.
    """
    clase = quitar_acentos(clase_actividad)
    nom = quitar_acentos(nombre)

    clases_validas = [
        "elaboracion de tortillas",
        "molienda de nixtamal",
        "tortill",
        "maquinaria",
        "reparacion",
        "mantenimiento industrial",
        "refaccion",
        "taller mecanico"
    ]
    if any(cv in clase for cv in clases_validas):
        return True

    excluidos = ["abarrote", "miscelanea", "tienda de", "carniceria", "taqueria", "fonda", "restaurante", "polleria", "oxxo", "mini super", "minisuper"]
    if any(ex in clase for ex in excluidos):
        return "tortilleria" in nom and "abarrote" not in nom

    return any(p in nom for p in ["tortill", "molino", "nixtamal", "celorio", "verduzco", "maquinaria", "refaccion"])


def _es_giro_valido_nicho(nombre: str, clase_actividad: str, perfil: dict = None) -> bool:
    if not perfil or normalizar_cliente_id(perfil.get("id_cliente", "mallas_tlaxcalli")) == "mallas_tlaxcalli":
        return _es_giro_valido_tlaxcalli(nombre, clase_actividad)

    busq = perfil.get("busqueda", {}) or {}
    scian = str(busq.get("codigo_scian_inegi") or "").strip()
    kws_raw = busq.get("palabras_clave_maps") or []
    giro = str(busq.get("giro_principal") or "").strip()

    clase = quitar_acentos(clase_actividad)
    nom = quitar_acentos(nombre)
    combinado = f"{nom} {clase}"

    if scian and scian in combinado:
        return True

    tokens = []
    for k in kws_raw + [giro]:
        for tok in re.split(r"[,;/\s]+", quitar_acentos(str(k))):
            if len(tok) >= 4 and tok not in ("para", "como", "este", "zona", "cdmx", "edomex", "mexico"):
                tokens.append(tok)

    if not tokens:
        return True
    return any(t in combinado for t in tokens)



# ==============================================================================
# 1. EXTRACCIÓN REAL DESDE INEGI DENUE API OFICIAL Y APIFY GOOGLE MAPS
# ==============================================================================

def _parsear_item_denue(d: dict, fallback_muni: str = "", perfil: dict = None) -> dict | None:
    tel = str(d.get("Telefono") or "").strip()
    if not tel:
        return None

    nombre_raw = re.sub(r"\s+", " ", str(d.get("Nombre") or "")).strip()
    razon = re.sub(r"\s+", " ", str(d.get("Razon_social") or "")).strip()
    clase = str(d.get("Clase_actividad") or "").strip()

    if not _es_giro_valido_nicho(nombre_raw, clase, perfil):
        return None

    muni_real = _extraer_municipio_denue(d.get("Ubicacion") or "", fallback_muni)
    calle = re.sub(r"\s+", " ", str(d.get("Calle") or "")).strip()
    num_ext = re.sub(r"\s+", " ", str(d.get("Num_Exterior") or "")).strip()
    colonia = re.sub(r"\s+", " ", str(d.get("Colonia") or "")).strip()
    cp = re.sub(r"\s+", " ", str(d.get("CP") or "")).strip()

    if calle.upper() == "NINGUNO":
        calle = ""
    if num_ext.upper() in ("NINGUNO", "0", "S/N"):
        num_ext = ""
    partes_dir = []
    if calle:
        partes_dir.append(f"{calle} {num_ext}".strip())
    if colonia and colonia.upper() != "NINGUNA":
        partes_dir.append(f"Col. {colonia}")
    if cp:
        partes_dir.append(f"C.P. {cp}")
    dir_completa = ", ".join(partes_dir) or f"Col. {colonia or 'Centro'}, {muni_real}"

    es_tlaxcalli = not perfil or normalizar_cliente_id(perfil.get("id_cliente", "mallas_tlaxcalli")) == "mallas_tlaxcalli"
    prefijo_giro = "Tortillería" if es_tlaxcalli else (perfil.get("busqueda", {}).get("giro_principal") or "Negocio")
    if not nombre_raw or "SIN NOMBRE" in nombre_raw.upper():
        nombre = f"{prefijo_giro} Col. {colonia.title()}" if colonia else (razon.title() if razon else f"{prefijo_giro} {muni_real}")
    else:
        nombre = nombre_raw.title()

    lat = _coord_valida(d.get("Latitud"))
    lon = _coord_valida(d.get("Longitud"))

    return {
        "id_externo": f"INEGI-{d.get('Id', '')}",
        "nombre": nombre,
        "telefono": tel,
        "direccion": dir_completa,
        "colonia": colonia.title(),
        "municipio": muni_real,
        "latitud": lat,
        "longitud": lon,
        "google_maps_url": construir_link_google_maps(nombre, dir_completa, muni_real, lat, lon),
        "rating": 4.6,
        "fuente": "INEGI_DENUE_OFICIAL"
    }


def extraer_inegi_por_coordenadas(termino: str, lat: str, lon: str, radio_metros: int, cant: int, token: str, reg_ini: int = 1, municipio_filtro: str = "", perfil: dict = None) -> list:
    """
    Usa el endpoint geográfico oficial del INEGI DENUE (`/Buscar/{termino}/{lat},{lon}/{radio}/{token}`),
    que devuelve los locales exactos dentro del municipio con Latitud/Longitud verificadas.
    """
    if not token:
        return []
    q = urllib.parse.quote(termino)
    url = f"https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/{q}/{lat},{lon}/{radio_metros}/{token}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=20) as resp:
            datos = json.loads(resp.read().decode("utf-8"))
            if not isinstance(datos, list):
                return []

            extraidos = []
            muni_norm = quitar_acentos(municipio_filtro)
            for d in datos:
                item = _parsear_item_denue(d, fallback_muni=municipio_filtro, perfil=perfil)
                if not item:
                    continue
                if muni_norm:
                    im = quitar_acentos(item["municipio"])
                    if muni_norm not in im and im not in muni_norm:
                        continue
                extraidos.append(item)

            idx_ini = max(0, reg_ini - 1)
            if idx_ini >= len(extraidos):
                idx_ini = 0
            return extraidos[idx_ini: idx_ini + cant]
    except Exception as e:
        print(f"   [!] Aviso consulta INEGI Buscar ({termino} @ {municipio_filtro}): {e}")
        return []


def extraer_inegi_por_municipio(termino: str, clave_entidad: str, cant: int, token: str, reg_ini: int = 1, perfil: dict = None) -> list:
    """
    Router inteligente para INEGI DENUE:
    Si el término incluye alguno de los municipios autorizados, consulta por coordenadas reales
    del municipio (`/Buscar/{giro}/lat,lon/5000/`).
    """
    if not token:
        return []

    termino_norm = quitar_acentos(termino)
    termino_limpio = re.sub(r"\s+", " ", termino_norm)
    es_tlaxcalli = not perfil or normalizar_cliente_id(perfil.get("id_cliente", "mallas_tlaxcalli")) == "mallas_tlaxcalli"

    for clave_m, (lat, lon, nombre_m, ent) in CENTROS_MUNICIPIOS.items():
        if clave_m in termino_limpio:
            if es_tlaxcalli:
                q_base = "tortilleria"
                if any(k in termino_limpio for k in ["mecanico", "maquina", "refaccion", "reparacion"]):
                    q_base = "maquinas tortilladoras"
                elif "molino" in termino_limpio:
                    q_base = "molino"
            else:
                kws = (perfil.get("busqueda", {}) or {}).get("palabras_clave_maps") or []
                q_base = kws[0] if kws else (perfil.get("busqueda", {}).get("giro_principal") or termino_limpio.replace(clave_m, "").strip() or "comercio")
            res = extraer_inegi_por_coordenadas(
                q_base, lat, lon, 5000, cant, token, reg_ini=reg_ini,
                municipio_filtro=("" if clave_m == "cdmx" else nombre_m),
                perfil=perfil
            )
            if res:
                return res

    # Fallback a BuscarEntidad solo si no coincidió municipio conocido
    q = urllib.parse.quote(termino)
    reg_fin = reg_ini + cant + 20
    url = f"https://www.inegi.org.mx/app/api/denue/v1/consulta/BuscarEntidad/{q}/{clave_entidad}/{reg_ini}/{reg_fin}/{token}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=15) as resp:
            datos = json.loads(resp.read().decode("utf-8"))
            if not isinstance(datos, list):
                return []
            extraidos = []
            for d in datos:
                item = _parsear_item_denue(d, perfil=perfil)
                if item:
                    extraidos.append(item)
            return extraidos[:cant]
    except Exception as e:
        print(f"   [!] Aviso consulta INEGI ({termino}): {e}")
        return []


def extraer_apify_google_maps(busqueda: str, max_items: int, apify_token: str, perfil: dict = None) -> list:
    """
    Ejecuta el scraper oficial de Google Maps en Apify (`compass~crawler-google-places`).
    Sobremuestrea (3x) para descartar locales cerrados o sin teléfono y devolver
    negocios ABIERTOS con teléfono y `query_place_id` exacto en Google Maps.
    """
    if not apify_token:
        return []
    url = f"https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token={apify_token}"
    lote_crawl = min(max(max_items * 3, 25), 50)
    payload = {
        "searchStringsArray": [busqueda],
        "maxCrawledPlacesPerSearch": lote_crawl,
        "language": "es",
        "countryCode": "mx"
    }
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, context=SSL_CTX, timeout=110) as resp:
            items = json.loads(resp.read().decode("utf-8"))
            resultados = []
            for it in items:
                if it.get("permanentlyClosed") or it.get("temporarilyClosed"):
                    continue
                tel = str(it.get("phoneUnformatted") or it.get("phone") or "").strip()
                if not tel:
                    continue
                nombre = str(it.get("title") or "Negocio").strip()
                cat = str(it.get("categoryName") or "").strip()
                if not _es_giro_valido_nicho(nombre, cat or busqueda, perfil):
                    continue

                direccion = str(it.get("address") or "").strip()
                muni = str(it.get("city") or "").strip()
                lat = _coord_valida((it.get("location") or {}).get("lat"))
                lon = _coord_valida((it.get("location") or {}).get("lng"))
                maps_url = str(it.get("url") or "").strip()
                if not maps_url or "google.com/maps" not in maps_url:
                    maps_url = construir_link_google_maps(nombre, direccion, muni, lat, lon)

                resultados.append({
                    "id_externo": f"MAPS-{str(it.get('placeId') or '')[:12]}",
                    "nombre": nombre,
                    "telefono": tel,
                    "direccion": direccion,
                    "colonia": str(it.get("neighborhood") or "").strip(),
                    "municipio": muni,
                    "latitud": lat,
                    "longitud": lon,
                    "google_maps_url": maps_url,
                    "rating": it.get("totalScore") or 4.7,
                    "fuente": "APIFY_GOOGLE_MAPS"
                })
                if len(resultados) >= max_items:
                    break
            return resultados
    except Exception as e:
        print(f"   [!] Aviso Apify ({busqueda}): {e}")
        return []


def recolectar_tortillerias_reales_inegi(token_inegi: str, municipios_especificos: list = None) -> list:
    consultas = municipios_especificos or [
        "tortilleria ecatepec",
        "tortilleria tultitlan",
        "tortilleria coacalco",
        "tortilleria naucalpan",
        "tortilleria tlalnepantla",
        "tortilleria cuautitlan izcalli",
        "tortilleria atizapan",
        "tortilleria cuautitlan",
        "tortilleria tepotzotlan"
    ]

    acumulados = []
    for q in consultas:
        clave = "09" if "cdmx" in quitar_acentos(q) else "15"
        lote = extraer_inegi_por_municipio(q, clave, 25, token_inegi)
        acumulados.extend(lote)

    if not municipios_especificos:
        lote_cdmx = extraer_inegi_por_municipio("tortilleria cdmx", "09", 40, token_inegi)
        acumulados.extend(lote_cdmx)

    return acumulados


def reparar_y_enriquecer_bd_existente() -> dict:
    """
    Limpia registros fuera de cobertura (ej. Toluca) y rellena latitud, longitud y links
    EXACTOS de Google Maps (`?api=1&query=lat,lon`) para todas las tortillerías ya existentes
    en SQLite cruzando contra las APIs reales de INEGI DENUE por coordenadas.
    """
    conn = inicializar_bd_sqlite()
    cur = conn.cursor()

    # 1. Eliminar prospectos rechazados fuera de cobertura que hayan quedado en BD
    cur.execute("DELETE FROM prospectos_cazador WHERE estatus_clasificacion NOT LIKE 'APROBADO%'")
    eliminados_fuera = cur.rowcount
    conn.commit()

    env = cargar_env()
    token_inegi = env.get("INEGI_DENUE_TOKEN", "")
    indice_tel = {}

    if token_inegi:
        zonas_reparacion = [
            ("19.6018", "-99.0506", "Ecatepec de Morelos"),
            ("19.6456", "-99.1689", "Tultitlán"),
            ("19.6319", "-99.1045", "Coacalco de Berriozábal"),
            ("19.4779", "-99.2389", "Naucalpan de Juárez"),
            ("19.5396", "-99.1948", "Tlalnepantla de Baz"),
            ("19.6540", "-99.2089", "Cuautitlán Izcalli"),
            ("19.6712", "-99.1806", "Cuautitlán"),
            ("19.5567", "-99.2577", "Atizapán de Zaragoza"),
            ("19.7136", "-99.2225", "Tepotzotlán"),
            ("19.4326", "-99.1332", "CDMX Centro"),
            ("19.4869", "-99.1136", "Gustavo A. Madero"),
            ("19.3574", "-99.0671", "Iztapalapa"),
            ("19.3000", "-99.1500", "CDMX Sur"),
        ]
        for lat_c, lon_c, _ in zonas_reparacion:
            url = f"https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/tortilleria/{lat_c},{lon_c}/5000/{token_inegi}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=15) as resp:
                    datos = json.loads(resp.read().decode("utf-8"))
                    if isinstance(datos, list):
                        for d in datos:
                            tel_limp, ok = limpiar_telefono_mexicano(d.get("Telefono") or "")
                            if ok:
                                lat_d = _coord_valida(d.get("Latitud"))
                                lon_d = _coord_valida(d.get("Longitud"))
                                if lat_d and lon_d:
                                    indice_tel[tel_limp] = (lat_d, lon_d)
            except Exception:
                continue

    cur.execute("SELECT id, nombre, telefono, direccion, municipio, latitud, longitud, google_maps_url FROM prospectos_cazador")
    filas = cur.fetchall()
    actualizados_pin = 0
    actualizados_fallback = 0
    for pid, nombre, tel, direc, muni, lat_b, lon_b, gurl in filas:
        tel_limp, _ = limpiar_telefono_mexicano(tel)
        lat_u, lon_u = lat_b or "", lon_b or ""
        if tel_limp in indice_tel:
            lat_u, lon_u = indice_tel[tel_limp]
        if lat_u and lon_u:
            nuevo_url = construir_link_google_maps(nombre, direc, muni, lat_u, lon_u)
            cur.execute(
                "UPDATE prospectos_cazador SET latitud=?, longitud=?, google_maps_url=? WHERE id=?",
                (lat_u, lon_u, nuevo_url, pid)
            )
            actualizados_pin += 1
        elif not gurl or "&center=" in str(gurl):
            nuevo_url = construir_link_google_maps(nombre, direc, muni)
            cur.execute("UPDATE prospectos_cazador SET google_maps_url=? WHERE id=?", (nuevo_url, pid))
            actualizados_fallback += 1

    conn.commit()
    conn.close()
    return {
        "eliminados_fuera_cobertura": eliminados_fuera,
        "con_pin_gps_exacto": actualizados_pin,
        "actualizados_busqueda_limpia": actualizados_fallback,
        "indice_denue_telefonos": len(indice_tel)
    }


# ==============================================================================
# 2. CLASIFICADOR INTELIGENTE DE NEGOCIOS
# ==============================================================================

def limpiar_telefono_mexicano(tel_crudo: str) -> tuple:
    digitos = re.sub(r"\D", "", str(tel_crudo or ""))
    if digitos.startswith("521") and len(digitos) == 13:
        digitos = "52" + digitos[3:]
    elif len(digitos) == 10:
        digitos = "52" + digitos
    es_valido = len(digitos) == 12 and digitos.startswith("52")
    return (digitos if es_valido else "", es_valido)


def clasificar_negocio(registro: dict, perfil: dict) -> dict:
    id_cliente = normalizar_cliente_id(perfil.get("id_cliente", "mallas_tlaxcalli"))
    es_tlaxcalli = (id_cliente == "mallas_tlaxcalli")

    nombre = registro.get("nombre", "").strip()
    direccion = registro.get("direccion", "").strip()
    colonia = registro.get("colonia", "").strip()
    municipio = registro.get("municipio", "").strip()
    latitud = _coord_valida(registro.get("latitud"))
    longitud = _coord_valida(registro.get("longitud"))
    rating = float(registro.get("rating", 4.6) or 4.6)

    tel_limpio, tel_valido = limpiar_telefono_mexicano(registro.get("telefono", ""))

    cob = perfil.get("cobertura_logistica", {}) or {}
    municipios_ok = [quitar_acentos(m) for m in (cob.get("municipios_edomex_autorizados") or [])]
    alcaldias_ok = [quitar_acentos(a) for a in (cob.get("alcaldias_cdmx_autorizadas") or [])]
    muni_norm = quitar_acentos(municipio)

    if not municipios_ok and not alcaldias_ok:
        en_cobertura = True
    else:
        en_cobertura = any(
            m in muni_norm or muni_norm in m
            for m in (municipios_ok + alcaldias_ok + ["cdmx", "ciudad de mexico"])
            if m
        )

    zonas_rojas = [quitar_acentos(z) for z in (cob.get("colonias_zonas_rojas") or [])]
    texto_ubicacion = quitar_acentos(f"{direccion} {colonia}")
    es_zona_roja = any(zr in texto_ubicacion for zr in zonas_rojas if zr)

    if not tel_valido:
        estatus_filtro = "RECHAZADO_SIN_TELEFONO"
        modalidad_entrega = "NO_APLICA"
    elif not en_cobertura:
        estatus_filtro = f"RECHAZADO_FUERA_DE_COBERTURA ({municipio})"
        modalidad_entrega = "FUERA_DE_RUTA"
    elif es_zona_roja:
        estatus_filtro = "APROBADO_CON_ALERTA_ZONA_ROJA"
        modalidad_entrega = "ENTREGAR_EN_AVENIDA_PRINCIPAL_O_METRO"
    else:
        estatus_filtro = "APROBADO_RUTA_DIRECTA"
        modalidad_entrega = "ENTREGA_A_DOMICILIO_GRATIS"

    reglas_oferta = perfil.get("reglas_clasificacion_oferta", {}) or {}
    palabras_mayoreo = [quitar_acentos(p) for p in (reglas_oferta.get("palabras_clave_mayoreo") or [])]
    nombre_norm = quitar_acentos(nombre)

    es_mecanico_mayoreo = any(pm in nombre_norm for pm in palabras_mayoreo if pm)
    if es_tlaxcalli:
        if es_mecanico_mayoreo:
            segmento = "MAYOREO_MECANICO_10_PIEZAS"
            oferta_asignada = reglas_oferta.get("oferta_mayoreo", "Mayoreo Mecánicos 10+ piezas")
        else:
            segmento = "MENUDEO_PAQUETE_1713"
            oferta_asignada = reglas_oferta.get("oferta_menudeo", "Paquete Completo Mantenimiento $1,713 MXN")
    else:
        giro_label = (perfil.get("busqueda", {}) or {}).get("giro_principal") or perfil.get("giro_objetivo") or "PROSPECTO_NICHO"
        segmento = re.sub(r"\s+", "_", giro_label.strip().upper())[:36]
        oferta_asignada = (
            perfil.get("oferta_gancho")
            or reglas_oferta.get("oferta_menudeo")
            or f"Oferta Especial {perfil.get('nombre_empresa', id_cliente)}"
        )

    score = 0
    if tel_valido and en_cobertura:
        score = 75
        if not es_zona_roja:
            score += 15
        if es_mecanico_mayoreo:
            score += 10
        elif rating >= 4.6:
            score += 5

    maps_url = registro.get("google_maps_url") or construir_link_google_maps(nombre, direccion, municipio, latitud, longitud)

    return {
        "id_cliente_agencia": id_cliente,
        "nombre": nombre,
        "telefono": tel_limpio,
        "direccion": direccion,
        "colonia": colonia,
        "municipio": municipio,
        "latitud": latitud,
        "longitud": longitud,
        "google_maps_url": maps_url,
        "segmento_cliente": segmento,
        "oferta_recomendada": oferta_asignada,
        "modalidad_entrega": modalidad_entrega,
        "estatus_clasificacion": estatus_filtro,
        "score_prioridad": min(score, 100),
        "fuente": registro.get("fuente", "INEGI_DENUE_OFICIAL"),
        "estatus_contacto_wa": "PENDIENTE_ENVIO" if (tel_valido and en_cobertura) else "DESCARTADO",
        "fecha_registro": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


# ==============================================================================
# 3. ALMACENAMIENTO SQLITE + EXPORTACIÓN EXCEL CSV (CON LINK GOOGLE MAPS)
# ==============================================================================

def inicializar_bd_sqlite():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS prospectos_cazador (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli',
            nombre TEXT,
            telefono TEXT,
            direccion TEXT,
            colonia TEXT,
            municipio TEXT,
            segmento_cliente TEXT,
            oferta_recomendada TEXT,
            modalidad_entrega TEXT,
            estatus_clasificacion TEXT,
            score_prioridad INTEGER,
            fuente TEXT,
            estatus_contacto_wa TEXT,
            fecha_registro TEXT,
            google_maps_url TEXT,
            latitud TEXT DEFAULT '',
            longitud TEXT DEFAULT '',
            UNIQUE(id_cliente_agencia, telefono)
        )
    """)
    cur.execute("PRAGMA table_info(prospectos_cazador)")
    cols = [row[1] for row in cur.fetchall()]
    if "id_cliente_agencia" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli'")
    if "google_maps_url" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN google_maps_url TEXT")
    if "latitud" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN latitud TEXT DEFAULT ''")
    if "longitud" not in cols:
        cur.execute("ALTER TABLE prospectos_cazador ADD COLUMN longitud TEXT DEFAULT ''")

    # Normalizar todos los registros existentes de Mallas Tlaxcalli al tenant canónico protegido 'mallas_tlaxcalli'
    cur.execute("""
        UPDATE prospectos_cazador
        SET id_cliente_agencia = 'mallas_tlaxcalli'
        WHERE id_cliente_agencia IS NULL
           OR TRIM(id_cliente_agencia) = ''
           OR LOWER(TRIM(id_cliente_agencia)) = 'mallas_tlaxcalli'
    """)

    # Asegurar índices únicos compuestos (telefono, id_cliente_agencia) y (id_cliente_agencia, telefono)
    cur.execute("""
        DELETE FROM prospectos_cazador
        WHERE id NOT IN (
            SELECT MAX(id) FROM prospectos_cazador GROUP BY id_cliente_agencia, telefono
        )
    """)
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_prospecto_cliente_tel ON prospectos_cazador(id_cliente_agencia, telefono)")
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_prospecto_tel_cliente ON prospectos_cazador(telefono, id_cliente_agencia)")
    conn.commit()
    return conn


def guardar_y_exportar(clasificados: list, id_cliente: str):
    id_cliente_norm = normalizar_cliente_id(id_cliente)
    conn = inicializar_bd_sqlite()
    cur = conn.cursor()

    for c in clasificados:
        cid_item = normalizar_cliente_id(c.get("id_cliente_agencia") or id_cliente_norm)
        c["id_cliente_agencia"] = cid_item
        if c["telefono"] and c["estatus_clasificacion"].startswith("APROBADO"):
            cur.execute(
                "SELECT id FROM prospectos_cazador WHERE LOWER(id_cliente_agencia) = LOWER(?) AND telefono = ?",
                (cid_item, c["telefono"])
            )
            existente = cur.fetchone()
            if existente:
                cur.execute("""
                    UPDATE prospectos_cazador SET
                        id_cliente_agencia = ?,
                        nombre = ?,
                        direccion = ?,
                        colonia = ?,
                        municipio = ?,
                        latitud = CASE WHEN ? != '' THEN ? ELSE latitud END,
                        longitud = CASE WHEN ? != '' THEN ? ELSE longitud END,
                        google_maps_url = CASE WHEN ? != '' THEN ? ELSE google_maps_url END
                    WHERE id = ?
                """, (
                    cid_item, c["nombre"], c["direccion"], c["colonia"], c["municipio"],
                    c.get("latitud", ""), c.get("latitud", ""),
                    c.get("longitud", ""), c.get("longitud", ""),
                    c.get("google_maps_url", ""), c.get("google_maps_url", ""),
                    existente[0]
                ))
            else:
                cur.execute("""
                    INSERT INTO prospectos_cazador (
                        id_cliente_agencia, nombre, telefono, direccion, colonia,
                        municipio, segmento_cliente, oferta_recomendada, modalidad_entrega,
                        estatus_clasificacion, score_prioridad, fuente, estatus_contacto_wa,
                        fecha_registro, google_maps_url, latitud, longitud
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    cid_item, c["nombre"], c["telefono"], c["direccion"], c["colonia"],
                    c["municipio"], c["segmento_cliente"], c["oferta_recomendada"], c["modalidad_entrega"],
                    c["estatus_clasificacion"], c["score_prioridad"], c["fuente"], c["estatus_contacto_wa"],
                    c["fecha_registro"], c.get("google_maps_url", ""), c.get("latitud", ""), c.get("longitud", "")
                ))

    conn.commit()

    if str(id_cliente or "").upper() == "TODOS":
        cur.execute("""
            SELECT nombre, telefono, direccion, colonia, municipio, segmento_cliente,
                   oferta_recomendada, modalidad_entrega, estatus_clasificacion,
                   score_prioridad, fuente, estatus_contacto_wa, fecha_registro,
                   google_maps_url, latitud, longitud, COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')
            FROM prospectos_cazador
            WHERE estatus_clasificacion LIKE 'APROBADO%'
            ORDER BY score_prioridad DESC, id DESC
        """)
    else:
        cur.execute("""
            SELECT nombre, telefono, direccion, colonia, municipio, segmento_cliente,
                   oferta_recomendada, modalidad_entrega, estatus_clasificacion,
                   score_prioridad, fuente, estatus_contacto_wa, fecha_registro,
                   google_maps_url, latitud, longitud, COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')
            FROM prospectos_cazador
            WHERE LOWER(COALESCE(id_cliente_agencia, 'mallas_tlaxcalli')) = LOWER(?)
              AND estatus_clasificacion LIKE 'APROBADO%'
            ORDER BY score_prioridad DESC, id DESC
        """, (id_cliente_norm,))
    filas = cur.fetchall()
    conn.close()

    aprobados_db = []
    for f in filas:
        nombre_f = f[0]
        dir_f = f[2]
        muni_f = f[4]
        lat_f = f[14] if len(f) > 14 else ""
        lon_f = f[15] if len(f) > 15 else ""
        cid_f = normalizar_cliente_id(f[16] if len(f) > 16 else id_cliente_norm)
        maps_link = f[13] if (len(f) > 13 and f[13] and "&center=" not in f[13]) else construir_link_google_maps(nombre_f, dir_f, muni_f, lat_f, lon_f)
        aprobados_db.append({
            "id_cliente_agencia": cid_f,
            "nombre": nombre_f,
            "telefono": f[1],
            "direccion": dir_f,
            "colonia": f[3],
            "municipio": muni_f,
            "segmento_cliente": f[5],
            "oferta_recomendada": f[6],
            "modalidad_entrega": f[7],
            "estatus_clasificacion": f[8],
            "score_prioridad": f[9],
            "fuente": f[10],
            "estatus_contacto_wa": f[11],
            "fecha_registro": f[12],
            "google_maps_url": maps_link,
            "latitud": lat_f,
            "longitud": lon_f
        })

    rechazados = [c for c in clasificados if not c["estatus_clasificacion"].startswith("APROBADO")]

    ruta_aprobados = os.path.join(DATA_DIR, "1_Prospectos_Maps.csv")
    columnas_ok = [
        "ID_Prospecto", "Nombre", "Telefono", "Direccion", "Municipio",
        "Link_Google_Maps", "Segmento_Cliente", "Modalidad_Entrega", "Oferta_Asignada",
        "Fuente_Oficial", "Score_Prioridad", "Estatus"
    ]
    with open(ruta_aprobados, mode="w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(columnas_ok)
        for idx, a in enumerate(aprobados_db, start=1):
            w.writerow([
                f"TLX-PROS-{idx:03d}",
                a["nombre"],
                a["telefono"],
                a["direccion"],
                a["municipio"],
                a["google_maps_url"],
                a["segmento_cliente"],
                a["modalidad_entrega"],
                a["oferta_recomendada"],
                a["fuente"],
                a["score_prioridad"],
                a["estatus_contacto_wa"]
            ])

    return ruta_aprobados, aprobados_db, rechazados


def ejecutar_extraccion_real_completa():
    env = cargar_env()
    token_inegi = env.get("INEGI_DENUE_TOKEN", "")
    ruta_perfil = os.path.join(SCRIPTS_DIR, "perfil_mallas_tlaxcalli.json")
    with open(ruta_perfil, "r", encoding="utf-8") as f:
        perfil = json.load(f)

    reales_inegi = recolectar_tortillerias_reales_inegi(token_inegi)
    clasificados = [clasificar_negocio(r, perfil) for r in reales_inegi]
    ruta_csv, aprobados_db, rechazados = guardar_y_exportar(clasificados, perfil["id_cliente"])
    print(f"✅ TOTAL TORTILLERÍAS CON LINK GOOGLE MAPS EXACTO EN BD: {len(aprobados_db)}")
    return aprobados_db


if __name__ == "__main__":
    ejecutar_extraccion_real_completa()
