'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const domain = require('./domain');
const { hashPassword, randomId, randomToken } = require('./accounts');
const policyRules = require('./policy');
const { has, isPlainObject, normaliseEmail, MAX_ID_LENGTH } = require('./fields');

const REFERENCE_PATTERN = /^[A-Z0-9]{6,12}$/;

function expectObject(value, field) {
  if (!isPlainObject(value)) fail('malformed_request', { field });
  return value;
}

function expectArray(value, field) {
  if (!Array.isArray(value)) fail('malformed_request', { field });
  return value;
}

function fixtureArray(container, name) {
  if (!has(container, name)) return [];
  return expectArray(container[name], name);
}

function fixtureId(value, field) {
  if (typeof value !== 'string') fail('malformed_request', { field });
  if (value.length === 0 || value.length > MAX_ID_LENGTH) fail('validation_failed', { field });
  return value;
}

function integerAtLeast(value, field, minimum) {
  if (typeof value !== 'number') fail('malformed_request', { field });
  if (!Number.isInteger(value) || value < minimum) fail('validation_failed', { field });
  return value;
}

function textOr(value, fallback, field) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') fail('malformed_request', { field });
  return value;
}

function parseOpeningHours(raw) {
  return fixtureArray({ opening_hours: raw }, 'opening_hours').map((entry) => {
    expectObject(entry, 'opening_hours');
    const weekday = entry.weekday;
    if (typeof weekday !== 'string') fail('malformed_request', { field: 'weekday' });
    const name = weekday.toLowerCase();
    if (!time.WEEKDAY_NAMES.includes(name)) fail('validation_failed', { field: 'weekday' });
    const opens = time.parseHhmm(entry.opens);
    const closes = time.parseHhmm(entry.closes);
    if (opens === null || closes === null) fail('validation_failed', { field: 'opening_hours' });
    if (closes <= opens) fail('validation_failed', { field: 'opening_hours' });
    return { weekday: name, opens: entry.opens, closes: entry.closes };
  });
}

function parseTables(raw) {
  const tables = fixtureArray({ tables: raw }, 'tables').map((entry) => {
    expectObject(entry, 'tables');
    const id = fixtureId(entry.id, 'table_id');
    const capacity = integerAtLeast(entry.capacity, 'capacity', 1);
    return { id, label: textOr(entry.label, id, 'label'), capacity };
  });
  const seen = new Set();
  for (const table of tables) {
    if (seen.has(table.id)) fail('validation_failed', { field: 'table_id' });
    seen.add(table.id);
  }
  return tables;
}

// A restaurant declares the pairs of its own tables that may be booked together. Entries are
// unordered pairs of two, never three, and both members have to be tables the restaurant actually
// has. A malformed declaration is refused here rather than quietly dropped, so a fixture cannot
// claim a pair the service will then refuse at the counter with a different reason.
function parseCombinable(raw, tables) {
  const tableIds = new Set(tables.map((table) => table.id));
  const entries = fixtureArray({ combinable: raw }, 'combinable');
  const seen = new Set();
  const pairs = [];
  for (const entry of entries) {
    if (!Array.isArray(entry)) fail('malformed_request', { field: 'combinable' });
    if (entry.length !== 2) fail('validation_failed', { field: 'combinable', reason: 'pairs_only' });
    for (const member of entry) {
      if (typeof member !== 'string') fail('malformed_request', { field: 'combinable' });
    }
    if (entry[0] === entry[1]) fail('validation_failed', { field: 'combinable', reason: 'pairs_only' });
    for (const member of entry) {
      if (!tableIds.has(member)) fail('validation_failed', { field: 'combinable', reason: 'unknown_table' });
    }
    // Order is the restaurant's, so t_1+t_2 and t_2+t_1 are the same pair declared once.
    const key = entry[0] < entry[1] ? `${entry[0]}\u0000${entry[1]}` : `${entry[1]}\u0000${entry[0]}`;
    if (seen.has(key)) fail('validation_failed', { field: 'combinable', reason: 'duplicate_pair' });
    seen.add(key);
    pairs.push([entry[0], entry[1]]);
  }
  return pairs;
}

