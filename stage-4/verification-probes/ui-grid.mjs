// The search results region, driven through the three states it can be in, at 375 and 1280.
//
//   node verification/probes/s2/ui-grid.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report, SHORT_WINDOW, baseFixture, baseFixtureWithHours,
  bookedDay, oneTableTaken, seed } from './ui-lib.mjs';

// Presence, not visibility: a hidden container satisfies a visibility check and fails a presence
// check, and only a driven check finds the difference.
const present = (handle, sel) => handle.evaluate((s) => !!document.querySelector(s), sel);

const vis = (handle, sel) => handle.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return 'absent';
  return el.offsetParent !== null && getComputedStyle(el).display !== 'none' ? 'visible' : 'hidden';
}, sel);

const text = (handle, sel) => handle.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
}, sel);

async function search(page, { date, party }) {
  await page.fill('#date-input', date);
  await page.fill('#party-size-input', String(party));
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch();

  // A fully-booked day: every table committed at every slot.
  await seed({ ...baseFixture(), reservations: ['t_1', 't_2', 't_3', 't_4'].flatMap(bookedDay) });

  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    section(`empty state at ${width}`);
    ok('results region visible on load', await vis(page, '[data-testid="availability-grid"]') === 'visible');
    ok('results region in the document on load',
      await present(page, '[data-testid="availability-grid"]'));
    ok('no booking form in the document before a table is chosen',
      await present(page, '[data-testid="booking-form"]') === false);
    ok('no confirmation in the document before anything is booked',
      await present(page, '[data-testid="confirmation"]') === false);
    ok('no-slots absent before any search', await vis(page, '[data-testid="no-slots"]') === 'absent');
    const emptyText = await text(page, '[data-testid="grid-empty"]');
    ok('empty state says what to do', typeof emptyText === 'string' && emptyText.length > 20
      && /choose/i.test(emptyText), emptyText);

    section(`loading state at ${width}`);
    await page.route('**/availability?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      route.continue();
    });
    await page.click('[data-testid="search-button"]');
    await page.waitForTimeout(250);
    ok('results region stays visible while loading',
      await vis(page, '[data-testid="availability-grid"]') === 'visible');
    ok('loading message visible in flight',
      await vis(page, '[data-testid="grid-loading"]') === 'visible');
    ok('no-slots absent while loading', await vis(page, '[data-testid="no-slots"]') === 'absent');
    await page.waitForTimeout(1600);
    await page.unroute('**/availability?*');

    section(`fully-booked day at ${width}`);
    await search(page, { date: '2026-12-01', party: 2 });
    const cells = await page.evaluate(() => [...document.querySelectorAll('[data-available]')]
      .map((c) => [c.getAttribute('data-testid'), c.getAttribute('data-available')]));
    ok('cells rendered', cells.length > 0, { cells: cells.length });
    ok('every cell unavailable', cells.every((c) => c[1] === 'false'),
      cells.filter((c) => c[1] !== 'false').slice(0, 4));
    ok('grid still visible', await vis(page, '[data-testid="availability-grid"]') === 'visible');
    ok('grid in the document on a fully-booked day',
      await present(page, '[data-testid="availability-grid"]'));
    ok('no-slots absent when a full day returns slots',
      await vis(page, '[data-testid="no-slots"]') === 'absent');
    ok('no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth)
      <= width, await page.evaluate(() => document.documentElement.scrollWidth));

    section(`an unavailable cell is inert at ${width}`);
    const cell = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="slot-t_1-17:00"]');
      if (!el) return null;
      el.click();
      return { available: el.getAttribute('data-available'), disabled: el.disabled };
    });
    ok('a cell the service says is taken is disabled', cell && cell.available === 'false'
      && cell.disabled === true, cell);
    await page.waitForTimeout(300);
    ok('clicking it opens no booking form',
      await present(page, '[data-testid="booking-form"]') === false);
    ok('clicking it leaves the grid alone',
      await vis(page, '[data-testid="availability-grid"]') === 'visible');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/grid-booked-${width}.png`, fullPage: true });

    section(`day with no slots at ${width}`);
    await search(page, { date: '2026-12-06', party: 2 });
    ok('the results region is out of the document, not merely hidden',
      await present(page, '[data-testid="availability-grid"]') === false);
    ok('no-slots visible when the day has no slots',
      await vis(page, '[data-testid="no-slots"]') === 'visible');
    ok('no-slots does not sit beside the grid',
      await vis(page, '[data-testid="availability-grid"]') !== 'visible');
    ok('no-slots explains the next step',
      /another date|smaller party/i.test(await text(page, '[data-testid="no-slots"]') || ''),
      await text(page, '[data-testid="no-slots"]'));
    // Read what the service says about this day before asserting what the screen says about it.
    // The wording is only right because the day is shut; if the fixture stopped making it shut, the
    // row would go red on the day's own answer rather than pass on a word.
    const said = await page.evaluate(async () => {
      const r = await fetch('/availability?restaurant_id=r_anker&date=2026-12-06'
        + '&party_size=2&explain=true');
      const body = await r.json();
      return Object.prototype.hasOwnProperty.call(body, 'day_state') ? body.day_state : null;
    });
    ok('the service reports this day as shut', said === 'shut', { said });
    ok('no-slots says the restaurant is closed, not that no tables are free',
      said === 'shut' && /closed/i.test(await text(page, '[data-testid="no-slots"]') || ''),
      { said, text: await text(page, '[data-testid="no-slots"]') });
    ok('the closed day is named as a person reads it',
      /Sunday/.test(await text(page, '[data-testid="no-slots"]') || ''),
      await text(page, '[data-testid="no-slots"]'));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/grid-noslots-${width}.png`, fullPage: true });

    await page.close();
  }

  // A closed day the other way: the restaurant lists hours on that weekday, but the window is
  // shorter than a booking, so there is no slot to offer. Asserted on its own, both halves.
  await seed(baseFixtureWithHours(SHORT_WINDOW));
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(6000);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    section(`closed by a window shorter than a booking at ${width}`);
    await search(page, { date: '2026-12-01', party: 2 });
    // Read the answer before trusting the screen's reading of it: assert the shape of what you read.
    const slots = await page.evaluate(async () => {
      const r = await fetch('/availability?restaurant_id=r_anker&date=2026-12-01&party_size=2');
      const body = await r.json();
      return Array.isArray(body.slots) ? body.slots.length : null;
    });
    ok('the service reports a day with no slots at all', slots === 0, { slots });
    ok('the results region is out of the document',
      await present(page, '[data-testid="availability-grid"]') === false);
    ok('no-slots visible', await vis(page, '[data-testid="no-slots"]') === 'visible');
    // The service reports this day as terms excluding every slot, not as shut: it lists hours, and
    // the window is simply shorter than a booking. So the screen must not call the restaurant
    // closed -- that is a claim about the restaurant, and it would be false.
    ok('the sentence does not claim the day is shut when the service did not say so',
      !/closed|shut|not open|not serving/i.test(await text(page, '[data-testid="no-slots"]') || ''),
      await text(page, '[data-testid="no-slots"]'));
    ok('the day is named as a person reads it',
      /Tuesday/.test(await text(page, '[data-testid="no-slots"]') || ''),
      await text(page, '[data-testid="no-slots"]'));
    ok('no booking form exists on a day with nothing to book',
      await present(page, '[data-testid="booking-form"]') === false);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/grid-shortwindow-${width}.png`, fullPage: true });
    await page.close();
  }

  // Every cell, checked against the service's own answer for that slot and party. A stage-4 policy
  // can change what is free, and this is where that shows: a cell that disagrees with the service
  // about the same slot is a diner shown a table the kitchen has given away.
  await seed({ ...baseFixture(), reservations: oneTableTaken('t_1') });
  for (const party of [2, 6]) {
    section(`every cell agrees with the service at party ${party}`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(6000);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.fill('#date-input', '2026-12-01');
    await page.fill('#party-size-input', String(party));
    await page.click('[data-testid="search-button"]');
    await page.waitForTimeout(700);

    const answer = await page.evaluate(async (n) => {
      const r = await fetch(`/availability?restaurant_id=r_anker&date=2026-12-01&party_size=${n}`);
      const body = await r.json();
      const out = {};
      for (const slot of body.slots || []) {
        out[slot.starts_at_local.slice(11, 16)] = {
          tables: slot.available_table_ids,
          pairs: (slot.available_options || []).map((o) => o.table_ids.join('+')),
        };
      }
      return out;
    }, party);
    ok('the service answered with a slot list to compare against', Object.keys(answer).length > 0,
      { slots: Object.keys(answer).length });

    const painted = await page.evaluate(() => [...document.querySelectorAll('[data-available]')]
      .map((c) => {
        const id = c.getAttribute('data-testid') || '';
        const time = id.slice(id.lastIndexOf('-') + 1);
        const ids = id.slice('slot-'.length, id.lastIndexOf('-')).split('+');
        return { ids, time, available: c.getAttribute('data-available') === 'true' };
      }));

    const disagreements = [];
    let freeSeen = 0;
    for (const cell of painted) {
      const slot = answer[cell.time];
      if (!slot) { disagreements.push({ cell: cell.ids, time: cell.time, why: 'slot not in the answer' }); continue; }
      const said = cell.ids.length > 1
        ? slot.pairs.indexOf(cell.ids.join('+')) !== -1
        : slot.tables.indexOf(cell.ids[0]) !== -1;
      if (said !== cell.available) {
        disagreements.push({ cell: cell.ids, time: cell.time, painted: cell.available, service: said });
      }
      if (cell.available) freeSeen += 1;
    }
    ok(`every cell matches the service's answer at party ${party}`, disagreements.length === 0,
      disagreements.slice(0, 4));
    if (party === 2) {
      ok('some cells are free, so the comparison is not vacuous', freeSeen > 0, { freeSeen });
    } else {
      // Only one table seats six, so every free cell must be that table and nothing else: the
      // comparison at this party is about not offering a table the kitchen cannot seat.
      const wrongSeat = painted.filter((c) => c.available && c.ids.join('+') !== 't_4').map((c) => c.ids);
      ok('at a party of six only the table that seats six is offered', wrongSeat.length === 0,
        { wrongSeat });
    }
    await page.close();
  }

  // Stage 3 adds explanations and policies to the service. The screens read the stage-1 shape, so
  // what the grid depends on is asserted here rather than assumed: the fields it reads are present,
  // and the ones stage 3 adds are absent unless asked for. If a response starts carrying them
  // unasked, a screen that grows to depend on them would still look correct here.
  section('the screens only depend on the shape they were written against');
  await seed(baseFixture());
  const plain = await page_fetch('restaurant_id=r_anker&date=2026-12-01&party_size=2');
  ok('the availability response still carries slots', Array.isArray(plain.body.slots), Object.keys(plain.body));
  const firstSlot = (plain.body.slots || [])[0] || {};
  ok('a slot still carries the list the grid paints from',
    Array.isArray(firstSlot.available_table_ids));
  ok('a slot still carries the pairs the grid builds its paired rows from',
    Array.isArray(firstSlot.available_options));
  ok('no explanation fields appear unless they were asked for',
    !('explain' in plain.body) && !(plain.body.slots || []).some((s) => 'explain' in s),
    Object.keys(firstSlot));
  const asked = await page_fetch('restaurant_id=r_anker&date=2026-12-01&party_size=2&explain=true');
  const askedFirst = (asked.body.slots || [])[0] || {};
  ok('asking for explanations does not change the list the grid paints from',
    JSON.stringify(askedFirst.available_table_ids) === JSON.stringify(firstSlot.available_table_ids),
    { asked: askedFirst.available_table_ids, plain: firstSlot.available_table_ids });

  await browser.close();
}

// A request made the way the screen makes it: same origin, same shape, no explanation parameter.
async function page_fetch(query) {
  const response = await fetch(BASE + '/availability?' + query);
  const body = await response.json().catch(() => null);
  return { status: response.status, body: body || {} };
}

main().then(() => {
  report();
}).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});
