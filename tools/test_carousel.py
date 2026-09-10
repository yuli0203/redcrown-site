"""Regression checks for the shared local homepage carousel (:8765)."""
from playwright.sync_api import sync_playwright

CASES = [('/?lang=en', 'en', 'Next project'), ('/he/', 'he', 'הפרויקט הבא'),
         ('/ru/', 'ru', 'Следующий проект')]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for path, lang, label in CASES:
        for width in [390, 1049]:
            page = browser.new_page(viewport={'width': width, 'height': 900})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto('http://127.0.0.1:8765' + path + '#work', wait_until='networkidle')
            page.locator('.project-carousel').scroll_into_view_if_needed()
            page.wait_for_timeout(650)
            assert page.locator('html').get_attribute('lang') == lang
            assert page.locator('[data-direction=next]').get_attribute('aria-label') == label
            assert page.locator('.carousel-count').inner_text() == '1/4'
            assert page.locator('[data-direction=next]').bounding_box()['x'] > page.locator('[data-direction=prev]').bounding_box()['x']
            for side in ['prev', 'next']:
                for i in range(5):
                    card = page.locator('.swiper-slide-' + side + ' .lcard')
                    target = card.get_attribute('data-project')
                    card.click()
                    page.wait_for_timeout(580)
                    assert page.locator('.swiper-slide-active .lcard').get_attribute('data-project') == target
                    assert page.locator('#work>.wdetail:not([hidden])').get_attribute('id') == 'wd-' + target
            page.locator('[data-direction=next]').focus()
            page.keyboard.press('Enter')
            page.wait_for_timeout(580)
            assert page.locator('.carousel-count').inner_text() == '2/4'
            page.keyboard.press('ArrowLeft')
            page.wait_for_timeout(580)
            assert page.locator('.carousel-count').inner_text() == '1/4'
            rect = page.locator('.swiper-slide-active .lcard').bounding_box()
            assert abs(rect['width'] / rect['height'] - .8) < .02
            assert page.locator('.project-carousel .l-title').evaluate_all('els=>els.every(e=>e.scrollWidth<=e.clientWidth+1)')
            assert page.locator('.project-carousel').evaluate('e=>e.getBoundingClientRect().left>=0 && e.getBoundingClientRect().right<=innerWidth')
            assert not errors, errors
            print(lang, width, 'PASS: loop, side selection, keyboard, labels, 4:5 cards, title fit', flush=True)
            if width == 1049:
                page.locator('.project-carousel').screenshot(path='C:/Users/syul053/AppData/Local/Temp/carousel-' + lang + '.png')
            page.close()
    # Progressive fallback: a missing vendor script must leave the original grid.
    page = browser.new_page()
    page.route('**/swiper-14.2.0.min.js', lambda route: route.abort())
    page.goto('http://127.0.0.1:8765/?lang=en', wait_until='load')
    assert page.locator('.w2-grid .lcard').count() == 4
    assert page.locator('.project-carousel').count() == 0
    print('PASS: grid fallback without Swiper', flush=True)
    browser.close()
