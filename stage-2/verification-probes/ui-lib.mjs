// Browser suite for the surfaces a person sees, run against a built container.
//
//   node --experimental-default-type=commonjs verification/probes/s2/ui-states.mjs [baseUrl]
//
// Requires playwright-core and a running service on BASE (default http://localhost:18099).
// Playwright is installed outside the repository: nothing here is a runtime dependency of the
// product, and the image stays dependency-free.
//
// Every row here is an observable a person can see, not a description of a change. Where a row
// covers a state, both halves are asserted: the state that applies and the state that must not.
import { chromium } from 'playwright-core';

export const BASE = process.argv[2] || 'http://localhost:18099';
export const SHOTS = process.env.SHOTS || '';

let failures = 0;
let passes = 0;


export function ok(name, condition, detail) {
  if (condition) {
    passes += 1;
    console.log(`  pass  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail === undefined ? '' : ' -- ' + JSON.stringify(detail)}`);
  }
}

export function section(title) {
  console.log(`\n${title}`);
}

export async function req(path, body) {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: r.status, body: parsed, raw: text };
}

const HOURS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  // Sunday is deliberately absent: a weekday with no opening hours is the day with no slots.
  .map((weekday) => ({ weekday, opens: '17:00', closes: '23:00' }));

// A closed day reached the second way: the weekday exists, but its opening window is shorter than
// a booking can be, so the service has no slot to offer. That is a different path through the code
// from a weekday with no hours at all, and it is covered separately for that reason.
export const SHORT_WINDOW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  .map((weekday) => ({ weekday, opens: '18:00', closes: '18:30' }));

export function baseFixtureWithHours(openingHours) {
  const fixture = baseFixture();
  fixture.restaurants[0].opening_hours = openingHours;
  return fixture;
}

export function baseFixture() {
  return {
    users: [{ id: 'u_ada', email: 'ada@example.com', password: 'correct horse', display_name: 'Ada' }],
    restaurants: [{
      id: 'r_anker', name: 'Zum Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
      reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120,
      opening_hours: HOURS,
      tables: [
        { id: 't_1', label: '1', capacity: 2 },
        { id: 't_2', label: '2', capacity: 4 },
        { id: 't_3', label: '3', capacity: 2 },
        { id: 't_4', label: '4', capacity: 6 },
      ],
    }],
    reservations: [],
  };
}

// A day tiled with legal single-table reservations: every table is committed at every slot, which
// is a fully-booked day without any illegal three-table booking.
// One table committed across the evening, so a day has both free and taken cells at once.
export function oneTableTaken(tableId) {
  return ['17:00', '18:00', '19:00'].map((time) => ({
    restaurant_id: 'r_anker', table_id: tableId, user_id: 'u_ada',
    starts_at_local: `2026-12-01T${time}`, party_size: 1,
  }));
}

export function bookedDay(tableId) {
  return ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']
    .map((time) => ({
      restaurant_id: 'r_anker', table_id: tableId, user_id: 'u_ada',
      starts_at_local: `2026-12-01T${time}`, party_size: 1,
    }));
}

export async function seed(fixture) {
  const reset = await req('/_test/reset', fixture);
  // A setup step that can fail must be asserted to have succeeded before its result is read: a
  // rejected reset leaves the previous store in place, and every reading after it would be stale.
  ok('seed: reset accepted', reset.status === 204 || reset.status === 200,
    { status: reset.status, body: reset.raw.slice(0, 160) });
  return reset;
}

export async function token() {
  const login = await req('/auth/login', { email: 'ada@example.com', password: 'correct horse' });
  ok('seed: login issued a token', login.status === 200 && Boolean(login.body && login.body.token),
    { status: login.status });
  return login.body.token;
}

export function report() {
  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures) process.exitCode = 1;
}
