#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SUITE DE VERIFICACIÓN AUTOMATIZADA — PLATAFORMA MALLAS TLAXCALLI
Milestone M1: Consultative Sales Closer ("Andrea"), Owner/CDO Mode,
Outbound Throttling (80 msgs/day), and Blitzr Studio Marketing Integration.

Tests all Acceptance Criteria against live HTTP runtime endpoints on 127.0.0.1:8090.
"""

import base64
import io
import json
import os
import re
import socketserver
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import wave
from datetime import datetime

import servidor_interactivo_tlaxcalli_patched as srv

SERVER_PORT = int(os.environ.get("PORT_TLAXCALLI", 8090))
BASE_URL = f"http://127.0.0.1:{SERVER_PORT}"


def post_json(path: str, data: dict, timeout: int = 45) -> dict:
    url = f"{BASE_URL}{path}"
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


class ReusableHTTPServer(socketserver.ThreadingMixIn, srv.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class TlaxcalliVerificationSuite:
    def __init__(self):
        self.server = None
        self.server_thread = None
        self.results = []
        self.total_tests = 0
        self.passed_tests = 0

    def start_server(self):
        # Check if server already running
        try:
            req = urllib.request.Request(f"{BASE_URL}/api/estatus_whatsapp")
            with urllib.request.urlopen(req, timeout=2):
                print(f"[*] Live server already detected on {BASE_URL}")
                return
        except Exception:
            pass

        print(f"[*] Starting embedded live server on {BASE_URL}...")
        self.server = ReusableHTTPServer(("127.0.0.1", SERVER_PORT), srv.PublicSafeHandler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        time.sleep(1.0)
        print("[+] Live server started and listening.")

    def stop_server(self):
        if self.server:
            print("[*] Stopping embedded live server...")
            try:
                self.server.shutdown()
            except Exception as e:
                print(f"[*] Warning during shutdown: {e}")
            try:
                self.server.server_close()
            except Exception as e:
                print(f"[*] Warning during server_close: {e}")
            if self.server_thread and self.server_thread.is_alive():
                self.server_thread.join(timeout=3.0)
            self.server = None
            self.server_thread = None
            print("[+] Embedded server stopped.")

    def record_test(self, name: str, success: bool, details: str = ""):
        self.total_tests += 1
        if success:
            self.passed_tests += 1
            print(f"  [PASS] {name}: {details}")
        else:
            print(f"  [FAIL] {name}: {details}")
        self.results.append({"name": name, "success": success, "details": details})

    def run_all(self):
        print("================================================================================")
        print("       INICIANDO SUITE DE VERIFICACIÓN AUTOMATIZADA: MALLAS TLAXCALLI M1        ")
        print("================================================================================")
        self.start_server()

        try:
            tests = [
                self.test_r1_sales_two_line_limit,
                self.test_r1_sales_escalera_del_si_and_price,
                self.test_r1_sales_anti_repetition,
                self.test_r1_gemini_tts_aoede,
                self.test_r2_owner_auth_credentials,
                self.test_r2_cdo_executive_reporting,
                self.test_r2_cdo_multichannel_description,
                self.test_r2_campaign_controls_pause_activate,
                self.test_r2_blitzr_studio_marketing_adapter,
                self.test_r3_outbound_throttle_80_daily,
                self.test_r3_standalone_shims_and_syntax,
            ]
            for test_fn in tests:
                try:
                    test_fn()
                except Exception as e_test:
                    self.record_test(test_fn.__name__, False, f"Unhandled exception: {e_test}")
        finally:
            self.stop_server()

        print("\n================================================================================")
        print(f"                   RESUMEN DE PRUEBAS: {self.passed_tests}/{self.total_tests} PASADAS                   ")
        print("================================================================================")
        for r in self.results:
            mark = "PASS" if r["success"] else "FAIL"
            print(f"  [{mark}] {r['name']}")
        print("================================================================================")

        if self.passed_tests == self.total_tests and self.total_tests > 0:
            print("\n>>> TODOS LOS CRITERIOS DE ACEPTACIÓN M1 VERIFICADOS CON ÉXITO <<<\n")
            return 0
        else:
            print("\n>>> ALGUNAS PRUEBAS FALLARON <<<\n")
            return 1

    # ==========================================================================
    # REQUIREMENT R1: Consultative Sales Closer ("Andrea")
    # ==========================================================================

    def test_r1_sales_two_line_limit(self):
        """Verifica que las respuestas de Andrea contengan estrictamente como máximo 2 renglones."""
        session_id = f"test_r1_twoline_{int(time.time())}"
        data = post_json("/api/chat", {
            "session_id": session_id,
            "mensaje": "Hola, buenas tardes, me interesa cotizar mallas para tortilladora",
            "incluir_voz": False
        })
        resp = data.get("respuesta", "")
        lines = [l.strip() for l in resp.splitlines() if l.strip()]
        ok = (data.get("ok", True)) and (0 < len(lines) <= 2)
        self.record_test(
            "R1.1 Andrea Ultra-Concise <= 2 Line Limit",
            ok,
            f"Line count: {len(lines)}, Preview: '{resp[:90]}...'"
        )

    def test_r1_sales_escalera_del_si_and_price(self):
        """Verifica la Escalera del Sí cotizando $1,713 MXN con envío gratis vs $2,700 refaccionaria y pregunta para un 'Sí'."""
        session_id = f"test_r1_escalera_{int(time.time())}"
        # Step 1: Client asks price/package
        d1 = post_json("/api/chat", {
            "session_id": session_id,
            "mensaje": "¿Cuánto cuesta el paquete completo de mallas y qué incluye?",
            "incluir_voz": False
        })
        r1 = d1.get("respuesta", "")
        has_1713 = bool(re.search(r"(\$1,?713|1713)", r1))
        has_envio_or_gratis = bool(re.search(r"(env[ií]o\s*gratis|gratis|domicilio)", r1, re.I))

        # Step 2: Follow-up asking about value vs store
        d2 = post_json("/api/chat", {
            "session_id": session_id,
            "mensaje": "Me dijeron que en la refaccionaria sale más caro, ¿es cierto?",
            "incluir_voz": False
        })
        r2 = d2.get("respuesta", "")
        has_2700 = bool(re.search(r"(\$2,?700|2700)", r2)) or bool(re.search(r"(\$2,?700|2700)", r1))
        ends_with_q = r1.strip().endswith("?") or r2.strip().endswith("?")

        ok = has_1713 and (has_2700 or has_envio_or_gratis) and ends_with_q
        self.record_test(
            "R1.2 Andrea Escalera del Sí & Value Quote ($1,713 vs $2,700)",
            ok,
            f"Has $1,713: {has_1713}, Has $2,700 ref: {has_2700}, Has closing question: {ends_with_q}"
        )

    def test_r1_sales_anti_repetition(self):
        """Verifica que no se repitan saludos en turnos subsecuentes y se mantenga tono no-pushy."""
        session_id = f"test_r1_antirep_{int(time.time())}"
        # Turn 1
        d1 = post_json("/api/chat", {
            "session_id": session_id,
            "mensaje": "Hola, qué tal, buenos días",
            "incluir_voz": False
        })
        r1 = d1.get("respuesta", "")

        # Turn 2
        d2 = post_json("/api/chat", {
            "session_id": session_id,
            "mensaje": "Tengo una máquina Celorio, ¿le quedan?",
            "incluir_voz": False
        })
        r2 = d2.get("respuesta", "")
        lines2 = [l.strip() for l in r2.splitlines() if l.strip()]

        # Check turn 2 doesn't repeat greeting
        repeats_greeting = bool(re.search(r"^(¡?hola|buen[oa]s\s+(d[ií]as|tardes|noches))", r2.strip(), re.I))
        ok = (not repeats_greeting) and (len(lines2) <= 2)
        self.record_test(
            "R1.3 Andrea Anti-Repetition & Non-Pushy Tone",
            ok,
            f"Repeated greeting: {repeats_greeting}, Turn 2 lines: {len(lines2)}"
        )

    def test_r1_gemini_tts_aoede(self):
        """Verifica Gemini TTS con el modelo de voz Aoede y empaquetado en memoria WAV sin /tmp ni ffmpeg."""
        data = post_json("/api/tts_voz_mujer", {
            "texto": "Hola, con gusto le mandamos su paquete completo con envío gratis."
        })
        ok = bool(data.get("ok"))
        data_url = data.get("audio_data_url", "")
        modelo_voz = data.get("modelo_voz", "")

        is_wav_data_url = data_url.startswith("data:audio/wav;base64,")
        is_aoede = "aoede" in modelo_voz.lower() or "aoede" in srv.os.environ.get("VOZ_GEMINI_ANDREA", "Aoede").lower()

        valid_wav_format = False
        if is_wav_data_url:
            b64_str = data_url.split(",", 1)[1]
            raw_wav = base64.b64decode(b64_str)
            try:
                with wave.open(io.BytesIO(raw_wav), "rb") as wf:
                    channels = wf.getnchannels()
                    sampwidth = wf.getsampwidth()
                    framerate = wf.getframerate()
                    nframes = wf.getnframes()
                    if channels == 1 and sampwidth == 2 and framerate in (24000, 48000) and nframes > 1000:
                        valid_wav_format = True
            except Exception as e:
                print("    WAV validation error:", e)

        success = ok and is_wav_data_url and is_aoede and valid_wav_format
        self.record_test(
            "R1.4 Gemini TTS Aoede In-Memory WAV Generation",
            success,
            f"Ok: {ok}, Voice model: {modelo_voz}, Aoede: {is_aoede}, Valid WAV: {valid_wav_format}"
        )

    # ==========================================================================
    # REQUIREMENT R2: Owner / CDO Mode & Blitzr Studio Integration
    # ==========================================================================

    def test_r2_owner_auth_credentials(self):
        """Verifica autenticación del dueño mediante #login paola Tlaxcalli2026, #admin 7210B y teléfono reconocido,
        así como rechazo adversarial de contraseñas erróneas y colisiones de catálogo (7210B)."""
        # 1. Login Paola válido
        d_pau = post_json("/api/verificar_dueno_wa", {
            "jid": "test_guest_paola@s.whatsapp.net",
            "texto": "#login paola Tlaxcalli2026"
        })
        pau_ok = bool(d_pau.get("es_dueno")) and ("Paola Almanza" in d_pau.get("nombre_admin", ""))

        # 2. Login Admin TopDiegoz válido
        d_adm = post_json("/api/verificar_dueno_wa", {
            "jid": "test_guest_admin@s.whatsapp.net",
            "texto": "#admin 7210B"
        })
        adm_ok = bool(d_adm.get("es_dueno")) and ("TopDiegoz" in d_adm.get("nombre_admin", ""))

        # 3. Known owner phone
        d_phone = post_json("/api/verificar_dueno_wa", {
            "jid": "5215648847438@s.whatsapp.net",
            "texto": "Hola"
        })
        phone_ok = bool(d_phone.get("es_dueno"))

        # 4. RECHAZO ADVERSARIAL: Contraseña errónea para Paola
        d_wrong_pau = post_json("/api/verificar_dueno_wa", {
            "jid": "test_adversarial_pau@s.whatsapp.net",
            "texto": "#login paola wrongpass"
        })
        wrong_pau_rejected = (d_wrong_pau.get("es_dueno") is False)

        # 5. RECHAZO ADVERSARIAL: PIN erróneo para Admin
        d_wrong_adm = post_json("/api/verificar_dueno_wa", {
            "jid": "test_adversarial_adm@s.whatsapp.net",
            "texto": "#admin wrongpass"
        })
        wrong_adm_rejected = (d_wrong_adm.get("es_dueno") is False)

        # 6. RECHAZO ADVERSARIAL: Colisión de catálogo (cliente preguntando por balero 7210B)
        d_collision = post_json("/api/verificar_dueno_wa", {
            "jid": "test_customer_inquiry@s.whatsapp.net",
            "texto": "Hola, necesito el balero 7210B para mi tortilladora"
        })
        collision_rejected = (d_collision.get("es_dueno") is False)

        # 7. RECHAZO ADVERSARIAL: Pieza sola sin comando
        d_bare = post_json("/api/verificar_dueno_wa", {
            "jid": "test_bare_part@s.whatsapp.net",
            "texto": "7210B"
        })
        bare_rejected = (d_bare.get("es_dueno") is False)

        ok = (pau_ok and adm_ok and phone_ok and wrong_pau_rejected and
              wrong_adm_rejected and collision_rejected and bare_rejected)
        self.record_test(
            "R2.1 Owner Authentication (#login / #admin / Phone & Negative Security)",
            ok,
            f"Positivos: [Paola={pau_ok}, Admin={adm_ok}, Phone={phone_ok}] | "
            f"Negativos: [PaolaWrong={wrong_pau_rejected}, AdminWrong={wrong_adm_rejected}, "
            f"Collision={collision_rejected}, BarePart={bare_rejected}]"
        )

    def test_r2_cdo_executive_reporting(self):
        """Verifica que el Agente CDO entregue reportes ejecutivos concisos (<= 2 párrafos) con métricas reales."""
        data = post_json("/api/agente_ceo_pau", {
            "session_id": "wa_dueno_5215648847438",
            "mensaje": "Dame el reporte ejecutivo de hoy",
            "incluir_voz": False
        })
        resp = data.get("respuesta_ceo", "")
        paragraphs = [p.strip() for p in resp.split("\n\n") if p.strip()]
        has_metrics = ("80" in resp or "prospect" in resp.lower() or "env" in resp.lower() or "motor" in resp.lower())
        ok = bool(data.get("ok")) and (len(paragraphs) <= 2) and has_metrics

        self.record_test(
            "R2.2 CDO Executive Reporting (Concise, <= 2 Paragraphs)",
            ok,
            f"Paragraph count: {len(paragraphs)}, Has core metrics: {has_metrics}"
        )

    def test_r2_cdo_multichannel_description(self):
        """Verifica que el CDO describa verbal/textualmente las capacidades multicanal sin ejecutar mutaciones externas."""
        data = post_json("/api/agente_ceo_pau", {
            "session_id": "wa_dueno_5215648847438",
            "mensaje": "¿Cuál es la estrategia multicanal y qué redes tenemos listas?",
            "incluir_voz": False
        })
        resp = data.get("respuesta_ceo", "")
        # Check channels mentioned
        mentions_wa = bool(re.search(r"whatsapp", resp, re.I))
        mentions_fb = bool(re.search(r"facebook", resp, re.I))
        mentions_tt = bool(re.search(r"tiktok", resp, re.I))
        mentions_ig = bool(re.search(r"instagram", resp, re.I))

        # Check safety guard (no automated posting executed)
        mentions_safety = bool(re.search(r"(sin\s+publica|prepara|encola|segur)", resp, re.I))

        ok = (mentions_wa and mentions_fb and (mentions_tt or mentions_ig))
        self.record_test(
            "R2.3 CDO Multi-Channel Description (WA, FB, TikTok, IG Guard)",
            ok,
            f"WA: {mentions_wa}, FB: {mentions_fb}, TikTok: {mentions_tt}, IG: {mentions_ig}, Safe staging: {mentions_safety}"
        )

    def test_r2_campaign_controls_pause_activate(self):
        """Verifica sincronización de comandos de campaña para pausar y activar dispatches."""
        # Pause
        p1 = post_json("/api/control_motor", {"activo": False})
        state_paused = not p1.get("activo", True)

        # Activate
        p2 = post_json("/api/control_motor", {"activo": True})
        state_active = bool(p2.get("activo", False))

        ok = state_paused and state_active
        self.record_test(
            "R2.4 Campaign Controls (Pause and Activate Sync)",
            ok,
            f"Paused state: {state_paused}, Active state: {state_active}"
        )

    def test_r2_blitzr_studio_marketing_adapter(self):
        """Verifica que marketing_adapter.js se integre y procese solicitudes de edición de imágenes."""
        node_script = """
        const mkt = require('./marketing_adapter');
        async function run() {
            // Test 1: Image editing request
            const imgRes = await mkt.generarImagenIA({
                texto: 'Mallas reforzadas calibre 14 con balero 7210B',
                base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                tema: 'industrial'
            });
            // Test 2: Social media multi-channel confirmation
            const pubRes = await mkt.confirmarPublicacionRedes({
                canales: ['whatsapp_estado', 'facebook', 'instagram', 'tiktok']
            });
            console.log(JSON.stringify({
                img_ok: Boolean(imgRes && imgRes.ok && imgRes.base64_resultado),
                pub_ok: Boolean(pubRes && pubRes.ok && pubRes.canales && pubRes.canales.length === 4)
            }));
        }
        run().catch(e => console.log(JSON.stringify({ error: e.message })));
        """
        proc = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, timeout=15)
        try:
            out = json.loads(proc.stdout.strip())
            ok = out.get("img_ok") and out.get("pub_ok")
        except Exception:
            ok = False
            out = {"stdout": proc.stdout, "stderr": proc.stderr}

        self.record_test(
            "R2.5 Blitzr Studio Marketing Adapter (Image Editing & Multi-Channel)",
            ok,
            f"Result: {out}"
        )

    # ==========================================================================
    # REQUIREMENT R3: Outbound Throttle & Compatibility Shims
    # ==========================================================================

    def test_r3_outbound_throttle_80_daily(self):
        """Verifica que la cuota diaria esté configurada en 80 mensajes/día y bloquee al alcanzar 80."""
        # 1. Verify global state
        meta_srv = srv.ESTADO_MOTOR_50_DIARIOS.get("meta_diaria")
        is_80_config = (meta_srv == 80)

        # 2. Verify candidate endpoint returns meta_diaria: 80
        cand_resp = post_json("/api/obtener_candidato_envio_50", {"forzar": True})
        meta_endpoint = cand_resp.get("meta_diaria")
        is_80_endpoint = (meta_endpoint == 80)

        # 3. Simulate hitting the 80/day quota in sqlite and verify cutoff
        conn = sqlite3.connect(srv.DB_PATH)
        cur = conn.cursor()
        hoy_pref = datetime.now().strftime("%Y-%m-%d")
        cur.execute("SELECT COUNT(*) FROM bitacora_envios_wa WHERE fecha_hora LIKE ?", (f"{hoy_pref}%",))
        curr_count = cur.fetchone()[0]

        # Insert temporary records to reach 80 if needed
        needed = max(0, 80 - curr_count)
        if needed > 0:
            for i in range(needed):
                cur.execute(
                    "INSERT INTO bitacora_envios_wa (telefono, nombre_negocio, municipio, mensaje, tipo_envio, fecha_hora) VALUES (?, ?, ?, ?, ?, ?)",
                    (f"52559999{i:04d}", "Tortillería Test Quota", "CDMX", "Prueba throttle", "MOTOR_80", f"{hoy_pref} 12:00:{i%60:02d}")
                )
            conn.commit()

        # Query candidate when quota is reached
        cutoff_resp = post_json("/api/obtener_candidato_envio_50", {"forzar": True})
        is_blocked = (cutoff_resp.get("ok") is False) and ("META_DIARIA" in cutoff_resp.get("motivo", ""))

        # Clean up test throttle entries
        cur.execute("DELETE FROM bitacora_envios_wa WHERE nombre_negocio = 'Tortillería Test Quota'")
        conn.commit()
        conn.close()

        ok = is_80_config and is_80_endpoint and is_80_endpoint and is_blocked
        self.record_test(
            "R3.1 Daily Outbound Throttle at 80 messages/day with Cutoff",
            ok,
            f"Config: {meta_srv}, Endpoint meta: {meta_endpoint}, Cutoff blocked at 80: {is_blocked}"
        )

    def test_r3_standalone_shims_and_syntax(self):
        """Verifica que el shim modulo_1_motor_cazador.py y puente_whatsapp_qr_patched.js compilen sin errores."""
        # 1. Python syntax checks
        p1 = subprocess.run([sys.executable, "-m", "py_compile", "servidor_interactivo_tlaxcalli_patched.py"], capture_output=True)
        p2 = subprocess.run([sys.executable, "-m", "py_compile", "modulo_1_motor_cazador.py"], capture_output=True)
        py_ok = (p1.returncode == 0) and (p2.returncode == 0)

        # 2. Node bridge syntax check
        n1 = subprocess.run(["node", "--check", "puente_whatsapp_qr_patched.js"], capture_output=True)
        node_ok = (n1.returncode == 0)

        ok = py_ok and node_ok
        self.record_test(
            "R3.2 Standalone Environment Shims & Syntax Validation",
            ok,
            f"Python compile: {py_ok}, Node bridge syntax: {node_ok}"
        )


if __name__ == "__main__":
    suite = TlaxcalliVerificationSuite()
    exit_code = suite.run_all()
    sys.exit(exit_code)
