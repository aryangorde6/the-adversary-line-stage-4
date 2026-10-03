// What a screen is allowed to say about a day, and what it must never say.
//
//   node ui-day-state.mjs [baseUrl]
//
// Written before the service grows the field this row reads, on purpose: the order has produced
// every real defect in this project and has never produced a false one.
//
// The service answers, at the day level, which of four states a date is in -- shut, terms exclude
// everything, nothing free, open. A screen may state a day as closed only on `shut`. Everywhere
// else its obligation is to say less, not more, and this suite drives the screen against each
// state with the service's own answer stubbed in, so the screen's behaviour is checked against the
// answers it will actually receive rather than against a guess about them.
//
// Two things this deliberately does not assert. It does not assert that some other sentence is
// rendered instead: a screen that says nothing at all is correct here, and a screen that says
// something *different and also wrong* would pass such a row. And it does not assert the service's
// discriminator -- that is an API-layer row, driven from another seat. What it asserts is the one
// thing only a person can see.
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report, baseFixture, seed } from './ui-lib.mjs';

const SHUT_DAY = '2026-12-06';   // a Sunday, absent from the timetable
const OPEN_DAY = '2026-12-01';   // a Tuesday, open

// The four day states, in the shape the service is required to report them.
function answer(dayState, slots) {
  return JSON.stringify({
    restaurant_id: 'r_anker',
    date: slots.length ? OPEN_DAY : SHUT_DAY,
    timezone: 'Europe/Berlin',
    day_state: dayState,
    slots,
  });
}

function slot(time, ids) {
  return {
    starts_at_local: `2026-12-01T${time}`,
    starts_at: `2026-12-01T${time}:00+01:00`,
    available_table_ids: ids,
    available_options: ids.map((id) => ({ table_ids: [id], capacity: 2 })),
  };
}

// One rendered slot, and one rendered day with nothing in it at all.
const WITH_SLOTS = answer('nothing_free', [slot('17:00', []), slot('17:30', []), slot('18:00', [])]);
const NO_SLOTS_SHUT = answer('shut', []);
const NO_SLOTS_TERMS = answer('terms_exclude_all', []);

// Anything a person would read as "the restaurant is not serving that day".
const CLOSED_SHAPED = /closed|shut|not open|not serving|we are closed|is closed/i;

async function drive(page, { body, date }) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.route('**/availability?*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body,
  }));
  await page.fill('#date-input', date);
  await page.fill('#party-size-input', '2');
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(700);
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
      empty: grab('[data-testid="grid-empty"]'),
      table: grab('[data-testid="availability-grid"] table'),
      cells: document.querySelectorAll('[data-available]').length,
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

  // The screens read the restaurant's tables from the service, so a real fixture has to exist; only
  // the availability answer is stubbed, because the day state under test is what is being varied.
  await seed(baseFixture());

  section('a day the service says is shut');
  const shut = await drive(page, { body: NO_SLOTS_SHUT, date: SHUT_DAY });
  ok('the shut day does say the restaurant is closed that day',
    CLOSED_SHAPED.test(shut.noSlots.text) || CLOSED_SHAPED.test(shut.visibleText.join(' ')),
    { noSlots: shut.noSlots.text });
  ok('the shut day has no times to show', shut.noSlots.visible, shut.noSlots);

  section('a day the service says the terms exclude everything');
  const terms = await drive(page, { body: NO_SLOTS_TERMS, date: SHUT_DAY });
  const termsWords = terms.visibleText.join(' ');
  ok('no closed-day claim is rendered for a day that is not shut',
    !CLOSED_SHAPED.test(termsWords), { said: termsWords.slice(0, 200) });
  ok('the screen did not present an empty day as a closure',
    !CLOSED_SHAPED.test(terms.noSlots.text), { noSlots: terms.noSlots.text });
  ok('what a person reads on that day is distinguishable from the shut day',
    termsWords !== shut.visibleText.join(' '), { terms: termsWords.slice(0, 120) });

  section('a day with slots and nothing free');
  const booked = await drive(page, { body: WITH_SLOTS, date: OPEN_DAY });
  ok('the times the service returned are the times on screen',
    booked.cells === 3 * 4, { cells: booked.cells });
  ok('nothing free is stated as nothing free, not as closure',
    !CLOSED_SHAPED.test(booked.visibleText.join(' ')),
    { said: booked.visibleText.join(' ').slice(0, 200) });
  ok('every cell on that day reads as unavailable',
    await page.evaluate(() => [...document.querySelectorAll('[data-available]')]
      .every((c) => c.getAttribute('data-available') === 'false')));
  ok('the slot list is what the service returned, not a filtered version of it',
    await page.evaluate(() => document.querySelectorAll('[data-testid="availability-grid"] thead th').length) === 4,
    await page.evaluate(() => document.querySelectorAll('[data-testid="availability-grid"] thead th').length));

  ok('no page errors', errors.length === 0, errors.slice(0, 3));

  if (SHOTS) {
    await drive(page, { body: NO_SLOTS_SHUT, date: SHUT_DAY });
    await page.screenshot({ path: `${SHOTS}/daystate-shut.png`, fullPage: true });
    await drive(page, { body: NO_SLOTS_TERMS, date: SHUT_DAY });
    await page.screenshot({ path: `${SHOTS}/daystate-terms.png`, fullPage: true });
  }

  await page.close();
  await browser.close();
}

main().then(() => { report(); }).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});