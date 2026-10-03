'use strict';
// Shared helpers for stage-1 probes. No dependencies: node:http only.
// Every probe prints `ROW <id> PASS|FAIL <evidence>` and exits non-zero on any failure.

const http = require('node:http');

function base() {
  return process.env.TK_BASE || 'http://127.0.0.1:8099';
}

function u(path) {
  return new URL(path, base());
}

// One request. Never throws on a non-2xx: returns the observed status, body and headers.
function req(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = u(path);
    const h = Object.assign({}, headers);
    if (body !== null && !h['content-type']) h['content-type'] = 'application/json';
    const r = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        method,
        path: url.pathname + url.search,
        headers: h,
        agent: false,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
      }
    );
    r.on('error', reject);
    if (body !== null) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

function json(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

function code(res) {
  const j = json(res);
  return j && j.error ? j.error.code : null;
}

function short(s, n = 220) {
  const t = String(s);
  return t.length > n ? t.slice(0, n) + '…' : t;
}

// ---- result collection -------------------------------------------------

const results = [];

function pass(id, evidence) {
  results.push({ id, ok: true, evidence });
  console.log(`ROW ${id} PASS ${evidence}`);
}

function fail(id, evidence) {
  results.push({ id, ok: false, evidence });
  console.log(`ROW ${id} FAIL ${evidence}`);
}

// Assert a full condition. `evidence` must quote what was actually observed.
function check(id, ok, evidence) {
  if (ok) pass(id, evidence);
  else fail(id, evidence);
  return ok;
}

function finish() {
  const bad = results.filter((r) => !r.ok);
  console.log(`SUMMARY ${results.length - bad.length}/${results.length} passed`);
  if (bad.length) {
    console.log(`FAILED ${bad.map((r) => r.id).join(' ')}`);
    process.exit(1);
  }
  process.exit(0);
}

// ---- fixtures ----------------------------------------------------------

const ANKER = {
  users: [{ id: 'u_ada', email: 'ada@example.com', password: 'correct horse', display_name: 'Ada' }],
  restaurants: [
    {
      id: 'r_anker',
      name: 'Zum Anker',
      timezone: 'Europe/Berlin',
      slot_minutes: 30,
      reservation_duration_minutes: 90,
      cancellation_cutoff_minutes: 120,
      opening_hours: [
        { weekday: 'thu', opens: '18:00', closes: '23:00' },
        { weekday: 'fri', opens: '18:00', closes: '23:30' },
      ],
      tables: [
        { id: 't_1', label: '1', capacity: 2 },
        { id: 't_2', label: '2', capacity: 4 },
      ],
    },
  ],
  reservations: [],
};

// Every weekday open all day: DST probes must not be refused for a closed day, which
// reads like an occupancy or DST defect when it is really the fixture.
function allWeek(overrides = {}) {
  const f = JSON.parse(JSON.stringify(ANKER));
  Object.assign(f.restaurants[0], overrides);
  f.restaurants[0].opening_hours = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((w) => ({
    weekday: w,
    opens: '00:00',
    closes: '23:30',
  }));
  return f;
}

async function reset(fixture) {
  const r = await req('POST', '/_test/reset', {}, fixture);
  if (r.status !== 204) throw new Error(`reset failed: ${r.status} ${short(r.body)}`);
}

async function login(email = 'ada@example.com', password = 'correct horse') {
  const r = await req('POST', '/auth/login', {}, { email, password });
  if (r.status !== 200) throw new Error(`login failed: ${r.status} ${short(r.body)}`);
  return json(r).token;
}

function auth(token) {
  return { authorization: `Bearer ${token}` };
}

function book(token, key, body) {
  return req('POST', '/reservations', Object.assign(auth(token), { 'idempotency-key': key }), body);
}

// Anything that CANCELS or AMENDS needs a start far enough in the future that
// cancellation_cutoff_minutes cannot have elapsed. The clock in this environment reads
// 2026-10-03, so the sample date 2026-09-24 is in the past and a cancel on it is correctly
// refused with cutoff_passed. Reading that refusal as a product defect is the single most
// common way a stage-1 probe fails for the wrong reason, so it is named here once.
const FUTURE = '2026-12-01'; // a Tuesday; allWeek opens every weekday

// A confirmation reference, valid start, party size that fits t_2 (capacity 4).
function booking(startsAtLocal = '2026-09-24T19:00', over = {}) {
  return Object.assign(
    { restaurant_id: 'r_anker', table_id: 't_2', starts_at_local: startsAtLocal, party_size: 4 },
    over
  );
}

// N genuinely parallel requests. Sequential replays cannot see a race, so every
// concurrency probe uses this and never a loop of awaits.
function parallel(n, makeRequest) {
  const jobs = [];
  // The index must be passed through. An earlier version queued `makeRequest` itself, so the
  // callback received `undefined` as its index and every indexed sweep built a body containing
  // `NaN` — which the service correctly refused with 422, and which a status-count row then
  // reported as a clean sweep of fifty bookings.
  for (let i = 0; i < n; i += 1) jobs.push(Promise.resolve().then(() => makeRequest(i)));
  return Promise.all(jobs);
}

  multiZone,
  zonedBooking,
  instantOf,
module.exports = {
  FUTURE,
  req,
  json,
  code,
  short,
  pass,
  fail,
  check,
  finish,
  reset,
  login,
  auth,
  book,
  booking,
  parallel,
  ANKER,
  allWeek,
  multiZone,
  zonedBooking,
  instantOf,
};
// ---- multi-timezone fixture ------------------------------------------------
//
// Every earlier stage-1 probe ran against ONE restaurant in ONE timezone, and that
// single timezone masks two whole classes of defect:
//
//   * a comparison made on wall-clock values rather than on absolute instants, because
//     with one zone the local date and the UTC date agree for every booking the probes
//     make, so a resolver that gets the date wrong still returns the right answer;
//   * an ordering made on local time strings, because with one zone local order and
//     absolute order are the same order.
//
// Three zones so that both are exposed: Berlin (UTC+1/+2, DST), New York (UTC-5/-4,
// DST) and Tokyo (UTC+9, **no DST**, so a resolver that assumes every zone observes
// daylight saving is wrong here in a way no single-zone fixture can show).
// `localDateDiffersFromUTC` is true for the Tokyo bookings below: 09:00 in Tokyo on
// 2026-06-02 is 00:00 UTC on the same date, while 08:00 in Tokyo is 23:00 UTC on
// 2026-06-01 — the previous UTC date.
function multiZone() {
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  // Open to 23:59, not 23:30: a 90-minute booking starting at 23:00 would otherwise be refused for
  // closing time, and a refusal for the wrong reason reads like an occupancy defect. The first
  // version of the occupancy probe lost three rows to exactly that.
  const openAllDay = days.map((w) => ({ weekday: w, opens: '00:00', closes: '23:59' }));
  const tables = [
    { id: 't_1', label: '1', capacity: 4 },
    { id: 't_2', label: '2', capacity: 4 },
  ];
  return {
    users: [{ id: 'u_ada', email: 'ada@example.com', password: 'correct horse', display_name: 'Ada' }],
    restaurants: [
      { id: 'r_berlin', name: 'Zum Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
        reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120,
        opening_hours: openAllDay, tables },
      { id: 'r_newyork', name: 'The Anchor', timezone: 'America/New_York', slot_minutes: 30,
        reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120,
        opening_hours: openAllDay, tables },
      { id: 'r_tokyo', name: 'Anker Tokyo', timezone: 'Asia/Tokyo', slot_minutes: 30,
        reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120,
        opening_hours: openAllDay, tables },
    ],
    reservations: [],
  };
}

// A booking body for one of the three zones. `starts_at_local` is always a LOCAL wall
// clock, which is the only kind the API accepts.
function zonedBooking(restaurantId, tableId, startsAtLocal, partySize = 2) {
  return { restaurant_id: restaurantId, table_id: tableId, starts_at_local: startsAtLocal, party_size: partySize };
}

// The absolute instant a local wall clock denotes, computed here from the IANA database
// rather than from the service, so a probe never reads the answer out of the thing it is
// testing. Returns null for a local time the zone skips.
function instantOf(timeZone, isoLocal) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(isoLocal);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (ms) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));
    const out = {};
    for (const part of parts) if (part.type !== 'literal') out[part.type] = Number(part.value);
    return Date.UTC(out.year, out.month - 1, out.day, out.hour, out.minute, out.second) - ms;
  };
  const first = naive - offsetAt(naive);
  const second = naive - offsetAt(naive - 24 * 3600000);
  const third = naive - offsetAt(naive + 24 * 3600000);
  const cands = [...new Set([first, second, third])].filter((ms) => {
    const back = new Date(ms);
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(back);
    const o = {};
    for (const part of p) if (part.type !== 'literal') o[part.type] = Number(part.value);
    return o.year === y && o.month === mo && o.day === d && o.hour === h && o.minute === mi;
  });
  // Two candidates means an ambiguous fall-back local time; the first occurrence is the one
  // the specification requires.
  cands.sort((a, b) => a - b);
  return cands.length ? cands[0] : null;
}
