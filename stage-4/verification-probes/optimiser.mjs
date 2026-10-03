// The two fixtures the Adversary named as owed, plus the one that separates the third objective.
//
// S4-170 levels 2 and 3 were asserted for presence and internal consistency only: "unused_seats and
// moved_count are reported" is a list of reported NUMBERS, not the rule. A build that ignored the seat
// total and the rank vector would pass every one of those rows -- and this build did, until the second
// fixture below was written. These three cases are the ones that actually separate the objectives.
//
// The separation technique is the whole point: in each case objective 1 is TIED, so only the later
// objective can decide, and the two candidates disagree about which one wins. A fixture where every
// objective agrees proves nothing, which is how the original optimiser shipped.
import { BASE, call } from './stage4-base.mjs';

let failures = 0;
const ok = (name, condition, detail) => {
  if (condition) console.log(`  pass  ${name}`);
  else { failures += 1; console.log(`  FAIL  ${name}${detail === undefined ? '' : ' -- ' + JSON.stringify(detail)}`); }
};

const OH = [{ weekday: 'mon', opens: '18:00', closes: '22:00' }];
const KEY = '2026-11-02';

async function withTables(tables, combinable, reservations) {
  const restaurant = {
    id: 'r_1', name: 'Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
    reservation_duration_minutes: 60, cancellation_cutoff_minutes: 120,
    manager_user_ids: ['u_ada'], opening_hours: OH, tables, combinable,
  };
  await call('POST', '/_test/reset', { body: { users: [{ id: 'u_ada', email: 'a@e.com', password: 'correct horse', display_name: 'Ada' }], restaurants: [restaurant], reservations } });
  return (await call('POST', '/auth/login', { body: { email: 'a@e.com', password: 'correct horse' } })).body.token;
}

const table = (id, capacity) => ({ id, label: id, capacity });
const booking = (tableId, partySize, at = '19:00') => ({ restaurant_id: 'r_1', table_id: tableId, user_id: 'u_ada', starts_at_local: `${KEY}T${at}`, party_size: partySize });
const close = (tableId) => ({ table_id: tableId, from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` });

console.log('\nOBJECTIVE 2 -- fewest unused seats decides when objective 1 is tied');
console.log('  t_a cap6 unused 4 rank 0  |  t_b cap2 unused 0 rank 1. Objective 2 says t_b; rank alone says t_a.');
{
  const token = await withTables([table('t_a', 6), table('t_b', 2), table('t_c', 4)], [], [booking('t_c', 2)]);
  const plan = await call('POST', '/restaurants/r_1/replans', { body: close('t_c'), token, key: 'o1' });
  ok('the plan is produced', plan.status === 201, plan.status);
  const chosen = plan.body.assignments[0].table_ids;
  ok('the TIGHTER fit is chosen, not the lowest-ranked one', chosen[0] === 't_b', { chosen, unused: plan.body.unused_seats });
  ok('and unused_seats is 0, not 4', plan.body.unused_seats === 0, plan.body.unused_seats);
  ok('and moved_count is 1 -- objective 1 was tied, not won', plan.body.moved_count === 1, plan.body.moved_count);
}

console.log('\nOBJECTIVE 1 -- fewest changed table sets beats a tighter fit');
console.log('  Two seats free on t_a (unused 0) and t_b (unused 0); t_b is closed, so t_a must be used anyway.');
{
  // t_a and t_c both fit a party of 1 exactly. t_c is closed and the booking holds t_b, which also cannot
  // be used -- so both candidates change the table set and objective 1 ties; then both have unused 0 and
  // the rank vector decides. That is the objective-3 case, asserted below. Here objective 1 is made to
  // DECIDE by giving one candidate an unchanged set that fits.
  const token = await withTables([table('t_a', 2), table('t_b', 2), table('t_c', 2)], [], [booking('t_b', 1, '19:00'), booking('t_a', 1, '19:30')]);
  const plan = await call('POST', '/restaurants/r_1/replans', { body: close('t_b'), token, key: 'o2' });
  ok('the plan is produced', plan.status === 201, plan.status);
  const moved = plan.body.assignments.filter((a) => a.changed).length;
  const stillOnA = plan.body.assignments.find((a) => a.table_ids[0] === 't_a');
  ok('the booking that did NOT hold the closed table is not moved', stillOnA !== undefined && stillOnA.changed === false,
    plan.body.assignments);
  ok('and exactly one booking moved', plan.body.moved_count === 1 && moved === 1, { reported: plan.body.moved_count, counted: moved });
}

console.log('\nOBJECTIVE 3 -- the rank vector decides when 1 and 2 tie');
console.log('  t_a cap4 unused 2 rank 0  |  t_b cap4 unused 2 rank 1. Identical on both earlier objectives.');
{
  const token = await withTables([table('t_a', 4), table('t_b', 4), table('t_c', 4)], [], [booking('t_c', 2)]);
  const plan = await call('POST', '/restaurants/r_1/replans', { body: close('t_c'), token, key: 'o3' });
  ok('the plan is produced', plan.status === 201, plan.status);
  const chosen = plan.body.assignments[0].table_ids;
  ok('the lower-ranked table wins the tie', chosen[0] === 't_a', chosen);
  ok('and unused_seats is 2 either way -- which is what makes this the tie-break case', plan.body.unused_seats === 2, plan.body.unused_seats);
}

console.log('\nA build that ignored the seat total would fail the first fixture, and one that ignored the');
console.log('rank vector would fail the third. Neither failure is visible in "unused_seats is reported".');
console.log(`\n${failures === 0 ? 'the three objectives are separated' : failures + ' FAILURES'}`);
if (failures > 0) process.exitCode = 1;
