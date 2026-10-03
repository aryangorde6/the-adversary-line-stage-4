'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const { parseRestaurant } = require('./fixture');
const policyRules = require('./policy');
const { isPlainObject, has } = require('./fields');
const domain = require('./domain');

const TRACK = 'tablekeeper';
const FORMAT_VERSION = 1;
const REFERENCE_PATTERN = /^[A-Z0-9]{6,12}$/;

function requireString(value, field, allowEmpty) {
  if (typeof value !== 'string') fail('validation_failed', { field });
  if (!allowEmpty && value.length === 0) fail('validation_failed', { field });
  return value;
}

function requireInteger(value, field) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail('validation_failed', { field });
  return value;
}

// A reservation is stored as a set, and the document says so the same way the API does: table_ids
// always, table_id only when there is one member. Reading a stage 1 export, which carries only
// table_id, therefore keeps working. The other direction cannot: a combined booking has no stage 1
// form, so a stage 2 export naming a pair is not something a stage 1 client can represent.
function snapshotReservation(reservation) {
  const copy = JSON.parse(JSON.stringify(reservation));
  const tableIds = Array.isArray(copy.table_ids) ? copy.table_ids : [];
  delete copy.table_id;
  copy.table_ids = tableIds;
  if (tableIds.length === 1) copy.table_id = tableIds[0];
  return copy;
}

function snapshotState(state) {
  return JSON.parse(
    JSON.stringify({
      users: state.users,
      tokens: state.tokens,
      restaurants: state.restaurants,
      reservations: state.reservations.map(snapshotReservation),
      idempotency: state.idempotency,
      policies: state.policies,
      history: state.history,
      series: state.series,
      batch_counters: state.batch_counters,
    }),
  );
}

function exportDocument(state) {
  return { track: TRACK, format_version: FORMAT_VERSION, state: snapshotState(state) };
}

function validateUsers(raw) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'users' });
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'users' });
    return {
      id: requireString(entry.id, 'user_id'),
      email: requireString(entry.email, 'email'),
      display_name: requireString(entry.display_name, 'display_name', true),
      password_hash: requireString(entry.password_hash, 'password_hash'),
    };
  });
}

function validateTokens(raw) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'tokens' });
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'tokens' });
    return {
      token: requireString(entry.token, 'token'),
      user_id: requireString(entry.user_id, 'user_id'),
    };
  });
}

function validateReservations(raw, restaurants) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'reservations' });
  const references = new Set();
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'reservations' });
    const restaurantId = requireString(entry.restaurant_id, 'restaurant_id');
    const restaurant = restaurants.find((candidate) => candidate.id === restaurantId);
    if (!restaurant) fail('validation_failed', { field: 'restaurant_id' });
    const tableIds = domain.resolveSeededTableIds(entry, restaurant);
    const startsAtLocal = requireString(entry.starts_at_local, 'starts_at_local');
    const wall = time.parseWall(startsAtLocal);
    if (!wall) fail('validation_failed', { field: 'starts_at_local' });
    const startsAtMs = requireInteger(entry.starts_at_ms, 'starts_at_ms');
    const endsAtMs = requireInteger(entry.ends_at_ms, 'ends_at_ms');
    if (endsAtMs <= startsAtMs) fail('validation_failed', { field: 'ends_at_ms' });
    if (time.wallToInstants(restaurant.timezone, wall.y, wall.mo, wall.d, wall.h, wall.mi)[0] !== startsAtMs) {
      fail('validation_failed', { field: 'starts_at_ms' });
    }
    const reference = requireString(entry.reference, 'reference');
    if (!REFERENCE_PATTERN.test(reference) || references.has(reference)) {
      fail('validation_failed', { field: 'reference' });
    }
    references.add(reference);
    const status = entry.status === 'cancelled' ? 'cancelled' : 'confirmed';
    const reservation = {
      id: requireString(entry.id, 'reservation_id'),
      reference,
      user_id: entry.user_id === null ? null : requireString(entry.user_id, 'user_id'),
      restaurant_id: restaurantId,
      table_ids: tableIds,
      party_size: requireInteger(entry.party_size, 'party_size'),
      status,
      starts_at_local: startsAtLocal,
      starts_at_ms: startsAtMs,
      ends_at_ms: endsAtMs,
      created_at: requireString(entry.created_at, 'created_at', true),
      // A stage 1 or stage 2 export has neither field, so both are defaulted here rather than
      // required: that is what lets a stage-2 document import into a stage-3 service unchanged
      // (S3-121), and it is why an imported booking reads as revision 1 under policy 0 (S3-052).
      revision: entry.revision === undefined ? 1 : requireInteger(entry.revision, 'revision'),
      // A stage 1 or stage 2 document carries no terms, so stage 3 derives them the same way a
      // seeded booking does: policy 0, read from the fixture's own rules. Deriving them here rather
      // than leaving them null is what makes an imported booking behave like a seeded one, and
      // S3-121 asks for exactly that — revision 1 under policy-0 terms.
      accepted_terms: entry.accepted_terms === undefined
        ? policyRules.acceptedTermsOf(policyRules.policyZeroOf(restaurant))
        : entry.accepted_terms,
      series_id: entry.series_id === undefined ? null : entry.series_id,
      series_index: entry.series_index === undefined ? null : entry.series_index,
    };
    if (reservation.party_size < 1) fail('validation_failed', { field: 'party_size' });
    if (reservation.revision < 1) fail('validation_failed', { field: 'revision' });
    return reservation;
  });
}

