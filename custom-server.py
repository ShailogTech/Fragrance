import http.server
import os
import mimetypes
from urllib.parse import urlparse, parse_qs

# Ensure proper MIME types for JS/CSS modules
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/webp', '.webp')
mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('font/woff', '.woff')
mimetypes.add_type('text/plain', '.txt')

OUT_DIR = '/home/z/my-project/out'

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add headers to allow iframe embedding
        self.send_header('X-Frame-Options', 'ALLOWALL')
        self.send_header('Content-Security-Policy',
                         "frame-ancestors * http: https:; "
                         "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;")
        # Add cache control for static assets
        if '/_next/static/' in self.path:
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Handle _next/image redirects - redirect to original image
        if path.startswith('/_next/image'):
            qs = parse_qs(parsed.query)
            img_url = qs.get('url', [''])[0]
            if img_url:
                self.send_response(302)
                self.send_header('Location', img_url)
                self.end_headers()
                return

        # Handle clean URLs: /admin -> /admin.html, /dashboard -> /dashboard.html
        if path in ('/admin', '/dashboard'):
            html_path = path + '.html'
            full_path = os.path.join(OUT_DIR, html_path.lstrip('/'))
            if os.path.isfile(full_path):
                self.path = html_path

        super().do_GET()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=OUT_DIR, **kwargs)

    def log_message(self, format, *args):
        # Suppress verbose logging
        pass

if __name__ == '__main__':
    os.chdir(OUT_DIR)
    server = http.server.HTTPServer(('0.0.0.0', 3000), CustomHandler)
    print("Serving on port 3000 with iframe headers...")
    server.serve_forever()
