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
};