function validateIdempotency(raw) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'idempotency' });
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'idempotency' });
    const status = requireInteger(entry.status, 'status');
    if (!has(entry, 'body')) fail('validation_failed', { field: 'body' });
    if (!has(entry, 'response')) fail('validation_failed', { field: 'response' });
    return {
      user_id: requireString(entry.user_id, 'user_id'),
      key: requireString(entry.key, 'key'),
      method: requireString(entry.method, 'method'),
      path: requireString(entry.path, 'path'),
      body: JSON.parse(JSON.stringify(entry.body)),
      status,
      response: JSON.parse(JSON.stringify(entry.response)),
    };
  });
}

function stateFromDocument(document) {
  if (!isPlainObject(document)) fail('validation_failed', { field: 'document' });
  if (document.track !== TRACK) fail('validation_failed', { field: 'track' });
  if (document.format_version !== FORMAT_VERSION) fail('validation_failed', { field: 'format_version' });
  const raw = document.state;
  if (!isPlainObject(raw)) fail('validation_failed', { field: 'state' });
  const state = store.emptyState();
  state.users = validateUsers(raw.users === undefined ? [] : raw.users);
  state.tokens = validateTokens(raw.tokens === undefined ? [] : raw.tokens);
  state.restaurants = (raw.restaurants === undefined ? [] : raw.restaurants).map(parseRestaurant);
  const restaurantIds = new Set();
  for (const restaurant of state.restaurants) {
    if (restaurantIds.has(restaurant.id)) fail('validation_failed', { field: 'restaurant_id' });
    restaurantIds.add(restaurant.id);
  }
  state.reservations = validateReservations(raw.reservations === undefined ? [] : raw.reservations, state.restaurants);
  state.idempotency = validateIdempotency(raw.idempotency === undefined ? [] : raw.idempotency);
  // The three stage-3 stores and the batch counter are optional in a document, so a stage-1 or
  // stage-2 export imports without them. Each is carried across verbatim rather than re-derived,
  // because a policy's version number and a history entry's seq are promises already made.
  state.policies = raw.policies === undefined ? [] : JSON.parse(JSON.stringify(raw.policies));
  state.history = raw.history === undefined ? [] : JSON.parse(JSON.stringify(raw.history));
  state.series = raw.series === undefined ? [] : JSON.parse(JSON.stringify(raw.series));
  state.batch_counters = raw.batch_counters === undefined
    ? {}
    : JSON.parse(JSON.stringify(raw.batch_counters));
  return state;
}

module.exports = {
  TRACK,
  snapshotReservation,
  FORMAT_VERSION,
  snapshotState,
  exportDocument,
  stateFromDocument,
  validateUsers,
  validateTokens,
  validateReservations,
  validateIdempotency,
  requireString,
  requireInteger,
};