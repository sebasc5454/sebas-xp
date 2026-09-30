"""Local preview server for Sebas XP.
Run from the project folder:  python3 tools/serve.py
Then open http://localhost:8000 in your browser.

Same as `python3 -m http.server`, except it tells the browser not to reuse old copies of files,
so every refresh shows your latest edits."""
import http.server
import os
import socketserver

PORT = int(os.environ.get('PORT', 8000))
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), NoCacheHandler) as httpd:
        print(f'Sebas XP running at http://localhost:{PORT}  (Ctrl+C to stop)')
        httpd.serve_forever()
