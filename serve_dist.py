from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from socketserver import TCPServer
import os


ROOT = Path(__file__).resolve().parent / "dist"


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        request_path = self.path.split("?", 1)[0].lstrip("/")
        target = ROOT / request_path
        if self.path.startswith("/assets/") or target.exists():
            return super().do_GET()
        self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    os.chdir(ROOT)
    TCPServer.allow_reuse_address = True
    with TCPServer(("127.0.0.1", 5173), SpaHandler) as server:
        print("Serving IntelliaTech UI at http://127.0.0.1:5173/", flush=True)
        server.serve_forever()
