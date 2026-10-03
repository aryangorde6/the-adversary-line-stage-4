// The rule the Foreman ordered: the round starts on a surface where no route throws something it cannot name.
//
// This exists because I reported a defect that was not one. I called the async stateFromFixture
// synchronously, read a TypeError out of my own test line, and told the room the fixture door refused
// legibly with an untyped error. The Foreman ruled it a real product defect in the error layer before I
// had checked it over HTTP. It was green.
//
// So the row that was asked for is written here in the form that is actually true and actually checkable,
// rather than as a fix for a bug that does not exist:
//
//   1. every code the service can raise is REGISTERED in the error layer -- a static measurement, not a
//      count, because fail() silently coerces an unregistered code to validation_failed and nothing else
//      in the service would ever notice;
//   2. every refusal the fixture door actually makes carries a REGISTERED code and a 422, so a refusal
//      is legible rather than a surprise;
//   3. and a CONTROL: the states the door accepts must still be accepted, because a door that refuses
//      everything would pass assertions 1 and 2 perfectly.
//
// Assertion 3 is the one that matters. It is the control the Foreman made standing procedure, and it is
// exactly what I did not have when I reported my phantom defect -- I wrote a positive row for the door and
// never wrote the one that would have contradicted me.
import { BASE, call } from './stage4-base.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const ok = (name, condition, detail) => {
  if (condition) console.log(`  pass  ${name}`);
  else { failures += 1; console.log(`  FAIL  ${name}${detail === undefined ? '' : ' -- ' + JSON.stringify(detail)}`); }
};

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const OH = [{ weekday: 'mon', opens: '18:00', closes: '22:00' }];
const RESTAURANT = {
  id: 'r_1', name: 'Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
  reservation_duration_minutes: 60, cancellation_cutoff_minutes: 120, manager_user_ids: ['u_ada'],
  opening_hours: OH,
  // Three tables, not one: the control below closes a table and needs somewhere else to seat the two
  // bookings onto. My first version had one table, closing it left nowhere to go, and the 409 it returned
  // was correct -- the assertion was wrong, not the build.
  tables: [{ id: 't_1', label: '1', capacity: 4 }, { id: 't_2', label: '2', capacity: 4 }, { id: 't_3', label: '3', capacity: 4 }],
  combinable: [],
};
const base = (extra) => ({
  users: [{ id: 'u_ada', email: 'a@e.com', password: 'correct horse', display_name: 'Ada' }],
  restaurants: [RESTAURANT], reservations: [], ...extra,
});

