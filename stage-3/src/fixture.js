'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const domain = require('./domain');
const { hashPassword, randomId, randomToken } = require('./accounts');
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
  if (has(raw, 'accepted_terms')
      && JSON.stringify(raw.accepted_terms) !== JSON.stringify(derivedTerms)) {
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

// The stage-3 stores. A reset fixture describes users, restaurants and reservations, and it cannot
// describe a published policy, a series, history or a batch counter — /_test/import is the door for
// those, because a document carries them and a hand-written fixture does not.
//
// They were previously accepted and silently dropped, which is the worst outcome available: the
// reset answered 204, the author believed they had seeded a policy, and every assertion they then
// wrote was quietly about policy 0 with nothing red. A capability a fixture cannot express has to be
// a refusal the author sees.
const STAGE3_FIXTURE_KEYS = ['policies', 'series', 'history', 'batch_counters'];

function refuseStage3State(fixture) {
  for (const key of STAGE3_FIXTURE_KEYS) {
    if (has(fixture, key)) {
      fail('fixture_unsupported', { field: key, reason: 'stage3_state_not_seedable' });
    }
  }
}

async function stateFromFixture(fixture, nowMs) {
  expectObject(fixture, 'fixture');
  refuseStage3State(fixture);
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

  return state;
}

module.exports = {
  STAGE3_FIXTURE_KEYS,
  refuseStage3State,
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