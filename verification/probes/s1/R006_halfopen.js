'use strict';
// R006 / mutant-01 — half-open occupancy [start, start+duration).
// A 90-minute booking at 19:00 does NOT overlap one starting at 20:30.

const { req, json, code, short, check, finish, reset, login, book, booking, allWeek } = require('./lib');

async function run() {
  await reset(allWeek());
  const token = await login();

  // 19:00 + 90m ends exactly 20:30. A booking starting at 20:30 must be accepted.
  const a = await book(token, 'half-a', booking('2026-09-24T19:00'));
  check('R006a', a.status === 201, `book 19:00 -> ${a.status} ${short(a.body)}`);
  if (a.status !== 201) return finish();

  const b = await book(token, 'half-b', booking('2026-09-24T20:30'));
  check(
    'R006b',
    b.status === 201,
    `book 20:30 adjacent to a 19:00-20:30 booking -> ${b.status} ${short(b.body)}` +
      ` (expected 201; 409 table_unavailable means the interval was treated as closed)`
  );

  // The negative half: a genuine overlap must still be refused.
  const c = await book(token, 'half-c', booking('2026-09-24T20:00'));
  check(
    'R006c',
    c.status === 409 && code(c) === 'table_unavailable',
    `book 20:00 overlapping 19:00-20:30 -> ${c.status} code=${code(c)} ${short(c.body)}`
  );

  // The same boundary on the OTHER table, so the rule is not an artefact of one table.
  const t1a = await book(token, 'half-d1', booking('2026-09-24T19:00', { table_id: 't_1', party_size: 2 }));
  check('R006d', t1a.status === 201, `book t_1 19:00 -> ${t1a.status} ${short(t1a.body)}`);
  const t1b = await book(token, 'half-d2', booking('2026-09-24T20:30', { table_id: 't_1', party_size: 2 }));
  check(
    'R006d2',
    t1b.status === 201,
    `book t_1 20:30 adjacent to a 19:00-20:30 booking on t_1 -> ${t1b.status} code=${code(t1b)} ${short(t1b.body)} (expected 201)`
  );
  const t1c = await book(token, 'half-d3', booking('2026-09-24T20:00', { table_id: 't_1', party_size: 2 }));
  check(
    'R006d3',
    t1c.status === 409 && code(t1c) === 'table_unavailable',
    `book t_1 20:00, 30 minutes before t_1's 20:30 end -> ${t1c.status} code=${code(t1c)} ${short(t1c.body)} (expected 409 table_unavailable)`
  );

  // Availability must agree with the boundary: t_2 is free at 20:30, busy at 20:00.
  const av = await req('GET', '/availability?restaurant_id=r_anker&date=2026-09-24&party_size=4');
  const slots = (json(av) || {}).slots || [];
  const at2000 = slots.find((s) => s.starts_at_local === '2026-09-24T20:00');
  const at2030 = slots.find((s) => s.starts_at_local === '2026-09-24T20:30');
  check(
    'R006e',
    !!at2000 && at2000.available_table_ids.includes('t_2') === false,
    `availability 20:00 available_table_ids=${at2000 ? JSON.stringify(at2000.available_table_ids) : 'absent'} (t_2 must be absent)`
  );
  check(
    'R006f',
    !!at2030 && at2030.available_table_ids.includes('t_2') === false,
    `availability 20:30 after the adjacent 20:30 booking -> ${at2030 ? JSON.stringify(at2030.available_table_ids) : 'absent'} (t_2 booked at 20:30 by this probe, so absent is correct)`
  );

  finish();
}

run().catch((e) => {
  console.log('ROW R006 FAIL probe error: ' + e.message);
  process.exit(1);
});