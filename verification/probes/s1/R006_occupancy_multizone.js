'use strict';
// R006 / mutant-2 — occupancy is decided on ABSOLUTE instants, not on wall-clock values.
//
// One restaurant in one timezone cannot expose this: the local date and the UTC date agree for
// every booking such a fixture makes, so a resolver that gets the date wrong still returns the
// right answer. The fixture here has three zones, and two of the cases below turn on exactly that:
//
//   * Tokyo 08:00 local on 2026-06-02 is 23:00 UTC on 2026-06-01 — the local date and the UTC date
//     differ, so a booking's own date is not recoverable from its instant;
//   * the same local wall clock in two zones is two different instants, so a comparison made on
//     wall-clock values would call a genuine overlap free (or a genuine gap taken).
//
// Expected instants come from the IANA database in lib.js, never from the service.

const { req, json, check, finish, reset, login, book, multiZone, zonedBooking, instantOf } = require('./lib');

async function run() {
  await reset(multiZone());
  const token = await login();

  // ---- case 1: the same time of day on consecutive days is NOT an overlap ------
  // Berlin 20:00 local on 1 June and 20:00 local on 2 June 2026 are the same clock time 24 hours
  // apart. Absolute arithmetic says free; wall-clock arithmetic that forgets the DATE says overlap
  // and refuses a booking that must be accepted. This is the case one timezone already allows, and
  // it is here because the multi-zone fixture has to keep passing once the mutant arrives.
  const first = await book(token, 'occ-a', zonedBooking('r_berlin', 't_1', '2026-06-01T20:00'));
  check('R006m1', first.status === 201, `book Berlin 2026-06-01T20:00 -> ${first.status} ${first.body.slice(0, 110)}`);
  const day1 = instantOf('Europe/Berlin', '2026-06-01T20:00');
  const day2 = instantOf('Europe/Berlin', '2026-06-02T20:00');
  const dayGapOverlap = day2 < day1 + 90 * 60000 && day1 < day2 + 90 * 60000;
  const sameClockNextDay = await book(token, 'occ-b', zonedBooking('r_berlin', 't_1', '2026-06-02T20:00'));
  check(
    'R006m2',
    !dayGapOverlap && sameClockNextDay.status === 201,
    `Berlin 20:00 on 1 June (${new Date(day1).toISOString()}) and 20:00 on 2 June ` +
      `(${new Date(day2).toISOString()}) overlap by absolute arithmetic = ${dayGapOverlap}; the second ` +
      `booking -> ${sameClockNextDay.status} (expected 201: the same clock time a day apart is not an overlap)`
  );

  // ---- case 2: a genuine overlap in the same zone is still refused --------------
  const evening = await book(token, 'occ-c', zonedBooking('r_berlin', 't_1', '2026-06-01T21:00'));
  check('R006m3', evening.status === 409 && json(evening) && json(evening).error.code === 'table_unavailable',
    `book Berlin 2026-06-01T21:00 against the 20:00-21:30 booking on the same table -> ${evening.status} ` +
      `${evening.body.slice(0, 110)} (expected 409 table_unavailable: an overlap is an overlap)`);

  // ---- case 3: the local date is not the UTC date ------------------------------
  // Tokyo 08:00 local on 2 June 2026 is 23:00 UTC on 1 JUNE. A resolver that reconstructs the
  // booking's date from its instant instead of from the wall clock would place it at 08:00Z on
  // 1 June and then find it overlapping the legitimate 17:00 Tokyo booking below, which is
  // 08:00Z on 1 June. The correct answer is free, and the difference is the date.
  const tokyoEvening = await book(token, 'occ-d', zonedBooking('r_tokyo', 't_1', '2026-06-01T17:00'));
  check('R006m4', tokyoEvening.status === 201,
    `book Tokyo 2026-06-01T17:00 (${new Date(instantOf('Asia/Tokyo', '2026-06-01T17:00')).toISOString()}) -> ` +
      `${tokyoEvening.status} ${tokyoEvening.body.slice(0, 110)}`);
  const tokyoBoundary = instantOf('Asia/Tokyo', '2026-06-02T08:00');
  const tokyoRef = instantOf('Asia/Tokyo', '2026-06-01T17:00');
  const boundaryOverlap = tokyoBoundary < tokyoRef + 90 * 60000 && tokyoRef < tokyoBoundary + 90 * 60000;
  const boundary = await book(token, 'occ-e', zonedBooking('r_tokyo', 't_1', '2026-06-02T08:00'));
  check(
    'R006m5',
    !boundaryOverlap && boundary.status === 201,
    `Tokyo 2026-06-02T08:00 local is ${new Date(tokyoBoundary).toISOString()}, whose UTC DATE is the ` +
      `previous day, against Tokyo 2026-06-01T17:00 at ${new Date(tokyoRef).toISOString()}; absolute ` +
      `overlap = ${boundaryOverlap}; booking -> ${boundary.status} (expected 201: the local date is ` +
      `2 June and must be honoured, whatever the UTC date is)`
  );

  // ---- case 4: the same local string in two zones is two instants --------------
  const b = await book(token, 'occ-f', zonedBooking('r_berlin', 't_2', '2026-06-02T12:00'));
  const n = await book(token, 'occ-g', zonedBooking('r_newyork', 't_1', '2026-06-02T12:00'));
  const bMs = instantOf('Europe/Berlin', '2026-06-02T12:00');
  const nMs = instantOf('America/New_York', '2026-06-02T12:00');
  check(
    'R006m6',
    b.status === 201 && n.status === 201 && Math.abs(nMs - bMs) === 6 * 3600000,
    `the identical local string 2026-06-02T12:00 is ${new Date(bMs).toISOString()} in Berlin and ` +
      `${new Date(nMs).toISOString()} in New York, ${Math.abs(nMs - bMs) / 3600000}h apart; bookings -> ` +
      `${b.status} and ${n.status} (expected 201 and 201: different restaurants cannot conflict)`
  );

  // ---- case 5: a zone with no daylight saving ----------------------------------
  const winter = await book(token, 'occ-h', zonedBooking('r_tokyo', 't_2', '2026-01-15T09:00'));
  const summer = await book(token, 'occ-i', zonedBooking('r_tokyo', 't_2', '2026-07-15T09:00'));
  const offsetWinter = (Date.UTC(2026, 0, 15, 9) - instantOf('Asia/Tokyo', '2026-01-15T09:00')) / 60000;
  const offsetSummer = (Date.UTC(2026, 6, 15, 9) - instantOf('Asia/Tokyo', '2026-07-15T09:00')) / 60000;
  check(
    'R006m7',
    winter.status === 201 && summer.status === 201 && offsetWinter === 540 && offsetSummer === 540,
    `Tokyo 09:00 local booked in January and July 2026 -> ${winter.status} and ${summer.status}; offsets ` +
      `+${offsetWinter} and +${offsetSummer} minutes (Tokyo has no daylight saving, so a resolver ` +
      `that assumes every zone does is wrong here)`
  );

  // ---- case 6: the refusals left nothing behind -------------------------------
  const list = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const body = json(list);
  const shapeOk = body !== null && Array.isArray(body.reservations);
  check(
    'R006m8',
    shapeOk,
    `GET /reservations carries a reservations array = ${shapeOk}` +
      (shapeOk ? '' : `; keys=${body ? Object.keys(body).join(',') : 'unparseable'}`)
  );
  if (shapeOk) {
    const eveningRows = body.reservations.filter(
      (r) => r.restaurant_id === 'r_berlin' && r.starts_at_local === '2026-06-01T21:00'
    );
    const tokyoRows = body.reservations.filter(
      (r) => r.restaurant_id === 'r_tokyo' && r.starts_at_local === '2026-06-02T08:00'
    );
    check(
      'R006m9',
      eveningRows.length === 0 && tokyoRows.length === 1,
      `the two refused bookings left no records (Berlin 21:00 rows=${eveningRows.length}, expected 0) ` +
        `and the accepted boundary booking is intact (Tokyo 08:00 rows=${tokyoRows.length}, expected 1)`
    );
  }

  finish();
}

run();
