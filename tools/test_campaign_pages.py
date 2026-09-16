"""Check generated campaigns' SEO, navigation and contact contracts offline."""
from collections import Counter
from copy import deepcopy
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urlsplit
import unittest

from build_he_landing_pages import PAGES, render_all
from landing_pages import TEMPLATE_PATH, render

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.schemas = []
        self._schema = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self._schema = ''

    def handle_data(self, value):
        if self._schema is not None:
            self._schema += value

    def handle_endtag(self, tag):
        if tag == 'script' and self._schema is not None:
            self.schemas.append(json.loads(self._schema))
            self._schema = None


class CampaignContracts(unittest.TestCase):
    def test_new_catalog_entry_needs_no_template_or_renderer_changes(self):
        page = deepcopy(next(p for p in PAGES if p['style'] == 'service'))
        page['slug'] = 'test-landing-page'
        page['title'] = 'Test service'
        html = render(page, [*PAGES, page])
        parsed = Page(html)
        canonical = next(a['href'] for t, a in parsed.tags if t == 'link' and a.get('rel') == 'canonical')
        self.assertEqual(canonical, 'https://redcrowninteractive.com/he/test-landing-page/')
        landing = next(a['value'] for t, a in parsed.tags if t == 'input' and a.get('name') == 'landing_page')
        self.assertEqual(landing, page['slug'])
        self.assertIn('<title>Test service | Red Crown Interactive</title>', html)

    def test_shared_template_changes_reach_every_page(self):
        source = TEMPLATE_PATH.read_text(encoding='utf-8')
        marker = 'shared-footer-test-marker'
        updated = source.replace('class="footer-main"', f'class="footer-main" data-test="{marker}"')
        self.assertNotEqual(source, updated)
        rendered = render_all(template_source=updated)
        self.assertEqual(set(rendered), {page['slug'] for page in PAGES})
        self.assertIn('vr-development', rendered)
        for slug, html in rendered.items():
            with self.subTest(page=slug):
                self.assertEqual(html.count(marker), 1)
        self.assertEqual(list(TEMPLATE_PATH.parent.glob('*.html')), [TEMPLATE_PATH])

    def test_generated_pages_are_current(self):
        for slug, html in render_all().items():
            with self.subTest(page=slug):
                self.assertEqual((ROOT / 'he' / slug / 'index.html').read_text(encoding='utf-8'), html)
                self.assertNotIn('${', html)

    def test_navigation_metadata_and_forms(self):
        for config in PAGES:
            slug = config['slug']
            source = (ROOT / 'he' / slug / 'index.html').read_text(encoding='utf-8')
            page = Page(source)
            with self.subTest(page=slug):
                ids = [a['id'] for _, a in page.tags if 'id' in a]
                self.assertEqual(len(ids), len(set(ids)), 'Duplicate IDs')
                counts = Counter(t for t, _ in page.tags)
                self.assertEqual(counts['h1'], 1)
                self.assertEqual(counts['main'], 1)
                self.assertEqual(counts['footer'], 1)
                self.assertEqual(counts['form'], 1)
                canonical = [a['href'] for t, a in page.tags if t == 'link' and a.get('rel') == 'canonical']
                self.assertEqual(canonical, [f'https://redcrowninteractive.com/he/{slug}/'])
                service = next(s for s in page.schemas if s['@type'] == 'Service')
                self.assertEqual(service['name'], config['title'])
                self.assertEqual(service['url'], canonical[0])
                faq = next(s for s in page.schemas if s['@type'] == 'FAQPage')
                self.assertEqual(len(faq['mainEntity']), counts['details'])
                for item in faq['mainEntity']:
                    self.assertIn(item['name'], source)
                    self.assertIn(item['acceptedAnswer']['text'], source)
                fields = {a.get('name'): a for t, a in page.tags if t in {'input', 'textarea', 'select'}}
                self.assertEqual(fields['landing_page']['value'], slug)
                self.assertIn('required', fields['name'])
                self.assertIn('required', fields['email'])
                self.assertNotIn('required', fields['message'])
                self.assertEqual(fields['botcheck']['type'], 'checkbox')
                for tracking in ('utm_source', 'utm_campaign', 'utm_content', 'gclid'):
                    self.assertIn(tracking, fields)
                form = next(a for t, a in page.tags if t == 'form')
                self.assertEqual(form['action'], 'https://api.web3forms.com/submit')
                for tag, attrs in page.tags:
                    if tag == 'img':
                        self.assertIn('alt', attrs)
                    for key in ('src', 'href', 'poster', 'data-src'):
                        value = attrs.get(key, '')
                        if value.startswith('#'):
                            self.assertIn(value[1:], ids, value)
                        elif value.startswith('/') and not value.startswith('//'):
                            dest = ROOT / urlsplit(value).path.lstrip('/')
                            if dest.is_dir():
                                dest /= 'index.html'
                            self.assertTrue(dest.is_file(), value)
                    for key in ('aria-labelledby', 'aria-describedby', 'aria-controls'):
                        for ref in attrs.get(key, '').split():
                            self.assertIn(ref, ids, f'Missing accessible target {ref}')
                if slug != 'vr-development':
                    for other in PAGES:
                        if other['slug'] != slug:
                            self.assertIn(f'href="/he/{other["slug"]}/"', source)
                    self.assertIn('id="journey"', source, 'Keep existing process anchor links')


if __name__ == '__main__':
    unittest.main()
