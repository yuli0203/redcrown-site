"""Local Hebrew serial-loading regression: run with the local server on :8765."""
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8765'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']


def check():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=GL)
        page = browser.new_page(viewport={'width': 1049, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script("""(() => {
          window.modelEvents = [];
          document.addEventListener('load', e => {
            if (e.target.tagName === 'MODEL-VIEWER')
              modelEvents.push({kind:'loaded', src:e.target.getAttribute('src'), t:performance.now()});
          }, true);
          new PerformanceObserver(list => {
            for (const e of list.getEntries()) if (e.name.includes('.glb'))
              modelEvents.push({kind:'request', src:new URL(e.name).pathname, t:e.startTime});
          }).observe({type:'resource', buffered:true});
        })();""")
        page.goto(BASE + '/he/?test=serial#top', wait_until='load')
        page.wait_for_function("document.querySelector('[data-model=robi]')?.__modelState === 'loaded'")
        # Continuous scroll notifications must defer the next load, even if a
        # previously scheduled idle callback has already fired.
        page.evaluate("window.scrollProbe = setInterval(()=>window.dispatchEvent(new Event('scroll')),50)")
        page.wait_for_timeout(1600)
        assert page.locator('model-viewer').count() == 1
        page.evaluate('clearInterval(scrollProbe)')
        page.wait_for_function("[...document.querySelectorAll('.wd-model-wrap')].every(w=>w.__modelState==='loaded')", timeout=60000)
        events = page.evaluate('modelEvents')
        loads = sorted((e for e in events if e['kind'] == 'loaded'), key=lambda e: e['t'])
        requests = sorted((e for e in events if e['kind'] == 'request'), key=lambda e: e['t'])
        assert len(loads) == len(requests) == 4, events
        assert [e['src'].split('/')[-1].split('?')[0] for e in loads] == [
            'robi_opt.glb', 'enzym_opt.glb', 'caffeine2_opt.glb', 'meta_quest_3_opt.glb']
        for i in range(1, 4):
            assert requests[i]['t'] - loads[i-1]['t'] >= 950, events
        assert page.locator('[data-model=robi] model-viewer').evaluate('m=>m.paused')
        page.locator('#wd-vr .wd-model-wrap').scroll_into_view_if_needed()
        page.wait_for_function("document.querySelector('[data-model=robi] model-viewer').paused === false")
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function("document.querySelector('[data-model=robi] model-viewer').paused === true")
        assert page.locator('model-viewer[auto-rotate]').count() == 0
        assert not errors, errors
        print('PASS: order, serial load + 1s gaps, scrolling deferral, offscreen pause, reduced motion')
        page.close()

        # A failed model must not stall the remaining queue, and can be retried.
        page = browser.new_page()
        page.route('**/enzym_opt.glb', lambda route: route.abort())
        page.goto(BASE + '/he/?test=failure#top', wait_until='load')
        page.wait_for_function("document.querySelector('[data-model=quest3]')?.__modelState === 'loaded'", timeout=60000)
        assert page.locator('[data-model=enzym]').evaluate('w=>w.__modelState') == 'error'
        page.unroute('**/enzym_opt.glb')
        # Open AR using the public carousel control, then retry the error UI.
        page.locator('[data-direction=next]').click()
        page.locator('[data-model=enzym] .wd-model-loading button').click()
        page.wait_for_function("document.querySelector('[data-model=enzym]')?.__modelState === 'loaded'", timeout=30000)
        print('PASS: model failure does not block queue; retry succeeds')
        page.close()

        # The new scheduler is Hebrew-homepage only.
        for path in ['/', '/ru/']:
            page = browser.new_page()
            page.goto(BASE + path, wait_until='load')
            page.evaluate('RCModels.load()')
            assert page.locator('model-viewer').count() == 4
            assert page.locator('.wd-model-wrap').evaluate_all('ws=>ws.every(w=>w.__modelState===undefined)')
            page.close()
        print('PASS: EN/RU retain existing loader behavior')
        browser.close()


if __name__ == '__main__':
    check()