// manager_user_ids defaults to [] so a fixture that never mentions it publishes nothing, and a
// restaurant with no declared manager answers 403 to every publication attempt (S3-020).
function parseManagerUserIds(raw) {
  if (!has(raw, 'manager_user_ids')) return [];
  const value = raw.manager_user_ids;
  if (!Array.isArray(value)) fail('malformed_request', { field: 'manager_user_ids' });
  const seen = new Set();
  for (const entry of value) {
    const id = fixtureId(entry, 'manager_user_ids');
    if (seen.has(id)) fail('validation_failed', { field: 'manager_user_ids' });
    seen.add(id);
  }
  return value.slice();
}

function parseRestaurant(raw) {
  expectObject(raw, 'restaurants');
  const id = fixtureId(raw.id, 'restaurant_id');
  const name = textOr(raw.name, id, 'name');
  if (typeof raw.timezone !== 'string') fail('malformed_request', { field: 'timezone' });
  if (!time.isValidTimeZone(raw.timezone)) fail('validation_failed', { field: 'timezone' });
  const slotMinutes = integerAtLeast(raw.slot_minutes, 'slot_minutes', 1);
  const duration = integerAtLeast(raw.reservation_duration_minutes, 'reservation_duration_minutes', 1);
  const cutoff = raw.cancellation_cutoff_minutes === undefined
    ? 0
    : integerAtLeast(raw.cancellation_cutoff_minutes, 'cancellation_cutoff_minutes', 0);
  const tables = parseTables(raw.tables);
  return {
    id,
    name,
    timezone: raw.timezone,
    slot_minutes: slotMinutes,
    reservation_duration_minutes: duration,
    cancellation_cutoff_minutes: cutoff,
    opening_hours: parseOpeningHours(raw.opening_hours),
    tables,
    combinable: parseCombinable(raw.combinable, tables),
    manager_user_ids: parseManagerUserIds(raw),
  };
}

function parseUser(raw, takenIds, takenEmails) {
  expectObject(raw, 'users');
  const email = normaliseEmail(raw.email, 'email');
  if (takenEmails.has(email)) fail('validation_failed', { field: 'email' });
  const id = raw.id === undefined ? randomId('u_') : fixtureId(raw.id, 'user_id');
  if (takenIds.has(id)) fail('validation_failed', { field: 'user_id' });
  const password = raw.password === undefined ? randomToken() : textOr(raw.password, null, 'password');
  const displayName = textOr(raw.display_name, email.split('@')[0], 'display_name');
  return { id, email, display_name: displayName, password, password_hash: null };
}

function requireReference(raw) {
  if (typeof raw !== 'string' || !REFERENCE_PATTERN.test(raw)) {
    fail('validation_failed', { field: 'reference' });
  }
  return raw;
}

