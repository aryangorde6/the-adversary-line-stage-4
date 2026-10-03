'use strict';
// R041 (second half) / mutant #7 — an idempotency key used on a request that FAILED is still unused.
//
// The defect this catches: an idempotency layer that stores a receipt on any completed request rather
// than only on a successful one. Then the first, failed attempt poisons the key, the retry replays the
// failure instead of booking, and a diner who corrects their request is told they have already tried
// it. `R007_no_partial.js` targets a different defect — a leaked reservation — so its rows say nothing
// about this; a probe pointed at the wrong defect is counted as coverage and is worse than none.
//
// The failing request is staged deliberately and the staging is asserted first: the first POST must
// actually be refused, with the refusal's own code, before any conclusion is drawn about the key.

const { req, json, code, check, finish, reset, login, book, multiZone, zonedBooking } = require('./lib');

async function run() {
  await reset(multiZone());
  const token = await login();

  // ---- stage the failure: a key spent on a 4xx ------------------------------
  const KEY = 'reuse-after-4xx';
  const SLOT = '2026-12-01T19:00';
  const refused = await book(token, KEY, zonedBooking('r_berlin', 't_2', SLOT, 99));
  check(
    'R041i-setup',
    refused.status === 422 && code(refused) === 'party_exceeds_capacity',
    `first attempt with key ${KEY} and party_size 99 -> ${refused.status} code=${code(refused)} ` +
      `${refused.body.slice(0, 110)} (expected 422 party_exceeds_capacity: the staging step must ` +
      `actually fail, or every row below is vacuous)`
  );
  if (refused.status < 400) {
    return finish();
  }

  // ---- and it left nothing behind -------------------------------------------
  const listAfterFail = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const bodyAfterFail = json(listAfterFail);
  const shapeOk = bodyAfterFail !== null && Array.isArray(bodyAfterFail.reservations);
  check(
    'R041j',
    shapeOk && bodyAfterFail.reservations.length === 0,
    `after the refused attempt: GET /reservations carries an array = ${shapeOk}, ` +
      `${shapeOk ? bodyAfterFail.reservations.length : 'n/a'} reservations (expected 0 — a refusal ` +
      `must leave no record, and the count is only read after the shape is asserted)`
  );

  // ---- the key is still unused: a corrected body is a FIRST use -------------
  const corrected = await book(token, KEY, zonedBooking('r_berlin', 't_2', SLOT, 4));
  check(
    'R041k',
    corrected.status === 201,
    `same key ${KEY}, corrected body (party_size 4) -> ${corrected.status} ` +
      `${corrected.body.slice(0, 130)} (expected **201**: a key spent on a 4xx was never used)`
  );
  if (corrected.status !== 201) {
    // Read out why, so the failure is legible rather than a bare status.
    check('R041k-why', false, `the key replayed the refusal instead of booking: ${corrected.body.slice(0, 200)}`);
    return finish();
  }
  const booked = json(corrected);
  check(
    'R041l',
    booked && booked.reference && booked.status === 'confirmed' && booked.party_size === 4,
    `the replayed body is the NEW booking, not the refusal: ${JSON.stringify({
      reference: booked && booked.reference,
      status: booked && booked.status,
      party_size: booked && booked.party_size,
    })}`
  );

  // ---- and only now is the key spent ----------------------------------------
  const replay = await book(token, KEY, zonedBooking('r_berlin', 't_2', SLOT, 4));
  check(
    'R041m',
    replay.status === 200 && replay.body === corrected.body,
    `third attempt, same key and body -> ${replay.status}, byte-identical to the second = ` +
      `${replay.body === corrected.body} (expected 200 with a byte-identical body: the key is spent ` +
      `by the SUCCESS, not by the failure)`
  );

  // ---- the negative half: the same key with the same bad body is not a replay
  const refusedAgain = await book(token, 'reuse-after-4xx-2', zonedBooking('r_berlin', 't_2', SLOT, 99));
  const refusedTwice = await book(token, 'reuse-after-4xx-2', zonedBooking('r_berlin', 't_2', SLOT, 99));
  check(
    'R041n',
    refusedAgain.status === 422 && refusedTwice.status === 422 && refusedAgain.body === refusedTwice.body,
    `a key used twice on the same 4xx -> ${refusedAgain.status} then ${refusedTwice.status}, identical ` +
      `bodies = ${refusedAgain.body === refusedTwice.body} (a refusal is re-evaluated, never replayed ` +
      `as a success, and never stored)`
  );

  // ---- and a 4xx key does not leak into another key's success ---------------
  const other = await book(token, 'unrelated-key', zonedBooking('r_berlin', 't_1', SLOT, 2));
  check(
    'R041o',
    other.status === 201,
    `an unrelated key booking the same slot on another table -> ${other.status} (expected 201: the ` +
      `refused key must not have consumed any state)`
  );

  // ---- 404 is a 4xx too ------------------------------------------------------
  const missing = await book(token, 'reuse-after-404', zonedBooking('r_berlin', 't_nope', SLOT, 2));
  // 21:00, not 20:00: the earlier booking holds t_2 until 20:30, so a 20:00 retry is a legitimate
  // 409 and would have made this row assert a conflict instead of the key's state.
  const afterMissing = await book(token, 'reuse-after-404', zonedBooking('r_berlin', 't_2', '2026-12-01T21:00', 2));
  check(
    'R041p',
    missing.status === 404 && afterMissing.status === 201,
    `key spent on a 404 (unknown table) -> ${missing.status}; then reused with a valid body -> ` +
      `${afterMissing.status} (expected 404 then **201**: the rule is about 4xx, not about validation)`
  );

  finish();
}

run();
