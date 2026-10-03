'use strict';
// R053 / mutant-06 — spring forward. Skipped local times do not exist: they never appear
// in availability and booking one is 422 invalid_local_time.
// R054 — fall back resolves to the FIRST occurrence, and the slot appears once.
// R055 — reservation_duration_minutes is absolute time, so 01:30 + 90m on a fall-back
//        night ends at 02:00 local, not 03:00.
// Both zones, all four transitions.

const { req, json, code, short, check, finish, reset, login, book, booking, allWeek } = require('./lib');

function fixtureInZone(zone, id) {
  const f = allWeek({ timezone: zone });
  f.restaurants[0].id = id;
  return f;
}

function localEndsAt(r) {
  // Render the absolute ends_at in the restaurant's zone as a local wall time.
  const e = json(r).ends_at;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}([+-]\d{2}):(\d{2})$/.exec(e || '');
  return m ? `${m[1]}T${m[2]}` : null;
}

async function run() {
  // ===================== Europe/Berlin =======================================
  await reset(fixtureInZone('Europe/Berlin', 'r_anker'));
  let token = await login();

  // --- spring forward 2026-03-29, 02:00 -> 03:00 ---------------------------
  let av = await req('GET', '/availability?restaurant_id=r_anker&date=2026-03-29&party_size=2');
  let slots = (json(av) || {}).slots || [];
  const inSkipped = slots.filter((s) => s.starts_at_local.slice(11, 13) === '02');
  check(
    'R053a',
    inSkipped.length === 0,
    `Europe/Berlin 2026-03-29 availability: slots whose local start is 02:xx = ${inSkipped.length} ` +
      `(expected 0; ${JSON.stringify(inSkipped.map((s) => s.starts_at_local))}) — the skipped hour must never appear`
  );
  // The negative half: the surrounding hours ARE present, so this is not an empty day
  // masquerading as a correct pass.
  const has0130 = slots.some((s) => s.starts_at_local === '2026-03-29T01:30');
  const has0300 = slots.some((s) => s.starts_at_local === '2026-03-29T03:00');
  check(
    'R053b',
    has0130 && has0300,
    `the hours either side of the gap are present: 01:30=${has0130}, 03:00=${has0300} ` +
      `(both must be true, so R053a is not passing because the day returned nothing)`
  );

  const spring = await book(token, 'dst-spring-1', booking('2026-03-29T02:30', { party_size: 2 }));
  check(
    'R053c',
    spring.status === 422 && code(spring) === 'invalid_local_time',
    `book 2026-03-29T02:30 in Europe/Berlin -> ${spring.status} code=${code(spring)} ${short(spring.body)} ` +
      `(expected 422 invalid_local_time; 201 means the skipped time was fabricated)`
  );

  // And it left nothing behind.
  const listAfter = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const leaked = (json(listAfter) || {}).reservations || [];
  check(
    'R053d',
    leaked.length === 0,
    `reservations after booking the skipped time = ${leaked.length} ${JSON.stringify(leaked.map((r) => r.starts_at_local))} (expected 0)`
  );

  // --- fall back 2026-10-25, 03:00 -> 02:00 ---------------------------------
  av = await req('GET', '/availability?restaurant_id=r_anker&date=2026-10-25&party_size=2');
  slots = (json(av) || {}).slots || [];
  const exact0200 = slots.filter((s) => s.starts_at_local === '2026-10-25T02:00');
  check(
    'R054a',
    exact0200.length === 1,
    `exactly one slot with starts_at_local "2026-10-25T02:00" = ${exact0200.length} ` +
      `(expected 1; counting on the substring over both starts_at_local and starts_at gives 2 and is the known wrong measurement)`
  );
  const at0200 = exact0200[0];
  check(
    'R054b',
    !!at0200 && /2026-10-25T02:00:00\+02:00$/.test(at0200.starts_at),
    `the 02:00 slot resolves to ${at0200 ? at0200.starts_at : 'absent'} (expected ...+02:00, the first occurrence, before the clocks change)`
  );

  // The absolute-duration rule, stated in the specification with a worked example.
  const fb = await book(token, 'dst-fb-1', booking('2026-10-25T01:30', { party_size: 2 }));
  check('R055a', fb.status === 201, `book 2026-10-25T01:30 Europe/Berlin -> ${fb.status} code=${code(fb)} ${short(fb.body)}`);
  if (fb.status === 201) {
    const endsLocal = localEndsAt(fb);
    check(
      'R055b',
      endsLocal === '2026-10-25T02:00',
      `90 minutes after 01:30 local ends at ${endsLocal} (expected 2026-10-25T02:00). ` +
        `A wall-clock addition gives 03:00, which is the defect this row exists to catch. Absolute: ${json(fb).ends_at}`
    );
    check(
      'R055c',
      json(fb).ends_at === '2026-10-25T02:00:00+01:00' && json(fb).starts_at === '2026-10-25T01:30:00+02:00',
      `starts_at=${json(fb).starts_at} ends_at=${json(fb).ends_at} (expected +02:00 start and +01:00 end, so the offset changed mid-booking)`
    );
  }

  // Booking the repeated hour resolves to the first occurrence.
  const rep = await book(token, 'dst-fb-2', booking('2026-10-25T02:30', { party_size: 2 }));
  check(
    'R054c',
    rep.status === 201 && /2026-10-25T02:30:00\+02:00$/.test(json(rep).starts_at || ''),
    `book the repeated hour 2026-10-25T02:30 -> ${rep.status} starts_at=${json(rep) && json(rep).starts_at} ` +
      `(expected 201 at +02:00, the first occurrence; +01:00 would be the second)`
  );

  // ===================== America/New_York ====================================
  await reset(fixtureInZone('America/New_York', 'r_anker'));
  token = await login();

  // spring forward 2026-03-08, 02:00 -> 03:00
  av = await req('GET', '/availability?restaurant_id=r_anker&date=2026-03-08&party_size=2');
  slots = (json(av) || {}).slots || [];
  const nySkip = slots.filter((s) => s.starts_at_local.slice(11, 13) === '02');
  check(
    'R053e',
    nySkip.length === 0,
    `America/New_York 2026-03-08 availability: slots with local start 02:xx = ${nySkip.length} (expected 0)`
  );
  const nySpring = await book(token, 'ny-spring', booking('2026-03-08T02:30', { party_size: 2 }));
  check(
    'R053f',
    nySpring.status === 422 && code(nySpring) === 'invalid_local_time',
    `book 2026-03-08T02:30 in America/New_York -> ${nySpring.status} code=${code(nySpring)} ${short(nySpring.body)}`
  );

  // fall back 2026-11-01, 02:00 -> 01:00. The repeated hour here is 01:xx.
  av = await req('GET', '/availability?restaurant_id=r_anker&date=2026-11-01&party_size=2');
  slots = (json(av) || {}).slots || [];
  const nyRepeat = slots.filter((s) => /^2026-11-01T01:[0-3]0$/.test(s.starts_at_local));
  const ny0100 = slots.filter((s) => s.starts_at_local === '2026-11-01T01:00');
  check(
    'R054d',
    ny0100.length === 1,
    `exactly one slot with starts_at_local "2026-11-01T01:00" = ${ny0100.length} (expected 1); ` +
      `repeated-hour slots present = ${JSON.stringify(nyRepeat.map((s) => s.starts_at_local))}`
  );
  check(
    'R054e',
    !!ny0100[0] && /2026-11-01T01:00:00-04:00$/.test(ny0100[0].starts_at),
    `the 01:00 slot resolves to ${ny0100[0] ? ny0100[0].starts_at : 'absent'} (expected -04:00, the first occurrence before the change)`
  );

  const nyFb = await book(token, 'ny-fb', booking('2026-11-01T00:30', { party_size: 2 }));
  check('R055d', nyFb.status === 201, `book 2026-11-01T00:30 America/New_York -> ${nyFb.status} ${short(nyFb.body)}`);
  if (nyFb.status === 201) {
    // 00:30 EDT + 90 absolute minutes = 01:00 EST, i.e. local 01:00 not 02:00.
    check(
      'R055e',
      localEndsAt(nyFb) === '2026-11-01T01:00',
      `90 minutes after 00:30 local ends at ${localEndsAt(nyFb)} (expected 2026-11-01T01:00; ` +
        `a wall-clock addition gives 02:00). Absolute: ${json(nyFb).ends_at}`
    );
    check(
      'R055f',
      json(nyFb).starts_at === '2026-11-01T00:30:00-04:00' && json(nyFb).ends_at === '2026-11-01T01:00:00-05:00',
      `starts_at=${json(nyFb).starts_at} ends_at=${json(nyFb).ends_at} (expected -04:00 start, -05:00 end)`
    );
  }

  finish();
}

run().catch((e) => {
  console.log('ROW R053 FAIL probe error: ' + e.message);
  process.exit(1);
});