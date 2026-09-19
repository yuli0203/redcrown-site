"""Check public HTML links against a static release tree, without opening browsers."""
import pathlib
import sys
import urllib.parse
from html.parser import HTMLParser

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'a':
            self.links.append(attrs)

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
pages = {}
for path in root.rglob('*.html'):
    if any(part in {'.git', 'node_modules', 'tools', 'artifacts', 'calendar-service'} for part in path.relative_to(root).parts):
        continue
    page = Page()
    page.feed(path.read_text(encoding='utf-8', errors='replace'))
    pages[path] = page
errors = []
for path, page in pages.items():
    for attrs in page.links:
        href = attrs.get('href', '')
        if not href and attrs.get('id') in {'preview-meeting-page', 'calendar-tip-link'}:
            continue  # Populated by workspace.js/support.js and checked in browser.
        url = urllib.parse.urlsplit(href)
        if url.scheme or url.netloc:
            continue
        target = ((root / urllib.parse.unquote(url.path).lstrip('/')) if url.path.startswith('/') else path.parent / urllib.parse.unquote(url.path)).resolve() if url.path else path
        if target.is_dir():
            target /= 'index.html'
        if not href or href == '#':
            errors.append(f'{path.relative_to(root)}: empty link')
        elif not target.exists():
            errors.append(f'{path.relative_to(root)}: missing target {href}')
        elif url.fragment and target in pages and urllib.parse.unquote(url.fragment) not in pages[target].ids:
            errors.append(f'{path.relative_to(root)}: missing anchor {href}')
print(f'{len(pages)} public HTML pages checked; {len(errors)} broken internal links.')
print('\n'.join(errors))
sys.exit(bool(errors))
