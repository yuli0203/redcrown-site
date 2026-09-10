"""Keyboard/AT-tree regression checks, not a screen-reader certification."""
from playwright.sync_api import sync_playwright


def assert_selection(page):
    state = page.evaluate("""()=>{
      const slides=[...document.querySelectorAll('.swiper-slide')];
      const active=document.querySelector('.swiper-slide-active');
      return {
        exposed:slides.filter(s=>s.getAttribute('aria-hidden')!=='true').length,
        exposedActive:active.getAttribute('aria-hidden')!=='true',
        tabStops:slides.filter(s=>s.querySelector('.lcard').tabIndex===0).length,
        hiddenFocus:!!document.activeElement.closest('[aria-hidden="true"], [hidden]'),
        duplicates:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((v,i,a)=>a.indexOf(v)!==i)
      };
    }""")
    assert state == dict(exposed=1, exposedActive=True, tabStops=1, hiddenFocus=False, duplicates=[]), state


with sync_playwright() as p:
    browser=p.chromium.launch()
    for path, lang in [('/?lang=en','en'),('/he/','he'),('/ru/','ru')]:
        page=browser.new_page(viewport={'width':1049,'height':900})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:8765'+path+'#work',wait_until='networkidle')
        page.locator('.project-carousel').scroll_into_view_if_needed()
        page.wait_for_timeout(650)
        assert_selection(page)
        tree=page.locator('.project-carousel').aria_snapshot()
        assert tree.count('- group ') == 1,tree
        # Backwards through the loop seam: keep the previous control focused.
        page.locator('[data-direction=prev]').focus()
        page.keyboard.press('Enter');page.wait_for_timeout(600)
        assert page.locator('.swiper-slide-active .lcard').get_attribute('data-project')=='class'
        assert page.evaluate("document.activeElement.dataset.direction")=='prev'
        assert_selection(page)
        # Close from inside the detail panel and restore focus to the real copy.
        page.locator('#wd-class .wdetail-close').focus()
        page.keyboard.press('Escape')
        assert page.locator('#work>.wdetail:not([hidden])').count()==0
        assert page.locator('.project-carousel [aria-expanded=true]').count()==0
        assert page.evaluate("document.activeElement===document.querySelector('.swiper-slide-active .lcard')")
        assert_selection(page)
        # Enter reopens the active card, Space closes it, Enter reopens it again.
        for key, count in [('Enter',1),('Space',0),('Enter',1)]:
            page.keyboard.press(key);page.wait_for_timeout(100)
            assert page.locator('#work>.wdetail:not([hidden])').count()==count
        # Card arrow navigation follows the selected card in BOTH directions.
        for key in ['ArrowRight','ArrowRight','ArrowLeft','ArrowLeft']:
            page.keyboard.press(key);page.wait_for_timeout(600)
            assert page.evaluate("document.activeElement===document.querySelector('.swiper-slide-active .lcard')")
            assert_selection(page)
        # Natural Tab order goes to previous, next, and the detail close button.
        for selector in ['[data-direction=prev]','[data-direction=next]','#wd-class .wdetail-close']:
            page.keyboard.press('Tab')
            assert page.locator(selector).evaluate('e=>e===document.activeElement'),selector
        page.keyboard.press('Enter')
        assert page.locator('#work>.wdetail:not([hidden])').count()==0
        assert_selection(page)
        # Mouse dragging of a side card still works despite suppressed pointer focus.
        box=page.locator('.swiper-slide-next .lcard').bounding_box()
        x=box['x']+box['width']/2;y=box['y']+box['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x-230,y,steps=20);page.mouse.up()
        page.wait_for_timeout(650)
        assert page.locator('.swiper-slide-active .lcard').get_attribute('data-project')!='class'
        assert_selection(page)
        page.emulate_media(reduced_motion='reduce')
        page.locator('[data-direction=next]').click();page.wait_for_timeout(100)
        assert page.locator('.swiper').evaluate('e=>e.swiper.params.speed')==0
        assert_selection(page)
        assert not errors,errors
        print(lang,'PASS: accessible tree, keyboard, both close paths, focus, drag, reduced motion',flush=True)
        page.close()
    browser.close()
