#!/usr/bin/env python3
"""Inline css/app.css and every local js/*.js <script src> from index.html into ONE file:
dist/procurement-control-tower.html (for sharing by email / Teams).

Usage:  python3 tools/bundle.py
CDN scripts (Tailwind Play CDN, Lucide) stay as external <script src> tags.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "index.html")
OUT_DIR = os.path.join(ROOT, "dist")
OUT = os.path.join(OUT_DIR, "procurement-control-tower.html")

SCRIPT_RE = re.compile(r'<script src="((?!https?://)[^"]+)"></script>')
CSS_RE = re.compile(r'<link rel="stylesheet" href="((?!https?://)[^"]+)">')


def read(rel):
    path = os.path.join(ROOT, rel)
    if not os.path.isfile(path):
        sys.exit("bundle.py: missing file referenced by index.html: " + rel)
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def main():
    with open(SRC, encoding="utf-8") as fh:
        html = fh.read()
    count = {"js": 0, "css": 0}

    def inline_js(m):
        count["js"] += 1
        code = read(m.group(1)).replace("</script", "<\\/script")
        return "<script data-src=\"" + m.group(1) + "\">\n" + code + "\n</script>"

    def inline_css(m):
        count["css"] += 1
        return "<style data-app=\"1\">\n" + read(m.group(1)) + "\n</style>"

    html = CSS_RE.sub(inline_css, html)
    html = SCRIPT_RE.sub(inline_js, html)
    # flag for the in-app "Download HTML" button (must run before js/router.js)
    html = html.replace('<script data-src="js/data.js">', "<script>window.__BUNDLED__ = true;</script>\n<script data-src=\"js/data.js\">", 1)
    if SCRIPT_RE.search(html) or CSS_RE.search(html):
        sys.exit("bundle.py: some local references were not inlined")
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)
    print("Wrote %s (%d scripts, %d stylesheet, %.0f KB)" % (os.path.relpath(OUT, ROOT), count["js"], count["css"], os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
