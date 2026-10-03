// Two invariants asserted, because a fix without an assertion is this stage's entire subject.
//
// Both were regressions in this stage and both are invisible to a count:
//
//   1. restaurant_revision must NOT move for a no-op, a failure, a preview or a replay. A bump placed
//      inside a domain primitive moved it on paths the specification excludes, and every count in the
//      folder stayed green while ten stage-3 rows went red. The counts could not see it; this can.
//
//   2. Stored bookings must carry no enumerable scratch keys. A planner stashed an index on the
//      reservations themselves, which put an extra key on real bookings and broke every deep-equality
//      row -- while every status code stayed correct.
//
// Run against a built container:  node invariants.mjs http://localhost:PORT
import { BASE, call } from './stage4-base.mjs';

let failures = 0;
const ok = (name, condition, detail) => {
  if (condition) console.log(`  pass  ${name}`);
  else { failures += 1; console.log(`  FAIL  ${name}${detail === undefined ? '' : ' -- ' + JSON.stringify(detail)}`); }
};

const OH = [{ weekday: 'mon', opens: '18:00', closes: '22:00' }, { weekday: 'tue', opens: '18:00', closes: '22:00' }];
const RESTAURANT = {
  id: 'r_1', name: 'Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
  reservation_duration_minutes: 60, cancellation_cutoff_minutes: 120, manager_user_ids: ['u_ada'],
  opening_hours: OH,
  tables: [{ id: 't_1', label: '1', capacity: 2 }, { id: 't_2', label: '2', capacity: 4 }],
  combinable: [['t_1', 't_2']],
};
const KEY = '2026-11-02';

async function seed(reservations = []) {
  await call('POST', '/_test/reset', { body: { users: [{ id: 'u_ada', email: 'a@e.com', password: 'correct horse', display_name: 'Ada' }], restaurants: [RESTAURANT], reservations } });
  return (await call('POST', '/auth/login', { body: { email: 'a@e.com', password: 'correct horse' } })).body.token;
}

// The specification exposes no read of restaurant_revision directly, so it is read where it is visible:
// the replans 201 and apply 201 bodies both carry it.
const revisionFrom = async (plan) => plan.restaurant_revision;

console.log('\nINVARIANT 1: restaurant_revision moves only for real writes');
{
  const token = await seed();
  const created = await call('POST', '/reservations', { body: { restaurant_id: 'r_1', table_ids: ['t_2'], starts_at_local: `${KEY}T19:00`, party_size: 2 }, token, key: 'i1' });
  ok('a booking is created', created.status === 201, created.status);
  const reference = created.body.reference;

  const preview = await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` }, token, key: 'i2' });
  ok('a preview is accepted', preview.status === 201, preview.status);
  const beforePreview = await revisionFrom(preview.body);
  const previewAgain = await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` }, token, key: 'i3' });
  ok('a second preview does not move it', await revisionFrom(previewAgain.body) === beforePreview,
    { before: beforePreview, after: await revisionFrom(previewAgain.body) });

  const noOp = await call('PATCH', `/reservations/${reference}`, { body: { party_size: 2 }, token });
  ok('a no-op patch succeeds', noOp.status === 200, noOp.status);
  const afterNoOp = await revisionFrom((await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` }, token, key: 'i4' })).body);
  ok('and a no-op patch does NOT move it', afterNoOp === beforePreview, { before: beforePreview, after: afterNoOp });

  const failure = await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: '2026-11-02T18:00:00', to: `${KEY}T23:00:00+01:00` }, token, key: 'i5' });
  ok('a naive instant is refused', failure.status === 422, failure.status);
  const afterFailure = await revisionFrom((await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` }, token, key: 'i6' })).body);
  ok('and a FAILURE does not move it', afterFailure === beforePreview, { before: beforePreview, after: afterFailure });

  const applied = await call('POST', `/restaurants/r_1/replans/${preview.body.plan_id}/apply`, { body: {}, token, key: 'i7' });
  ok('an application succeeds', applied.status === 201, applied.status);
  ok('and it moves the revision exactly once', applied.body.restaurant_revision === beforePreview + 1,
    { before: beforePreview, after: applied.body.restaurant_revision });

  const replay = await call('POST', `/restaurants/r_1/replans/${preview.body.plan_id}/apply`, { body: {}, token, key: 'i7' });
  ok('a replay returns the ORIGINAL response', replay.status === 200, replay.status);
  ok('and the replayed revision equals the original, so no second increment happened',
    replay.body.restaurant_revision === applied.body.restaurant_revision,
    { original: applied.body.restaurant_revision, replay: replay.body.restaurant_revision });
}

console.log('\nINVARIANT 2: stored records carry no scratch keys');
{
  const token = await seed([{ restaurant_id: 'r_1', table_id: 't_1', user_id: 'u_ada', starts_at_local: `${KEY}T19:00`, party_size: 2 }]);
  const plan = await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` }, token, key: 'j1' });
  ok('a plan over a seeded booking is accepted', plan.status === 201, plan.status);
  await call('POST', `/restaurants/r_1/replans/${plan.body.plan_id}/apply`, { body: {}, token, key: 'j2' });

  // Every field the reservation view has ever had, and nothing a helper might have left on the record.
  // The reservation VIEW and the reservation RECORD are different shapes and both are enumerated
  // explicitly. A guess at either list would have made this assert against a shape I imagined, which is
  // the same mistake as a probe corrected into agreement with the build.
  const VIEW = new Set(['id', 'reservation_id', 'reference', 'user_id', 'restaurant_id', 'table_id', 'table_ids',
    'party_size', 'status', 'starts_at_local', 'starts_at', 'ends_at', 'created_at', 'revision',
    'accepted_terms', 'series_id', 'series_index']);
  // What a planner leaves behind when it stashes state on a record: a key pointing at other records.
  const SCRATCH = ['byReference', 'by_reference', 'seen', 'assigned', 'chosen', 'scratch', 'cache', 'index'];
  const list = (await call('GET', '/reservations', { token })).body.reservations;
  ok('there is a booking to inspect', list.length > 0, list.length);
  for (const reservation of list) {
    const extra = Object.keys(reservation).filter((key) => !VIEW.has(key));
    ok(`reservation ${reservation.reference} carries no unexpected field`, extra.length === 0, extra);
  }

  // The planner's scratch index was the specific offender, so name THAT rather than guessing at a shape.
  // accepted_terms is legitimately a large nested object, so "has a big object" is not the test.
  for (const reservation of list) {
    const stashed = Object.keys(reservation).filter((key) => SCRATCH.includes(key));
    ok(`reservation ${reservation.reference} carries no planner scratch key`, stashed.length === 0, stashed);
  }

  // And the export, which is what a stage 1-3 document round-trips through.
  const exported = (await call('GET', '/_test/export')).body.state;
  const RECORD = new Set([...VIEW, 'starts_at_ms', 'ends_at_ms']);
  for (const reservation of exported.reservations) {
    const extra = Object.keys(reservation).filter((key) => !RECORD.has(key));
    ok(`exported reservation ${reservation.reference} carries no unexpected field`, extra.length === 0, extra);
    const stashed = Object.keys(reservation).filter((key) => SCRATCH.includes(key));
    ok(`exported reservation ${reservation.reference} carries no planner scratch key`, stashed.length === 0, stashed);
  }
}

console.log(`\n${failures === 0 ? 'all invariants held' : failures + ' INVARIANT FAILURES'}`);
if (failures > 0) process.exitCode = 1;
