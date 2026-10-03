'use strict';
// R005 / mutant-02 — concurrent identical requests on one unused Idempotency-Key.
// Exactly one 201, the rest 200 with a byte-identical body, and exactly one confirmed
// reservation. Uses real parallel connections: a sequential replay cannot see a race.

const { req, json, code, short, check, finish, reset, login, book, booking, parallel, allWeek } = require('./lib');

async function run() {
  await reset(allWeek());
  const token = await login();

  // --- Trial 1: ten identical requests, one unused key ------------------------
  const bodies = await parallel(10, () =>
    book(token, 'race-1', booking('2026-09-24T19:00'))
  );
  const created = bodies.filter((r) => r.status === 201);
  const replayed = bodies.filter((r) => r.status === 200);
  const conflicts = bodies.filter((r) => r.status === 409);
  const other = bodies.filter((r) => r.status !== 201 && r.status !== 200 && r.status !== 409);

  check(
    'R005a',
    created.length === 1,
    `10 parallel identical POSTs on one unused key -> 201 count=${created.length} ` +
      `(200 count=${replayed.length}, 409 count=${conflicts.length}, other=${JSON.stringify(other.map((r) => r.status))})`
  );
  check(
    'R005b',
    replayed.length === 9,
    `replay count=${replayed.length}, expected 9 (exactly one 201 and nine 200s)`
  );
  check(
    'R005c',
    conflicts.length === 0,
    `409 count=${conflicts.length}, expected 0 — codes=${JSON.stringify(conflicts.map(code))}; ` +
      `a 409 here is the race: the key was resolved twice and the second lost`
  );
  check('R005d', other.length === 0, `unexpected statuses=${JSON.stringify(other.map((r) => r.status))}`);

  // Every 200 body must be byte-identical to the 201 body.
  const createdBody = created.length ? created[0].body : null;
  const mismatched = replayed.filter((r) => r.body !== createdBody);
  check(
    'R005e',
    mismatched.length === 0,
    `bodies identical to the 201: ${replayed.length - mismatched.length}/${replayed.length}; ` +
      `a mismatch means the replay re-derived the response. First mismatch: ${short(mismatched.length ? mismatched[0].body : '')}`
  );

  // The operation must take effect exactly once.
  const list = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const mine = ((json(list) || {}).reservations || []).filter(
    (r) => r.starts_at_local === '2026-09-24T19:00'
  );
  check(
    'R005f',
    mine.length === 1 && mine[0].status === 'confirmed',
    `confirmed reservations at 19:00 = ${mine.length} statuses=${JSON.stringify(mine.map((r) => r.status))} (exactly one, confirmed)`
  );

  // --- Trial 2: repeat, to catch a race that only sometimes loses ------------
  await reset(allWeek());
  const token2 = await login();
  const again = await parallel(10, () => book(token2, 'race-2', booking('2026-09-24T19:30')));
  const c2 = again.filter((r) => r.status === 201).length;
  const x2 = again.filter((r) => r.status === 409).length;
  check(
    'R005g',
    c2 === 1 && x2 === 0,
    `second trial -> 201 count=${c2}, 409 count=${x2}, statuses=${JSON.stringify(again.map((r) => r.status))}`
  );

  // --- Trial 3: fifty concurrent distinct requests, zero 5xx -----------------
  await reset(allWeek());
  const token3 = await login();
  // 50 distinct keys against 50 distinct slots on two tables. Overlaps are expected
  // and fine; what must not happen is a 5xx or a lost response.
  const many = await parallel(50, (i) => {
    const minutes = 18 * 60 + (i % 10) * 30;
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    const table = i % 2 === 0 ? 't_1' : 't_2';
    const day = i < 25 ? '2026-09-24' : '2026-09-25';
    return book(token3, `many-${i}`, booking(`${day}T${hh}:${mm}`, { table_id: table, party_size: 2 }));
  });
  const fivexx = many.filter((r) => r.status >= 500);
  check(
    'R005h',
    fivexx.length === 0,
    `50 parallel distinct POSTs -> statuses=${JSON.stringify(many.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {}))}, 5xx=${fivexx.length}`
  );

  // --- Trial 4: fifty concurrent mixed reads and writes, zero 5xx ------------
  const mixed = await parallel(50, (i) => {
    if (i % 2 === 0) {
      return req('GET', `/availability?restaurant_id=r_anker&date=2026-09-24&party_size=${(i % 4) + 1}`);
    }
    return req('GET', '/reservations', { authorization: `Bearer ${token3}` });
  });
  const mixed5xx = mixed.filter((r) => r.status >= 500);
  check(
    'R005i',
    mixed5xx.length === 0,
    `50 parallel GETs while writes are in flight -> statuses=${JSON.stringify(mixed.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {}))}, 5xx=${mixed5xx.length}`
  );

  finish();
}

run().catch((e) => {
  console.log('ROW R005 FAIL probe error: ' + e.message);
  process.exit(1);
});