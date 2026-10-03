// Probe suite for stage 3's non-screen surface: policies, availability explanations,
// accepted terms, reservation history and recurring series.
//
// The ten standing clauses, restated here because a convention in a header does not travel into
// new code by itself. Every one of them was added after a real reading error on this build.
//
//  1. Assert the injected fault or the setup step actually happened before asserting the product's
//     reaction to it.
//  2. Assert the shape of what you read before concluding from it. A missing key is not a zero.
//  3. Measure against the surface the thing is actually drawn on; follow the mechanism, not the
//     element type.
//  4. An instrument that looks at the wrong element inverts rather than merely misses.
//  5. A single keystroke is not a state transition when the control holds several stops.
//  6. For every state asserted in one direction, assert the transition back.
//  7. Presence and wording are separate failures, and "absent" means absent from the document.
//  8. A comparison that cannot distinguish the two cases is vacuous however green it is.
//  9. Reasoning about a path instead of driving it is the same error wearing better manners.
// 10. Every mechanism added on a story must have that story re-derived when its surroundings
//     change — and removing a mechanism can uncover the defects it was covering.
//
// What is deliberately NOT done here: no row concludes from a field the response also reports.
// `explain` is checked against a capacity and an occupancy recomputed from the fixture, history is
// checked against the revision that resulted from its own event, and an occurrence's dates are
// recomputed in this file from the anchor's local date rather than read back from the service.

import { strict as assert } from 'node:assert';

const BASE = process.env.TK_BASE_URL || 'http://localhost:8080';

let failures = 0;
let rows = 0;

async function call(method, path, { body, token, key } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['Idempotency-Key'] = key;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, body: parsed };
}

