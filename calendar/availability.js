(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const panel = $('#sync-availability');
  if (!panel) return;
  const scopes = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.freebusy'];
  let uid = null, generation = 0, accounts = [], busy = false, clientId = '', sdkReady = false, enabled = false;
  const sessions = new Map(); // Access tokens stay in memory, never in browser storage.
  const edits = new Map();
  const calendarErrors = new Map();
  const errorKey = (account,id) => JSON.stringify([account,id]);
  function calendarFailure(calendar) {
    const reason = calendar?.errors?.map(error => error.reason).join(', ') || 'missing availability data';
    const explanation = reason.includes('notFound') ? 'Google could not find this calendar or allow access to its busy times.'
      : reason.includes('forbidden') ? 'Google did not allow access to this calendar.'
      : reason.includes('internalError') ? 'Google had a temporary error. Try Refresh availability again.'
      : 'Google could not return busy times for this calendar.';
    return `${explanation} (${reason})`;
  }
  const workspaceLinks = [...document.querySelectorAll('a[href="#features"], a[href="#how-it-works"], a[href="#connection-heading"]')].map(link => ({link, href:link.getAttribute('href'),text:link.textContent}));
  const message = text => { $('#sync-message').textContent = text; };
  const key = () => `crown-calendar-connections-v1:${uid}`;
  function save() {
    if (!uid) return;
    try { localStorage.setItem(key(), JSON.stringify(accounts)); }
    catch { message('Selections could not be saved. Browser storage may be full or unavailable.'); }
  }
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(key()) || '[]');
      return Array.isArray(value) ? value.filter(a => typeof a.id === 'string' && typeof a.email === 'string' && Array.isArray(a.calendars)).map(a => ({id:a.id,email:a.email,calendars:a.calendars.filter(c => typeof c.id === 'string' && typeof c.name === 'string').map(c => ({id:c.id,name:c.name,selected:c.selected === true,primary:c.primary === true}))})) : [];
    } catch { message('Saved calendar selections could not be read. Add your accounts again.'); return []; }
  }
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
  function button(text, action) { const node = element('button',text,'auth-link'); node.type = 'button'; node.disabled = busy; node.addEventListener('click',action); return node; }
  function invalidate() {
    window.CrownBusyPreview?.clear();
    $('#busy-preview').hidden = true;
    $('#busy-periods').replaceChildren();
    $('#sync-summary-text').textContent = 'Availability has not been checked for the current selection.';
  }
  function render() {
    const list = $('#calendar-accounts'); list.replaceChildren();
    $('#sync-empty').hidden = accounts.length > 0;
    $('#add-calendar').disabled = busy;
    $('#connect-google-calendar').disabled = busy || !sdkReady || !clientId || !enabled;
    $('#refresh-availability').disabled = busy || !accounts.some(a => a.calendars.some(c => c.selected));
    for (const account of accounts) {
      const card = element('article',null,'calendar-account');
      const heading = element('div',null,'calendar-account-heading');
      const info = element('div'); info.append(element('h2',account.email));
      const session = sessions.get(account.id);
      info.append(element('p', session && session.expires > Date.now() ? 'Google Calendar - connected for this session' : 'Google Calendar - reconnect to refresh availability','sync-small'));
      const actions = element('div',null,'calendar-account-actions');
      const reconnect = button('Reconnect', () => connect(account)); reconnect.disabled ||= !sdkReady || !clientId || !enabled;
      const edit = button('Edit calendars', () => { edits.set(account.id,new Set(account.calendars.filter(c => c.selected).map(c => c.id))); render(); });
      edit.setAttribute('aria-expanded',String(edits.has(account.id)));
      actions.append(edit,reconnect,button('Remove account', () => {
        sessions.delete(account.id); edits.delete(account.id); accounts = accounts.filter(a => a.id !== account.id); save(); invalidate(); render();
        message('Account removed from this browser. Google permissions can be managed in your Google Account.');
      }));
      heading.append(info,actions); card.append(heading);
      const selected = account.calendars.filter(c => c.selected);
      card.append(element('p',selected.length ? `${selected.length} selected: ${selected.map(c => c.name).join(', ')}` : 'No calendars selected. Use Edit calendars to choose which calendars to sync.','sync-small'));
      const failed = account.calendars.filter(c => c.selected && calendarErrors.has(errorKey(account.id,c.id)));
      for (const calendar of failed) card.append(element('p',`${calendar.name}: ${calendarErrors.get(errorKey(account.id,calendar.id))}`,'calendar-error'));
      if (!edits.has(account.id)) { list.append(card); continue; }
      const draft = edits.get(account.id);
      const choices = element('fieldset'); choices.append(element('legend','Calendars to check for conflicts'));
      choices.append(element('p','Choose your calendars, then Save selection to apply and sync. Google permission was requested when you connected the account.','sync-small'));
      for (const calendar of account.calendars) {
        const row = element('label',null,'calendar-choice');
        const input = element('input'); input.type = 'checkbox'; input.checked = draft.has(calendar.id); input.disabled = busy;
        input.addEventListener('change', () => { if (input.checked) draft.add(calendar.id); else draft.delete(calendar.id); });
        const description = element('span',calendar.name);
        const error = calendarErrors.get(errorKey(account.id,calendar.id));
        if (error) description.append(element('small',error,'calendar-error'));
        row.append(input,description);
        if (calendar.primary) row.append(element('small','Primary'));
        choices.append(row);
      }
      if (!account.calendars.length) choices.append(element('p','No readable calendars were returned for this account.','sync-small'));
      const editActions = element('div',null,'calendar-edit-actions');
      const apply = button('Save selection', () => {
        account.calendars.forEach(calendar => { calendar.selected = draft.has(calendar.id); });
        edits.delete(account.id); save(); invalidate(); render(); refresh();
      });
      apply.className = 'auth-button';
      editActions.append(apply,button('Cancel', () => { edits.delete(account.id); render(); }));
      card.append(choices,editActions); list.append(card);
    }
  }
  async function api(url, token, body) {
    const response = await fetch(url, {method:body ? 'POST' : 'GET',headers:{Authorization:`Bearer ${token}`,...(body ? {'Content-Type':'application/json'} : {})},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(20000)});
    if (!response.ok) {
      if (response.status === 401) throw new Error('Calendar access expired. Reconnect the account and try again.');
      if (response.status === 403) throw new Error('Google denied calendar access. Check the granted permissions and that the Calendar API is enabled.');
      if (response.status === 429) throw new Error('Google is limiting requests. Please wait before refreshing again.');
      throw new Error('Calendar data could not be loaded. Please try again.');
    }
    return response.json();
  }
  function connect(expected) {
    if (!uid || busy || !sdkReady || !clientId || !enabled) return;
    const version = generation;
    busy = true; render(); message('Choose a Google account and allow calendar availability access.');
    let finished = false;
    const timeout = setTimeout(() => finish('The connection window did not finish. Try again in Chrome or allow popups.'),120000);
    function finish(text) {
      if (finished) return;
      finished = true; clearTimeout(timeout);
      if (version !== generation) return;
      busy = false; render(); if (text) message(text);
    }
    try {
    const client = google.accounts.oauth2.initTokenClient({
      client_id:clientId, scope:scopes.join(' '), include_granted_scopes:false,
      ...(expected ? {hint:expected.email} : {}),
      error_callback:() => finish('Calendar connection cancelled or blocked. You can try again.'),
      callback:async result => {
        if (finished || version !== generation) return;
        if (result.error || !google.accounts.oauth2.hasGrantedAllScopes(result,...scopes.slice(2))) { finish('Calendar access was not granted. Choose both calendar permissions to connect.'); return; }
        try {
          const identity = await api('https://www.googleapis.com/oauth2/v3/userinfo',result.access_token);
          if (!identity.sub || !identity.email) throw new Error('Google did not return an account identity. Please reconnect.');
          if (expected && identity.sub !== expected.id) throw new Error('Choose the same account to reconnect, or use Add calendar account for a different account.');
          let pageToken = '', calendars = [];
          do {
            const query = new URLSearchParams({maxResults:'250',minAccessRole:'freeBusyReader',showHidden:'true'});
            if (pageToken) query.set('pageToken',pageToken);
            const page = await api(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${query}`,result.access_token);
            calendars.push(...(page.items || [])); pageToken = page.nextPageToken || '';
          } while (pageToken && version === generation && !finished);
          if (version !== generation || finished) return;
          const previous = accounts.find(a => a.id === identity.sub);
          const account = {id:identity.sub,email:identity.email,calendars:calendars.filter(c => !c.deleted).map(c => ({id:c.id,name:c.summaryOverride || c.summary || c.id,primary:Boolean(c.primary),selected:previous?.calendars.find(old => old.id === c.id)?.selected ?? false}))};
          accounts = [...accounts.filter(a => a.id !== account.id),account];
          if (!previous) edits.set(account.id,new Set());
          sessions.set(account.id,{token:result.access_token,expires:Date.now() + Number(result.expires_in || 3600)*1000 - 60000});
          save(); invalidate(); $('#calendar-providers').hidden = true; $('#add-calendar').setAttribute('aria-expanded','false');
          finish('Account connected. Choose your sub-calendars, then click Save selection.');
          if (account.calendars.some(c => c.selected)) refresh();
        } catch (error) { finish(error.message || 'Calendar connection failed. Please try again.'); }
      }
    });
    client.requestAccessToken({prompt:'select_account'}); }
    catch { finish('The connection window could not open. Allow popups or try Chrome.'); }
  }
  async function refresh() {
    if (!uid || busy) return;
    const selected = accounts.filter(a => a.calendars.some(c => c.selected));
    invalidate();
    if (!selected.length) { message('Select at least one calendar to check availability.'); return; }
    if (selected.some(a => !sessions.has(a.id) || sessions.get(a.id).expires <= Date.now())) { render(); message('Reconnect each selected account before checking availability.'); return; }
    const version = generation;
    busy = true; calendarErrors.clear(); render(); message('Refreshing availability...');
    const start = new Date(), end = new Date(start.getTime() + 30*86400000);
    try {
      const intervals = [];
      for (const account of selected) {
        const ids = account.calendars.filter(c => c.selected).map(c => c.id);
        for (let i = 0; i < ids.length; i += 50) {
          const batch = ids.slice(i,i+50);
          const data = await api('https://www.googleapis.com/calendar/v3/freeBusy',sessions.get(account.id).token,{timeMin:start.toISOString(),timeMax:end.toISOString(),items:batch.map(id => ({id}))});
          if (version !== generation) return;
          for (const id of batch) {
            const calendar = data.calendars?.[id];
            if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
              calendarErrors.set(errorKey(account.id,id),calendarFailure(calendar));
              continue;
            }
            for (const interval of calendar.busy) {
              const from = Date.parse(interval.start), to = Date.parse(interval.end);
              if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error('A calendar returned invalid availability. Try refreshing again.');
              intervals.push({start:from,end:to});
            }
          }
        }
      }
      if (version !== generation) return;
      if (calendarErrors.size) {
        const names = selected.flatMap(account => account.calendars.filter(c => c.selected && calendarErrors.has(errorKey(account.id,c.id))).map(c => `${c.name} (${account.email})`));
        throw new Error(`Availability is incomplete: ${names.join('; ')} could not be checked. See the reason under the account. Use Edit calendars to deselect them and Save selection, or retry Refresh availability.`);
      }
      intervals.sort((a,b) => a.start-b.start);
      const merged = [];
      for (const item of intervals) {
        const last = merged.at(-1);
        if (last && item.start <= last.end) last.end = Math.max(last.end,item.end);
        else merged.push({...item});
      }
      const count = selected.reduce((sum,a) => sum+a.calendars.filter(c => c.selected).length,0);
      $('#sync-summary-text').textContent = `${count} selected calendars checked. ${merged.length} busy periods in the next 30 days. Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`;
      const list = $('#busy-periods'); list.replaceChildren();
      for (const interval of merged) list.append(element('li',`${new Date(interval.start).toLocaleString()} - ${new Date(interval.end).toLocaleString()}`));
      $('#busy-preview').hidden = !merged.length;
      window.CrownBusyPreview?.update(merged, start.getTime(), end.getTime());
      message('Availability refreshed. This preview does not yet block times on booking pages.');
    } catch (error) { if (version === generation) { invalidate(); message(error.message || 'Availability could not be refreshed. Check your connection.'); } }
    finally { if (version === generation) { busy = false; render(); } }
  }
  $('#add-calendar').addEventListener('click', () => {
    const picker = $('#calendar-providers'); picker.hidden = !picker.hidden;
    $('#add-calendar').setAttribute('aria-expanded',String(!picker.hidden));
    if (!picker.hidden && !enabled) message('Google Calendar connections are awaiting activation. Outlook connections are coming soon.');
  });
  $('#connect-google-calendar').addEventListener('click', () => connect());
  $('#refresh-availability').addEventListener('click',refresh);
  document.addEventListener('crown-auth-change',event => {
    const nextUid = event.detail.uid;
    if (uid === nextUid) return;
    uid = nextUid; generation++; busy = false; sessions.clear(); edits.clear(); calendarErrors.clear(); message(''); invalidate();
    panel.hidden = !uid; document.body.classList.toggle('is-signed-in',Boolean(uid));
    for (const {link,href,text} of workspaceLinks) {
      link.setAttribute('href',uid ? (href === '#how-it-works' ? '/calendar/preview/' : '#sync-availability') : href);
      link.textContent = uid ? (href === '#how-it-works' ? 'Scheduling preview' : 'Sync availability') : text;
    }
    accounts = uid ? load() : []; render();
  });
  setInterval(() => { if (uid && !document.hidden && sessions.size && !busy && !edits.size) refresh(); },5*60*1000);
  Promise.all([
    fetch('/calendar/auth-config.json',{cache:'no-store'}).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    new Promise((resolve,reject) => {
      const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      script.onload = resolve; script.onerror = reject; document.head.append(script);
    })
  ]).then(([config]) => { clientId = config.calendar?.googleClientId || ''; enabled = config.calendar?.googleEnabled === true; sdkReady = Boolean(window.google?.accounts?.oauth2); render(); })
    .catch(() => { message('Calendar connection tools could not load. Check your connection and reload.'); });
})();
