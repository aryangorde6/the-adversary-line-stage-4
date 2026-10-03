'use strict';
// R037 / mutant #6 — an idempotency key is scoped to the operation it was used for.
//
// The defect: the receipt store keys on the caller and the key alone, ignoring the METHOD and the
// PATH, so a key used on one write satisfies a *different* write. A diner (or a client library)
// reusing one key across two endpoints gets the first endpoint's answer replayed for the second, and a
// booking that never happened appears to have happened.
//
// The harness caught this mutant and my probes missed it at 14/14. Every earlier probe used a fresh
// key per endpoint, so nothing in the suite ever presented the same key to two paths — the condition
// was never staged. This file stages it in its first row.
//
// Both keyed write paths in stage 1 are `POST /reservations` and `POST /reservation-moves`. The rows
// below assert, in both directions:
//   * the same key on a DIFFERENT path is a first use, not a replay and not a key-reuse refusal;
//   * the same key on the same path with a different body is still `idempotency_key_reuse`;
//   * neither write leaves the other's receipt visible.

const { req, json, code, check, finish, reset, login, book, multiZone, zonedBooking } = require('./lib');

const FUTURE = '2026-12-01';

async function run() {
  await reset(multiZone());
  const token = await login();

  // ---- stage it: one key, two keyed paths ------------------------------------
  const KEY = 'shared-key-1';
  const first = await book(token, KEY, zonedBooking('r_berlin', 't_1', `${FUTURE}T19:00`, 2));
  check(
    'R037a-setup',
    first.status === 201,
    `POST /reservations with key ${KEY} -> ${first.status} ${first.body.slice(0, 110)} (expected 201: ` +
      `the staging step must succeed, or the cross-path rows below prove nothing)`
  );
  if (first.status !== 201) return finish();
  const firstRef = json(first).reference;

  // A moves request naming two existing bookings. At this point only one exists, so the second
  // booking is created first with its own key, and the batch is then presented with the shared key.
  const second = await book(token, 'second-booking', zonedBooking('r_berlin', 't_2', `${FUTURE}T19:00`, 2));
  check('R037b-setup', second.status === 201,
    `second booking on t_2 -> ${second.status} ${second.body.slice(0, 110)} (expected 201)`);
  if (second.status !== 201) return finish();
  const secondRef = json(second).reference;

  // ---- the same key on the OTHER keyed path ----------------------------------
  const moved = await req('POST', '/reservation-moves',
    { authorization: `Bearer ${token}`, 'idempotency-key': KEY, 'content-type': 'application/json' },
    { moves: [{ reference: firstRef, starts_at_local: `${FUTURE}T21:00` }] });
  check(
    'R037c',
    moved.status === 201,
    `the SAME key ${KEY} on POST /reservation-moves -> ${moved.status} code=${code(moved)} ` +
      `${moved.body.slice(0, 130)} (expected **201**: a key is scoped to its operation, so this is a ` +
      `first use. A 200 here means the moves call replayed the reservations receipt; a 409 ` +
      `idempotency_key_reuse means the store compares bodies across paths, which is the same defect ` +
      `wearing a different status.)`
  );
  if (moved.status === 201) {
    const body = json(moved);
    const reservations = Array.isArray(body.reservations) ? body.reservations : [];
    check(
      'R037d',
      reservations.length === 1 && reservations[0].reference === firstRef,
      `the moves response is a moves response: ${JSON.stringify(reservations.map((r) => r.reference))} ` +
        `(expected exactly [${firstRef}]; an implementation that replayed the other endpoint's answer ` +
        `would return a different shape or a different reference)`
    );
  }

  // ---- and the first write is untouched by the second ------------------------
  const reread = await req('GET', `/reservations/${firstRef}`, { authorization: `Bearer ${token}` });
  const after = json(reread);
  check(
    'R037e',
    reread.status === 200 && after && after.starts_at_local === `${FUTURE}T21:00`,
    `after the cross-path write, the original reservation reads ${after && after.starts_at_local} ` +
      `(expected ${FUTURE}T21:00 — the moves call moved it once, not twice and not not at all)`
  );

  // ---- same key, SAME path, different body is still a refusal ---------------
  const sameePathNewBody = await book(token, KEY, zonedBooking('r_berlin', 't_1', `${FUTURE}T22:00`, 4));
  check(
    'R037f',
    sameePathNewBody.status === 409 && code(sameePathNewBody) === 'idempotency_key_reuse',
    `the same key ${KEY} on the SAME path with a different body -> ${sameePathNewBody.status} ` +
      `code=${code(sameePathNewBody)} (expected 409 idempotency_key_reuse: the scoping fix must not ` +
      `weaken the rule it is fixing)`
  );

  // ---- the second path's own replay still works ------------------------------
  const replayMoves = await req('POST', '/reservation-moves',
    { authorization: `Bearer ${token}`, 'idempotency-key': KEY, 'content-type': 'application/json' },
    { moves: [{ reference: firstRef, starts_at_local: `${FUTURE}T21:00` }] });
  check(
    'R037g',
    replayMoves.status === 200 && replayMoves.body === moved.body,
    `replaying the moves call with its own key -> ${replayMoves.status}, byte-identical to the ` +
      `original = ${replayMoves.body === moved.body} (expected 200 and identical: scoping by path ` +
      `must not break replay *within* a path)`
  );

  // ---- and a key used on one user's path is not another's ---------------------
  const bob = json(await req('POST', '/auth/signup', { 'content-type': 'application/json' },
    { email: 'bob@example.com', password: 'correct horse', display_name: 'Bob' }));
  const bobSameKey = await book(bob.token, KEY, zonedBooking('r_newyork', 't_1', `${FUTURE}T19:00`, 2));
  check(
    'R037h',
    bobSameKey.status === 201,
    `a DIFFERENT user presenting the same key string on the same path -> ${bobSameKey.status} ` +
      `(expected 201: the store is scoped per account as well as per path)`
  );

  finish();
}

run();
