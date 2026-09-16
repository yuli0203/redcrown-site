"""Build the Hebrew campaign pages; --check verifies committed output."""
import argparse
from pathlib import Path
from landing_pages import PAGES, load_templates, render

ROOT = Path(__file__).resolve().parents[1]

def render_all(template_source=None):
    templates = load_templates(template_source)
    return {page['slug']: render(page, PAGES, templates) for page in PAGES}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    stale = []
    for slug, html in render_all().items():
        target = ROOT / 'he' / slug / 'index.html'
        current = target.read_text(encoding='utf-8') if target.exists() else None
        if current == html:
            continue
        if args.check:
            stale.append(slug)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(html, encoding='utf-8')
    if stale:
        raise SystemExit('Stale campaign pages: ' + ', '.join(stale))
    print('Campaign pages current: ' + str(len(PAGES)))


if __name__ == '__main__':
    main()