function parseSeededReservation(raw, state, nowMs) {
  expectObject(raw, 'reservations');
  const restaurantId = fixtureId(raw.restaurant_id, 'restaurant_id');
  const restaurant = store.findRestaurant(state, restaurantId);
  if (!restaurant) fail('validation_failed', { field: 'restaurant_id' });
  const tableIds = domain.resolveSeededTableIds(raw, restaurant);
  if (!has(raw, 'starts_at_local')) fail('validation_failed', { field: 'starts_at_local' });
  const wall = time.parseWall(raw.starts_at_local);
  if (!wall) fail('validation_failed', { field: 'starts_at_local' });
  const startMs = domain.resolveStartMs(restaurant, wall);
  const partySize = raw.party_size === undefined ? 1 : integerAtLeast(raw.party_size, 'party_size', 1);
  const status = raw.status === 'cancelled' ? 'cancelled' : 'confirmed';
  const userId = raw.user_id === undefined ? null : fixtureId(raw.user_id, 'user_id');
  const reference = raw.reference === undefined ? store.allocateReference(state) : requireReference(raw.reference);
  if (store.isReferenceTaken(state, reference)) fail('validation_failed', { field: 'reference' });
  const id = raw.id === undefined ? store.allocateReservationId(state) : fixtureId(raw.id, 'reservation_id');
  if (state.reservations.some((reservation) => reservation.id === id)) {
    fail('validation_failed', { field: 'reservation_id' });
  }
  const createdAt = textOr(raw.created_at, time.formatUtc(nowMs), 'created_at');
  // A seeded booking was accepted under the rules the fixture declares, which is policy 0 by
  // definition, and it starts at revision 1 (S3-052). Both are therefore derived here rather than
  // read from the fixture, and a fixture that tries to assert either is refused instead.
  //
  // The two arrival paths must not be able to disagree about what a booking is. The import path
  // derives policy-0 terms for a document that carries none, and this path may not produce the
  // booking the import path would refuse: a reservation asserting revision 5 with null terms is a
  // booking that obeys rules it was never created under. Coercing the terms while keeping the
  // revision would reintroduce that defect through this door, so it is refused rather than coerced.
  const policyRules = require('./policy');
  const derivedTerms = policyRules.acceptedTermsOf(policyRules.policyZeroOf(restaurant));
  if (has(raw, 'revision') && raw.revision !== 1) {
    fail('fixture_unsupported', { field: 'reservations', reason: 'revision_not_seedable' });
  }
  // A declared accepted_terms is refused outright rather than compared against the derivation.
  //
  // Comparing was worse in both directions and had a third failure the comparison could not have. It
  // refused a semantically identical object whose keys were in another order, which is a refusal the
  // author cannot account for. And it would have broken every such fixture at once the moment
  // acceptedTermsOf gained a field, refusing them for something that did not change: the two only
  // coincide while the derived serialisation is stable.
  //
  // There is nothing to compare. The seeder always derives the terms from the fixture's own rules,
  // so a declared object can only ever be a second, divergent claim about the same booking. Refusing
  // it leaves one rule and no equality surface at all.
  if (has(raw, 'accepted_terms')) {
    // SABOTAGE SEED 1 (S4-152): a refusal that mutates. The reference counter is moved BEFORE the
    // refusal, so the route returns its error having already written state. Named exactly so it is not
    // confused with stage 3's fixture-refusal half-application debt, which is seed 2 and is separate.
    store.allocateReference(state);
    fail('fixture_unsupported', { field: 'reservations', reason: 'terms_not_seedable' });
  }
  if (has(raw, 'series_id') || has(raw, 'series_index')) {
    fail('fixture_unsupported', { field: 'reservations', reason: 'series_not_seedable' });
  }
  return {
    id,
    reference,
    user_id: userId,
    restaurant_id: restaurantId,
    table_ids: tableIds,
    party_size: partySize,
    status,
    starts_at_local: time.wallToString(wall),
    starts_at_ms: startMs,
    ends_at_ms: startMs + restaurant.reservation_duration_minutes * domain.MILLIS_PER_MINUTE,
    created_at: createdAt,
    revision: 1,
    accepted_terms: derivedTerms,
    series_id: null,
    series_index: null,
  };
}

// The stores added for policies, series, history and the batch counter. A reset fixture describes
// users, restaurants and reservations; these four are seeded here so a row can state the stage-3 world
// it needs instead of expressing it through /_test/import on every request.
//
// They were once accepted and silently dropped, which is the worst outcome available: the reset
// answered 204, the author believed they had seeded a policy, and every assertion they then wrote was
// quietly about policy 0 with nothing red. They were then refused outright, which is legible but leaves
// every row that needs seeded stage-3 state unmeasurable rather than pending. This is the door.
//
// The contract, and the line it draws:
//
//   accept exactly what the stage added as STATE, and nothing it added as DERIVED.
//
// `policies`, `series` and `batch_counters` are state: nothing else in the fixture determines them, so
// the fixture must be able to say them. A reservation's `accepted_terms` and its `revision` are derived
// from the fixture's own rules, and a fixture asserting them is the two-arrival-paths defect with a
// different door — so they are still refused. The dividing line is which of them can be recomputed
// from the others.
//
// Three constraints, each a way a row becomes silently unmeasurable:
//
//   1. Numbers a row asserts on are preserved verbatim. A policy's `policy_version` is NOT renumbered
//      by position, and a history entry's `seq` is not renumbered either: a row asserting that a tie on
//      effective_from goes to the greater version needs two policies sharing a date with distinct
//      versions, and assigning by position would make that row unwritable rather than failing.
//   2. The validation here is the product's own, not a second one. A policy that POST /policies would
//      refuse must be refused by a fixture too, or this door becomes a way in to states the product
//      cannot reach — the "state without a surface" shape inverted.
//   3. Anything still inexpressible is refused rather than dropped. The refusal is not the capability,
//      and removing it would put back the defect that started this.

