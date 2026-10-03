'use strict';
// R038 / mutant-04 — idempotency is resolved before endpoint field validation.
// A used key with a different body is 409 idempotency_key_reuse EVEN WHEN the new body is
// itself invalid, and a used key with the same body replays regardless of field validity.

const { req, json, code, short, check, finish, reset, login, book, booking, allWeek } = require('./lib');

async function run() {
  await reset(allWeek());
  const token = await login();

  // --- 1. establish a receipt --------------------------------------------------
  const first = await book(token, 'order-1', booking('2026-09-24T19:00'));
  check('R038a', first.status === 201, `first use of order-1 -> ${first.status} ${short(first.body)}`);

  // --- 2. different body, and that body is invalid -> still 409 ---------------
  const bad = await book(
    token,
    'order-1',
    booking('2026-09-24T20:00', { table_id: 't_1', party_size: 99 })
  );
  check(
    'R038b',
    bad.status === 409 && code(bad) === 'idempotency_key_reuse',
    `used key + different invalid body (party_size 99, t_1) -> ${bad.status} code=${code(bad)} ${short(bad.body)} ` +
      `(expected 409 idempotency_key_reuse; 422 validation_failed means idempotency was resolved after field validation)`
  );

  // --- 3. different body that is invalid for a non-field reason -> still 409 ---
  const bad2 = await book(token, 'order-1', booking('2026-09-24T19:07'));
  check(
    'R038c',
    bad2.status === 409 && code(bad2) === 'idempotency_key_reuse',
    `used key + different off-grid body (19:07) -> ${bad2.status} code=${code(bad2)} ${short(bad2.body)}`
  );

  // --- 4. different body that is perfectly valid -> 409 ------------------------
  const good = await book(token, 'order-1', booking('2026-09-24T21:00'));
  check(
    'R038d',
    good.status === 409 && code(good) === 'idempotency_key_reuse',
    `used key + different valid body (21:00) -> ${good.status} code=${code(good)} ${short(good.body)}`
  );

  // --- 5. the negative half: none of those created anything -------------------
  const list = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const all = (json(list) || {}).reservations || [];
  check(
    'R038e',
    all.length === 1 && all[0].starts_at_local === '2026-09-24T19:00',
    `reservations after four refusals = ${all.length} at ${JSON.stringify(all.map((r) => r.starts_at_local))} ` +
      `(exactly one, at 19:00 — a 200 instead of 409 would have replayed, and a 422 would have booked)`
  );

  // --- 6. same key, same body still replays with the ORIGINAL body ------------
  const replay = await book(token, 'order-1', booking('2026-09-24T19:00'));
  check(
    'R038f',
    replay.status === 200 && replay.body === first.body,
    `replay same key same body -> ${replay.status}, body identical to the original: ${replay.body === first.body}`
  );

  // --- 7. body comparison is by JSON value, not byte order ---------------------
  const reordered = '{"party_size":4,"starts_at_local":"2026-09-24T19:00","table_id":"t_2","restaurant_id":"r_anker"}';
  const same = await req(
    'POST',
    '/reservations',
    { authorization: `Bearer ${token}`, 'idempotency-key': 'order-1', 'content-type': 'application/json' },
    reordered
  );
  check(
    'R038g',
    same.status === 200 && same.body === first.body,
    `same key, same JSON value with keys reordered and different whitespace -> ${same.status}, body identical: ${same.body === first.body} ` +
      `(409 here would mean the body was compared textually rather than as a parsed JSON value)`
  );

  // --- 8. the same key on a DIFFERENT path is a different request -------------
  const moves = await req(
    'POST',
    '/reservation-moves',
    { authorization: `Bearer ${token}`, 'idempotency-key': 'order-1', 'content-type': 'application/json' },
    { moves: [{ reference: json(first).reference, table_id: 't_1' }] }
  );
  check(
    'R038h',
    moves.status === 200 || moves.status === 201,
    `same key on a different path with a valid moves body -> ${moves.status} code=${code(moves)} ${short(moves.body)} ` +
      `(expected 200 or 201; 409 idempotency_key_reuse would mean the receipt was not scoped to the path)`
  );

  finish();
}

run().catch((e) => {
  console.log('ROW R038 FAIL probe error: ' + e.message);
  process.exit(1);
});