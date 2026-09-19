(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  // Local-only appointments. No external calendars, accounts or invitations.
  let storageKey = 'crown-calendar-meetings-v1';
  let meetings = [];
  let selectedStart = null;
  function loadMeetings() {
    meetings = [];
    try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) meetings = stored.filter(m => typeof m.id === 'string' && typeof m.title === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && Number.isInteger(m.start) && Number.isInteger(m.duration) && m.duration > 0 && m.start >= 0 && m.start + m.duration <= 1440);
    } catch { $('#save-status').textContent = 'Saved meetings could not be read. Browser storage may be unavailable.'; }
  }
  loadMeetings();
  const timeText = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const conflicts = (start, length) => meetings.some(m => m.date === dateKey(selectedDate) && start < m.start + m.duration && start + length > m.start);
  function persist(next) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); meetings = next; return true; }
    catch { $('#save-status').textContent = 'Unable to save in this browser. Allow browser storage and try again.'; return false; }
  }
  function exportMeeting(meeting) {
    const escapeICS = value => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const stamp = minutes => `${meeting.date.replaceAll('-', '')}T${timeText(minutes).replace(':', '')}00`;
    const content = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Red Crown//Calendar//EN','BEGIN:VEVENT',`UID:${meeting.id}@redcrowninteractive.com`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z')}`,`DTSTART;TZID=Asia/Jerusalem:${stamp(meeting.start)}`,`DTEND;TZID=Asia/Jerusalem:${stamp(meeting.start + meeting.duration)}`,`SUMMARY:${escapeICS(meeting.title)}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], {type:'text/calendar;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'crown-meeting.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function renderMeetings() {
    const list = $('#saved-meetings'); list.replaceChildren();
    if (!meetings.length) { const empty = document.createElement('p'); empty.textContent = 'No saved meetings yet.'; list.append(empty); return; }
    [...meetings].sort((a,b) => a.date.localeCompare(b.date) || a.start - b.start).forEach(meeting => {
      const item = document.createElement('div'); item.className = 'meeting-item';
      const details = document.createElement('div'); const title = document.createElement('strong'); title.textContent = meeting.title;
      const time = document.createElement('small'); time.textContent = `${meeting.date} · ${timeText(meeting.start)} - ${timeText(meeting.start + meeting.duration)} · Israel Time`;
      details.append(title, time);
      const actions = document.createElement('div'); actions.className = 'meeting-actions';
      const download = document.createElement('button'); download.textContent = 'Export .ics'; download.setAttribute('aria-label', `Export ${meeting.title}`); download.addEventListener('click', () => exportMeeting(meeting));
      const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${meeting.title}`); remove.addEventListener('click', () => { if (persist(meetings.filter(m => m.id !== meeting.id))) { renderMeetings(); renderTimes(); $('#save-status').textContent = 'Meeting removed from this browser.'; } });
      actions.append(download, remove); item.append(details, actions); list.append(item);
    });
  }
  const israelParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type) => Number(israelParts.find(p => p.type === type).value);
  const today = new Date(part('year'), part('month') - 1, part('day'), 12);
  const earliest = new Date(today); earliest.setDate(earliest.getDate() + 1);
  while ([5, 6].includes(earliest.getDay())) earliest.setDate(earliest.getDate() + 1);
  let selectedDate = new Date(earliest);
  let month = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
  let duration = 30;
  const minimumMonth = earliest.getFullYear() * 12 + earliest.getMonth();
  const maximumMonth = minimumMonth + 12;
  const monthIndex = () => month.getFullYear() * 12 + month.getMonth();
  const validDate = date => date > today && ![5, 6].includes(date.getDay());
  const dateLabel = date => date.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
  function renderCalendar() {
    $('#month-label').textContent = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    $('#previous-month').disabled = monthIndex() <= minimumMonth;
    $('#next-month').disabled = monthIndex() >= maximumMonth;
    $('#selected-date').textContent = selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const grid = $('#date-grid'); grid.replaceChildren();
    const offset = (month.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) { const blank = document.createElement('span'); blank.className = 'empty-day'; blank.setAttribute('aria-hidden', 'true'); grid.append(blank); }
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
      const button = document.createElement('button');
      button.textContent = day; button.type = 'button'; button.disabled = !validDate(date);
      button.setAttribute('aria-label', dateLabel(date));
      button.setAttribute('aria-pressed', String(date.getTime() === selectedDate.getTime()));
      button.addEventListener('click', () => { selectedDate = date; renderCalendar(); renderTimes(); $('#date-grid button[aria-pressed="true"]').focus({preventScroll:true}); });
      grid.append(button);
    }
  }
  function renderTimes() {
    selectedStart = null;
    $('#save-meeting').disabled = true;
    const slots = $('#time-slots'); slots.replaceChildren();
    $('#slot-summary').textContent = 'Select a time. Saved meetings block overlapping times on this device.';
    if (!duration) { $('#slot-summary').textContent = 'Enter a duration from 1 to 480 minutes.'; return; }
    // Demonstration work day: 09:00-17:00, with a busy interval at 12:00-13:00.
    const candidates = [540, 570, 630, 660, 780, 810, 840, 900, 960];
    const available = candidates.filter(start => start + duration <= 1020 && !(start < 780 && start + duration > 720) && !conflicts(start, duration));
    if (!available.length) { $('#slot-summary').textContent = 'No times fit this duration. Try a shorter meeting or another date.'; return; }
    const timeText = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    available.forEach(start => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = timeText(start);
      button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', `${timeText(start)}, ${duration} minutes`);
      button.addEventListener('click', () => {
        slots.querySelectorAll('button').forEach(slot => slot.setAttribute('aria-pressed', String(slot === button)));
        selectedStart = start;
        $('#save-meeting').disabled = false;
        $('#save-status').textContent = '';
        $('#slot-summary').textContent = `${dateLabel(selectedDate)}, ${timeText(start)} - ${timeText(start + duration)} Israel Time. ${duration} min.`;
      }); slots.append(button);
    });
  }
  function changeMonth(delta) {
    if (monthIndex() + delta < minimumMonth || monthIndex() + delta > maximumMonth) return;
    month = new Date(month.getFullYear(), month.getMonth() + delta, 1, 12);
    selectedDate = new Date(month);
    while (!validDate(selectedDate)) selectedDate.setDate(selectedDate.getDate() + 1);
    renderCalendar(); renderTimes();
  }
  $('#previous-month').addEventListener('click', () => changeMonth(-1));
  $('#next-month').addEventListener('click', () => changeMonth(1));
  function updateDuration() {
    const custom = $('#duration').value === 'custom';
    $('#custom-duration-wrap').hidden = !custom;
    const value = Number(custom ? $('#custom-duration').value : $('#duration').value);
    duration = Number.isInteger(value) && value >= 1 && value <= 480 ? value : null;
    $('#custom-duration').setAttribute('aria-invalid', String(custom && !duration));
    $('#duration-error').textContent = custom && !duration ? 'Choose a whole number from 1 to 480.' : '';
    renderTimes();
  }
  $('#duration').addEventListener('change', updateDuration);
  $('#custom-duration').addEventListener('input', updateDuration);
  $('#save-meeting').addEventListener('click', () => {
    if (selectedStart === null || !duration) return;
    const title = $('#meeting-title').value.trim();
    if (!title) { $('#save-status').textContent = 'Add a meeting title.'; $('#meeting-title').focus(); return; }
    if (conflicts(selectedStart, duration)) { renderTimes(); $('#save-status').textContent = 'That time is no longer available.'; return; }
    const meeting = {id:crypto.randomUUID(),title,date:dateKey(selectedDate),start:selectedStart,duration};
    if (persist([...meetings, meeting])) { renderTimes(); renderMeetings(); $('#save-status').textContent = 'Saved on this device. No invitation sent.'; }
  });
  renderCalendar(); renderTimes(); renderMeetings();
  document.addEventListener('crown-auth-change', event => {
    const nextKey = event.detail.uid ? `crown-calendar-meetings-v1:${event.detail.uid}` : 'crown-calendar-meetings-v1';
    if (storageKey === nextKey) return;
    storageKey = nextKey;
    loadMeetings(); renderMeetings(); renderTimes();
    $('#meeting-title').value = 'Meeting';
    $('#save-status').textContent = '';
  });

})();
