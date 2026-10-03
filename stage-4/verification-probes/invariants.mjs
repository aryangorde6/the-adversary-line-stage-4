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
let revisionReads = 0;

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

  const current = async () => (await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` }, token, key: 'probe' + (revisionReads += 1) })).body.restaurant_revision;
  revisionReads = 0;

  // A REAL amendment and a PUBLICATION each move it; a real cancellation moves it. These three were
  // named by the requirement and were missing from this probe, which asserted the negatives thoroughly
  // and the positives only for a booking and an application -- an omission that reads as coverage.
  const beforeAmend = await current();
  await call('PATCH', `/reservations/${reference}`, { body: { party_size: 3 }, token });
  const afterAmend = await current();
  ok('a REAL amendment moves it', afterAmend === beforeAmend + 1, { before: beforeAmend, after: afterAmend });

  const beforePublish = await current();
  const published = await call('POST', '/restaurants/r_1/policies', { body: { effective_from: '2026-01-01', slot_minutes: 30, reservation_duration_minutes: 60, cancellation_cutoff_minutes: 120, opening_hours: OH, capacities: { t_1: 2, t_2: 4 } }, token, key: 'i8' });
  ok('a publication succeeds', published.status === 201, published.status);
  ok('a PUBLICATION moves it', await current() === beforePublish + 1);

  const beforeCancel = await current();
  const cancelled = await call('POST', `/reservations/${reference}/cancel`, { token });
  ok('a cancellation succeeds', cancelled.status === 200, cancelled.status);
  ok('a real CANCELLATION moves it', await current() === beforeCancel + 1);

  const beforeRepeat = await current();
  await call('POST', `/reservations/${reference}/cancel`, { token });
  ok('a REPEATED cancellation does not move it', await current() === beforeRepeat, { before: beforeRepeat, after: await current() });

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
  // A first version of this probe recorded its baseline by writing `entries` ONTO each reservation --
  // which is the exact defect this invariant exists to catch, committed by the probe meant to catch it.
  // The allowlist caught it. That is the invariant working, and it is also the reason the baseline lives
  // in a Map outside the objects under test rather than on them.
  const historyCounts = new Map();
  for (const reservation of list) {
    const entries = (await call('GET', `/reservations/${reservation.reference}/history`, { token })).body.entries;
    historyCounts.set(reservation.reference, entries.length);
  }
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

  // THE RECORD, restated as its CONSEQUENCE rather than as a key.
  //
  // The audit's finding, and this rewrite exists because of it. The view rows above PASS while the
  // planner's scratch key is planted: the view is a fixed projection and a key stashed on the stored
  // record is not in it. Worse, the defect the invariant exists for is CIRCULAR, so serialisation fails
  // before any key is readable -- a key-enumerating row cannot see it either, and asserting the status
  // alone would be satisfied by a build carrying the exact defect.
  //
  // So the observable is not the key. It is that the service can still produce its own document WITH the
  // records in it. That is a property of the record and of nothing else, and no projection can satisfy
  // it, which is what clause 55's first half asks for.
  const exportResponse = await call('GET', '/_test/export');
  const seededReferences = list.map((reservation) => reservation.reference).sort();
  ok('EXPORT-SERIALISES: /_test/export answers 200', exportResponse.status === 200,
    { status: exportResponse.status });
  const exportedState = exportResponse.status === 200 && exportResponse.body
    ? exportResponse.body.state
    : undefined;
  ok('EXPORT-SERIALISES: the export carries a reservations array',
    Boolean(exportedState) && Array.isArray(exportedState.reservations),
    exportedState === undefined ? 'the export carried no state at all' : 'state present but no reservations array');
  if (exportedState && Array.isArray(exportedState.reservations)) {
    const exportedReferences = exportedState.reservations.map((reservation) => reservation.reference).sort();
    // Compared by reference against what the service itself reports, never sampled: an export that
    // succeeds while omitting records is the failure this row exists for.
    ok('EXPORT-SERIALISES: it carries EVERY seeded reference',
      JSON.stringify(exportedReferences) === JSON.stringify(seededReferences),
      { seeded: seededReferences, exported: exportedReferences });
    // Key-level, each record inside its OWN guard. A guard belongs where the failure actually occurs,
    // which is never the level you first think of: guarding only the fetch left the throw one level in.
    const RECORD = new Set([...VIEW, 'starts_at_ms', 'ends_at_ms']);
    let inspected = 0;
    for (const [index, reservation] of exportedState.reservations.entries()) {
      let keys;
      try {
        keys = Object.keys(reservation);
      } catch (cause) {
        ok(`RECORD[${index}] could be inspected, and the rows after it still ran`, false,
          { error: cause && cause.message });
        continue;
      }
      inspected += 1;
      const label = reservation && reservation.reference ? reservation.reference : `index ${index}`;
      const stashed = keys.filter((key) => SCRATCH.includes(key));
      ok(`RECORD ${label} carries no planner scratch key`, stashed.length === 0, stashed);
      const extra = keys.filter((key) => !RECORD.has(key));
      ok(`RECORD ${label} carries no unexpected field`, extra.length === 0, extra);
    }
    ok('the record-side rows ran rather than threw', inspected === exportedState.reservations.length,
      { inspected, of: exportedState.reservations.length });
  }
}

console.log('\nTHE DEFECT THIS PROBE FOUND, AS ITS OWN ROW');
console.log('  A closure constrains a booking only when it covers the booking\'s CURRENT table. A booking');
console.log('  that does not hold the closed table is a candidate to STAY, and a plan that cannot express');
console.log('  staying has confused "must move" with "may move".');
{
  const token = await seed([{ restaurant_id: 'r_1', table_id: 't_2', user_id: 'u_ada', starts_at_local: `${KEY}T19:00`, party_size: 2 }]);
  const before = (await call('GET', '/reservations', { token })).body.reservations[0];
  // The baseline is the ACTUAL history length, read from the service. Comparing against a number derived
  // from another field would assert nothing: a fixture-seeded booking has no history entries at all, so
  // "entries.length === revision" is false for reasons that have nothing to do with the plan.
  const historyBefore = (await call('GET', `/reservations/${before.reference}/history`, { token })).body.entries.length;
  const plan = await call('POST', '/restaurants/r_1/replans', { body: { table_id: 't_1', from: `${KEY}T18:00:00+01:00`, to: `${KEY}T23:00:00+01:00` }, token, key: 'k1' });
  ok('a closure NOT covering the booking\'s table plans at all', plan.status === 201, { status: plan.status, code: plan.body && plan.body.error });
  const assignment = (plan.body.assignments || [])[0];
  ok('and the booking is considered, because it OVERLAPS the interval', Boolean(assignment), plan.body.assignments);
  ok('and it is assigned the table it already holds', assignment && JSON.stringify(assignment.table_ids) === JSON.stringify(before.table_ids), assignment);
  ok('and changed is FALSE -- staying is not a change', assignment && assignment.changed === false, assignment);
  ok('and moved_count is 0', plan.body.moved_count === 0, plan.body.moved_count);

  await call('POST', `/restaurants/r_1/replans/${plan.body.plan_id}/apply`, { body: {}, token, key: 'k2' });
  const after = (await call('GET', `/reservations/${before.reference}`, { token })).body;
  ok('and after applying, the booking is UNCHANGED', JSON.stringify(after.table_ids) === JSON.stringify(before.table_ids), { before: before.table_ids, after: after.table_ids });
  ok('and its revision did not move -- an unmoved booking gains nothing', after.revision === before.revision, { before: before.revision, after: after.revision });
  const entries = (await call('GET', `/reservations/${before.reference}/history`, { token })).body.entries;
  ok('and it gained NO history entry', entries.length === historyBefore, { before: historyBefore, after: entries.length });
}

console.log(`\n${failures === 0 ? 'all invariants held' : failures + ' FAILURES'}`);
if (failures > 0) process.exitCode = 1;
