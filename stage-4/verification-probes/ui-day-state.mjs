// What a screen is allowed to say about a day, and what it must never say.
//
//   node ui-day-state.mjs [baseUrl]
//
// Written before the service grew the field this row reads, kept red until the field arrived, and
// now driven against the service's own answers rather than a stub: each of the four day states is
// produced by a real fixture, the field name is the service's, and if `day_state` is renamed or
// moved this row goes red and says so rather than passing against a shape it imagined.
//
// The service reports which of three things a day is -- shut, terms exclude everything, nothing
// free -- and a screen may state a day as closed only on `shut`. Everywhere else its obligation is
// to say less, not more.
//
// Two things this deliberately does not assert. It does not assert that some other sentence is
// rendered instead: a screen that says nothing at all is correct here, and a screen saying
// something *different and also wrong* would pass such a row. And it does not assert the service's
// discriminator -- that is an API-layer row driven from another seat. What it asserts is the one
// thing only a person can see.
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report, req } from './ui-lib.mjs';

const TABLES = [
  { id: 't_1', label: '1', capacity: 2 },
  { id: 't_2', label: '2', capacity: 4 },
  { id: 't_3', label: '3', capacity: 2 },
  { id: 't_4', label: '4', capacity: 6 },
];
const OPEN_HOURS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  .map((weekday) => ({ weekday, opens: '17:00', closes: '23:00' }));
// Sunday is absent from the timetable entirely: the day is shut.
const SHUT_HOURS = OPEN_HOURS;
// Sunday is listed, but the window is shorter than one reservation: the terms exclude every slot.
const NARROW_HOURS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  .map((weekday) => ({ weekday, opens: '18:00', closes: '18:30' }));

const SHUT_DAY = '2026-12-06';   // a Sunday with no hours
const OPEN_DAY = '2026-12-01';   // a Tuesday, open

function fixture(openingHours, reservations) {
  return {
    users: [{ id: 'u_ada', email: 'ada@example.com', password: 'correct horse', display_name: 'Ada' }],
    restaurants: [{
      id: 'r_anker', name: 'Zum Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
      reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120,
      opening_hours: openingHours, tables: TABLES,
    }],
    reservations: reservations || [],
  };
}

// Every table committed across the whole evening, so the day has times and nothing free anywhere.
function wholeDayBooked() {
  const times = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
  return TABLES.flatMap((t) => times.map((time) => ({
    restaurant_id: 'r_anker', table_id: t.id, user_id: 'u_ada',
    starts_at_local: `${OPEN_DAY}T${time}`, party_size: 1,
  })));
}

// Anything a person would read as "the restaurant is not serving that day".
const CLOSED_SHAPED = /closed|shut|not open|not serving/i;

async function drive(page, date) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.fill('#date-input', date);
  await page.fill('#party-size-input', '2');
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const grab = (sel) => {
      const el = document.querySelector(sel);
      return el ? { present: true, visible: el.offsetParent !== null,
        text: el.textContent.replace(/\s+/g, ' ').trim() } : { present: false, visible: false, text: '' };
    };
    const visibleText = [...document.querySelectorAll('body *')]
      .filter((el) => el.children.length === 0 && el.offsetParent !== null)
      .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return {
      grid: grab('[data-testid="availability-grid"]'),
      noSlots: grab('[data-testid="no-slots"]'),
      cells: document.querySelectorAll('[data-available]').length,
      freeCells: [...document.querySelectorAll('[data-available="true"]')].length,
      columns: document.querySelectorAll('[data-testid="availability-grid"] thead th').length - 1,
      allUnavailable: [...document.querySelectorAll('[data-available]')]
        .every((c) => c.getAttribute('data-available') === 'false'),
      visibleText,
    };
  });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Each state is produced by a real fixture and read back from the service before the screen is
  // driven, so a row cannot pass against a day state the service did not actually report.
  const states = {};

  section('the service reports each of the four day states');
  for (const [name, hours, reservations, date, expected] of [
    ['shut', SHUT_HOURS, [], SHUT_DAY, 'shut'],
    ['terms_exclude_all', NARROW_HOURS, [], SHUT_DAY, 'terms_exclude_all'],
    ['nothing_free', OPEN_HOURS, wholeDayBooked(), OPEN_DAY, 'nothing_free'],
    ['open', OPEN_HOURS, [], OPEN_DAY, 'open'],
  ]) {
    const reset = await req('/_test/reset', fixture(hours, reservations));
    // A setup step that can fail is asserted before its result is read: a rejected reset leaves the
    // previous store in place, and every reading after it would be stale.
    ok(`fixture for ${name} accepted`, reset.status === 204 || reset.status === 200,
      { status: reset.status, body: JSON.stringify(reset).slice(0, 140) });
    const login = await req('/auth/login', { email: 'ada@example.com', password: 'correct horse' });
    ok(`signed in for ${name}`, login.status === 200 && Boolean(login.body && login.body.token),
      { status: login.status });
    const auth = { Authorization: `Bearer ${login.body.token}` };
    const raw = await fetch(`${BASE}/availability?restaurant_id=r_anker&date=${date}`
      + `&party_size=2&explain=true`, { headers: auth });
    const body = await raw.json();
    // The shape is asserted before it is relied on: a missing key is not a value.
    ok(`${name}: the response carries a day state at the top level`,
      Object.prototype.hasOwnProperty.call(body, 'day_state'), { keys: Object.keys(body) });
    ok(`${name}: the service reports ${expected}`, body.day_state === expected, { got: body.day_state });
    states[name] = await drive(page, date);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/daystate-${name}.png`, fullPage: true });
  }

  section('a day the service reports as shut');
  ok('the screen says the restaurant is closed that day',
    CLOSED_SHAPED.test(states.shut.visibleText.join(' ')),
    { said: states.shut.visibleText.join(' ').slice(0, 160) });
  ok('the shut day has no times to show', states.shut.noSlots.visible, states.shut.noSlots);
  ok('and no grid of times', states.shut.cells === 0, { cells: states.shut.cells });

  section('a day the service reports the terms exclude everything');
  const termsWords = states.terms_exclude_all.visibleText.join(' ');
  ok('no closed-day claim is rendered for a day that is not shut',
    !CLOSED_SHAPED.test(termsWords), { said: termsWords.slice(0, 200) });
  ok('the message does not present an empty day as a closure',
    !CLOSED_SHAPED.test(states.terms_exclude_all.noSlots.text),
    { noSlots: states.terms_exclude_all.noSlots.text });
  ok('what a person reads is distinguishable from the shut day',
    termsWords !== states.shut.visibleText.join(' '),
    { terms: termsWords.slice(0, 120), shut: states.shut.visibleText.join(' ').slice(0, 120) });
  ok('and no times are invented for it', states.terms_exclude_all.cells === 0,
    { cells: states.terms_exclude_all.cells });

  section('a day with times and nothing free');
  ok('the times on screen are the times the service returned',
    states.nothing_free.columns === 10, { columns: states.nothing_free.columns });
  ok('every cell reads as unavailable', states.nothing_free.allUnavailable,
    { cells: states.nothing_free.cells });
  ok('nothing free is not stated as closure',
    !CLOSED_SHAPED.test(states.nothing_free.visibleText.join(' ')),
    { said: states.nothing_free.visibleText.join(' ').slice(0, 200) });

  section('an open day');
  ok('a free table is offered', states.open.freeCells > 0, { freeCells: states.open.freeCells });

  ok('no page errors', errors.length === 0, errors.slice(0, 3));

  await page.close();
  await browser.close();
}

main().then(() => { report(); }).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});