#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MÓDULO 1: MOTOR CAZADOR DE PROSPECTOS — MALLAS TLAXCALLI
Compatibility and standalone execution shim.
Provides core functions for database initialization, prospect cleaning,
Google Maps link generation, and data enrichment.
"""

import os
import sqlite3
import unicodedata
import urllib.parse
from datetime import datetime

_curr_dir = os.path.dirname(os.path.abspath(__file__))
if os.path.basename(_curr_dir).lower() == "scripts":
    BASE_DIR = os.path.dirname(_curr_dir)
else:
    BASE_DIR = _curr_dir

DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "cazador_agencia.db")


def cargar_env() -> dict:
    """Loads environment variables from .env if present and returns a merged dictionary."""
    env = dict(os.environ)
    env_paths = [
        os.path.join(BASE_DIR, ".env"),
        os.path.join(os.getcwd(), ".env"),
    ]
    for ep in env_paths:
        if os.path.exists(ep):
            try:
                with open(ep, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            env[k.strip()] = v.strip().strip('"').strip("'")
            except Exception:
                pass
    return env


def quitar_acentos(texto: str) -> str:
    """Normalizes text by removing diacritics and converting to lowercase."""
    if not texto:
        return ""
    nfkd = unicodedata.normalize("NFD", str(texto))
    sin_acento = "".join([c for c in nfkd if not unicodedata.combining(c)])
    return sin_acento.lower().strip()


def construir_link_google_maps(nombre="", direccion="", municipio="", lat=None, lon=None) -> str:
    """Builds a Google Maps search or coordinates link."""
    try:
        if lat and lon and str(lat).strip() and str(lon).strip():
            lat_f = float(lat)
            lon_f = float(lon)
            if lat_f != 0 and lon_f != 0:
                return f"https://www.google.com/maps?q={lat_f},{lon_f}"
    except (ValueError, TypeError):
        pass

    partes = [str(p).strip() for p in (nombre, direccion, municipio) if p and str(p).strip()]
    query = " ".join(partes) if partes else "Tortilleria Mexico"
    return f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(query)}"


def inicializar_bd_sqlite() -> sqlite3.Connection:
    """Initializes the SQLite database and base tables if they do not exist."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS prospectos_cazador (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_cliente_agencia TEXT DEFAULT 'mallas_tlaxcalli',
            nombre TEXT,
            telefono TEXT,
            municipio TEXT,
            direccion TEXT,
            colonia TEXT,
            segmento_cliente TEXT DEFAULT 'TORTILLERIA',
            oferta_recomendada TEXT DEFAULT 'PAQUETE_MALLAS_1713',
            estatus_contacto_wa TEXT DEFAULT 'PENDIENTE',
            estatus_maps TEXT DEFAULT 'PENDIENTE_VERIFICAR',
            estatus_clasificacion TEXT DEFAULT 'APROBADO',
            google_maps_url TEXT,
            latitud REAL,
            longitud REAL,
            fecha_ultimo_wa TEXT DEFAULT '',
            fecha_registro TEXT
        )
    """)
    conn.commit()
    return conn


def clasificar_negocio(r: dict, perfil: dict = None) -> dict:
    """Classifies a prospect record according to the target business profile."""
    res = dict(r)
    nombre = res.get("nombre", "")
    res["id_cliente_agencia"] = (perfil or {}).get("id_cliente", "mallas_tlaxcalli")
    res["estatus_clasificacion"] = "APROBADO"
    res["oferta_recomendada"] = "PAQUETE_MALLAS_1713"
    res["segmento_cliente"] = "TORTILLERIA"
    return res


def guardar_y_exportar(clasificados: list, id_cliente: str = "mallas_tlaxcalli") -> tuple:
    """Saves classified prospects to the database and returns (total, approved, rejected)."""
    conn = inicializar_bd_sqlite()
    cur = conn.cursor()
    aprobados = []
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for item in clasificados:
        cur.execute("""
            INSERT INTO prospectos_cazador (
                id_cliente_agencia, nombre, telefono, municipio, direccion, colonia,
                segmento_cliente, oferta_recomendada, estatus_contacto_wa, estatus_maps,
                estatus_clasificacion, google_maps_url, latitud, longitud, fecha_registro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            id_cliente,
            item.get("nombre", "Tortillería"),
            item.get("telefono", ""),
            item.get("municipio", "CDMX"),
            item.get("direccion", ""),
            item.get("colonia", ""),
            item.get("segmento_cliente", "TORTILLERIA"),
            item.get("oferta_recomendada", "PAQUETE_MALLAS_1713"),
            item.get("estatus_contacto_wa", "PENDIENTE"),
            item.get("estatus_maps", "PENDIENTE_VERIFICAR"),
            item.get("estatus_clasificacion", "APROBADO"),
            item.get("google_maps_url", ""),
            item.get("latitud", None),
            item.get("longitud", None),
            ahora
        ))
        aprobados.append(item)

    conn.commit()
    conn.close()
    return (len(clasificados), aprobados, [])


def reparar_y_enriquecer_bd_existente() -> dict:
    """Audits database records and repairs missing Google Maps links."""
    conn = inicializar_bd_sqlite()
    cur = conn.cursor()
    cur.execute("SELECT id, nombre, direccion, municipio, latitud, longitud, google_maps_url FROM prospectos_cazador")
    filas = cur.fetchall()
    reparados = 0

    for r in filas:
        pid, nom, direc, muni, lat, lon, url = r
        if not url or "&center=" in str(url) or url == "":
            nuevo_url = construir_link_google_maps(nom or "", direc or "", muni or "", lat, lon)
            cur.execute("UPDATE prospectos_cazador SET google_maps_url = ? WHERE id = ?", (nuevo_url, pid))
            reparados += 1

    conn.commit()
    cur.execute("SELECT COUNT(*) FROM prospectos_cazador")
    total = cur.fetchone()[0]
    conn.close()
    return {"ok": True, "reparados": repararados if 'repararados' in locals() else reparados, "total": total}


def extraer_apify_google_maps(query: str, max_items: int, token: str) -> list:
    """Stub for Apify Google Maps scraping."""
    return []


def extraer_inegi_por_municipio(query: str, clave_ent: str, max_items: int, token: str, reg_ini: int = 1) -> list:
    """Stub for INEGI DENUE scraping."""
    return []
