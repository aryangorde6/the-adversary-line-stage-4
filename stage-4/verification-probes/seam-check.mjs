// The seam the Foreman named: the grid a person reads and the service's own explanation for the
// same slot. This is the seam row of 0.4, re-driven against the stage-4 build: stage 4 changes
// availability underneath the grid, so the two answers are compared in the state where they drift.
import { chromium } from 'playwright-core';
import { BASE, call as baseCall } from './stage4-base.mjs';
let pass = 0, fail = 0;
const row = async (name, fn) => {
  try { await fn(); pass += 1; console.log('ok   ' + name); }
  catch (e) { fail += 1; console.log('FAIL ' + name + ': ' + (e && e.message ? e.message : e)); }
};
// The base URL, the timeout and the precheck come from stage4-base.mjs; this suite keeps its own call
// signature so the rows below read the way they did.
const call = (method, path, opts = {}) => baseCall(method, path, opts);
const OH = [{ weekday: 'thu', opens: '18:00', closes: '23:00' }];
const fx = () => ({ users: [{ id: 'u_ada', email: 'ada@example.com', password: 'correct horse', display_name: 'Ada' }],
  restaurants: [{ id: 'r_anker', name: 'Zum Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
    reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120, manager_user_ids: ['u_ada'],
    opening_hours: OH, tables: [{ id: 't_1', label: '1', capacity: 2 }, { id: 't_2', label: '2', capacity: 4 }],
    combinable: [['t_1', 't_2']] }], reservations: [] });
const policy = (o = {}) => ({ effective_from: '2026-01-01', slot_minutes: 30, reservation_duration_minutes: 90,
  cancellation_cutoff_minutes: 120, opening_hours: OH, capacities: { t_1: 2, t_2: 4 }, ...o });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// The two populations are compared as sets, in BOTH directions, and both counts are printed when they
// disagree. Comparing only cells -> explain leaves an explain entry with no rendered cell uncompared,
// so this suite could go green with a slot nobody explained on screen. That is the mirror of the
// pair-indexing bug this file already carries a comment about: that one dropped every pair cell from
// the map, this one would drop every unrendered cell from the assertion. A row that compares counts
// cannot see either, so the direction is stated here rather than left to look accidental.
function assertPopulationsMatch(dom, explained, label) {
  const rendered = new Set(dom.map((cell) => cell.id));
  const explainedIds = new Set(explained.keys());
  const unexplained = [...rendered].filter((id) => !explainedIds.has(id));
  const unrendered = [...explainedIds].filter((id) => !rendered.has(id));
  if (unexplained.length > 0 || unrendered.length > 0) {
    throw new Error(
      `populations differ (${label}): ${rendered.size} rendered cells, ${explainedIds.size} explained entries.`
      + ` cells with no explain entry: ${unexplained.join(', ') || 'none'}`
      + ` | explain entries with no rendered cell: ${unrendered.join(', ') || 'none'}`,
    );
  }
  console.log(`     populations equal in both directions (${label}): ${rendered.size} cells, ${explainedIds.size} explain entries`);
}

// Read every cell's data-available and compare with explain for the same slot and table.
const cellsVs = async (date, party) => {
  await page.goto(BASE + '/');
  await page.fill('[data-testid="date-input"]', date);
  await page.fill('[data-testid="party-size-input"]', String(party));
  await page.click('[data-testid="search-button"]');
  await page.waitForSelector('[data-testid^="slot-"]', { timeout: 15000 });
  const dom = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="slot-"]')].map((c) => ({
    id: c.getAttribute('data-testid'),
    available: c.getAttribute('data-available') === 'true',
    disabled: c.disabled === true,
  })));
  const api = (await call('GET', `/availability?restaurant_id=r_anker&date=${date}&party_size=${party}&explain=true`)).body;
  const explained = new Map();
  for (const slot of api.slots) {
    const hhmm = slot.starts_at_local.slice(11);
    for (const e of slot.explain) {
      // A pair is explained as its own entry and the grid renders it as its own cell, so both key
      // shapes have to be indexed or the comparison silently skips every pair cell.
      if ('table_id' in e) explained.set(`slot-${e.table_id}-${hhmm}`, e.available);
      else if (Array.isArray(e.table_ids)) explained.set(`slot-${e.table_ids.join('+')}-${hhmm}`, e.available);
    }
  }
  return { dom, explained, slots: api.slots.length };
};

await row('SEAM the grid agrees with explain under policy 0', async () => {
  await call('POST', '/_test/reset', { body: fx() });
  const { dom, explained } = await cellsVs('2026-09-24', 3);
  if (dom.length === 0) throw new Error('no cells rendered');
  for (const cell of dom) {
    const want = explained.get(cell.id);
    if (want === undefined) throw new Error('no explain entry for ' + cell.id);
    if (want !== cell.available) throw new Error(`${cell.id}: grid says ${cell.available}, explain says ${want}`);
    if (cell.disabled === cell.available) throw new Error(`${cell.id}: disabled ${cell.disabled} but available ${cell.available}`);
  }
  assertPopulationsMatch(dom, explained, 'policy 0');
});

await row('SEAM the grid follows a policy that flips a cell, and still agrees with explain', async () => {
  const t = (await call('POST', '/auth/login', { body: { email: 'ada@example.com', password: 'correct horse' } })).body.token;
  // Read BEFORE publishing, or the flip is invisible: both readings would be post-policy and the
  // comparison would agree with itself, which is the vacuous case clause 8 exists to catch.
  const before = await cellsVs('2026-09-24', 3);
  const availableBefore = [...before.explained.entries()].filter(([, v]) => v === true).map(([k]) => k);
  // t_2 shrinks 4 -> 1, so a party of 3 flips it from available to unavailable.
  const pub = await call('POST', '/restaurants/r_anker/policies', { body: policy({ capacities: { t_1: 2, t_2: 1 } }), token: t, key: 'seam1' });
  if (pub.status !== 201) throw new Error('policy not published: ' + pub.status);
  const after = await cellsVs('2026-09-24', 3);
  if (after.dom.length !== before.dom.length) throw new Error('the cell count changed under a policy');
  for (const cell of after.dom) {
    const want = after.explained.get(cell.id);
    if (want !== cell.available) throw new Error(`${cell.id}: grid says ${cell.available}, explain says ${want}`);
    if (cell.disabled === cell.available) throw new Error(`${cell.id}: disabled ${cell.disabled} but available ${cell.available}`);
  }
  // The flip must actually have happened, or the row proves nothing.
  const flipped = [...after.explained.entries()].filter(([k, v]) => availableBefore.includes(k) && v === false).map(([k]) => k);
  if (flipped.length === 0) throw new Error('no cell flipped, so the agreement above is vacuous');
  console.log('     cells that flipped under the policy: ' + flipped.join(', '));
  assertPopulationsMatch(after.dom, after.explained, 'after the policy');
});

await row('SEAM the detail endpoint still reports the fixture under a published policy', async () => {
  const detail = (await call('GET', '/restaurants/r_anker')).body;
  if (detail.slot_minutes !== 30) throw new Error('the detail reports ' + detail.slot_minutes);
  if (detail.tables.find((x) => x.id === 't_2').capacity !== 4) throw new Error('the detail table capacity moved');
});

await row('SEAM no page errors across the whole drive', async () => {
  if (errors.length > 0) throw new Error(errors.join(' | '));
});

console.log(`\n${pass}/${pass + fail} seam rows passed`);
if (fail > 0) process.exitCode = 1;
await browser.close();