function requireVersion(raw, field) {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    fail('fixture_unsupported', { field, reason: 'version_not_seedable' });
  }
  return raw;
}

// Every field a policy needs is read through the product's own reader, so a fixture and a publication
// agree on what a complete policy is. Only the version is taken from the fixture rather than allocated,
// because allocating here would renumber a policy the row is asserting about.
function parseFixturePolicies(raw, restaurants) {
  return fixtureArray({ policies: raw }, 'policies').map((entry) => {
    expectObject(entry, 'policies');
    const restaurantId = fixtureId(entry.restaurant_id === undefined ? '' : entry.restaurant_id, 'restaurant_id');
    const restaurant = restaurants.find((candidate) => candidate.id === restaurantId);
    if (!restaurant) fail('validation_failed', { field: 'restaurant_id' });
    const read = policyRules.readCompletePolicy(entry, restaurant);
    read.restaurant_id = restaurant.id;
    read.policy_version = requireVersion(entry.policy_version, 'policies');
    return read;
  });
}

function parseFixtureSeries(raw, users, restaurants) {
  return fixtureArray({ series: raw }, 'series').map((entry) => {
    expectObject(entry, 'series');
    const seriesId = fixtureId(entry.series_id, 'series_id');
    const userId = fixtureId(entry.user_id, 'user_id');
    if (!users.some((user) => user.id === userId)) fail('validation_failed', { field: 'user_id' });
    const restaurantId = fixtureId(entry.restaurant_id, 'restaurant_id');
    if (!restaurants.some((restaurant) => restaurant.id === restaurantId)) {
      fail('validation_failed', { field: 'restaurant_id' });
    }
    const anchor = fixtureId(entry.anchor_reference, 'anchor_reference');
    const count = integerAtLeast(entry.count, 'count', 1);
    const intervalWeeks = integerAtLeast(entry.interval_weeks, 'interval_weeks', 1);
    const revision = entry.revision === undefined ? 1 : requireVersion(entry.revision, 'series');
    const occurrences = fixtureArray(entry, 'occurrences').map((occurrence) => {
      expectObject(occurrence, 'occurrences');
      return {
        // The occurrence's own reference, seeded rather than looked up: after stage 3 it is a field of
        // the occurrence and not a nested read, so a fixture may state it.
        index: integerAtLeast(occurrence.index, 'index', 0),
        reference: fixtureId(occurrence.reference, 'reference'),
        exception: occurrence.exception === true,
      };
    });
    if (occurrences.length !== count) fail('validation_failed', { field: 'occurrences' });
    const indices = occurrences.map((occurrence) => occurrence.index);
    const ordered = indices.slice().sort((a, b) => a - b);
    for (let at = 0; at < ordered.length; at += 1) {
      if (ordered[at] !== at) fail('validation_failed', { field: 'index' });
    }
    return {
      series_id: seriesId,
      user_id: userId,
      restaurant_id: restaurantId,
      anchor_reference: anchor,
      count,
      interval_weeks: intervalWeeks,
      revision,
      occurrences,
      created_at: textOr(entry.created_at, time.formatUtc(Date.now()), 'created_at'),
    };
  });
}

const HISTORY_EVENTS = ['created', 'changed', 'cancelled'];

// History is seeded so a row can state a record it cannot reach by driving. `seq` is preserved per
// reference rather than renumbered, for the same reason a policy's version is: a row asserting a total
// order needs the numbers it is about.
function parseFixtureHistory(raw) {
  return fixtureArray({ history: raw }, 'history').map((entry) => {
    expectObject(entry, 'history');
    const event = entry.event;
    if (!HISTORY_EVENTS.includes(event)) fail('validation_failed', { field: 'event' });
    return {
      reference: fixtureId(entry.reference, 'reference'),
      seq: integerAtLeast(entry.seq, 'seq', 1),
      at: textOr(entry.at, time.formatUtc(Date.now()), 'at'),
      event,
      changes: JSON.parse(JSON.stringify(fixtureArray(entry, 'changes'))),
      revision: requireVersion(entry.revision, 'revision'),
      accepted_terms: JSON.parse(JSON.stringify(entry.accepted_terms)),
    };
  });
}

