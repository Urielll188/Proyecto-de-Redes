#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor Puente Bidireccional Puro-Bash (Laptop <-> VPS Ubuntu / VS Code Container)
"""

import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
ZIP_PATH = r"C:\Users\Hugo\Desktop\PAQUETE_MIGRACION_NUEVA_VPS_TOPDIEGOZ.zip"
ACCESOS_LOG = os.path.join(DATA_DIR, "accesos_vps.log")
REPORTE_PATH = os.path.join(DATA_DIR, "reporte_vps.txt")
TAREA_BASH_PATH = os.path.join(DATA_DIR, "tarea_bash.txt")
RESULTADO_PATH = os.path.join(DATA_DIR, "resultado_vps.txt")


def registrar_acceso(linea: str):
    try:
        with open(ACCESOS_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%H:%M:%S')}] {linea}\n")
    except Exception:
        pass


class MigrationHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        registrar_acceso(f"{self.client_address[0]} - {format % args}")

    def _send_text(self, txt: str):
        raw = txt.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        registrar_acceso(f"GET {self.path}")

        if self.path == "/paquete.zip":
            with open(ZIP_PATH, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if self.path == "/paquete.tar.gz":
            with open(r"C:\Users\Hugo\Desktop\paquete_topdiegoz.tar.gz", "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/gzip")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if self.path == "/tarea_bash":
            if os.path.exists(TAREA_BASH_PATH):
                try:
                    with open(TAREA_BASH_PATH, "r", encoding="utf-8") as f:
                        cmd = f.read().strip()
                    os.remove(TAREA_BASH_PATH)
                    self._send_text(cmd)
                    return
                except Exception:
                    pass
            self._send_text("")
            return

        if self.path.startswith("/instalar.sh"):
            host = self.headers.get("Host", "fellow-chapter-carb-ladies.trycloudflare.com")
            base_url = f"https://{host}" if ("trycloudflare.com" in host or "lhr.life" in host) else f"http://{host}"
            script = f"""#!/usr/bin/env bash
BASE="{base_url}"
WORK_DIR="$(pwd)"

# 1. Avisar de inmediato a Antigravity que la VPS ya se conectó
(curl -skL -X POST --data-binary "CONECTADO: user=$(whoami) | dir=$WORK_DIR | $(uname -a)" "$BASE/reporte" >/dev/null 2>&1 || wget -qO- --post-data="CONECTADO: $(whoami)" "$BASE/reporte" >/dev/null 2>&1) &

# 2. Dejar encendido el Agente Puente en Puro Bash (no requiere Python ni permisos especiales)
cat << 'EOF' > /tmp/puente_antigravity.sh
#!/usr/bin/env bash
BASE_URL="__BASE_URL__"
while true; do
  CMD=$(curl -skL "$BASE_URL/tarea_bash" 2>/dev/null || wget -qO- "$BASE_URL/tarea_bash" 2>/dev/null)
  if [ -n "$CMD" ]; then
    eval "$CMD" > /tmp/out_cmd.txt 2>&1
    curl -skL -X POST --data-binary @/tmp/out_cmd.txt "$BASE_URL/resultado_vps" >/dev/null 2>&1
  fi
  sleep 2
done
EOF
sed -i "s|__BASE_URL__|$BASE|g" /tmp/puente_antigravity.sh
chmod +x /tmp/puente_antigravity.sh
pkill -f puente_antigravity.sh 2>/dev/null || true
nohup /tmp/puente_antigravity.sh >/dev/null 2>&1 &

echo "✅ PUENTE REMOTO CONECTADO CON ANTIGRAVITY"
echo "⬇️ Descargando proyecto AGENCIA_AUTOMATIZACION en $WORK_DIR..."
curl -skL "$BASE/paquete.zip" -o /tmp/paquete_topdiegoz.zip || wget -qO /tmp/paquete_topdiegoz.zip "$BASE/paquete.zip"

if command -v unzip >/dev/null 2>&1; then
  unzip -oq /tmp/paquete_topdiegoz.zip -d "$WORK_DIR"
elif command -v python3 >/dev/null 2>&1; then
  python3 -c "import zipfile; zipfile.ZipFile('/tmp/paquete_topdiegoz.zip').extractall('$WORK_DIR')"
fi

echo "✅ ¡LISTO! Ya puedes avisarle a Antigravity."
""".replace("__BASE_URL__", base_url)
            self._send_text(script)
            return

        self._send_text("OK")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8", errors="replace") if length > 0 else ""
        registrar_acceso(f"POST {self.path} ({len(raw)} bytes)")

        if self.path == "/reporte":
            with open(REPORTE_PATH, "w", encoding="utf-8") as f:
                f.write(raw)
            self._send_text("OK")
            return

        if self.path == "/resultado_vps":
            with open(RESULTADO_PATH, "w", encoding="utf-8") as f:
                f.write(raw)
            self._send_text("OK")
            return

        self._send_text("OK")


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8091), MigrationHandler)
    print("Puente Puro-Bash activo en 127.0.0.1:8091")
    server.serve_forever()