async function row(name, fn) {
  rows += 1;
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}: ${error && error.message ? error.message : error}`);
  }
}

const HOURS_THU = [{ weekday: 'thu', opens: '18:00', closes: '23:00' }];

function fixture(reservations = [], managers = ['u_ada']) {
  const restaurant = {
    id: 'r_anker',
    name: 'Zum Anker',
    timezone: 'Europe/Berlin',
    slot_minutes: 30,
    reservation_duration_minutes: 90,
    cancellation_cutoff_minutes: 120,
    opening_hours: HOURS_THU,
    tables: [
      { id: 't_1', label: '1', capacity: 2 },
      { id: 't_2', label: '2', capacity: 4 },
    ],
    combinable: [['t_1', 't_2']],
  };
  if (managers) restaurant.manager_user_ids = managers;
  return {
    users: [
      { id: 'u_ada', email: 'ada@example.com', password: 'correct horse', display_name: 'Ada' },
      { id: 'u_bob', email: 'bob@example.com', password: 'correct horse', display_name: 'Bob' },
    ],
    restaurants: [restaurant],
    reservations,
  };
}

function completePolicy(overrides = {}) {
  return {
    effective_from: '2026-12-01',
    slot_minutes: 30,
    reservation_duration_minutes: 90,
    cancellation_cutoff_minutes: 120,
    opening_hours: HOURS_THU,
    capacities: { t_1: 2, t_2: 4 },
    ...overrides,
  };
}

async function seed(reservations = [], managers) {
  await call('POST', '/_test/reset', { body: fixture(reservations, managers) });
}

async function tokenFor(email) {
  const { body } = await call('POST', '/auth/login', {
    body: { email, password: 'correct horse' },
  });
  // Clause 2: the shape of what I read is asserted before I conclude from it.
  assert.ok(body && typeof body.token === 'string', 'login returned a token');
  return body.token;
}

let keyCounter = 0;
function nextKey(label) {
  keyCounter += 1;
  return `probe-${label}-${keyCounter}`;
}

async function book(token, at, tableId, partySize, key) {
  return call('POST', '/reservations', {
    body: { restaurant_id: 'r_anker', table_id: tableId, starts_at_local: at, party_size: partySize },
    token,
    key: key || nextKey('book'),
  });
}

async function publish(token, policy, key) {
  return call('POST', '/restaurants/r_anker/policies', {
    body: policy,
    token,
    key: key || nextKey('pol'),
  });
}

async function availability(date, partySize, explain) {
  const suffix = explain ? '&explain=true' : '';
  const { status, body } = await call(
    'GET',
    `/availability?restaurant_id=r_anker&date=${date}&party_size=${partySize}${suffix}`,
  );
  assert.equal(status, 200, 'availability answered 200');
  return body;
}

async function historyOf(reference, token) {
  const { status, body } = await call('GET', `/reservations/${reference}/history`, { token });
  assert.equal(status, 200, 'history answered 200');
  assert.ok(body && Array.isArray(body.entries), 'history body carries an entries array');
  return body.entries;
}

async function run() {
  // ---------------------------------------------------------------- publishing policies
  await row('S3-020 a fixture without manager_user_ids publishes nothing', async () => {
    await seed([], null);
    const ada = await tokenFor('ada@example.com');
    const { status } = await publish(ada, completePolicy());
    assert.equal(status, 403);
  });

  await row('S3-021 no token 401, non-manager 403 forbidden, unknown restaurant 404', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const bob = await tokenFor('bob@example.com');
    const policy = completePolicy();
    const anon = await call('POST', '/restaurants/r_anker/policies', { body: policy, key: 'a' });
    assert.equal(anon.status, 401);
    const refused = await publish(bob, policy);
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error.code, 'forbidden');
    const unknown = await call('POST', '/restaurants/r_nope/policies', { body: policy, token: ada, key: 'b' });
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error.code, 'not_found');
    const listed = await call('GET', '/restaurants/r_anker/policies');
    assert.equal(listed.body.policies.length, 0, 'a 403 created no policy');
  });

  await row('S3-025 versions start at 1 and increase by one per restaurant', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const first = await publish(ada, completePolicy(), 'v1');
    assert.equal(first.status, 201);
    assert.equal(first.body.policy_version, 1);
    assert.equal(typeof first.body.policy_version, 'number');
    assert.ok(!('effective_from' in first.body), 'effective_from is not echoed');
    const second = await publish(ada, completePolicy(), 'v2');
    assert.equal(second.body.policy_version, 2);
  });

  await row('S3-024 a policy is complete, and omitting any field is 422', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    for (const field of Object.keys(completePolicy())) {
      const partial = completePolicy();
      delete partial[field];
      const { status } = await publish(ada, partial);
      assert.equal(status, 422, `omitting ${field} is 422`);
    }
    const listed = await call('GET', '/restaurants/r_anker/policies');
    assert.equal(listed.body.policies.length, 0, 'no partial application happened');
  });

  await row('S3-026 a refused write allocates no version', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    await publish(ada, completePolicy(), 'ok1');
    const refused = await publish(ada, completePolicy({ slot_minutes: 0 }), 'bad');
    assert.equal(refused.status, 422);
    const next = await publish(ada, completePolicy(), 'ok2');
    assert.equal(next.body.policy_version, 2, 'the next valid publication is 2, with no gap');
  });

  await row('S3-023 an idempotency key replays and a changed body is refused', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const first = await publish(ada, completePolicy(), 'same');
    assert.equal(first.status, 201);
    const replay = await publish(ada, completePolicy(), 'same');
    assert.equal(replay.status, 200, 'a replay answers 200');
    assert.deepEqual(replay.body, first.body, 'the replay body is byte-identical');
    const listed = await call('GET', '/restaurants/r_anker/policies');
    assert.equal(listed.body.policies.length, 1, 'the replay allocated no version');
    const changed = await publish(ada, completePolicy({ slot_minutes: 60 }), 'same');
    assert.equal(changed.status, 409);
    assert.equal(changed.body.error.code, 'idempotency_key_reuse');
  });

  await row('S3-033 grid and duration are integers in 1..1440 and a cutoff in 0..10080', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    for (const value of [0, 1441, 30.5, '30', true]) {
      const { status } = await publish(ada, completePolicy({ slot_minutes: value }));
      assert.equal(status, 422, `slot_minutes ${JSON.stringify(value)} is 422`);
    }
    for (const value of [-1, 10081, true]) {
      const { status } = await publish(ada, completePolicy({ cancellation_cutoff_minutes: value }));
      assert.equal(status, 422, `cancellation_cutoff_minutes ${JSON.stringify(value)} is 422`);
    }
    for (const value of ['2026-13-01', '2026-02-30', '2026-9-1', '24/09/2026', 'today']) {
      const { status } = await publish(ada, completePolicy({ effective_from: value }));
      assert.equal(status, 422, `effective_from ${value} is 422`);
    }
    assert.equal((await publish(ada, completePolicy({ slot_minutes: 1 }), 'b1')).status, 201);
    assert.equal((await publish(ada, completePolicy({ slot_minutes: 1440 }), 'b2')).status, 201);
    assert.equal((await publish(ada, completePolicy({ cancellation_cutoff_minutes: 0 }), 'b3')).status, 201);
    assert.equal((await publish(ada, completePolicy({ cancellation_cutoff_minutes: 10080 }), 'b4')).status, 201);
  });

  await row('S3-035 capacities names exactly the tables, each 1..100', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const cases = [
      [{ t_1: 2 }, 'a missing table id'],
      [{ t_1: 2, t_2: 4, t_9: 4 }, 'an unknown table id'],
      [{ t_1: 0, t_2: 4 }, 'a capacity of 0'],
      [{ t_1: 101, t_2: 4 }, 'a capacity of 101'],
      [{ t_1: 1.5, t_2: 4 }, 'a fractional capacity'],
      [{ t_1: true, t_2: 4 }, 'a boolean capacity'],
    ];
    for (const [capacities, label] of cases) {
      const { status } = await publish(ada, completePolicy({ capacities }));
      assert.equal(status, 422, `${label} is 422`);
    }
  });

  await row('S3-029 and S3-030 selection is by local date, ties by greatest version', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    await publish(ada, completePolicy({ effective_from: '2026-10-01', slot_minutes: 30 }), 'p1');
    await publish(ada, completePolicy({ effective_from: '2026-09-01', slot_minutes: 60 }), 'p2');
    const listed = await call('GET', '/restaurants/r_anker/policies');
    assert.deepEqual(
      listed.body.policies.map((p) => p.effective_from),
      ['2026-10-01', '2026-09-01'],
      'the list is in publication order, not effective-date order',
    );
    const before = await availability('2026-08-27', 4, false);
    assert.equal(before.slots[1].starts_at_local.slice(11), '18:30', 'a date before every policy is policy 0');
    const middle = await availability('2026-09-24', 4, false);
    assert.equal(middle.slots[1].starts_at_local.slice(11), '19:00', 'a 60-minute grid was selected');
    await publish(ada, completePolicy({ effective_from: '2026-09-01', slot_minutes: 15 }), 'p3');
    const tie = await availability('2026-09-24', 4, false);
    assert.equal(tie.slots[1].starts_at_local.slice(11), '18:15', 'the tie went to the greater version');
    const explained = await availability('2026-09-24', 4, true);
    assert.equal(explained.slots[0].explain[0].policy_version, 3, 'explain reports the selected version');
  });

  await row('S3-037 and S3-039 a policy cannot change tables and a misspelling is not applied', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const withExtras = completePolicy({
      tables: [{ id: 't_9', capacity: 99 }],
      timezone: 'Asia/Tokyo',
      future_field: { anything: true },
      slot_minute: 15,
    });
    const { status } = await publish(ada, withExtras, 'x1');
    assert.equal(status, 201, 'unknown fields are ignored rather than refused');
    const detail = await call('GET', '/restaurants/r_anker');
    assert.equal(detail.body.timezone, 'Europe/Berlin', 'the timezone is the fixture\'s');
    assert.deepEqual(detail.body.tables.map((t) => t.id), ['t_1', 't_2'], 'the tables are the fixture\'s');
    const avail = await availability('2026-09-24', 4, false);
    assert.equal(avail.slots[1].starts_at_local.slice(11), '18:30', 'the misspelled slot_minute did not apply');
  });

  // ---------------------------------------------------------------- availability explanations
  await row('S3-001 explain has exactly one accepted value', async () => {
    await seed();
    for (const value of ['false', '1', '0', 'TRUE', 'yes', '', 'true%20']) {
      const { status, body } = await call(
        'GET',
        `/availability?restaurant_id=r_anker&date=2026-09-24&party_size=4&explain=${value}`,
      );
      assert.equal(status, 422, `explain=${value} is 422`);
      assert.equal(body.error.code, 'validation_failed');
    }
    const asked = await call('GET', '/availability?restaurant_id=r_anker&date=2026-09-24&party_size=4&explain=true');
    assert.equal(asked.status, 200);
    const absent = await call('GET', '/availability?restaurant_id=r_anker&date=2026-09-24&party_size=4');
    assert.equal(absent.status, 200);
  });

  await row('S3-002 without explain the response keeps stage 1 shape exactly', async () => {
    await seed();
    const plain = await availability('2026-09-24', 4, false);
    assert.ok(!('explain' in plain), 'no top-level explain key');
    for (const slot of plain.slots) assert.ok(!('explain' in slot), 'no per-slot explain key');
    const explained = await availability('2026-09-24', 4, true);
    assert.deepEqual(
      plain.slots.map((s) => s.available_table_ids),
      explained.slots.map((s) => s.available_table_ids),
      'available_table_ids is identical with and without explain',
    );
  });

  await row('S3-003 every table appears once, in fixture order', async () => {
    await seed();
    const slot = (await availability('2026-09-24', 4, true)).slots[0];
    const singles = slot.explain.filter((e) => 'table_id' in e);
    assert.deepEqual(singles.map((e) => e.table_id), ['t_1', 't_2'], 'fixture order');
    assert.equal(new Set(singles.map((e) => e.table_id)).size, singles.length, 'no duplicate table_id');
    const available = singles.filter((e) => e.available).map((e) => e.table_id);
    assert.deepEqual(available, slot.available_table_ids, 'the available ids are exactly available_table_ids, in order');
  });

  await row('S3-004 and S3-005 both rules are reported and available is their conjunction', async () => {
    await seed();
    for (const entry of (await availability('2026-09-24', 4, true)).slots[0].explain) {
      if (!('table_id' in entry)) continue;
      assert.deepEqual(entry.rules.map((r) => r.rule), ['capacity', 'no_overlap'], 'rule order');
      assert.equal(entry.rules.length, 2, 'no rule omitted');
      assert.equal(
        entry.available,
        entry.rules[0].holds && entry.rules[1].holds,
        'available equals both rules holding',
      );
    }
  });

  await row('S3-007 capacity holds exactly when the party fits', async () => {
    await seed();
    const caps = { t_1: 2, t_2: 4 };
    for (const party of [2, 3, 5]) {
      const slot = (await availability('2026-09-24', party, true)).slots[0];
      for (const entry of slot.explain) {
        if (!('table_id' in entry)) continue;
        const capacity = caps[entry.table_id];
        const holds = party <= capacity;
        const reported = entry.rules.find((r) => r.rule === 'capacity').holds;
        assert.equal(reported, holds, `${entry.table_id} at party ${party}`);
      }
    }
  });

  await row('S3-006 no_overlap is half-open and ignores a cancelled booking', async () => {
    await seed();
    // A 60-minute duration so the 18:00 slot ends exactly at 19:00, which is the boundary the row
    // names. Recomputed here rather than assumed, because the boundary only exists at that duration.
    const restaurant = fixture([]);
    restaurant.restaurants[0].reservation_duration_minutes = 60;
    await call('POST', '/_test/reset', { body: restaurant });
    // The token is taken after this reset: a token minted against the previous state belongs to a
    // store that no longer exists, and every later call with it would be reading nothing.
    const ada = await tokenFor('ada@example.com');
    const book60 = await book(ada, '2026-12-24T19:00', 't_1', 2, 'occ');
    assert.equal(book60.status, 201);
    // Re-read on every call rather than reading a snapshot: after the cancellation the same slot must
    // be asked again, and a captured snapshot would report the answer from before it.
    const read = async (hhmm) => {
      const slots = (await availability('2026-12-24', 2, true)).slots;
      const slot = slots.find((s) => s.starts_at_local.slice(11) === hhmm);
      const entry = slot.explain.find((e) => e.table_id === 't_1');
      return entry.rules.find((r) => r.rule === 'no_overlap').holds;
    };
    assert.equal(await read('19:00'), false, 'the overlapping slot does not hold');
    assert.equal(await read('18:00'), true, 'a slot ending exactly at the start does hold');
    assert.equal(await read('20:00'), true, 'a slot starting exactly at the end does hold');
    const reference = book60.body.reference;
    const cancelled = await call('POST', `/reservations/${reference}/cancel`, { token: ada });
    // Clause 1: assert the setup step happened before asserting the reaction to it. A 409 here would
    // mean the booking was never cancelled, and the reading after it would be silently meaningless.
    assert.equal(cancelled.status, 200, 'the cancellation actually happened');
    assert.equal(await read('19:00'), true, 'a cancelled booking no longer overlaps');
  });

  await row('S3-008 a closed day still returns an empty slots array', async () => {
    await seed();
    const closed = await availability('2026-09-23', 4, true);
    assert.ok('slots' in closed, 'the slots key is present');
    assert.deepEqual(closed.slots, []);
  });

  await row('S3-009 a fully booked day still renders every slot with a full explain', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    for (const [index, hour] of ['18:00', '19:00', '20:00', '21:00'].entries()) {
      await book(ada, `2026-09-24T${hour}`, 't_1', 2, `f${index}`);
      await book(ada, `2026-09-24T${hour}`, 't_2', 4, `g${index}`);
    }
    const avail = await availability('2026-09-24', 2, true);
    assert.ok(avail.slots.length > 0, 'the slots were not dropped');
    const slot = avail.slots.find((s) => s.starts_at_local.slice(11) === '19:00');
    assert.deepEqual(slot.available_table_ids, [], 'no table is available');
    assert.ok(slot.explain.length >= 2, 'every table is still explained');
    for (const entry of slot.explain) assert.equal(entry.rules.length, 2, 'both rules are present');
  });

  // ---------------------------------------------------------------- accepted terms and revision
  await row('S3-050 every reservation gains revision and a six-key accepted_terms', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 't1');
    assert.equal(created.status, 201);
    assert.equal(created.body.revision, 1);
    assert.equal(typeof created.body.revision, 'number');
    const terms = created.body.accepted_terms;
    assert.ok(terms && typeof terms === 'object', 'accepted_terms is present');
    assert.ok(!('effective_from' in terms), 'effective_from is deliberately excluded');
    for (const field of ['policy_version', 'slot_minutes', 'reservation_duration_minutes',
      'cancellation_cutoff_minutes', 'opening_hours', 'capacities']) {
      assert.ok(field in terms, `accepted_terms carries ${field}`);
    }
    assert.equal(Object.keys(terms).length, 6, 'exactly six keys');
  });

  await row('S3-051 accepted terms are a snapshot, not a live read', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    await publish(ada, completePolicy({ reservation_duration_minutes: 45 }), 's1');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 's2');
    const before = JSON.stringify(created.body.accepted_terms);
    await publish(ada, completePolicy({ reservation_duration_minutes: 120 }), 's2');
    const after = await call('GET', `/reservations/${created.body.reference}`, { token: ada });
    assert.equal(JSON.stringify(after.body.accepted_terms), before, 'a later publication changed nothing');
  });

  await row('S3-052 a seeded booking starts at revision 1 under policy 0', async () => {
    await seed([{ restaurant_id: 'r_anker', table_id: 't_2', starts_at_local: '2026-12-24T19:00', party_size: 4, user_id: 'u_ada' }]);
    const ada = await tokenFor('ada@example.com');
    const mine = await call('GET', '/reservations', { token: ada });
    assert.equal(mine.body.reservations[0].revision, 1);
    assert.equal(mine.body.reservations[0].accepted_terms.policy_version, 0);
  });

  await row('S3-055 the cutoff checked is the one the diner accepted', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'c1');
    await publish(ada, completePolicy({ cancellation_cutoff_minutes: 5 }), 'c2');
    const amended = await call('PATCH', `/reservations/${created.body.reference}`, {
      body: { party_size: 3 },
      token: ada,
    });
    assert.equal(amended.status, 200, 'the accepted 120-minute cutoff still governs');
  });

  await row('S3-057 an amendment across a boundary re-adopts terms and the end time', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'm1');
    await publish(ada, completePolicy({ effective_from: '2026-12-25', reservation_duration_minutes: 30 }), 'm2');
    const amended = await call('PATCH', `/reservations/${created.body.reference}`, {
      body: { starts_at_local: '2026-12-31T19:00' },
      token: ada,
    });
    assert.equal(amended.status, 200);
    assert.equal(amended.body.revision, 2, 'revision increments exactly once');
    assert.equal(amended.body.accepted_terms.policy_version, 1, "the resulting date's policy was adopted");
    assert.equal(amended.body.ends_at.slice(11, 16), '19:30', 'the end time uses that policy\'s duration');
  });

  await row('S3-058 a no-op amendment retains everything and consumes no revision', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'n1');
    const noop = await call('PATCH', `/reservations/${created.body.reference}`, {
      body: { party_size: 4 },
      token: ada,
    });
    assert.equal(noop.status, 200);
    assert.equal(noop.body.revision, 1, 'the revision did not move');
    assert.equal((await historyOf(created.body.reference, ada)).length, 1, 'and no history entry was written');
  });

  await row('S3-059 and S3-060 cancel increments once and a repeat does nothing', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'k1');
    const first = await call('POST', `/reservations/${created.body.reference}/cancel`, { token: ada });
    assert.equal(first.body.revision, 2);
    const again = await call('POST', `/reservations/${created.body.reference}/cancel`, { token: ada });
    assert.equal(again.body.revision, 2, 'a repeated cancel does not increment again');
    const entries = await historyOf(created.body.reference, ada);
    assert.equal(entries.filter((e) => e.event === 'cancelled').length, 1, 'no second cancelled entry');
  });

  await row('S3-061 expected_revision is checked before the cutoff and validated', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'e1');
    const stale = await call('PATCH', `/reservations/${created.body.reference}`, {
      body: { party_size: 2, expected_revision: 99 },
      token: ada,
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'stale_revision');
    for (const value of [0, -1, '1', 1.5, true]) {
      const bad = await call('PATCH', `/reservations/${created.body.reference}`, {
        body: { party_size: 2, expected_revision: value },
        token: ada,
      });
      assert.equal(bad.status, 422, `expected_revision ${JSON.stringify(value)} is 422`);
    }
  });

  await row('S3-062 two parallel amendments on one revision: one wins, one is stale', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'r1');
    const path = `/reservations/${created.body.reference}`;
    // Genuinely parallel: two requests in flight at once, not a sequential replay. A loop of awaits
    // cannot see this race, which is the whole content of the row.
    const [a, b] = await Promise.all([
      call('PATCH', path, { body: { party_size: 2, expected_revision: 1 }, token: ada }),
      call('PATCH', path, { body: { party_size: 3, expected_revision: 1 }, token: ada }),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409], 'exactly one succeeded');
    const current = await call('GET', path, { token: ada });
    assert.equal(current.body.revision, 2, 'the final revision is 2');
    const entries = await historyOf(created.body.reference, ada);
    assert.equal(entries.filter((e) => e.event === 'changed').length, 1, 'exactly one changed entry');
  });

  await row('S3-063 unknown fields stay ignored and the real one applies', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'i1');
    const patched = await call('PATCH', `/reservations/${created.body.reference}`, {
      body: { party_size: 3, colour: 'blue', table_idd: 't_9' },
      token: ada,
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.party_size, 3, 'the real field applied');
    assert.deepEqual(patched.body.table_ids, ['t_2'], 'the misspelled table field did not move the table');
  });

  // ---------------------------------------------------------------- history
  await row('S3-070 to S3-077 history is ordered, sequenced and records only real changes', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'h1');
    const reference = created.body.reference;
    let entries = await historyOf(reference, ada);
    assert.deepEqual(entries.map((e) => e.seq), [1], 'seq starts at 1');
    assert.equal(entries[0].event, 'created');
    assert.deepEqual(
      entries[0].changes.map((c) => c.field),
      ['table_id', 'starts_at_local', 'party_size'],
      'a creation names three fields in order',
    );
    assert.ok(entries[0].changes.every((c) => c.from === null), 'each from is null');
    await call('PATCH', `/reservations/${reference}`, { body: { party_size: 2 }, token: ada });
    entries = await historyOf(reference, ada);
    assert.deepEqual(entries.map((e) => e.seq), [1, 2], 'seq increments by exactly one');
    assert.deepEqual(entries[1].changes.map((c) => c.field), ['party_size'], 'only the changed field is named');
    await call('PATCH', `/reservations/${reference}`, { body: { party_size: 2 }, token: ada });
    entries = await historyOf(reference, ada);
    assert.deepEqual(entries.map((e) => e.seq), [1, 2], 'a no-op consumed no seq');
    await call('PATCH', `/reservations/${reference}`, { body: { party_size: 3 }, token: ada });
    entries = await historyOf(reference, ada);
    assert.deepEqual(entries.map((e) => e.seq), [1, 2, 3], 'the later real amendment is previous + 1');
    await call('POST', `/reservations/${reference}/cancel`, { token: ada });
    entries = await historyOf(reference, ada);
    assert.equal(entries[entries.length - 1].event, 'cancelled');
    assert.deepEqual(entries[entries.length - 1].changes, [], 'cancelled carries an empty changes array');
    const after = await call('PATCH', `/reservations/${reference}`, { body: { party_size: 4 }, token: ada });
    assert.equal(after.status, 409, 'amending a cancelled booking is refused');
    entries = await historyOf(reference, ada);
    assert.equal(entries[entries.length - 1].seq, 4, 'nothing follows the cancellation');
  });

  await row('S3-071 and S3-081 history is owner-only and anonymous reads 404', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const bob = await tokenFor('bob@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'o1');
    const reference = created.body.reference;
    assert.equal((await call('GET', `/reservations/${reference}/history`, { token: ada })).status, 200);
    const stranger = await call('GET', `/reservations/${reference}/history`, { token: bob });
    assert.equal(stranger.status, 404);
    assert.equal(stranger.body.error.code, 'not_found');
    const anonymous = await call('GET', `/reservations/${reference}/history`);
    assert.equal(anonymous.status, 404, 'no token is 404, not stage 1\'s 401');
    const missing = await call('GET', '/reservations/ZZZZZZ/history', { token: bob });
    assert.equal(missing.status, 404);
    const strangerMessage = stranger.body.error.message.split(reference).join('<ref>');
    const missingMessage = missing.body.error.message.split('ZZZZZZ').join('<ref>');
    assert.equal(strangerMessage, missingMessage, 'a stranger and a missing reference answer identically');
  });

  await row('S3-079 each entry carries the revision and terms its own event produced', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    await publish(ada, completePolicy({ effective_from: '2026-12-25', reservation_duration_minutes: 30 }), 'q1');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'q2');
    await call('PATCH', `/reservations/${created.body.reference}`, {
      body: { starts_at_local: '2026-12-31T19:00' },
      token: ada,
    });
    const entries = await historyOf(created.body.reference, ada);
    assert.equal(entries[0].accepted_terms.policy_version, 0, 'entry 1 keeps the old terms');
    assert.equal(entries[1].accepted_terms.policy_version, 1, 'entry 2 carries the new terms');
    assert.deepEqual(entries.map((e) => e.revision), [1, 2], 'each entry carries its own resulting revision');
  });

  await row('S3-078 replaying a booking key records nothing', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const first = await book(ada, '2026-12-24T19:00', 't_2', 4, 'rep');
    const replay = await book(ada, '2026-12-24T19:00', 't_2', 4, 'rep');
    assert.equal(replay.status, 200);
    const entries = await historyOf(first.body.reference, ada);
    assert.equal(entries.length, 1, 'exactly one created entry');
    assert.equal(entries[0].event, 'created');
  });

  await row('S3-080 decision returns exactly three keys for the current booking', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const bob = await tokenFor('bob@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'd1');
    const decision = await call('GET', `/reservations/${created.body.reference}/decision`, { token: ada });
    assert.equal(decision.status, 200);
    assert.deepEqual(Object.keys(decision.body).sort(), ['accepted_terms', 'reference', 'revision']);
    const reservation = await call('GET', `/reservations/${created.body.reference}`, { token: ada });
    assert.deepEqual(
      decision.body.accepted_terms,
      reservation.body.accepted_terms,
      'the terms are the booking\'s, not the policy\'s',
    );
    assert.equal((await call('GET', `/reservations/${created.body.reference}/decision`, { token: bob })).status, 404);
    await call('POST', `/reservations/${created.body.reference}/cancel`, { token: ada });
    const after = await call('GET', `/reservations/${created.body.reference}/decision`, { token: ada });
    assert.equal(after.status, 200, 'decision still answers after cancellation');
    assert.equal(after.body.revision, 2, 'with the incremented revision');
  });

  // ---------------------------------------------------------------- recurring series
  await row('S3-100 to S3-111 adoption, occurrence zero and the generated dates', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 's1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 4, interval_weeks: 2 },
      token: ada,
      key: 'k1',
    });
    assert.equal(adopted.status, 201);
    const occurrences = adopted.body.occurrences;
    assert.equal(occurrences.length, 4, 'occurrences length equals count');
    assert.deepEqual(occurrences.map((o) => o.index), [0, 1, 2, 3], 'index is 0..count-1 in order');
    assert.equal(occurrences[0].reservation.reference, anchor.body.reference, 'occurrence zero is the anchor');
    // S3-105/S3-111: the shape, not just the value. An occurrence names its reference beside index and
    // exception, so a probe reading the level the specification shows must find it there. Reading the
    // nested reservation instead would pass while the field a client reads is absent.
    for (const occurrence of occurrences) {
      assert.deepEqual(
        Object.keys(occurrence).sort(),
        ['exception', 'index', 'reference', 'reservation'],
        'an occurrence carries exactly index, reference, exception and reservation',
      );
      assert.equal(typeof occurrence.reference, 'string', 'the occurrence-level reference is a string');
      assert.equal(
        occurrence.reference,
        occurrence.reservation.reference,
        'the occurrence-level reference is the same value as the nested reservation\'s',
      );
    }
    assert.equal(new Set(occurrences.map((o) => o.reference)).size, 4, 'the occurrence references are distinct');
    assert.equal(new Set(occurrences.map((o) => o.reservation.reference)).size, 4, 'references are distinct');
    // The dates are recomputed here from the anchor's local date, not read back from the service.
    const expected = [0, 14, 28, 42].map((days) => new Date(Date.UTC(2026, 11, 24) + days * 86400000).toISOString().slice(0, 10));
    assert.deepEqual(
      occurrences.map((o) => o.reservation.starts_at_local.slice(0, 10)),
      expected,
      'anchor + i * interval_weeks * 7 days',
    );
    assert.ok(
      occurrences.every((o) => o.reservation.starts_at_local.slice(11) === '19:00'),
      'the local clock time is unchanged',
    );
    assert.ok(
      occurrences.every((o) => o.reservation.table_id === 't_2' && o.reservation.party_size === 4),
      "the anchor's table and party size are reused",
    );
    assert.equal(occurrences[0].exception, false);
    const after = await call('GET', `/reservations/${anchor.body.reference}`, { token: ada });
    assert.equal(after.body.revision, anchor.body.revision, "the anchor's revision is unchanged");
    assert.equal(after.body.created_at, anchor.body.created_at, "the anchor's timestamp is unchanged");
  });

  await row('S3-105 an occurrence names its reference even when its reservation is absent', async () => {
    // The occurrence reference is emitted from the series record rather than read back off the
    // reservation, so it survives a reservation that is not there. Every other assertion in this file
    // has a reservation behind every occurrence, which means without this row the design could be
    // replaced by a lookup and nothing here would notice.
    await seed();
    const ada = await tokenFor('ada@example.com');
    const anchorBooking = await book(ada, '2026-12-24T19:00', 't_2', 4, 'abs1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchorBooking.body.reference, count: 3, interval_weeks: 1 },
      token: ada, key: 'abs2',
    });
    assert.equal(adopted.status, 201);
    const expected = adopted.body.occurrences.map((o) => o.reference);
    // A document whose series record names reservations that are not present: the record survives and
    // the reservations do not, which is the only way to reach the case from outside.
    const exported = await call('GET', '/_test/export');
    assert.equal(exported.status, 200);
    const document = exported.body;
    document.state.reservations = document.state.reservations.filter(
      (r) => r.reference === expected[0],
    );
    const imported = await call('POST', '/_test/import', { body: document });
    assert.equal(imported.status, 204, 'a series may name reservations that are not present');
    const read = await call('GET', `/series/${adopted.body.series_id}`, { token: ada });
    assert.equal(read.status, 200);
    const occurrences = read.body.occurrences;
    assert.equal(occurrences.length, 3, 'every occurrence is still listed');
    assert.deepEqual(
      occurrences.map((o) => o.reservation),
      [occurrences[0].reservation, null, null],
      'the two whose reservations are gone read reservation: null',
    );
    assert.deepEqual(
      occurrences.map((o) => o.reference),
      expected,
      'and every occurrence still names its own reference with nothing behind it',
    );
    for (const occurrence of occurrences) {
      assert.ok('reference' in occurrence, 'the key is on the occurrence, not borrowed from a nested object');
    }
  });

  await row('S3-112 occurrences are ordinary reservations', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const bob = await tokenFor('bob@example.com');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'p1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: 1 },
      token: ada,
      key: 'k2',
    });
    const generated = adopted.body.occurrences[1].reservation.reference;
    const mine = await call('GET', '/reservations', { token: ada });
    const references = mine.body.reservations.map((r) => r.reference);
    for (const occurrence of adopted.body.occurrences) {
      assert.ok(references.includes(occurrence.reservation.reference), 'the occurrence is in the reservation list');
    }
    const entries = await historyOf(generated, ada);
    assert.equal(entries[0].event, 'created', 'a generated occurrence has an ordinary history');
    assert.equal((await call('GET', `/reservations/${generated}/history`, { token: bob })).status, 404);
    const generatedDate = adopted.body.occurrences[1].reservation.starts_at_local.slice(0, 10);
    const avail = await availability(generatedDate, 4, false);
    const slot = avail.slots.find((s) => s.starts_at_local.slice(11) === '19:00');
    assert.ok(!slot.available_table_ids.includes('t_2'), 'the occurrence occupies its table');
  });

  await row('S3-113 a series is readable only by its owner', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const bob = await tokenFor('bob@example.com');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'q1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: 1 },
      token: ada,
      key: 'k3',
    });
    const id = adopted.body.series_id;
    assert.equal((await call('GET', `/series/${id}`, { token: ada })).status, 200);
    assert.equal((await call('GET', `/series/${id}`, { token: bob })).status, 404);
    assert.equal((await call('GET', `/series/${id}`)).status, 404);
    assert.equal((await call('GET', '/series/ser_absent', { token: ada })).status, 404);
  });

  await row('S3-114 a real amendment is a permanent exception; a no-op and a failure are not', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'e1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 3, interval_weeks: 1 },
      token: ada,
      key: 'k4',
    });
    const id = adopted.body.series_id;
    const target = adopted.body.occurrences[1].reservation.reference;
    await call('PATCH', `/reservations/${target}`, { body: { party_size: 2 }, token: ada });
    let series = await call('GET', `/series/${id}`, { token: ada });
    assert.equal(series.body.occurrences[1].exception, true, 'the occurrence is an exception');
    assert.equal(series.body.revision, 2, 'the series revision moved once');
    const revision = series.body.revision;
    await call('PATCH', `/reservations/${target}`, { body: { party_size: 2 }, token: ada });
    series = await call('GET', `/series/${id}`, { token: ada });
    assert.equal(series.body.revision, revision, 'a no-op changed nothing');
    await call('PATCH', `/reservations/${target}`, { body: { party_size: 99 }, token: ada });
    series = await call('GET', `/series/${id}`, { token: ada });
    assert.equal(series.body.revision, revision, 'a failed amendment changed nothing');
    assert.equal(series.body.occurrences[1].exception, true, 'the exception is permanent');
  });

  await row('S3-115 cancelling an occurrence retains it without marking an exception', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'f1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 3, interval_weeks: 1 },
      token: ada,
      key: 'k5',
    });
    const id = adopted.body.series_id;
    const target = adopted.body.occurrences[2].reservation.reference;
    const before = (await call('GET', `/series/${id}`, { token: ada })).body.revision;
    await call('POST', `/reservations/${target}/cancel`, { token: ada });
    let series = await call('GET', `/series/${id}`, { token: ada });
    assert.equal(series.body.occurrences.length, 3, 'the occurrence is retained');
    const entry = series.body.occurrences[2];
    assert.equal(entry.reservation.status, 'cancelled', 'reported with its current status');
    assert.equal(entry.exception, false, 'a cancellation is not an exception');
    assert.equal(series.body.revision, before + 1, 'the series revision moved once');
    await call('POST', `/reservations/${target}/cancel`, { token: ada });
    series = await call('GET', `/series/${id}`, { token: ada });
    assert.equal(series.body.revision, before + 1, 'a repeated cancel does nothing');
  });

  await row('S3-116 cancelling the anchor leaves its siblings confirmed', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'g1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 4, interval_weeks: 1 },
      token: ada,
      key: 'k6',
    });
    await call('POST', `/reservations/${anchor.body.reference}/cancel`, { token: ada });
    const series = await call('GET', `/series/${adopted.body.series_id}`, { token: ada });
    assert.deepEqual(
      series.body.occurrences.map((o) => o.reservation.status),
      ['cancelled', 'confirmed', 'confirmed', 'confirmed'],
      'every sibling is still confirmed',
    );
  });

  await row('S3-102 and S3-103 adoption refusals and boundaries', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const bob = await tokenFor('bob@example.com');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'h1');
    await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: 1 },
      token: ada,
      key: 'ad1',
    });
    const again = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: 1 },
      token: ada,
      key: 'ad2',
    });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'already_in_series', 'a new key cannot explain the refusal');
    const replay = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: 1 },
      token: ada,
      key: 'ad1',
    });
    assert.equal(replay.status, 200, 'the same key replays');
    const unknown = await call('POST', '/series', {
      body: { anchor_reference: 'ZZZZZZ', count: 2, interval_weeks: 1 }, token: ada, key: 'ad3',
    });
    assert.equal(unknown.status, 404);
    const foreign = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: 1 }, token: bob, key: 'ad4',
    });
    assert.equal(foreign.status, 404, "another owner's anchor is 404");
    const anonymous = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: 1 }, key: 'ad5',
    });
    assert.equal(anonymous.status, 401);
  });

  await row('S3-103 count and interval_weeks accept their boundaries', async () => {
    const badCounts = [1, 13, 0, -1, 2.5, '8', true];
    const badIntervals = [0, 5, 1.5, '1', false];
    let index = 0;
    for (const value of badCounts) {
      await seed();
      const ada = await tokenFor('ada@example.com');
      const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, `bc${index++}`);
      const { status } = await call('POST', '/series', {
        body: { anchor_reference: anchor.body.reference, count: value, interval_weeks: 1 },
        token: ada, key: `bc${index}`,
      });
      assert.equal(status, 422, `count ${JSON.stringify(value)} is 422`);
    }
    for (const value of badIntervals) {
      await seed();
      const ada = await tokenFor('ada@example.com');
      const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, `bi${index++}`);
      const { status } = await call('POST', '/series', {
        body: { anchor_reference: anchor.body.reference, count: 2, interval_weeks: value },
        token: ada, key: `bi${index}`,
      });
      assert.equal(status, 422, `interval_weeks ${JSON.stringify(value)} is 422`);
    }
    for (const [count, weeks] of [[2, 1], [2, 4], [12, 4]]) {
      await seed();
      const ada = await tokenFor('ada@example.com');
      const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, `ok${index++}`);
      const { status } = await call('POST', '/series', {
        body: { anchor_reference: anchor.body.reference, count, interval_weeks: weeks },
        token: ada, key: `ok${index}`,
      });
      assert.equal(status, 201, `count=${count} interval=${weeks} is accepted`);
    }
  });

  await row('S3-107 each occurrence selects its own date policy and duration', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    await publish(ada, completePolicy({ effective_from: '2027-01-01', reservation_duration_minutes: 30 }), 'pol');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'c1');
    const adopted = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 3, interval_weeks: 1 },
      token: ada, key: 'k7',
    });
    const versions = [];
    const ends = [];
    for (const occurrence of adopted.body.occurrences) {
      const reservation = await call('GET', `/reservations/${occurrence.reservation.reference}`, { token: ada });
      versions.push(reservation.body.accepted_terms.policy_version);
      ends.push(reservation.body.ends_at.slice(11, 16));
    }
    assert.deepEqual(versions, [0, 0, 1], 'the series straddles the policy boundary');
    assert.deepEqual(ends, ['20:30', '20:30', '19:30'], "each end time uses its own policy's duration");
  });

  await row('S3-109 a failing occurrence leaves nothing behind and a replay is a first use', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    await publish(ada, completePolicy({ effective_from: '2026-12-25', capacities: { t_1: 1, t_2: 1 } }), 'shrink');
    const anchor = await book(ada, '2026-12-24T19:00', 't_2', 4, 'c2');
    const before = (await call('GET', '/reservations', { token: ada })).body.reservations.length;
    const failed = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 3, interval_weeks: 1 },
      token: ada, key: 'fail1',
    });
    assert.equal(failed.status, 422, 'the first failing occurrence\'s ordinary booking error');
    assert.equal(failed.body.error.code, 'party_exceeds_capacity');
    const after = (await call('GET', '/reservations', { token: ada })).body.reservations.length;
    assert.equal(after, before, 'no generated occurrence survived');
    const retry = await call('POST', '/series', {
      body: { anchor_reference: anchor.body.reference, count: 3, interval_weeks: 1 },
      token: ada, key: 'fail1',
    });
    assert.equal(retry.status, 422, 'a replay of the failed key is treated as a first use, not a 200');
    assert.equal(
      (await call('GET', '/reservations', { token: ada })).body.reservations.length,
      before,
      'and the retry created nothing either',
    );
  });

  // ---------------------------------------------------------------- combined tables and moves
  await row('S3-130 a pair\'s capacity is the selected policy\'s sum', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const slot = (await availability('2026-09-24', 5, true)).slots[0];
    const pair = slot.explain.find((e) => Array.isArray(e.table_ids));
    assert.ok(pair, 'the declared pair is explained as its own entry');
    assert.equal(pair.capacity, 6, 'under policy 0 the pair sums to 6');
    assert.equal(pair.available, true, 'a party of 5 fits under policy 0');
    await publish(ada, completePolicy({ effective_from: '2026-09-01', capacities: { t_1: 2, t_2: 2 } }), 'pair1');
    const after = (await availability('2026-09-24', 5, true)).slots[0];
    const shrunk = after.explain.find((e) => Array.isArray(e.table_ids));
    assert.equal(shrunk.capacity, 4, 'the published policy sums to 4, not the fixture\'s 6');
    assert.equal(shrunk.available, false, 'so a party of 5 no longer fits');
    const refused = await book(ada, '2026-09-24T19:00', 't_1', 5, 'pair2');
    assert.equal(refused.status, 422, 'a party of 5 is refused once the pair is smaller');
  });

  await row('S3-132 to S3-134 pair history names table_ids and a reversed set is not a change', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'pair3');
    await call('POST', `/reservations/${created.body.reference}/cancel`, { token: ada });
    await seed();
    const ada2 = await tokenFor('ada@example.com');
    const pair = await call('POST', '/reservations', {
      body: { restaurant_id: 'r_anker', table_ids: ['t_2', 't_1'], starts_at_local: '2026-12-24T19:00', party_size: 4 },
      token: ada2, key: 'pair4',
    });
    assert.equal(pair.status, 201, JSON.stringify(pair.body));
    let entries = await historyOf(pair.body.reference, ada2);
    const fields = entries[0].changes.map((c) => c.field);
    assert.deepEqual(fields, ['table_ids', 'starts_at_local', 'party_size'], 'a pair creation names table_ids');
    assert.ok(!fields.includes('table_id'), 'and does not also name table_id');
    assert.deepEqual(
      entries[0].changes[0].to,
      ['t_1', 't_2'],
      'in the combination order the restaurant declared, not the order the caller typed',
    );
    const reversed = await call('PATCH', `/reservations/${pair.body.reference}`, {
      body: { table_ids: ['t_1', 't_2'] }, token: ada2,
    });
    assert.equal(reversed.status, 200);
    assert.equal(reversed.body.revision, 1, 'a reversed pair is not an amendment');
    entries = await historyOf(pair.body.reference, ada2);
    assert.equal(entries.length, 1, 'and records no new history entry');
  });

  await row('S3-136 a move batch validates each expected_revision and refuses the whole batch', async () => {
    await seed();
    const ada = await tokenFor('ada@example.com');
    const created = await book(ada, '2026-12-24T19:00', 't_2', 4, 'mv1');
    const stale = await call('POST', '/reservation-moves', {
      body: { moves: [{ reference: created.body.reference, table_id: 't_1', expected_revision: 99 }] },
      token: ada, key: 'mv2',
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'stale_revision');
    for (const value of ['1', true]) {
      const bad = await call('POST', '/reservation-moves', {
        body: { moves: [{ reference: created.body.reference, table_id: 't_1', expected_revision: value }] },
        token: ada, key: `mv-${String(value)}`,
      });
      assert.equal(bad.status, 422, `expected_revision ${JSON.stringify(value)} is 422`);
    }
    const unchanged = await call('GET', `/reservations/${created.body.reference}`, { token: ada });
    assert.equal(unchanged.body.revision, 1, 'the refused batch moved nothing');
  });

  console.log(`\n${rows - failures}/${rows} rows passed`);
  if (failures > 0) process.exitCode = 1;
}

await run();