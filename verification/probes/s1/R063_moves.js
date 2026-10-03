'use strict';
// R063 / mutant-11 — POST /reservation-moves is all-or-nothing across occupancy,
// reservation records and retry keys. A batch whose later item conflicts must leave every
// earlier item untouched, and must not store a receipt for its key.

const { req, json, code, short, check, finish, reset, login, auth, book, booking, allWeek } = require('./lib');

async function occupancy(token, startsAtLocal) {
  const av = await req('GET', `/availability?restaurant_id=r_anker&date=${startsAtLocal.slice(0, 10)}&party_size=2`);
  const slot = ((json(av) || {}).slots || []).find((s) => s.starts_at_local === startsAtLocal);
  return slot ? slot.available_table_ids : null;
}

async function run() {
  await reset(allWeek());
  const token = await login();

  // A on t_1 at 19:00, B on t_2 at 19:00, C on t_1 at 21:00.
  const a = await book(token, 'mv-a', booking('2026-09-24T19:00', { table_id: 't_1', party_size: 2 }));
  const b = await book(token, 'mv-b', booking('2026-09-24T19:00', { table_id: 't_2', party_size: 2 }));
  const c = await book(token, 'mv-c', booking('2026-09-24T21:00', { table_id: 't_1', party_size: 2 }));
  check('R063a', a.status === 201 && b.status === 201 && c.status === 201,
    `seed A(t_1 19:00)=${a.status} B(t_2 19:00)=${b.status} C(t_1 21:00)=${c.status}`);
  if (a.status !== 201 || b.status !== 201 || c.status !== 201) return finish();
  const refA = json(a).reference;
  const refC = json(c).reference;

  const before1900 = await occupancy(token, '2026-09-24T19:00');
  check('R063b', before1900 && before1900.length === 0,
    `occupancy at 19:00 before the batch -> available_table_ids=${JSON.stringify(before1900)} (expected [] — both tables taken)`);

  // ---- the failing batch: move A onto t_2 (occupied by B), then move C onto t_1
  const failBody = {
    moves: [
      { reference: refA, table_id: 't_2' },
      { reference: refC, starts_at_local: '2026-09-24T19:00', table_id: 't_1' },
    ],
  };
  const failRes = await req(
    'POST',
    '/reservation-moves',
    Object.assign(auth(token), { 'idempotency-key': 'mv-fail-1', 'content-type': 'application/json' }),
    failBody
  );
  check(
    'R063c',
    failRes.status === 409 && code(failRes) === 'table_unavailable',
    `batch with an occupancy conflict -> ${failRes.status} code=${code(failRes)} ${short(failRes.body)} ` +
      `(expected 409 table_unavailable)`
  );

  // ---- nothing changed: A must still be on t_1, not t_2 ---------------------
  const aAfter = await req('GET', `/reservations/${refA}`, auth(token));
  check(
    'R063d',
    aAfter.status === 200 && json(aAfter).table_id === 't_1',
    `A after the refused batch -> table_id=${json(aAfter) && json(aAfter).table_id}, ` +
      `starts_at_local=${json(aAfter) && json(aAfter).starts_at_local} ` +
      `(expected t_1 at 19:00 — A must not have been moved to t_2 before the conflict was found)`
  );

  const cAfter = await req('GET', `/reservations/${refC}`, auth(token));
  check(
    'R063e',
    cAfter.status === 200 && json(cAfter).table_id === 't_1' && json(cAfter).starts_at_local === '2026-09-24T21:00',
    `C after the refused batch -> table_id=${json(cAfter) && json(cAfter).table_id} ` +
      `at ${json(cAfter) && json(cAfter).starts_at_local} (expected t_1 at 21:00, unchanged)`
  );

  const after1900 = await occupancy(token, '2026-09-24T19:00');
  check(
    'R063f',
    !!after1900 && after1900.length === 0,
    `occupancy at 19:00 after the refused batch -> available_table_ids=${JSON.stringify(after1900)} ` +
      `(expected [] — unchanged. A on t_2 would leave t_1 free here)`
  );

  // ---- no receipt was stored for the failed batch key ------------------------
  const retrySame = await req(
    'POST',
    '/reservation-moves',
    Object.assign(auth(token), { 'idempotency-key': 'mv-fail-1', 'content-type': 'application/json' }),
    { moves: [{ reference: refA, table_id: 't_1' }] }
  );
  check(
    'R063g',
    retrySame.status === 201,
    `the failed batch's key 'mv-fail-1' reused with a now-valid body -> ${retrySame.status} code=${code(retrySame)} ` +
      `${short(retrySame.body)} (expected 201: a refused batch must not store a receipt, so this is a first use)`
  );

  // ---- a succeeding batch commits every item ---------------------------------
  await reset(allWeek());
  const t2 = await login();
  const a2 = await book(t2, 'mv2-a', booking('2026-09-24T19:00', { table_id: 't_1', party_size: 2 }));
  const c2 = await book(t2, 'mv2-c', booking('2026-09-24T21:00', { table_id: 't_2', party_size: 2 }));
  check('R063h', a2.status === 201 && c2.status === 201, `re-seed -> A=${a2.status} C=${c2.status}`);
  if (a2.status !== 201 || c2.status !== 201) return finish();
  const rA2 = json(a2).reference;
  const rC2 = json(c2).reference;

  const okRes = await req(
    'POST',
    '/reservation-moves',
    Object.assign(auth(t2), { 'idempotency-key': 'mv-ok-1', 'content-type': 'application/json' }),
    { moves: [{ reference: rA2, table_id: 't_2' }, { reference: rC2, table_id: 't_1' }] }
  );
  check(
    'R063i',
    okRes.status === 201,
    `a non-conflicting two-item batch -> ${okRes.status} code=${code(okRes)} ${short(okRes.body, 300)} (expected 201)`
  );
  if (okRes.status === 201) {
    const arr = (json(okRes).reservations || []);
    check(
      'R063j',
      arr.length === 2 && arr[0].reference === rA2 && arr[1].reference === rC2,
      `201 body carries reservations in INPUT order: ${JSON.stringify(arr.map((r) => r.reference))} (expected [${rA2}, ${rC2}])`
    );
    check(
      'R063k',
      arr.length === 2 && arr[0].table_id === 't_2' && arr[1].table_id === 't_1',
      `both moves applied: A->${arr[0] && arr[0].table_id} (want t_2), C->${arr[1] && arr[1].table_id} (want t_1)`
    );
  }

  // ---- a replay of the successful batch returns the original response --------
  const replay = await req(
    'POST',
    '/reservation-moves',
    Object.assign(auth(t2), { 'idempotency-key': 'mv-ok-1', 'content-type': 'application/json' }),
    { moves: [{ reference: rA2, table_id: 't_2' }, { reference: rC2, table_id: 't_1' }] }
  );
  check(
    'R063l',
    replay.status === 200 && replay.body === okRes.body,
    `replay of the successful batch -> ${replay.status}, byte-identical to the original: ${replay.body === okRes.body}`
  );

  // ---- a single-item conflict in a longer batch, with the good item FIRST ----
  await reset(allWeek());
  const t3 = await login();
  const x = await book(t3, 'mv3-x', booking('2026-09-24T19:00', { table_id: 't_1', party_size: 2 }));
  const y = await book(t3, 'mv3-y', booking('2026-09-24T19:00', { table_id: 't_2', party_size: 2 }));
  check('R063m', x.status === 201 && y.status === 201, `re-seed for the ordering case -> X=${x.status} Y=${y.status}`);
  if (x.status === 201 && y.status === 201) {
    const rX = json(x).reference;
    const rY = json(y).reference;
    // X moves to 21:00 on t_1 (fine). Y moves to 21:00 on t_1 (conflicts with X).
    const bad2 = await req(
      'POST',
      '/reservation-moves',
      Object.assign(auth(t3), { 'idempotency-key': 'mv3-bad', 'content-type': 'application/json' }),
      {
        moves: [
          { reference: rX, starts_at_local: '2026-09-24T21:00', table_id: 't_1' },
          { reference: rY, starts_at_local: '2026-09-24T21:00', table_id: 't_1' },
        ],
      }
    );
    check(
      'R063n',
      bad2.status === 409 && code(bad2) === 'table_unavailable',
      `batch where the FIRST item is fine and the SECOND conflicts -> ${bad2.status} code=${code(bad2)} ${short(bad2.body)}`
    );
    const xAfter = await req('GET', `/reservations/${rX}`, auth(t3));
    check(
      'R063o',
      xAfter.status === 200 && json(xAfter).starts_at_local === '2026-09-24T19:00',
      `X after the refused batch -> starts_at_local=${json(xAfter) && json(xAfter).starts_at_local} ` +
        `(expected 2026-09-24T19:00 — a partially-applied batch would show 21:00 here, which is the mutant)`
    );
  }

  finish();
}

run().catch((e) => {
  console.log('ROW R063 FAIL probe error: ' + e.message);
  process.exit(1);
});