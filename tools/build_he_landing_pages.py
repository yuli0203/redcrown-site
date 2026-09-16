"""Build the Hebrew campaign pages; --check verifies committed output."""
import argparse
from pathlib import Path
from service_landing_pages import render

ROOT = Path(__file__).resolve().parents[1]

PAGES = [{'slug': 'vr-development',
  'title': 'פיתוח VR ו־AR לארגונים בישראל',
  'eyebrow': 'מציאות מדומה · מציאות רבודה · מציאות משולבת'},
 {'slug': 'training-simulations',
  'title': 'סימולציות הדרכה לעובדים',
  'eyebrow': 'תרגול מורכב בלי לסכן אנשים, ציוד או זמן ייצור',
  'project_type': 'XR',
  'image': '/assets/work-class-setup.jpg?v=20260814'},
 {'slug': 'interactive-3d',
  'title': 'פיתוח תוכנה אינטראקטיבית בתלת־ממד',
  'eyebrow': 'גרפיקה והנדסת תוכנה שנבנות כמוצר אחד',
  'project_type': 'PC',
  'image': '/assets/work-ar-enzymatic.jpg?v=20260814'},
 {'slug': 'research-software',
  'title': 'פיתוח תוכנה למחקר והנדסה',
  'eyebrow': 'ממודל מדעי לכלי שאנשים באמת יכולים להשתמש בו',
  'project_type': 'PC',
  'image': '/assets/work-ml-livemol.jpg?v=20260814'},
 {'slug': 'medical-prototypes',
  'title': 'פיתוח אבות־טיפוס רפואיים',
  'eyebrow': 'מ־MedTech מורכב לאב־טיפוס שאפשר לראות, להפעיל ולבחון',
  'project_type': 'PC',
  'image': '/assets/codex-epd-philips.png?v=20260814'},
 {'slug': 'startup-mvp-poc',
  'title': 'פיתוח MVP ו־POC לסטארטאפים',
  'eyebrow': 'מרעיון למוצר שאפשר להדגים, לבדוק ולקדם',
  'project_type': 'PC',
  'image': '/assets/work-ml-livemol.jpg?v=20260814'}]


def render_all():
    return {
        page['slug']: (ROOT / 'tools/templates/vr-development.html').read_text(encoding='utf-8')
        if page['slug'] == 'vr-development' else render(page, PAGES)
        for page in PAGES
    }


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
