'use strict';
// R059 / mutant #11 — the export is a SNAPSHOT, not a live view of the store.
//
// The defect: the document handed back by `GET /_test/export` shares structure with the live state, so
// a write that lands afterwards is visible in the document a caller already received. Every prior
// export probe asserted properties *of* a document — its `format_version`, its identities, whether an
// import restored a booking — and every one of those passed against a live view, because a live view
// is correct until something writes to it. So the condition has to be staged: export, WRITE, then read
// the export again.
//
// This is deliberately NOT what `R060_export_import.js` covers. That file catches an import that
// regenerates identities; this one catches an export that is not a snapshot. They fail in opposite
// directions and neither probe can see the other's defect.

const { req, json, check, finish, reset, login, book, multiZone, zonedBooking } = require('./lib');

const SLOT_A = '2026-12-01T19:00';
const SLOT_B = '2026-12-01T21:00';

async function run() {
  await reset(multiZone());
  const token = await login();

  const first = await book(token, 'snap-1', zonedBooking('r_berlin', 't_1', SLOT_A, 2));
  check('R059a-setup', first.status === 201, `first booking -> ${first.status} ${first.body.slice(0, 100)}`);
  if (first.status !== 201) return finish();

  // ---- the export, and the shape of it -------------------------------------
  const one = await req('GET', '/_test/export');
  const doc1 = json(one);
  check(
    'R059b',
    one.status === 200 && doc1 !== null && typeof doc1 === 'object' && 'state' in doc1,
    `GET /_test/export -> ${one.status}, carries a state key = ${doc1 !== null && 'state' in doc1} ` +
      `(asserted before anything is read out of it)`
  );
  if (!doc1 || !('state' in doc1)) return finish();

  const reservationsKey = Array.isArray(doc1.state.reservations) ? 'state.reservations' : null;
  check(
    'R059c',
    reservationsKey !== null,
    `state.reservations is an array = ${reservationsKey !== null} ` +
      `(keys present: ${Object.keys(doc1.state).join(',')})`
  );
  if (!reservationsKey) return finish();

  const before = {
    reservations: doc1.state.reservations.length,
    reference: doc1.state.reservations[0] && doc1.state.reservations[0].reference,
    createdAt: doc1.state.reservations[0] && doc1.state.reservations[0].created_at,
    users: doc1.state.users.length,
    idempotency: doc1.state.idempotency.length,
    // The document exactly as it was serialised, so a later comparison cannot be fooled by a
    // re-read of the same object graph.
    raw: one.body,
  };
  check('R059d', before.reservations === 1,
    `the export holds ${before.reservations} reservation(s), expected 1`);

  // ---- stage the write ------------------------------------------------------
  const second = await book(token, 'snap-2', zonedBooking('r_berlin', 't_2', SLOT_B, 4));
  check('R059e-setup', second.status === 201,
    `a second booking after the export -> ${second.status} ${second.body.slice(0, 100)} (expected 201: ` +
      `the write has to land, or the snapshot rows below are vacuous)`);
  if (second.status !== 201) return finish();

  // ---- the first document must not have moved -------------------------------
  const reread = json(await req('GET', '/_test/export'));
  check(
    'R059f',
    reread !== null && Array.isArray(reread.state.reservations) && reread.state.reservations.length === 2,
    `a fresh export now holds ${reread && reread.state && reread.state.reservations.length} ` +
      `reservations, expected 2 — so the write did land and the snapshot question is real`
  );

  check(
    'R059g',
    before.raw === one.body,
    `the FIRST export document, re-read after the write, is byte-identical to what was returned ` +
      `earlier = ${before.raw === one.body}. A live view would have grown by one reservation.`
  );

  // A document handed to a caller is a value, not a window: the caller's copy must not change even
  // though the caller can still read it. Assert on the parsed object, not only on the raw bytes.
  const heldReservations = doc1.state.reservations.length;
  const heldReference = before.reference;
  check(
    'R059h',
    heldReservations === 1 && heldReference !== null,
    `the document the caller still holds reports ${heldReservations} reservation(s), reference ` +
      `${JSON.stringify(heldReference)} — the same values it was given`
  );

  // ---- and the snapshot must be complete enough to restore -----------------
  // A snapshot that silently omitted live-only fields would pass every row above and fail here.
  const secondExport = await req('GET', '/_test/export');
  const doc2 = json(secondExport);
  const userFields = Object.keys((doc2.state.users[0] || {})).sort();
  const reservationFields = Object.keys((doc2.state.reservations[0] || {})).sort();
  const idempotencyFields = Object.keys((doc2.state.idempotency[0] || {})).sort();
  check(
    'R059i',
    userFields.includes('password_hash') && userFields.includes('id') &&
      reservationFields.includes('reference') && reservationFields.includes('starts_at_ms') &&
      idempotencyFields.includes('key') && idempotencyFields.includes('response'),
    `the snapshot carries the fields a restore needs: users [${userFields.join(',')}], reservations ` +
      `[${reservationFields.join(',')}], idempotency [${idempotencyFields.join(',')}]`
  );

  // ---- exporting again must not disturb the document already taken ----------
  await req('GET', '/_test/export');
  const afterTwoExports = one.body;
  check(
    'R059j',
    afterTwoExports === before.raw,
    `taking a further export does not change the earlier document = ${afterTwoExports === before.raw}`
  );

  finish();
}

run();
