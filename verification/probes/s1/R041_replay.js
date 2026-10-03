'use strict';
// R041 / mutant-05 — a successful replay returns the ORIGINAL response body, even
// after the resource changed or was cancelled, and makes no further state change.
// A receipt that stored a null body replays an empty or missing reference.

const { FUTURE, req, json, code, short, check, finish, reset, login, book, booking, allWeek } = require('./lib');

async function run() {
  await reset(allWeek());
  const token = await login();

  const first = await book(token, 'replay-1', booking(FUTURE + 'T19:00'));
  check('R041a', first.status === 201, `first use -> ${first.status} ${short(first.body)}`);
  if (first.status !== 201) return finish();
  const reference = json(first).reference;
  const createdAt = json(first).created_at;

  // --- 1. cancel the reservation, then replay the create ----------------------
  const cancel = await req('POST', `/reservations/${reference}/cancel`, { authorization: `Bearer ${token}` });
  check(
    'R041b',
    cancel.status === 200 && json(cancel).status === 'cancelled',
    `cancel ${reference} -> ${cancel.status} status=${json(cancel) && json(cancel).status} ${short(cancel.body)}`
  );

  const replay = await book(token, 'replay-1', booking(FUTURE + 'T19:00'));
  check(
    'R041c',
    replay.status === 200,
    `replay after cancel -> ${replay.status} ${short(replay.body)} (expected 200)`
  );

  // --- 2. the replayed body must be the ORIGINAL, complete, confirmed body -----
  let rj = json(replay);
  check(
    'R041d',
    !!rj && rj.reference === reference && rj.status === 'confirmed' && rj.created_at === createdAt,
    `replayed body = ${short(replay.body)} — reference ${rj && rj.reference} (want ${reference}), ` +
      `status ${rj && rj.status} (want confirmed), created_at ${rj && rj.created_at} (want ${createdAt}). ` +
      `A null or empty replayed body, or one showing status "cancelled", fails here`
  );
  check(
    'R041e',
    replay.body === first.body,
    `replayed body byte-identical to the original response: ${replay.body === first.body}`
  );

  // --- 3. and it made no state change: the booking is still cancelled ---------
  const lookup = await req('GET', `/reservations/${reference}`, { authorization: `Bearer ${token}` });
  check(
    'R041f',
    lookup.status === 200 && json(lookup).status === 'cancelled',
    `GET the reference after the replay -> ${lookup.status} status=${json(lookup) && json(lookup).status} ` +
      `(still cancelled: the replay must not have re-confirmed the booking)`
  );

  // --- 4. amend something else, then replay the create ------------------------
  // Amending the CANCELLED reservation would be 409 reservation_cancelled, which is correct
  // and proves nothing about replay. So a second, confirmed booking is amended instead, and
  // the first create is then replayed: the replay must still return the original body.
  const second = await book(token, 'replay-2', booking(FUTURE + 'T20:00'));
  check('R041g', second.status === 201, `second booking to amend -> ${second.status} ${short(second.body)}`);
  if (second.status !== 201) return finish();
  const patch = await req(
    'PATCH',
    `/reservations/${json(second).reference}`,
    { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    { party_size: 2 }
  );
  check(
    'R041g2',
    patch.status === 200 && json(patch).party_size === 2,
    `amend the confirmed booking -> ${patch.status} party_size=${json(patch) && json(patch).party_size} ${short(patch.body)}`
  );
  const cancelAgain = await req('POST', `/reservations/${json(second).reference}/cancel`, { authorization: `Bearer ${token}` });
  check(
    'R041g3',
    cancelAgain.status === 200 && json(cancelAgain).status === 'cancelled',
    `cancel the amended booking -> ${cancelAgain.status} status=${json(cancelAgain) && json(cancelAgain).status} (expected 200 cancelled)`
  );

  const replay2 = await book(token, 'replay-1', booking(FUTURE + 'T19:00'));
  check(
    'R041h',
    replay2.status === 200 && replay2.body === first.body,
    `replay after the amend -> ${replay2.status}, body identical to the original: ${replay2.body === first.body}`
  );

  // --- 5. the slot was freed by the cancel and the replay must not re-take it --
  const av = await req('GET', '/availability?restaurant_id=r_anker&date=' + FUTURE + '&party_size=4');
  const slot = ((json(av) || {}).slots || []).find((s) => s.starts_at_local === FUTURE + 'T19:00');
  check(
    'R041i',
    !!slot && slot.available_table_ids.includes('t_2'),
    `availability at 19:00 after cancel+replay -> ${slot ? JSON.stringify(slot.available_table_ids) : 'absent'} ` +
      `(t_2 must be free: the replay made no further state change)`
  );

  finish();
}

run().catch((e) => {
  console.log('ROW R041 FAIL probe error: ' + e.message);
  process.exit(1);
});