"""
Servidor HTTP para Road To — envía CSP y no-cache en cada respuesta.
Uso: python server.py
"""
import http.server
import socketserver

PORT = 3000

CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "https://cdn.jsdelivr.net https://bt-cdn.yappy.cloud; "
    "connect-src 'self' "
        "https://*.supabase.co wss://*.supabase.co "
        "https://bt-cdn.yappy.cloud "
        "https://*.bgeneral.cloud "
        "https://*.yappy.cloud "
        "https://conductores-api.onrender.com; "
    "img-src 'self' data: blob: "
        "https://*.supabase.co "
        "https://*.tile.openstreetmap.org "
        "https://unpkg.com "
        "https://bt-cdn.yappy.cloud "
        "https://*.yappy.cloud; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com;"
)

class CSPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Seguridad: CSP via header HTTP (tiene prioridad sobre meta-tag)
        self.send_header("Content-Security-Policy", CSP)
        # Sin caché — fuerza al navegador a pedir el archivo siempre
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

with socketserver.TCPServer(("", PORT), CSPHandler) as httpd:
    print(f"Servidor Road To en http://localhost:{PORT}")
    print(f"  CSP con Yappy activa")
    print(f"  Sin cache (no-cache)")
    print(f"  Ctrl+C para detener\n")
    httpd.serve_forever()
