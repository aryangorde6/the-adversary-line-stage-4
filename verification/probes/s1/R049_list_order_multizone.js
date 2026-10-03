'use strict';
// R049 / mutant-14 — the reservation list is ordered by ABSOLUTE time.
//
// Every earlier stage-1 probe ran against one restaurant in one timezone, and in one zone the
// local order and the absolute order are the same order. A list sorted on the local time STRING
// therefore passes every one of them. This fixture has three zones, chosen so that local order and
// absolute order genuinely disagree:
//
//   Berlin  2026-06-02T12:00 local -> 10:00Z
//   New York 2026-06-02T09:00 local -> 13:00Z   (earlier locally, LATER absolutely)
//   Tokyo   2026-06-02T09:00 local -> 00:00Z    (equal local time to New York, a different instant)
//   Tokyo   2026-06-02T08:00 local -> 23:00Z on the PREVIOUS UTC date
//
// The expected instants are computed from the IANA database in lib.js, never read back out of the
// service, so the probe never reads the answer out of the thing under test.

const { req, json, check, finish, reset, login, book, multiZone, zonedBooking, instantOf } = require('./lib');

const CASES = [
  { name: 'berlin-noon', r: 'r_berlin', t: 't_1', local: '2026-06-02T12:00', zone: 'Europe/Berlin' },
  { name: 'newyork-nine', r: 'r_newyork', t: 't_2', local: '2026-06-02T09:00', zone: 'America/New_York' },
  { name: 'tokyo-nine', r: 'r_tokyo', t: 't_1', local: '2026-06-02T09:00', zone: 'Asia/Tokyo' },
  { name: 'tokyo-eight', r: 'r_tokyo', t: 't_2', local: '2026-06-02T08:00', zone: 'Asia/Tokyo' },
];

async function run() {
  await reset(multiZone());
  const token = await login();

  const booked = [];
  for (let i = 0; i < CASES.length; i += 1) {
    const c = CASES[i];
    const r = await book(token, `tz-sort-${i}`, zonedBooking(c.r, c.t, c.local));
    check(
      `R049a-${c.name}`,
      r.status === 201,
      `book ${c.zone} ${c.local} -> ${r.status} ${r.body.slice(0, 120)} (expected 201)`
    );
    if (r.status === 201) booked.push({ ...c, instant: instantOf(c.zone, c.local) });
  }

  // Shape before count: a missing key is not an empty list.
  const list = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const body = json(list);
  const shapeOk = body !== null && Array.isArray(body.reservations);
  check(
    'R049b',
    shapeOk,
    `GET /reservations -> ${list.status}, carries a reservations array = ${shapeOk}` +
      (shapeOk ? '' : `; keys=${body ? Object.keys(body).join(',') : 'unparseable'}`)
  );
  if (!shapeOk) return finish();

  const got = body.reservations;
  check(
    'R049c',
    got.length === booked.length,
    `listed ${got.length} reservations, expected ${booked.length} (every seeded booking must appear)`
  );

  // The expected order: descending absolute instant, computed here from the IANA database.
  //
  // Labelled by restaurant AND local time, never by the local time alone: two of these bookings
  // share the local string "2026-06-02T09:00", so comparing local strings cannot tell a
  // correct order from a wrong one — the first version of this row did exactly that and would
  // have passed a service that sorted on the local string.
  const label = (r) => `${r.restaurant_id}@${r.starts_at_local}`;
  const expected = booked
    .slice()
    .sort((a, b) => b.instant - a.instant)
    .map((c) => `${c.r}@${c.local}`);
  const actual = got.map(label);

  // The order a local-time-string sort would produce, to show the two really differ.
  const localSort = booked
    .slice()
    .sort((a, b) => (a.local < b.local ? -1 : a.local > b.local ? 1 : a.r < b.r ? -1 : 1))
    .map((c) => `${c.r}@${c.local}`);
  check(
    'R049d',
    JSON.stringify(actual) === JSON.stringify(expected),
    `listed ${JSON.stringify(actual)}; descending ABSOLUTE order is ${JSON.stringify(expected)}; a ` +
      `local-time-string sort would give ${JSON.stringify(localSort)} (equal = ` +
      `${JSON.stringify(actual) === JSON.stringify(localSort)})`
  );

  // And the offsets the service reports must agree with the database, per booking.
  for (const r of got) {
    const c = booked.find((x) => x.local === r.starts_at_local && x.r === r.restaurant_id);
    if (!c || typeof c.instant !== 'number') continue;
    const expectedIso = new Date(c.instant).toISOString();
    const sameInstant = new Date(r.starts_at).getTime() === c.instant;
    check(
      `R049e-${c.name}`,
      sameInstant,
      `${c.zone} ${c.local} reported starts_at ${r.starts_at} -> ${new Date(r.starts_at).toISOString()}, ` +
        `IANA says ${expectedIso} (equal = ${sameInstant})`
    );
  }

  // Two of these share a local wall clock (09:00) in different zones. A list keyed on the local
  // string alone cannot order them; assert they are not adjacent-and-tied in the response.
  const tied = got.filter((r) => r.starts_at_local === '2026-06-02T09:00');
  check(
    'R049f',
    tied.length === 2 && tied[0].starts_at !== tied[1].starts_at,
    `the two 09:00 local bookings carry distinct instants: ${JSON.stringify(tied.map((r) => r.starts_at))} ` +
      `(a local-string sort cannot separate these at all)`
  );

  // A zone with no daylight saving must not be shifted by one: Tokyo is UTC+9 all year.
  // A zone with no daylight saving must keep the same UTC OFFSET across the northern summer.
  // The quantity to compare is the OFFSET, not the instant: two different dates six months apart
  // are of course different instants. My first version compared instants and reported a red
  // against a correct service — asserting the wrong quantity, which is the same fault as
  // comparing a ring with the element it surrounds.
  const offsetOf = (zone, isoLocal) => {
    const ms = instantOf(zone, isoLocal);
    if (ms === null) return null;
    const asUtc = Date.UTC(...isoLocal.slice(0, 10).split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))),
      Number(isoLocal.slice(11, 13)), Number(isoLocal.slice(14, 16)));
    return (asUtc - ms) / 60000;
  };
  const offsetWinter = offsetOf('Asia/Tokyo', '2026-01-15T09:00');
  const offsetSummer = offsetOf('Asia/Tokyo', '2026-07-15T09:00');
  check(
    'R049g',
    offsetWinter === 540 && offsetSummer === 540,
    `Tokyo's offset is +540 minutes in January and +540 in July 2026 (got ${offsetWinter} and ` +
      `${offsetSummer}); a resolver that assumes every zone observes daylight saving is wrong here`
  );
  const berlinOffset = offsetOf('Europe/Berlin', '2026-01-15T09:00');
  check(
    'R049h',
    berlinOffset === 60,
    `Europe/Berlin's offset is +60 minutes in January 2026 (got ${berlinOffset}) — the two zones in ` +
      `one fixture, so a fixed-offset assumption cannot satisfy both rows`
  );

  finish();
}

run();
