// No network requests or real conversion events: exercise the production handler
// against controlled responses, including failures after the message is accepted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../site.js'), 'utf8');
const tracking = source.slice(source.indexOf('// Google Ads conversion tracking'),
  source.indexOf('// selected work:'));

function setup({ response = { ok: true, json: async () => ({ success: true }) },
  fetchError, tagError, noTag = false, delayed = false } = {}) {
  const ok = { hidden: true }, err = { hidden: true }, btn = { disabled: false };
  let handler, finish;
  const calls = [], events = [], warnings = [];
  const form = {
    action: 'https://example.test/submit',
    elements: { project: { value: 'XR' } },
    resets: 0,
    querySelector: selector => ({ '.form-ok': ok, '.form-err': err, 'button[type=submit]': btn })[selector],
    addEventListener: (event, fn) => { if (event === 'submit') handler = fn; },
    reset() { this.resets++; this.elements.project.value = ''; },
  };
  const context = {
    document: {
      querySelector: selector => selector === '.contact-form' ? form : { value: '/he/vr-development/' },
      querySelectorAll: () => [],
    },
    location: { pathname: '/he/vr-development/' },
    FormData: class extends Map {
      constructor(target) {
        super([['redirect', 'https://example.test/?sent=1'], ['project', 'XR']]);
        assert.equal(target, form);
      }
    },
    fetch: async (...args) => {
      calls.push(args);
      if (fetchError) throw fetchError;
      if (delayed) await new Promise(resolve => { finish = resolve; });
      return response;
    },
    console: { warn: (...args) => warnings.push(args) },
  };
  if (!noTag) context.gtag = (...args) => {
    if (tagError) throw tagError;
    events.push(args);
  };
  vm.runInNewContext(tracking, context, { filename: 'site.js (contact handler)' });
  return { ok, err, btn, form, calls, events, warnings,
    submit: () => handler({ preventDefault() {} }), finish: () => finish() };
}

test('accepted message emits one form conversion with its original project context', async () => {
  const h = setup(); await h.submit();
  assert.equal(h.form.resets, 1);
  assert.equal(h.ok.hidden, false); assert.equal(h.err.hidden, true);
  assert.equal(h.btn.disabled, false); assert.equal(h.events.length, 1);
  assert.equal(h.events[0][0], 'event'); assert.equal(h.events[0][1], 'conversion');
  assert.equal(h.events[0][2].send_to, 'AW-18313532220/H3CjCKq279QcELymyZxE');
  assert.equal(h.events[0][2].project_type, 'XR');
  assert.equal(h.events[0][2].landing_page, '/he/vr-development/');
});
test('AJAX request omits the native-form redirect and keeps the submitted fields', async () => {
  const h = setup(); await h.submit();
  const body = h.calls[0][1].body;
  assert.equal(body.has('redirect'), false);
  assert.equal(body.get('project'), 'XR');
});
for (const [label, options] of [
  ['HTTP rejection', { response: { ok: false, json: async () => ({ success: false }) } }],
  ['API rejection in HTTP 200', { response: { ok: true, json: async () => ({ success: false }) } }],
  ['invalid response body', { response: { ok: true, json: async () => { throw new Error('Invalid JSON'); } } }],
  ['network error', { fetchError: new Error('Network failure') }],
]) test(`${label} preserves the message and never records a conversion`, async () => {
  const h = setup(options); await h.submit();
  assert.equal(h.form.resets, 0); assert.equal(h.form.elements.project.value, 'XR');
  assert.equal(h.ok.hidden, true); assert.equal(h.err.hidden, false);
  assert.equal(h.btn.disabled, false); assert.equal(h.events.length, 0);
});
test('blocked Google tag does not turn a delivered message into a form error', async () => {
  const h = setup({ tagError: new Error('Tag blocked') }); await h.submit();
  assert.equal(h.ok.hidden, false); assert.equal(h.err.hidden, true);
  assert.equal(h.btn.disabled, false); assert.equal(h.form.resets, 1);
});
test('missing Google tag does not prevent delivery', async () => {
  const h = setup({ noTag: true }); await h.submit();
  assert.equal(h.ok.hidden, false); assert.equal(h.err.hidden, true);
});
test('a second submission while sending cannot duplicate the message or conversion', async () => {
  const h = setup({ delayed: true });
  const first = h.submit(); const second = h.submit();
  assert.equal(h.calls.length, 1);
  h.finish(); await Promise.all([first, second]);
  assert.equal(h.events.length, 1); assert.equal(h.form.resets, 1);
});