function parseFixtureBatchCounters(raw) {
  if (!isPlainObject(raw)) fail('malformed_request', { field: 'batch_counters' });
  const counters = {};
  for (const restaurantId of Object.keys(raw)) {
    const value = raw[restaurantId];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      fail('validation_failed', { field: 'batch_counters' });
    }
    counters[restaurantId] = value;
  }
  return counters;
}

function seedStageState(state, fixture) {
  // SABOTAGE SEED 4 (the pre-registered seed): the reset door ACCEPTS the four store keys and silently
  // drops them. This is the stage-3 defect the Adversary's fixture_arrival.py was written about: the reset
  // answers 204, the author believes they seeded a policy, and every assertion they then write is quietly
  // about policy 0 with nothing red.
  //
  // No parser is called. Nothing is refused. The four keys are accepted and ignored, which is the whole
  // shape of the original defect and the reason fixture_arrival.py owes controls asserting the door
  // REFUSES what it cannot seed.
  const policies = [];
  if (false) { policies.length = parseFixturePolicies(fixture.policies, state.restaurants).length; }

  const series = [];
  state.policies = policies;
  // A seeded reservation is parsed before the policies are known, so its terms are derived again here
  // against the policies this same fixture declared. Without this pass a fixture could state a 15-minute
  // policy and a booking under its date and the booking would still carry policy zero's 30 minutes:
  // two halves of one fixture describing different worlds, and a row asserting the terms a booking
  // accepted would be quietly about the wrong policy. The derivation is the product's own and is
  // unconditional, exactly as for an imported reservation — only the rule set it reads from is now the
  // seeded one.
  for (const reservation of state.reservations) {
    const restaurant = state.restaurants.find(
      (candidate) => candidate.id === reservation.restaurant_id,
    );
    const inForce = policyRules.policyForStart(state, restaurant, reservation.starts_at_local);
    reservation.accepted_terms = policyRules.acceptedTermsOf(inForce || policyRules.policyZeroOf(restaurant));
  }

  state.series = series;
  state.history = [];
  state.batch_counters = {};
  // Every seeded occurrence's reservation carries its series identity, so the series and the bookings
  // agree rather than two halves of one fixture describing different worlds.
  const byReference = new Map(state.reservations.map((reservation) => [reservation.reference, reservation]));
  for (const record of state.series) {
    for (const occurrence of record.occurrences) {
      const reservation = byReference.get(occurrence.reference);
      if (!reservation) fail('validation_failed', { field: 'reference' });
      reservation.series_id = record.series_id;
      reservation.series_index = occurrence.index;
    }
  }
}

async function stateFromFixture(fixture, nowMs) {
  expectObject(fixture, 'fixture');
  const state = store.emptyState();

  const takenIds = new Set();
  const takenEmails = new Set();
  for (const raw of fixtureArray(fixture, 'users')) {
    const user = parseUser(raw, takenIds, takenEmails);
    takenIds.add(user.id);
    takenEmails.add(user.email);
    user.password_hash = await hashPassword(user.password);
    delete user.password;
    state.users.push(user);
  }

  const restaurantIds = new Set();
  for (const raw of fixtureArray(fixture, 'restaurants')) {
    const restaurant = parseRestaurant(raw);
    if (restaurantIds.has(restaurant.id)) fail('validation_failed', { field: 'restaurant_id' });
    restaurantIds.add(restaurant.id);
    state.restaurants.push(restaurant);
  }

  for (const raw of fixtureArray(fixture, 'reservations')) {
    state.reservations.push(parseSeededReservation(raw, state, nowMs));
  }

  seedStageState(state, fixture);

  return state;
}

module.exports = {
  parseFixturePolicies,
  parseFixtureSeries,
  parseFixtureHistory,
  parseFixtureBatchCounters,
  seedStageState,
  parseManagerUserIds,
  stateFromFixture,
  expectObject,
  expectArray,
  fixtureArray,
  fixtureId,
  integerAtLeast,
  textOr,
  parseOpeningHours,
  parseTables,
  parseCombinable,
  parseRestaurant,
};