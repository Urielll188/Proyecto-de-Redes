import base64
import hmac
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API_KEY = os.environ.get("VPS_API_KEY", "").strip()
PORT = int(os.environ.get("PORT", "3020"))
ALLOWED_MODULES = {"whatsapp", "workflows", "bots", "video-studio", "clients"}


def get_container_id(pattern: str) -> str:
    """Resuelve dinámicamente el ID del contenedor Docker coincidente."""
    try:
        res = subprocess.run(
            ["docker", "ps", "--format", "{{.ID}} {{.Names}}"],
            capture_output=True,
            text=True,
            timeout=5.0,
        )
        if res.returncode == 0 and res.stdout:
            for line in res.stdout.strip().splitlines():
                parts = line.split(None, 1)
                if len(parts) == 2:
                    cid, name = parts
                    if re.search(pattern, name, re.IGNORECASE):
                        return cid.strip()
    except Exception:
        pass
    return ""


def get_vsc_container() -> str:
    cid = get_container_id(r"agencia_topdiegozc_vsc-server")
    return cid or "f610d06918b1"


def get_n8n_container() -> str:
    cid = get_container_id(r"agencia_topdiegozc_n8n\.")
    return cid or "8a900e599b83"


CONTAINER_PROXY_SCRIPT = """
import base64, json, sys, urllib.request, urllib.error
req_data = json.loads(sys.stdin.read())
url = "http://127.0.0.1:8090" + req_data["path"]
body = base64.b64decode(req_data["body_b64"]) if req_data.get("body_b64") else None
headers = {}
if req_data.get("content_type"):
    headers["Content-Type"] = req_data["content_type"]
req = urllib.request.Request(url, data=body, method=req_data["method"], headers=headers)
try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read()
        print(json.dumps({
            "status": resp.status,
            "content_type": resp.headers.get("Content-Type", "application/json"),
            "body_b64": base64.b64encode(raw).decode("ascii"),
        }))
except urllib.error.HTTPError as e:
    raw = e.read()
    print(json.dumps({
        "status": e.code,
        "content_type": e.headers.get("Content-Type", "application/json") if e.headers else "application/json",
        "body_b64": base64.b64encode(raw).decode("ascii"),
    }))
except Exception as exc:
    raw = json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")
    print(json.dumps({
        "status": 502,
        "content_type": "application/json",
        "body_b64": base64.b64encode(raw).decode("ascii"),
    }))
""".strip()


def run_cmd(cmd: list[str], timeout: float = 3.0) -> tuple[int, str]:
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return res.returncode, (res.stdout or "").strip()
    except Exception as exc:
        return 1, str(exc)


def proxy_to_tlaxcalli(method: str, path: str, content_type: str, raw_body: bytes) -> tuple[int, str, bytes]:
    vsc_cid = get_vsc_container()
    if not vsc_cid:
        return 502, "application/json", json.dumps({"ok": False, "error": "VSC Container not found"}).encode("utf-8")

    payload = json.dumps({
        "method": method,
        "path": path,
        "content_type": content_type,
        "body_b64": base64.b64encode(raw_body).decode("ascii") if raw_body else "",
    })
    try:
        res = subprocess.run(
            ["docker", "exec", "-i", vsc_cid, "python3", "-c", CONTAINER_PROXY_SCRIPT],
            input=payload,
            capture_output=True,
            text=True,
            timeout=95,
        )
        if res.returncode != 0 or not res.stdout.strip():
            err_msg = (res.stderr or res.stdout or "Container proxy error").strip()
            return 502, "application/json", json.dumps({"ok": False, "error": err_msg}).encode("utf-8")
        out = json.loads(res.stdout.strip().splitlines()[-1])
        return (
            int(out.get("status", 200)),
            out.get("content_type", "application/json"),
            base64.b64decode(out.get("body_b64", "")),
        )
    except Exception as exc:
        return 502, "application/json", json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")


def check_vps_module(modulo: str) -> dict:
    ts = datetime.now(timezone.utc).isoformat()
    vsc_cid = get_vsc_container()
    n8n_cid = get_n8n_container()

    if modulo == "whatsapp":
        rc, out = run_cmd(["docker", "exec", vsc_cid, "pgrep", "-fa", "puente_whatsapp_qr.js"])
        return {
            "module": "whatsapp",
            "active": rc == 0 and bool(out),
            "process": out or "standby",
            "containerId": vsc_cid,
            "timestamp": ts,
        }
    if modulo == "workflows":
        rc, out = run_cmd(["docker", "inspect", "-f", "{{.State.Running}}", n8n_cid])
        return {
            "module": "workflows",
            "active": rc == 0 and out == "true",
            "n8nRunning": out == "true",
            "containerId": n8n_cid,
            "timestamp": ts,
        }
    if modulo == "bots":
        rc, out = run_cmd(["docker", "exec", vsc_cid, "pgrep", "-fa", "servidor_interactivo_tlaxcalli.py"])
        return {
            "module": "bots",
            "active": rc == 0 and bool(out),
            "process": out or "standby",
            "containerId": vsc_cid,
            "timestamp": ts,
        }
    if modulo == "video-studio":
        rc, out = run_cmd(["docker", "exec", vsc_cid, "ls", "/config/workspace/AGENCIA_AUTOMATIZACION/06_Video_Studio"])
        return {
            "module": "video-studio",
            "active": rc == 0,
            "ready": rc == 0,
            "containerId": vsc_cid,
            "timestamp": ts,
        }
    return {
        "module": "clients",
        "active": True,
        "timestamp": ts,
    }


class GatewayHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return

    def _send_bytes(self, code: int, content_type: str, body: bytes) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, code: int, payload: dict) -> None:
        self._send_bytes(code, "application/json", json.dumps(payload).encode("utf-8"))

    def _authorize(self) -> bool:
        if not API_KEY:
            return False
        token = self.headers.get("x-vps-api-key", "").strip()
        if not token:
            auth = self.headers.get("Authorization", "")
            if auth.lower().startswith("bearer "):
                token = auth[7:].strip()
        return bool(token) and hmac.compare_digest(token, API_KEY)

    def _handle_request(self, method: str) -> None:
        if not self._authorize():
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if path == "/health":
            self._send_json(200, {"ok": True, "status": "online"})
            return

        prefix = "/api/vps/"
        if path.startswith(prefix):
            modulo = path[len(prefix):]
            if modulo not in ALLOWED_MODULES:
                self._send_json(400, {"ok": False, "error": f"Invalid module: {modulo}"})
                return

            length = int(self.headers.get("Content-Length", "0") or 0)
            raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                req_body = json.loads(raw_body) if raw_body else {}
            except Exception:
                req_body = {}

            info = check_vps_module(modulo)
            info["method"] = method
            if method == "POST" and req_body:
                info["echo"] = req_body
            self._send_json(200, info)
            return

        if path.startswith("/api/") or path == "/excel_mallas_tlaxcalli.csv":
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw_body = self.rfile.read(length) if length > 0 else b""
            ct = self.headers.get("Content-Type", "")
            status, resp_ct, resp_bytes = proxy_to_tlaxcalli(method, self.path, ct, raw_body)
            self._send_bytes(status, resp_ct, resp_bytes)
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_GET(self) -> None:
        self._handle_request("GET")

    def do_POST(self) -> None:
        self._handle_request("POST")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), GatewayHandler)
    print(f"Blitzr VPS Gateway listening on 0.0.0.0:{PORT}", flush=True)
    server.serve_forever()
