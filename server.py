"""Servidor estático LAN con tipos MIME correctos para Brújula Vocacional."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import os
import socket


class StaticHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def get_lan_ip() -> str:
    """Obtiene la IP LAN preferida sin enviar datos por Internet."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "IP-DE-TU-PC"
    finally:
        sock.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Servidor LAN de Brújula Vocacional"
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    os.chdir(root)

    try:
        server = ThreadingHTTPServer((args.host, args.port), StaticHandler)
    except OSError as exc:
        raise SystemExit(
            f"No se pudo abrir {args.host}:{args.port}. "
            "Verifica que el puerto no esté ocupado o prueba --port 8080.\n"
            f"Detalle: {exc}"
        ) from exc

    lan_ip = get_lan_ip()
    print("\nBrújula Vocacional iniciada")
    print(f"En este equipo: http://127.0.0.1:{args.port}")
    print(f"En la red LAN: http://{lan_ip}:{args.port}")
    print("Los otros dispositivos deben estar conectados a la misma red Wi-Fi/LAN.")
    print("Presiona Ctrl+C para detener el servidor.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
