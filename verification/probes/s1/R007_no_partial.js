'use strict';
// R007 / mutant-03 — a rejected request must leave no partial or duplicate booking.
// A party larger than capacity is refused; nothing may remain in state.

const { req, json, code, short, check, finish, reset, login, book, booking, allWeek } = require('./lib');

async function countAt(token, startsAtLocal) {
  const list = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  return ((json(list) || {}).reservations || []).filter((r) => r.starts_at_local === startsAtLocal);
}

async function run() {
  await reset(allWeek());
  const token = await login();

  // --- 1. party_size over capacity: refused, and nothing persisted ------------
  const over = await book(token, 'partial-1', booking('2026-09-24T19:00', { table_id: 't_1', party_size: 9 }));
  check(
    'R007a',
    over.status === 422 && code(over) === 'party_exceeds_capacity',
    `party_size 9 on t_1 (capacity 2) -> ${over.status} code=${code(over)} ${short(over.body)}`
  );
  const leaked = await countAt(token, '2026-09-24T19:00');
  check(
    'R007b',
    leaked.length === 0,
    `reservations persisted at 19:00 after the refusal = ${leaked.length} ` +
      `${JSON.stringify(leaked.map((r) => r.reference))} — any value here is a partial booking left by a rejected request`
  );

  // --- 2. the negative half: the slot must still be bookable -----------------
  const ok = await book(token, 'partial-2', booking('2026-09-24T19:00', { table_id: 't_1', party_size: 2 }));
  check(
    'R007c',
    ok.status === 201,
    `the same slot and table after the refusal -> ${ok.status} code=${code(ok)} ${short(ok.body)} ` +
      `(409 table_unavailable here means the rejected request occupied the table)`
  );

  // --- 3. overlap refusal leaves nothing, and a retry can succeed -------------
  await book(token, 'partial-3', booking('2026-09-24T21:00'));
  const clash = await book(token, 'partial-4', booking('2026-09-24T21:00'));
  check(
    'R007d',
    clash.status === 409 && code(clash) === 'table_unavailable',
    `overlapping booking -> ${clash.status} code=${code(clash)} ${short(clash.body)}`
  );
  const at2100 = await countAt(token, '2026-09-24T21:00');
  check(
    'R007e',
    at2100.length === 1,
    `reservations at 21:00 after one success and one refusal = ${at2100.length} (exactly one — a second would be the duplicate a refused request created)`
  );

  // --- 4. the refused key is reusable as a first use, and creates one booking -
  const retry = await book(token, 'partial-1', booking('2026-09-24T22:00', { table_id: 't_1', party_size: 2 }));
  check(
    'R007f',
    retry.status === 201,
    `key 'partial-1' whose first request was refused, reused with a valid body -> ${retry.status} code=${code(retry)} ${short(retry.body)} (expected 201)`
  );
  const at2200 = await countAt(token, '2026-09-24T22:00');
  check(
    'R007g',
    at2200.length === 1,
    `reservations at 22:00 after the reuse = ${at2200.length} (exactly one)`
  );

  // --- 5. off-grid and outside-hours refusals leave nothing ------------------
  const offGrid = await book(token, 'partial-5', booking('2026-09-24T19:07'));
  check(
    'R007h',
    offGrid.status === 422 && code(offGrid) === 'not_on_slot_grid',
    `off-grid start 19:07 -> ${offGrid.status} code=${code(offGrid)} ${short(offGrid.body)}`
  );
  const list = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const all = (json(list) || {}).reservations || [];
  check(
    'R007i',
    all.length === 3,
    `total reservations for this user = ${all.length} starts=${JSON.stringify(all.map((r) => r.starts_at_local))} ` +
      `(expected exactly 3: 19:00, 21:00, 22:00 — the 19:07 off-grid attempt must not appear)`
  );
  check(
    'R007j',
    all.every((r) => r.status === 'confirmed'),
    `every persisted reservation is confirmed: ${JSON.stringify(all.map((r) => r.status))}`
  );

  finish();
}

run().catch((e) => {
  console.log('ROW R007 FAIL probe error: ' + e.message);
  process.exit(1);
});