console.log('\n1. EVERY CODE THE SERVICE CAN RAISE IS REGISTERED');
{
  // Read from source rather than from a hand-kept list, because a hand-kept list is exactly the artefact
  // that goes stale while the service moves on.
  const raised = new Set();
  for (const file of readdirSync(SRC).filter((n) => n.endsWith('.js'))) {
    const source = readFileSync(join(SRC, file), 'utf8');
    for (const match of source.matchAll(/fail\(\s*'([a-z_]+)'/g)) raised.add(match[1]);
  }
  const { STATUS_BY_CODE } = await import(join(SRC, 'errors.js'));
  const unregistered = [...raised].filter((code) => !(code in STATUS_BY_CODE)).sort();
  ok(`the service raises ${raised.size} distinct codes`, raised.size > 15, raised.size);
  ok('every one of them is registered in the error layer', unregistered.length === 0, unregistered);
  // And the coercion itself, asserted rather than described: an unregistered code becomes
  // validation_failed, which is the failure mode that let a stale_plan answer 422 with a validation
  // message and sent me hunting a fault that did not exist.
  const { fail } = await import(join(SRC, 'errors.js'));
  let coerced = null;
  try { fail('not_a_real_code', {}); } catch (error) { coerced = error.code; }
  ok('an unregistered code IS coerced to validation_failed -- asserted, so the hazard stays visible',
    coerced === 'validation_failed', coerced);
}

console.log('\n2. EVERY REFUSAL THE FIXTURE DOOR MAKES CARRIES A REGISTERED CODE AND A 422');
{
  const refusals = [
    ['a derived accepted_terms', { reservations: [{ restaurant_id: 'r_1', table_id: 't_1', user_id: 'u_ada', starts_at_local: '2026-11-02T19:00', party_size: 2, accepted_terms: { policy_version: 0 } }] }],
    ['a non-1 revision', { reservations: [{ restaurant_id: 'r_1', table_id: 't_1', user_id: 'u_ada', starts_at_local: '2026-11-02T19:00', party_size: 2, revision: 5 }] }],
    ['a series naming an occurrence with no seeded booking', { series: [{ series_id: 's1', user_id: 'u_ada', restaurant_id: 'r_1', anchor_reference: 'AAAAAA', count: 2, interval_weeks: 1, revision: 1, occurrences: [{ index: 0, reference: 'AAAAAA', exception: false }, { index: 1, reference: 'BBBBBB', exception: false }] }] }],
    ['a policy that duplicates a weekday', { policies: [{ restaurant_id: 'r_1', policy_version: 1, effective_from: '2026-01-01', slot_minutes: 30, reservation_duration_minutes: 60, cancellation_cutoff_minutes: 120, opening_hours: [...OH, ...OH], capacities: { t_1: 4, t_2: 4, t_3: 4 } }] }],
  ];
  for (const [label, extra] of refusals) {
    const refused = await call('POST', '/_test/reset', { body: base(extra) });
    const code = refused.body && refused.body.error ? refused.body.error.code : undefined;
    ok(`${label} is refused with 422 and a NAMED code`, refused.status === 422 && typeof code === 'string' && code.length > 0,
      { status: refused.status, code });
  }
}

console.log('\n3. THE CONTROL -- the states the door accepts must STILL be accepted');
console.log('   A door that refused everything would pass 1 and 2 perfectly. This is what I did not have.');
{
  const cases = [
    ['an ordinary seeded booking', { reservations: [{ restaurant_id: 'r_1', table_id: 't_1', user_id: 'u_ada', starts_at_local: '2026-11-02T19:00', party_size: 2 }] }],
    ['an ordinary seeded policy', { policies: [{ restaurant_id: 'r_1', policy_version: 4, effective_from: '2026-01-01', slot_minutes: 30, reservation_duration_minutes: 60, cancellation_cutoff_minutes: 120, opening_hours: OH, capacities: { t_1: 4, t_2: 4, t_3: 4 } }] }],
    // The state I wrongly reported as refused. It is accepted, and asserting so is what stops the same
    // phantom being reported a second time.
    ['TWO bookings on one table at ONE INSTANT', { reservations: [
      { restaurant_id: 'r_1', table_id: 't_1', user_id: 'u_ada', starts_at_local: '2026-11-02T19:00', party_size: 2 },
      { restaurant_id: 'r_1', table_id: 't_1', user_id: 'u_ada', starts_at_local: '2026-11-02T19:00', party_size: 2 },
    ] }],
  ];
  for (const [label, extra] of cases) {
    const accepted = await call('POST', '/_test/reset', { body: base(extra) });
    ok(`${label} is ACCEPTED with 204`, accepted.status === 204, { status: accepted.status, code: accepted.body && accepted.body.error });
  }
  // And the tie it creates is load-bearing for the rank vector, which is the property the fixture exists for.
  const token = (await call('POST', '/auth/login', { body: { email: 'a@e.com', password: 'correct horse' } })).body.token;
  const plan = await call('POST', '/restaurants/r_1/replans', {
    body: { table_id: 't_1', from: '2026-11-02T18:00:00+01:00', to: '2026-11-02T23:00:00+01:00' }, token, key: 'e1',
  });
  ok('and the seeded tie makes the rank vector decide', plan.status === 201
    && new Set(plan.body.assignments.map((a) => a.table_ids[0])).size === 2, plan.body.assignments);
}

console.log(`\n${failures === 0 ? 'no route throws something it cannot name' : failures + ' FAILURES'}`);
if (failures > 0) process.exitCode = 1;
